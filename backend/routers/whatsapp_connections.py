"""
WhatsApp Business Connections Router
Handles WhatsApp Business API OAuth connections and management
"""

from fastapi import APIRouter, Depends, HTTPException, status, Header, Query
from fastapi.responses import HTMLResponse, RedirectResponse
import os
import json
import secrets
import string
import logging
import requests
from typing import Dict, Any, Optional
from datetime import datetime
from supabase import create_client, Client
from cryptography.fernet import Fernet
from dotenv import load_dotenv
from pydantic import BaseModel

# Load environment variables
load_dotenv()

# Configure logger
logger = logging.getLogger(__name__)

# Get Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_anon_key = os.getenv("SUPABASE_ANON_KEY")
supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not supabase_url or not supabase_anon_key:
    raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY must be set")

# Create client with anon key for user authentication
supabase: Client = create_client(supabase_url, supabase_anon_key)

# Create admin client for database operations
if supabase_service_key:
    supabase_admin: Client = create_client(supabase_url, supabase_service_key)
else:
    supabase_admin = supabase  # Fallback to anon client

router = APIRouter(prefix="/connections/whatsapp", tags=["whatsapp-connections"])

# WhatsApp Business API Configuration
WHATSAPP_APP_ID = os.getenv("WHATSAPP_APP_ID")
WHATSAPP_APP_SECRET = os.getenv("WHATSAPP_APP_SECRET")
WHATSAPP_API_VERSION = os.getenv("WHATSAPP_API_VERSION", "v21.0")

# OAuth URLs
WHATSAPP_AUTH_URL = f"https://www.facebook.com/{WHATSAPP_API_VERSION}/dialog/oauth"
WHATSAPP_TOKEN_URL = f"https://graph.facebook.com/{WHATSAPP_API_VERSION}/oauth/access_token"
WHATSAPP_GRAPH_URL = f"https://graph.facebook.com/{WHATSAPP_API_VERSION}"

# User model
class User(BaseModel):
    id: str
    email: str
    name: str
    created_at: str

def get_current_user(authorization: str = Header(None)):
    """Get current user from Supabase JWT token"""
    try:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authorization header missing or invalid"
            )

        # Extract token
        token = authorization.split(" ")[1]

        # Try to get user info from Supabase using the token
        try:
            user_response = supabase.auth.get_user(token)

            if user_response and hasattr(user_response, 'user') and user_response.user:
                user_data = user_response.user
                return User(
                    id=user_data.id,
                    email=user_data.email or "unknown@example.com",
                    name=user_data.user_metadata.get('name', user_data.email or "Unknown User"),
                    created_at=user_data.created_at.isoformat() if hasattr(user_data.created_at, 'isoformat') else str(user_data.created_at)
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token"
                )
        except Exception as e:
            logger.error(f"Error validating token: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token validation failed"
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting current user: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed"
        )

def encrypt_token(token: str) -> str:
    """Encrypt token for storage"""
    key = os.getenv('ENCRYPTION_KEY')
    if not key:
        raise ValueError("ENCRYPTION_KEY not found")

    f = Fernet(key.encode())
    return f.encrypt(token.encode()).decode()

def decrypt_token(encrypted_token: str) -> str:
    """Decrypt token for use"""
    key = os.getenv('ENCRYPTION_KEY')
    if not key:
        raise ValueError("ENCRYPTION_KEY not found")

    f = Fernet(key.encode())
    return f.decrypt(encrypted_token.encode()).decode()

