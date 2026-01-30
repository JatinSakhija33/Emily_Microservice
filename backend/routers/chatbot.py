"""
Chatbot API endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, status, Header, Query
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel
from typing import Optional, Generator, List, Dict
from datetime import datetime, timedelta, timezone, date, time, time
import logging

logger = logging.getLogger(__name__)
import os
import json
from dotenv import load_dotenv
import openai

# Load environment variables
load_dotenv()

# Import the chatbot agent
from agents.chatbot_agent import get_chatbot_response, get_chatbot_response_stream, search_business_news, get_user_profile
# Intent-based chatbot removed - only using ATSN chatbot now
from supabase import create_client, Client

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase_client: Client = create_client(supabase_url, supabase_key)

router = APIRouter(prefix="/chatbot", tags=["chatbot"])

# Initialize OpenAI client for TTS
openai_api_key = os.getenv("OPENAI_API_KEY")
openai_client = None
if openai_api_key:
    openai_client = openai.OpenAI(api_key=openai_api_key)

class User(BaseModel):
    id: str
    email: str
    name: str
    created_at: str

class ChatRequest(BaseModel):
    message: str
    user_id: Optional[str] = None
    conversation_history: Optional[List[Dict[str, str]]] = None  # Previous messages for context

class EveningNewsRequest(BaseModel):
    user_id: Optional[str] = None

class TTSRequest(BaseModel):
    text: str

class ChatResponse(BaseModel):
    response: str
    user_id: str
    timestamp: str

def get_current_user(authorization: str = Header(None)):
    """Get current user from Supabase JWT token"""
    try:
        if not authorization or not authorization.startswith("Bearer "):
            logger.warning("Missing or invalid authorization header")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Missing or invalid authorization header"
            )
        
        # Extract token
        try:
            token = authorization.split(" ")[1]
        except IndexError:
            logger.warning("Invalid authorization header format")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authorization header format"
            )
        
        # Verify token with Supabase
        try:
            response = supabase_client.auth.get_user(token)
            if not response or not response.user:
                logger.warning("Invalid token - no user found")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token"
                )
        except Exception as auth_error:
            logger.error(f"Supabase auth error: {str(auth_error)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate token"
            )
        
        # Convert created_at to string if it's a datetime object
        try:
            created_at_str = response.user.created_at
            if hasattr(created_at_str, 'isoformat'):
                created_at_str = created_at_str.isoformat()
            else:
                created_at_str = str(created_at_str)
        except Exception:
            created_at_str = datetime.now().isoformat()
        
        user_obj = User(
            id=response.user.id,
            email=response.user.email or "unknown@example.com",
            name=response.user.user_metadata.get("name", response.user.email) if response.user.user_metadata else response.user.email or "Unknown",
            created_at=created_at_str
        )
        
        logger.debug(f"Authenticated user: {user_obj.id}")
        return user_obj
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error validating user token: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )

# Removed: General chat endpoint (emily.py dependency removed)

# @router.post("/chat/stream")  # Disabled - emily.py dependency removed
async def chat_with_bot_stream(
    request: ChatRequest,
    current_user: User = Depends(get_current_user)
):
    """Stream chat response from the business assistant bot"""
    try:
        # Use the user_id from the request or fall back to current user
        user_id = request.user_id or current_user.id
        
        # Save user message to conversation history
        try:
            user_message_data = {
                "user_id": user_id,
                "message_type": "user",
                "content": request.message,
                "metadata": {}
            }
            supabase_client.table("chatbot_conversations").insert(user_message_data).execute()
        except Exception as e:
            logger.error(f"Error saving user message to conversation history: {e}")
        
        full_response = ""
        
        def generate_stream() -> Generator[str, None, None]:
            nonlocal full_response
            try:
                for chunk in get_chatbot_response_stream(user_id, request.message, request.conversation_history):
                    full_response += chunk
                    # Format as Server-Sent Events
                    yield f"data: {json.dumps({'content': chunk, 'done': False})}\n\n"
                
                # Save bot response to conversation history after streaming completes
                try:
                    bot_message_data = {
                        "user_id": user_id,
                        "message_type": "bot",
                        "content": full_response,
                        "metadata": {}
                    }
                    supabase_client.table("chatbot_conversations").insert(bot_message_data).execute()
                except Exception as e:
                    logger.error(f"Error saving bot response to conversation history: {e}")
                
                # Send final done message
                yield f"data: {json.dumps({'content': '', 'done': True})}\n\n"
                
            except Exception as e:
                error_msg = f"Error: {str(e)}"
                yield f"data: {json.dumps({'content': error_msg, 'done': True, 'error': True})}\n\n"
        
        return StreamingResponse(
            generate_stream(),
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Content-Type": "text/event-stream",
            }
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing streaming chat request: {str(e)}"
        )

# Removed: Intent-based chatbot v2 endpoint (emily.py dependency removed)

# Removed: Intent-based chatbot v2 streaming endpoint (emily.py dependency removed)

@router.post("/evening-news")
async def get_evening_news(
    request: EveningNewsRequest,
    current_user: User = Depends(get_current_user)
):
    """Get evening news for the user's business"""
    try:
        # Use the user_id from the request or fall back to current user
        user_id = request.user_id or current_user.id
        
        # Get user profile
        profile_result = get_user_profile.invoke({"user_id": user_id})
        
        if not profile_result.get("success") or not profile_result.get("profile"):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User profile not found"
            )
        
        profile = profile_result["profile"]
        business_description = profile.get("business_description", "")
        industry = profile.get("industry", "technology")
        
        # Handle industry if it's a list
        if isinstance(industry, list) and len(industry) > 0:
            industry = industry[0]
        elif not isinstance(industry, str):
            industry = "technology"
        
        # Search for business news
        news_result = search_business_news.invoke({
            "business_description": business_description,
            "industry": industry
        })
        
        if news_result.get("success") and news_result.get("news"):
            news = news_result["news"]
            # Format the news message
            formatted_content = f"I found an exciting news update for you!\n\n**{news.get('title', 'Latest News')}**\n\n{news.get('content', '')}\n\nWould you like me to generate a social media post based on this news?"
            
            return {
                "success": True,
                "news": {
                    **news,
                    "formatted_content": formatted_content
                }
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to fetch news"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching evening news: {str(e)}"
        )

