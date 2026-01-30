from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, List
import os
from datetime import datetime
from supabase import create_client
from pydantic import BaseModel
import logging
from cryptography.fernet import Fernet

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Supabase clients
supabase_url = os.getenv("SUPABASE_URL")
supabase_anon_key = os.getenv("SUPABASE_ANON_KEY")
supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not supabase_url or not supabase_anon_key:
    raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY must be set")

supabase = create_client(supabase_url, supabase_anon_key)
supabase_admin = create_client(supabase_url, supabase_service_key)

# Encryption setup
ENCRYPTION_KEY = os.getenv('ENCRYPTION_KEY')
if not ENCRYPTION_KEY:
    print("⚠️  WARNING: ENCRYPTION_KEY not set! Generating a new key. This will cause existing tokens to be unreadable.")
    ENCRYPTION_KEY = Fernet.generate_key().decode()
    print(f"🔑 Generated encryption key: {ENCRYPTION_KEY}")
else:
    print(f"🔑 Using provided encryption key: {ENCRYPTION_KEY[:20]}...")

try:
    cipher = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)
except Exception as e:
    print(f"❌ Error initializing cipher: {e}")
    raise

def encrypt_token(token: str) -> str:
    """Encrypt token for storage"""
    try:
        return cipher.encrypt(token.encode()).decode()
    except Exception as e:
        print(f"❌ Error encrypting token: {e}")
        raise

def decrypt_token(encrypted_token: str) -> str:
    """Decrypt token for use"""
    try:
        return cipher.decrypt(encrypted_token.encode()).decode()
    except Exception as e:
        print(f"❌ Error decrypting token: {e}")
        raise

# Security
security = HTTPBearer()

class User(BaseModel):
    id: str
    email: str
    name: str
    created_at: str

