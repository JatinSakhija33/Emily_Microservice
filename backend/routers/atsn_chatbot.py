"""
ATSN Chatbot Router
Handles chat interactions with the ATSN agent (Content & Lead Management)
"""

import os
import sys
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
import logging

# Add agents directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from agents.atsn import ATSNAgent
from supabase import create_client, Client
from auth import get_current_user
from utils.daily_cache_manager import daily_cache

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Supabase
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase_client: Client = create_client(supabase_url, supabase_key)

router = APIRouter(prefix="/atsn", tags=["atsn"])


# Pydantic models for request/response
class ChatMessage(BaseModel):
    message: str
    session_id: Optional[str] = None
    conversation_history: Optional[List[str]] = None
    media_file: Optional[str] = None
    media_urls: Optional[List[str]] = None


class ChatResponse(BaseModel):
    response: str
    intent: Optional[str] = None
    payload: Optional[dict] = None
    payload_complete: bool = False
    waiting_for_user: bool = False
    clarification_question: Optional[str] = None
    clarification_options: Optional[List[dict]] = None  # Clickable options for clarification
    clarification_data: Optional[dict] = None  # Additional clarification data (e.g., upload requests)
    waiting_for_upload: bool = False  # Whether the agent is waiting for a file upload
    upload_type: Optional[str] = None  # Type of upload expected ('image', 'video', etc.)
    result: Optional[str] = None
    error: Optional[str] = None
    current_step: str
    content_id: Optional[str] = None  # Single content ID (UUID) for operations on specific content
    content_ids: Optional[List[str]] = None  # List of content IDs for selection
    lead_id: Optional[str] = None  # Single lead ID (UUID) for operations on specific lead
    content_items: Optional[List[dict]] = None  # Structured content data for frontend card rendering
    lead_items: Optional[List[dict]] = None  # Structured lead data for frontend card rendering
    calendar_entries: Optional[List[dict]] = None  # Structured calendar data for frontend table rendering
    needs_connection: Optional[bool] = None  # Whether user needs to connect account
    connection_platform: Optional[str] = None  # Platform to connect
    agent_name: Optional[str] = None  # Agent name for displaying appropriate icon


# Store agent instances per user session
user_agents = {}

# Store active conversation sessions per user
user_conversations = {}


def get_or_create_conversation(user_id: str, session_id: str = None) -> dict:
    """Get or create a conversation record for the user"""
    if session_id and session_id in user_conversations:
        return user_conversations[session_id]

    try:
        # If no session_id provided, check if user has an active conversation today
        if not session_id:
            today = datetime.now(timezone.utc).date()
            result = supabase_client.table("atsn_conversations").select("id, session_id").eq("user_id", user_id).eq("conversation_date", today.isoformat()).eq("is_active", True).execute()

            if result.data and len(result.data) > 0:
                conversation = result.data[0]
                user_conversations[conversation["session_id"]] = conversation
                return conversation

        # Create new conversation
        session_id = session_id or str(uuid.uuid4())
        conversation_data = {
            "user_id": user_id,
            "session_id": session_id,
            "conversation_date": datetime.now(timezone.utc).date().isoformat(),
            "primary_agent_name": "atsn",
            "is_active": True
        }

        result = supabase_client.table("atsn_conversations").insert(conversation_data).execute()
        conversation = result.data[0]
        user_conversations[session_id] = conversation

        logger.info(f"Created new conversation {conversation['id']} for user {user_id}")
        return conversation

    except Exception as e:
        logger.error(f"Error creating/getting conversation for user {user_id}: {e}")
        # Fallback to a dummy conversation for error resilience
        return {"id": str(uuid.uuid4()), "session_id": session_id or str(uuid.uuid4())}


def save_message_to_conversation(conversation_id: str, user_id: str, message_data: dict) -> None:
    """Save a message to the conversation messages table"""
    try:
        # Get message sequence number
        sequence_result = supabase_client.table("atsn_conversation_messages").select("message_sequence").eq("conversation_id", conversation_id).order("message_sequence", desc=True).limit(1).execute()

        sequence = 1
        if sequence_result.data and len(sequence_result.data) > 0:
            sequence = sequence_result.data[0]["message_sequence"] + 1

        message_record = {
            "conversation_id": conversation_id,
            "user_id": user_id,
            "message_sequence": sequence,
            **message_data
        }

        supabase_client.table("atsn_conversation_messages").insert(message_record).execute()
        logger.info(f"Saved {message_data.get('message_type', 'unknown')} message to conversation {conversation_id}")

    except Exception as e:
        logger.error(f"Error saving message to conversation {conversation_id}: {e}")


def get_user_agent(user_id: str) -> ATSNAgent:
    """Get or create ATSN agent for user"""
    if user_id not in user_agents:
        user_agents[user_id] = ATSNAgent(user_id=user_id)
        logger.info(f"Created new ATSN agent for user {user_id}")
    return user_agents[user_id]


