
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    partner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    pairing_code VARCHAR(8) UNIQUE,
    pairing_code_expires TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    last_active TIMESTAMP DEFAULT NOW(),
    preferences JSONB DEFAULT '{
        "notifications": true,
        "reminder_time": "20:00",
        "theme": "auto",
        "text_size": "medium"
    }',
    phone VARCHAR(20),
    timezone VARCHAR(50) DEFAULT 'UTC',
    email_verified BOOLEAN DEFAULT false,
    profile_image_url TEXT,
    subscription_tier VARCHAR(20) DEFAULT 'free', -- free, pro, enterprise
    subscription_expires TIMESTAMP,
    terms_accepted_at TIMESTAMP,
    privacy_accepted_at TIMESTAMP,
    onboarding_completed BOOLEAN DEFAULT false,

    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT valid_pairing_code CHECK (pairing_code ~* '^[A-Z0-9]{8}$' OR pairing_code IS NULL),
    CONSTRAINT valid_timezone CHECK (timezone IS NOT NULL)
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_partner_id ON users(partner_id) WHERE partner_id IS NOT NULL;
CREATE INDEX idx_users_pairing_code ON users(pairing_code) WHERE pairing_code IS NOT NULL;
CREATE INDEX idx_users_last_active ON users(last_active);
CREATE INDEX idx_users_created_at ON users(created_at);

CREATE TABLE couples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner1_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    partner2_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    current_level INTEGER DEFAULT 1,
    current_section INTEGER DEFAULT 1,
    relationship_start_date DATE,
    paired_at TIMESTAMP DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'active', -- active, paused, ended
    shared_timezone VARCHAR(50) DEFAULT 'UTC',
    relationship_type VARCHAR(20) DEFAULT 'romantic', -- romantic, friendship, family
    privacy_settings JSONB DEFAULT '{
        "share_progress": true,
        "share_journal_entries": false,
        "show_online_status": true
    }',
    goals JSONB DEFAULT '[]', -- Array of relationship goals
    notes TEXT, -- Private notes visible to both partners

    UNIQUE(partner1_id, partner2_id),
    CHECK (partner1_id < partner2_id), -- Enforce canonical ordering (smaller UUID first)
    CHECK (partner1_id != partner2_id), -- Cannot pair with self
    CHECK (status IN ('active', 'paused', 'ended')),
    CHECK (current_level >= 1 AND current_level <= 7),
    CHECK (current_section >= 1)
);

CREATE INDEX idx_couples_partners ON couples(partner1_id, partner2_id);
CREATE INDEX idx_couples_status ON couples(status);
CREATE INDEX idx_couples_level_section ON couples(current_level, current_section);
CREATE INDEX idx_couples_paired_at ON couples(paired_at);

CREATE TABLE section_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    couple_id UUID NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
    level INTEGER NOT NULL,
    section INTEGER NOT NULL,

    partner1_content_complete BOOLEAN DEFAULT false,
    partner1_completed_at TIMESTAMP,
    partner1_comprehension_score DECIMAL(3,2), -- 0.00 to 1.00
    partner1_comprehension_attempts INTEGER DEFAULT 0,
    partner1_time_spent_minutes INTEGER DEFAULT 0,
    partner1_last_accessed TIMESTAMP,

    partner2_content_complete BOOLEAN DEFAULT false,
    partner2_completed_at TIMESTAMP,
    partner2_comprehension_score DECIMAL(3,2), -- 0.00 to 1.00
    partner2_comprehension_attempts INTEGER DEFAULT 0,
    partner2_time_spent_minutes INTEGER DEFAULT 0,
    partner2_last_accessed TIMESTAMP,

    settle_timer_start TIMESTAMP,
    comprehension_unlocked_at TIMESTAMP,
    section_unlocked BOOLEAN DEFAULT false,
    section_unlocked_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    notes JSONB DEFAULT '{}', -- Flexible storage for additional data

    UNIQUE(couple_id, level, section),
    CHECK (level >= 1 AND level <= 7),
    CHECK (section >= 1),
    CHECK (partner1_comprehension_score IS NULL OR (partner1_comprehension_score >= 0 AND partner1_comprehension_score <= 1)),
    CHECK (partner2_comprehension_score IS NULL OR (partner2_comprehension_score >= 0 AND partner2_comprehension_score <= 1)),
    CHECK (partner1_comprehension_attempts >= 0),
    CHECK (partner2_comprehension_attempts >= 0),
    CHECK (partner1_time_spent_minutes >= 0),
    CHECK (partner2_time_spent_minutes >= 0)
);

