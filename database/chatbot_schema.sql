-- Chatbot Conversations and Daily Messages Schema

-- Chatbot Conversations Table - stores all conversations between user and chatbot
CREATE TABLE IF NOT EXISTS chatbot_conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    message_type VARCHAR(20) NOT NULL, -- 'user' or 'bot'
    content TEXT NOT NULL,
    intent VARCHAR(100), -- classified intent if bot message
    metadata JSONB DEFAULT '{}'::jsonb, -- additional data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Index for faster queries
    INDEX idx_chatbot_conversations_user_date (user_id, created_at)
);

-- Chatbot Daily Messages Cache - caches daily follow-up messages
CREATE TABLE IF NOT EXISTS chatbot_daily_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    message_type VARCHAR(20) NOT NULL, -- 'morning_post', 'afternoon_analytics', 'evening_news'
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb, -- stores news data, analytics data, etc.
    date DATE NOT NULL, -- the date this message was generated for
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one message per type per user per day
    UNIQUE(user_id, message_type, date)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_chatbot_daily_messages_user_date 
ON chatbot_daily_messages(user_id, date);

