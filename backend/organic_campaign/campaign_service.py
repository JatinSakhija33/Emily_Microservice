# campaign_service.py
import os
import logging
import json
import re
import asyncio
import random
from typing import Dict, Any, List, Tuple
from datetime import datetime, timedelta, date

import openai
from supabase import create_client
from dotenv import load_dotenv
from pathlib import Path

# Load environment
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Clients
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(supabase_url, supabase_key) if supabase_url and supabase_key else None

openai_api_key = os.getenv("OPENAI_API_KEY")
openai_client = openai.OpenAI(api_key=openai_api_key) if openai_api_key else None

# Constants
JSON_ONLY_INSTRUCTION = """
CRITICAL: Respond with ONLY valid JSON.
No markdown. No comments. No extra text.
"""


# --- 1) Utility Helpers ---

def clean_and_parse_json(content: str) -> Any:
    """Robustly extracts JSON even if the LLM includes markdown or extra text."""
    try:
        content = re.sub(r"```json\s*|```", "", content).strip()

        # Try direct parse first
        try:
            return json.loads(content)
        except Exception:
            pass

        # Fallback: grab first JSON object/array inside the string
        match = re.search(r"(\{.*\}|\[.*\])", content, re.DOTALL)
        if match:
            return json.loads(match.group(1))

        return {}
    except Exception as e:
        logger.error(f"JSON Parse Error: {e}")
        return {}


def get_user_business_context(user_id: str) -> Dict:
    if not user_id or not supabase:
        return {}

    try:
        profile = supabase.table("profiles").select("*").eq("id", user_id).execute()
        if not profile.data:
            return {}

        p = profile.data[0]
        base_context = p.get("business_context", {})

        if isinstance(base_context, str):
            try:
                base_context = json.loads(base_context)
            except Exception:
                base_context = {}

        return {
            **base_context,
            "name": p.get("business_name"),
            "industry": p.get("industry", "General Business"),
            "audience": p.get("target_audience", "General Audience"),
        }

    except Exception as e:
        logger.error(f"Context fetch error: {e}")
        return {}


# --- 2) Agentic Payload Helpers (Restored + Compatible) ---

def construct_create_organic_campaign_payload(state) -> Any:
    """
    Extract organic campaign details + description from user query
    Works with your existing _extract_payload flow.
    """
    from ..agents.atsn import _extract_payload

    prompt = f"""You are extracting information to create a 'Smart Organic Campaign'.

Extract:
1. campaign_goal: "brand_awareness", "leads", "sales", "community"
2. duration_days: integer (default 60 if unsure)
3. platform: "instagram", "facebook", "linkedin", "youtube"
4. frequency: "high" (5-6), "medium" (3-4), "low" (1-2)
5. campaign_description: A clear summary of the campaign's theme and purpose.
6. end_date: ISO format string "YYYY-MM-DD" (if mentioned by user)
7. confirm_generation: "yes" | "no"

User Query: {state.user_query}

Return JSON only:
{{
  "campaign_goal": "brand_awareness",
  "duration_days": 60,
  "end_date": "2024-12-31",
  "platform": "instagram",
  "frequency": "medium",
  "campaign_description": "...",
  "confirm_generation": "yes"
}}
{JSON_ONLY_INSTRUCTION}"""

    return _extract_payload(state, prompt)


def complete_create_organic_campaign_payload(state) -> Any:
    payload = getattr(state, "payload", {}) or {}

    required = ["campaign_goal", "platform", "frequency", "confirm_generation", "campaign_description"]
    missing = [f for f in required if not payload.get(f)]

    if missing:
        state.clarification_question = f"Please provide: {', '.join(missing)}"
        state.waiting_for_user = True
        return state

    state.payload_complete = True
    return state


# --- 3) AI Planning Helpers ---