CREATE INDEX idx_progress_couple ON section_progress(couple_id);
CREATE INDEX idx_progress_level_section ON section_progress(level, section);
CREATE INDEX idx_progress_unlocked ON section_progress(section_unlocked, section_unlocked_at);
CREATE INDEX idx_progress_comprehension_ready ON section_progress(comprehension_unlocked_at) WHERE comprehension_unlocked_at IS NOT NULL;
CREATE INDEX idx_progress_updated_at ON section_progress(updated_at);

CREATE TABLE translator_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    couple_id UUID NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
    mode VARCHAR(10) NOT NULL, -- 'TES' or 'TEL'

    input_text TEXT NOT NULL,
    input_context JSONB DEFAULT '{}', -- Additional context for better translation

    output_data JSONB NOT NULL,

    processing_time_ms INTEGER,
    model_version VARCHAR(50),
    confidence_score DECIMAL(3,2), -- 0.00 to 1.00
    feedback VARCHAR(20), -- helpful, neutral, not_helpful
    feedback_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,

    CHECK (mode IN ('TES', 'TEL')),
    CHECK (LENGTH(input_text) > 0 AND LENGTH(input_text) <= 5000),
    CHECK (feedback IS NULL OR feedback IN ('helpful', 'neutral', 'not_helpful')),
    CHECK (processing_time_ms IS NULL OR processing_time_ms > 0),
    CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1))
);

CREATE INDEX idx_translator_user ON translator_sessions(user_id);
CREATE INDEX idx_translator_couple ON translator_sessions(couple_id);
CREATE INDEX idx_translator_mode ON translator_sessions(mode);
CREATE INDEX idx_translator_created_at ON translator_sessions(created_at);
CREATE INDEX idx_translator_feedback ON translator_sessions(feedback) WHERE feedback IS NOT NULL;

CREATE TABLE mediator_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    couple_id UUID NOT NULL REFERENCES couples(id) ON DELETE CASCADE,

    audio_url TEXT NOT NULL, -- S3 path
    audio_duration_seconds INTEGER NOT NULL,
    audio_format VARCHAR(10) DEFAULT 'm4a', -- m4a, wav, mp3
    audio_size_bytes BIGINT,
    upload_completed_at TIMESTAMP,

    transcript TEXT NOT NULL,
    speaker VARCHAR(10) NOT NULL, -- 'partner1' or 'partner2'
    transcription_confidence DECIMAL(3,2), -- 0.00 to 1.00
    language_detected VARCHAR(10) DEFAULT 'en',

    tel_summary JSONB NOT NULL,

    depth_questions JSONB NOT NULL, -- ["question1", "question2", ...]
    suggested_games JSONB NOT NULL, -- [{game_id, score, rationale}, ...]
    emotional_markers JSONB DEFAULT '{}', -- Detected emotions and intensity

    processing_time_ms INTEGER,
    transcription_time_ms INTEGER,
    analysis_time_ms INTEGER,
    model_versions JSONB DEFAULT '{}', -- {asr: "whisper-1", llm: "gpt-4"}
    feedback VARCHAR(20), -- helpful, neutral, not_helpful
    feedback_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),

    auto_delete_at TIMESTAMP, -- Automatically delete after 90 days
    consent_recorded BOOLEAN DEFAULT true,

    CHECK (speaker IN ('partner1', 'partner2')),
    CHECK (audio_duration_seconds > 0 AND audio_duration_seconds <= 300), -- Max 5 minutes
    CHECK (audio_format IN ('m4a', 'wav', 'mp3')),
    CHECK (transcription_confidence IS NULL OR (transcription_confidence >= 0 AND transcription_confidence <= 1)),
    CHECK (feedback IS NULL OR feedback IN ('helpful', 'neutral', 'not_helpful')),
    CHECK (processing_time_ms IS NULL OR processing_time_ms > 0),
    CHECK (LENGTH(transcript) > 0)
);

