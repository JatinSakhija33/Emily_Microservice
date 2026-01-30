-- Update subscription plans pricing for 2025
-- This migration updates the subscription plans with new pricing structure

-- Update existing starter plan pricing
UPDATE subscription_plans
SET
    price_monthly = 349900,  -- ₹3499 monthly (349900 paise)
    price_yearly = 3359000,  -- ₹33590 yearly (3359000 paise)
    updated_at = NOW()
WHERE name = 'starter';

-- Add new advanced plan
INSERT INTO subscription_plans (name, display_name, price_monthly, price_yearly, features, is_active)
VALUES (
    'advanced',
    'Advanced',
    799900,  -- ₹7999 monthly (799900 paise)
    7599900, -- ₹75999 yearly (7599900 paise)
    '["Everything in Starter", "Maximum Tasks & Generations", "AI Content Optimization", "Advanced SEO Tools", "Performance Analytics Dashboard"]'::jsonb,
    true
)
ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    price_monthly = EXCLUDED.price_monthly,
    price_yearly = EXCLUDED.price_yearly,
    features = EXCLUDED.features,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Update existing pro plan pricing
UPDATE subscription_plans
SET
    price_monthly = 999900,  -- ₹9999 monthly (999900 paise)
    price_yearly = 9499900,  -- ₹94999 yearly (9499900 paise)
    updated_at = NOW()
WHERE name = 'pro';

-- Add freemium plan for free tier
INSERT INTO subscription_plans (name, display_name, price_monthly, price_yearly, features, is_active)
VALUES (
    'freemium',
    'Freemium',
    0,  -- Free
    0,  -- Free
    '["Access to All AI Agents", "Basic Social Media Generation", "Limited Tasks", "Basic Support"]'::jsonb,
    true
)
ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    price_monthly = EXCLUDED.price_monthly,
    price_yearly = EXCLUDED.price_yearly,
    features = EXCLUDED.features,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Log the pricing updates
DO $$
BEGIN
    RAISE NOTICE 'Subscription plans updated successfully (prices in paise):';
    RAISE NOTICE 'Starter: ₹3499/month (349900), ₹33590/year (3359000)';
    RAISE NOTICE 'Advanced: ₹7999/month (799900), ₹75999/year (7599900)';
    RAISE NOTICE 'Pro: ₹9999/month (999900), ₹94999/year (9499900)';
    RAISE NOTICE 'Freemium: Free (0)';
END $$;
