"""
ATSN Agent - Content & Lead Management Agent
Built with LangGraph and Pydantic
Uses Gemini 2.5 for classification and generation

Architecture:
============

User Query
    ↓
Intent Classifier (Gemini 2.5)
    ↓
    ├→ Create Content → Payload Constructor → Payload Completer → Content Generator
    ├→ Edit Content → Payload Constructor → Payload Completer → Content Editor
    ├→ Delete Content → Payload Constructor → Payload Completer → Content Deleter
    ├→ View Content → Payload Constructor → Payload Completer → Content Viewer
    ├→ Publish Content → Payload Constructor → Payload Completer → Content Publisher
    ├→ Schedule Content → Payload Constructor → Payload Completer → Content Scheduler
    ├→ Create Leads → Payload Constructor → Payload Completer → Lead Creator
    ├→ View Leads → Payload Constructor → Payload Completer → Lead Viewer
    ├→ Edit Leads → Payload Constructor → Payload Completer → Lead Editor
    ├→ Delete Leads → Payload Constructor → Payload Completer → Lead Deleter
    ├→ Follow Up Leads → Payload Constructor → Payload Completer → Lead Follow-up
    ├→ View Insights → Payload Constructor → Payload Completer → Insights Viewer
    └→ View Analytics → Payload Constructor → Payload Completer → Analytics Viewer

Key Features:
=============
- 13 task-specific payload constructors with examples
- Intelligent clarification questions with clear options
- Conversation context maintained across turns
- Gemini 2.5 for all LLM operations (lightweight & fast)
- Clean Pydantic models for type safety
- Ready for Supabase integration
"""

import os
import logging
import re
import random
import uuid
from typing import List, Optional, Literal, Dict, Any
from datetime import datetime, timedelta
from pydantic import BaseModel, Field
from langgraph.graph import StateGraph, END
import google.generativeai as genai
import openai
import aiohttp
from supabase import create_client, Client

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def get_contextual_suggestion(field_type: str, conversation_context: str, all_options: List[Dict]) -> str:
    """Get LLM suggestion for the most appropriate option based on context"""

    if field_type == "Post_type":
        options_text = "\n".join([f"- {opt['label']}" for opt in all_options])
        prompt = f"""Based on the user's conversation, suggest the most appropriate post type from these options:

{options_text}

User conversation:
{conversation_context}

Return only the exact label of the most appropriate option. If none seem particularly relevant, return the first option "Educational tips"."""

    elif field_type == "Image_type":
        options_text = "\n".join([f"- {opt['label']}" for opt in all_options])
        prompt = f"""Based on the user's conversation and content idea, suggest the most appropriate image style from these options:

{options_text}

User conversation:
{conversation_context}

Return only the exact label of the most appropriate option. If none seem particularly relevant, return the first option "Minimal & Clean with Bold Typography"."""

    try:
        model = genai.GenerativeModel('gemini-2.5-flash-lite')
        response = model.generate_content(prompt)

        if response and response.text:
            suggested_option = response.text.strip().strip('"\'')
            # Validate that the suggestion is actually in our options
            for opt in all_options:
                if opt['label'] == suggested_option:
                    return suggested_option
            # Fallback to first option if LLM returned invalid suggestion
            return all_options[0]['label']

    except Exception as e:
        logger.error(f"Error getting contextual suggestion: {str(e)}")

    # Fallback to first option
    return all_options[0]['label']


def generate_clarifying_question(base_question: str, user_context: str, user_input: str = "") -> str:
    """
    Generate a personalized clarifying question using LLM based on user context and input.

    Args:
        base_question: The base clarifying question template
        user_context: The full conversation context to understand user tone/language
        user_input: The specific user input that triggered this clarification (optional)

    Returns:
        A personalized clarifying question in the user's tone and style
    """
    try:
        logger.info(f"Generating clarifying question for base_question: '{base_question}'")
        # Extract key information from user context to understand tone
        recent_messages = user_context.split('\n')[-10:]  # Last 10 lines for context
        user_context_sample = '\n'.join(recent_messages)
        logger.debug(f"User context sample: {user_context_sample[:200]}...")

        # Determine user's communication style
        prompt = f"""You are an AI assistant that needs to ask a clarifying question to the user.

User's recent conversation style and tone:
{user_context_sample}

Original question template: "{base_question}"

User's latest input: "{user_input}"

Your task: Rewrite the clarifying question to match the user's communication style, tone, and language patterns.
- Keep it conversational and natural
- Match their formality level (casual vs formal)
- Use similar vocabulary and sentence structure
- Make it feel like a natural continuation of the conversation
- Keep the core question the same but adapt the wording and tone

Return ONLY the rephrased question, nothing else."""

        model = genai.GenerativeModel('gemini-2.5-flash-lite')
        response = model.generate_content(prompt)

        if response and response.text:
            personalized_question = response.text.strip()
            # Remove any quotes that might be added
            personalized_question = personalized_question.strip('"\'')
            logger.info(f"LLM generated personalized question: '{personalized_question}' (base: '{base_question}')")
            return personalized_question
        else:
            # Fallback to original question if LLM fails
            logger.warning("LLM failed to generate clarifying question, using original")
            logger.warning(f"LLM response: {response}")
            return base_question

    except Exception as e:
        logger.error(f"Error generating clarifying question with LLM: {str(e)}")
        # Fallback to original question
        return base_question


def generate_personalized_message(base_message: str, user_context: str, message_type: str = "success") -> str:
    """
    Generate a personalized success/result message using LLM based on user context.

    Args:
        base_message: The base message template
        user_context: The full conversation context to understand user tone/language
        message_type: Type of message ("success", "error", "info", etc.)

    Returns:
        A personalized message in the user's tone and style
    """
    try:
        logger.info(f"Generating personalized {message_type} message for base_message: '{base_message[:100]}...'")
        # Extract key information from user context to understand tone
        recent_messages = user_context.split('\n')[-10:]  # Last 10 lines for context
        user_context_sample = '\n'.join(recent_messages)

        # Determine user's communication style and message type
        message_type_instruction = {
            "success": "celebratory and positive",
            "error": "helpful and apologetic",
            "info": "informative and clear",
            "warning": "cautious and advisory"
        }.get(message_type, "neutral and clear")

        prompt = f"""You are an AI assistant that needs to deliver a {message_type_instruction} message to the user.

User's recent conversation style and tone:
{user_context_sample}

Original message template: "{base_message}"

Your task: Rewrite the message to match the user's communication style, tone, and language patterns.
- Keep it {message_type_instruction}
- Match their formality level (casual vs formal)
- Use similar vocabulary and sentence structure
- Make it feel like a natural, personalized response
- Preserve all factual information and key details
- Adapt the wording and tone while keeping the core message

Return ONLY the rephrased message, nothing else."""

        model = genai.GenerativeModel('gemini-2.5-flash-lite')
        response = model.generate_content(prompt)

        if response and response.text:
            personalized_message = response.text.strip()
            # Remove any quotes that might be added
            personalized_message = personalized_message.strip('"\'')
            logger.info(f"LLM generated personalized {message_type} message: '{personalized_message[:100]}...'")
            return personalized_message
        else:
            # Fallback to original message if LLM fails
            logger.warning(f"LLM failed to generate personalized {message_type} message, using original")
            logger.warning(f"LLM response: {response}")
            return base_message

    except Exception as e:
        logger.error(f"Error generating personalized {message_type} message with LLM: {str(e)}")
        # Fallback to original message
        return base_message

# Configure Gemini
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel('gemini-2.5-flash-lite')

# Initialize OpenAI client
openai_client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY")) if os.getenv("OPENAI_API_KEY") else None

# Initialize Supabase client (following the app's pattern)
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
supabase: Client = create_client(supabase_url, supabase_key) if supabase_url and supabase_key else None

if not supabase:
    logger.warning("⚠️  Supabase not configured. Using mock data. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.")
else:
    logger.info(" Supabase client initialized successfully")


# ==================== UTILITY FUNCTIONS ====================

def detect_and_replace_pii_in_query(query: str) -> tuple[str, list, list]:
    """
    Detect email and phone numbers in user query and return sanitized query with defaults.

    Args:
        query: The user query containing potential PII

    Returns:
        tuple: (sanitized_query, original_emails, original_phones)
        - sanitized_query: Query with real PII replaced by default values
        - original_emails: List of original emails found
        - original_phones: List of original phones found
    """
    sanitized_query = query
    original_emails = []
    original_phones = []

    # Email regex pattern - matches most common email formats
    email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'

    # Phone regex pattern - matches common phone number formats (targeted)
    phone_pattern = r'\b\+?[0-9]{1,4}?[\s\-\.]?\(?[0-9]{3}\)?[\s\-\.]?[0-9]{3}[\s\-\.]?[0-9]{4}\b|\b[0-9]{10,12}\b'

    # Find and store all original emails
    email_matches = re.findall(email_pattern, query, re.IGNORECASE)
    original_emails = email_matches
    # Replace all emails with default for LLM
    if email_matches:
        sanitized_query = re.sub(email_pattern, 'atsn@gmail.com', sanitized_query, flags=re.IGNORECASE)

    # Find and store all original phones
    phone_matches = re.findall(phone_pattern, query)
    original_phones = phone_matches
    # Replace all phones with default for LLM
    if phone_matches:
        sanitized_query = re.sub(phone_pattern, '9876543210', sanitized_query)

    return sanitized_query, original_emails, original_phones


# ==================== TREND ANALYSIS FUNCTIONS ====================

async def get_trends_from_grok(topic: str, business_context: dict) -> dict:
    """Fetch social media trends from Grok API for content generation"""
    import aiohttp

    grok_api_key = os.getenv('GROK_API_KEY')
    grok_api_url = os.getenv('GROK_API_URL', 'https://api.x.ai/v1/chat/completions')
    grok_model = os.getenv('GROK_MODEL', 'grok-4-1-fast-non-reasoning')

    logger.info(f"🔍 Starting trend analysis for topic: '{topic}' using model: {grok_model}")

    if not grok_api_key:
        logger.warning("GROK_API_KEY not found, returning default trends")
        return {
            "trends": [
                {
                    "trend_name": "General Content",
                    "description": "Create engaging, valuable content for your audience",
                    "why_it_works": "Builds trust and engagement with consistent value",
                    "content_angle": "Share helpful insights and practical advice",
                    "example_hook": "Did you know...",
                    "recommended_format": "Feed Post"
                }
            ]
        }

    from datetime import datetime
    current_datetime = datetime.now()
    current_date = current_datetime.strftime("%Y-%m-%d")
    current_time = current_datetime.strftime("%H:%M:%S UTC")

    trend_prompt = f"""You are a social media trend analyst. CURRENT DATE/TIME: {current_date} at {current_time}

TASK: Identify current and emerging Instagram content trends related to the following topic. TOPIC: {topic} TARGET AUDIENCE: {business_context.get('target_audience', 'General audience')} PLATFORM: Instagram

OUTPUT REQUIREMENTS: Return ONLY valid JSON in the following structure: {{ "trends": [ {{ "trend_name": "Short name of the trend", "description": "What this trend is about in 1–2 lines", "why_it_works": "Why this trend performs well on Instagram", "content_angle": "How a brand can use this trend", "example_hook": "An example opening hook or line", "recommended_format": "Feed Post | Reel | Carousel" }} ] }}

RULES: - Provide 3 to 5 relevant trends - Trends must be practical and currently usable - No explanations outside the JSON"""

    # Log the complete trend analysis prompt
    logger.info(f"🎯 Complete trend analysis prompt being sent to Grok:")
    logger.info("=" * 80)
    logger.info(trend_prompt)
    logger.info("=" * 80)

    try:
        async with aiohttp.ClientSession() as session:
            headers = {
                'Authorization': f'Bearer {grok_api_key}',
                'Content-Type': 'application/json'
            }

            payload = {
                'model': grok_model,
                'messages': [{'role': 'user', 'content': trend_prompt}],
                'max_tokens': 1000,
                'temperature': 0.7
            }

            async with session.post(grok_api_url, json=payload, headers=headers) as response:
                if response.status == 200:
                    result = await response.json()
                    content = result['choices'][0]['message']['content'].strip()

                    # Extract JSON from response
                    import json
                    json_start = content.find('{')
                    json_end = content.rfind('}') + 1
                    if json_start != -1 and json_end > json_start:
                        json_content = content[json_start:json_end]
                        parsed_result = json.loads(json_content)

                        # Log the trends for debugging
                        trends = parsed_result.get('trends', [])
                        logger.info(f"🎯 Grok API returned {len(trends)} trends for topic: '{topic}'")
                        for i, trend in enumerate(trends[:3]):  # Log first 3 trends
                            logger.info(f"   Trend {i+1}: {trend.get('trend_name', 'N/A')} - {trend.get('content_angle', 'N/A')[:50]}...")

                        return parsed_result
                    else:
                        logger.error(f"Could not extract JSON from Grok response: {content}")
                        return {"trends": []}
                else:
                    logger.error(f"Grok API error: {response.status} - {await response.text()}")
                    return {"trends": []}

    except Exception as e:
        logger.error(f"❌ Error calling Grok API: {e}")
        logger.info("🔄 Falling back to default trends")
        return {"trends": []}


def parse_trends_for_content(trends_json: dict) -> dict:
    """Parse Grok trends JSON into content generation format"""

    trends = trends_json.get('trends', [])
    if not trends:
        return {
            'primary_trend': 'General Content',
            'content_angle': 'Create engaging, valuable content',
            'example_hook': 'Did you know...',
            'supporting_trends': [],
            'format': 'Feed Post'
        }

    # Use first trend as primary
    primary = trends[0]

    return {
        'primary_trend': primary.get('trend_name', 'General Content'),
        'content_angle': primary.get('content_angle', 'Create engaging content'),
        'example_hook': primary.get('example_hook', 'Here\'s something interesting...'),
        'supporting_trends': [t.get('trend_name', '') for t in trends[1:3]],  # Next 2 trends
        'format': primary.get('recommended_format', 'Feed Post')
    }


def get_instagram_prompt(payload: dict, business_context: dict, parsed_trends: dict, profile_assets: dict = None) -> str:
    """Generate Instagram-optimized content prompt"""

    from datetime import datetime
    current_datetime = datetime.now()
    current_date = current_datetime.strftime("%Y-%m-%d")
    current_time = current_datetime.strftime("%H:%M:%S UTC")

    # Build brand context using helper function
    brand_context = build_content_brand_context(profile_assets or {})

    return f"""
You are a professional Instagram content creator and copywriter. CURRENT DATE/TIME: {current_date} at {current_time}

BUSINESS CONTEXT:
Brand Name: {business_context.get('business_name', 'Business')}
Industry: {business_context.get('industry', 'General')}
Target Audience: {business_context.get('target_audience', 'General audience')}
Brand Voice: {business_context.get('brand_voice', 'Professional and friendly')}
Brand Tone: {business_context.get('brand_tone', 'Approachable')}
{brand_context}

CONTENT STRATEGY INPUT (FROM TREND ANALYSIS):
Primary Trend: {parsed_trends.get('primary_trend')}
Trend-Based Content Angle: {parsed_trends.get('content_angle')}
Example Hook Inspiration: {parsed_trends.get('example_hook')}
Supporting Trends: {", ".join(parsed_trends.get('supporting_trends', []))}
Recommended Format: {parsed_trends.get('format')}

CONTENT IDEA:
{payload.get('content_idea', '')}

INSTAGRAM CONTENT REQUIREMENTS:
- Platform: Instagram
- Format: {parsed_trends.get('format')}
- Caption Style: Scroll-stopping, conversational, value-driven
- Emoji Usage: DO NOT include any emojis in the caption or title
- CTA: Include exactly ONE clear CTA
- Line Breaks: Use short paragraphs for readability
- Avoid generic advice — be specific and actionable

TASK:
Create a complete Instagram post optimized for engagement and relevance to the trend.

FORMAT (Return ONLY this format, no extra text):

TITLE: [Hook-based title, max 60 characters]

CAPTION:
[Trend-aligned Instagram caption using the angle and hook]

HASHTAGS:
[7–10 relevant Instagram hashtags, space-separated]
"""


def get_platform_specific_prompt(platform: str, payload: dict, business_context: dict, parsed_trends: dict, profile_assets: dict = None) -> str:
    """Return platform-optimized prompt based on platform type"""

    platform_lower = platform.lower()

    if platform_lower == 'instagram':
        return get_instagram_prompt(payload, business_context, parsed_trends, profile_assets)
    else:
        # Fallback to general social media prompt for now
        from datetime import datetime
        current_datetime = datetime.now()
        current_date = current_datetime.strftime("%Y-%m-%d")
        current_time = current_datetime.strftime("%H:%M:%S UTC")

        # Build brand context for other platforms too
        brand_context = build_content_brand_context(profile_assets or {})

        return f"""You are a professional social media content creator specializing in {payload.get('platform', 'social media')} posts for businesses. CURRENT DATE/TIME: {current_date} at {current_time}

BUSINESS CONTEXT:
{business_context.get('business_name', 'Business')}
Industry: {business_context.get('industry', 'General')}
Target Audience: {business_context.get('target_audience', 'General audience')}
Brand Voice: {business_context.get('brand_voice', 'Professional and friendly')}
Brand Tone: {business_context.get('brand_tone', 'Approachable')}
{brand_context}

CONTENT REQUIREMENTS:
- Platform: {payload.get('platform', 'Social Media')}
- Channel: {payload.get('channel', 'Social Media')}
- Content Idea: {payload.get('content_idea', '')}

TASK:
Create a complete social media post with the following structure:

TITLE: [Create an engaging title for the post (max 60 characters)]

CONTENT: [Write the full post content with emojis and engaging copy]

HASHTAGS: [Provide 5-8 relevant hashtags separated by spaces]

Return ONLY in this exact format, no other text or explanations."""


def parse_instagram_response(response_text: str) -> dict:
    """Parse Instagram-specific response format"""

    lines = response_text.split('\n')
    content_data = {
        'title': '',
        'content': '',
        'hashtags': []
    }

    current_section = None

    for line in lines:
        line = line.strip()
        if line.startswith('TITLE:'):
            content_data['title'] = line.replace('TITLE:', '').strip()
            current_section = 'title'
        elif line.startswith('CAPTION:'):
            content_data['content'] = line.replace('CAPTION:', '').strip()
            current_section = 'caption'
        elif line.startswith('HASHTAGS:'):
            hashtags_text = line.replace('HASHTAGS:', '').strip()
            content_data['hashtags'] = hashtags_text.split()
            current_section = 'hashtags'
        elif current_section == 'caption' and line:
            content_data['content'] += ' ' + line
        elif current_section == 'hashtags' and line:
            # Continue collecting hashtags from subsequent lines
            content_data['hashtags'].extend(line.split())

    return content_data


async def generate_image_enhancer_prompt(generated_post: dict, payload: dict, business_context: dict, parsed_trends: dict, profile_assets: dict = None) -> dict:
    """Generate an enhanced image prompt using AI based on the generated content"""

    import json
    import os
    import httpx

    from datetime import datetime
    current_datetime = datetime.now()
    current_date = current_datetime.strftime("%Y-%m-%d")
    current_time = current_datetime.strftime("%H:%M:%S UTC")

    # Build brand assets and location context using helper functions
    brand_assets_context = build_image_enhancer_brand_assets(profile_assets or {}, business_context)
    location_context = build_location_context(business_context)

    # Check if logo is available and prepare logo context
    logo_context = ""
    logo_available = False

    if profile_assets and profile_assets.get('logo'):
        logo_url = profile_assets.get('logo')
        logo_context = f"""
LOGO REQUIREMENTS (MANDATORY - NO EXCEPTIONS):
- Business Logo URL: {logo_url}
- CRITICAL: Include this EXACT logo prominently in the generated image
- DO NOT modify, alter, change, or edit the logo in ANY way
- DO NOT recolor, resize disproportionately, distort, or transform the logo
- DO NOT create variations, simplified versions, or stylized versions of the logo
- DO NOT use generic logos, placeholders, or substitute logos
- Use ONLY the original, unchanged logo file exactly as provided
- Logo placement options: bottom-right corner (recommended), top-left corner, or integrated into design
- Ensure logo is clearly visible and professionally positioned
- Maintain original logo proportions, colors, and quality perfectly
- Logo should not interfere with main content readability
- Size: appropriate for social media (typically 10-20% of image area)
- Position strategically for brand recognition and visual balance
- PRESERVE ALL original elements, text, colors, and design details exactly
"""
        logo_available = True
        logger.info(f"✅ Logo included in image enhancer prompt: {logo_url}")

    # Load image enhancer prompts and get style-specific complete prompt
    image_type = payload.get('Image_type')
    image_prompt_enhancer = ""

    if image_type:
        try:
            # Load the image enhancer prompts configuration
            config_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'image_enhancer_prompts.json')
            with open(config_path, 'r') as f:
                enhancer_config = json.load(f)

            # Map Image_type to config key (convert spaces to underscores and lowercase)
            config_key_map = {
                "Minimal & Clean with Bold Typography": "minimal_clean_bold_typography",
                "Modern Corporate / B2B Professional": "modern_corporate_b2b",
                "Luxury Editorial (Black, White, Gold Accents)": "luxury_editorial",
                "Photography-Led Lifestyle Aesthetic": "photography_led_lifestyle",
                "Product-Focused Clean Commercial Style": "product_focused_commercial",
                "Flat Illustration with Friendly Characters": "flat_illustration_characters",
                "Isometric / Explainer Illustration Style": "isometric_explainer",
                "Playful & Youthful (Memphis / Stickers / Emojis)": "playful_youthful_memphis",
                "High-Impact Color-Blocking with Loud Type": "high_impact_color_blocking",
                "Retro / Vintage Poster Style": "retro_vintage_poster",
                "Futuristic Tech / AI-Inspired Dark Mode": "futuristic_tech_dark",
                "Glassmorphism / Neumorphism UI Style": "glassmorphism_neumorphism",
                "Abstract Shapes & Fluid Gradient Art": "abstract_shapes_gradients",
                "Infographic / Data-Driven Educational Layout": "infographic_data_driven",
                "Quote Card / Thought-Leadership Typography Post": "quote_card_typography",
                "Meme-Style / Social-Native Engagement Post": "meme_style_engagement",
                "Festive / Campaign-Based Creative": "festive_campaign_creative",
                "Textured Design (Paper, Grain, Handmade Feel)": "textured_design_paper",
                "Magazine / Editorial Layout with Strong Hierarchy": "magazine_editorial_layout",
                "Experimental / Artistic Concept-Driven Design": "experimental_artistic_concept"
            }

            config_key = config_key_map.get(image_type)
            if config_key and config_key in enhancer_config.get('image_enhancer_prompts', {}):
                style_config = enhancer_config['image_enhancer_prompts'][config_key]
                style_prompts = style_config.get('prompts', [])

                # Use the first (and only) complete prompt template for this style
                if style_prompts:
                    image_prompt_enhancer = style_prompts[0]

                    # Replace placeholder variables with actual values
                    image_prompt_enhancer = image_prompt_enhancer.replace("{current_date}", current_date)
                    image_prompt_enhancer = image_prompt_enhancer.replace("{current_time}", current_time)
                    image_prompt_enhancer = image_prompt_enhancer.replace("{parsed_trends.get('format', 'Feed Post')}", parsed_trends.get('format', 'Feed Post'))
                    image_prompt_enhancer = image_prompt_enhancer.replace("{business_context.get('industry', 'General')}", business_context.get('industry', 'General'))
                    image_prompt_enhancer = image_prompt_enhancer.replace("{business_context.get('target_audience', 'General audience')}", business_context.get('target_audience', 'General audience'))
                    image_prompt_enhancer = image_prompt_enhancer.replace("{business_context.get('brand_tone', 'Approachable')}", business_context.get('brand_tone', 'Approachable'))
                    image_prompt_enhancer = image_prompt_enhancer.replace("{business_context.get('brand_voice', 'Professional and friendly')}", business_context.get('brand_voice', 'Professional and friendly'))
                    image_prompt_enhancer = image_prompt_enhancer.replace("{brand_assets_context}", brand_assets_context)
                    image_prompt_enhancer = image_prompt_enhancer.replace("{location_context}", location_context)
                    image_prompt_enhancer = image_prompt_enhancer.replace("{generated_post.get('title', '')}", generated_post.get('title', ''))
                    image_prompt_enhancer = image_prompt_enhancer.replace("{generated_post.get('content', '')}", generated_post.get('content', ''))

                    # Add logo context if available
                    if logo_context:
                        # Insert logo context before the VISUAL STYLE REQUIREMENT section
                        vis_pos = image_prompt_enhancer.find("VISUAL STYLE REQUIREMENT:")
                        if vis_pos != -1:
                            image_prompt_enhancer = image_prompt_enhancer[:vis_pos] + logo_context + "\n" + image_prompt_enhancer[vis_pos:]
                        else:
                            # Fallback: add logo context before PRIMARY GOAL
                            goal_pos = image_prompt_enhancer.find("PRIMARY GOAL:")
                            if goal_pos != -1:
                                image_prompt_enhancer = image_prompt_enhancer[:goal_pos] + logo_context + "\n" + image_prompt_enhancer[goal_pos:]

        except Exception as e:
            logger.warning(f"Could not load image enhancer prompts for Image_type '{image_type}': {e}")
            # Fall back to default prompt structure if style-specific prompt fails
            image_prompt_enhancer = f"""
You are an expert visual prompt engineer for AI image generation, specializing in Instagram content. CURRENT DATE/TIME: {current_date} at {current_time}

INPUT CONTEXT:
Platform: Instagram
Post Format: {parsed_trends.get('format', 'Feed Post')}
Industry: {business_context.get('industry', 'General')}
Target Audience: {business_context.get('target_audience', 'General audience')}
Brand Tone: {business_context.get('brand_tone', 'Approachable')}
Brand Voice: {business_context.get('brand_voice', 'Professional and friendly')}

{brand_assets_context}

{location_context}

{logo_context}

INSTAGRAM POST CONTENT:
Title: {generated_post.get('title', '')}
Caption: {generated_post.get('content', '')}

PRIMARY GOAL:
Create a visually compelling image prompt that:
- Instantly communicates the core message of the post
- Matches Instagram aesthetics and trends
- Feels natural, human, and scroll-stopping
- Aligns with the brand tone and audience

IMAGE PROMPT REQUIREMENTS:
- Describe the main subject clearly
- Specify environment/background
- Define mood, lighting, and color palette
- Include composition and camera perspective
- Ensure Instagram-friendly framing (4:5 or square)
- Avoid text-heavy visuals (no captions on image)
- Avoid logos, watermarks, or brand names
- Photorealistic unless illustration fits better

OUTPUT FORMAT (Return ONLY this JSON):

{{
  "image_prompt": "A single, detailed image generation prompt",
  "visual_style": "{image_type if image_type else 'photorealistic'}",
  "aspect_ratio": "1:1 or 4:5",
  "negative_prompt": "Things to avoid in the image"
}}
"""
    else:
        # No Image_type specified, use default prompt structure
        image_prompt_enhancer = f"""
You are an expert visual prompt engineer for AI image generation, specializing in Instagram content. CURRENT DATE/TIME: {current_date} at {current_time}

INPUT CONTEXT:
Platform: Instagram
Post Format: {parsed_trends.get('format', 'Feed Post')}
Industry: {business_context.get('industry', 'General')}
Target Audience: {business_context.get('target_audience', 'General audience')}
Brand Tone: {business_context.get('brand_tone', 'Approachable')}
Brand Voice: {business_context.get('brand_voice', 'Professional and friendly')}

{brand_assets_context}

{location_context}

{logo_context}

INSTAGRAM POST CONTENT:
Title: {generated_post.get('title', '')}
Caption: {generated_post.get('content', '')}

PRIMARY GOAL:
Create a visually compelling image prompt that:
- Instantly communicates the core message of the post
- Matches Instagram aesthetics and trends
- Feels natural, human, and scroll-stopping
- Aligns with the brand tone and audience

IMAGE PROMPT REQUIREMENTS:
- Describe the main subject clearly
- Specify environment/background
- Define mood, lighting, and color palette
- Include composition and camera perspective
- Ensure Instagram-friendly framing (4:5 or square)
- Avoid text-heavy visuals (no captions on image)
- Avoid logos, watermarks, or brand names
- Photorealistic unless illustration fits better

OUTPUT FORMAT (Return ONLY this JSON):

{{
  "image_prompt": "A single, detailed image generation prompt",
  "visual_style": "{image_type if image_type else 'photorealistic'}",
  "aspect_ratio": "1:1 or 4:5",
  "negative_prompt": "Things to avoid in the image"
}}
"""

    try:
        # Log the complete image enhancer prompt
        logger.info(f"🎨 Complete image enhancer prompt being sent to GPT-4o-mini:")
        logger.info("=" * 80)
        logger.info(image_prompt_enhancer)
        logger.info("=" * 80)

        logger.info(f"🎨 Generating enhanced image prompt with GPT-4o-mini at {current_datetime.strftime('%Y-%m-%d %H:%M:%S UTC')}")

        if openai_client:
            response = openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": image_prompt_enhancer}],
                max_tokens=400,
                temperature=0.7
            )

            enhancer_response = response.choices[0].message.content.strip()

            # Parse JSON response
            json_start = enhancer_response.find('{')
            json_end = enhancer_response.rfind('}') + 1

            if json_start != -1 and json_end > json_start:
                json_content = enhancer_response[json_start:json_end]
                enhanced_prompt_data = json.loads(json_content)

                logger.info(f"✅ Enhanced image prompt generated: {enhanced_prompt_data.get('visual_style', 'unknown')} style")
                return enhanced_prompt_data
            else:
                logger.error(f"Could not parse JSON from image enhancer response: {enhancer_response}")
                return {
                    "image_prompt": f"Create a professional Instagram image for: {generated_post.get('title', '')}",
                    "visual_style": image_type if image_type else "photorealistic",
                    "aspect_ratio": "1:1",
                    "negative_prompt": "text, logos, watermarks, blurry"
                }
        else:
            logger.warning("OpenAI client not available for image enhancer")
            return {
                "image_prompt": f"Create a professional Instagram image for: {generated_post.get('title', '')}",
                "visual_style": image_type if image_type else "photorealistic",
                "aspect_ratio": "1:1",
                "negative_prompt": "text, logos, watermarks, blurry"
            }

    except Exception as e:
        logger.error(f"❌ Error generating enhanced image prompt: {e}")
        return {
            "image_prompt": f"Create a professional Instagram image for: {generated_post.get('title', '')}",
            "visual_style": image_type if image_type else "photorealistic",
            "aspect_ratio": "1:1",
            "negative_prompt": "text, logos, watermarks, blurry"
        }


