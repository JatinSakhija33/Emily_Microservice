"""
Website Analysis API Router
Handles website analysis requests and results
"""

from fastapi import APIRouter, HTTPException, Depends, status, BackgroundTasks
from typing import List, Optional, Dict, Any
import os
import logging
from datetime import datetime, timedelta
from supabase import create_client
import asyncio
from pydantic import BaseModel, HttpUrl
import json

from auth import get_current_user, User
from agents.website_analyzer_agent import WebsiteAnalyzerAgent

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Supabase
supabase_url = os.getenv("SUPABASE_URL")
supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not supabase_url or not supabase_service_key:
    raise ValueError("Supabase configuration missing")

supabase_admin = create_client(supabase_url, supabase_service_key)

# Initialize router
router = APIRouter(prefix="/api/website-analysis", tags=["website-analysis"])

# Pydantic models
class WebsiteAnalysisRequest(BaseModel):
    url: HttpUrl
    force_refresh: bool = False

class WebsiteAnalysisResponse(BaseModel):
    id: str
    url: str
    analysis_date: datetime
    seo_score: int
    performance_score: int
    accessibility_score: int
    best_practices_score: int
    overall_score: int
    seo_analysis: Dict[str, Any]
    performance_analysis: Dict[str, Any]
    content_analysis: Dict[str, Any]
    technical_analysis: Dict[str, Any]
    recommendations: List[Dict[str, Any]]

class AnalysisSummaryResponse(BaseModel):
    total_analyses: int
    avg_seo_score: float
    avg_performance_score: float
    avg_accessibility_score: float
    avg_best_practices_score: float
    avg_overall_score: float
    latest_analysis_date: Optional[datetime]
    best_performing_url: Optional[str]
    worst_performing_url: Optional[str]

class AnalysisTrendResponse(BaseModel):
    analysis_date: datetime
    seo_score: int
    performance_score: int
    accessibility_score: int
    best_practices_score: int
    overall_score: int

class AnalysisSettingsRequest(BaseModel):
    auto_analyze: bool = False
    analysis_frequency: str = "weekly"
    notify_on_changes: bool = True
    notify_threshold: int = 10
    include_mobile_analysis: bool = True
    include_accessibility_analysis: bool = True
    include_content_analysis: bool = True

class AnalysisSettingsResponse(BaseModel):
    auto_analyze: bool
    analysis_frequency: str
    notify_on_changes: bool
    notify_threshold: int
    include_mobile_analysis: bool
    include_accessibility_analysis: bool
    include_content_analysis: bool


# Initialize website analyzer agent
analyzer_agent = WebsiteAnalyzerAgent()

@router.post("/analyze", response_model=WebsiteAnalysisResponse)
async def analyze_website(
    request: WebsiteAnalysisRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """Analyze a website and return comprehensive results"""
    try:
        logger.info(f"Starting website analysis for user {current_user.id}, URL: {request.url}")
        
        # Check if we have a recent analysis (unless force refresh)
        if not request.force_refresh:
            recent_analysis = await get_recent_analysis(str(request.url), current_user.id)
            if recent_analysis:
                logger.info("Returning recent analysis result")
                return recent_analysis
        
        # Perform analysis
        analysis_result = await analyzer_agent.analyze_website(str(request.url), current_user.id)
        
        # Save to database
        analysis_data = {
            "user_id": current_user.id,
            "url": str(request.url),
            "analysis_date": analysis_result.analysis_date.isoformat(),
            "seo_score": analysis_result.seo_score,
            "performance_score": analysis_result.performance_score,
            "accessibility_score": analysis_result.accessibility_score,
            "best_practices_score": analysis_result.best_practices_score,
            "seo_analysis": analysis_result.seo_analysis,
            "performance_analysis": analysis_result.performance_analysis,
            "content_analysis": analysis_result.content_analysis,
            "technical_analysis": analysis_result.technical_analysis,
            "recommendations": analysis_result.recommendations,
            "raw_data": analysis_result.raw_data
        }
        
        # Insert into database
        result = supabase_admin.table("website_analyses").insert(analysis_data).execute()
        
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save analysis results"
            )
        
        analysis_id = result.data[0]["id"]
        
        # Create history entry
        background_tasks.add_task(create_analysis_history, analysis_id, analysis_data)
        
        # Return response
        return WebsiteAnalysisResponse(
            id=analysis_id,
            url=str(request.url),
            analysis_date=analysis_result.analysis_date,
            seo_score=analysis_result.seo_score,
            performance_score=analysis_result.performance_score,
            accessibility_score=analysis_result.accessibility_score,
            best_practices_score=analysis_result.best_practices_score,
            overall_score=(analysis_result.seo_score + analysis_result.performance_score + 
                          analysis_result.accessibility_score + analysis_result.best_practices_score) // 4,
            seo_analysis=analysis_result.seo_analysis,
            performance_analysis=analysis_result.performance_analysis,
            content_analysis=analysis_result.content_analysis,
            technical_analysis=analysis_result.technical_analysis,
            recommendations=analysis_result.recommendations
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error analyzing website: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to analyze website"
        )

