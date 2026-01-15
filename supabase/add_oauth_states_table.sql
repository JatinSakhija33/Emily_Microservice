-- OAuth States Table Migration
-- Add oauth_states table for CSRF protection during OAuth flows

-- OAuth States Table (for CSRF protection during OAuth flows)
CREATE TABLE IF NOT EXISTS oauth_states (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  state VARCHAR(100) NOT NULL UNIQUE,
  platform VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Ensure unique state per user/platform combination
  UNIQUE(user_id, platform)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_oauth_states_user_id ON oauth_states(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_states_state ON oauth_states(state);
CREATE INDEX IF NOT EXISTS idx_oauth_states_platform ON oauth_states(platform);

-- RLS (Row Level Security) policies
ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own OAuth states
CREATE POLICY "Users can view own oauth states" ON oauth_states
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own OAuth states
CREATE POLICY "Users can insert own oauth states" ON oauth_states
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own OAuth states
CREATE POLICY "Users can delete own oauth states" ON oauth_states
  FOR DELETE USING (auth.uid() = user_id);

-- Clean up expired states periodically (optional)
-- You can run this as a cron job or scheduled function
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM oauth_states WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;