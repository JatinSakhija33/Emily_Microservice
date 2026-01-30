#!/usr/bin/env python3
"""
Trial Expiration Job
Scheduled job to check for and deactivate expired trials
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any

from services.trial_service import trial_service

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TrialExpirationJob:
    """
    Job to handle expired trial cleanup
    """
    
    def __init__(self):
        self.trial_service = trial_service
    
    async def check_expired_trials(self) -> Dict[str, Any]:
        """
        Check for and deactivate expired trials
        """
        try:
            logger.info("Starting expired trial check")
            
            # Get all users with trial status
            result = self.trial_service.supabase.table("profiles").select("*").eq("subscription_status", "trial").execute()
            
            if not result.data:
                logger.info("No trial users found")
                return {
                    "success": True,
                    "message": "No trial users found",
                    "expired_count": 0,
                    "processed_count": 0
                }
            
            expired_users = []
            processed_count = 0
            
            for profile in result.data:
                user_id = profile["id"]
                trial_expires_at = profile.get("trial_expires_at")
                
                if trial_expires_at:
                    expires_datetime = datetime.fromisoformat(trial_expires_at.replace('Z', '+00:00'))
                    now = datetime.utcnow()
                    
                    if now > expires_datetime:
                        # Trial has expired
                        logger.info(f"Trial expired for user {user_id}")
                        
                        # Deactivate trial
                        deactivation_success = await self.trial_service._deactivate_expired_trial(user_id)
                        
                        if deactivation_success:
                            expired_users.append({
                                "user_id": user_id,
                                "name": profile.get("name", "unknown"),
                                "expired_at": trial_expires_at,
                                "deactivated": True
                            })
                        else:
                            logger.error(f"Failed to deactivate trial for user {user_id}")
                            expired_users.append({
                                "user_id": user_id,
                                "name": profile.get("name", "unknown"),
                                "expired_at": trial_expires_at,
                                "deactivated": False
                            })
                
                processed_count += 1
            
            logger.info(f"Expired trial check completed. Processed {processed_count} users, {len(expired_users)} expired")
            
            return {
                "success": True,
                "message": f"Processed {processed_count} trial users",
                "expired_count": len(expired_users),
                "processed_count": processed_count,
                "expired_users": expired_users
            }
            
        except Exception as e:
            logger.error(f"Error checking expired trials: {str(e)}")
            return {
                "success": False,
                "message": f"Error checking expired trials: {str(e)}",
                "expired_count": 0,
                "processed_count": 0
            }
    
    async def get_trial_statistics(self) -> Dict[str, Any]:
        """
        Get statistics about current trials
        """
        try:
            # Get all trial users
            result = self.trial_service.supabase.table("profiles").select("*").eq("subscription_status", "trial").execute()
            
            if not result.data:
                return {
                    "success": True,
                    "total_trials": 0,
                    "active_trials": 0,
                    "expired_trials": 0,
                    "expiring_soon": 0
                }
            
            total_trials = len(result.data)
            active_trials = 0
            expired_trials = 0
            expiring_soon = 0
            
            now = datetime.utcnow()
            soon_threshold = now + timedelta(days=1)  # Expiring within 24 hours
            
            for profile in result.data:
                trial_expires_at = profile.get("trial_expires_at")
                
                if trial_expires_at:
                    expires_datetime = datetime.fromisoformat(trial_expires_at.replace('Z', '+00:00'))
                    
                    if now > expires_datetime:
                        expired_trials += 1
                    elif expires_datetime <= soon_threshold:
                        expiring_soon += 1
                    else:
                        active_trials += 1
                else:
                    # No expiration date, consider active
                    active_trials += 1
            
            return {
                "success": True,
                "total_trials": total_trials,
                "active_trials": active_trials,
                "expired_trials": expired_trials,
                "expiring_soon": expiring_soon,
                "checked_at": now.isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting trial statistics: {str(e)}")
            return {
                "success": False,
                "message": f"Error getting trial statistics: {str(e)}"
            }
    
    async def send_expiration_notifications(self) -> Dict[str, Any]:
        """
        Send notifications to users whose trials are expiring soon
        """
        try:
            logger.info("Checking for trials expiring soon")
            
            # Get all trial users
            result = self.trial_service.supabase.table("profiles").select("*").eq("subscription_status", "trial").execute()
            
            if not result.data:
                return {
                    "success": True,
                    "message": "No trial users found",
                    "notifications_sent": 0
                }
            
            notifications_sent = 0
            now = datetime.utcnow()
            expiration_threshold = now + timedelta(days=1)  # Notify 24 hours before expiration
            
            for profile in result.data:
                user_id = profile["id"]
                trial_expires_at = profile.get("trial_expires_at")
                
                if trial_expires_at:
                    expires_datetime = datetime.fromisoformat(trial_expires_at.replace('Z', '+00:00'))
                    
                    # Check if trial expires within 24 hours
                    if now < expires_datetime <= expiration_threshold:
                        logger.info(f"Sending expiration notification to user {user_id}")
                        
                        # Here you would integrate with your notification system
                        # For now, we'll just log it
                        notification_sent = await self._send_notification(
                            user_id=user_id,
                            name=profile.get("name"),
                            expires_at=trial_expires_at
                        )
                        
                        if notification_sent:
                            notifications_sent += 1
            
            logger.info(f"Sent {notifications_sent} expiration notifications")
            
            return {
                "success": True,
                "message": f"Sent {notifications_sent} expiration notifications",
                "notifications_sent": notifications_sent
            }
            
        except Exception as e:
            logger.error(f"Error sending expiration notifications: {str(e)}")
            return {
                "success": False,
                "message": f"Error sending expiration notifications: {str(e)}"
            }
    
    async def _send_notification(self, user_id: str, name: str, expires_at: str) -> bool:
        """
        Send notification to user about trial expiration
        """
        try:
            # This is where you would integrate with your notification system
            # For now, we'll just log the notification
            
            logger.info(f"NOTIFICATION: Trial expiring for {name} (ID: {user_id}) at {expires_at}")
            
            # You could integrate with:
            # - Email service (SendGrid, AWS SES, etc.)
            # - Push notifications
            # - In-app notifications
            # - SMS service
            
            return True
            
        except Exception as e:
            logger.error(f"Error sending notification to user {user_id}: {str(e)}")
            return False

# Create global instance
trial_expiration_job = TrialExpirationJob()

# Convenience functions
async def check_expired_trials() -> Dict[str, Any]:
    """Check for and deactivate expired trials"""
    return await trial_expiration_job.check_expired_trials()

async def get_trial_statistics() -> Dict[str, Any]:
    """Get trial statistics"""
    return await trial_expiration_job.get_trial_statistics()

async def send_expiration_notifications() -> Dict[str, Any]:
    """Send expiration notifications"""
    return await trial_expiration_job.send_expiration_notifications()

# Main function for running the job
async def main():
    """Main function to run the trial expiration job"""
    logger.info("Starting trial expiration job")
    
    # Check for expired trials
    expired_result = await check_expired_trials()
    logger.info(f"Expired trials check: {expired_result}")
    
    # Get statistics
    stats_result = await get_trial_statistics()
    logger.info(f"Trial statistics: {stats_result}")
    
    # Send notifications
    notification_result = await send_expiration_notifications()
    logger.info(f"Notifications: {notification_result}")
    
    logger.info("Trial expiration job completed")

if __name__ == "__main__":
    asyncio.run(main())
