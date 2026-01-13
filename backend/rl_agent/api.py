"""
FastAPI application for content generation agent
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime
import pytz

# Import agent functions
from rl_agent_main import run_one_post
import db

# Indian Standard Time (IST) - Asia/Kolkata
IST = pytz.timezone("Asia/Kolkata")

app = FastAPI(
    title="Post Suggestion Agent API",
    description="API for generating social media content using reinforcement learning",
    version="1.0.0"
)

class GenerateContentRequest(BaseModel):
    profile_id: str
    topic: str
    platform: Optional[str] = "instagram"  # Default platform

class GenerateContentResponse(BaseModel):
    success: bool
    post_id: str
    platform: str
    topic: str
    generated_caption: str
    generated_image_url: str
    action_id: int
    message: str

@app.post("/generate-content", response_model=GenerateContentResponse)
async def generate_content(request: GenerateContentRequest):
    """
    Generate content for a specific profile and topic.

    This endpoint will:
    1. Run the content generation agent with the provided topic
    2. Populate the RL actions table
    3. Save the generated content to the post_content table
    4. Return the generated content details
    """
    try:
        # Validate that the profile exists
        profile_data = db.get_profile_business_data(request.profile_id)
        if not profile_data:
            raise HTTPException(
                status_code=404,
                detail=f"Profile with ID {request.profile_id} not found"
            )

        # Validate that the platform is supported
        if request.platform.lower() not in ["instagram", "facebook"]:
            raise HTTPException(
                status_code=400,
                detail=f"Platform {request.platform} is not supported. Supported platforms: instagram, facebook"
            )

        print(f"🚀 Starting content generation for profile {request.profile_id} on {request.platform} with topic: {request.topic}")

        # Run the content generation agent
        # Note: This will run synchronously. In production, you might want to make this async
        # or use background tasks for long-running operations
        run_one_post(
            BUSINESS_ID=request.profile_id,
            platform=request.platform.lower(),
            provided_topic=request.topic
        )

        # Get the most recently created post for this profile and platform
        # Since we just created it, we can query for the latest one
        current_date = datetime.now(IST).date().isoformat()

        # Query for the most recent post_content entry for this profile and platform
        result = db.supabase.table("post_contents").select("*").eq("business_id", request.profile_id).eq("platform", request.platform.lower()).eq("post_date", current_date).order("created_at", desc=True).limit(1).execute()

        if not result.data:
            raise HTTPException(
                status_code=500,
                detail="Content was generated but could not retrieve the result"
            )

        post_data = result.data[0]

        return GenerateContentResponse(
            success=True,
            post_id=post_data["post_id"],
            platform=post_data["platform"],
            topic=post_data["topic"],
            generated_caption=post_data["generated_caption"],
            generated_image_url=post_data["generated_image_url"],
            action_id=post_data["action_id"],
            message="Content generated successfully"
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error generating content: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate content: {str(e)}"
        )

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.now(IST).isoformat()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)