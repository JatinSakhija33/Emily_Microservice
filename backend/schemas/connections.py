from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime

class ConnectionResponse(BaseModel):
    id: str
    platform: str
    page_id: Optional[str] = None
    page_name: Optional[str] = None
    page_username: Optional[str] = None
    follower_count: int = 0
    connection_status: str
    is_active: bool = True
    last_sync: Optional[datetime] = None
    last_posted_at: Optional[datetime] = None
    connected_at: datetime
    last_token_refresh: Optional[datetime] = None

class ConnectionCreate(BaseModel):
    platform: str
    page_id: Optional[str] = None
    page_name: Optional[str] = None
    page_username: Optional[str] = None
    follower_count: int = 0
    access_token: str
    refresh_token: Optional[str] = None
    token_expires_at: Optional[datetime] = None

class ConnectionUpdate(BaseModel):
    page_name: Optional[str] = None
    page_username: Optional[str] = None
    follower_count: Optional[int] = None
    connection_status: Optional[str] = None
    is_active: Optional[bool] = None

class OAuthInitiateResponse(BaseModel):
    auth_url: str
    state: str

class OAuthCallbackRequest(BaseModel):
    code: str
    state: str

class ConnectionSettingsUpdate(BaseModel):
    auto_posting: Optional[bool] = None
    default_posting_time: Optional[str] = None  # Format: "HH:MM"
    timezone: Optional[str] = None
    post_frequency: Optional[int] = None  # Posts per day
    content_preferences: Optional[Dict[str, Any]] = None

class ConnectionSettingsResponse(BaseModel):
    id: str
    connection_id: str
    auto_posting: bool = True
    default_posting_time: Optional[str] = None
    timezone: str = "UTC"
    post_frequency: int = 1
    content_preferences: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

class ConnectionAnalyticsResponse(BaseModel):
    connection_id: str
    platform: str
    total_posts: int = 0
    successful_posts: int = 0
    failed_posts: int = 0
    total_engagement: int = 0
    average_engagement: float = 0.0
    last_30_days_posts: int = 0
    last_30_days_engagement: int = 0
    top_performing_content: Optional[Dict[str, Any]] = None
    engagement_trend: Optional[Dict[str, Any]] = None
