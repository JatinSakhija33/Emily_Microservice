-- Migration: Add content_id column to calendar_entries table
-- This migration links calendar entries to created content

-- Add content_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'calendar_entries'
        AND column_name = 'content_id'
    ) THEN
        ALTER TABLE calendar_entries
        ADD COLUMN content_id UUID REFERENCES post_content(id) ON DELETE SET NULL;

        RAISE NOTICE 'Added content_id column to calendar_entries';
    ELSE
        RAISE NOTICE 'content_id column already exists in calendar_entries';
    END IF;
END $$;

-- Add status column if it doesn't exist (for tracking creation status)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'calendar_entries'
        AND column_name = 'status'
    ) THEN
        ALTER TABLE calendar_entries
        ADD COLUMN status TEXT DEFAULT 'draft';

        RAISE NOTICE 'Added status column to calendar_entries';
    ELSE
        RAISE NOTICE 'status column already exists in calendar_entries';
    END IF;
END $$;

-- Add index for content_id if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_calendar_entries_content_id
ON calendar_entries(content_id);

-- Add index for status if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_calendar_entries_status
ON calendar_entries(status);

-- Add comments
COMMENT ON COLUMN calendar_entries.content_id IS 'Reference to the created content in post_content table';
COMMENT ON COLUMN calendar_entries.status IS 'Status of calendar entry (draft, content_created, scheduled, published)';

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '✅ Migration completed: content_id and status columns added to calendar_entries';
END $$;