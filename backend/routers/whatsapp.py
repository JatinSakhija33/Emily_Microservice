"""
WhatsApp Router
Handles WhatsApp message sending endpoints
"""

from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import os
import logging
from services.whatsapp_service import WhatsAppService
from supabase import create_client, Client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])
security = HTTPBearer()

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_anon_key = os.getenv("SUPABASE_ANON_KEY")

if not supabase_url or not supabase_anon_key:
    raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY must be set")

supabase: Client = create_client(supabase_url, supabase_anon_key)

# User model
class User(BaseModel):
    id: str
    email: str
    name: str
    created_at: str

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current user from Supabase JWT token"""
    try:
        token = credentials.credentials
        response = supabase.auth.get_user(token)
        
        if not response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials"
            )
        
        # Convert created_at to string if it's a datetime object
        created_at_str = response.user.created_at
        if hasattr(created_at_str, 'isoformat'):
            created_at_str = created_at_str.isoformat()
        else:
            created_at_str = str(created_at_str)
        
        return User(
            id=response.user.id,
            email=response.user.email,
            name=response.user.user_metadata.get("name", response.user.email),
            created_at=created_at_str
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )


class SendMessageRequest(BaseModel):
    phone_number: str
    message: str
    message_type: str = "text"  # "text" or "template"
    template_name: Optional[str] = None
    language_code: Optional[str] = "en"
    template_parameters: Optional[List[Dict[str, Any]]] = None


class SendMessageResponse(BaseModel):
    success: bool
    message_id: Optional[str] = None
    status: Optional[str] = None
    error: Optional[str] = None
    note: Optional[str] = None


@router.post("/send-message", response_model=SendMessageResponse)
async def send_whatsapp_message(
    request: SendMessageRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Send a WhatsApp message to a phone number
    
    Args:
        request: SendMessageRequest with phone_number and message
        current_user: Authenticated user
        
    Returns:
        SendMessageResponse with success status and message_id
    """
    try:
        # Validate phone number format
        phone_number = request.phone_number.strip()
        if not phone_number:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Phone number is required"
            )
        
        # Ensure phone number starts with +
        if not phone_number.startswith("+"):
            phone_number = "+" + phone_number.lstrip("+")
        
        # Initialize WhatsApp service
        whatsapp_service = WhatsAppService()
        
        # Send message based on type
        if request.message_type == "template" and request.template_name:
            # Validate template name
            if not request.template_name.strip():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Template name is required for template messages"
                )
            
            # Send template message
            result = await whatsapp_service.send_template_message(
                user_id=current_user.id,
                phone_number=phone_number,
                template_name=request.template_name,
                language_code=request.language_code or "en",
                template_parameters=request.template_parameters
            )
        else:
            # Validate message for text messages
            message = request.message.strip()
            if not message:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Message is required for text messages"
                )
            
            # Send text message
            result = await whatsapp_service.send_message(
                user_id=current_user.id,
                phone_number=phone_number,
                message=message,
                message_type="text"
            )
        
        if result.get("success"):
            return SendMessageResponse(
                success=True,
                message_id=result.get("message_id"),
                status=result.get("status", "sent")
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=result.get("error", "Failed to send message")
            )
            
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error sending WhatsApp message: {str(e)}"
        )


@router.get("/templates")
async def get_whatsapp_templates(
    current_user: User = Depends(get_current_user)
):
    """
    Get list of approved WhatsApp message templates
    
    Returns:
        List of available templates from Meta API
    """
    try:
        whatsapp_service = WhatsAppService()
        templates = await whatsapp_service.get_templates(current_user.id)
        
        return {
            "success": True,
            "templates": templates,
            "count": len(templates)
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error fetching WhatsApp templates: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching templates: {str(e)}"
        )

