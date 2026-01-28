
# router.py
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, Dict, Any

from .campaign_service import (
    construct_create_organic_campaign_payload,
    complete_create_organic_campaign_payload, 
    handle_create_organic_campaign,
    create_organic_campaign_manual
)
from .content_service import (
    construct_create_organic_content_payload,
    complete_create_organic_content_payload,
    handle_create_organic_content
)

router = APIRouter(prefix="/organic-campaign", tags=["Organic Campaign"])

# Mock State object to reuse existing agent patterns
class MockState:
    def __init__(self, user_query: str, user_id: str = None, payload: dict = None):
        self.user_query = user_query
        self.user_id = user_id
        self.payload = payload or {}
        self.payload_complete = False
        self.clarification_question = None
        self.waiting_for_user = False
        self.result = None
        self.error = None

class CampaignRequest(BaseModel):
    user_query: str
    user_id: Optional[str] = None
    payload: Optional[Dict[str, Any]] = {}

class OrganicCampaignCreate(BaseModel):
    name: str
    goal: str
    platforms: list[str]
    start_date: str
    end_date: Optional[str] = None
    duration_days: Optional[int] = None
    frequency: str
    description: Optional[str] = ""
    user_id: Optional[str] = None

@router.post("/campaign")
async def create_campaign_endpoint(req: CampaignRequest):
    # Simulate Agent Flow strictly for this microservice
    state = MockState(req.user_query, req.user_id, req.payload)
    
    # Step 1: Construct
    if not state.payload:
        state = construct_create_organic_campaign_payload(state)
        
    # Step 2: Complete
    state = complete_create_organic_campaign_payload(state)
    
    if state.waiting_for_user:
        return {
            "status": "clarification_needed",
            "question": state.clarification_question,
            "payload": state.payload
        }
        
    # Step 3: Handle
    state = handle_create_organic_campaign(state)
    
    if state.error:
        raise HTTPException(status_code=500, detail=state.error)
        
    return {
        "status": "success",
        "result": state.result,
        "calendar_id": getattr(state, 'calendar_id', None)
    }

    return {
        "status": "success",
        "result": state.result,
        "calendar_id": getattr(state, 'calendar_id', None)
    }

@router.post("/create")
async def create_organic_campaign_manual_endpoint(payload: OrganicCampaignCreate):
    """
    Manual creation endpoint for the campaign wizard.
    Bypasses the agentic chat flow.
    """
    if not payload.user_id:
        # In a real app, we'd get this from the auth token dependency
        # For now, we assume it's passed or handled upstream
        raise HTTPException(status_code=400, detail="User ID required")
        
    try:
        result = await create_organic_campaign_manual(payload.dict())
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/content")
async def create_content_endpoint(req: CampaignRequest):
    state = MockState(req.user_query, req.user_id, req.payload)
    
    if not state.payload:
        state = construct_create_organic_content_payload(state)
        
    state = complete_create_organic_content_payload(state)
    
    if state.waiting_for_user:
        return {
            "status": "clarification_needed", 
            "question": state.clarification_question,
            "payload": state.payload
        }
        
    state = handle_create_organic_content(state)
    
    if state.error:
        raise HTTPException(status_code=500, detail=state.error)
        
    return {
        "status": "success",
        "result": state.result
    }