CREATE INDEX idx_mediator_user ON mediator_sessions(user_id);
CREATE INDEX idx_mediator_couple ON mediator_sessions(couple_id);
CREATE INDEX idx_mediator_created_at ON mediator_sessions(created_at);
CREATE INDEX idx_mediator_speaker ON mediator_sessions(speaker);
CREATE INDEX idx_mediator_auto_delete ON mediator_sessions(auto_delete_at) WHERE auto_delete_at IS NOT NULL;
CREATE INDEX idx_mediator_feedback ON mediator_sessions(feedback) WHERE feedback IS NOT NULL;

CREATE TABLE journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    level INTEGER,
    section INTEGER,
    prompt TEXT,
    content TEXT NOT NULL,
    shared_with_partner BOOLEAN DEFAULT false,
    shared_at TIMESTAMP,

    word_count INTEGER,
    mood VARCHAR(50), -- User-selected mood
    tags JSONB DEFAULT '[]', -- User-defined tags
    is_private BOOLEAN DEFAULT true, -- Extra privacy flag
    template_used VARCHAR(100), -- If generated from template

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    deleted_at TIMESTAMP,
    deleted_reason VARCHAR(100),

    CHECK (LENGTH(content) > 0 AND LENGTH(content) <= 50000), -- Max 50k characters
    CHECK (level IS NULL OR (level >= 1 AND level <= 7)),
    CHECK (section IS NULL OR section >= 1),
    CHECK (word_count IS NULL OR word_count >= 0),
    CHECK (shared_with_partner = false OR shared_at IS NOT NULL) -- If shared, must have timestamp
);

