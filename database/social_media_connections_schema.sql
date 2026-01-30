-- Social Media Connections Table
-- This table stores user connections to various social media platforms
-- Supports both OAuth and manual token-based connections

CREATE TABLE social_media_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL, -- 'instagram', 'facebook', 'twitter', 'linkedin'
  account_type VARCHAR(50) NOT NULL, -- 'page', 'profile', 'business', 'personal'
  account_id VARCHAR(100) NOT NULL,
  account_name VARCHAR(200),
  access_token TEXT NOT NULL,
  token_expires_at TIMESTAMP,
  permissions JSONB, -- Store granted permissions as JSON
  is_active BOOLEAN DEFAULT true,
  connection_method VARCHAR(20) DEFAULT 'oauth', -- 'oauth' or 'token'
  connected_at TIMESTAMP DEFAULT NOW(),
  last_sync_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Ensure unique connection per user/platform/account
  UNIQUE(user_id, platform, account_id)
);

-- Indexes for better performance
CREATE INDEX idx_social_media_user_id ON social_media_connections(user_id);
CREATE INDEX idx_social_media_platform ON social_media_connections(platform);
CREATE INDEX idx_social_media_active ON social_media_connections(is_active);
CREATE INDEX idx_social_media_connection_method ON social_media_connections(connection_method);
CREATE INDEX idx_social_media_user_platform ON social_media_connections(user_id, platform);

-- RLS (Row Level Security) policies
ALTER TABLE social_media_connections ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own connections
CREATE POLICY "Users can view own connections" ON social_media_connections
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own connections
CREATE POLICY "Users can insert own connections" ON social_media_connections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own connections
CREATE POLICY "Users can update own connections" ON social_media_connections
  FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can delete their own connections
CREATE POLICY "Users can delete own connections" ON social_media_connections
  FOR DELETE USING (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON TABLE social_media_connections IS 'Stores user connections to social media platforms';
COMMENT ON COLUMN social_media_connections.platform IS 'Social media platform identifier (instagram, facebook, twitter, linkedin)';
COMMENT ON COLUMN social_media_connections.account_type IS 'Type of account (page, profile, business, personal)';
COMMENT ON COLUMN social_media_connections.account_id IS 'Platform-specific account identifier';
COMMENT ON COLUMN social_media_connections.access_token IS 'Encrypted access token for API calls';
COMMENT ON COLUMN social_media_connections.permissions IS 'JSON object storing granted permissions';
COMMENT ON COLUMN social_media_connections.connection_method IS 'Method used to connect (oauth or token)';
COMMENT ON COLUMN social_media_connections.is_active IS 'Whether the connection is currently active';
