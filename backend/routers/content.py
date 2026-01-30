from fastapi import APIRouter, Depends, HTTPException, status, Header, Query
from typing import List, Optional
import os
import logging
from datetime import datetime, timedelta
from supabase import create_client, Client
from dotenv import load_dotenv
from pydantic import BaseModel
import openai
from .connections import delete_from_social_media

logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

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

# User model
class User(BaseModel):
    id: str
    email: str
    name: str
    created_at: str

# Content update model
class ContentUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    hashtags: Optional[List[str]] = None
    scheduled_date: Optional[str] = None
    scheduled_time: Optional[str] = None
    status: Optional[str] = None
    images: Optional[List[str]] = None

# Content status update model
class ContentStatusUpdate(BaseModel):
    status: str

# AI Edit request model
class AIEditRequest(BaseModel):
    content: str
    instruction: str

def get_current_user(authorization: str = Header(None)):
    """Get current user from Supabase JWT token"""
    try:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authorization header required"
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
                    detail="Invalid token or user not found"
                )
                
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication failed"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed"
        )

router = APIRouter(prefix="/content", tags=["content"])

@router.get("/test")
async def test_content_router():
    """Test endpoint to verify content router is working"""
    return {"message": "Content router is working!", "status": "success"}

@router.get("/scheduled")
async def get_scheduled_content(
    current_user: User = Depends(get_current_user)
):
    """Get scheduled content for the current day"""
    try:
        # Get today's date
        today = datetime.now()
        today_start = today.replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        # Query Supabase for scheduled content from content_posts table
        response = supabase_admin.table("content_posts").select("*, content_campaigns!inner(*)").eq("content_campaigns.user_id", current_user.id).gte("scheduled_date", today_start.date().isoformat()).lte("scheduled_date", today_end.date().isoformat()).order("scheduled_date").execute()
        
        content_items = response.data if response.data else []
        
        # Format response
        formatted_content = []
        for item in content_items:
            platform_value = item.get("platform", "unknown")
            
            formatted_item = {
                "id": item["id"],
                "title": item.get("title", "Untitled"),
                "content": item.get("content", ""),
                "platform": platform_value,
                "scheduled_at": f"{item.get('scheduled_date')}T{item.get('scheduled_time', '12:00:00')}",
                "status": item.get("status", "draft"),
                "created_at": item.get("created_at"),
                "media_url": item.get("primary_image_url"),  # Use primary_image_url from content_posts
                "hashtags": item.get("hashtags", []),
                "post_type": item.get("post_type", "text"),
                "campaign_id": item.get("campaign_id"),
                "metadata": item.get("metadata", {})
            }
            formatted_content.append(formatted_item)
        
        return {
            "content": formatted_content,
            "date": today.strftime("%Y-%m-%d"),
            "count": len(formatted_content)
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch scheduled content: {str(e)}"
        )

@router.get("/all")
async def get_all_content(
    current_user: User = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0
):
    """Get all content for the user"""
    try:
        user_id = current_user.id
        print(f"🔍 Fetching content for user_id: {user_id}, email: {current_user.email}")
        
        # First, try the standard query with INNER JOIN (for posts with campaigns)
        response = supabase_admin.table("content_posts").select("*, content_campaigns!inner(*)").eq("content_campaigns.user_id", user_id).order("scheduled_date", desc=True).range(offset, offset + limit - 1).execute()
        
        content_items = response.data if response.data else []
        print(f"🔍 Found {len(content_items)} posts with campaigns via INNER JOIN")
        
        # Also check for posts without campaigns (using metadata.user_id as fallback)
        # This handles edge cases where posts were created but campaign creation failed
        fallback_response = supabase_admin.table("content_posts").select("*").is_("campaign_id", "null").order("scheduled_date", desc=True).range(offset, offset + limit - 1).execute()
        
        print(f"🔍 Fallback query found {len(fallback_response.data) if fallback_response.data else 0} posts without campaigns (before filtering)")
        
        if fallback_response.data:
            # Filter by metadata.user_id to ensure we only get posts for this user
            fallback_posts = []
            for post in fallback_response.data:
                metadata = post.get("metadata", {})
                if isinstance(metadata, dict) and metadata.get("user_id") == user_id:
                    # Check if this post has a "Drive Content" campaign that might be missing
                    # Try to find or create the campaign
                    try:
                        campaign_check = supabase_admin.table("content_campaigns").select("id").eq("user_id", user_id).eq("campaign_name", "Drive Content").execute()
                        if campaign_check.data and campaign_check.data[0]:
                            campaign_id = campaign_check.data[0]["id"]
                            # Update the post with the campaign_id
                            supabase_admin.table("content_posts").update({"campaign_id": campaign_id}).eq("id", post["id"]).execute()
                            print(f"✅ Fixed post {post['id']} by linking to campaign {campaign_id}")
                            # Add campaign info to the post for response
                            post["content_campaigns"] = campaign_check.data[0]
                            fallback_posts.append(post)
                    except Exception as fix_error:
                        print(f"⚠️ Could not fix post {post.get('id')}: {fix_error}")
                        # Still include the post even if we can't fix it
                        fallback_posts.append(post)
            
            if fallback_posts:
                print(f"🔍 Found {len(fallback_posts)} posts without campaigns (fixed {len([p for p in fallback_posts if p.get('content_campaigns')])} of them)")
                # Merge with existing content_items, avoiding duplicates
                existing_ids = {item["id"] for item in content_items}
                for post in fallback_posts:
                    if post["id"] not in existing_ids:
                        content_items.append(post)
        
        print(f"🔍 Total posts returned: {len(content_items)}")
        
        # Format response
        formatted_content = []
        for item in content_items:
            # Handle both posts with campaigns (from INNER JOIN) and posts without (from fallback)
            campaign_id = item.get("campaign_id")
            if not campaign_id and isinstance(item.get("content_campaigns"), dict):
                campaign_id = item.get("content_campaigns", {}).get("id")
            
            platform = item.get("platform", "unknown")
            # Log platform for debugging
            if len(formatted_content) < 5:  # Log first 5 for debugging
                print(f"🔍 Post {item.get('id')}: platform='{platform}', title='{item.get('title', '')[:30]}'")
            
            formatted_item = {
                "id": item["id"],
                "title": item.get("title", "Untitled"),
                "content": item.get("content", ""),
                "platform": platform,
                "scheduled_at": f"{item.get('scheduled_date')}T{item.get('scheduled_time', '12:00:00')}",
                "status": item.get("status", "draft"),
                "created_at": item.get("created_at"),
                "media_url": item.get("primary_image_url"),  # Use primary_image_url from content_posts
                "hashtags": item.get("hashtags", []),
                "post_type": item.get("post_type", "text"),
                "campaign_id": campaign_id,
                "metadata": item.get("metadata", {}),
                "video_scripting": item.get("video_scripting")  # Include video_scripting for script display
            }
            formatted_content.append(formatted_item)
        
        # Log summary of platforms
        platform_counts = {}
        for item in formatted_content:
            platform = item.get("platform", "unknown")
            platform_counts[platform] = platform_counts.get(platform, 0) + 1
        print(f"🔍 Platform distribution: {platform_counts}")
        
        return {
            "content": formatted_content,
            "count": len(formatted_content),
            "limit": limit,
            "offset": offset
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch content: {str(e)}"
        )

