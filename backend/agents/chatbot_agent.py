"""
Business Chatbot Agent using LangGraph
Handles queries about scheduled posts, insights, and industry trends
"""

import os
import json
import time
import uuid
from typing import Dict, List, Any, Optional, Generator
from datetime import datetime, timedelta
import requests
from supabase import create_client, Client
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_core.prompts import ChatPromptTemplate
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from langchain_core.tools import tool
from typing import TypedDict
from dotenv import load_dotenv
from services.token_usage_service import TokenUsageService, FEATURE_TYPES

# Load environment variables
load_dotenv()

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(supabase_url, supabase_key)

# Initialize OpenAI
openai_api_key = os.getenv("OPENAI_API_KEY")
llm = ChatOpenAI(
    model="gpt-4o-mini",
    temperature=0.3,
    openai_api_key=openai_api_key
)

class ChatbotState(TypedDict):
    """State for the chatbot conversation"""
    messages: List[Dict[str, str]]
    user_id: Optional[str]
    intent: Optional[str]
    context: Dict[str, Any]
    response: Optional[str]
    current_query: Optional[str]
    classified_intent: Optional[str]  # The classified intent from the intent classification step

# Tools for the chatbot
@tool
def approve_draft_posts(user_id: str, post_ids: List[str]) -> Dict[str, Any]:
    """Approve draft posts to schedule them"""
    try:
        if not post_ids:
            return {
                "success": False,
                "error": "No post IDs provided",
                "approved_count": 0
            }
        
        # Update posts from draft to scheduled status
        result = supabase.table("content_posts").update({
            "status": "scheduled"
        }).in_("id", post_ids).execute()
        
        if result.data:
            return {
                "success": True,
                "approved_count": len(result.data),
                "approved_posts": result.data,
                "message": f"Successfully approved {len(result.data)} draft posts to scheduled status"
            }
        else:
            return {
                "success": False,
                "error": "No posts were updated",
                "approved_count": 0
            }
            
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "approved_count": 0
        }

@tool
def get_scheduled_posts(user_id: str, platform: str = "") -> Dict[str, Any]:
    """Get scheduled posts for a user, optionally filtered by platform"""
    try:
        # First get user's campaigns
        campaigns_response = supabase.table("content_campaigns").select("id").eq("user_id", user_id).execute()
        campaign_ids = [campaign["id"] for campaign in campaigns_response.data] if campaigns_response.data else []
        
        if not campaign_ids:
            return {
                "success": True,
                "scheduled_posts": [],
                "published_posts": [],
                "scheduled_count": 0,
                "published_count": 0,
                "message": "No campaigns found for user"
            }
        
        # Get truly scheduled posts (status = 'scheduled')
        scheduled_query = supabase.table("content_posts").select("*").in_("campaign_id", campaign_ids).eq("status", "scheduled")
        if platform and platform.strip():
            scheduled_query = scheduled_query.eq("platform", platform)
        
        scheduled_response = scheduled_query.order("scheduled_date", desc=False).order("scheduled_time", desc=False).execute()
        scheduled_posts = scheduled_response.data if scheduled_response.data else []
        
        # Get draft posts separately
        draft_query = supabase.table("content_posts").select("*").in_("campaign_id", campaign_ids).eq("status", "draft")
        if platform and platform.strip():
            draft_query = draft_query.eq("platform", platform)
        
        draft_response = draft_query.order("created_at", desc=True).execute()
        draft_posts = draft_response.data if draft_response.data else []
        
        # Get published posts for context
        published_query = supabase.table("content_posts").select("*").in_("campaign_id", campaign_ids).eq("status", "published")
        if platform and platform.strip():
            published_query = published_query.eq("platform", platform)
        
        published_response = published_query.order("created_at", desc=True).limit(5).execute()
        published_posts = published_response.data if published_response.data else []
        
        return {
            "success": True,
            "scheduled_posts": scheduled_posts,
            "draft_posts": draft_posts,
            "published_posts": published_posts,
            "scheduled_count": len(scheduled_posts),
            "draft_count": len(draft_posts),
            "published_count": len(published_posts)
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "scheduled_posts": [],
            "draft_posts": [],
            "published_posts": [],
            "scheduled_count": 0,
            "draft_count": 0,
            "published_count": 0
        }