CREATE INDEX idx_journal_user ON journal_entries(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_journal_section ON journal_entries(level, section) WHERE deleted_at IS NULL;
CREATE INDEX idx_journal_shared ON journal_entries(shared_with_partner, shared_at) WHERE shared_with_partner = true;
CREATE INDEX idx_journal_created_at ON journal_entries(created_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_journal_updated_at ON journal_entries(updated_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_journal_tags ON journal_entries USING GIN(tags) WHERE deleted_at IS NULL;

CREATE TABLE game_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    couple_id UUID NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
    game_id VARCHAR(50) NOT NULL,

    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    duration_minutes INTEGER,
    paused_duration_minutes INTEGER DEFAULT 0, -- Time spent paused

    started_by_user_id UUID REFERENCES users(id),
    participants JSONB DEFAULT '[]', -- Array of user IDs who participated

    feedback VARCHAR(20), -- helpful, neutral, not_helpful
    rating INTEGER, -- 1-5 star rating
    notes TEXT,
    debrief_responses JSONB DEFAULT '{}', -- Responses to debrief questions

    game_data JSONB DEFAULT '{}', -- Flexible storage for game-specific information
    interruptions INTEGER DEFAULT 0, -- Number of times game was paused/interrupted
    difficulty_level VARCHAR(20), -- easy, medium, hard (as experienced)
    suggested_by VARCHAR(50), -- mediator, manual, daily, etc.
    suggestion_context JSONB DEFAULT '{}', -- Why this game was suggested

    insights_gained JSONB DEFAULT '[]', -- Array of insights or breakthroughs
    follow_up_needed BOOLEAN DEFAULT false,
    follow_up_notes TEXT,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    CHECK (feedback IS NULL OR feedback IN ('helpful', 'neutral', 'not_helpful')),
    CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
    CHECK (duration_minutes IS NULL OR duration_minutes > 0),
    CHECK (paused_duration_minutes >= 0),
    CHECK (interruptions >= 0),
    CHECK (completed_at IS NULL OR completed_at >= started_at),
    CHECK (difficulty_level IS NULL OR difficulty_level IN ('easy', 'medium', 'hard'))
);

CREATE INDEX idx_games_couple ON game_sessions(couple_id);
CREATE INDEX idx_games_game_id ON game_sessions(game_id);
CREATE INDEX idx_games_started_at ON game_sessions(started_at);
CREATE INDEX idx_games_completed ON game_sessions(completed_at) WHERE completed_at IS NOT NULL;
CREATE INDEX idx_games_feedback ON game_sessions(feedback) WHERE feedback IS NOT NULL;
CREATE INDEX idx_games_rating ON game_sessions(rating) WHERE rating IS NOT NULL;
CREATE INDEX idx_games_started_by ON game_sessions(started_by_user_id) WHERE started_by_user_id IS NOT NULL;

CREATE TABLE comprehension_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level INTEGER NOT NULL,
    section INTEGER NOT NULL,
    question_type VARCHAR(20) NOT NULL, -- multiple_choice, translation, scenario
    question_data JSONB NOT NULL, -- Full question object with options, scoring, etc.
    difficulty VARCHAR(20) DEFAULT 'medium', -- easy, medium, hard
    points_possible INTEGER DEFAULT 1,

    concepts_tested JSONB DEFAULT '[]', -- Array of concepts this question tests
    estimated_time_minutes INTEGER DEFAULT 2,
    author VARCHAR(100),
    version INTEGER DEFAULT 1,

    times_presented INTEGER DEFAULT 0,
    times_correct INTEGER DEFAULT 0,
    avg_score DECIMAL(3,2),

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    is_active BOOLEAN DEFAULT true,
    retired_at TIMESTAMP,
    retired_reason TEXT,

    CHECK (level >= 1 AND level <= 7),
    CHECK (section >= 1),
    CHECK (question_type IN ('multiple_choice', 'translation', 'scenario')),
    CHECK (difficulty IN ('easy', 'medium', 'hard')),
    CHECK (points_possible > 0),
    CHECK (estimated_time_minutes > 0),
    CHECK (times_presented >= 0),
    CHECK (times_correct >= 0),
    CHECK (times_correct <= times_presented),
    CHECK (avg_score IS NULL OR (avg_score >= 0 AND avg_score <= 1))
);

CREATE INDEX idx_questions_level_section ON comprehension_questions(level, section) WHERE is_active = true;
CREATE INDEX idx_questions_difficulty ON comprehension_questions(difficulty) WHERE is_active = true;
CREATE INDEX idx_questions_type ON comprehension_questions(question_type) WHERE is_active = true;
CREATE INDEX idx_questions_concepts ON comprehension_questions USING GIN(concepts_tested) WHERE is_active = true;

CREATE TABLE comprehension_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    couple_id UUID NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
    level INTEGER NOT NULL,
    section INTEGER NOT NULL,
    attempt_number INTEGER NOT NULL,

    questions_presented JSONB NOT NULL, -- Array of question IDs
    answers_submitted JSONB NOT NULL, -- User's answers
    scores_per_question JSONB NOT NULL, -- Individual question scores

    total_score DECIMAL(3,2) NOT NULL, -- 0.00 to 1.00
    passed BOOLEAN NOT NULL,
    time_taken_minutes INTEGER,

    detailed_feedback JSONB DEFAULT '{}', -- Per-question feedback
    areas_for_improvement JSONB DEFAULT '[]', -- Concepts to review
    strengths JSONB DEFAULT '[]', -- Concepts mastered

    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP NOT NULL,

    UNIQUE(user_id, level, section, attempt_number),
    CHECK (level >= 1 AND level <= 7),
    CHECK (section >= 1),
    CHECK (attempt_number >= 1),
    CHECK (total_score >= 0 AND total_score <= 1),
    CHECK (time_taken_minutes IS NULL OR time_taken_minutes > 0),
    CHECK (completed_at >= started_at)
);

