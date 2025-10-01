-- ============================================================================
-- TERI Mobile App - Initial Database Schema Migration
-- Migration: 001_initial_schema.sql
-- Created: 2025-09-30
-- Description: Complete initial schema with all tables, indexes, and triggers
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Users table with enhanced authentication and profile features
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    partner_id UUID,
    pairing_code VARCHAR(8) UNIQUE,
    pairing_code_expires TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    last_active TIMESTAMP DEFAULT NOW(),
    preferences JSONB DEFAULT '{
        "notifications": true,
        "reminder_time": "20:00",
        "theme": "auto",
        "text_size": "medium",
        "sound_enabled": true,
        "haptic_enabled": true
    }',

    -- Enhanced profile fields
    phone VARCHAR(20),
    timezone VARCHAR(50) DEFAULT 'UTC',
    email_verified BOOLEAN DEFAULT false,
    phone_verified BOOLEAN DEFAULT false,
    profile_image_url TEXT,
    subscription_tier VARCHAR(20) DEFAULT 'free',
    subscription_expires TIMESTAMP,
    terms_accepted_at TIMESTAMP,
    privacy_accepted_at TIMESTAMP,
    onboarding_completed BOOLEAN DEFAULT false,

    -- Security and compliance
    two_factor_enabled BOOLEAN DEFAULT false,
    two_factor_secret VARCHAR(32),
    login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    password_reset_token VARCHAR(100),
    password_reset_expires TIMESTAMP,
    email_verification_token VARCHAR(100),
    email_verification_expires TIMESTAMP,

    -- User preferences and settings
    language_preference VARCHAR(10) DEFAULT 'en',
    accessibility_settings JSONB DEFAULT '{}',
    privacy_settings JSONB DEFAULT '{
        "show_activity_status": true,
        "allow_partner_progress_view": true,
        "share_anonymous_analytics": true
    }',

    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT valid_pairing_code CHECK (pairing_code ~* '^[A-Z0-9]{8}$' OR pairing_code IS NULL),
    CONSTRAINT valid_timezone CHECK (timezone IS NOT NULL),
    CONSTRAINT valid_subscription_tier CHECK (subscription_tier IN ('free', 'pro', 'enterprise')),
    CONSTRAINT valid_language CHECK (language_preference IN ('en', 'es', 'fr', 'de', 'pt'))
);

-- Add foreign key constraint after table creation to avoid circular dependency
ALTER TABLE users ADD CONSTRAINT fk_users_partner_id
    FOREIGN KEY (partner_id) REFERENCES users(id) ON DELETE SET NULL;

