-- PostgreSQL Database Initialization Script for TERI Model
-- This script sets up the database schema based on PRD Section 2.2

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create database user if not exists
DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_roles
      WHERE  rolname = 'teri_app') THEN

      CREATE ROLE teri_app LOGIN PASSWORD 'teri_app_password';
   END IF;
END
$do$;

-- Grant permissions
GRANT CONNECT ON DATABASE teri_development TO teri_app;
GRANT USAGE ON SCHEMA public TO teri_app;
GRANT CREATE ON SCHEMA public TO teri_app;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    partner_id UUID REFERENCES users(id),
    pairing_code VARCHAR(8) UNIQUE,
    pairing_code_expires TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    last_active TIMESTAMP DEFAULT NOW(),
    preferences JSONB DEFAULT '{
        "notifications": true,
        "reminder_time": "20:00",
        "theme": "auto",
        "text_size": "medium"
    }'
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_pairing ON users(pairing_code) WHERE pairing_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_partner ON users(partner_id) WHERE partner_id IS NOT NULL;

-- Couples Table
CREATE TABLE IF NOT EXISTS couples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner1_id UUID NOT NULL REFERENCES users(id),
    partner2_id UUID NOT NULL REFERENCES users(id),
    current_level INTEGER DEFAULT 1,
    current_section INTEGER DEFAULT 1,
    relationship_start_date DATE,
    paired_at TIMESTAMP DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'active', -- active, paused, ended
    UNIQUE(partner1_id, partner2_id),
    CHECK (partner1_id < partner2_id) -- Enforce canonical ordering
);

CREATE INDEX IF NOT EXISTS idx_couples_partners ON couples(partner1_id, partner2_id);
CREATE INDEX IF NOT EXISTS idx_couples_status ON couples(status);

-- Section Progress Table
CREATE TABLE IF NOT EXISTS section_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    couple_id UUID NOT NULL REFERENCES couples(id),
    level INTEGER NOT NULL,
    section INTEGER NOT NULL,
    
    -- Partner 1 progress
    partner1_content_complete BOOLEAN DEFAULT false,
    partner1_completed_at TIMESTAMP,
    partner1_comprehension_score DECIMAL(3,2),
    partner1_comprehension_attempts INTEGER DEFAULT 0,
    
    -- Partner 2 progress
    partner2_content_complete BOOLEAN DEFAULT false,
    partner2_completed_at TIMESTAMP,
    partner2_comprehension_score DECIMAL(3,2),
    partner2_comprehension_attempts INTEGER DEFAULT 0,
    
    -- Shared gating
    settle_timer_start TIMESTAMP,
    comprehension_unlocked_at TIMESTAMP,
    section_unlocked BOOLEAN DEFAULT false,
    section_unlocked_at TIMESTAMP,
    
    UNIQUE(couple_id, level, section)
);

CREATE INDEX IF NOT EXISTS idx_progress_couple ON section_progress(couple_id);
CREATE INDEX IF NOT EXISTS idx_progress_level_section ON section_progress(level, section);
CREATE INDEX IF NOT EXISTS idx_progress_unlocked ON section_progress(section_unlocked, comprehension_unlocked_at);

-- Translator Sessions Table
CREATE TABLE IF NOT EXISTS translator_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    couple_id UUID NOT NULL REFERENCES couples(id),
    mode VARCHAR(10) NOT NULL, -- 'TES' or 'TEL'
    
    -- Input
    input_text TEXT NOT NULL,
    
    -- Output (stored as JSONB for flexibility)
    output_data JSONB NOT NULL,
    
    processing_time_ms INTEGER,
    feedback VARCHAR(20), -- helpful, neutral, not_helpful
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_translator_user ON translator_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_translator_couple ON translator_sessions(couple_id);
CREATE INDEX IF NOT EXISTS idx_translator_mode ON translator_sessions(mode);
CREATE INDEX IF NOT EXISTS idx_translator_created ON translator_sessions(created_at);

-- Mediator Sessions Table
CREATE TABLE IF NOT EXISTS mediator_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    couple_id UUID NOT NULL REFERENCES couples(id),
    
    -- Audio
    audio_url TEXT NOT NULL, -- S3 path
    audio_duration_seconds INTEGER NOT NULL,
    
    -- Transcription
    transcript TEXT NOT NULL,
    speaker VARCHAR(10) NOT NULL, -- 'partner1' or 'partner2'
    
    -- Analysis (JSONB)
    tel_summary JSONB NOT NULL,
    depth_questions JSONB NOT NULL, -- ["question1", "question2", ...]
    suggested_games JSONB NOT NULL, -- [{game_id, score, rationale}, ...]
    
    processing_time_ms INTEGER,
    feedback VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mediator_couple ON mediator_sessions(couple_id);
CREATE INDEX IF NOT EXISTS idx_mediator_user ON mediator_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_mediator_created ON mediator_sessions(created_at);

