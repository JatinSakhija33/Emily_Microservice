"""
Performance Learner
AI-powered learning from content performance
"""

import os
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from supabase import create_client, Client
import openai

logger = logging.getLogger(__name__)


class PerformanceLearner:
    """AI-powered learning from content performance"""
    
    def __init__(
        self,
        supabase: Client,
        openai_client: Optional[openai.OpenAI]
    ):
        """
        Initialize Performance Learner
        
        Args:
            supabase: Supabase client
            openai_client: OpenAI client for AI operations
        """
        self.supabase = supabase
        self.openai_client = openai_client
    
    async def analyze_user_performance(self, user_id: str) -> Dict[str, Any]:
        """
        Analyze user's content performance
        
        Args:
            user_id: User ID
        
        Returns:
            Performance analysis results
        """
        try:
            # Get past content posts
            posts = await self._get_user_posts(user_id)
            
            if not posts:
                return {
                    "total_posts": 0,
                    "insights": [],
                    "recommendations": [],
                    "patterns": {}
                }
            
            # Analyze patterns
            patterns = await self._identify_patterns(posts)
            
            # Generate insights
            insights = await self._generate_insights(posts, patterns)
            
            # Generate recommendations
            recommendations = await self._generate_recommendations(posts, patterns)
            
            return {
                "total_posts": len(posts),
                "insights": insights,
                "recommendations": recommendations,
                "patterns": patterns,
                "analyzed_at": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error analyzing performance: {e}")
            return {"error": str(e)}
    
    async def _get_user_posts(self, user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Get user's content posts"""
        try:
            response = self.supabase.table("content_posts").select(
                "*, content_campaigns!inner(*)"
            ).eq("content_campaigns.user_id", user_id).order(
                "created_at", desc=True
            ).limit(limit).execute()
            
            return response.data if response.data else []
            
        except Exception as e:
            logger.error(f"Error getting user posts: {e}")
            return []
    
    async def _identify_patterns(self, posts: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Identify patterns in content performance"""
        patterns = {
            "top_platforms": {},
            "top_post_types": {},
            "top_posting_times": {},
            "content_length_distribution": {},
            "hashtag_usage": {},
            "top_themes": {}
        }
        
        if not posts:
            return patterns
        
        # Analyze platforms
        for post in posts:
            platform = post.get("platform", "unknown")
            patterns["top_platforms"][platform] = patterns["top_platforms"].get(platform, 0) + 1
        
        # Analyze post types
        for post in posts:
            post_type = post.get("post_type", "unknown")
            patterns["top_post_types"][post_type] = patterns["top_post_types"].get(post_type, 0) + 1
        
        # Analyze posting times
        for post in posts:
            scheduled_time = post.get("scheduled_time")
            if scheduled_time:
                if isinstance(scheduled_time, str):
                    hour = scheduled_time.split(":")[0]
                else:
                    hour = str(scheduled_time.hour)
                patterns["top_posting_times"][hour] = patterns["top_posting_times"].get(hour, 0) + 1
        
        # Analyze content length
        lengths = []
        for post in posts:
            content = post.get("content", "")
            if content:
                lengths.append(len(content))
        
        if lengths:
            avg_length = sum(lengths) / len(lengths)
            patterns["content_length_distribution"] = {
                "average": int(avg_length),
                "min": min(lengths),
                "max": max(lengths)
            }
        
        # Analyze hashtag usage
        hashtag_counts = []
        for post in posts:
            hashtags = post.get("hashtags", [])
            if isinstance(hashtags, list):
                hashtag_counts.append(len(hashtags))
        
        if hashtag_counts:
            patterns["hashtag_usage"] = {
                "average": sum(hashtag_counts) / len(hashtag_counts),
                "min": min(hashtag_counts),
                "max": max(hashtag_counts)
            }
        
        # Analyze themes from metadata
        themes = {}
        for post in posts:
            metadata = post.get("metadata", {})
            if isinstance(metadata, dict):
                topic = metadata.get("topic")
                if topic:
                    themes[topic] = themes.get(topic, 0) + 1
        
        patterns["top_themes"] = dict(sorted(
            themes.items(),
            key=lambda x: x[1],
            reverse=True
        )[:5])
        
        return patterns
    
    async def _generate_insights(
        self,
        posts: List[Dict[str, Any]],
        patterns: Dict[str, Any]
    ) -> List[str]:
        """Generate performance insights"""
        insights = []
        
        if not posts:
            return ["No content history available for analysis"]
        
        # Platform insights
        top_platforms = sorted(
            patterns["top_platforms"].items(),
            key=lambda x: x[1],
            reverse=True
        )
        
        if top_platforms:
            insights.append(
                f"Most content is posted on {top_platforms[0][0]} ({top_platforms[0][1]} posts)"
            )
        
        # Post type insights
        top_types = sorted(
            patterns["top_post_types"].items(),
            key=lambda x: x[1],
            reverse=True
        )
        
        if top_types:
            insights.append(
                f"Most common post type: {top_types[0][0]} ({top_types[0][1]} posts)"
            )
        
        # Posting time insights
        top_times = sorted(
            patterns["top_posting_times"].items(),
            key=lambda x: x[1],
            reverse=True
        )
        
        if top_times:
            insights.append(
                f"Most frequent posting time: {top_times[0][0]}:00 ({top_times[0][1]} posts)"
            )
        
        # Content length insights
        length_dist = patterns.get("content_length_distribution", {})
        if length_dist:
            avg = length_dist.get("average", 0)
            if avg < 200:
                insights.append("Content tends to be short and concise")
            elif avg < 500:
                insights.append("Content length is moderate and balanced")
            else:
                insights.append("Content tends to be longer and detailed")
        
        # Hashtag insights
        hashtag_usage = patterns.get("hashtag_usage", {})
        if hashtag_usage:
            avg = hashtag_usage.get("average", 0)
            insights.append(f"Average hashtag usage: {avg:.1f} hashtags per post")
        
        return insights
    
    async def _generate_recommendations(
        self,
        posts: List[Dict[str, Any]],
        patterns: Dict[str, Any]
    ) -> List[str]:
        """Generate performance-based recommendations"""
        recommendations = []
        
        if not posts:
            return ["Start creating content to get performance insights"]
        
        # Platform diversity
        platforms = patterns.get("top_platforms", {})
        if len(platforms) == 1:
            recommendations.append(
                "Consider diversifying across multiple platforms for broader reach"
            )
        
        # Post type diversity
        post_types = patterns.get("top_post_types", {})
        if len(post_types) < 3:
            recommendations.append(
                "Try experimenting with different post types for variety"
            )
        
        # Posting time optimization
        posting_times = patterns.get("top_posting_times", {})
        if posting_times:
            # Check if posting times are spread out
            time_hours = [int(h) for h in posting_times.keys()]
            time_range = max(time_hours) - min(time_hours) if time_hours else 0
            
            if time_range < 6:
                recommendations.append(
                    "Consider spreading posts across different times of day"
                )
        
        # Content length recommendations
        length_dist = patterns.get("content_length_distribution", {})
        if length_dist:
            avg = length_dist.get("average", 0)
            if avg < 150:
                recommendations.append(
                    "Consider adding more detail to posts for better engagement"
                )
            elif avg > 800:
                recommendations.append(
                    "Consider making posts more concise for better readability"
                )
        
        # Hashtag recommendations
        hashtag_usage = patterns.get("hashtag_usage", {})
        if hashtag_usage:
            avg = hashtag_usage.get("average", 0)
            if avg < 3:
                recommendations.append(
                    "Consider using more hashtags (5-7 recommended) for better discoverability"
                )
            elif avg > 10:
                recommendations.append(
                    "Consider reducing hashtag count (5-7 optimal) to avoid looking spammy"
                )
        
        # Theme diversity
        themes = patterns.get("top_themes", {})
        if len(themes) < 3:
            recommendations.append(
                "Try exploring different content themes for audience variety"
            )
        
        if not recommendations:
            recommendations.append("Keep creating consistent, quality content")
        
        return recommendations
    
    async def learn_from_performance(
        self,
        user_id: str,
        post_id: str,
        performance_metrics: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Learn from individual post performance
        
        Args:
            user_id: User ID
            post_id: Post ID
            performance_metrics: Performance metrics (engagement, views, etc.)
        
        Returns:
            Learning insights
        """
        try:
            # Get post details
            response = self.supabase.table("content_posts").select("*").eq(
                "id", post_id
            ).execute()
            
            if not response.data:
                return {"error": "Post not found"}
            
            post = response.data[0]
            
            # Store performance data in metadata
            metadata = post.get("metadata", {})
            if not isinstance(metadata, dict):
                metadata = {}
            
            metadata["performance"] = performance_metrics
            metadata["performance_analyzed_at"] = datetime.now().isoformat()
            
            # Update post metadata
            self.supabase.table("content_posts").update({
                "metadata": metadata
            }).eq("id", post_id).execute()
            
            # Generate insights
            insights = await self._generate_post_insights(post, performance_metrics)
            
            return {
                "success": True,
                "insights": insights,
                "learned_at": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error learning from performance: {e}")
            return {"error": str(e)}
    
    async def _generate_post_insights(
        self,
        post: Dict[str, Any],
        metrics: Dict[str, Any]
    ) -> List[str]:
        """Generate insights for a specific post"""
        insights = []
        
        # Analyze engagement
        engagement = metrics.get("engagement_rate", 0)
        if engagement > 0.05:  # 5% engagement rate
            insights.append("This post performed exceptionally well!")
        elif engagement > 0.02:  # 2% engagement rate
            insights.append("This post performed above average")
        elif engagement < 0.01:  # 1% engagement rate
            insights.append("This post had lower engagement - consider different approach")
        
        # Analyze post type
        post_type = post.get("post_type")
        if post_type:
            insights.append(f"Post type '{post_type}' generated this performance")
        
        # Analyze timing
        scheduled_time = post.get("scheduled_time")
        if scheduled_time:
            insights.append(f"Posted at {scheduled_time} - note this timing")
        
        return insights