-- Couples table with enhanced relationship management
CREATE TABLE couples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner1_id UUID NOT NULL,
    partner2_id UUID NOT NULL,
    current_level INTEGER DEFAULT 1,
    current_section INTEGER DEFAULT 1,
    relationship_start_date DATE,
    paired_at TIMESTAMP DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'active',
    shared_timezone VARCHAR(50) DEFAULT 'UTC',
    relationship_type VARCHAR(20) DEFAULT 'romantic',

    -- Enhanced relationship settings
    privacy_settings JSONB DEFAULT '{
        "share_progress": true,
        "share_journal_entries": false,
        "show_online_status": true,
        "allow_game_suggestions": true
    }',
    goals JSONB DEFAULT '[]',
    notes TEXT,
    relationship_counselor_access BOOLEAN DEFAULT false,
    emergency_contact_info JSONB DEFAULT '{}',

    -- Progress tracking
    total_sections_completed INTEGER DEFAULT 0,
    total_games_played INTEGER DEFAULT 0,
    total_translator_uses INTEGER DEFAULT 0,
    total_mediator_uses INTEGER DEFAULT 0,
    longest_streak_days INTEGER DEFAULT 0,
    current_streak_days INTEGER DEFAULT 0,
    last_activity_date DATE,

    UNIQUE(partner1_id, partner2_id),
    CHECK (partner1_id < partner2_id),
    CHECK (partner1_id != partner2_id),
    CHECK (status IN ('active', 'paused', 'ended', 'suspended')),
    CHECK (current_level >= 1 AND current_level <= 7),
    CHECK (current_section >= 1),
    CHECK (relationship_type IN ('romantic', 'friendship', 'family', 'other')),

    FOREIGN KEY (partner1_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (partner2_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Section progress with enhanced tracking
CREATE TABLE section_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    couple_id UUID NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
    level INTEGER NOT NULL,
    section INTEGER NOT NULL,

    -- Partner 1 detailed progress
    partner1_content_complete BOOLEAN DEFAULT false,
    partner1_completed_at TIMESTAMP,
    partner1_comprehension_score DECIMAL(3,2),
    partner1_comprehension_attempts INTEGER DEFAULT 0,
    partner1_time_spent_minutes INTEGER DEFAULT 0,
    partner1_last_accessed TIMESTAMP,
    partner1_notes TEXT,
    partner1_difficulty_rating INTEGER, -- 1-5

    -- Partner 2 detailed progress
    partner2_content_complete BOOLEAN DEFAULT false,
    partner2_completed_at TIMESTAMP,
    partner2_comprehension_score DECIMAL(3,2),
    partner2_comprehension_attempts INTEGER DEFAULT 0,
    partner2_time_spent_minutes INTEGER DEFAULT 0,
    partner2_last_accessed TIMESTAMP,
    partner2_notes TEXT,
    partner2_difficulty_rating INTEGER, -- 1-5

    -- Gating and progression logic
    settle_timer_start TIMESTAMP,
    comprehension_unlocked_at TIMESTAMP,
    section_unlocked BOOLEAN DEFAULT false,
    section_unlocked_at TIMESTAMP,

    -- Additional tracking
    first_accessed_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    section_data JSONB DEFAULT '{}',

    UNIQUE(couple_id, level, section),
    CHECK (level >= 1 AND level <= 7),
    CHECK (section >= 1),
    CHECK (partner1_comprehension_score IS NULL OR (partner1_comprehension_score >= 0 AND partner1_comprehension_score <= 1)),
    CHECK (partner2_comprehension_score IS NULL OR (partner2_comprehension_score >= 0 AND partner2_comprehension_score <= 1)),
    CHECK (partner1_comprehension_attempts >= 0),
    CHECK (partner2_comprehension_attempts >= 0),
    CHECK (partner1_time_spent_minutes >= 0),
    CHECK (partner2_time_spent_minutes >= 0),
    CHECK (partner1_difficulty_rating IS NULL OR (partner1_difficulty_rating >= 1 AND partner1_difficulty_rating <= 5)),
    CHECK (partner2_difficulty_rating IS NULL OR (partner2_difficulty_rating >= 1 AND partner2_difficulty_rating <= 5))
);

-- ============================================================================
-- AI/ML INTERACTION TABLES
-- ============================================================================

-- Enhanced translator sessions
CREATE TABLE translator_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    couple_id UUID NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
    mode VARCHAR(10) NOT NULL,

    -- Input with context
    input_text TEXT NOT NULL,
    input_context JSONB DEFAULT '{}',
    input_language VARCHAR(10) DEFAULT 'en',
    input_sentiment VARCHAR(20), -- positive, negative, neutral, mixed

    -- LLM processing
    output_data JSONB NOT NULL,
    model_version VARCHAR(50),
    processing_time_ms INTEGER,
    confidence_score DECIMAL(3,2),
    token_count_input INTEGER,
    token_count_output INTEGER,

    -- Quality and feedback
    feedback VARCHAR(20),
    feedback_notes TEXT,
    quality_score DECIMAL(3,2), -- 0.00 to 1.00
    user_edited BOOLEAN DEFAULT false,
    final_output JSONB, -- User's edited version if different

    -- Analytics and tracking
    session_context JSONB DEFAULT '{}', -- What led to this translation
    used_in_conversation BOOLEAN DEFAULT false,
    conversation_outcome VARCHAR(50), -- resolved, escalated, postponed, etc.

    -- Technical metadata
    created_at TIMESTAMP DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    app_version VARCHAR(20),

    CHECK (mode IN ('TES', 'TEL')),
    CHECK (LENGTH(input_text) > 0 AND LENGTH(input_text) <= 5000),
    CHECK (feedback IS NULL OR feedback IN ('helpful', 'neutral', 'not_helpful')),
    CHECK (processing_time_ms IS NULL OR processing_time_ms > 0),
    CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)),
    CHECK (quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 1)),
    CHECK (input_language IN ('en', 'es', 'fr', 'de', 'pt')),
    CHECK (input_sentiment IS NULL OR input_sentiment IN ('positive', 'negative', 'neutral', 'mixed'))
);

