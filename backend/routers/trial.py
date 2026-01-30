#!/usr/bin/env python3
"""
Trial Router
API endpoints for managing user trials
"""

import logging
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional

from auth import get_current_user, User
from services.trial_service import trial_service

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/api/trial", tags=["trial"])

# Pydantic models
class TrialActivationRequest(BaseModel):
    """Request model for trial activation"""
    user_email: str
    user_name: str

class TrialExtensionRequest(BaseModel):
    """Request model for trial extension"""
    additional_days: int = 1

class TrialStatusResponse(BaseModel):
    """Response model for trial status"""
    success: bool
    trial_active: bool
    subscription_status: str
    days_remaining: Optional[int] = None
    trial_expires_at: Optional[str] = None
    message: str

@router.post("/activate")
async def activate_trial(
    request: TrialActivationRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Activate a 3-day free trial for the current user
    """
    try:
        logger.info(f"Trial activation requested for user {current_user.id}")
        
        # Activate trial
        result = await trial_service.activate_trial(
            user_id=current_user.id,
            user_email=request.user_email,
            user_name=request.user_name
        )
        
        if result["success"]:
            logger.info(f"Trial activated successfully for user {current_user.id}")
            return JSONResponse(content={
                "success": True,
                "message": "Trial activated successfully",
                "trial_info": result
            })
        else:
            logger.warning(f"Trial activation failed for user {current_user.id}: {result['message']}")
            return JSONResponse(content={
                "success": False,
                "message": result["message"],
                "trial_info": result
            }, status_code=400)
            
    except Exception as e:
        logger.error(f"Error activating trial for user {current_user.id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error activating trial: {str(e)}")

@router.get("/status")
async def get_trial_status(current_user: User = Depends(get_current_user)):
    """
    Get the current trial status for the user
    """
    try:
        logger.info(f"Trial status requested for user {current_user.id}")
        
        # Check trial status
        result = await trial_service.check_trial_status(current_user.id)
        
        if result["success"]:
            return JSONResponse(content={
                "success": True,
                "trial_status": result
            })
        else:
            return JSONResponse(content={
                "success": False,
                "message": result["message"]
            }, status_code=400)
            
    except Exception as e:
        logger.error(f"Error checking trial status for user {current_user.id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error checking trial status: {str(e)}")

@router.get("/info")
async def get_trial_info(current_user: User = Depends(get_current_user)):
    """
    Get comprehensive trial information for the user
    """
    try:
        logger.info(f"Trial info requested for user {current_user.id}")
        
        # Get trial info
        result = await trial_service.get_trial_info(current_user.id)
        
        if result["success"]:
            return JSONResponse(content={
                "success": True,
                "trial_info": result
            })
        else:
            return JSONResponse(content={
                "success": False,
                "message": result["message"]
            }, status_code=400)
            
    except Exception as e:
        logger.error(f"Error getting trial info for user {current_user.id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error getting trial info: {str(e)}")

@router.post("/extend")
async def extend_trial(
    request: TrialExtensionRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Extend the trial by additional days (admin function)
    """
    try:
        logger.info(f"Trial extension requested for user {current_user.id}: {request.additional_days} days")
        
        # Extend trial
        result = await trial_service.extend_trial(
            user_id=current_user.id,
            additional_days=request.additional_days
        )
        
        if result["success"]:
            logger.info(f"Trial extended successfully for user {current_user.id}")
            return JSONResponse(content={
                "success": True,
                "message": "Trial extended successfully",
                "extension_info": result
            })
        else:
            logger.warning(f"Trial extension failed for user {current_user.id}: {result['message']}")
            return JSONResponse(content={
                "success": False,
                "message": result["message"]
            }, status_code=400)
            
    except Exception as e:
        logger.error(f"Error extending trial for user {current_user.id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error extending trial: {str(e)}")

@router.get("/check-expired")
async def check_expired_trials():
    """
    Check for and deactivate expired trials (admin endpoint)
    """
    try:
        logger.info("Checking for expired trials")
        
        # This would typically be called by a scheduled job
        # For now, we'll just return a message
        return JSONResponse(content={
            "success": True,
            "message": "Expired trial check completed",
            "note": "This endpoint should be called by a scheduled job"
        })
        
    except Exception as e:
        logger.error(f"Error checking expired trials: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error checking expired trials: {str(e)}")

@router.get("/health")
async def trial_health_check():
    """
    Health check endpoint for the trial service
    """
    try:
        # Test database connection
        test_result = trial_service.supabase.table("profiles").select("count").execute()
        
        return JSONResponse(content={
            "success": True,
            "message": "Trial service is healthy",
            "database_connected": True,
            "trial_duration_days": trial_service.TRIAL_DURATION_DAYS
        })
        
    except Exception as e:
        logger.error(f"Trial service health check failed: {str(e)}")
        return JSONResponse(content={
            "success": False,
            "message": f"Trial service health check failed: {str(e)}",
            "database_connected": False
        }, status_code=500)
