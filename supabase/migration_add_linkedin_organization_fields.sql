-- Migration: Add LinkedIn organization fields
-- This migration adds fields to support LinkedIn company page connections

ALTER TABLE platform_connections 
ADD COLUMN IF NOT EXISTS organization_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS account_type VARCHAR(50) DEFAULT 'personal',
ADD COLUMN IF NOT EXISTS is_organization BOOLEAN DEFAULT false;

-- Update existing LinkedIn connections to have account_type = 'personal'
UPDATE platform_connections 
SET account_type = 'personal', is_organization = false 
WHERE platform = 'linkedin' AND account_type IS NULL;

-- Add index for organization lookups
CREATE INDEX IF NOT EXISTS idx_platform_connections_organization_id ON platform_connections(organization_id);
CREATE INDEX IF NOT EXISTS idx_platform_connections_account_type ON platform_connections(account_type);
CREATE INDEX IF NOT EXISTS idx_platform_connections_is_organization ON platform_connections(is_organization);
