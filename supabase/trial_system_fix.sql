-- Fix trial system database functions to remove email column references
-- Run these SQL commands to update the existing functions

-- Update check_trial_expiration function
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

-- Update get_expired_trials function
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