-- Enhanced mediator sessions
CREATE TABLE mediator_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    couple_id UUID NOT NULL REFERENCES couples(id) ON DELETE CASCADE,

    -- Audio metadata
    audio_url TEXT NOT NULL,
    audio_duration_seconds INTEGER NOT NULL,
    audio_format VARCHAR(10) DEFAULT 'm4a',
    audio_size_bytes BIGINT,
    audio_quality VARCHAR(20), -- high, medium, low
    background_noise_level VARCHAR(20), -- low, medium, high
    upload_completed_at TIMESTAMP,

    -- Enhanced transcription
    transcript TEXT NOT NULL,
    speaker VARCHAR(10) NOT NULL,
    transcription_confidence DECIMAL(3,2),
    language_detected VARCHAR(10) DEFAULT 'en',
    word_timestamps JSONB DEFAULT '[]', -- Array of {word, start, end}
    emotion_markers JSONB DEFAULT '{}', -- Detected emotions throughout recording

    -- AI analysis
    tel_summary JSONB NOT NULL,
    depth_questions JSONB NOT NULL,
    suggested_games JSONB NOT NULL,
    conflict_level INTEGER, -- 1-10 scale
    emotional_intensity INTEGER, -- 1-10 scale
    key_themes JSONB DEFAULT '[]', -- Extracted themes

    -- Processing metrics
    processing_time_ms INTEGER,
    transcription_time_ms INTEGER,
    analysis_time_ms INTEGER,
    model_versions JSONB DEFAULT '{}',

    -- Feedback and outcomes
    feedback VARCHAR(20),
    feedback_notes TEXT,
    session_helpful BOOLEAN,
    games_actually_played JSONB DEFAULT '[]',
    follow_up_needed BOOLEAN DEFAULT false,

    -- Privacy and compliance
    auto_delete_at TIMESTAMP,
    consent_recorded BOOLEAN DEFAULT true,
    data_retention_category VARCHAR(50) DEFAULT 'standard', -- standard, extended, minimal

    created_at TIMESTAMP DEFAULT NOW(),

    CHECK (speaker IN ('partner1', 'partner2')),
    CHECK (audio_duration_seconds > 0 AND audio_duration_seconds <= 300),
    CHECK (audio_format IN ('m4a', 'wav', 'mp3', 'ogg')),
    CHECK (transcription_confidence IS NULL OR (transcription_confidence >= 0 AND transcription_confidence <= 1)),
    CHECK (feedback IS NULL OR feedback IN ('helpful', 'neutral', 'not_helpful')),
    CHECK (processing_time_ms IS NULL OR processing_time_ms > 0),
    CHECK (LENGTH(transcript) > 0),
    CHECK (conflict_level IS NULL OR (conflict_level >= 1 AND conflict_level <= 10)),
    CHECK (emotional_intensity IS NULL OR (emotional_intensity >= 1 AND emotional_intensity <= 10)),
    CHECK (audio_quality IS NULL OR audio_quality IN ('high', 'medium', 'low')),
    CHECK (background_noise_level IS NULL OR background_noise_level IN ('low', 'medium', 'high')),
    CHECK (data_retention_category IN ('standard', 'extended', 'minimal'))
);

-- ============================================================================
-- CONTENT AND ENGAGEMENT TABLES
-- ============================================================================

-- Enhanced journal entries
CREATE TABLE journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    level INTEGER,
    section INTEGER,

    -- Content
    prompt TEXT,
    content TEXT NOT NULL,
    word_count INTEGER,
    estimated_read_time_minutes INTEGER,

    -- Sharing and privacy
    shared_with_partner BOOLEAN DEFAULT false,
    shared_at TIMESTAMP,
    partner_reaction VARCHAR(50), -- loved, supported, curious, etc.
    partner_response_id UUID, -- Reference to partner's response entry

    -- Metadata and categorization
    mood VARCHAR(50),
    energy_level INTEGER, -- 1-10
    stress_level INTEGER, -- 1-10
    tags JSONB DEFAULT '[]',
    is_private BOOLEAN DEFAULT true,
    template_used VARCHAR(100),
    writing_session_duration_minutes INTEGER,

    -- AI insights (optional)
    ai_insights JSONB DEFAULT '{}', -- Detected themes, emotions, growth areas
    sentiment_score DECIMAL(3,2), -- -1.00 to 1.00
    growth_indicators JSONB DEFAULT '[]',

    -- Lifecycle
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_edited_at TIMESTAMP,
    deleted_at TIMESTAMP,
    deleted_reason VARCHAR(100),

    CHECK (LENGTH(content) > 0 AND LENGTH(content) <= 50000),
    CHECK (level IS NULL OR (level >= 1 AND level <= 7)),
    CHECK (section IS NULL OR section >= 1),
    CHECK (word_count IS NULL OR word_count >= 0),
    CHECK (shared_with_partner = false OR shared_at IS NOT NULL),
    CHECK (energy_level IS NULL OR (energy_level >= 1 AND energy_level <= 10)),
    CHECK (stress_level IS NULL OR (stress_level >= 1 AND stress_level <= 10)),
    CHECK (sentiment_score IS NULL OR (sentiment_score >= -1 AND sentiment_score <= 1)),
    CHECK (writing_session_duration_minutes IS NULL OR writing_session_duration_minutes > 0)
);

