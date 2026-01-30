from datetime import datetime, date
from supabase import create_client, Client
import logging

logger = logging.getLogger(__name__)

class CreditService:
    def __init__(self, supabase_url: str, supabase_key: str):
        self.supabase: Client = create_client(supabase_url, supabase_key)

    def get_user_limits(self, user_plan: str) -> dict:
        """Get credit limits for a user's plan"""
        limits = {
            'freemium': {'tasks': 100, 'images': 20},
            'starter': {'tasks': 1000, 'images': 200},
            'advanced': {'tasks': 5000, 'images': 800},
            'pro': {'tasks': -1, 'images': 1500},  # -1 = unlimited tasks
            'admin': {'tasks': -1, 'images': -1}  # Admin = unlimited everything
        }
        return limits.get(user_plan, limits['freemium'])

    def reset_monthly_usage_if_needed(self, user_id: str) -> bool:
        """Reset monthly usage if it's a new month"""
        try:
            result = self.supabase.table("profiles").select("current_month_start").eq("id", user_id).execute()
            if result.data:
                current_month_start = result.data[0]['current_month_start']
                today = date.today()

                # Check if we need to reset (new month)
                if current_month_start.month != today.month or current_month_start.year != today.year:
                    # Reset usage counters and update month start
                    self.supabase.table("profiles").update({
                        "tasks_completed_this_month": 0,
                        "images_generated_this_month": 0,
                        "current_month_start": today
                    }).eq("id", user_id).execute()
                    logger.info(f"Reset monthly usage for user {user_id}")
                    return True
        except Exception as e:
            logger.error(f"Error resetting monthly usage for user {user_id}: {e}")
        return False

    def check_usage_limits(self, user_id: str, user_plan: str, action_type: str) -> dict:
        """
        Check if user has exceeded their monthly limits

        Args:
            user_id: User ID
            user_plan: User's subscription plan
            action_type: 'task' or 'image'

        Returns:
            dict: {'allowed': bool, 'current': int, 'limit': int, 'exceeded': bool}
        """
        try:
            # Admin users have unlimited access
            if user_plan == 'admin':
                return {'allowed': True, 'current': 0, 'limit': -1, 'exceeded': False}

            # Reset usage if needed (new month)
            self.reset_monthly_usage_if_needed(user_id)

            # Get current usage
            result = self.supabase.table("profiles").select(
                "tasks_completed_this_month, images_generated_this_month"
            ).eq("id", user_id).execute()

            if not result.data:
                return {'allowed': False, 'current': 0, 'limit': 0, 'exceeded': True}

            usage = result.data[0]
            limits = self.get_user_limits(user_plan)

            if action_type == 'task':
                current = usage['tasks_completed_this_month'] or 0
                limit = limits['tasks']
            elif action_type == 'image':
                current = usage['images_generated_this_month'] or 0
                limit = limits['images']
            else:
                return {'allowed': False, 'current': 0, 'limit': 0, 'exceeded': True}

            # Pro plan has unlimited tasks
            if limit == -1:
                return {'allowed': True, 'current': current, 'limit': -1, 'exceeded': False}

            exceeded = current >= limit
            return {
                'allowed': not exceeded,
                'current': current,
                'limit': limit,
                'exceeded': exceeded
            }

        except Exception as e:
            logger.error(f"Error checking usage limits for user {user_id}: {e}")
            return {'allowed': False, 'current': 0, 'limit': 0, 'exceeded': True}

    def increment_usage(self, user_id: str, action_type: str) -> bool:
        """Increment usage counter for user"""
        try:
            field = 'tasks_completed_this_month' if action_type == 'task' else 'images_generated_this_month'

            result = self.supabase.table("profiles").select(field).eq("id", user_id).execute()
            if result.data:
                current = result.data[0][field] or 0
                self.supabase.table("profiles").update({
                    field: current + 1
                }).eq("id", user_id).execute()
                return True
        except Exception as e:
            logger.error(f"Error incrementing usage for user {user_id}: {e}")
        return False

    def get_usage_stats(self, user_id: str, user_plan: str) -> dict:
        """Get current usage statistics for user"""
        try:
            logger.info(f"Getting usage stats for user {user_id} with plan: {user_plan}")

            # Admin users have unlimited access but we still track their usage
            if user_plan == 'admin':
                logger.info(f"User {user_id} is admin, fetching actual usage with unlimited limits")
                result = self.supabase.table("profiles").select(
                    "tasks_completed_this_month, images_generated_this_month, current_month_start"
                ).eq("id", user_id).execute()

                if result.data:
                    usage = result.data[0]
                    return {
                        'tasks_used': usage['tasks_completed_this_month'] or 0,
                        'tasks_limit': -1,
                        'images_used': usage['images_generated_this_month'] or 0,
                        'images_limit': -1,
                        'month_start': usage['current_month_start']
                    }
                else:
                    # Fallback if no data found
                    return {
                        'tasks_used': 0,
                        'tasks_limit': -1,
                        'images_used': 0,
                        'images_limit': -1,
                        'month_start': date.today()
                    }

            result = self.supabase.table("profiles").select(
                "tasks_completed_this_month, images_generated_this_month, current_month_start"
            ).eq("id", user_id).execute()

            if result.data:
                usage = result.data[0]
                limits = self.get_user_limits(user_plan)

                logger.info(f"User {user_id} limits for plan {user_plan}: {limits}")

                return {
                    'tasks_used': usage['tasks_completed_this_month'] or 0,
                    'tasks_limit': limits['tasks'],
                    'images_used': usage['images_generated_this_month'] or 0,
                    'images_limit': limits['images'],
                    'month_start': usage['current_month_start']
                }
        except Exception as e:
            logger.error(f"Error getting usage stats for user {user_id}: {e}")

        return {
            'tasks_used': 0,
            'tasks_limit': 100,
            'images_used': 0,
            'images_limit': 20,
            'month_start': date.today()
        }
