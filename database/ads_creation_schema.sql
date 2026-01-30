-- Ads Creation Agent Tables
-- Run this after the main schema.sql

-- Ad Campaigns Table
CREATE TABLE IF NOT EXISTS ad_campaigns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    campaign_name TEXT NOT NULL,
    campaign_objective TEXT NOT NULL, -- brand_awareness, conversions, traffic, etc.
    target_audience TEXT NOT NULL,
    budget_range TEXT NOT NULL, -- low, medium, high
    platforms TEXT[] NOT NULL, -- array of platforms
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT DEFAULT 'draft', -- draft, generating, completed, failed
    total_ads INTEGER DEFAULT 0,
    approved_ads INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB -- additional campaign data
);

-- Ad Copies Table
CREATE TABLE IF NOT EXISTS ad_copies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    campaign_id UUID REFERENCES ad_campaigns(id) ON DELETE CASCADE,
    platform TEXT NOT NULL, -- facebook, instagram, linkedin, etc.
    ad_type TEXT NOT NULL, -- text, image, video, carousel, story, banner
    title TEXT NOT NULL,
    ad_copy TEXT NOT NULL,
    call_to_action TEXT NOT NULL,
    target_audience TEXT NOT NULL,
    budget_range TEXT NOT NULL,
    campaign_objective TEXT NOT NULL,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT DEFAULT 'draft', -- draft, approved, rejected, published, paused
    media_url TEXT, -- URL to associated media
    hashtags TEXT[], -- array of hashtags
    metadata JSONB, -- platform-specific data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ad Images Table
CREATE TABLE IF NOT EXISTS ad_images (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ad_id UUID REFERENCES ad_copies(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL, -- URL to the generated image
    image_prompt TEXT NOT NULL, -- Prompt used to generate the image
    image_style TEXT, -- artistic, realistic, cartoon, etc.
    image_size TEXT DEFAULT '1024x1024', -- 1024x1024, 512x512, etc.
    image_quality TEXT DEFAULT 'standard', -- standard, hd
    generation_model TEXT DEFAULT 'dall-e-3', -- dall-e-3, midjourney, etc.
    generation_cost DECIMAL(10,4), -- Cost of generation
    generation_time INTEGER, -- Time taken in seconds
    is_approved BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ad Performance Table (for tracking metrics)
CREATE TABLE IF NOT EXISTS ad_performance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ad_id UUID REFERENCES ad_copies(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    spend DECIMAL(10,2) DEFAULT 0.00,
    ctr DECIMAL(5,4) DEFAULT 0.0000, -- click-through rate
    cpc DECIMAL(10,4) DEFAULT 0.0000, -- cost per click
    cpm DECIMAL(10,4) DEFAULT 0.0000, -- cost per mille
    conversion_rate DECIMAL(5,4) DEFAULT 0.0000,
    date_recorded DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_user_id ON ad_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_status ON ad_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_created_at ON ad_campaigns(created_at);

CREATE INDEX IF NOT EXISTS idx_ad_copies_campaign_id ON ad_copies(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ad_copies_platform ON ad_copies(platform);
CREATE INDEX IF NOT EXISTS idx_ad_copies_status ON ad_copies(status);
CREATE INDEX IF NOT EXISTS idx_ad_copies_scheduled_at ON ad_copies(scheduled_at);

CREATE INDEX IF NOT EXISTS idx_ad_images_ad_id ON ad_images(ad_id);
CREATE INDEX IF NOT EXISTS idx_ad_images_approved ON ad_images(is_approved);

CREATE INDEX IF NOT EXISTS idx_ad_performance_ad_id ON ad_performance(ad_id);
CREATE INDEX IF NOT EXISTS idx_ad_performance_platform ON ad_performance(platform);
CREATE INDEX IF NOT EXISTS idx_ad_performance_date ON ad_performance(date_recorded);

-- RLS Policies
ALTER TABLE ad_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_copies ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_performance ENABLE ROW LEVEL SECURITY;

-- Ad Campaigns RLS Policies
CREATE POLICY "Users can view their own ad campaigns" ON ad_campaigns
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own ad campaigns" ON ad_campaigns
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ad campaigns" ON ad_campaigns
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own ad campaigns" ON ad_campaigns
    FOR DELETE USING (auth.uid() = user_id);

-- Ad Copies RLS Policies
CREATE POLICY "Users can view their own ad copies" ON ad_copies
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM ad_campaigns 
            WHERE ad_campaigns.id = ad_copies.campaign_id 
            AND ad_campaigns.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own ad copies" ON ad_copies
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM ad_campaigns 
            WHERE ad_campaigns.id = ad_copies.campaign_id 
            AND ad_campaigns.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own ad copies" ON ad_copies
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM ad_campaigns 
            WHERE ad_campaigns.id = ad_copies.campaign_id 
            AND ad_campaigns.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their own ad copies" ON ad_copies
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM ad_campaigns 
            WHERE ad_campaigns.id = ad_copies.campaign_id 
            AND ad_campaigns.user_id = auth.uid()
        )
    );

-- Ad Images RLS Policies
CREATE POLICY "Users can view their own ad images" ON ad_images
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM ad_copies 
            JOIN ad_campaigns ON ad_campaigns.id = ad_copies.campaign_id
            WHERE ad_images.ad_id = ad_copies.id 
            AND ad_campaigns.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own ad images" ON ad_images
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM ad_copies 
            JOIN ad_campaigns ON ad_campaigns.id = ad_copies.campaign_id
            WHERE ad_images.ad_id = ad_copies.id 
            AND ad_campaigns.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own ad images" ON ad_images
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM ad_copies 
            JOIN ad_campaigns ON ad_campaigns.id = ad_copies.campaign_id
            WHERE ad_images.ad_id = ad_copies.id 
            AND ad_campaigns.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their own ad images" ON ad_images
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM ad_copies 
            JOIN ad_campaigns ON ad_campaigns.id = ad_copies.campaign_id
            WHERE ad_images.ad_id = ad_copies.id 
            AND ad_campaigns.user_id = auth.uid()
        )
    );

-- Ad Performance RLS Policies
CREATE POLICY "Users can view their own ad performance" ON ad_performance
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM ad_copies 
            JOIN ad_campaigns ON ad_campaigns.id = ad_copies.campaign_id
            WHERE ad_performance.ad_id = ad_copies.id 
            AND ad_campaigns.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own ad performance" ON ad_performance
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM ad_copies 
            JOIN ad_campaigns ON ad_campaigns.id = ad_copies.campaign_id
            WHERE ad_performance.ad_id = ad_copies.id 
            AND ad_campaigns.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own ad performance" ON ad_performance
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM ad_copies 
            JOIN ad_campaigns ON ad_campaigns.id = ad_copies.campaign_id
            WHERE ad_performance.ad_id = ad_copies.id 
            AND ad_campaigns.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their own ad performance" ON ad_performance
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM ad_copies 
            JOIN ad_campaigns ON ad_campaigns.id = ad_copies.campaign_id
            WHERE ad_performance.ad_id = ad_copies.id 
            AND ad_campaigns.user_id = auth.uid()
        )
    );