-- Journal Entries Table
CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    level INTEGER,
    section INTEGER,
    prompt TEXT,
    content TEXT NOT NULL,
    shared_with_partner BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journal_user ON journal_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_section ON journal_entries(level, section);
CREATE INDEX IF NOT EXISTS idx_journal_shared ON journal_entries(shared_with_partner);

-- Game Sessions Table
CREATE TABLE IF NOT EXISTS game_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    couple_id UUID NOT NULL REFERENCES couples(id),
    game_id VARCHAR(50) NOT NULL,
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    duration_minutes INTEGER,
    feedback VARCHAR(20), -- helpful, neutral, not_helpful
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_games_couple ON game_sessions(couple_id);
CREATE INDEX IF NOT EXISTS idx_games_game_id ON game_sessions(game_id);
CREATE INDEX IF NOT EXISTS idx_games_completed ON game_sessions(completed_at);

-- Comprehension Questions Table
CREATE TABLE IF NOT EXISTS comprehension_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level INTEGER NOT NULL,
    section INTEGER NOT NULL,
    type VARCHAR(20) NOT NULL, -- multiple_choice, translation, scenario
    question_data JSONB NOT NULL, -- Full question object
    difficulty VARCHAR(20) DEFAULT 'medium', -- easy, medium, hard
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_questions_level_section ON comprehension_questions(level, section);
CREATE INDEX IF NOT EXISTS idx_questions_type ON comprehension_questions(type);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON comprehension_questions(difficulty);

-- Games Metadata Table
CREATE TABLE IF NOT EXISTS games (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    objective TEXT NOT NULL,
    duration_minutes_min INTEGER NOT NULL,
    duration_minutes_max INTEGER NOT NULL,
    level_required INTEGER NOT NULL,
    themes JSONB NOT NULL, -- ["communication", "vulnerability"]
    tags JSONB NOT NULL, -- ["quick", "daily", "verbal"]
    contraindications JSONB DEFAULT '[]', -- ["active_conflict", "recent_betrayal"]
    how_to_play TEXT NOT NULL,
    safety_notes TEXT,
    debrief_questions JSONB NOT NULL, -- ["question1", "question2"]
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_games_level ON games(level_required);
CREATE INDEX IF NOT EXISTS idx_games_themes ON games USING GIN (themes);
CREATE INDEX IF NOT EXISTS idx_games_tags ON games USING GIN (tags);

-- Audit Log Table
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_journal_entries_updated_at BEFORE UPDATE ON journal_entries 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_games_updated_at BEFORE UPDATE ON games 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate pairing codes
CREATE OR REPLACE FUNCTION generate_pairing_code()
RETURNS VARCHAR(8) AS $$
DECLARE
    code VARCHAR(8);
    exists BOOLEAN;
BEGIN
    LOOP
        -- Generate 8-character alphanumeric code
        code := upper(substring(md5(random()::text) from 1 for 8));
        
        -- Check if code already exists
        SELECT EXISTS(SELECT 1 FROM users WHERE pairing_code = code) INTO exists;
        
        -- Exit loop if code is unique
        EXIT WHEN NOT exists;
    END LOOP;
    
    RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Function to check couple progression
CREATE OR REPLACE FUNCTION check_section_progression(
    p_couple_id UUID,
    p_level INTEGER,
    p_section INTEGER
) RETURNS JSONB AS $$
DECLARE
    progress_record section_progress%ROWTYPE;
    result JSONB;
BEGIN
    SELECT * INTO progress_record 
    FROM section_progress 
    WHERE couple_id = p_couple_id 
      AND level = p_level 
      AND section = p_section;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'status', 'not_found',
            'message', 'Section progress not found'
        );
    END IF;
    
    -- Check if both partners completed content
    IF progress_record.partner1_content_complete AND progress_record.partner2_content_complete THEN
        -- Check if settle timer should start
        IF progress_record.settle_timer_start IS NULL THEN
            UPDATE section_progress 
            SET settle_timer_start = NOW() 
            WHERE couple_id = p_couple_id 
              AND level = p_level 
              AND section = p_section;
            
            RETURN jsonb_build_object(
                'status', 'settling',
                'settle_timer_start', NOW(),
                'comprehension_available_at', NOW() + INTERVAL '24 hours'
            );
        END IF;
        
        -- Check if 24 hours have passed
        IF progress_record.settle_timer_start + INTERVAL '24 hours' <= NOW() 
           AND progress_record.comprehension_unlocked_at IS NULL THEN
            UPDATE section_progress 
            SET comprehension_unlocked_at = NOW() 
            WHERE couple_id = p_couple_id 
              AND level = p_level 
              AND section = p_section;
            
            RETURN jsonb_build_object(
                'status', 'comprehension_ready',
                'comprehension_unlocked_at', NOW()
            );
        END IF;
    END IF;
    
    RETURN jsonb_build_object(
        'status', 'waiting',
        'progress', row_to_json(progress_record)
    );
END;
$$ LANGUAGE plpgsql;

