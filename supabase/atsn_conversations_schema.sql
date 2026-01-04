-- Create ATSN conversations table
CREATE TABLE IF NOT EXISTS atsn_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    conversation_date DATE NOT NULL,
    primary_agent_name VARCHAR(255) DEFAULT 'atsn',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Add foreign key constraint to profiles table (assuming it exists)
    CONSTRAINT fk_atsn_conversations_user_id
        FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- Create index on user_id and conversation_date for faster lookups
CREATE INDEX IF NOT EXISTS idx_atsn_conversations_user_date
    ON atsn_conversations(user_id, conversation_date);

-- Create index on session_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_atsn_conversations_session_id
    ON atsn_conversations(session_id);

-- Enable Row Level Security (RLS)
ALTER TABLE atsn_conversations ENABLE ROW LEVEL SECURITY;

-- Create policy for users to access their own conversations
CREATE POLICY "Users can view own ATSN conversations" ON atsn_conversations
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own ATSN conversations" ON atsn_conversations
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own ATSN conversations" ON atsn_conversations
    FOR UPDATE USING (auth.uid()::text = user_id::text);

-- Create ATSN conversation messages table
CREATE TABLE IF NOT EXISTS atsn_conversation_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL,
    user_id UUID NOT NULL,
    message_sequence INTEGER NOT NULL,
    message_type VARCHAR(50) NOT NULL, -- 'user' or 'bot'
    content TEXT NOT NULL,
    agent_name VARCHAR(255),
    intent VARCHAR(255),
    current_step VARCHAR(255),
    clarification_question TEXT,
    clarification_options JSONB,
    content_items JSONB,
    lead_items JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Add foreign key constraints
    CONSTRAINT fk_atsn_messages_conversation_id
        FOREIGN KEY (conversation_id) REFERENCES atsn_conversations(id) ON DELETE CASCADE,

    CONSTRAINT fk_atsn_messages_user_id
        FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,

    -- Ensure message_sequence is unique within a conversation
    CONSTRAINT unique_conversation_sequence
        UNIQUE (conversation_id, message_sequence)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_atsn_messages_conversation_id
    ON atsn_conversation_messages(conversation_id);

CREATE INDEX IF NOT EXISTS idx_atsn_messages_user_id
    ON atsn_conversation_messages(user_id);

CREATE INDEX IF NOT EXISTS idx_atsn_messages_created_at
    ON atsn_conversation_messages(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE atsn_conversation_messages ENABLE ROW LEVEL SECURITY;

-- Create policy for users to access their own conversation messages
CREATE POLICY "Users can view own ATSN conversation messages" ON atsn_conversation_messages
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own ATSN conversation messages" ON atsn_conversation_messages
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

-- Create trigger to automatically update updated_at in conversations table
CREATE TRIGGER update_atsn_conversations_updated_at
    BEFORE UPDATE ON atsn_conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
