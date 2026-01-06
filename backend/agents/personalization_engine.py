"""
Personalization Engine
Deep personalization system for content generation
"""

import os
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
from supabase import create_client, Client
import openai

logger = logging.getLogger(__name__)


class PersonalizationEngine:
    """Deep personalization system for content"""
    
    def __init__(
        self,
        supabase: Client,
        openai_client: Optional[openai.OpenAI]
    ):
        """
        Initialize Personalization Engine
        
        Args:
            supabase: Supabase client
            openai_client: OpenAI client for AI operations
        """
        self.supabase = supabase
        self.openai_client = openai_client
    
    async def get_recommendations(self, user_id: str) -> Dict[str, Any]:
        """
        Get personalized content recommendations
        
        Args:
            user_id: User ID
        
        Returns:
            Personalized recommendations
        """
        try:
            # Load user profile
            profile = await self._load_profile(user_id)
            
            # Analyze brand consistency needs
            brand_consistency = self._analyze_brand_consistency(profile)
            
            # Get audience insights
            audience_insights = await self._get_audience_insights(user_id, profile)
            
            # Get content preferences
            content_preferences = await self._get_content_preferences(user_id)
            
            # Generate recommendations
            recommendations = {
                "brand_consistency": brand_consistency,
                "audience_targeting": audience_insights,
                "content_preferences": content_preferences,
                "recommended_themes": await self._recommend_themes(user_id, profile),
                "recommended_post_types": await self._recommend_post_types(user_id),
                "optimal_posting_times": await self._recommend_posting_times(user_id),
                "hashtag_strategy": await self._recommend_hashtags(user_id, profile)
            }
            
            return recommendations
            
        except Exception as e:
            logger.error(f"Error getting recommendations: {e}")
            return {"error": str(e)}
    
    async def _load_profile(self, user_id: str) -> Dict[str, Any]:
        """Load user profile"""
        try:
            profile_fields = [
                "business_name", "business_description", "brand_tone", "brand_voice",
                "industry", "target_audience", "unique_value_proposition",
                "primary_color", "secondary_color", "brand_colors", "logo_url",
                "posting_frequency", "preferred_content_types", "content_themes"
            ]
            
            response = self.supabase.table("profiles").select(
                ", ".join(profile_fields)
            ).eq("id", user_id).execute()
            
            if response.data and len(response.data) > 0:
                return response.data[0]
            return {}
        except Exception as e:
            logger.error(f"Error loading profile: {e}")
            return {}
    
    def _analyze_brand_consistency(self, profile: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze brand consistency requirements"""
        brand_tone = profile.get("brand_tone", "Professional")
        brand_voice = profile.get("brand_voice", "Professional and friendly")
        primary_color = profile.get("primary_color")
        secondary_color = profile.get("secondary_color")
        brand_colors = profile.get("brand_colors", [])
        
        return {
            "tone": brand_tone,
            "voice": brand_voice,
            "colors": {
                "primary": primary_color,
                "secondary": secondary_color,
                "palette": brand_colors
            },
            "consistency_score": self._calculate_consistency_score(profile),
            "recommendations": self._get_brand_recommendations(profile)
        }
    
    def _calculate_consistency_score(self, profile: Dict[str, Any]) -> int:
        """Calculate brand consistency score"""
        score = 0
        
        if profile.get("brand_tone"):
            score += 20
        if profile.get("brand_voice"):
            score += 20
        if profile.get("primary_color"):
            score += 20
        if profile.get("secondary_color"):
            score += 20
        if profile.get("logo_url"):
            score += 20
        
        return score
    
    def _get_brand_recommendations(self, profile: Dict[str, Any]) -> List[str]:
        """Get brand consistency recommendations"""
        recommendations = []
        
        if not profile.get("brand_tone"):
            recommendations.append("Define your brand tone for consistent messaging")
        
        if not profile.get("primary_color"):
            recommendations.append("Set brand colors for visual consistency")
        
        if not profile.get("logo_url"):
            recommendations.append("Upload a logo for brand recognition")
        
        return recommendations
    
    async def _get_audience_insights(
        self,
        user_id: str,
        profile: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Get audience targeting insights"""
        target_audience = profile.get("target_audience", [])
        if isinstance(target_audience, str):
            target_audience = [target_audience]
        
        industry = profile.get("industry", [])
        if isinstance(industry, str):
            industry = [industry]
        
        return {
            "target_audience": target_audience,
            "industry": industry,
            "language_style": self._determine_language_style(target_audience),
            "content_topics": self._determine_content_topics(target_audience, industry),
            "cta_strategy": self._determine_cta_strategy(target_audience)
        }
    
    def _determine_language_style(self, audience: List[str]) -> str:
        """Determine appropriate language style for audience"""
        if not audience:
            return "Professional and friendly"
        
        audience_str = " ".join(audience).lower()
        
        if any(word in audience_str for word in ["professional", "business", "b2b"]):
            return "Professional and formal"
        elif any(word in audience_str for word in ["young", "millennial", "gen z"]):
            return "Casual and engaging"
        elif any(word in audience_str for word in ["senior", "mature"]):
            return "Clear and respectful"
        else:
            return "Professional and friendly"
    
    def _determine_content_topics(
        self,
        audience: List[str],
        industry: List[str]
    ) -> List[str]:
        """Determine relevant content topics"""
        topics = []
        
        if audience:
            topics.extend([
                f"Content for {audience[0]}",
                f"Tips relevant to {audience[0]}"
            ])
        
        if industry:
            topics.extend([
                f"{industry[0]} industry insights",
                f"Trends in {industry[0]}"
            ])
        
        if not topics:
            topics = ["Business insights", "Industry trends", "Customer value"]
        
        return topics
    
    def _determine_cta_strategy(self, audience: List[str]) -> str:
        """Determine CTA strategy based on audience"""
        if not audience:
            return "Clear and direct"
        
        audience_str = " ".join(audience).lower()
        
        if any(word in audience_str for word in ["professional", "business"]):
            return "Professional and value-focused"
        elif any(word in audience_str for word in ["young", "millennial"]):
            return "Engaging and action-oriented"
        else:
            return "Clear and compelling"
    
    async def _get_content_preferences(self, user_id: str) -> Dict[str, Any]:
        """Get learned content preferences"""
        try:
            # Analyze past content performance
            response = self.supabase.table("content_posts").select(
                "*, content_campaigns!inner(*)"
            ).eq("content_campaigns.user_id", user_id).order(
                "created_at", desc=True
            ).limit(30).execute()
            
            posts = response.data if response.data else []
            
            if not posts:
                return {
                    "preferred_types": [],
                    "optimal_length": "medium",
                    "hashtag_count": 5,
                    "emoji_usage": "moderate"
                }
            
            # Analyze post types
            post_types = {}
            for post in posts:
                post_type = post.get("post_type", "unknown")
                post_types[post_type] = post_types.get(post_type, 0) + 1
            
            preferred_types = sorted(
                post_types.items(),
                key=lambda x: x[1],
                reverse=True
            )[:3]
            
            # Analyze content length
            lengths = [len(post.get("content", "")) for post in posts]
            avg_length = sum(lengths) / len(lengths) if lengths else 0
            
            if avg_length < 200:
                optimal_length = "short"
            elif avg_length < 500:
                optimal_length = "medium"
            else:
                optimal_length = "long"
            
            # Analyze hashtag usage
            hashtag_counts = [
                len(post.get("hashtags", [])) for post in posts if post.get("hashtags")
            ]
            avg_hashtags = int(sum(hashtag_counts) / len(hashtag_counts)) if hashtag_counts else 5
            
            return {
                "preferred_types": [pt[0] for pt in preferred_types],
                "optimal_length": optimal_length,
                "hashtag_count": avg_hashtags,
                "emoji_usage": "moderate"
            }
            
        except Exception as e:
            logger.error(f"Error getting content preferences: {e}")
            return {
                "preferred_types": [],
                "optimal_length": "medium",
                "hashtag_count": 5,
                "emoji_usage": "moderate"
            }
    
    async def _recommend_themes(
        self,
        user_id: str,
        profile: Dict[str, Any]
    ) -> List[str]:
        """Recommend content themes"""
        industry = profile.get("industry", [])
        if isinstance(industry, str):
            industry = [industry]
        
        target_audience = profile.get("target_audience", [])
        if isinstance(target_audience, str):
            target_audience = [target_audience]
        
        # Use AI if available
        if self.openai_client:
            try:
                prompt = f"""Based on this business profile, recommend 5 content themes:

Industry: {industry[0] if industry else 'General'}
Target Audience: {target_audience[0] if target_audience else 'General'}
Business: {profile.get('business_name', 'Business')}

Return ONLY a comma-separated list of 5 theme ideas (3-5 words each)."""
                
                response = self.openai_client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=150,
                    temperature=0.8
                )
                
                themes_text = response.choices[0].message.content.strip()
                themes = [t.strip() for t in themes_text.split(",") if t.strip()]
                
                if themes:
                    return themes[:5]
            except Exception as e:
                logger.error(f"Error generating theme recommendations: {e}")
        
        # Fallback
        return [
            "Business insights and tips",
            "Industry trends and updates",
            "Customer success stories",
            "Behind the scenes content",
            "Educational content"
        ]
    
    async def _recommend_post_types(self, user_id: str) -> List[str]:
        """Recommend post types based on performance"""
        try:
            response = self.supabase.table("content_posts").select(
                "*, content_campaigns!inner(*)"
            ).eq("content_campaigns.user_id", user_id).order(
                "created_at", desc=True
            ).limit(20).execute()
            
            posts = response.data if response.data else []
            
            if not posts:
                return ["Educational tips", "Promotional offer", "Behind-the-scenes"]
            
            post_types = {}
            for post in posts:
                post_type = post.get("post_type", "unknown")
                post_types[post_type] = post_types.get(post_type, 0) + 1
            
            recommended = sorted(
                post_types.items(),
                key=lambda x: x[1],
                reverse=True
            )[:5]
            
            return [pt[0] for pt in recommended]
            
        except Exception as e:
            logger.error(f"Error recommending post types: {e}")
            return ["Educational tips", "Promotional offer", "Behind-the-scenes"]
    
    async def _recommend_posting_times(self, user_id: str) -> List[str]:
        """Recommend optimal posting times"""
        try:
            response = self.supabase.table("content_posts").select(
                "*, content_campaigns!inner(*)"
            ).eq("content_campaigns.user_id", user_id).order(
                "created_at", desc=True
            ).limit(30).execute()
            
            posts = response.data if response.data else []
            
            if not posts:
                return ["09:00:00", "12:00:00", "18:00:00"]
            
            # Analyze scheduled times
            times = {}
            for post in posts:
                scheduled_time = post.get("scheduled_time")
                if scheduled_time:
                    if isinstance(scheduled_time, str):
                        hour = scheduled_time.split(":")[0]
                    else:
                        hour = str(scheduled_time.hour)
                    times[hour] = times.get(hour, 0) + 1
            
            if times:
                top_times = sorted(
                    times.items(),
                    key=lambda x: x[1],
                    reverse=True
                )[:3]
                return [f"{t[0]}:00:00" for t in top_times]
            
            return ["09:00:00", "12:00:00", "18:00:00"]
            
        except Exception as e:
            logger.error(f"Error recommending posting times: {e}")
            return ["09:00:00", "12:00:00", "18:00:00"]
    
    async def _recommend_hashtags(
        self,
        user_id: str,
        profile: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Recommend hashtag strategy"""
        try:
            # Analyze past hashtag usage
            response = self.supabase.table("content_posts").select(
                "hashtags, content_campaigns!inner(*)"
            ).eq("content_campaigns.user_id", user_id).order(
                "created_at", desc=True
            ).limit(20).execute()
            
            posts = response.data if response.data else []
            
            hashtag_frequency = {}
            for post in posts:
                hashtags = post.get("hashtags", [])
                if isinstance(hashtags, list):
                    for tag in hashtags:
                        hashtag_frequency[tag] = hashtag_frequency.get(tag, 0) + 1
            
            top_hashtags = sorted(
                hashtag_frequency.items(),
                key=lambda x: x[1],
                reverse=True
            )[:10]
            
            industry = profile.get("industry", [])
            if isinstance(industry, str):
                industry = [industry]
            
            return {
                "top_hashtags": [h[0] for h in top_hashtags],
                "recommended_count": 5,
                "industry_tags": self._get_industry_tags(industry[0] if industry else "General"),
                "strategy": "Mix of branded, industry, and trending hashtags"
            }
            
        except Exception as e:
            logger.error(f"Error recommending hashtags: {e}")
            return {
                "top_hashtags": [],
                "recommended_count": 5,
                "industry_tags": [],
                "strategy": "Use 5-7 relevant hashtags"
            }
    
    def _get_industry_tags(self, industry: str) -> List[str]:
        """Get industry-specific hashtag suggestions"""
        industry_map = {
            "Technology": ["#Tech", "#Innovation", "#Digital"],
            "Healthcare": ["#Health", "#Wellness", "#Medical"],
            "Education": ["#Education", "#Learning", "#Teaching"],
            "Retail": ["#Retail", "#Shopping", "#Fashion"],
            "Food & Beverage": ["#Food", "#Restaurant", "#Culinary"]
        }
        
        return industry_map.get(industry, ["#Business", "#Success", "#Growth"])