def select_stage_for_day(goals: List[str], context: Dict) -> str:
    """
    Multi-goal funnel staging:
    blends weights from multiple goals for better campaign balance.
    """
    goal_weights = {
        "brand_awareness": {"T": 0.70, "M": 0.20, "B": 0.10},
        "leads":           {"T": 0.30, "M": 0.40, "B": 0.30},
        "sales":           {"T": 0.15, "M": 0.35, "B": 0.50},
        "community":       {"T": 0.40, "M": 0.20, "B": 0.40},
    }

    if isinstance(goals, str):
        goals = [goals]

    t_sum = m_sum = b_sum = 0.0
    count = 0

    for g in goals:
        w = goal_weights.get(str(g).lower())
        if w:
            t_sum += w["T"]
            m_sum += w["M"]
            b_sum += w["B"]
            count += 1

    if count == 0:
        avg_t, avg_m, avg_b = 0.33, 0.34, 0.33
    else:
        avg_t, avg_m, avg_b = t_sum / count, m_sum / count, b_sum / count

    r = random.random()
    if r < avg_t:
        return random.choice(["hook", "pain", "reframe"])
    elif r < (avg_t + avg_m):
        return random.choice(["mechanism", "proof"])
    return random.choice(["objection", "cta", "retention"])


def generate_smart_rhythm(frequency: str, platform: str, context: Dict) -> List[int]:
    """AI determines optimal posting days for the platform/frequency."""
    if not openai_client:
        # fallback rhythm
        if frequency == "high":
            return [0, 1, 2, 3, 4]
        if frequency == "low":
            return [0, 3]
        return [0, 2, 4]

    try:
        prompt = f"""
Suggest optimal posting days (0=Mon, 6=Sun) for a {frequency} campaign on {platform}.
Industry: {context.get("industry", "business")}
Return ONLY a JSON list of integers. Example: [0,2,4]
{JSON_ONLY_INSTRUCTION}
""".strip()

        res = openai_client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=80,
            temperature=0.3,
        )

        parsed = clean_and_parse_json(res.choices[0].message.content)
        if isinstance(parsed, list) and all(isinstance(x, int) for x in parsed):
            return parsed

    except Exception as e:
        logger.error(f"Smart rhythm error: {e}")

    # fallback
    if frequency == "high":
        return [0, 1, 2, 3, 4]
    if frequency == "low":
        return [0, 3]
    return [0, 2, 4]


def generate_weekly_themes(num: int, goals_str: str, context: Dict) -> List[str]:
    """Generate sequential weekly themes grounded in goals."""
    if not openai_client:
        return [f"Focus: {goals_str}" for _ in range(num)]

    try:
        prompt = f"""
Generate {num} sequential weekly themes (max 10 words each)
for a campaign focusing on: {goals_str}
Industry: {context.get("industry", "General")}
Return ONLY a JSON array of strings.
{JSON_ONLY_INSTRUCTION}
""".strip()

        res = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=400,
            temperature=0.6,
        )

        parsed = clean_and_parse_json(res.choices[0].message.content)
        if isinstance(parsed, list) and all(isinstance(x, str) for x in parsed):
            return parsed

    except Exception as e:
        logger.error(f"Weekly themes error: {e}")

    return [f"Week {i+1}" for i in range(num)]


async def generate_weekly_content_batch(
    tasks: List[Dict], theme: str, context: Dict, description: str
) -> Dict[str, Dict]:
    """
    Generates unique content for each task.
    Key includes date => avoids overwriting when multiple posts share same stage.
    """
    if not openai_client:
        return {}

    request_list = [
        f"- Key: {t['platform']}_{t['stage']}_{t['date'].isoformat()} | Stage: {t['stage']}"
        for t in tasks
    ]

    prompt = f"""
Theme: {theme}
Description: {description}
Business: {context.get("name")} ({context.get("industry")})

Requests:
{chr(10).join(request_list)}

Return JSON object where keys match 'Key'.
Each value MUST include: topic, format, hook, caption, cta, assets_needed.
{JSON_ONLY_INSTRUCTION}
""".strip()

    try:
        res = openai_client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1400,
            temperature=0.7,
        )
        parsed = clean_and_parse_json(res.choices[0].message.content)
        return parsed if isinstance(parsed, dict) else {}

    except Exception as e:
        logger.error(f"Batch generation error: {e}")
        return {}


# --- 4) Database Orchestration ---