class WordPressConnection(BaseModel):
    site_name: str
    site_url: str
    username: str
    password: str

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current user from Supabase JWT token"""
    try:
        token = credentials.credentials
        response = supabase.auth.get_user(token)
        
        if response and hasattr(response, 'user') and response.user:
            user_data = response.user
            return User(
                id=user_data.id,
                email=user_data.email or "unknown@example.com",
                name=user_data.user_metadata.get('name', user_data.email or "Unknown User"),
                created_at=user_data.created_at.isoformat() if hasattr(user_data.created_at, 'isoformat') else str(user_data.created_at)
            )
        else:
            raise HTTPException(status_code=401, detail="Invalid token")
            
    except Exception as e:
        logger.error(f"Authentication error: {e}")
        raise HTTPException(status_code=401, detail="Authentication failed")

router = APIRouter(prefix="/connections/platform", tags=["platform-connections"])

@router.get("/")
async def get_platform_connections(
    current_user: User = Depends(get_current_user),
    platform: Optional[str] = Query(None, description="Filter by platform (e.g., 'wordpress')")
):
    """Get platform connections for the current user"""
    try:
        logger.info(f"Fetching platform connections for user: {current_user.id}, platform: {platform}")
        
        query = supabase_admin.table("platform_connections").select("*").eq("user_id", current_user.id).eq("is_active", True)
        
        if platform:
            query = query.eq("platform", platform)
        
        response = query.execute()
        connections = response.data if response.data else []
        
        logger.info(f"Found {len(connections)} platform connections")
        return connections
        
    except Exception as e:
        logger.error(f"Error fetching platform connections: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch platform connections: {str(e)}")

@router.post("/wordpress/create")
async def create_wordpress_connection(
    connection_data: WordPressConnection,
    current_user: User = Depends(get_current_user)
):
    """Create a new WordPress connection in platform_connections table"""
    try:
        logger.info(f"Creating WordPress connection for user: {current_user.id}")
        
        # Test the WordPress connection first
        import requests
        
        # Try multiple WordPress REST API endpoints for better compatibility
        endpoints_to_try = [
            f"{connection_data.site_url.rstrip('/')}/wp-json/wp/v2/users/me",
            f"{connection_data.site_url.rstrip('/')}/wp-json/wp/v2/users",
            f"{connection_data.site_url.rstrip('/')}/wp-json/wp/v2/posts?per_page=1"
        ]
        
        response = None
        successful_endpoint = None
        
        for endpoint in endpoints_to_try:
            try:
                response = requests.get(
                    endpoint,
                    auth=(connection_data.username, connection_data.password),
                    headers={
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'User-Agent': 'Agent-Emily/1.0'
                    },
                    timeout=10
                )
                
                # Debug: Log the response details
                logger.info(f"WordPress API response for {endpoint}: Status {response.status_code}")
                logger.info(f"Response headers: {dict(response.headers)}")
                logger.info(f"Response text: {response.text[:200]}...")
                logger.info(f"Status code type: {type(response.status_code)}, value: {response.status_code}")
                
                if response.status_code == 200:
                    successful_endpoint = endpoint
                    break
                elif response.status_code == 401 or str(response.status_code) == "401":
                    # Authentication failed - wrong username/password
                    logger.error(f"Authentication failed for {endpoint}: {response.text}")
                    logger.error(f"Raising HTTPException with status 401")
                    raise HTTPException(
                        status_code=401,
                        detail="Invalid WordPress credentials. Please check your username and app password."
                    )
                elif response.status_code == 403 or str(response.status_code) == "403":
                    # Access denied - user doesn't have permission or REST API blocked
                    logger.error(f"Access denied for {endpoint}: {response.text}")
                    raise HTTPException(
                        status_code=403,
                        detail="Access denied. Please check that your WordPress user has administrator privileges and REST API is not blocked by security plugins."
                    )
                elif response.status_code == 404 or str(response.status_code) == "404":
                    # Site not found
                    logger.error(f"Site not found for {endpoint}: {response.text}")
                    raise HTTPException(
                        status_code=404,
                        detail="WordPress site not found. Please check that your site URL is correct and your site is accessible."
                    )
                elif response.status_code == 500 or str(response.status_code) == "500":
                    # WordPress server error
                    logger.error(f"WordPress server error for {endpoint}: {response.text}")
                    raise HTTPException(
                        status_code=500,
                        detail="WordPress server error. Please try again later or contact your WordPress administrator."
                    )
                elif response.status_code == 406:
                    logger.warning(f"406 Not Acceptable for {endpoint}, trying next...")
                    continue
                else:
                    logger.warning(f"Status {response.status_code} for {endpoint}, trying next...")
                    continue
                    
            except HTTPException:
                # Re-raise HTTP exceptions (401, 403, 404)
                raise
            except requests.exceptions.RequestException as e:
                logger.warning(f"Request failed for {endpoint}: {e}")
                # Check if this is a domain resolution error
                error_str = str(e).lower()
                if 'getaddrinfo failed' in error_str or 'name resolution' in error_str or 'nodename nor servname provided' in error_str:
                    logger.error(f"Domain resolution failed for {endpoint}: {e}")
                    raise HTTPException(
                        status_code=404,
                        detail="WordPress site not found. Please check that your site URL is correct and your site is accessible."
                    )
                continue
        
        if not response or not successful_endpoint:
            # Check if this was due to domain resolution issues
            raise HTTPException(
                status_code=404,
                detail="WordPress site not found. Please check that your site URL is correct and your site is accessible."
            )
        
        logger.info(f"WordPress REST API response: {response.status_code}")
        
        user_info = response.json()
        logger.info(f"WordPress REST API authentication successful!")
        logger.info(f"User: {user_info.get('name', 'Unknown')}")
        logger.info(f"Email: {user_info.get('email', 'Unknown')}")
        
        # Encrypt the password
        encrypted_password = encrypt_token(connection_data.password)
        
        # Store connection in platform_connections table
        connection_record = {
            "user_id": current_user.id,
            "platform": "wordpress",
            "page_id": f"wp_{connection_data.site_url}",  # Use site URL as page_id
            "page_name": connection_data.site_name,
            "page_username": connection_data.username,
            "is_active": True,
            "connection_status": "active",
            "connected_at": datetime.now().isoformat(),
            "wordpress_site_url": connection_data.site_url,
            "wordpress_username": connection_data.username,
            "wordpress_app_password_encrypted": encrypted_password,
            "wordpress_site_name": connection_data.site_name,
            "wordpress_user_id": user_info.get('id'),
            "wordpress_user_email": user_info.get('email', ''),
            "wordpress_user_display_name": user_info.get('name', connection_data.site_name),
            "wordpress_capabilities": user_info.get('capabilities', {}),
            "wordpress_version": user_info.get('wordpress_version', 'Unknown'),
            "wordpress_last_checked_at": datetime.now().isoformat(),
            "wordpress_metadata": {
                "site_title": user_info.get('display_name', connection_data.site_name),
                "site_description": user_info.get('description', ''),
                "user_display_name": user_info.get('display_name', connection_data.site_name),
                "user_email": user_info.get('user_email', ''),
                "capabilities": user_info.get('capabilities', {}),
                "wordpress_version": user_info.get('wordpress_version', 'Unknown')
            }
        }
        
        response = supabase_admin.table("platform_connections").insert(connection_record).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=500,
                detail="Failed to create WordPress connection"
            )
        
        logger.info(f"WordPress connection created: {response.data[0]['id']}")
        
        return {
            "success": True,
            "message": f"Successfully connected to {connection_data.site_name}",
            "connection": response.data[0],
            "site_info": {
                "site_name": connection_data.site_name,
                "site_url": connection_data.site_url,
                "site_title": user_info.get('display_name', connection_data.site_name),
                "user_display_name": user_info.get('display_name', connection_data.site_name)
            }
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions (401, 403, 404) that we specifically created
        raise
    except requests.exceptions.RequestException as e:
        logger.error(f"WordPress REST API request failed: {e}")
        raise HTTPException(
            status_code=400,
            detail=f"Failed to connect to WordPress site. Please check your site URL and ensure it's accessible. Error: {str(e)}"
        )
    except Exception as e:
        logger.error(f"WordPress REST API authentication failed: {e}")
        # Check if this is an authentication-related error
        error_str = str(e).lower()
        if '401' in error_str or 'unauthorized' in error_str or 'authentication' in error_str:
            raise HTTPException(
                status_code=401,
                detail="Invalid WordPress credentials. Please check your username and app password."
            )
        elif '403' in error_str or 'forbidden' in error_str or 'access denied' in error_str:
            raise HTTPException(
                status_code=403,
                detail="Access denied. Please check that your WordPress user has administrator privileges and REST API is not blocked by security plugins."
            )
        elif '404' in error_str or 'not found' in error_str:
            raise HTTPException(
                status_code=404,
                detail="WordPress site not found. Please check that your site URL is correct and your site is accessible."
            )
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to authenticate with WordPress REST API. Please check your credentials and ensure the REST API is enabled. Error: {str(e)}"
            )

@router.delete("/wordpress/delete/{connection_id}")
async def delete_wordpress_connection(
    connection_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a WordPress connection"""
    try:
        logger.info(f"Deleting WordPress connection {connection_id} for user: {current_user.id}")
        
        # Verify the connection belongs to the user
        response = supabase_admin.table("platform_connections").select("*").eq("id", connection_id).eq("user_id", current_user.id).eq("platform", "wordpress").execute()
        
        if not response.data:
            raise HTTPException(
                status_code=404,
                detail="WordPress connection not found"
            )
        
        # Delete the connection
        delete_response = supabase_admin.table("platform_connections").delete().eq("id", connection_id).eq("user_id", current_user.id).execute()
        
        if not delete_response.data:
            raise HTTPException(
                status_code=500,
                detail="Failed to delete WordPress connection"
            )
        
        logger.info(f"WordPress connection deleted: {connection_id}")
        
        return {
            "success": True,
            "message": "WordPress connection deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting WordPress connection: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete WordPress connection: {str(e)}"
        )

