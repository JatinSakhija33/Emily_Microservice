# content_service.py
import os
import logging
import json
import re
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List

import openai
from supabase import create_client
from dotenv import load_dotenv
from pathlib import Path

# Load environment
env_path = Path(__file__).resolve().parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Clients
supabase_url = os.getenv('SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
supabase = create_client(supabase_url, supabase_key) if supabase_url and supabase_key else None

openai_api_key = os.getenv('OPENAI_API_KEY')
openai_client = openai.OpenAI(api_key=openai_api_key) if openai_api_key else None

# Constants
JSON_ONLY_INSTRUCTION = """
CRITICAL: You MUST respond with ONLY a valid JSON object.
Your response must start with { and end with }."""

INTENT_PROMPTS = {
    "RELATE": "Tell a relatable personal or business story. NO SELLING. Use casual, vulnerable tone. Connect emotionally.",
    "EDUCATE": "Teach a valuable insight or 'how-to'. Focus on value. No hard pitch. Use clear structure.",
    "TRUST": "Showcase a win, a testimonial, or deep expertise. Professional but proud. Build authority.",
    "DIRECT": "Clear, strong Call to Action (CTA). Sell the value proposition directly. Create urgency."
}

# --- Utility ---

def clean_and_parse_json(content: str) -> Dict:
    """Robustly parse JSON even if LLM wraps it in Markdown blocks."""
    try:
        content = re.sub(r'```json\s*', '', content)
        content = re.sub(r'```', '', content)
        content = content.strip()
        return json.loads(content)
    except json.JSONDecodeError:
        return {}

def get_active_campaigns(user_id: str) -> List[Dict]:
    """Fetch all active organic campaigns for the user."""
    try:
        res = supabase.table('social_media_calendars')\
            .select('*')\
            .eq('is_organic_campaign', True)\
            .eq('status', 'active')\
            .eq('user_id', user_id)\
            .execute()
        return res.data or []
    except Exception as e:
        logger.error(f"Error fetching campaigns: {e}")
        return []

# --- Logic ---

def construct_create_organic_content_payload(state) -> dict:
    # Import locally to avoid circular imports
    from ..agents.atsn import _extract_payload
    
    prompt = f"""Extract content generation details.
    
    1. platform: "instagram", "linkedin", "twitter", etc.
    2. target_campaign: Name or goal keywords (e.g., "brand awareness", "summer sale") or "latest".
    3. calendar_date: "YYYY-MM-DD" or "next" (default to "next" if unspecified).
    4. confirm_creation: "yes" | "no"
    
    User Query: {state.user_query}
    
    Return JSON: {{ "platform": "...", "target_campaign": "...", "calendar_date": "...", "confirm_creation": "..." }}
    {JSON_ONLY_INSTRUCTION}"""
    
    return _extract_payload(state, prompt)

def complete_create_organic_content_payload(state) -> dict:
    p = state.payload
    
    # 1. Basic Validation
    if not p.get('platform'):
        state.clarification_question = "Which platform are we creating content for?"
        state.waiting_for_user = True
        return state

    if not p.get('calendar_date'):
        p['calendar_date'] = 'next' # Default to next available

    # 2. Campaign Selection Logic
    if not p.get('selected_campaign_id'):
        campaigns = get_active_campaigns(state.user_id)
        
        if not campaigns:
            state.error = "No active organic campaigns found. Please create one first."
            return state
            
        selected = None
        target = p.get('target_campaign')
        
        # Auto-select if only one exists
        if len(campaigns) == 1:
            selected = campaigns[0]
        
        # Fuzzy match by name/goal if target provided
        elif target and target != 'latest':
            target_lower = target.lower()
            matches = [c for c in campaigns if target_lower in c.get('campaign_goal', '').lower() or target_lower in c.get('campaign_name', '').lower()]
            if len(matches) == 1:
                selected = matches[0]
            elif len(matches) > 1:
                # If multiple matches, filter list for clarification
                campaigns = matches

        # Handle 'latest' or selection index
        elif target == 'latest':
             # Sort by creation date desc
             campaigns.sort(key=lambda x: x.get('created_at', ''), reverse=True)
             selected = campaigns[0]
        
        elif p.get('campaign_selection_index'):
            try:
                idx = int(p['campaign_selection_index']) - 1
                if 0 <= idx < len(campaigns): selected = campaigns[idx]
            except ValueError: pass

        # If still no selection, ask user
        if not selected:
            state.clarification_question = "Which campaign are we working on?"
            state.clarification_options = [
                {
                    "label": f"{c.get('campaign_name', 'Campaign')} - {c.get('campaign_goal')} (Ends {c.get('campaign_end_date', 'N/A')})", 
                    "value": str(i+1)
                }
                for i, c in enumerate(campaigns)
            ]
            state.expected_field = "campaign_selection_index"
            state.waiting_for_user = True
            return state
            
        p['selected_campaign_id'] = selected['id']

    # 3. Find the Calendar Entry
    try:
        query = supabase.table('calendar_entries').select('*')\
            .eq('platform', p['platform'])\
            .eq('calendar_id', p['selected_campaign_id'])\
            .neq('status', 'published') # Allow drafting on 'planned' or 'drafted'
        
        if p['calendar_date'] == 'next':
            # Find next unplanned or drafted entry from today onwards
            today = datetime.now().strftime('%Y-%m-%d')
            query = query.gte('entry_date', today)\
                         .order('entry_date', desc=False)\
                         .limit(1)
        else:
            query = query.eq('entry_date', p['calendar_date'])
            
        res = query.execute()
        
        if res.data:
            state.payload['entry'] = res.data[0]
            entry_topic = res.data[0]['topic']
            entry_date = res.data[0]['entry_date']
            
            # Confirm before burning tokens
            if p.get('confirm_creation') != 'yes':
                state.clarification_question = f"Found entry for {entry_date}: '{entry_topic}'. Ready to generate?"
                state.waiting_for_user = True
                # We auto-set confirm_creation to yes for the next turn if they say "yes"
                return state
        else:
            state.error = f"No planned entry found for {p['platform']} on {p['calendar_date']}."
            
    except Exception as e:
        state.error = f"Database error: {str(e)}"
        
    state.payload_complete = True
    return state

def handle_create_organic_content(state) -> dict:
    entry = state.payload.get('entry')
    if not entry:
        state.error = "No entry found to generate content for."
        return state
        
    try:
        # Extract Context
        intent = entry.get('intent_type', 'EDUCATE')
        phase = entry.get('campaign_phase', 'CLARITY')
        theme = entry.get('weekly_theme', 'General')
        platform = entry.get('platform')
        topic = entry.get('topic')
        
        # 1. Generate Copy & Image Prompt in Parallel (Conceptual) or Sequence
        prompt = f"""Generate organic social media content for {platform}.
        
        Topic: {topic}
        STRICT INTENT: {intent} ({INTENT_PROMPTS.get(intent, '')})
        
        Context:
        - Phase: {phase}
        - Theme: {theme}
        
        Output a JSON object with:
        1. "caption": The post caption (include emojis and hashtags).
        2. "image_prompt": A detailed prompt to generate an image for this post (e.g., for Midjourney or DALL-E). Describe the visual style, subject, lighting, and mood.
        
        {JSON_ONLY_INSTRUCTION}"""
        
        res = openai_client.chat.completions.create(
            model="gpt-4o", # Using stronger model for creative copy
            messages=[{"role": "user", "content": prompt}]
        )
        
        content_data = clean_and_parse_json(res.choices[0].message.content)
        caption = content_data.get('caption', 'Failed to generate caption.')
        image_prompt = content_data.get('image_prompt', '')
        
        # 2. Save to Database
        # Check if post content already exists to update instead of insert
        # (Simplified: just insert new record for now, or update if we had a post_id)
        
        post_data = {
            'post_id': f"organic_{entry['id']}_{int(datetime.now().timestamp())}", # synthetic ID
            'calendar_entry_id': entry['id'], # Link back to calendar
            'platform': platform,
            'topic': topic,
            'generated_caption': caption,
            'image_prompt': image_prompt,
            'status': 'draft',
            'created_at': datetime.now().isoformat()
        }
        
        # Use upsert or insert
        supabase.table('post_contents').insert(post_data).execute()
        
        # Update entry status to drafted
        supabase.table('calendar_entries').update({'status': 'drafted'}).eq('id', entry['id']).execute()
        
        # 3. Format Result for User
        state.result = f"""**{intent} Post Generated!** 

**Caption:**
{caption}

**Image Idea:**
> {image_prompt}

*(Saved to drafts)*"""

        # Add a "next step" suggestion
        state.next_step = "Would you like me to generate the image now or move to the next post?"
        
    except Exception as e:
        logger.error(f"Content gen error: {e}", exc_info=True)
        state.error = f"Failed to generate content: {str(e)}"
        
    return state 