-- Enhanced game sessions
CREATE TABLE game_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    couple_id UUID NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
    game_id VARCHAR(50) NOT NULL,

    -- Session management
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    duration_minutes INTEGER,
    paused_duration_minutes INTEGER DEFAULT 0,
    interruptions INTEGER DEFAULT 0,
    early_termination BOOLEAN DEFAULT false,
    termination_reason VARCHAR(100),

    -- Participants
    started_by_user_id UUID REFERENCES users(id),
    participants JSONB DEFAULT '[]',
    partner1_participation_level INTEGER, -- 1-10
    partner2_participation_level INTEGER, -- 1-10

    -- Game experience
    difficulty_experienced VARCHAR(20), -- easier, as_expected, harder
    emotional_intensity_max INTEGER, -- 1-10 highest point
    conflict_resolution_achieved BOOLEAN,
    breakthrough_moments JSONB DEFAULT '[]',

    -- Feedback and outcomes
    feedback VARCHAR(20),
    rating INTEGER,
    notes TEXT,
    debrief_responses JSONB DEFAULT '{}',
    lessons_learned JSONB DEFAULT '[]',
    would_play_again BOOLEAN,

    -- Game-specific data
    game_data JSONB DEFAULT '{}',
    custom_rules_used JSONB DEFAULT '[]',
    modifications_made TEXT,

    -- Context and suggestions
    suggested_by VARCHAR(50),
    suggestion_context JSONB DEFAULT '{}',
    played_due_to_conflict BOOLEAN DEFAULT false,
    conflict_context TEXT,

    -- Outcomes and follow-up
    insights_gained JSONB DEFAULT '[]',
    action_items JSONB DEFAULT '[]',
    follow_up_needed BOOLEAN DEFAULT false,
    follow_up_notes TEXT,
    follow_up_scheduled_date DATE,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    CHECK (feedback IS NULL OR feedback IN ('helpful', 'neutral', 'not_helpful')),
    CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
    CHECK (duration_minutes IS NULL OR duration_minutes > 0),
    CHECK (paused_duration_minutes >= 0),
    CHECK (interruptions >= 0),
    CHECK (completed_at IS NULL OR completed_at >= started_at),
    CHECK (difficulty_experienced IS NULL OR difficulty_experienced IN ('easier', 'as_expected', 'harder')),
    CHECK (partner1_participation_level IS NULL OR (partner1_participation_level >= 1 AND partner1_participation_level <= 10)),
    CHECK (partner2_participation_level IS NULL OR (partner2_participation_level >= 1 AND partner2_participation_level <= 10)),
    CHECK (emotional_intensity_max IS NULL OR (emotional_intensity_max >= 1 AND emotional_intensity_max <= 10))
);

-- ============================================================================
-- ASSESSMENT AND LEARNING TABLES
-- ============================================================================

-- Enhanced comprehension questions
CREATE TABLE comprehension_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level INTEGER NOT NULL,
    section INTEGER NOT NULL,
    question_type VARCHAR(20) NOT NULL,
    question_data JSONB NOT NULL,
    difficulty VARCHAR(20) DEFAULT 'medium',
    points_possible INTEGER DEFAULT 1,

    -- Question metadata
    concepts_tested JSONB DEFAULT '[]',
    estimated_time_minutes INTEGER DEFAULT 2,
    learning_objectives JSONB DEFAULT '[]',
    author VARCHAR(100),
    version INTEGER DEFAULT 1,
    review_notes TEXT,

    -- Question analytics
    times_presented INTEGER DEFAULT 0,
    times_correct INTEGER DEFAULT 0,
    avg_score DECIMAL(3,2),
    avg_time_taken_seconds INTEGER,
    difficulty_rating_user DECIMAL(3,2), -- User-reported difficulty
    confusion_indicators JSONB DEFAULT '{}',

    -- Question lifecycle
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    retired_at TIMESTAMP,
    retired_reason TEXT,
    replacement_question_id UUID,

    -- Quality assurance
    peer_reviewed BOOLEAN DEFAULT false,
    expert_reviewed BOOLEAN DEFAULT false,
    review_feedback JSONB DEFAULT '{}',
    last_quality_check TIMESTAMP,

    CHECK (level >= 1 AND level <= 7),
    CHECK (section >= 1),
    CHECK (question_type IN ('multiple_choice', 'translation', 'scenario', 'matching', 'ordering')),
    CHECK (difficulty IN ('easy', 'medium', 'hard')),
    CHECK (points_possible > 0),
    CHECK (estimated_time_minutes > 0),
    CHECK (times_presented >= 0),
    CHECK (times_correct >= 0),
    CHECK (times_correct <= times_presented),
    CHECK (avg_score IS NULL OR (avg_score >= 0 AND avg_score <= 1)),
    CHECK (difficulty_rating_user IS NULL OR (difficulty_rating_user >= 1 AND difficulty_rating_user <= 5)),

    FOREIGN KEY (replacement_question_id) REFERENCES comprehension_questions(id)
);

