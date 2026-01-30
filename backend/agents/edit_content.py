"""
Edit Content Functions - Extracted from ATSN Agent
Contains construct, complete, and handle functions for editing content.
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
    "edit_content": {
        "channel": {
            "question": "Which channel contains the content you want to edit? I can help you edit content in Social Media, Blog, Email, or Messages.",
            "options": [
                {"label": "Social Media", "value": "Social Media"},
                {"label": "Blog", "value": "Blog"}
            ]
        },
        "platform": {
            "question": "Which platform is your content on? I can help you edit content from Instagram, Facebook, LinkedIn, YouTube, Gmail, or WhatsApp.",
            "options": [
                {"label": "Instagram", "value": "Instagram"},
                {"label": "Facebook", "value": "Facebook"},
                {"label": "LinkedIn", "value": "LinkedIn"},
                {"label": "YouTube", "value": "YouTube"}
            ]
        },
        "date_range": {
            "question": "When was the content created? I can help you find content from Today, This week, Last week, Yesterday, or you can specify a custom date range.",
            "options": [
                {"label": "Today", "value": "today"},
                {"label": "This week", "value": "this week"},
                {"label": "Last week", "value": "last week"},
                {"label": "Yesterday", "value": "yesterday"},
                {"label": "Custom date", "value": "show_date_picker"}
            ]
        },
        "status": {
            "question": "What status is the content you're looking to edit? I can help you edit Generated (drafts), Scheduled (waiting to publish), or Published content.",
            "options": [
                {"label": "Generated/Drafts", "value": "generated"},
                {"label": "Scheduled", "value": "scheduled"},
                {"label": "Published", "value": "published"}
            ]
        },
        "content_type": {
            "question": "What type of content would you like to edit? I can help you edit Posts, Short videos, Long videos, Blogs, Emails, or Messages.",
            "options": [
                {"label": "Post", "value": "post"},
                {"label": "Short video", "value": "short_video"},
                {"label": "Long video", "value": "long_video"},
                {"label": "Blog", "value": "blog"},
                {"label": "Email", "value": "email"},
                {"label": "Message", "value": "message"}
            ]
        },
        "query": {
            "question": "You can also search for specific content by keywords. What would you like to search for? (Leave empty to see all matching content)",
            "options": []
        },
        "edit_instruction": {
            "question": "Perfect! What changes would you like to make to this content? Feel free to describe exactly what you want to update, change, or improve!",
            "options": []
        },
    }
}

# ==================== IMPORTED FUNCTIONS FROM ATSN ====================

# These functions need to be imported from atsn when using this module
# - _extract_payload
# - generate_clarifying_question
# - generate_personalized_message
# - _get_date_range_filter
# - _parse_date_range_format

# Functions will be imported locally to avoid circular imports

# ==================== FUNCTIONS ====================

def construct_edit_content_payload(state) -> Any:
    """Construct payload for edit content task"""

    # Use user_query which contains the full conversation context
    conversation = state.user_query

    prompt = f"""You are extracting information for editing content. The user may be:
1. Searching for content to edit (provide filters to find content)
2. Selecting specific content and providing edit instructions (provide content_id and edit_instruction)

User conversation:
{conversation}

Extract these fields if mentioned:
- channel: "Social Media" or "Blog"
- platform: "Instagram", "Facebook", "LinkedIn", or "Youtube"
- date_range: Natural language date like "yesterday", "today", "this week", "last week"
- status: "generated", "scheduled", or "published"
- content_type: "post", "short_video", "long_video", "blog", "email"
- content_id: Specific content identifier (UUID) if user selects specific content
- query: Search keywords for finding content
- edit_instruction: What changes to make to the content

CONTENT SELECTION PATTERNS:
- "content 1", "content 2", "edit content 3" → refers to content shown in numbered list (will be mapped to actual content_id)
- "the Instagram post", "the Facebook post" → refers to specific content by description
- Specific UUID or content ID → direct content selection
- "content_1", "content_2" → direct content reference by number

Examples:

Query: "Edit my Instagram post from yesterday"
{{
    "channel": "Social Media",
    "platform": "Instagram",
    "date_range": "yesterday",
    "content_type": "post",
    "content_id": null,
    "query": null,
    "edit_instruction": null
}}