@router.post("/initiate")
async def initiate_whatsapp_connection(current_user: User = Depends(get_current_user)):
    """
    Initiate WhatsApp Business API OAuth connection
    """
    try:
        if not WHATSAPP_APP_ID:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="WhatsApp App ID not configured"
            )

        # Generate state parameter for CSRF protection
        state = secrets.token_urlsafe(32)

        # Store state in database for verification
        state_data = {
            "user_id": current_user.id,
            "state": state,
            "platform": "whatsapp",
            "created_at": datetime.now().isoformat(),
            "expires_at": (datetime.now().replace(hour=23, minute=59, second=59)).isoformat()
        }

        try:
            supabase_admin.table("oauth_states").insert(state_data).execute()
        except Exception as e:
            logger.warning(f"Failed to store OAuth state: {e}")

        # WhatsApp Business API scopes
        scopes = [
            "whatsapp_business_management",
            "whatsapp_business_messaging"
        ]

        # Build authorization URL
        auth_url = (
            f"{WHATSAPP_AUTH_URL}?"
            f"client_id={WHATSAPP_APP_ID}&"
            f"redirect_uri={os.getenv('WHATSAPP_REDIRECT_URI', 'https://agent-emily.onrender.com/connections/whatsapp/callback')}&"
            f"scope={','.join(scopes)}&"
            f"response_type=code&"
            f"state={state}"
        )

        logger.info(f"Initiating WhatsApp OAuth for user {current_user.id}")

        return {
            "success": True,
            "auth_url": auth_url,
            "message": "Redirecting to WhatsApp Business API for authorization"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error initiating WhatsApp connection: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initiate WhatsApp connection: {str(e)}"
        )