@tool
def get_latest_insights(user_id: str, platform: str = None) -> Dict[str, Any]:
    """Get latest insights for posts from a user's channels"""
    try:
        # Get user's active connections
        connections_response = supabase.table("platform_connections").select("*").eq("user_id", user_id).eq("is_active", True).execute()
        connections = connections_response.data if connections_response.data else []
        
        if platform:
            connections = [conn for conn in connections if conn.get('platform') == platform]
        
        insights = []
        for connection in connections:
            # Get posts for this connection
            posts_response = supabase.table("content_posts").select("*").eq("user_id", user_id).eq("platform", connection['platform']).eq("status", "published").order("published_at", desc=True).limit(10).execute()
            posts = posts_response.data if posts_response.data else []
            
            for post in posts:
                # Mock insights data (in real implementation, this would come from platform APIs)
                insight = {
                    "post_id": post['id'],
                    "platform": connection['platform'],
                    "content": post.get('content', '')[:100] + "..." if len(post.get('content', '')) > 100 else post.get('content', ''),
                    "published_at": post.get('published_at'),
                    "likes": post.get('likes_count', 0),
                    "comments": post.get('comments_count', 0),
                    "shares": post.get('shares_count', 0),
                    "engagement_rate": round((post.get('likes_count', 0) + post.get('comments_count', 0) + post.get('shares_count', 0)) / max(post.get('follower_count', 1), 1) * 100, 2)
                }
                insights.append(insight)
        
        return {
            "success": True,
            "insights": insights,
            "count": len(insights)
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "insights": [],
            "count": 0
        }

@tool
def get_industry_trends(industry: str) -> Dict[str, Any]:
    """Get latest trends for a specific industry using web search"""
    try:
        # Use OpenAI to generate industry-specific trends
        prompt = f"""
        Generate 4-5 current marketing and social media trends for the {industry} industry in 2024.
        Focus on trends that are relevant to social media marketing and content creation.
        
        For each trend, provide:
        - A clear, concise title
        - A detailed description (2-3 sentences)
        - Impact level (High/Medium/Low)
        - Relevance to social media marketing
        
        Format as JSON with this structure:
        {{
            "trends": [
                {{
                    "trend": "Trend Title",
                    "description": "Detailed description of the trend",
                    "impact": "High/Medium/Low",
                    "relevance": "Relevance to social media marketing"
                }}
            ]
        }}
        """
        
        # Use OpenAI to generate trends
        response = llm.invoke([HumanMessage(content=prompt)])
        
        # Try to parse the JSON response
        import json
        try:
            trends_data = json.loads(response.content)
            trends = {
                "industry": industry,
                "trends": trends_data.get("trends", []),
                "last_updated": datetime.now().isoformat()
            }
        except json.JSONDecodeError:
            # Fallback if JSON parsing fails
            trends = {
                "industry": industry,
                "trends": [
                    {
                        "trend": f"AI-Powered Marketing in {industry}",
                        "description": f"Artificial intelligence is revolutionizing marketing strategies in the {industry} industry, enabling personalized content creation and automated customer engagement.",
                        "impact": "High",
                        "relevance": "Critical for modern social media strategy"
                    },
                    {
                        "trend": f"Video-First Content Strategy",
                        "description": f"Short-form video content is dominating social media engagement in {industry}, with platforms prioritizing video content in their algorithms.",
                        "impact": "High", 
                        "relevance": "Essential for social media success"
                    },
                    {
                        "trend": f"Authentic Storytelling in {industry}",
                        "description": f"Consumers in {industry} are seeking authentic, behind-the-scenes content that shows the human side of businesses.",
                        "impact": "Medium",
                        "relevance": "Important for brand building and trust"
                    }
                ],
                "last_updated": datetime.now().isoformat()
            }
        
        return {
            "success": True,
            "trends": trends
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "trends": None
        }

