-- Add Google connection fields to platform_connections table
-- This migration adds fields specific to Google Workspace integration

-- Add Google-specific fields to platform_connections table
ALTER TABLE platform_connections 
ADD COLUMN IF NOT EXISTS google_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS google_drive_quota BIGINT,
ADD COLUMN IF NOT EXISTS google_docs_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS google_sheets_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS google_calendar_enabled BOOLEAN DEFAULT false;

-- Add index for Google connections
CREATE INDEX IF NOT EXISTS idx_platform_connections_google 
ON platform_connections(platform, is_active) 
WHERE platform = 'google';

-- Add comment to table
COMMENT ON TABLE platform_connections IS 'Stores social media and Google Workspace platform connections for users';

-- Add comments to new columns
COMMENT ON COLUMN platform_connections.google_email IS 'Google account email address';
COMMENT ON COLUMN platform_connections.google_drive_quota IS 'Google Drive storage quota in bytes';
COMMENT ON COLUMN platform_connections.google_docs_count IS 'Number of Google Docs accessible';
COMMENT ON COLUMN platform_connections.google_sheets_count IS 'Number of Google Sheets accessible';
COMMENT ON COLUMN platform_connections.google_calendar_enabled IS 'Whether Google Calendar access is enabled';
