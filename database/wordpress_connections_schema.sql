-- WordPress Connections Schema
-- This table stores WordPress site connections for each user

CREATE TABLE IF NOT EXISTS wordpress_connections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    site_name VARCHAR(255) NOT NULL,
    site_url VARCHAR(500) NOT NULL,
    username VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_checked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_wordpress_connections_user_id ON wordpress_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_wordpress_connections_is_active ON wordpress_connections(is_active);
CREATE INDEX IF NOT EXISTS idx_wordpress_connections_site_url ON wordpress_connections(site_url);

-- Enable Row Level Security
ALTER TABLE wordpress_connections ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own WordPress connections" ON wordpress_connections
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own WordPress connections" ON wordpress_connections
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own WordPress connections" ON wordpress_connections
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own WordPress connections" ON wordpress_connections
    FOR DELETE USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_wordpress_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_wordpress_connections_updated_at
    BEFORE UPDATE ON wordpress_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_wordpress_connections_updated_at();

-- Add comments for documentation
COMMENT ON TABLE wordpress_connections IS 'Stores WordPress site connections for automated blog posting and content reading';
COMMENT ON COLUMN wordpress_connections.site_name IS 'Display name for the WordPress site';
COMMENT ON COLUMN wordpress_connections.site_url IS 'Full URL of the WordPress site (e.g., https://example.com)';
COMMENT ON COLUMN wordpress_connections.username IS 'WordPress username for API authentication';
COMMENT ON COLUMN wordpress_connections.application_password IS 'WordPress application password for API authentication';
COMMENT ON COLUMN wordpress_connections.is_active IS 'Whether the connection is currently active and usable';
COMMENT ON COLUMN wordpress_connections.last_checked_at IS 'Last time the connection was tested/verified';
COMMENT ON COLUMN wordpress_connections.metadata IS 'Additional metadata about the WordPress site (version, capabilities, etc.)';
