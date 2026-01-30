-- Add trial tracking field to prevent multiple trials
-- Run this SQL to add additional protection

-- Add field to track if user has ever had a trial
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS has_had_trial BOOLEAN DEFAULT FALSE;

-- Update existing trial users to mark they've had a trial
UPDATE profiles 
SET has_had_trial = TRUE 
WHERE subscription_status IN ('trial', 'expired', 'active');

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_has_had_trial 
ON profiles(has_had_trial) 
WHERE has_had_trial = TRUE;