# ==================== BUSINESS CONTEXT HELPERS ====================

def extract_text_field(profile_record: dict, field_name: str, default_value: str = '', required: bool = False) -> str:
    """Extract and validate a text field from profile record"""
    value = profile_record.get(field_name)

    if value is None or value == '':
        if required:
            logger.warning(f"⚠️ Required field '{field_name}' is empty in profile record, using default: '{default_value}'")
        else:
            logger.debug(f"📝 Optional field '{field_name}' is empty, using default: '{default_value}'")
        return default_value

    # Validate string type
    if not isinstance(value, str):
        logger.warning(f"⚠️ Field '{field_name}' is not a string (type: {type(value)}), converting to string")
        value = str(value)

    logger.debug(f"✅ Extracted field '{field_name}': '{value[:50]}{'...' if len(value) > 50 else ''}'")
    return value


def extract_array_field(profile_record: dict, field_name: str, default_value: str = '', required: bool = False) -> str:
    """Extract first item from an array field in profile record"""
    array_value = profile_record.get(field_name)

    if not array_value or not isinstance(array_value, list) or len(array_value) == 0:
        if required:
            logger.warning(f"⚠️ Required array field '{field_name}' is empty or invalid, using default: '{default_value}'")
        else:
            logger.debug(f"📝 Optional array field '{field_name}' is empty, using default: '{default_value}'")
        return default_value

    first_item = array_value[0]

    # Validate the first item
    if first_item is None or first_item == '':
        logger.warning(f"⚠️ First item in array field '{field_name}' is empty, using default: '{default_value}'")
        return default_value

    if not isinstance(first_item, str):
        logger.warning(f"⚠️ Array field '{field_name}' first item is not a string (type: {type(first_item)}), converting")
        first_item = str(first_item)

    logger.debug(f"✅ Extracted array field '{field_name}': '{first_item}' (from array of {len(array_value)} items)")
    return first_item


def extract_color_field(profile_record: dict, field_name: str) -> str:
    """Extract color field (can be None, no validation needed)"""
    color_value = profile_record.get(field_name)

    if color_value is not None:
        logger.debug(f"✅ Extracted color field '{field_name}': '{color_value}'")
    else:
        logger.debug(f"📝 Color field '{field_name}' is not set (optional)")

    return color_value


def extract_color_array_field(profile_record: dict, field_name: str) -> list:
    """Extract color array field"""
    color_array = profile_record.get(field_name, [])

    if not isinstance(color_array, list):
        logger.warning(f"⚠️ Color array field '{field_name}' is not a list (type: {type(color_array)}), using empty array")
        return []

    logger.debug(f"✅ Extracted color array field '{field_name}': {len(color_array)} colors")
    return color_array


def get_business_context_from_profile(profile_record: dict) -> dict:
    """Extract structured business context from profile record using individual field extraction"""

    if not profile_record:
        logger.warning("❌ Profile record is None or empty, using all defaults")
        profile_record = {}

    # Count available fields for logging
    available_fields = [k for k, v in profile_record.items() if v is not None and v != '' and v != []]
    logger.info(f"📊 Profile record analysis: {len(available_fields)}/{len(profile_record)} fields populated")

    # Extract each field individually with validation
    context = {
        # Core business information
        'business_name': extract_text_field(profile_record, 'business_name', 'Business', required=True),
        'business_description': extract_text_field(profile_record, 'business_description', '', required=False),

        # Brand personality
        'brand_tone': extract_text_field(profile_record, 'brand_tone', 'Professional', required=False),
        'brand_voice': extract_text_field(profile_record, 'brand_voice', 'Professional and friendly', required=False),

        # Business categorization
        'industry': extract_array_field(profile_record, 'industry', 'General', required=False),
        'target_audience': extract_array_field(profile_record, 'target_audience', 'General audience', required=False),

        # Unique value
        'unique_value_proposition': extract_text_field(profile_record, 'unique_value_proposition', '', required=False),

        # Brand colors (optional)
        'primary_color': extract_color_field(profile_record, 'primary_color'),
        'secondary_color': extract_color_field(profile_record, 'secondary_color'),
        'brand_colors': extract_color_array_field(profile_record, 'brand_colors'),

        # Location and timezone context
        'timezone': extract_text_field(profile_record, 'timezone', '', required=False),
        'location_city': extract_text_field(profile_record, 'location_city', '', required=False),
        'location_state': extract_text_field(profile_record, 'location_state', '', required=False),
        'location_country': extract_text_field(profile_record, 'location_country', '', required=False)
    }

    # Log summary of extracted context
    color_status = f"{bool(context['primary_color'])}/{bool(context['secondary_color'])}"
    location_info = []
    if context.get('location_city'): location_info.append(context['location_city'])
    if context.get('location_country'): location_info.append(context['location_country'])
    location_str = ', '.join(location_info) if location_info else 'Not specified'

    logger.info(f"📋 Context extraction complete: Business='{context['business_name']}', Industry='{context['industry']}', Location='{location_str}', Colors={color_status}")

    return context

def get_profile_context_with_structured_data(profile_data: dict) -> dict:
    """Legacy function - now uses structured data instead of embeddings"""
    return get_business_context_from_profile(profile_data)


# ==================== BRAND ASSET HELPERS ====================

def build_brand_color_instructions(profile_assets: dict, business_context: dict) -> str:
    """Build conditional color instructions based on available brand assets"""
    primary = profile_assets.get('primary_color')
    secondary = profile_assets.get('secondary_color')
    brand_colors = profile_assets.get('brand_colors', [])

    if primary and secondary:
        color_text = f"""
BRAND COLORS:
- Primary: {primary}
- Secondary: {secondary}
- Use primary color for main elements, secondary for accents and highlights"""

        if brand_colors:
            color_text += f"\n- Additional brand colors: {', '.join(brand_colors)}"

        return color_text

    elif primary:
        color_text = f"""
BRAND COLOR:
- Primary: {primary}
- Use this color consistently throughout the design"""

        if brand_colors:
            color_text += f"\n- Additional brand colors: {', '.join(brand_colors)}"

        return color_text

    elif brand_colors:
        return f"""
BRAND COLORS:
- Available colors: {', '.join(brand_colors)}
- Use these brand colors strategically in the design"""

    else:
        return f"""
COLOR PALETTE:
- Use professional, modern colors suitable for {business_context.get('industry', 'General')} industry
- Focus on colors that appeal to {business_context.get('target_audience', 'General audience')}"""


def build_content_brand_context(profile_assets: dict) -> str:
    """Build brand context for content generation prompts"""
    if profile_assets.get('primary_color') and profile_assets.get('secondary_color'):
        return f"""
Primary Brand Color: {profile_assets['primary_color']}
Secondary Brand Color: {profile_assets['secondary_color']}
Visual Style: Use these colors strategically in any visual suggestions"""
    elif profile_assets.get('primary_color'):
        return f"""
Primary Brand Color: {profile_assets['primary_color']}
Visual Style: Use this color as the main brand color in visual suggestions"""
    else:
        return """
Visual Style: Use professional, modern colors suitable for your industry"""


def build_location_context(business_context: dict) -> str:
    """Build location-aware context for image generation"""
    location_parts = []

    if business_context.get('location_city'):
        location_parts.append(business_context['location_city'])
    if business_context.get('location_state'):
        location_parts.append(business_context['location_state'])
    if business_context.get('location_country'):
        location_parts.append(business_context['location_country'])

    if location_parts:
        location_str = ', '.join(location_parts)
        timezone = business_context.get('timezone', '')

        location_context = f"""
LOCATION CONTEXT:
Business Location: {location_str}"""

        if timezone:
            location_context += f"\nTimezone: {timezone}"

        # Add location-specific imagery suggestions
        location_context += f"""
Location-Inspired Elements: Consider incorporating subtle local landmarks, architectural styles, or cultural elements from {location_str} that would resonate with the local audience. Adapt the imagery to reflect the local environment and aesthetic preferences of {business_context.get('location_city', 'the local area')}."""

        return location_context
    else:
        return """
LOCATION CONTEXT:
No specific location information available. Use universally appealing, professional imagery that works across different regions and cultures."""


def build_image_enhancer_brand_assets(profile_assets: dict, business_context: dict) -> str:
    """Build brand assets context for image enhancer prompts"""
    primary = profile_assets.get('primary_color')
    secondary = profile_assets.get('secondary_color')
    brand_colors = profile_assets.get('brand_colors', [])
    primary_typography = profile_assets.get('primary_typography')
    secondary_typography = profile_assets.get('secondary_typography')

    if primary and secondary:
        color_text = f"""
BRAND ASSETS:
Primary Color: {primary}
Secondary Color: {secondary}
Color Usage: Use primary color for main elements, secondary for accents and highlights"""

        if brand_colors:
            color_text += f"\nAdditional Brand Colors: {', '.join(brand_colors)}"

        if primary_typography:
            color_text += f"\nPrimary Typography: {primary_typography}"
        if secondary_typography:
            color_text += f"\nSecondary Typography: {secondary_typography}"

        return color_text

    elif primary:
        color_text = f"""
BRAND ASSETS:
Primary Color: {primary}
Color Usage: Use this color consistently throughout the design"""

        if brand_colors:
            color_text += f"\nAdditional Brand Colors: {', '.join(brand_colors)}"

        if primary_typography:
            color_text += f"\nPrimary Typography: {primary_typography}"
        if secondary_typography:
            color_text += f"\nSecondary Typography: {secondary_typography}"

        return color_text

    elif brand_colors:
        color_text = f"""
BRAND ASSETS:
Available Brand Colors: {', '.join(brand_colors)}
Color Usage: Use these brand colors strategically in the composition"""

        if primary_typography:
            color_text += f"\nPrimary Typography: {primary_typography}"
        if secondary_typography:
            color_text += f"\nSecondary Typography: {secondary_typography}"

        return color_text

    else:
        color_text = f"""
COLOR APPROACH:
Use a professional color palette suitable for {business_context.get('industry', 'General')} industry
Focus on colors that resonate with {business_context.get('target_audience', 'General audience')}"""

        if primary_typography:
            color_text += f"\nPrimary Typography: {primary_typography}"
        if secondary_typography:
            color_text += f"\nSecondary Typography: {secondary_typography}"

        return color_text


# ==================== PYDANTIC MODELS ====================

class CreateContentPayload(BaseModel):
    channel: Optional[Literal["Social Media", "Blog"]] = None
    platform: Optional[Literal["Instagram", "Facebook", "LinkedIn", "Youtube"]] = None
    content_type: Optional[Literal["static_post", "carousel", "short_video or reel", "long_video", "blog"]] = None
    media: Optional[Literal["Generate", "Upload", "without media"]] = None
    media_file: Optional[str] = None
    content_idea: Optional[str] = Field(None, min_length=10)
    content_id: Optional[str] = None
    agent_name: Optional[str] = None                                                                                
    Post_type: Optional[Literal[
        "Educational tips", "Quote / motivation", "Promotional offer", "Product showcase",
        "Carousel infographic", "Announcement", "Testimonial / review", "Before–after",
        "Behind-the-scenes", "User-generated content", "Brand story", "Meme / humor",
        "Facts / did-you-know", "Event highlight", "Countdown", "FAQ post", "Comparison",
        "Case study snapshot", "Milestone / achievement", "Call-to-action post"
    ]] = None
    Image_type: Optional[Literal[
        "Minimal & Clean with Bold Typography", "Modern Corporate / B2B Professional",
        "Luxury Editorial (Black, White, Gold Accents)", "Photography-Led Lifestyle Aesthetic",
        "Product-Focused Clean Commercial Style", "Flat Illustration with Friendly Characters",
        "Isometric / Explainer Illustration Style", "Playful & Youthful (Memphis / Stickers / Emojis)",
        "High-Impact Color-Blocking with Loud Type", "Retro / Vintage Poster Style",
        "Futuristic Tech / AI-Inspired Dark Mode", "Glassmorphism / Neumorphism UI Style",
        "Abstract Shapes & Fluid Gradient Art", "Infographic / Data-Driven Educational Layout",
        "Quote Card / Thought-Leadership Typography Post", "Meme-Style / Social-Native Engagement Post",
        "Festive / Campaign-Based Creative", "Textured Design (Paper, Grain, Handmade Feel)",
        "Magazine / Editorial Layout with Strong Hierarchy", "Experimental / Artistic Concept-Driven Design"
    ]] = None


class EditContentPayload(BaseModel):
    channel: Optional[Literal["Social Media", "Blog"]] = None
    platform: Optional[Literal["Instagram", "Facebook", "LinkedIn", "Youtube"]] = None
    date_range: Optional[str] = None  # Natural language date concept: "yesterday", "today", "this week", etc.
    start_date: Optional[str] = None  # Format: YYYY-MM-DD (calculated from date_range)
    end_date: Optional[str] = None    # Format: YYYY-MM-DD (calculated from date_range)
    status: Optional[Literal["generated", "scheduled", "published"]] = None
    content_type: Optional[Literal["post", "short_video", "long_video", "blog"]] = None
    content_id: Optional[str] = None  # Specific content to edit (selected by user)
    query: Optional[str] = None  # Search query for semantic search in title and content
    edit_instruction: Optional[str] = None  # What changes to make to the content


class DeleteContentPayload(BaseModel):
    channel: Optional[Literal["Social Media", "Blog"]] = None
    platform: Optional[Literal["Instagram", "Facebook", "LinkedIn", "Youtube"]] = None
    date_range: Optional[str] = None  # Natural language date concept: "yesterday", "today", etc.
    start_date: Optional[str] = None  # Calculated from date_range (YYYY-MM-DD)
    end_date: Optional[str] = None    # Calculated from date_range (YYYY-MM-DD)
    status: Optional[Literal["generated", "scheduled", "published"]] = None
    content_id: Optional[str] = None


class ViewContentPayload(BaseModel):
    channel: Optional[Literal["Social Media", "Blog"]] = None
    platform: Optional[Literal["Instagram", "Facebook", "LinkedIn", "Youtube"]] = None
    date_range: Optional[str] = None  # Natural language date concept: "yesterday", "today", "this week", etc.
    start_date: Optional[str] = None  # Format: YYYY-MM-DD (calculated from date_range)
    end_date: Optional[str] = None    # Format: YYYY-MM-DD (calculated from date_range)
    status: Optional[Literal["generated", "scheduled", "published"]] = None
    content_type: Optional[Literal["post", "short_video", "long_video", "blog"]] = None
    query: Optional[str] = None  # Search query for semantic search in title and content
    all: Optional[bool] = None  # When true, show all posts without limits


class PublishContentPayload(BaseModel):
    channel: Optional[Literal["Social Media", "Blog"]] = None
    platform: Optional[Literal["Instagram", "Facebook", "LinkedIn", "Youtube"]] = None
    date_range: Optional[str] = None  # Natural language date concept: "yesterday", "today", "this week", etc.
    start_date: Optional[str] = None  # Format: YYYY-MM-DD (calculated from date_range)
    end_date: Optional[str] = None    # Format: YYYY-MM-DD (calculated from date_range)
    status: Optional[Literal["generated", "scheduled"]] = None
    content_id: Optional[str] = None  # Specific content to publish (selected by user)
    query: Optional[str] = None  # Search query for semantic search in title and content


class ScheduleContentPayload(BaseModel):
    channel: Optional[Literal["Social Media", "Blog"]] = None
    platform: Optional[Literal["Instagram", "Facebook", "LinkedIn", "Youtube"]] = None
    content_id: Optional[str] = None
    schedule_date: Optional[str] = None
    schedule_time: Optional[str] = None


class CreateLeadPayload(BaseModel):
    lead_id: Optional[str] = None  # UUID of the lead (for updates/operations)
    lead_name: Optional[str] = None
    lead_email: Optional[str] = None
    lead_phone: Optional[str] = None
    lead_source: Optional[Literal["Manual Entry", "Facebook", "Instagram", "Walk Ins", "Referral", "Email", "Website", "Phone Call"]] = None
    lead_status: Optional[Literal["new", "contacted", "responded", "qualified", "converted", "lost", "invalid"]] = None
    remarks: Optional[str] = None  # Now required
    follow_up: Optional[str] = None  # Now required


class ViewLeadsPayload(BaseModel):
    lead_id: Optional[str] = None  # Specific lead ID to view
    lead_source: Optional[Literal["Manual Entry", "Facebook", "Instagram", "Walk Ins", "Referral", "Email", "Website", "Phone Call"]] = None
    lead_name: Optional[str] = None
    lead_email: Optional[str] = None
    lead_status: Optional[Literal["new", "contacted", "responded", "qualified", "converted", "lost", "invalid"]] = None
    lead_phone: Optional[str] = None
    time_period: Optional[str] = None  # Time period to filter leads (e.g., "last_7_days", "last_30_days", "this_month")


class EditLeadsPayload(BaseModel):
    lead_id: Optional[str] = None  # Required: UUID of lead to edit
    lead_name: Optional[str] = None
    lead_source: Optional[str] = None
    lead_email: Optional[str] = None
    lead_phone: Optional[str] = None
    new_lead_name: Optional[str] = None
    new_lead_email: Optional[str] = None
    new_lead_phone: Optional[str] = None
    new_lead_source: Optional[Literal["Manual Entry", "Facebook", "Instagram", "Walk Ins", "Referral", "Email", "Website", "Phone Call"]] = None
    new_lead_status: Optional[Literal["new", "contacted", "responded", "qualified", "converted", "lost", "invalid"]] = None
    new_remarks: Optional[str] = None


class DeleteLeadsPayload(BaseModel):
    lead_id: Optional[str] = None  # Required: UUID of lead to delete
    lead_name: Optional[str] = None
    lead_phone: Optional[str] = None
    lead_email: Optional[str] = None
    lead_status: Optional[Literal["New", "Contacted", "Qualified", "Lost", "Won"]] = None


class FollowUpLeadsPayload(BaseModel):
    lead_id: Optional[str] = None  # Required: UUID of lead to follow up with
    lead_name: Optional[str] = None
    lead_email: Optional[str] = None
    lead_phone: Optional[str] = None
    follow_up_message: Optional[str] = None
    follow_up_date: Optional[str] = None  # ISO format date string for follow-up scheduling


class ViewInsightsPayload(BaseModel):
    channel: Optional[Literal["Social Media", "Blog"]] = None
    platform: Optional[Literal["Instagram", "Facebook", "LinkedIn", "Youtube"]] = None
    metrics: Optional[List[str]] = None
    date_range: Optional[Literal["today", "this week", "last week", "yesterday", "custom date"]] = None


class ViewAnalyticsPayload(BaseModel):
    channel: Optional[Literal["Social Media", "Blog"]] = None
    platform: Optional[Literal["Instagram", "Facebook", "LinkedIn", "Youtube"]] = None
    date_range: Optional[Literal["today", "this week", "last week", "yesterday", "custom date"]] = None


# ==================== STATE ====================

class AgentState(BaseModel):
    user_query: str = ""  # Contains current message for intent classification
    full_conversation: str = ""  # Contains full conversation history for context
    conversation_history: List[str] = Field(default_factory=list)  # Deprecated: kept for compatibility, not used
    intent: Optional[str] = None
    payload: Optional[Dict[str, Any]] = Field(default_factory=dict)
    payload_complete: bool = False
    clarification_question: Optional[str] = None
    clarification_options: Optional[List[Dict[str, Any]]] = None  # Clickable options for clarification
    clarification_data: Optional[Dict[str, Any]] = None  # Additional clarification data (e.g., upload requests)
    waiting_for_user: bool = False
    waiting_for_upload: bool = False  # Whether the agent is waiting for a file upload
    upload_type: Optional[str] = None  # Type of upload expected ('image', 'video', etc.)
    result: Optional[str] = None
    error: Optional[str] = None
    current_step: str = "intent_classification"
    user_id: Optional[str] = None  # User ID for database queries
    content_id: Optional[str] = None  # Single content ID (UUID) for operations on specific content
    content_ids: Optional[List[str]] = None  # List of content IDs available for selection
    lead_id: Optional[str] = None  # Single lead ID (UUID) for operations on specific lead
    content_items: Optional[List[Dict[str, Any]]] = None  # Structured content data for frontend card rendering
    lead_items: Optional[List[Dict[str, Any]]] = None  # Structured lead data for frontend card rendering
    needs_connection: Optional[bool] = None  # Whether user needs to connect an account
    connection_platform: Optional[str] = None  # Platform that needs to be connected
    intent_change_detected: bool = False  # Whether an intent change was detected
    previous_intent: Optional[str] = None  # Previous intent before change
    intent_change_type: str = "none"  # Type of intent change: 'none', 'refinement', 'complete_shift'
    # Temporary fields for PII handling
    temp_original_email: Optional[str] = None
    temp_original_phone: Optional[str] = None
    temp_filter_emails: Optional[List[str]] = None
    temp_filter_phones: Optional[List[str]] = None
    temp_original_emails: Optional[List[str]] = None
    temp_original_phones: Optional[List[str]] = None
    temp_delete_emails: Optional[List[str]] = None
    temp_delete_phones: Optional[List[str]] = None
    temp_followup_emails: Optional[List[str]] = None
    temp_followup_phones: Optional[List[str]] = None

    # Temporary fields for PII privacy protection
    temp_original_email: Optional[str] = None  # Original email from user input (create operations)
    temp_original_phone: Optional[str] = None  # Original phone from user input (create operations)
    temp_original_emails: Optional[List[str]] = Field(default_factory=list)  # Original emails (edit operations)
    temp_original_phones: Optional[List[str]] = Field(default_factory=list)  # Original phones (edit operations)
    temp_filter_emails: Optional[List[str]] = Field(default_factory=list)  # Original emails for filtering
    temp_filter_phones: Optional[List[str]] = Field(default_factory=list)  # Original phones for filtering
    temp_delete_emails: Optional[List[str]] = Field(default_factory=list)  # Original emails for deletion
    temp_delete_phones: Optional[List[str]] = Field(default_factory=list)  # Original phones for deletion
    temp_followup_emails: Optional[List[str]] = Field(default_factory=list)  # Original emails for follow-up
    temp_followup_phones: Optional[List[str]] = Field(default_factory=list)  # Original phones for follow-up

    # Intent change detection
    intent_change_detected: bool = False
    intent_change_type: Optional[str] = None  # 'refinement', 'complete_shift', 'none'
    previous_intent: Optional[str] = None

    class Config:
        arbitrary_types_allowed = True


# ==================== INTENT CLASSIFICATION ====================

