from fastapi import APIRouter, HTTPException, Depends, Header, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import httpx
import os
from datetime import datetime, timedelta
import json
import base64
import jwt
from cryptography.fernet import Fernet
from supabase import create_client, Client
from .meta_scopes import get_meta_oauth_scopes
import openai
import asyncio

router = APIRouter(prefix="/api/social-media", tags=["social-media-connections"])

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_ANON_KEY")
supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

def get_supabase_client(authorization: str = None) -> Client:
    """Get Supabase client with service role for backend operations"""
    # Use service role key for backend operations to bypass RLS
    if supabase_service_key:
        return create_client(supabase_url, supabase_service_key)
    else:
        # Fallback to anonymous client
        return create_client(supabase_url, supabase_key)

# Initialize encryption
encryption_key = os.getenv("ENCRYPTION_KEY")
if encryption_key:
    cipher_suite = Fernet(encryption_key.encode())
else:
    cipher_suite = None

# Security
security = HTTPBearer()

# User model for authentication
class User(BaseModel):
    id: str
    email: str
    name: str
    created_at: str

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current user from Supabase JWT token (same as main app)"""
    import concurrent.futures
    
    token = credentials.credentials
    
    def authenticate_with_timeout():
        """Authenticate with Supabase with timeout handling"""
        try:
            supabase_client = get_supabase_client()
            response = supabase_client.auth.get_user(token)
            if not response.user:
                raise HTTPException(
                    status_code=401,
                    detail="Invalid token"
                )
            return response.user
        except HTTPException:
            raise
        except Exception as e:
            error_str = str(e).lower()
            if "timeout" in error_str or "handshake" in error_str or "timed out" in error_str:
                print(f"Supabase authentication timeout: {e}")
                raise HTTPException(
                    status_code=503,
                    detail="Authentication service temporarily unavailable. Please try again."
                )
            raise
    
    # Try authentication with timeout (5 seconds)
    try:
        with concurrent.futures.ThreadPoolExecutor() as executor:
            future = executor.submit(authenticate_with_timeout)
            try:
                user = future.result(timeout=5.0)
            except concurrent.futures.TimeoutError:
                print("Authentication request timed out after 5 seconds")
                raise HTTPException(
                    status_code=503,
                    detail="Authentication service timeout. Please try again."
                )
    except HTTPException:
        raise
    except Exception as e:
        print(f"Authentication error: {e}")
        # Check if it's a timeout-related error
        error_str = str(e).lower()
        if "timeout" in error_str or "handshake" in error_str or "timed out" in error_str:
            raise HTTPException(
                status_code=503,
                detail="Authentication service temporarily unavailable. Please try again."
            )
        raise HTTPException(
            status_code=401,
            detail="Could not validate credentials"
        )
    
    # Convert created_at to string if it's a datetime object
    created_at_str = user.created_at
    if hasattr(created_at_str, 'isoformat'):
        created_at_str = created_at_str.isoformat()
    else:
        created_at_str = str(created_at_str)
    
    return User(
        id=user.id,
        email=user.email,
        name=user.user_metadata.get("name", user.email),
        created_at=created_at_str
    )

class SocialMediaConnection(BaseModel):
    platform: str
    account_type: str
    account_id: str
    account_name: str
    access_token: str
    token_expires_at: Optional[str] = None
    permissions: Optional[Dict[str, Any]] = None
    connection_method: str = "token"

class ConnectionResponse(BaseModel):
    success: bool
    message: str
    account_name: Optional[str] = None
    connection_method: Optional[str] = None

def encrypt_token(token: str) -> str:
    """Encrypt access token for storage"""
    if cipher_suite:
        return cipher_suite.encrypt(token.encode()).decode()
    return token

def decrypt_token(encrypted_token: str) -> str:
    """Decrypt access token for use"""
    if cipher_suite:
        return cipher_suite.decrypt(encrypted_token.encode()).decode()
    return encrypted_token

def extract_user_id_from_jwt(authorization: str) -> str:
    """Extract user ID from JWT token in authorization header"""
    try:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid authorization header")
        
        # Extract the JWT token
        jwt_token = authorization.split(" ")[1]
        
        # Decode JWT without verification (since we're just extracting user info)
        # In production, you should verify the JWT signature
        decoded_token = jwt.decode(jwt_token, options={"verify_signature": False})
        
        # Extract user ID from the 'sub' field (Supabase uses 'sub' for user ID)
        user_id = decoded_token.get('sub')
        if not user_id:
            raise HTTPException(status_code=401, detail="No user ID found in token")
        
        print(f"Extracted user ID: {user_id}")
        return user_id
        
    except jwt.InvalidTokenError as e:
        print(f"JWT decode error: {e}")
        # Try to decode as base64 to get more info
        try:
            import base64
            # Split the JWT token
            parts = jwt_token.split('.')
            if len(parts) >= 2:
                # Decode the payload (second part)
                payload = base64.b64decode(parts[1] + '==')  # Add padding
                payload_json = json.loads(payload.decode('utf-8'))
                user_id = payload_json.get('sub')
                if user_id:
                    print(f"Extracted user ID from base64: {user_id}")
                    return user_id
        except Exception as base64_error:
            print(f"Base64 decode error: {base64_error}")
        
        raise HTTPException(status_code=401, detail="Invalid JWT token")
    except Exception as e:
        print(f"Error extracting user ID: {e}")
        raise HTTPException(status_code=401, detail="Failed to extract user ID from token")

async def validate_and_get_account_info(platform: str, access_token: str) -> Dict[str, Any]:
    """Validate access token and get account information"""
    print(f"Expected Meta OAuth scopes for token connections: {', '.join(get_meta_oauth_scopes())}")
    try:
        if platform == "instagram":
            # Instagram Basic Display API validation
            async with httpx.AsyncClient() as client:
                # Validate token format first
                if not access_token or len(access_token) < 10:
                    raise HTTPException(status_code=400, detail="Invalid token format: Token is too short or empty")
                
                print(f"Validating Instagram Basic Display token: {access_token[:10]}...{access_token[-10:]}")
                
                # Validate the token using Instagram Basic Display API
                user_response = await client.get(
                    "https://graph.instagram.com/me",
                    params={
                        "access_token": access_token,
                        "fields": "id,username,account_type"
                    }
                )
                
                print(f"Instagram Basic Display response: {user_response.status_code} - {user_response.text[:200]}")
                
                if user_response.status_code != 200:
                    error_data = user_response.json() if user_response.headers.get('content-type', '').startswith('application/json') else {"error": {"message": user_response.text}}
                    raise HTTPException(status_code=400, detail=f"Invalid Instagram token: {error_data}")
                
                user_data = user_response.json()
                print(f"Token belongs to Instagram user: {user_data.get('username', 'Unknown')} (ID: {user_data.get('id')})")
                
                return {
                    "account_id": user_data["id"],
                    "name": user_data.get("username", "Instagram Account"),
                    "account_type": "personal",  # Instagram Basic Display is for personal accounts
                    "permissions": {"instagram_basic": True},
                    "username": user_data.get("username")
                }
        
        elif platform == "facebook":
            # Facebook Graph API validation
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"https://graph.facebook.com/v18.0/me",
                    params={
                        "access_token": access_token,
                        "fields": "id,name,accounts"
                    }
                )
                
                if response.status_code != 200:
                    raise HTTPException(status_code=400, detail="Invalid Facebook access token")
                
                data = response.json()
                return {
                    "account_id": data["id"],
                    "name": data["name"],
                    "account_type": "page",
                    "permissions": {"pages_manage_posts": True, "pages_read_engagement": True}
                }
        
        elif platform == "twitter":
            # Twitter API v2 validation
            async with httpx.AsyncClient() as client:
                headers = {"Authorization": f"Bearer {access_token}"}
                response = await client.get(
                    "https://api.twitter.com/2/users/me",
                    headers=headers
                )
                
                if response.status_code != 200:
                    raise HTTPException(status_code=400, detail="Invalid Twitter access token")
                
                data = response.json()
                user_data = data["data"]
                return {
                    "account_id": user_data["id"],
                    "name": user_data["name"],
                    "account_type": "profile",
                    "permissions": {"tweet.read": True, "tweet.write": True}
                }
        
        elif platform == "linkedin":
            # LinkedIn API validation
            async with httpx.AsyncClient() as client:
                headers = {"Authorization": f"Bearer {access_token}"}
                response = await client.get(
                    "https://api.linkedin.com/v2/me",
                    headers=headers
                )
                
                if response.status_code != 200:
                    raise HTTPException(status_code=400, detail="Invalid LinkedIn access token")
                
                data = response.json()
                return {
                    "account_id": data["id"],
                    "name": f"{data.get('firstName', {}).get('localized', {}).get('en_US', '')} {data.get('lastName', {}).get('localized', {}).get('en_US', '')}".strip(),
                    "account_type": "profile",
                    "permissions": {"r_liteprofile": True, "w_member_social": True}
                }
        
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported platform: {platform}")
    
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=400, detail=f"API validation failed: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Token validation failed: {str(e)}")

@router.post("/connect-token", response_model=ConnectionResponse)
async def connect_with_token(
    connection: SocialMediaConnection,
    current_user: User = Depends(get_current_user)
):
    """Connect social media account using access token"""
    try:
        # Get user ID from authenticated user
        user_id = current_user.id
        
        # Add debugging
        print(f"Connecting {connection.platform} for user {user_id}")
        print(f"Token preview: {connection.access_token[:20]}...")
        print(f"Requesting Meta scopes: {', '.join(get_meta_oauth_scopes())}")
        
        # Validate access token and get account info
        account_info = await validate_and_get_account_info(connection.platform, connection.access_token)
        
        # Get authenticated Supabase client
        supabase_client = get_supabase_client()
        
        # Check if connection already exists
        existing = supabase_client.table("social_media_connections").select("*").eq(
            "user_id", user_id
        ).eq("platform", connection.platform).eq("account_id", account_info["account_id"]).execute()
        
        # Encrypt the access token
        encrypted_token = encrypt_token(connection.access_token)
        
        if existing.data:
            # Update existing connection
            update_data = {
                "access_token": encrypted_token,
                "account_name": account_info["name"],
                "permissions": account_info.get("permissions", {}),
                "is_active": True,
                "connection_method": connection.connection_method,
                "connected_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            result = supabase_client.table("social_media_connections").update(update_data).eq(
                "id", existing.data[0]["id"]
            ).execute()
        else:
            # Create new connection
            connection_data = {
                "user_id": user_id,
                "platform": connection.platform,
                "account_type": account_info["account_type"],
                "account_id": account_info["account_id"],
                "account_name": account_info["name"],
                "access_token": encrypted_token,
                "permissions": account_info.get("permissions", {}),
                "is_active": True,
                "connection_method": connection.connection_method,
                "connected_at": datetime.utcnow().isoformat()
            }
            
            result = supabase_client.table("social_media_connections").insert(connection_data).execute()
        
        return ConnectionResponse(
            success=True,
            message=f"{connection.platform.title()} account connected successfully via {connection.connection_method}",
            account_name=account_info["name"],
            connection_method=connection.connection_method
        )
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/debug/validate-token")
async def debug_validate_token(request: Dict[str, Any]):
    """Debug endpoint to test token validation"""
    try:
        platform = request.get("platform", "instagram")
        access_token = request.get("access_token", "")
        
        print(f"Debug: Validating {platform} token: {access_token[:10]}...{access_token[-10:] if len(access_token) > 20 else access_token}")
        print(f"Debug: Token length: {len(access_token)}")
        
        # Test the token with different endpoints
        async with httpx.AsyncClient() as client:
            if platform == "instagram":
                # Test Instagram Basic Display API
                instagram_response = await client.get(
                    "https://graph.instagram.com/me",
                    params={
                        "access_token": access_token,
                        "fields": "id,username,account_type"
                    }
                )
                
                print(f"Debug: Instagram Basic Display response status: {instagram_response.status_code}")
                print(f"Debug: Instagram Basic Display response: {instagram_response.text}")
                
                if instagram_response.status_code == 200:
                    instagram_data = instagram_response.json()
                    return {
                        "valid": True,
                        "me_data": instagram_data,
                        "platform": "instagram_basic_display",
                        "me_status": instagram_response.status_code,
                        "token_length": len(access_token),
                        "token_preview": f"{access_token[:10]}...{access_token[-10:] if len(access_token) > 20 else access_token}"
                    }
                else:
                    return {
                        "valid": False,
                        "error": instagram_response.text,
                        "status": instagram_response.status_code,
                        "token_length": len(access_token),
                        "token_preview": f"{access_token[:10]}...{access_token[-10:] if len(access_token) > 20 else access_token}"
                    }
            else:
                # Test Facebook Graph API for other platforms
                me_response = await client.get(
                    f"https://graph.facebook.com/v18.0/me",
                    params={
                        "access_token": access_token,
                        "fields": "id,name"
                    }
                )
                
                print(f"Debug: /me response status: {me_response.status_code}")
                print(f"Debug: /me response: {me_response.text}")
                
                if me_response.status_code == 200:
                    me_data = me_response.json()
                    return {
                        "valid": True,
                        "me_data": me_data,
                        "platform": "facebook_graph",
                        "me_status": me_response.status_code,
                        "token_length": len(access_token),
                        "token_preview": f"{access_token[:10]}...{access_token[-10:] if len(access_token) > 20 else access_token}"
                    }
                else:
                    return {
                        "valid": False,
                        "error": me_response.text,
                        "status": me_response.status_code,
                        "token_length": len(access_token),
                        "token_preview": f"{access_token[:10]}...{access_token[-10:] if len(access_token) > 20 else access_token}"
                    }
                
    except Exception as e:
        return {
            "valid": False,
            "error": str(e),
            "token_length": len(access_token) if 'access_token' in locals() else 0
        }

@router.get("/connections")
async def get_user_connections(current_user: User = Depends(get_current_user)):
    """Get all social media connections for the user"""
    try:
        user_id = current_user.id
        
        # Get authenticated Supabase client
        supabase_client = get_supabase_client()
        
        result = supabase_client.table("social_media_connections").select("*").eq(
            "user_id", user_id
        ).eq("is_active", True).execute()
        
        # Decrypt tokens for display (in production, you might not want to return tokens)
        connections = []
        for conn in result.data:
            conn_copy = conn.copy()
            conn_copy["access_token"] = "***encrypted***"  # Don't return actual tokens
            connections.append(conn_copy)
        
        return {"connections": connections}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/disconnect/{connection_id}")
async def disconnect_social_media(connection_id: str, current_user: User = Depends(get_current_user)):
    """Disconnect a social media account"""
    try:
        user_id = current_user.id
        
        # Get authenticated Supabase client
        supabase_client = get_supabase_client()
        
        # Verify ownership and delete
        result = supabase_client.table("social_media_connections").delete().eq(
            "id", connection_id
        ).eq("user_id", user_id).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Connection not found")
        
        return {"success": True, "message": "Account disconnected successfully"}
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/instagram/profile/{user_id}")
async def get_instagram_profile(user_id: str, current_user: User = Depends(get_current_user)):
    """Get Instagram profile data using stored token"""
    try:
        # Verify the user_id matches the authenticated user
        if user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Get authenticated Supabase client
        supabase_client = get_supabase_client()
        
        # Get user's Instagram connection
        result = supabase_client.table("social_media_connections").select("*").eq(
            "user_id", user_id
        ).eq("platform", "instagram").eq("is_active", True).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="No Instagram connection found")
        
        connection = result.data[0]
        access_token = decrypt_token(connection["access_token"])
        
        # Get Instagram profile data
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://graph.facebook.com/v18.0/{connection['account_id']}",
                params={
                    "access_token": access_token,
                    "fields": "id,name,username,biography,followers_count,follows_count,media_count"
                }
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to fetch Instagram profile")
            
            profile_data = response.json()
            
            # Update last sync time
            supabase_client.table("social_media_connections").update({
                "last_sync_at": datetime.utcnow().isoformat()
            }).eq("id", connection["id"]).execute()
            
            return profile_data
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/instagram/media/{user_id}")
async def get_instagram_media(user_id: str, current_user: User = Depends(get_current_user)):
    """Get Instagram media data using stored token"""
    try:
        # Verify the user_id matches the authenticated user
        if user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Get authenticated Supabase client
        supabase_client = get_supabase_client()
        
        # Get user's Instagram connection
        result = supabase_client.table("social_media_connections").select("*").eq(
            "user_id", user_id
        ).eq("platform", "instagram").eq("is_active", True).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="No Instagram connection found")
        
        connection = result.data[0]
        access_token = decrypt_token(connection["access_token"])
        
        # Get Instagram media data using Instagram Basic Display API
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://graph.instagram.com/{connection['account_id']}/media",
                params={
                    "access_token": access_token,
                    "fields": "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count"
                }
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to fetch Instagram media")
            
            media_data = response.json()
            
            # Update last sync time
            supabase_client.table("social_media_connections").update({
                "last_sync_at": datetime.utcnow().isoformat()
            }).eq("id", connection["id"]).execute()
            
            return media_data
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/instagram/insights/{user_id}")
async def get_instagram_insights(user_id: str, current_user: User = Depends(get_current_user)):
    """Get Instagram insights data using stored token"""
    try:
        # Verify the user_id matches the authenticated user
        if user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Get authenticated Supabase client
        supabase_client = get_supabase_client()
        
        # Get user's Instagram connection
        result = supabase_client.table("social_media_connections").select("*").eq(
            "user_id", user_id
        ).eq("platform", "instagram").eq("is_active", True).execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="No Instagram connection found")
        
        connection = result.data[0]
        access_token = decrypt_token(connection["access_token"])
        
        # Get Instagram insights data
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://graph.facebook.com/v18.0/{connection['account_id']}/insights",
                params={
                    "access_token": access_token,
                    "metric": "impressions,reach,profile_views,website_clicks,email_contacts,phone_call_clicks,text_message_clicks,get_directions_clicks",
                    "period": "day"
                }
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to fetch Instagram insights")
            
            insights_data = response.json()
            
            # Update last sync time
            supabase_client.table("social_media_connections").update({
                "last_sync_at": datetime.utcnow().isoformat()
            }).eq("id", connection["id"]).execute()
            
            return insights_data
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/task-executions")
async def get_task_executions(current_user: User = Depends(get_current_user)):
    """Get recent autonomous task executions"""
    try:
        user_id = current_user.id
        
        # For now, return the weekly content generation task status
        # In the future, this could be expanded to track all task executions
        import os
        from datetime import datetime
        import pytz
        
        # Check for weekly generation marker files
        scheduler_dir = os.path.join(os.path.dirname(__file__), '..', 'scheduler')
        marker_files = []
        
        if os.path.exists(scheduler_dir):
            for file in os.listdir(scheduler_dir):
                if file.startswith('weekly_run_') and file.endswith('.marker'):
                    marker_files.append(file)
        
        # Sort by date (newest first)
        marker_files.sort(reverse=True)
        
        tasks = []
        
        # Get the most recent execution
        if marker_files:
            latest_marker = marker_files[0]
            marker_path = os.path.join(scheduler_dir, latest_marker)
            
            try:
                with open(marker_path, 'r') as f:
                    content = f.read().strip()
                    # Extract timestamp from content
                    if 'completed at' in content:
                        timestamp_str = content.split('completed at ')[1]
                        execution_time = datetime.fromisoformat(timestamp_str)
                        
                        # Calculate next run (next Sunday at 4:00 AM IST)
                        ist = pytz.timezone('Asia/Kolkata')
                        now_ist = datetime.now(ist)
                        
                        # Find next Sunday
                        days_until_sunday = (6 - now_ist.weekday()) % 7
                        if days_until_sunday == 0 and now_ist.hour < 4:
                            # It's Sunday but before 4 AM, so next run is today
                            next_run = now_ist.replace(hour=4, minute=0, second=0, microsecond=0)
                        else:
                            # Next Sunday at 4 AM
                            next_sunday = now_ist + timedelta(days=days_until_sunday)
                            next_run = next_sunday.replace(hour=4, minute=0, second=0, microsecond=0)
                        
                        tasks.append({
                            "id": 1,
                            "name": "Weekly Content Generation",
                            "description": "Generated Social Media posts for you this Sunday at 4:00 AM IST",
                            "status": "completed",
                            "executionTime": execution_time.isoformat(),
                            "duration": "2m 15s",  # Estimated
                            "type": "content_generation",
                            "frequency": "Weekly (Sundays at 4:00 AM IST)",
                            "isActive": True,
                            "nextRun": next_run.strftime("%A, %B %d at %I:%M %p IST")
                        })
            except Exception as e:
                print(f"Error reading marker file: {e}")
        
        # If no executions found, show scheduled task
        if not tasks:
            ist = pytz.timezone('Asia/Kolkata')
            now_ist = datetime.now(ist)
            
            # Find next Sunday at 4 AM
            days_until_sunday = (6 - now_ist.weekday()) % 7
            if days_until_sunday == 0 and now_ist.hour < 4:
                next_run = now_ist.replace(hour=4, minute=0, second=0, microsecond=0)
            else:
                next_sunday = now_ist + timedelta(days=days_until_sunday)
                next_run = next_sunday.replace(hour=4, minute=0, second=0, microsecond=0)
            
            tasks.append({
                "id": 1,
                "name": "Weekly Content Generation",
                "description": "Will generate Social Media posts for you next Sunday at 4:00 AM IST",
                "status": "scheduled",
                "executionTime": None,
                "duration": None,
                "type": "content_generation",
                "frequency": "Weekly (Sundays at 4:00 AM IST)",
                "isActive": True,
                "nextRun": next_run.strftime("%A, %B %d at %I:%M %p IST")
            })
        
        return {
            "tasks": tasks,
            "total_tasks": len(tasks),
            "last_updated": datetime.now().isoformat()
        }
        
    except Exception as e:
        print(f"Error fetching task executions: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/latest-posts")
async def get_latest_posts(current_user: User = Depends(get_current_user)):
    """Get latest posts from all connected social media platforms (both OAuth and API token connections)"""
    try:
        user_id = current_user.id
        
        # Get authenticated Supabase client
        supabase_client = get_supabase_client()
        
        # Get OAuth connections from platform_connections table
        oauth_result = supabase_client.table("platform_connections").select("*").eq(
            "user_id", user_id
        ).eq("is_active", True).execute()
        
        oauth_connections = oauth_result.data if oauth_result.data else []
        print(f"Found {len(oauth_connections)} OAuth connections")
        
        # Get API token connections from social_media_connections table
        token_result = supabase_client.table("social_media_connections").select("*").eq(
            "user_id", user_id
        ).eq("is_active", True).execute()
        
        token_connections = token_result.data if token_result.data else []
        print(f"Found {len(token_connections)} API token connections")
        
        # Combine all connections
        all_connections = []
        
        # Add OAuth connections
        for conn in oauth_connections:
            all_connections.append({
                **conn,
                'connection_type': 'oauth',
                'access_token': conn.get('access_token_encrypted', ''),
                'account_id': conn.get('page_id', ''),
                'account_name': conn.get('page_name', '')
            })
        
        # Add API token connections
        for conn in token_connections:
            all_connections.append({
                **conn,
                'connection_type': 'token',
                'access_token': conn.get('access_token', ''),
                'account_id': conn.get('account_id', ''),
                'account_name': conn.get('account_name', '')
            })
        
        print(f"Total connections to process: {len(all_connections)}")
        
        # Helper function to fetch posts for a single connection
        async def fetch_posts_for_connection(connection: dict) -> tuple:
            """Fetch posts for a single connection. Returns (platform, posts, connection_type) or (platform, None, connection_type) on error."""
            platform = connection.get('platform', '').lower()
            connection_type = connection.get('connection_type', 'oauth')
            connection_id = connection.get('id', 'unknown')
            
            print(f"Processing {platform} connection ({connection_type}): {connection_id}")
            
            try:
                posts = None
                
                if platform == 'instagram':
                    if connection_type == 'oauth':
                        posts = await fetch_instagram_posts_oauth(connection, 1)
                    else:
                        posts = await fetch_instagram_posts_new(connection, 1)
                elif platform == 'facebook':
                    if connection_type == 'oauth':
                        posts = await fetch_facebook_posts_oauth(connection, 1)
                    else:
                        posts = await fetch_facebook_posts_new(connection, 1)
                elif platform == 'twitter':
                    posts = await fetch_twitter_posts_new(connection, 5)
                elif platform == 'linkedin':
                    posts = await fetch_linkedin_posts_new(connection, 5)
                else:
                    print(f"Unsupported platform: {platform}")
                    return (platform, None, connection_type)
                
                if posts:
                    print(f"✅ Fetched {len(posts)} posts from {platform} ({connection_type})")
                    return (platform, posts, connection_type)
                else:
                    print(f"⚠️ No posts found for {platform} ({connection_type})")
                    return (platform, None, connection_type)
                    
            except Exception as e:
                print(f"❌ Error fetching posts from {platform} ({connection_type}): {e}")
                return (platform, None, connection_type)
        
        # Process all connections in parallel
        print(f"🚀 Starting parallel fetch for {len(all_connections)} connections...")
        start_time = datetime.now()
        
        tasks = [fetch_posts_for_connection(conn) for conn in all_connections]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        elapsed_time = (datetime.now() - start_time).total_seconds()
        print(f"✅ Parallel fetch completed in {elapsed_time:.2f} seconds")
        
        # Aggregate results
        posts_by_platform = {}
        for result in results:
            # Handle exceptions
            if isinstance(result, Exception):
                print(f"❌ Task failed with exception: {result}")
                continue
            
            platform, posts, connection_type = result
            
            if posts:
                # If platform already has posts, extend the list
                if platform in posts_by_platform:
                    posts_by_platform[platform].extend(posts)
                else:
                    posts_by_platform[platform] = posts
        
        return {
            "posts": posts_by_platform,
            "total_platforms": len(posts_by_platform),
            "total_posts": sum(len(posts) for posts in posts_by_platform.values()),
            "oauth_connections": len(oauth_connections),
            "token_connections": len(token_connections)
        }
        
    except Exception as e:
        print(f"Error fetching latest posts: {e}")
        raise HTTPException(status_code=400, detail=str(e))

async def fetch_instagram_posts_oauth(connection: dict, limit: int) -> List[Dict[str, Any]]:
    """Fetch latest posts from Instagram using OAuth connection (Facebook Graph API)"""
    try:
        # OAuth connections use access_token_encrypted, token connections use access_token
        encrypted_token = connection.get('access_token_encrypted') or connection.get('access_token', '')
        access_token = decrypt_token(encrypted_token)
        page_id = connection.get('account_id', '')
        
        print(f"Instagram OAuth page_id: {page_id}")
        print(f"Instagram OAuth access_token: {access_token[:20]}...")
        
        if not page_id:
            print("No page_id found for Instagram OAuth connection")
            return []
        
        # Check if this is a Facebook Page ID (shorter) or Instagram account ID (longer)
        # Instagram account IDs are typically 15+ digits, Facebook Page IDs are usually 10-15 digits
        print(f"🔍 Checking page_id: {page_id} (length: {len(page_id)})")
        
        if page_id.isdigit() and len(page_id) <= 15:
            # This looks like a Facebook Page ID, need to get Instagram account
            print(f"🔄 page_id looks like Facebook Page ID, looking up Instagram account...")
            async with httpx.AsyncClient() as client:
                instagram_account_response = await client.get(
                    f"https://graph.facebook.com/v18.0/{page_id}",
                    params={
                        "access_token": access_token,
                        "fields": "instagram_business_account"
                    }
                )
                
                print(f"Instagram account lookup response: {instagram_account_response.status_code}")
                
                if instagram_account_response.status_code != 200:
                    print(f"Instagram account lookup error: {instagram_account_response.status_code} - {instagram_account_response.text}")
                    return []
                
                account_data = instagram_account_response.json()
                instagram_business_account = account_data.get('instagram_business_account')
                
                if not instagram_business_account:
                    print("No Instagram Business account found for this Facebook Page")
                    return []
                
                instagram_account_id = instagram_business_account.get('id')
                print(f"Found Instagram Business account ID: {instagram_account_id}")
        else:
            # This is already an Instagram account ID (15+ digits)
            instagram_account_id = page_id
            print(f"✅ Using page_id as Instagram account ID: {instagram_account_id}")
        
        # Now fetch media from Instagram Graph API
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://graph.facebook.com/v18.0/{instagram_account_id}/media",
                params={
                    "access_token": access_token,
                    "fields": "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
                    "limit": limit
                }
            )
            
            print(f"Instagram OAuth API response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"Instagram OAuth API response data: {data}")
                posts = []
                
                for media in data.get('data', []):
                    post_data = {
                        'id': media.get('id'),
                        'message': media.get('caption', ''),
                        'created_time': media.get('timestamp'),
                        'permalink_url': media.get('permalink'),
                        'media_url': media.get('media_url') or media.get('thumbnail_url'),
                        'thumbnail_url': media.get('thumbnail_url'),
                        'media_type': media.get('media_type', 'IMAGE'),
                        'likes_count': media.get('like_count', 0),
                        'comments_count': media.get('comments_count', 0),
                        'shares_count': 0  # Instagram doesn't provide shares count
                    }
                    posts.append(post_data)
                
                print(f"Instagram OAuth posts processed: {len(posts)}")
                return posts
            else:
                print(f"Instagram OAuth API error: {response.status_code} - {response.text}")
                return []
                
    except Exception as e:
        print(f"Error fetching Instagram OAuth posts: {e}")
        return []

async def fetch_instagram_posts_new(connection: dict, limit: int) -> List[Dict[str, Any]]:
    """Fetch latest posts from Instagram using Basic Display API"""
    try:
        # Token connections use access_token field
        encrypted_token = connection.get('access_token', '')
        access_token = decrypt_token(encrypted_token)
        account_id = connection.get('account_id')
        
        print(f"Instagram account_id: {account_id}")
        print(f"Instagram access_token: {access_token[:20]}...")
        
        if not account_id:
            print("No account_id found for Instagram connection")
            return []
        
        # Fetch media from Instagram Basic Display API
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://graph.instagram.com/{account_id}/media",
                params={
                    "access_token": access_token,
                    "fields": "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
                    "limit": limit
                }
            )
            
            print(f"Instagram API response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"Instagram API response data: {data}")
                posts = []
                
                for media in data.get('data', []):
                    post_data = {
                        'id': media.get('id'),
                        'message': media.get('caption', ''),
                        'created_time': media.get('timestamp'),
                        'permalink_url': media.get('permalink'),
                        'media_url': media.get('media_url') or media.get('thumbnail_url'),
                        'thumbnail_url': media.get('thumbnail_url'),
                        'media_type': media.get('media_type', 'IMAGE'),
                        'likes_count': media.get('like_count', 0),
                        'comments_count': media.get('comments_count', 0),
                        'shares_count': 0  # Instagram doesn't provide shares count
                    }
                    posts.append(post_data)
                
                print(f"Instagram posts processed: {len(posts)}")
                return posts
            else:
                print(f"Instagram API error: {response.status_code} - {response.text}")
                return []
                
    except Exception as e:
        print(f"Error fetching Instagram posts: {e}")
        return []

async def fetch_facebook_posts_oauth(connection: dict, limit: int) -> List[Dict[str, Any]]:
    """Fetch latest posts from Facebook using OAuth connection"""
    try:
        # OAuth connections use access_token_encrypted, token connections use access_token
        encrypted_token = connection.get('access_token_encrypted') or connection.get('access_token', '')
        access_token = decrypt_token(encrypted_token)
        page_id = connection.get('account_id', '')
        
        print(f"Facebook OAuth page_id: {page_id}")
        print(f"Facebook OAuth access_token: {access_token[:20]}...")
        
        if not page_id:
            print("No page_id found for Facebook OAuth connection")
            return []
        
        # Fetch posts from Facebook Graph API
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://graph.facebook.com/v18.0/{page_id}/posts",
                params={
                    "access_token": access_token,
                    "fields": "id,message,created_time,permalink_url,attachments{media},likes.summary(true),comments.summary(true),shares",
                    "limit": limit
                }
            )
            
            print(f"Facebook OAuth API response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"Facebook OAuth API response data: {data}")
                posts = []
                
                for post in data.get('data', []):
                    # Extract media URL if available
                    media_url = None
                    if post.get('attachments', {}).get('data'):
                        attachment = post['attachments']['data'][0]
                        if attachment.get('media', {}).get('image'):
                            media_url = attachment['media']['image'].get('src')
                    
                    post_data = {
                        'id': post.get('id'),
                        'message': post.get('message', ''),
                        'created_time': post.get('created_time'),
                        'permalink_url': post.get('permalink_url'),
                        'media_url': media_url,
                        'likes_count': post.get('likes', {}).get('summary', {}).get('total_count', 0),
                        'comments_count': post.get('comments', {}).get('summary', {}).get('total_count', 0),
                        'shares_count': post.get('shares', {}).get('count', 0)
                    }
                    posts.append(post_data)
                
                print(f"Facebook OAuth posts processed: {len(posts)}")
                return posts
            else:
                print(f"Facebook OAuth API error: {response.status_code} - {response.text}")
                return []
                
    except Exception as e:
        print(f"Error fetching Facebook OAuth posts: {e}")
        return []

async def fetch_facebook_posts_new(connection: dict, limit: int) -> List[Dict[str, Any]]:
    """Fetch latest posts from Facebook"""
    try:
        # Token connections use access_token field
        encrypted_token = connection.get('access_token', '')
        access_token = decrypt_token(encrypted_token)
        account_id = connection.get('account_id')
        
        print(f"Facebook account_id: {account_id}")
        print(f"Facebook access_token: {access_token[:20]}...")
        
        if not account_id:
            print("No account_id found for Facebook connection")
            return []
        
        # Fetch posts from Facebook Graph API
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://graph.facebook.com/v18.0/{account_id}/posts",
                params={
                    "access_token": access_token,
                    "fields": "id,message,created_time,permalink_url,attachments{media},likes.summary(true),comments.summary(true),shares",
                    "limit": limit
                }
            )
            
            print(f"Facebook API response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"Facebook API response data: {data}")
                posts = []
                
                for post in data.get('data', []):
                    # Extract media URL if available
                    media_url = None
                    if post.get('attachments', {}).get('data'):
                        attachment = post['attachments']['data'][0]
                        if attachment.get('media', {}).get('image'):
                            media_url = attachment['media']['image'].get('src')
                    
                    post_data = {
                        'id': post.get('id'),
                        'message': post.get('message', ''),
                        'created_time': post.get('created_time'),
                        'permalink_url': post.get('permalink_url'),
                        'media_url': media_url,
                        'likes_count': post.get('likes', {}).get('summary', {}).get('total_count', 0),
                        'comments_count': post.get('comments', {}).get('summary', {}).get('total_count', 0),
                        'shares_count': post.get('shares', {}).get('count', 0)
                    }
                    posts.append(post_data)
                
                print(f"Facebook posts processed: {len(posts)}")
                return posts
            else:
                print(f"Facebook API error: {response.status_code} - {response.text}")
                return []
                
    except Exception as e:
        print(f"Error fetching Facebook posts: {e}")
        return []

async def fetch_twitter_posts_new(connection: dict, limit: int) -> List[Dict[str, Any]]:
    """Fetch latest posts from Twitter (placeholder)"""
    print("Twitter posts not implemented yet")
    return []

async def fetch_linkedin_posts_new(connection: dict, limit: int) -> List[Dict[str, Any]]:
    """Fetch latest posts from LinkedIn (placeholder)"""
    print("LinkedIn posts not implemented yet")
    return []

@router.post("/instagram/post")
async def post_to_instagram_token(
    post_data: dict,
    current_user: User = Depends(get_current_user)
):
    """Post content to Instagram using token-based authentication"""
    try:
        print(f"📱 Instagram token post request from user: {current_user.id}")
        print(f"📝 Post data: {post_data}")
        
        # Get user's Instagram connection from social_media_connections table
        supabase_client = get_supabase_client()
        response = supabase_client.table("social_media_connections").select("*").eq(
            "user_id", current_user.id
        ).eq("platform", "instagram").eq("is_active", True).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No active Instagram connection found. Please connect your Instagram account first."
            )
        
        connection = response.data[0]
        print(f"🔗 Found Instagram connection: {connection['id']}")
        
        # Decrypt the access token
        try:
            access_token = decrypt_token(connection['access_token'])
            print(f"🔓 Decrypted access token: {access_token[:20]}...")
        except Exception as e:
            print(f"❌ Error decrypting token: {e}")
            # Check if the token is already in plaintext (not encrypted)
            if connection.get('access_token', '').startswith('EAAB') or connection.get('access_token', '').startswith('IG'):
                print("🔓 Token appears to be unencrypted, using directly")
                access_token = connection['access_token']
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to decrypt access token. Please reconnect your Instagram account."
                )
        
        # Prepare the post message
        message = post_data.get('message', '')
        title = post_data.get('title', '')
        hashtags = post_data.get('hashtags', [])
        image_url = post_data.get('image_url', '')
        
        # Combine title, message, and hashtags
        full_message = ""
        if title:
            full_message += f"{title}\n\n"
        full_message += message
        if hashtags:
            hashtag_string = " ".join([f"#{tag}" for tag in hashtags])
            full_message += f"\n\n{hashtag_string}"
        
        print(f"📄 Full message to post: {full_message}")
        print(f"🖼️ Image URL: {image_url}")
        
        # Get Instagram account ID
        instagram_id = connection.get('account_id')
        if not instagram_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Instagram account ID not found. Please reconnect your Instagram account."
            )
        
        # For Instagram Basic Display API, we can only read data, not post
        # Instagram Basic Display API doesn't support posting - only reading
        # We need to inform the user about this limitation
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Instagram Basic Display API does not support posting content. Please use OAuth connection method for posting to Instagram. The Basic Display API is read-only and only allows you to view your Instagram media."
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error posting to Instagram: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to post to Instagram: {str(e)}"
        )

@router.get("/post-insights")
async def get_post_insights(
    post_id: str,
    platform: str,
    current_user: User = Depends(get_current_user)
):
    """
    Get AI-powered insights for a specific post
    Analyzes the current post, compares with previous 5 posts, and performs sentiment analysis
    """
    try:
        user_id = current_user.id
        
        # Get authenticated Supabase client
        supabase_client = get_supabase_client()
        
        # Get user's connections for the platform
        oauth_result = supabase_client.table("platform_connections").select("*").eq(
            "user_id", user_id
        ).eq("platform", platform.lower()).eq("is_active", True).execute()
        
        token_result = supabase_client.table("social_media_connections").select("*").eq(
            "user_id", user_id
        ).eq("platform", platform.lower()).eq("is_active", True).execute()
        
        oauth_connections = oauth_result.data if oauth_result.data else []
        token_connections = token_result.data if token_result.data else []
        
        if not oauth_connections and not token_connections:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No active connection found for {platform}"
            )
        
        # Use first available connection
        connection = oauth_connections[0] if oauth_connections else token_connections[0]
        connection_type = 'oauth' if oauth_connections else 'token'
        
        # Normalize connection data for OAuth connections (similar to latest-posts endpoint)
        if connection_type == 'oauth':
            connection = {
                **connection,
                'access_token': connection.get('access_token_encrypted', ''),
                'account_id': connection.get('page_id', connection.get('account_id', '')),
                'account_name': connection.get('page_name', connection.get('account_name', ''))
            }
        
        # Fetch current post with comments
        current_post = None
        comments = []
        
        if platform.lower() == 'instagram':
            if connection_type == 'oauth':
                current_post, comments = await fetch_instagram_post_with_comments_oauth(connection, post_id)
            else:
                current_post, comments = await fetch_instagram_post_with_comments_new(connection, post_id)
        elif platform.lower() == 'facebook':
            if connection_type == 'oauth':
                current_post, comments = await fetch_facebook_post_with_comments_oauth(connection, post_id)
            else:
                current_post, comments = await fetch_facebook_post_with_comments_new(connection, post_id)
        elif platform.lower() == 'twitter':
            current_post, comments = await fetch_twitter_post_with_comments_new(connection, post_id)
        elif platform.lower() == 'linkedin':
            current_post, comments = await fetch_linkedin_post_with_comments_new(connection, post_id)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported platform: {platform}"
            )
        
        if not current_post:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Post not found or could not be fetched. Please check if the post ID is correct and your {platform} connection is valid."
            )
        
        # Fetch previous posts for comparison - fetch more to ensure we get 5 previous posts
        # Fetch 20 posts to ensure we have enough after filtering out the current post
        previous_posts = []
        if platform.lower() == 'instagram':
            if connection_type == 'oauth':
                previous_posts = await fetch_instagram_posts_oauth(connection, 20)
            else:
                previous_posts = await fetch_instagram_posts_new(connection, 20)
        elif platform.lower() == 'facebook':
            if connection_type == 'oauth':
                previous_posts = await fetch_facebook_posts_oauth(connection, 20)
            else:
                previous_posts = await fetch_facebook_posts_new(connection, 20)
        elif platform.lower() == 'twitter':
            previous_posts = await fetch_twitter_posts_new(connection, 20)
        elif platform.lower() == 'linkedin':
            previous_posts = await fetch_linkedin_posts_new(connection, 20)
        
        # Filter out current post from previous posts and take 5
        # Use flexible matching for post IDs (handle different formats)
        current_post_id = current_post.get('id', post_id)
        previous_posts = [
            p for p in previous_posts 
            if p.get('id') != current_post_id 
            and str(p.get('id', '')) != str(post_id)
            and str(p.get('id', '')) != str(current_post_id)
        ][:5]
        
        print(f"Found {len(previous_posts)} previous posts for comparison (current post ID: {current_post_id}, requested post_id: {post_id})")
        
        # Generate AI insights
        insights = await generate_ai_insights(current_post, previous_posts, comments, platform)
        
        return {
            "insights": insights,
            "post_id": post_id,
            "platform": platform,
            "comments_analyzed": len(comments),
            "previous_posts_compared": len(previous_posts)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error generating post insights: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate insights: {str(e)}"
        )

async def generate_ai_insights(current_post: Dict, previous_posts: List[Dict], comments: List[Dict], platform: str) -> str:
    """Generate AI-powered insights using OpenAI"""
    try:
        openai_api_key = os.getenv("OPENAI_API_KEY")
        if not openai_api_key:
            return "AI insights unavailable: OpenAI API key not configured"
        
        client = openai.OpenAI(api_key=openai_api_key)
        
        # Prepare data for analysis
        current_post_data = {
            "content": current_post.get('message', current_post.get('text', current_post.get('caption', ''))),
            "likes": current_post.get('likes_count', current_post.get('like_count', 0)),
            "comments_count": current_post.get('comments_count', 0),
            "shares": current_post.get('shares_count', 0),
            "created_time": current_post.get('created_time', current_post.get('timestamp', ''))
        }
        
        previous_posts_data = []
        for post in previous_posts:
            previous_posts_data.append({
                "content": post.get('message', post.get('text', post.get('caption', ''))),
                "likes": post.get('likes_count', post.get('like_count', 0)),
                "comments_count": post.get('comments_count', 0),
                "shares": post.get('shares_count', 0),
                "created_time": post.get('created_time', post.get('timestamp', ''))
            })
        
        # Calculate average metrics for previous posts
        avg_likes = sum(p.get('likes_count', p.get('like_count', 0)) for p in previous_posts) / len(previous_posts) if previous_posts else 0
        avg_comments = sum(p.get('comments_count', 0) for p in previous_posts) / len(previous_posts) if previous_posts else 0
        avg_shares = sum(p.get('shares_count', 0) for p in previous_posts) / len(previous_posts) if previous_posts else 0
        
        # Prepare comments for sentiment analysis
        comments_text = [comment.get('text', comment.get('message', '')) for comment in comments[:50]]  # Limit to 50 comments
        
        # Build previous posts summary
        previous_posts_summary = ""
        if previous_posts:
            for i, post in enumerate(previous_posts, 1):
                previous_posts_summary += f"\nPost {i}: {post.get('likes_count', post.get('like_count', 0))} likes, {post.get('comments_count', 0)} comments, {post.get('shares_count', 0)} shares"
        else:
            previous_posts_summary = "\nNo previous posts available for comparison."
        
        prompt = f"""You are a social media analytics expert. Analyze this {platform} post and provide comprehensive insights in a STRICT, STRUCTURED FORMAT.

