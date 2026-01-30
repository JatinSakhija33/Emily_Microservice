"""
Schedule Content Functions - Extracted from ATSN Agent
Contains construct, complete, and handle functions for scheduling content.
"""

import os
import logging
import re
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import google.generativeai as genai
import openai
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

# Configure Gemini
genai.configure(api_key=os.getenv('GEMINI_API_KEY'))

# ==================== CONSTANTS ====================

JSON_ONLY_INSTRUCTION = """

CRITICAL: You MUST respond with ONLY a valid JSON object. Do NOT include any explanatory text, comments, or additional text before or after the JSON.
Your response must start with {{ and end with }}. No other text is allowed.
Return ONLY the JSON object, nothing else."""

# ==================== IMPORTED FUNCTIONS FROM ATSN ====================

# These functions need to be imported from atsn when using this module
# - _extract_payload
# - _parse_schedule_datetime
# - generate_personalized_message

# Functions will be imported locally to avoid circular imports

# ==================== FUNCTIONS ====================

def construct_schedule_content_payload(state) -> Any:
    """Construct payload for schedule content task"""

    # Use user_query which contains the full conversation context
    conversation = state.user_query

    prompt = f"""You are extracting information to schedule content for future publishing.

User conversation:
{conversation}

Extract these fields if mentioned:
- channel: "Social Media" or "Blog"
- platform: "Instagram", "Facebook", "LinkedIn", or "Youtube"
- content_id: Specific content identifier
- schedule_date: Date to publish (format: YYYY-MM-DD or relative like "tomorrow", "next Monday")
- schedule_time: Time to publish (format: HH:MM or "morning", "afternoon", "evening")

CRITICAL DATE PARSING RULES:
- Parse ALL date mentions into YYYY-MM-DD format without errors
- "today" → current date in YYYY-MM-DD format
- "tomorrow" → tomorrow's date in YYYY-MM-DD format
- "next Monday", "next Tuesday", etc. → calculate next occurrence
- Specific dates like "27 december" → "YYYY-12-27" (use current year)
- If no date mentioned, set schedule_date to null (will use default)

Examples:

Query: "Schedule my Instagram post for tomorrow at 9 AM"
{{
    "content_id": null,
    "schedule_date": "tomorrow",
    "schedule_time": "09:00"
}}

Query: "Schedule content CONTENT_123 for next Monday at 2 PM"
{{
    "content_id": "CONTENT_123",
    "schedule_date": "next Monday",
    "schedule_time": "14:00"
}}

Query: "Schedule a post"
{{
    "content_id": null,
    "schedule_date": null,
    "schedule_time": null
}}

Extract ONLY explicitly mentioned information. Set fields to null if not mentioned.
{JSON_ONLY_INSTRUCTION}"""

    # Import _extract_payload from atsn (local import to avoid circular dependency)
    from .atsn import _extract_payload
    return _extract_payload(state, prompt)


def complete_schedule_content_payload(state) -> Any:
    """Complete schedule_content payload - simplified flow"""

    # If content_id is provided directly, we might need schedule details
    if state.payload.get('content_id') and state.payload['content_id'].strip():
        # Check if we have schedule details, if not provide defaults or ask
        if not state.payload.get('schedule_date'):
            # Set default to tomorrow
            from datetime import datetime, timedelta
            tomorrow = datetime.now() + timedelta(days=1)
            state.payload['schedule_date'] = tomorrow.strftime('%Y-%m-%d')

        if not state.payload.get('schedule_time'):
            # Set default to morning
            state.payload['schedule_time'] = '09:00'

        state.payload_complete = True
        state.current_step = "action_execution"
        print(f" Schedule content payload complete - direct content selection with defaults")
        return state

    # For draft selection, no additional fields needed - just show drafts
    state.payload_complete = True
    state.current_step = "action_execution"
    print(" Schedule content payload complete - draft selection mode")
    return state


def handle_schedule_content(state) -> Any:
    """Handle content scheduling - direct schedule or show drafts for selection"""
    payload = state.payload

    # If content_id is provided directly, schedule that specific content
    if payload.get('content_id') and payload['content_id'].strip():
        return handle_schedule_specific_content(state)

    # Otherwise, show recent draft posts for selection
    return handle_schedule_draft_selection(state)