@router.get("/created")
async def get_created_content(
    current_user: User = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0
):
    """Get created content for the user from created_content table"""
    try:
        user_id = current_user.id
        print(f"🔍 Fetching created content for user_id: {user_id}, email: {current_user.email}")

        # Fetch from created_content table
        response = supabase_admin.table("created_content").select("*").eq("user_id", user_id).order("created_at", desc=True).range(offset, offset + limit - 1).execute()

        content_items = response.data if response.data else []
        print(f"🔍 Found {len(content_items)} created content items")

        # Debug: Print status values (raw from database, no fallbacks)
        status_counts = {}
        for item in content_items:
            raw_status = item.get("status")  # No fallback - show exactly what's in DB
            status_counts[raw_status] = status_counts.get(raw_status, 0) + 1
            print(f"📊 Content {item['id'][:8]}: raw_status='{raw_status}'")

        print(f"📈 Raw status distribution: {status_counts}")

        # Transform the data to match what the frontend expects
        transformed_items = []
        for item in content_items:
            transformed_item = {
                "id": item["id"],
                "title": item.get("title", f"Created Content {item['id'][:8]}"),
                "content": item.get("content", ""),
                "content_text": item.get("content", ""),
                "hashtags": item.get("hashtags", []),
                "images": item.get("images", []),
                "platform": item.get("platform", "General"),
                "content_type": item.get("content_type", "post"),
                "created_at": item.get("created_at"),
                "status": item.get("status", "draft"),
                "metadata": item.get("metadata", {}),
                "archetype": item.get("archetype"),
                "visual_metaphor": item.get("visual_metaphor"),
                "hook_type": item.get("hook_type"),
                "call_to_action": item.get("call_to_action"),
                "engagement_question": item.get("engagement_question"),
                "media_url": item.get("images", [])[0] if item.get("images") and len(item.get("images", [])) > 0 else None,
                # Mock campaign data for compatibility
                "content_campaigns": {
                    "platform": item.get("platform", "General"),
                    "channel": "Social Media"
                }
            }
            transformed_items.append(transformed_item)

        return transformed_items

    except Exception as e:
        logger.error(f"Error getting created content: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/debug/status")
async def debug_status_values(current_user: User = Depends(get_current_user)):
    """Debug endpoint to check RAW status values in created_content table (no fallbacks)"""
    try:
        user_id = current_user.id

        # Fetch all content for this user (select all columns to ensure status is included)
        response = supabase_admin.table("created_content").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()

        content_items = response.data if response.data else []

        # Group by status (raw values, no processing)
        status_groups = {}
        null_status_count = 0

        for item in content_items:
            raw_status = item.get("status")  # Raw value - no defaults
            if raw_status is None:
                null_status_count += 1
                raw_status = "NULL"
            elif raw_status == "":
                raw_status = "EMPTY_STRING"

            if raw_status not in status_groups:
                status_groups[raw_status] = []
            status_groups[raw_status].append({
                "id": item["id"][:8] + "...",
                "created_at": item.get("created_at")
            })

        return {
            "total_items": len(content_items),
            "null_status_items": null_status_count,
            "raw_status_distribution": {status: len(items) for status, items in status_groups.items()},
            "raw_status_details": status_groups,
            "raw_sample_items": [
                {
                    "id": item["id"],
                    "status": item.get("status"),  # Raw status value
                    "all_columns": item  # Full raw item data
                }
                for item in content_items[:5]  # First 5 items with full details
            ]
        }

    except Exception as e:
        logger.error(f"Error debugging status values: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/by-date")