-- Enhanced comprehension attempts
CREATE TABLE comprehension_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    couple_id UUID NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
    level INTEGER NOT NULL,
    section INTEGER NOT NULL,
    attempt_number INTEGER NOT NULL,

    -- Questions and responses
    questions_presented JSONB NOT NULL,
    answers_submitted JSONB NOT NULL,
    scores_per_question JSONB NOT NULL,
    time_per_question JSONB DEFAULT '{}',

    -- Overall performance
    total_score DECIMAL(3,2) NOT NULL,
    passed BOOLEAN NOT NULL,
    time_taken_minutes INTEGER,
    confidence_ratings JSONB DEFAULT '{}', -- User's confidence per question

    -- Detailed analysis
    detailed_feedback JSONB DEFAULT '{}',
    areas_for_improvement JSONB DEFAULT '[]',
    strengths JSONB DEFAULT '[]',
    recommended_review_topics JSONB DEFAULT '[]',

    -- Learning indicators
    improvement_from_last_attempt DECIMAL(3,2),
    knowledge_gaps_identified JSONB DEFAULT '[]',
    learning_style_indicators JSONB DEFAULT '{}',

    -- Session context
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP NOT NULL,
    device_info JSONB DEFAULT '{}',
    network_conditions VARCHAR(20), -- excellent, good, fair, poor
    interruptions_count INTEGER DEFAULT 0,

    -- Follow-up and support
    tutor_session_recommended BOOLEAN DEFAULT false,
    peer_study_recommended BOOLEAN DEFAULT false,
    additional_resources JSONB DEFAULT '[]',

    UNIQUE(user_id, level, section, attempt_number),
    CHECK (level >= 1 AND level <= 7),
    CHECK (section >= 1),
    CHECK (attempt_number >= 1),
    CHECK (total_score >= 0 AND total_score <= 1),
    CHECK (time_taken_minutes IS NULL OR time_taken_minutes > 0),
    CHECK (completed_at >= started_at),
    CHECK (improvement_from_last_attempt IS NULL OR improvement_from_last_attempt >= -1),
    CHECK (interruptions_count >= 0),
    CHECK (network_conditions IS NULL OR network_conditions IN ('excellent', 'good', 'fair', 'poor'))
);

-- ============================================================================
-- COMMUNICATION AND NOTIFICATIONS
-- ============================================================================

-- Enhanced notifications system
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,

    -- Notification categorization
    category VARCHAR(50),
    priority VARCHAR(10) DEFAULT 'medium',
    urgency_level INTEGER DEFAULT 5, -- 1-10
    action_required BOOLEAN DEFAULT false,

    -- Rich content and actions
    action_url TEXT,
    action_data JSONB DEFAULT '{}',
    image_url TEXT,
    sound_preference VARCHAR(50), -- default, urgent, gentle, etc.

    -- Personalization
    personalized_content JSONB DEFAULT '{}',
    localization_key VARCHAR(100),
    dynamic_variables JSONB DEFAULT '{}',

    -- Delivery tracking
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    read_at TIMESTAMP,
    clicked_at TIMESTAMP,
    dismissed_at TIMESTAMP,
    snoozed_until TIMESTAMP,

    -- Scheduling and lifecycle
    scheduled_for TIMESTAMP,
    expires_at TIMESTAMP,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,

    -- Analytics and optimization
    delivery_method VARCHAR(20), -- push, email, sms, in_app
    device_type VARCHAR(20),
    time_zone_sent VARCHAR(50),
    user_online_status VARCHAR(20), -- online, offline, away
    engagement_score DECIMAL(3,2), -- How user typically engages with this type

    created_at TIMESTAMP DEFAULT NOW(),

    CHECK (type IS NOT NULL AND LENGTH(type) > 0),
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    CHECK (urgency_level >= 1 AND urgency_level <= 10),
    CHECK (scheduled_for IS NULL OR scheduled_for >= created_at),
    CHECK (sent_at IS NULL OR sent_at >= created_at),
    CHECK (delivered_at IS NULL OR delivered_at >= sent_at),
    CHECK (read_at IS NULL OR read_at >= delivered_at),
    CHECK (clicked_at IS NULL OR clicked_at >= read_at),
    CHECK (retry_count >= 0 AND retry_count <= max_retries),
    CHECK (delivery_method IS NULL OR delivery_method IN ('push', 'email', 'sms', 'in_app')),
    CHECK (engagement_score IS NULL OR (engagement_score >= 0 AND engagement_score <= 1))
);

