-- Add channel_post_id column to created_content table
-- This column will store the post ID returned by social media platforms
-- (e.g., Instagram media ID, Facebook post ID, LinkedIn post URN, etc.)

-- Step 1: Add channel_post_id column to created_content table
ALTER TABLE created_content
ADD COLUMN IF NOT EXISTS channel_post_id TEXT;

-- Step 2: Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_created_content_channel_post_id ON created_content(channel_post_id);

-- Step 3: Add comment to document the column purpose
COMMENT ON COLUMN created_content.channel_post_id IS 'Post ID returned by the social media platform (e.g., Instagram media ID, Facebook post ID, LinkedIn post URN)';

-- Step 4: Enable Row Level Security policy for the new column (if needed)
-- The existing RLS policies should already cover this column since it's part of the table
