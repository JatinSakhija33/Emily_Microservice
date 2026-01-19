"""
Create Content from Calendar Functions - Extracted from ATSN Agent
Contains construct, complete, and handle functions for creating content from calendar entries.
"""

import os
import logging
import re
import uuid
import base64
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
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

# Configure Gemini
genai.configure(api_key=os.getenv('GEMINI_API_KEY'))

# ==================== CONSTANTS ====================

JSON_ONLY_INSTRUCTION = """

CRITICAL: You MUST respond with ONLY a valid JSON object. Do NOT include any explanatory text, comments, or additional text before or after the JSON.
Your response must start with { and end with }. No other text is allowed.
Return ONLY the JSON object, nothing else."""

FIELD_CLARIFICATIONS = {
    "create_content_from_calendar": {
        "platform": {
            "question": "Which platform's calendar content would you like to create content for?",
            "options": [
                {"label": "Instagram", "value": "instagram"},
                {"label": "Facebook", "value": "facebook"},
                {"label": "LinkedIn", "value": "linkedin"},
                {"label": "YouTube", "value": "youtube"}
            ]
        },
        "calendar_date": {
            "question": "Which date's content would you like to create? (Please specify in YYYY-MM-DD format or use 'today', 'tomorrow', etc.)",
            "options": [
                {"label": "Today", "value": "today"},
                {"label": "Tomorrow", "value": "tomorrow"},
                {"label": "Yesterday", "value": "yesterday"},
                {"label": "Let me type the date", "value": "custom_date"}
            ]
        },
        "confirm_creation": {
            "question": "Found your calendar content! Ready to create the actual content?",
            "options": [
                {"label": "Yes, create the content", "value": "yes"},
                {"label": "No, cancel", "value": "no"}
            ]
        }
    }
}

# ==================== FUNCTIONS ====================

def _parse_calendar_date(date_input: str) -> Optional[str]:
    """Parse various date formats into YYYY-MM-DD format for calendar date selection"""
    from datetime import datetime, timedelta

    date_input = date_input.lower().strip()

    # Handle relative dates
    now = datetime.now()
    if date_input == "today":
        return now.strftime('%Y-%m-%d')
    elif date_input == "tomorrow":
        tomorrow = now + timedelta(days=1)
        return tomorrow.strftime('%Y-%m-%d')
    elif date_input == "yesterday":
        yesterday = now - timedelta(days=1)
        return yesterday.strftime('%Y-%m-%d')

    # Handle YYYY-MM-DD format
    if len(date_input) == 10 and date_input.count('-') == 2:
        try:
            datetime.strptime(date_input, '%Y-%m-%d')
            return date_input
        except ValueError:
            pass

    # Handle "Month DD, YYYY" format (e.g., "January 15, 2026")
    if ',' in date_input:
        try:
            # Remove comma and parse
            clean_date = date_input.replace(',', '')
            parsed_date = datetime.strptime(clean_date, '%B %d %Y')
            return parsed_date.strftime('%Y-%m-%d')
        except ValueError:
            pass

    # Handle "Month DD YYYY" format (without comma)
    try:
        parts = date_input.split()
        if len(parts) == 3:
            month, day, year = parts
            # Reconstruct with comma for parsing
            date_with_comma = f"{month} {day}, {year}"
            parsed_date = datetime.strptime(date_with_comma, '%B %d, %Y')
            return parsed_date.strftime('%Y-%m-%d')
    except (ValueError, AttributeError):
        pass

    # If custom_date option was selected, ask for typed input
    if date_input == "custom_date":
        return None  # This will trigger the custom date input clarification

    return None

