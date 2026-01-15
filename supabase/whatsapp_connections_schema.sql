-- WhatsApp Business Connections Table Migration
-- Add missing columns to existing whatsapp_connections table

-- Add phone_number_display column
ALTER TABLE whatsapp_connections
ADD COLUMN IF NOT EXISTS phone_number_display VARCHAR(50);

-- Add phone_number_verified_at column
ALTER TABLE whatsapp_connections
ADD COLUMN IF NOT EXISTS phone_number_verified_at TIMESTAMP WITH TIME ZONE;

-- Add comments for documentation
COMMENT ON COLUMN whatsapp_connections.phone_number_display IS 'Display phone number for the WhatsApp account';
COMMENT ON COLUMN whatsapp_connections.phone_number_verified_at IS 'When phone number was verified';

-- Ensure RLS is enabled
ALTER TABLE whatsapp_connections ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own whatsapp connections" ON whatsapp_connections;
DROP POLICY IF EXISTS "Users can insert own whatsapp connections" ON whatsapp_connections;
DROP POLICY IF EXISTS "Users can update own whatsapp connections" ON whatsapp_connections;
DROP POLICY IF EXISTS "Users can delete own whatsapp connections" ON whatsapp_connections;

-- Policy: Users can only see their own connections
CREATE POLICY "Users can view own whatsapp connections" ON whatsapp_connections
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own connections
CREATE POLICY "Users can insert own whatsapp connections" ON whatsapp_connections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own connections
CREATE POLICY "Users can update own whatsapp connections" ON whatsapp_connections
  FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can delete their own connections
CREATE POLICY "Users can delete own whatsapp connections" ON whatsapp_connections
  FOR DELETE USING (auth.uid() = user_id);