CREATE INDEX idx_attempts_user ON comprehension_attempts(user_id);
CREATE INDEX idx_attempts_couple ON comprehension_attempts(couple_id);
CREATE INDEX idx_attempts_level_section ON comprehension_attempts(level, section);
CREATE INDEX idx_attempts_passed ON comprehension_attempts(passed);
CREATE INDEX idx_attempts_completed_at ON comprehension_attempts(completed_at);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- comprehension_ready, section_unlocked, reminder, etc.
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,

    category VARCHAR(50), -- progress, social, system, marketing
    priority VARCHAR(10) DEFAULT 'medium', -- low, medium, high, urgent
    action_url TEXT, -- Deep link to relevant screen
    action_data JSONB DEFAULT '{}', -- Additional data for action

    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    read_at TIMESTAMP,
    clicked_at TIMESTAMP,
    dismissed_at TIMESTAMP,

    scheduled_for TIMESTAMP,
    expires_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT NOW(),

    CHECK (type IS NOT NULL AND LENGTH(type) > 0),
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    CHECK (scheduled_for IS NULL OR scheduled_for >= created_at),
    CHECK (sent_at IS NULL OR sent_at >= created_at),
    CHECK (delivered_at IS NULL OR delivered_at >= sent_at),
    CHECK (read_at IS NULL OR read_at >= delivered_at),
    CHECK (clicked_at IS NULL OR clicked_at >= read_at)
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_scheduled ON notifications(scheduled_for) WHERE scheduled_for IS NOT NULL AND sent_at IS NULL;
CREATE INDEX idx_notifications_unread ON notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    couple_id UUID REFERENCES couples(id) ON DELETE SET NULL,

    event_type VARCHAR(100) NOT NULL, -- user_created, section_completed, etc.
    event_category VARCHAR(50) NOT NULL, -- auth, progress, content, etc.
    description TEXT NOT NULL,

    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(100),
    request_id VARCHAR(100),

    old_values JSONB,
    new_values JSONB,
    affected_table VARCHAR(100),
    affected_record_id UUID,

    event_data JSONB DEFAULT '{}',
    severity VARCHAR(20) DEFAULT 'info', -- debug, info, warning, error, critical

    created_at TIMESTAMP DEFAULT NOW(),

    CHECK (event_type IS NOT NULL AND LENGTH(event_type) > 0),
    CHECK (event_category IS NOT NULL AND LENGTH(event_category) > 0),
    CHECK (severity IN ('debug', 'info', 'warning', 'error', 'critical'))
);