-- ============================================================================
-- ANALYTICS AND AUDIT
-- ============================================================================

-- Enhanced audit log
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    couple_id UUID REFERENCES couples(id) ON DELETE SET NULL,

    -- Event identification
    event_type VARCHAR(100) NOT NULL,
    event_category VARCHAR(50) NOT NULL,
    event_subcategory VARCHAR(50),
    description TEXT NOT NULL,

    -- Context and environment
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(100),
    request_id VARCHAR(100),
    correlation_id VARCHAR(100), -- For tracking related events

    -- Change tracking
    old_values JSONB,
    new_values JSONB,
    affected_table VARCHAR(100),
    affected_record_id UUID,
    change_summary TEXT,

    -- Event data and metadata
    event_data JSONB DEFAULT '{}',
    severity VARCHAR(20) DEFAULT 'info',
    risk_level VARCHAR(20) DEFAULT 'low', -- low, medium, high, critical

    -- Performance and technical details
    execution_time_ms INTEGER,
    memory_usage_mb INTEGER,
    api_endpoint VARCHAR(200),
    http_method VARCHAR(10),
    http_status_code INTEGER,

    -- Security and compliance
    security_relevant BOOLEAN DEFAULT false,
    privacy_relevant BOOLEAN DEFAULT false,
    compliance_tags JSONB DEFAULT '[]',
    requires_review BOOLEAN DEFAULT false,
    reviewed_at TIMESTAMP,
    reviewed_by VARCHAR(100),

    created_at TIMESTAMP DEFAULT NOW(),

    CHECK (event_type IS NOT NULL AND LENGTH(event_type) > 0),
    CHECK (event_category IS NOT NULL AND LENGTH(event_category) > 0),
    CHECK (severity IN ('debug', 'info', 'warning', 'error', 'critical')),
    CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    CHECK (execution_time_ms IS NULL OR execution_time_ms >= 0),
    CHECK (memory_usage_mb IS NULL OR memory_usage_mb >= 0),
    CHECK (http_status_code IS NULL OR (http_status_code >= 100 AND http_status_code < 600)),
    CHECK (http_method IS NULL OR http_method IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'))
);

-- ============================================================================
-- PERFORMANCE AND ANALYTICS TABLES
-- ============================================================================

-- User analytics and behavior tracking
CREATE TABLE user_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    couple_id UUID REFERENCES couples(id) ON DELETE CASCADE,

    -- Session information
    session_id VARCHAR(100) NOT NULL,
    session_start TIMESTAMP NOT NULL,
    session_end TIMESTAMP,
    session_duration_minutes INTEGER,

    -- Device and technical info
    device_type VARCHAR(20), -- mobile, tablet, desktop
    operating_system VARCHAR(50),
    app_version VARCHAR(20),
    device_model VARCHAR(100),
    screen_resolution VARCHAR(20),
    network_type VARCHAR(20), -- wifi, cellular, etc.

    -- User behavior
    screens_visited JSONB DEFAULT '[]',
    features_used JSONB DEFAULT '[]',
    time_per_screen JSONB DEFAULT '{}',
    tap_count INTEGER DEFAULT 0,
    scroll_distance_pixels INTEGER DEFAULT 0,
    errors_encountered JSONB DEFAULT '[]',

    -- Engagement metrics
    engagement_score DECIMAL(3,2), -- 0.00 to 1.00
    content_completion_rate DECIMAL(3,2),
    feature_adoption_score DECIMAL(3,2),
    retention_probability DECIMAL(3,2),

    -- Performance metrics
    app_crashes INTEGER DEFAULT 0,
    loading_times JSONB DEFAULT '{}',
    network_requests_count INTEGER DEFAULT 0,
    cache_hit_rate DECIMAL(3,2),

    created_at TIMESTAMP DEFAULT NOW(),

    CHECK (session_duration_minutes IS NULL OR session_duration_minutes >= 0),
    CHECK (tap_count >= 0),
    CHECK (scroll_distance_pixels >= 0),
    CHECK (app_crashes >= 0),
    CHECK (network_requests_count >= 0),
    CHECK (engagement_score IS NULL OR (engagement_score >= 0 AND engagement_score <= 1)),
    CHECK (content_completion_rate IS NULL OR (content_completion_rate >= 0 AND content_completion_rate <= 1)),
    CHECK (feature_adoption_score IS NULL OR (feature_adoption_score >= 0 AND feature_adoption_score <= 1)),
    CHECK (retention_probability IS NULL OR (retention_probability >= 0 AND retention_probability <= 1)),
    CHECK (cache_hit_rate IS NULL OR (cache_hit_rate >= 0 AND cache_hit_rate <= 1))
);

