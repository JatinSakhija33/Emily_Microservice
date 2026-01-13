# post_scheduler.py - Cron job for scheduling and posting content

import os
import sys
from datetime import datetime
import pytz
from dotenv import load_dotenv
import time
from datetime import datetime, timedelta

# Add current directory to path to import local modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Load environment variables
load_dotenv()

# Indian Standard Time (IST) - Asia/Kolkata
IST = pytz.timezone("Asia/Kolkata")



def get_generated_posts():
    """
    Fetch all posts with status 'generated' that are ready for scheduling
    """
    try:
        posts = db.get_posts_by_status("generated")

        formatted_posts = []
        for row in posts:
            formatted_posts.append({
                "id": row["id"],
                "post_id": row["post_id"],
                "platform": row["platform"],
                "business_id": row["business_id"],
                "topic": row.get("topic"),
                "generated_caption": row.get("generated_caption"),
                "generated_image_url": row.get("generated_image_url"),
                "post_date": row.get("post_date"),
                "post_time": row.get("post_time"),
                "created_at": row.get("created_at")
            })

        print(f"📝 Found {len(formatted_posts)} posts with status 'generated'")
        return formatted_posts

    except Exception as e:
        print(f"❌ Error fetching generated posts: {e}")
        return []

def schedule_posts(posts):
    """
    Schedule posts by updating their status to 'scheduled'
    In a real implementation, this would also queue them for posting at the appropriate time
    """
    scheduled_count = 0

    for post in posts:
        try:
            db.schedule_post(post["post_id"])
            scheduled_count += 1
        except Exception as e:
            print(f"❌ Error scheduling post {post['post_id']}: {e}")

    return scheduled_count

def post_to_platform(post):
    """
    Actually post to the social media platform using real APIs
    """
    try:
        platform = post["platform"]
        post_id = post["post_id"]
        business_id = post["business_id"]
        caption = post.get("generated_caption", "")
        image_url = post.get("generated_image_url")

        print(f"🚀 Posting {post_id} to {platform} for business {business_id}...")

        # Use real social media APIs
        result = poster.post_to_platform(
            business_id=business_id,
            platform=platform,
            post_id=post_id,
            caption=caption,
            image_url=image_url
        )

        if result["success"]:
            return {
                "success": True,
                "media_id": result["media_id"],
                "posted_at": datetime.now(IST).isoformat()
            }
        else:
            return {
                "success": False,
                "error": result.get("error", "Unknown error")
            }

    except Exception as e:
        error_msg = f"Error posting {post['post_id']} to {platform}: {e}"
        print(f"❌ {error_msg}")
        return {
            "success": False,
            "error": str(e)
        }

def update_post_status(post_id, platform, media_id=None, new_status="posted"):
    """
    Update post status after posting
    """
    try:
        if new_status == "posted":
            db.mark_post_as_posted(post_id, media_id)
        elif new_status == "failed":
            db.fail_post(post_id)
        else:
            # Generic status update
            db.supabase.table("post_contents").update({
                "status": new_status,
                "updated_at": datetime.now(IST).isoformat()
            }).eq("post_id", post_id).eq("platform", platform).execute()
            print(f"📊 Updated {post_id} status to '{new_status}'")

    except Exception as e:
        print(f"❌ Error updating post status for {post_id}: {e}")

def run_scheduling_job():
    """
    Main function to run the scheduling job at 5 AM
    """
    print("🌅 Starting post scheduling job at 5 AM IST")
    print(f"🕐 Current time: {datetime.now(IST).strftime('%Y-%m-%d %H:%M:%S %Z')}")

    # Get all generated posts
    generated_posts = get_generated_posts()

    if not generated_posts:
        print("ℹ️ No posts to schedule")
        return

    # Schedule the posts
    scheduled_count = schedule_posts(generated_posts)

    print(f"✅ Successfully scheduled {scheduled_count} posts")

def run_posting_job():
    """
    Function to actually post scheduled content
    This would typically be called at the scheduled time for each post
    """
    print("🚀 Starting post publishing job")

    try:
        # Get all scheduled posts that are ready to post
        scheduled_posts = db.get_scheduled_posts_ready_to_post()

        if not scheduled_posts:
            print("ℹ️ No posts ready to publish")
            return

        print(f"📤 Found {len(scheduled_posts)} posts ready to publish")

        posted_count = 0
        failed_count = 0

        for post_row in scheduled_posts:
            post = {
                "id": post_row["id"],
                "post_id": post_row["post_id"],
                "platform": post_row["platform"],
                "business_id": post_row["business_id"],
                "topic": post_row.get("topic"),
                "generated_caption": post_row.get("generated_caption"),
                "generated_image_url": post_row.get("generated_image_url"),
                "post_date": post_row.get("post_date"),
                "post_time": post_row.get("post_time"),
            }

            # Post to platform
            result = post_to_platform(post)

            if result["success"]:
                # Update status to 'posted' with media_id
                update_post_status(
                    post_id=post["post_id"],
                    platform=post["platform"],
                    media_id=result["media_id"],
                    new_status="posted"
                )
                posted_count += 1
            else:
                # Update status to 'failed'
                update_post_status(
                    post_id=post["post_id"],
                    platform=post["platform"],
                    new_status="failed"
                )
                failed_count += 1

        print(f"✅ Successfully posted {posted_count} posts")
        if failed_count > 0:
            print(f"❌ Failed to post {failed_count} posts")

    except Exception as e:
        print(f"❌ Error in posting job: {e}")

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Post Scheduler - Schedule and publish social media content")
    parser.add_argument("action", choices=["schedule", "post"], help="Action to perform: schedule (5 AM job) or post (publish scheduled content)")

    args = parser.parse_args()

    if args.action == "schedule":
        run_scheduling_job()
    elif args.action == "post":
        run_posting_job()