@router.get("/analyses", response_model=List[WebsiteAnalysisResponse])
async def get_user_analyses(
    limit: int = 10,
    offset: int = 0,
    current_user: User = Depends(get_current_user)
):
    """Get user's website analyses"""
    try:
        result = supabase_admin.table("website_analyses")\
            .select("*")\
            .eq("user_id", current_user.id)\
            .order("analysis_date", desc=True)\
            .range(offset, offset + limit - 1)\
            .execute()
        
        if not result.data:
            return []
        
        analyses = []
        for analysis in result.data:
            analyses.append(WebsiteAnalysisResponse(
                id=analysis["id"],
                url=analysis["url"],
                analysis_date=datetime.fromisoformat(analysis["analysis_date"].replace('Z', '+00:00')),
                seo_score=analysis["seo_score"],
                performance_score=analysis["performance_score"],
                accessibility_score=analysis["accessibility_score"],
                best_practices_score=analysis["best_practices_score"],
                overall_score=analysis["overall_score"],
                seo_analysis=analysis["seo_analysis"],
                performance_analysis=analysis["performance_analysis"],
                content_analysis=analysis["content_analysis"],
                technical_analysis=analysis["technical_analysis"],
                recommendations=analysis["recommendations"]
            ))
        
        return analyses
        
    except Exception as e:
        logger.error(f"Error fetching analyses: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch analyses"
        )