def construct_create_content_from_calendar_payload(state) -> Any:
    """Construct payload for create content from calendar task"""

    # Use user_query which contains the full conversation context
    conversation = state.user_query

    prompt = f"""You are extracting information to create content from a calendar entry. Be EXTREMELY STRICT and CONSERVATIVE in your extraction.

CRITICAL PRINCIPLES:
1. ONLY extract information that is EXPLICITLY and CLEARLY stated
2. NEVER infer, assume, or extrapolate information
3. If uncertain about any field, set it to null
4. Quality over quantity - better to ask questions than make wrong assumptions

CURRENT DATE CONTEXT:
- Today's date: {datetime.now().strftime('%Y-%m-%d')} ({datetime.now().strftime('%A, %B %d, %Y')})
- Tomorrow's date: {(datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')}
- Yesterday's date: {(datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')}

EXTRACTION RULES:

platform:
- ONLY extract if user explicitly names exactly one of: "instagram", "facebook", "linkedin", "youtube"
- Case insensitive - convert to lowercase
- If multiple platforms mentioned, set to null (ask user to choose)
- Otherwise: null

calendar_date:
- Extract and PARSE the date for calendar content into YYYY-MM-DD format
- Convert relative dates using CURRENT DATE CONTEXT:
  * "today" → use today's date from context
  * "tomorrow" → use tomorrow's date from context
  * "yesterday" → use yesterday's date from context
- Convert month names to YYYY-MM-DD:
  * "January 15, 2026" or "Jan 15, 2026" → "2026-01-15"
  * "February 20, 2026" → "2026-02-20"
- Accept direct YYYY-MM-DD format as-is
- If user is responding to a custom date prompt, extract any date-like input
- If multiple dates mentioned, set to null (ask user to choose)
- If date cannot be parsed, set to null
- Return ONLY the parsed YYYY-MM-DD string, not the original input

confirm_creation:
- Set to "yes" ONLY if user explicitly confirms they want to create content from calendar
- Set to "no" ONLY if user explicitly says they don't want to create or want to cancel
- Otherwise: null

VALIDATION CHECKLIST:
□ Is platform an exact match from allowed values?
□ Is calendar_date a valid date format or relative date?
□ Is confirm_creation only set when user clearly states intent?

If ANY doubt exists, set the uncertain field(s) to null.

User conversation:
{conversation}

Return a JSON object with exactly this structure:
{{
    "platform": "instagram" | "facebook" | "linkedin" | "youtube" | null,
    "calendar_date": "YYYY-MM-DD" | null,
    "confirm_creation": "yes" | "no" | null
}}

IMPORTANT: calendar_date must ALWAYS be in YYYY-MM-DD format if provided. Never return relative dates or month names - convert them to YYYY-MM-DD format.

IMPORTANT: Return ONLY the JSON object, no additional text or explanation.
{JSON_ONLY_INSTRUCTION}"""

    # Import _extract_payload from atsn
    from .atsn import _extract_payload
    return _extract_payload(state, prompt)

