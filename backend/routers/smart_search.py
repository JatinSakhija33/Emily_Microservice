from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
import os, json, logging, requests
import google.generativeai as genai
from prompts.smart_fill import SMART_FILL_SYSTEM_PROMPT

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/smart-search", tags=["Smart Search"])

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

class SearchRequest(BaseModel):
    query: Optional[str] = None # For backwards compatibility
    type: str = 'business'      # 'business' or 'creator'
    business_name: Optional[str] = None
    location: Optional[str] = None
    website_url: Optional[str] = None
    uploaded_text: Optional[str] = None
    google_place_id: Optional[str] = None

# ... (rest of file) ...




class SearchResponse(BaseModel):
    success: bool
    data: Dict[str, Any]
    message: Optional[str] = None

# Helper for Google Custom Search
def perform_google_custom_search(query: str, api_key: str, cx: str, num_results: int = 5) -> str:
    try:
        url = "https://www.googleapis.com/customsearch/v1"
        params = {
            'key': api_key,
            'cx': cx,
            'q': query,
            'num': num_results
        }
        res = requests.get(url, params=params, timeout=15)
        res.raise_for_status()
        data = res.json()
        
        items = data.get('items', [])
        if not items:
            return ""
            
        context_parts = []
        for item in items:
            title = item.get('title', 'No Title')
            link = item.get('link', 'No Link')
            snippet = item.get('snippet', 'No Snippet')
            context_parts.append(f"Title: {title}\nLink: {link}\nSnippet: {snippet}")
            
        return "\n\n".join(context_parts)
    except Exception as e:
        logger.error(f"Google Custom Search failed: {e}")
        return ""

# Helper for Google Knowledge Graph
def perform_knowledge_graph_search(query: str, api_key: str) -> str:
    try:
        url = "https://kgsearch.googleapis.com/v1/entities:search"
        params = {
            'query': query,
            'key': api_key,
            'limit': 1,
            'limit': 1,
            'indent': True,
        }
        res = requests.get(url, params=params, timeout=15)
        res.raise_for_status()
        data = res.json()
        
        item = data.get('itemListElement', [])[0].get('result', {}) if data.get('itemListElement') else {}
        if not item:
            return ""
            
        description = item.get('detailedDescription', {}).get('articleBody', 'No description')
        name = item.get('name', 'Unknown')
        types = ", ".join(item.get('@type', []))
        url = item.get('url', 'No URL')
        
        return f"KG ENTITY: {name} ({types})\nDescription: {description}\nURL: {url}"
    except Exception as e:
        logger.error(f"Knowledge Graph search failed: {e}")
        return ""

# Helper for Google Places API
def perform_places_search(query: str, api_key: str, place_id: str = None) -> tuple[str, str]:
    try:
        found_place_id = place_id
        
        # Step 1: Find Place ID (if not provided)
        if not found_place_id:
            search_url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
            search_params = {
                'query': query,
                'key': api_key
            }
            res = requests.get(search_url, params=search_params, timeout=15)
            res.raise_for_status()
            candidates = res.json().get('results', [])
            
            if not candidates:
                return "", ""
                
            found_place_id = candidates[0].get('place_id')
        
        # Step 2: Get Details
        details_url = "https://maps.googleapis.com/maps/api/place/details/json"
        details_params = {
            'place_id': found_place_id,
            'key': api_key,
            'fields': 'name,formatted_address,website,international_phone_number,rating,reviews,types,editorial_summary'
        }
        res = requests.get(details_url, params=details_params, timeout=15)
        res.raise_for_status()
        details = res.json().get('result', {})
        
        # Format reviews for tone analysis
        reviews = details.get('reviews', [])
        review_texts = [f"- {r.get('text')[:200]}..." for r in reviews[:3] if r.get('text')]
        review_summary = "\n".join(review_texts)
        
        website = details.get('website', '')
        
        return f"""Google Place: {details.get('name')}
Address: {details.get('formatted_address')}
Phone: {details.get('international_phone_number')}
Website: {website}
Rating: {details.get('rating')}
Types: {", ".join(details.get('types', []))}
Summary: {details.get('editorial_summary', {}).get('overview', 'No summary')}
Recent Reviews (for Tone):
{review_summary}
""", website
    except Exception as e:
        logger.error(f"Places API search failed: {e}")
        return "", ""

@router.get("/autocomplete", response_model=Dict[str, Any])
async def autocomplete_business(query: str):
    """
    Provides real-time business address autocomplete suggestions.
    """
    GOOGLE_PLACES_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY") or os.getenv("GOOGLE_SEARCH_API_KEY")
    
    if not GOOGLE_PLACES_API_KEY:
        raise HTTPException(500, "Google Places API Key not configured")
        
    if not query or len(query) < 3:
        return {"predictions": []}

    try:
        url = "https://maps.googleapis.com/maps/api/place/autocomplete/json"
        params = {
            'input': query,
            'key': GOOGLE_PLACES_API_KEY,
            'types': 'establishment|geocode', # Broaden search to businesses and addresses
        }
        res = requests.get(url, params=params, timeout=10)
        res.raise_for_status()
        data = res.json()
        
        predictions = []
        for p in data.get('predictions', [])[:5]:
            predictions.append({
                "description": p.get('description'),
                "place_id": p.get('place_id'),
                "main_text": p.get('structured_formatting', {}).get('main_text', ''),
                "secondary_text": p.get('structured_formatting', {}).get('secondary_text', '')
            })
            
        return {"predictions": predictions}
    except Exception as e:
        logger.error(f"Autocomplete failed: {e}")
        return {"predictions": []}