-- ============================================================================
-- CREATE ALL INDEXES
-- ============================================================================

-- Users table indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_email_lower ON users(LOWER(email));
CREATE INDEX idx_users_partner_id ON users(partner_id) WHERE partner_id IS NOT NULL;
CREATE INDEX idx_users_pairing_code ON users(pairing_code) WHERE pairing_code IS NOT NULL;
CREATE INDEX idx_users_last_active ON users(last_active);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_subscription_tier ON users(subscription_tier);
CREATE INDEX idx_users_email_verified ON users(email_verified);
CREATE INDEX idx_users_onboarding_completed ON users(onboarding_completed);

-- Couples table indexes
CREATE INDEX idx_couples_partners ON couples(partner1_id, partner2_id);
CREATE INDEX idx_couples_partner1 ON couples(partner1_id);
CREATE INDEX idx_couples_partner2 ON couples(partner2_id);
CREATE INDEX idx_couples_status ON couples(status);
CREATE INDEX idx_couples_level_section ON couples(current_level, current_section);
CREATE INDEX idx_couples_paired_at ON couples(paired_at);
CREATE INDEX idx_couples_last_activity ON couples(last_activity_date);

-- Section progress indexes
CREATE INDEX idx_progress_couple ON section_progress(couple_id);
CREATE INDEX idx_progress_level_section ON section_progress(level, section);
CREATE INDEX idx_progress_unlocked ON section_progress(section_unlocked, section_unlocked_at);
CREATE INDEX idx_progress_comprehension_ready ON section_progress(comprehension_unlocked_at) WHERE comprehension_unlocked_at IS NOT NULL;
CREATE INDEX idx_progress_updated_at ON section_progress(updated_at);
CREATE INDEX idx_progress_partner1_complete ON section_progress(partner1_content_complete, partner1_completed_at);
CREATE INDEX idx_progress_partner2_complete ON section_progress(partner2_content_complete, partner2_completed_at);

-- Translator sessions indexes
CREATE INDEX idx_translator_user ON translator_sessions(user_id);
CREATE INDEX idx_translator_couple ON translator_sessions(couple_id);
CREATE INDEX idx_translator_mode ON translator_sessions(mode);
CREATE INDEX idx_translator_created_at ON translator_sessions(created_at);
CREATE INDEX idx_translator_feedback ON translator_sessions(feedback) WHERE feedback IS NOT NULL;
CREATE INDEX idx_translator_output_data ON translator_sessions USING GIN(output_data);
CREATE INDEX idx_translator_confidence ON translator_sessions(confidence_score) WHERE confidence_score IS NOT NULL;

-- Mediator sessions indexes
CREATE INDEX idx_mediator_user ON mediator_sessions(user_id);
CREATE INDEX idx_mediator_couple ON mediator_sessions(couple_id);
CREATE INDEX idx_mediator_created_at ON mediator_sessions(created_at);
CREATE INDEX idx_mediator_speaker ON mediator_sessions(speaker);
CREATE INDEX idx_mediator_auto_delete ON mediator_sessions(auto_delete_at) WHERE auto_delete_at IS NOT NULL;
CREATE INDEX idx_mediator_feedback ON mediator_sessions(feedback) WHERE feedback IS NOT NULL;
CREATE INDEX idx_mediator_conflict_level ON mediator_sessions(conflict_level) WHERE conflict_level IS NOT NULL;

