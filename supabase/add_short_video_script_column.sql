-- Add short_video_script column to created_content table
ALTER TABLE created_content ADD COLUMN IF NOT EXISTS short_video_script TEXT;

-- Add comment for the new column
COMMENT ON COLUMN created_content.short_video_script IS 'Script content for short videos and reels, formatted for 15-30 second videos';