@router.post("/", response_model=SearchResponse)
async def perform_smart_search(request: SearchRequest):
    
    # Resolve business name from query if not provided explicitly
    business_name = request.business_name or request.query

    if not any([business_name, request.website_url, request.uploaded_text]):
        raise HTTPException(400, "At least one input (business_name, website_url, uploaded_text) is required")
        
    # Check for Google Credentials
    # Prefer specific keys, fall back to general key
    GOOGLE_SEARCH_API_KEY = os.getenv("GOOGLE_SEARCH_API_KEY") 
    GOOGLE_KG_API_KEY = os.getenv("GOOGLE_KNOWLEDGE_GRAPH_API_KEY") or GOOGLE_SEARCH_API_KEY
    GOOGLE_PLACES_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY") or GOOGLE_SEARCH_API_KEY
    GOOGLE_SEARCH_ENGINE_ID = os.getenv("GOOGLE_SEARCH_ENGINE_ID")
    
    context_parts = []
    discovered_website = ""
    
    # 1. Knowledge Graph
    if GOOGLE_KG_API_KEY:
        kg_data = perform_knowledge_graph_search(business_name, GOOGLE_KG_API_KEY)
        if kg_data:
            context_parts.append(f"--- KNOWLEDGE GRAPH ---\n{kg_data}")
            
    # 2. Places API (Location + Reviews + Website Discovery)
    if GOOGLE_PLACES_API_KEY:
        # Construct a location-aware query if no place_id
        place_query = f"{business_name} {request.location or ''}"
        places_data, found_website = perform_places_search(place_query, GOOGLE_PLACES_API_KEY, request.google_place_id)
        
        if places_data:
            context_parts.append(f"--- PLACES API ---\n{places_data}")
            if found_website and not request.website_url:
                discovered_website = found_website
                logger.info(f"Discovered Website from Places: {discovered_website}")
            
    # 3. Custom Search (Chain discovered website)
    if GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID:
        if GOOGLE_SEARCH_API_KEY: # Redundant check but keeps logic clear
            logger.info("Using Google APIs for Data Enrichment")
            
            cse_query = ""
            target_url = request.website_url or discovered_website
            
            # Smart Search Strategy to maximize coverage
            if target_url:
                # Hybrid: Search specific site pages AND broader reviews/profiles
                # standard "site:" is effective but can be too restrictive if site map is poor.
                cse_query = f'{business_name} {request.location or ""} (site:{target_url} OR "about us" OR "services" OR "reviews" OR "profile")'
            elif business_name:
                # Fallback: General broad search for key business pages
                cse_query = f'{business_name} {request.location or ""} {request.type} ("about" OR "services" OR "reviews")'
                
            if cse_query:
                cse_data = perform_google_custom_search(cse_query, GOOGLE_SEARCH_API_KEY, GOOGLE_SEARCH_ENGINE_ID)
                if cse_data:
                    context_parts.append(f"--- CUSTOM SEARCH ---\n{cse_data}")


    # If we gathered significant data, we might optionally disable Grounding to save tokens/latency, 
    # but keeping it enabled ensures the model can 'verify' or fill gaps. 
    # However, to prioritize "External Search Context" as requested, we feed this rich data in.
    
    consolidated_context = "\n\n".join(context_parts)

    # ---- BUILD RAW CONTEXT ----
    context = f"""
TARGET ENTITY TYPE: {request.type.upper()}

BUSINESS/CREATOR IDENTIFIERS
Name: {business_name or "Not provided"}
Location: {request.location or "Not provided"}
Website URL: {request.website_url or "Not provided"}

UPLOADED DOCUMENT CONTENT
{request.uploaded_text or "None"}

EXTERNAL ENRICHED DATA (High Priority)
{consolidated_context}

INSTRUCTIONS
- You are filling a {request.type.upper()} onboarding form.
- Use the "{request.type.upper()}" schema definition from the system prompt.
- Prioritize "EXTERNAL ENRICHED DATA" (Knowledge Graph, Places, Custom Search).
- If specific fields (like phone, address) appear in Places API data, use them verbatim.
- Derive "Brand Tone" from Reviews and Descriptions.
- If data is missing locally, rely on public web knowledge (Grounding).
- Be conservative. Do not invent facts.
"""

    # Initialize Gemini Model
    model = genai.GenerativeModel("gemini-2.5-flash-lite")
    
    # Configure tools for search grounding
    # Constructing Tool explicitly using the nested GoogleSearch message
    tools = [genai.protos.Tool(google_search=genai.protos.Tool.GoogleSearch())]

    response = model.generate_content(
        f"{SMART_FILL_SYSTEM_PROMPT}\n\n{context}",
        tools=tools,
        generation_config=genai.types.GenerationConfig(
            temperature=0.2, 
            max_output_tokens=4096,
            response_mime_type="application/json"
        )
    )

    try:
        parsed = json.loads(response.text)
        return SearchResponse(
            success=True,
            data=parsed,
            message="Smart Fill completed"
        )
    except Exception:
        logger.error("Invalid Gemini JSON output")
        logger.error(response.text)
        return SearchResponse(
            success=False,
            data={},
            message="AI output could not be parsed"
        )
