"""
WhatsApp Business API Service
Handles sending messages, webhook verification, and connection management
"""

import os
import requests
import hmac
import hashlib
import json
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
from supabase import create_client
from cryptography.fernet import Fernet

logger = logging.getLogger(__name__)

class WhatsAppService:
    def __init__(self):
        self.supabase_url = os.getenv("SUPABASE_URL")
        self.supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if not self.supabase_url or not self.supabase_key:
            raise ValueError("Supabase credentials not configured")
        
        self.supabase = create_client(self.supabase_url, self.supabase_key)
        self.webhook_secret = os.getenv("WHATSAPP_WEBHOOK_SECRET", "")
        self.api_version = os.getenv("WHATSAPP_API_VERSION", "v21.0")
    
    def encrypt_token(self, token: str) -> str:
        """Encrypt token for storage"""
        key = os.getenv('ENCRYPTION_KEY')
        if not key:
            raise ValueError("ENCRYPTION_KEY not found")
        
        f = Fernet(key.encode())
        return f.encrypt(token.encode()).decode()
    
    def decrypt_token(self, encrypted_token: str) -> str:
        """Decrypt token for use"""
        key = os.getenv('ENCRYPTION_KEY')
        if not key:
            raise ValueError("ENCRYPTION_KEY not found")
        
        f = Fernet(key.encode())
        return f.decrypt(encrypted_token.encode()).decode()
    
    def get_whatsapp_connection(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get active WhatsApp connection for user"""
        try:
            result = self.supabase.table("whatsapp_connections").select("*").eq("user_id", user_id).eq("is_active", True).execute()
            
            if result.data and len(result.data) > 0:
                return result.data[0]
            return None
        except Exception as e:
            logger.error(f"Error getting WhatsApp connection: {e}")
            return None
    
    def create_or_update_whatsapp_connection(
        self,
        user_id: str,
        phone_number_id: str,
        access_token: str,
        business_account_id: Optional[str] = None,
        whatsapp_business_account_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create or update WhatsApp connection for user"""
        try:
            encrypted_token = self.encrypt_token(access_token)
            
            # Check if connection exists
            existing = self.supabase.table("whatsapp_connections").select("*").eq("user_id", user_id).eq("phone_number_id", phone_number_id).execute()
            
            connection_data = {
                "user_id": user_id,
                "phone_number_id": phone_number_id,
                "access_token_encrypted": encrypted_token,
                "business_account_id": business_account_id,
                "whatsapp_business_account_id": whatsapp_business_account_id,
                "is_active": True,
                "verified_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat()
            }
            
            if existing.data and len(existing.data) > 0:
                # Update existing connection
                result = self.supabase.table("whatsapp_connections").update(connection_data).eq("id", existing.data[0]["id"]).execute()
                logger.info(f"Updated WhatsApp connection for user {user_id}")
            else:
                # Create new connection - don't include id, let database generate UUID
                result = self.supabase.table("whatsapp_connections").insert(connection_data).execute()
                logger.info(f"Created WhatsApp connection for user {user_id}")
            
            return result.data[0] if result.data else None
        except Exception as e:
            logger.error(f"Error creating/updating WhatsApp connection: {e}")
            raise
    
    async def send_message(
        self,
        user_id: str,
        phone_number: str,
        message: str,
        message_type: str = "text"
    ) -> Dict[str, Any]:
        """
        Send WhatsApp message via Business API
        
        Args:
            user_id: User ID who owns the WhatsApp connection
            phone_number: Recipient phone number (E.164 format, e.g., +1234567890)
            message: Message content
            message_type: Type of message (text, template)
        
        Returns:
            Dict with message_id and status
        """
        try:
            # Get WhatsApp connection
            connection = self.get_whatsapp_connection(user_id)
            if not connection:
                raise ValueError(f"No active WhatsApp connection found for user {user_id}")
            
            # Decrypt access token
            access_token = self.decrypt_token(connection["access_token_encrypted"])
            phone_number_id = connection["phone_number_id"]
            
            # Format phone number (ensure it starts with +)
            if not phone_number.startswith("+"):
                phone_number = "+" + phone_number.lstrip("+")
            
            # Prepare API request
            url = f"https://graph.facebook.com/{self.api_version}/{phone_number_id}/messages"
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            
            # Build message payload based on type
            if message_type == "template":
                # For template messages, you need template name and parameters
                payload = {
                    "messaging_product": "whatsapp",
                    "to": phone_number,
                    "type": "template",
                    "template": {
                        "name": message.get("template_name", ""),
                        "language": {"code": message.get("language_code", "en")},
                        "components": message.get("components", [])
                    }
                }
            else:
                # Text message
                payload = {
                    "messaging_product": "whatsapp",
                    "recipient_type": "individual",
                    "to": phone_number,
                    "type": "text",
                    "text": {
                        "preview_url": False,
                        "body": message
                    }
                }
            
            # Send message
            response = requests.post(url, headers=headers, json=payload, timeout=30)
            
            # Check response for errors
            if not response.ok:
                error_data = response.json() if response.content else {}
                error_message = error_data.get("error", {}).get("message", "Unknown error")
                error_code = error_data.get("error", {}).get("code", 0)
                error_subcode = error_data.get("error", {}).get("error_subcode", 0)
                
                # Check if it's a 24-hour window issue (error code 131047)
                if error_code == 131047 or error_subcode == 131047:
                    raise ValueError(
                        "Cannot send free-form message. The recipient must have replied to you within the last 24 hours, "
                        "or you need to use an approved WhatsApp template message for the first contact. "
                        "Please use a template message or wait for the recipient to message you first."
                    )
                elif error_code == 131026:
                    raise ValueError(
                        "Recipient phone number is not registered on WhatsApp or is invalid. "
                        "Please verify the phone number is correct and has WhatsApp installed."
                    )
                else:
                    raise ValueError(f"WhatsApp API error: {error_message} (Code: {error_code})")
            
            response.raise_for_status()
            result = response.json()
            message_id = result.get("messages", [{}])[0].get("id", "")
            
            # Check for warnings or status in response
            contacts = result.get("contacts", [])
            contact_status = contacts[0].get("wa_id") if contacts else None
            
            logger.info(f"Sent WhatsApp message to {phone_number}, message_id: {message_id}")
            
            # Log additional info for debugging
            if not contact_status:
                logger.warning(f"Message sent but no contact status returned for {phone_number}")
            
            return {
                "success": True,
                "message_id": message_id,
                "status": "sent",
                "whatsapp_id": message_id,
                "contact_status": contact_status,
                "note": "Message sent to WhatsApp API. Delivery status will be updated via webhook. "
                        "Note: Free-form messages only work if recipient replied within 24 hours. "
                        "For first messages, use a template message."
            }
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Error sending WhatsApp message: {e}")
            if hasattr(e, 'response') and e.response is not None:
                try:
                    error_data = e.response.json()
                    error_message = error_data.get("error", {}).get("message", str(e))
                    error_code = error_data.get("error", {}).get("code", 0)
                    logger.error(f"WhatsApp API Error: {error_message} (Code: {error_code})")
                    
                    # Re-raise with more specific error
                    if error_code == 131047:
                        raise ValueError(
                            "Cannot send free-form message. Use a template message for first contact, "
                            "or wait for recipient to reply within 24 hours."
                        )
                except:
                    logger.error(f"Response: {e.response.text}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error sending WhatsApp message: {e}")
            raise
    
    def verify_webhook_signature(self, payload: bytes, signature: str) -> bool:
        """
        Verify WhatsApp webhook signature
        
        Args:
            payload: Raw request body
            signature: X-Hub-Signature-256 header value
        
        Returns:
            True if signature is valid
        """
        if not self.webhook_secret:
            logger.warning("WhatsApp webhook secret not configured, skipping verification")
            return True  # Allow in development if secret not set
        
        try:
            # WhatsApp uses HMAC SHA256
            expected_signature = hmac.new(
                self.webhook_secret.encode(),
                payload,
                hashlib.sha256
            ).hexdigest()
            
            # Signature comes as "sha256=<hash>"
            if signature.startswith("sha256="):
                received_signature = signature[7:]
            else:
                received_signature = signature
            
            # Compare signatures
            is_valid = hmac.compare_digest(expected_signature, received_signature)
            
            if not is_valid:
                logger.warning("WhatsApp webhook signature verification failed")
            
            return is_valid
        except Exception as e:
            logger.error(f"Error verifying webhook signature: {e}")
            return False
    
    def parse_webhook_payload(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Parse WhatsApp webhook payload
        
        Returns:
            Parsed payload with message data
        """
        try:
            entry = payload.get("entry", [])
            if not entry:
                return {"type": "unknown", "data": payload}
            
            changes = entry[0].get("changes", [])
            if not changes:
                return {"type": "unknown", "data": payload}
            
            value = changes[0].get("value", {})
            
            # Check for messages
            if "messages" in value:
                messages = value["messages"]
                if messages:
                    message = messages[0]
                    return {
                        "type": "message",
                        "message_id": message.get("id"),
                        "from": value.get("metadata", {}).get("phone_number_id"),
                        "to": value.get("metadata", {}).get("display_phone_number"),
                        "timestamp": message.get("timestamp"),
                        "message_type": message.get("type"),
                        "text": message.get("text", {}).get("body") if message.get("type") == "text" else None,
                        "data": message
                    }
            
            # Check for status updates
            if "statuses" in value:
                statuses = value["statuses"]
                if statuses:
                    status = statuses[0]
                    return {
                        "type": "status",
                        "message_id": status.get("id"),
                        "status": status.get("status"),  # sent, delivered, read, failed
                        "timestamp": status.get("timestamp"),
                        "recipient_id": status.get("recipient_id"),
                        "data": status
                    }
            
            return {"type": "unknown", "data": payload}
            
        except Exception as e:
            logger.error(f"Error parsing webhook payload: {e}")
            return {"type": "error", "error": str(e), "data": payload}
    
    async def get_message_status(self, user_id: str, message_id: str) -> Optional[Dict[str, Any]]:
        """Get status of a sent message (if stored in database)"""
        try:
            # This would query the lead_conversations table
            # For now, return None as status is updated via webhooks
            return None
        except Exception as e:
            logger.error(f"Error getting message status: {e}")
            return None

    async def get_templates(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Get list of approved WhatsApp message templates from Meta API
        
        Args:
            user_id: User ID who owns the WhatsApp connection
            
        Returns:
            List of template objects with name, language, status, etc.
        """
        try:
            # Get WhatsApp connection
            connection = self.get_whatsapp_connection(user_id)
            if not connection:
                raise ValueError(f"No active WhatsApp connection found for user {user_id}")
            
            # Decrypt access token
            access_token = self.decrypt_token(connection["access_token_encrypted"])
            whatsapp_business_account_id = connection.get("whatsapp_business_account_id")
            business_account_id = connection.get("business_account_id")
            
            # Try to get templates using business account ID or WABA ID
            # WhatsApp templates are associated with the business account, not phone number
            if whatsapp_business_account_id:
                url = f"https://graph.facebook.com/{self.api_version}/{whatsapp_business_account_id}/message_templates"
            elif business_account_id:
                url = f"https://graph.facebook.com/{self.api_version}/{business_account_id}/message_templates"
            else:
                # Fallback: try to get WABA ID from phone number
                phone_number_id = connection["phone_number_id"]
                # First, try to get the WABA ID from the phone number
                try:
                    phone_info_url = f"https://graph.facebook.com/{self.api_version}/{phone_number_id}"
                    phone_response = requests.get(phone_info_url, headers={"Authorization": f"Bearer {access_token}"}, timeout=10)
                    if phone_response.ok:
                        phone_data = phone_response.json()
                        waba_id = phone_data.get("whatsapp_business_account_id")
                        if waba_id:
                            url = f"https://graph.facebook.com/{self.api_version}/{waba_id}/message_templates"
                        else:
                            raise ValueError("Could not find WhatsApp Business Account ID. Please provide it when connecting.")
                    else:
                        raise ValueError("Could not access phone number information. Please provide WhatsApp Business Account ID when connecting.")
                except Exception as e:
                    logger.error(f"Error getting WABA ID: {e}")
                    raise ValueError("Could not find WhatsApp Business Account ID. Please provide it when connecting.")
            
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            
            # Fetch templates
            response = requests.get(url, headers=headers, timeout=30)
            response.raise_for_status()
            
            result = response.json()
            templates = result.get("data", [])
            
            # Format templates for easier use
            formatted_templates = []
            for template in templates:
                formatted_templates.append({
                    "name": template.get("name", ""),
                    "language": template.get("language", "en"),
                    "status": template.get("status", ""),
                    "category": template.get("category", ""),
                    "components": template.get("components", []),
                    "id": template.get("id", "")
                })
            
            logger.info(f"Retrieved {len(formatted_templates)} WhatsApp templates for user {user_id}")
            return formatted_templates
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Error fetching WhatsApp templates: {e}")
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"Response: {e.response.text}")
            # Return empty list instead of raising - templates are optional
            return []
        except Exception as e:
            logger.error(f"Unexpected error fetching WhatsApp templates: {e}")
            return []
    
    async def send_template_message(
        self,
        user_id: str,
        phone_number: str,
        template_name: str,
        language_code: str = "en",
        template_parameters: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Send WhatsApp template message
        
        Args:
            user_id: User ID who owns the WhatsApp connection
            phone_number: Recipient phone number (E.164 format)
            template_name: Name of the approved template
            language_code: Language code (default: "en")
            template_parameters: Optional list of parameter components for the template
            
        Returns:
            Dict with message_id and status
        """
        try:
            # Get WhatsApp connection
            connection = self.get_whatsapp_connection(user_id)
            if not connection:
                raise ValueError(f"No active WhatsApp connection found for user {user_id}")
            
            # Decrypt access token
            access_token = self.decrypt_token(connection["access_token_encrypted"])
            phone_number_id = connection["phone_number_id"]
            
            # Format phone number
            if not phone_number.startswith("+"):
                phone_number = "+" + phone_number.lstrip("+")
            
            # Prepare API request
            url = f"https://graph.facebook.com/{self.api_version}/{phone_number_id}/messages"
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            }
            
            # Build template payload
            template_payload = {
                "name": template_name,
                "language": {"code": language_code}
            }
            
            # Add components if parameters provided
            if template_parameters:
                # Format parameters according to WhatsApp API structure
                components = []
                
                # Handle body parameters
                body_params = []
                for param in template_parameters:
                    if isinstance(param, dict):
                        if param.get("type") == "text":
                            body_params.append({
                                "type": "text",
                                "text": param.get("text", "")
                            })
                        elif "text" in param:
                            body_params.append({
                                "type": "text",
                                "text": param["text"]
                            })
                    elif isinstance(param, str):
                        body_params.append({
                            "type": "text",
                            "text": param
                        })
                
                if body_params:
                    components.append({
                        "type": "body",
                        "parameters": body_params
                    })
                
                if components:
                    template_payload["components"] = components
            
            payload = {
                "messaging_product": "whatsapp",
                "to": phone_number,
                "type": "template",
                "template": template_payload
            }
            
            # Send message
            response = requests.post(url, headers=headers, json=payload, timeout=30)
            
            # Check response for errors
            if not response.ok:
                error_data = response.json() if response.content else {}
                error_message = error_data.get("error", {}).get("message", "Unknown error")
                error_code = error_data.get("error", {}).get("code", 0)
                raise ValueError(f"WhatsApp API error: {error_message} (Code: {error_code})")
            
            response.raise_for_status()
            result = response.json()
            message_id = result.get("messages", [{}])[0].get("id", "")
            
            logger.info(f"Sent WhatsApp template message '{template_name}' to {phone_number}, message_id: {message_id}")
            
            return {
                "success": True,
                "message_id": message_id,
                "status": "sent",
                "whatsapp_id": message_id,
                "template_name": template_name
            }
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Error sending WhatsApp template message: {e}")
            if hasattr(e, 'response') and e.response is not None:
                try:
                    error_data = e.response.json()
                    error_message = error_data.get("error", {}).get("message", str(e))
                    logger.error(f"WhatsApp API Error: {error_message}")
                except:
                    logger.error(f"Response: {e.response.text}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error sending WhatsApp template message: {e}")
            raise



