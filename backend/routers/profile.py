"""
Profile API endpoints
Handles profile-related operations including usage tracking
"""

import os
import json
import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from supabase import create_client, Client

import openai
from dotenv import load_dotenv

from routers.connections import get_current_user, User

# Configure logging
load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/profile", tags=["profile"])

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not supabase_url or not supabase_service_key:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")

supabase_client: Client = create_client(supabase_url, supabase_service_key)

openai_api_key = os.getenv("OPENAI_API_KEY")
openai_client = openai.OpenAI(api_key=openai_api_key) if openai_api_key else None

@router.get("/usage-counts")
async def get_usage_counts(current_user: User = Depends(get_current_user)):
    """Get current month's usage counts for tasks and images"""
    try:
        user_id = current_user.id

        # Simple direct query to get usage counts
        response = supabase_client.table('profiles').select('tasks_completed_this_month, images_generated_this_month').eq('id', user_id).execute()

        if response.data and len(response.data) > 0:
            profile = response.data[0]
            return {
                "tasks_count": profile.get('tasks_completed_this_month', 0),
                "images_count": profile.get('images_generated_this_month', 0)
            }
        else:
            logger.warning(f"No profile found for user {user_id}")
            return {
                "tasks_count": 0,
                "images_count": 0
            }

    except Exception as e:
        logger.error(f"Error fetching usage counts for user {current_user.id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching usage counts: {str(e)}")

@router.post("/agents/{agent_name}/like")
async def increment_agent_likes(agent_name: str, current_user: User = Depends(get_current_user)):
    """Increment the likes count for a specific agent"""
    try:
        # Validate agent name
        valid_agents = ['emily', 'leo', 'chase', 'atsn']
        if agent_name.lower() not in valid_agents:
            raise HTTPException(status_code=400, detail=f"Invalid agent name. Must be one of: {', '.join(valid_agents)}")

        # First get current likes count
        current_response = supabase_client.table('agent_profiles').select('likes_count').eq('agent_name', agent_name.lower()).execute()

        if not current_response.data or len(current_response.data) == 0:
            raise HTTPException(status_code=404, detail=f"Agent {agent_name} not found")

        current_likes = current_response.data[0]['likes_count'] or 0

        # Increment likes count
        response = supabase_client.table('agent_profiles').update({
            'likes_count': current_likes + 1
        }).eq('agent_name', agent_name.lower()).execute()

        if not response.data:
            raise HTTPException(status_code=500, detail="Failed to update likes count")

        logger.info(f"Incremented likes count for agent {agent_name} by user {current_user.id} (from {current_likes} to {current_likes + 1})")
        return {"success": True, "agent_name": agent_name, "new_likes_count": current_likes + 1}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error incrementing likes for agent {agent_name}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error incrementing likes count: {str(e)}")

@router.get("/usage-stats")
async def get_usage_stats(current_user: User = Depends(get_current_user)):
    """Get user's current usage statistics"""
    try:
        from services.credit_service import CreditService

        credit_service = CreditService(
            supabase_url=os.getenv("SUPABASE_URL"),
            supabase_key=os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        )

        # Get user's plan directly from profiles table
        result = supabase_client.table("profiles").select("subscription_plan").eq("id", current_user.id).execute()

        if not result.data:
            logger.warning(f"No profile data found for user {current_user.id}")
            user_plan = 'freemium'
        else:
            user_plan = result.data[0].get('subscription_plan')
            if user_plan is None or user_plan == '':
                logger.warning(f"User {current_user.id} has null/empty subscription_plan, defaulting to freemium")
                user_plan = 'freemium'

        # Strip whitespace and convert to lowercase for case-insensitive matching
        user_plan_lower = user_plan.strip().lower() if isinstance(user_plan, str) else 'freemium'

        logger.info(f"User {current_user.id} has subscription_plan: '{user_plan}' (stripped+lowercase: '{user_plan_lower}')")

        # Map database plan names to our credit service plan names (case-insensitive)
        plan_mapping = {
            'starter': 'starter',
            'free_trial': 'freemium',  # Map free_trial to freemium for credit limits
            'pro': 'pro',
            'admin': 'admin',
            'advanced': 'advanced'
        }
        credit_plan = plan_mapping.get(user_plan_lower, 'freemium')

        logger.info(f"Mapped '{user_plan}' (stripped+lowercase: '{user_plan_lower}') to credit_plan: '{credit_plan}'")

        usage_stats = credit_service.get_usage_stats(current_user.id, credit_plan)

        # Add the actual database plan name to the response
        usage_stats['subscription_plan'] = user_plan.strip() if isinstance(user_plan, str) else user_plan
        usage_stats['debug_info'] = {
            'raw_plan': user_plan,
            'stripped_plan': user_plan.strip() if isinstance(user_plan, str) else user_plan,
            'lowercase_plan': user_plan_lower,
            'mapped_plan': credit_plan
        }

        logger.info(f"Returning usage stats for user {current_user.id}: {usage_stats}")

        return usage_stats

    except Exception as e:
        logger.error(f"Error getting usage stats for user {current_user.id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching usage stats: {str(e)}")


def build_profile_embedding_text(profile: dict) -> str:
    if not isinstance(profile, dict):
        return ""

    skip_keys = {"id", "profile_embedding", "created_at", "updated_at"}
    pieces = []
    for key, value in profile.items():
        if key in skip_keys:
            continue
        if value is None:
            continue
        if isinstance(value, (list, dict)):
            try:
                pieces.append(json.dumps(value, ensure_ascii=False, separators=(",", ":")))
            except Exception:
                pieces.append(str(value))
        else:
            pieces.append(str(value))

    return "\n".join(pieces).strip()


@router.post("/refresh-embeddings")
async def refresh_profile_embeddings(
    limit: int = Query(100, gt=0, le=500)
):
    """Generate embeddings for all profiles and store them in profiles.profile_embedding."""
    if not openai_client:
        raise HTTPException(status_code=500, detail="OpenAI API key is not configured")

    total_processed = 0
    errors = []
    offset = 0

    logger.info("Starting profile embedding refresh")
    logger.info(f"Chunk size set to {limit}")

    while True:
        response = supabase_client.table("profiles").select("*").range(offset, offset + limit - 1).execute()
        profiles = response.data or []

        if not profiles:
            logger.info("No more profiles fetched; ending loop")
            break

        logger.info(f"Fetched {len(profiles)} profiles starting at offset {offset}")

        for profile in profiles:
            profile_id = profile.get("id")
            text = build_profile_embedding_text(profile)
            if not text:
                logger.info(f"Skipping profile {profile_id} because there is no textual data to embed")
                continue

            try:
                embedding_response = openai_client.embeddings.create(
                    model="text-embedding-3-small",
                    input=text
                )

                vector = embedding_response.data[0].embedding
                supabase_client.table("profiles").update({
                    "profile_embedding": vector
                }).eq("id", profile_id).execute()

                total_processed += 1
            except Exception as exc:
                logger.error(f"Failed to embed profile {profile_id}: {exc}", exc_info=True)
                errors.append({"id": profile_id, "error": str(exc)})

        if len(profiles) < limit:
            logger.info("Final batch processed")
            break
        offset += limit
        logger.info(f"Moving to next batch with offset {offset}")

    return {
        "success": True,
        "profiles_processed": total_processed,
        "errors": errors
    }

