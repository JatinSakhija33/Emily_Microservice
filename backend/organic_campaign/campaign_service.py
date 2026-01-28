# campaign_service.py
import os
import logging
import json
import re
import asyncio
import random
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta, date
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
# Constants
JSON_ONLY_INSTRUCTION = """
CRITICAL: You MUST respond with ONLY a valid JSON object. Do NOT include any explanatory text.
Your response must start with { or [ and end with } or ]."""

CAMPAIGN_STAGES = [
    "hook", "pain", "reframe", "mechanism", "proof", "objection", "cta", "retention"
]

# --- Utility Helpers ---

def clean_and_parse_json(content: str) -> Any:
    """Robustly parse JSON even if LLM wraps it in Markdown blocks."""
    try:
        # Remove markdown code blocks if present
        content = re.sub(r'```json\s*', '', content)
        content = re.sub(r'```', '', content)
        content = content.strip()
        return json.loads(content)
    except json.JSONDecodeError as e:
        logger.error(f"JSON Parse Error: {e} | Content: {content}")
        return [] if '[' in content else {}

def get_user_business_context(user_id: str) -> Dict:
    """Centralized context fetching to ensure consistency."""
    if not user_id or not supabase:
        return {}
    
    try:
        profile = supabase.table("profiles").select("*").eq("id", user_id).execute()
        if not profile.data:
            return {}
        
        p = profile.data[0]
        # Handle case where business_context is stored as stringified JSON
        base_context = p.get('business_context', {})
        if isinstance(base_context, str):
            try: base_context = json.loads(base_context)
            except: base_context = {}
            
        return {
            **base_context,
            "name": p.get('business_name'),
            "industry": p.get('industry', 'General Business'),
            "audience": p.get('target_audience', 'General Audience')
        }
    except Exception as e:
        logger.error(f"Context fetch error: {e}")
        return {}

# --- Campaign Logic ---

def construct_create_organic_campaign_payload(state) -> Any:
    """Extract organic campaign details from user query"""
    # Import locally to avoid circular imports
    from ..agents.atsn import _extract_payload
    
    prompt = f"""You are extracting information to create a 'Smart Organic Campaign'.
    
    Extract:
    1. campaign_goal: "brand_awareness", "leads", "sales", "community"
    2. duration_days: integer (default 60 if unsure)
    3. platform: "instagram", "facebook", "linkedin", "youtube"
    4. frequency: "high" (5-6), "medium" (3-4), "low" (1-2)
    5. confirm_generation: "yes" | "no"
    
    User Query: {state.user_query}
    
    Return JSON only:
    {{
        "campaign_goal": "...",
        "duration_days": 60,
        "platform": "...",
        "frequency": "...",
        "confirm_generation": "..."
    }}
    {JSON_ONLY_INSTRUCTION}"""
    
    return _extract_payload(state, prompt)

def complete_create_organic_campaign_payload(state) -> Any:
    """Ensure all fields are present"""
    payload = state.payload
    required = ["campaign_goal", "platform", "frequency", "confirm_generation"]
    
    missing = [f for f in required if not payload.get(f)]
    
    if missing:
        state.clarification_question = f"Please provide: {', '.join(missing)}"
        state.waiting_for_user = True
        return state
        
    state.payload_complete = True
    return state

def handle_create_organic_campaign(state) -> Any:
    """Execute Smart Campaign Generation (State Machine Entry)"""
    payload = state.payload
    if payload.get('confirm_generation') != 'yes':
        state.result = "Campaign generation cancelled."
        return state

    try:
        # Map state payload to manual function args
        result = asyncio.run(create_organic_campaign_manual({
            "user_id": getattr(state, 'user_id', None),
            "goal": payload.get('campaign_goal'),
            "duration_days": int(payload.get('duration_days', 60)),
            "platforms": [payload.get('platform')],
            "frequency": payload.get('frequency'),
            "start_date": date.today().isoformat()
        }))
        
        state.result = format_campaign_summary(
            payload.get('campaign_goal'), 
            payload.get('duration_days'), 
            result['post_count'], 
            result['weekly_themes']
        )
        state.calendar_id = result['calendar_id']

    except Exception as e:
        logger.error(f"Campaign gen error: {e}", exc_info=True)
        state.error = f"Failed: {str(e)}"
        
    return state

