-- Add blog_url column to blog_posts table
ALTER TABLE blog_posts 
ADD COLUMN IF NOT EXISTS blog_url TEXT;

-- Add comment to the column
COMMENT ON COLUMN blog_posts.blog_url IS 'The actual published blog post URL (permalink)';

