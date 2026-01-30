"""
Delete Content Functions - Extracted from ATSN Agent
Contains construct, complete, and handle functions for deleting content.
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

FIELD_CLARIFICATIONS = {
    "delete_content": {
        "channel": {
            "question": "Let's clean up some content! Which channel should we look in?",
            "options": [
                {"label": "Social Media", "value": "Social Media"},
                {"label": "Blog", "value": "Blog"}
            ]
        },
        "platform": {
            "question": "Alright! which platform do you want to delete content from? I can show you your content for Instagram, Facebook, LinkedIn, YouTube, Gmail, or WhatsApp.",
            "options": [
                {"label": "Instagram", "value": "Instagram"},
                {"label": "Facebook", "value": "Facebook"},
                {"label": "LinkedIn", "value": "LinkedIn"},
                {"label": "YouTube", "value": "YouTube"}
            ]
        },
        "date_range": {
            "question": "Please select a time period to delete content from",
            "options": [
                {"label": "Today", "value": "today"},
                {"label": "This week", "value": "this week"},
                {"label": "Last week", "value": "last week"},
                {"label": "Yesterday", "value": "yesterday"},
                {"label": "Custom date", "value": "show_date_picker"}
            ]
        },
        "status": {
            "question": "which content do you want to delete, your drafts or scheduled posts or published posts ?",
            "options": [
                {"label": "Generated", "value": "generated"},
                {"label": "Scheduled", "value": "scheduled"},
                {"label": "Published", "value": "published"}
            ]
        },
    }
}

# ==================== IMPORTED FUNCTIONS FROM ATSN ====================

# These functions need to be imported from atsn when using this module
# - _extract_payload
# - generate_clarifying_question
# - generate_personalized_message
# - _parse_date_range_format

# ==================== FUNCTIONS ====================

def construct_delete_content_payload(state) -> Any:
    """Construct payload for delete content task"""

    # Use user_query which contains the full conversation context
    conversation = state.user_query

    # Get current date and user timezone for date parsing context
    from datetime import datetime
    current_date = datetime.now().strftime("%Y-%m-%d")

    # Get user timezone from profile
    user_timezone = "UTC"  # default
    if state.user_id and supabase:
        try:
            profile_response = supabase.table("profiles").select("timezone").eq("id", state.user_id).execute()
            if profile_response.data and len(profile_response.data) > 0:
                user_timezone = profile_response.data[0].get("timezone", "UTC")
        except Exception as e:
            logger.warning(f"Could not fetch user timezone: {e}")

    prompt = f"""You are extracting information to delete content.

Current date reference: Today is {current_date}
User timezone: {user_timezone}

User conversation:
{conversation}

Extract these fields ONLY if explicitly mentioned:
- channel: "Social Media" or "Blog"
- platform: "Instagram", "Facebook", "LinkedIn", or "Youtube"
- date_range: PARSE dates into YYYY-MM-DD format (e.g., "2025-12-27") or date ranges like "2025-12-20 to 2025-12-27"
- status: "generated", "scheduled", or "published"
- content_id: Specific content identifier
- query: Any search terms or phrases the user wants to search for in content (e.g., "posts for new year", "christmas content", "product launch")

CRITICAL DATE PARSING RULES:
- Parse ALL date mentions into YYYY-MM-DD format without errors
- "today" → current date ({current_date}) in YYYY-MM-DD format
- "yesterday" → yesterday's date relative to {current_date}
- "tomorrow" → tomorrow's date relative to {current_date}
- "this week" → current week range (Monday to current day) relative to {current_date}
- "last week" → previous week range (Monday to Sunday) relative to {current_date}
- "this month" → current month range (1st to current day) relative to {current_date}
- "last month" → previous month range (1st to last day) relative to {current_date}
- "last_7_days" → date range for last 7 days from {current_date}
- "last_30_days" → date range for last 30 days from {current_date}
- Specific dates like "27 december" → "YYYY-12-27" (use current year if not specified)
- Month names: "january"/"jan" → "01", "february"/"feb" → "02", etc.
- For date ranges, use format "YYYY-MM-DD to YYYY-MM-DD"
- If no date mentioned, set date_range to null
- NEVER leave date parsing incomplete - always convert to proper format
- Use the user's timezone ({user_timezone}) for all date calculations

