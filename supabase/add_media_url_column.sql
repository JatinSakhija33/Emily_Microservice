-- Add media_url column to created_content table
-- This column stores URLs for uploaded videos, images, and other media files

ALTER TABLE created_content
ADD COLUMN media_url TEXT;

-- Add comment to document the column purpose
COMMENT ON COLUMN created_content.media_url IS 'URL for uploaded media files (videos, images, etc.) stored in Supabase storage';
