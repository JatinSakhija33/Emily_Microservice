"""
API endpoints for Custom Blog Creation Agent
"""

import os
import json
import logging
from typing import Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from pydantic import BaseModel
import uuid
import os
from supabase import create_client

from auth import get_current_user

# Initialize Supabase for image uploads
supabase_url = os.getenv("SUPABASE_URL")
supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase_admin = create_client(supabase_url, supabase_service_key) if supabase_url and supabase_service_key else None

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/custom-blog", tags=["custom-blog"])

# Custom blog agent is temporarily disabled
# conversation_states: Dict[str, dict] = {}

class StartConversationRequest(BaseModel):
    user_id: str

class UserInputRequest(BaseModel):
    conversation_id: str
    user_input: str
    input_type: str = "text"

@router.post("/start")
async def start_conversation(
    request: StartConversationRequest,
    current_user: dict = Depends(get_current_user)
):
    """Start a new custom blog creation conversation - Service temporarily unavailable"""
    logger.warning(f"Custom blog conversation requested for user {request.user_id}, but custom blog agent is disabled")
    raise HTTPException(status_code=503, detail="Custom blog creation service is temporarily unavailable. Please create blog content manually instead.")

@router.post("/input")
async def process_user_input(
    request: UserInputRequest,
    current_user: dict = Depends(get_current_user)
):
    """Process user input in the conversation - Service temporarily unavailable"""
    logger.warning(f"Custom blog input processing requested for conversation {request.conversation_id}, but custom blog agent is disabled")
    raise HTTPException(status_code=503, detail="Custom blog conversation service is temporarily unavailable. Please create blog content manually instead.")

@router.get("/conversation/{conversation_id}")
async def get_conversation(
    conversation_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get conversation state and messages - Service temporarily unavailable"""
    logger.warning(f"Custom blog conversation retrieval requested for {conversation_id}, but custom blog agent is disabled")
    raise HTTPException(status_code=503, detail="Custom blog conversation service is temporarily unavailable. Please create blog content manually instead.")

@router.delete("/conversation/{conversation_id}")
async def end_conversation(
    conversation_id: str,
    current_user: dict = Depends(get_current_user)
):
    """End and clean up a conversation - Service temporarily unavailable"""
    logger.warning(f"Custom blog conversation deletion requested for {conversation_id}, but custom blog agent is disabled")
    raise HTTPException(status_code=503, detail="Custom blog conversation service is temporarily unavailable. Please create blog content manually instead.")

@router.post("/upload-image")
async def upload_image(
    conversation_id: str = Form(...),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload image for custom blog creation - Service temporarily unavailable"""
    logger.warning(f"Custom blog image upload requested for conversation {conversation_id}, but custom blog agent is disabled")
    raise HTTPException(status_code=503, detail="Custom blog image upload service is temporarily unavailable. Please create blog content manually instead.")

@router.post("/generate-image")
async def generate_image(
    conversation_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Generate image for custom blog creation - Service temporarily unavailable"""
    logger.warning(f"Custom blog image generation requested for conversation {conversation_id}, but custom blog agent is disabled")
    raise HTTPException(status_code=503, detail="Custom blog image generation service is temporarily unavailable. Please create blog content manually instead.")