@router.get("/callback")
async def whatsapp_oauth_callback(
    code: str = Query(None),
    state: str = Query(None),
    error: str = Query(None),
    error_description: str = Query(None)
):
    """
    Handle WhatsApp Business API OAuth callback
    """
    try:
        # Check for OAuth errors
        if error:
            error_msg = error_description or error
            logger.error(f"WhatsApp OAuth error: {error_msg}")

            # Redirect to frontend with error
            frontend_url = os.getenv("FRONTEND_URL", "https://emily.atsnai.com")
            return RedirectResponse(
                url=f"{frontend_url}/settings?error={error_msg}",
                status_code=302
            )

        if not code or not state:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing authorization code or state parameter"
            )

        # Verify state parameter
        try:
            state_record = supabase_admin.table("oauth_states").select("*").eq("state", state).eq("platform", "whatsapp").execute()

            if not state_record.data:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid state parameter"
                )

            state_data = state_record.data[0]
            user_id = state_data["user_id"]

            # Clean up used state
            supabase_admin.table("oauth_states").delete().eq("state", state).execute()

        except Exception as e:
            logger.error(f"State verification failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="State verification failed"
            )

        # Exchange authorization code for access token
        token_data = {
            "client_id": WHATSAPP_APP_ID,
            "client_secret": WHATSAPP_APP_SECRET,
            "code": code,
            "redirect_uri": os.getenv('WHATSAPP_REDIRECT_URI', 'https://agent-emily.onrender.com/connections/whatsapp/callback')
        }

        token_response = requests.post(WHATSAPP_TOKEN_URL, data=token_data, timeout=30)

        if not token_response.ok:
            logger.error(f"Token exchange failed: {token_response.text}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to exchange authorization code for access token"
            )

        token_json = token_response.json()
        access_token = token_json.get("access_token")

        if not access_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No access token received from WhatsApp"
            )

        # Get user's WhatsApp Business Accounts
        headers = {"Authorization": f"Bearer {access_token}"}

        # First, get the user's business accounts
        business_accounts_url = f"{WHATSAPP_GRAPH_URL}/me/businesses"
        business_response = requests.get(business_accounts_url, headers=headers, timeout=30)

        if not business_response.ok:
            logger.error(f"Failed to get business accounts: {business_response.text}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to retrieve WhatsApp Business accounts"
            )

        business_data = business_response.json()
        business_accounts = business_data.get("data", [])

        if not business_accounts:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No WhatsApp Business accounts found. Please create a WhatsApp Business account first."
            )

        # For each business account, get WhatsApp Business Accounts
        whatsapp_accounts = []
        for business in business_accounts:
            business_id = business.get("id")

            # Get WhatsApp Business Accounts for this business
            waba_url = f"{WHATSAPP_GRAPH_URL}/{business_id}/whatsapp_business_accounts"
            waba_response = requests.get(waba_url, headers=headers, timeout=30)

            if waba_response.ok:
                waba_data = waba_response.json()
                for waba in waba_data.get("data", []):
                    waba_id = waba.get("id")

                    # Get phone numbers for this WhatsApp Business Account
                    phones_url = f"{WHATSAPP_GRAPH_URL}/{waba_id}/phone_numbers"
                    phones_response = requests.get(phones_url, headers=headers, timeout=30)

                    if phones_response.ok:
                        phones_data = phones_response.json()
                        for phone in phones_data.get("data", []):
                            whatsapp_accounts.append({
                                "business_account_id": business_id,
                                "whatsapp_business_account_id": waba_id,
                                "phone_number_id": phone.get("id"),
                                "phone_number": phone.get("display_phone_number"),
                                "verified_name": phone.get("verified_name")
                            })

        if not whatsapp_accounts:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No verified WhatsApp phone numbers found. Please verify a phone number in your WhatsApp Business account."
            )

        # Use the first available WhatsApp account (user can manage multiple later if needed)
        account = whatsapp_accounts[0]

        # Store the connection in database
        connection_data = {
            "user_id": user_id,
            "phone_number_id": account["phone_number_id"],
            "access_token_encrypted": encrypt_token(access_token),
            "business_account_id": account["business_account_id"],
            "whatsapp_business_account_id": account["whatsapp_business_account_id"],
            "phone_number_display": account["phone_number"],
            "is_active": True,
            "verified_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }

        # Check if connection exists
        existing = supabase_admin.table("whatsapp_connections").select("*").eq("user_id", user_id).eq("phone_number_id", account["phone_number_id"]).execute()

        if existing.data and len(existing.data) > 0:
            # Update existing connection
            supabase_admin.table("whatsapp_connections").update(connection_data).eq("id", existing.data[0]["id"]).execute()
            logger.info(f"Updated WhatsApp connection for user {user_id}")
        else:
            # Create new connection
            supabase_admin.table("whatsapp_connections").insert(connection_data).execute()
            logger.info(f"Created WhatsApp connection for user {user_id}")

        # Redirect to frontend with success
        frontend_url = os.getenv("FRONTEND_URL", "https://emily.atsnai.com")
        return RedirectResponse(
            url=f"{frontend_url}/settings?success=WhatsApp Business account connected successfully!",
            status_code=302
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in WhatsApp OAuth callback: {e}")

        # Redirect to frontend with error
        frontend_url = os.getenv("FRONTEND_URL", "https://emily.atsnai.com")
        return RedirectResponse(
            url=f"{frontend_url}/settings?error=Failed to connect WhatsApp Business account",
            status_code=302
        )

@router.get("/connection-status")
async def get_whatsapp_connection_status(current_user: User = Depends(get_current_user)):
    """
    Get WhatsApp connection status for the current user
    """
    try:
        # Check if user has an active WhatsApp connection
        result = supabase_admin.table("whatsapp_connections").select("*").eq("user_id", current_user.id).eq("is_active", True).execute()

        if result.data and len(result.data) > 0:
            connection = result.data[0]
            return {
                "connected": True,
                "phone_number": connection.get("phone_number_display"),
                "phone_number_id": connection.get("phone_number_id"),
                "business_account_id": connection.get("business_account_id"),
                "whatsapp_business_account_id": connection.get("whatsapp_business_account_id"),
                "connected_at": connection.get("verified_at"),
                "status": "connected"
            }
        else:
            return {
                "connected": False,
                "status": "not_connected"
            }

    except Exception as e:
        logger.error(f"Error checking WhatsApp connection status: {e}")
        return {
            "connected": False,
            "status": "error",
            "error": str(e)
        }

@router.delete("/disconnect")
async def disconnect_whatsapp(current_user: User = Depends(get_current_user)):
    """
    Disconnect WhatsApp Business account
    """
    try:
        # Deactivate the connection
        result = supabase_admin.table("whatsapp_connections").update({
            "is_active": False,
            "updated_at": datetime.now().isoformat()
        }).eq("user_id", current_user.id).eq("is_active", True).execute()

        if result.data and len(result.data) > 0:
            return {
                "success": True,
                "message": "WhatsApp Business account disconnected successfully"
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No active WhatsApp connection found"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error disconnecting WhatsApp: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to disconnect WhatsApp: {str(e)}"
        )