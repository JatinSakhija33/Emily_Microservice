"""
View Content Functions - Extracted from ATSN Agent
Contains construct, complete, and handle functions for viewing content.
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
    "view_content": {
        "channel": {
            "question": "Which channel would you like to explore? I can show you your content in Social Media, Blog, Email, or Messages.",
            "options": [
                {"label": "Social Media", "value": "Social Media"},
                {"label": "Blog", "value": "Blog"}
            ]
        },
        "platform": {
            "question": "Which platform would you like to explore? I can show you your content on Instagram, Facebook, LinkedIn, YouTube, Gmail, or WhatsApp.",
            "options": [
                {"label": "Instagram", "value": "Instagram"},
                {"label": "Facebook", "value": "Facebook"},
                {"label": "LinkedIn", "value": "LinkedIn"},
                {"label": "YouTube", "value": "YouTube"}
            ]
        },
        "date_range": {
            "question": "Which time period would you like to explore? I can show you content from Today, This week, Last week, Yesterday, or you can specify a custom date.",
            "options": [
                {"label": "Today", "value": "today"},
                {"label": "This week", "value": "this week"},
                {"label": "Last week", "value": "last week"},
                {"label": "Yesterday", "value": "yesterday"},
                {"label": "Custom date", "value": "show_date_picker"}
            ]
        },
        "status": {
            "question": "Which content status would you like to see? I can filter by Generated (drafts), Scheduled (waiting to publish), or Published (already posted).",
            "options": [
                {"label": "Generated", "value": "generated"},
                {"label": "Scheduled", "value": "scheduled"},
                {"label": "Published", "value": "published"}
            ]
        },
        "content_type": {
            "question": "Which content type would you like to explore? I can show you Static Posts, Carousel Posts, Reels, Short Videos, Long Videos, or Blog Posts.",
            "options": [
                {"label": "Image Posts", "value": "static_post"},
                {"label": "Carousel Posts", "value": "carousel"},
                {"label": "Reels", "value": "reel"},
                {"label": "Short Videos", "value": "short_video"},
                {"label": "Long Videos", "value": "long_video"},
                {"label": "Blog Posts", "value": "blog"}
            ]
        },
    }
}

# ==================== IMPORTED FUNCTIONS FROM ATSN ====================

# These functions need to be imported from atsn when using this module
# - _extract_payload
# - generate_clarifying_question
# - generate_personalized_message

# ==================== FUNCTIONS ====================

def construct_view_content_payload(state) -> Any:
    """Construct payload for view content task"""

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

    prompt = f"""You are extracting information to view/list content from the database.

Current date reference: Today is {current_date}
User timezone: {user_timezone}

User conversation:
{conversation}

Extract these fields ONLY if explicitly mentioned:
- channel: "Social Media" or "Blog"
- platform: "Instagram", "Facebook", "LinkedIn", or "Youtube"
- date_range: PARSE dates into YYYY-MM-DD format (e.g., "2025-12-27") or date ranges like "2025-12-20 to 2025-12-27"
- status: "generated", "scheduled", or "published"
- content_type: "static_post", "carousel", "reel", "short_video", "long_video", "blog" (set to null if the user just says "posts")
- query: Any search terms or phrases the user wants to search for in content (e.g., "posts for new year", "christmas content", "product launch")
- all: Set to true if user wants to see ALL posts without any limits (e.g., "show all posts", "all posts", "every post")

CRITICAL DATE PARSING RULES:
- Parse ALL date mentions into YYYY-MM-DD format without errors
- "today" → current date in YYYY-MM-DD format
- "yesterday" → yesterday's date in YYYY-MM-DD format
- "tomorrow" → tomorrow's date in YYYY-MM-DD format
- "this week" → current week range (Monday to current day)
- "last week" → previous week range (Monday to Sunday)
- "this month" → current month range (1st to current day)
- "last month" → previous month range (1st to last day)
- "last_7_days" → date range for last 7 days
- "last_30_days" → date range for last 30 days
- Specific dates like "27 december" → "YYYY-12-27" (use current year)
- For date ranges, use format "YYYY-MM-DD to YYYY-MM-DD"
- If no date mentioned, set date_range to null
- NEVER leave date parsing incomplete - always convert to proper format