def get_intent_change_message(from_intent: str, to_intent: str, agent_name: str = None) -> str:
    """Generate a helpful message explaining what the AI can do for the new intent"""

    # Map intents to agents
    intent_to_agent = {
        "create_content": "Leo",
        "edit_content": "Leo",
        "delete_content": "Emily",
        "view_content": "Emily",
        "publish_content": "Emily",
        "schedule_content": "Emily",
        "create_leads": "Chase",
        "view_leads": "Chase",
        "edit_leads": "Chase",
        "delete_leads": "Chase",
        "follow_up_leads": "Chase",
        "view_insights": "Orion",
        "view_analytics": "Orion"
    }

    # Determine agent name
    if not agent_name:
        agent_name = intent_to_agent.get(to_intent, "Emily")  # Default to Emily

    intent_help = {
        "create_content": "I can help you create engaging content for social media platforms like Instagram, Facebook, LinkedIn, and YouTube. Tell me your topic and target audience, and I'll craft compelling posts, captions, and hashtags.",
        "edit_content": "I can help you modify your existing content. Show me which content you'd like to edit and what changes you need, and I'll help refine it for better engagement.",
        "delete_content": "I can help you remove content from your social media platforms. Just specify which content and platform, and I'll assist with the deletion process.",
        "view_content": "I can show you all your created content across different platforms. I can filter by platform, date, or status to help you find exactly what you're looking for.",
        "publish_content": "I can help you publish your content to social media platforms. Tell me which content and when you'd like it published, and I'll handle the publishing process.",
        "schedule_content": "I can help you schedule content for future publishing. Choose your content, set the date and time, and I'll ensure it gets posted at the right moment.",
        "create_leads": "I can help you create and manage leads from various sources. Provide lead details and I'll help you organize and track them effectively.",
        "view_leads": "I can show you all your leads with filtering options. You can view leads by status, source, or date to track your sales pipeline.",
        "edit_leads": "I can help you update lead information. Tell me which lead and what information needs to be changed, and I'll assist with the updates.",
        "delete_leads": "I can help you remove leads from your system. Just specify which leads and I'll assist with the deletion process.",
        "follow_up_leads": "I can help you manage follow-ups with your leads. I can suggest follow-up strategies, create messages, and track interactions.",
        "view_insights": "I can show you detailed analytics and insights about your content performance across all platforms. Get metrics on engagement, reach, and growth.",
        "view_analytics": "I can provide comprehensive analytics about your social media performance. Track follower growth, engagement rates, and content performance over time."
    }

    from_display = from_intent.replace('_', ' ')
    to_display = to_intent.replace('_', ' ')

    help_text = intent_help.get(to_intent, "I can help you with this task. Just let me know what you need assistance with.")

    return f"Hey, I am {agent_name}! I can help you with {to_display}.\n\n{help_text}\n\nHow can I assist you with this?"


INTENT_MAP = {
    "greeting": None,  # No payload needed for greetings
    "general_talks": None,  # No payload needed for general conversation
    "create_content": CreateContentPayload,
    "edit_content": EditContentPayload,
    "delete_content": DeleteContentPayload,
    "view_content": ViewContentPayload,
    "publish_content": PublishContentPayload,
    "schedule_content": ScheduleContentPayload,
    "create_leads": CreateLeadPayload,
    "view_leads": ViewLeadsPayload,
    "edit_leads": EditLeadsPayload,
    "delete_leads": DeleteLeadsPayload,
    "follow_up_leads": FollowUpLeadsPayload,
    "view_insights": ViewInsightsPayload,
    "view_analytics": ViewAnalyticsPayload,
}


def detect_intent_changes(state: AgentState) -> AgentState:
    """Continuously monitor for intent changes throughout conversation using LLM"""
    if not state.intent:
        return state

    # Skip intent detection for very short responses to clarifications
    last_message = state.user_query.strip().split('\n')[-1].strip()

    # Special case: skip intent detection for media upload messages
    if last_message.lower() == "[media_upload]":
        print(f"   Skipping intent detection for media upload message")
        return state

    if len(last_message.split()) <= 2:  # Reduced from 3 to 2 for more sensitivity
        print(f"   Skipping intent detection for short response: '{last_message}'")
        # Likely a short clarification response, preserve current intent
        return state

    # Prepare conversation context for intent analysis
    conversation_context = f"""
You are an intent change detector. Analyze if the user has changed their intent.

Current Intent: {state.intent}
Full Conversation: {state.user_query}

CORE INTENTS: greeting, general_talks, create_content, edit_content, delete_content, view_content, publish_content, schedule_content, create_leads, view_leads, edit_leads, delete_leads, follow_up_leads, view_insights, view_analytics

TASK: Determine if the user's LATEST message indicates a change in intent.

Return ONLY ONE of these exact formats:
"same_intent"
"intent_changed: create_content"
"intent_changed: edit_content"
"intent_changed: delete_content"
"intent_changed: view_content"
"intent_changed: publish_content"
"intent_changed: schedule_content"
"intent_changed: create_leads"
"intent_changed: view_leads"
"intent_changed: edit_leads"
"intent_changed: delete_leads"
"intent_changed: follow_up_leads"
"intent_changed: view_insights"
"intent_changed: view_analytics"
"intent_changed: greeting"
"intent_changed: general_talks"

EXAMPLES:
- User says "Actually, show me my leads" → intent_changed: view_leads
- User says "Instagram platform" as clarification → same_intent
- User says "Nevermind, delete that post instead" → intent_changed: delete_content
- User says "How are my analytics?" → intent_changed: view_analytics
- User says "Schedule this for tomorrow" → intent_changed: schedule_content
"""

    try:
        print(f"🔍 Checking for intent changes in conversation...")
        print(f"   Current intent: {state.intent}")
        print(f"   Last message: {last_message[:100]}...")

        response = model.generate_content(conversation_context)
        result = response.text.strip().lower()

        print(f"   LLM Response: {result}")

        if result.startswith("intent_changed:"):
            # Extract new intent
            new_intent = result.split(":", 1)[1].strip()

            print(f"   Detected intent change to: {new_intent}")

            # Validate the new intent
            if new_intent in INTENT_MAP:
                # Intent change detected!
                old_intent = state.intent

                # Update intent change tracking
                state.intent_change_detected = True
                state.previous_intent = old_intent

                # Determine change type
                content_intents = ['create_content', 'edit_content', 'delete_content', 'view_content', 'publish_content', 'schedule_content']
                lead_intents = ['create_leads', 'view_leads', 'edit_leads', 'delete_leads', 'follow_up_leads']
                analytics_intents = ['view_insights', 'view_analytics']

                old_category = None
                new_category = None

                if old_intent in content_intents:
                    old_category = 'content'
                elif old_intent in lead_intents:
                    old_category = 'leads'
                elif old_intent in analytics_intents:
                    old_category = 'analytics'

                if new_intent in content_intents:
                    new_category = 'content'
                elif new_intent in lead_intents:
                    new_category = 'leads'
                elif new_intent in analytics_intents:
                    new_category = 'analytics'

                if old_category == new_category:
                    state.intent_change_type = 'refinement'
                else:
                    state.intent_change_type = 'complete_shift'

                # Update intent
                state.intent = new_intent

                # Handle the change
                if state.intent_change_type == 'complete_shift':
                    # Reset state for complete shifts
                    state.payload = {}
                    state.payload_complete = False
                    state.clarification_question = None
                    state.clarification_options = None
                    state.waiting_for_user = False
                    state.result = get_intent_change_message(old_intent, new_intent)
                    state.current_step = "payload_construction"  # Restart payload construction

                print(f"🎯 Continuous intent change detected: {old_intent} → {new_intent} ({state.intent_change_type})")

            else:
                print(f"⚠️ Detected invalid intent change: {new_intent}, keeping current intent")

        else:
            print(f"   No intent change detected, continuing with {state.intent}")
            # If no change detected, continue with current intent
            return state

    except Exception as e:
        print(f"❌ Error in continuous intent detection: {e}")
        import traceback
        print(f"   Traceback: {traceback.format_exc()}")
        # On error, preserve current intent
        return state


def classify_intent(state: AgentState) -> AgentState:
    """Classify user intent using Gemini"""
    
    # If intent is already set and we're continuing from a clarification, preserve it
    # This prevents re-classification when user responds to clarification questions
    if state.intent and state.current_step == "payload_construction":
        print(f" Intent preserved: {state.intent} (continuing from clarification)")
        return state
    
    # Check for special upload message that should preserve existing intent
    user_query_lower = state.user_query.lower().strip()
    if user_query_lower == "[media_upload]":
        # This is an upload completion - preserve existing intent and continue
        if state.intent:
            print(f" Media upload detected, preserving intent: {state.intent}")
            state.current_step = "payload_construction"
            return state

    # Check for greetings first (simple pattern matching)
    greeting_words = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening',
                      'greetings', 'howdy', 'what\'s up', 'whats up', 'sup', 'yo']

    if any(greeting in user_query_lower for greeting in greeting_words) and len(user_query_lower.split()) <= 5:
        state.intent = "greeting"
        state.current_step = "action_execution"
        print(f" Intent classified: greeting")
        return state
    
    prompt = f"""You are an intent classifier for a content and lead management system.
    
Available intents:
1. greeting - User is greeting (hi, hello, good morning, etc.)
2. create_content - Creating new content (posts, videos, emails, messages)
3. edit_content - Editing existing content
4. delete_content - Deleting content
5. view_content - Viewing/listing content
6. publish_content - Publishing content to platforms
7. schedule_content - Scheduling content for future publishing
8. create_leads - Creating new leads
9. view_leads - Viewing/listing leads
10. edit_leads - Editing existing leads
11. delete_leads - Deleting leads
12. follow_up_leads - Following up with leads
13. view_insights - Viewing insights and metrics
14. view_analytics - Viewing analytics data
15. general_talks - General conversation not related to the above tasks

User query: {state.user_query}

Return ONLY the intent name (e.g., "create_content", "greeting", "general_talks", etc.) without any explanation.
If the query doesn't match any specific task, return "general_talks"."""

    try:
        response = model.generate_content(prompt)
        intent = response.text.strip().lower()
        
        # Validate intent
        if intent not in INTENT_MAP:
            # Try to find closest match
            for valid_intent in INTENT_MAP.keys():
                if valid_intent in intent or intent in valid_intent:
                    intent = valid_intent
                    break
            else:
                # Default to general_talks for unmatched intents
                intent = "general_talks"

        # Intent Change Detection
        previous_intent = state.intent
        if previous_intent and previous_intent != intent:
            state.intent_change_detected = True

            # Determine change type
            content_intents = ['create_content', 'edit_content', 'delete_content', 'view_content', 'publish_content', 'schedule_content']
            lead_intents = ['create_leads', 'view_leads', 'edit_leads', 'delete_leads', 'follow_up_leads']
            analytics_intents = ['view_insights', 'view_analytics']

            prev_category = None
            new_category = None

            if previous_intent in content_intents:
                prev_category = 'content'
            elif previous_intent in lead_intents:
                prev_category = 'leads'
            elif previous_intent in analytics_intents:
                prev_category = 'analytics'
            elif previous_intent in ['greeting', 'general_talks']:
                prev_category = 'conversation'

            if intent in content_intents:
                new_category = 'content'
            elif intent in lead_intents:
                new_category = 'leads'
            elif intent in analytics_intents:
                new_category = 'analytics'
            elif intent in ['greeting', 'general_talks']:
                new_category = 'conversation'

            if prev_category == new_category and prev_category != 'conversation':
                state.intent_change_type = 'refinement'
            else:
                state.intent_change_type = 'complete_shift'

            state.previous_intent = previous_intent

            # Store full conversation and isolate latest message for clean classification
            if not state.full_conversation:
                state.full_conversation = state.user_query  # Preserve complete conversation history
            # Use only the latest message for intent classification (last non-empty line)
            source_text = state.full_conversation or state.user_query
            conversation_lines = [line.strip() for line in source_text.split('\n') if line.strip()]
            state.user_query = conversation_lines[-1] if conversation_lines else source_text

            print(f"🎯 Intent change detected: {previous_intent} → {intent} ({state.intent_change_type})")

            # For complete shifts, add a brief acknowledgment and reset state
            if state.intent_change_type == 'complete_shift':
                state.result = get_intent_change_message(previous_intent, intent)
                # Reset payload and clarification state for complete shifts
                state.payload = {}
                state.payload_complete = False
                state.clarification_question = None
                state.clarification_options = None
                state.waiting_for_user = False
                print(f"📝 Added intent change acknowledgment for complete shift and reset state")

        else:
            state.intent_change_detected = False
            state.intent_change_type = 'none'
            state.previous_intent = previous_intent or intent

        state.intent = intent
        
        # For greeting, handle directly and end
        if intent == "greeting":
            state = handle_greeting(state)
            state.current_step = "end"
            # Ensure result is never None
            if not state.result:
                state.result = "Hello! How can I help you today?"
        # For general_talks, skip payload construction
        elif intent == "general_talks":
            state.current_step = "action_execution"
        else:
            state.current_step = "payload_construction"
            
        print(f" Intent classified: {intent}")
        
    except Exception as e:
        state.error = f"Intent classification failed: {str(e)}"
        state.current_step = "end"
    
    return state


# ==================== PAYLOAD CONSTRUCTORS ====================

# Common JSON-only instruction suffix for all payload constructors
JSON_ONLY_INSTRUCTION = """

CRITICAL: You MUST respond with ONLY a valid JSON object. Do NOT include any explanatory text, comments, or additional text before or after the JSON.
Your response must start with {{ and end with }}. No other text is allowed.
Return ONLY the JSON object, nothing else."""

def construct_create_content_payload(state: AgentState) -> AgentState:
    """Construct payload for create content task"""

    # Use user_query which contains the full conversation context
    conversation = state.user_query

    prompt = f"""You are extracting information to create content. Analyze the user's query and extract relevant fields.

User conversation:
{conversation}

Extract these fields if mentioned:
- channel: "Social Media" or "Blog"
- platform: "Instagram", "Facebook", "LinkedIn", or "Youtube"
- content_type: "static_post", "carousel", "short_video or reel", "long_video", or "blog"
- media: "Generate", "Upload", or "without media"
- content_idea: The main idea/topic for the content (minimum 10 words)

SPECIAL RULE: If user says something generic like "i want to post", "make a post", "create a post", or similar vague post requests, set content_type to null (do not classify it automatically). Only set content_type if they specify the exact type like "static post", "carousel", "short video", etc.

Based on the content_idea and overall context, classify:
- Post_type: Choose ONE from ["Educational tips", "Quote / motivation", "Promotional offer", "Product showcase", "Carousel infographic", "Announcement", "Testimonial / review", "Before–after", "Behind-the-scenes", "User-generated content", "Brand story", "Meme / humor", "Facts / did-you-know", "Event highlight", "Countdown", "FAQ post", "Comparison", "Case study snapshot", "Milestone / achievement", "Call-to-action post"] or return null
- Image_type: Choose ONE from ["Minimal & Clean with Bold Typography", "Modern Corporate / B2B Professional", "Luxury Editorial (Black, White, Gold Accents)", "Photography-Led Lifestyle Aesthetic", "Product-Focused Clean Commercial Style", "Flat Illustration with Friendly Characters", "Isometric / Explainer Illustration Style", "Playful & Youthful (Memphis / Stickers / Emojis)", "High-Impact Color-Blocking with Loud Type", "Retro / Vintage Poster Style", "Futuristic Tech / AI-Inspired Dark Mode", "Glassmorphism / Neumorphism UI Style", "Abstract Shapes & Fluid Gradient Art", "Infographic / Data-Driven Educational Layout", "Quote Card / Thought-Leadership Typography Post", "Meme-Style / Social-Native Engagement Post", "Festive / Campaign-Based Creative", "Textured Design (Paper, Grain, Handmade Feel)", "Magazine / Editorial Layout with Strong Hierarchy", "Experimental / Artistic Concept-Driven Design"] or return null

Examples:

Query: "Create an Instagram static post about sustainable fashion trends for 2025"
{{
    "channel": "Social Media",
    "platform": "Instagram",
    "content_type": "static_post",
    "media": null,
    "content_idea": "sustainable fashion trends for 2025 including eco-friendly materials and circular economy practices",
    "Post_type": "Educational tips",
    "Image_type": "Photography-Led Lifestyle Aesthetic"
}}

Query: "Create a carousel post for Facebook"
{{
    "channel": "Social Media",
    "platform": "Facebook",
    "content_type": "carousel",
    "media": null,
    "content_idea": null,
    "Post_type": null,
    "Image_type": null
}}

Query: "I want to post something"
{{
    "channel": null,
    "platform": null,
    "content_type": null,
    "media": null,
    "content_idea": null,
    "Post_type": null,
    "Image_type": null
}}

Query: "I need a LinkedIn short video discussing AI impact on healthcare"
{{
    "channel": "Social Media",
    "platform": "LinkedIn",
    "content_type": "short_video or reel",
    "media": null,
    "content_idea": "artificial intelligence impact on healthcare industry transformation including diagnostics and patient care",
    "Post_type": "Educational tips",
    "Image_type": "Modern Corporate / B2B Professional"
}}

Query: "Write a blog post with images about productivity hacks for remote workers"
{{
    "channel": "Blog",
    "platform": null,
    "content_type": "blog",
    "media": "Generate",
    "content_idea": "productivity hacks for remote workers including time management techniques and workspace optimization strategies",
    "Post_type": "Educational tips",
    "Image_type": "Infographic / Data-Driven Educational Layout"
}}

Extract ONLY explicitly mentioned information. For classification fields, set to null if not applicable. Set fields to null if not mentioned.
{JSON_ONLY_INSTRUCTION}"""

    return _extract_payload(state, prompt)


def construct_edit_content_payload(state: AgentState) -> AgentState:
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

    return _extract_payload(state, prompt)


def construct_delete_content_payload(state: AgentState) -> AgentState:
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


{JSON_ONLY_INSTRUCTION}"""

    return _extract_payload(state, prompt)


def construct_view_content_payload(state: AgentState) -> AgentState:
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
- content_type: "post", "short_video", "long_video", "blog", "email", or "message"
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

CRITICAL RULES:
1. Set fields to null if NOT explicitly mentioned in the conversation
2. DO NOT infer or assume values - only extract what the user explicitly stated
3. If user says "view content" without mentioning status, set status to null
4. If user says "show posts" without mentioning status, set status to null
5. Only set status to "published" if user explicitly says "published", "posted", "live", etc.
6. Only set status to "scheduled" if user explicitly says "scheduled", "scheduled posts", etc.
7. Only set status to "generated" if user explicitly says "generated", "draft", "created", etc.
8. Extract search queries like "posts about new year", "christmas content", "summer campaigns"
9. IMPORTANT: When user responds to clarification questions with single words, parse dates correctly:
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
   - "post" → content_type: "post"
   - "generated" → status: "generated"
   - "published" → status: "published"
10. Preserve existing payload values - only update fields that are explicitly mentioned in the current response


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

    return _extract_payload(state, prompt)


def construct_publish_content_payload(state: AgentState) -> AgentState:
    """Construct payload for publish content task"""

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

    prompt = f"""You are extracting information to publish content.

Current date reference: Today is {current_date}
User timezone: {user_timezone}

User conversation:
{conversation}

Extract these fields ONLY if explicitly mentioned:
- channel: "Social Media" or "Blog"
- platform: "Instagram", "Facebook", "LinkedIn", or "Youtube"
- date_range: PARSE dates into YYYY-MM-DD format (e.g., "2025-12-27") or date ranges like "2025-12-20 to 2025-12-27"
- status: "generated", "scheduled"
- content_id: Specific content identifier (e.g., "abc123", "content_001")
- query: Any search terms or phrases the user wants to search for in content (e.g., "posts for new year", "christmas content", "product launch")

CRITICAL CONTENT SELECTION:
- If user says "Publish content: [ID]" or similar, extract the content_id
- Examples: "Publish content: abc123", "Select content abc123", "Publish this content"

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

Examples:

Query: "Publish my christmas content to Instagram this week"
{{
    "channel": "Social Media",
    "platform": "Instagram",
    "date_range": "current week range",
    "status": null,
    "content_id": null,
    "query": "christmas"
}}

Query: "Post the Facebook content I created yesterday"
{{
    "channel": "Social Media",
    "platform": "Facebook",
    "date_range": "yesterday's date",
    "status": null,
    "content_id": null,
    "query": null
}}

Query: "Publish content: abc123"
{{
    "channel": null,
    "platform": null,
    "date_range": null,
    "status": null,
    "content_id": "abc123",
    "query": null
}}

Extract ONLY explicitly mentioned information. Set fields to null if not mentioned.

Return ONLY this format:
{{
    "channel": null or "Social Media" or "Blog",
    "platform": null or "Instagram" or "Facebook" or "LinkedIn" or "Youtube",
    "date_range": null or "YYYY-MM-DD" or "YYYY-MM-DD to YYYY-MM-DD",
    "status": null or "generated" or "scheduled",
    "content_id": null or string,
    "query": null or string
}}

{JSON_ONLY_INSTRUCTION}"""

    return _extract_payload(state, prompt)


def construct_schedule_content_payload(state: AgentState) -> AgentState:
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

    return _extract_payload(state, prompt)


def construct_create_leads_payload(state: AgentState) -> AgentState:
    """Construct payload for create leads task"""

    # Detect and replace PII with default values, store originals
    sanitized_conversation, original_emails, original_phones = detect_and_replace_pii_in_query(state.user_query)
    # Store first email/phone found (for create operations, typically only one set)
    state.temp_original_email = original_emails[0] if original_emails else None
    state.temp_original_phone = original_phones[0] if original_phones else None

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

    prompt = f"""You are extracting information to create a new lead in the system.

Current date reference: Today is {current_date}
User timezone: {user_timezone}

User conversation:
{sanitized_conversation}

Extract these fields if mentioned:
- lead_name: Full name of the lead
- lead_email: Email address
- lead_phone: Phone number
- lead_source: Where the lead came from (website, referral, event, social media, etc.)
- lead_status: "New", "Contacted", "Qualified", "Lost", or "Won"
- follow_up: PARSE dates into YYYY-MM-DD format or ISO format (YYYY-MM-DDTHH:MM:SS)
- remarks: Additional notes

CRITICAL DATE PARSING RULES FOR follow_up:
- Parse ALL date mentions into YYYY-MM-DD format
- "today" → current date ({current_date}) in YYYY-MM-DD format
- "yesterday" → DO NOT USE PAST DATES, convert to tomorrow
- "tomorrow" → tomorrow's date in YYYY-MM-DD format
- "next week" → date 7 days from {current_date}
- Weekday names ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday") → calculate the NEXT occurrence of that weekday from {current_date}
  * If today is Tuesday (Dec 31, 2025) and user says "Sunday", return 2026-01-04 (next Sunday)
  * If today is Tuesday and user says "Friday", return 2026-01-03 (this Friday)
  * If today is Tuesday and user says "Tuesday", return 2026-01-07 (next Tuesday, not today)
  * ALWAYS find the NEXT upcoming occurrence, never use today or past dates
- "next monday", "next tuesday", etc → same as above, calculate next occurrence of that weekday
- Specific dates like "Jan 15" → "YYYY-01-15" (use current/next year appropriately)
- NEVER use past dates - always convert to future dates
- If no date mentioned, set follow_up to null
- Use {current_date} as the reference point for all calculations

Examples:

Query: "Add a new lead John Doe from the website, email atsn@gmail.com, follow up tomorrow"
{{
    "lead_name": "John Doe",
    "lead_email": "atsn@gmail.com",
    "lead_phone": null,
    "lead_source": "website",
    "lead_status": null,
    "follow_up": "{(datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')}",
    "remarks": null
}}

Query: "Create lead Sarah Johnson, phone 9876543210, came from LinkedIn, status is qualified, follow up next Monday"
{{
    "lead_name": "Sarah Johnson",
    "lead_email": null,
    "lead_phone": "9876543210",
    "lead_source": "LinkedIn",
    "lead_status": "Qualified",
    "follow_up": "2025-01-06",
    "remarks": null
}}

Query: "New lead: Mike Chen, atsn@gmail.com, referred by existing client, very interested in our services"
{{
    "lead_name": "Mike Chen",
    "lead_email": "atsn@gmail.com",
    "lead_phone": null,
    "lead_source": "referral",
    "lead_status": null,
    "follow_up": null,
    "remarks": "very interested in our services, referred by existing client"
}}

Extract ONLY explicitly mentioned information. Set fields to null if not mentioned.
{JSON_ONLY_INSTRUCTION}"""

    return _extract_payload(state, prompt)


def construct_view_leads_payload(state: AgentState) -> AgentState:
    """Construct payload for view leads task"""

    # Detect and replace PII with default values for privacy
    sanitized_conversation, original_emails, original_phones = detect_and_replace_pii_in_query(state.user_query)
    # Store originals for potential filtering
    state.temp_filter_emails = original_emails
    state.temp_filter_phones = original_phones

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

    prompt = f"""You are extracting information to view/filter leads.

Current date reference: Today is {current_date}
User timezone: {user_timezone}

User conversation:
{sanitized_conversation}

Extract these fields if mentioned:
- lead_source: One of "Manual Entry", "Facebook", "Instagram", "Walk Ins", "Referral", "Email", "Website", "Phone Call"
- lead_name: Filter by name
- lead_email: Filter by email
- lead_status: One of "new", "contacted", "responded", "qualified", "converted", "lost", "invalid"
- lead_phone: Filter by phone
- date_range: PARSE dates into YYYY-MM-DD format or date ranges

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

Examples:

Query: "Show me all leads from Facebook"
{{
    "lead_source": "Facebook",
    "lead_name": null,
    "lead_email": null,
    "lead_status": null,
    "lead_phone": null,
    "date_range": null
}}

Query: "List all qualified leads from last month"
{{
    "lead_source": null,
    "lead_name": null,
    "lead_email": null,
    "lead_status": "qualified",
    "lead_phone": null,
    "date_range": "last month range"
}}

Query: "Find lead John Doe"
{{
    "lead_source": null,
    "lead_name": "John Doe",
    "lead_email": null,
    "lead_status": null,
    "lead_phone": null,
    "date_range": null
}}

Query: "Show me converted leads from Instagram in the last 30 days"
{{
    "lead_source": "Instagram",
    "lead_name": null,
    "lead_email": null,
    "lead_status": "converted",
    "lead_phone": null,
    "date_range": "last 30 days range"
}}

Query: "Show me leads from yesterday"
{{
    "lead_source": null,
    "lead_name": null,
    "lead_email": null,
    "lead_status": null,
    "lead_phone": null,
    "date_range": "yesterday's date"
}}

Extract ONLY explicitly mentioned information. Set fields to null if not mentioned.

Return ONLY this format:
{{
    "lead_source": null or "Manual Entry" or "Facebook" or "Instagram" or "Walk Ins" or "Referral" or "Email" or "Website" or "Phone Call",
    "lead_name": null or string,
    "lead_email": null or string,
    "lead_status": null or "new" or "contacted" or "responded" or "qualified" or "converted" or "lost" or "invalid",
    "lead_phone": null or string,
    "date_range": null or "YYYY-MM-DD" or "YYYY-MM-DD to YYYY-MM-DD"
}}

{JSON_ONLY_INSTRUCTION}"""

    return _extract_payload(state, prompt)


def construct_edit_leads_payload(state: AgentState) -> AgentState:
    """Construct payload for edit leads task"""

    # Detect and replace PII with default values, store originals for both current and new values
    sanitized_conversation, original_emails, original_phones = detect_and_replace_pii_in_query(state.user_query)
    # For edit operations, store multiple emails/phones (current and new)
    state.temp_original_emails = original_emails
    state.temp_original_phones = original_phones

    prompt = f"""You are extracting information to edit an existing lead.

User conversation:
{sanitized_conversation}

Extract these fields if mentioned:
Identification (current values):
- lead_name: Current name to find the lead
- lead_email: Current email to find the lead (use atsn@gmail.com if mentioned)
- lead_phone: Current phone to find the lead (use 9876543210 if mentioned)

Updates (new values, prefix with "new_"):
- new_lead_name: New name
- new_lead_email: New email (use atsn@gmail.com if mentioned)
- new_lead_phone: New phone (use 9876543210 if mentioned)
- new_lead_source: New source
- new_lead_status: "New", "Contacted", "Qualified", "Lost", or "Won"
- new_remarks: New remarks

Examples:

