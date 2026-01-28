-- Add metadata column to calendar_entries for rich campaign data
ALTER TABLE calendar_entries
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
