from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import os
import google.generativeai as genai
import PyPDF2
from docx import Document
import io
import json
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/document-parser", tags=["document-parser"])

# Configuration
INDUSTRIES_LIST = [
    'Technology/IT', 'Retail/E-commerce', 'Education/eLearning', 'Healthcare/Wellness',
    'Fashion/Apparel', 'Food & Beverage', 'Travel & Hospitality', 'Finance/Fintech/Insurance',
    'Construction/Infrastructure', 'Automobile/Mobility', 'Media/Entertainment/Creators',
    'Real Estate', 'Logistics/Supply Chain', 'Manufacturing/Industrial', 'Professional Services',
    'Non-Profit/NGO/Social Enterprise', 'Others'
]

# Configure Gemini
api_key = os.getenv("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)

# --- MODELS ---

class ConfidenceScores(BaseModel):
    step_0: float = 0.0
    step_1: float = 0.0
    step_2: float = 0.0
    total_average: float = 0.0

class SmartFillResponse(BaseModel):
    step_0_basic_info: Dict[str, Any] = Field(default_factory=dict)
    step_1_target_audience: Dict[str, Any] = Field(default_factory=dict)
    step_2_branding: Dict[str, Any] = Field(default_factory=dict)
    step_3_current_presence: Dict[str, Any] = Field(default_factory=dict)
    step_4_goals_metrics: Dict[str, Any] = Field(default_factory=dict)
    step_5_budget_content: Dict[str, Any] = Field(default_factory=dict)
    step_6_market_competition: Dict[str, Any] = Field(default_factory=dict)
    step_7_strategy_timing: Dict[str, Any] = Field(default_factory=dict)
    step_8_performance_insights: Dict[str, Any] = Field(default_factory=dict)
    step_9_automation: Dict[str, Any] = Field(default_factory=dict)
    confidence_scores: ConfidenceScores
    deep_research_summary: str
    assumptions: List[str] = []

# --- UTILS ---

async def extract_text_from_file(file: UploadFile) -> str:
    content = await file.read()
    file_ext = file.filename.split('.')[-1].lower()
    text = ""
    try:
        if file_ext == 'pdf':
            pdf_reader = PyPDF2.PdfReader(io.BytesIO(content))
            text = "\n".join([page.extract_text() for page in pdf_reader.pages if page.extract_text()])
        elif file_ext in ['doc', 'docx']:
            doc = Document(io.BytesIO(content))
            text = "\n".join([para.text for para in doc.paragraphs])
        elif file_ext == 'txt':
            text = content.decode('utf-8')
        else:
            raise HTTPException(status_code=400, detail="Invalid format. Use PDF, DOCX, or TXT.")
    except Exception as e:
        logger.error(f"File Read Error: {e}")
        raise HTTPException(status_code=500, detail="Error processing document text.")
    return text

def clean_json_response(text: str) -> Dict:
    """Robustly extract JSON from LLM response"""
    try:
        # Remove markdown blocks
        clean_text = text.replace("```json", "").replace("```", "").strip()
        return json.loads(clean_text)
    except Exception as e:
        logger.error(f"JSON Parse Error: {e}")
        # Attempt to find the first '{' and last '}'
        start = text.find('{')
        end = text.rfind('}')
        if start != -1 and end != -1:
            return json.loads(text[start:end+1])
        raise ValueError("LLM did not return valid JSON.")

# --- ROUTES ---

@router.post("/parse-smart-fill", response_model=SmartFillResponse)
async def parse_document_for_smart_fill(
    file: UploadFile = File(...),
    business_type: str = Form("BUSINESS") # "BUSINESS" or "CREATOR"
):
    if not api_key:
        raise HTTPException(status_code=500, detail="Gemini API Key missing.")

    raw_text = await extract_text_from_file(file)
    context_text = raw_text[:30000] # Cap to save tokens

    prompt = f"""
    You are the ATSN "Atlas" Research Agent. Your goal is to analyze the provided document 
    and auto-fill an onboarding form for a {business_type}.

    ### 🧠 RULES
    - **STRICT JSON ONLY**.
    - **INDUSTRY MAPPING**: Map to exactly one: {json.dumps(INDUSTRIES_LIST)}.
    - **CONFIDENCE**: Use 0.0 to 1.0. If below 0.6, use null for that field.
    - **NO AI SLANG**: No "leverage", "comprehensive", or "innovative".
    
    ### 📦 REQUIRED STRUCTURE
    Return a JSON object with:
    - step_0 to step_9 (Matching the form schema)
    - confidence_scores
    - deep_research_summary (3 sentences max)
    - assumptions (List of logic used)

    ### 📄 DOCUMENT TEXT:
    {context_text}
    """

    try:
        # Use the latest flash model for speed and extraction quality
        model = genai.GenerativeModel('gemini-2.5-flash-lite')
        response = model.generate_content(prompt)
        
        extracted_data = clean_json_response(response.text)
        
        # Ensure model validation via Pydantic
        return SmartFillResponse(**extracted_data)

    except Exception as e:
        logger.error(f"Smart Fill Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Deep extraction failed: {str(e)}")