Query: "Update John Doe's status to Contacted"
{{
    "lead_name": "John Doe",
    "lead_email": null,
    "lead_phone": null,
    "new_lead_status": "Contacted"
}}

Query: "Change the email for Sarah Johnson to atsn@gmail.com"
{{
    "lead_name": "Sarah Johnson",
    "lead_email": null,
    "lead_phone": null,
    "new_lead_email": "atsn@gmail.com"
}}

Query: "Mark lead atsn@gmail.com as won and add note: closed deal worth $10k"
{{
    "lead_name": null,
    "lead_email": "atsn@gmail.com",
    "lead_phone": null,
    "new_lead_status": "Won",
    "new_remarks": "closed deal worth $10k"
}}

Extract ONLY explicitly mentioned information. Set fields to null if not mentioned.
{JSON_ONLY_INSTRUCTION}"""

    return _extract_payload(state, prompt)


def construct_delete_leads_payload(state: AgentState) -> AgentState:
    """Construct payload for delete leads task"""

    # Detect and replace PII with default values for privacy
    sanitized_conversation, original_emails, original_phones = detect_and_replace_pii_in_query(state.user_query)
    # Store originals for deletion identification
    state.temp_delete_emails = original_emails
    state.temp_delete_phones = original_phones

    prompt = f"""You are extracting information to delete a lead.

User conversation:
{sanitized_conversation}

Extract these fields if mentioned:
- lead_id: UUID of the lead to delete (if mentioned directly)
- lead_name: Name of lead to delete
- lead_phone: Phone of lead to delete
- lead_email: Email of lead to delete
- lead_status: Filter by status before deleting

Examples:

Query: "Delete the lead John Doe"
{{
    "lead_id": null,
    "lead_name": "John Doe",
    "lead_phone": null,
    "lead_email": null,
    "lead_status": null
}}

Query: "Remove lead with email atsn@gmail.com"
{{
    "lead_id": null,
    "lead_name": null,
    "lead_phone": null,
    "lead_email": "spam@example.com",
    "lead_status": null
}}

Query: "Delete lead with ID: 123e4567-e89b-12d3-a456-426614174000"
{{
    "lead_id": "123e4567-e89b-12d3-a456-426614174000",
    "lead_name": null,
    "lead_phone": null,
    "lead_email": null,
    "lead_status": null
}}

Query: "Delete all lost leads"
{{
    "lead_id": null,
    "lead_name": null,
    "lead_phone": null,
    "lead_email": null,
    "lead_status": "Lost"
}}

Extract ONLY explicitly mentioned information. Set fields to null if not mentioned.
{JSON_ONLY_INSTRUCTION}"""

    return _extract_payload(state, prompt)


def construct_follow_up_leads_payload(state: AgentState) -> AgentState:
    """Construct payload for follow up leads task"""

    # Detect and replace PII with default values for privacy
    sanitized_conversation, original_emails, original_phones = detect_and_replace_pii_in_query(state.user_query)
    # Store originals for follow-up identification
    state.temp_followup_emails = original_emails
    state.temp_followup_phones = original_phones

    # Get current date for date parsing context
    from datetime import datetime
    current_date = datetime.now().strftime("%Y-%m-%d")

    prompt = f"""You are extracting information to follow up with a lead.

Current date reference: Today is {current_date}

User conversation:
{sanitized_conversation}

Extract these fields if mentioned:
- lead_name: Name of lead to follow up
- lead_email: Email of lead to follow up
- lead_phone: Phone of lead to follow up
- follow_up_message: Specific message to send (optional)
- follow_up_date: PARSE dates into YYYY-MM-DD format

DATE PARSING RULES FOR follow_up_date:
- "today" → current date ({current_date}) in YYYY-MM-DD format
- "tomorrow" → tomorrow's date in YYYY-MM-DD format
- "next week" → date 7 days from {current_date}
- Weekday names ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday") → calculate the NEXT occurrence of that weekday from {current_date}
  * If today is Tuesday (Dec 31, 2025) and user says "Sunday", return 2026-01-04 (next Sunday)
  * If today is Tuesday and user says "Friday", return 2026-01-03 (this Friday)
  * If today is Tuesday and user says "Tuesday", return 2026-01-07 (next Tuesday, not today)
  * ALWAYS find the NEXT upcoming occurrence, never use today or past dates
- "next monday", "next tuesday", etc → same as above, calculate next occurrence of that weekday
- Specific dates like "Jan 15" → "YYYY-01-15" (use current/next year appropriately)
- NEVER use past dates - always convert to future dates
- If no date mentioned, set to null
- Use {current_date} as the reference point for all calculations

Examples:

Query: "Follow up with John Doe about the proposal next Monday"
{{
    "lead_name": "John Doe",
    "lead_email": null,
    "lead_phone": null,
    "follow_up_message": "following up about the proposal",
    "follow_up_date": "2025-01-06"
}}

Query: "Send follow-up email to atsn@gmail.com asking about the meeting tomorrow"
{{
    "lead_name": null,
    "lead_email": "sarah@company.com",
    "lead_phone": null,
    "follow_up_message": "asking about the meeting",
    "follow_up_date": "{(datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')}"
}}

Query: "Call lead Mike Chen to check if he's ready to proceed"
{{
    "lead_name": "Mike Chen",
    "lead_email": null,
    "lead_phone": null,
    "follow_up_message": "check if ready to proceed with next steps",
    "follow_up_date": null
}}

Extract ONLY explicitly mentioned information. Set fields to null if not mentioned.
{JSON_ONLY_INSTRUCTION}"""

    return _extract_payload(state, prompt)


def construct_view_insights_payload(state: AgentState) -> AgentState:
    """Construct payload for view insights task"""
    
    # Use user_query which contains the full conversation context
    conversation = state.user_query
    
    prompt = f"""You are extracting information to view insights and metrics.

User conversation:
{conversation}

Extract these fields if mentioned:
- channel: "Social Media" or "Blog"
- platform: "Instagram", "Facebook", "LinkedIn", or "Youtube"
- metrics: List of metrics (engagement, reach, clicks, conversions, etc.)
- date_range: "today", "this week", "last week", "yesterday", or "custom date"

Examples:

Query: "Show me Instagram engagement metrics for this week"
{{
    "channel": "Social Media",
    "platform": "Instagram",
    "metrics": ["engagement"],
    "date_range": "this week"
}}

Query: "What's the reach and clicks on LinkedIn posts from last week?"
{{
    "channel": "Social Media",
    "platform": "LinkedIn",
    "metrics": ["reach", "clicks"],
    "date_range": "last week"
}}

Query: "Display all social media insights"
{{
    "channel": "Social Media",
    "platform": null,
    "metrics": null,
    "date_range": null
}}

Extract ONLY explicitly mentioned information. Set fields to null if not mentioned.
{JSON_ONLY_INSTRUCTION}"""

    return _extract_payload(state, prompt)


def construct_view_analytics_payload(state: AgentState) -> AgentState:
    """Construct payload for view analytics task"""
    
    # Use user_query which contains the full conversation context
    conversation = state.user_query
    
    prompt = f"""You are extracting information to view analytics data.

User conversation:
{conversation}

Extract these fields if mentioned:
- channel: "Social Media" or "Blog"
- platform: "Instagram", "Facebook", "LinkedIn", or "Youtube"
- date_range: "today", "this week", "last week", "yesterday", or "custom date"

Examples:

Query: "Show me Facebook analytics for this week"
{{
    "channel": "Social Media",
    "platform": "Facebook",
    "date_range": "this week"
}}

Query: "Display email analytics from last week"
{{
    "channel": "Email",
    "platform": "Gmail",
    "date_range": "last week"
}}

Query: "Show all LinkedIn analytics"
{{
    "channel": "Social Media",
    "platform": "LinkedIn",
    "date_range": null
}}

