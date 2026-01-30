"""
Daily Conversation Cache Manager
Manages day-wise conversation caching with automatic cleanup
"""

from datetime import datetime, timezone
import logging
from typing import Dict, Any, Optional
import time

logger = logging.getLogger(__name__)

class DailyConversationCache:
    """
    Manages day-wise conversation caching.
    Conversations are stored in memory for the current day and automatically flushed at midnight.
    """

    def __init__(self, max_memory_mb: int = 500):
        self.cache: Dict[str, Dict[str, Any]] = {}
        self.max_memory_mb = max_memory_mb
        logger.info(f"Initialized DailyConversationCache with {max_memory_mb}MB limit")

    def get_user_cache(self, user_id: str) -> Dict[str, Any]:
        """
        Get or create user's daily cache.
        Automatically flushes old day data if day has changed.
        """
        today = datetime.now(timezone.utc).date().isoformat()

        if user_id not in self.cache:
            self.cache[user_id] = self._create_empty_cache(today)
            logger.debug(f"Created new cache for user {user_id}")

        # Check if day changed - flush old data
        if self.cache[user_id]["current_day"] != today:
            logger.info(f"Day changed for user {user_id}, flushing old conversations")
            self._flush_day(user_id, today)

        return self.cache[user_id]

    def _create_empty_cache(self, day: str) -> Dict[str, Any]:
        """Create empty cache structure for a user"""
        return {
            "current_day": day,
            "conversations": {},
            "day_stats": {
                "total_conversations": 0,
                "total_messages": 0,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "last_updated": datetime.now(timezone.utc).isoformat()
            }
        }

    def _flush_day(self, user_id: str, new_day: str):
        """Flush old day's conversations"""
        old_day = self.cache[user_id]["current_day"]
        old_conversations = len(self.cache[user_id]["conversations"])
        old_messages = self.cache[user_id]["day_stats"]["total_messages"]

        # Reset cache for new day
        self.cache[user_id] = self._create_empty_cache(new_day)

        logger.info(f"Flushed {old_conversations} conversations ({old_messages} messages) for user {user_id} (day: {old_day} -> {new_day})")

    def add_message_to_session(self, user_id: str, session_id: str, message_data: Dict[str, Any]) -> str:
        """
        Add a message to a conversation session.
        Creates session if it doesn't exist.
        """
        user_cache = self.get_user_cache(user_id)
        conversations = user_cache["conversations"]

        # Create session if it doesn't exist
        if session_id not in conversations:
            conversations[session_id] = {
                "messages": [],
                "agent_name": message_data.get("agent_name", "atsn"),
                "started_at": datetime.now(timezone.utc).isoformat(),
                "last_activity": datetime.now(timezone.utc).isoformat()
            }
            user_cache["day_stats"]["total_conversations"] += 1
            logger.debug(f"Created new session {session_id} for user {user_id}")
        else:
            # Update agent_name if this message has a different agent (e.g., bot response)
            current_agent = conversations[session_id].get("agent_name", "atsn")
            new_agent = message_data.get("agent_name", "atsn")
            if new_agent != "atsn" and current_agent == "atsn":
                conversations[session_id]["agent_name"] = new_agent

        session = conversations[session_id]

        # Add message
        message_entry = {
            "message_type": message_data["message_type"],
            "content": message_data["content"],
            "agent_name": message_data.get("agent_name", "atsn"),
            "intent": message_data.get("intent"),
            "current_step": message_data.get("current_step"),
            "clarification_question": message_data.get("clarification_question"),
            "clarification_options": message_data.get("clarification_options"),
            "content_items": message_data.get("content_items"),
            "lead_items": message_data.get("lead_items"),
            "created_at": datetime.now(timezone.utc).isoformat()
        }

        session["messages"].append(message_entry)
        session["last_activity"] = datetime.now(timezone.utc).isoformat()
        user_cache["day_stats"]["total_messages"] += 1
        user_cache["day_stats"]["last_updated"] = datetime.now(timezone.utc).isoformat()

        return session_id

    def get_user_conversations(self, user_id: str) -> Dict[str, Any]:
        """Get all conversations for a user (today only)"""
        user_cache = self.get_user_cache(user_id)

        conversations_list = []
        for session_id, session_data in user_cache["conversations"].items():
            conversations_list.append({
                "id": session_id,
                "session_id": session_id,
                "conversation_date": user_cache["current_day"],
                "primary_agent_name": session_data.get("agent_name", "atsn"),
                "total_messages": len(session_data["messages"]),
                "messages": session_data["messages"],
                "created_at": session_data["started_at"],
                "updated_at": session_data["last_activity"]
            })

        return {
            "conversations": conversations_list,
            "count": len(conversations_list),
            "current_day": user_cache["current_day"],
            "day_stats": user_cache["day_stats"]
        }

    def get_session_messages(self, user_id: str, session_id: str) -> Optional[Dict[str, Any]]:
        """Get messages for a specific session"""
        user_cache = self.get_user_cache(user_id)
        session = user_cache["conversations"].get(session_id)

        if not session:
            return None

        return {
            "session_id": session_id,
            "messages": session["messages"],
            "agent_name": session["agent_name"],
            "started_at": session["started_at"],
            "last_activity": session["last_activity"]
        }

    async def cleanup_old_caches(self):
        """Clean up caches for users who haven't been active today"""
        today = datetime.now(timezone.utc).date().isoformat()
        users_to_cleanup = []

        for user_id, user_cache in self.cache.items():
            if user_cache["current_day"] != today:
                users_to_cleanup.append(user_id)

        for user_id in users_to_cleanup:
            logger.info(f"Cleaning up old cache for user {user_id}")
            del self.cache[user_id]

        if users_to_cleanup:
            logger.info(f"Cleaned up {len(users_to_cleanup)} old user caches")

    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics for monitoring"""
        total_users = len(self.cache)
        total_conversations = sum(
            len(user_cache["conversations"])
            for user_cache in self.cache.values()
        )
        total_messages = sum(
            user_cache["day_stats"]["total_messages"]
            for user_cache in self.cache.values()
        )

        return {
            "total_users": total_users,
            "total_conversations": total_conversations,
            "total_messages": total_messages,
            "average_conversations_per_user": total_conversations / max(total_users, 1),
            "average_messages_per_user": total_messages / max(total_users, 1),
            "cache_size_mb": len(str(self.cache)) / (1024 * 1024)  # Rough estimate
        }

    def clear_user_cache(self, user_id: str):
        """Manually clear a user's cache"""
        if user_id in self.cache:
            del self.cache[user_id]
            logger.info(f"Manually cleared cache for user {user_id}")

    def clear_all_cache(self):
        """Clear all cache data (for debugging/emergency)"""
        user_count = len(self.cache)
        self.cache.clear()
        logger.info(f"Cleared all cache data for {user_count} users")

# Global cache instance
daily_cache = DailyConversationCache()