async def create_organic_campaign_manual(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handle manual creation of organic campaign with RICH STAGE-BASED CONTENT.
    APPEND MODE: Always appends (no overwrite).
    """
    user_id = payload.get('user_id')
    name = payload.get('name', 'Smart Campaign')
    goal = payload.get('goal')
    
    # Date Handling
    start_date = datetime.strptime(payload.get('start_date'), '%Y-%m-%d').date()
    if payload.get('end_date'):
        end_date = datetime.strptime(payload.get('end_date'), '%Y-%m-%d').date()
        duration = (end_date - start_date).days
    else:
        duration = int(payload.get('duration_days', 30))
        end_date = start_date + timedelta(days=duration)
        
    platforms = payload.get('platforms', [])
    frequency = payload.get('frequency', 'medium')
    
    # 1. Get Business Context
    business_context = get_user_business_context(user_id)
    business_context['current_campaign'] = {
        "name": name,
        "goal": goal,
        "frequency": frequency
    }

    # 2. Plan Strategy
    primary_platform = platforms[0] if platforms else "LinkedIn"
    schedule_days = generate_smart_rhythm(frequency, primary_platform, business_context)
    
    num_weeks = (duration // 7) + 2
    weekly_themes = generate_weekly_themes(num_weeks, goal, business_context)
    
    # 3. Execution Setup
    entries_to_insert = []
    current = start_date
    calendar_map = {} # Cache (platform, YYYY-MM) -> calendar_id
    
    # Pre-calculate the schedule to batch AI generation
    weekly_batches = {} # { week_index: [ {date, stage, platform}... ] }
    
    while current <= end_date:
        if current.weekday() in schedule_days:
            
            # Stage Logic - Cycle through stages or random mix
            stage = select_stage_for_day(goal, business_context)
            
            week_idx = (current - start_date).days // 7
            theme = weekly_themes[min(week_idx, len(weekly_themes)-1)]
            
            for plat in platforms:
                if week_idx not in weekly_batches:
                    weekly_batches[week_idx] = []
                
                weekly_batches[week_idx].append({
                    "date": current,
                    "stage": stage,
                    "theme": theme,
                    "platform": plat,
                    "week_idx": week_idx
                })
                
        current += timedelta(days=1)

    # 4. Batch Generate Content (Performance Optimization)
    # Instead of generating 1 by 1, we generate per week
    for week_idx, tasks in weekly_batches.items():
        if not tasks: continue
        
        # Unique theme for this week
        theme = tasks[0]['theme']
        
        # Generate rich content for the whole week
        # Returns: {"Key": {topic, stage, ...}, ...}
        content_map = generate_weekly_content_batch(tasks, theme, business_context)
        
        # Process results
        for task in tasks:
            key = f"{task['platform']}_{task['stage']}"
            
            # content_data is the rich object
            content_data = content_map.get(key, {})
            # Fallback if generation failed
            if not content_data or isinstance(content_data, str):
                 content_data = {
                     "topic": f"{task['stage']} post about {theme}",
                     "stage": task['stage'],
                     "format": "static_post",
                     "hook": "Check this out!",
                     "caption": f"Here is a post about {theme}",
                     "cta": "Link in bio",
                     "assets_needed": ["Image"]
                 }

            # Resolve Calendar (Lazy Load)
            cal_month = task['date'].replace(day=1).isoformat()
            cal_key = (task['platform'], cal_month)
            
            if cal_key not in calendar_map:
                calendar_map[cal_key] = resolve_or_create_calendar(
                    user_id, task['platform'], task['date'], name, goal, frequency, business_context
                )
            
            cal_id = calendar_map.get(cal_key)
            if not cal_id: continue

            # Construct Metadata
            metadata = {
                "hook": content_data.get('hook'),
                "caption": content_data.get('caption'),
                "cta": content_data.get('cta'),
                "assets_needed": content_data.get('assets_needed'),
                "stage": content_data.get('stage', task['stage']),
                "format": content_data.get('format', 'static')
            }

            entries_to_insert.append({
                'calendar_id': cal_id,
                'user_id': user_id,
                'entry_date': task['date'].isoformat(),
                'platform': task['platform'],
                'content_type': content_data.get('format', 'static_post').lower(), # Map format to content_type
                'topic': content_data.get('topic', 'New Post'),
                'campaign_phase': task['stage'], # Storing stage in campaign_phase legacy column too
                'intent_type': task['stage'],    # Storing stage in intent_type legacy column too
                'weekly_theme': theme,
                'content_theme': theme,
                'status': 'planned',
                'metadata': metadata # Store rich data here
            })

    # 5. Bulk Insert - APPEND MODE (No collision check/deletion)
    if entries_to_insert:
        try:
            # Batch insert
            chunk_size = 50
            for i in range(0, len(entries_to_insert), chunk_size):
                supabase.table('calendar_entries').insert(entries_to_insert[i:i+chunk_size]).execute()
                
        except Exception as e:
            logger.error(f"Bulk insertion error: {e}")

    return {
        "message": f"Campaign generated. {len(entries_to_insert)} posts added.",
        "post_count": len(entries_to_insert),
        "weekly_themes": weekly_themes,
        "calendar_id": list(calendar_map.values())[0] if calendar_map else None
    }

def resolve_or_create_calendar(user_id, platform, date_obj, name, goal, freq, context):
    """Helper to find or create the parent calendar record"""
    try:
        cal_month = date_obj.replace(day=1).isoformat()
        
        # Check existing
        existing = supabase.table('social_media_calendars')\
            .select('id')\
            .eq('user_id', user_id)\
            .eq('calendar_month', cal_month)\
            .eq('platform', platform)\
            .execute()
        
        if existing.data:
            cal_id = existing.data[0]['id']
            # UPDATE: Ensure this calendar is marked as organic since we are using it for a campaign
            try:
                supabase.table('social_media_calendars')\
                    .update({'is_organic_campaign': True, 'status': 'active'})\
                    .eq('id', cal_id)\
                    .execute()
            except Exception as upd_err:
                logger.warning(f"Failed to update calendar {cal_id} flag: {upd_err}")
                
            return cal_id
            
        # Create new
        new_cal = {
            'user_id': user_id,
            'platform': platform,
            'calendar_month': cal_month,
            'calendar_year': date_obj.year,
            'is_organic_campaign': True, 
            'campaign_name': name,       
            'campaign_goal': goal,
            'start_date': date_obj.isoformat(),
            'frequency': freq,
            'business_context': context,
            'status': 'active'
        }
        res = supabase.table('social_media_calendars').insert(new_cal).execute()
        return res.data[0]['id'] if res.data else None
    except Exception as e:
        logger.error(f"Calendar resolution error: {e}")
        return None

# --- AI Helpers (Optimized) ---

def generate_smart_rhythm(frequency: str, platform: str, context: dict) -> List[int]:
    """AI determines optimal days"""
    try:
        prompt = f"""Suggest optimal posting days (0=Mon, 6=Sun) for a {frequency} campaign on {platform}.
        Industry: {context.get('industry', 'business')}.
        Return ONLY a JSON list of integers. Example: [0, 2, 4]"""
        
        response = openai_client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=50,
            temperature=0.3
        )
        return clean_and_parse_json(response.choices[0].message.content)
    except Exception:
        # Fallbacks
        if frequency == 'high': return [0, 1, 2, 3, 4] 
        if frequency == 'low': return [0, 3]
        return [0, 2, 4]

def generate_weekly_themes(num: int, goal: str, context: dict) -> List[str]:
    """Generate themes"""
    try:
        prompt = f"""Generate {num} sequential, short weekly themes (max 10 words) for a {goal} campaign.
        Industry: {context.get('industry')}.
        Return JSON array of strings."""
        
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini", # Use cost-effective models
            messages=[{"role": "user", "content": prompt}],
            max_tokens=400
        )
        return clean_and_parse_json(response.choices[0].message.content)
    except Exception:
        return [f"Focus on {goal}" for _ in range(num)]

def select_stage_for_day(goal: str, context: dict) -> str:
    """Randomly select a stage based on industry best practices"""
    # Simple probability distribution for now, can be smarter later
    # 30% Educate/Pain/Reframe (Top Funnel)
    # 40% Proof/Mechanism (Mid Funnel)
    # 30% CTA/Objection/Retention (Bottom Funnel)
    
    r = random.random()
    if r < 0.3:
        return random.choice(["hook", "pain", "reframe"])
    elif r < 0.7:
        return random.choice(["mechanism", "proof"])
    else:
        return random.choice(["objection", "cta", "retention"])

def generate_weekly_content_batch(tasks: List[Dict], theme: str, context: dict) -> Dict[str, Dict]:
    """
    Generates RICH CONTENT for an entire week of posts.
    Returns: {"Platform_Stage": {topic, stage, format, hook, caption, cta, assets_needed}, ...}
    """
    if not tasks: return {}
    
    request_list = []
    for t in tasks:
        # Use stage instead of intent
        key = f"{t['platform']}_{t['stage']}"
        request_list.append(f"- Key: {key} | Platform: {t['platform']} | Stage: {t['stage']}")
        
    tasks_str = "\n".join(request_list)
    
    prompt = f"""Generate social media content.
    Industry: {context.get('industry')}
    Weekly Theme: {theme}
    
    Requests:
    {tasks_str}
    
    Return a JSON object where keys match the 'Key' provided.
    Each value MUST be an object with:
    - topic: (string)
    - stage: (string) matches requested stage
    - format: (string) e.g. reel, carousel, static, story
    - hook: (string) initial hook text
    - caption: (string) post caption
    - cta: (string) call to action
    - assets_needed: (array of strings) e.g. ["photo of product", "video of founder"]

    {JSON_ONLY_INSTRUCTION}"""
    
    try:
        response = openai_client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1000 # Increased tokens for rich objects
        )
        return clean_and_parse_json(response.choices[0].message.content)
    except Exception as e:
        logger.error(f"Batch generation error: {e}")
        return {}

def format_campaign_summary(goal, duration, posts, themes):
    return f"""**Smart Campaign Ready!** 🧠
    
Goal: {goal} | Duration: {duration} days
Total Posts: {posts}

**Weekly Flow:**
1. {themes[0]}
2. {themes[1] if len(themes)>1 else '...'}
...
"""