-- Journal entries indexes
CREATE INDEX idx_journal_user ON journal_entries(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_journal_section ON journal_entries(level, section) WHERE deleted_at IS NULL;
CREATE INDEX idx_journal_shared ON journal_entries(shared_with_partner, shared_at) WHERE shared_with_partner = true;
CREATE INDEX idx_journal_created_at ON journal_entries(created_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_journal_updated_at ON journal_entries(updated_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_journal_tags ON journal_entries USING GIN(tags) WHERE deleted_at IS NULL;
CREATE INDEX idx_journal_mood ON journal_entries(mood) WHERE mood IS NOT NULL AND deleted_at IS NULL;

-- Game sessions indexes
CREATE INDEX idx_games_couple ON game_sessions(couple_id);
CREATE INDEX idx_games_game_id ON game_sessions(game_id);
CREATE INDEX idx_games_started_at ON game_sessions(started_at);
CREATE INDEX idx_games_completed ON game_sessions(completed_at) WHERE completed_at IS NOT NULL;
CREATE INDEX idx_games_feedback ON game_sessions(feedback) WHERE feedback IS NOT NULL;
CREATE INDEX idx_games_rating ON game_sessions(rating) WHERE rating IS NOT NULL;
CREATE INDEX idx_games_started_by ON game_sessions(started_by_user_id) WHERE started_by_user_id IS NOT NULL;
CREATE INDEX idx_games_suggested_by ON game_sessions(suggested_by) WHERE suggested_by IS NOT NULL;

-- Comprehension questions indexes
CREATE INDEX idx_questions_level_section ON comprehension_questions(level, section) WHERE is_active = true;
CREATE INDEX idx_questions_difficulty ON comprehension_questions(difficulty) WHERE is_active = true;
CREATE INDEX idx_questions_type ON comprehension_questions(question_type) WHERE is_active = true;
CREATE INDEX idx_questions_concepts ON comprehension_questions USING GIN(concepts_tested) WHERE is_active = true;
CREATE INDEX idx_questions_analytics ON comprehension_questions(avg_score, times_presented) WHERE is_active = true;

-- Comprehension attempts indexes
CREATE INDEX idx_attempts_user ON comprehension_attempts(user_id);
CREATE INDEX idx_attempts_couple ON comprehension_attempts(couple_id);
CREATE INDEX idx_attempts_level_section ON comprehension_attempts(level, section);
CREATE INDEX idx_attempts_passed ON comprehension_attempts(passed);
CREATE INDEX idx_attempts_completed_at ON comprehension_attempts(completed_at);
CREATE INDEX idx_attempts_score ON comprehension_attempts(total_score);

-- Notifications indexes
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_category ON notifications(category);
CREATE INDEX idx_notifications_scheduled ON notifications(scheduled_for) WHERE scheduled_for IS NOT NULL AND sent_at IS NULL;
CREATE INDEX idx_notifications_unread ON notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
CREATE INDEX idx_notifications_priority ON notifications(priority, urgency_level);

-- Audit log indexes
CREATE INDEX idx_audit_user ON audit_log(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_audit_couple ON audit_log(couple_id) WHERE couple_id IS NOT NULL;
CREATE INDEX idx_audit_event_type ON audit_log(event_type);
CREATE INDEX idx_audit_category ON audit_log(event_category);
CREATE INDEX idx_audit_severity ON audit_log(severity);
CREATE INDEX idx_audit_created_at ON audit_log(created_at);
CREATE INDEX idx_audit_affected ON audit_log(affected_table, affected_record_id) WHERE affected_table IS NOT NULL;
CREATE INDEX idx_audit_security ON audit_log(security_relevant) WHERE security_relevant = true;
CREATE INDEX idx_audit_event_data ON audit_log USING GIN(event_data);

-- User analytics indexes
CREATE INDEX idx_analytics_user ON user_analytics(user_id);
CREATE INDEX idx_analytics_session ON user_analytics(session_id);
CREATE INDEX idx_analytics_created_at ON user_analytics(created_at);
CREATE INDEX idx_analytics_engagement ON user_analytics(engagement_score) WHERE engagement_score IS NOT NULL;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Record migration completion
INSERT INTO audit_log (
    event_type,
    event_category,
    description,
    severity,
    event_data
) VALUES (
    'migration_completed',
    'system',
    'Initial database schema migration completed successfully',
    'info',
    '{"migration": "001_initial_schema.sql", "tables_created": 12, "indexes_created": 67}'
);