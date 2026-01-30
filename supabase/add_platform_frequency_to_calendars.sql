-- Migration: Add platform and frequency columns to social_media_calendars table
-- This migration adds missing columns needed for platform-specific calendar management

-- Add platform column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'social_media_calendars' 
        AND column_name = 'platform'
    ) THEN
        ALTER TABLE social_media_calendars 
        ADD COLUMN platform TEXT;
        
        RAISE NOTICE 'Added platform column to social_media_calendars';
    ELSE
        RAISE NOTICE 'platform column already exists in social_media_calendars';
    END IF;
END $$;

-- Add frequency column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'social_media_calendars' 
        AND column_name = 'frequency'
    ) THEN
        ALTER TABLE social_media_calendars 
        ADD COLUMN frequency TEXT;
        
        RAISE NOTICE 'Added frequency column to social_media_calendars';
    ELSE
        RAISE NOTICE 'frequency column already exists in social_media_calendars';
    END IF;
END $$;

-- Update existing records with default values (if any exist)
UPDATE social_media_calendars 
SET platform = 'instagram' 
WHERE platform IS NULL;

UPDATE social_media_calendars 
SET frequency = 'weekly' 
WHERE frequency IS NULL;

-- Add NOT NULL constraints after setting defaults
ALTER TABLE social_media_calendars 
ALTER COLUMN platform SET NOT NULL;

ALTER TABLE social_media_calendars 
ALTER COLUMN frequency SET NOT NULL;

-- Create or replace the unique constraint to include platform
ALTER TABLE social_media_calendars 
DROP CONSTRAINT IF EXISTS social_media_calendars_user_id_calendar_month_key;

ALTER TABLE social_media_calendars 
DROP CONSTRAINT IF EXISTS social_media_calendars_user_id_calendar_month_platform_key;

ALTER TABLE social_media_calendars 
ADD CONSTRAINT social_media_calendars_user_id_calendar_month_platform_key 
UNIQUE (user_id, calendar_month, platform);

-- Create index for platform if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_social_media_calendars_platform 
ON social_media_calendars(platform);

-- Add comments
COMMENT ON COLUMN social_media_calendars.platform IS 'Target social media platform (instagram, facebook, youtube, linkedin)';
COMMENT ON COLUMN social_media_calendars.frequency IS 'Posting frequency (daily, three_times_week, two_times_week, weekly, bi_weekly)';

-- Display success message
DO $$ 
BEGIN
    RAISE NOTICE '✅ Migration completed successfully: platform and frequency columns added';
END $$;