Query: "Edit content 1 to add more emojis"
{{
    "content_id": "content_1",
    "edit_instruction": "add more emojis",
    "channel": null,
    "platform": null,
    "date_range": null,
    "status": null,
    "content_type": null,
    "query": null
}}

Query: "Change the LinkedIn post about AI to be more professional"
{{
    "platform": "LinkedIn",
    "query": "AI",
    "edit_instruction": "make more professional",
    "content_id": null,
    "channel": null,
    "date_range": null,
    "status": null,
    "content_type": null
}}

Query: "Add hashtags to content 3"
{{
    "content_id": "content_3",
    "edit_instruction": "add hashtags",
    "channel": null,
    "platform": null,
    "date_range": null,
    "status": null,
    "content_type": null,
    "query": null
}}

Extract ONLY explicitly mentioned information. Set fields to null if not mentioned.
{JSON_ONLY_INSTRUCTION}"""

    # Import _extract_payload from atsn (local import to avoid circular dependency)
    from .atsn import _extract_payload
    return _extract_payload(state, prompt)


def complete_edit_content_payload(state) -> Any:
    """Complete edit_content payload - handle content selection and edit instructions"""
    # If payload is already complete, don't check again
    if state.payload_complete:
        logger.info("Payload already complete, skipping completion check")
        state.current_step = "action_execution"
        return state

    # Resolve content selection by number (e.g., "content_1" -> actual content_id)
    if state.payload.get('content_id') and state.payload['content_id'].strip():
        content_id_ref = state.payload['content_id'].strip()

        # Check if it's a numbered reference like "content_1", "content_2", etc.
        if content_id_ref.startswith('content_') and hasattr(state, 'content_ids') and state.content_ids:
            try:
                # Extract the number (e.g., "content_1" -> 1)
                content_number = int(content_id_ref.split('_')[1]) - 1  # Convert to 0-based index

                if 0 <= content_number < len(state.content_ids):
                    # Replace with actual content_id
                    actual_content_id = state.content_ids[content_number]
                    state.payload['content_id'] = actual_content_id
                    logger.info(f"Resolved content reference {content_id_ref} to actual content_id: {actual_content_id}")
                else:
                    logger.warning(f"Content number {content_number + 1} is out of range (available: {len(state.content_ids)})")
            except (ValueError, IndexError) as e:
                logger.warning(f"Could not resolve content reference {content_id_ref}: {e}")

    # Handle direct content selection with edit instructions (highest priority)
    if (state.payload.get('content_id') and state.payload['content_id'].strip() and
        state.payload.get('edit_instruction') and state.payload['edit_instruction'].strip()):
        logger.info(f"Direct content selection with edit instructions detected: {state.payload['content_id']}")
        state.payload_complete = True
        state.current_step = "action_execution"
        print(f" Edit content payload complete - direct content selection with edit instructions: {state.payload['content_id']}")
        print(f"  Edit instruction: {state.payload['edit_instruction']}")
        print(f"  Final payload: {state.payload}")
        return state

    # Handle content selection only (wait for edit instructions)
    if state.payload.get('content_id') and state.payload['content_id'].strip():
        logger.info(f"Content selection detected, waiting for edit instructions: {state.payload['content_id']}")
        # Ask for edit instructions
        clarification_data = FIELD_CLARIFICATIONS.get("edit_content", {}).get("edit_instruction", {})
        if isinstance(clarification_data, dict):
            base_question = clarification_data.get("question", "What changes would you like to make to this content?")

            # Add remaining questions count to the question for personalization
            question_count_context = f"I will ask you just {len(missing_fields)} more question{'s' if len(missing_fields) > 1 else ''} for further understanding."
            enhanced_base_question = f"{question_count_context}\n\n{base_question}"

            personalized_question = generate_clarifying_question(
                base_question=enhanced_base_question,
                user_context=state.user_query,
                user_input=state.user_query.split('\n')[-1] if state.user_query else ""
            )
            state.clarification_question = personalized_question
            state.result = f"{personalized_question}\n\nPlease choose one of the options below:"
        else:
            state.clarification_question = clarification_data or "What changes would you like to make to this content?"
            state.result = f"{state.clarification_question}\n\nPlease choose one of the options below:"

        state.waiting_for_user = True
        state.current_step = "waiting_for_clarification"
        print(f"? Clarification needed for edit_content: waiting for edit instructions for content {state.payload['content_id']}")
        return state

    # Give priority to search queries - if query is present, skip clarifying questions
    if state.payload.get('query') and state.payload['query'].strip():
        logger.info("Search query detected, skipping clarifying questions and proceeding with search")
        state.payload_complete = True
        state.current_step = "action_execution"
        print(" Edit content payload complete - search query provided, proceeding without clarifications")
        print(f"  Final payload: {state.payload}")
        return state

    required_fields = ["channel", "platform", "content_type", "date_range", "status"]
    clarifications = FIELD_CLARIFICATIONS.get("edit_content", {})

    # Convert date_range to start_date and end_date if present
    if state.payload.get("date_range") and state.payload["date_range"]:
        date_range = str(state.payload["date_range"]).strip()

        # First try natural language date parsing (yesterday, today, this week, etc.)
        # Import _get_date_range_filter from atsn (local import to avoid circular dependency)
        from .atsn import _get_date_range_filter
        date_filter = _get_date_range_filter(date_range)

        if not date_filter:
            # Fall back to YYYY-MM-DD format parsing
            # Import _parse_date_range_format from atsn (local import to avoid circular dependency)
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
        valid_types = ["post", "short_video", "long_video", "blog"]
        if content_type_val in valid_types:
            state.payload["content_type"] = content_type_val
        else:
            # Try to match variations
            if content_type_val in ["posts", "post"]:
                state.payload["content_type"] = "post"
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
        print(" Edit content payload complete - all fields provided")
        print(f"  Final payload: {state.payload}")
        return state

    next_field = missing_fields[0]
    clarification_data = clarifications.get(next_field, {})

    if isinstance(clarification_data, dict):
        base_question = clarification_data.get("question", f"Please provide: {next_field.replace('_', ' ')}")

        # Add remaining questions count to the question for personalization
        remaining_questions = len(missing_fields)
        question_count_context = f"I will ask you just {remaining_questions} more question{'s' if remaining_questions > 1 else ''} for further understanding."
        base_question = f"{question_count_context}\n\n{base_question}"

        # Generate personalized question using LLM
        logger.info(f"Calling LLM for clarification question. Base: '{base_question}', User context length: {len(state.user_query or '')}")
        # Import generate_clarifying_question from atsn (local import to avoid circular dependency)
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
        question_text = clarification_data or f"Please provide: {next_field.replace('_', ' ')}"
        # Add remaining questions count to the question
        remaining_questions = len(missing_fields)
        question_count_context = f"I will ask you just {remaining_questions} more question{'s' if remaining_questions > 1 else ''} for further understanding."
        state.clarification_question = f"{question_count_context}\n\n{question_text}"
        state.clarification_options = []

    state.waiting_for_user = True
    state.current_step = "waiting_for_clarification"
    print(f"? Clarification needed for edit_content: {state.clarification_question}")
    return state


def handle_edit_content(state) -> Any:
    """Edit existing content from created_content table with rich formatting similar to dashboard"""
    # Import generate_personalized_message from atsn (local import to avoid circular dependency)
    from .atsn import generate_personalized_message

    payload = state.payload

    if not supabase:
        state.error = "Database connection not configured. Please contact support."
        state.result = "Unable to search for content to edit: Database not available."
        logger.error("Supabase not configured - cannot search content for editing")
        return state

    # Ensure user_id is present for security
    if not state.user_id:
        state.error = "User ID is required to edit content"
        state.result = "Unable to search for content: User authentication required."
        logger.error("User ID missing in handle_edit_content")
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
            logger.info(f"Performing semantic search for editing: '{search_query}'")

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

        # For semantic search, limit results to avoid too many matches
        # For traditional filters, show more results
        if has_semantic_search:
            result = query.limit(30).execute()  # Limit semantic search results for editing
        else:
            result = query.limit(50).execute()  # Allow more results for filtered searches

        logger.info(f"Edit content search executed: Found {len(result.data) if result.data else 0} items (semantic_search: {has_semantic_search})")

        if not result.data or len(result.data) == 0:
            # Generate personalized "no results" message
            if has_semantic_search:
                base_message = f"I couldn't find any content matching your search for '{payload['query']}'. Try different keywords or adjust your filters."
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
                base_message = f"I couldn't find any content with the specified filters ({filters_text}). Try adjusting your search criteria."

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

        # Format summary message with proper grammar and edit-specific instructions
        # Import _format_view_content_summary from atsn (local import to avoid circular dependency)
        from .atsn import _format_view_content_summary
        summary_message = _format_view_content_summary(payload, total_count)

        # Modify summary for editing context
        summary_message = summary_message.replace(
            "If you want to edit, delete, publish or schedule any post, just click on the post and select options.",
            "Select any content item below to edit it. You can modify text, images, hashtags, and more."
        )

        # Build result with summary (frontend will render cards with edit options)
        result = summary_message
        if total_count > showing:
            result += f"\n\nShowing {showing} of {total_count} items."

        # Add content selection instructions
        result += "\n\n**Next Step**: Select the content you want to edit, then tell me what changes to make!"

        # Generate personalized success message
        personalized_result = generate_personalized_message(
            base_message=result,
            user_context=state.user_query,
            message_type="success"
        )

        state.result = personalized_result

        # Set up for content selection - wait for user to select content and provide edit instructions
        state.waiting_for_user = True
        state.current_step = "content_selection"

        return state

    except Exception as e:
        logger.error(f"Database query failed in handle_edit_content: {str(e)}", exc_info=True)
        state.error = f"Failed to search for content: {str(e)}"
        state.result = generate_personalized_message(
            base_message="I encountered an error while searching for your content. Please try again or contact support if the problem persists.",
            user_context=state.user_query,
            message_type="error"
        )
    return state


def _parse_schedule_datetime(schedule_date: str, schedule_time: str) -> tuple[str, str]:
    """Parse natural language schedule date and time into database format (YYYY-MM-DD, HH:MM)"""
    from datetime import datetime, timedelta

    current_date = datetime.now()

    # Parse schedule_date
    if schedule_date.startswith('tomorrow'):
        parsed_date = (current_date + timedelta(days=1)).strftime('%Y-%m-%d')
    elif schedule_date.startswith('next '):
        # Handle "next monday", "next tuesday", etc.
        weekday_name = schedule_date.replace('next ', '').lower()
        weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        if weekday_name in weekdays:
            target_weekday = weekdays.index(weekday_name)
            current_weekday = current_date.weekday()
            days_ahead = (target_weekday - current_weekday) % 7
            if days_ahead == 0:  # Same weekday, get next week
                days_ahead = 7
            parsed_date = (current_date + timedelta(days=days_ahead)).strftime('%Y-%m-%d')
        else:
            parsed_date = schedule_date  # Assume it's already in YYYY-MM-DD format
    elif len(schedule_date) == 10 and schedule_date.count('-') == 2:
        # Already in YYYY-MM-DD format
        parsed_date = schedule_date
    else:
        # Try to parse other formats or default to tomorrow
        try:
            # Handle formats like "Jan 15" -> "2025-01-15" or "2026-01-15"
            if len(schedule_date.split()) == 2:
                month_name, day = schedule_date.split()
                month_names = ['jan', 'feb', 'mar', 'apr', 'may', 'jun',
                             'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
                month_num = month_names.index(month_name.lower()) + 1
                year = current_date.year if current_date.month <= month_num else current_date.year + 1
                parsed_date = f"{year:04d}-{month_num:02d}-{int(day):02d}"
            else:
                parsed_date = (current_date + timedelta(days=1)).strftime('%Y-%m-%d')
        except:
            parsed_date = (current_date + timedelta(days=1)).strftime('%Y-%m-%d')

    # Parse schedule_time
    if schedule_time.lower() in ['morning', '9am', '9 am']:
        parsed_time = '09:00'
    elif schedule_time.lower() in ['afternoon', '2pm', '2 pm']:
        parsed_time = '14:00'
    elif schedule_time.lower() in ['evening', '6pm', '6 pm']:
        parsed_time = '18:00'
    elif ':' in schedule_time:
        # Already in HH:MM format
        parsed_time = schedule_time
    elif len(schedule_time) == 4 and schedule_time.isdigit():
        # Handle formats like "0900" -> "09:00"
        parsed_time = f"{schedule_time[:2]}:{schedule_time[2:]}"
    else:
        # Default to morning
        parsed_time = '09:00'

    return parsed_date, parsed_time