def resolve_or_create_calendar(
    user_id, platform, date_obj, name, goal, freq, context, end_date=None, description=""
) -> Tuple[str, bool]:
    """Finds or creates monthly campaign header. Returns (calendar_id, was_created_new)."""
    if not supabase:
        return None, False

    try:
        month_str = date_obj.strftime("%Y-%m-01")

        existing = (
            supabase.table("social_media_calendars")
            .select("id")
            .eq("user_id", user_id)
            .eq("platform", platform.lower())
            .filter("calendar_month", "gte", month_str)
            .filter("calendar_month", "lt", (date_obj + timedelta(days=32)).strftime("%Y-%m-01"))
            .execute()
        )

        packet = {
            "campaign_name": name,
            "campaign_goal": goal,
            "campaign_description": description,
            "frequency": freq,
            "business_context": context,
            "status": "active",
            "is_organic_campaign": True,
        }

        if end_date:
            packet["campaign_end_date"] = end_date.isoformat()

        if existing.data:
            cal_id = existing.data[0]["id"]
            supabase.table("social_media_calendars").update(packet).eq("id", cal_id).execute()
            return cal_id, False

        new_cal = {
            "user_id": user_id,
            "platform": platform.lower(),
            "calendar_month": month_str,
            "calendar_year": date_obj.year,
            "start_date": date_obj.isoformat(),
            **packet,
        }

        res = supabase.table("social_media_calendars").insert(new_cal).execute()
        return (res.data[0]["id"], True) if res.data else (None, False)

    except Exception as e:
        logger.error(f"Resolver failed: {e}")
        return None, False


# --- 5) Core Master Function ---

