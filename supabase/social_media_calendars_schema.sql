-- Main calendar table
CREATE TABLE IF NOT EXISTS social_media_calendars (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    calendar_month DATE NOT NULL, -- First day of the month (YYYY-MM-01)
    calendar_year INTEGER NOT NULL,
    platform TEXT NOT NULL, -- instagram, facebook, linkedin, youtube
    frequency TEXT NOT NULL, -- daily, three_times_week, two_times_week, weekly, bi_weekly
    business_context JSONB, -- Cached business context used for generation
    trends_data JSONB, -- Cached trends data used for generation
    total_entries INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, calendar_month, platform)
);

-- Individual calendar entries
CREATE TABLE IF NOT EXISTS calendar_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    calendar_id UUID REFERENCES social_media_calendars(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL,
    content_type TEXT NOT NULL, -- image, video, carousel, story, reel
    content_theme TEXT NOT NULL, -- educational, promotional, engagement, etc.
    topic TEXT NOT NULL, -- Main topic/title for the content
    platform TEXT NOT NULL, -- instagram, facebook, linkedin, youtube
    
    -- RL Agent 6 Values
    hook_type TEXT, -- question, statement, how-to, list, story
    hook_length TEXT, -- short, medium, long
    tone TEXT, -- casual, professional, inspirational, humorous
    creativity TEXT, -- low, medium, high
    text_in_image TEXT, -- none, overlay, caption, minimal
    visual_style TEXT, -- clean, vibrant, minimalist, bold
    
    status TEXT DEFAULT 'draft', -- draft, scheduled, published
    scheduled_time TIME, -- Best posting time for this entry
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_social_media_calendars_user_month ON social_media_calendars(user_id, calendar_month);
CREATE INDEX IF NOT EXISTS idx_social_media_calendars_platform ON social_media_calendars(platform);
CREATE INDEX IF NOT EXISTS idx_calendar_entries_calendar_date ON calendar_entries(calendar_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_calendar_entries_status ON calendar_entries(status);

-- Enable Row Level Security
ALTER TABLE social_media_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for social_media_calendars
CREATE POLICY "Users can view own calendars" ON social_media_calendars
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own calendars" ON social_media_calendars
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own calendars" ON social_media_calendars
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own calendars" ON social_media_calendars
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for calendar_entries
CREATE POLICY "Users can view own calendar entries" ON calendar_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM social_media_calendars
      WHERE social_media_calendars.id = calendar_entries.calendar_id
      AND social_media_calendars.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own calendar entries" ON calendar_entries
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM social_media_calendars
      WHERE social_media_calendars.id = calendar_entries.calendar_id
      AND social_media_calendars.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own calendar entries" ON calendar_entries
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM social_media_calendars
      WHERE social_media_calendars.id = calendar_entries.calendar_id
      AND social_media_calendars.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own calendar entries" ON calendar_entries
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM social_media_calendars
      WHERE social_media_calendars.id = calendar_entries.calendar_id
      AND social_media_calendars.user_id = auth.uid()
    )
  );

-- Comments for documentation
COMMENT ON TABLE social_media_calendars IS 'Stores social media content calendars for users';
COMMENT ON COLUMN social_media_calendars.calendar_month IS 'First day of the month (YYYY-MM-01)';
COMMENT ON COLUMN social_media_calendars.platform IS 'Target social media platform';
COMMENT ON COLUMN social_media_calendars.frequency IS 'Posting frequency for this calendar';
COMMENT ON COLUMN social_media_calendars.business_context IS 'Cached business context from user profile';
COMMENT ON COLUMN social_media_calendars.trends_data IS 'Cached trends data from Grok';

COMMENT ON TABLE calendar_entries IS 'Individual content entries within a calendar';
COMMENT ON COLUMN calendar_entries.entry_date IS 'Scheduled date for this content piece';
COMMENT ON COLUMN calendar_entries.content_type IS 'Type of content (image, video, carousel, story, reel)';
COMMENT ON COLUMN calendar_entries.content_theme IS 'Theme/category of content (educational, promotional, etc.)';

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_calendar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER social_media_calendars_updated_at
    BEFORE UPDATE ON social_media_calendars
    FOR EACH ROW
    EXECUTE FUNCTION update_calendar_updated_at();

CREATE TRIGGER calendar_entries_updated_at
    BEFORE UPDATE ON calendar_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_calendar_updated_at();