@router.get("/analyses/{analysis_id}", response_model=WebsiteAnalysisResponse)
async def get_analysis(
    analysis_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get specific analysis by ID"""
    try:
        result = supabase_admin.table("website_analyses")\
            .select("*")\
            .eq("id", analysis_id)\
            .eq("user_id", current_user.id)\
            .execute()
        
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Analysis not found"
            )
        
        analysis = result.data[0]
        return WebsiteAnalysisResponse(
            id=analysis["id"],
            url=analysis["url"],
            analysis_date=datetime.fromisoformat(analysis["analysis_date"].replace('Z', '+00:00')),
            seo_score=analysis["seo_score"],
            performance_score=analysis["performance_score"],
            accessibility_score=analysis["accessibility_score"],
            best_practices_score=analysis["best_practices_score"],
            overall_score=analysis["overall_score"],
            seo_analysis=analysis["seo_analysis"],
            performance_analysis=analysis["performance_analysis"],
            content_analysis=analysis["content_analysis"],
            technical_analysis=analysis["technical_analysis"],
            recommendations=analysis["recommendations"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching analysis: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch analysis"
        )

@router.get("/summary", response_model=AnalysisSummaryResponse)
async def get_analysis_summary(current_user: User = Depends(get_current_user)):
    """Get user's analysis summary statistics"""
    try:
        # Call the database function
        result = supabase_admin.rpc("get_user_analysis_summary", {"p_user_id": current_user.id}).execute()
        
        if not result.data:
            return AnalysisSummaryResponse(
                total_analyses=0,
                avg_seo_score=0.0,
                avg_performance_score=0.0,
                avg_accessibility_score=0.0,
                avg_best_practices_score=0.0,
                avg_overall_score=0.0,
                latest_analysis_date=None,
                best_performing_url=None,
                worst_performing_url=None
            )
        
        data = result.data[0]
        return AnalysisSummaryResponse(
            total_analyses=data["total_analyses"],
            avg_seo_score=float(data["avg_seo_score"]) if data["avg_seo_score"] else 0.0,
            avg_performance_score=float(data["avg_performance_score"]) if data["avg_performance_score"] else 0.0,
            avg_accessibility_score=float(data["avg_accessibility_score"]) if data["avg_accessibility_score"] else 0.0,
            avg_best_practices_score=float(data["avg_best_practices_score"]) if data["avg_best_practices_score"] else 0.0,
            avg_overall_score=float(data["avg_overall_score"]) if data["avg_overall_score"] else 0.0,
            latest_analysis_date=datetime.fromisoformat(data["latest_analysis_date"].replace('Z', '+00:00')) if data["latest_analysis_date"] else None,
            best_performing_url=data["best_performing_url"],
            worst_performing_url=data["worst_performing_url"]
        )
        
    except Exception as e:
        logger.error(f"Error fetching analysis summary: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch analysis summary"
        )

@router.get("/trends/{url:path}", response_model=List[AnalysisTrendResponse])
async def get_analysis_trends(
    url: str,
    days: int = 30,
    current_user: User = Depends(get_current_user)
):
    """Get analysis trends for a specific URL"""
    try:
        result = supabase_admin.rpc("get_url_analysis_trends", {
            "p_user_id": current_user.id,
            "p_url": url,
            "p_days": days
        }).execute()
        
        if not result.data:
            return []
        
        trends = []
        for trend in result.data:
            trends.append(AnalysisTrendResponse(
                analysis_date=datetime.fromisoformat(trend["analysis_date"].replace('Z', '+00:00')),
                seo_score=trend["seo_score"],
                performance_score=trend["performance_score"],
                accessibility_score=trend["accessibility_score"],
                best_practices_score=trend["best_practices_score"],
                overall_score=trend["overall_score"]
            ))
        
        return trends
        
    except Exception as e:
        logger.error(f"Error fetching analysis trends: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch analysis trends"
        )

@router.get("/settings", response_model=AnalysisSettingsResponse)
async def get_analysis_settings(current_user: User = Depends(get_current_user)):
    """Get user's analysis settings"""
    try:
        result = supabase_admin.table("website_analysis_settings")\
            .select("*")\
            .eq("user_id", current_user.id)\
            .execute()
        
        if not result.data:
            # Return default settings
            return AnalysisSettingsResponse(
                auto_analyze=False,
                analysis_frequency="weekly",
                notify_on_changes=True,
                notify_threshold=10,
                include_mobile_analysis=True,
                include_accessibility_analysis=True,
                include_content_analysis=True
            )
        
        settings = result.data[0]
        return AnalysisSettingsResponse(
            auto_analyze=settings["auto_analyze"],
            analysis_frequency=settings["analysis_frequency"],
            notify_on_changes=settings["notify_on_changes"],
            notify_threshold=settings["notify_threshold"],
            include_mobile_analysis=settings["include_mobile_analysis"],
            include_accessibility_analysis=settings["include_accessibility_analysis"],
            include_content_analysis=settings["include_content_analysis"]
        )
        
    except Exception as e:
        logger.error(f"Error fetching analysis settings: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch analysis settings"
        )

@router.put("/settings", response_model=AnalysisSettingsResponse)
async def update_analysis_settings(
    settings: AnalysisSettingsRequest,
    current_user: User = Depends(get_current_user)
):
    """Update user's analysis settings"""
    try:
        settings_data = {
            "auto_analyze": settings.auto_analyze,
            "analysis_frequency": settings.analysis_frequency,
            "notify_on_changes": settings.notify_on_changes,
            "notify_threshold": settings.notify_threshold,
            "include_mobile_analysis": settings.include_mobile_analysis,
            "include_accessibility_analysis": settings.include_accessibility_analysis,
            "include_content_analysis": settings.include_content_analysis,
            "updated_at": datetime.now().isoformat()
        }
        
        # Upsert settings
        result = supabase_admin.table("website_analysis_settings")\
            .upsert({
                "user_id": current_user.id,
                **settings_data
            })\
            .execute()
        
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update settings"
            )
        
        return AnalysisSettingsResponse(**settings_data)
        
    except Exception as e:
        logger.error(f"Error updating analysis settings: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update analysis settings"
        )