def complete_create_content_from_calendar_payload(state) -> Any:
    """Complete payload for create content from calendar task"""

    payload = state.payload

    # Check if platform is missing - ask for clarification
    if not payload.get('platform'):
        clarification = FIELD_CLARIFICATIONS['create_content_from_calendar']['platform']
        state.clarification_options = clarification['options']
        state.clarification_data = {
            'field': 'platform',
            'question': clarification['question']
        }
        state.clarification_question = clarification['question']
        state.waiting_for_user = True
        state.current_step = "waiting_for_clarification"
        return state

    # Check if calendar_date is missing - ask for clarification
    if not payload.get('calendar_date'):
        clarification = FIELD_CLARIFICATIONS['create_content_from_calendar']['calendar_date']
        state.clarification_options = clarification['options']
        state.clarification_data = {
            'field': 'calendar_date',
            'question': clarification['question']
        }
        state.clarification_question = clarification['question']
        state.waiting_for_user = True
        state.current_step = "waiting_for_clarification"
        return state

    # Parse calendar date using proper date parsing logic
    calendar_date = payload.get('calendar_date', '')
    calendar_date = calendar_date.strip() if calendar_date else ''

    if calendar_date:
        # Handle special case for custom_date selection
        if calendar_date.lower() == 'custom_date':
            # User wants to type a custom date - ask for it
            state.clarification_question = "Please type the date in YYYY-MM-DD format (e.g., 2026-01-15), 'Month DD, YYYY' format (e.g., January 15, 2026), or use 'today', 'tomorrow', 'yesterday':"
            state.clarification_options = []
            state.clarification_data = {'field': 'calendar_date', 'question': state.clarification_question}
            state.waiting_for_user = True
            state.current_step = "waiting_for_clarification"
            return state

        # Use the date parsing logic
        parsed_date = _parse_calendar_date(calendar_date)
        if parsed_date:
            payload['calendar_date'] = parsed_date
        else:
            # Invalid date format
            state.error = f"Invalid date format: '{calendar_date}'. Please use YYYY-MM-DD format, 'today', 'tomorrow', 'yesterday', or 'Month DD, YYYY' format."
            return state

    # Fetch calendar entry based on platform and date
    try:
        platform = payload.get('platform')

        calendar_date = payload.get('calendar_date')
        if not calendar_date:
            state.error = "Calendar date not provided"
            return state

        # First, find calendar(s) for this user and platform
        calendars_response = supabase.table('social_media_calendars').select('id').eq('user_id', state.user_id).eq('platform', platform).execute()

        if not calendars_response.data or len(calendars_response.data) == 0:
            state.error = f"No calendar found for {platform} platform"
            return state

        calendar_ids = [cal['id'] for cal in calendars_response.data]

        # Query calendar entries for the specific date from any of the user's calendars for this platform
        calendar_response = supabase.table('calendar_entries').select('*').in_('calendar_id', calendar_ids).eq('entry_date', calendar_date).execute()

        if not calendar_response.data or len(calendar_response.data) == 0:
            state.error = f"No calendar entries found for {platform} on {calendar_date}"
            return state

        # For now, take the first entry (user can specify which one later if needed)
        calendar_entry = calendar_response.data[0]

        # Add calendar entry data to payload
        payload['calendar_entry'] = calendar_entry
        payload['calendar_entry_id'] = calendar_entry['id']

        # Check if content already exists for this calendar entry
        if calendar_entry.get('content_id'):
            state.result = "Content has already been created for this calendar entry."
            state.payload_complete = True
            return state

        # If confirm_creation is not set, ask for confirmation
        if not payload.get('confirm_creation'):
            clarification = FIELD_CLARIFICATIONS['create_content_from_calendar']['confirm_creation']
            state.clarification_options = clarification['options']
            state.clarification_data = {
                'field': 'confirm_creation',
                'question': clarification['question'],
                'calendar_info': {
                    'topic': calendar_entry.get('topic'),
                    'content_type': calendar_entry.get('content_type'),
                    'platform': platform,
                    'date': calendar_date
                }
            }
            state.clarification_question = clarification['question']
            state.clarification_options = clarification['options']
            state.waiting_for_user = True
            state.current_step = "waiting_for_clarification"
            return state

        # If user confirmed, mark payload as complete
        if payload.get('confirm_creation') == 'yes':
            state.payload_complete = True
            print(f"🔍 DEBUG: payload marked as complete")
        else:
            state.result = "Content creation cancelled."
            state.payload_complete = True
            print(f"🔍 DEBUG: content creation cancelled")

    except Exception as e:
        logger.error(f"Failed to complete payload: {e}")
        state.error = f"Failed to fetch calendar data: {str(e)}"

    return state