@router.post("/wordpress/{connection_id}/test")
async def test_wordpress_connection(
    connection_id: str,
    current_user: User = Depends(get_current_user)
):
    """Test a WordPress connection"""
    try:
        logger.info(f"Testing WordPress connection {connection_id} for user: {current_user.id}")
        
        # Get connection details
        response = supabase_admin.table("platform_connections").select("*").eq("id", connection_id).eq("user_id", current_user.id).eq("platform", "wordpress").eq("is_active", True).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=404,
                detail="WordPress connection not found"
            )
        
        connection = response.data[0]
        
        # Decrypt the password
        try:
            password = decrypt_token(connection['wordpress_app_password_encrypted'])
        except Exception as e:
            logger.error(f"Error decrypting password: {e}")
            raise HTTPException(
                status_code=500,
                detail="Failed to decrypt password"
            )
        
        # Test the connection using WordPress REST API authentication
        rest_url = f"{connection['wordpress_site_url'].rstrip('/')}/wp-json/wp/v2/users/me"
        
        logger.info(f"Testing WordPress connection with REST API: {rest_url}")
        
        try:
            import requests
            
            response = requests.get(
                rest_url,
                auth=(connection['wordpress_username'], password),
                headers={
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'Agent-Emily/1.0'
                },
                timeout=10
            )
            
            if response.status_code == 200:
                user_info = response.json()
                logger.info(f"WordPress connection test successful!")
                
                # Update last_checked_at
                supabase_admin.table("platform_connections").update({
                    "wordpress_last_checked_at": datetime.now().isoformat()
                }).eq("id", connection_id).execute()
                
                return {
                    "success": True,
                    "message": "WordPress connection is working",
                    "site_info": {
                        "site_name": connection['wordpress_site_name'],
                        "site_url": connection['wordpress_site_url'],
                        "user_display_name": user_info.get('name', 'Unknown'),
                        "user_email": user_info.get('email', 'Unknown')
                    }
                }
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"WordPress connection test failed with status {response.status_code}: {response.text}"
                )
                
        except requests.exceptions.RequestException as e:
            logger.error(f"WordPress REST API test failed: {e}")
            raise HTTPException(
                status_code=400,
                detail=f"Failed to test WordPress connection. Error: {str(e)}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error testing WordPress connection: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to test WordPress connection: {str(e)}"
        )
