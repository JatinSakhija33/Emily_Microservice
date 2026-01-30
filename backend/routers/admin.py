"""
Admin Router - Token Usage Tracking and Budget Analysis
Provides admin-only endpoints for monitoring token usage, costs, and budget analysis
"""

from fastapi import APIRouter, HTTPException, Depends, Query, Response
from fastapi.responses import StreamingResponse
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from pydantic import BaseModel
import os
import csv
import io
import json
from supabase import create_client, Client
from auth import get_admin_user, User
from services.pricing_service import PricingService
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
supabase: Client = create_client(supabase_url, supabase_key)

# Initialize pricing service
pricing_service = PricingService(supabase_url, supabase_key)

# Request/Response Models
class TokenUsageResponse(BaseModel):
    id: str
    user_id: str
    feature_type: str
    model_name: str
    input_tokens: int
    output_tokens: int
    total_tokens: int
    input_cost: float
    output_cost: float
    total_cost: float
    created_at: str
    request_metadata: Dict[str, Any]

class TokenUsageStatsResponse(BaseModel):
    total_cost: float
    total_input_cost: float
    total_output_cost: float
    total_tokens: int
    total_input_tokens: int
    total_output_tokens: int
    total_requests: int
    by_feature_type: Dict[str, Dict[str, Any]]
    by_model: Dict[str, Dict[str, Any]]
    by_user: List[Dict[str, Any]]
    by_conversation: Optional[Dict[str, Dict[str, Any]]] = None
    daily_cost_trend: List[Dict[str, Any]]

class BudgetAnalysisResponse(BaseModel):
    projected_monthly_cost: float
    cost_per_user_average: float
    top_cost_drivers: List[Dict[str, Any]]
    cost_trends: Dict[str, List[Dict[str, Any]]]
    cost_efficiency_metrics: Dict[str, Any]

class PricingUpdateRequest(BaseModel):
    input_price_per_1m: Optional[float] = None
    output_price_per_1m: Optional[float] = None
    fixed_price_per_unit: Optional[float] = None
    is_active: Optional[bool] = None

def apply_array_filter(query, field: str, values):
    """Helper function to apply array filter to Supabase query"""
    if values:
        if isinstance(values, list) and len(values) > 0:
            query = query.in_(field, values)
        elif isinstance(values, str) and values:
            # Handle comma-separated string for backward compatibility
            values_list = [v.strip() for v in values.split(',') if v.strip()]
            if values_list:
                query = query.in_(field, values_list)
    return query