CRITICAL QUERY EXTRACTION:
- Extract search queries that indicate what content the user is looking for
- Examples: "posts for new year", "christmas content", "summer sale posts", "product launch videos"
- Set query field to the search phrase if user wants to find content by topic/theme
- If no specific search query mentioned, set query to null

CRITICAL RULES:
1. Set fields to null if NOT explicitly mentioned in the conversation
2. DO NOT infer or assume values - only extract what the user explicitly stated
3. If user says "delete content" without mentioning status, set status to null
4. If user says "remove posts" without mentioning status, set status to null
5. Only set status to "published" if user explicitly says "published", "posted", "live", etc.
6. Only set status to "scheduled" if user explicitly says "scheduled", "scheduled posts", etc.
7. Only set status to "generated" if user explicitly says "generated", "draft", "created", etc.
8. IMPORTANT: When user responds to clarification questions with single words, parse dates correctly:
   - "yesterday" → date_range: yesterday's date ({(datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')})
   - "today" → date_range: today's date ({current_date})
   - "tomorrow" → date_range: tomorrow's date ({(datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')})
   - "this week" → date_range: current week range
   - "last week" → date_range: previous week range
   - "this month" → date_range: current month range
   - "last month" → date_range: previous month range
   - "last_7_days" → date_range: last 7 days from {current_date}
   - "last_30_days" → date_range: last 30 days from {current_date}
   - "generated" → status: "generated"
   - "scheduled" → status: "scheduled"
   - "published" → status: "published"
   - "Instagram" → platform: "Instagram"
   - "Facebook" → platform: "Facebook"
   - "LinkedIn" → platform: "LinkedIn"
   - "YouTube" → platform: "Youtube"
   - "Gmail" → platform: "Gmail"
   - "WhatsApp" → platform: "Whatsapp"
   - "Social Media" → channel: "Social Media"
   - "Blog" → channel: "Blog"
   - "Email" → channel: "Email"
9. Preserve existing payload values - only update fields that are explicitly mentioned in the current response