async def create_organic_campaign_manual(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Full workflow:
    Plan -> Batch AI -> DB insert (safe)
    """
    user_id = payload.get("user_id")
    if not user_id:
        return {"error": "Missing user_id", "post_count": 0}

    goals = payload.get("goals") or [payload.get("goal") or payload.get("campaign_goal") or "brand_awareness"]
    if isinstance(goals, str):
        goals = [goals]

    name = payload.get("name", "Smart Campaign")
    description = payload.get("description") or payload.get("campaign_description", "")

    platforms = payload.get("platforms") or ([payload.get("platform")] if payload.get("platform") else [])
    if not platforms:
        return {"error": "No platforms provided.", "post_count": 0}

    # Safe extraction for duration and end_date
    start_date_str = payload.get("start_date") or date.today().isoformat()
    try:
        start_date = datetime.strptime(start_date_str, "%Y-%m-%d").date()
    except Exception:
        start_date = date.today()

    # Priorities: 1. end_date, 2. duration_days, 3. duration, 4. days
    end_date_val = payload.get("end_date")
    duration = 30 # Default

    if end_date_val:
        try:
            end_date = datetime.strptime(end_date_val, "%Y-%m-%d").date()
            duration = (end_date - start_date).days
        except Exception:
            end_date = None

    if not end_date_val or not end_date:
        duration = int(payload.get("duration_days") or payload.get("duration") or payload.get("days") or 30)
        end_date = start_date + timedelta(days=duration)

    frequency = payload.get("frequency", "medium")

    biz_ctx = get_user_business_context(user_id)
    biz_ctx["current_campaign"] = {"name": name, "goals": goals, "description": description}

    calendar_map: Dict[str, str] = {}
    newly_created_ids: List[str] = []

    for plat in platforms:
        cal_id, created = resolve_or_create_calendar(
            user_id=user_id,
            platform=plat,
            date_obj=start_date,
            name=name,
            goal=goals[0],
            freq=frequency,
            context=biz_ctx,
            end_date=end_date,
            description=description,
        )

        if cal_id:
            calendar_map[plat] = cal_id
            if created:
                newly_created_ids.append(cal_id)

    if not calendar_map:
        return {"error": "Failed to initialize headers.", "post_count": 0}

    # Strategy & planning
    schedule_days = generate_smart_rhythm(frequency, platforms[0], biz_ctx)
    themes = generate_weekly_themes(int(duration // 7) + 2, ", ".join(goals), biz_ctx)

    entries_to_insert: List[Dict] = []
    weekly_batches: Dict[int, List[Dict]] = {}

    current = start_date
    while current <= end_date:
        if current.weekday() in schedule_days:
            stage = select_stage_for_day(goals, biz_ctx)
            week_idx = (current - start_date).days // 7
            theme = themes[min(week_idx, len(themes) - 1)]

            for plat in platforms:
                if plat not in calendar_map:
                    continue
                weekly_batches.setdefault(week_idx, []).append(
                    {
                        "date": current,
                        "stage": stage,
                        "theme": theme,
                        "platform": plat,
                        "calendar_id": calendar_map[plat],
                    }
                )
        current += timedelta(days=1)

    # Batch AI generation per week
    for week_idx, tasks in weekly_batches.items():
        if not tasks:
            continue

        week_theme = tasks[0]["theme"]
        content_map = await generate_weekly_content_batch(tasks, week_theme, biz_ctx, description)

        for task in tasks:
            key = f"{task['platform']}_{task['stage']}_{task['date'].isoformat()}"
            data = content_map.get(key, {})

            if not isinstance(data, dict) or not data:
                continue

            entries_to_insert.append(
                {
                    "calendar_id": task["calendar_id"],
                    "user_id": user_id,
                    "entry_date": task["date"].isoformat(),
                    "platform": task["platform"],
                    "content_type": str(data.get("format", "static")).lower(),
                    "topic": data.get("topic", "Post"),
                    "campaign_phase": task["stage"],
                    "intent_type": task["stage"],
                    "weekly_theme": task["theme"],
                    "content_theme": task["theme"],
                    "status": "planned",
                    "metadata": data,
                }
            )

    # Fail-safe cleanup only if newly created headers and no entries
    if not entries_to_insert:
        for cid in newly_created_ids:
            supabase.table("social_media_calendars").delete().eq("id", cid).execute()
        return {"error": "AI generation failed.", "post_count": 0}

    # Insert in chunks
    chunk_size = 50
    for i in range(0, len(entries_to_insert), chunk_size):
        supabase.table("calendar_entries").insert(entries_to_insert[i : i + chunk_size]).execute()

    return {
        "message": f"Success! {len(entries_to_insert)} posts added.",
        "post_count": len(entries_to_insert),
        "weekly_themes": themes,
        "calendar_id": list(calendar_map.values())[0],
    }


# --- 6) State Machine Handler (Async-Safe) ---

async def handle_create_organic_campaign(state) -> Any:
    """Async handler (no asyncio.run) to prevent event loop crashes."""
    payload = getattr(state, "payload", {}) or {}

    if payload.get("confirm_generation") != "yes":
        state.result = "Campaign generation cancelled."
        return state

    try:
        goals = payload.get("campaign_goals") or [payload.get("campaign_goal", "brand_awareness")]
        if isinstance(goals, str):
            goals = [goals]

        platform = payload.get("platform")

        # Use a safe default and support multiple keys
        duration_val = payload.get('duration_days') or payload.get('duration') or payload.get('days') or 60
        end_date_val = payload.get('end_date')

        result = await create_organic_campaign_manual(
            {
                "user_id": getattr(state, "user_id", None),
                "goals": goals,
                "duration_days": int(duration_val),
                "end_date": end_date_val,
                "platform": platform,
                "platforms": [platform] if platform else [],
                "frequency": payload.get("frequency", "medium"),
                "description": payload.get("campaign_description", ""),
                "start_date": date.today().isoformat(),
                "name": payload.get("campaign_name") or f"{goals[0].capitalize()} Campaign",
            }
        )


        if result.get("error"):
            state.error = result["error"]
        else:
            state.result = (
                f"**Campaign Ready!** {result.get('post_count', 0)} posts created using "
                f"{len(result.get('weekly_themes', []))} weekly themes."
            )
            state.calendar_id = result.get("calendar_id")

    except Exception as e:
        logger.error(f"Handler Failure: {e}", exc_info=True)
        state.error = str(e)

    return state


# --- 7) Summary Helper ---

def format_campaign_summary(goal, duration, posts, themes):
    return f"**Smart Campaign Ready!** 🧠\nGoal: {goal} | Duration: {duration} days | Total Posts: {posts}"