async def handle_create_content_from_calendar(state) -> Any:
    """Create content from a calendar entry using RL agent"""

    # Import required functions
    from .atsn import (
        get_business_context_from_profile,
        generate_content_with_rl_agent,
        extract_hashtags_from_caption,
        generate_personalized_message,
    )

    payload = state.payload

    if not state.payload_complete:
        state.error = "Payload is not complete"
        return state

    # Check if user confirmed creation
    if payload.get('confirm_creation') != 'yes':
        state.result = "Content creation cancelled."
        return state

    try:
        calendar_entry = payload.get('calendar_entry')
        if not calendar_entry:
            state.error = "No calendar entry found"
            return state

        # Check if content already exists
        if calendar_entry.get('content_id'):
            state.result = "Content has already been created for this calendar entry."
            return state

        # Extract values from calendar entry
        topic = calendar_entry.get('topic')
        platform = calendar_entry.get('platform')
        content_type = calendar_entry.get('content_type')
        content_theme = calendar_entry.get('content_theme')

        logger.info(f"🎨 Creating content from calendar entry: {topic}")

        # Load business context from profiles table
        business_context = {}
        if state.user_id:
            try:
                profile_fields = [
                    "business_name", "business_description", "brand_tone", "industry", "target_audience",
                    "brand_voice", "unique_value_proposition", "primary_color", "secondary_color",
                    "brand_colors", "logo_url", "timezone", "location_city", "location_state", "location_country"
                ]
                profile_response = supabase.table("profiles").select(", ".join(profile_fields)).eq("id", state.user_id).execute()

                if profile_response.data and len(profile_response.data) > 0:
                    profile_data = profile_response.data[0]
                    business_context = get_business_context_from_profile(profile_data)
                    logger.info(f"✅ Loaded business context for: {business_context.get('business_name', 'Business')}")
                else:
                    logger.warning(f"❌ No profile data found for user_id: {state.user_id}, using defaults")
                    business_context = get_business_context_from_profile({})
            except Exception as e:
                logger.error(f"❌ Failed to load business context for user_id {state.user_id}: {e}")
                business_context = get_business_context_from_profile({})
        else:
            logger.warning("❌ No user_id provided in state, using defaults")
            business_context = get_business_context_from_profile({})

        # Use the RL agent values from the calendar entry
        rl_values = {
            'hook_type': calendar_entry.get('hook_type'),
            'hook_length': calendar_entry.get('hook_length'),
            'tone': calendar_entry.get('tone'),
            'creativity': calendar_entry.get('creativity'),
            'text_in_image': calendar_entry.get('text_in_image'),
            'visual_style': calendar_entry.get('visual_style')
        }

        # Generate content directly using calendar RL values
        try:
            # Use LLM to generate content based on calendar RL values
            content_prompt = f"""Generate social media content for the following specifications:

Topic: {topic}
Platform: {platform}
Content Type: {content_type}
Content Theme: {content_theme}

RL Agent Parameters:
- Hook Type: {rl_values.get('hook_type', 'question')}
- Hook Length: {rl_values.get('hook_length', 'short')}
- Tone: {rl_values.get('tone', 'casual')}
- Creativity: {rl_values.get('creativity', 'medium')}
- Text in Image: {rl_values.get('text_in_image', 'overlay')}
- Visual Style: {rl_values.get('visual_style', 'clean')}

Business Context: {business_context.get('business_description', '')}

Generate a compelling caption that incorporates these specifications. Make it engaging and suitable for {platform}."""

            response = openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": content_prompt}],
                max_tokens=300,
                temperature=0.7
            )

            generated_caption = response.choices[0].message.content.strip()

            # Prepare content data for database
            content_data = {
                'title': f"Calendar Content: {calendar_entry.get('topic', '')[:50]}",
                'content': generated_caption,
                'hashtags': extract_hashtags_from_caption(generated_caption),
                'images': [],  # Will be generated separately if needed
                'platform': calendar_entry.get('platform'),
                'content_type': calendar_entry.get('content_type'),
                'content_theme': calendar_entry.get('content_theme'),
                'rl_values': rl_values,
                'created_from_calendar': True
            }

            # Save content to post_contents table
            content_record = {
                'post_id': f"calendar_{calendar_entry.get('id')}_{int(datetime.now().timestamp())}",
                'platform': content_data['platform'],
                'topic': calendar_entry.get('topic'),
                'generated_caption': content_data['content'],
                'status': 'draft',
                'created_at': datetime.now().isoformat()
            }

            # Insert into post_contents table
            content_response = supabase.table('post_contents').insert(content_record).execute()

            if not content_response.data:
                state.error = "Failed to save content to database"
                return state

            content_id = content_response.data[0]['id']

            # Note: calendar_entries table doesn't have content_id column yet
            # TODO: Add content_id column to calendar_entries table via migration
            # For now, we just create the content without linking it back to calendar

            # Create success response
            result_message = f"""✅ **Content Created Successfully!**

**Topic:** {calendar_entry.get('topic')}
**Platform:** {calendar_entry.get('platform').title()}
**Content Type:** {calendar_entry.get('content_type', '').replace('_', ' ').title()}

**Generated Content:**
{content_data['content']}

{f"**Hashtags:** {' '.join(content_data['hashtags'])}" if content_data['hashtags'] else ""}

The content has been saved and is ready for scheduling!"""

            state.result = result_message
            state.content_id = content_id

            logger.info(f"✅ Content created from calendar entry {calendar_entry.get('id')} with content_id {content_id}")

        except Exception as e:
            logger.error(f"Failed to create content from calendar: {e}", exc_info=True)
            state.error = f"Failed to create content: {str(e)}"

    except Exception as e:
        logger.error(f"Unexpected error in handle_create_content_from_calendar: {e}", exc_info=True)
        state.error = f"An unexpected error occurred: {str(e)}"

    return state