CREATE INDEX idx_audit_user ON audit_log(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_audit_couple ON audit_log(couple_id) WHERE couple_id IS NOT NULL;
CREATE INDEX idx_audit_event_type ON audit_log(event_type);
CREATE INDEX idx_audit_category ON audit_log(event_category);
CREATE INDEX idx_audit_severity ON audit_log(severity);
CREATE INDEX idx_audit_created_at ON audit_log(created_at);
CREATE INDEX idx_audit_affected ON audit_log(affected_table, affected_record_id) WHERE affected_table IS NOT NULL;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_couples_updated_at BEFORE UPDATE ON couples FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_section_progress_updated_at BEFORE UPDATE ON section_progress FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_journal_entries_updated_at BEFORE UPDATE ON journal_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_game_sessions_updated_at BEFORE UPDATE ON game_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_comprehension_questions_updated_at BEFORE UPDATE ON comprehension_questions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION set_mediator_auto_delete()
RETURNS TRIGGER AS $$
BEGIN
    NEW.auto_delete_at = NEW.created_at + INTERVAL '90 days';
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER set_mediator_auto_delete_trigger
    BEFORE INSERT ON mediator_sessions
    FOR EACH ROW EXECUTE FUNCTION set_mediator_auto_delete();

CREATE VIEW active_couples_progress AS
SELECT
    c.id as couple_id,
    c.partner1_id,
    c.partner2_id,
    u1.name as partner1_name,
    u2.name as partner2_name,
    c.current_level,
    c.current_section,
    c.paired_at,
    c.status,
    COUNT(sp.id) as sections_started,
    SUM(CASE WHEN sp.section_unlocked THEN 1 ELSE 0 END) as sections_completed,
    AVG(sp.partner1_comprehension_score) as partner1_avg_score,
    AVG(sp.partner2_comprehension_score) as partner2_avg_score,
    MAX(GREATEST(u1.last_active, u2.last_active)) as last_activity,
    COUNT(ts.id) as translator_uses_last_week,
    COUNT(ms.id) as mediator_uses_last_week,
    COUNT(gs.id) as games_played_last_week
FROM couples c
JOIN users u1 ON c.partner1_id = u1.id
JOIN users u2 ON c.partner2_id = u2.id
LEFT JOIN section_progress sp ON c.id = sp.couple_id
LEFT JOIN translator_sessions ts ON c.id = ts.couple_id AND ts.created_at > NOW() - INTERVAL '7 days'
LEFT JOIN mediator_sessions ms ON c.id = ms.couple_id AND ms.created_at > NOW() - INTERVAL '7 days'
LEFT JOIN game_sessions gs ON c.id = gs.couple_id AND gs.started_at > NOW() - INTERVAL '7 days'
WHERE c.status = 'active'
GROUP BY c.id, u1.name, u2.name;

CREATE VIEW user_engagement_metrics AS
SELECT
    u.id as user_id,
    u.name,
    u.email,
    u.created_at,
    u.last_active,
    COUNT(DISTINCT CONCAT(sp.level, '-', sp.section)) as sections_started,
    SUM(CASE WHEN u.id = c.partner1_id AND sp.partner1_content_complete THEN 1
             WHEN u.id = c.partner2_id AND sp.partner2_content_complete THEN 1
             ELSE 0 END) as sections_completed,
    COUNT(ts.id) as translator_sessions,
    COUNT(ms.id) as mediator_sessions,
    COUNT(je.id) as journal_entries,
    COUNT(gs.id) as games_participated,
    COUNT(CASE WHEN ts.created_at > NOW() - INTERVAL '30 days' THEN 1 END) as translator_sessions_30d,
    COUNT(CASE WHEN ms.created_at > NOW() - INTERVAL '30 days' THEN 1 END) as mediator_sessions_30d,
    COUNT(CASE WHEN je.created_at > NOW() - INTERVAL '30 days' THEN 1 END) as journal_entries_30d,
    COUNT(CASE WHEN gs.started_at > NOW() - INTERVAL '30 days' THEN 1 END) as games_30d
FROM users u
LEFT JOIN couples c ON u.id IN (c.partner1_id, c.partner2_id)
LEFT JOIN section_progress sp ON c.id = sp.couple_id
LEFT JOIN translator_sessions ts ON u.id = ts.user_id
LEFT JOIN mediator_sessions ms ON u.id = ms.user_id
LEFT JOIN journal_entries je ON u.id = je.user_id AND je.deleted_at IS NULL
LEFT JOIN game_sessions gs ON c.id = gs.couple_id
GROUP BY u.id, u.name, u.email, u.created_at, u.last_active;

CREATE OR REPLACE FUNCTION pair_users(
    p_user1_id UUID,
    p_user2_id UUID,
    p_relationship_start_date DATE DEFAULT NULL,
    p_shared_timezone VARCHAR DEFAULT 'UTC'
) RETURNS UUID AS $$
DECLARE
    v_couple_id UUID;
    v_partner1_id UUID;
    v_partner2_id UUID;
BEGIN
    IF p_user1_id < p_user2_id THEN
        v_partner1_id := p_user1_id;
        v_partner2_id := p_user2_id;
    ELSE
        v_partner1_id := p_user2_id;
        v_partner2_id := p_user1_id;
    END IF;

    IF EXISTS (SELECT 1 FROM users WHERE id IN (v_partner1_id, v_partner2_id) AND partner_id IS NOT NULL) THEN
        RAISE EXCEPTION 'One or both users are already paired';
    END IF;

    INSERT INTO couples (partner1_id, partner2_id, relationship_start_date, shared_timezone)
    VALUES (v_partner1_id, v_partner2_id, p_relationship_start_date, p_shared_timezone)
    RETURNING id INTO v_couple_id;

    UPDATE users
    SET partner_id = v_partner2_id, pairing_code = NULL, pairing_code_expires = NULL
    WHERE id = v_partner1_id;

    UPDATE users
    SET partner_id = v_partner1_id, pairing_code = NULL, pairing_code_expires = NULL
    WHERE id = v_partner2_id;

    INSERT INTO section_progress (couple_id, level, section)
    VALUES (v_couple_id, 1, 1);

    RETURN v_couple_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION check_section_progression(
    p_couple_id UUID,
    p_level INTEGER,
    p_section INTEGER
) RETURNS JSON AS $$
DECLARE
    v_progress section_progress%ROWTYPE;
    v_result JSON;
    v_both_content_complete BOOLEAN;
    v_settle_elapsed BOOLEAN;
    v_both_passed BOOLEAN;
BEGIN
    SELECT * INTO v_progress
    FROM section_progress
    WHERE couple_id = p_couple_id AND level = p_level AND section = p_section;

    IF v_progress.id IS NULL THEN
        RETURN json_build_object('status', 'not_found');
    END IF;

    v_both_content_complete := v_progress.partner1_content_complete AND v_progress.partner2_content_complete;

    IF v_both_content_complete AND v_progress.settle_timer_start IS NULL THEN
        UPDATE section_progress
        SET settle_timer_start = NOW()
        WHERE id = v_progress.id;

        RETURN json_build_object(
            'status', 'settle_timer_started',
            'unlocks_at', NOW() + INTERVAL '24 hours'
        );
    END IF;

    v_settle_elapsed := (v_progress.settle_timer_start IS NOT NULL) AND
                       (NOW() - v_progress.settle_timer_start > INTERVAL '24 hours');

    IF v_settle_elapsed AND v_progress.comprehension_unlocked_at IS NULL THEN
        UPDATE section_progress
        SET comprehension_unlocked_at = NOW()
        WHERE id = v_progress.id;

        RETURN json_build_object('status', 'comprehension_unlocked');
    END IF;

    v_both_passed := (v_progress.partner1_comprehension_score >= 0.80) AND
                     (v_progress.partner2_comprehension_score >= 0.80);

    IF v_both_passed AND NOT v_progress.section_unlocked THEN
        UPDATE section_progress
        SET section_unlocked = TRUE, section_unlocked_at = NOW()
        WHERE id = v_progress.id;

        INSERT INTO section_progress (couple_id, level, section)
        VALUES (p_couple_id, p_level, p_section + 1)
        ON CONFLICT (couple_id, level, section) DO NOTHING;

        RETURN json_build_object(
            'status', 'section_unlocked',
            'next_section', p_section + 1
        );
    END IF;

    RETURN json_build_object(
        'status', 'waiting',
        'both_content_complete', v_both_content_complete,
        'settle_time_remaining', CASE
            WHEN v_progress.settle_timer_start IS NOT NULL
            THEN GREATEST(0, EXTRACT(epoch FROM (v_progress.settle_timer_start + INTERVAL '24 hours' - NOW())))
            ELSE NULL
        END,
        'comprehension_available', v_progress.comprehension_unlocked_at IS NOT NULL,
        'both_passed', v_both_passed
    );
END;
$$ LANGUAGE plpgsql;

CREATE INDEX CONCURRENTLY idx_users_email_lower ON users(LOWER(email));
CREATE INDEX CONCURRENTLY idx_audit_log_event_data ON audit_log USING GIN(event_data);
CREATE INDEX CONCURRENTLY idx_translator_output_data ON translator_sessions USING GIN(output_data);

COMMENT ON TABLE users IS 'Individual user accounts with authentication and profile information';
COMMENT ON TABLE couples IS 'Partner relationships with canonical ordering (smaller UUID first)';
COMMENT ON TABLE section_progress IS 'Training progress tracking with 24-hour settle timer and gating logic';
COMMENT ON TABLE translator_sessions IS 'TES/TEL translation sessions with LLM outputs';
COMMENT ON TABLE mediator_sessions IS 'Audio recording analysis with transcription and insights';
COMMENT ON TABLE journal_entries IS 'Personal reflections and journaling with privacy controls';
COMMENT ON TABLE game_sessions IS 'Relationship games and activities tracking';
COMMENT ON TABLE comprehension_questions IS 'Quiz questions for section completion testing';
COMMENT ON TABLE comprehension_attempts IS 'User attempts at comprehension quizzes with detailed scoring';
COMMENT ON TABLE notifications IS 'System notifications and user communications';
COMMENT ON TABLE audit_log IS 'Comprehensive audit trail for security and debugging';

COMMENT ON COLUMN couples.partner1_id IS 'Always the smaller UUID for canonical ordering';
COMMENT ON COLUMN couples.partner2_id IS 'Always the larger UUID for canonical ordering';
COMMENT ON COLUMN section_progress.settle_timer_start IS 'Starts when both partners complete content, unlocks comprehension after 24h';
COMMENT ON COLUMN mediator_sessions.auto_delete_at IS 'Automatically set to created_at + 90 days for compliance';
COMMENT ON COLUMN translator_sessions.output_data IS 'JSONB containing TES/TEL structure with outer, inner, under, etc.';

