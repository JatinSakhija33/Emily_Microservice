"""
Template Editor API Router
Handles template editing requests and workflow management
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse, FileResponse
from typing import Optional, Dict, Any
import base64
import json
from datetime import datetime
import os

from agents.template_editor_agent import template_editor_agent
from auth import get_current_user
from utils.template_manager import template_manager
from utils.prompt_manager import prompt_manager
from supabase import create_client, Client

router = APIRouter(prefix="/api/template-editor", tags=["template-editor"])

# Initialize Supabase
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase_admin: Client = create_client(supabase_url, supabase_key)

@router.post("/start-editing")
async def start_template_editing(
    content_id: str = Form(...),
    template_id: Optional[str] = Form(None),
    template_image: Optional[UploadFile] = File(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Start the template editing process
    """
    try:
        # Get content details
        content_response = supabase_admin.table("content").select("*").eq("id", content_id).eq("user_id", current_user.id).execute()
        
        if not content_response.data:
            raise HTTPException(status_code=404, detail="Content not found")
        
        content = content_response.data[0]
        
        # Handle template image upload
        template_image_b64 = None
        if template_image:
            # Convert uploaded file to base64
            image_data = await template_image.read()
            template_image_b64 = base64.b64encode(image_data).decode()
            template_image_b64 = f"data:image/jpeg;base64,{template_image_b64}"
        
        # Start template editing process
        result = await template_editor_agent.process_template_edit(
            current_content=content.get("content", ""),
            current_image_url=content.get("image_url", ""),
            user_id=current_user.id,
            content_id=content_id,
            template_id=template_id,
            template_image=template_image_b64
        )
        
        return JSONResponse(content={
            "success": result["success"],
            "message": "Template editing process started",
            "workflow_id": f"template_edit_{content_id}_{datetime.now().timestamp()}",
            "current_node": result["current_node"],
            "final_template": result["final_template"],
            "error": result.get("error_message")
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start template editing: {str(e)}")

@router.get("/premade-templates")
async def get_premade_templates(
    category: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Get available premade templates from static files
    """
    try:
        # Get templates from template manager
        if category and category != "all":
            templates = template_manager.get_templates_by_category(category)
        else:
            templates = template_manager.get_all_templates()
        
        # Format templates for API response
        formatted_templates = []
        for template in templates:
            formatted_templates.append({
                "id": template["id"],
                "name": template["name"],
                "category": template["category"],
                "description": template.get("description", ""),
                "preview_url": template.get("preview_url", ""),
                "filename": template.get("filename", ""),
                "content_areas": template.get("content_areas", []),
                "image_areas": template.get("image_areas", []),
                "design_info": template.get("design_info", {})
            })
        
        return JSONResponse(content={
            "success": True,
            "templates": formatted_templates
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch templates: {str(e)}")

@router.post("/continue-workflow")
async def continue_workflow(
    workflow_id: str = Form(...),
    user_satisfied: bool = Form(False),
    custom_instructions: Optional[str] = Form(None),
    needs_restart: bool = Form(False),
    current_user: dict = Depends(get_current_user)
):
    """
    Continue the template editing workflow with user input
    """
    try:
        # This would typically store workflow state in a database
        # For now, we'll simulate the continuation
        
        # Extract content_id from workflow_id
        content_id = workflow_id.split("_")[2]
        
        # Get current content
        content_response = supabase_admin.table("content").select("*").eq("id", content_id).eq("user_id", current_user.id).execute()
        
        if not content_response.data:
            raise HTTPException(status_code=404, detail="Content not found")
        
        content = content_response.data[0]
        
        # Create new state for continuation
        from agents.template_editor_agent import TemplateEditorState
        
        # This is a simplified continuation - in production, you'd store the full state
        state = TemplateEditorState(
            current_content=content.get("content", ""),
            current_image_url=content.get("image_url", ""),
            user_id=current_user.id,
            content_id=content_id,
            template_id=None,
            template_image=None,
            template_type="premade",
            template_analysis=None,
            content_pieces=None,
            image_modifications=None,
            modified_content=None,
            modified_image=None,
            final_template=None,
            user_satisfied=user_satisfied,
            custom_instructions=custom_instructions,
            needs_restart=needs_restart,
            current_node="flow_router",
            error_message=None
        )
        
        # Continue from flow_router
        result = await template_editor_agent.flow_router(state)
        
        return JSONResponse(content={
            "success": not bool(result.get("error_message")),
            "current_node": result.get("current_node"),
            "final_template": result.get("final_template"),
            "error": result.get("error_message"),
            "next_action": "custom_edit" if custom_instructions else ("save" if user_satisfied else "waiting")
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to continue workflow: {str(e)}")

@router.get("/workflow-status/{workflow_id}")
async def get_workflow_status(
    workflow_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get the current status of a template editing workflow
    """
    try:
        # In production, this would fetch from a workflow state store
        # For now, return a basic status
        
        return JSONResponse(content={
            "success": True,
            "workflow_id": workflow_id,
            "status": "active",
            "current_node": "content_output_generator",
            "progress": 80,
            "message": "Template generation in progress"
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get workflow status: {str(e)}")

@router.post("/upload-template")
async def upload_template(
    template_file: UploadFile = File(...),
    template_name: str = Form(...),
    category: str = Form(...),
    description: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Upload a custom template
    """
    try:
        # Validate file type
        if not template_file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        # Convert to base64
        image_data = await template_file.read()
        image_b64 = base64.b64encode(image_data).decode()
        
        # Save template to database
        
        template_data = {
            "name": template_name,
            "category": category,
            "description": description or "",
            "template_image": f"data:image/jpeg;base64,{image_b64}",
            "user_id": current_user.id,
            "created_at": datetime.now().isoformat()
        }
        
        response = supabase_admin.table("premade_templates").insert(template_data).execute()
        
        if response.data:
            return JSONResponse(content={
                "success": True,
                "message": "Template uploaded successfully",
                "template_id": response.data[0]["id"]
            })
        else:
            raise HTTPException(status_code=500, detail="Failed to save template")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload template: {str(e)}")

@router.delete("/template/{template_id}")
async def delete_template(
    template_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete a custom template
    """
    try:
        
        # Check if user owns the template
        template_response = supabase_admin.table("premade_templates").select("*").eq("id", template_id).eq("user_id", current_user.id).execute()
        
        if not template_response.data:
            raise HTTPException(status_code=404, detail="Template not found or not owned by user")
        
        # Delete template
        delete_response = supabase_admin.table("premade_templates").delete().eq("id", template_id).execute()
        
        return JSONResponse(content={
            "success": True,
            "message": "Template deleted successfully"
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete template: {str(e)}")

@router.get("/categories")
async def get_template_categories(
    current_user: dict = Depends(get_current_user)
):
    """
    Get available template categories from static files
    """
    try:
        categories = template_manager.get_categories()
        
        return JSONResponse(content={
            "success": True,
            "categories": categories
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch categories: {str(e)}")

@router.get("/template-image/{template_id}")
async def get_template_image(
    template_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Serve template image file
    """
    try:
        image_path = template_manager.get_template_image_path(template_id)
        if not image_path or not os.path.exists(image_path):
            raise HTTPException(status_code=404, detail="Template image not found")
        
        return FileResponse(
            path=image_path,
            media_type="image/jpeg",
            filename=f"{template_id}.jpg"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to serve template image: {str(e)}")

@router.get("/template-preview/{template_id}")
async def get_template_preview(
    template_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get template preview URL
    """
    try:
        preview_url = template_manager.get_template_preview_url(template_id)
        if not preview_url:
            raise HTTPException(status_code=404, detail="Template preview not found")
        
        return JSONResponse(content={
            "success": True,
            "preview_url": preview_url
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get template preview: {str(e)}")

@router.get("/template-stats")
async def get_template_stats(
    current_user: dict = Depends(get_current_user)
):
    """
    Get template statistics
    """
    try:
        stats = template_manager.get_template_stats()
        
        return JSONResponse(content={
            "success": True,
            "stats": stats
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get template stats: {str(e)}")

@router.get("/templates.json")
async def get_templates_config():
    """Scan templates folder and return actual template files"""
    try:
        templates_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'templates')
        
        templates = []
        categories = []
        
        # Scan each category folder
        for category_name in os.listdir(templates_dir):
            category_path = os.path.join(templates_dir, category_name)
            if os.path.isdir(category_path):
                categories.append({
                    "name": category_name,
                    "display_name": category_name.replace('-', ' ').title(),
                    "description": f"Templates for {category_name.replace('-', ' ')}",
                    "icon": "folder",
                    "color": "#3B82F6"
                })
                
                # Find all image files in this category
                for filename in os.listdir(category_path):
                    if filename.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.webp')):
                        template_id = f"{category_name}-{filename.split('.')[0]}"
                        templates.append({
                            "id": template_id,
                            "name": filename.replace('_', ' ').replace('-', ' ').split('.')[0].title(),
                            "category": category_name,
                            "description": f"{category_name.replace('-', ' ').title()} template",
                            "filename": filename,
                            "preview_url": None
                        })
        
        return JSONResponse(content={
            "templates": templates,
            "categories": categories
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error scanning templates: {str(e)}")

@router.get("/template-image/{category}/{filename}")
async def get_template_image(category: str, filename: str):
    """Serve template images from static files"""
    try:
        image_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'templates', category, filename)
        if os.path.exists(image_path):
            # Determine media type based on file extension
            if filename.lower().endswith('.png'):
                media_type = "image/png"
            elif filename.lower().endswith('.jpg') or filename.lower().endswith('.jpeg'):
                media_type = "image/jpeg"
            elif filename.lower().endswith('.gif'):
                media_type = "image/gif"
            elif filename.lower().endswith('.webp'):
                media_type = "image/webp"
            else:
                media_type = "image/jpeg"  # Default fallback
            
            return FileResponse(image_path, media_type=media_type)
        else:
            raise HTTPException(status_code=404, detail="Template image not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error serving template image: {str(e)}")

@router.post("/apply-template")
async def apply_template(
    template_id: str = Form(...),
    content: str = Form(...),
    image_url: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Apply a template to content and image using the template editor agent
    """
    try:
        # Parse template_id to get category and filename
        # Handle template IDs like "social-media-Did_you_know"
        if '-' not in template_id:
            raise HTTPException(status_code=400, detail="Invalid template ID format")
        
        # We need to find the category by checking which directory exists
        templates_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'templates')
        
        # Try to find the category by checking existing directories
        category = None
        filename_without_ext = None
        
        # Get all available categories
        available_categories = [d for d in os.listdir(templates_dir) if os.path.isdir(os.path.join(templates_dir, d))]
        
        # Try different split points to find a valid category
        for i in range(1, len(template_id.split('-'))):
            potential_category = '-'.join(template_id.split('-')[:i])
            potential_filename = '-'.join(template_id.split('-')[i:])
            
            if potential_category in available_categories:
                category = potential_category
                filename_without_ext = potential_filename
                break
        
        if not category:
            raise HTTPException(status_code=400, detail=f"Could not determine category from template_id: {template_id}. Available categories: {available_categories}")
        
        # Find the actual filename with extension
        # Templates are in the backend directory
        templates_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'templates')
        category_dir = os.path.join(templates_dir, category)
        
        if not os.path.exists(category_dir):
            raise HTTPException(status_code=404, detail="Template category not found")
        
        # Find the actual file
        actual_filename = None
        for file in os.listdir(category_dir):
            if file.lower().startswith(filename_without_ext.lower()) and file.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.webp')):
                actual_filename = file
                break
        
        if not actual_filename:
            raise HTTPException(status_code=404, detail="Template file not found")
        
        # Read template image as base64
        template_image_path = os.path.join(category_dir, actual_filename)
        with open(template_image_path, 'rb') as f:
            image_data = f.read()
            template_image_b64 = base64.b64encode(image_data).decode()
            
            # Determine the correct MIME type
            if actual_filename.lower().endswith('.png'):
                mime_type = 'image/png'
            elif actual_filename.lower().endswith('.jpg') or actual_filename.lower().endswith('.jpeg'):
                mime_type = 'image/jpeg'
            elif actual_filename.lower().endswith('.gif'):
                mime_type = 'image/gif'
            elif actual_filename.lower().endswith('.webp'):
                mime_type = 'image/webp'
            else:
                mime_type = 'image/jpeg'
            
            template_image_b64 = f"data:{mime_type};base64,{template_image_b64}"
        
        # Prepare the state for the template editor agent
        initial_state = {
            "template_id": template_id,
            "template_image": template_image_b64,
            "template_type": "premade",
            "current_content": content,
            "current_image_url": image_url,
            "user_id": current_user.id,
            "workflow_id": f"template_edit_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{current_user.id}"
        }
        
        # Start the template editing workflow with LangGraph
        result = await template_editor_agent.process_template_edit(
            current_content=content,
            current_image_url=image_url,
            user_id=current_user.id,
            content_id=f"template_edit_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{current_user.id}",
            template_id=template_id,
            template_image=template_image_b64
        )
        
        if result.get("success"):
            # If we have a final_template_url (Supabase URL), use it directly
            if result.get("final_template_url"):
                edited_image_url = result.get("final_template_url")
            else:
                # If we only have base64 data, upload it to Supabase storage
                final_template_b64 = result.get("final_template")
                if final_template_b64:
                    # Extract base64 data
                    if final_template_b64.startswith('data:image'):
                        image_data = final_template_b64.split(',')[1]
                    else:
                        image_data = final_template_b64
                    
                    # Upload to Supabase storage
                    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                    filename = f"template_applied_{current_user.id}_{timestamp}.jpg"
                    file_path = f"template-edits/{filename}"
                    
                    upload_result = supabase_admin.storage.from_('ai-generated-images').upload(
                        file_path,
                        base64.b64decode(image_data),
                        file_options={"content-type": "image/jpeg"}
                    )
                    
                    if hasattr(upload_result, 'error') and upload_result.error:
                        raise HTTPException(status_code=500, detail=f"Failed to upload template image: {upload_result.error}")
                    
                    # Get public URL
                    edited_image_url = supabase_admin.storage.from_('ai-generated-images').get_public_url(file_path)
                else:
                    raise HTTPException(status_code=500, detail="No template image generated")
            
            return JSONResponse(content={
                "success": True,
                "edited_image_url": edited_image_url,
                "workflow_id": initial_state["workflow_id"],
                "message": "Template applied successfully"
            })
        else:
            raise HTTPException(status_code=500, detail=result.get("error_message", "Failed to apply template"))
            
    except Exception as e:
        print(f"Error applying template: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error applying template: {str(e)}")

@router.post("/save-template")
async def save_template(
    original_image_url: str = Form(...),
    edited_image_url: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Save edited template image by replacing the original image (same approach as simple image editor)
    """
    try:
        print(f"🔍 Save template called with:")
        print(f"  - original_image_url: {original_image_url}")
        print(f"  - edited_image_url: {edited_image_url}")
        print(f"  - current_user.id: {current_user.id}")
        
        import httpx
        
        # 1. Download the edited image
        if edited_image_url.startswith('data:'):
            # Handle data URL (base64 encoded image)
            import base64
            if ',' in edited_image_url:
                header, data = edited_image_url.split(',', 1)
                edited_image_data = base64.b64decode(data)
            else:
                raise ValueError("Invalid data URL format")
        else:
            # Handle HTTP URL
            async with httpx.AsyncClient() as client:
                response = await client.get(edited_image_url)
                edited_image_data = response.content
        
        # 2. Extract the original path and bucket from the URL
        # URL format: https://yibrsxythicjzshqhqxf.supabase.co/storage/v1/object/public/BUCKET_NAME/path/filename.png
        print(f"🔍 Checking original_image_url: {original_image_url}")
        if '/storage/v1/object/public/' not in original_image_url:
            print(f"⚠️ Original image URL is not a Supabase storage URL - will save as new image")
            # If not a Supabase URL, just save the edited image as a new file
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"template_saved_{current_user.id}_{timestamp}.jpg"
            file_path = f"template-edits/{filename}"
            
            upload_result = supabase_admin.storage.from_('ai-generated-images').upload(
                file_path,
                edited_image_data,
                file_options={"content-type": "image/jpeg"}
            )
            
            if hasattr(upload_result, 'error') and upload_result.error:
                raise Exception(f"Failed to upload edited image: {upload_result.error}")
            
            public_url = supabase_admin.storage.from_('ai-generated-images').get_public_url(file_path)
            
            return JSONResponse(content={
                "success": True,
                "message": "Template image saved successfully!",
                "image_url": public_url,
                "post_id": None
            })
        
        full_path = original_image_url.split('/storage/v1/object/public/')[-1].split('?')[0]
        
        # Determine bucket and path
        if 'ai-generated-images/' in full_path:
            bucket_name = 'ai-generated-images'
            original_path = full_path.replace('ai-generated-images/', '')
        elif 'user-uploads/' in full_path:
            bucket_name = 'user-uploads'
            original_path = full_path.replace('user-uploads/', '')
        else:
            # Fallback to ai-generated-images for backward compatibility
            bucket_name = 'ai-generated-images'
            original_path = full_path
        
        print(f"Original image URL: {original_image_url}")
        print(f"Detected bucket: {bucket_name}")
        print(f"Extracted original path: {original_path}")
        print(f"Edited image URL: {edited_image_url}")
        
        # 3. Find the content post that uses this image (optional)
        print(f"🔍 Looking for content post with image URL: {original_image_url}")
        content_images_result = supabase_admin.table('content_images').select('post_id, image_url').eq('image_url', original_image_url).execute()
        
        print(f"🔍 Content images result: {content_images_result.data}")
        post_id = None
        if content_images_result.data:
            post_id = content_images_result.data[0]['post_id']
            print(f"✅ Found content post: {post_id}")
        else:
            print(f"⚠️ No content post found with this image URL - will save image only")
        
        # 4. Delete the original image from storage
        try:
            delete_result = supabase_admin.storage.from_(bucket_name).remove([original_path])
            print(f"Deleted original image from {bucket_name}: {original_path}")
        except Exception as e:
            print(f"Could not delete original image (may not exist): {e}")
        
        # 5. Upload the edited image to replace the original (same path and bucket)
        print(f"Uploading edited image to {bucket_name} at path: {original_path}")
        upload_result = supabase_admin.storage.from_(bucket_name).upload(
            original_path,  # Use the same path as the original
            edited_image_data,
            file_options={"content-type": "image/jpeg"}
        )
        
        if hasattr(upload_result, 'error') and upload_result.error:
            raise Exception(f"Failed to upload edited image: {upload_result.error}")
        
        print(f"Successfully uploaded edited image to: {original_path}")
        
        # 6. Delete the temporary edited image from the template-edits/ folder
        try:
            if 'supabase.co/storage/v1/object/public/' in edited_image_url:
                edited_path = edited_image_url.split('/storage/v1/object/public/')[-1].split('?')[0]
                edited_storage_path = edited_path.replace('ai-generated-images/', '')
                print(f"Temporary edited image path: {edited_storage_path}")
                delete_edited_result = supabase_admin.storage.from_('ai-generated-images').remove([edited_storage_path])
                print(f"Deleted temporary edited image from ai-generated-images: {edited_storage_path}")
        except Exception as e:
            print(f"Failed to delete temporary edited image: {e}")
            # Don't fail the entire operation if delete fails, just log it
        
        # 7. Update the content_images table with the new image URL (same URL, new content) - only if post exists
        if post_id:
            content_images_update = supabase_admin.table('content_images').update({
                'image_url': original_image_url  # Same URL, but now contains the edited image
            }).eq('post_id', post_id).execute()
            
            if not content_images_update.data:
                print("No content_images records found to update")
            else:
                print(f"✅ Updated content_images table for post {post_id}")
        else:
            print("ℹ️ No content post to update - image saved to storage only")
        
        # 8. The content_posts table doesn't need to be updated since the image URL stays the same
        # The image content is replaced in storage, but the URL remains unchanged
        
        return JSONResponse(content={
            "success": True,
            "message": f"Template image saved successfully! The original image in {bucket_name} has been completely replaced with your edited version.",
            "post_id": post_id,
            "image_url": original_image_url,  # Same URL, new content
            "bucket_used": bucket_name
        })
            
    except Exception as e:
        print(f"❌ Error saving template: {str(e)}")
        print(f"❌ Error type: {type(e)}")
        import traceback
        print(f"❌ Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error saving template: {str(e)}")

# Custom Prompt Management Endpoints

@router.get("/custom-prompts")
async def get_custom_prompts(current_user: dict = Depends(get_current_user)):
    """Get all available custom prompts"""
    try:
        templates = prompt_manager.get_available_templates()
        return JSONResponse(content={
            "success": True,
            "templates": templates
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching custom prompts: {str(e)}")

@router.get("/custom-prompts/{template_name}")
async def get_custom_prompt(template_name: str, current_user: dict = Depends(get_current_user)):
    """Get custom prompt for a specific template"""
    try:
        prompt_data = prompt_manager.get_template_prompt(template_name)
        if prompt_data:
            return JSONResponse(content={
                "success": True,
                "template": prompt_data
            })
        else:
            raise HTTPException(status_code=404, detail=f"No custom prompt found for template: {template_name}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching custom prompt: {str(e)}")

@router.post("/custom-prompts")
async def create_custom_prompt(
    template_name: str = Form(...),
    name: str = Form(...),
    description: str = Form(...),
    prompt: str = Form(...),
    skip_template_analyzer: bool = Form(True),
    current_user: dict = Depends(get_current_user)
):
    """Create or update a custom prompt for a template"""
    try:
        prompt_data = {
            "name": name,
            "description": description,
            "prompt": prompt,
            "skip_template_analyzer": skip_template_analyzer,
            "created_by": current_user.get("email", "unknown")
        }
        
        success = prompt_manager.add_template_prompt(template_name, prompt_data)
        if success:
            return JSONResponse(content={
                "success": True,
                "message": f"Custom prompt created/updated for template: {template_name}",
                "template": prompt_data
            })
        else:
            raise HTTPException(status_code=500, detail="Failed to save custom prompt")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating custom prompt: {str(e)}")

@router.put("/custom-prompts/{template_name}")
async def update_custom_prompt(
    template_name: str,
    name: str = Form(...),
    description: str = Form(...),
    prompt: str = Form(...),
    skip_template_analyzer: bool = Form(True),
    current_user: dict = Depends(get_current_user)
):
    """Update an existing custom prompt"""
    try:
        prompt_data = {
            "name": name,
            "description": description,
            "prompt": prompt,
            "skip_template_analyzer": skip_template_analyzer,
            "updated_by": current_user.get("email", "unknown")
        }
        
        success = prompt_manager.add_template_prompt(template_name, prompt_data)
        if success:
            return JSONResponse(content={
                "success": True,
                "message": f"Custom prompt updated for template: {template_name}",
                "template": prompt_data
            })
        else:
            raise HTTPException(status_code=500, detail="Failed to update custom prompt")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating custom prompt: {str(e)}")

@router.delete("/custom-prompts/{template_name}")
async def delete_custom_prompt(template_name: str, current_user: dict = Depends(get_current_user)):
    """Delete a custom prompt for a template"""
    try:
        success = prompt_manager.remove_template_prompt(template_name)
        if success:
            return JSONResponse(content={
                "success": True,
                "message": f"Custom prompt deleted for template: {template_name}"
            })
        else:
            raise HTTPException(status_code=404, detail=f"No custom prompt found for template: {template_name}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting custom prompt: {str(e)}")

@router.post("/custom-prompts/reload")
async def reload_custom_prompts(current_user: dict = Depends(get_current_user)):
    """Reload custom prompts configuration from file"""
    try:
        success = prompt_manager.reload_config()
        if success:
            return JSONResponse(content={
                "success": True,
                "message": "Custom prompts configuration reloaded successfully"
            })
        else:
            raise HTTPException(status_code=500, detail="Failed to reload custom prompts configuration")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reloading custom prompts: {str(e)}")