async def get_content_by_date(
    date: str,
    current_user: User = Depends(get_current_user)
):
    """Get content for a specific date"""
    try:
        # Parse the date
        try:
            target_date = datetime.fromisoformat(date).date()
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date format. Use YYYY-MM-DD format."
            )
        
        # Query Supabase for content on the specific date
        response = supabase_admin.table("content_posts").select("*, content_campaigns!inner(*)").eq("content_campaigns.user_id", current_user.id).eq("scheduled_date", target_date.isoformat()).order("scheduled_time").execute()
        
        content_items = response.data if response.data else []
        
        # Format response
        formatted_content = []
        for item in content_items:
            platform_value = item.get("platform", "unknown")
            
            formatted_item = {
                "id": item["id"],
                "title": item.get("title", "Untitled"),
                "content": item.get("content", ""),
                "platform": platform_value,
                "scheduled_at": f"{item.get('scheduled_date')}T{item.get('scheduled_time', '12:00:00')}",
                "status": item.get("status", "draft"),
                "created_at": item.get("created_at"),
                "media_url": item.get("primary_image_url"),  # Use primary_image_url from content_posts
                "hashtags": item.get("hashtags", []),
                "post_type": item.get("post_type", "text"),
                "campaign_id": item.get("campaign_id"),
                "metadata": item.get("metadata", {})
            }
            formatted_content.append(formatted_item)
        
        return {
            "content": formatted_content,
            "date": target_date.isoformat(),
            "count": len(formatted_content)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch content for date {date}: {str(e)}"
        )

