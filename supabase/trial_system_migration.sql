-- Trial System Database Migration
-- Add trial-related fields to the profiles table

-- Add trial-specific columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS trial_activated_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMP;

-- Create index for trial expiration checking
CREATE INDEX IF NOT EXISTS idx_profiles_trial_expires_at 
ON profiles(trial_expires_at) 
WHERE subscription_status = 'trial';

-- Create index for trial status queries
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status 
ON profiles(subscription_status);

-- Add comment to explain trial status values
COMMENT ON COLUMN profiles.subscription_status IS 'User subscription status: inactive, trial, active, expired, cancelled';

-- Create function to check trial expiration
CREATE OR REPLACE FUNCTION check_trial_expiration()
RETURNS TABLE (
    user_id UUID,
    name TEXT,
    trial_expires_at TIMESTAMP,
    days_remaining INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.trial_expires_at,
        EXTRACT(DAYS FROM (p.trial_expires_at - NOW()))::INTEGER as days_remaining
    FROM profiles p
    WHERE p.subscription_status = 'trial'
    AND p.trial_expires_at IS NOT NULL
    AND p.trial_expires_at > NOW()
    ORDER BY p.trial_expires_at ASC;
END;
$$ LANGUAGE plpgsql;

-- Create function to get expired trials
CREATE OR REPLACE FUNCTION get_expired_trials()
RETURNS TABLE (
    user_id UUID,
    name TEXT,
    trial_expires_at TIMESTAMP,
    days_expired INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.trial_expires_at,
        EXTRACT(DAYS FROM (NOW() - p.trial_expires_at))::INTEGER as days_expired
    FROM profiles p
    WHERE p.subscription_status = 'trial'
    AND p.trial_expires_at IS NOT NULL
    AND p.trial_expires_at <= NOW()
    ORDER BY p.trial_expires_at ASC;
END;
$$ LANGUAGE plpgsql;

-- Create function to deactivate expired trials
CREATE OR REPLACE FUNCTION deactivate_expired_trials()
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE profiles 
    SET 
        subscription_status = 'expired',
        subscription_plan = NULL,
        subscription_end_date = NULL,
        trial_expires_at = NULL,
        updated_at = NOW()
    WHERE subscription_status = 'trial'
    AND trial_expires_at IS NOT NULL
    AND trial_expires_at <= NOW();
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to get trial statistics
CREATE OR REPLACE FUNCTION get_trial_statistics()
RETURNS TABLE (
    total_trials INTEGER,
    active_trials INTEGER,
    expired_trials INTEGER,
    expiring_soon INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_trials,
        COUNT(CASE WHEN trial_expires_at IS NULL OR trial_expires_at > NOW() THEN 1 END)::INTEGER as active_trials,
        COUNT(CASE WHEN trial_expires_at IS NOT NULL AND trial_expires_at <= NOW() THEN 1 END)::INTEGER as expired_trials,
        COUNT(CASE WHEN trial_expires_at IS NOT NULL AND trial_expires_at > NOW() AND trial_expires_at <= NOW() + INTERVAL '1 day' THEN 1 END)::INTEGER as expiring_soon
    FROM profiles
    WHERE subscription_status = 'trial';
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for profiles table
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert trial plan into subscription_plans table if it doesn't exist
INSERT INTO subscription_plans (name, display_name, price_monthly, price_yearly, features, is_active)
VALUES (
    'free_trial',
    'Free Trial',
    0,
    0,
    '{"trial": true, "duration_days": 3, "features": ["full_access", "all_templates", "social_media_posting", "content_generation"]}',
    true
)
ON CONFLICT (name) DO NOTHING;

-- Add comment to explain the migration
COMMENT ON TABLE profiles IS 'User profiles with trial system support - includes trial_activated_at and trial_expires_at fields for 3-day free trial management';
