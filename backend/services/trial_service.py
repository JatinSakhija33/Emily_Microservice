#!/usr/bin/env python3
"""
Trial System Service
Handles 3-day free trial activation and management for new users
"""

import os
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TrialService:
    """Service for managing user trials"""
    
    def __init__(self):
        """Initialize the trial service with Supabase connection"""
        self.supabase_url = os.getenv("SUPABASE_URL")
        self.supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not self.supabase_url or not self.supabase_service_key:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
        
        # Use service role key for admin operations
        self.supabase: Client = create_client(self.supabase_url, self.supabase_service_key)
        
        # Trial configuration
        self.TRIAL_DURATION_DAYS = 3
        self.TRIAL_STATUS = "trial"
        self.TRIAL_PLAN = "free_trial"
    
    async def activate_trial(self, user_id: str, user_email: str, user_name: str) -> Dict[str, Any]:
        """
        Activate a 3-day free trial for a new user
        
        Args:
            user_id: The user's UUID
            user_email: The user's email address
            user_name: The user's name
            
        Returns:
            Dict containing trial activation result
        """
        try:
            logger.info(f"Activating trial for user {user_id} ({user_email})")
            
            # Check if user already has a profile
            existing_profile = self.supabase.table("profiles").select("*").eq("id", user_id).execute()
            
            if existing_profile.data:
                profile = existing_profile.data[0]
                current_status = profile.get("subscription_status", "inactive")
                has_had_trial = profile.get("has_had_trial", False)
                
                # If user already has an active subscription or trial, don't activate new trial
                if current_status in ["active", "trial"]:
                    logger.info(f"User {user_id} already has status: {current_status}")
                    return {
                        "success": False,
                        "message": f"User already has {current_status} status",
                        "current_status": current_status,
                        "trial_active": current_status == "trial"
                    }
                
                # If user has ever had a trial before, don't activate new trial
                if has_had_trial:
                    logger.info(f"User {user_id} has already had a trial before")
                    return {
                        "success": False,
                        "message": "User has already used their free trial",
                        "current_status": current_status,
                        "trial_active": False,
                        "has_had_trial": True
                    }
            
            # Calculate trial dates
            now = datetime.utcnow()
            trial_end_date = now + timedelta(days=self.TRIAL_DURATION_DAYS)
            
            # Prepare profile data (without email as it's not in profiles table)
            profile_data = {
                "id": user_id,
                "name": user_name,
                "subscription_status": self.TRIAL_STATUS,
                "subscription_plan": self.TRIAL_PLAN,
                "subscription_start_date": now.isoformat(),
                "subscription_end_date": trial_end_date.isoformat(),
                "trial_activated_at": now.isoformat(),
                "trial_expires_at": trial_end_date.isoformat(),
                "has_had_trial": True,  # Mark that user has had a trial
                "onboarding_completed": False,
                "migration_status": "trial_user",
                "created_at": now.isoformat(),
                "updated_at": now.isoformat()
            }
            
            # Insert or update profile
            if existing_profile.data:
                # Update existing profile
                result = self.supabase.table("profiles").update(profile_data).eq("id", user_id).execute()
                logger.info(f"Updated existing profile for user {user_id}")
            else:
                # Create new profile
                result = self.supabase.table("profiles").insert(profile_data).execute()
                logger.info(f"Created new profile for user {user_id}")
            
            if result.data:
                logger.info(f"✅ Trial activated successfully for user {user_id}")
                return {
                    "success": True,
                    "message": "Trial activated successfully",
                    "trial_start": now.isoformat(),
                    "trial_end": trial_end_date.isoformat(),
                    "days_remaining": self.TRIAL_DURATION_DAYS,
                    "trial_active": True
                }
            else:
                logger.error(f"Failed to activate trial for user {user_id}")
                return {
                    "success": False,
                    "message": "Failed to activate trial"
                }
                
        except Exception as e:
            logger.error(f"Error activating trial for user {user_id}: {str(e)}")
            return {
                "success": False,
                "message": f"Error activating trial: {str(e)}"
            }
    
    async def check_trial_status(self, user_id: str) -> Dict[str, Any]:
        """
        Check the current trial status for a user
        
        Args:
            user_id: The user's UUID
            
        Returns:
            Dict containing trial status information
        """
        try:
            # Get user profile
            result = self.supabase.table("profiles").select("*").eq("id", user_id).execute()
            
            if not result.data:
                return {
                    "success": False,
                    "message": "User profile not found",
                    "trial_active": False,
                    "subscription_status": "inactive"
                }
            
            profile = result.data[0]
            subscription_status = profile.get("subscription_status", "inactive")
            
            # If not on trial, return current status
            if subscription_status != "trial":
                return {
                    "success": True,
                    "trial_active": False,
                    "subscription_status": subscription_status,
                    "message": f"User has {subscription_status} status"
                }
            
            # Check if trial has expired
            trial_expires_at = profile.get("trial_expires_at")
            if trial_expires_at:
                expires_datetime = datetime.fromisoformat(trial_expires_at.replace('Z', '+00:00'))
                now = datetime.utcnow()
                
                if now > expires_datetime:
                    # Trial has expired, deactivate it
                    await self._deactivate_expired_trial(user_id)
                    return {
                        "success": True,
                        "trial_active": False,
                        "subscription_status": "expired",
                        "message": "Trial has expired",
                        "expired_at": trial_expires_at
                    }
                else:
                    # Trial is still active
                    days_remaining = (expires_datetime - now).days
                    return {
                        "success": True,
                        "trial_active": True,
                        "subscription_status": "trial",
                        "days_remaining": days_remaining,
                        "trial_expires_at": trial_expires_at,
                        "message": f"Trial active, {days_remaining} days remaining"
                    }
            else:
                # No expiration date set, assume trial is active
                return {
                    "success": True,
                    "trial_active": True,
                    "subscription_status": "trial",
                    "message": "Trial active (no expiration date set)"
                }
                
        except Exception as e:
            logger.error(f"Error checking trial status for user {user_id}: {str(e)}")
            return {
                "success": False,
                "message": f"Error checking trial status: {str(e)}"
            }
    
    async def _deactivate_expired_trial(self, user_id: str) -> bool:
        """
        Deactivate an expired trial
        
        Args:
            user_id: The user's UUID
            
        Returns:
            True if deactivation was successful
        """
        try:
            logger.info(f"Deactivating expired trial for user {user_id}")
            
            result = self.supabase.table("profiles").update({
                "subscription_status": "expired",
                "subscription_plan": None,
                "subscription_end_date": None,
                "trial_expires_at": None,
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", user_id).execute()
            
            if result.data:
                logger.info(f"✅ Trial deactivated for user {user_id}")
                return True
            else:
                logger.error(f"Failed to deactivate trial for user {user_id}")
                return False
                
        except Exception as e:
            logger.error(f"Error deactivating trial for user {user_id}: {str(e)}")
            return False
    
    async def get_trial_info(self, user_id: str) -> Dict[str, Any]:
        """
        Get comprehensive trial information for a user
        
        Args:
            user_id: The user's UUID
            
        Returns:
            Dict containing detailed trial information
        """
        try:
            result = self.supabase.table("profiles").select("*").eq("id", user_id).execute()
            
            if not result.data:
                return {
                    "success": False,
                    "message": "User profile not found"
                }
            
            profile = result.data[0]
            subscription_status = profile.get("subscription_status", "inactive")
            
            trial_info = {
                "success": True,
                "user_id": user_id,
                "subscription_status": subscription_status,
                "subscription_plan": profile.get("subscription_plan"),
                "trial_active": subscription_status == "trial",
                "has_had_trial": profile.get("has_had_trial", False),
                "onboarding_completed": profile.get("onboarding_completed", False),
                "created_at": profile.get("created_at"),
                "updated_at": profile.get("updated_at")
            }
            
            # Always add trial-specific information if trial_expires_at exists (regardless of subscription_status)
            # This ensures we can show countdown timer even if user upgraded or trial expired
            trial_expires_at = profile.get("trial_expires_at")
            trial_activated_at = profile.get("trial_activated_at")
            
            if trial_expires_at or trial_activated_at:
                trial_info.update({
                    "trial_start": trial_activated_at,
                    "trial_end": trial_expires_at,
                    "trial_expires_at": trial_expires_at,  # Add this explicitly for frontend
                    "subscription_start_date": profile.get("subscription_start_date"),
                    "subscription_end_date": profile.get("subscription_end_date")
                })
                
                # Calculate days remaining if trial_expires_at exists
                if trial_expires_at:
                    try:
                        expires_datetime = datetime.fromisoformat(trial_expires_at.replace('Z', '+00:00'))
                        now = datetime.utcnow()
                        days_remaining = max(0, (expires_datetime - now).days)
                        trial_info["days_remaining"] = days_remaining
                        trial_info["trial_expired"] = now > expires_datetime
                    except Exception as e:
                        logger.error(f"Error calculating days remaining for user {user_id}: {e}")
                        trial_info["days_remaining"] = 0
                        trial_info["trial_expired"] = True
            
            return trial_info
            
        except Exception as e:
            logger.error(f"Error getting trial info for user {user_id}: {str(e)}")
            return {
                "success": False,
                "message": f"Error getting trial info: {str(e)}"
            }
    
    async def extend_trial(self, user_id: str, additional_days: int = 1) -> Dict[str, Any]:
        """
        Extend a trial by additional days (for admin use)
        
        Args:
            user_id: The user's UUID
            additional_days: Number of days to extend the trial
            
        Returns:
            Dict containing extension result
        """
        try:
            logger.info(f"Extending trial for user {user_id} by {additional_days} days")
            
            # Get current profile
            result = self.supabase.table("profiles").select("*").eq("id", user_id).execute()
            
            if not result.data:
                return {
                    "success": False,
                    "message": "User profile not found"
                }
            
            profile = result.data[0]
            current_status = profile.get("subscription_status", "inactive")
            
            if current_status != "trial":
                return {
                    "success": False,
                    "message": f"User is not on trial (current status: {current_status})"
                }
            
            # Calculate new expiration date
            current_expires_at = profile.get("trial_expires_at")
            if current_expires_at:
                expires_datetime = datetime.fromisoformat(current_expires_at.replace('Z', '+00:00'))
                new_expires_at = expires_datetime + timedelta(days=additional_days)
            else:
                # If no expiration date, set from now
                new_expires_at = datetime.utcnow() + timedelta(days=additional_days)
            
            # Update profile
            update_result = self.supabase.table("profiles").update({
                "trial_expires_at": new_expires_at.isoformat(),
                "subscription_end_date": new_expires_at.isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", user_id).execute()
            
            if update_result.data:
                logger.info(f"✅ Trial extended for user {user_id} until {new_expires_at.isoformat()}")
                return {
                    "success": True,
                    "message": f"Trial extended by {additional_days} days",
                    "new_expiration": new_expires_at.isoformat(),
                    "days_added": additional_days
                }
            else:
                return {
                    "success": False,
                    "message": "Failed to extend trial"
                }
                
        except Exception as e:
            logger.error(f"Error extending trial for user {user_id}: {str(e)}")
            return {
                "success": False,
                "message": f"Error extending trial: {str(e)}"
            }

# Create a global instance
trial_service = TrialService()

async def activate_user_trial(user_id: str, user_email: str, user_name: str) -> Dict[str, Any]:
    """Convenience function to activate a trial for a user"""
    return await trial_service.activate_trial(user_id, user_email, user_name)

async def check_user_trial_status(user_id: str) -> Dict[str, Any]:
    """Convenience function to check a user's trial status"""
    return await trial_service.check_trial_status(user_id)

async def get_user_trial_info(user_id: str) -> Dict[str, Any]:
    """Convenience function to get comprehensive trial information"""
    return await trial_service.get_trial_info(user_id)
