-- Social Media Connections Schema
-- This file contains the database schema for social media platform connections

-- Platform connections table
CREATE TABLE IF NOT EXISTS platform_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    page_id VARCHAR(100),
    page_name VARCHAR(255),
    page_username VARCHAR(100),
    follower_count INTEGER DEFAULT 0,
    
    -- Encrypted token storage
    access_token_encrypted TEXT,
    refresh_token_encrypted TEXT,
    token_expires_at TIMESTAMP,
    
    -- Platform-specific fields
    -- Instagram fields
    instagram_id VARCHAR(100),
    account_type VARCHAR(50),
    media_count INTEGER DEFAULT 0,
    
    -- LinkedIn fields
    linkedin_id VARCHAR(100),
    headline TEXT,
    email VARCHAR(255),
    profile_picture TEXT,
    
    -- Connection metadata
    is_active BOOLEAN DEFAULT true,
    last_sync TIMESTAMP,
    last_posted_at TIMESTAMP,
    connection_status VARCHAR(20) DEFAULT 'active', -- active, expired, revoked, error
    
    -- Timestamps
    connected_at TIMESTAMP DEFAULT NOW(),
    last_token_refresh TIMESTAMP,
    disconnected_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Unique constraint
    UNIQUE(user_id, platform, page_id)
);

-- Platform-specific settings
CREATE TABLE IF NOT EXISTS platform_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES platform_connections(id) ON DELETE CASCADE,
    auto_posting BOOLEAN DEFAULT true,
    default_posting_time TIME,
    timezone VARCHAR(50) DEFAULT 'UTC',
    post_frequency INTEGER DEFAULT 1, -- posts per day
    content_preferences JSONB, -- hashtags, emojis, etc.
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Token refresh queue for background processing
CREATE TABLE IF NOT EXISTS token_refresh_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES platform_connections(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    refresh_attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    next_attempt_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Connection activity log
CREATE TABLE IF NOT EXISTS connection_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES platform_connections(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL, -- connect, refresh, post, error, disconnect
    status VARCHAR(20) NOT NULL, -- success, error, warning
    message TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- OAuth states for security
CREATE TABLE IF NOT EXISTS oauth_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    state VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_platform_connections_user_id ON platform_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_connections_platform ON platform_connections(platform);
CREATE INDEX IF NOT EXISTS idx_platform_connections_status ON platform_connections(connection_status);
CREATE INDEX IF NOT EXISTS idx_platform_connections_active ON platform_connections(is_active);
CREATE INDEX IF NOT EXISTS idx_token_refresh_queue_status ON token_refresh_queue(status);
CREATE INDEX IF NOT EXISTS idx_token_refresh_queue_next_attempt ON token_refresh_queue(next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_connection_activity_connection_id ON connection_activity(connection_id);
CREATE INDEX IF NOT EXISTS idx_oauth_states_state ON oauth_states(state);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires_at ON oauth_states(expires_at);

-- RLS (Row Level Security) policies
ALTER TABLE platform_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_refresh_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE connection_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;

-- Platform connections policies
CREATE POLICY "Users can view their own connections" ON platform_connections
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own connections" ON platform_connections
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own connections" ON platform_connections
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own connections" ON platform_connections
    FOR DELETE USING (auth.uid() = user_id);

-- Platform settings policies
CREATE POLICY "Users can view their own settings" ON platform_settings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM platform_connections 
            WHERE id = connection_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own settings" ON platform_settings
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM platform_connections 
            WHERE id = connection_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own settings" ON platform_settings
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM platform_connections 
            WHERE id = connection_id AND user_id = auth.uid()
        )
    );

-- Token refresh queue policies (system access only)
CREATE POLICY "System can manage token refresh queue" ON token_refresh_queue
    FOR ALL USING (true);

-- Connection activity policies
CREATE POLICY "Users can view their own activity" ON connection_activity
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM platform_connections 
            WHERE id = connection_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "System can insert activity" ON connection_activity
    FOR INSERT WITH CHECK (true);

-- OAuth states policies
CREATE POLICY "Users can manage their own oauth states" ON oauth_states
    FOR ALL USING (auth.uid() = user_id);
