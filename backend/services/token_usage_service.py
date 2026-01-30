"""
Token Usage Service for Tracking AI API Usage and Costs
Tracks token usage from OpenAI and other AI providers and stores in database
"""

import os
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime
from supabase import create_client, Client
from services.pricing_service import PricingService

logger = logging.getLogger(__name__)

# Feature type constants
FEATURE_TYPES = {
    "content_generation": "Main content generation",
    "image_generation": "Image generation for posts",
    "blog_generation": "Blog writing",
    "custom_content": "Custom content chatbot",
    "custom_blog": "Custom blog chatbot",
    "template_editing": "Template editor",
    "ads_creation": "Ads creation",
    "image_editing": "Image editor chatbot",
    "lead_email": "Lead email generation",
    "content_ai_edit": "AI content editing",
    "chatbot_conversation": "Business chatbot conversations",
    "website_analysis": "Website analysis and recommendations"
}


class TokenUsageService:
    """Service for tracking token usage and calculating costs"""
    
    def __init__(self, supabase_url: str, supabase_key: str):
        """Initialize token usage service"""
        self.supabase: Client = create_client(supabase_url, supabase_key)
        self.pricing_service = PricingService(supabase_url, supabase_key)
    
    def calculate_costs(
        self, 
        model_name: str, 
        input_tokens: int, 
        output_tokens: int,
        is_image: bool = False,
        image_count: int = 1,
        image_size: Optional[str] = None
    ) -> Dict[str, float]:
        """
        Calculate costs based on model and token usage
        
        Args:
            model_name: Name of the model
            input_tokens: Number of input tokens
            output_tokens: Number of output tokens
            is_image: Whether this is image generation
            image_count: Number of images (for image generation)
            image_size: Image size (for image generation)
            
        Returns:
            Dict with input_cost, output_cost, total_cost (all rounded to 6 decimals)
        """
        # Validate token counts
        if input_tokens < 0 or output_tokens < 0:
            logger.warning(f"Invalid token counts: input={input_tokens}, output={output_tokens}")
            input_tokens = max(0, input_tokens)
            output_tokens = max(0, output_tokens)
        
        if is_image:
            # Use pricing service for image cost calculation
            return self.pricing_service.calculate_image_cost(model_name, image_count, image_size)
        else:
            # Use pricing service for token cost calculation
            return self.pricing_service.calculate_token_cost(model_name, input_tokens, output_tokens)
    
    async def track_chat_completion_usage(
        self,
        user_id: str,
        feature_type: str,
        model_name: str,
        response: Any,
        request_metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Track token usage from OpenAI chat completion response
        
        Args:
            user_id: User ID
            feature_type: Type of feature (from FEATURE_TYPES)
            model_name: Name of the model used
            response: OpenAI response object
            request_metadata: Optional metadata to store
            
        Returns:
            True if tracking succeeded, False otherwise
        """
        try:
            # Extract usage from response
            usage = getattr(response, 'usage', None)
            if not usage:
                logger.warning(f"No usage data in response for {feature_type}")
                return False
            
            # Handle both old and new API formats
            input_tokens = (
                getattr(usage, 'input_tokens', None) or 
                getattr(usage, 'prompt_tokens', None) or 
                0
            )
            output_tokens = (
                getattr(usage, 'output_tokens', None) or 
                getattr(usage, 'completion_tokens', None) or 
                0
            )
            total_tokens = (
                getattr(usage, 'total_tokens', None) or 
                (input_tokens + output_tokens)
            )
            
            # Ensure we have valid token counts
            if input_tokens == 0 and output_tokens == 0 and total_tokens == 0:
                logger.warning(f"All token counts are zero for {feature_type}")
                return False
            
            # Calculate costs
            costs = self.calculate_costs(model_name, input_tokens, output_tokens, is_image=False)
            
            # Prepare metadata
            metadata = request_metadata or {}
            metadata.update({
                "response_id": getattr(response, 'id', None),
                "model": model_name,
                "timestamp": datetime.utcnow().isoformat(),
                "pricing_version": "database-driven"
            })
            
            # Store in database
            result = self.supabase.table("token_usage").insert({
                "user_id": user_id,
                "feature_type": feature_type,
                "model_name": model_name,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_tokens": total_tokens,
                "input_cost": costs["input_cost"],
                "output_cost": costs["output_cost"],
                "total_cost": costs["total_cost"],
                "request_metadata": metadata
            }).execute()
            
            logger.info(
                f"Tracked token usage: {feature_type} - {total_tokens} tokens "
                f"(${costs['total_cost']:.6f}) for user {user_id}"
            )
            return True
            
        except Exception as e:
            logger.error(f"Error tracking chat completion usage: {str(e)}", exc_info=True)
            return False
    
    async def track_image_generation_usage(
        self,
        user_id: str,
        feature_type: str,
        model_name: str,
        response: Any,
        image_count: int = 1,
        image_size: Optional[str] = None,
        request_metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Track token usage from image generation response
        
        Args:
            user_id: User ID
            feature_type: Type of feature (from FEATURE_TYPES)
            model_name: Name of the model used
            response: API response object
            image_count: Number of images generated
            image_size: Image size (e.g., '1024x1024')
            request_metadata: Optional metadata to store
            
        Returns:
            True if tracking succeeded, False otherwise
        """
        try:
            # For DALL-E, usage might be in response.data or response.usage
            usage = getattr(response, 'usage', None)
            
            if usage:
                # DALL-E 3 returns usage object with token information
                input_tokens = (
                    getattr(usage, 'input_tokens', None) or 
                    getattr(usage, 'prompt_tokens', None) or 
                    0
                )
                output_tokens = 0  # Images don't have output tokens
                total_tokens = (
                    getattr(usage, 'total_tokens', None) or 
                    input_tokens
                )
            else:
                # Gemini doesn't provide usage, so estimate tokens based on image size
                # For Gemini image generation: token-based pricing
                # Average: ~1,290 tokens per 1024x1024 image
                if "gemini" in model_name.lower():
                    # Estimate tokens based on image size
                    # Base: 1024x1024 ≈ 1,290 tokens (mostly input tokens)
                    estimated_tokens_per_image = 1290  # Base estimate for 1024x1024
                    
                    # Adjust for larger images
                    if image_size:
                        if "1792" in str(image_size) or "1920" in str(image_size):
                            # Larger images use more tokens
                            estimated_tokens_per_image = 2000
                        elif "512" in str(image_size):
                            # Smaller images use fewer tokens
                            estimated_tokens_per_image = 800
                    
                    # Gemini image generation: mostly input tokens (prompt + image processing)
                    # Output tokens are minimal for image generation
                    input_tokens = estimated_tokens_per_image * image_count
                    output_tokens = int(estimated_tokens_per_image * 0.1 * image_count)  # ~10% output tokens
                    total_tokens = input_tokens + output_tokens
                else:
                    # For DALL-E and other fixed-price models, use fixed pricing
                    input_tokens = image_count  # Represent image count
                    output_tokens = 0
                    total_tokens = image_count
            
            # Calculate costs
            # For Gemini: use token-based pricing via calculate_image_cost with tokens
            # For others (DALL-E): use fixed pricing
            if "gemini" in model_name.lower() and input_tokens > 0:
                # Use token-based pricing for Gemini
                costs = self.pricing_service.calculate_image_cost(
                    model_name,
                    image_count=image_count,
                    size=image_size,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens
                )
            else:
                # Use fixed pricing for DALL-E and other fixed-price models
                costs = self.calculate_costs(
                    model_name, 
                    input_tokens, 
                    output_tokens, 
                    is_image=True,
                    image_count=image_count,
                    image_size=image_size
                )
            
            # Prepare metadata
            metadata = request_metadata or {}
            metadata.update({
                "response_id": getattr(response, 'id', None),
                "model": model_name,
                "image_count": image_count,
                "image_size": image_size,
                "timestamp": datetime.utcnow().isoformat(),
                "pricing_version": "database-driven"
            })
            
            # Store in database
            result = self.supabase.table("token_usage").insert({
                "user_id": user_id,
                "feature_type": feature_type,
                "model_name": model_name,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_tokens": total_tokens,
                "input_cost": costs["input_cost"],
                "output_cost": costs["output_cost"],
                "total_cost": costs["total_cost"],
                "request_metadata": metadata
            }).execute()
            
            logger.info(
                f"Tracked image generation usage: {feature_type} - "
                f"{image_count} images (${costs['total_cost']:.6f}) for user {user_id}"
            )
            return True
            
        except Exception as e:
            logger.error(f"Error tracking image generation usage: {str(e)}", exc_info=True)
            return False
    
    def _extract_langchain_usage(self, response: Any, messages: List[Any]) -> Dict[str, int]:
        """
        Extract token usage from LangChain response object
        
        Args:
            response: LangChain response object
            messages: List of messages sent to the LLM (for estimation if needed)
            
        Returns:
            Dict with input_tokens, output_tokens, total_tokens
        """
        try:
            # Try to get usage from response_metadata
            response_metadata = getattr(response, 'response_metadata', None)
            if response_metadata:
                usage = response_metadata.get('token_usage', {})
                if usage:
                    input_tokens = usage.get('prompt_tokens', 0) or usage.get('input_tokens', 0)
                    output_tokens = usage.get('completion_tokens', 0) or usage.get('output_tokens', 0)
                    total_tokens = usage.get('total_tokens', 0) or (input_tokens + output_tokens)
                    
                    if input_tokens > 0 or output_tokens > 0:
                        return {
                            "input_tokens": input_tokens,
                            "output_tokens": output_tokens,
                            "total_tokens": total_tokens
                        }
            
            # If no usage in metadata, try to estimate using tiktoken
            try:
                import tiktoken
                
                # Get model name from response or default
                model_name = getattr(response, 'model_name', None) or "gpt-4o-mini"
                
                # Try to get encoding for the model
                try:
                    encoding = tiktoken.encoding_for_model(model_name)
                except KeyError:
                    # Fallback to cl100k_base (used by gpt-4o-mini and most models)
                    encoding = tiktoken.get_encoding("cl100k_base")
                
                # Estimate input tokens from messages
                input_text = ""
                for msg in messages:
                    if hasattr(msg, 'content'):
                        input_text += str(msg.content) + "\n"
                    elif isinstance(msg, dict):
                        input_text += str(msg.get('content', '')) + "\n"
                
                input_tokens = len(encoding.encode(input_text))
                
                # Estimate output tokens from response
                output_text = ""
                if hasattr(response, 'content'):
                    output_text = str(response.content)
                elif hasattr(response, 'message') and hasattr(response.message, 'content'):
                    output_text = str(response.message.content)
                
                output_tokens = len(encoding.encode(output_text)) if output_text else 0
                total_tokens = input_tokens + output_tokens
                
                return {
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "total_tokens": total_tokens
                }
            except ImportError:
                logger.warning("tiktoken not available, using rough estimation")
                # Rough estimation: ~4 characters per token
                input_text = ""
                for msg in messages:
                    if hasattr(msg, 'content'):
                        input_text += str(msg.content)
                    elif isinstance(msg, dict):
                        input_text += str(msg.get('content', ''))
                
                output_text = ""
                if hasattr(response, 'content'):
                    output_text = str(response.content)
                elif hasattr(response, 'message') and hasattr(response.message, 'content'):
                    output_text = str(response.message.content)
                
                input_tokens = max(1, len(input_text) // 4)
                output_tokens = max(1, len(output_text) // 4) if output_text else 0
                total_tokens = input_tokens + output_tokens
                
                return {
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "total_tokens": total_tokens
                }
        except Exception as e:
            logger.error(f"Error extracting LangChain usage: {str(e)}", exc_info=True)
            # Return minimal tokens as fallback
            return {
                "input_tokens": 1,
                "output_tokens": 1,
                "total_tokens": 2
            }
    
    async def track_langchain_usage(
        self,
        user_id: str,
        feature_type: str,
        model_name: str,
        response: Any,
        messages: List[Any],
        request_metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Track token usage from LangChain response object
        
        Args:
            user_id: User ID
            feature_type: Type of feature (from FEATURE_TYPES)
            model_name: Name of the model used
            response: LangChain response object
            messages: List of messages sent to the LLM
            request_metadata: Optional metadata to store
            
        Returns:
            True if tracking succeeded, False otherwise
        """
        try:
            # Extract usage from LangChain response
            usage_data = self._extract_langchain_usage(response, messages)
            input_tokens = usage_data["input_tokens"]
            output_tokens = usage_data["output_tokens"]
            total_tokens = usage_data["total_tokens"]
            
            # Ensure we have valid token counts
            if input_tokens == 0 and output_tokens == 0 and total_tokens == 0:
                logger.warning(f"All token counts are zero for {feature_type}")
                return False
            
            # Calculate costs
            costs = self.calculate_costs(model_name, input_tokens, output_tokens, is_image=False)
            
            # Prepare metadata
            metadata = request_metadata or {}
            metadata.update({
                "model": model_name,
                "timestamp": datetime.utcnow().isoformat(),
                "pricing_version": "database-driven",
                "source": "langchain"
            })
            
            # Store in database
            result = self.supabase.table("token_usage").insert({
                "user_id": user_id,
                "feature_type": feature_type,
                "model_name": model_name,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_tokens": total_tokens,
                "input_cost": costs["input_cost"],
                "output_cost": costs["output_cost"],
                "total_cost": costs["total_cost"],
                "request_metadata": metadata
            }).execute()
            
            logger.info(
                f"Tracked LangChain token usage: {feature_type} - {total_tokens} tokens "
                f"(${costs['total_cost']:.6f}) for user {user_id}"
            )
            return True
            
        except Exception as e:
            logger.error(f"Error tracking LangChain usage: {str(e)}", exc_info=True)
            return False
    
    def validate_cost_calculation(
        self,
        model_name: str,
        input_tokens: int,
        output_tokens: int,
        expected_cost: float,
        tolerance: float = 0.000001
    ) -> bool:
        """
        Validate cost calculation against expected value (for testing)
        
        Args:
            model_name: Model name
            input_tokens: Input token count
            output_tokens: Output token count
            expected_cost: Expected total cost
            tolerance: Tolerance for floating point comparison
            
        Returns:
            True if calculated cost matches expected (within tolerance)
        """
        costs = self.calculate_costs(model_name, input_tokens, output_tokens, is_image=False)
        calculated_cost = costs["total_cost"]
        difference = abs(calculated_cost - expected_cost)
        
        if difference <= tolerance:
            return True
        else:
            logger.warning(
                f"Cost validation failed for {model_name}: "
                f"calculated={calculated_cost}, expected={expected_cost}, diff={difference}"
            )
            return False