@router.put("/update/{content_id}")
async def update_content(
    content_id: str,
    update_data: ContentUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update content by ID"""
    try:
        logger.info(f"Update content request: content_id={content_id}, user_id={current_user.id}, update_data={update_data.dict(exclude_unset=True)}")
        # Convert Pydantic model to dict, excluding None values
        update_dict = update_data.dict(exclude_unset=True, exclude_none=True)
        
        # First verify the content belongs to the user
        # Check if content exists and get its campaign_id
        content_response = supabase_admin.table("content_posts").select("id, campaign_id, metadata").eq("id", content_id).execute()
        
        if not content_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Content not found"
            )

        content_data = content_response.data[0]
        campaign_id = content_data.get("campaign_id")

        # If content has a campaign, verify the campaign belongs to the user
        if campaign_id:
            campaign_response = supabase_admin.table("content_campaigns").select("id").eq("id", campaign_id).eq("user_id", current_user.id).execute()
            if not campaign_response.data:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied"
                )
        else:
            # If no campaign, check if content was created by this user via metadata
            # This handles legacy content that doesn't have campaigns
            metadata = content_data.get("metadata", {})
            if metadata.get("user_id") != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied"
            )
        
        # Build update dict with only provided fields
        update_fields = {}
        if "title" in update_dict:
            update_fields["title"] = update_dict["title"]
        if "content" in update_dict:
            update_fields["content"] = update_dict["content"]
        if "hashtags" in update_dict:
            update_fields["hashtags"] = update_dict["hashtags"]
        if "scheduled_date" in update_dict:
            update_fields["scheduled_date"] = update_dict["scheduled_date"]
        if "scheduled_time" in update_dict:
            update_fields["scheduled_time"] = update_dict["scheduled_time"]
        if "status" in update_dict:
            update_fields["status"] = update_dict["status"]
        if "images" in update_dict:
            update_fields["images"] = update_dict["images"]
        
        if not update_fields:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields provided for update"
            )
        
        # Update the content
        update_response = supabase_admin.table("content_posts").update(update_fields).eq("id", content_id).execute()
        
        if not update_response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update content"
            )
        
        updated_content = update_response.data[0]
        
        return {
            "success": True,
            "message": "Content updated successfully",
            "content": {
                "id": updated_content["id"],
                "title": updated_content["title"],
                "content": updated_content["content"],
                "platform": updated_content["platform"],
                "scheduled_at": f"{updated_content['scheduled_date']}T{updated_content['scheduled_time']}",
                "status": updated_content["status"],
                "hashtags": updated_content["hashtags"],
                "updated_at": updated_content["updated_at"]
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update content: {str(e)}"
        )


@router.put("/update-status/{content_id}")
async def update_content_status(
    content_id: str,
    status_data: ContentStatusUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update content status by ID"""
    try:
        # First verify the content belongs to the user
        content_response = supabase_admin.table("content_posts").select("*, content_campaigns!inner(*)").eq("id", content_id).eq("content_campaigns.user_id", current_user.id).execute()
        
        if not content_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Content not found or access denied"
            )
        
        # Update only the status
        update_response = supabase_admin.table("content_posts").update({
            "status": status_data.status
        }).eq("id", content_id).execute()
        
        if not update_response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update content status"
            )
        
        updated_content = update_response.data[0]
        
        return {
            "success": True,
            "message": "Content status updated successfully",
            "content": {
                "id": updated_content["id"],
                "status": updated_content["status"],
                "updated_at": updated_content["updated_at"]
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update content status: {str(e)}"
        )

@router.put("/created-content/update/{content_id}")
async def update_created_content(
    content_id: str,
    update_data: ContentUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update created content by ID"""
    try:
        # Convert Pydantic model to dict, excluding None values
        update_dict = update_data.dict(exclude_unset=True, exclude_none=True)

        # Verify the content belongs to the user
        content_response = supabase_admin.table("created_content").select("id").eq("id", content_id).eq("user_id", current_user.id).execute()

        if not content_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Content not found or access denied"
            )

        # Build update dict with only provided fields
        update_fields = {}
        if "title" in update_dict:
            update_fields["title"] = update_dict["title"]
        if "content" in update_dict:
            update_fields["content"] = update_dict["content"]
        if "hashtags" in update_dict:
            update_fields["hashtags"] = update_dict["hashtags"]
        if "scheduled_date" in update_dict:
            update_fields["scheduled_date"] = update_dict["scheduled_date"]
        if "scheduled_time" in update_dict:
            update_fields["scheduled_time"] = update_dict["scheduled_time"]
        if "status" in update_dict:
            update_fields["status"] = update_dict["status"]
        if "images" in update_dict:
            update_fields["images"] = update_dict["images"]

        # Add updated_at timestamp
        update_fields["updated_at"] = datetime.now().isoformat()

        update_response = supabase_admin.table("created_content").update(update_fields).eq("id", content_id).execute()

        if not update_response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update content"
            )

        updated_content = update_response.data[0]

        return {
            "success": True,
            "message": "Content updated successfully",
            "content": {
                "id": updated_content["id"],
                "title": updated_content["title"],
                "content": updated_content["content"],
                "hashtags": updated_content["hashtags"],
                "images": updated_content["images"],
                "updated_at": updated_content["updated_at"]
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update content: {str(e)}"
        )

@router.delete("/created-content/{content_id}")
async def delete_created_content(
    content_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete created content and associated images, plus automatically delete from social media platforms"""
    try:
        # First verify the content belongs to the user
        content_response = supabase_admin.table("created_content").select("*").eq("id", content_id).eq("user_id", current_user.id).execute()

        if not content_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Content not found or access denied"
            )

        content = content_response.data[0]

        # Delete from social media platforms first (if the content was posted)
        social_delete_results = None
        try:
            metadata = content.get("metadata", {})
            if metadata and any(key.endswith("_post_id") for key in metadata.keys()):
                print(f"🗑️ Created content has social media post IDs, attempting to delete from platforms...")
                social_delete_results = await delete_from_social_media(metadata, current_user.id)
            else:
                print(f"ℹ️ Created content has no social media post IDs, skipping social media deletion")
        except Exception as social_error:
            print(f"⚠️ Failed to delete from social media, but continuing with database deletion: {social_error}")
            # Don't fail the entire operation if social media deletion fails
            social_delete_results = {"error": str(social_error)}

        # Delete associated images from Supabase storage if they exist
        try:
            images = content.get("images", [])
            if images:
                for image_url in images:
                    if image_url and "ai-generated-images" in image_url:
                        # Extract file path from Supabase storage URL
                        file_path = image_url.split("ai-generated-images/")[-1]
                        if file_path:
                            try:
                                # Delete from Supabase storage
                                supabase_admin.storage.from_("ai-generated-images").remove([file_path])
                                print(f"🗑️ Deleted image from storage: {file_path}")
                            except Exception as storage_error:
                                # Continue even if storage deletion fails
                                print(f"⚠️ Could not delete image {file_path} from storage: {storage_error}")
                                pass
        except Exception as image_error:
            # Continue with content deletion even if image deletion fails
            print(f"⚠️ Error deleting images: {image_error}")
            pass

        # Delete the created content
        delete_response = supabase_admin.table("created_content").delete().eq("id", content_id).execute()

        if not delete_response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete content"
            )

        # Prepare response message
        response_message = "Content and associated images deleted successfully"
        if social_delete_results:
            if social_delete_results.get("total_platforms_attempted", 0) > 0:
                successful = social_delete_results.get("successful_deletions", 0)
                failed = social_delete_results.get("failed_deletions", 0)
                total = social_delete_results.get("total_platforms_attempted", 0)
                response_message += f". Deleted from {successful}/{total} social media platforms"
                if failed > 0:
                    response_message += f" ({failed} deletions failed)"

        return {
            "success": True,
            "message": response_message,
            "deleted_content": {
                "id": content_id,
                "title": content.get("title", ""),
                "platform": content.get("platform", ""),
                "deleted_at": datetime.now().isoformat()
            },
            "social_media_deletion": social_delete_results if social_delete_results else None
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete content: {str(e)}"
        )

        if not content_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Content not found or access denied"
            )

        content = content_response.data[0]

        # Delete from social media platforms first (if the content was posted)
        social_delete_results = None
        try:
            metadata = content.get("metadata", {})
            if metadata and any(key.endswith("_post_id") for key in metadata.keys()):
                print(f"🗑️ Created content has social media post IDs, attempting to delete from platforms...")
                social_delete_results = await delete_from_social_media(metadata, current_user.id)
            else:
                print(f"ℹ️ Created content has no social media post IDs, skipping social media deletion")
        except Exception as social_error:
            print(f"⚠️ Failed to delete from social media, but continuing with database deletion: {social_error}")
            # Don't fail the entire operation if social media deletion fails
            social_delete_results = {"error": str(social_error)}

        # Delete associated images from Supabase storage if they exist
        try:
            images = content.get("images", [])
            if images:
                for image_url in images:
                    if image_url and "ai-generated-images" in image_url:
                        # Extract file path from Supabase storage URL
                        file_path = image_url.split("ai-generated-images/")[-1]
                        if file_path:
                            try:
                                # Delete from Supabase storage
                                supabase_admin.storage.from_("ai-generated-images").remove([file_path])
                                print(f"🗑️ Deleted image from storage: {file_path}")
                            except Exception as storage_error:
                                # Continue even if storage deletion fails
                                print(f"⚠️ Could not delete image {file_path} from storage: {storage_error}")
                                pass
        except Exception as image_error:
            # Continue with content deletion even if image deletion fails
            print(f"⚠️ Error deleting images: {image_error}")
            pass

        # Delete the created content
        delete_response = supabase_admin.table("created_content").delete().eq("id", content_id).execute()

        if not delete_response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete content"
            )

        # Prepare response message
        response_message = "Content and associated images deleted successfully"
        if social_delete_results:
            if social_delete_results.get("total_platforms_attempted", 0) > 0:
                successful = social_delete_results.get("successful_deletions", 0)
                failed = social_delete_results.get("failed_deletions", 0)
                total = social_delete_results.get("total_platforms_attempted", 0)
                response_message += f". Deleted from {successful}/{total} social media platforms"
                if failed > 0:
                    response_message += f" ({failed} deletions failed)"

        return {
            "success": True,
            "message": response_message,
            "deleted_content": {
                "id": content_id,
                "title": content.get("title", ""),
                "platform": content.get("platform", ""),
                "deleted_at": datetime.now().isoformat()
            },
            "social_media_deletion": social_delete_results if social_delete_results else None
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete content: {str(e)}"
        )