CRITICAL QUERY EXTRACTION:
- Extract search queries that indicate what content the user is looking for
- Examples: "posts for new year", "christmas content", "summer sale posts", "product launch videos"
- Set query field to the search phrase if user wants to find content by topic/theme
- If no specific search query mentioned, set query to null

CONTENT TYPE CLASSIFICATION RULES:
1. Set content_type to null if the user just says "posts" or "content" without specifying a subtype.
2. Only set content_type if the user explicitly mentions one of: "static post" (→ static_post), "carousel post" (→ carousel), "reel" (→ reel), "short video" (→ short_video), "long video" (→ long_video), or "blog post" (→ blog).
3. Generic mention of "videos" defaults to "long_video" unless clarified as "short" or "reel".
4. Do NOT classify general "posts" as "static_post"; leave content_type null when unclear.

CRITICAL RULES:
1. Set fields to null if NOT explicitly mentioned in the conversation
2. DO NOT infer or assume values—only extract what the user explicitly stated
3. If user says "view content" without mentioning status, set status to null
4. If user says "show posts" without mentioning status, set status to null
5. Only set status to "published" if the user explicitly says "published", "posted", "live", etc.
6. Only set status to "scheduled" if the user explicitly says "scheduled", "scheduled posts", etc.
7. Only set status to "generated" if the user explicitly says "generated", "draft", "created", etc.
8. Extract search queries like "posts about new year", "christmas content", "summer campaigns"
9. IMPORTANT: When the user responds with single words, parse dates correctly:
   - "yesterday" → date_range: yesterday's date
   - "today" → date_range: today's date
   - "tomorrow" → date_range: tomorrow's date
   - "this week" → date_range: current week range
   - "last week" → date_range: previous week range
   - "this month" → date_range: current month range
   - "last month" → date_range: previous month range
   - Specific dates like "december 12" → parse to appropriate date
   - "Instagram" → platform: "Instagram"
   - "Facebook" → platform: "Facebook"
   - "Social Media" → channel: "Social Media"
   - "static post" → content_type: "static_post"
   - "carousel" → content_type: "carousel"
   - "reel" → content_type: "reel"
   - "short video" → content_type: "short_video"
   - "long video" → content_type: "long_video"
   - "blog" → content_type: "blog"
10. Preserve existing payload values—only update fields that are explicitly mentioned in the current response


Extract ONLY explicitly mentioned information. Set fields to null if not mentioned.
DO NOT infer status - only set it if user explicitly mentions "published", "scheduled", "generated", "draft", etc.
When user responds with single words like "yesterday", "today", "Instagram", extract them into the correct field.

CRITICAL: You MUST respond with ONLY a valid JSON object. Do NOT include any explanatory text, comments, or additional text before or after the JSON.
Your response must start with {{ and end with }}. No other text is allowed.