**IMPORTANT: You MUST format your response EXACTLY as shown below with these exact section headers. Do not deviate from this format.**

---

## Current Post Data:
- Content: {current_post_data['content']}
- Likes: {current_post_data['likes']}
- Comments: {current_post_data['comments_count']}
- Shares: {current_post_data['shares']}
- Posted: {current_post_data['created_time']}

## Previous Posts Average:
- Average Likes: {avg_likes:.1f}
- Average Comments: {avg_comments:.1f}
- Average Shares: {avg_shares:.1f}

## Previous Posts Details:
{previous_posts_summary}

## Comments Sample (for sentiment analysis):
{chr(10).join(comments_text[:30]) if comments_text else 'No comments available'}

---

**REQUIRED OUTPUT FORMAT (use these exact section headers):**

Performance Analysis:
[Compare current post performance (likes, comments, shares) with previous posts. Calculate percentage changes. Mention if it's above/below average. Be specific with numbers.]

Content Analysis:
[Analyze the content quality, messaging style, engagement potential, and what makes it effective or ineffective. Discuss content length, tone, and appeal.]

Sentiment Analysis:
[Analyze comment sentiment - identify positive, negative, and neutral comments. Provide overall sentiment score context. Mention specific positive/negative themes if applicable. Use words like "positive", "negative", "good", "bad", "happy", "disappointed" to help sentiment calculation.]

Trends & Patterns:
[Identify trends or patterns compared to previous posts. Discuss engagement patterns, posting frequency impact, content type performance, time-based patterns if visible.]

Recommendations:
[Provide 3-5 actionable, specific recommendations to improve future posts. Be concrete and data-driven.]

---

**CRITICAL INSTRUCTIONS:**
1. Always start each section with the exact header shown above (e.g., "Performance Analysis:")
2. Do NOT use markdown formatting like ## or ###
3. Keep each section focused and concise (2-4 sentences each)
4. Use specific numbers and percentages when available
5. If data is missing, state that clearly but still provide insights based on available data
6. Ensure sentiment analysis mentions positive/negative keywords for accurate sentiment scoring
7. Always provide all 5 sections, even if some data is limited"""
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system", 
                    "content": "You are a social media analytics expert. You MUST always format your insights responses with these exact section headers: 'Performance Analysis:', 'Content Analysis:', 'Sentiment Analysis:', 'Trends & Patterns:', and 'Recommendations:'. Never deviate from this format. Be specific, data-driven, and actionable."
                },
                {"role": "user", "content": prompt}
            ],
            max_tokens=2000,
            temperature=0.5  # Lower temperature for more consistent output
        )
        
        # Track token usage (non-blocking)
        try:
            from services.token_usage_service import TokenUsageService
            supabase_url = os.getenv("SUPABASE_URL")
            supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
            if supabase_url and supabase_service_key:
                token_tracker = TokenUsageService(supabase_url, supabase_service_key)
                # Get user_id from current_post if available
                user_id = current_post.get("user_id") if current_post else None
                if user_id:
                    import asyncio
                    asyncio.create_task(
                        token_tracker.track_chat_completion_usage(
                            user_id=user_id,
                            feature_type="content_ai_edit",
                            model_name="gpt-4o-mini",
                            response=response,
                            request_metadata={"action": "generate_ai_insights", "platform": platform}
                        )
                    )
        except Exception as e:
            print(f"Error tracking token usage: {e}")
        
        return response.choices[0].message.content
        
    except Exception as e:
        print(f"Error generating AI insights: {e}")
        return f"Error generating insights: {str(e)}"

# Helper functions to fetch post with comments
async def fetch_instagram_post_with_comments_oauth(connection: dict, post_id: str) -> tuple:
    """Fetch Instagram post with comments"""
    try:
        # OAuth connections use access_token_encrypted, token connections use access_token
        encrypted_token = connection.get('access_token_encrypted') or connection.get('access_token', '')
        access_token = decrypt_token(encrypted_token)
        
        async with httpx.AsyncClient() as client:
            # Fetch post
            post_response = await client.get(
                f"https://graph.facebook.com/v18.0/{post_id}",
                params={
                    "access_token": access_token,
                    "fields": "id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count"
                }
            )
            
            if post_response.status_code != 200:
                return None, []
            
            post_data = post_response.json()
            post = {
                'id': post_data.get('id'),
                'caption': post_data.get('caption', ''),
                'created_time': post_data.get('timestamp'),
                'likes_count': post_data.get('like_count', 0),
                'comments_count': post_data.get('comments_count', 0),
                'permalink_url': post_data.get('permalink')
            }
            
            # Fetch comments
            comments_response = await client.get(
                f"https://graph.facebook.com/v18.0/{post_id}/comments",
                params={
                    "access_token": access_token,
                    "fields": "id,text,username,timestamp",
                    "limit": 50
                }
            )
            
            comments = []
            if comments_response.status_code == 200:
                comments_data = comments_response.json()
                comments = comments_data.get('data', [])
            
            return post, comments
            
    except Exception as e:
        print(f"Error fetching Instagram post with comments: {e}")
        return None, []

async def fetch_instagram_post_with_comments_new(connection: dict, post_id: str) -> tuple:
    """Fetch Instagram post with comments (new API)"""
    return await fetch_instagram_post_with_comments_oauth(connection, post_id)

async def fetch_facebook_post_with_comments_oauth(connection: dict, post_id: str) -> tuple:
    """Fetch Facebook post with comments"""
    try:
        # OAuth connections use access_token_encrypted, token connections use access_token
        encrypted_token = connection.get('access_token_encrypted') or connection.get('access_token', '')
        access_token = decrypt_token(encrypted_token)
        
        async with httpx.AsyncClient() as client:
            # Fetch post
            post_response = await client.get(
                f"https://graph.facebook.com/v18.0/{post_id}",
                params={
                    "access_token": access_token,
                    "fields": "id,message,created_time,permalink_url,likes.summary(true),comments.summary(true),shares"
                }
            )
            
            if post_response.status_code != 200:
                return None, []
            
            post_data = post_response.json()
            post = {
                'id': post_data.get('id'),
                'message': post_data.get('message', ''),
                'created_time': post_data.get('created_time'),
                'likes_count': post_data.get('likes', {}).get('summary', {}).get('total_count', 0),
                'comments_count': post_data.get('comments', {}).get('summary', {}).get('total_count', 0),
                'shares_count': post_data.get('shares', {}).get('count', 0),
                'permalink_url': post_data.get('permalink_url')
            }
            
            # Fetch comments
            comments_response = await client.get(
                f"https://graph.facebook.com/v18.0/{post_id}/comments",
                params={
                    "access_token": access_token,
                    "fields": "id,message,from,created_time",
                    "limit": 50
                }
            )
            
            comments = []
            if comments_response.status_code == 200:
                comments_data = comments_response.json()
                comments = comments_data.get('data', [])
            
            return post, comments
            
    except Exception as e:
        print(f"Error fetching Facebook post with comments: {e}")
        import traceback
        traceback.print_exc()
        return None, []

async def fetch_facebook_post_with_comments_new(connection: dict, post_id: str) -> tuple:
    """Fetch Facebook post with comments (new API)"""
    try:
        # Token connections use access_token field
        encrypted_token = connection.get('access_token', '')
        access_token = decrypt_token(encrypted_token)
        
        async with httpx.AsyncClient() as client:
            # Fetch post
            post_response = await client.get(
                f"https://graph.facebook.com/v18.0/{post_id}",
                params={
                    "access_token": access_token,
                    "fields": "id,message,created_time,permalink_url,likes.summary(true),comments.summary(true),shares"
                }
            )
            
            if post_response.status_code != 200:
                return None, []
            
            post_data = post_response.json()
            post = {
                'id': post_data.get('id'),
                'message': post_data.get('message', ''),
                'created_time': post_data.get('created_time'),
                'likes_count': post_data.get('likes', {}).get('summary', {}).get('total_count', 0),
                'comments_count': post_data.get('comments', {}).get('summary', {}).get('total_count', 0),
                'shares_count': post_data.get('shares', {}).get('count', 0),
                'permalink_url': post_data.get('permalink_url')
            }
            
            # Fetch comments
            comments_response = await client.get(
                f"https://graph.facebook.com/v18.0/{post_id}/comments",
                params={
                    "access_token": access_token,
                    "fields": "id,message,from,created_time",
                    "limit": 50
                }
            )
            
            comments = []
            if comments_response.status_code == 200:
                comments_data = comments_response.json()
                comments = comments_data.get('data', [])
            
            return post, comments
            
    except Exception as e:
        print(f"Error fetching Facebook post with comments (new API): {e}")
        import traceback
        traceback.print_exc()
        return None, []

async def fetch_twitter_post_with_comments_new(connection: dict, post_id: str) -> tuple:
    """Fetch Twitter post with comments"""
    try:
        # Twitter API v2 doesn't support direct comment fetching easily
        # We'll return the post and empty comments
        access_token = decrypt_token(connection.get('access_token', ''))
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://api.twitter.com/2/tweets/{post_id}",
                headers={"Authorization": f"Bearer {access_token}"},
                params={
                    "tweet.fields": "created_at,public_metrics",
                    "expansions": "author_id"
                }
            )
            
            if response.status_code != 200:
                return None, []
            
            tweet_data = response.json()
            tweet = tweet_data.get('data', {})
            metrics = tweet.get('public_metrics', {})
            
            post = {
                'id': tweet.get('id'),
                'text': tweet.get('text', ''),
                'created_time': tweet.get('created_at'),
                'likes_count': metrics.get('like_count', 0),
                'comments_count': metrics.get('reply_count', 0),
                'shares_count': metrics.get('retweet_count', 0)
            }
            
            return post, []  # Twitter doesn't easily provide comments via API
            
    except Exception as e:
        print(f"Error fetching Twitter post: {e}")
        return None, []

async def fetch_linkedin_post_with_comments_new(connection: dict, post_id: str) -> tuple:
    """Fetch LinkedIn post with comments"""
    try:
        # LinkedIn API is complex - simplified version
        # Return post with empty comments for now
        return None, []
    except Exception as e:
        print(f"Error fetching LinkedIn post: {e}")
        return None, []