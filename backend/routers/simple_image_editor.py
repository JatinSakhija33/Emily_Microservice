"""
Simplified Image Editor API - No LangGraph
"""

import logging
from typing import Dict, Any
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from services.image_editor_service import image_editor_service
from auth import get_current_user
from supabase import create_client, Client
import os

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/simple-image-editor", tags=["simple-image-editor"])

# Initialize Supabase
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(supabase_url, supabase_key)

# Request Models
class AddLogoRequest(BaseModel):
    user_id: str
    input_image_url: str
    content: str
    position: str = "bottom_right"

class ApplyTemplateRequest(BaseModel):
    user_id: str
    input_image_url: str
    content: str
    template_name: str

class ManualEditRequest(BaseModel):
    user_id: str
    input_image_url: str
    content: str
    instructions: str

class SaveImageRequest(BaseModel):
    user_id: str
    post_id: str
    original_image_url: str
    edited_image_url: str

@router.get("/profiles/{user_id}")
async def get_user_profile(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get user profile for image editor"""
    try:
        logger.info(f"Getting profile for user {user_id}")
        
        result = supabase.table('profiles').select('*').eq('id', user_id).execute()
        
        if result.data:
            return result.data[0]
        else:
            raise HTTPException(status_code=404, detail="Profile not found")
            
    except Exception as e:
        logger.error(f"Error getting profile: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/add-logo")
async def add_logo(
    request: AddLogoRequest,
    current_user: dict = Depends(get_current_user)
):
    """Add logo to image"""
    try:
        logger.info(f"Add logo request for user {request.user_id}")
        result = await image_editor_service.add_logo_to_image(
            user_id=request.user_id,
            input_image_url=request.input_image_url,
            content=request.content,
            position=request.position
        )
        
        if result["success"]:
            return result
        else:
            logger.error(f"Add logo failed: {result['error']}")
            raise HTTPException(status_code=400, detail=result["error"])
            
    except Exception as e:
        logger.error(f"Error in add_logo endpoint: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.post("/apply-template")
async def apply_template(
    request: ApplyTemplateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Apply template to image"""
    try:
        result = await image_editor_service.apply_template(
            user_id=request.user_id,
            input_image_url=request.input_image_url,
            content=request.content,
            template_name=request.template_name
        )
        
        if result["success"]:
            return result
        else:
            raise HTTPException(status_code=400, detail=result["error"])
            
    except Exception as e:
        logger.error(f"Error in apply_template endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/manual-edit")
async def manual_edit(
    request: ManualEditRequest,
    current_user: dict = Depends(get_current_user)
):
    """Apply manual editing instructions"""
    try:
        from middleware.credit_middleware import check_credits_before_action, increment_usage_after_action

        # Check credits before image editing
        await check_credits_before_action(request.user_id, 'image')
        result = await image_editor_service.apply_manual_instructions(
            user_id=request.user_id,
            input_image_url=request.input_image_url,
            content=request.content,
            instructions=request.instructions
        )
        
        if result["success"]:
            # Increment usage after successful image editing
            await increment_usage_after_action(request.user_id, 'image')
            return result
        else:
            raise HTTPException(status_code=400, detail=result["error"])
            
    except Exception as e:
        logger.error(f"Error in manual_edit endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/save-image")
async def save_image(
    request: SaveImageRequest,
    current_user: dict = Depends(get_current_user)
):
    """Save edited image by updating the content record with new image URL"""
    try:
        logger.info(f"Saving edited image for user {request.user_id}")
        logger.info(f"Post ID: {request.post_id}")
        logger.info(f"Original URL: {request.original_image_url}")
        logger.info(f"Edited URL: {request.edited_image_url}")

        # Update the images array in the created_content table
        # First, get the current content to see the images array
        content_result = supabase.table('created_content').select('images').eq('id', request.post_id).execute()

        if not content_result.data:
            raise HTTPException(status_code=404, detail="Content post not found")

        current_images = content_result.data[0].get('images', [])
        logger.info(f"Current images in post {request.post_id}: {current_images}")
        logger.info(f"Looking for original URL: {request.original_image_url}")

        # Find the original image in the array (handle URL variations)
        original_found = False
        updated_images = []

        for img in current_images:
            # Compare URLs, ignoring query parameters if present
            img_base = img.split('?')[0] if '?' in img else img
            original_base = request.original_image_url.split('?')[0] if '?' in request.original_image_url else request.original_image_url

            if img_base == original_base or img == request.original_image_url:
                updated_images.append(request.edited_image_url)
                original_found = True
                logger.info(f"Found and replaced image: {img} -> {request.edited_image_url}")
            else:
                updated_images.append(img)

        if original_found:
            update_result = supabase.table('created_content').update({
                'images': updated_images
            }).eq('id', request.post_id).execute()

            if not update_result.data:
                raise HTTPException(status_code=400, detail="Failed to update images in database")

            # Also update any conversation messages that reference this image
            try:
                # Find conversation messages that contain the old image URL in text
                messages_with_image = supabase.table('atsn_conversation_messages').select('id, text').like('text', f'%{request.original_image_url}%').execute()

                if messages_with_image.data:
                    for message in messages_with_image.data:
                        updated_text = message['text'].replace(request.original_image_url, request.edited_image_url)
                        supabase.table('atsn_conversation_messages').update({
                            'text': updated_text
                        }).eq('id', message['id']).execute()

                    logger.info(f"Updated {len(messages_with_image.data)} conversation messages with image URLs")

                # Also update metadata JSON field if it contains image_url
                metadata_messages = supabase.table('atsn_conversation_messages').select('id, metadata').eq('metadata->>image_url', request.original_image_url).execute()
        
                if metadata_messages.data:
                    for message in metadata_messages.data:
                        updated_metadata = message['metadata'].copy()
                        updated_metadata['image_url'] = request.edited_image_url
                        supabase.table('atsn_conversation_messages').update({
                            'metadata': updated_metadata
                        }).eq('id', message['id']).execute()

                    logger.info(f"Updated {len(metadata_messages.data)} conversation metadata records")

            except Exception as e:
                logger.warning(f"Failed to update conversation messages: {e}")
                # Don't fail the entire operation if conversation update fails

        else:
            logger.error(f"Original image not found in array. Available images: {current_images}")
            raise HTTPException(status_code=400, detail=f"Original image not found in content images array. Original: {request.original_image_url}")

            logger.info(f"Successfully updated image URL for post {request.post_id}")

            # ✅ Increment image count after successful editing
            try:
                # Read current image count and increment
                current_images = supabase.table('profiles').select('images_generated_this_month').eq('id', request.user_id).execute()
                if current_images.data and len(current_images.data) > 0:
                    current_image_count = current_images.data[0]['images_generated_this_month'] or 0
                    supabase.table('profiles').update({
                        'images_generated_this_month': current_image_count + 1
                    }).eq('id', request.user_id).execute()
                    logger.info(f"Incremented image count for user {request.user_id} after successful editing (from {current_image_count} to {current_image_count + 1})")
            except Exception as counter_error:
                logger.error(f"Error incrementing image count after editing: {counter_error}")

        return {
            "success": True,
            "message": "Image saved successfully! The content has been updated with the edited image.",
            "post_id": request.post_id,
            "new_image_url": request.edited_image_url
        }
            
    except Exception as e:
        logger.error(f"Error in save_image endpoint: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
