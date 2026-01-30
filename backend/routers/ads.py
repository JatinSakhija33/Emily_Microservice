"""
Ads Router - Handle ad creation, management, and analytics
"""

from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import logging


# Initialize security
security = HTTPBearer()
from supabase import create_client, Client
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Supabase clients
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

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current user from Supabase JWT token"""
    try:
        token = credentials.credentials
        response = supabase.auth.get_user(token)
        
        if not response.user:
            raise HTTPException(
                status_code=401,
                detail="Could not validate credentials"
            )
        
        return {
            "id": response.user.id,
            "email": response.user.email,
            "name": response.user.user_metadata.get("name", response.user.email),
            "created_at": response.user.created_at
        }
        
    except Exception as e:
        print(f"Authentication error: {e}")
        raise HTTPException(
            status_code=401,
            detail="Could not validate credentials"
        )

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ads", tags=["ads"])
security = HTTPBearer()

@router.get("/test")
async def test_ads_router():
    """Test endpoint to verify ads router is working"""
    return {"message": "Ads router is working", "status": "ok"}

class AdCopyResponse(BaseModel):
    id: str
    title: str
    ad_copy: str
    platform: str
    ad_type: str
    call_to_action: str
    target_audience: str
    budget_range: str
    campaign_objective: str
    scheduled_at: datetime
    status: str
    media_url: Optional[str] = None
    hashtags: List[str] = []
    metadata: Dict[str, Any] = {}
    campaign_id: str
    created_at: datetime

class AdCampaignResponse(BaseModel):
    id: str
    user_id: str
    campaign_name: str
    campaign_objective: str
    target_audience: str
    budget_range: str
    platforms: List[str]
    start_date: datetime
    end_date: datetime
    status: str
    total_ads: int
    approved_ads: int
    created_at: datetime
    metadata: Dict[str, Any] = {}

class AdUpdateRequest(BaseModel):
    title: Optional[str] = None
    ad_copy: Optional[str] = None
    call_to_action: Optional[str] = None
    target_audience: Optional[str] = None
    budget_range: Optional[str] = None
    campaign_objective: Optional[str] = None
    hashtags: Optional[List[str]] = None
    status: Optional[str] = None

class CampaignUpdateRequest(BaseModel):
    campaign_name: Optional[str] = None
    campaign_objective: Optional[str] = None
    target_audience: Optional[str] = None
    budget_range: Optional[str] = None
    status: Optional[str] = None

@router.get("/by-date")
async def get_ads_by_date(
    date: str = Query(..., description="Date in YYYY-MM-DD format"),
    current_user: dict = Depends(get_current_user)
):
    """Get all ads for a specific date"""
    try:
        supabase_client = supabase_admin
        
        # Parse date and get date range
        target_date = datetime.fromisoformat(date)
        start_date = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
        end_date = start_date + timedelta(days=1)
        
        # Get ads for the date range
        response = supabase_client.table("ad_copies").select("""
            *,
            ad_campaigns!inner(
                id,
                user_id,
                campaign_name,
                campaign_objective,
                target_audience,
                budget_range,
                platforms,
                start_date,
                end_date,
                status,
                total_ads,
                approved_ads,
                created_at,
                metadata
            )
        """).eq("ad_campaigns.user_id", current_user["id"]).gte("scheduled_at", start_date.isoformat()).lt("scheduled_at", end_date.isoformat()).execute()
        
        ads = []
        for ad in response.data:
            print(f"🔍 Ad data from DB: {ad}")
            print(f"🔍 Platform field: {ad.get('platform', 'MISSING')}")
            
            # Handle missing platform field by deriving from campaign platforms
            if not ad.get('platform') and ad.get('ad_campaigns', {}).get('platforms'):
                campaign_platforms = ad['ad_campaigns']['platforms']
                if campaign_platforms and len(campaign_platforms) > 0:
                    # Use the first platform from the campaign as fallback
                    ad['platform'] = campaign_platforms[0]
                    print(f"🔧 Set platform from campaign: {ad['platform']}")
            
            # If still no platform, set a default
            if not ad.get('platform'):
                ad['platform'] = 'unknown'
                print(f"⚠️ No platform found, setting to 'unknown'")
            
            try:
                # Parse datetime fields properly
                ad_copy = AdCopyResponse(
                    id=ad['id'],
                    title=ad['title'],
                    ad_copy=ad['ad_copy'],
                    platform=ad['platform'],
                    ad_type=ad['ad_type'],
                    call_to_action=ad['call_to_action'],
                    target_audience=ad['target_audience'],
                    budget_range=ad['budget_range'],
                    campaign_objective=ad['campaign_objective'],
                    scheduled_at=datetime.fromisoformat(ad['scheduled_at'].replace('Z', '+00:00')),
                    status=ad['status'],
                    media_url=ad.get('media_url'),
                    hashtags=ad.get('hashtags', []),
                    metadata=ad.get('metadata', {}),
                    campaign_id=ad['campaign_id'],
                    created_at=datetime.fromisoformat(ad['created_at'].replace('Z', '+00:00'))
                )
                ads.append(ad_copy)
                print(f"✅ Successfully parsed ad: {ad_copy.id} - Platform: {ad_copy.platform}")
            except Exception as e:
                print(f"❌ Error parsing ad {ad.get('id', 'unknown')}: {e}")
                # Create a fallback ad with minimal data
                try:
                    fallback_ad = AdCopyResponse(
                        id=ad.get('id', 'unknown'),
                        title=ad.get('title', 'Unknown Title'),
                        ad_copy=ad.get('ad_copy', ''),
                        platform=ad.get('platform', 'unknown'),
                        ad_type=ad.get('ad_type', 'text'),
                        call_to_action=ad.get('call_to_action', ''),
                        target_audience=ad.get('target_audience', ''),
                        budget_range=ad.get('budget_range', ''),
                        campaign_objective=ad.get('campaign_objective', ''),
                        scheduled_at=datetime.now(),
                        status=ad.get('status', 'draft'),
                        media_url=ad.get('media_url'),
                        hashtags=ad.get('hashtags', []),
                        metadata=ad.get('metadata', {}),
                        campaign_id=ad.get('campaign_id', ''),
                        created_at=datetime.now()
                    )
                    ads.append(fallback_ad)
                    print(f"🔧 Created fallback ad: {fallback_ad.id} - Platform: {fallback_ad.platform}")
                except Exception as fallback_error:
                    print(f"❌ Failed to create fallback ad: {fallback_error}")
        
        return {"ads": ads, "date": date, "count": len(ads)}
        
    except Exception as e:
        logger.error(f"Error fetching ads by date: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/campaigns")
async def get_campaigns(current_user: dict = Depends(get_current_user)):
    """Get all campaigns for the current user"""
    try:
        supabase_client = supabase_admin
        
        response = supabase_client.table("ad_campaigns").select("*").eq("user_id", current_user["id"]).order("created_at", desc=True).execute()
        
        campaigns = []
        for campaign in response.data:
            campaigns.append(AdCampaignResponse(**campaign))
        
        return {"campaigns": campaigns, "count": len(campaigns)}
        
    except Exception as e:
        logger.error(f"Error fetching campaigns: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/campaigns/{campaign_id}")
async def get_campaign(
    campaign_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific campaign"""
    try:
        supabase_client = supabase_admin
        
        response = supabase_client.table("ad_campaigns").select("*").eq("id", campaign_id).eq("user_id", current_user["id"]).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Campaign not found")
        
        campaign = AdCampaignResponse(**response.data[0])
        
        # Get ads for this campaign
        ads_response = supabase_client.table("ad_copies").select("*").eq("campaign_id", campaign_id).execute()
        ads = [AdCopyResponse(**ad) for ad in ads_response.data]
        
        return {"campaign": campaign, "ads": ads, "ads_count": len(ads)}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching campaign: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate")
