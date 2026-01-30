import os
from openai import OpenAI
from db import supabase

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# --------------------------------------------------
# Prompt template (STRICT + BRIEF)
# --------------------------------------------------
USER_CONTEXT_PROMPT = """
You are generating a compact business context for an AI system.

Rules:
- Keep it brief (4–6 lines max)
- Include all necessary business info
- No marketing fluff, no adjectives, no assumptions
- Write in plain, factual language

Business Data:
Business Type: {business_type}
Industry: {industry}
Description: {business_description}
Unique Value Proposition: {unique_value_proposition}
Products / Services: {products_or_services}

Write the user context:
"""

# --------------------------------------------------
# Fetch profiles with missing RL context
# --------------------------------------------------
def fetch_profiles():
    res = (
        supabase
        .table("profiles")
        .select(
            "id, business_type, industry, business_description, "
            "unique_value_proposition, products_or_services"
        )
        .eq("onboarding_completed", True)   # ✅ onboarding gate
        .is_("user_context_rl", None)       # ✅ only missing RL context
        .execute()
    )
    return res.data or []

# --------------------------------------------------
# Generate user context using GPT-4o-mini
# --------------------------------------------------
def generate_user_context(profile):
    prompt = USER_CONTEXT_PROMPT.format(
        business_type=profile.get("business_type", ""),
        industry=profile.get("industry", ""),
        business_description=profile.get("business_description", ""),
        unique_value_proposition=profile.get("unique_value_proposition", ""),
        products_or_services=profile.get("products_or_services", ""),
    )

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You generate concise structured business context."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.2,
    )

    return response.choices[0].message.content.strip()

# --------------------------------------------------
# Generate embedding
# --------------------------------------------------
def generate_embedding(text):
    emb = client.embeddings.create(
        model="text-embedding-3-small",
        input=text
    )
    return emb.data[0].embedding

# --------------------------------------------------
# Store context + embedding
# --------------------------------------------------
def update_profile(profile_id, context, embedding):
    supabase.table("profiles").update(
        {
            "user_context_rl": context,
            "user_context_embedding": embedding,
        }
    ).eq("id", profile_id).execute()

# --------------------------------------------------
# Main runner
# --------------------------------------------------
def run():
    profiles = fetch_profiles()
    print(f"Found {len(profiles)} profiles to process")

    for p in profiles:
        try:
            context = generate_user_context(p)
            embedding = generate_embedding(context)
            update_profile(p["id"], context, embedding)

            print(f"✅ Updated profile {p['id']}")
        except Exception as e:
            print(f"❌ Failed for profile {p['id']}: {e}")

if __name__ == "__main__":
    run()
