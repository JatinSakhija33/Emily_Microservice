# This file contains Pydantic models for the connections system
# The actual data is stored in Supabase, not SQLAlchemy

from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime

class PlatformConnection(BaseModel):
    id: Optional[str] = None
    user_id: str
    platform: str
    page_id: Optional[str] = None
    page_name: Optional[str] = None
    page_username: Optional[str] = None
    follower_count: int = 0
    
    # Encrypted token storage
    access_token_encrypted: Optional[str] = None
    refresh_token_encrypted: Optional[str] = None
    token_expires_at: Optional[datetime] = None
    
    # Platform-specific fields
    # Instagram fields
    instagram_id: Optional[str] = None
    account_type: Optional[str] = None
    media_count: int = 0
    
    # LinkedIn fields
    linkedin_id: Optional[str] = None
    headline: Optional[str] = None
    email: Optional[str] = None
    profile_picture: Optional[str] = None
    
    # Connection metadata
    is_active: bool = True
    last_sync: Optional[datetime] = None
    last_posted_at: Optional[datetime] = None
    connection_status: str = 'active'  # active, expired, revoked, error
    
    # Timestamps
    connected_at: Optional[datetime] = None
    last_token_refresh: Optional[datetime] = None
    disconnected_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class PlatformSettings(BaseModel):
    id: Optional[str] = None
    connection_id: str
    auto_posting: bool = True
    default_posting_time: Optional[str] = None  # Format: "HH:MM"
    timezone: str = "UTC"
    post_frequency: int = 1  # Posts per day
    content_preferences: Optional[Dict[str, Any]] = None  # hashtags, emojis, etc.
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class TokenRefreshQueue(BaseModel):
    id: Optional[str] = None
    connection_id: str
    platform: str
    refresh_attempts: int = 0
    max_attempts: int = 3
    next_attempt_at: Optional[datetime] = None
    status: str = 'pending'  # pending, processing, completed, failed
    error_message: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class ConnectionActivity(BaseModel):
    id: Optional[str] = None
    connection_id: str
    activity_type: str  # connect, refresh, post, error, disconnect
    status: str  # success, error, warning
    message: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None

class OAuthState(BaseModel):
    id: Optional[str] = None
    user_id: str
    platform: str
    state: str
    expires_at: datetime
    created_at: Optional[datetime] = None

# User model for authentication
class User(BaseModel):
    id: str
    email: str
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    onboarding_completed: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

# Authentication functions
def get_current_user():
    """Placeholder for authentication - should be implemented with Supabase auth"""
    # This would typically extract user from JWT token
    # For now, return a mock user for development
    pass