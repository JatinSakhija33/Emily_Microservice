"""
Migration script to migrate image data from content_images to content_posts table.

This script:
1. Adds columns to content_posts: primary_image_url, primary_image_prompt, primary_image_approved
2. Migrates data: For each post, finds approved image (or latest if no approved)
3. Updates content_posts with the primary image data

Run this script once before deploying the updated code.
"""

import os
import sys
from dotenv import load_dotenv
from supabase import create_client
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

def migrate_images_to_content_posts():
    """Migrate image data from content_images to content_posts"""
    try:
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not supabase_url or not supabase_key:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
        
        supabase = create_client(supabase_url, supabase_key)
        
        logger.info("Starting migration: content_images to content_posts")
        
        # Step 1: Add columns to content_posts (if they don't exist)
        # Note: This requires SQL execution. In Supabase, you can run this via SQL editor:
        # ALTER TABLE content_posts ADD COLUMN IF NOT EXISTS primary_image_url TEXT;
        # ALTER TABLE content_posts ADD COLUMN IF NOT EXISTS primary_image_prompt TEXT;
        # ALTER TABLE content_posts ADD COLUMN IF NOT EXISTS primary_image_approved BOOLEAN DEFAULT false;
        logger.info("Step 1: Please add columns to content_posts table via Supabase SQL editor:")
        logger.info("  ALTER TABLE content_posts ADD COLUMN IF NOT EXISTS primary_image_url TEXT;")
        logger.info("  ALTER TABLE content_posts ADD COLUMN IF NOT EXISTS primary_image_prompt TEXT;")
        logger.info("  ALTER TABLE content_posts ADD COLUMN IF NOT EXISTS primary_image_approved BOOLEAN DEFAULT false;")
        
        # Step 2: Get all posts
        logger.info("Step 2: Fetching all content posts...")
        posts_response = supabase.table("content_posts").select("id").execute()
        posts = posts_response.data if posts_response.data else []
        logger.info(f"Found {len(posts)} content posts")
        
        migrated_count = 0
        skipped_count = 0
        error_count = 0
        
        # Step 3: For each post, find primary image
        for post in posts:
            post_id = post["id"]
            try:
                # First, try to find approved image
                approved_images = supabase.table("content_images").select("*").eq("post_id", post_id).eq("is_approved", True).order("created_at", desc=True).limit(1).execute()
                
                primary_image = None
                if approved_images.data and len(approved_images.data) > 0:
                    primary_image = approved_images.data[0]
                    logger.debug(f"Post {post_id}: Found approved image")
                else:
                    # If no approved image, get latest image
                    latest_images = supabase.table("content_images").select("*").eq("post_id", post_id).order("created_at", desc=True).limit(1).execute()
                    if latest_images.data and len(latest_images.data) > 0:
                        primary_image = latest_images.data[0]
                        logger.debug(f"Post {post_id}: Using latest image (no approved image)")
                
                if primary_image:
                    # Update content_posts with primary image data
                    update_data = {
                        "primary_image_url": primary_image.get("image_url"),
                        "primary_image_prompt": primary_image.get("image_prompt", ""),
                        "primary_image_approved": primary_image.get("is_approved", False)
                    }
                    
                    update_response = supabase.table("content_posts").update(update_data).eq("id", post_id).execute()
                    
                    if update_response.data:
                        migrated_count += 1
                        logger.info(f"Post {post_id}: Migrated image (approved: {primary_image.get('is_approved', False)})")
                    else:
                        error_count += 1
                        logger.error(f"Post {post_id}: Failed to update")
                else:
                    # No images for this post - set to NULL
                    update_data = {
                        "primary_image_url": None,
                        "primary_image_prompt": None,
                        "primary_image_approved": False
                    }
                    supabase.table("content_posts").update(update_data).eq("id", post_id).execute()
                    skipped_count += 1
                    logger.debug(f"Post {post_id}: No images found")
                    
            except Exception as e:
                error_count += 1
                logger.error(f"Error migrating post {post_id}: {e}")
        
        logger.info("=" * 50)
        logger.info("Migration completed!")
        logger.info(f"  Migrated: {migrated_count} posts")
        logger.info(f"  No images: {skipped_count} posts")
        logger.info(f"  Errors: {error_count} posts")
        logger.info("=" * 50)
        
        return {
            "success": True,
            "migrated": migrated_count,
            "skipped": skipped_count,
            "errors": error_count
        }
        
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        raise

if __name__ == "__main__":
    try:
        result = migrate_images_to_content_posts()
        sys.exit(0)
    except Exception as e:
        logger.error(f"Migration script failed: {e}")
        sys.exit(1)