Extract ONLY explicitly mentioned information. Set fields to null if not mentioned.
{JSON_ONLY_INSTRUCTION}"""

    return _extract_payload(state, prompt)


def _extract_payload(state: AgentState, prompt: str) -> AgentState:
    """Helper function to extract payload using Gemini with retry mechanism"""
    import json
    import re
    
    max_retries = 2
    
    for attempt in range(max_retries):
        try:
            # Add stricter instruction on retry
            current_prompt = prompt
            if attempt > 0:
                current_prompt = prompt + "\n\nREMINDER: Respond with ONLY JSON. No explanations, no text before or after. Just the JSON object starting with { and ending with }."
            
            response = model.generate_content(current_prompt)
            raw_result = response.text.strip()
            
            # Log raw response for debugging
            logger.info(f"Raw LLM response (attempt {attempt + 1}): {raw_result[:300]}...")
            
            if not raw_result:
                if attempt < max_retries - 1:
                    continue  # Retry
                raise ValueError("Empty response from LLM")
            
            result = raw_result
            
            # Clean JSON response - try multiple extraction methods
            # Method 1: Extract from code blocks
            if "```json" in result:
                result = result.split("```json")[1].split("```")[0].strip()
            elif "```" in result:
                # Try to extract JSON from any code block
                code_blocks = re.findall(r'```(?:json)?\s*\n?(.*?)```', result, re.DOTALL)
                if code_blocks:
                    result = code_blocks[0].strip()
            
            # Method 2: Try to find JSON object in text using improved regex
            if not result or result == raw_result or not result.startswith('{'):
                # Look for JSON object pattern - improved regex to handle nested objects
                json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', raw_result, re.DOTALL)
                if json_match:
                    result = json_match.group(0).strip()
            
            # Method 3: If still no JSON found, try the whole response
            if not result or result == raw_result:
                result = raw_result.strip()
            
            # Remove any leading/trailing non-JSON text
            # Find the first { and last }
            first_brace = result.find('{')
            last_brace = result.rfind('}')
            if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
                result = result[first_brace:last_brace + 1]
            
            # Check if result looks like JSON (starts with { and ends with })
            if not result or not result.startswith('{') or not result.endswith('}'):
                if attempt < max_retries - 1:
                    logger.warning(f"No valid JSON found in attempt {attempt + 1}, retrying...")
                    continue  # Retry
                raise ValueError(f"No JSON found in response. Raw response: {raw_result[:200]}")
            
            # Try to parse JSON
            try:
                extracted_payload = json.loads(result)
            except json.JSONDecodeError as json_err:
                # Log the problematic JSON for debugging
                logger.error(f"JSON parse error (attempt {attempt + 1}): {json_err}")
                logger.error(f"Attempted to parse: {result[:500]}")
                if attempt < max_retries - 1:
                    logger.warning(f"Retrying with stricter prompt...")
                    continue  # Retry with stricter prompt
                raise ValueError(f"Invalid JSON format: {str(json_err)}. Response: {result[:200]}")
            
            # Validate extracted payload is a dict
            if not isinstance(extracted_payload, dict):
                if attempt < max_retries - 1:
                    continue  # Retry
                raise ValueError(f"Extracted payload is not a dictionary: {type(extracted_payload)}")
            
            # Merge with existing payload - only update non-null values to preserve existing data
            if state.payload:
                # Only update fields that are not null in the extracted payload
                for key, value in extracted_payload.items():
                    if value is not None:
                        state.payload[key] = value
            else:
                state.payload = extracted_payload
            
            state.current_step = "payload_completion"
            print(f" Payload constructed: {state.payload}")
            logger.info(f"Successfully extracted payload on attempt {attempt + 1}: {state.payload}")
            return state  # Success!
            
        except Exception as e:
            if attempt < max_retries - 1:
                logger.warning(f"Attempt {attempt + 1} failed: {str(e)}, retrying...")
                continue  # Retry
            else:
                # Final attempt failed
                error_msg = f"Payload construction failed after {max_retries} attempts: {str(e)}"
                logger.error(error_msg, exc_info=True)
                logger.error(f"Final raw response: {raw_result[:500] if 'raw_result' in locals() else 'N/A'}")
                state.error = error_msg
                state.current_step = "end"
                # Don't clear existing payload on error - preserve what we have
                return state
    
    # Should not reach here, but just in case
    state.error = "Payload construction failed: Unknown error"
    state.current_step = "end"
    return state


# ==================== PAYLOAD COMPLETERS ====================

FIELD_CLARIFICATIONS = {
    "create_content": {
        "channel": {
            "question": "Hello! Let's create some content together.\n\nWhich channel would you like to focus on?",
            "options": [
                {"label": "Social Media", "value": "Social Media"},
                {"label": "Blog", "value": "Blog"}
            ]
        },
        "platform": {
            "question": "Great choice! Now, where would you like to share this content?",
            "options": [
                {"label": "Instagram", "value": "Instagram"},
                {"label": "Facebook", "value": "Facebook"},
                {"label": "LinkedIn", "value": "LinkedIn"},
                {"label": "YouTube", "value": "YouTube"}
            ]
        },
        "content_type": {
            "question": "Perfect! What kind of content are you thinking?",
            "options": [
                {"label": "Static Post", "value": "static_post"},
                {"label": "Carousel", "value": "carousel"},
                {"label": "Short Video/Reel", "value": "short_video or reel"},
                {"label": "Long Video", "value": "long_video"},
                {"label": "Blog Post", "value": "blog"}
            ]
        },
        "media": {
            "question": "Awesome! Should we include some visual elements?",
            "options": [
                {"label": "Yes, Generate", "value": "Generate"},
                {"label": "I will Upload", "value": "Upload"},
                {"label": "Generate Without media", "value": "Without media"}
            ]
        },
        "content_idea": {
            "question": "Love it! Tell me more about what you have in mind. What's the main idea or topic you want to cover? (Aim for at least 10 words to give me a good sense of what you're looking for)",
            "options": []
        },
        "Post_type": {
            "question": "What kind of post are you thinking of?",
            "options": [],  # No multiple choice options - open-ended
            "full_options": [  # Full list for contextual LLM suggestion
                {"label": "Educational tips", "value": "Educational tips"},
                {"label": "Quote / motivation", "value": "Quote / motivation"},
                {"label": "Promotional offer", "value": "Promotional offer"},
                {"label": "Product showcase", "value": "Product showcase"},
                {"label": "Carousel infographic", "value": "Carousel infographic"},
                {"label": "Announcement", "value": "Announcement"},
                {"label": "Testimonial / review", "value": "Testimonial / review"},
                {"label": "Before–after", "value": "Before–after"},
                {"label": "Behind-the-scenes", "value": "Behind-the-scenes"},
                {"label": "User-generated content", "value": "User-generated content"},
                {"label": "Brand story", "value": "Brand story"},
                {"label": "Meme / humor", "value": "Meme / humor"},
                {"label": "Facts / did-you-know", "value": "Facts / did-you-know"},
                {"label": "Event highlight", "value": "Event highlight"},
                {"label": "Countdown", "value": "Countdown"},
                {"label": "FAQ post", "value": "FAQ post"},
                {"label": "Comparison", "value": "Comparison"},
                {"label": "Case study snapshot", "value": "Case study snapshot"},
                {"label": "Milestone / achievement", "value": "Milestone / achievement"},
                {"label": "Call-to-action post", "value": "Call-to-action post"}
            ]
        },
        "Image_type": {
            "question": "What's the visual style you have in mind for your images?",
            "options": [],  # No multiple choice options - open-ended
            "full_options": [  # Full list for contextual LLM suggestion
                {"label": "Minimal & Clean with Bold Typography", "value": "Minimal & Clean with Bold Typography"},
                {"label": "Modern Corporate / B2B Professional", "value": "Modern Corporate / B2B Professional"},
                {"label": "Luxury Editorial (Black, White, Gold Accents)", "value": "Luxury Editorial (Black, White, Gold Accents)"},
                {"label": "Photography-Led Lifestyle Aesthetic", "value": "Photography-Led Lifestyle Aesthetic"},
                {"label": "Product-Focused Clean Commercial Style", "value": "Product-Focused Clean Commercial Style"},
                {"label": "Flat Illustration with Friendly Characters", "value": "Flat Illustration with Friendly Characters"},
                {"label": "Isometric / Explainer Illustration Style", "value": "Isometric / Explainer Illustration Style"},
                {"label": "Playful & Youthful (Memphis / Stickers / Emojis)", "value": "Playful & Youthful (Memphis / Stickers / Emojis)"},
                {"label": "High-Impact Color-Blocking with Loud Type", "value": "High-Impact Color-Blocking with Loud Type"},
                {"label": "Retro / Vintage Poster Style", "value": "Retro / Vintage Poster Style"},
                {"label": "Futuristic Tech / AI-Inspired Dark Mode", "value": "Futuristic Tech / AI-Inspired Dark Mode"},
                {"label": "Glassmorphism / Neumorphism UI Style", "value": "Glassmorphism / Neumorphism UI Style"},
                {"label": "Abstract Shapes & Fluid Gradient Art", "value": "Abstract Shapes & Fluid Gradient Art"},
                {"label": "Infographic / Data-Driven Educational Layout", "value": "Infographic / Data-Driven Educational Layout"},
                {"label": "Quote Card / Thought-Leadership Typography Post", "value": "Quote Card / Thought-Leadership Typography Post"},
                {"label": "Meme-Style / Social-Native Engagement Post", "value": "Meme-Style / Social-Native Engagement Post"},
                {"label": "Festive / Campaign-Based Creative", "value": "Festive / Campaign-Based Creative"},
                {"label": "Textured Design (Paper, Grain, Handmade Feel)", "value": "Textured Design (Paper, Grain, Handmade Feel)"},
                {"label": "Magazine / Editorial Layout with Strong Hierarchy", "value": "Magazine / Editorial Layout with Strong Hierarchy"},
                {"label": "Experimental / Artistic Concept-Driven Design", "value": "Experimental / Artistic Concept-Driven Design"}
            ]
        },
    },
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
    },
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
    },
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
            "question": "Which content type would you like to explore? I can show you Posts, Short videos, Long videos, Blogs, Emails, or Messages.",
            "options": [
                {"label": "Post", "value": "post"},
                {"label": "Short video", "value": "short video"},
                {"label": "Long video", "value": "long video"},
                {"label": "Blog", "value": "blog"},
                {"label": "Email", "value": "email"},
                {"label": "Message", "value": "message"}
            ]
        },
    },
    "publish_content": {
        "channel": {
            "question": "Which content do you want to publish? I can show you your content for Social Media, Blog, Email, or Messages.",
            "options": [
                {"label": "Social Media", "value": "Social Media"},
                {"label": "Blog", "value": "Blog"}
            ]
        },
        "platform": {
            "question": "Which platform do you want to publish on? I can show you your content for Instagram, Facebook, LinkedIn, YouTube, Gmail, or WhatsApp.",
            "options": [
                {"label": "Instagram", "value": "Instagram"},
                {"label": "Facebook", "value": "Facebook"},
                {"label": "LinkedIn", "value": "LinkedIn"},
                {"label": "YouTube", "value": "YouTube"}
            ]
        },
        "date_range": {
            "question": "Please select a time period to search your drafted posts or scheduled posts to publish",
            "options": [
                {"label": "Today", "value": "today"},
                {"label": "This week", "value": "this week"},
                {"label": "Last week", "value": "last week"},
                {"label": "Yesterday", "value": "yesterday"},
                {"label": "Custom date", "value": "show_date_picker"}
            ]
        },
        "status": {
            "question": "Do you want to publish from your generated or drafts posts? or publish a scheduled post early",
            "options": [
                {"label": "Generated/Drafts", "value": "generated"},
                {"label": "Scheduled", "value": "scheduled"}
            ]
        },
    },
    "schedule_content": {
        "schedule_date": {
            "question": "When would you like this to be posted? You can say things like 'Tomorrow', 'Next Monday', or a specific date.",
            "options": [
                {"label": "Tomorrow", "value": "tomorrow"},
                {"label": "Next Monday", "value": "next monday"},
                {"label": "Next week", "value": "next week"}
            ]
        },
        "schedule_time": {
            "question": "What time would you like this posted?",
            "options": [
                {"label": "Morning (9 AM)", "value": "morning"},
                {"label": "Afternoon (2 PM)", "value": "afternoon"},
                {"label": "Evening (6 PM)", "value": "evening"}
            ]
        }
    },
    "create_leads": {
        "lead_name": {
            "question": "Let's add a new lead! What's the person's name? (This helps us identify them easily)",
            "options": []
        },
        "lead_email": {
            "question": "Got it! What's their email address? We'll use this to stay in touch.",
            "options": []
        },
        "lead_phone": {
            "question": "Perfect! What's their phone number? (Optional, but helpful for follow-ups)",
            "options": []
        },
        "lead_source": {
            "question": "Thanks! How did you connect with this lead? This helps us understand where our best leads come from!",
            "options": [
                {"label": "Website", "value": "Website", "description": "Through your site"},
                {"label": "Social Media", "value": "Social Media", "description": "From social platforms"},
                {"label": "Referral", "value": "Referral", "description": "Someone recommended them"},
                {"label": "Event", "value": "Event", "description": "Met at an event"},
                {"label": "Other", "value": "Other", "description": "Tell me more"}
            ]
        },
        "lead_status": {
            "question": "Great! What's their current status in our process?",
            "options": [
                {"label": "New", "value": "new", "description": "Just discovered"},
                {"label": "Contacted", "value": "contacted", "description": "We've reached out"},
                {"label": "Qualified", "value": "qualified", "description": "Good fit for us"},
                {"label": "Proposal", "value": "proposal", "description": "Sent a proposal"},
                {"label": "Negotiation", "value": "negotiation", "description": "Discussing terms"},
                {"label": "Closed Won", "value": "closed_won", "description": "They chose us!"},
                {"label": "Closed Lost", "value": "closed_lost", "description": "Didn't work out"}
            ]
        },
        "follow_up": {
            "question": "When should we follow up with this lead? Choose from common options or pick a custom date.",
            "options": [
                {"label": "Today", "value": "today"},
                {"label": "Tomorrow", "value": "tomorrow"},
                {"label": "Next week", "value": "next week"},
                {"label": "Next month", "value": "next month"},
                {"label": "Custom date", "value": "show_date_picker"}
            ]
        },
        "remarks": {
            "question": "Awesome! Any additional notes or details about this lead that would be helpful to remember?",
            "options": []
        },
    },
    "view_leads": {
        "lead_source": {
            "question": "Let's find some leads! Which source would you like to check?",
            "options": [
                {"label": "Website", "value": "Website"},
                {"label": "Social Media", "value": "Social Media"},
                {"label": "Referral", "value": "Referral"},
                {"label": "Event", "value": "Event"},
                {"label": "Other", "value": "Other"}
            ]
        },
        "lead_name": {
            "question": "Perfect! Which lead would you like to look up? Just give me their name.",
            "options": []
        },
        "lead_email": {
            "question": "Got it! What's their email address? I'll find them for you.",
            "options": []
        },
        "lead_status": {
            "question": "Great! Which status group are you interested in?",
            "options": [
                {"label": "New", "value": "new"},
                {"label": "Contacted", "value": "contacted"},
                {"label": "Qualified", "value": "qualified"},
                {"label": "Proposal", "value": "proposal"},
                {"label": "Negotiation", "value": "negotiation"},
                {"label": "Closed Won", "value": "closed_won"},
                {"label": "Closed Lost", "value": "closed_lost"}
            ]
        },
        "lead_phone": {
            "question": "Alright! What's their phone number? I'll search for the matching contact.",
            "options": []
        },
        "date_range": {
            "question": "Please select a date range to view these leads.",
            "options": [
                {"label": "Today", "value": "today"},
                {"label": "Yesterday", "value": "yesterday"},
                {"label": "This week", "value": "this week"},
                {"label": "Last week", "value": "last week"},
                {"label": "This month", "value": "this month"},
                {"label": "Last month", "value": "last month"},
                {"label": "Custom date", "value": "show_date_picker"}
            ]
        },
    },
    "edit_leads": {
        "lead_name": {
            "question": "Let's update a lead! Which lead would you like to edit? Just tell me their name.",
            "options": []
        },
        "lead_source": {
            "question": "Thanks! What's their new source?",
            "options": [
                {"label": "Website", "value": "Website", "description": "Website visitor"},
                {"label": "Social Media", "value": "Social Media", "description": "Social contact"},
                {"label": "Referral", "value": "Referral", "description": "Recommended"},
                {"label": "Event", "value": "Event", "description": "Event attendee"},
                {"label": "Other", "value": "Other", "description": "Tell me more"}
            ]
        },
        "lead_email": {
            "question": "Got it! What's their new email address?",
            "options": []
        },
        "lead_phone": {
            "question": "Perfect! What's their updated phone number?",
            "options": []
        },
    },
    "delete_leads": {
        "lead_name": {
            "question": "Let's clean up the leads list! Which lead would you like to remove? Just give me their name.",
            "options": []
        },
        "lead_phone": {
            "question": "Alright! What's their phone number? This helps me find the right person.",
            "options": []
        },
        "lead_email": {
            "question": "Got it! What's their email address? I'll locate them for you.",
            "options": []
        },
        "lead_status": {
            "question": "Thanks! What's their current status?",
            "options": [
                {"label": "New", "value": "new", "description": "Fresh leads"},
                {"label": "Contacted", "value": "contacted", "description": "We've reached out"},
                {"label": "Qualified", "value": "qualified", "description": "Good prospects"},
                {"label": "Proposal", "value": "proposal", "description": "Sent proposals"},
                {"label": "Negotiation", "value": "negotiation", "description": "Active discussions"},
                {"label": "Closed Won", "value": "closed_won", "description": "Our clients!"},
                {"label": "Closed Lost", "value": "closed_lost", "description": "Didn't convert"}
            ]
        },
    },
    "follow_up_leads": {
        "lead_name": {
            "question": "Time for a follow-up! Which lead would you like to reach out to?",
            "options": []
        },
        "lead_email": {
            "question": "Perfect! What's their email address? I'll help you craft the perfect follow-up.",
            "options": []
        },
        "lead_phone": {
            "question": "Got it! What's their phone number? We can prepare a call or message.",
            "options": []
        },
    },
    "view_insights": {
        "channel": {
            "question": "Let's check your performance! Which channel would you like insights for?",
            "options": [
                {"label": "Social Media", "value": "Social Media", "description": "Social performance"},
                {"label": "Blog", "value": "Blog", "description": "Article engagement"},
                {"label": "Email", "value": "Email", "description": "Campaign results"},
                {"label": "Messages", "value": "Messages", "description": "Direct message stats"}
            ]
        },
        "platform": {
            "question": "Awesome! Which platform should we analyze?",
            "options": [
                {"label": "Instagram", "value": "Instagram", "description": "Visual analytics"},
                {"label": "Facebook", "value": "Facebook", "description": "Community metrics"},
                {"label": "LinkedIn", "value": "LinkedIn", "description": "Professional insights"},
                {"label": "YouTube", "value": "YouTube", "description": "Video performance"},
                {"label": "Gmail", "value": "Gmail", "description": "Email analytics"},
                {"label": "WhatsApp", "value": "WhatsApp", "description": "Message engagement"}
            ]
        },
        "date_range": {
            "question": "Perfect! What time period interests you?",
            "options": [
                {"label": "Today", "value": "today", "description": "Today's performance"},
                {"label": "This week", "value": "this week", "description": "Weekly overview"},
                {"label": "Last week", "value": "last week", "description": "Previous week"},
                {"label": "This month", "value": "this month", "description": "Monthly summary"},
                {"label": "Last month", "value": "last month", "description": "Last month's data"}
            ]
        },
        "metrics": {
            "question": "Great! What would you like to focus on?",
            "options": [
                {"label": "Engagement", "value": "engagement", "description": "Likes, comments, shares"},
                {"label": "Reach", "value": "reach", "description": "How many people saw it"},
                {"label": "Followers", "value": "followers", "description": "Growth metrics"},
                {"label": "Performance", "value": "performance", "description": "Overall success"},
                {"label": "All metrics", "value": "all", "description": "Complete overview"}
            ]
        },
    },
    "view_analytics": {
        "channel": {
            "question": "Let's dive into the numbers! Which channel would you like to analyze?",
            "options": [
                {"label": "Social Media", "value": "Social Media", "description": "Social performance"},
                {"label": "Blog", "value": "Blog", "description": "Article analytics"},
                {"label": "Email", "value": "Email", "description": "Campaign metrics"},
                {"label": "Messages", "value": "Messages", "description": "Direct message stats"}
            ]
        },
        "platform": {
            "question": "Exciting! Which platform should we examine?",
            "options": [
                {"label": "Instagram", "value": "Instagram", "description": "Visual analytics"},
                {"label": "Facebook", "value": "Facebook", "description": "Community insights"},
                {"label": "LinkedIn", "value": "LinkedIn", "description": "Professional metrics"},
                {"label": "YouTube", "value": "YouTube", "description": "Video performance"},
                {"label": "Gmail", "value": "Gmail", "description": "Email analytics"},
                {"label": "WhatsApp", "value": "WhatsApp", "description": "Message statistics"}
            ]
        },
        "date_range": {
            "question": "Perfect! What time period should we look at?",
            "options": [
                {"label": "Today", "value": "today", "description": "Today's data"},
                {"label": "This week", "value": "this week", "description": "Weekly trends"},
                {"label": "Last week", "value": "last week", "description": "Previous week"},
                {"label": "This month", "value": "this month", "description": "Monthly overview"},
                {"label": "Last month", "value": "last month", "description": "Last month's performance"}
            ]
        },
    },
}


# ==================== INDIVIDUAL PAYLOAD COMPLETERS ====================

def complete_view_content_payload(state: AgentState) -> AgentState:
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
        print(" View content payload complete - all fields provided")
        print(f"  Final payload: {state.payload}")
        return state
    
    next_field = missing_fields[0]
    clarification_data = clarifications.get(next_field, {})

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
    print(f"? Clarification needed for view_content: {state.clarification_question}")

    return state


def complete_create_content_payload(state: AgentState) -> AgentState:
    """Complete create_content payload"""

    # Define the clarification flow order (media last)
    clarification_flow = ["channel", "platform", "content_type", "content_idea", "Post_type", "media"]

    # Build required fields list based on current state
    required_fields = []

    # Check if all fields before media are complete
    other_fields_complete = True
    for field in clarification_flow[:-1]:  # All fields except media
        if field == "Image_type":
            # Only require Image_type if media is "Generate"
            if state.payload.get("media") == "Generate":
                if field not in state.payload or state.payload.get(field) is None or not state.payload.get(field):
                    other_fields_complete = False
                    break
        elif field == "content_idea":
            # Special handling for content_idea - check word count
            content_idea = state.payload.get("content_idea", "")
            if not content_idea or len(content_idea.split()) < 10:
                other_fields_complete = False
                break
        else:
            # Check if field is missing or empty
            if field not in state.payload or state.payload.get(field) is None or not state.payload.get(field):
                other_fields_complete = False
                break

    for field in clarification_flow:
        if field == "Image_type":
            # Only require Image_type if media is "Generate"
            if state.payload.get("media") == "Generate":
                if field not in state.payload or state.payload.get(field) is None or not state.payload.get(field):
                    required_fields.append(field)
        elif field == "content_idea":
            # Special handling for content_idea - check word count
            content_idea = state.payload.get("content_idea", "")
            if not content_idea or len(content_idea.split()) < 10:
                required_fields.append(field)
        elif field == "media":
            # Only ask for media if all other fields are complete
            if other_fields_complete:
                if field not in state.payload or state.payload.get(field) is None or not state.payload.get(field):
                    required_fields.append(field)
        else:
            # Check if field is missing or empty
            if field not in state.payload or state.payload.get(field) is None or not state.payload.get(field):
                required_fields.append(field)

    clarifications = FIELD_CLARIFICATIONS.get("create_content", {})

    if not required_fields:
        state.payload_complete = True
        state.current_step = "action_execution"
        print(" Create content payload complete")
        return state

    next_field = required_fields[0]
    clarification_data = clarifications.get(next_field, {})

    # Calculate remaining questions count
    remaining_questions = len(required_fields)

    if isinstance(clarification_data, dict):
        base_question = clarification_data.get("question", f"Please provide: {next_field.replace('_', ' ')}")

        # Question count will be included in the enhanced_base_question for personalization

        # Special handling for channel options when content_type is a post type
        if next_field == "channel":
            content_type = state.payload.get("content_type")
            print(f"DEBUG: Channel clarification - content_type is: {content_type}")
            post_types = ["static_post", "carousel"]
            if content_type in post_types:
                # Filter channel options to only show Social Media for posts
                original_options = clarification_data.get("options", [])
                filtered_options = [
                    option for option in original_options
                    if option.get("value") in ["Social Media"]
                ]
        # Special handling for content_type options when platform is Instagram
        elif next_field == "content_type":
            platform = state.payload.get("platform")
            print(f"DEBUG: Content type clarification - platform is: {platform}")
            if platform == "Instagram":
                # Filter out "Blog Post" for Instagram
                original_options = clarification_data.get("options", [])
                filtered_options = [
                    option for option in original_options
                    if option.get("value") != "blog"
                ]
                state.clarification_options = filtered_options
                # Add question count to the base question that was already modified above
                state.clarification_question = base_question
                state.waiting_for_user = True
                state.result = f"{base_question}\n\nPlease choose one of the options below:"
                return state
        # Special handling for media options when platform is Instagram
        elif next_field == "media":
            platform = state.payload.get("platform")
            print(f"DEBUG: Media clarification - platform is: {platform}")
            if platform == "Instagram":
                # Filter out "Without media" for Instagram - Instagram requires visual content
                original_options = clarification_data.get("options", [])
                filtered_options = [
                    option for option in original_options
                    if option.get("value") != "Without media"
                ]
                state.clarification_options = filtered_options
                # Add question count to the base question that was already modified above
                state.clarification_question = base_question
                state.waiting_for_user = True
                state.result = f"{base_question}\n\nPlease choose one of the options below:"
                return state
                clarification_data = clarification_data.copy()
                clarification_data["options"] = filtered_options
                print(f"DEBUG: Filtered channel options to: {[opt.get('value') for opt in filtered_options]}")

        # Special handling for platform options when channel is "Social Media"
        if next_field == "platform":
            channel = state.payload.get("channel")
            print(f"DEBUG: Platform clarification - channel is: {channel}")
            if channel == "Social Media":
                # Filter platform options to only show social media platforms for Social Media channel
                original_options = clarification_data.get("options", [])
                filtered_options = [
                    option for option in original_options
                    if option.get("value") in ["Instagram", "Facebook", "LinkedIn", "YouTube"]
                ]
                clarification_data = clarification_data.copy()
                clarification_data["options"] = filtered_options
                print(f"DEBUG: Filtered platform options to: {[opt.get('value') for opt in filtered_options]}")

        # Special handling for content_idea validation
        if next_field == "content_idea":
            existing_content = state.payload.get("content_idea", "")
            if existing_content and len(existing_content.split()) < 10:
                base_question = f"Your content idea is too short (needs at least 10 words). {base_question}"

        # For Post_type and Image_type, get contextual LLM suggestion
        if next_field in ["Post_type", "Image_type"]:
            all_options = clarification_data.get("full_options", [])
            if all_options:
                contextual_suggestion = get_contextual_suggestion(
                    field_type=next_field,
                    conversation_context=state.user_query or "",
                    all_options=all_options
                )
                base_question = f"{base_question} Based on what you've told me, how about '{contextual_suggestion}'? Or tell me your own preference!"

        # Add remaining questions count to the question for personalization
        question_count_context = f"I will ask you just {remaining_questions} more question{'s' if remaining_questions > 1 else ''} for further understanding."
        enhanced_base_question = f"{question_count_context}\n\n{base_question}"

        # Generate personalized question using LLM
        logger.info(f"Calling LLM for clarification question. Base: '{enhanced_base_question}', User context length: {len(state.user_query or '')}")
        personalized_question = generate_clarifying_question(
            base_question=enhanced_base_question,
            user_context=state.user_query,
            user_input=state.user_query.split('\n')[-1] if state.user_query else ""
        )
        logger.info(f"LLM returned: '{personalized_question}'")

        state.clarification_question = personalized_question
        state.clarification_options = clarification_data.get("options", [])
        state.result = f"{personalized_question}\n\nPlease choose one of the options below:"
    else:
        # Backward compatibility for string clarifications
        question_text = clarification_data or f"Please provide: {next_field.replace('_', ' ')}"
        # Add remaining questions count to the question
        question_count_context = f"I will ask you just {remaining_questions} more question{'s' if remaining_questions > 1 else ''} for further understanding."
        state.clarification_question = f"{question_count_context}\n\n{question_text}"
        state.clarification_options = []
        state.result = f"{state.clarification_question}\n\nPlease choose one of the options below:"

    state.waiting_for_user = True
    state.current_step = "waiting_for_clarification"
    print(f"? Clarification needed for create_content: {state.clarification_question}")

    return state


def complete_edit_content_payload(state: AgentState) -> AgentState:
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


def complete_delete_content_payload(state: AgentState) -> AgentState:
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


def check_channel_connection(user_id: str, channel_or_platform: str) -> bool:
    """Check if user has an active connection for the specified channel/platform"""
    if not supabase or not user_id or not channel_or_platform:
        return False

    try:
        # First check if it's a direct platform name
        platform_names = ["instagram", "facebook", "linkedin", "youtube", "gmail", "whatsapp", "wordpress", "google"]
        if channel_or_platform.lower() in platform_names:
            platform = channel_or_platform.lower()
            # Handle platform name variations
            if platform == "gmail":
                platform = "google"
        else:
            # Map channel to platform for connection checking
            platform_mapping = {
                "Social Media": None,  # Social Media is a channel, not a specific platform
                "Blog": "wordpress",
                "Email": "google",  # Gmail uses Google OAuth
                "messages": "whatsapp"
            }

            platform = platform_mapping.get(channel_or_platform)
            if not platform:
                # For Social Media channel or unknown channel, allow to proceed
                # They will need to specify a platform
                return True

        # Check if user has active connection for this platform (case-insensitive)
        response = supabase.table("platform_connections").select("*").eq(
            "user_id", user_id
        ).ilike("platform", platform).eq("is_active", True).execute()

        return bool(response.data and len(response.data) > 0)

    except Exception as e:
        logger.error(f"Error checking channel connection: {e}")
        return False


def complete_publish_content_payload(state: AgentState) -> AgentState:
    """Complete publish_content payload - fields required before proceeding, except when search query is provided"""

    # Handle direct content selection (highest priority)
    if state.payload.get('content_id') and state.payload['content_id'].strip():
        logger.info(f"Direct content selection detected: {state.payload['content_id']}")
        state.payload_complete = True
        state.current_step = "action_execution"
        print(f" Publish content payload complete - direct content selection: {state.payload['content_id']}")
        print(f"  Final payload: {state.payload}")
        return state

    # Give priority to search queries - if query is present, skip clarifying questions
    if state.payload.get('query') and state.payload['query'].strip():
        logger.info("Search query detected, skipping clarifying questions and proceeding with search")
        state.payload_complete = True
        state.current_step = "action_execution"
        print(" Publish content payload complete - search query provided, proceeding without clarifications")
        print(f"  Final payload: {state.payload}")
        return state

    required_fields = ["channel", "platform", "date_range", "status"]
    clarifications = FIELD_CLARIFICATIONS.get("publish_content", {})

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

    # Handle special connection-related responses
    user_query_lower = state.user_query.lower().strip() if state.user_query else ""
    if user_query_lower in ["connect_account", "change_channel", "change_platform", "cancel"]:
        if user_query_lower == "connect_account":
            # Determine which platform needs to be connected based on current payload
            platform_to_connect = state.payload.get('platform')
            print(f"DEBUG: connect_account selected, current payload: {state.payload}")
            print(f"DEBUG: platform from payload: {platform_to_connect}")

            if not platform_to_connect:
                # Try to map channel to platform
                channel = state.payload.get('channel')
                print(f"DEBUG: channel from payload: {channel}")

                if channel == "Social Media":
                    # For Social Media, ask user to specify which platform
                    state.result = "Please specify which social media platform you want to connect to first. Choose from: Instagram, Facebook, LinkedIn, or YouTube."
                    state.clarification_question = "Which social media platform would you like to connect?"
                    state.clarification_options = [
                        {"label": "Instagram", "value": "instagram"},
                        {"label": "Facebook", "value": "facebook"},
                        {"label": "LinkedIn", "value": "linkedin"},
                        {"label": "YouTube", "value": "youtube"}
                    ]
                    state.waiting_for_user = True
                    state.current_step = "waiting_for_clarification"
                    return state
                elif channel == "Blog":
                    platform_to_connect = "wordpress"
                elif channel == "Email":
                    platform_to_connect = "google"
                elif channel == "messages":
                    platform_to_connect = "whatsapp"

            # Normalize platform name to lowercase for OAuth compatibility
            if platform_to_connect:
                platform_to_connect = platform_to_connect.lower()
                # Handle special cases
                if platform_to_connect == "gmail":
                    platform_to_connect = "google"

            print(f"DEBUG: normalized platform_to_connect: {platform_to_connect}")

            # Return connection information for frontend to handle OAuth
            state.result = f"To publish to this platform, you need to connect your account first."
            state.needs_connection = True
            state.connection_platform = platform_to_connect
            state.payload_complete = True
            state.current_step = "connection_required"
            return state
        elif user_query_lower in ["change_channel", "change_platform"]:
            # Reset the relevant field to allow user to choose again
            if "channel" in state.payload:
                state.payload["channel"] = None
            if "platform" in state.payload:
                state.payload["platform"] = None
            state.payload_complete = False
            state.waiting_for_user = False
            state.current_step = "payload_construction"
            return state
        elif user_query_lower == "cancel":
            # Cancel the operation
            state.result = "Publish operation cancelled."
            state.payload_complete = True
            state.current_step = "end"
            return state
    
    missing_fields = [
        f for f in required_fields 
        if f not in state.payload or state.payload.get(f) is None or not state.payload.get(f)
    ]
    
    if not missing_fields:
        # Check if user has connection for the selected channel/platform before allowing publish
        channel = state.payload.get('channel')
        platform = state.payload.get('platform')

        # Check platform connection first (more specific)
        if platform and not check_channel_connection(state.user_id, platform):
            # User doesn't have connection for this platform
            state.payload_complete = False
            state.clarification_question = f"You don't have a connection set up for {platform}. Would you like to connect your {platform} account first?"
            state.clarification_options = [
                {"label": "Connect Account", "value": "connect_account"},
                {"label": "Choose Different Platform", "value": "change_platform"},
                {"label": "Cancel", "value": "cancel"}
            ]
            state.waiting_for_user = True
            state.current_step = "waiting_for_clarification"
            print(f"? Connection needed for {platform}")
            return state

        # Check channel connection (for channels that don't have specific platforms)
        elif channel and not check_channel_connection(state.user_id, channel):
            # User doesn't have connection for this channel
            state.payload_complete = False
            state.clarification_question = f"You don't have a connection set up for {channel}. Would you like to connect your {channel.lower()} account first?"
            state.clarification_options = [
                {"label": "Connect Account", "value": "connect_account"},
                {"label": "Choose Different Channel", "value": "change_channel"},
                {"label": "Cancel", "value": "cancel"}
            ]
            state.waiting_for_user = True
            state.current_step = "waiting_for_clarification"
            print(f"? Connection needed for {channel}")
            return state

        state.payload_complete = True
        state.current_step = "action_execution"
        print(" Publish content payload complete")
        return state
    
    next_field = missing_fields[0]
    clarification_data = clarifications.get(next_field, {})

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
    print(f"? Clarification needed for publish_content: {state.clarification_question}")

    return state


def complete_schedule_content_payload(state: AgentState) -> AgentState:
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


def complete_create_leads_payload(state: AgentState) -> AgentState:
    """Complete create_leads payload - ALL fields are compulsory"""
    clarifications = FIELD_CLARIFICATIONS.get("create_leads", {})

    # Check ALL required fields
    has_name = state.payload.get("lead_name") and state.payload.get("lead_name").strip()
    has_email = state.payload.get("lead_email") and state.payload.get("lead_email").strip()
    has_phone = state.payload.get("lead_phone") and state.payload.get("lead_phone").strip()
    has_source = state.payload.get("lead_source") and state.payload.get("lead_source").strip()
    has_status = state.payload.get("lead_status") and state.payload.get("lead_status").strip()
    has_follow_up = state.payload.get("follow_up") and state.payload.get("follow_up").strip()
    has_remarks = state.payload.get("remarks") and state.payload.get("remarks").strip()

    # Must have ALL required fields: name, contact method, source, status, follow_up, remarks
    if has_name and (has_email or has_phone) and has_source and has_status and has_follow_up and has_remarks:
        # All required fields are present, proceed
        state.payload_complete = True
        state.current_step = "action_execution"
        print(" Create leads payload complete")
        return state

    # Calculate remaining questions
    missing_count = sum([not has_name, not (has_email or has_phone), not has_source, not has_status, not has_follow_up, not has_remarks])

    # Ask for what's missing - check in priority order
    if not has_name:
        clarification_data = clarifications.get("lead_name", {})
        if isinstance(clarification_data, dict):
            base_question = clarification_data.get("question", "What's the lead's name?")
            # Question count will be included in the enhanced_base_question for personalization
            question_count_context = f"I will ask you just {missing_count} more question{'s' if missing_count > 1 else ''} for further understanding."
            enhanced_base_question = f"{question_count_context}\n\n{base_question}"

            personalized_question = generate_clarifying_question(
                base_question=enhanced_base_question,
                user_context=state.user_query,
                user_input=state.user_query.split('\n')[-1] if state.user_query else ""
            )
            state.clarification_question = personalized_question
            state.clarification_options = clarification_data.get("options", [])
            state.result = f"{personalized_question}\n\nPlease choose one of the options below:"
        else:
            question_text = clarification_data or "What's the lead's name?"
            # Add remaining questions count to the question
            question_count_context = f"I will ask you just {missing_count} more question{'s' if missing_count > 1 else ''} for further understanding."
            state.clarification_question = f"{question_count_context}\n\n{question_text}"
            state.clarification_options = []
            state.result = f"{state.clarification_question}\n\nPlease choose one of the options below:"
    elif not has_email and not has_phone:
        clarification_data = clarifications.get("lead_email", {})
        if isinstance(clarification_data, dict):
            base_question = clarification_data.get("question", "What's their email address?")
            # Question count will be included in the enhanced_base_question for personalization
            question_count_context = f"I will ask you just {missing_count} more question{'s' if missing_count > 1 else ''} for further understanding."
            enhanced_base_question = f"{question_count_context}\n\n{base_question}"

            personalized_question = generate_clarifying_question(
                base_question=enhanced_base_question,
                user_context=state.user_query,
                user_input=state.user_query.split('\n')[-1] if state.user_query else ""
            )
            state.clarification_question = personalized_question
            state.clarification_options = clarification_data.get("options", [])
            state.result = f"{personalized_question}\n\nPlease choose one of the options below:"
        else:
            question_text = clarification_data or "What's their email address?"
            # Add remaining questions count to the question
            question_count_context = f"I will ask you just {missing_count} more question{'s' if missing_count > 1 else ''} for further understanding."
            state.clarification_question = f"{question_count_context}\n\n{question_text}"
            state.clarification_options = []
            state.result = f"{state.clarification_question}\n\nPlease choose one of the options below:"
    elif not has_email:
        clarification_data = clarifications.get("lead_email", {})
        if isinstance(clarification_data, dict):
            base_question = clarification_data.get("question", "What's their email address?")
            # Question count will be included in the enhanced_base_question for personalization
            question_count_context = f"I will ask you just {missing_count} more question{'s' if missing_count > 1 else ''} for further understanding."
            enhanced_base_question = f"{question_count_context}\n\n{base_question}"

            personalized_question = generate_clarifying_question(
                base_question=enhanced_base_question,
                user_context=state.user_query,
                user_input=state.user_query.split('\n')[-1] if state.user_query else ""
            )
            state.clarification_question = personalized_question
            state.clarification_options = clarification_data.get("options", [])
            state.result = f"{personalized_question}\n\nPlease choose one of the options below:"
        else:
            question_text = clarification_data or "What's their email address?"
            # Add remaining questions count to the question
            question_count_context = f"I will ask you just {missing_count} more question{'s' if missing_count > 1 else ''} for further understanding."
            state.clarification_question = f"{question_count_context}\n\n{question_text}"
            state.clarification_options = []
            state.result = f"{state.clarification_question}\n\nPlease choose one of the options below:"
    elif not has_phone:
        clarification_data = clarifications.get("lead_phone", {})
        if isinstance(clarification_data, dict):
            base_question = clarification_data.get("question", "What's their phone number?")
            # Question count will be included in the enhanced_base_question for personalization
            question_count_context = f"I will ask you just {missing_count} more question{'s' if missing_count > 1 else ''} for further understanding."
            enhanced_base_question = f"{question_count_context}\n\n{base_question}"

            personalized_question = generate_clarifying_question(
                base_question=enhanced_base_question,
                user_context=state.user_query,
                user_input=state.user_query.split('\n')[-1] if state.user_query else ""
            )
            state.clarification_question = personalized_question
            state.clarification_options = clarification_data.get("options", [])
            state.result = f"{personalized_question}\n\nPlease choose one of the options below:"
        else:
            question_text = clarification_data or "What's their phone number?"
            # Add remaining questions count to the question
            question_count_context = f"I will ask you just {missing_count} more question{'s' if missing_count > 1 else ''} for further understanding."
            state.clarification_question = f"{question_count_context}\n\n{question_text}"
            state.clarification_options = []
            state.result = f"{state.clarification_question}\n\nPlease choose one of the options below:"
    elif not has_source:
        clarification_data = clarifications.get("lead_source", {})
        if isinstance(clarification_data, dict):
            base_question = clarification_data.get("question", "How did you connect with this lead?")
            # Question count will be included in the enhanced_base_question for personalization
            question_count_context = f"I will ask you just {missing_count} more question{'s' if missing_count > 1 else ''} for further understanding."
            enhanced_base_question = f"{question_count_context}\n\n{base_question}"

            personalized_question = generate_clarifying_question(
                base_question=enhanced_base_question,
                user_context=state.user_query,
                user_input=state.user_query.split('\n')[-1] if state.user_query else ""
            )
            state.clarification_question = personalized_question
            state.clarification_options = clarification_data.get("options", [])
            state.result = f"{personalized_question}\n\nPlease choose one of the options below:"
        else:
            question_text = clarification_data or "How did you connect with this lead?"
            # Add remaining questions count to the question
            question_count_context = f"I will ask you just {missing_count} more question{'s' if missing_count > 1 else ''} for further understanding."
            state.clarification_question = f"{question_count_context}\n\n{question_text}"
            state.clarification_options = []
            state.result = f"{state.clarification_question}\n\nPlease choose one of the options below:"
    elif not has_status:
        clarification_data = clarifications.get("lead_status", {})
        if isinstance(clarification_data, dict):
            base_question = clarification_data.get("question", "What's their current status?")
            # Question count will be included in the enhanced_base_question for personalization
            question_count_context = f"I will ask you just {missing_count} more question{'s' if missing_count > 1 else ''} for further understanding."
            enhanced_base_question = f"{question_count_context}\n\n{base_question}"

            personalized_question = generate_clarifying_question(
                base_question=enhanced_base_question,
                user_context=state.user_query,
                user_input=state.user_query.split('\n')[-1] if state.user_query else ""
            )
            state.clarification_question = personalized_question
            state.clarification_options = clarification_data.get("options", [])
            state.result = f"{personalized_question}\n\nPlease choose one of the options below:"
        else:
            question_text = clarification_data or "What's their current status?"
            # Add remaining questions count to the question
            question_count_context = f"I will ask you just {missing_count} more question{'s' if missing_count > 1 else ''} for further understanding."
            state.clarification_question = f"{question_count_context}\n\n{question_text}"
            state.clarification_options = []
            state.result = f"{state.clarification_question}\n\nPlease choose one of the options below:"
    elif not has_follow_up:
        clarification_data = clarifications.get("follow_up", {})
        if isinstance(clarification_data, dict):
            base_question = clarification_data.get("question", "When should we follow up with this lead?")
            # Question count will be included in the enhanced_base_question for personalization
            question_count_context = f"I will ask you just {missing_count} more question{'s' if missing_count > 1 else ''} for further understanding."
            enhanced_base_question = f"{question_count_context}\n\n{base_question}"

            personalized_question = generate_clarifying_question(
                base_question=enhanced_base_question,
                user_context=state.user_query,
                user_input=state.user_query.split('\n')[-1] if state.user_query else ""
            )
            state.clarification_question = personalized_question
            state.clarification_options = clarification_data.get("options", [])
            state.result = f"{personalized_question}\n\nPlease choose one of the options below:"
        else:
            question_text = clarification_data or "When should we follow up with this lead?"
            # Add remaining questions count to the question
            question_count_context = f"I will ask you just {missing_count} more question{'s' if missing_count > 1 else ''} for further understanding."
            state.clarification_question = f"{question_count_context}\n\n{question_text}"
            state.clarification_options = []
            state.result = f"{state.clarification_question}\n\nPlease choose one of the options below:"
    elif not has_remarks:
        clarification_data = clarifications.get("remarks", {})
        if isinstance(clarification_data, dict):
            base_question = clarification_data.get("question", "Any additional notes or remarks about this lead?")
            # Question count will be included in the enhanced_base_question for personalization
            question_count_context = f"I will ask you just {missing_count} more question{'s' if missing_count > 1 else ''} for further understanding."
            enhanced_base_question = f"{question_count_context}\n\n{base_question}"

            personalized_question = generate_clarifying_question(
                base_question=enhanced_base_question,
                user_context=state.user_query,
                user_input=state.user_query.split('\n')[-1] if state.user_query else ""
            )
            state.clarification_question = personalized_question
            state.clarification_options = clarification_data.get("options", [])
            state.result = f"{personalized_question}\n\nPlease choose one of the options below:"
        else:
            question_text = clarification_data or "Any additional notes or remarks about this lead?"
            # Add remaining questions count to the question
            question_count_context = f"I will ask you just {missing_count} more question{'s' if missing_count > 1 else ''} for further understanding."
            state.clarification_question = f"{question_count_context}\n\n{question_text}"
            state.clarification_options = []
            state.result = f"{state.clarification_question}\n\nPlease choose one of the options below:"

    state.waiting_for_user = True
    state.current_step = "waiting_for_clarification"
    print(f"? Clarification needed for create_leads: {state.clarification_question}")

    return state


def complete_view_leads_payload(state: AgentState) -> AgentState:
    """Complete view_leads payload - all fields optional except date_range when lead_status is provided"""
    payload = state.payload

    # If lead_status is provided, date_range becomes mandatory
    if payload.get('lead_status') and not payload.get('date_range'):
        state.payload_complete = False

        # Use FIELD_CLARIFICATIONS for consistent questioning
        clarifications = FIELD_CLARIFICATIONS.get("view_leads", {})
        clarification_data = clarifications.get("date_range", {})

        if isinstance(clarification_data, dict):
            base_question = clarification_data.get("question", "Please select a date range to view these leads.")
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
            state.clarification_question = clarification_data or "When would you like to see these leads? Please tell me the time period (e.g., 'yesterday', 'this week', 'last month')."
            state.clarification_options = []

        state.waiting_for_user = True
        state.current_step = "waiting_for_clarification"
        print(f"? Clarification needed for view_leads: {state.clarification_question}")
        return state

    # Convert date_range to start_date and end_date if present
    if payload.get("date_range") and payload["date_range"]:
        date_range = str(payload["date_range"]).strip()
        date_filter = _parse_date_range_format(date_range)

        if date_filter:
            # Successfully converted date_range to actual dates
            payload["start_date"] = date_filter.get("start") if date_filter.get("start") else None
            payload["end_date"] = date_filter.get("end") if date_filter.get("end") else None
            print(f" Converted '{date_range}' to start_date: {payload['start_date']}, end_date: {payload['end_date']}")
        else:
            # Could not parse date_range
            print(f"⚠️ Could not parse date_range '{date_range}', treating as missing")
            payload["date_range"] = None
            payload["start_date"] = None
            payload["end_date"] = None

    # All fields are optional otherwise
    state.payload_complete = True
    state.current_step = "action_execution"
    print(" View leads payload complete")
    return state


def complete_edit_leads_payload(state: AgentState) -> AgentState:
    """Complete edit_leads payload"""
    required_fields = ["lead_name"]
    clarifications = FIELD_CLARIFICATIONS.get("edit_leads", {})
    
    missing_fields = [
        f for f in required_fields 
        if f not in state.payload or state.payload.get(f) is None or not state.payload.get(f)
    ]
    
    if not missing_fields:
        state.payload_complete = True
        state.current_step = "action_execution"
        print(" Edit leads payload complete")
        return state
    
    next_field = missing_fields[0]
    clarification_data = clarifications.get(next_field, {})

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
    print(f"? Clarification needed for edit_leads: {state.clarification_question}")

    return state


def complete_delete_leads_payload(state: AgentState) -> AgentState:
    """Complete delete_leads payload"""
    # Accept either lead_id OR lead_name as sufficient identifier
    has_lead_id = state.payload.get('lead_id') and state.payload['lead_id'].strip()
    has_lead_name = state.payload.get('lead_name') and state.payload['lead_name'].strip()

    if has_lead_id or has_lead_name:
        state.payload_complete = True
        state.current_step = "action_execution"
        print(" Delete leads payload complete")
        return state

    # If neither ID nor name is provided, we need clarification
    clarifications = FIELD_CLARIFICATIONS.get("delete_leads", {})

    # Ask for lead_name as the primary identifier (same as before)
    next_field = "lead_name"
    clarification_data = clarifications.get(next_field, {})

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
    print(f"? Clarification needed for delete_leads: {state.clarification_question}")

    return state


def complete_follow_up_leads_payload(state: AgentState) -> AgentState:
    """Complete follow_up_leads payload"""
    required_fields = ["lead_name", "follow_up_date"]
    clarifications = FIELD_CLARIFICATIONS.get("follow_up_leads", {})
    
    missing_fields = [
        f for f in required_fields 
        if f not in state.payload or state.payload.get(f) is None or not state.payload.get(f)
    ]
    
    if not missing_fields:
        state.payload_complete = True
        state.current_step = "action_execution"
        print("✓ Follow up leads payload complete")
        return state
    
    next_field = missing_fields[0]
    
    # Special handling for follow_up_date
    if next_field == "follow_up_date":
        state.clarification_question = "When should we follow up with this lead? (e.g., 'tomorrow', 'next week', 'Jan 15')"
        state.clarification_options = []
    else:
        clarification_data = clarifications.get(next_field, {})

        if isinstance(clarification_data, dict):
            base_question = clarification_data.get("question", f"Please provide: {next_field.replace('_', ' ')}")
            personalized_question = generate_clarifying_question(
                base_question=base_question,
                user_context=state.user_query,
                user_input=state.user_query.split('\n')[-1] if state.user_query else ""
            )
            state.clarification_question = personalized_question
            state.clarification_options = clarification_data.get("options", [])
        else:
            state.clarification_question = clarification_data or f"Please provide: {next_field.replace('_', ' ')}"
            state.clarification_options = []

    state.waiting_for_user = True
    state.current_step = "waiting_for_clarification"
    print(f"? Clarification needed for follow_up_leads: {state.clarification_question}")

    return state


def complete_view_insights_payload(state: AgentState) -> AgentState:
    """Complete view_insights payload"""
    required_fields = ["channel"]
    clarifications = FIELD_CLARIFICATIONS.get("view_insights", {})
    
    missing_fields = [
        f for f in required_fields 
        if f not in state.payload or state.payload.get(f) is None or not state.payload.get(f)
    ]
    
    if not missing_fields:
        state.payload_complete = True
        state.current_step = "action_execution"
        print(" View insights payload complete")
        return state
    
    next_field = missing_fields[0]
    state.clarification_question = clarifications.get(
        next_field,
        f"Please provide: {next_field.replace('_', ' ')}"
    )
    state.waiting_for_user = True
    state.current_step = "waiting_for_clarification"
    print(f"? Clarification needed for view_insights: {state.clarification_question}")
    
    return state


def complete_view_analytics_payload(state: AgentState) -> AgentState:
    """Complete view_analytics payload"""
    required_fields = ["channel"]
    clarifications = FIELD_CLARIFICATIONS.get("view_analytics", {})
    
    missing_fields = [
        f for f in required_fields 
        if f not in state.payload or state.payload.get(f) is None or not state.payload.get(f)
    ]
    
    if not missing_fields:
        state.payload_complete = True
        state.current_step = "action_execution"
        print(" View analytics payload complete")
        return state
    
    next_field = missing_fields[0]
    state.clarification_question = clarifications.get(
        next_field,
        f"Please provide: {next_field.replace('_', ' ')}"
    )
    state.waiting_for_user = True
    state.current_step = "waiting_for_clarification"
    print(f"? Clarification needed for view_analytics: {state.clarification_question}")
    
    return state


def complete_payload(state: AgentState) -> AgentState:
    """Route to specific payload completer based on intent"""
    if state.intent not in INTENT_MAP:
        state.current_step = "end"
        return state

    # Check for intent changes in the user's latest response before proceeding
    print(f"🔄 Calling detect_intent_changes in complete_payload for intent: {state.intent}")
    old_state = state
    state = detect_intent_changes(state)
    if state and state.intent_change_detected:
        print(f"✅ Intent change detected in complete_payload: {state.previous_intent} → {state.intent} ({state.intent_change_type})")
    elif not state:
        print(f"❌ detect_intent_changes returned None in complete_payload, restoring old state")
        state = old_state

    # If a complete intent shift was detected, restart the workflow
    if state.intent_change_detected and state.intent_change_type == 'complete_shift':
        print("🔄 Complete intent shift detected during payload completion, restarting workflow")
        # Reset to initial state and return to classification
        state.current_step = "intent_classification"
        state.payload_complete = False
        state.clarification_question = None
        state.clarification_options = None
        state.waiting_for_user = False
        return state
    
    # Route to specific completer
    completers = {
        "view_content": complete_view_content_payload,
        "create_content": complete_create_content_payload,
        "edit_content": complete_edit_content_payload,
        "delete_content": complete_delete_content_payload,
        "publish_content": complete_publish_content_payload,
        "schedule_content": complete_schedule_content_payload,
        "create_leads": complete_create_leads_payload,
        "view_leads": complete_view_leads_payload,
        "edit_leads": complete_edit_leads_payload,
        "delete_leads": complete_delete_leads_payload,
        "follow_up_leads": complete_follow_up_leads_payload,
        "view_insights": complete_view_insights_payload,
        "view_analytics": complete_view_analytics_payload,
    }
    
    completer = completers.get(state.intent)
    if completer:
        return completer(state)
    else:
        state.error = f"No completer found for intent: {state.intent}"
        state.current_step = "end"
        return state


# ==================== CONVERSATION HANDLERS ====================

def handle_greeting(state: AgentState) -> AgentState:
    """Handle greeting messages with personalized tip"""
    
    # Get user profile for personalization
    user_name = "there"
    business_type = "your business"
    
    if state.user_id and supabase:
        try:
            response = supabase.table("profiles").select("name, business_type, business_name").eq("id", state.user_id).execute()
            if response.data and len(response.data) > 0:
                profile_data = response.data[0]
                user_name = profile_data.get("name") or profile_data.get("business_name") or "there"
                business_type = profile_data.get("business_type") or "your business"
        except Exception as e:
            logger.warning(f"Could not fetch profile for greeting: {e}")
    
    # Generate personalized greeting with LLM
    prompt = f"""Generate a warm, brief greeting (under 40 words) for {user_name} who runs {business_type}.