Extract ONLY explicitly mentioned information. Set fields to null if not mentioned.
{JSON_ONLY_INSTRUCTION}"""

    # Import _extract_payload from atsn
    from .atsn import _extract_payload
    return _extract_payload(state, prompt)


def complete_delete_content_payload(state) -> Any:
    """Complete delete_content payload - ALL fields required for safety, except when search query is provided"""
    # If payload is already complete, don't check again
    if state.payload_complete:
        logger.info("Payload already complete, skipping completion check")
        state.current_step = "action_execution"
        return state

    # Give priority to search queries - if query is present, skip clarifying questions
    if state.payload.get('query') and state.payload['query'].strip():
        logger.info("Search query detected, skipping clarifying questions and proceeding with search")
        state.payload_complete = True
        state.current_step = "action_execution"
        print(" Delete content payload complete - search query provided, proceeding without clarifications")
        print(f"  Final payload: {state.payload}")
        return state

    required_fields = ["channel", "platform", "date_range", "status"]
    clarifications = FIELD_CLARIFICATIONS.get("delete_content", {})

    # Convert date_range to start_date and end_date if present (same as view_content)
    if state.payload.get("date_range") and state.payload["date_range"]:
        date_range = str(state.payload["date_range"]).strip()
        # Import _parse_date_range_format from atsn
        from .atsn import _parse_date_range_format
        date_filter = _parse_date_range_format(date_range)

        if date_filter:
            # Successfully converted date_range to actual dates
            state.payload["start_date"] = date_filter.get("start") if date_filter.get("start") else None
            state.payload["end_date"] = date_filter.get("end") if date_filter.get("end") else None
            print(f" Converted '{date_range}' to start_date: {state.payload['start_date']}, end_date: {state.payload['end_date']}")
        else:
            # Could not parse date_range
            print(f"⚠️ Could not parse date_range '{date_range}', treating as missing")
            state.payload["date_range"] = None
            state.payload["start_date"] = None
            state.payload["end_date"] = None

    # Check if we have all required fields including converted dates
    missing_fields = [
        f for f in required_fields
        if f not in state.payload or state.payload.get(f) is None or not state.payload.get(f)
    ]

    # Also check that date conversion was successful
    if not state.payload.get("start_date") or not state.payload.get("end_date"):
        if "date_range" not in missing_fields:
            missing_fields.append("date_range")

    # Normalize status if present
    if state.payload.get("status"):
        status_val = str(state.payload["status"]).lower().strip()
        valid_statuses = ["generated", "scheduled", "published"]
        if status_val in valid_statuses:
            state.payload["status"] = status_val
        else:
            # Try to match variations
            if status_val in ["draft", "create", "new"]:
                state.payload["status"] = "generated"
            elif status_val in ["schedule", "pending"]:
                state.payload["status"] = "scheduled"
            elif status_val in ["publish", "posted", "live"]:
                state.payload["status"] = "published"
            else:
                state.payload["status"] = None

    if not missing_fields:
        state.payload_complete = True
        state.current_step = "action_execution"
        print(" Delete content payload complete - all fields and date conversion successful")
        return state

    next_field = missing_fields[0]
    clarification_data = clarifications.get(next_field, {})

    if isinstance(clarification_data, dict):
        base_question = clarification_data.get("question", f"Please provide: {next_field.replace('_', ' ')}")

        # Generate personalized question using LLM
        logger.info(f"Calling LLM for clarification question. Base: '{base_question}', User context length: {len(state.user_query or '')}")
        # Import generate_clarifying_question from atsn
        from .atsn import generate_clarifying_question
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
    print(f"? Clarification needed for delete_content: {state.clarification_question}")

    return state


def handle_delete_content(state) -> Any:
    """Display content for deletion selection"""
    payload = state.payload

    if not supabase:
        state.error = "Database connection not configured. Please contact support."
        state.result = "Unable to fetch content for deletion: Database not available."
        logger.error("Supabase not configured - cannot fetch content for deletion")
        return state

    # Ensure user_id is present for security
    if not state.user_id:
        state.error = "User ID is required to view content for deletion"
        state.result = "Unable to fetch content: User authentication required."
        logger.error("User ID missing in handle_delete_content")
        return state

    try:
        # Build query for created_content table - select all fields including uuid (id)
        query = supabase.table('created_content').select('*')

        # Security: Always filter by user_id (required)
        query = query.eq('user_id', state.user_id)

        # Apply filters from payload
        if payload.get('channel'):
            # Channel filter (Social Media, Blog, Email, Messages)
            query = query.eq('channel', payload['channel'])

        # Apply filters from payload - convert to lowercase for platform and status
        if payload.get('platform'):
            # Convert platform to lowercase to match schema (instagram, facebook, etc.)
            platform_filter = payload['platform'].lower().strip()
            query = query.eq('platform', platform_filter)

        if payload.get('status'):
            # Convert status to lowercase to match schema (generated, scheduled, published)
            status_filter = payload['status'].lower().strip()
            query = query.eq('status', status_filter)

        if payload.get('content_type'):
            query = query.eq('content_type', payload['content_type'])

        # Check if we have a semantic search query
        has_semantic_search = payload.get('query') and payload['query'].strip()

        if has_semantic_search:
            # Use semantic search instead of traditional filters
            search_query = payload['query'].strip()
            logger.info(f"Performing semantic search for deletion: '{search_query}'")

            # Perform text search on title and content columns
            # Use ilike for case-insensitive partial matching
            query = query.or_(f"title.ilike.%{search_query}%,content.ilike.%{search_query}%")

            # Apply any additional filters if present
            if payload.get('channel'):
                query = query.eq('channel', payload['channel'])
            if payload.get('platform'):
                platform_filter = payload['platform'].lower().strip()
                query = query.eq('platform', platform_filter)
            if payload.get('status'):
                status_filter = payload['status'].lower().strip()
                query = query.eq('status', status_filter)
            if payload.get('content_type'):
                query = query.eq('content_type', payload['content_type'])

        # Apply date range filter - use start_date and end_date directly
        if payload.get('start_date'):
            # Convert YYYY-MM-DD to PostgreSQL timestamp format (start of day)
            start_datetime = f"{payload['start_date']}T00:00:00.000Z"
            query = query.gte('created_at', start_datetime)

        if payload.get('end_date'):
            # Convert YYYY-MM-DD to PostgreSQL timestamp format (end of day)
            end_datetime = f"{payload['end_date']}T23:59:59.999Z"
            query = query.lte('created_at', end_datetime)

        # Order by most recent first
        query = query.order('created_at', desc=True)

        # For semantic search, limit results to avoid too many matches
        # For traditional filters, show more results
        if has_semantic_search:
            response = query.limit(50).execute()  # Limit semantic search results
        else:
            response = query.limit(100).execute()  # Allow more results for filtered searches

        logger.info(f"Delete content query executed: Found {len(response.data) if response.data else 0} items (semantic_search: {has_semantic_search})")

        if not response.data or len(response.data) == 0:
            # Generate personalized "no results" message
            if has_semantic_search:
                base_message = f"No content found matching your search for '{payload['query']}'. Try different keywords or check your filters."
            else:
                filters_desc = []
                if payload.get('channel'): filters_desc.append(f"channel: {payload['channel']}")
                if payload.get('platform'): filters_desc.append(f"platform: {payload['platform']}")
                if payload.get('status'): filters_desc.append(f"status: {payload['status']}")
                if payload.get('content_type'): filters_desc.append(f"type: {payload['content_type']}")
                if payload.get('start_date'): filters_desc.append(f"date from: {payload['start_date']}")
                if payload.get('end_date'): filters_desc.append(f"date to: {payload['end_date']}")

                if filters_desc:
                    base_message = f"No content found with the specified filters: {', '.join(filters_desc)}. Please adjust your criteria and try again."
                else:
                    base_message = "No content found. Please specify some search criteria and try again."

            state.result = base_message
            return state

        # Collect content_ids and structured content items for frontend selection
        content_items = []
        content_ids = []  # Store all content IDs for payload

        for idx, item in enumerate(response.data[:50], 1):  # Show up to 50 items for deletion
            # Get content_id (uuid) - store for payload
            content_id = item.get('id') or item.get('uuid')
            if content_id:
                content_ids.append(content_id)

            # Extract image URL from images array (first image if available)
            images = item.get('images', [])
            media_url = None
            if images and len(images) > 0:
                # Handle both string URLs and object formats
                first_image = images[0]
                if isinstance(first_image, str):
                    media_url = first_image
                elif isinstance(first_image, dict):
                    media_url = first_image.get('url') or first_image.get('image_url')

            # Format hashtags
            hashtags = item.get('hashtags', [])
            hashtag_text = ''
            if hashtags:
                if isinstance(hashtags, list):
                    hashtag_text = ' '.join([f"#{tag}" if not tag.startswith('#') else tag for tag in hashtags[:10]])
                else:
                    hashtag_text = str(hashtags)

            # Format date
            created_at = item.get('created_at', '')
            date_display = ''
            if created_at:
                try:
                    from datetime import datetime
                    dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                    date_display = dt.strftime('%B %d, %Y at %I:%M %p')
                except:
                    date_display = created_at[:10] if len(created_at) >= 10 else created_at

            # Get content text (try multiple field names)
            content_text = item.get('content') or item.get('content_text') or item.get('text', '')

            # Get title
            title = item.get('title', '')

            # Create structured content item for frontend deletion selection
            content_item = {
                'id': idx,
                'content_id': content_id,
                'platform': item.get('platform', 'Unknown').title(),
                'content_type': item.get('content_type', 'post').replace('_', ' ').title(),
                'status': item.get('status', 'unknown').title(),
                'created_at': date_display,
                'created_at_raw': created_at,  # Raw timestamp for sorting/filtering
                'title': title,
                'title_display': title,  # Full title for deletion
                'content_text': content_text,
                'content_preview': content_text[:150] + '...' if len(content_text) > 150 else content_text,
                'hashtags': hashtag_text,
                'hashtags_display': hashtag_text,  # Clean hashtags
                'media_url': media_url,
                'has_media': bool(media_url),
                'images': item.get('images', []),
                # Additional metadata for frontend
                'platform_emoji': {
                    'Instagram': '📸',
                    'Facebook': '👥',
                    'Linkedin': '💼',
                    'Youtube': '🎥',
                    'Gmail': '✉️',
                    'Whatsapp': '💬'
                }.get(item.get('platform', 'Unknown').title(), '🌐'),
                'status_emoji': {
                    'Generated': '📝',
                    'Scheduled': '⏰',
                    'Published': '✅'
                }.get(item.get('status', 'unknown').title(), '📄'),
                'status_color': {
                    'Generated': 'blue',
                    'Scheduled': 'orange',
                    'Published': 'green'
                }.get(item.get('status', 'unknown').title(), 'gray'),
                # Raw data for advanced frontend features
                'metadata': item.get('metadata', {}),
                'raw_data': item  # Full original item for debugging
            }

            content_items.append(content_item)

        total_count = len(response.data)
        showing = len(content_items)

        # Set structured content data for frontend
        state.content_items = content_items

        # Append content_ids to payload for frontend
        if content_ids:
            state.payload['content_ids'] = content_ids
            state.payload['content_count'] = total_count

        # Format date range display
        date_display = payload.get('start_date', 'All')
        if payload.get('start_date') and payload.get('end_date'):
            start_date = payload.get('start_date')
            end_date = payload.get('end_date')
            if start_date == end_date:
                try:
                    from datetime import datetime
                    date_obj = datetime.strptime(start_date, '%Y-%m-%d')
                    date_display = date_obj.strftime('%B %d, %Y')
                except:
                    date_display = start_date
            else:
                date_display = f"{start_date} to {end_date}"

        # Format status display
        status = payload.get('status')
        status_display = status.title() if status else 'Any Status'

        # Build beautiful, concise result message
        channel = payload.get('channel', 'content')
        platform = payload.get('platform', '')
        content_type = payload.get('content_type', '')
        date_info = date_display

        # Format the message components
        if platform:
            platform_str = f"{platform} "
        else:
            platform_str = ""

        if content_type:
            content_type_str = f"{content_type} "
        else:
            content_type_str = ""

        result = f"""These are your {channel} {platform_str}{content_type_str}from {date_info}.

Select the items you want to delete from the list below."""

        if total_count > showing:
            result += f"\n\nShowing {showing} of {total_count} items."

        # Generate personalized success message
        # Import generate_personalized_message from atsn
        from .atsn import generate_personalized_message
        state.result = generate_personalized_message(
            base_message=result,
            user_context=state.user_query,
            message_type="success"
        )

        # Log final state for debugging
        logger.info(f"Delete content: Found {total_count} items for deletion selection")
        logger.info(f"Delete content payload content_ids: {content_ids[:5]}...")  # Log first 5 IDs

    except Exception as e:
        error_msg = f"Failed to fetch content for deletion: {str(e)}"
        state.error = error_msg
        state.result = f"Error: {error_msg}\n\nPlease try again or contact support if the issue persists."
        logger.error(f"Database query failed in handle_delete_content: {str(e)}", exc_info=True)

    return state