@router.post("/chat", response_model=ChatResponse)
async def chat(
    chat_message: ChatMessage,
    current_user=Depends(get_current_user)
):
    """
    Handle chat messages with ATSN agent using daily cache
    """
    try:
        user_id = current_user.id
        logger.info(f"ATSN chat request from user {user_id}: {chat_message.message}")

        # Generate session_id if not provided
        session_id = chat_message.session_id
        if not session_id:
            session_id = f"session_{int(datetime.now(timezone.utc).timestamp())}"
            logger.debug(f"Generated new session_id: {session_id} for user {user_id}")

        # Save user message to daily cache
        user_message_data = {
            "message_type": "user",
            "content": chat_message.message,
            "agent_name": "atsn"
        }
        daily_cache.add_message_to_session(user_id, session_id, user_message_data)
        logger.info(f"Stored user message in cache for session {session_id}: {chat_message.message[:50]}...")

        # Get conversation history from cache for context (last 10 messages)
        session_data = daily_cache.get_session_messages(user_id, session_id)
        conversation_history = []
        if session_data and session_data["messages"]:
            # Get last 10 messages for context, excluding the current user message
            recent_messages = session_data["messages"][-11:-1]  # Last 10 before current
            conversation_history = [msg["content"] for msg in recent_messages if msg["message_type"] == "user"]

        # Get user's agent instance
        agent = get_user_agent(user_id)
        
        # Process the query
        response = await agent.process_query(
            user_query=chat_message.message,
            conversation_history=conversation_history,
            user_id=user_id,
            media_file=chat_message.media_file,
            media_urls=chat_message.media_urls
        )
        
        # Format response - ensure we always have a valid response string
        response_text = (
            response.get('clarification_question') or 
            response.get('result') or 
            response.get('error') or 
            'I received your message. How can I help you?'
        )
        
        # Determine agent name based on intent
        agent_name = 'emily'  # default
        intent = response.get('intent')
        if intent:
            if 'lead' in intent.lower():
                agent_name = 'chase'
            elif intent.lower() in ['view_content', 'publish_content', 'delete_content','schedule_content']:
                agent_name = 'emily'
            elif intent.lower() in ['create_content', 'edit_content','created_content']:
                agent_name = 'leo'
            elif 'orio' in intent.lower() or 'analytics' in intent.lower():
                agent_name = 'orio'

        chat_response = ChatResponse(
            response=response_text,
            intent=response.get('intent'),
            payload=response.get('payload'),
            payload_complete=response.get('payload_complete', False),
            waiting_for_user=response.get('waiting_for_user', False),
            clarification_question=response.get('clarification_question'),
            clarification_options=response.get('clarification_options', []),
            clarification_data=response.get('clarification_data'),
            waiting_for_upload=response.get('waiting_for_upload', False),
            upload_type=response.get('upload_type'),
            result=response.get('result'),
            error=response.get('error'),
            current_step=response.get('current_step', 'unknown'),
            content_id=response.get('content_id'),  # Single content ID (UUID)
            content_ids=response.get('content_ids'),  # List of content IDs for selection
            lead_id=response.get('lead_id'),  # Single lead ID (UUID)
            content_items=response.get('content_items'),  # Structured content data for frontend cards
            lead_items=response.get('lead_items'),  # Structured lead data for frontend cards
            calendar_entries=response.get('calendar_entries'),  # Structured calendar data for frontend table
            needs_connection=response.get('needs_connection'),  # Whether user needs to connect account
            connection_platform=response.get('connection_platform'),  # Platform to connect
            agent_name=agent_name
        )

        # Save bot response to daily cache
        bot_message_data = {
            "message_type": "bot",
            "content": response_text,
            "agent_name": agent_name,
            "intent": response.get('intent'),
            "current_step": response.get('current_step', 'unknown'),
            "clarification_question": response.get('clarification_question'),
            "clarification_options": response.get('clarification_options'),
            "content_items": response.get('content_items'),
            "lead_items": response.get('lead_items'),
            "calendar_entries": response.get('calendar_entries')
            }
        daily_cache.add_message_to_session(user_id, session_id, bot_message_data)
        
        logger.info(f"ATSN response - Intent: {chat_response.intent}, Step: {chat_response.current_step}, Waiting: {chat_response.waiting_for_user}, Session: {session_id}")
        
        return chat_response
        
    except Exception as e:
        logger.error(f"Error in ATSN chat: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Chat processing failed: {str(e)}")