@tool
def get_user_profile(user_id: str) -> Dict[str, Any]:
    """Get user profile information including industry"""
    try:
        response = supabase.table("profiles").select("*").eq("id", user_id).execute()
        profile = response.data[0] if response.data else None
        
        if profile:
            # Handle industry field - it might be a list or string
            industry = profile.get("industry")
            if isinstance(industry, list) and len(industry) > 0:
                industry = industry[0].lower()  # Take first industry and convert to lowercase
            elif isinstance(industry, str):
                industry = industry.lower()
            else:
                industry = "technology"  # Default fallback
            
            # Update the profile with processed industry
            profile["industry"] = industry
            
            return {
                "success": True,
                "profile": profile
            }
        else:
            return {
                "success": False,
                "error": "User profile not found",
                "profile": None
            }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "profile": None
        }

@tool
def search_business_news(business_description: str, industry: str) -> Dict[str, Any]:
    """Search for exciting news related to the business using web search"""
    try:
        # Use DuckDuckGo for web search (no API key required)
        search_query = f"{industry} {business_description} latest news today"
        
        # Use DuckDuckGo Instant Answer API
        ddg_url = "https://api.duckduckgo.com/"
        params = {
            "q": search_query,
            "format": "json",
            "no_html": "1",
            "skip_disambig": "1"
        }
        
        response = requests.get(ddg_url, params=params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            # Try to get abstract or related topics
            abstract = data.get("Abstract", "")
            abstract_text = data.get("AbstractText", "")
            related_topics = data.get("RelatedTopics", [])
            
            # If we have an abstract, use it
            if abstract_text:
                news_item = {
                    "title": abstract or f"Latest {industry} News",
                    "content": abstract_text,
                    "source": data.get("AbstractURL", ""),
                    "date": datetime.now().strftime("%Y-%m-%d")
                }
                return {
                    "success": True,
                    "news": news_item
                }
            
            # If we have related topics, get the first one
            if related_topics and len(related_topics) > 0:
                first_topic = related_topics[0]
                if isinstance(first_topic, dict):
                    news_item = {
                        "title": first_topic.get("Text", f"Latest {industry} News"),
                        "content": first_topic.get("Text", ""),
                        "source": first_topic.get("FirstURL", ""),
                        "date": datetime.now().strftime("%Y-%m-%d")
                    }
                    return {
                        "success": True,
                        "news": news_item
                    }
        
        # Fallback: Use OpenAI to generate a news summary based on industry
        prompt = f"""Based on the {industry} industry and business description: "{business_description}", 
        generate an exciting and relevant news item or trend that would be interesting for this business today.
        
        Format as JSON:
        {{
            "title": "News Title",
            "content": "Brief description of the news (2-3 sentences)",
            "source": "Industry News",
            "date": "{datetime.now().strftime('%Y-%m-%d')}"
        }}
        
        Make it relevant, exciting, and useful for the business."""
        
        llm_response = llm.invoke([HumanMessage(content=prompt)])
        
        try:
            # Try to parse JSON from response
            import re
            json_match = re.search(r'\{[^}]+\}', llm_response.content, re.DOTALL)
            if json_match:
                news_data = json.loads(json_match.group())
                return {
                    "success": True,
                    "news": news_data
                }
        except:
            pass
        
        # Final fallback: Create a generic news item
        news_item = {
            "title": f"Latest Trends in {industry.title()}",
            "content": f"Stay updated with the latest developments in the {industry} industry. Keep an eye on emerging trends and opportunities that could benefit your business.",
            "source": "Industry Insights",
            "date": datetime.now().strftime("%Y-%m-%d")
        }
        
        return {
            "success": True,
            "news": news_item
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "news": None
        }

# Initialize tools
tools = [approve_draft_posts, get_scheduled_posts, get_latest_insights, get_industry_trends, get_user_profile, search_business_news]
tool_node = ToolNode(tools)

class BusinessChatbot:
    def __init__(self):
        self.llm = llm
        self.tools = tools
        # Initialize token tracker for usage tracking
        supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if supabase_url and supabase_service_key:
            self.token_tracker = TokenUsageService(supabase_url, supabase_service_key)
        else:
            self.token_tracker = None
        self.setup_graph()
    
    def setup_graph(self):
        """Setup the LangGraph workflow - fresh start with intent classification"""
        workflow = StateGraph(ChatbotState)
        
        # Add nodes - starting fresh
        workflow.add_node("classify_intent", self.classify_intent)
        workflow.add_node("generate_response", self.generate_response)
        
        # Set entry point to classify_intent (second step after receiving message)
        workflow.set_entry_point("classify_intent")
        
        # After classifying intent, go to generate_response
        # TODO: Add specific handler nodes for each intent later
        workflow.add_edge("classify_intent", "generate_response")
        workflow.add_edge("generate_response", END)
        
        # Compile the graph
        self.graph = workflow.compile()
    
    def classify_intent(self, state: ChatbotState) -> ChatbotState:
        """Classify the user's intent into one of 7 categories"""
        query = state["current_query"].lower()
        
        # Use LLM to classify intent more accurately
        classification_prompt = f"""Classify the following user message into one of these 7 intents:

1. social_media_post_generation - User wants to generate/create a new social media post
2. greeting_or_normal_chat - Greeting, casual conversation, or general chat
3. trending_topic_for_today - User wants to know trending topics for today
4. next_scheduled_post - User wants to know about their next scheduled post
5. social_media_analytics - User wants social media analytics, insights, or performance data
6. website_analytics - User wants website analytics or website performance data
7. social_media_post_suggestion - User wants suggestions for posts (e.g., "suggest me a post for today")

User message: "{state['current_query']}"

Respond with ONLY the intent name (e.g., "social_media_post_generation", "greeting_or_normal_chat", etc.)
Do not include any explanation or additional text.
"""
        
        try:
            response = self.llm.invoke([HumanMessage(content=classification_prompt)])
            classified_intent = response.content.strip().lower()
            
            # Validate the classified intent
            valid_intents = [
                "social_media_post_generation",
                "greeting_or_normal_chat",
                "trending_topic_for_today",
                "next_scheduled_post",
                "social_media_analytics",
                "website_analytics",
                "social_media_post_suggestion"
            ]
            
            # Check if the response matches any valid intent
            if classified_intent in valid_intents:
                state["classified_intent"] = classified_intent
                state["intent"] = classified_intent
            else:
                # Fallback to keyword-based classification if LLM returns invalid intent
                state["classified_intent"] = self._fallback_classify_intent(query)
                state["intent"] = state["classified_intent"]
        except Exception as e:
            # Fallback to keyword-based classification on error
            state["classified_intent"] = self._fallback_classify_intent(query)
            state["intent"] = state["classified_intent"]
        
        return state
    
    def _fallback_classify_intent(self, query: str) -> str:
        """Fallback keyword-based intent classification"""
        query_lower = query.lower()
        
        # 1. Social media post generation
        if any(keyword in query_lower for keyword in [
            'generate post', 'create post', 'make a post', 'new post', 'create content',
            'generate content', 'create social media post', 'post generation'
        ]):
            return "social_media_post_generation"
        
        # 2. Greeting or normal chat
        elif any(keyword in query_lower for keyword in [
            'hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening',
            'how are you', 'how do you do', 'how are things', 'how\'s it going',
            'thanks', 'thank you', 'bye', 'see you'
        ]):
            return "greeting_or_normal_chat"
        
        # 3. Trending topic for today
        elif any(keyword in query_lower for keyword in [
            'trending', 'trends', 'trending topic', 'trending topics', 'what\'s trending',
            'trending today', 'current trends', 'latest trends', 'what are the trends'
        ]):
            return "trending_topic_for_today"
        
        # 4. Next scheduled post
        elif any(keyword in query_lower for keyword in [
            'next post', 'next scheduled post', 'upcoming post', 'when is my next post',
            'what is my next post', 'next scheduled', 'when will my next post',
            'show me my next post', 'my next post'
        ]):
            return "next_scheduled_post"
        
        # 5. Social media analytics
        elif any(keyword in query_lower for keyword in [
            'analytics', 'social media analytics', 'performance', 'insights',
            'engagement', 'metrics', 'how are my posts performing', 'post performance',
            'social media performance', 'analytics data', 'social media insights'
        ]):
            return "social_media_analytics"
        
        # 6. Website analytics
        elif any(keyword in query_lower for keyword in [
            'website analytics', 'website performance', 'website traffic', 'site analytics',
            'website insights', 'web analytics', 'site performance', 'website metrics'
        ]):
            return "website_analytics"
        
        # 7. Social media post suggestion
        elif any(keyword in query_lower for keyword in [
            'suggest', 'suggestion', 'suggest me', 'give me a suggestion', 'post suggestion',
            'suggest a post', 'suggest me a post', 'what should I post', 'post ideas',
            'content suggestion', 'suggest content', 'what to post today'
        ]):
            return "social_media_post_suggestion"
        
        # Default to greeting_or_normal_chat if no match
        else:
            return "greeting_or_normal_chat"
    
    # Handler nodes will be added later based on intent
    # For now, all intents go directly to generate_response
    
    def generate_response(self, state: ChatbotState) -> ChatbotState:
        """Generate the final response using LLM based on classified intent"""
        try:
            # Add classified intent to context
            state["context"]["classified_intent"] = state.get("classified_intent", "greeting_or_normal_chat")
            
            # Create system prompt based on classified intent
            system_prompt = self.create_system_prompt(state["context"])
            
            # Create user message
            user_message = f"User query: {state['current_query']}\n\nClassified Intent: {state.get('classified_intent', 'greeting_or_normal_chat')}"
            
            # Generate response
            messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=user_message)
            ]
            
            response = self.llm.invoke(messages)
            state["response"] = response.content
            
        except Exception as e:
            state["response"] = f"I apologize, but I encountered an error while processing your request: {str(e)}"
        
        return state
    
    def create_system_prompt(self, context: Dict[str, Any]) -> str:
        """Create system prompt based on classified intent"""
        intent = context.get("classified_intent", "greeting_or_normal_chat")
        
        prompt = """You are Emily, a helpful AI marketing assistant chatbot. 
        
        Based on the classified intent, respond appropriately to the user's query.
        Always be helpful, concise, and provide actionable insights when possible.
        """
        
        # Add intent-specific instructions
        if intent == "social_media_post_generation":
            prompt += "\n\nThe user wants to generate/create a new social media post. Guide them through the process or direct them to the content creation feature."
        
        elif intent == "greeting_or_normal_chat":
            prompt += "\n\nThe user is greeting you or having a normal conversation. Respond warmly and helpfully. You can ask how you can assist them with their marketing needs."
        
        elif intent == "trending_topic_for_today":
            prompt += "\n\nThe user wants to know trending topics for today. Provide relevant trending topics that would be useful for their social media content."
        
        elif intent == "next_scheduled_post":
            prompt += "\n\nThe user wants to know about their next scheduled post. Check their scheduled posts and provide details about when and what is scheduled next."
        
        elif intent == "social_media_analytics":
            prompt += "\n\nThe user wants social media analytics or performance insights. Provide analytics data about their social media posts and performance."
        
        elif intent == "website_analytics":
            prompt += "\n\nThe user wants website analytics or website performance data. Provide insights about their website traffic and performance."
        
        elif intent == "social_media_post_suggestion":
            prompt += "\n\nThe user wants suggestions for social media posts. Provide creative and relevant post suggestions based on their business and industry."
        
        # Add context information if available
        if context.get("data"):
            prompt += f"\n\nAvailable context data: {json.dumps(context.get('data'), indent=2)}"
        
        return prompt
    
    def chat(self, user_id: str, query: str, conversation_history: Optional[List[Dict[str, str]]] = None) -> str:
        """Main chat interface with conversation memory"""
        # Generate or get conversation_id for session-based tracking
        conversation_id = str(uuid.uuid4())
        
        # Create initial state
        state = {
            "user_id": user_id,
            "current_query": query,
            "messages": conversation_history or [],
            "intent": None,
            "classified_intent": None,
            "context": {},
            "response": None
        }
        
        # Run the graph
        result = self.graph.invoke(state)
        
        # Add classified intent to context for system prompt
        state["context"]["classified_intent"] = result.get("classified_intent", "greeting_or_normal_chat")
        
        # Create system prompt based on classified intent
        system_prompt = self.create_system_prompt(state["context"])
        
        # Build message history for LLM
        messages = [SystemMessage(content=system_prompt)]
        
        # Add conversation history if available
        if conversation_history:
            for msg in conversation_history:
                if msg.get("type") == "user" or msg.get("role") == "user":
                    messages.append(HumanMessage(content=msg.get("content", "")))
                elif msg.get("type") == "bot" or msg.get("role") == "assistant" or msg.get("role") == "bot":
                    messages.append(AIMessage(content=msg.get("content", "")))
        
        # Add current user query
        user_message = f"User query: {query}\n\nClassified Intent: {result.get('classified_intent', 'greeting_or_normal_chat')}"
        messages.append(HumanMessage(content=user_message))
        
        # Generate response
        response = self.llm.invoke(messages)
        
        # Track token usage (non-blocking, fire-and-forget)
        if self.token_tracker:
            try:
                import threading
                import asyncio
                # Get model name from LLM
                model_name = getattr(self.llm, 'model_name', 'gpt-4o-mini')
                
                # Run tracking in a background thread to avoid blocking
                def track_in_thread():
                    try:
                        # Create new event loop for this thread
                        loop = asyncio.new_event_loop()
                        asyncio.set_event_loop(loop)
                        loop.run_until_complete(
                            self.token_tracker.track_langchain_usage(
                                user_id=user_id,
                                feature_type="chatbot_conversation",
                                model_name=model_name,
                                response=response,
                                messages=messages,
                                request_metadata={
                                    "conversation_id": conversation_id,
                                    "message_count": len(conversation_history) + 1 if conversation_history else 1,
                                    "classified_intent": result.get("classified_intent", "greeting_or_normal_chat")
                                }
                            )
                        )
                        loop.close()
                    except Exception as e:
                        logger.error(f"Error tracking chatbot token usage in thread: {str(e)}")
                
                thread = threading.Thread(target=track_in_thread, daemon=True)
                thread.start()
            except Exception as e:
                # Log error but don't break the chat functionality
                logger.error(f"Error setting up chatbot token tracking: {str(e)}")
        
        return response.content
    
    def chat_stream(self, user_id: str, query: str, conversation_history: Optional[List[Dict[str, str]]] = None) -> Generator[str, None, None]:
        """Streaming chat interface - streams only the final message with conversation memory"""
        # Generate or get conversation_id for session-based tracking
        conversation_id = str(uuid.uuid4())
        
        # Create initial state
        state = {
            "user_id": user_id,
            "current_query": query,
            "messages": conversation_history or [],
            "intent": None,
            "classified_intent": None,
            "context": {},
            "response": None
        }
        
        # Store accumulated response for tracking
        accumulated_response = ""
        full_response = None
        messages_for_tracking = None
        
        try:
            # Run the graph to classify intent and generate response
            result = self.graph.invoke(state)
            
            # Add classified intent to context for system prompt
            state["context"]["classified_intent"] = result.get("classified_intent", "greeting_or_normal_chat")
            
            # Create system prompt based on classified intent
            system_prompt = self.create_system_prompt(state["context"])
            
            # Build message history for LLM
            messages = [SystemMessage(content=system_prompt)]
            messages_for_tracking = messages.copy()
            
            # Add conversation history if available
            if conversation_history:
                for msg in conversation_history:
                    if msg.get("type") == "user" or msg.get("role") == "user":
                        messages.append(HumanMessage(content=msg.get("content", "")))
                        messages_for_tracking.append(HumanMessage(content=msg.get("content", "")))
                    elif msg.get("type") == "bot" or msg.get("role") == "assistant" or msg.get("role") == "bot":
                        messages.append(AIMessage(content=msg.get("content", "")))
                        messages_for_tracking.append(AIMessage(content=msg.get("content", "")))
            
            # Add current user query
            user_message = f"User query: {query}\n\nClassified Intent: {result.get('classified_intent', 'greeting_or_normal_chat')}"
            messages.append(HumanMessage(content=user_message))
            messages_for_tracking.append(HumanMessage(content=user_message))
            
            # Stream the response directly without progress messages
            for chunk in self.llm.stream(messages):
                if hasattr(chunk, 'content') and chunk.content:
                    accumulated_response += chunk.content
                    # Store the last chunk as full response for tracking
                    full_response = chunk
                    yield chunk.content
            
            # Track token usage after streaming completes (non-blocking, fire-and-forget)
            if self.token_tracker and full_response and messages_for_tracking:
                try:
                    import threading
                    import asyncio
                    # Create a mock response object with accumulated content for tracking
                    class MockResponse:
                        def __init__(self, content, response_metadata=None):
                            self.content = content
                            self.response_metadata = response_metadata or {}
                            self.message = type('obj', (object,), {'content': content})()
                    
                    mock_response = MockResponse(accumulated_response)
                    # Get model name from LLM
                    model_name = getattr(self.llm, 'model_name', 'gpt-4o-mini')
                    
                    # Run tracking in a background thread to avoid blocking
                    def track_in_thread():
                        try:
                            # Create new event loop for this thread
                            loop = asyncio.new_event_loop()
                            asyncio.set_event_loop(loop)
                            loop.run_until_complete(
                                self.token_tracker.track_langchain_usage(
                                    user_id=user_id,
                                    feature_type="chatbot_conversation",
                                    model_name=model_name,
                                    response=mock_response,
                                    messages=messages_for_tracking,
                                    request_metadata={
                                        "conversation_id": conversation_id,
                                        "message_count": len(conversation_history) + 1 if conversation_history else 1,
                                        "classified_intent": result.get("classified_intent", "greeting_or_normal_chat"),
                                        "is_streaming": True
                                    }
                                )
                            )
                            loop.close()
                        except Exception as e:
                            logger.error(f"Error tracking chatbot token usage (streaming) in thread: {str(e)}")
                    
                    thread = threading.Thread(target=track_in_thread, daemon=True)
                    thread.start()
                except Exception as e:
                    # Log error but don't break the chat functionality
                    logger.error(f"Error setting up chatbot token tracking (streaming): {str(e)}")
                    
        except Exception as e:
            yield f"I apologize, but I encountered an error while processing your request: {str(e)}"

# Initialize the chatbot
chatbot = BusinessChatbot()

def get_chatbot_response(user_id: str, query: str, conversation_history: Optional[List[Dict[str, str]]] = None) -> str:
    """Get response from the business chatbot with conversation memory"""
    return chatbot.chat(user_id, query, conversation_history)

def get_chatbot_response_stream(user_id: str, query: str, conversation_history: Optional[List[Dict[str, str]]] = None) -> Generator[str, None, None]:
    """Get streaming response from the business chatbot with conversation memory"""
    return chatbot.chat_stream(user_id, query, conversation_history)