@router.delete("/analyses/{analysis_id}")
async def delete_analysis(
    analysis_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a specific analysis"""
    try:
        result = supabase_admin.table("website_analyses")\
            .delete()\
            .eq("id", analysis_id)\
            .eq("user_id", current_user.id)\
            .execute()
        
        if not result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Analysis not found"
            )
        
        return {"message": "Analysis deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting analysis: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete analysis"
        )

# Helper functions
async def get_recent_analysis(url: str, current_user_id: str) -> Optional[WebsiteAnalysisResponse]:
    """Get recent analysis if available (within 24 hours)"""
    try:
        cutoff_time = datetime.now() - timedelta(hours=24)
        
        result = supabase_admin.table("website_analyses")\
            .select("*")\
            .eq("user_id", current_user_id)\
            .eq("url", url)\
            .gte("analysis_date", cutoff_time.isoformat())\
            .order("analysis_date", desc=True)\
            .limit(1)\
            .execute()
        
        if not result.data:
            return None
        
        analysis = result.data[0]
        return WebsiteAnalysisResponse(
            id=analysis["id"],
            url=analysis["url"],
            analysis_date=datetime.fromisoformat(analysis["analysis_date"].replace('Z', '+00:00')),
            seo_score=analysis["seo_score"],
            performance_score=analysis["performance_score"],
            accessibility_score=analysis["accessibility_score"],
            best_practices_score=analysis["best_practices_score"],
            overall_score=analysis["overall_score"],
            seo_analysis=analysis["seo_analysis"],
            performance_analysis=analysis["performance_analysis"],
            content_analysis=analysis["content_analysis"],
            technical_analysis=analysis["technical_analysis"],
            recommendations=analysis["recommendations"]
        )
        
    except Exception as e:
        logger.error(f"Error fetching recent analysis: {str(e)}")
        return None

async def create_analysis_history(analysis_id: str, analysis_data: Dict[str, Any]):
    """Create analysis history entry"""
    try:
        history_data = {
            "analysis_id": analysis_id,
            "url": analysis_data["url"],
            "analysis_date": analysis_data["analysis_date"],
            "seo_score_change": 0,  # Will be calculated in future iterations
            "performance_score_change": 0,
            "accessibility_score_change": 0,
            "best_practices_score_change": 0,
            "overall_score_change": 0,
            "page_load_time": analysis_data.get("performance_analysis", {}).get("core_web_vitals", {}).get("lcp", {}).get("value"),
            "word_count": analysis_data.get("content_analysis", {}).get("word_count"),
            "image_count": analysis_data.get("seo_analysis", {}).get("images", {}).get("total"),
            "internal_links_count": analysis_data.get("seo_analysis", {}).get("links", {}).get("internal"),
            "external_links_count": analysis_data.get("seo_analysis", {}).get("links", {}).get("external")
        }
        
        supabase_admin.table("website_analysis_history").insert(history_data).execute()
        
    except Exception as e:
        logger.error(f"Error creating analysis history: {str(e)}")

@router.get("/profiles/{user_id}")
async def get_user_profile(user_id: str, current_user: User = Depends(get_current_user)):
    """Get user profile for website analysis"""
    try:
        logger.info(f"Getting profile for user {user_id}")
        
        result = supabase_admin.table('profiles').select('*').eq('id', user_id).execute()
        
        if result.data:
            return result.data[0]
        else:
            raise HTTPException(status_code=404, detail="Profile not found")
            
    except Exception as e:
        logger.error(f"Error getting profile: {e}")
        raise HTTPException(status_code=500, detail=str(e))