@router.post("/reset")
async def reset_agent(current_user=Depends(get_current_user)):
    """
    Reset the agent for the current user
    """
    try:
        user_id = current_user.id
        
        if user_id in user_agents:
            user_agents[user_id].reset()
            logger.info(f"Reset ATSN agent for user {user_id}")
            return {"message": "Agent reset successfully"}
        else:
            return {"message": "No active agent to reset"}
            
    except Exception as e:
        logger.error(f"Error resetting ATSN agent: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Reset failed: {str(e)}")


@router.get("/status")
async def get_status(current_user=Depends(get_current_user)):
    """
    Get current agent status
    """
    try:
        user_id = current_user.id
        
        if user_id in user_agents:
            agent = user_agents[user_id]
            state = agent.state
            
            if state:
                return {
                    "active": True,
                    "intent": state.intent,
                    "current_step": state.current_step,
                    "waiting_for_user": state.waiting_for_user,
                    "payload_complete": state.payload_complete
                }
        
        return {
            "active": False,
            "message": "No active agent session"
        }
        
    except Exception as e:
        logger.error(f"Error getting ATSN status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Status check failed: {str(e)}")


@router.get("/cache-stats")
async def get_cache_stats(current_user=Depends(get_current_user)):
    """
    Get daily cache statistics (admin/debug endpoint)
    """
    try:
        # Check if user is admin (you might want to add proper admin check)
        stats = daily_cache.get_cache_stats()
        return {
            "cache_stats": stats,
            "user_count": len(daily_cache.cache),
            "current_time": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        logger.error(f"Error getting cache stats: {str(e)}")
        return {"error": "Failed to get cache stats"}


@router.post("/clear-cache")
async def clear_user_cache(current_user=Depends(get_current_user), all: bool = False):
    """
    Clear user's daily cache (for debugging)
    """
    try:
        if all:
            # Admin function to clear all cache
            daily_cache.clear_all_cache()
            logger.info("Cleared all cache data")
            return {"message": "All cache cleared"}
        else:
            user_id = current_user.id
            daily_cache.clear_user_cache(user_id)
            logger.info(f"Manually cleared cache for user {user_id}")
            return {"message": f"Cache cleared for user {user_id}"}
    except Exception as e:
        logger.error(f"Error clearing cache: {str(e)}")
        return {"error": "Failed to clear cache"}


@router.get("/conversations")
async def get_atsn_conversations(
    current_user=Depends(get_current_user),
    limit: int = Query(20, description="Number of conversations to return", le=50),
    all: bool = Query(False, description="Get all conversations instead of just today's (not applicable with daily cache)")
):
    """Get ATSN conversations for current user from daily cache - only today's conversations"""
    try:
        user_id = current_user.id

        logger.info(f"Fetching today's ATSN conversations for user {user_id} from daily cache")

        # Get conversations from daily cache
        cache_data = daily_cache.get_user_conversations(user_id)
        conversations = cache_data["conversations"]

        logger.info(f"Found {len(conversations)} conversations with {cache_data['day_stats']['total_messages']} total messages")

        # Apply limit if specified
        if limit and len(conversations) > limit:
            conversations = conversations[-limit:]  # Get most recent

        # Convert messages to frontend format
        conversations_with_formatted_messages = []
        for conv in conversations:
            formatted_messages = []
            for msg in conv["messages"]:
                formatted_msg = {
                    "id": f"msg-{msg['created_at']}",  # Use timestamp as ID since we don't have DB IDs
                    "sender": msg["message_type"],
                    "text": msg["content"],
                    "timestamp": msg["created_at"],
                    "intent": msg.get("intent"),
                    "agent_name": msg.get("agent_name", "atsn"),
                    "current_step": msg.get("current_step"),
                    "clarification_question": msg.get("clarification_question"),
                    "clarification_options": msg.get("clarification_options"),
                    "content_items": msg.get("content_items"),
                    "lead_items": msg.get("lead_items"),
                    "calendar_entries": msg.get("calendar_entries")
                }
                formatted_messages.append(formatted_msg)

            conversations_with_formatted_messages.append({
                "id": conv["session_id"],
                "session_id": conv["session_id"],
                "conversation_date": cache_data["current_day"],
                "primary_agent_name": conv.get("agent_name", "atsn"),  # Use get() with default
                "total_messages": len(formatted_messages),
                "messages": formatted_messages,
                "created_at": conv.get("started_at", datetime.now(timezone.utc).isoformat()),
                "updated_at": conv.get("last_activity", datetime.now(timezone.utc).isoformat())
            })

        logger.info(f"Returning {len(conversations_with_formatted_messages)} today's conversations for user {user_id}")
        return {
            "conversations": conversations_with_formatted_messages,
            "count": len(conversations_with_formatted_messages),
            "current_day": cache_data["current_day"],
            "day_stats": cache_data["day_stats"]
        }

    except Exception as e:
        logger.error(f"Error fetching ATSN conversations from cache: {str(e)}", exc_info=True)
        return {
            "conversations": [],
            "count": 0,
            "current_day": datetime.now(timezone.utc).date().isoformat(),
            "day_stats": {"total_conversations": 0, "total_messages": 0}
        }


@router.post("/conversations/incremental-save")
async def incremental_save_conversation(
    conversation_data: dict,
    current_user=Depends(get_current_user)
):
    """Save only new messages since last save to optimize performance"""
    try:
        user_id = current_user.id
        session_id = conversation_data.get("session_id")
        new_messages = conversation_data.get("messages", [])
        last_saved_timestamp = conversation_data.get("last_saved_timestamp")

        if not session_id or not isinstance(new_messages, list):
            raise HTTPException(status_code=400, detail="Invalid conversation data")

        logger.info(f"Incremental saving {len(new_messages)} messages for user {user_id}, session {session_id}")

        # Check if conversation already exists
        existing_conv = supabase_client.table("atsn_conversations").select("*").eq("session_id", session_id).eq("user_id", user_id).execute()

        if existing_conv.data and len(existing_conv.data) > 0:
            conversation_id = existing_conv.data[0]["id"]
            logger.info(f"Updating existing conversation {conversation_id}")
        else:
            # Create new conversation
            today = datetime.now(timezone.utc).date()
            conversation_data = {
                "user_id": user_id,
                "session_id": session_id,
                "conversation_date": today.isoformat(),
                "primary_agent_name": "atsn",
                "is_active": True
            }

            new_conv = supabase_client.table("atsn_conversations").insert(conversation_data).execute()
            conversation_id = new_conv.data[0]["id"]
            logger.info(f"Created new conversation {conversation_id}")

        # Filter only messages after last save (if timestamp provided)
        if last_saved_timestamp:
            try:
                last_saved = datetime.fromisoformat(last_saved_timestamp.replace('Z', '+00:00'))
                new_messages = [msg for msg in new_messages
                               if datetime.fromisoformat(msg["timestamp"].replace('Z', '+00:00')) > last_saved]
                logger.info(f"Filtered to {len(new_messages)} messages after last save")
            except (ValueError, KeyError):
                logger.warning("Invalid last_saved_timestamp format, saving all messages")

        if not new_messages:
            logger.info("No new messages to save")
            return {"status": "success", "conversation_id": conversation_id, "messages_saved": 0}

        # Get current max sequence for this conversation
        existing_msgs = supabase_client.table("atsn_conversation_messages").select("message_sequence").eq("conversation_id", conversation_id).order("message_sequence", desc=False).execute()

        max_sequence = 0
        if existing_msgs.data and len(existing_msgs.data) > 0:
            max_sequence = max([msg["message_sequence"] for msg in existing_msgs.data])

        # Prepare messages for insertion
        messages_to_insert = []
        for i, msg in enumerate(new_messages):
            message_data = {
                "conversation_id": conversation_id,
                "user_id": user_id,
                "message_sequence": max_sequence + i + 1,
                "message_type": msg.get("sender", "user"),
                "content": msg.get("text", ""),
                "created_at": msg.get("timestamp", datetime.now(timezone.utc).isoformat()),
                "intent": msg.get("intent"),
                "agent_name": msg.get("agent_name"),
                "current_step": msg.get("current_step"),
                "clarification_question": msg.get("clarification_question"),
                "clarification_options": msg.get("clarification_options"),
                "content_items": msg.get("content_items"),
                "lead_items": msg.get("lead_items"),
                "calendar_entries": msg.get("calendar_entries")
            }
            messages_to_insert.append(message_data)

        # Batch insert messages
        supabase_client.table("atsn_conversation_messages").insert(messages_to_insert).execute()

        logger.info(f"Successfully saved {len(messages_to_insert)} new messages to conversation {conversation_id}")

        return {
            "status": "success",
            "conversation_id": conversation_id,
            "messages_saved": len(messages_to_insert),
            "last_saved_timestamp": datetime.now(timezone.utc).isoformat()
        }

    except Exception as e:
        logger.error(f"Error incremental saving conversation: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to save conversation")


@router.post("/conversations/save-complete")
async def save_complete_conversation(
    conversation_data: dict,
    current_user=Depends(get_current_user)
):
    """Save complete conversation when intent is fully completed - DISABLED"""
    try:
        user_id = current_user.id
        session_id = conversation_data.get("session_id")
        messages = conversation_data.get("messages", [])

        logger.info(f"Conversation saving DISABLED - skipping save for user {user_id}, session {session_id}")

        # Return success without doing anything
        return {
            "status": "success",
            "conversation_id": None,
            "messages_saved": 0,
            "note": "Conversation saving is disabled"
        }

    except Exception as e:
        logger.error(f"Error in disabled save_complete_conversation: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to save conversation")