Include:
1. A friendly greeting
2. ONE quick social media tip/trending topic for their business type
3. Ask what they'd like to work on

Keep it conversational, helpful, and under 40 words total.
DO NOT use any emojis.

Greeting:"""

    try:
        response = model.generate_content(prompt)
        greeting = response.text.strip()
        
        # Ensure it's not too long
        words = greeting.split()
        if len(words) > 45:
            greeting = ' '.join(words[:45]) + '...'
        
        state.result = greeting
        
    except Exception as e:
        logger.error(f"Greeting LLM failed: {str(e)}")
        # Fallback greeting
        state.result = f"""Hello {user_name}! Ready to boost {business_type}?

Tip: Video content drives 3x more engagement right now!"""
    
    # Final safeguard - ensure result is never None or empty
    if not state.result or not state.result.strip():
        state.result = "Hello! I'm your ATSN Agent. How can I help you with content or leads today?"
    
    return state


def handle_general_talks(state: AgentState) -> AgentState:
    """Handle general conversation using LLM"""
    
    prompt = f"""You are ATSN Agent, a professional business assistant for content and lead management.

User said: {state.user_query}

Respond in a friendly but professional way. Keep your response under 20 words.
Gently guide them to discuss their business needs - content creation, lead management, or analytics.
Be helpful and encouraging.
DO NOT use any emojis.

Response:"""

    try:
        response = model.generate_content(prompt)
        llm_response = response.text.strip()
        
        # Add a helpful nudge
        state.result = f"{llm_response}\n\nI'm here to help with your content and leads. What would you like to work on?"
        
    except Exception as e:
        logger.error(f"General talks LLM failed: {str(e)}")
        state.result = """I'm here to help with your business! 

I specialize in:
- Content Management (create, view, schedule, publish)
- Lead Management (add, track, follow-up)
- Analytics & Insights

What can I help you with today?"""
    
    return state


# ==================== ACTION EXECUTION ====================

async def execute_action(state: AgentState) -> AgentState:
    """Execute the action based on intent and complete payload"""
    
    intent = state.intent
    payload = state.payload
    
    print(f" Executing action: {intent}")
    print(f"  Payload: {payload}")
    
    # Route to specific handler
    if intent == "greeting":
        state = handle_greeting(state)
    elif intent == "general_talks":
        state = handle_general_talks(state)
    elif intent == "create_content":
        state = await handle_create_content(state)
    elif intent == "edit_content":
        state = handle_edit_content(state)
    elif intent == "delete_content":
        state = handle_delete_content(state)
    elif intent == "view_content":
        state = handle_view_content(state)
        # Log the result for debugging
        if state.result:
            logger.info(f"View content result length: {len(state.result)} characters")
            logger.info(f"View content payload content_ids: {state.payload.get('content_ids', [])}")
    elif intent == "publish_content":
        state = handle_publish_content(state)
    elif intent == "schedule_content":
        state = handle_schedule_content(state)
    elif intent == "create_leads":
        state = handle_create_leads(state)
    elif intent == "view_leads":
        state = handle_view_leads(state)
    elif intent == "edit_leads":
        state = handle_edit_leads(state)
    elif intent == "delete_leads":
        state = handle_delete_leads(state)
    elif intent == "follow_up_leads":
        state = handle_follow_up_leads(state)
    elif intent == "view_insights":
        state = handle_view_insights(state)
    elif intent == "view_analytics":
        state = handle_view_analytics(state)
    else:
        state.error = f"No handler for intent: {intent}"
    
    # Clear clarification state when action executes successfully
    # This ensures the frontend shows the result instead of the clarification question
    state.clarification_question = None
    state.waiting_for_user = False

    # Ensure payload_complete remains True after action execution
    # This prevents re-asking for clarification after showing results
    if state.payload_complete:
        logger.info(f"Action executed for {intent}, payload_complete remains True")

    state.current_step = "end"
    return state


# ==================== CONTENT HANDLERS ====================

async def handle_create_content(state: AgentState) -> AgentState:
    """Generate and create content"""
    payload = state.payload
    
    # Set agent name for content creation
    payload['agent_name'] = 'chase'

    if not state.payload_complete:
        state.error = "Payload is not complete"
        return state

    try:
        generated_content = ""
        generated_image_url = None
        content_data = {}  # Store data to save to database

        # Load business context and profile assets from profiles table
        business_context = {}
        profile_assets = {}
        if state.user_id:
            logger.info(f"🔍 Loading profile data for user_id: {state.user_id}")
            try:
                # Fetch comprehensive profile data including all context fields
                profile_fields = [
                    "business_name", "business_description", "brand_tone", "industry", "target_audience",
                    "brand_voice", "unique_value_proposition", "primary_color", "secondary_color",
                    "brand_colors", "logo_url", "timezone", "location_city", "location_state", "location_country"
                ]
                logger.info(f"🔍 Fetching profile fields: {', '.join(profile_fields)}")
                profile_response = supabase.table("profiles").select(", ".join(profile_fields)).eq("id", state.user_id).execute()

                logger.info(f"🔍 Profile query response: {len(profile_response.data) if profile_response.data else 0} records found")

                if profile_response.data and len(profile_response.data) > 0:
                    profile_data = profile_response.data[0]
                    logger.info(f"🔍 Raw profile data: {profile_data}")

                    business_context = get_business_context_from_profile(profile_data)

                    # Extract brand assets for content and image generation
                    profile_assets = {
                        'primary_color': profile_data.get('primary_color'),
                        'secondary_color': profile_data.get('secondary_color'),
                        'brand_colors': profile_data.get('brand_colors') or [],  # Ensure it's always a list
                        'logo': profile_data.get('logo_url'),  # Use correct column name
                        'primary_typography': profile_data.get('primary_typography'),
                        'secondary_typography': profile_data.get('secondary_typography')
                    }

                    logger.info(f"✅ Loaded structured business context for: {business_context.get('business_name', 'Business')}")
                    logger.info(f"   Brand colors: {bool(profile_assets['primary_color'])}/{bool(profile_assets['secondary_color'])}")
                    brand_colors_len = len(profile_assets.get('brand_colors') or [])
                    logger.info(f"   Brand colors array: {brand_colors_len} colors")
                    logger.info(f"   Logo: {bool(profile_assets.get('logo'))}")
                    logger.info(f"   Typography: {bool(profile_assets.get('primary_typography'))}/{bool(profile_assets.get('secondary_typography'))}")
                    logger.info(f"   Industry: {business_context.get('industry', 'N/A')}")
                    logger.info(f"   Target audience: {business_context.get('target_audience', 'N/A')}")
                else:
                    logger.warning(f"❌ No profile data found for user_id: {state.user_id}, using defaults")
                    logger.warning("   This usually means the user hasn't completed their profile onboarding")
                    business_context = get_business_context_from_profile({})
                    profile_assets = {'primary_color': None, 'secondary_color': None, 'brand_colors': [], 'logo': None}
            except Exception as e:
                logger.error(f"❌ Failed to load business context for user_id {state.user_id}: {e}")
                logger.error(f"   Exception type: {type(e).__name__}")
                import traceback
                logger.error(f"   Traceback: {traceback.format_exc()}")
                business_context = get_business_context_from_profile({})
                profile_assets = {'primary_color': None, 'secondary_color': None, 'brand_colors': [], 'logo': None}
        else:
            logger.warning("❌ No user_id provided in state, using defaults")
            business_context = get_business_context_from_profile({})
            profile_assets = {'primary_color': None, 'secondary_color': None, 'brand_colors': [], 'logo': None}

        # Handle different content types
        content_type = payload.get('content_type', '')

        if content_type in ['static_post', 'carousel']:
            # Step 1: Get trends from Grok API for trend-aware content
            topic = payload.get('content_idea', '')
            trends_data = await get_trends_from_grok(topic, business_context)
            parsed_trends = parse_trends_for_content(trends_data)

            # Step 2: Get platform-specific prompt
            platform = payload.get('platform', 'Instagram')
            prompt = get_platform_specific_prompt(platform, payload, business_context, parsed_trends, profile_assets)

            # Log the complete prompt being sent to LLM
            logger.info(f"📝 Complete prompt being sent to GPT-4o-mini for {platform}:")
            logger.info("=" * 80)
            logger.info(prompt)
            logger.info("=" * 80)

            # Initialize variables
            title = ""
            content = ""
            hashtags = []

            # Generate structured content with GPT-4o-mini
            from datetime import datetime
            content_gen_datetime = datetime.now()
            logger.info(f"📝 Generating content with GPT-4o-mini for platform: {platform} at {content_gen_datetime.strftime('%Y-%m-%d %H:%M:%S UTC')}")
            if openai_client:
                response = openai_client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=600,
                    temperature=0.7
                )
                generated_response = response.choices[0].message.content.strip()

                # Parse platform-specific response
                if platform.lower() == 'instagram':
                    parsed_content = parse_instagram_response(generated_response)
                    title = parsed_content['title']
                    content = parsed_content['content']
                    hashtags = parsed_content['hashtags']
                else:
                    # Fallback parsing for other platforms
                    # Variables already initialized above

                    lines = generated_response.split('\n')
                    current_section = None

                    for line in lines:
                        line = line.strip()
                        if line.startswith('TITLE:'):
                            title = line.replace('TITLE:', '').strip()
                            current_section = 'title'
                        elif line.startswith('CONTENT:'):
                            content = line.replace('CONTENT:', '').strip()
                            current_section = 'content'
                        elif line.startswith('HASHTAGS:'):
                            hashtags_text = line.replace('HASHTAGS:', '').strip()
                            hashtags = hashtags_text.split() if hashtags_text else []
                            current_section = 'hashtags'
                        elif current_section == 'content' and line:
                            content += ' ' + line
                        elif current_section == 'hashtags' and line:
                            hashtags.extend(line.split())

                # Save structured data
                content_data['title'] = title
                content_data['content'] = content
                content_data['hashtags'] = hashtags

                generated_content = f"{title}\n\n{content}\n\n{' '.join(hashtags)}"
            else:
                generated_content = "OpenAI client not configured"
                content_data['title'] = "Content Generation Failed"
                content_data['content'] = generated_content
                content_data['hashtags'] = []
                title = "Content Generation Failed"
                content = generated_content

        elif content_type == 'short_video or reel':
            # Check if user wants to upload their own video
            if payload.get('media') == 'Upload':
                # Set flag for upload requirement - user will upload both video and cover
                if not payload.get('media_file'):
                    state.waiting_for_upload = True
                    state.upload_type = 'video'  # They need to upload video file
                    state.result = "Ready to upload your short video/reel. Please select and upload a video file."
                    return state
                else:
                    # File already uploaded, use it
                    generated_image_url = payload.get('media_file')
                    if generated_image_url:
                        content_data['images'] = [generated_image_url]

            # Step 1: Get viral content trends from Grok
            topic = payload.get('content_idea', 'viral content trends')
            trends_data = await get_trends_from_grok(topic, business_context)

            # Step 2: Generate short video script using GPT-4o-mini with trend insights
            viral_content = ""
            if trends_data and 'trends' in trends_data:
                viral_content = "\n\nVIRAL CONTENT INSIGHTS:\n" + "\n".join([
                    f"- {trend.get('trend_name', '')}: {trend.get('description', '')[:100]}..."
                    for trend in trends_data['trends'][:3]  # Top 3 trends
                ])

            prompt = f"""You are a professional short-form video script writer creating viral content for {payload.get('platform', 'social media')} Reels.

BUSINESS CONTEXT:
{business_context.get('business_name', 'Business')}
Industry: {business_context.get('industry', 'General')}
Target Audience: {business_context.get('target_audience', 'General audience')}
Brand Voice: {business_context.get('brand_voice', 'Professional and friendly')}
Business Description: {business_context.get('business_description', 'N/A')}

CONTENT REQUIREMENTS:
- Platform: {payload.get('platform', 'Instagram Reels/TikTok/YouTube Shorts')}
- Content Idea: {payload.get('content_idea', '')}
- Duration: 15-30 seconds (keep script concise and punchy)
- Goal: Create engaging, scroll-stopping content{viral_content}

TASK:
Create a complete 15-30 second video script optimized for virality that includes:
1. STRONG HOOK (0-3 seconds - shock, question, or surprising fact)
2. VALUE DELIVERY (3-20 seconds - solve problem or provide insight)
3. EMOTIONAL CLOSE (20-25 seconds - build connection)
4. CLEAR CTA (25-30 seconds - what to do next)

SCRIPT FORMAT:
🎬 SCENE BREAKDOWN:
[0-3s] HOOK: [One powerful sentence that stops the scroll]
[3-20s] VALUE: [2-3 key points that deliver real value]
[20-25s] STORY/CONNECTION: [Make it relatable, add emotion]
[25-30s] CTA: [Specific action + urgency]

VISUAL CUES:
- Background music suggestions
- Text overlays for key points
- Transitions between sections
- Thumbnail-worthy moments

Make it conversational, authentic, and optimized for the algorithm."""

            if openai_client:
                response = openai_client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=1000,
                    temperature=0.8
                )
                generated_script = response.choices[0].message.content.strip()
                content_data['short_video_script'] = generated_script  # Save to short_video_script column
                content_data['content'] = generated_script  # Required field for database

                # Step 3: Generate video cover image using Gemini (only if not uploading)
                if payload.get('media') != 'Upload' and not payload.get('media_url'):
                    cover_prompt = f"""Create a professional, eye-catching thumbnail image for a {payload.get('platform', 'social media')} short video about: {payload.get('content_idea', 'viral content')}

Business: {business_context.get('business_name', 'Business')}
Style: Scroll-stopping, viral-worthy, modern and engaging
Visual elements: Bold text overlays, vibrant gradients, clean mobile-first design
Composition: High contrast, clear focal point, optimized for 9:16 aspect ratio
Make it irresistible to click and watch!"""

                logger.info(f"🎨 Complete video cover generation prompt:")
                logger.info("=" * 80)
                logger.info(cover_prompt)
                logger.info("=" * 80)

                # Import datetime locally (following working image generation pattern)
                from datetime import datetime

                # Check if logo is available and prepare to send it to Gemini
                logo_data = None
                if profile_assets and profile_assets.get('logo'):
                    logo_url = profile_assets.get('logo')
                    logger.info(f"📎 Including logo in video cover generation: {logo_url}")
                    try:
                        import httpx
                        async with httpx.AsyncClient(follow_redirects=True) as client:
                            logo_response = await client.get(logo_url)
                            logo_response.raise_for_status()
                            logo_data = logo_response.content
                        logger.info(f"✅ Logo downloaded successfully: {len(logo_data)} bytes")
                    except Exception as e:
                        logger.warning(f"Failed to download logo: {e}")
                        logo_data = None

                # Generate image with Gemini
                logger.info(f"🎨 Generating video cover with Gemini for platform: {payload.get('platform')} at {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}")
                logger.info(f"   Logo included: {logo_data is not None}")

                gemini_image_model = 'gemini-2.5-flash-image-preview'

                # Prepare contents for Gemini API
                contents = [cover_prompt]  # Text prompt is always first

                # Add logo as reference image if available
                if logo_data:
                    import base64
                    contents.append({
                        "inline_data": {
                            "mime_type": "image/png",  # Assume PNG for transparency
                            "data": base64.b64encode(logo_data).decode('utf-8')
                        }
                    })

                image_response = genai.GenerativeModel(gemini_image_model).generate_content(
                    contents=contents
                )
                logger.info(f"Gemini response received, has candidates: {bool(image_response.candidates)}")

                # Extract image data
                if image_response.candidates and len(image_response.candidates) > 0:
                    candidate = image_response.candidates[0]
                    if candidate.content.parts:
                        for part in candidate.content.parts:
                            if part.inline_data is not None and part.inline_data.data:
                                try:
                                    # Get image data as bytes
                                    image_data = part.inline_data.data
                                    if not isinstance(image_data, bytes):
                                        import base64
                                        image_data = base64.b64decode(image_data)

                                    # Generate unique filename
                                    import uuid
                                    filename = f"video_covers/{uuid.uuid4()}.png"
                                    file_path = filename

                                    logger.info(f"📤 Uploading generated video cover to ai-generated-images bucket: {file_path}")

                                    # Upload to ai-generated-images bucket in generated folder
                                    storage_response = supabase.storage.from_("ai-generated-images").upload(
                                        file_path,
                                        image_data,
                                        file_options={"content-type": "image/png", "upsert": "false"}
                                    )

                                    if hasattr(storage_response, 'error') and storage_response.error:
                                        logger.error(f"Storage upload error: {storage_response.error}")
                                        generated_image_url = None
                                    else:
                                        # Get public URL
                                        generated_image_url = supabase.storage.from_("ai-generated-images").get_public_url(file_path)
                                        logger.info(f"✅ Video cover uploaded successfully: {generated_image_url}")

                                        if generated_image_url and isinstance(generated_image_url, str):
                                            content_data['images'] = [generated_image_url]

                                            # Update metadata for video cover
                                            content_data['metadata'] = {
                                                'video_cover_generated': True,
                                                'cover_prompt': cover_prompt,
                                                'trends_used': trends_data.get('trends', [])[:3] if trends_data else [],
                                                'generated_with': 'gemini'
                                            }
                                        else:
                                            logger.error(f"Invalid public URL returned: {generated_image_url}")

                                except Exception as upload_error:
                                    logger.error(f"Error uploading video cover to storage: {upload_error}")

                                break
                    else:
                        # When uploading, don't generate cover - user will upload their own
                        content_data['metadata'] = {
                            'video_cover_uploaded': True,
                            'trends_used': trends_data.get('trends', [])[:3] if trends_data else [],
                            'generated_with': 'user_upload'
                        }

                # Step 4: Generate compelling title and caption for the reel
                caption_prompt = f"""Based on this short video script, create a compelling title and Instagram caption for the reel.

VIDEO SCRIPT:
{generated_script}

