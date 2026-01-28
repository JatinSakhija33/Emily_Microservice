"""
Create Calendar Functions - Extracted from ATSN Agent
Contains construct, complete, and handle functions for calendar creation.
"""

import os
import logging
import re
import uuid
import json
import asyncio
import aiohttp
from typing import Dict, Any, List
from datetime import datetime, timedelta, date
import google.generativeai as genai
import openai
import httpx
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment
load_dotenv()

# Configure logging
logger = logging.getLogger(__name__)

# Initialize Supabase client
supabase_url = os.getenv('SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
supabase = create_client(supabase_url, supabase_key) if supabase_url and supabase_key else None

# Initialize OpenAI client
openai_api_key = os.getenv('OPENAI_API_KEY')
openai_client = openai.OpenAI(api_key=openai_api_key) if openai_api_key else None

# Grok API configuration (using direct API calls like in atsn.py)
grok_api_key = os.getenv('GROK_API_KEY')
grok_api_url = os.getenv('GROK_API_URL', 'https://api.x.ai/v1/chat/completions')
grok_model = os.getenv('GROK_MODEL', 'grok-4-1-fast-non-reasoning')

# Configure Gemini
genai.configure(api_key=os.getenv('GEMINI_API_KEY'))

# ==================== CONSTANTS ====================

JSON_ONLY_INSTRUCTION = """

CRITICAL: You MUST respond with ONLY a valid JSON object. Do NOT include any explanatory text, comments, or additional text before or after the JSON.
Your response must start with { and end with }. No other text is allowed.
Return ONLY the JSON object, nothing else."""

FIELD_CLARIFICATIONS = {
    "create_calendar": {
        "channel": {
            "question": "I'd be happy to create a content calendar for you! 📅\n\nWhich platform would you like to focus on?",
            "options": [
                {"label": "Instagram", "value": "instagram"},
                {"label": "Facebook", "value": "facebook"},
                {"label": "YouTube", "value": "youtube"},
                {"label": "LinkedIn", "value": "linkedin"}
            ]
        },
        "post_frequency": {
            "question": "Great! How often would you like to post on this platform?",
            "options": [
                {"label": "Daily (7 posts/week)", "value": "daily"},
                {"label": "Three times a week", "value": "three_times_week"},
                {"label": "Two times a week", "value": "two_times_week"},
                {"label": "Weekly (1 post/week)", "value": "weekly"},
                {"label": "Bi-weekly (every 2 weeks)", "value": "bi_weekly"}
            ]
        },
        "confirm_generation": {
            "question": "Perfect! I'll create a fresh calendar for this month based on current trends. This will include unique topics that haven't been used in your previous calendars.\n\nReady to generate your calendar?",
            "options": [
                {"label": "Yes, create my calendar", "value": "yes"},
                {"label": "No, let me think about it", "value": "no"}
            ]
        }
    }
}

# Platform-specific content configurations
PLATFORM_CONFIGS = {
    "instagram": {
        "content_types": ["static_post", "reel", "carousel", "story"],
        "description": "Instagram calendar with reels, static posts, carousels, and trending formats"
    },
    "facebook": {
        "content_types": ["static_post", "carousel", "video"],
        "description": "Facebook calendar with posts, carousels, and videos"
    },
    "youtube": {
        "content_types": ["video"],
        "description": "YouTube calendar focused on video content"
    },
    "linkedin": {
        "content_types": ["static_post", "carousel", "article"],
        "description": "LinkedIn calendar with professional posts, carousels, and articles"
    }
}

# RL Agent value mappings based on content type and platform
RL_AGENT_MAPPINGS = {
    "instagram": {
        "static_post": {
            "hook_type": ["question", "statement", "how_to", "story"],
            "hook_length": ["short", "medium"],
            "tone": ["casual", "inspirational", "humorous"],
            "creativity": ["medium", "high"],
            "text_in_image": ["overlay", "caption", "minimal"],
            "visual_style": ["vibrant", "clean", "bold", "minimalist"]
        },
        "reel": {
            "hook_type": ["question", "statement", "how_to"],
            "hook_length": ["short"],
            "tone": ["casual", "inspirational", "humorous"],
            "creativity": ["high"],
            "text_in_image": ["overlay", "minimal"],
            "visual_style": ["vibrant", "bold", "clean"]
        },
        "carousel": {
            "hook_type": ["list", "how_to", "comparison"],
            "hook_length": ["medium", "long"],
            "tone": ["educational", "casual", "professional"],
            "creativity": ["medium", "high"],
            "text_in_image": ["caption", "overlay", "minimal"],
            "visual_style": ["clean", "minimalist", "bold"]
        },
        "story": {
            "hook_type": ["question", "statement"],
            "hook_length": ["short"],
            "tone": ["casual", "inspirational"],
            "creativity": ["medium", "high"],
            "text_in_image": ["overlay", "minimal"],
            "visual_style": ["vibrant", "bold", "clean"]
        }
    },
    "facebook": {
        "static_post": {
            "hook_type": ["question", "statement", "story", "how_to"],
            "hook_length": ["medium"],
            "tone": ["casual", "professional", "inspirational"],
            "creativity": ["medium"],
            "text_in_image": ["caption", "none", "overlay"],
            "visual_style": ["clean", "professional", "vibrant"]
        },
        "carousel": {
            "hook_type": ["list", "how_to", "comparison"],
            "hook_length": ["medium", "long"],
            "tone": ["educational", "casual"],
            "creativity": ["medium"],
            "text_in_image": ["caption", "overlay"],
            "visual_style": ["clean", "minimalist"]
        },
        "video": {
            "hook_type": ["question", "statement", "story"],
            "hook_length": ["medium"],
            "tone": ["casual", "professional"],
            "creativity": ["medium", "high"],
            "text_in_image": ["overlay", "caption"],
            "visual_style": ["clean", "vibrant"]
        }
    },
    "youtube": {
        "video": {
            "hook_type": ["question", "how_to", "statement", "story"],
            "hook_length": ["medium", "long"],
            "tone": ["educational", "professional", "casual"],
            "creativity": ["high", "medium"],
            "text_in_image": ["minimal", "overlay", "caption"],
            "visual_style": ["professional", "clean", "bold"]
        }
    },
    "linkedin": {
        "static_post": {
            "hook_type": ["statement", "question", "story", "how_to"],
            "hook_length": ["medium", "long"],
            "tone": ["professional", "educational"],
            "creativity": ["medium"],
            "text_in_image": ["none", "caption", "minimal"],
            "visual_style": ["professional", "clean", "minimalist"]
        },
        "carousel": {
            "hook_type": ["list", "comparison", "how_to"],
            "hook_length": ["medium", "long"],
            "tone": ["professional", "educational"],
            "creativity": ["medium"],
            "text_in_image": ["caption", "minimal"],
            "visual_style": ["professional", "clean"]
        },
        "article": {
            "hook_type": ["statement", "question", "story"],
            "hook_length": ["long"],
            "tone": ["professional", "educational"],
            "creativity": ["medium"],
            "text_in_image": ["minimal", "none"],
            "visual_style": ["professional", "clean"]
        }
    }
}

# ==================== FUNCTIONS ====================

async def get_trends_from_grok(industry: str, month: str, year: str) -> List[str]:
    """Get current trending topics from Grok API for calendar generation"""
    if not grok_api_key:
        logger.warning("Grok API key not available, using fallback trends")
        return [
            "industry_news", "customer_stories", "behind_scenes",
            "tips_and_tricks", "product_updates", "community_engagement"
        ]

    try:
        prompt = f"""You are a social media trend analyst. What are the top 10 trending topics and content ideas for the {industry} industry in {month} {year}?

        Focus on:
        - Current news and developments
        - Seasonal content opportunities
        - Popular discussion topics
        - Content formats that are performing well

        Return ONLY a JSON array of strings, no other text. Example: ["topic1", "topic2", "topic3"]"""

        async with aiohttp.ClientSession() as session:
            headers = {
                'Authorization': f'Bearer {grok_api_key}',
                'Content-Type': 'application/json'
            }

            payload = {
                'model': grok_model,
                'messages': [{'role': 'user', 'content': prompt}],
                'max_tokens': 500,
                'temperature': 0.7
            }

            async with session.post(grok_api_url, json=payload, headers=headers) as response:
                if response.status == 200:
                    result = await response.json()
                    content = result['choices'][0]['message']['content'].strip()

                    # Clean JSON response
                    if content.startswith('```json'):
                        content = content[7:]
                    if content.endswith('```'):
                        content = content[:-3]
                    content = content.strip()

                    trends = json.loads(content)
                    logger.info(f"✅ Got {len(trends)} trends from Grok for {industry}")
                    return trends[:10]  # Limit to top 10
                else:
                    logger.error(f"Grok API error: {response.status} - {await response.text()}")
                    return [
                        "industry_news", "customer_stories", "behind_scenes",
                        "tips_and_tricks", "product_updates", "community_engagement"
                    ]

    except Exception as e:
        logger.error(f"Failed to get trends from Grok: {e}")
        return [
            "industry_news", "customer_stories", "behind_scenes",
            "tips_and_tricks", "product_updates", "community_engagement"
        ]


async def get_important_dates_from_grok(industry: str, month: str, year: str) -> List[Dict]:
    """Get important dates and events from Grok API for calendar planning"""
    if not grok_api_key:
        logger.warning("Grok API key not available, using fallback dates")
        return []

    try:
        prompt = f"""You are a calendar planning expert. What are the important dates, holidays, and industry events for {industry} industry in {month} {year}?

        Include:
        - Major holidays
        - Industry conferences or events
        - Product launch seasons
        - Awareness months/campaigns
        - Seasonal shopping periods
        - Industry-specific dates

        Return ONLY a JSON array of objects with this format:
        [
            {{
                "date": "YYYY-MM-DD",
                "event": "Event Name",
                "type": "holiday|conference|seasonal|industry",
                "description": "Brief description"
            }}
        ]

        Only include events that would be relevant for content planning."""

        async with aiohttp.ClientSession() as session:
            headers = {
                'Authorization': f'Bearer {grok_api_key}',
                'Content-Type': 'application/json'
            }

            payload = {
                'model': grok_model,
                'messages': [{'role': 'user', 'content': prompt}],
                'max_tokens': 800,
                'temperature': 0.6
            }

            async with session.post(grok_api_url, json=payload, headers=headers) as response:
                if response.status == 200:
                    result = await response.json()
                    content = result['choices'][0]['message']['content'].strip()

                    # Clean JSON response
                    if content.startswith('```json'):
                        content = content[7:]
                    if content.endswith('```'):
                        content = content[:-3]
                    content = content.strip()

                    important_dates = json.loads(content)
                    logger.info(f"✅ Got {len(important_dates)} important dates from Grok for {month} {year}")
                    return important_dates
                else:
                    logger.error(f"Grok API error: {response.status} - {await response.text()}")
                    return []

    except Exception as e:
        logger.error(f"Failed to get important dates from Grok: {e}")
        return []

def construct_create_calendar_payload(state) -> Any:
    """Construct payload for create calendar task"""

    # Use user_query which contains the full conversation context
    conversation = state.user_query

    prompt = f"""You are extracting information to create a social media content calendar. Be EXTREMELY STRICT and CONSERVATIVE in your extraction.

CRITICAL PRINCIPLES:
1. ONLY extract information that is EXPLICITLY and CLEARLY stated
2. NEVER infer, assume, or extrapolate information
3. If uncertain about any field, set it to null
4. Quality over quantity - better to ask questions than make wrong assumptions

EXTRACTION RULES:

channel:
- ONLY extract if user explicitly names exactly one of: "instagram", "facebook", "youtube", "linkedin"
- Case insensitive - convert to lowercase
- If multiple platforms mentioned, set to null (ask user to choose)
- Otherwise: null

post_frequency:
- ONLY extract if user explicitly uses these exact patterns:
  * "daily" → "daily"
  * "three times a week" or "3 times a week" → "three_times_week"
  * "two times a week" or "2 times a week" → "two_times_week"
  * "weekly" or "once a week" → "weekly"
  * "bi weekly" or "bi-weekly" or "every two weeks" → "bi_weekly"
- Generic terms like "often", "regularly", "frequently" are NOT sufficient
- Otherwise: null

confirm_generation:
- Set to "yes" ONLY if user explicitly confirms they want to generate/create the calendar
- Set to "no" ONLY if user explicitly says they don't want to generate or want to cancel
- Otherwise: null

VALIDATION CHECKLIST:
□ Is every field either properly extracted or null?
□ Is channel an exact match from allowed values?
□ Is post_frequency based on explicit user wording?
□ Is confirm_generation only set when user clearly states intent?

If ANY doubt exists, set the uncertain field(s) to null.

User conversation:
{conversation}

Return a JSON object with exactly this structure:
{{
    "channel": "instagram" | "facebook" | "youtube" | "linkedin" | null,
    "post_frequency": "daily" | "three_times_week" | "two_times_week" | "weekly" | "bi_weekly" | null,
    "confirm_generation": "yes" | "no" | null
}}

IMPORTANT: Return ONLY the JSON object, no additional text or explanation.
{JSON_ONLY_INSTRUCTION}"""

    # Import _extract_payload from atsn
    from .atsn import _extract_payload
    return _extract_payload(state, prompt)


def complete_create_calendar_payload(state) -> Any:
    """Complete create_calendar payload"""

    # Import required functions
    from .atsn import generate_clarifying_question

    # Define the clarification flow order
    clarification_flow = ["channel", "post_frequency", "confirm_generation"]

    # Build required fields list
    required_fields = []

    for field in clarification_flow:
        # Check if field is missing or empty
        if field not in state.payload or state.payload.get(field) is None or not state.payload.get(field):
            required_fields.append(field)

    clarifications = FIELD_CLARIFICATIONS.get("create_calendar", {})

    if not required_fields:
        state.payload_complete = True
        state.current_step = "action_execution"
        print("✅ Create calendar payload complete")
        return state

    next_field = required_fields[0]
    clarification_data = clarifications.get(next_field, {})

    # Calculate remaining questions count
    remaining_questions = len(required_fields)

    if isinstance(clarification_data, dict):
        base_question = clarification_data.get("question", f"Please provide: {next_field.replace('_', ' ')}")

        # Generate personalized question using LLM
        logger.info(f"Calling LLM for clarification question. Base: '{base_question}', User context length: {len(state.user_query or '')}")
        personalized_question = generate_clarifying_question(
            base_question=base_question,
            user_context=state.user_query,
            user_input=state.user_query.split('\n')[-1] if state.user_query else ""
        )
        logger.info(f"LLM returned: '{personalized_question}'")

        state.clarification_question = personalized_question
        state.clarification_options = clarification_data.get("options", [])
    else:
        # Backward compatibility for string clarifications
        state.clarification_question = clarification_data or f"Please provide: {next_field.replace('_', ' ')}"
        state.clarification_options = []

    state.waiting_for_user = True
    state.current_step = "waiting_for_clarification"
    print(f"? Clarification needed for create_calendar: {state.clarification_question}")

    return state


async def handle_create_calendar(state) -> Any:
    """Generate and create social media calendar"""

    # Import required functions
    from .atsn import (
        get_business_context_from_profile,
        generate_personalized_message,
    )

    payload = state.payload

    if not state.payload_complete:
        state.error = "Payload is not complete"
        return state

    # Check if user confirmed generation
    if payload.get('confirm_generation') != 'yes':
        state.result = "Calendar generation cancelled. Let me know when you're ready to create your calendar!"
        return state

    try:
        # Get current month and year for calendar generation
        current_date = datetime.now()
        target_month = current_date.month
        target_year = current_date.year

        # Calculate calendar date range
        calendar_start = date(target_year, target_month, 1)
        if target_month == 12:
            calendar_end = date(target_year + 1, 1, 1) - timedelta(days=1)
        else:
            calendar_end = date(target_year, target_month + 1, 1) - timedelta(days=1)

        logger.info(f"📅 Generating calendar for {calendar_start.strftime('%B %Y')}")

        # Load business context from profile
        business_context = {}
        if state.user_id:
            try:
                profile_response = supabase.table("profiles").select("*").eq("id", state.user_id).execute()
                if profile_response.data and len(profile_response.data) > 0:
                    profile_data = profile_response.data[0]
                    business_context = get_business_context_from_profile(profile_data)
                    logger.info(f"✅ Loaded business context for: {business_context.get('business_name', 'Business')}")
                else:
                    business_context = get_business_context_from_profile({})
            except Exception as e:
                logger.error(f"Failed to load business context: {e}")
                business_context = get_business_context_from_profile({})
        else:
            business_context = get_business_context_from_profile({})

        # Get existing calendar data to avoid topic duplication
        existing_topics = get_existing_calendar_topics(state.user_id, target_month, target_year, payload['channel'])
        logger.info(f"📋 Found {len(existing_topics)} existing topics to avoid duplication")

        # Calculate posting schedule based on frequency
        posting_dates = calculate_posting_schedule(payload['post_frequency'], calendar_start, calendar_end)
        logger.info(f"📅 Calculated {len(posting_dates)} posting dates for {payload['post_frequency']} frequency")

        # Generate calendar entries using LLM
        calendar_entries = await generate_calendar_entries_with_llm(
            platform=payload['channel'],
            posting_dates=posting_dates,
            business_context=business_context,
            existing_topics=existing_topics,
            user_id=state.user_id
        )

        if not calendar_entries:
            state.error = "Failed to generate calendar entries"
            state.result = "Sorry, I couldn't generate your calendar right now. Please try again."
            return state

        # Check if calendar already exists for this month/platform and delete old entries
        delete_existing_calendar(state.user_id, target_month, target_year, payload['channel'])

        # Save calendar to database
        calendar_id = save_calendar_to_database(
            user_id=state.user_id,
            calendar_month=target_month,
            calendar_year=target_year,
            platform=payload['channel'],
            frequency=payload['post_frequency'],
            business_context=business_context,
            calendar_entries=calendar_entries
        )

        if not calendar_id:
            state.error = "Failed to save calendar"
            state.result = "Sorry, I couldn't save your calendar. Please try again."
            return state

        # Create calendar_items for frontend display (structured data)
        calendar_items = []
        for i, entry in enumerate(calendar_entries, 1):
            date_obj = datetime.fromisoformat(entry['entry_date'])
            date_display = date_obj.strftime('%B %d, %Y')

            calendar_item = {
                'id': i,
                'entry_id': f"{calendar_id}_{i}",
                'calendar_id': calendar_id,
                'entry_date': entry['entry_date'],
                'date_display': date_display,
                'content_type': entry['content_type'],
                'content_theme': entry['content_theme'],
                'topic': entry['topic'],
                'platform': entry['platform'],
                'hook_type': entry.get('hook_type'),
                'hook_length': entry.get('hook_length'),
                'tone': entry.get('tone'),
                'creativity': entry.get('creativity'),
                'text_in_image': entry.get('text_in_image'),
                'visual_style': entry.get('visual_style'),
                'status': entry.get('status', 'draft'),
                # Add emojis and formatted display fields
                'content_type_emoji': {
                    'static_post': '📝',
                    'reel': '🎬',
                    'carousel': '📸',
                    'video': '🎥',
                    'story': '📖',
                    'article': '📄'
                }.get(entry['content_type'], '📝'),
                'platform_emoji': {
                    'instagram': '📸',
                    'facebook': '👥',
                    'youtube': '🎥',
                    'linkedin': '💼'
                }.get(entry['platform'], '📱'),
                'metadata': {},
                'raw_data': entry
            }
            calendar_items.append(calendar_item)

        # Store calendar data for frontend
        state.calendar_id = calendar_id
        state.calendar_entries = calendar_items  # Use structured items for frontend
        state.calendar_month = target_month
        state.calendar_year = target_year

        # Format response with summary
        result_message = format_calendar_summary(
            calendar_entries=calendar_entries,
            platform=payload['channel'],
            frequency=payload['post_frequency'],
            month_name=calendar_start.strftime('%B %Y'),
            total_entries=len(calendar_entries)
        )

        state.result = generate_personalized_message(
            base_message=result_message,
            user_context=state.user_query,
            message_type="success"
        )

        logger.info(f"✅ Successfully created calendar with {len(calendar_entries)} entries for {payload['channel']}")

    except Exception as e:
        error_msg = f"Failed to create calendar: {str(e)}"
        state.error = error_msg
        state.result = f"Error: {error_msg}\n\nPlease try again or contact support if the issue persists."
        logger.error(f"Database/calendar generation failed: {str(e)}", exc_info=True)

    return state


# ==================== HELPER FUNCTIONS ====================

def delete_existing_calendar(user_id: str, month: int, year: int, platform: str):
    """Delete existing calendar and entries for the given month/platform/year combination only"""
    try:
        if not supabase:
            logger.warning("Supabase not available for deleting existing calendar")
            return

        # Calculate the first day of the month for the database query
        first_day_of_month = date(year, month, 1).isoformat()

        # Find existing calendar for this user/month/year/platform combination
        # IMPORTANT: Only delete if the exact same platform is being regenerated
        calendar_response = supabase.table('social_media_calendars').select('id').eq('user_id', user_id).eq('calendar_month', first_day_of_month).eq('calendar_year', year).eq('platform', platform).execute()

        if calendar_response.data and len(calendar_response.data) > 0:
            calendar_id = calendar_response.data[0]['id']
            logger.info(f"🗑️ Found existing calendar {calendar_id} for user {user_id}, month {month}/{year}, platform {platform} - Deleting to regenerate")

            # Delete calendar entries first (due to foreign key constraint)
            entries_delete = supabase.table('calendar_entries').delete().eq('calendar_id', calendar_id).execute()
            logger.info(f"✅ Deleted {len(entries_delete.data) if entries_delete.data else 0} calendar entries for platform {platform}")

            # Delete the calendar record
            calendar_delete = supabase.table('social_media_calendars').delete().eq('id', calendar_id).execute()
            logger.info(f"✅ Deleted calendar record {calendar_id} for platform {platform}")

        else:
            logger.info(f"ℹ️ No existing calendar found for user {user_id}, month {month}/{year}, platform {platform} - Creating new")

    except Exception as e:
        logger.error(f"Failed to delete existing calendar: {e}")


def get_existing_calendar_topics(user_id: str, month: int, year: int, platform: str = None) -> List[str]:
    """Get topics from existing calendars to avoid duplication"""
    try:
        if not supabase:
            return []

        # Get all calendar entries for this user, optionally filtered by platform
        query = supabase.table('calendar_entries').select('topic')

        # Join with calendar table to get platform information if needed
        if platform:
            # Get calendar IDs for this user and platform
            calendar_response = supabase.table('social_media_calendars').select('id').eq('user_id', user_id).execute()
            if calendar_response.data:
                calendar_ids = [cal['id'] for cal in calendar_response.data]
                if calendar_ids:
                    query = query.in_('calendar_id', calendar_ids)

        response = query.execute()

        existing_topics = []
        if response.data:
            existing_topics = [entry['topic'] for entry in response.data if entry.get('topic')]

        logger.info(f"Found {len(existing_topics)} existing topics to avoid duplication")
        return existing_topics
    except Exception as e:
        logger.warning(f"Failed to get existing topics: {e}")
        return []


def calculate_posting_schedule(frequency: str, start_date: date, end_date: date) -> List[date]:
    """Calculate optimal posting dates based on frequency"""
    dates = []

    frequency_map = {
        'daily': 1,
        'three_times_week': 2.33,  # Average days between posts
        'two_times_week': 3.5,
        'weekly': 7,
        'bi_weekly': 14
    }

    interval_days = frequency_map.get(frequency, 7)

    current_date = start_date
    while current_date <= end_date:
        # Skip weekends for business platforms (optional - could be configurable)
        if current_date.weekday() < 5:  # Monday-Friday
            dates.append(current_date)

        # Move to next posting date
        if frequency == 'three_times_week':
            # Distribute roughly evenly across week
            current_date += timedelta(days=2)  # Every 2-3 days pattern
        else:
            current_date += timedelta(days=int(interval_days))

    return dates[:31]  # Limit to reasonable number


async def generate_calendar_entries_with_llm(platform: str, posting_dates: List[date],
                                     business_context: dict, existing_topics: List[str],
                                     user_id: str) -> List[Dict]:
    """Generate calendar entries using LLM with trend awareness and topic deduplication"""

    platform_config = PLATFORM_CONFIGS.get(platform, PLATFORM_CONFIGS['instagram'])
    platform_mappings = RL_AGENT_MAPPINGS.get(platform, RL_AGENT_MAPPINGS['instagram'])

    # Get current trends and important dates from Grok
    industry = business_context.get('industry', 'general')
    current_month = datetime.now().strftime("%B")
    current_year = datetime.now().year

    grok_trends = await get_trends_from_grok(industry, current_month, str(current_year))
    important_dates = await get_important_dates_from_grok(industry, current_month, str(current_year))

    # Extract all possible RL agent values for this platform
    all_hook_types = set()
    all_hook_lengths = set()
    all_tones = set()
    all_creativities = set()
    all_text_in_images = set()
    all_visual_styles = set()

    for content_type, values in platform_mappings.items():
        all_hook_types.update(values.get('hook_type', []))
        all_hook_lengths.update(values.get('hook_length', []))
        all_tones.update(values.get('tone', []))
        all_creativities.update(values.get('creativity', []))
        all_text_in_images.update(values.get('text_in_image', []))
        all_visual_styles.update(values.get('visual_style', []))

    # Convert sets to sorted lists for consistent ordering
    hook_types_list = sorted(list(all_hook_types))
    hook_lengths_list = sorted(list(all_hook_lengths))
    tones_list = sorted(list(all_tones))
    creativities_list = sorted(list(all_creativities))
    text_in_images_list = sorted(list(all_text_in_images))
    visual_styles_list = sorted(list(all_visual_styles))

    # Content themes from RL agent perspective + Grok trends
    base_themes = [
        "educational", "promotional", "engagement", "entertainment",
        "behind_scenes", "testimonial", "announcement", "brand_story",
        "user_generated", "meme_humor", "facts_did_you_know", "event_highlight",
        "countdown", "faq", "comparison", "case_study", "milestone_achievement",
        "call_to_action"
    ]

    # Combine base themes with Grok trends
    content_themes = base_themes + grok_trends

    prompt = f"""You are a social media strategist creating a content calendar for {current_month} {current_year}.

BUSINESS CONTEXT:
- Business: {business_context.get('business_name', 'Business')}
- Industry: {business_context.get('industry', 'General')}
- Target Audience: {business_context.get('target_audience', 'General audience')}
- Brand Tone: {business_context.get('brand_tone', 'Professional')}

PLATFORM: {platform.upper()}
CONTENT TYPES AVAILABLE: {', '.join(platform_config['content_types'])}

CURRENT TRENDS FROM GROK: {', '.join(grok_trends)}

IMPORTANT DATES/EVENTS: {json.dumps(important_dates) if important_dates else 'None identified'}

RL AGENT VALUES FOR {platform.upper()}:
- hook_type: {', '.join(hook_types_list)}
- hook_length: {', '.join(hook_lengths_list)}
- tone: {', '.join(tones_list)}
- creativity: {', '.join(creativities_list)}
- text_in_image: {', '.join(text_in_images_list)}
- visual_style: {', '.join(visual_styles_list)}

CONTENT THEMES: {', '.join(content_themes)}

EXISTING TOPICS TO AVOID: {', '.join(existing_topics[:20]) if existing_topics else 'None'}

CALENDAR REQUIREMENTS:
- Create {len(posting_dates)} unique content entries
- Each entry must have fresh, original topics not in the existing topics list
- Mix content types appropriately for the platform
- Incorporate current trends from Grok where relevant
- Consider important dates/events for timely content
- Use RL agent values that are optimal for each content type and platform
- Include trending topics and formats for {platform}
- Topics should be engaging and aligned with business goals

For each posting date, generate:
- content_type: Choose from {platform_config['content_types']}
- content_theme: Choose from [{', '.join(content_themes)}]
- topic: Unique, engaging topic title (not in existing topics)
- hook_type: Choose from [{', '.join(hook_types_list)}]
- hook_length: Choose from [{', '.join(hook_lengths_list)}]
- tone: Choose from [{', '.join(tones_list)}]
- creativity: Choose from [{', '.join(creativities_list)}]
- text_in_image: Choose from [{', '.join(text_in_images_list)}]
- visual_style: Choose from [{', '.join(visual_styles_list)}]

CRITICAL: Select RL agent values that are most appropriate for the chosen content_type on this platform.

Return ONLY a JSON array of calendar entries.
{JSON_ONLY_INSTRUCTION}"""

    try:
        # Use Gemini for calendar generation
        model = genai.GenerativeModel('gemini-2.0-flash-exp')
        response = model.generate_content(prompt)

        if response and response.text:
            # Clean the response to extract JSON
            text = response.text.strip()
            if text.startswith('```json'):
                text = text[7:]
            if text.endswith('```'):
                text = text[:-3]
            text = text.strip()

            import json
            calendar_data = json.loads(text)

            # Validate and format entries
            formatted_entries = []
            for i, entry in enumerate(calendar_data):
                if i >= len(posting_dates):
                    break

                formatted_entry = {
                    'entry_date': posting_dates[i].isoformat(),
                    'content_type': entry.get('content_type', 'static_post'),
                    'content_theme': entry.get('content_theme', 'educational'),
                    'topic': entry.get('topic', f'Content for {posting_dates[i].strftime("%B %d")}'),
                    'platform': platform,
                    'hook_type': entry.get('hook_type', 'statement'),
                    'hook_length': entry.get('hook_length', 'medium'),
                    'tone': entry.get('tone', 'professional'),
                    'creativity': entry.get('creativity', 'medium'),
                    'text_in_image': entry.get('text_in_image', 'overlay'),
                    'visual_style': entry.get('visual_style', 'clean')
                }
                formatted_entries.append(formatted_entry)

            return formatted_entries

    except Exception as e:
        logger.error(f"Failed to generate calendar with LLM: {e}")

    # Fallback: Generate basic calendar entries
    return generate_fallback_calendar_entries(platform, posting_dates)


def generate_fallback_calendar_entries(platform: str, posting_dates: List[date]) -> List[Dict]:
    """Fallback calendar generation when LLM fails"""
    platform_config = PLATFORM_CONFIGS.get(platform, PLATFORM_CONFIGS['instagram'])
    platform_mappings = RL_AGENT_MAPPINGS.get(platform, RL_AGENT_MAPPINGS['instagram'])
    content_types = platform_config['content_types']

    entries = []
    content_themes = [
        "educational", "promotional", "engagement", "entertainment",
        "behind_scenes", "testimonial", "announcement"
    ]

    for i, post_date in enumerate(posting_dates):
        content_type = content_types[i % len(content_types)]
        content_type_mapping = platform_mappings.get(content_type, platform_mappings.get('static_post', {}))

        entry = {
            'entry_date': post_date.isoformat(),
            'content_type': content_type,
            'content_theme': content_themes[i % len(content_themes)],
            'topic': f'{platform_config["description"]} - Day {i+1}',
            'platform': platform,
            'hook_type': content_type_mapping.get('hook_type', ['statement'])[0],
            'hook_length': content_type_mapping.get('hook_length', ['medium'])[0],
            'tone': content_type_mapping.get('tone', ['professional'])[0],
            'creativity': content_type_mapping.get('creativity', ['medium'])[0],
            'text_in_image': content_type_mapping.get('text_in_image', ['overlay'])[0],
            'visual_style': content_type_mapping.get('visual_style', ['clean'])[0]
        }
        entries.append(entry)

    return entries


def save_calendar_to_database(user_id: str, calendar_month: int, calendar_year: int,
                            platform: str, frequency: str, business_context: dict,
                            calendar_entries: List[Dict]) -> str:
    """Save calendar and entries to database"""
    try:
        if not supabase:
            logger.error("Supabase not available for saving calendar")
            return None

        # Create calendar record - calendar_month should be the first day of the month
        first_day_of_month = date(calendar_year, calendar_month, 1)
        calendar_data = {
            'user_id': user_id,
            'calendar_month': first_day_of_month.isoformat(),
            'calendar_year': calendar_year,
            'platform': platform,
            'frequency': frequency,
            'business_context': business_context,
            'total_entries': len(calendar_entries),
            'is_active': True
        }

        calendar_response = supabase.table('social_media_calendars').insert(calendar_data).execute()

        if not calendar_response.data:
            logger.error("Failed to create calendar record")
            return None

        calendar_id = calendar_response.data[0]['id']

        # Create calendar entries
        entries_data = []
        for entry in calendar_entries:
            entry_data = {
                'calendar_id': calendar_id,
                'entry_date': entry['entry_date'],
                'content_type': entry['content_type'],
                'content_theme': entry['content_theme'],
                'topic': entry['topic'],
                'platform': entry['platform'],
                'hook_type': entry.get('hook_type'),
                'hook_length': entry.get('hook_length'),
                'tone': entry.get('tone'),
                'creativity': entry.get('creativity'),
                'text_in_image': entry.get('text_in_image'),
                'visual_style': entry.get('visual_style'),
                'status': 'draft'
            }
            entries_data.append(entry_data)

        # Bulk insert entries
        supabase.table('calendar_entries').insert(entries_data).execute()

        logger.info(f"Successfully saved calendar with {len(entries_data)} entries")
        return calendar_id

    except Exception as e:
        logger.error(f"Failed to save calendar to database: {e}")
        return None


def format_calendar_summary(calendar_entries: List[Dict], platform: str, frequency: str, month_name: str, total_entries: int) -> str:
    """Format calendar summary response for user (detailed display handled by frontend)"""

    platform_emoji = {
        'instagram': '📸',
        'facebook': '👥',
        'youtube': '🎥',
        'linkedin': '💼'
    }.get(platform, '📱')

    response = f"""🎉 Your {platform_emoji} {platform.upper()} calendar for {month_name} has been created successfully!

**📊 Calendar Summary:**
• **Platform:** {platform.title()}
• **Posting Schedule:** {frequency.replace('_', ' ').title()}
• **Total Planned Posts:** {total_entries}

**🎯 Content Mix:**
"""

    # Add content type breakdown
    content_type_counts = {}
    for entry in calendar_entries:
        content_type = entry['content_type']
        content_type_counts[content_type] = content_type_counts.get(content_type, 0) + 1

    for content_type, count in content_type_counts.items():
        emoji = {
            'static_post': '📝',
            'reel': '🎬',
            'carousel': '📸',
            'video': '🎥',
            'story': '📖',
            'article': '📄'
        }.get(content_type, '📝')
        response += f"• {emoji} {content_type.replace('_', ' ').title()}: {count} posts\n"

    response += f"""

**📅 Calendar Preview:**
Here are your scheduled posts for {month_name}:

"""

    # Show first few entries as preview
    preview_count = min(5, len(calendar_entries))
    for i, entry in enumerate(calendar_entries[:preview_count], 1):
        date_obj = datetime.fromisoformat(entry['entry_date'])
        date_str = date_obj.strftime('%b %d')

        content_type_emoji = {
            'static_post': '📝',
            'reel': '🎬',
            'carousel': '📸',
            'video': '🎥',
            'story': '📖',
            'article': '📄'
        }.get(entry['content_type'], '📝')

        # Truncate topic for preview
        topic = entry['topic']
        if len(topic) > 40:
            topic = topic[:37] + "..."

        response += f"{i}. **{date_str}** {content_type_emoji} {topic}\n"

    if len(calendar_entries) > preview_count:
        response += f"\n... and {len(calendar_entries) - preview_count} more posts scheduled.\n"

    response += """
💡 **What happens next:**
• Your calendar entries are now available for detailed review below
• Each entry includes optimized RL agent settings for maximum engagement
• You can schedule posts or make adjustments as needed

Your calendar has been saved and you can access it anytime! 📅"""

    return response