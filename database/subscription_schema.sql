-- Subscription System Database Schema
-- This file contains all the database changes needed for the subscription system

-- 1. Add subscription fields to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20) DEFAULT 'inactive';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(20) DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMP DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMP DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS razorpay_subscription_id VARCHAR(255) DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS razorpay_customer_id VARCHAR(255) DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS migration_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS grace_period_end TIMESTAMP DEFAULT NULL;

-- 2. Create subscription_plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    price_monthly INTEGER NOT NULL, -- Price in cents
    price_yearly INTEGER NOT NULL, -- Price in cents
    features JSONB NOT NULL,
    razorpay_plan_id_monthly VARCHAR(255) DEFAULT NULL,
    razorpay_plan_id_yearly VARCHAR(255) DEFAULT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Create subscription_transactions table for tracking payments
CREATE TABLE IF NOT EXISTS subscription_transactions (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    subscription_id VARCHAR(255) NOT NULL,
    razorpay_payment_id VARCHAR(255) NOT NULL,
    amount INTEGER NOT NULL, -- Amount in cents
    currency VARCHAR(3) DEFAULT 'INR',
    status VARCHAR(20) NOT NULL,
    payment_method VARCHAR(50) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. Create subscription_webhooks table for tracking webhook events
CREATE TABLE IF NOT EXISTS subscription_webhooks (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(255) NOT NULL UNIQUE,
    event_type VARCHAR(100) NOT NULL,
    subscription_id VARCHAR(255) DEFAULT NULL,
    payment_id VARCHAR(255) DEFAULT NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Insert default subscription plans
INSERT INTO subscription_plans (name, display_name, price_monthly, price_yearly, features) VALUES
('starter', 'Starter', 5900, 59000, '["1 AI Agent", "Basic Analytics", "Email Support", "Standard Features"]'),
('pro', 'Pro', 9900, 99000, '["Managed Agents", "Advanced Analytics", "Priority Support", "Custom Integrations"]')
ON CONFLICT (name) DO NOTHING;

-- 6. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status ON profiles(subscription_status);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_plan ON profiles(subscription_plan);
CREATE INDEX IF NOT EXISTS idx_profiles_migration_status ON profiles(migration_status);
CREATE INDEX IF NOT EXISTS idx_subscription_transactions_user_id ON subscription_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_transactions_subscription_id ON subscription_transactions(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_webhooks_event_id ON subscription_webhooks(event_id);
CREATE INDEX IF NOT EXISTS idx_subscription_webhooks_processed ON subscription_webhooks(processed);

-- 7. Create function to update migration status for existing users
CREATE OR REPLACE FUNCTION update_existing_users_migration_status()
RETURNS void AS $$
BEGIN
    -- Set migration status for users created before subscription system
    UPDATE profiles 
    SET 
        migration_status = 'grandfathered',
        grace_period_end = created_at + INTERVAL '30 days'
    WHERE 
        created_at < '2025-01-01'::timestamp 
        AND (subscription_status IS NULL OR subscription_status = 'inactive')
        AND migration_status = 'pending';
END;
$$ LANGUAGE plpgsql;

-- 8. Execute the migration function
SELECT update_existing_users_migration_status();

-- 9. Create function to check if user has active subscription
CREATE OR REPLACE FUNCTION user_has_active_subscription(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_record RECORD;
BEGIN
    SELECT 
        subscription_status,
        subscription_end_date,
        created_at,
        grace_period_end,
        migration_status
    INTO user_record
    FROM profiles 
    WHERE id = user_uuid;
    
    -- Check if user has active subscription AND subscription hasn't expired
    IF user_record.subscription_status = 'active' THEN
        -- IMPORTANT: Also check if subscription_end_date is in the future or NULL
        IF user_record.subscription_end_date IS NULL OR user_record.subscription_end_date > NOW() THEN
            RETURN TRUE;
        ELSE
            -- Subscription expired but status not updated - return FALSE
            RETURN FALSE;
        END IF;
    END IF;
    
    -- Check if user is grandfathered and within grace period
    IF user_record.migration_status = 'grandfathered' AND 
       user_record.grace_period_end > NOW() THEN
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- 10. Create function to get user subscription info
CREATE OR REPLACE FUNCTION get_user_subscription_info(user_uuid UUID)
RETURNS TABLE(
    has_active_subscription BOOLEAN,
    subscription_status VARCHAR(20),
    subscription_plan VARCHAR(20),
    migration_status VARCHAR(20),
    grace_period_end TIMESTAMP,
    days_left INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        user_has_active_subscription(user_uuid) as has_active_subscription,
        p.subscription_status,
        p.subscription_plan,
        p.migration_status,
        p.grace_period_end,
        CASE 
            WHEN p.grace_period_end IS NOT NULL AND p.grace_period_end > NOW() 
            THEN EXTRACT(DAY FROM (p.grace_period_end - NOW()))::INTEGER
            ELSE 0
        END as days_left
    FROM profiles p
    WHERE p.id = user_uuid;
END;
$$ LANGUAGE plpgsql;
