from fastapi import HTTPException
from services.credit_service import CreditService
import os
import logging

logger = logging.getLogger(__name__)

async def check_credits_before_action(user_id: str, action_type: str) -> dict:
    """Check if user can perform an action based on their credits"""

    credit_service = CreditService(
        supabase_url=os.getenv("SUPABASE_URL"),
        supabase_key=os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )

    # Get user's subscription plan
    try:
        result = credit_service.supabase.table("profiles").select("subscription_plan").eq("id", user_id).execute()
        if result.data:
            user_plan = result.data[0].get('subscription_plan', 'freemium')
        else:
            user_plan = 'freemium'
    except Exception as e:
        logger.error(f"Error getting user plan for {user_id}: {e}")
        user_plan = 'freemium'

    # Check usage limits
    limits_check = credit_service.check_usage_limits(user_id, user_plan, action_type)

    if not limits_check['allowed']:
        raise HTTPException(
            status_code=402,  # Payment Required
            detail={
                "error": "Credit limit exceeded",
                "type": action_type,
                "current": limits_check['current'],
                "limit": limits_check['limit'],
                "message": f"You've exceeded your monthly {action_type} limit ({limits_check['current']}/{limits_check['limit']}). Please upgrade your plan to continue."
            }
        )

    return limits_check

async def increment_usage_after_action(user_id: str, action_type: str):
    """Increment usage counter after successful action"""
    try:
        credit_service = CreditService(
            supabase_url=os.getenv("SUPABASE_URL"),
            supabase_key=os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        )
        credit_service.increment_usage(user_id, action_type)
    except Exception as e:
        logger.error(f"Error incrementing usage for user {user_id}: {e}")
        # Don't raise exception here - action was successful, just logging failed

