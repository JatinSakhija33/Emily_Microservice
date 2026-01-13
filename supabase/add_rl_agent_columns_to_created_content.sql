-- Migration: Add RL Agent columns to created_content table
-- Date: 2026-01-13
-- Description: Add rl_post_id and rl_action_id columns to track RL agent metadata

-- Add rl_post_id column
ALTER TABLE created_content 
ADD COLUMN IF NOT EXISTS rl_post_id TEXT;

-- Add rl_action_id column
ALTER TABLE created_content 
ADD COLUMN IF NOT EXISTS rl_action_id TEXT;

-- Add comment for documentation
COMMENT ON COLUMN created_content.rl_post_id IS 'RL Agent post ID for tracking and learning';
COMMENT ON COLUMN created_content.rl_action_id IS 'RL Agent action ID for reinforcement learning';

-- Create index on rl_post_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_created_content_rl_post_id ON created_content(rl_post_id);

-- Create index on rl_action_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_created_content_rl_action_id ON created_content(rl_action_id);
