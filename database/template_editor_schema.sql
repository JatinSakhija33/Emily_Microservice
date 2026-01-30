-- Template Editor Database Schema
-- This schema supports the template editor designer agent

-- Premade templates table
CREATE TABLE IF NOT EXISTS premade_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    description TEXT,
    template_image TEXT NOT NULL, -- Base64 encoded template image
    preview_url VARCHAR(500), -- URL for preview thumbnail
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Template editing workflows table
CREATE TABLE IF NOT EXISTS template_workflows (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workflow_id VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content_id UUID REFERENCES content(id) ON DELETE CASCADE,
    template_id UUID REFERENCES premade_templates(id) ON DELETE SET NULL,
    current_node VARCHAR(100) NOT NULL,
    workflow_state JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'active', -- active, completed, failed, cancelled
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Template editing sessions table
CREATE TABLE IF NOT EXISTS template_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workflow_id VARCHAR(255) REFERENCES template_workflows(workflow_id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    session_data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Template categories table
CREATE TABLE IF NOT EXISTS template_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    icon VARCHAR(100), -- Icon class or URL
    color VARCHAR(7), -- Hex color code
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default template categories
INSERT INTO template_categories (name, description, icon, color) VALUES
('Social Media', 'Templates for social media posts', 'share-2', '#3B82F6'),
('Marketing', 'Marketing and promotional templates', 'megaphone', '#EF4444'),
('Events', 'Event announcement and invitation templates', 'calendar', '#10B981'),
('Business', 'Professional business templates', 'briefcase', '#6B7280'),
('Creative', 'Artistic and creative templates', 'palette', '#8B5CF6'),
('Newsletter', 'Email newsletter templates', 'mail', '#F59E0B')
ON CONFLICT (name) DO NOTHING;

-- Template analytics table
CREATE TABLE IF NOT EXISTS template_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    template_id UUID REFERENCES premade_templates(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- view, use, download, share
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Template favorites table
CREATE TABLE IF NOT EXISTS template_favorites (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    template_id UUID REFERENCES premade_templates(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, template_id)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_premade_templates_category ON premade_templates(category);
CREATE INDEX IF NOT EXISTS idx_premade_templates_user_id ON premade_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_premade_templates_is_public ON premade_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_template_workflows_user_id ON template_workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_template_workflows_status ON template_workflows(status);
CREATE INDEX IF NOT EXISTS idx_template_analytics_template_id ON template_analytics(template_id);
CREATE INDEX IF NOT EXISTS idx_template_analytics_user_id ON template_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_template_favorites_user_id ON template_favorites(user_id);

-- RLS (Row Level Security) policies
ALTER TABLE premade_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_favorites ENABLE ROW LEVEL SECURITY;

-- Premade templates policies
CREATE POLICY "Users can view public templates" ON premade_templates
    FOR SELECT USING (is_public = true);

CREATE POLICY "Users can view their own templates" ON premade_templates
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own templates" ON premade_templates
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own templates" ON premade_templates
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own templates" ON premade_templates
    FOR DELETE USING (auth.uid() = user_id);

-- Template workflows policies
CREATE POLICY "Users can view their own workflows" ON template_workflows
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own workflows" ON template_workflows
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own workflows" ON template_workflows
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own workflows" ON template_workflows
    FOR DELETE USING (auth.uid() = user_id);

-- Template sessions policies
CREATE POLICY "Users can view their own sessions" ON template_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions" ON template_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions" ON template_sessions
    FOR UPDATE USING (auth.uid() = user_id);

-- Template analytics policies
CREATE POLICY "Users can view their own analytics" ON template_analytics
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own analytics" ON template_analytics
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Template favorites policies
CREATE POLICY "Users can view their own favorites" ON template_favorites
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own favorites" ON template_favorites
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own favorites" ON template_favorites
    FOR DELETE USING (auth.uid() = user_id);

-- Functions for template editor
CREATE OR REPLACE FUNCTION get_user_templates(user_uuid UUID)
RETURNS TABLE (
    id UUID,
    name VARCHAR(255),
    category VARCHAR(100),
    description TEXT,
    preview_url VARCHAR(500),
    is_public BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE,
    is_favorite BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pt.id,
        pt.name,
        pt.category,
        pt.description,
        pt.preview_url,
        pt.is_public,
        pt.created_at,
        CASE WHEN tf.id IS NOT NULL THEN true ELSE false END as is_favorite
    FROM premade_templates pt
    LEFT JOIN template_favorites tf ON pt.id = tf.template_id AND tf.user_id = user_uuid
    WHERE pt.user_id = user_uuid OR pt.is_public = true
    ORDER BY pt.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_template_analytics(template_uuid UUID, days INTEGER DEFAULT 30)
RETURNS TABLE (
    action VARCHAR(50),
    count BIGINT,
    last_action TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ta.action,
        COUNT(*) as count,
        MAX(ta.created_at) as last_action
    FROM template_analytics ta
    WHERE ta.template_id = template_uuid
    AND ta.created_at >= NOW() - INTERVAL '1 day' * days
    GROUP BY ta.action
    ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_premade_templates_updated_at
    BEFORE UPDATE ON premade_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_template_workflows_updated_at
    BEFORE UPDATE ON template_workflows
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
