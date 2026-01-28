-- Database Schema Updates for Organic Campaign Functionality

-- Updates to calendar_entries table
ALTER TABLE calendar_entries
ADD COLUMN IF NOT EXISTS campaign_phase TEXT,
ADD COLUMN IF NOT EXISTS intent_type TEXT,
ADD COLUMN IF NOT EXISTS weekly_theme TEXT,
ADD COLUMN IF NOT EXISTS is_organic BOOLEAN DEFAULT false;

-- Updates to social_media_calendars table
ALTER TABLE social_media_calendars
ADD COLUMN IF NOT EXISTS is_organic_campaign BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS campaign_goal TEXT,
ADD COLUMN IF NOT EXISTS campaign_end_date DATE;