@router.post("/tts")
async def text_to_speech(
    request: TTSRequest,
    current_user: User = Depends(get_current_user)
):
    """Convert text to speech using OpenAI TTS API with a female voice"""
    try:
        if not openai_client:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="OpenAI API key not configured"
            )
        
        # Clean text (remove markdown formatting)
        import re
        clean_text = re.sub(r'[#*_`\[\]()]', '', request.text).strip()
        
        if not clean_text:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Text cannot be empty"
            )
        
        # Use OpenAI TTS API with "nova" voice (best female voice)
        response = openai_client.audio.speech.create(
            model="tts-1",
            voice="nova",  # Best female voice
            input=clean_text,
            speed=1.0
        )
        
        # Get the audio data
        audio_data = response.content
        
        # Return audio as response
        return Response(
            content=audio_data,
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": "inline; filename=speech.mp3"
            }
        )
        
    except Exception as e:
        logger.error(f"Error generating TTS: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating speech: {str(e)}"
        )


# Removed: Chat v2 refresh endpoint (emily.py dependency removed)

@router.get("/health")
async def chatbot_health():
    """Health check for chatbot service"""
    return {
        "status": "healthy",
        "service": "business_chatbot",
        "capabilities": [
            "scheduled_posts",
            "performance_insights", 
            "industry_trends"
        ]
    }

@router.get("/capabilities")
async def get_capabilities():
    """Get chatbot capabilities"""
    return {
        "capabilities": {
            "scheduled_posts": {
                "description": "Tell you about your next scheduled posts",
                "example_queries": [
                    "What's my next scheduled post?",
                    "When is my next Facebook post?",
                    "Show me my upcoming content"
                ]
            },
            "performance_insights": {
                "description": "Analyze your social media performance",
                "example_queries": [
                    "How are my posts performing?",
                    "Show me my latest Instagram insights",
                    "What's my engagement rate?"
                ]
            },
            "industry_trends": {
                "description": "Get latest trends in your industry",
                "example_queries": [
                    "What are the latest trends in my industry?",
                    "Tell me about current marketing trends",
                    "What's new in social media?"
                ]
            }
        }
    }