@router.delete("/{content_id}")
async def delete_content(
    content_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete content post and associated images"""
    try:
        # First verify the content belongs to the user
        content_response = supabase_admin.table("content_posts").select("*, content_campaigns!inner(*)").eq("id", content_id).eq("content_campaigns.user_id", current_user.id).execute()
        
        if not content_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Content not found or access denied"
            )
        
        content = content_response.data[0]

        # Delete from social media platforms first (if the content was posted)
        social_delete_results = None
        try:
            metadata = content.get("metadata", {})
            if metadata and any(key.endswith("_post_id") for key in metadata.keys()):
                print(f"🗑️ Content has social media post IDs, attempting to delete from platforms...")
                social_delete_results = await delete_from_social_media(metadata, current_user.id)
            else:
                print(f"ℹ️ Content has no social media post IDs, skipping social media deletion")
        except Exception as social_error:
            print(f"⚠️ Failed to delete from social media, but continuing with database deletion: {social_error}")
            # Don't fail the entire operation if social media deletion fails
            social_delete_results = {"error": str(social_error)}

        # Delete associated images first
        try:
            # Get all images associated with this content
            images_response = supabase_admin.table("content_images").select("*").eq("post_id", content_id).execute()
            
            if images_response.data:
                # Delete images from Supabase storage if they exist
                for image in images_response.data:
                    if image.get("image_url"):
                        try:
                            # Extract file path from URL for storage deletion
                            image_url = image["image_url"]
                            if "ai-generated-images" in image_url:
                                # Extract file path from Supabase storage URL
                                file_path = image_url.split("ai-generated-images/")[-1]
                                if file_path:
                                    # Delete from Supabase storage
                                    supabase_admin.storage.from_("ai-generated-images").remove([file_path])
                        except Exception as storage_error:
                            # Continue even if storage deletion fails
                            pass
                
                # Delete image records from database
                supabase_admin.table("content_images").delete().eq("post_id", content_id).execute()
                
        except Exception as image_error:
            # Continue with content deletion even if image deletion fails
            pass
        
        # Check if post was scheduled before deletion
        was_scheduled = content.get("status", "").lower() == "scheduled"
        
        # Delete the content post
        delete_response = supabase_admin.table("content_posts").delete().eq("id", content_id).execute()
        
        if not delete_response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete content"
            )
        
        
        # Prepare response message
        response_message = "Content and associated images deleted successfully"
        if social_delete_results:
            if social_delete_results.get("total_platforms_attempted", 0) > 0:
                successful = social_delete_results.get("successful_deletions", 0)
                failed = social_delete_results.get("failed_deletions", 0)
                total = social_delete_results.get("total_platforms_attempted", 0)
                response_message += f". Deleted from {successful}/{total} social media platforms"
                if failed > 0:
                    response_message += f" ({failed} deletions failed)"

        return {
            "success": True,
            "message": response_message,
            "deleted_content": {
                "id": content_id,
                "title": content.get("title", ""),
                "platform": content.get("platform", ""),
                "deleted_at": datetime.now().isoformat()
            },
            "social_media_deletion": social_delete_results if social_delete_results else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete content: {str(e)}"
        )

# Scheduled post registration model

@router.post("/{post_id}/regenerate-carousel-image/{image_index}")
async def regenerate_carousel_image(
    post_id: str,
    image_index: int,
    current_user: User = Depends(get_current_user)
):
    """Regenerate a single carousel image for an existing post"""
    try:
        import logging
        logger = logging.getLogger(__name__)
        
        # Verify the content belongs to the user
        content_response = supabase_admin.table("content_posts").select(
            "*, content_campaigns!inner(*)"
        ).eq("id", post_id).eq("content_campaigns.user_id", current_user.id).execute()
        
        if not content_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Content not found or access denied"
            )
        
        content = content_response.data[0]
        
        # Verify it's a carousel post
        if content.get("post_type", "").lower() != "carousel":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This post is not a carousel post"
            )
        
        # Get carousel images from metadata
        metadata = content.get("metadata", {}) or {}
        carousel_images = metadata.get("carousel_images", [])
        
        if not isinstance(carousel_images, list) or len(carousel_images) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No carousel images found in this post"
            )
        
        # Verify image index is valid
        if image_index < 0 or image_index >= len(carousel_images):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Image index {image_index} is out of range. This carousel has {len(carousel_images)} images."
            )
        
        # Get user's business context for image generation
        user_id = current_user.id
        profile_response = supabase_admin.table("profiles").select("*").eq("id", user_id).execute()
        business_context = {}
        if profile_response.data and len(profile_response.data) > 0:
            profile = profile_response.data[0]
            business_context = {
                "business_name": profile.get("business_name", ""),
                "business_type": profile.get("business_type", ""),
                "target_audience": profile.get("target_audience", ""),
                "brand_personality": profile.get("brand_voice", ""),  # Using brand_voice instead of brand_personality
                "brand_values": []  # profiles table doesn't have brand_values, using empty array
            }
        
        # Generate image using media agent
        from agents.media_agent import create_media_agent
        
        supabase_url_env = os.getenv("SUPABASE_URL")
        supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        gemini_api_key = os.getenv("GEMINI_API_KEY")
        
        if not gemini_api_key:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Image generation not available - GEMINI_API_KEY not set"
            )
        
        media_agent = create_media_agent(supabase_url_env, supabase_service_key, gemini_api_key)
        
        # Build description for this specific carousel image
        # Use the post content as the base description
        post_content = content.get("content", "")
        platform = content.get("platform", "Facebook")
        carousel_theme = metadata.get("carousel_theme", f"Carousel post: {post_content[:100]}")
        
        # Create sequential description based on index
        total_images = len(carousel_images)
        image_description = f"{carousel_theme} - Image {image_index + 1} of {total_images}"
        
        if image_index == 0:
            image_description += ": Opening/Introduction scene"
        elif image_index == total_images - 1:
            image_description += ": Conclusion/Call to action scene"
        else:
            image_description += f": Development scene (part {image_index + 1} of {total_images})"
        
        # Add business context
        if business_context.get("business_name"):
            image_description += f" for {business_context['business_name']}"
        
        # Generate image
        from agents.media_agent import MediaAgentState, Style, ImageSize
        
        # Determine image style and size (similar to analyze_content_for_image)
        image_style = Style.REALISTIC  # Default style
        image_size = ImageSize.SQUARE_1024  # Default size for social media
        
        image_state = MediaAgentState(
            user_id=user_id,
            post_id=post_id,
            post_data={
                "id": post_id,  # Required for save_image_data
                "content": image_description,
                "platform": platform.lower() if platform else "facebook",
                "user_description": post_content[:200],
                "carousel_index": image_index,
                "total_carousel_images": total_images,
                "is_sequential_carousel": True,
                "carousel_theme": carousel_theme
            },
            image_prompt=None,
            image_style=image_style,
            image_size=image_size,
            generated_image_url=None,
            generation_cost=None,
            generation_time=None,
            generation_model=None,
            generation_service=None,
            error_message=None,
            status="prompt_generation"  # Set to prompt_generation since we're skipping analyze_content
        )
        
        # Generate prompt and image
        logger.info(f"Regenerating carousel image {image_index + 1} for post {post_id}")
        
        image_state = await media_agent.generate_image_prompt(image_state)
        if not image_state or image_state.get("status") == "failed" or not image_state.get("image_prompt"):
            error_msg = image_state.get("error_message", "Unknown error") if image_state else "No state returned"
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to generate image prompt: {error_msg}"
            )
        
        result = await media_agent.generate_image(image_state)
        if not result:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to generate image"
            )
        
        if result.get("status") != "completed" or not result.get("generated_image_url"):
            error_msg = result.get("error_message", "Unknown error")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to generate image: {error_msg}"
            )
        
        new_image_url = result.get("generated_image_url")
        
        # Update carousel images array
        updated_carousel_images = carousel_images.copy()
        updated_carousel_images[image_index] = new_image_url
        
        # Update metadata
        updated_metadata = metadata.copy()
        updated_metadata["carousel_images"] = updated_carousel_images
        
        # Update primary_image_url if this is the first image
        update_data = {
            "metadata": updated_metadata
        }
        if image_index == 0:
            update_data["primary_image_url"] = new_image_url
        
        # Update the post in database
        update_response = supabase_admin.table("content_posts").update(update_data).eq("id", post_id).execute()
        
        if not update_response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update post with new carousel image"
            )
        
        logger.info(f"Successfully regenerated carousel image {image_index + 1} for post {post_id}")
        
        return {
            "success": True,
            "image_url": new_image_url,
            "image_index": image_index,
            "message": f"Carousel image {image_index + 1} has been successfully regenerated"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error regenerating carousel image: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to regenerate carousel image: {str(e)}"
        )

@router.post("/{post_id}/generate-all-carousel-images")
async def generate_all_carousel_images_for_post(
    post_id: str,
    current_user: User = Depends(get_current_user)
):
    """Generate all 4 carousel images for an existing post"""
    try:
        import logging
        logger = logging.getLogger(__name__)
        
        # Verify the content belongs to the user
        content_response = supabase_admin.table("content_posts").select(
            "*, content_campaigns!inner(*)"
        ).eq("id", post_id).eq("content_campaigns.user_id", current_user.id).execute()
        
        if not content_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Content not found or access denied"
            )
        
        content = content_response.data[0]
        
        # Verify it's a carousel post
        if content.get("post_type", "").lower() != "carousel":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This post is not a carousel post"
            )
        
        # Get user's business context for image generation
        user_id = current_user.id
        profile_response = supabase_admin.table("profiles").select("*").eq("id", user_id).execute()
        business_context = {}
        if profile_response.data and len(profile_response.data) > 0:
            profile = profile_response.data[0]
            business_context = {
                "business_name": profile.get("business_name", ""),
                "business_type": profile.get("business_type", ""),
                "target_audience": profile.get("target_audience", ""),
                "brand_personality": profile.get("brand_voice", ""),  # Using brand_voice instead of brand_personality
                "brand_values": []  # profiles table doesn't have brand_values, using empty array
            }
        
        # Generate images using media agent
        from agents.media_agent import create_media_agent
        
        supabase_url_env = os.getenv("SUPABASE_URL")
        supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        gemini_api_key = os.getenv("GEMINI_API_KEY")
        
        if not gemini_api_key:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Image generation not available - GEMINI_API_KEY not set"
            )
        
        media_agent = create_media_agent(supabase_url_env, supabase_service_key, gemini_api_key)
        
        # Build description for carousel images
        post_content = content.get("content", "")
        platform = content.get("platform", "Facebook")
        metadata = content.get("metadata", {}) or {}
        carousel_theme = metadata.get("carousel_theme", f"Sequential carousel story about: {post_content[:100]}")
        
        # Generate all 4 images sequentially
        generated_images = []
        previous_prompts = []
        total_generation_time = 0
        
        for image_index in range(4):
            try:
                # Create sequential description based on index
                image_description = f"{carousel_theme} - Image {image_index + 1} of 4"
                
                if image_index == 0:
                    image_description += ": Opening/Introduction scene"
                elif image_index == 3:
                    image_description += ": Conclusion/Call to action scene"
                else:
                    image_description += f": Development scene (part {image_index + 1} of 4)"
                
                # Add business context
                if business_context.get("business_name"):
                    image_description += f" for {business_context['business_name']}"
                
                # Generate image
                from agents.media_agent import MediaAgentState, Style, ImageSize
                
                # Determine image style and size (similar to analyze_content_for_image)
                image_style = Style.REALISTIC  # Default style
                image_size = ImageSize.SQUARE_1024  # Default size for social media
                
                image_state = MediaAgentState(
                    user_id=user_id,
                    post_id=post_id,
                    post_data={
                        "id": post_id,  # Required for save_image_data
                        "content": image_description,
                        "platform": platform.lower() if platform else "facebook",
                        "user_description": post_content[:200],
                        "carousel_index": image_index,
                        "total_carousel_images": 4,
                        "is_sequential_carousel": True,
                        "carousel_theme": carousel_theme,
                        "previous_carousel_prompts": previous_prompts
                    },
                    image_prompt=None,
                    image_style=image_style,
                    image_size=image_size,
                    generated_image_url=None,
                    generation_cost=None,
                    generation_time=None,
                    generation_model=None,
                    generation_service=None,
                    error_message=None,
                    status="prompt_generation"  # Set to prompt_generation since we're skipping analyze_content
                )
                
                # Generate prompt and image
                logger.info(f"Generating carousel image {image_index + 1}/4 for post {post_id}")
                
                image_state = await media_agent.generate_image_prompt(image_state)
                if not image_state or image_state.get("status") == "failed" or not image_state.get("image_prompt"):
                    error_msg = image_state.get("error_message", "Unknown error") if image_state else "No state returned"
                    raise Exception(f"Failed to generate image prompt for image {image_index + 1}: {error_msg}")
                
                result = await media_agent.generate_image(image_state)
                if not result or result.get("status") != "completed":
                    error_msg = result.get("error_message", "Unknown error") if result else "No result returned"
                    raise Exception(f"Failed to generate image {image_index + 1}: {error_msg}")
                
                new_image_url = result.get("generated_image_url")
                if not new_image_url:
                    raise Exception(f"No image URL returned for image {image_index + 1}")
                
                generated_images.append(new_image_url)
                previous_prompts.append(result.get("image_prompt", ""))
                total_generation_time += result.get("generation_time", 0)
                
                logger.info(f"Successfully generated carousel image {image_index + 1}/4")
                
            except Exception as e:
                logger.error(f"Failed to generate carousel image {image_index + 1}: {str(e)}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to generate carousel image {image_index + 1}: {str(e)}"
                )
        
        # Update post metadata with carousel images
        updated_metadata = metadata.copy()
        updated_metadata["carousel_images"] = generated_images
        updated_metadata["carousel_theme"] = carousel_theme
        
        # Update the post
        update_response = supabase_admin.table("content_posts").update({
            "metadata": updated_metadata,
            "primary_image_url": generated_images[0] if generated_images else None
        }).eq("id", post_id).execute()
        
        if not update_response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update post with carousel images"
            )
        
        logger.info(f"Successfully generated all 4 carousel images for post {post_id}")
        
        return {
            "success": True,
            "message": "All 4 carousel images generated successfully",
            "carousel_images": generated_images,
            "image_url": generated_images[0] if generated_images else None,  # Return first image for compatibility
            "generation_time": total_generation_time,
            "generation_model": "gemini-2.5-flash-image",
            "generation_service": "google_gemini"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate all carousel images: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate carousel images: {str(e)}"
        )


@router.post("/ai/edit-content")
async def ai_edit_content(
    request: AIEditRequest,
    current_user: User = Depends(get_current_user)
):
    """Edit content using AI based on user instructions"""
    try:
        # Check if OpenAI API key is available
        openai_api_key = os.getenv("OPENAI_API_KEY")
        if not openai_api_key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="OpenAI API key not configured"
            )
        
        # Create OpenAI client
        client = openai.OpenAI(api_key=openai_api_key)
        
        # Create the edit prompt
        edit_prompt = f"""You are an expert content editor. Edit the following content based on the user's instructions.

ORIGINAL CONTENT:
{request.content}

USER INSTRUCTIONS:
{request.instruction}

REQUIREMENTS:
- Follow the user's instructions precisely
- Maintain the core message and intent of the original content
- Keep the same tone and style unless specifically requested to change it
- Ensure the edited content is clear, engaging, and professional
- Do not add any information that wasn't in the original or requested by the user
- Return only the edited content, nothing else

Return the edited content:"""
        
        # Call OpenAI to edit the content
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are an expert content editor. Always return only the edited content without any explanations or additional text."},
                {"role": "user", "content": edit_prompt}
            ],
            temperature=0.7,
            max_tokens=2000
        )
        
        # Track token usage
        from services.token_usage_service import TokenUsageService
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
        if supabase_url and supabase_service_key:
            token_tracker = TokenUsageService(supabase_url, supabase_service_key)
            await token_tracker.track_chat_completion_usage(
                user_id=current_user.id,
                feature_type="content_ai_edit",
                model_name="gpt-4o-mini",
                response=response,
                request_metadata={"content_length": len(request.content)}
            )
        
        edited_content = response.choices[0].message.content.strip()
        
        # Remove any markdown formatting if present
        if edited_content.startswith("```"):
            lines = edited_content.split("\n")
            edited_content = "\n".join(lines[1:-1]) if len(lines) > 2 else edited_content
        
        return {
            "success": True,
            "edited_content": edited_content
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to edit content with AI: {str(e)}"
        )

@router.get("/post-contents")
async def get_post_contents(
    limit: int = Query(50, gt=0, le=200),
    offset: int = Query(0, ge=0),
    platform: Optional[str] = None,
    post_status: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get post contents from post_contents table filtered by user's business_id"""
    try:
        # Use current user's ID as business_id
        business_id = current_user.id
        logger.info(f"Fetching post_contents for business_id: {business_id}")
        
        # Build query with business_id filter
        query = supabase_admin.table("post_contents").select("*").eq("business_id", business_id)

        # Add additional filters
        if platform:
            query = query.eq("platform", platform)
        if post_status:
            query = query.eq("status", post_status)

        # Apply pagination and ordering
        query = query.order("created_at", desc=True).range(offset, offset + limit - 1)

        response = query.execute()

        # Check if response has data
        if not response.data:
            logger.warning(f"No data returned from post_contents query for business_id: {business_id}")

        logger.info(f"Found {len(response.data or [])} post_contents for business_id: {business_id}")
        
        # Log first item for debugging
        if response.data and len(response.data) > 0:
            first_item = response.data[0]
            logger.info(f"Sample post_content: id={first_item.get('id')}, platform={first_item.get('platform')}, has_images={bool(first_item.get('generated_images'))}, images_type={type(first_item.get('generated_images'))}")

        return {
            "success": True,
            "data": response.data or [],
            "count": len(response.data or [])
        }

    except Exception as e:
        logger.error(f"Error fetching post contents: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch post contents: {str(e)}"
        )
