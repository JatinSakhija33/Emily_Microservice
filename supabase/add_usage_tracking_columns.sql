-- Add usage tracking columns to profiles table
-- These columns track monthly usage for credit limiting

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS tasks_completed_this_month INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS images_generated_this_month INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_month_start DATE DEFAULT CURRENT_DATE;

-- Create an index for better performance on usage queries
CREATE INDEX IF NOT EXISTS idx_profiles_usage ON profiles(tasks_completed_this_month, images_generated_this_month);

-- Comment on the columns for documentation
COMMENT ON COLUMN profiles.tasks_completed_this_month IS 'Number of content generation tasks completed this month';
COMMENT ON COLUMN profiles.images_generated_this_month IS 'Number of images generated this month';
COMMENT ON COLUMN profiles.current_month_start IS 'Start date of the current usage tracking month';
