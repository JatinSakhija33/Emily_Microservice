-- Website Analysis Schema
-- Stores comprehensive website analysis results

-- Website analysis results table
CREATE TABLE IF NOT EXISTS website_analyses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    analysis_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Overall scores (0-100)
    seo_score INTEGER NOT NULL DEFAULT 0,
    performance_score INTEGER NOT NULL DEFAULT 0,
    accessibility_score INTEGER NOT NULL DEFAULT 0,
    best_practices_score INTEGER NOT NULL DEFAULT 0,
    overall_score INTEGER GENERATED ALWAYS AS (
        (seo_score + performance_score + accessibility_score + best_practices_score) / 4
    ) STORED,
    
    -- Analysis data (JSONB for flexible storage)
    seo_analysis JSONB,
    performance_analysis JSONB,
    content_analysis JSONB,
    technical_analysis JSONB,
    recommendations JSONB,
    raw_data JSONB,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_seo_score CHECK (seo_score >= 0 AND seo_score <= 100),
    CONSTRAINT valid_performance_score CHECK (performance_score >= 0 AND performance_score <= 100),
    CONSTRAINT valid_accessibility_score CHECK (accessibility_score >= 0 AND accessibility_score <= 100),
    CONSTRAINT valid_best_practices_score CHECK (best_practices_score >= 0 AND best_practices_score <= 100)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_website_analyses_user_id ON website_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_website_analyses_url ON website_analyses(url);
CREATE INDEX IF NOT EXISTS idx_website_analyses_analysis_date ON website_analyses(analysis_date);
CREATE INDEX IF NOT EXISTS idx_website_analyses_overall_score ON website_analyses(overall_score);

-- Website analysis history table (for tracking changes over time)
CREATE TABLE IF NOT EXISTS website_analysis_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    analysis_id UUID NOT NULL REFERENCES website_analyses(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    analysis_date TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Score changes
    seo_score_change INTEGER DEFAULT 0,
    performance_score_change INTEGER DEFAULT 0,
    accessibility_score_change INTEGER DEFAULT 0,
    best_practices_score_change INTEGER DEFAULT 0,
    overall_score_change INTEGER DEFAULT 0,
    
    -- Key metrics for tracking
    page_load_time DECIMAL(10,3),
    word_count INTEGER,
    image_count INTEGER,
    internal_links_count INTEGER,
    external_links_count INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for history queries
CREATE INDEX IF NOT EXISTS idx_website_analysis_history_analysis_id ON website_analysis_history(analysis_id);
CREATE INDEX IF NOT EXISTS idx_website_analysis_history_analysis_date ON website_analysis_history(analysis_date);

-- Website analysis cache table (for avoiding duplicate analyses)
CREATE TABLE IF NOT EXISTS website_analysis_cache (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    url_hash TEXT NOT NULL UNIQUE, -- Hash of URL for quick lookup
    url TEXT NOT NULL,
    analysis_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Auto-cleanup expired cache
    CONSTRAINT valid_expires_at CHECK (expires_at > created_at)
);

-- Index for cache lookups
CREATE INDEX IF NOT EXISTS idx_website_analysis_cache_url_hash ON website_analysis_cache(url_hash);
CREATE INDEX IF NOT EXISTS idx_website_analysis_cache_expires_at ON website_analysis_cache(expires_at);

-- Website analysis settings table (user preferences)
CREATE TABLE IF NOT EXISTS website_analysis_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    
    -- Analysis preferences
    auto_analyze BOOLEAN DEFAULT false,
    analysis_frequency TEXT DEFAULT 'weekly' CHECK (analysis_frequency IN ('daily', 'weekly', 'monthly')),
    notify_on_changes BOOLEAN DEFAULT true,
    notify_threshold INTEGER DEFAULT 10, -- Notify if score changes by this amount
    
    -- Analysis scope
    include_mobile_analysis BOOLEAN DEFAULT true,
    include_accessibility_analysis BOOLEAN DEFAULT true,
    include_content_analysis BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for settings lookup
CREATE INDEX IF NOT EXISTS idx_website_analysis_settings_user_id ON website_analysis_settings(user_id);

-- RLS (Row Level Security) policies
ALTER TABLE website_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_analysis_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_analysis_settings ENABLE ROW LEVEL SECURITY;

-- Policies for website_analyses
CREATE POLICY "Users can view their own analyses" ON website_analyses
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own analyses" ON website_analyses
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own analyses" ON website_analyses
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own analyses" ON website_analyses
    FOR DELETE USING (auth.uid() = user_id);

-- Policies for website_analysis_history
CREATE POLICY "Users can view their own analysis history" ON website_analysis_history
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM website_analyses 
            WHERE id = analysis_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own analysis history" ON website_analysis_history
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM website_analyses 
            WHERE id = analysis_id AND user_id = auth.uid()
        )
    );

