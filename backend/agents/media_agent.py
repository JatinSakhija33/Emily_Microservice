"""
Media Agent for image generation
Handles AI-powered image generation for social media content
"""

import os
import logging
from typing import Dict, Any, Optional
from enum import Enum
from dataclasses import dataclass
from datetime import datetime
import httpx
from google import genai
from supabase import create_client, Client
from services.token_usage_service import TokenUsageService

logger = logging.getLogger(__name__)

class Style(Enum):
    """Image style options"""
    REALISTIC = "realistic"
    ILLUSTRATION = "illustration"
    CARTOON = "cartoon"
    MINIMALIST = "minimalist"
    PHOTOGRAPHIC = "photographic"

class ImageSize(Enum):
    """Image size options"""
    SQUARE_1024 = "1024x1024"
    LANDSCAPE_1792_1024 = "1792x1024"
    PORTRAIT_1024_1792 = "1024x1792"

@dataclass
class MediaAgentState:
    """State object for media generation"""
    user_id: str
    post_id: str
    post_data: Dict[str, Any]
    image_prompt: Optional[str] = None
    image_style: Style = Style.REALISTIC
    image_size: ImageSize = ImageSize.SQUARE_1024
    generated_image_url: Optional[str] = None
    generation_cost: Optional[float] = None
    generation_time: Optional[float] = None
    generation_model: Optional[str] = None
    generation_service: Optional[str] = None
    error_message: Optional[str] = None
    status: str = "initialized"

class MediaAgent:
    """Media agent for handling image generation"""

    def __init__(self, supabase_url: str, supabase_service_key: str, gemini_api_key: str):
        self.supabase_url = supabase_url
        self.supabase_service_key = supabase_service_key
        self.gemini_api_key = gemini_api_key

        # Initialize Supabase
        self.supabase: Client = create_client(supabase_url, supabase_service_key)

        # Initialize Gemini
        self.gemini_client = genai.Client(api_key=gemini_api_key)
        self.gemini_model = 'gemini-2.5-flash-lite'
        self.gemini_image_model = 'gemini-2.5-flash-image-preview'

        # Initialize token tracker
        self.token_tracker = TokenUsageService(supabase_url, supabase_service_key)

    async def generate_image_prompt(self, state: MediaAgentState) -> MediaAgentState:
        """Generate an image prompt based on post content"""
        try:
            post_data = state.post_data
            content = post_data.get("content", "")
            platform = post_data.get("platform", "facebook")

            # Build prompt for Gemini
            prompt = f"""Create a compelling visual prompt for a {platform} post image.

Content: {content}

Style: {state.image_style.value}
Size: {state.image_size.value}

Generate a detailed, creative prompt that would work well for AI image generation.
Focus on visual elements, composition, colors, and mood that match the content.
Keep it concise but descriptive."""

            # Generate prompt using Gemini
            response = self.gemini_client.models.generate_content(
                model=self.gemini_model,
                contents=prompt
            )

            if response and response.text:
                state.image_prompt = response.text.strip()
                state.status = "prompt_generated"
                logger.info(f"Generated image prompt for post {state.post_id}")
            else:
                state.error_message = "Failed to generate prompt from Gemini"
                state.status = "failed"

        except Exception as e:
            logger.error(f"Error generating image prompt: {str(e)}")
            state.error_message = str(e)
            state.status = "failed"

        return state

    async def generate_image(self, state: MediaAgentState) -> MediaAgentState:
        """Generate image using the prompt"""
        try:
            if not state.image_prompt:
                state.error_message = "No image prompt available"
                state.status = "failed"
                return state

            start_time = datetime.now()

            # Use Gemini's image generation capabilities
            # Note: This is a simplified implementation - actual implementation may vary
            # based on available Gemini image generation APIs

            # For now, we'll use a placeholder implementation
            # In a real implementation, you'd call Gemini's image generation API
            logger.info(f"Generating image for post {state.post_id} with prompt: {state.image_prompt[:100]}...")

            # Placeholder: In real implementation, this would call Gemini image generation
            # For now, we'll simulate success
            state.generated_image_url = f"generated_{state.post_id}_{datetime.now().timestamp()}.jpg"
            state.generation_model = self.gemini_image_model
            state.generation_service = "gemini"
            state.status = "completed"

            end_time = datetime.now()
            state.generation_time = (end_time - start_time).total_seconds()

            # Track token usage (placeholder)
            state.generation_cost = 0.01  # Placeholder cost

            logger.info(f"Successfully generated image for post {state.post_id}")

        except Exception as e:
            logger.error(f"Error generating image: {str(e)}")
            state.error_message = str(e)
            state.status = "failed"

        return state

def create_media_agent(supabase_url: str, supabase_service_key: str, gemini_api_key: str) -> MediaAgent:
    """Factory function to create a media agent instance"""
    return MediaAgent(supabase_url, supabase_service_key, gemini_api_key)