def handle_schedule_specific_content(state) -> Any:
    """Schedule a specific piece of content by ID"""
    # Import generate_personalized_message from atsn (local import to avoid circular dependency)
    from .atsn import generate_personalized_message

    payload = state.payload

    content_id = payload['content_id'].strip()
    schedule_date = payload.get('schedule_date')
    schedule_time = payload.get('schedule_time')

    if not supabase:
        state.error = "Database connection not configured. Please contact support."
        # Import generate_personalized_message from atsn (local import to avoid circular dependency)
        from .atsn import generate_personalized_message
        state.result = generate_personalized_message(
            base_message="Unable to schedule content: Database not available.",
            user_context=state.user_query,
            message_type="error"
        )
        logger.error("Supabase not configured - cannot schedule content")
        return state

    # Ensure user_id is present for security
    if not state.user_id:
        state.error = "User ID is required to schedule content"
        state.result = generate_personalized_message(
            base_message="Unable to schedule content: User authentication required.",
            user_context=state.user_query,
            message_type="error"
        )
        logger.error("User ID missing in handle_schedule_specific_content")
        return state

    if not schedule_date or not schedule_time:
        state.error = "Schedule date and time are required"
        state.result = generate_personalized_message(
            base_message="❌ Both schedule date and time are required. Please provide when you want this post scheduled.",
            user_context=state.user_query,
            message_type="error"
        )
        return state

    try:
        # Parse and validate the schedule date and time
        # Import _parse_schedule_datetime from atsn (local import to avoid circular dependency)
        from .atsn import _parse_schedule_datetime
        parsed_date, parsed_time = _parse_schedule_datetime(schedule_date, schedule_time)

        # First, check if content exists
        response = supabase.table('created_content').select('*').eq('id', content_id).eq('user_id', state.user_id).execute()

        if not response.data or len(response.data) == 0:
            state.error = f"Content with ID '{content_id}' not found"
            state.result = generate_personalized_message(
                base_message=f"❌ Content with ID '{content_id}' not found. Please check the content ID and try again.",
                user_context=state.user_query,
                message_type="error"
            )
            return state

        content = response.data[0]

        # Check if content is already scheduled or published
        if content.get('status') == 'published':
            state.result = generate_personalized_message(
                base_message=f"⚠️ Content '{content_id}' is already published. Cannot schedule published content.",
                user_context=state.user_query,
                message_type="warning"
            )
            return state

        if content.get('status') == 'scheduled':
            state.result = generate_personalized_message(
                base_message=f"⚠️ Content '{content_id}' is already scheduled. Use edit functionality to change the schedule.",
                user_context=state.user_query,
                message_type="warning"
            )
            return state

        # Update content with scheduling information
        schedule_response = supabase.table('created_content').update({
            'status': 'scheduled',
            'scheduled_date': parsed_date,
            'scheduled_time': parsed_time,
            'scheduled_at': f"{parsed_date} {parsed_time}:00"  # Combined datetime for easier querying
        }).eq('id', content_id).eq('user_id', state.user_id).execute()

        if schedule_response.data:
            # Create a more user-friendly date/time description
            from datetime import datetime
            try:
                # Try to parse the date for a more natural description
                date_obj = datetime.strptime(parsed_date, '%Y-%m-%d')
                today = datetime.now()
                tomorrow = today.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
                scheduled_date_obj = date_obj.replace(hour=0, minute=0, second=0, microsecond=0)

                if scheduled_date_obj.date() == today.date():
                    date_desc = "today"
                elif scheduled_date_obj.date() == tomorrow.date():
                    date_desc = "tomorrow"
                else:
                    date_desc = date_obj.strftime('%B %d, %Y')
            except:
                date_desc = parsed_date

            # Convert time to more natural format
            try:
                time_obj = datetime.strptime(parsed_time, '%H:%M')
                if parsed_time == '09:00':
                    time_desc = 'morning'
                elif parsed_time == '14:00':
                    time_desc = 'afternoon'
                elif parsed_time == '18:00':
                    time_desc = 'evening'
                else:
                    time_desc = time_obj.strftime('%I:%M %p').lstrip('0')
            except:
                time_desc = parsed_time

            platform_name = payload.get('platform') or content.get('platform', 'your platform')

            base_success_message = f"""Woohoo! 🎉 Your {platform_name} post is all set to go for {date_desc} {time_desc}!

It's officially scheduled and will pop up automatically when the time is right. You got this! ✨"""

            state.result = generate_personalized_message(
                base_message=base_success_message,
                user_context=state.user_query,
                message_type="success"
            )
        else:
            state.error = "Failed to update content schedule"
            state.result = generate_personalized_message(
                base_message="❌ Failed to schedule content. Please try again.",
                user_context=state.user_query,
                message_type="error"
            )

    except Exception as e:
        logger.error(f"Error scheduling content: {str(e)}")
        state.error = f"Failed to schedule content: {str(e)}"
        state.result = generate_personalized_message(
            base_message="❌ Something went wrong while scheduling your content. Please check the date/time format and try again.",
            user_context=state.user_query,
            message_type="error"
        )

    return state


