"""
Pricing Service for AI Model Cost Calculation
Manages pricing configuration from database with in-memory caching for performance
"""

import os
import logging
from typing import Optional, Dict, Any
from supabase import create_client, Client
from datetime import datetime

logger = logging.getLogger(__name__)


class PricingService:
    """Service for managing and calculating AI model pricing"""
    
    def __init__(self, supabase_url: str, supabase_key: str):
        """Initialize pricing service with Supabase client"""
        self.supabase: Client = create_client(supabase_url, supabase_key)
        self._pricing_cache: Dict[str, Dict[str, Any]] = {}
        self._cache_loaded = False
        self._load_pricing_cache()
    
    def _load_pricing_cache(self) -> None:
        """Load all active pricing from database into memory cache"""
        try:
            response = self.supabase.table("model_pricing").select("*").eq("is_active", True).execute()
            
            if response.data:
                self._pricing_cache = {}
                for pricing in response.data:
                    model_name = pricing.get("model_name", "").lower()
                    # Handle NULL values - convert None to 0.0
                    input_price = pricing.get("input_price_per_1m")
                    output_price = pricing.get("output_price_per_1m")
                    fixed_price = pricing.get("fixed_price_per_unit")
                    
                    self._pricing_cache[model_name] = {
                        "model_name": pricing.get("model_name"),
                        "model_type": pricing.get("model_type"),
                        "input_price_per_1m": float(input_price) if input_price is not None else 0.0,
                        "output_price_per_1m": float(output_price) if output_price is not None else 0.0,
                        "fixed_price_per_unit": float(fixed_price) if fixed_price is not None else 0.0,
                        "unit_type": pricing.get("unit_type", "token"),
                        "provider": pricing.get("provider", "openai"),
                        "effective_date": pricing.get("effective_date")
                    }
                logger.info(f"Loaded {len(self._pricing_cache)} active pricing configurations into cache")
            else:
                logger.warning("No active pricing configurations found in database")
            
            self._cache_loaded = True
        except Exception as e:
            logger.error(f"Error loading pricing cache: {str(e)}")
            self._cache_loaded = False
    
    def refresh_pricing_cache(self) -> bool:
        """Refresh pricing cache from database"""
        try:
            self._load_pricing_cache()
            logger.info("Pricing cache refreshed successfully")
            return True
        except Exception as e:
            logger.error(f"Error refreshing pricing cache: {str(e)}")
            return False
    
    def get_pricing(self, model_name: str, provider: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Get pricing configuration for a model
        
        Args:
            model_name: Name of the model (e.g., 'gpt-4', 'dall-e-3')
            provider: Optional provider filter
            
        Returns:
            Pricing configuration dict or None if not found
        """
        if not self._cache_loaded:
            self._load_pricing_cache()
        
        # Normalize model name (lowercase, handle variations)
        model_name_lower = model_name.lower().strip()
        
        # Try exact match first
        pricing = self._pricing_cache.get(model_name_lower)
        
        # Try variations if exact match not found
        if not pricing:
            # Handle common variations
            variations = {
                "gpt-4": ["gpt4", "gpt_4"],
                "gpt-4-turbo": ["gpt4-turbo", "gpt4turbo", "gpt_4_turbo"],
                "gpt-4o": ["gpt4o", "gpt_4o", "gpt-4-o"],
                "gpt-3.5-turbo": ["gpt3.5-turbo", "gpt35turbo", "gpt_3_5_turbo"],
                "dall-e-3": ["dalle3", "dalle-3", "dall_e_3"],
                "dall-e-2": ["dalle2", "dalle-2", "dall_e_2"]
            }
            
            for key, variants in variations.items():
                if model_name_lower in variants or model_name_lower == key:
                    pricing = self._pricing_cache.get(key)
                    if pricing:
                        break
        
        # Filter by provider if specified
        if pricing and provider:
            if pricing.get("provider", "").lower() != provider.lower():
                return None
        
        if not pricing:
            logger.warning(f"Pricing not found for model: {model_name} (provider: {provider})")
            logger.warning(f"Available models in cache: {list(self._pricing_cache.keys())}")
        
        return pricing
    
    def calculate_token_cost(
        self, 
        model_name: str, 
        input_tokens: int, 
        output_tokens: int
    ) -> Dict[str, float]:
        """
        Calculate cost for token-based models (chat completions)
        
        Args:
            model_name: Name of the model
            input_tokens: Number of input tokens
            output_tokens: Number of output tokens
            
        Returns:
            Dict with input_cost, output_cost, total_cost (all rounded to 6 decimals)
        """
        # Validate token counts
        if input_tokens < 0 or output_tokens < 0:
            logger.warning(f"Invalid token counts: input={input_tokens}, output={output_tokens}")
            input_tokens = max(0, input_tokens)
            output_tokens = max(0, output_tokens)
        
        # Get pricing
        pricing = self.get_pricing(model_name)
        
        if not pricing:
            logger.warning(f"No pricing found for {model_name}, using zero cost")
            logger.warning(f"Cache contains {len(self._pricing_cache)} models: {list(self._pricing_cache.keys())[:10]}")
            return {
                "input_cost": 0.0,
                "output_cost": 0.0,
                "total_cost": 0.0
            }
        
        # Calculate costs: (tokens / 1,000,000) × price_per_1M
        input_price = pricing.get("input_price_per_1m", 0.0)
        output_price = pricing.get("output_price_per_1m", 0.0)
        
        # Log if prices are zero to help debug
        if input_price == 0.0 and output_price == 0.0:
            logger.warning(f"Pricing found for {model_name} but both input and output prices are 0.0. Pricing data: {pricing}")
        
        input_cost = (input_tokens / 1_000_000) * input_price
        output_cost = (output_tokens / 1_000_000) * output_price
        total_cost = input_cost + output_cost
        
        logger.debug(f"Cost calculation for {model_name}: input_tokens={input_tokens}, output_tokens={output_tokens}, input_price={input_price}, output_price={output_price}, total_cost={total_cost}")
        
        return {
            "input_cost": round(input_cost, 6),
            "output_cost": round(output_cost, 6),
            "total_cost": round(total_cost, 6)
        }
    
    def calculate_image_cost(
        self, 
        model_name: str, 
        image_count: int = 1, 
        size: Optional[str] = None,
        input_tokens: int = 0,
        output_tokens: int = 0
    ) -> Dict[str, float]:
        """
        Calculate cost for image generation models
        Supports both fixed pricing (DALL-E) and token-based pricing (Gemini)
        
        Args:
            model_name: Name of the model (e.g., 'dall-e-3', 'gemini-2.5-flash-image')
            image_count: Number of images generated
            size: Optional image size (e.g., '1024x1024', '1024x1792')
            input_tokens: Number of input tokens (for token-based models like Gemini)
            output_tokens: Number of output tokens (for token-based models like Gemini)
            
        Returns:
            Dict with input_cost, output_cost, total_cost (all rounded to 6 decimals)
        """
        # Validate image count
        if image_count < 0:
            logger.warning(f"Invalid image count: {image_count}")
            image_count = max(0, image_count)
        
        # Handle size-specific models (DALL-E 3 HD)
        if size and "1792" in size and "dall-e-3" in model_name.lower():
            model_name = "dall-e-3-hd"
        
        # Get pricing
        pricing = self.get_pricing(model_name)
        
        if not pricing:
            logger.warning(f"No pricing found for {model_name}, using zero cost")
            return {
                "input_cost": 0.0,
                "output_cost": 0.0,
                "total_cost": 0.0
            }
        
        # Check if model uses token-based pricing (like Gemini) or fixed pricing (like DALL-E)
        unit_type = pricing.get("unit_type", "token")
        has_token_pricing = pricing.get("input_price_per_1m", 0.0) > 0 or pricing.get("output_price_per_1m", 0.0) > 0
        has_fixed_pricing = pricing.get("fixed_price_per_unit", 0.0) > 0
        
        if has_token_pricing and (input_tokens > 0 or output_tokens > 0):
            # Token-based pricing (Gemini image generation)
            input_price = pricing.get("input_price_per_1m", 0.0)
            output_price = pricing.get("output_price_per_1m", 0.0)
            
            input_cost = (input_tokens / 1_000_000) * input_price
            output_cost = (output_tokens / 1_000_000) * output_price
            total_cost = input_cost + output_cost
            
            return {
                "input_cost": round(input_cost, 6),
                "output_cost": round(output_cost, 6),
                "total_cost": round(total_cost, 6)
            }
        elif has_fixed_pricing:
            # Fixed pricing per image (DALL-E)
            fixed_price = pricing.get("fixed_price_per_unit", 0.0)
            total_cost = fixed_price * image_count
            
            return {
                "input_cost": round(total_cost, 6),  # For fixed pricing, all cost goes to input_cost
                "output_cost": 0.0,
                "total_cost": round(total_cost, 6)
            }
        else:
            logger.warning(f"No valid pricing found for {model_name}, using zero cost")
            return {
                "input_cost": 0.0,
                "output_cost": 0.0,
                "total_cost": 0.0
            }
    
    def get_all_pricing(self) -> Dict[str, Dict[str, Any]]:
        """Get all pricing configurations from cache"""
        if not self._cache_loaded:
            self._load_pricing_cache()
        return self._pricing_cache.copy()
    
    def is_cache_loaded(self) -> bool:
        """Check if pricing cache is loaded"""
        return self._cache_loaded