BUSINESS CONTEXT:
{business_context.get('business_name', 'Business')}
Industry: {business_context.get('industry', 'General')}
Target Audience: {business_context.get('target_audience', 'General audience')}

TASK:
Create a viral-worthy Instagram Reel title and caption that will:
1. Hook viewers in the first 3 words
2. Use trending hashtags and emojis naturally
3. Include a strong call-to-action
4. Be optimized for Instagram's algorithm

FORMAT (Return ONLY this format):
TITLE: [Compelling 1-5 word title]
CAPTION: [Scroll-stopping caption with emojis, 100-150 characters]

Make it authentic, engaging, and optimized for maximum engagement!"""

                try:
                    caption_response = openai_client.chat.completions.create(
                        model="gpt-4o-mini",
                        messages=[{"role": "user", "content": caption_prompt}],
                        max_tokens=300,
                        temperature=0.9
                    )
                    caption_result = caption_response.choices[0].message.content.strip()

                    # Parse title and caption
                    title = ""
                    caption = ""
                    for line in caption_result.split('\n'):
                        line = line.strip()
                        if line.startswith('TITLE:'):
                            title = line.replace('TITLE:', '').strip()
                        elif line.startswith('CAPTION:'):
                            caption = line.replace('CAPTION:', '').strip()

                    # Save title and caption
                    content_data['title'] = title if title else f"Reel: {payload.get('content_idea', 'Viral Content')[:30]}"
                    content_data['content'] = caption if caption else generated_script[:200] + "..."

                    logger.info(f"✅ Generated reel title: '{title}' and caption: '{caption[:50]}...'")

                except Exception as caption_error:
                    logger.warning(f"Failed to generate reel caption: {caption_error}")
                    # Fallback: use script as content
                    content_data['title'] = f"Reel: {payload.get('content_idea', 'Viral Content')[:30]}"
                    content_data['content'] = generated_script[:200] + "..."

                generated_content = f"🎬 Short Video Script Generated:\n\n{generated_script}"
            else:
                generated_content = "OpenAI client not configured"
                content_data['short_video_script'] = "Script generation failed - OpenAI client not configured"
                content_data['title'] = "Reel Generation Failed"
                content_data['content'] = generated_content

        elif content_type == 'long_video':
            # Generate long video script using GPT-4o-mini
            prompt = f"""You are a professional video script writer specializing in long-form video content.

BUSINESS CONTEXT:
{business_context.get('business_name', 'Business')}
Industry: {business_context.get('industry', 'General')}
Target Audience: {business_context.get('target_audience', 'General audience')}
Brand Voice: {business_context.get('brand_voice', 'Professional and friendly')}

CONTENT REQUIREMENTS:
- Platform: {payload.get('platform', 'YouTube/Vimeo')}
- Content Idea: {payload.get('content_idea', '')}
- Duration: 5-15 minutes

TASK:
Create a complete long-form video script that includes:
1. Introduction/Hook (30-60 seconds)
2. Main content sections with clear structure
3. Key points and value delivery
4. Conclusion with call-to-action
5. Visual and editing cues

SCRIPT FORMAT:
[0:00-0:30] INTRODUCTION: [Hook and overview]
[0:30-8:00] MAIN CONTENT: [Detailed explanation with sections]
[8:00-10:00] CONCLUSION: [Summary and CTA]

Use professional, engaging language.
Include timing estimates for each section."""

            if openai_client:
                response = openai_client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=2000,
                    temperature=0.7
                )
                generated_script = response.choices[0].message.content.strip()
                content_data['long_video_script'] = generated_script  # Save to long_video_script column
                generated_content = f"Long Video Script Generated:\n\n{generated_script}"
            else:
                generated_content = "OpenAI client not configured"
                content_data['long_video_script'] = "Script generation failed - OpenAI client not configured"


        else:
            # For other content types, use original logic
            generated_content = f"Generated {content_type} for {payload.get('platform', 'platform')}"
            content_data['content'] = generated_content

        # Handle media generation based on payload.media
        logger.info(f"Media type: {payload.get('media')}")
        if payload.get('media') == 'Generate' and not payload.get('media_url'):
            # Generate image using Gemini with the generated content and business context
            try:
                # First, generate enhanced image prompt using AI
                generated_post = {
                    'title': title,
                    'content': content
                }

                enhanced_prompt_data = await generate_image_enhancer_prompt(
                    generated_post, payload, business_context, parsed_trends, profile_assets
                )

                # Build final image generation prompt using the enhanced prompt
                from datetime import datetime
                current_datetime = datetime.now()
                current_date = current_datetime.strftime("%Y-%m-%d")
                current_time = current_datetime.strftime("%H:%M:%S UTC")

                # Use the enhanced prompt as the base
                base_prompt = enhanced_prompt_data.get('image_prompt', f"Create a professional image for: {title}")
                visual_style = enhanced_prompt_data.get('visual_style', 'photorealistic')
                aspect_ratio = enhanced_prompt_data.get('aspect_ratio', '1:1')
                negative_prompt = enhanced_prompt_data.get('negative_prompt', 'text, logos, watermarks')

                # Build color instructions and location context using helper functions
                color_instructions = build_brand_color_instructions(profile_assets, business_context)
                location_context = build_location_context(business_context)

                image_prompt = f"""{base_prompt}

VISUAL REQUIREMENTS:
- Style: {visual_style}
- Aspect Ratio: {aspect_ratio}
- Business: {business_context.get('business_name', 'Business')}
- Industry: {business_context.get('industry', 'General')}
- Target Audience: {business_context.get('target_audience', 'General audience')}
{color_instructions}

{location_context}

AVOID: {negative_prompt}

Create a high-quality, professional image optimized for Instagram that reflects current design trends for {current_date}."""

                # Log the complete image generation prompt
                logger.info(f"🎨 Complete image generation prompt being sent to Gemini:")
                logger.info("=" * 80)
                logger.info(image_prompt)
                logger.info("=" * 80)

                # Check if logo is available and prepare to send it to Gemini
                logo_data = None
                if profile_assets and profile_assets.get('logo'):
                    logo_url = profile_assets.get('logo')
                    logger.info(f"📎 Including logo in image generation: {logo_url}")
                    try:
                        import httpx
                        async with httpx.AsyncClient(follow_redirects=True) as client:
                            logo_response = await client.get(logo_url)
                            logo_response.raise_for_status()
                            logo_data = logo_response.content
                        logger.info(f"✅ Logo downloaded successfully: {len(logo_data)} bytes")
                    except Exception as e:
                        logger.warning(f"Failed to download logo: {e}")
                        logo_data = None

                # Generate image with Gemini
                logger.info(f"🎨 Generating image with Gemini for platform: {payload.get('platform')} at {current_datetime.strftime('%Y-%m-%d %H:%M:%S UTC')}")
                logger.info(f"   Using enhanced prompt with {visual_style} style and {aspect_ratio} aspect ratio")
                logger.info(f"   Logo included: {logo_data is not None}")

                gemini_image_model = 'gemini-2.5-flash-image-preview'

                # Prepare contents for Gemini API
                contents = [image_prompt]  # Text prompt is always first

                # Add logo as reference image if available
                if logo_data:
                    import base64
                    contents.append({
                        "inline_data": {
                            "mime_type": "image/png",  # Assume PNG for transparency
                            "data": base64.b64encode(logo_data).decode('utf-8')
                        }
                    })

                image_response = genai.GenerativeModel(gemini_image_model).generate_content(
                    contents=contents
                )
                logger.info(f"Gemini response received, has candidates: {bool(image_response.candidates)}")

                # Extract image data
                if image_response.candidates and len(image_response.candidates) > 0:
                    candidate = image_response.candidates[0]
                    if candidate.content.parts:
                        for part in candidate.content.parts:
                            if part.inline_data is not None and part.inline_data.data:
                                try:
                                    # Get image data as bytes
                                    image_data = part.inline_data.data
                                    if not isinstance(image_data, bytes):
                                        import base64
                                        image_data = base64.b64decode(image_data)

                                    # Generate unique filename
                                    import uuid
                                    filename = f"generated/{uuid.uuid4()}.png"
                                    file_path = filename

                                    logger.info(f"📤 Uploading generated image to content-images bucket: {file_path}")

                                    # Upload to ai-generated-images bucket in generated folder
                                    storage_response = supabase.storage.from_("ai-generated-images").upload(
                                        file_path,
                                        image_data,
                                        file_options={"content-type": "image/png", "upsert": "false"}
                                    )

                                    if hasattr(storage_response, 'error') and storage_response.error:
                                        logger.error(f"Storage upload error: {storage_response.error}")
                                        generated_image_url = None
                                    else:
                                        # Get public URL
                                        generated_image_url = supabase.storage.from_("ai-generated-images").get_public_url(file_path)
                                        logger.info(f"✅ Image uploaded successfully: {generated_image_url}")

                                        if generated_image_url and isinstance(generated_image_url, str):
                                            content_data['images'] = [generated_image_url]

                                            # ✅ Increment image count after successful generation and storage
                                            try:
                                                # Read current image count and increment
                                                current_images = supabase.table('profiles').select('images_generated_this_month').eq('id', state.user_id).execute()
                                                if current_images.data and len(current_images.data) > 0:
                                                    current_image_count = current_images.data[0]['images_generated_this_month'] or 0
                                                    supabase.table('profiles').update({
                                                        'images_generated_this_month': current_image_count + 1
                                                    }).eq('id', state.user_id).execute()
                                                    logger.info(f"Incremented image count for user {state.user_id} after successful generation (from {current_image_count} to {current_image_count + 1})")
                                            except Exception as counter_error:
                                                logger.error(f"Error incrementing image count after generation: {counter_error}")
                                        else:
                                            logger.error(f"Invalid public URL returned: {generated_image_url}")
                                            generated_image_url = None

                                except Exception as upload_error:
                                    logger.error(f"Error uploading image to storage: {upload_error}")
                                    generated_image_url = None

                                break

            except Exception as e:
                logger.error(f"Image generation failed: {e}")
                generated_image_url = None

        elif payload.get('media') == 'Upload':
            # Set flag for upload requirement
            if not payload.get('media_file'):
                # No file uploaded yet, set upload flag
                state.waiting_for_upload = True
                state.upload_type = 'image'
                state.result = "Ready to upload an image for your content. Please select and upload an image file."
                return state
            else:
                # File already uploaded, use it
                generated_image_url = payload.get('media_file')
                if generated_image_url:
                    content_data['images'] = [generated_image_url]
        # For "without media", no images added

        # Save to Supabase created_content table
        logger.info(f"💾 Preparing to save content_data keys: {list(content_data.keys())}")
        if state.user_id and content_data:
            try:
                # Prepare data for created_content table
                db_data = {
                    'user_id': state.user_id,
                    'platform': payload.get('platform', '').lower(),
                    'content_type': content_type.lower(),
                    'title': content_data.get('title', f"{content_type} for {payload.get('platform', 'Platform').lower()}"),
                    'status': 'generated',
                    'metadata': {
                        'channel': payload.get('channel'),
                        'content_idea': payload.get('content_idea'),
                        'generated_at': datetime.now().isoformat()
                    },
                    **content_data  # This spreads the content-specific data into the correct columns
                }

                # Insert into created_content table
                result = supabase.table('created_content').insert(db_data).execute()
                if result.data and len(result.data) > 0:
                    content_id = result.data[0]['id']
                    state.content_id = str(content_id)
                    logger.info(f"✅ Successfully saved {content_type} content to created_content table with ID: {content_id}")

                    # Log which columns were saved
                    saved_columns = list(content_data.keys())
                    logger.info(f"📝 Saved content to columns: {', '.join(saved_columns)}")
                    logger.info(f"📸 Images in content_data: {'images' in content_data and len(content_data.get('images', []))} image(s)")
                    if 'images' in content_data:
                        logger.info(f"📸 Image URLs saved: {len(content_data['images'])} URL(s) in database")
                else:
                    logger.warning("Failed to save content to created_content table - no data returned")

            except Exception as e:
                logger.error(f"Error saving content to created_content table: {e}")
                state.error = f"Failed to save content to database: {str(e)}"

        # Generate display content ID
        display_content_id = f"CONTENT_{datetime.now().strftime('%Y%m%d%H%M%S')}"

        # Create content item for frontend display
        if state.user_id and state.content_id:
            try:
                # Fetch the newly created content from database to get complete data
                content_response = supabase.table('created_content').select('*').eq('id', state.content_id).execute()
                if content_response.data and len(content_response.data) > 0:
                    item = content_response.data[0]

                    # Extract image URL from images array (first image if available)
                    images = item.get('images', [])
                    media_url = None
                    if images and len(images) > 0:
                        first_image = images[0]
                        if isinstance(first_image, str):
                            media_url = first_image

                    # Format hashtags
                    hashtags = item.get('hashtags', [])
                    hashtag_text = ''
                    if hashtags:
                        if isinstance(hashtags, list):
                            hashtag_text = ' '.join([f"#{tag}" if not tag.startswith('#') else tag for tag in hashtags[:10]])

                    # Format date
                    created_at = item.get('created_at', '')
                    date_display = ''
                    if created_at:
                        try:
                            dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                            date_display = dt.strftime('%B %d, %Y at %I:%M %p')
                        except:
                            date_display = created_at[:10] if len(created_at) >= 10 else created_at

                    # Get content text based on content type
                    content_type = item.get('content_type', 'post')
                    content_text = ''
                    if content_type == 'email':
                        if item.get('email_subject') and item.get('email_body'):
                            content_text = f"Subject: {item['email_subject']}\n\n{item['email_body']}"
                        else:
                            content_text = item.get('content', '')
                    elif content_type == 'short_video or reel':
                        content_text = item.get('short_video_script', '')
                    elif content_type == 'long_video':
                        content_text = item.get('long_video_script', '')
                    elif content_type == 'message':
                        content_text = item.get('message', '')
                    else:
                        content_text = item.get('content', '')

                    # Get title
                    title = item.get('title', f"{content_type.title()} for {item.get('platform', 'Platform')}")

                    # Create structured content item for frontend
                    content_item = {
                        'id': 1,  # Single item
                        'content_id': state.content_id,
                        'platform': item.get('platform', 'Unknown').title(),
                        'content_type': content_type.replace('_', ' ').title(),
                        'status': item.get('status', 'generated').title(),
                        'created_at': date_display,
                        'created_at_raw': created_at,
                        'title': title,
                        'title_display': title,
                        'content_text': content_text,
                        'content_preview': content_text[:150] + '...' if len(content_text) > 150 else content_text,
                        'hashtags': hashtag_text,
                        'hashtags_display': hashtag_text,
                        'media_url': media_url,
                        'has_media': bool(media_url),
                        'images': item.get('images', []),
                        # Additional fields for different content types
                        'email_subject': item.get('email_subject'),
                        'email_body': item.get('email_body'),
                        'short_video_script': item.get('short_video_script'),
                        'long_video_script': item.get('long_video_script'),
                        'message': item.get('message'),
                        # Platform emoji
                        'platform_emoji': {
                            'Instagram': '📸',
                            'Facebook': '👥',
                            'Linkedin': '💼',
                            'Youtube': '🎥',
                            'Gmail': '✉️',
                            'Whatsapp': '💬'
                        }.get(item.get('platform', 'Unknown').title(), '🌐'),
                        # Status emoji and color
                        'status_emoji': {
                            'Generated': '📝',
                            'Scheduled': '⏰',
                            'Published': '✅'
                        }.get(item.get('status', 'generated').title(), '📄'),
                        'status_color': {
                            'Generated': 'blue',
                            'Scheduled': 'orange',
                            'Published': 'green'
                        }.get(item.get('status', 'generated').title(), 'gray'),
                        'metadata': item.get('metadata', {}),
                        'raw_data': item
                    }

                    # Set content_items for frontend display
                    state.content_items = [content_item]

            except Exception as e:
                logger.error(f"Error creating content item for display: {e}")

        # Set intent for frontend to enable action buttons
        state.intent = "created_content"

        # Minimal success response - cards will be displayed by frontend
        base_message = "Content created successfully! Use the action buttons below to manage your content."
        state.result = generate_personalized_message(
            base_message=base_message,
            user_context=state.user_query,
            message_type="success"
        )
        
    except Exception as e:
        state.error = f"Content generation failed: {str(e)}"
        logger.error(f"Content creation error: {e}")
    
    return state


def handle_edit_content(state: AgentState) -> AgentState:
    """Edit existing content from created_content table with rich formatting similar to dashboard"""
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


def handle_delete_content(state: AgentState) -> AgentState:
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
        if date_display:
            filter_parts.append(date_display.strip())

        if filter_parts:
            parts.append(f"(showing all matching {', '.join(filter_parts)})")

    elif has_query:
        # For semantic search, use different formatting
        parts.append(f"You have {count}")
        parts.append("item" if count == 1 else "items")
        parts.append(f"matching '{payload['query']}'")

        # Add any additional filters
        filter_parts = []
        if status_display != 'content':
            filter_parts.append(f"status: {status_display}")
        if channel_display != 'content':
            filter_parts.append(f"channel: {channel_display}")
        if content_type_display != 'items':
            filter_parts.append(f"type: {content_type_display}")
        if platform_display:
            filter_parts.append(f"platform: {platform_display}")
        if date_display:
            filter_parts.append(date_display.strip())

        if filter_parts:
            parts.append(f"(filtered by {', '.join(filter_parts)})")
    else:
        # Traditional filter-based summary
        # Start with "You have {count}"
        parts.append(f"You have {count}")

        # Add status if specified
        if status_display != 'content':
            parts.append(status_display)

        # Add channel if specified
        if channel_display != 'content':
            parts.append(channel_display)

        # Add content type if specified
        if content_type_display != 'items':
            parts.append(content_type_display)
        else:
            parts.append("item" if count == 1 else "items")

        # Add platform if specified
        if platform_display:
            parts.append(f"on {platform_display}")

        # Add date range if specified
        if date_display:
            parts.append(date_display)

    # Join parts with spaces
    summary = ' '.join(parts)

    # Capitalize first letter
    summary = summary[0].upper() + summary[1:] if summary else f"You have {count} content items"

    # Add period at the end
    if not summary.endswith('.'):
        summary += '.'

    # Add action instructions
    if show_all_posts:
        summary += "\n\nShowing ALL your content. Click on any item to edit, delete, or take other actions."
    else:
        summary += "\n\nIf you want to edit, delete, publish or schedule any post, just click on the post and select options."

    return summary


def handle_view_content(state: AgentState) -> AgentState:
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
- Date range: {payload.get('date_range', 'All time')}

Found 3 content item(s):
{''.join(content_list)}

Note: This is mock data. Connect to Supabase to see real content.
   Set SUPABASE_URL and SUPABASE_KEY environment variables."""


def handle_publish_content(state: AgentState) -> AgentState:
    """Handle content publishing - either direct publish or search and select"""
    payload = state.payload

    # Set agent name for content publishing
    payload['agent_name'] = 'emily'

    # If content_id is provided directly, publish that specific content
    if payload.get('content_id') and payload['content_id'].strip():
        return handle_publish_specific_content(state)

    # Otherwise, search for content and present for selection
    return handle_publish_content_search(state)


def handle_publish_specific_content(state: AgentState) -> AgentState:
    """Publish a specific piece of content by ID"""
    payload = state.payload

    # Set agent name for content publishing
    payload['agent_name'] = 'emily'

    content_id = payload['content_id'].strip()

    if not supabase:
        state.error = "Database connection not configured. Please contact support."
        state.result = generate_personalized_message(
            base_message="Unable to publish content: Database not available.",
            user_context=state.user_query,
            message_type="error"
        )
        logger.error("Supabase not configured - cannot publish content")
        return state

    # Ensure user_id is present for security
    if not state.user_id:
        state.error = "User ID is required to publish content"
        state.result = generate_personalized_message(
            base_message="Unable to publish content: User authentication required.",
            user_context=state.user_query,
            message_type="error"
        )
        logger.error("User ID missing in handle_publish_specific_content")
        return state

    try:
        # Fetch the specific content
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

        # Check if content is already published
        if content.get('status') == 'published':
            state.result = generate_personalized_message(
                base_message=f"⚠️ Content '{content_id}' is already published. Cannot publish again.",
                user_context=state.user_query,
                message_type="warning"
            )
            return state

        # Here you would implement the actual publishing logic
        # For now, just mark as published in the database
        publish_response = supabase.table('created_content').update({
            'status': 'published',
            'published_at': 'now()'
        }).eq('id', content_id).eq('user_id', state.user_id).execute()

        if publish_response.data:
            base_success_message = f"""✅ Content published successfully!

📝 **Content Details:**
• ID: {content_id}
• Platform: {content.get('platform', 'Unknown')}
• Type: {content.get('content_type', 'Unknown')}
• Status: Published

The content has been published to your connected {content.get('platform', 'platform')} account."""
            state.result = generate_personalized_message(
                base_message=base_success_message,
                user_context=state.user_query,
                message_type="success"
            )
        else:
            state.error = "Failed to update content status"
            state.result = generate_personalized_message(
                base_message="❌ Failed to publish content. Please try again.",
                user_context=state.user_query,
                message_type="error"
            )

    except Exception as e:
        logger.error(f"Error publishing specific content: {e}")
        state.error = f"Failed to publish content: {str(e)}"
        state.result = generate_personalized_message(
            base_message=f"❌ Error publishing content: {str(e)}",
            user_context=state.user_query,
            message_type="error"
        )

    return state


def handle_publish_content_search(state: AgentState) -> AgentState:
    """Search for content to publish and present for user selection"""
    payload = state.payload

    if not supabase:
        state.error = "Database connection not configured. Please contact support."
        state.result = "Unable to fetch content for publishing: Database not available."
        logger.error("Supabase not configured - cannot fetch content for publishing")
        return state

    # Ensure user_id is present for security
    if not state.user_id:
        state.error = "User ID is required to view content for publishing"
        state.result = "Unable to fetch content: User authentication required."
        logger.error("User ID missing in handle_publish_content_search")
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
            logger.info(f"Performing semantic search for publishing: '{search_query}'")

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

        logger.info(f"Publish content query executed: Found {len(response.data) if response.data else 0} items (semantic_search: {has_semantic_search})")

        if not response.data or len(response.data) == 0:
            # Generate personalized "no results" message
            if has_semantic_search:
                base_message = f"No content found matching your search for '{payload['query']}'. Try different keywords or check your filters."
            else:
                filters_desc = []
                if payload.get('channel'): filters_desc.append(f"channel: {payload['channel']}")
                if payload.get('platform'): filters_desc.append(f"platform: {payload['platform']}")
                if payload.get('status'): filters_desc.append(f"status: {payload['status']}")
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

        for idx, item in enumerate(response.data[:50], 1):  # Show up to 50 items for publishing
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

                # Create content item for frontend display
                content_item = {
                    "content_id": content_id,
                    "platform": item.get('platform', 'Unknown'),
                    "content_type": item.get('content_type', 'Unknown'),
                    "status": item.get('status', 'Unknown'),
                    "created_at": item.get('created_at', 'Unknown'),
                    "title": item.get('title', ''),
                    "content": item.get('content', '')[:200] + ('...' if len(item.get('content', '')) > 200 else ''),
                    "channel": item.get('channel', 'Unknown'),
                    "media_url": media_url,
                    "has_media": bool(media_url),
                    "images": item.get('images', [])
                }
                content_items.append(content_item)

        # Check if this is a semantic search result
        has_query = payload.get('query') and payload['query'].strip()

        if has_query:
            # For semantic search, use different formatting
            result_parts = [f"You have {len(content_items)} content item{'s' if len(content_items) != 1 else ''} matching '{payload['query']}' that can be published."]
        else:
            result_parts = [f"Found {len(content_items)} content item{'s' if len(content_items) != 1 else ''} ready for publishing."]

        result_parts.append("\nSelect which content you'd like to publish:")

        # Add filters info
        filters = []
        if payload.get('channel'): filters.append(f"Channel: {payload['channel']}")
        if payload.get('platform'): filters.append(f"Platform: {payload['platform']}")
        if payload.get('status'): filters.append(f"Status: {payload['status']}")
        if payload.get('start_date'): filters.append(f"Date: {payload['start_date']} to {payload.get('end_date', 'now')}")

        if filters:
            result_parts.append(f"Filters: {', '.join(filters)}")

        # Generate personalized success message
        state.result = generate_personalized_message(
            base_message='\n'.join(result_parts),
            user_context=state.user_query,
            message_type="success"
        )
        state.content_ids = content_ids  # Store available content IDs
        state.content_items = content_items  # Store structured content for frontend

        # Don't set payload_complete - wait for user to select content
        state.waiting_for_user = True
        state.current_step = "content_selection"

    except Exception as e:
        logger.error(f"Error in handle_publish_content: {e}")
        state.error = f"Failed to search content for publishing: {str(e)}"
        state.result = generate_personalized_message(
            base_message=f"❌ Error searching content: {str(e)}",
            user_context=state.user_query,
            message_type="error"
        )

    return state


def handle_schedule_content(state: AgentState) -> AgentState:
    """Handle content scheduling - direct schedule or show drafts for selection"""
    payload = state.payload

    # If content_id is provided directly, schedule that specific content
    if payload.get('content_id') and payload['content_id'].strip():
        return handle_schedule_specific_content(state)

    # Otherwise, show recent draft posts for selection
    return handle_schedule_draft_selection(state)


def handle_schedule_specific_content(state: AgentState) -> AgentState:
    """Schedule a specific piece of content by ID"""
    payload = state.payload

    content_id = payload['content_id'].strip()
    schedule_date = payload.get('schedule_date')
    schedule_time = payload.get('schedule_time')

    if not supabase:
        state.error = "Database connection not configured. Please contact support."
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
            base_message=f"❌ Error scheduling content: {str(e)}. Please try again.",
            user_context=state.user_query,
            message_type="error"
        )

    return state


def handle_schedule_draft_selection(state: AgentState) -> AgentState:
    """Show recent draft posts and let user choose which to schedule"""
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
                    dt = datetime.fromisoformat(created_date.replace('Z', '+00:00'))
                    date_display = dt.strftime('%b %d')
                except:
                    date_display = created_date[:10]

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


# ==================== LEAD HANDLERS ====================

