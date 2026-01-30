-- Add carousel_images column to created_content table
-- This column stores an array of image URLs for carousel posts

ALTER TABLE created_content
ADD COLUMN IF NOT EXISTS carousel_images TEXT[] DEFAULT '{}'::TEXT[];

-- Add comment to document the column
COMMENT ON COLUMN created_content.carousel_images IS 'Array of image URLs for carousel posts, generated in sequence with contextual prompts';

-- Create index for better performance when querying carousel content
CREATE INDEX IF NOT EXISTS idx_created_content_carousel_images ON created_content USING GIN (carousel_images);

-- Update existing records to have empty array if null
UPDATE created_content
SET carousel_images = '{}'::TEXT[]
WHERE carousel_images IS NULL;
