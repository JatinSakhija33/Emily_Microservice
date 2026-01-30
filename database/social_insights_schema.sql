-- Social Insights Table Schema
-- This table stores social media insights/metrics for all platforms
-- Run this to create a fresh table starting from zero

-- Drop table if exists (to start from zero)
DROP TABLE IF EXISTS social_insights CASCADE;

-- Create Social Insights Table
CREATE TABLE social_insights (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL, -- facebook, instagram, linkedin, twitter, youtube, pinterest, etc.
    connection_id UUID, -- Optional: reference to platform_connections table
    account_name TEXT, -- Name of the connected account/page
    
    -- Date and time for the insight
    insight_date DATE NOT NULL, -- The date this insight represents
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- When this record was created
    
    -- Common metrics across all platforms
    followers_count INTEGER DEFAULT 0,
    subscribers_count INTEGER DEFAULT 0, -- For YouTube, LinkedIn, etc.
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    shares_count INTEGER DEFAULT 0,
    retweets_count INTEGER DEFAULT 0, -- For Twitter
    views_count INTEGER DEFAULT 0, -- For YouTube, Instagram Reels, etc.
    saves_count INTEGER DEFAULT 0, -- For Instagram, Pinterest
    reactions_count INTEGER DEFAULT 0, -- For Facebook
    
    -- Engagement metrics
    engagement_rate DECIMAL(10, 4) DEFAULT 0, -- Calculated engagement rate
    reach_count INTEGER DEFAULT 0, -- Number of unique users who saw the content
    impressions_count INTEGER DEFAULT 0, -- Total number of times content was shown
    
    -- Post counts
    posts_count INTEGER DEFAULT 0, -- Total posts on the account
    new_posts_count INTEGER DEFAULT 0, -- Posts created in the insight period
    
    -- Platform-specific metrics stored as JSONB
    platform_metrics JSONB DEFAULT '{}'::jsonb,
    -- Examples:
    -- Instagram: { "media_count": 100, "stories_count": 5, "reels_count": 10 }
    -- YouTube: { "videos_count": 50, "playlists_count": 5, "watch_time_minutes": 1200 }
    -- Facebook: { "page_likes": 1000, "page_views": 500, "page_engagement": 200 }
    -- LinkedIn: { "company_followers": 500, "page_views": 300, "post_impressions": 1000 }
    -- Twitter: { "tweets_count": 200, "following_count": 100, "listed_count": 5 }
    -- Pinterest: { "boards_count": 10, "pins_count": 500, "monthly_views": 5000 }
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb, -- Additional metadata, notes, etc.
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_user_platform_date UNIQUE (user_id, platform, insight_date, connection_id)
);

-- Create indexes for better query performance
CREATE INDEX idx_social_insights_user_id ON social_insights(user_id);
CREATE INDEX idx_social_insights_platform ON social_insights(platform);
CREATE INDEX idx_social_insights_insight_date ON social_insights(insight_date DESC);
CREATE INDEX idx_social_insights_user_platform_date ON social_insights(user_id, platform, insight_date DESC);
CREATE INDEX idx_social_insights_connection_id ON social_insights(connection_id);
CREATE INDEX idx_social_insights_recorded_at ON social_insights(recorded_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE social_insights ENABLE ROW LEVEL SECURITY;

-- RLS Policies for social_insights
-- Users can view their own insights
CREATE POLICY "Users can view own social insights" ON social_insights
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own insights
CREATE POLICY "Users can insert own social insights" ON social_insights
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own insights
CREATE POLICY "Users can update own social insights" ON social_insights
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own insights
CREATE POLICY "Users can delete own social insights" ON social_insights
    FOR DELETE USING (auth.uid() = user_id);

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_social_insights_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_social_insights_updated_at 
    BEFORE UPDATE ON social_insights 
    FOR EACH ROW 
    EXECUTE FUNCTION update_social_insights_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE social_insights IS 'Stores social media insights and metrics for all platforms';
COMMENT ON COLUMN social_insights.platform IS 'Platform name: facebook, instagram, linkedin, twitter, youtube, pinterest, etc.';
COMMENT ON COLUMN social_insights.insight_date IS 'The date this insight represents (not when it was recorded)';
COMMENT ON COLUMN social_insights.recorded_at IS 'When this record was created in the database';
COMMENT ON COLUMN social_insights.platform_metrics IS 'Platform-specific metrics stored as JSONB for flexibility';
COMMENT ON COLUMN social_insights.connection_id IS 'Optional reference to platform_connections table for tracking which account/page';