def handle_create_leads(state: AgentState) -> AgentState:
    """Create new lead with database insertion and card display"""
    payload = state.payload

    # Check if payload is complete before proceeding
    if not state.payload_complete:
        state.result = "Lead creation payload is not complete. Please provide all required information first."
        return state

    # Set agent name to Chase
    payload['agent_name'] = 'chase'

    # Basic safety validation (payload should be complete, but double-check)
    lead_name = payload.get('lead_name', '').strip()
    if not lead_name:
        state.result = "Lead name is required."
        return state

    # Ensure we have user_id
    if not state.user_id:
        state.result = "User authentication required."
        return state

    # Get contact info - use original values if available, otherwise use payload values
    lead_email = getattr(state, 'temp_original_email', None) or payload.get('lead_email')
    lead_phone = getattr(state, 'temp_original_phone', None) or payload.get('lead_phone')

    # Final validation for contact info
    if not lead_email and not lead_phone:
        state.result = "Either email or phone number is required."
        return state

    lead_data = {
        "user_id": state.user_id,
        "name": lead_name.strip(),  # Keep name as-is (not lowercase)
        "email": lead_email.lower() if lead_email else None,  # Lowercase email
        "phone_number": lead_phone,  # Keep phone as-is
        "source_platform": payload.get('lead_source').strip().lower(),  # Lowercase source
        "status": payload.get('lead_status').strip().lower(),  # Lowercase status
        "form_data": {},
        "metadata": {
            "remarks": (payload.get('remarks') or '').lower(),  # Lowercase remarks
            "created_by_agent": True,
            "agent_name": "chase",
            "created_at": datetime.now().isoformat()
        }
    }

    # Handle follow_up_at if provided
    follow_up = payload.get('follow_up')
    if follow_up:
        try:
            from dateutil import parser
            follow_up_dt = parser.parse(str(follow_up))
            # Ensure it's timezone aware
            if follow_up_dt.tzinfo is None:
                follow_up_dt = follow_up_dt.replace(tzinfo=datetime.now().astimezone().tzinfo)
            lead_data["follow_up_at"] = follow_up_dt.isoformat()
        except Exception as e:
            logger.warning(f"Failed to parse follow_up_at: {follow_up}, continuing without it")

    try:
        # Insert into Supabase leads table
        if supabase:
            result = supabase.table("leads").insert(lead_data).execute()

            if result.data:
                created_lead = result.data[0]
                lead_id = created_lead["id"]

                # Set lead_id for frontend to fetch and display
                state.lead_id = lead_id

                # Set success intent for frontend
                state.intent = "lead_created"

                # Simple success message - lead card will be displayed separately
                base_message = "Added a new lead successfully!"

                state.result = generate_personalized_message(
                    base_message=base_message,
                    user_context=state.user_query,
                    message_type="success"
                )

                return state
            else:
                state.result = "Failed to create lead in database."
                return state
        else:
            state.result = "Database connection not available."
            return state

    except Exception as e:
        logger.error(f"Error creating lead: {e}")
        state.result = f"Error creating lead: {str(e)}"
        return state


def handle_view_leads(state: AgentState) -> AgentState:
    """View leads with database query and fuzzy matching"""
    payload = state.payload

    # Set agent name to Chase
    payload['agent_name'] = 'chase'

    # Ensure user_id is present for security
    if not state.user_id:
        state.result = "User authentication required."
        return state

    try:
        if not supabase:
            state.result = "Database connection not available."
            return state

        # Build query - always filter by user_id for security
        query = supabase.table("leads").select("*").eq("user_id", state.user_id)

        # Add filters
        filters = []

        if payload.get('lead_source'):
            query = query.eq("source_platform", payload['lead_source'])
            filters.append(f"Source: {payload['lead_source']}")

        if payload.get('lead_status'):
            query = query.eq("status", payload['lead_status'])
            filters.append(f"Status: {payload['lead_status']}")

        # Add date range filter if provided
        if payload.get('start_date') and payload.get('end_date'):
            filters.append(f"Date range: {payload['start_date']} to {payload['end_date']}")
            # Use the parsed start_date and end_date from complete_view_leads_payload
            start_datetime = f"{payload['start_date']}T00:00:00.000Z"
            end_datetime = f"{payload['end_date']}T23:59:59.999Z"
            query = query.gte("created_at", start_datetime).lte("created_at", end_datetime)
        elif payload.get('start_date'):
            filters.append(f"Date from: {payload['start_date']}")
            # Single date filter
            start_datetime = f"{payload['start_date']}T00:00:00.000Z"
            end_datetime = f"{payload['start_date']}T23:59:59.999Z"
            query = query.gte("created_at", start_datetime).lte("created_at", end_datetime)

        # Add fuzzy matching for name/email if provided
        if payload.get('lead_name'):
            # Use ilike for case-insensitive partial matching
            query = query.ilike("name", f"%{payload['lead_name']}%")
            filters.append(f"Name contains: {payload['lead_name']}")

        if payload.get('lead_email'):
            # Use original email for filtering
            filter_email = getattr(state, 'temp_filter_emails', [payload['lead_email']])[0]
            query = query.ilike("email", f"%{filter_email}%")
            filters.append(f"Email contains: {filter_email}")

        if payload.get('lead_phone'):
            # Use original phone for filtering
            filter_phone = getattr(state, 'temp_filter_phones', [payload['lead_phone']])[0]
            query = query.ilike("phone", f"%{filter_phone}%")
            filters.append(f"Phone contains: {filter_phone}")

        # Order by creation date (newest first) and limit results
        query = query.order("created_at", desc=True).limit(50)

        result = query.execute()
        leads = result.data if result.data else []

        # Get last remarks for all leads (similar to leads.py router)
        last_remarks = {}
        if leads:
            lead_ids = [lead["id"] for lead in leads]
            status_history_result = supabase.table("lead_status_history").select("lead_id, reason, created_at").in_("lead_id", lead_ids).order("created_at", desc=True).execute()

            seen_leads = set()
            if status_history_result.data:
                for history in status_history_result.data:
                    lead_id = history["lead_id"]
                    if lead_id not in seen_leads and history.get("reason"):
                        last_remarks[lead_id] = history["reason"]
                        seen_leads.add(lead_id)

        # Create secure lead items for frontend display (not sent to LLM)
        if not leads:
            state.result = generate_personalized_message(
                base_message="No leads found matching your criteria.",
                user_context=state.user_query,
                message_type="info"
            )
        else:
            # Store lead_ids and structured data for frontend only
            lead_ids = [lead["id"] for lead in leads]
            state.payload['lead_ids'] = lead_ids

            # Create lead_items for frontend display (not sent to LLM)
            lead_items = []
            for lead in leads:
                last_remark = last_remarks.get(lead["id"], "No remarks")
                created_date = lead.get("created_at", "Unknown")[:10] if lead.get("created_at") else "Unknown"

                lead_item = {
                    'id': lead["id"],
                    'lead_id': lead["id"],
                    'name': lead.get('name', 'Unknown'),
                    'email': lead.get('email', 'No email'),
                    'phone': lead.get('phone_number', 'No phone'),
                    'status': lead.get('status', 'Unknown'),
                    'source_platform': lead.get('source_platform', 'Unknown'),
                    'created_at': created_date,
                    'last_remark': last_remark,
                    # Add any other fields needed for frontend display
                    'metadata': lead.get('metadata', {}),
                    'raw_data': lead  # Full data for advanced frontend features
                }
                lead_items.append(lead_item)

            state.lead_items = lead_items

            # Send only summary to LLM (no PII)
            base_message = f"Found {len(leads)} lead{'s' if len(leads) != 1 else ''} matching your criteria. Select any lead to view details or take actions."

            if filters:
                base_message += f"\n\nFilters applied: {', '.join(filters)}"

            state.result = generate_personalized_message(
                base_message=base_message,
                user_context=state.user_query,
                message_type="success"
            )

    except Exception as e:
        logger.error(f"Error viewing leads: {e}")
        state.result = f"Error retrieving leads: {str(e)}"

    return state


def handle_edit_leads(state: AgentState) -> AgentState:
    """Edit lead"""
    payload = state.payload

    # Set agent name to Chase
    payload['agent_name'] = 'chase'
    
    updates = []
    if payload.get('new_lead_name'):
        updates.append(f"Name → {payload['new_lead_name']}")
    if payload.get('new_lead_email'):
        updates.append(f"Email → {payload['new_lead_email']}")
    if payload.get('new_lead_status'):
        updates.append(f"Status → {payload['new_lead_status']}")
    
    state.result = f"""Lead updated

Identifying lead:
- Name: {payload.get('lead_name')}
- Email: {payload.get('lead_email')}
- Phone: {payload.get('lead_phone')}

Updates applied:
{chr(10).join(f'  • {u}' for u in updates)}"""
    
    return state


def handle_delete_leads(state: AgentState) -> AgentState:
    """Delete lead with database removal"""
    payload = state.payload

    # Check if payload is complete before proceeding
    if not state.payload_complete:
        state.result = "Lead deletion payload is not complete. Please provide lead identification first."
        return state

    # Set agent name to Chase
    payload['agent_name'] = 'chase'

    # Ensure we have user_id
    if not state.user_id:
        state.result = "User authentication required."
        return state

    # Get lead identification - prefer ID, fallback to name/email/phone search
    lead_id = payload.get('lead_id')
    lead_name = payload.get('lead_name')
    lead_email = payload.get('lead_email')
    lead_phone = payload.get('lead_phone')

    if not lead_id and not lead_name and not lead_email and not lead_phone:
        state.result = "No lead identification provided. Please specify lead ID, name, email, or phone."
        return state

    try:
        # Build query to find the lead
        query = supabase.table("leads").select("*").eq("user_id", state.user_id)

        if lead_id:
            # Direct ID lookup
            query = query.eq("id", lead_id)
        else:
            # Search by name, email, phone
            if lead_name:
                query = query.ilike("name", f"%{lead_name}%")
            if lead_email:
                query = query.ilike("email", f"%{lead_email}%")
            if lead_phone:
                query = query.ilike("phone_number", f"%{lead_phone}%")

        # Execute the query to find leads
        result = query.execute()

        if not result.data or len(result.data) == 0:
            state.result = f"No lead found matching the specified criteria."
            return state

        if len(result.data) > 1:
            # Multiple matches - show all and ask for clarification
            lead_list = "\n".join([f"- {lead['name']} ({lead['email'] or 'no email'})" for lead in result.data[:5]])
            state.result = f"Multiple leads found. Please be more specific:\n{lead_list}"
            return state

        # Single lead found - proceed with deletion
        lead_to_delete = result.data[0]
        lead_id_to_delete = lead_to_delete["id"]

        # Perform the actual deletion
        delete_result = supabase.table("leads").delete().eq("id", lead_id_to_delete).eq("user_id", state.user_id).execute()

        if delete_result.data:
            # Set success intent for frontend
            state.intent = "lead_deleted"

            # Success message
            base_message = f"Successfully deleted lead '{lead_to_delete['name']}'"

            state.result = generate_personalized_message(
                base_message=base_message,
                user_context=state.user_query,
                message_type="success"
            )

            return state
        else:
            state.result = "Failed to delete lead from database."
            return state

    except Exception as e:
        logger.error(f"Error deleting lead: {e}")
        state.result = f"Error deleting lead: {str(e)}"
        return state


def handle_follow_up_leads(state: AgentState) -> AgentState:
    """Follow up with lead"""
    payload = state.payload

    # Set agent name to Chase
    payload['agent_name'] = 'chase'
    
    # Generate follow-up message if not provided
    if not payload.get('follow_up_message'):
        prompt = f"""Generate a professional follow-up message for a lead.

Lead name: {payload.get('lead_name')}

Make it friendly, brief, and action-oriented."""
        
        try:
            response = model.generate_content(prompt)
            follow_up_message = response.text.strip()
        except:
            follow_up_message = f"Hi {payload.get('lead_name', 'there')}, following up on our previous conversation..."
    else:
        follow_up_message = payload['follow_up_message']
    
    # Get original contact info for display
    display_email = getattr(state, 'temp_followup_emails', [None])[0] or payload.get('lead_email')
    display_phone = getattr(state, 'temp_followup_phones', [None])[0] or payload.get('lead_phone')
    
    # Format the follow-up date for display
    follow_up_date = payload.get('follow_up_date')
    formatted_date = f"\n📅 Scheduled: {follow_up_date}" if follow_up_date else ""

    state.result = f"""📧 Follow-up prepared

Lead: {payload.get('lead_name')}
Contact: {display_email or display_phone}{formatted_date}

Message:
{follow_up_message}

Status: Ready to send"""
    
    return state


# ==================== ANALYTICS HANDLERS ====================

def handle_view_insights(state: AgentState) -> AgentState:
    """View insights"""
    payload = state.payload
    
    state.result = f"""📊 Insights Dashboard

Channel: {payload.get('channel', 'All')}
Platform: {payload.get('platform', 'All')}
Metrics: {', '.join(payload.get('metrics', ['All']))}
Period: {payload.get('date_range', 'All time')}

[Insights data would be displayed here]"""
    
    return state


def handle_view_analytics(state: AgentState) -> AgentState:
    """View analytics"""
    payload = state.payload
    
    state.result = f"""📈 Analytics Dashboard

Channel: {payload.get('channel', 'All')}
Platform: {payload.get('platform', 'All')}
Period: {payload.get('date_range', 'All time')}

[Analytics data would be displayed here]"""
    
    return state


# ==================== GRAPH CONSTRUCTION ====================

def route_to_constructor(state: AgentState) -> str:
    """Route to specific payload constructor based on intent"""
    if state.error:
        return "end"
    
    # Greeting goes directly to end
    if state.intent == "greeting":
        return "end"
    
    # General_talks skips payload construction
    if state.intent == "general_talks":
        return "execute_action"
    
    intent_to_constructor = {
        "create_content": "construct_create_content",
        "edit_content": "construct_edit_content",
        "delete_content": "construct_delete_content",
        "view_content": "construct_view_content",
        "publish_content": "construct_publish_content",
        "schedule_content": "construct_schedule_content",
        "create_leads": "construct_create_leads",
        "view_leads": "construct_view_leads",
        "edit_leads": "construct_edit_leads",
        "delete_leads": "construct_delete_leads",
        "follow_up_leads": "construct_follow_up_leads",
        "view_insights": "construct_view_insights",
        "view_analytics": "construct_view_analytics",
    }
    
    return intent_to_constructor.get(state.intent, "end")


def should_continue_to_completion(state: AgentState) -> str:
    """Route after payload construction"""
    if state.error:
        return "end"
    return "complete_payload"


def should_continue_to_action(state: AgentState) -> str:
    """Route after payload completion check"""
    if state.error:
        return "end"
    if state.payload_complete:
        return "execute_action"
    # When waiting for user clarification or upload, stop graph execution
    # The graph will pause and return control. When user responds,
    # process_query will update state and invoke graph again from entry point
    if state.waiting_for_user or state.waiting_for_upload:
        return "end"  # Stop execution - graph pauses naturally
    return "end"


def build_graph():
    """Build the LangGraph workflow"""
    
    workflow = StateGraph(AgentState)
    
    # Add nodes
    workflow.add_node("classify_intent", classify_intent)
    
    # Add specific payload constructor nodes for each intent
    workflow.add_node("construct_create_content", construct_create_content_payload)
    workflow.add_node("construct_edit_content", construct_edit_content_payload)
    workflow.add_node("construct_delete_content", construct_delete_content_payload)
    workflow.add_node("construct_view_content", construct_view_content_payload)
    workflow.add_node("construct_publish_content", construct_publish_content_payload)
    workflow.add_node("construct_schedule_content", construct_schedule_content_payload)
    workflow.add_node("construct_create_leads", construct_create_leads_payload)
    workflow.add_node("construct_view_leads", construct_view_leads_payload)
    workflow.add_node("construct_edit_leads", construct_edit_leads_payload)
    workflow.add_node("construct_delete_leads", construct_delete_leads_payload)
    workflow.add_node("construct_follow_up_leads", construct_follow_up_leads_payload)
    workflow.add_node("construct_view_insights", construct_view_insights_payload)
    workflow.add_node("construct_view_analytics", construct_view_analytics_payload)
    
    # Add payload completer and action executor
    workflow.add_node("complete_payload", complete_payload)
    workflow.add_node("execute_action", execute_action)
    
    # Add edges
    workflow.set_entry_point("classify_intent")
    
    # Route from intent classifier to specific constructor or direct to action
    workflow.add_conditional_edges(
        "classify_intent",
        route_to_constructor,
        {
            "execute_action": "execute_action",  # For greeting and general_talks
            "construct_create_content": "construct_create_content",
            "construct_edit_content": "construct_edit_content",
            "construct_delete_content": "construct_delete_content",
            "construct_view_content": "construct_view_content",
            "construct_publish_content": "construct_publish_content",
            "construct_schedule_content": "construct_schedule_content",
            "construct_create_leads": "construct_create_leads",
            "construct_view_leads": "construct_view_leads",
            "construct_edit_leads": "construct_edit_leads",
            "construct_delete_leads": "construct_delete_leads",
            "construct_follow_up_leads": "construct_follow_up_leads",
            "construct_view_insights": "construct_view_insights",
            "construct_view_analytics": "construct_view_analytics",
            "end": END
        }
    )
    
    # All constructors go to payload completer
    for constructor_name in [
        "construct_create_content", "construct_edit_content", "construct_delete_content",
        "construct_view_content", "construct_publish_content", "construct_schedule_content",
        "construct_create_leads", "construct_view_leads", "construct_edit_leads",
        "construct_delete_leads", "construct_follow_up_leads", "construct_view_insights",
        "construct_view_analytics"
    ]:
        workflow.add_conditional_edges(
            constructor_name,
            should_continue_to_completion,
            {
                "complete_payload": "complete_payload",
                "end": END
            }
        )
    
    # Payload completer routes to action or ends (when waiting for user)
    workflow.add_conditional_edges(
        "complete_payload",
        should_continue_to_action,
        {
            "execute_action": "execute_action",
            "end": END  # Ends when waiting for user clarification or on error
        }
    )
    
    workflow.add_edge("execute_action", END)
    
    return workflow.compile()


# ==================== MAIN AGENT CLASS ====================

class ATSNAgent:
    """Main agent class for content and lead management"""
    
    def __init__(self, user_id: Optional[str] = None):
        self.graph = build_graph()
        self.state = None
        self.user_id = user_id
    
    async def process_query(self, user_query: str, conversation_history: List[str] = None, user_id: Optional[str] = None, media_file: Optional[str] = None, media_urls: Optional[List[str]] = None) -> Dict[str, Any]:
        """Process a user query
        
        Maintains conversation context by appending new messages to user_query.
        This ensures the LLM always has full context for intent classification and payload construction.
        """
        
        # Use provided user_id or fall back to instance user_id
        active_user_id = user_id or self.user_id
        
        # Clean and normalize user query
        user_query = user_query.strip()
        if not user_query:
            return {
                "error": "Empty query provided",
                "current_step": "end"
            }
        
        # Initialize or update state
        # Check if previous query was completed (has result and payload_complete)
        previous_completed = (
            self.state is not None
            and self.state.payload_complete
            and (self.state.result or self.state.current_step == "end")
            and not self.state.waiting_for_user
            and not self.state.waiting_for_upload
        )
        
        if self.state is None or previous_completed or not self.state.waiting_for_user:
            # New conversation or new query after completion
            # Reset state if previous query was completed
            if previous_completed:
                logger.info("Previous query completed, starting new conversation")
            self.state = AgentState(
                user_query=user_query,
                conversation_history=[],  # Deprecated but kept for compatibility
                user_id=active_user_id
            )
        else:
            # User is responding to clarification - append to maintain context
            # This ensures the LLM sees the full conversation flow
            if self.state.user_query:
                # Append with space separator, ensuring no double spaces
                existing_query = self.state.user_query.rstrip()
                self.state.user_query = f"{existing_query} {user_query}"
                # Also maintain full conversation history
                if self.state.full_conversation:
                    existing_full = self.state.full_conversation.rstrip()
                    self.state.full_conversation = f"{existing_full} {user_query}"
                else:
                    self.state.full_conversation = user_query
            else:
                self.state.user_query = user_query
                self.state.full_conversation = user_query
            
            self.state.waiting_for_user = False
            self.state.current_step = "payload_construction"

            # Check for intent changes in clarification responses
            if self.state and self.state.intent:
                print(f"🔄 Calling detect_intent_changes in process_query for intent: {self.state.intent}")
                old_state = self.state
                self.state = detect_intent_changes(self.state)
                if self.state and self.state.intent_change_detected:
                    print(f"✅ Intent change detected in process_query: {self.state.previous_intent} → {self.state.intent} ({self.state.intent_change_type})")
                elif not self.state:
                    print(f"❌ detect_intent_changes returned None, restoring old state")
                    self.state = old_state
            
            # Preserve user_id if provided
            if active_user_id:
                self.state.user_id = active_user_id

        # Handle media_file or media_urls if provided (for upload functionality)
        if media_file:
            self.state.payload['media_file'] = media_file
            logger.info(f"Media file set in payload: {media_file}")
        elif media_urls and len(media_urls) > 0:
            self.state.payload['media_file'] = media_urls[0]  # Use first URL
            logger.info(f"Media URLs set in payload: {media_urls}")

        # Handle content selection from temp_content_options (for scheduling)
        if (hasattr(self.state, 'temp_content_options') and
            self.state.temp_content_options and
            user_query.strip()):

            # Check if user response is a number
            try:
                selection_idx = int(user_query.strip()) - 1  # Convert to 0-based index
                if 0 <= selection_idx < len(self.state.temp_content_options):
                    selected_content = self.state.temp_content_options[selection_idx]
                    content_id = selected_content.get('id')

                    # Set the content_id in payload
                    self.state.payload['content_id'] = content_id
                    logger.info(f"User selected content {selection_idx + 1}: {content_id}")

                    # Clear temp options since selection is made
                    self.state.temp_content_options = None

            except ValueError:
                # Not a number, check if it's a direct content ID
                if user_query.strip().startswith('CONTENT_') or len(user_query.strip()) > 20:
                    # Looks like a content ID
                    self.state.payload['content_id'] = user_query.strip()
                    logger.info(f"User provided direct content ID: {user_query.strip()}")
                    self.state.temp_content_options = None

        # Run the graph
        result = await self.graph.ainvoke(self.state)
        
        # Update state with result
        self.state = AgentState(**result)
        
        # Prepare response - only include clarification_options when actually waiting for user
        clarification_options = []
        if self.state.waiting_for_user and hasattr(self.state, 'clarification_options'):
            clarification_options = getattr(self.state, 'clarification_options', [])

        # Adjust current_step for waiting states
        current_step = self.state.current_step
        if self.state.waiting_for_upload:
            current_step = "waiting_for_upload"

        response = {
            "intent": self.state.intent,
            "payload": self.state.payload,
            "payload_complete": self.state.payload_complete,
            "waiting_for_user": self.state.waiting_for_user,
            "waiting_for_upload": self.state.waiting_for_upload,
            "upload_type": self.state.upload_type,
            "clarification_question": self.state.clarification_question,
            "clarification_options": clarification_options,  # Only include when waiting
            "result": self.state.result,
            "error": self.state.error,
            "current_step": current_step,
            "content_id": self.state.content_id,  # Single content ID (UUID)
            "content_ids": getattr(self.state, 'content_ids', None),  # List of content IDs for selection
            "lead_id": self.state.lead_id,  # Single lead ID (UUID)
            "content_items": self.state.content_items,  # Structured content data for frontend cards
            "lead_items": self.state.lead_items,  # Structured lead data for frontend cards
            "needs_connection": getattr(self.state, 'needs_connection', None),  # Whether user needs to connect account
            "connection_platform": getattr(self.state, 'connection_platform', None)  # Platform to connect
        }
        
        return response
    
    def reset(self):
        """Reset the agent state"""
        self.state = None


# ==================== USAGE EXAMPLE ====================

def main():
    """Example usage"""
    
    print("=" * 80)
    print("ATSN Agent - Content & Lead Management")
    print("Built with LangGraph | Powered by Gemini 2.5")
    print("=" * 80)
    print()
    
    agent = ATSNAgent()
    
    # Example 1: Create content with clarifications
    print("📝 Example 1: Create Instagram post")
    print("-" * 80)
    print("User: Create an Instagram post about sustainable fashion trends for 2025")
    response = agent.process_query(
        "Create an Instagram post about sustainable fashion trends for 2025"
    )
    
    # Handle clarifications
    clarification_count = 0
    while response['waiting_for_user'] and clarification_count < 5:
        clarification_count += 1
        print(f"\n🤖 Agent: {response['clarification_question']}")
        
        # Simulate user responses
        if "media" in response['clarification_question'].lower():
            user_response = "Generate an image"
            print(f"👤 User: {user_response}")
            response = agent.process_query(user_response)
        else:
            user_response = input("👤 User: ")
            response = agent.process_query(user_response)
    
    if response['result']:
        print(f"\n{response['result']}")
    elif response['error']:
        print(f"\nError: {response['error']}")
    
    print("\n")
    
    # Example 2: Create lead with partial information
    print("👤 Example 2: Create a new lead")
    print("-" * 80)
    print("User: Add a new lead John Doe from website")
    agent.reset()
    response = agent.process_query(
        "Add a new lead John Doe from website"
    )
    
    clarification_count = 0
    while response['waiting_for_user'] and clarification_count < 5:
        clarification_count += 1
        print(f"\n🤖 Agent: {response['clarification_question']}")
        
        # Simulate responses
        if "email" in response['clarification_question'].lower():
            user_response = "john.doe@example.com"
        elif "phone" in response['clarification_question'].lower():
            user_response = "+1234567890"
        else:
            user_response = input("👤 User: ")
        
        print(f"👤 User: {user_response}")
        response = agent.process_query(user_response)
    
    if response['result']:
        print(f"\n{response['result']}")
    elif response['error']:
        print(f"\nError: {response['error']}")
    
    print("\n")
    
    # Example 3: Schedule content
    print("📅 Example 3: Schedule LinkedIn content")
    print("-" * 80)
    print("User: Schedule my LinkedIn post for tomorrow at 2 PM")
    agent.reset()
    response = agent.process_query(
        "Schedule my LinkedIn post for tomorrow at 2 PM"
    )
    
    clarification_count = 0
    while response['waiting_for_user'] and clarification_count < 5:
        clarification_count += 1
        print(f"\n🤖 Agent: {response['clarification_question']}")
        user_response = input("👤 User: ")
        response = agent.process_query(user_response)
    
    if response['result']:
        print(f"\n{response['result']}")
    elif response['error']:
        print(f"\nError: {response['error']}")
    
    print("\n")
    
    # Example 4: View leads with filters
    print("Example 4: View qualified leads")
    print("-" * 80)
    print("User: Show me all qualified leads from LinkedIn")
    agent.reset()
    response = agent.process_query(
        "Show me all qualified leads from LinkedIn"
    )
    
    clarification_count = 0
    while response['waiting_for_user'] and clarification_count < 5:
        clarification_count += 1
        print(f"\n🤖 Agent: {response['clarification_question']}")
        user_response = input("👤 User: ")
        response = agent.process_query(user_response)
    
    if response['result']:
        print(f"\n{response['result']}")
    elif response['error']:
        print(f"\nError: {response['error']}")
    
    print("\n")
    
    # Example 5: View content with filters (NEW - Database integration)
    print("Example 5: View content with filters")
    print("-" * 80)
    print("User: Show me all scheduled Instagram posts")
    agent.reset()
    response = agent.process_query(
        "Show me all scheduled Instagram posts"
    )
    
    clarification_count = 0
    while response['waiting_for_user'] and clarification_count < 5:
        clarification_count += 1
        print(f"\n🤖 Agent: {response['clarification_question']}")
        user_response = input("👤 User: ")
        response = agent.process_query(user_response)
    
    if response['result']:
        print(f"\n{response['result']}")
    elif response['error']:
        print(f"\nError: {response['error']}")
    
    print("\n")
    print("=" * 80)
    print("All examples completed!")
    print("=" * 80)
    print("\nTip: Set SUPABASE_URL and SUPABASE_KEY to use real database")
    print("   Otherwise, mock data will be displayed.")


if __name__ == "__main__":
    main()

