-- Migration: 001_add_organic_fields.sql
-- Purpose: Add columns for Smart Organic Campaign functionality

-- Updates to calendar_entries table
ALTER TABLE calendar_entries
ADD COLUMN IF NOT EXISTS campaign_phase TEXT, -- e.g., 'DISCOVERY', 'CLARITY'
ADD COLUMN IF NOT EXISTS intent_type TEXT,   -- e.g., 'RELATE', 'EDUCATE'
ADD COLUMN IF NOT EXISTS weekly_theme TEXT,  -- e.g., 'Overcoming Fear'
ADD COLUMN IF NOT EXISTS is_organic BOOLEAN DEFAULT false;

-- Updates to social_media_calendars table
ALTER TABLE social_media_calendars
ADD COLUMN IF NOT EXISTS is_organic_campaign BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS campaign_goal TEXT,    -- e.g., 'brand_awareness'
ADD COLUMN IF NOT EXISTS campaign_end_date DATE,
ADD COLUMN IF NOT EXISTS burn_out_prevention_mode BOOLEAN DEFAULT true;