-- Policies for website_analysis_settings
CREATE POLICY "Users can view their own settings" ON website_analysis_settings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings" ON website_analysis_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings" ON website_analysis_settings
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own settings" ON website_analysis_settings
    FOR DELETE USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_website_analysis_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for website_analyses
CREATE TRIGGER update_website_analyses_updated_at
    BEFORE UPDATE ON website_analyses
    FOR EACH ROW
    EXECUTE FUNCTION update_website_analysis_updated_at();

-- Trigger for website_analysis_settings
CREATE TRIGGER update_website_analysis_settings_updated_at
    BEFORE UPDATE ON website_analysis_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_website_analysis_updated_at();

-- Function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_website_analysis_cache()
RETURNS void AS $$
BEGIN
    DELETE FROM website_analysis_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to get analysis summary for a user
CREATE OR REPLACE FUNCTION get_user_analysis_summary(p_user_id UUID)
RETURNS TABLE (
    total_analyses BIGINT,
    avg_seo_score NUMERIC,
    avg_performance_score NUMERIC,
    avg_accessibility_score NUMERIC,
    avg_best_practices_score NUMERIC,
    avg_overall_score NUMERIC,
    latest_analysis_date TIMESTAMP WITH TIME ZONE,
    best_performing_url TEXT,
    worst_performing_url TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_analyses,
        ROUND(AVG(seo_score), 2) as avg_seo_score,
        ROUND(AVG(performance_score), 2) as avg_performance_score,
        ROUND(AVG(accessibility_score), 2) as avg_accessibility_score,
        ROUND(AVG(best_practices_score), 2) as avg_best_practices_score,
        ROUND(AVG(overall_score), 2) as avg_overall_score,
        MAX(analysis_date) as latest_analysis_date,
        (SELECT url FROM website_analyses WHERE user_id = p_user_id ORDER BY overall_score DESC LIMIT 1) as best_performing_url,
        (SELECT url FROM website_analyses WHERE user_id = p_user_id ORDER BY overall_score ASC LIMIT 1) as worst_performing_url
    FROM website_analyses 
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get analysis trends for a specific URL
CREATE OR REPLACE FUNCTION get_url_analysis_trends(p_user_id UUID, p_url TEXT, p_days INTEGER DEFAULT 30)
RETURNS TABLE (
    analysis_date TIMESTAMP WITH TIME ZONE,
    seo_score INTEGER,
    performance_score INTEGER,
    accessibility_score INTEGER,
    best_practices_score INTEGER,
    overall_score INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        wa.analysis_date,
        wa.seo_score,
        wa.performance_score,
        wa.accessibility_score,
        wa.best_practices_score,
        wa.overall_score
    FROM website_analyses wa
    WHERE wa.user_id = p_user_id 
        AND wa.url = p_url
        AND wa.analysis_date >= NOW() - INTERVAL '1 day' * p_days
    ORDER BY wa.analysis_date DESC;
END;
$$ LANGUAGE plpgsql;

-- Insert default settings for existing users
INSERT INTO website_analysis_settings (user_id, auto_analyze, analysis_frequency, notify_on_changes, notify_threshold)
SELECT 
    id as user_id,
    false as auto_analyze,
    'weekly' as analysis_frequency,
    true as notify_on_changes,
    10 as notify_threshold
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM website_analysis_settings)
ON CONFLICT (user_id) DO NOTHING;