def handle_schedule_draft_selection(state) -> Any:
    """Show recent draft posts and let user choose which to schedule"""
    # Import generate_personalized_message from atsn (local import to avoid circular dependency)
    from .atsn import generate_personalized_message

    payload = state.payload

    if not supabase:
        state.error = "Database connection not configured. Please contact support."
        state.result = generate_personalized_message(
            base_message="Unable to access your saved drafts: Database not available.",
            user_context=state.user_query,
            message_type="error"
        )
        return state

    if not state.user_id:
        state.error = "User ID is required to view draft content"
        state.result = generate_personalized_message(
            base_message="Unable to access your saved drafts: User authentication required.",
            user_context=state.user_query,
            message_type="error"
        )
        return state

    try:
        # Get recent draft posts (generated but not scheduled/published)
        query = supabase.table('created_content').select('*').eq('user_id', state.user_id).eq('status', 'generated').order('created_at', desc=True).limit(10)

        result = query.execute()
        draft_posts = result.data if result.data else []

        if not draft_posts:
            state.result = generate_personalized_message(
                base_message="You don't have any posts in saved drafts for scheduling. Please create some content first.",
                user_context=state.user_query,
                message_type="info"
            )
            return state

        # Format draft posts for selection
        draft_list = []
        for idx, post in enumerate(draft_posts, 1):
            # Get title - try multiple fields
            title = post.get('title', '').strip()
            if not title:
                # Generate a preview from content
                content_text = post.get('content', '').strip()
                if content_text:
                    title = content_text[:50] + ('...' if len(content_text) > 50 else '')
                else:
                    title = f"Draft {post.get('id', '')[:8]}"

            platform_display = post.get('platform', 'Unknown').title()
            content_type_display = post.get('content_type', 'post').replace('_', ' ').title()
            created_date = post.get('created_at', '')
            date_display = ''
            if created_date:
                try:
                    from datetime import datetime
                    dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                    date_display = dt.strftime('%b %d')
                except:
                    date_display = created_at[:10]

            draft_list.append(f"{idx}. {title} - {platform_display} ({content_type_display}) - {date_display}")

        # Ask user to select which draft to schedule
        state.result = f"Here are your saved drafts for scheduling:\n\n" + "\n".join(draft_list) + "\n\nWhich post would you like to schedule? Reply with the number (1-{len(draft_posts)}) or the content ID."

        # Store draft options for next interaction and set waiting state
        state.temp_content_options = draft_posts
        state.waiting_for_user = True
        state.current_step = "content_selection"

        return state

    except Exception as e:
        logger.error(f"Error fetching draft posts for scheduling: {str(e)}")
        state.error = f"Failed to fetch draft posts: {str(e)}"
        state.result = generate_personalized_message(
            base_message="Unable to access your saved drafts at the moment. Please try again later.",
            user_context=state.user_query,
            message_type="error"
        )
    return state