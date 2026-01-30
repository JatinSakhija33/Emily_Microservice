"""
Enhanced Authentication utilities with trial system integration
"""

import os
import asyncio
from fastapi import HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, Client
from pydantic import BaseModel
from dotenv import load_dotenv
from services.trial_service import trial_service

# Load environment variables
load_dotenv()

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
supabase: Client = create_client(supabase_url, supabase_key)

# Security
security = HTTPBearer()

class User(BaseModel):
    id: str
    email: str
    name: str
    created_at: str
    subscription_status: str = "inactive"
    trial_active: bool = False
    days_remaining: int = 0

async def get_current_user_with_trial(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Enhanced authentication that automatically handles trial activation for new users
    """
    try:
        token = credentials.credentials
        print(f"🔍 Auth - Received token: {token[:20]}...")
        
        # Temporary test token for development
        if token == "test-token":
            print("🔍 Auth - Using test token for development")
            return User(
                id="22ecf157-2eef-4aea-b1a7-67e7c09127d0",  # Valid user ID from Supabase
                email="test@example.com",
                name="Test User",
                created_at="2025-01-01T00:00:00Z",
                subscription_status="trial",
                trial_active=True,
                days_remaining=3
            )
        
        # Verify token with Supabase
        response = supabase.auth.get_user(token)
        print(f"🔍 Auth - Supabase response: {response}")
        
        if not response.user:
            print(f"🔍 Auth - No user found in response: {response}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
        
        user_id = response.user.id
        user_email = response.user.email
        user_name = response.user.user_metadata.get("name", response.user.email)
        
        # Convert created_at to string if it's a datetime object
        created_at_str = response.user.created_at
        if hasattr(created_at_str, 'isoformat'):
            created_at_str = created_at_str.isoformat()
        else:
            created_at_str = str(created_at_str)
        
        # Check if user has a profile and handle trial activation
        try:
            profile_result = supabase.table("profiles").select("*").eq("id", user_id).execute()
            
            if not profile_result.data:
                # New user - activate trial
                print(f"🔍 Auth - New user detected, activating trial for {user_id}")
                trial_result = await trial_service.activate_trial(user_id, user_email, user_name)
                
                if trial_result["success"]:
                    print(f"✅ Trial activated for new user {user_id}")
                    subscription_status = "trial"
                    trial_active = True
                    days_remaining = trial_result.get("days_remaining", 3)
                else:
                    print(f"⚠️ Failed to activate trial for new user {user_id}: {trial_result['message']}")
                    subscription_status = "inactive"
                    trial_active = False
                    days_remaining = 0
            else:
                # Existing user - check trial status
                profile = profile_result.data[0]
                subscription_status = profile.get("subscription_status", "inactive")
                
                if subscription_status == "trial":
                    # Check if trial is still active
                    trial_status = await trial_service.check_trial_status(user_id)
                    if trial_status["success"]:
                        trial_active = trial_status.get("trial_active", False)
                        days_remaining = trial_status.get("days_remaining", 0)
                        
                        # If trial expired, update status
                        if not trial_active and trial_status.get("subscription_status") == "expired":
                            subscription_status = "expired"
                    else:
                        trial_active = False
                        days_remaining = 0
                else:
                    trial_active = False
                    days_remaining = 0
                
                # If user has inactive status, activate trial
                if subscription_status == "inactive":
                    print(f"🔍 Auth - Existing user with inactive status, activating trial for {user_id}")
                    trial_result = await trial_service.activate_trial(user_id, user_email, user_name)
                    
                    if trial_result["success"]:
                        print(f"✅ Trial activated for existing user {user_id}")
                        subscription_status = "trial"
                        trial_active = True
                        days_remaining = trial_result.get("days_remaining", 3)
                    else:
                        print(f"⚠️ Failed to activate trial for existing user {user_id}: {trial_result['message']}")
        
        except Exception as e:
            print(f"⚠️ Error handling trial logic for user {user_id}: {str(e)}")
            # Don't fail authentication if trial logic fails
            subscription_status = "inactive"
            trial_active = False
            days_remaining = 0
        
        return User(
            id=user_id,
            email=user_email,
            name=user_name,
            created_at=created_at_str,
            subscription_status=subscription_status,
            trial_active=trial_active,
            days_remaining=days_remaining
        )
        
    except Exception as e:
        print(f"🔍 Auth - Exception occurred: {e}")
        print(f"🔍 Auth - Exception type: {type(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )

# Keep the original function for backward compatibility
def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Original authentication function (kept for backward compatibility)
    """
    try:
        token = credentials.credentials
        print(f"🔍 Auth - Received token: {token[:20]}...")
        
        # Temporary test token for development
        if token == "test-token":
            print("🔍 Auth - Using test token for development")
            return User(
                id="22ecf157-2eef-4aea-b1a7-67e7c09127d0",  # Valid user ID from Supabase
                email="test@example.com",
                name="Test User",
                created_at="2025-01-01T00:00:00Z"
            )
        
        # Verify token with Supabase
        response = supabase.auth.get_user(token)
        print(f"🔍 Auth - Supabase response: {response}")
        
        if not response.user:
            print(f"🔍 Auth - No user found in response: {response}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
        
        # Convert created_at to string if it's a datetime object
        created_at_str = response.user.created_at
        if hasattr(created_at_str, 'isoformat'):
            created_at_str = created_at_str.isoformat()
        else:
            created_at_str = str(created_at_str)
        
        return User(
            id=response.user.id,
            email=response.user.email,
            name=response.user.user_metadata.get("name", response.user.email),
            created_at=created_at_str
        )
    except Exception as e:
        print(f"🔍 Auth - Exception occurred: {e}")
        print(f"🔍 Auth - Exception type: {type(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )

# Function to check if user has active subscription or trial
def has_active_access(user: User) -> bool:
    """
    Check if user has active access (either paid subscription or active trial)
    """
    return user.subscription_status in ["active", "trial"] and user.trial_active

# Function to check if user needs subscription
def requires_subscription(user: User) -> bool:
    """
    Check if user needs to subscribe (trial expired or no access)
    """
    return user.subscription_status in ["expired", "inactive"] or not user.trial_active