@router.get("/conversations")
async def get_conversations(
    current_user: User = Depends(get_current_user),
    all: bool = Query(False, description="Get all conversations instead of just today's"),
    agent: str = Query(None, description="Filter by agent type (e.g., 'atsn')")
):
    """Get conversations for current user - today's by default, or all if all=true"""
    try:
        user_id = current_user.id
        logger.info(f"Fetching conversations for user {user_id}, all={all}")
        
        conversations = []
        try:
            query = supabase_client.table("atsn_conversations").select("*").eq("user_id", user_id)

            if not all:
                # Get today's date for conversation_date filtering
                target_date = datetime.now().date().isoformat()

                logger.info(f"Filtering conversations for date: {target_date}")
                query = query.eq("conversation_date", target_date)

            # Filter by agent if specified
            if agent:
                logger.info(f"Filtering conversations by agent: {agent}")
                query = query.eq("primary_agent_name", agent)
            else:
                # When no agent is specified, show all conversations (since we're now only using ATSN)
                logger.info("Showing all ATSN conversations")
            
            response = query.order("created_at", desc=False).execute()

            if response and hasattr(response, 'data'):
                conversations = response.data if response.data else []

            # Filter conversations based on agent parameter
            if agent:
                # When filtering for a specific agent, only include conversations with that agent
                conversations = [conv for conv in conversations if
                    conv.get("primary_agent_name") == agent]
            else:
                # When no agent is specified, show all conversations (since we're now only using ATSN)
                pass

            logger.info(f"Found {len(conversations)} conversations for user {user_id} (agent filter: {agent or 'non-atsn'})")
        except Exception as db_error:
            logger.error(f"Database error fetching conversations: {str(db_error)}", exc_info=True)
            # Return empty list instead of crashing
            conversations = []
        
        # Remove duplicates based on scheduled_message_id
        seen_scheduled_ids = set()
        unique_conversations = []
        
        for conv in conversations:
            try:
                # Handle metadata - it might be None, dict, or string
                metadata = conv.get("metadata") if isinstance(conv, dict) else None
                if isinstance(metadata, str):
                    try:
                        metadata = json.loads(metadata)
                    except:
                        metadata = {}
                elif metadata is None:
                    metadata = {}
                
                scheduled_id = metadata.get("scheduled_message_id") if isinstance(metadata, dict) else None
                if scheduled_id:
                    if scheduled_id in seen_scheduled_ids:
                        continue  # Skip duplicate
                    seen_scheduled_ids.add(scheduled_id)
                unique_conversations.append(conv)
            except Exception as conv_error:
                logger.warning(f"Error processing conversation {conv.get('id', 'unknown') if isinstance(conv, dict) else 'unknown'}: {str(conv_error)}")
                # Still add the conversation even if metadata parsing fails
                unique_conversations.append(conv)
        
        result = {
            "success": True,
            "conversations": unique_conversations,
            "count": len(unique_conversations)
        }
        logger.info(f"Returning {len(unique_conversations)} unique conversations for user {user_id}")
        return result
        
    except HTTPException as http_ex:
        logger.error(f"HTTP exception in get_conversations: {http_ex.detail}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error fetching conversations: {str(e)}", exc_info=True)
        # Return empty result instead of crashing
        return {
            "success": True,
            "conversations": [],
            "count": 0,
            "error": str(e)
        }

@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a conversation message from Supabase"""
    try:
        user_id = current_user.id
        
        # Verify message belongs to user and delete
        response = supabase_client.table("chatbot_conversations").delete().eq(
            "id", conversation_id
        ).eq("user_id", user_id).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Message not found"
            )
        
        return {
            "success": True,
            "message": "Message deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting conversation: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting message: {str(e)}"
        )






