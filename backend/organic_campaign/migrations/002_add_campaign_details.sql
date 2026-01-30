-- Migration: 002_add_campaign_details.sql
-- Purpose: Add columns for Manual Organic Campaign creation

ALTER TABLE social_media_calendars
ADD COLUMN IF NOT EXISTS campaign_name TEXT,
ADD COLUMN IF NOT EXISTS campaign_description TEXT,
ADD COLUMN IF NOT EXISTS frequency TEXT, -- e.g. "3-4", "5-6", "weekly"
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS business_context JSONB DEFAULT '{}'::jsonb;