async def generate_ads(current_user: dict = Depends(get_current_user)):
    """Generate ads for the current user - Service temporarily unavailable"""
    logger.warning(f"Ads generation requested for user {current_user['id']}, but ads agent is disabled")
    raise HTTPException(status_code=503, detail="Ads generation service is temporarily unavailable. Please create ads manually instead.")

@router.get("/{ad_id}")
async def get_ad(
    ad_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific ad"""
    try:
        supabase_client = supabase_admin
        
        response = supabase_client.table("ad_copies").select("""
            *,
            ad_campaigns!inner(
                id,
                user_id,
                campaign_name,
                campaign_objective,
                target_audience,
                budget_range,
                platforms,
                start_date,
                end_date,
                status,
                total_ads,
                approved_ads,
                created_at,
                metadata
            )
        """).eq("id", ad_id).eq("ad_campaigns.user_id", current_user["id"]).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail="Ad not found")
        
        ad = AdCopyResponse(**response.data[0])
        
        # Get ad images
        images_response = supabase.table("ad_images").select("*").eq("ad_id", ad_id).execute()
        ad.images = images_response.data
        
        return {"ad": ad}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching ad: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{ad_id}")
async def update_ad(
    ad_id: str,
    ad_data: AdUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update an ad"""
    print(f"🔧 PUT /api/ads/{ad_id} called with data: {ad_data.dict()}")
    try:
        supabase_client = supabase_admin
        
        # Check if ad exists and belongs to user
        ad_response = supabase_client.table("ad_copies").select("""
            *,
            ad_campaigns!inner(
                id,
                user_id
            )
        """).eq("id", ad_id).eq("ad_campaigns.user_id", current_user["id"]).execute()
        
        print(f"🔧 Ad query result: {ad_response.data}")
        print(f"🔧 User ID: {current_user['id']}")
        print(f"🔧 Ad ID: {ad_id}")
        
        if not ad_response.data:
            raise HTTPException(status_code=404, detail="Ad not found")
        
        # Update ad
        update_data = {k: v for k, v in ad_data.dict().items() if v is not None}
        update_data["updated_at"] = datetime.now().isoformat()
        
        response = supabase_client.table("ad_copies").update(update_data).eq("id", ad_id).execute()
        
        if response.data:
            return {"message": "Ad updated successfully", "ad": AdCopyResponse(**response.data[0])}
        else:
            raise HTTPException(status_code=500, detail="Failed to update ad")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating ad: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{ad_id}/approve")
async def approve_ad(
    ad_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Approve an ad"""
    try:
        supabase_client = supabase_admin
        
        # Check if ad exists and belongs to user
        ad_response = supabase_client.table("ad_copies").select("""
            *,
            ad_campaigns!inner(
                id,
                user_id
            )
        """).eq("id", ad_id).eq("ad_campaigns.user_id", current_user["id"]).execute()
        
        if not ad_response.data:
            raise HTTPException(status_code=404, detail="Ad not found")
        
        # Update ad status
        response = supabase_client.table("ad_copies").update({
            "status": "approved",
            "updated_at": datetime.now().isoformat()
        }).eq("id", ad_id).execute()
        
        if response.data:
            # Update campaign approved count
            campaign_id = response.data[0]["campaign_id"]
            supabase_client.table("ad_campaigns").update({
                "approved_ads": supabase.table("ad_campaigns").select("approved_ads").eq("id", campaign_id).execute().data[0]["approved_ads"] + 1
            }).eq("id", campaign_id).execute()
            
            return {"message": "Ad approved successfully", "ad": AdCopyResponse(**response.data[0])}
        else:
            raise HTTPException(status_code=500, detail="Failed to approve ad")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error approving ad: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{ad_id}/reject")
async def reject_ad(
    ad_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Reject an ad"""
    try:
        supabase_client = supabase_admin
        
        # Check if ad exists and belongs to user
        ad_response = supabase_client.table("ad_copies").select("""
            *,
            ad_campaigns!inner(
                id,
                user_id
            )
        """).eq("id", ad_id).eq("ad_campaigns.user_id", current_user["id"]).execute()
        
        if not ad_response.data:
            raise HTTPException(status_code=404, detail="Ad not found")
        
        # Update ad status
        response = supabase_client.table("ad_copies").update({
            "status": "rejected",
            "updated_at": datetime.now().isoformat()
        }).eq("id", ad_id).execute()
        
        if response.data:
            return {"message": "Ad rejected successfully", "ad": AdCopyResponse(**response.data[0])}
        else:
            raise HTTPException(status_code=500, detail="Failed to reject ad")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error rejecting ad: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{ad_id}")
async def delete_ad(
    ad_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete an ad"""
    try:
        supabase_client = supabase_admin
        
        # Check if ad exists and belongs to user
        ad_response = supabase_client.table("ad_copies").select("""
            *,
            ad_campaigns!inner(
                id,
                user_id
            )
        """).eq("id", ad_id).eq("ad_campaigns.user_id", current_user["id"]).execute()
        
        if not ad_response.data:
            raise HTTPException(status_code=404, detail="Ad not found")
        
        # Delete ad images first
        supabase_client.table("ad_images").delete().eq("ad_id", ad_id).execute()
        
        # Delete ad
        response = supabase_client.table("ad_copies").delete().eq("id", ad_id).execute()
        
        if response.data:
            return {"message": "Ad deleted successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to delete ad")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting ad: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{ad_id}/performance")
async def get_ad_performance(
    ad_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get performance metrics for an ad"""
    try:
        supabase_client = supabase_admin
        
        # Check if ad exists and belongs to user
        ad_response = supabase_client.table("ad_copies").select("""
            *,
            ad_campaigns!inner(
                id,
                user_id
            )
        """).eq("id", ad_id).eq("ad_campaigns.user_id", current_user["id"]).execute()
        
        if not ad_response.data:
            raise HTTPException(status_code=404, detail="Ad not found")
        
        # Get performance data
        response = supabase_client.table("ad_performance").select("*").eq("ad_id", ad_id).order("date_recorded", desc=True).execute()
        
        return {"performance": response.data, "ad_id": ad_id}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching ad performance: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/campaigns/{campaign_id}")
async def update_campaign(
    campaign_id: str,
    campaign_data: CampaignUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update a campaign"""
    try:
        supabase_client = supabase_admin
        
        # Check if campaign exists and belongs to user
        campaign_response = supabase.table("ad_campaigns").select("*").eq("id", campaign_id).eq("user_id", current_user["id"]).execute()
        
        if not campaign_response.data:
            raise HTTPException(status_code=404, detail="Campaign not found")
        
        # Update campaign
        update_data = {k: v for k, v in campaign_data.dict().items() if v is not None}
        update_data["updated_at"] = datetime.now().isoformat()
        
        response = supabase_client.table("ad_campaigns").update(update_data).eq("id", campaign_id).execute()
        
        if response.data:
            return {"message": "Campaign updated successfully", "campaign": AdCampaignResponse(**response.data[0])}
        else:
            raise HTTPException(status_code=500, detail="Failed to update campaign")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating campaign: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/campaigns/{campaign_id}")
async def delete_campaign(
    campaign_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a campaign and all its ads"""
    try:
        supabase_client = supabase_admin
        
        # Check if campaign exists and belongs to user
        campaign_response = supabase.table("ad_campaigns").select("*").eq("id", campaign_id).eq("user_id", current_user["id"]).execute()
        
        if not campaign_response.data:
            raise HTTPException(status_code=404, detail="Campaign not found")
        
        # Get all ads for this campaign
        ads_response = supabase_client.table("ad_copies").select("id").eq("campaign_id", campaign_id).execute()
        ad_ids = [ad["id"] for ad in ads_response.data]
        
        # Delete ad images
        if ad_ids:
            supabase_client.table("ad_images").delete().in_("ad_id", ad_ids).execute()
        
        # Delete ads
        if ad_ids:
            supabase_client.table("ad_copies").delete().in_("id", ad_ids).execute()
        
        # Delete campaign
        response = supabase_client.table("ad_campaigns").delete().eq("id", campaign_id).execute()
        
        if response.data:
            return {"message": "Campaign deleted successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to delete campaign")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting campaign: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{ad_id}/generate-media")
async def generate_ad_media(
    ad_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Generate media for a specific ad - Service temporarily unavailable"""
    logger.warning(f"Ad media generation requested for ad {ad_id}, but ads media agent is disabled")
    raise HTTPException(status_code=503, detail="Ad media generation service is temporarily unavailable. Please upload media manually instead.")

@router.post("/{ad_id}/upload-image")
async def upload_ad_image(
    ad_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload an image file for a specific ad"""
    try:
        logger.info(f"Ad image upload request - ad_id: {ad_id}, filename: {file.filename}")
        
        # Verify the ad belongs to the user
        ad_response = supabase_admin.table("ad_copies").select("*").eq("id", ad_id).eq("user_id", current_user["id"]).execute()
        
        if not ad_response.data:
            raise HTTPException(status_code=404, detail="Ad not found or access denied")
        
        # Validate file type
        allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
        if file.content_type not in allowed_types:
            raise HTTPException(status_code=400, detail="Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.")
        
        # Read file content
        file_content = await file.read()
        logger.info(f"File content read - size: {len(file_content)} bytes")
        
        # Generate filename
        import uuid
        file_ext = file.filename.split('.')[-1] if '.' in file.filename else 'png'
        filename = f"{ad_id}-{uuid.uuid4().hex[:8]}.{file_ext}"
        
        # Upload to Supabase storage using user-uploads bucket (same as content manual uploads)
        storage_response = supabase_admin.storage.from_("user-uploads").upload(
            filename,
            file_content,
            file_options={"content-type": file.content_type}
        )
        
        if hasattr(storage_response, 'error') and storage_response.error:
            raise HTTPException(status_code=400, detail=f"Storage upload failed: {storage_response.error}")
        
        # Get public URL
        public_url = supabase_admin.storage.from_("user-uploads").get_public_url(filename)
        logger.info(f"Ad image uploaded successfully: {public_url}")
        
        # Update ad with media URL
        update_response = supabase_admin.table("ad_copies").update({
            "media_url": public_url,
            "updated_at": datetime.now().isoformat()
        }).eq("id", ad_id).execute()
        
        if not update_response.data:
            raise HTTPException(status_code=500, detail="Failed to update ad with media URL")
        
        # Create ad image record
        image_record = {
            "ad_id": ad_id,
            "image_url": public_url,
            "image_prompt": "User uploaded image",
            "image_style": "user_upload",
            "image_size": "custom",
            "image_quality": "custom",
            "generation_model": "user_upload",
            "is_approved": True,
            "created_at": datetime.now().isoformat()
        }
        
        image_response = supabase_admin.table("ad_images").insert(image_record).execute()
        
        if not image_response.data:
            logger.warning("Failed to create ad image record")
        
        return {
            "success": True,
            "image_url": public_url,
            "message": "Ad image uploaded successfully"
        }
        
    except Exception as e:
        logger.error(f"Error uploading ad image: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error uploading ad image: {str(e)}")

@router.post("/campaigns/{campaign_id}/generate-media")
async def generate_campaign_media(
    campaign_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Generate media for all ads in a campaign - Service temporarily unavailable"""
    logger.warning(f"Campaign media generation requested for campaign {campaign_id}, but ads media agent is disabled")
    raise HTTPException(status_code=503, detail="Campaign media generation service is temporarily unavailable. Please upload media manually instead.")