Return ONLY this format:
{{
    "channel": null or "Social Media" or "Blog",
    "platform": null or "Instagram" or "Facebook" or "LinkedIn" or "Youtube",
    "date_range": null or "YYYY-MM-DD" or "YYYY-MM-DD to YYYY-MM-DD",
    "status": null or "generated" or "scheduled" or "published",
    "content_type": null or "post" or "short_video" or "long_video" or "blog",
    "query": null or "search phrase",
    "all": null or true
}}"""

    # Import _extract_payload from atsn
    from .atsn import _extract_payload
    return _extract_payload(state, prompt)


def complete_view_content_payload(state) -> Any:
    """Complete view_content payload - ALL fields required before proceeding, except when search query is provided"""
    # If payload is already complete, don't check again
    if state.payload_complete:
        logger.info("Payload already complete, skipping completion check")
        state.current_step = "action_execution"
        return state

    # Give priority to "all" requests - if all is true, skip clarifying questions
    if state.payload.get('all') and state.payload['all'] is True:
        logger.info("'All posts' detected, skipping clarifying questions and proceeding with unlimited search")
        state.payload_complete = True
        state.current_step = "action_execution"
        print(" View content payload complete - 'all posts' requested, proceeding without clarifications")
        print(f"  Final payload: {state.payload}")
        return state

    # Give priority to search queries - if query is present, skip clarifying questions
    if state.payload.get('query') and state.payload['query'].strip():
        logger.info("Search query detected, skipping clarifying questions and proceeding with search")
        state.payload_complete = True
        state.current_step = "action_execution"
        print(" View content payload complete - search query provided, proceeding without clarifications")
        print(f"  Final payload: {state.payload}")
        return state

    required_fields = ["channel", "platform", "date_range", "status", "content_type"]
    clarifications = FIELD_CLARIFICATIONS.get("view_content", {})

    # Convert date_range to start_date and end_date if present
    if state.payload.get("date_range") and state.payload["date_range"]:
        date_range = str(state.payload["date_range"]).strip()

        # First try natural language date parsing (yesterday, today, this week, etc.)
        date_filter = _get_date_range_filter(date_range)

        if not date_filter:
            # Fall back to YYYY-MM-DD format parsing
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

    # Normalize platform if present (handle case)
    if state.payload.get("platform"):
        platform_val = str(state.payload["platform"]).strip()
        valid_platforms = ["Instagram", "Facebook", "LinkedIn", "Youtube"]
        # Keep original case for platform (it's used as-is in queries)
        if platform_val.title() in [p.title() for p in valid_platforms]:
            state.payload["platform"] = platform_val
        else:
            # Try to match common variations
            platform_lower = platform_val.lower()
            if platform_lower in ["instagram", "ig"]:
                state.payload["platform"] = "Instagram"
            elif platform_lower in ["facebook", "fb"]:
                state.payload["platform"] = "Facebook"
            elif platform_lower in ["linkedin", "li"]:
                state.payload["platform"] = "LinkedIn"
            elif platform_lower in ["youtube", "yt"]:
                state.payload["platform"] = "Youtube"

    # Normalize channel if present
    if state.payload.get("channel"):
        channel_val = str(state.payload["channel"]).strip()
        valid_channels = ["Social Media", "Blog"]
        if channel_val in valid_channels:
            state.payload["channel"] = channel_val
        else:
            # Try to match variations
            channel_lower = channel_val.lower()
            if "social" in channel_lower or "media" in channel_lower:
                state.payload["channel"] = "Social Media"
            elif channel_lower == "blog":
                state.payload["channel"] = "Blog"

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

    # Normalize content_type if present
    if state.payload.get("content_type"):
        content_type_val = str(state.payload["content_type"]).lower().strip()
        valid_types = ["static_post", "carousel", "reel", "short_video", "long_video", "blog"]
        if content_type_val in valid_types:
            state.payload["content_type"] = content_type_val
        else:
            # Try to match variations
            if content_type_val in ["static", "static post", "image post", "photo post", "posts", "post"]:
                state.payload["content_type"] = "static_post"
            elif content_type_val in ["carousel", "carousel post", "multiple images"]:
                state.payload["content_type"] = "carousel"
            elif content_type_val in ["reel", "short video", "instagram reel"]:
                state.payload["content_type"] = "reel"
            elif "short" in content_type_val and "video" in content_type_val:
                state.payload["content_type"] = "short_video"
            elif "long" in content_type_val and "video" in content_type_val:
                state.payload["content_type"] = "long_video"
            elif content_type_val == "blog":
                state.payload["content_type"] = "blog"
            else:
                state.payload["content_type"] = None

    missing_fields = [
        f for f in required_fields
        if f not in state.payload or state.payload.get(f) is None or not state.payload.get(f)
    ]

    if not missing_fields:
        state.payload_complete = True
        state.current_step = "action_execution"
        print(" View content payload complete - all fields provided")
        print(f"  Final payload: {state.payload}")
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
    print(f"? Clarification needed for view_content: {state.clarification_question}")

    return state


def handle_view_content(state) -> Any:
    """View content from created_content table with rich formatting similar to dashboard"""
    payload = state.payload

    if not supabase:
        state.error = "Database connection not configured. Please contact support."
        state.result = "Unable to fetch content: Database not available."
        logger.error("Supabase not configured - cannot fetch content")
        return state

    # Ensure user_id is present for security
    if not state.user_id:
        state.error = "User ID is required to view content"
        state.result = "Unable to fetch content: User authentication required."
        logger.error("User ID missing in handle_view_content")
        return state

    try:
        # Build query for created_content table - select all fields including uuid (id)
        query = supabase.table('created_content').select('*')

        # Security: Always filter by user_id (required)
        query = query.eq('user_id', state.user_id)

        # Check if we have a semantic search query
        has_semantic_search = payload.get('query') and payload['query'].strip()

        if has_semantic_search:
            # Use semantic search instead of traditional filters
            search_query = payload['query'].strip()
            logger.info(f"Performing semantic search for query: '{search_query}'")

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

        else:
            # Use traditional filters
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

        # Apply date range filter using start_date and end_date directly
        if payload.get('start_date'):
            start_date = payload['start_date']
            # Check if it's already a full timestamp (contains 'T') or just a date
            if 'T' in start_date:
                # Already a full timestamp from _get_date_range_filter
                start_datetime = start_date
            else:
                # YYYY-MM-DD format from _parse_date_range_format, add time components
                start_datetime = f"{start_date}T00:00:00.000Z"
            query = query.gte('created_at', start_datetime)

        if payload.get('end_date'):
            end_date = payload['end_date']
            # Check if it's already a full timestamp (contains 'T') or just a date
            if 'T' in end_date:
                # Already a full timestamp from _get_date_range_filter
                end_datetime = end_date
            else:
                # YYYY-MM-DD format from _parse_date_range_format, add time components
                end_datetime = f"{end_date}T23:59:59.999Z"
            query = query.lte('created_at', end_datetime)

        # Order by creation date (newest first) and limit results
        query = query.order('created_at', desc=True)

        # Check if user wants to see ALL posts without limits
        show_all_posts = payload.get('all') and payload['all'] is True

        # For semantic search, limit results to avoid too many matches
        # For traditional filters, show more results
        # But if user wants ALL posts, don't apply any limits
        if show_all_posts:
            result = query.execute()  # No limit when showing all posts
            logger.info("Showing ALL posts without limits")
        elif has_semantic_search:
            result = query.limit(50).execute()  # Limit semantic search results
        else:
            result = query.limit(100).execute()  # Allow more results for filtered searches

        logger.info(f"View content query executed: Found {len(result.data) if result.data else 0} items (semantic_search: {has_semantic_search})")

        if not result.data or len(result.data) == 0:
            # Generate personalized "no results" message
            if has_semantic_search:
                base_message = f"No content found matching your search for '{payload['query']}'. Try different keywords or check your filters."
            else:
                filters_desc = []
                if payload.get('channel'): filters_desc.append(f"channel: {payload['channel']}")
                if payload.get('platform'): filters_desc.append(f"platform: {payload['platform']}")
                if payload.get('status'): filters_desc.append(f"status: {payload['status']}")
                if payload.get('content_type'): filters_desc.append(f"type: {payload['content_type']}")
                if payload.get('start_date') or payload.get('end_date'):
                    date_desc = ""
                    if payload.get('start_date'): date_desc += f"from {payload['start_date']}"
                    if payload.get('end_date'): date_desc += f" to {payload['end_date']}"
                    filters_desc.append(f"date: {date_desc.strip()}")

                filters_text = ", ".join(filters_desc) if filters_desc else "no filters applied"
                base_message = f"No content found with the specified filters ({filters_text}). Try adjusting your search criteria."

            # Import generate_personalized_message from atsn
            from .atsn import generate_personalized_message
            state.result = generate_personalized_message(
                base_message=base_message,
                user_context=state.user_query,
                message_type="info"
            )
            return state

        # Process content items for display
        content_items = []
        content_ids = []  # Store all content IDs for payload
        total_count = len(result.data)

        # Show fewer items for semantic search to avoid overwhelming results
        # But show ALL items when user requests "all posts"
        show_all_posts = payload.get('all') and payload['all'] is True
        if show_all_posts:
            showing = total_count  # Show all items when "all" is requested
        else:
            showing = min(total_count, 20 if has_semantic_search else 50)

        for idx, item in enumerate(result.data[:showing], 1):
            # Debug logging for images field
            logger.info(f"Content item {idx}: has images field: {'images' in item}, images value: {item.get('images', 'NOT_FOUND')}")

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

            # Process content for display
            processed_title = title
            if title and len(title) > 60:
                processed_title = title[:60] + '...'

            processed_content = content_text
            if content_text:
                # Clean up line breaks and extra spaces
                processed_content = ' '.join(content_text.split())
                if len(processed_content) > 150:
                    processed_content = processed_content[:150] + '...'

            processed_hashtags = hashtag_text
            if hashtag_text:
                processed_hashtags = hashtag_text.replace(' #', ' #')

            # Create structured content item for frontend card rendering
            content_item = {
                'id': idx,
                'content_id': content_id,
                'platform': item.get('platform', 'Unknown').title(),
                'content_type': item.get('content_type', 'post').replace('_', ' ').title(),
                'status': item.get('status', 'unknown').title(),
                'created_at': date_display,
                'created_at_raw': created_at,  # Raw timestamp for sorting/filtering
                'title': title,
                'title_display': processed_title,  # Truncated for display
                'content_text': content_text,
                'content_preview': processed_content,  # Processed preview
                'hashtags': hashtag_text,
                'hashtags_display': processed_hashtags,  # Clean hashtags
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

            # Debug logging for content_item
            logger.info(f"Content item {idx} created with images: {content_item.get('images', 'MISSING')}")

            content_items.append(content_item)

        total_count = len(result.data)
        showing = len(content_items)

        # Append content_ids to payload for chatbot
        if content_ids:
            state.payload['content_ids'] = content_ids
            state.payload['content_count'] = total_count
            # Set content_id in AgentState (first content ID if multiple results)
            state.content_id = content_ids[0] if len(content_ids) > 0 else None
            # Also add to payload for backward compatibility
            state.payload['content_id'] = content_ids[0] if len(content_ids) > 0 else None

        # Set structured content data for frontend
        state.content_items = content_items

        # Format summary message with proper grammar and action instructions
        summary_message = _format_view_content_summary(payload, total_count)

        # Build result with summary only (frontend will render cards)
        result = summary_message
        if total_count > showing:
            result += f"\n\nShowing {showing} of {total_count} items."

        # Generate personalized success message
        # Import generate_personalized_message from atsn
        from .atsn import generate_personalized_message
        personalized_result = generate_personalized_message(
            base_message=result,
            user_context=state.user_query,
            message_type="success"
        )

        state.result = personalized_result

        # Log final state for debugging
        logger.info(f"View content: Found {total_count} items, added {len(content_ids)} content_ids to payload")
        logger.info(f"View content result set: {len(state.result) if state.result else 0} characters")
        logger.info(f"View content payload keys: {list(state.payload.keys())}")
        logger.info(f"View content payload content_ids: {state.payload.get('content_ids', [])}")

    except Exception as e:
        error_msg = f"Failed to fetch content: {str(e)}"
        state.error = error_msg
        state.result = f"Error: {error_msg}\n\nPlease try again or contact support if the issue persists."
        logger.error(f"Database query failed in handle_view_content: {str(e)}", exc_info=True)

    return state


def _format_view_content_summary(payload: Dict[str, Any], count: int) -> str:
    """Format a human-readable summary message for view content results"""
    from datetime import datetime, timedelta

    # Format status
    status = payload.get('status', '').lower() if payload.get('status') else ''
    status_display = ''
    if status == 'generated':
        status_display = 'generated'
    elif status == 'scheduled':
        status_display = 'scheduled'
    elif status == 'published':
        status_display = 'published'
    else:
        status_display = 'content'

    # Format channel
    channel = payload.get('channel', '').lower() if payload.get('channel') else ''
    channel_display = ''
    if channel == 'social media':
        channel_display = 'social media'
    elif channel == 'blog':
        channel_display = 'blog'
    elif channel == 'email':
        channel_display = 'email'
    elif channel == 'messages':
        channel_display = 'messages'
    else:
        channel_display = 'content'

    # Format content type with proper pluralization
    content_type = payload.get('content_type', '').lower() if payload.get('content_type') else ''
    content_type_display = ''
    if content_type in ['static_post', 'carousel']:
        content_type_display = 'post' if count == 1 else 'posts'
    elif content_type == 'short_video or reel':
        content_type_display = 'short video' if count == 1 else 'short videos'
    elif content_type == 'long_video':
        content_type_display = 'long video' if count == 1 else 'long videos'
    elif content_type == 'blog':
        content_type_display = 'blog post' if count == 1 else 'blog posts'
    else:
        content_type_display = 'item' if count == 1 else 'items'

    # Format platform
    platform = payload.get('platform', '')
    platform_display = platform if platform else ''

    # Format date range using the original date_range concept
    date_range = payload.get('date_range', '').lower() if payload.get('date_range') else ''
    date_display = ''

    # Show the natural language date concept, not calculated dates
    if date_range:
        if date_range == 'today':
            date_display = "for today"
        elif date_range == 'yesterday':
            date_display = "for yesterday"
        elif date_range == 'this week':
            date_display = "for this week"
        elif date_range == 'last week':
            date_display = "for last week"
        elif date_range == 'custom date':
            # For custom dates, we might have start_date/end_date
            start_date = payload.get('start_date')
            end_date = payload.get('end_date')
            if start_date and end_date and start_date == end_date:
                try:
                    date_obj = datetime.strptime(start_date, '%Y-%m-%d')
                    date_display = f"for {date_obj.strftime('%m/%d/%y')}"
                except:
                    date_display = f"for {start_date}"
            else:
                date_display = f"for {date_range}"
        else:
            # For other custom date formats like "december 12", show as-is
            date_display = f"for {date_range}"
    else:
        date_display = ""

    # Build the summary message with proper grammar
    parts = []

    # Check if this is a semantic search result or "all posts" request
    has_query = payload.get('query') and payload['query'].strip()
    show_all_posts = payload.get('all') and payload['all'] is True

    if show_all_posts:
        # For "all posts" requests, show a special summary
        parts.append(f"You have ALL {count}")
        parts.append("item" if count == 1 else "items")
        parts.append("in your content library")

        # Add any filters that were applied
        filter_parts = []
        if status_display != 'content':
            filter_parts.append(f"status: {status_display}")
        if channel_display != 'content':
            filter_parts.append(f"channel: {channel_display}")
        if content_type_display != 'items':
            filter_parts.append(f"type: {content_type_display}")
        if platform_display:
            filter_parts.append(f"platform: {platform_display}")

        if filter_parts:
            parts.append(f"({', '.join(filter_parts)})")

    elif has_query:
        # For semantic search results
        parts.append(f"Found {count}")
        parts.append("result" if count == 1 else "results")
        parts.append(f"for your search '{payload['query']}'")

        # Add filters if they were applied
        filter_parts = []
        if status_display != 'content':
            filter_parts.append(f"status: {status_display}")
        if channel_display != 'content':
            filter_parts.append(f"channel: {channel_display}")
        if content_type_display != 'items':
            filter_parts.append(f"type: {content_type_display}")
        if platform_display:
            filter_parts.append(f"platform: {platform_display}")

        if filter_parts:
            parts.append(f"filtered by {', '.join(filter_parts)}")

    else:
        # For traditional filter results
        if status_display != 'content':
            parts.append(f"Found {count}")
            parts.append(status_display)
            if content_type_display != 'items':
                parts.append(content_type_display)
            elif channel_display != 'content':
                parts.append(channel_display)
                parts.append("item" if count == 1 else "items")
            else:
                parts.append("item" if count == 1 else "items")
        else:
            parts.append(f"Found {count}")
            if content_type_display != 'items':
                parts.append(content_type_display)
            elif channel_display != 'content':
                parts.append(channel_display)
                parts.append("item" if count == 1 else "items")
            else:
                parts.append("item" if count == 1 else "items")

        # Add platform if specified
        if platform_display:
            parts.append(f"for {platform_display}")

        # Add date range
        if date_display:
            parts.append(date_display)

    # Join all parts and ensure proper grammar
    summary = " ".join(parts)

    # Add action instructions for multiple results
    if count > 1:
        if has_query:
            summary += ". You can refine your search or select a specific item to edit/publish."
        elif show_all_posts:
            summary += ". You can select any item to edit, publish, or schedule."
        else:
            summary += ". You can select a specific item to edit, publish, or schedule."

    return summary


def _get_date_range_filter(date_range: str) -> Optional[Dict[str, str]]:
    """Convert date range string to start/end dates for PostgreSQL timestamp filtering"""
    from datetime import datetime, timedelta

    now = datetime.now()
    date_range_lower = date_range.lower().strip()

    if date_range_lower == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end = now.replace(hour=23, minute=59, second=59, microsecond=999999)
        return {"start": start.isoformat(), "end": end.isoformat()}

    elif date_range_lower == "yesterday":
        yesterday = now - timedelta(days=1)
        start = yesterday.replace(hour=0, minute=0, second=0, microsecond=0)
        end = yesterday.replace(hour=23, minute=59, second=59, microsecond=999999)
        return {"start": start.isoformat(), "end": end.isoformat()}

    elif date_range_lower == "tomorrow":
        tomorrow = now + timedelta(days=1)
        start = tomorrow.replace(hour=0, minute=0, second=0, microsecond=0)
        end = tomorrow.replace(hour=23, minute=59, second=59, microsecond=999999)
        return {"start": start.isoformat(), "end": end.isoformat()}

    elif date_range_lower == "this week":
        # Start of current week (Monday)
        days_since_monday = now.weekday()
        start = now - timedelta(days=days_since_monday)
        start = start.replace(hour=0, minute=0, second=0, microsecond=0)
        end = now.replace(hour=23, minute=59, second=59, microsecond=999999)
        return {"start": start.isoformat(), "end": end.isoformat()}

    elif date_range_lower == "last week":
        # Previous week (Monday to Sunday)
        days_since_monday = now.weekday()
        last_monday = now - timedelta(days=days_since_monday + 7)
        start = last_monday.replace(hour=0, minute=0, second=0, microsecond=0)
        last_sunday = last_monday + timedelta(days=6)
        end = last_sunday.replace(hour=23, minute=59, second=59, microsecond=999999)
        return {"start": start.isoformat(), "end": end.isoformat()}

    elif date_range_lower == "this month":
        # Current month (1st to today)
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end = now.replace(hour=23, minute=59, second=59, microsecond=999999)
        return {"start": start.isoformat(), "end": end.isoformat()}

    elif date_range_lower == "last month":
        # Previous month (1st to last day)
        first_of_this_month = now.replace(day=1)
        last_of_last_month = first_of_this_month - timedelta(days=1)
        first_of_last_month = last_of_last_month.replace(day=1)
        start = first_of_last_month.replace(hour=0, minute=0, second=0, microsecond=0)
        end = last_of_last_month.replace(hour=23, minute=59, second=59, microsecond=999999)
        return {"start": start.isoformat(), "end": end.isoformat()}

    elif date_range_lower == "last_7_days":
        # Last 7 days including today
        start = (now - timedelta(days=6)).replace(hour=0, minute=0, second=0, microsecond=0)
        end = now.replace(hour=23, minute=59, second=59, microsecond=999999)
        return {"start": start.isoformat(), "end": end.isoformat()}

    elif date_range_lower == "last_30_days":
        # Last 30 days including today
        start = (now - timedelta(days=29)).replace(hour=0, minute=0, second=0, microsecond=0)
        end = now.replace(hour=23, minute=59, second=59, microsecond=999999)
        return {"start": start.isoformat(), "end": end.isoformat()}

    elif date_range_lower == "custom date":
        # For custom dates, return None - will need to be handled separately
        return None

    return None


def _parse_date_range_format(date_range: str) -> Optional[Dict[str, str]]:
    """Parse YYYY-MM-DD format dates and ranges into start/end dates for filtering"""
    from datetime import datetime

    date_range = date_range.strip()

    # Handle single date: "2025-12-27"
    if len(date_range) == 10 and date_range.count('-') == 2:
        try:
            # Validate the date format
            datetime.strptime(date_range, '%Y-%m-%d')
            return {"start": date_range, "end": date_range}
        except ValueError:
            return None

    # Handle date range: "2025-12-23 to 2025-12-27"
    if ' to ' in date_range:
        try:
            start_str, end_str = date_range.split(' to ')
            start_str = start_str.strip()
            end_str = end_str.strip()

            # Validate both dates
            datetime.strptime(start_str, '%Y-%m-%d')
            datetime.strptime(end_str, '%Y-%m-%d')

            return {"start": start_str, "end": end_str}
        except (ValueError, AttributeError):
            return None

    return None


def _generate_mock_view_content(payload: Dict[str, Any]) -> str:
    """Generate mock content list for testing without database"""

    # Mock data
    mock_content = [
        {
            "id": "CONTENT_001",
            "platform": payload.get('platform', 'Instagram'),
            "content_type": payload.get('content_type', 'post'),
            "status": payload.get('status', 'generated'),
            "created_at": "2025-12-24",
            "content_text": "Exciting AI trends for 2025! Discover how artificial intelligence is transforming..."
        },
        {
            "id": "CONTENT_002",
            "platform": payload.get('platform', 'LinkedIn'),
            "content_type": payload.get('content_type', 'post'),
            "status": payload.get('status', 'published'),
            "created_at": "2025-12-23",
            "content_text": "Top 10 productivity hacks for remote workers. Boost your efficiency with these..."
        },
        {
            "id": "CONTENT_003",
            "platform": payload.get('platform', 'Facebook'),
            "content_type": payload.get('content_type', 'short_video'),
            "status": payload.get('status', 'scheduled'),
            "created_at": "2025-12-22",
            "content_text": "Video: Sustainable fashion trends you need to know about in 2025..."
        },
    ]

    content_list = []
    for idx, item in enumerate(mock_content, 1):
        content_list.append(f"""
{idx}. {item['content_type'].title().replace('_', ' ')} - {item['platform']}
   Status: {item['status'].upper()}
   Created: {item['created_at']}
   ID: {item['id']}
   Preview: {item['content_text'][:100]}...
""")

    return f"""Viewing Content (Mock Data)

Filters:
- Channel: {payload.get('channel', 'All')}
- Platform: {payload.get('platform', 'All')}
- Status: {payload.get('status', 'All')}
- Content Type: {payload.get('content_type', 'All')}
- Date Range: {payload.get('date_range', 'All time')}
- Search Query: {payload.get('query', 'None')}

Results ({len(mock_content)} items):
{''.join(content_list)}

Use the buttons below to edit, publish, or schedule any content item."""