-- Insert initial games data
INSERT INTO games (id, title, description, objective, duration_minutes_min, duration_minutes_max, level_required, themes, tags, how_to_play, safety_notes, debrief_questions) VALUES
('iwr', 'Internal Weather Report', 'Share your emotional state like weather', 'Build emotional awareness and vulnerability', 2, 3, 1, '["communication", "vulnerability"]', '["quick", "daily", "verbal"]', 
'One partner shares their emotional state using weather metaphors. "I''m sunny with clouds of anxiety" or "I''m stormy with lightning bolts of anger." No response needed, just witness.', 
'None - this is a low-risk game', 
'["What weather pattern shows up most often?", "What helps shift your weather?"]'),

('pause', 'Pause', 'Stop conversations from spiraling', 'Recognize when a conversation is going off track, take accountability, and rewind to a better moment', 1, 2, 1, '["elevation", "repair"]', '["quick", "crisis"]',
'1. Either partner calls "Pause"\n2. Caller has 15 seconds to identify where things went wrong\n3. Must own their part: "I got defensive when..."\n4. If no ownership in 15 seconds, conversation resumes\n5. Other partner shares their responsibility\n6. Both say "Rewind" to restart before the misstep\n7. Say "Play!" together to continue',
'Stop if elevation above 7/10',
'["What triggered the spiral?", "How can we catch it earlier next time?"]'),

('pillar_talk', 'Pillar Talk', 'Explore the Four Pillars together', 'Deepen understanding of relationship foundations', 5, 10, 1, '["communication", "foundation"]', '["quick", "verbal"]',
'1. Pick one of the Four Pillars (Freeness, Wholesomeness, Non-Meanness, Fairness)\n2. Each partner shares: How am I honoring this pillar? Where am I struggling?\n3. Listen without fixing or defending\n4. End with appreciation for honesty',
'None - foundational conversation',
'["Which pillar needs most attention right now?", "How can we support each other with this?"]')

ON CONFLICT (id) DO NOTHING;

-- Grant permissions to application user
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO teri_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO teri_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO teri_app;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO teri_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO teri_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO teri_app;

-- Create views for common queries
CREATE OR REPLACE VIEW v_couple_progress AS
SELECT 
    c.id as couple_id,
    c.partner1_id,
    c.partner2_id,
    c.current_level,
    c.current_section,
    c.status as couple_status,
    sp.level,
    sp.section,
    sp.partner1_content_complete,
    sp.partner2_content_complete,
    sp.settle_timer_start,
    sp.comprehension_unlocked_at,
    sp.section_unlocked,
    CASE 
        WHEN sp.partner1_content_complete AND sp.partner2_content_complete 
             AND sp.comprehension_unlocked_at IS NOT NULL
        THEN 'comprehension_ready'
        WHEN sp.partner1_content_complete AND sp.partner2_content_complete 
             AND sp.settle_timer_start IS NOT NULL
        THEN 'settling'
        WHEN sp.partner1_content_complete AND sp.partner2_content_complete
        THEN 'both_complete'
        WHEN sp.partner1_content_complete OR sp.partner2_content_complete
        THEN 'one_complete'
        ELSE 'not_started'
    END as progress_status
FROM couples c
LEFT JOIN section_progress sp ON c.id = sp.couple_id;

GRANT SELECT ON v_couple_progress TO teri_app;

-- Create function for user statistics
CREATE OR REPLACE FUNCTION get_user_stats(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    stats JSONB;
BEGIN
    SELECT jsonb_build_object(
        'translator_sessions', COUNT(*) FILTER (WHERE ts.user_id = p_user_id),
        'mediator_sessions', COUNT(*) FILTER (WHERE ms.user_id = p_user_id),
        'journal_entries', COUNT(*) FILTER (WHERE je.user_id = p_user_id),
        'game_sessions', COUNT(*) FILTER (WHERE gs.couple_id IN (SELECT id FROM couples WHERE partner1_id = p_user_id OR partner2_id = p_user_id)),
        'sections_completed', COUNT(*) FILTER (WHERE 
            (sp.partner1_content_complete = true AND c.partner1_id = p_user_id) OR
            (sp.partner2_content_complete = true AND c.partner2_id = p_user_id)
        ),
        'current_level', MAX(c.current_level),
        'current_section', MAX(c.current_section)
    ) INTO stats
    FROM users u
    LEFT JOIN couples c ON u.id IN (c.partner1_id, c.partner2_id)
    LEFT JOIN translator_sessions ts ON u.id = ts.user_id
    LEFT JOIN mediator_sessions ms ON u.id = ms.user_id
    LEFT JOIN journal_entries je ON u.id = je.user_id
    LEFT JOIN game_sessions gs ON c.id = gs.couple_id
    LEFT JOIN section_progress sp ON c.id = sp.couple_id
    WHERE u.id = p_user_id;
    
    RETURN stats;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_user_stats TO teri_app;

COMMIT;