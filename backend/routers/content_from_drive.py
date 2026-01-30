"""
API Router for Content from Drive Agent
Handles processing of Google Drive content and automatic post creation
"""

import os
import logging
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from typing import Optional, Dict, Any

from agents.content_from_drive_agent import ContentFromDriveAgent, ContentFromDriveState
from auth import get_current_user

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/content/drive", tags=["content-from-drive"])

# Initialize the content from drive agent
openai_api_key = os.getenv("OPENAI_API_KEY")
if not openai_api_key:
    raise ValueError("OPENAI_API_KEY environment variable is required")

content_from_drive_agent = ContentFromDriveAgent(openai_api_key)
content_from_drive_graph = content_from_drive_agent.create_graph()

class ProcessDriveContentRequest(BaseModel):
    """Request to process content from Google Drive"""
    user_id: str

class ProcessDriveContentResponse(BaseModel):
    """Response from processing drive content"""
    success: bool
    message: str
    posts_created: int
    posts_scheduled: int
    errors: Optional[list] = None
    # Detailed state information
    emily_folder_found: bool = False
    photos_found: int = 0
    photos_analyzed: int = 0
    captions_generated: int = 0
    posts_saved: int = 0

@router.post("/process", response_model=ProcessDriveContentResponse)
async def process_drive_content(
    request: ProcessDriveContentRequest,
    current_user = Depends(get_current_user)
):
    """
    Process content from Google Drive and create scheduled posts
    
    Scans the 'emily' folder in Google Drive for platform-specific subfolders,
    processes images with descriptions and dates in filenames, analyzes photos,
    generates captions, and schedules posts.
    """
    try:
        # Verify user ID matches
        if request.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User ID mismatch"
            )
        
        # Initialize state
        initial_state: ContentFromDriveState = {
            "user_id": current_user.id,
            "current_step": None,
            "google_credentials": None,
            "emily_folder_id": None,
            "platform_folders": {},
            "connected_platforms": [],
            "files_to_process": [],
            "processed_files": [],
            "analyzed_photos": [],
            "generated_posts": [],
            "saved_posts": [],
            "error_message": None,
            "progress_percentage": 0,
            "current_platform": None,
            "current_file_index": 0
        }
        
        # Run the graph
        logger.info(f"Starting drive content processing for user {current_user.id}")
        final_state = await content_from_drive_graph.ainvoke(initial_state)
        
        # Check for errors
        if final_state.get("current_step") == "error" or final_state.get("error_message"):
            return ProcessDriveContentResponse(
                success=False,
                message=final_state.get("error_message", "Unknown error occurred"),
                posts_created=0,
                posts_scheduled=0,
                errors=[final_state.get("error_message", "Unknown error")],
                emily_folder_found=False,
                photos_found=0,
                photos_analyzed=0,
                captions_generated=0,
                posts_saved=0
            )
        
        # Extract detailed state information
        emily_folder_found = final_state.get("emily_folder_id") is not None
        files_to_process = final_state.get("files_to_process", [])
        analyzed_photos = final_state.get("analyzed_photos", [])
        generated_posts = final_state.get("generated_posts", [])
        saved_posts = final_state.get("saved_posts", [])
        
        # Count scheduled vs draft posts
        from datetime import datetime
        now = datetime.now()
        posts_scheduled = sum(1 for post in generated_posts if post.get("scheduled_date") and post.get("scheduled_date") > now)
        
        return ProcessDriveContentResponse(
            success=True,
            message=f"Successfully processed {len(saved_posts)} posts from Google Drive",
            posts_created=len(saved_posts),
            posts_scheduled=len([p for p in generated_posts if p.get("scheduled_date")]),
            errors=None,
            emily_folder_found=emily_folder_found,
            photos_found=len(files_to_process),
            photos_analyzed=len(analyzed_photos),
            captions_generated=len(generated_posts),
            posts_saved=len(saved_posts)
        )
        
    except Exception as e:
        logger.error(f"Error processing drive content: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process drive content: {str(e)}"
        )

@router.get("/status")
async def get_drive_processing_status(current_user = Depends(get_current_user)):
    """
    Get status of Google Drive connection and emily folder
    """
    try:
        from supabase import create_client, Client
        from google.auth.transport.requests import Request
        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build
        from cryptography.fernet import Fernet
        
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        supabase: Client = create_client(supabase_url, supabase_key)
        
        # Check Google connection
        response = supabase.table("platform_connections").select("*").eq("platform", "google").eq("user_id", current_user.id).eq("is_active", True).execute()
        
        if not response.data:
            return {
                "google_connected": False,
                "emily_folder_found": False,
                "platform_folders": [],
                "message": "Google account not connected"
            }
        
        conn = response.data[0]
        
        # Decrypt tokens
        encryption_key = os.getenv("ENCRYPTION_KEY")
        if not encryption_key:
            return {
                "google_connected": True,
                "emily_folder_found": False,
                "platform_folders": [],
                "message": "Encryption key not configured"
            }
        
        f = Fernet(encryption_key.encode())
        access_token = f.decrypt(conn['access_token_encrypted'].encode()).decode()
        refresh_token = f.decrypt(conn['refresh_token_encrypted'].encode()).decode() if conn.get('refresh_token_encrypted') else None
        
        # Create credentials
        credentials = Credentials(
            token=access_token,
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=os.getenv('GOOGLE_CLIENT_ID'),
            client_secret=os.getenv('GOOGLE_CLIENT_SECRET'),
            scopes=['https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/drive.file']
        )
        
        if credentials.expired and credentials.refresh_token:
            credentials.refresh(Request())
        
        # Check for emily folder
        service = build('drive', 'v3', credentials=credentials)
        query = "name='emily' and mimeType='application/vnd.google-apps.folder' and trashed=false"
        results = service.files().list(q=query, fields="files(id, name)").execute()
        files = results.get('files', [])
        
        emily_folder_id = files[0]['id'] if files else None
        
        platform_folders = []
        if emily_folder_id:
            # Get platform folders
            query = f"'{emily_folder_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
            results = service.files().list(q=query, fields="files(id, name)").execute()
            folders = results.get('files', [])
            platform_folders = [f['name'] for f in folders]
        
        return {
            "google_connected": True,
            "emily_folder_found": emily_folder_id is not None,
            "platform_folders": platform_folders,
            "message": "Ready to process" if emily_folder_id else "emily folder not found"
        }
        
    except Exception as e:
        logger.error(f"Error getting drive status: {e}")
        return {
            "google_connected": False,
            "emily_folder_found": False,
            "platform_folders": [],
            "message": f"Error: {str(e)}"
        }

