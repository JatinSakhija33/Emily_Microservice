"""
Calendar Router
Handles calendar-related API endpoints
"""

import os
import sys
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List
import logging

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from supabase import create_client, Client
from auth import get_current_user

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Supabase
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not supabase_url or not supabase_key:
    logger.error("Supabase credentials not found in environment variables")
else:
    logger.info(f"Initializing Supabase client with URL: {supabase_url}")

supabase_client: Client = create_client(supabase_url, supabase_key)

router = APIRouter(prefix="/calendars", tags=["calendars"])

# Pydantic models
class CalendarResponse(BaseModel):
    id: str
    user_id: str
    calendar_month: str  # Stored as DATE string in database
    calendar_year: int
    platform: Optional[str] = None
    campaign_name: Optional[str] = None
    campaign_description: Optional[str] = None
    campaign_goal: Optional[str] = None
    campaign_end_date: Optional[str] = None
    start_date: Optional[str] = None
    is_organic_campaign: Optional[bool] = False
    is_active: Optional[bool] = True
    created_at: Optional[str] = None

@router.get("/", response_model=List[CalendarResponse])
async def get_calendars(
    limit: int = Query(50, description="Maximum number of calendars to return"),
    offset: int = Query(0, description="Number of calendars to skip"),
    user=Depends(get_current_user)
):
    """
    Get all calendars for the authenticated user
    """
    try:
        if not user:
            raise HTTPException(status_code=401, detail="Authentication required")

        # Query calendars for the user
        logger.info(f"Fetching calendars for user {user.id}")
        response = supabase_client.table('social_media_calendars').select('*').eq('user_id', user.id).order('created_at', desc=True).range(offset, offset + limit - 1).execute()
        logger.info(f"Found {len(response.data) if response.data else 0} calendars")

        if not response.data:
            return []

        calendars = []
        for calendar in response.data:
            calendar_dict = {
                'id': calendar['id'],
                'user_id': calendar['user_id'],
                'calendar_month': calendar['calendar_month'],
                'calendar_year': calendar['calendar_year'],
                'platform': calendar.get('platform'),
                'frequency': calendar.get('frequency'),
                'business_context': calendar.get('business_context'),
                'total_entries': calendar.get('total_entries', 0),
                'campaign_name': calendar.get('campaign_name'),
                'campaign_description': calendar.get('campaign_description'),
                'campaign_goal': calendar.get('campaign_goal'),
                'campaign_end_date': calendar.get('campaign_end_date'),
                'start_date': calendar.get('start_date'),
                'is_organic_campaign': calendar.get('is_organic_campaign', False),
                'is_active': calendar.get('is_active', True),
                'created_at': calendar.get('created_at')
            }
            calendars.append(calendar_dict)

        logger.info(f"Retrieved {len(calendars)} calendars for user {user.id}")
        return calendars

    except Exception as e:
        logger.error(f"Error fetching calendars: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch calendars: {str(e)}")

@router.get("/{calendar_id}")
async def get_calendar_details(
    calendar_id: str,
    user=Depends(get_current_user)
):
    """
    Get detailed information about a specific calendar including its entries
    """
    try:
        if not user:
            raise HTTPException(status_code=401, detail="Authentication required")

        logger.info(f"Fetching calendar {calendar_id} for user {user.id}")

        # Get calendar info
        calendar_response = supabase_client.table('social_media_calendars').select('*').eq('id', calendar_id).eq('user_id', user.id).execute()

        if not calendar_response.data or len(calendar_response.data) == 0:
            logger.warning(f"Calendar {calendar_id} not found for user {user.id}")
            raise HTTPException(status_code=404, detail="Calendar not found")

        calendar = calendar_response.data[0]
        logger.info(f"Found calendar: {calendar}")

        # Get calendar entries
        try:
            entries_response = supabase_client.table('calendar_entries').select('*').eq('calendar_id', calendar_id).order('entry_date', desc=False).execute()
            logger.info(f"Fetched {len(entries_response.data) if entries_response.data else 0} entries")
        except Exception as entry_error:
            logger.error(f"Error fetching entries: {entry_error}")
            # Return calendar without entries if entries fetch fails
            entries_response = type('obj', (object,), {'data': []})()

        calendar_data = {
            'id': calendar['id'],
            'user_id': calendar['user_id'],
            'calendar_month': calendar['calendar_month'],
            'calendar_year': calendar['calendar_year'],
            'platform': calendar.get('platform'),
            'frequency': calendar.get('frequency'),
            'business_context': calendar.get('business_context'),
            'total_entries': calendar.get('total_entries', 0),
            'campaign_name': calendar.get('campaign_name'),
            'campaign_description': calendar.get('campaign_description'),
            'campaign_goal': calendar.get('campaign_goal'),
            'campaign_end_date': calendar.get('campaign_end_date'),
            'start_date': calendar.get('start_date'),
            'is_organic_campaign': calendar.get('is_organic_campaign', False),
            'is_active': calendar.get('is_active', True),
            'created_at': calendar.get('created_at'),
            'entries': entries_response.data if entries_response.data else []
        }

        logger.info(f"Retrieved calendar {calendar_id} with {len(calendar_data['entries'])} entries")
        return calendar_data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching calendar details: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch calendar details: {str(e)}")

@router.delete("/{calendar_id}")
async def delete_calendar(
    calendar_id: str,
    user=Depends(get_current_user)
):
    """
    Delete a calendar and all its entries
    """
    try:
        if not user:
            raise HTTPException(status_code=401, detail="Authentication required")

        # Verify calendar ownership
        calendar_response = supabase_client.table('social_media_calendars').select('id').eq('id', calendar_id).eq('user_id', user.id).execute()

        if not calendar_response.data or len(calendar_response.data) == 0:
            raise HTTPException(status_code=404, detail="Calendar not found or access denied")

        # Delete calendar entries first (due to foreign key constraint)
        supabase_client.table('calendar_entries').delete().eq('calendar_id', calendar_id).execute()

        # Delete the calendar
        supabase_client.table('social_media_calendars').delete().eq('id', calendar_id).execute()

        logger.info(f"Successfully deleted calendar {calendar_id} and all its entries")
        return {"message": "Calendar deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting calendar: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete calendar: {str(e)}")