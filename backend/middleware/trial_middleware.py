#!/usr/bin/env python3
"""
Trial Middleware
Automatically handles trial activation and status checking on user login
"""

import logging
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
from typing import Callable

from services.trial_service import trial_service

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TrialMiddleware(BaseHTTPMiddleware):
    """
    Middleware to automatically handle trial activation and status checking
    """
    
    def __init__(self, app: ASGIApp):
        super().__init__(app)
        self.trial_service = trial_service
    
    async def dispatch(self, request: Request, call_next: Callable):
        """
        Process the request and handle trial logic
        """
        try:
            # Skip trial logic for certain paths
            if self._should_skip_trial_logic(request):
                response = await call_next(request)
                return response
            
            # Extract user information from request headers or JWT
            user_info = await self._extract_user_info(request)
            
            if user_info:
                # Check if this is a new user login
                if self._is_login_request(request):
                    await self._handle_user_login(user_info)
                
                # Check trial status for authenticated requests
                if self._is_authenticated_request(request):
                    trial_status = await self._check_trial_status(user_info["user_id"])
                    
                    # If trial has expired, return appropriate response
                    if trial_status.get("trial_expired", False):
                        return JSONResponse(
                            content={
                                "success": False,
                                "message": "Your free trial has expired. Please subscribe to continue using the service.",
                                "trial_expired": True,
                                "subscription_required": True
                            },
                            status_code=402  # Payment Required
                        )
            
            # Continue with the request
            response = await call_next(request)
            return response
            
        except Exception as e:
            logger.error(f"Error in trial middleware: {str(e)}")
            # Don't block the request if trial middleware fails
            response = await call_next(request)
            return response
    
    def _should_skip_trial_logic(self, request: Request) -> bool:
        """
        Determine if trial logic should be skipped for this request
        """
        skip_paths = [
            "/health",
            "/trial/health",
            "/docs",
            "/openapi.json",
            "/favicon.ico",
            "/static",
            "/auth/login",
            "/auth/signup",
            "/auth/callback"
        ]
        
        path = request.url.path
        return any(path.startswith(skip_path) for skip_path in skip_paths)
    
    async def _extract_user_info(self, request: Request) -> dict:
        """
        Extract user information from the request
        """
        try:
            # Try to get user info from Authorization header
            auth_header = request.headers.get("Authorization")
            if auth_header and auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]
                
                # Verify token with Supabase
                user_response = self.trial_service.supabase.auth.get_user(token)
                
                if user_response and user_response.user:
                    return {
                        "user_id": user_response.user.id,
                        "email": user_response.user.email,
                        "name": user_response.user.user_metadata.get("name", user_response.user.email)
                    }
            
            return None
            
        except Exception as e:
            logger.debug(f"Could not extract user info: {str(e)}")
            return None
    
    def _is_login_request(self, request: Request) -> bool:
        """
        Check if this is a login request
        """
        # This would need to be customized based on your login endpoints
        login_paths = ["/auth/login", "/auth/signup", "/auth/callback"]
        return request.url.path in login_paths
    
    def _is_authenticated_request(self, request: Request) -> bool:
        """
        Check if this is an authenticated request that should check trial status
        """
        # Skip trial checks for certain endpoints
        skip_paths = [
            "/trial/",
            "/auth/",
            "/health",
            "/docs"
        ]
        
        path = request.url.path
        return not any(path.startswith(skip_path) for skip_path in skip_paths)
    
    async def _handle_user_login(self, user_info: dict):
        """
        Handle user login and potentially activate trial
        """
        try:
            user_id = user_info["user_id"]
            user_email = user_info["email"]
            user_name = user_info["name"]
            
            logger.info(f"Handling login for user {user_id}")
            
            # Check if user already has a profile
            profile_result = self.trial_service.supabase.table("profiles").select("*").eq("id", user_id).execute()
            
            if not profile_result.data:
                # New user - activate trial
                logger.info(f"New user detected, activating trial for {user_id}")
                trial_result = await self.trial_service.activate_trial(user_id, user_email, user_name)
                
                if trial_result["success"]:
                    logger.info(f"Trial activated for new user {user_id}")
                else:
                    logger.warning(f"Failed to activate trial for new user {user_id}: {trial_result['message']}")
            else:
                # Existing user - check if trial needs to be activated
                profile = profile_result.data[0]
                current_status = profile.get("subscription_status", "inactive")
                
                if current_status == "inactive":
                    logger.info(f"Existing user with inactive status, activating trial for {user_id}")
                    trial_result = await self.trial_service.activate_trial(user_id, user_email, user_name)
                    
                    if trial_result["success"]:
                        logger.info(f"Trial activated for existing user {user_id}")
                    else:
                        logger.warning(f"Failed to activate trial for existing user {user_id}: {trial_result['message']}")
                
        except Exception as e:
            logger.error(f"Error handling user login: {str(e)}")
    
    async def _check_trial_status(self, user_id: str) -> dict:
        """
        Check trial status for a user
        """
        try:
            trial_status = await self.trial_service.check_trial_status(user_id)
            return trial_status
        except Exception as e:
            logger.error(f"Error checking trial status for user {user_id}: {str(e)}")
            return {"trial_expired": False}

# Function to create trial middleware
def create_trial_middleware(app: ASGIApp) -> TrialMiddleware:
    """
    Create and return trial middleware instance
    """
    return TrialMiddleware(app)


