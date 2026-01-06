"""
Content Strategy Engine
AI-powered content planning and strategy generation
"""

import os
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from supabase import create_client, Client
import openai

logger = logging.getLogger(__name__)


class ContentStrategyEngine:
    """Intelligent content strategy planning system"""
    
    def __init__(
        self,
        supabase: Client,
        openai_client: Optional[openai.OpenAI],
        business_context: Dict[str, Any]
    ):
        """
        Initialize Content Strategy Engine
        
        Args:
            supabase: Supabase client
            openai_client: OpenAI client for AI operations
            business_context: Business context from user profile
        """
        self.supabase = supabase
        self.openai_client = openai_client
        self.business_context = business_context
    
    async def generate_strategy(
        self,
        user_id: str,
        options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Generate comprehensive content strategy
        
        Args:
            user_id: User ID
            options: Optional generation options
        
        Returns:
            Content strategy dictionary
        """
        try:
            # Analyze user profile and performance
            performance_data = await self._analyze_past_performance(user_id)
            
            # Determine platforms
            platforms = self._determine_platforms(user_id, options)
            
            # Generate content themes
            themes = await self._generate_content_themes(user_id, performance_data)
            
            # Determine content mix
            content_mix = self._determine_content_mix(performance_data, options)
            
            # Determine posting frequency
            posting_frequency = self._determine_posting_frequency(user_id, options)
            
            # Generate campaign name
            campaign_name = self._generate_campaign_name()
            
            strategy = {
                "campaign_name": campaign_name,
                "platforms": platforms,
                "themes": themes,
                "content_mix": content_mix,
                "posting_frequency": posting_frequency,
                "posts_per_platform": posting_frequency.get("posts_per_platform", 7),
                "performance_insights": performance_data,
                "generated_at": datetime.now().isoformat()
            }
            
            return strategy
            
        except Exception as e:
            logger.error(f"Error generating strategy: {e}")
            # Return default strategy
            return self._get_default_strategy(user_id, options)
    
    async def generate_calendar(
        self,
        user_id: str,
        strategy: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Generate content calendar based on strategy
        
        Args:
            user_id: User ID
            strategy: Generated strategy
        
        Returns:
            List of calendar items
        """
        try:
            platforms = strategy.get("platforms", ["Instagram"])
            posts_per_platform = strategy.get("posts_per_platform", 7)
            themes = strategy.get("themes", ["General content"])
            content_mix = strategy.get("content_mix", {})
            
            calendar = []
            today = datetime.now()
            
            # Distribute posts across the week
            total_posts = posts_per_platform * len(platforms)
            posts_per_day = max(1, total_posts // 7)
            
            post_types = self._get_post_types_from_mix(content_mix)
            
            post_idx = 0
            for day_offset in range(7):
                post_date = today + timedelta(days=day_offset)
                
                # Determine optimal posting times for this day
                posting_times = self._get_optimal_posting_times(
                    user_id,
                    post_date.weekday()
                )
                
                posts_for_day = min(posts_per_day, total_posts - post_idx)
                
                for post_num in range(posts_for_day):
                    if post_idx >= total_posts:
                        break
                    
                    # Select platform (rotate through platforms)
                    platform = platforms[post_idx % len(platforms)]
                    
                    # Select theme (rotate through themes)
                    theme = themes[post_idx % len(themes)]
                    
                    # Select post type (rotate through types)
                    post_type = post_types[post_idx % len(post_types)]
                    
                    # Select posting time
                    time_slot = posting_times[post_num % len(posting_times)]
                    
                    calendar.append({
                        "date": post_date.date().isoformat(),
                        "time": time_slot,
                        "platform": platform,
                        "content_type": "static_post",
                        "topic": theme,
                        "post_type": post_type
                    })
                    
                    post_idx += 1
            
            return calendar
            
        except Exception as e:
            logger.error(f"Error generating calendar: {e}")
            return self._get_default_calendar(strategy)
    
    async def _analyze_past_performance(self, user_id: str) -> Dict[str, Any]:
        """Analyze past content performance"""
        try:
            # Query past content posts
            response = self.supabase.table("content_posts").select(
                "*, content_campaigns!inner(*)"
            ).eq("content_campaigns.user_id", user_id).order(
                "created_at", desc=True
            ).limit(50).execute()
            
            posts = response.data if response.data else []
            
            if not posts:
                return {
                    "total_posts": 0,
                    "top_platforms": [],
                    "top_post_types": [],
                    "best_posting_times": [],
                    "successful_themes": []
                }
            
            # Analyze platforms
            platforms = {}
            post_types = {}
            posting_times = {}
            
            for post in posts:
                platform = post.get("platform", "unknown")
                platforms[platform] = platforms.get(platform, 0) + 1
                
                post_type = post.get("post_type", "unknown")
                post_types[post_type] = post_types.get(post_type, 0) + 1
                
                scheduled_time = post.get("scheduled_time")
                if scheduled_time:
                    hour = scheduled_time.split(":")[0] if isinstance(scheduled_time, str) else scheduled_time.hour
                    posting_times[hour] = posting_times.get(hour, 0) + 1
            
            # Get top performers
            top_platforms = sorted(
                platforms.items(),
                key=lambda x: x[1],
                reverse=True
            )[:3]
            
            top_post_types = sorted(
                post_types.items(),
                key=lambda x: x[1],
                reverse=True
            )[:5]
            
            best_times = sorted(
                posting_times.items(),
                key=lambda x: x[1],
                reverse=True
            )[:3]
            
            return {
                "total_posts": len(posts),
                "top_platforms": [p[0] for p in top_platforms],
                "top_post_types": [p[0] for p in top_post_types],
                "best_posting_times": [f"{t[0]}:00" for t in best_times],
                "successful_themes": []
            }
            
        except Exception as e:
            logger.error(f"Error analyzing performance: {e}")
            return {}
    
    def _determine_platforms(
        self,
        user_id: str,
        options: Optional[Dict[str, Any]]
    ) -> List[str]:
        """Determine which platforms to generate content for"""
        if options and options.get("platforms"):
            return options["platforms"]
        
        try:
            # Get from user profile
            response = self.supabase.table("profiles").select(
                "social_media_platforms"
            ).eq("id", user_id).execute()
            
            if response.data and response.data[0].get("social_media_platforms"):
                platforms = response.data[0]["social_media_platforms"]
                if isinstance(platforms, list) and platforms:
                    return platforms
            
        except Exception as e:
            logger.error(f"Error getting platforms from profile: {e}")
        
        # Default platforms
        return ["Instagram"]
    
    async def _generate_content_themes(
        self,
        user_id: str,
        performance_data: Dict[str, Any]
    ) -> List[str]:
        """Generate content themes based on business and performance"""
        try:
            industry = self.business_context.get("industry", "General")
            if isinstance(industry, list):
                industry = industry[0] if industry else "General"
            
            target_audience = self.business_context.get("target_audience", "General audience")
            if isinstance(target_audience, list):
                target_audience = target_audience[0] if target_audience else "General audience"
            
            business_name = self.business_context.get("business_name", "Business")
            business_description = self.business_context.get("business_description", "")
            
            # Use AI to generate themes if OpenAI is available
            if self.openai_client:
                prompt = f"""Generate 5-7 content theme ideas for a business in the {industry} industry.

Business: {business_name}
Description: {business_description}
Target Audience: {target_audience}

Generate diverse, engaging content themes that would resonate with this audience. Each theme should be 3-5 words and actionable.

Return ONLY a comma-separated list of themes, no numbering or bullets."""
                
                try:
                    response = self.openai_client.chat.completions.create(
                        model="gpt-4o-mini",
                        messages=[{"role": "user", "content": prompt}],
                        max_tokens=200,
                        temperature=0.8
                    )
                    
                    themes_text = response.choices[0].message.content.strip()
                    themes = [t.strip() for t in themes_text.split(",") if t.strip()]
                    
                    if themes:
                        return themes[:7]
                except Exception as e:
                    logger.error(f"Error generating themes with AI: {e}")
            
            # Fallback to default themes
            return self._get_default_themes(industry, target_audience)
            
        except Exception as e:
            logger.error(f"Error generating themes: {e}")
            return ["Business insights", "Industry trends", "Customer success stories"]
    
    def _get_default_themes(
        self,
        industry: str,
        target_audience: str
    ) -> List[str]:
        """Get default themes based on industry"""
        default_themes = {
            "General": [
                "Business tips and insights",
                "Industry trends and updates",
                "Customer success stories",
                "Behind the scenes content",
                "Educational content",
                "Product or service highlights",
                "Community engagement"
            ]
        }
        
        return default_themes.get(industry, default_themes["General"])
    
    def _determine_content_mix(
        self,
        performance_data: Dict[str, Any],
        options: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Determine content mix percentages"""
        if options and options.get("content_mix"):
            return options["content_mix"]
        
        # Default balanced mix
        return {
            "educational": 40,
            "promotional": 20,
            "entertaining": 20,
            "behind_scenes": 10,
            "user_generated": 10
        }
    
    def _determine_posting_frequency(
        self,
        user_id: str,
        options: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Determine posting frequency"""
        if options and options.get("posts_per_platform"):
            return {
                "posts_per_platform": options["posts_per_platform"],
                "frequency": "custom"
            }
        
        try:
            # Get from profile
            response = self.supabase.table("profiles").select(
                "posting_frequency"
            ).eq("id", user_id).execute()
            
            if response.data and response.data[0].get("posting_frequency"):
                frequency = response.data[0]["posting_frequency"]
                # Map frequency to posts per week
                frequency_map = {
                    "daily": 7,
                    "5-6 times per week": 6,
                    "3-4 times per week": 4,
                    "1-2 times per week": 2,
                    "few times per month": 4
                }
                posts = frequency_map.get(frequency, 7)
                return {
                    "posts_per_platform": posts,
                    "frequency": frequency
                }
        except Exception as e:
            logger.error(f"Error getting posting frequency: {e}")
        
        # Default: daily posting
        return {
            "posts_per_platform": 7,
            "frequency": "daily"
        }
    
    def _get_post_types_from_mix(self, content_mix: Dict[str, Any]) -> List[str]:
        """Convert content mix to post types"""
        post_type_map = {
            "educational": "Educational tips",
            "promotional": "Promotional offer",
            "entertaining": "Meme / humor",
            "behind_scenes": "Behind-the-scenes",
            "user_generated": "User-generated content"
        }
        
        types = []
        for key, percentage in content_mix.items():
            if key in post_type_map:
                # Add post type proportionally
                count = max(1, int(percentage / 20))  # Rough estimate
                types.extend([post_type_map[key]] * count)
        
        if not types:
            types = ["Educational tips", "Promotional offer", "Behind-the-scenes"]
        
        return types
    
    def _get_optimal_posting_times(
        self,
        user_id: str,
        weekday: int
    ) -> List[str]:
        """Get optimal posting times for a weekday"""
        # Default optimal times (can be enhanced with timezone and analytics)
        default_times = [
            "09:00:00",  # Morning
            "12:00:00",  # Lunch
            "18:00:00",  # Evening
            "21:00:00"   # Night
        ]
        
        # Weekend adjustments
        if weekday >= 5:  # Saturday or Sunday
            return ["10:00:00", "14:00:00", "19:00:00"]
        
        return default_times
    
    def _generate_campaign_name(self) -> str:
        """Generate campaign name"""
        today = datetime.now()
        week_start = today - timedelta(days=today.weekday())
        return f"Weekly Content - {week_start.strftime('%B %d, %Y')}"
    
    def _get_default_strategy(
        self,
        user_id: str,
        options: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Get default strategy if generation fails"""
        platforms = self._determine_platforms(user_id, options)
        posting_frequency = self._determine_posting_frequency(user_id, options)
        
        return {
            "campaign_name": self._generate_campaign_name(),
            "platforms": platforms,
            "themes": ["Business insights", "Industry trends", "Customer stories"],
            "content_mix": {
                "educational": 40,
                "promotional": 20,
                "entertaining": 20,
                "behind_scenes": 10,
                "user_generated": 10
            },
            "posting_frequency": posting_frequency,
            "posts_per_platform": posting_frequency.get("posts_per_platform", 7),
            "performance_insights": {},
            "generated_at": datetime.now().isoformat()
        }
    
    def _get_default_calendar(
        self,
        strategy: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Get default calendar if generation fails"""
        platforms = strategy.get("platforms", ["Instagram"])
        posts_per_platform = strategy.get("posts_per_platform", 7)
        themes = strategy.get("themes", ["General content"])
        
        calendar = []
        today = datetime.now()
        
        for day_offset in range(7):
            post_date = today + timedelta(days=day_offset)
            for platform in platforms:
                for i in range(posts_per_platform // len(platforms)):
                    calendar.append({
                        "date": post_date.date().isoformat(),
                        "time": "12:00:00",
                        "platform": platform,
                        "content_type": "static_post",
                        "topic": themes[i % len(themes)],
                        "post_type": "Educational tips"
                    })
        
        return calendar[:posts_per_platform * len(platforms)]