@router.get("/token-usage", response_model=List[TokenUsageResponse])
async def get_token_usage(
    user_id: Optional[List[str]] = Query(None, description="Filter by user ID(s)"),
    feature_type: Optional[List[str]] = Query(None, description="Filter by feature type(s)"),
    model_name: Optional[List[str]] = Query(None, description="Filter by model name(s)"),
    start_date: Optional[str] = Query(None, description="Start date (ISO format)"),
    end_date: Optional[str] = Query(None, description="End date (ISO format)"),
    limit: int = Query(100, ge=1, le=1000, description="Number of records to return"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    current_user: User = Depends(get_admin_user)
):
    """Get paginated token usage data with filters"""
    try:
        query = supabase.table("token_usage").select("*")
        
        # Apply filters using array filter helper
        query = apply_array_filter(query, "user_id", user_id)
        query = apply_array_filter(query, "feature_type", feature_type)
        query = apply_array_filter(query, "model_name", model_name)
        
        if start_date:
            query = query.gte("created_at", start_date)
        if end_date:
            query = query.lte("created_at", end_date)
        
        # Order by created_at descending
        query = query.order("created_at", desc=True)
        
        # Apply pagination
        query = query.range(offset, offset + limit - 1)
        
        response = query.execute()
        
        return response.data
        
    except Exception as e:
        logger.error(f"Error fetching token usage: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching token usage: {str(e)}")

@router.get("/token-usage/stats", response_model=TokenUsageStatsResponse)
async def get_token_usage_stats(
    start_date: Optional[str] = Query(None, description="Start date (ISO format)"),
    end_date: Optional[str] = Query(None, description="End date (ISO format)"),
    user_id: Optional[List[str]] = Query(None, description="Filter by user ID(s)"),
    feature_type: Optional[List[str]] = Query(None, description="Filter by feature type(s)"),
    model_name: Optional[List[str]] = Query(None, description="Filter by model name(s)"),
    current_user: User = Depends(get_admin_user)
):
    """Get aggregated token usage statistics"""
    try:
        # Build base query
        query = supabase.table("token_usage").select("*")
        
        # Apply all filters including feature_type and model_name
        query = apply_array_filter(query, "user_id", user_id)
        query = apply_array_filter(query, "feature_type", feature_type)
        query = apply_array_filter(query, "model_name", model_name)
        
        if start_date:
            query = query.gte("created_at", start_date)
        if end_date:
            query = query.lte("created_at", end_date)
        
        response = query.execute()
        data = response.data
        
        # Calculate aggregates
        total_cost = sum(float(item.get("total_cost", 0)) for item in data)
        total_input_cost = sum(float(item.get("input_cost", 0)) for item in data)
        total_output_cost = sum(float(item.get("output_cost", 0)) for item in data)
        total_tokens = sum(int(item.get("total_tokens", 0)) for item in data)
        total_input_tokens = sum(int(item.get("input_tokens", 0)) for item in data)
        total_output_tokens = sum(int(item.get("output_tokens", 0)) for item in data)
        total_requests = len(data)  # Total number of API requests/records
        
        # Group by feature type
        by_feature_type = {}
        for item in data:
            feature = item.get("feature_type", "unknown")
            if feature not in by_feature_type:
                by_feature_type[feature] = {
                    "total_cost": 0.0,
                    "total_tokens": 0,
                    "count": 0
                }
            by_feature_type[feature]["total_cost"] += float(item.get("total_cost", 0))
            by_feature_type[feature]["total_tokens"] += int(item.get("total_tokens", 0))
            by_feature_type[feature]["count"] += 1
        
        # Aggregate chatbot sessions by conversation_id (optional enhancement)
        by_conversation = {}
        chatbot_data = [item for item in data if item.get("feature_type") == "chatbot_conversation"]
        for item in chatbot_data:
            metadata = item.get("request_metadata", {})
            if isinstance(metadata, dict):
                conversation_id = metadata.get("conversation_id")
                if conversation_id:
                    if conversation_id not in by_conversation:
                        by_conversation[conversation_id] = {
                            "total_cost": 0.0,
                            "total_tokens": 0,
                            "message_count": 0,
                            "count": 0
                        }
                    by_conversation[conversation_id]["total_cost"] += float(item.get("total_cost", 0))
                    by_conversation[conversation_id]["total_tokens"] += int(item.get("total_tokens", 0))
                    by_conversation[conversation_id]["count"] += 1
                    # Get message count from metadata if available
                    msg_count = metadata.get("message_count", 0)
                    if msg_count > by_conversation[conversation_id]["message_count"]:
                        by_conversation[conversation_id]["message_count"] = msg_count
        
        # Group by model
        by_model = {}
        for item in data:
            model = item.get("model_name", "unknown")
            if model not in by_model:
                by_model[model] = {
                    "total_cost": 0.0,
                    "total_tokens": 0,
                    "count": 0
                }
            by_model[model]["total_cost"] += float(item.get("total_cost", 0))
            by_model[model]["total_tokens"] += int(item.get("total_tokens", 0))
            by_model[model]["count"] += 1
        
        # Group by user
        by_user = {}
        for item in data:
            user_id = item.get("user_id")
            if user_id not in by_user:
                by_user[user_id] = {
                    "user_id": user_id,
                    "total_cost": 0.0,
                    "total_tokens": 0,
                    "count": 0
                }
            by_user[user_id]["total_cost"] += float(item.get("total_cost", 0))
            by_user[user_id]["total_tokens"] += int(item.get("total_tokens", 0))
            by_user[user_id]["count"] += 1
        
        # Get user information for by_user
        # Email is in auth.users, name is in profiles
        user_ids = list(by_user.keys())
        if user_ids:
            # Get names from profiles
            profiles_response = supabase.table("profiles").select("id, name").in_("id", user_ids).execute()
            profiles = {p["id"]: p for p in profiles_response.data}
            
            # Get emails from auth.users using admin API
            user_emails = {}
            for user_id in user_ids:
                try:
                    # Use admin API to get user email
                    user_response = supabase.auth.admin.get_user_by_id(user_id)
                    if user_response and user_response.user:
                        user_emails[user_id] = user_response.user.email or "Unknown"
                    else:
                        user_emails[user_id] = "Unknown"
                except Exception as e:
                    logger.warning(f"Could not fetch email for user {user_id}: {str(e)}")
                    user_emails[user_id] = "Unknown"
            
            for user_id in by_user:
                profile = profiles.get(user_id, {})
                by_user[user_id]["email"] = user_emails.get(user_id, "Unknown")
                by_user[user_id]["name"] = profile.get("name", "Unknown")
        
        # Daily cost trend
        daily_costs = {}
        for item in data:
            created_at = item.get("created_at", "")
            if created_at:
                date = created_at.split("T")[0]  # Extract date part
                if date not in daily_costs:
                    daily_costs[date] = 0.0
                daily_costs[date] += float(item.get("total_cost", 0))
        
        daily_cost_trend = [
            {"date": date, "cost": cost}
            for date, cost in sorted(daily_costs.items())
        ]
        
        return TokenUsageStatsResponse(
            total_cost=round(total_cost, 6),
            total_input_cost=round(total_input_cost, 6),
            total_output_cost=round(total_output_cost, 6),
            total_tokens=total_tokens,
            total_input_tokens=total_input_tokens,
            total_output_tokens=total_output_tokens,
            total_requests=total_requests,
            by_feature_type=by_feature_type,
            by_model=by_model,
            by_user=list(by_user.values()),
            by_conversation=by_conversation if by_conversation else None,
            daily_cost_trend=daily_cost_trend
        )
        
    except Exception as e:
        logger.error(f"Error calculating token usage stats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error calculating stats: {str(e)}")

@router.get("/token-usage/export")
async def export_token_usage(
    format: str = Query(..., description="Export format: json or csv"),
    user_id: Optional[List[str]] = Query(None, description="Filter by user ID(s)"),
    feature_type: Optional[List[str]] = Query(None, description="Filter by feature type(s)"),
    model_name: Optional[List[str]] = Query(None, description="Filter by model name(s)"),
    start_date: Optional[str] = Query(None, description="Start date (ISO format)"),
    end_date: Optional[str] = Query(None, description="End date (ISO format)"),
    current_user: User = Depends(get_admin_user)
):
    """Export token usage data in JSON or CSV format"""
    try:
        if format not in ['json', 'csv']:
            raise HTTPException(status_code=400, detail="Format must be 'json' or 'csv'")
        
        # Build query with same filters as get_token_usage
        query = supabase.table("token_usage").select("*")
        
        # Apply filters using array filter helper
        query = apply_array_filter(query, "user_id", user_id)
        query = apply_array_filter(query, "feature_type", feature_type)
        query = apply_array_filter(query, "model_name", model_name)
        
        if start_date:
            query = query.gte("created_at", start_date)
        if end_date:
            query = query.lte("created_at", end_date)
        
        # Order by created_at descending
        query = query.order("created_at", desc=True)
        
        # Get all data (no pagination for export)
        response = query.execute()
        data = response.data
        
        if format == 'json':
            return Response(
                content=json.dumps(data, indent=2, default=str),
                media_type="application/json",
                headers={
                    "Content-Disposition": f"attachment; filename=token_usage_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
                }
            )
        elif format == 'csv':
            if not data:
                # Return empty CSV with headers
                output = io.StringIO()
                writer = csv.writer(output)
                writer.writerow([
                    'id', 'user_id', 'feature_type', 'model_name', 'input_tokens', 
                    'output_tokens', 'total_tokens', 'input_cost', 'output_cost', 
                    'total_cost', 'created_at'
                ])
                output.seek(0)
                return StreamingResponse(
                    iter([output.getvalue()]),
                    media_type="text/csv",
                    headers={
                        "Content-Disposition": f"attachment; filename=token_usage_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
                    }
                )
            
            # Generate CSV
            output = io.StringIO()
            writer = csv.writer(output)
            
            # Write header
            writer.writerow([
                'id', 'user_id', 'feature_type', 'model_name', 'input_tokens', 
                'output_tokens', 'total_tokens', 'input_cost', 'output_cost', 
                'total_cost', 'created_at', 'request_metadata'
            ])
            
            # Write data rows
            for item in data:
                writer.writerow([
                    item.get('id', ''),
                    item.get('user_id', ''),
                    item.get('feature_type', ''),
                    item.get('model_name', ''),
                    item.get('input_tokens', 0),
                    item.get('output_tokens', 0),
                    item.get('total_tokens', 0),
                    item.get('input_cost', 0.0),
                    item.get('output_cost', 0.0),
                    item.get('total_cost', 0.0),
                    item.get('created_at', ''),
                    json.dumps(item.get('request_metadata', {}), default=str)
                ])
            
            output.seek(0)
            return StreamingResponse(
                iter([output.getvalue()]),
                media_type="text/csv",
                headers={
                    "Content-Disposition": f"attachment; filename=token_usage_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
                }
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error exporting token usage: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error exporting token usage: {str(e)}")



@router.get("/token-usage/users")
async def get_users_with_usage(
    start_date: Optional[str] = Query(None, description="Start date (ISO format)"),
    end_date: Optional[str] = Query(None, description="End date (ISO format)"),
    current_user: User = Depends(get_admin_user)
):
    """Get list of users with their total costs"""
    try:
        query = supabase.table("token_usage").select("*")
        
        if start_date:
            query = query.gte("created_at", start_date)
        if end_date:
            query = query.lte("created_at", end_date)
        
        response = query.execute()
        data = response.data
        
        # Aggregate by user
        user_totals = {}
        for item in data:
            user_id = item.get("user_id")
            if user_id not in user_totals:
                user_totals[user_id] = {
                    "user_id": user_id,
                    "total_cost": 0.0,
                    "total_tokens": 0,
                    "usage_count": 0
                }
            user_totals[user_id]["total_cost"] += float(item.get("total_cost", 0))
            user_totals[user_id]["total_tokens"] += int(item.get("total_tokens", 0))
            user_totals[user_id]["usage_count"] += 1
        
        # Get user information
        # Email is in auth.users, name is in profiles
        user_ids = list(user_totals.keys())
        if user_ids:
            # Get names from profiles
            profiles_response = supabase.table("profiles").select("id, name").in_("id", user_ids).execute()
            profiles = {p["id"]: p for p in profiles_response.data}
            
            # Get emails from auth.users using admin API
            user_emails = {}
            for user_id in user_ids:
                try:
                    # Use admin API to get user email
                    user_response = supabase.auth.admin.get_user_by_id(user_id)
                    if user_response and user_response.user:
                        user_emails[user_id] = user_response.user.email or "Unknown"
                    else:
                        user_emails[user_id] = "Unknown"
                except Exception as e:
                    logger.warning(f"Could not fetch email for user {user_id}: {str(e)}")
                    user_emails[user_id] = "Unknown"
            
            result = []
            for user_id, totals in user_totals.items():
                profile = profiles.get(user_id, {})
                result.append({
                    "user_id": user_id,
                    "email": user_emails.get(user_id, "Unknown"),
                    "name": profile.get("name", "Unknown"),
                    "total_cost": round(totals["total_cost"], 6),
                    "total_tokens": totals["total_tokens"],
                    "usage_count": totals["usage_count"]
                })
            
            # Sort by total_cost descending
            result.sort(key=lambda x: x["total_cost"], reverse=True)
            return result
        
        return []
        
    except Exception as e:
        logger.error(f"Error fetching users with usage: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching users: {str(e)}")

@router.get("/token-usage/budget-analysis", response_model=BudgetAnalysisResponse)
async def get_budget_analysis(
    days: int = Query(30, ge=1, le=365, description="Number of days to analyze"),
    current_user: User = Depends(get_admin_user)
):
    """Get budget analysis and projections"""
    try:
        # Calculate date range
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        # Get usage data
        query = supabase.table("token_usage").select("*").gte("created_at", start_date.isoformat())
        response = query.execute()
        data = response.data
        
        if not data:
            return BudgetAnalysisResponse(
                projected_monthly_cost=0.0,
                cost_per_user_average=0.0,
                top_cost_drivers=[],
                cost_trends={"daily": [], "weekly": [], "monthly": []},
                cost_efficiency_metrics={}
            )
        
        # Calculate daily average cost
        total_cost = sum(float(item.get("total_cost", 0)) for item in data)
        daily_average = total_cost / days
        projected_monthly_cost = daily_average * 30
        
        # Calculate cost per user average
        unique_users = len(set(item.get("user_id") for item in data))
        cost_per_user_average = total_cost / unique_users if unique_users > 0 else 0.0
        
        # Top cost drivers (by model)
        model_costs = {}
        for item in data:
            model = item.get("model_name", "unknown")
            if model not in model_costs:
                model_costs[model] = 0.0
            model_costs[model] += float(item.get("total_cost", 0))
        
        top_cost_drivers = [
            {"model": model, "total_cost": round(cost, 6)}
            for model, cost in sorted(model_costs.items(), key=lambda x: x[1], reverse=True)[:10]
        ]
        
        # Cost trends
        daily_trends = {}
        weekly_trends = {}
        monthly_trends = {}
        
        for item in data:
            created_at = item.get("created_at", "")
            if created_at:
                dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                cost = float(item.get("total_cost", 0))
                
                # Daily
                day_key = dt.strftime("%Y-%m-%d")
                daily_trends[day_key] = daily_trends.get(day_key, 0.0) + cost
                
                # Weekly
                week_key = dt.strftime("%Y-W%W")
                weekly_trends[week_key] = weekly_trends.get(week_key, 0.0) + cost
                
                # Monthly
                month_key = dt.strftime("%Y-%m")
                monthly_trends[month_key] = monthly_trends.get(month_key, 0.0) + cost
        
        # Cost efficiency metrics
        total_tokens = sum(int(item.get("total_tokens", 0)) for item in data)
        cost_per_token = total_cost / total_tokens if total_tokens > 0 else 0.0
        
        return BudgetAnalysisResponse(
            projected_monthly_cost=round(projected_monthly_cost, 6),
            cost_per_user_average=round(cost_per_user_average, 6),
            top_cost_drivers=top_cost_drivers,
            cost_trends={
                "daily": [{"date": date, "cost": round(cost, 6)} for date, cost in sorted(daily_trends.items())],
                "weekly": [{"period": period, "cost": round(cost, 6)} for period, cost in sorted(weekly_trends.items())],
                "monthly": [{"period": period, "cost": round(cost, 6)} for period, cost in sorted(monthly_trends.items())]
            },
            cost_efficiency_metrics={
                "cost_per_token": round(cost_per_token, 8),
                "total_tokens": total_tokens,
                "total_requests": len(data)
            }
        )
        
    except Exception as e:
        logger.error(f"Error calculating budget analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error calculating budget analysis: {str(e)}")

@router.get("/pricing")
async def get_pricing(
    current_user: User = Depends(get_admin_user)
):
    """Get all model pricing configurations"""
    try:
        response = supabase.table("model_pricing").select("*").order("model_name").execute()
        return response.data
    except Exception as e:
        logger.error(f"Error fetching pricing: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching pricing: {str(e)}")

@router.get("/pricing/{model_name}")
async def get_pricing_for_model(
    model_name: str,
    current_user: User = Depends(get_admin_user)
):
    """Get pricing for a specific model"""
    try:
        response = supabase.table("model_pricing").select("*").eq("model_name", model_name).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail=f"Pricing not found for model: {model_name}")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching pricing for {model_name}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching pricing: {str(e)}")

@router.put("/pricing/{model_name}")
async def update_pricing(
    model_name: str,
    pricing_update: PricingUpdateRequest,
    current_user: User = Depends(get_admin_user)
):
    """Update pricing for a model"""
    try:
        # Validate pricing values
        update_data = {}
        if pricing_update.input_price_per_1m is not None:
            if pricing_update.input_price_per_1m < 0:
                raise HTTPException(status_code=400, detail="input_price_per_1m must be non-negative")
            update_data["input_price_per_1m"] = pricing_update.input_price_per_1m
        
        if pricing_update.output_price_per_1m is not None:
            if pricing_update.output_price_per_1m < 0:
                raise HTTPException(status_code=400, detail="output_price_per_1m must be non-negative")
            update_data["output_price_per_1m"] = pricing_update.output_price_per_1m
        
        if pricing_update.fixed_price_per_unit is not None:
            if pricing_update.fixed_price_per_unit < 0:
                raise HTTPException(status_code=400, detail="fixed_price_per_unit must be non-negative")
            update_data["fixed_price_per_unit"] = pricing_update.fixed_price_per_unit
        
        if pricing_update.is_active is not None:
            update_data["is_active"] = pricing_update.is_active
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        # Update effective_date
        update_data["effective_date"] = datetime.now().isoformat()
        
        # Update in database
        response = supabase.table("model_pricing").update(update_data).eq("model_name", model_name).execute()
        
        if not response.data:
            raise HTTPException(status_code=404, detail=f"Pricing not found for model: {model_name}")
        
        # Refresh pricing cache
        pricing_service.refresh_pricing_cache()
        
        return response.data[0]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating pricing for {model_name}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error updating pricing: {str(e)}")

@router.post("/pricing/refresh")
async def refresh_pricing_cache(
    current_user: User = Depends(get_admin_user)
):
    """Refresh pricing cache from database"""
    try:
        success = pricing_service.refresh_pricing_cache()
        if success:
            return {"message": "Pricing cache refreshed successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to refresh pricing cache")
    except Exception as e:
        logger.error(f"Error refreshing pricing cache: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error refreshing cache: {str(e)}")
