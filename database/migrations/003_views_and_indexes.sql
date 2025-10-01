-- ============================================================================
-- TERI Mobile App - Views and Performance Optimization Migration
-- Migration: 003_views_and_indexes.sql
-- Created: 2025-09-30
-- Description: Advanced views, materialized views, and performance indexes
-- ============================================================================

-- ============================================================================
-- CORE REPORTING VIEWS
-- ============================================================================

-- Comprehensive active couples progress view
CREATE VIEW active_couples_progress AS
SELECT
    c.id as couple_id,
    c.partner1_id,
    c.partner2_id,
    u1.name as partner1_name,
    u1.email as partner1_email,
    u2.name as partner2_name,
    u2.email as partner2_email,
    c.current_level,
    c.current_section,
    c.paired_at,
    c.status,
    c.relationship_type,
    c.current_streak_days,
    c.longest_streak_days,
    c.last_activity_date,

    -- Progress metrics
    COUNT(sp.id) as sections_started,
    SUM(CASE WHEN sp.section_unlocked THEN 1 ELSE 0 END) as sections_completed,
    ROUND(AVG(sp.partner1_comprehension_score), 2) as partner1_avg_score,
    ROUND(AVG(sp.partner2_comprehension_score), 2) as partner2_avg_score,
    SUM(sp.partner1_time_spent_minutes + sp.partner2_time_spent_minutes) as total_study_time_minutes,

    -- Activity metrics (last 7 days)
    GREATEST(u1.last_active, u2.last_active) as last_activity,
    c.total_translator_uses,
    c.total_mediator_uses,
    c.total_games_played,

    -- Recent activity counts
    (SELECT COUNT(*) FROM translator_sessions ts WHERE ts.couple_id = c.id AND ts.created_at > NOW() - INTERVAL '7 days') as translator_uses_last_week,
    (SELECT COUNT(*) FROM mediator_sessions ms WHERE ms.couple_id = c.id AND ms.created_at > NOW() - INTERVAL '7 days') as mediator_uses_last_week,
    (SELECT COUNT(*) FROM game_sessions gs WHERE gs.couple_id = c.id AND gs.started_at > NOW() - INTERVAL '7 days') as games_played_last_week,

    -- Engagement indicators
    CASE
        WHEN GREATEST(u1.last_active, u2.last_active) > NOW() - INTERVAL '24 hours' THEN 'highly_active'
        WHEN GREATEST(u1.last_active, u2.last_active) > NOW() - INTERVAL '3 days' THEN 'active'
        WHEN GREATEST(u1.last_active, u2.last_active) > NOW() - INTERVAL '7 days' THEN 'moderately_active'
        WHEN GREATEST(u1.last_active, u2.last_active) > NOW() - INTERVAL '30 days' THEN 'low_activity'
        ELSE 'inactive'
    END as activity_level

FROM couples c
JOIN users u1 ON c.partner1_id = u1.id
JOIN users u2 ON c.partner2_id = u2.id
LEFT JOIN section_progress sp ON c.id = sp.couple_id
WHERE c.status = 'active'
GROUP BY
    c.id, c.partner1_id, c.partner2_id, u1.name, u1.email, u2.name, u2.email,
    c.current_level, c.current_section, c.paired_at, c.status, c.relationship_type,
    c.current_streak_days, c.longest_streak_days, c.last_activity_date,
    u1.last_active, u2.last_active, c.total_translator_uses, c.total_mediator_uses, c.total_games_played;

-- User engagement metrics with detailed analytics
CREATE VIEW user_engagement_metrics AS
SELECT
    u.id as user_id,
    u.name,
    u.email,
    u.created_at as signup_date,
    u.last_active,
    u.subscription_tier,
    u.onboarding_completed,
    u.email_verified,

    -- Partner information
    u.partner_id,
    CASE WHEN u.partner_id IS NOT NULL THEN 'paired' ELSE 'single' END as relationship_status,
    c.id as couple_id,
    c.paired_at,

    -- Content progress
    COUNT(DISTINCT CONCAT(sp.level, '-', sp.section)) as sections_started,
    SUM(CASE
        WHEN u.id = c.partner1_id AND sp.partner1_content_complete THEN 1
        WHEN u.id = c.partner2_id AND sp.partner2_content_complete THEN 1
        ELSE 0
    END) as sections_completed,

    -- Average scores
    ROUND(AVG(CASE
        WHEN u.id = c.partner1_id THEN sp.partner1_comprehension_score
        WHEN u.id = c.partner2_id THEN sp.partner2_comprehension_score
    END), 2) as avg_comprehension_score,

    -- Tool usage
    COUNT(ts.id) as translator_sessions,
    COUNT(ms.id) as mediator_sessions,
    COUNT(je.id) as journal_entries,
    COUNT(gs.id) as games_participated,

    -- Time investment
    SUM(CASE
        WHEN u.id = c.partner1_id THEN sp.partner1_time_spent_minutes
        WHEN u.id = c.partner2_id THEN sp.partner2_time_spent_minutes
        ELSE 0
    END) as total_study_time_minutes,

    -- Recent activity (last 30 days)
    COUNT(CASE WHEN ts.created_at > NOW() - INTERVAL '30 days' THEN 1 END) as translator_sessions_30d,
    COUNT(CASE WHEN ms.created_at > NOW() - INTERVAL '30 days' THEN 1 END) as mediator_sessions_30d,
    COUNT(CASE WHEN je.created_at > NOW() - INTERVAL '30 days' THEN 1 END) as journal_entries_30d,
    COUNT(CASE WHEN gs.started_at > NOW() - INTERVAL '30 days' THEN 1 END) as games_30d,

    -- Engagement score (calculated)
    calculate_user_engagement_score(u.id) as engagement_score,

    -- Activity patterns
    EXTRACT(days FROM NOW() - u.last_active) as days_since_last_activity,
    EXTRACT(days FROM NOW() - u.created_at) as days_since_signup,

    -- Current level and progress
    COALESCE(c.current_level, 1) as current_level,
    COALESCE(c.current_section, 1) as current_section

FROM users u
LEFT JOIN couples c ON u.id IN (c.partner1_id, c.partner2_id)
LEFT JOIN section_progress sp ON c.id = sp.couple_id
LEFT JOIN translator_sessions ts ON u.id = ts.user_id
LEFT JOIN mediator_sessions ms ON u.id = ms.user_id
LEFT JOIN journal_entries je ON u.id = je.user_id AND je.deleted_at IS NULL
LEFT JOIN game_sessions gs ON c.id = gs.couple_id
GROUP BY
    u.id, u.name, u.email, u.created_at, u.last_active, u.subscription_tier,
    u.onboarding_completed, u.email_verified, u.partner_id, c.id, c.paired_at,
    c.current_level, c.current_section;

-- Section progress overview with detailed metrics
CREATE VIEW section_progress_overview AS
SELECT
    sp.id,
    sp.couple_id,
    sp.level,
    sp.section,
    c.partner1_id,
    c.partner2_id,
    u1.name as partner1_name,
    u2.name as partner2_name,

    -- Progress status
    sp.partner1_content_complete,
    sp.partner1_completed_at,
    sp.partner1_comprehension_score,
    sp.partner1_comprehension_attempts,
    sp.partner1_time_spent_minutes,
    sp.partner1_difficulty_rating,

    sp.partner2_content_complete,
    sp.partner2_completed_at,
    sp.partner2_comprehension_score,
    sp.partner2_comprehension_attempts,
    sp.partner2_time_spent_minutes,
    sp.partner2_difficulty_rating,

    -- Gating status
    sp.settle_timer_start,
    sp.comprehension_unlocked_at,
    sp.section_unlocked,
    sp.section_unlocked_at,

    -- Calculated fields
    CASE
        WHEN sp.partner1_content_complete AND sp.partner2_content_complete THEN 'both_complete'
        WHEN sp.partner1_content_complete OR sp.partner2_content_complete THEN 'one_complete'
        ELSE 'none_complete'
    END as content_status,

    CASE
        WHEN sp.section_unlocked THEN 'unlocked'
        WHEN sp.comprehension_unlocked_at IS NOT NULL THEN 'comprehension_available'
        WHEN sp.settle_timer_start IS NOT NULL THEN 'settling'
        ELSE 'in_progress'
    END as section_status,

    -- Time calculations
    CASE
        WHEN sp.settle_timer_start IS NOT NULL THEN
            GREATEST(0, EXTRACT(EPOCH FROM (sp.settle_timer_start + INTERVAL '24 hours' - NOW())) / 3600)
        ELSE NULL
    END as settle_hours_remaining,

    sp.created_at,
    sp.updated_at

FROM section_progress sp
JOIN couples c ON sp.couple_id = c.id
JOIN users u1 ON c.partner1_id = u1.id
JOIN users u2 ON c.partner2_id = u2.id;

-- ============================================================================
-- ANALYTICS AND REPORTING VIEWS
-- ============================================================================

-- Daily activity summary
CREATE VIEW daily_activity_summary AS
SELECT
    activity_date,
    COUNT(DISTINCT user_id) as active_users,
    COUNT(DISTINCT couple_id) as active_couples,
    SUM(translator_sessions) as total_translator_sessions,
    SUM(mediator_sessions) as total_mediator_sessions,
    SUM(journal_entries) as total_journal_entries,
    SUM(games_started) as total_games_started,
    SUM(sections_completed) as total_sections_completed,
    SUM(comprehension_attempts) as total_comprehension_attempts
FROM (
    -- Translator sessions
    SELECT
        created_at::date as activity_date,
        user_id,
        couple_id,
        1 as translator_sessions,
        0 as mediator_sessions,
        0 as journal_entries,
        0 as games_started,
        0 as sections_completed,
        0 as comprehension_attempts
    FROM translator_sessions
    WHERE created_at > NOW() - INTERVAL '90 days'

    UNION ALL

    -- Mediator sessions
    SELECT
        created_at::date,
        user_id,
        couple_id,
        0,
        1,
        0,
        0,
        0,
        0
    FROM mediator_sessions
    WHERE created_at > NOW() - INTERVAL '90 days'

    UNION ALL

    -- Journal entries
    SELECT
        created_at::date,
        user_id,
        NULL as couple_id,
        0,
        0,
        1,
        0,
        0,
        0
    FROM journal_entries
    WHERE created_at > NOW() - INTERVAL '90 days' AND deleted_at IS NULL

    UNION ALL

    -- Game sessions
    SELECT
        started_at::date,
        started_by_user_id as user_id,
        couple_id,
        0,
        0,
        0,
        1,
        0,
        0
    FROM game_sessions
    WHERE started_at > NOW() - INTERVAL '90 days' AND started_by_user_id IS NOT NULL

    UNION ALL

    -- Section completions
    SELECT
        section_unlocked_at::date,
        CASE WHEN sp.partner1_content_complete THEN c.partner1_id ELSE c.partner2_id END as user_id,
        sp.couple_id,
        0,
        0,
        0,
        0,
        1,
        0
    FROM section_progress sp
    JOIN couples c ON sp.couple_id = c.id
    WHERE sp.section_unlocked_at > NOW() - INTERVAL '90 days'

    UNION ALL

    -- Comprehension attempts
    SELECT
        completed_at::date,
        user_id,
        couple_id,
        0,
        0,
        0,
        0,
        0,
        1
    FROM comprehension_attempts
    WHERE completed_at > NOW() - INTERVAL '90 days'
) activities
GROUP BY activity_date
ORDER BY activity_date DESC;

-- Feature usage analytics
CREATE VIEW feature_usage_analytics AS
SELECT
    'translator_tes' as feature_name,
    COUNT(*) as usage_count,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT couple_id) as unique_couples,
    AVG(processing_time_ms) as avg_processing_time_ms,
    AVG(confidence_score) as avg_confidence_score,
    COUNT(CASE WHEN feedback = 'helpful' THEN 1 END)::DECIMAL / NULLIF(COUNT(CASE WHEN feedback IS NOT NULL THEN 1 END), 0) as helpfulness_rate
FROM translator_sessions
WHERE mode = 'TES' AND created_at > NOW() - INTERVAL '30 days'

UNION ALL

SELECT
    'translator_tel' as feature_name,
    COUNT(*) as usage_count,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT couple_id) as unique_couples,
    AVG(processing_time_ms) as avg_processing_time_ms,
    AVG(confidence_score) as avg_confidence_score,
    COUNT(CASE WHEN feedback = 'helpful' THEN 1 END)::DECIMAL / NULLIF(COUNT(CASE WHEN feedback IS NOT NULL THEN 1 END), 0) as helpfulness_rate
FROM translator_sessions
WHERE mode = 'TEL' AND created_at > NOW() - INTERVAL '30 days'

UNION ALL

SELECT
    'mediator' as feature_name,
    COUNT(*) as usage_count,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT couple_id) as unique_couples,
    AVG(processing_time_ms) as avg_processing_time_ms,
    AVG(transcription_confidence) as avg_confidence_score,
    COUNT(CASE WHEN feedback = 'helpful' THEN 1 END)::DECIMAL / NULLIF(COUNT(CASE WHEN feedback IS NOT NULL THEN 1 END), 0) as helpfulness_rate
FROM mediator_sessions
WHERE created_at > NOW() - INTERVAL '30 days'

UNION ALL

SELECT
    'games' as feature_name,
    COUNT(*) as usage_count,
    COUNT(DISTINCT started_by_user_id) as unique_users,
    COUNT(DISTINCT couple_id) as unique_couples,
    AVG(duration_minutes) as avg_processing_time_ms, -- Reusing column for duration
    AVG(rating) as avg_confidence_score, -- Reusing column for rating
    COUNT(CASE WHEN feedback = 'helpful' THEN 1 END)::DECIMAL / NULLIF(COUNT(CASE WHEN feedback IS NOT NULL THEN 1 END), 0) as helpfulness_rate
FROM game_sessions
WHERE started_at > NOW() - INTERVAL '30 days' AND completed_at IS NOT NULL;

-- ============================================================================
-- MATERIALIZED VIEWS FOR PERFORMANCE
-- ============================================================================

-- Materialized view for user statistics (refreshed hourly)
CREATE MATERIALIZED VIEW mv_user_statistics AS
SELECT
    u.id as user_id,
    u.email,
    u.created_at as signup_date,
    u.last_active,
    u.subscription_tier,

    -- Partner info
    CASE WHEN u.partner_id IS NOT NULL THEN 'paired' ELSE 'single' END as status,
    c.paired_at,
    c.current_level,
    c.current_section,

    -- Activity metrics
    COALESCE(ts_stats.session_count, 0) as translator_sessions,
    COALESCE(ms_stats.session_count, 0) as mediator_sessions,
    COALESCE(je_stats.entry_count, 0) as journal_entries,
    COALESCE(gs_stats.game_count, 0) as games_played,

    -- Progress metrics
    COALESCE(sp_stats.sections_completed, 0) as sections_completed,
    COALESCE(sp_stats.avg_score, 0) as avg_comprehension_score,
    COALESCE(sp_stats.total_time, 0) as total_study_minutes,

    -- Engagement score
    calculate_user_engagement_score(u.id) as engagement_score,

    -- Last activity indicators
    EXTRACT(days FROM NOW() - u.last_active) as days_since_last_activity,
    EXTRACT(days FROM NOW() - u.created_at) as days_since_signup,

    NOW() as last_updated

FROM users u
LEFT JOIN couples c ON u.id IN (c.partner1_id, c.partner2_id)
LEFT JOIN (
    SELECT user_id, COUNT(*) as session_count
    FROM translator_sessions
    GROUP BY user_id
) ts_stats ON u.id = ts_stats.user_id
LEFT JOIN (
    SELECT user_id, COUNT(*) as session_count
    FROM mediator_sessions
    GROUP BY user_id
) ms_stats ON u.id = ms_stats.user_id
LEFT JOIN (
    SELECT user_id, COUNT(*) as entry_count
    FROM journal_entries
    WHERE deleted_at IS NULL
    GROUP BY user_id
) je_stats ON u.id = je_stats.user_id
LEFT JOIN (
    SELECT
        CASE WHEN gs.started_by_user_id = c.partner1_id THEN c.partner1_id
             WHEN gs.started_by_user_id = c.partner2_id THEN c.partner2_id
        END as user_id,
        COUNT(*) as game_count
    FROM game_sessions gs
    JOIN couples c ON gs.couple_id = c.id
    WHERE gs.started_by_user_id IS NOT NULL
    GROUP BY user_id
) gs_stats ON u.id = gs_stats.user_id
LEFT JOIN (
    SELECT
        CASE WHEN c.partner1_id = user_id THEN c.partner1_id
             WHEN c.partner2_id = user_id THEN c.partner2_id
        END as user_id,
        SUM(CASE WHEN sp.section_unlocked THEN 1 ELSE 0 END) as sections_completed,
        AVG(CASE
            WHEN c.partner1_id = user_id THEN sp.partner1_comprehension_score
            WHEN c.partner2_id = user_id THEN sp.partner2_comprehension_score
        END) as avg_score,
        SUM(CASE
            WHEN c.partner1_id = user_id THEN sp.partner1_time_spent_minutes
            WHEN c.partner2_id = user_id THEN sp.partner2_time_spent_minutes
        END) as total_time
    FROM section_progress sp
    JOIN couples c ON sp.couple_id = c.id
    CROSS JOIN (SELECT c.partner1_id as user_id UNION SELECT c.partner2_id as user_id) users
    GROUP BY user_id
) sp_stats ON u.id = sp_stats.user_id;

-- Create unique index for materialized view
CREATE UNIQUE INDEX idx_mv_user_statistics_user_id ON mv_user_statistics(user_id);
CREATE INDEX idx_mv_user_statistics_engagement ON mv_user_statistics(engagement_score DESC);
CREATE INDEX idx_mv_user_statistics_activity ON mv_user_statistics(days_since_last_activity);

-- ============================================================================
-- PERFORMANCE OPTIMIZATION INDEXES
-- ============================================================================

-- Composite indexes for common query patterns
CREATE INDEX CONCURRENTLY idx_translator_sessions_composite
    ON translator_sessions(couple_id, created_at DESC)
    WHERE feedback IS NOT NULL;

CREATE INDEX CONCURRENTLY idx_mediator_sessions_composite
    ON mediator_sessions(couple_id, created_at DESC)
    WHERE feedback IS NOT NULL;

CREATE INDEX CONCURRENTLY idx_game_sessions_composite
    ON game_sessions(couple_id, game_id, started_at DESC)
    WHERE completed_at IS NOT NULL;

CREATE INDEX CONCURRENTLY idx_journal_entries_composite
    ON journal_entries(user_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY idx_section_progress_composite
    ON section_progress(couple_id, level, section)
    WHERE section_unlocked = false;

-- Partial indexes for specific use cases
CREATE INDEX CONCURRENTLY idx_users_active_subscribers
    ON users(subscription_tier, last_active)
    WHERE subscription_tier != 'free' AND email_verified = true;

CREATE INDEX CONCURRENTLY idx_couples_recent_activity
    ON couples(last_activity_date DESC, status)
    WHERE status = 'active';

CREATE INDEX CONCURRENTLY idx_notifications_pending
    ON notifications(user_id, scheduled_for)
    WHERE sent_at IS NULL AND expires_at > NOW();

CREATE INDEX CONCURRENTLY idx_comprehension_attempts_recent
    ON comprehension_attempts(user_id, level, section, completed_at DESC)
    WHERE completed_at > NOW() - INTERVAL '30 days';

-- GIN indexes for JSONB fields
CREATE INDEX CONCURRENTLY idx_translator_output_gin
    ON translator_sessions USING GIN(output_data);

CREATE INDEX CONCURRENTLY idx_mediator_tel_summary_gin
    ON mediator_sessions USING GIN(tel_summary);

CREATE INDEX CONCURRENTLY idx_game_sessions_data_gin
    ON game_sessions USING GIN(game_data);

CREATE INDEX CONCURRENTLY idx_user_preferences_gin
    ON users USING GIN(preferences);

CREATE INDEX CONCURRENTLY idx_audit_log_event_data_gin
    ON audit_log USING GIN(event_data);

-- Full-text search indexes
CREATE INDEX CONCURRENTLY idx_journal_content_fulltext
    ON journal_entries USING GIN(to_tsvector('english', content))
    WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY idx_audit_log_description_fulltext
    ON audit_log USING GIN(to_tsvector('english', description));

-- ============================================================================
-- FUNCTIONS FOR VIEW MAINTENANCE
-- ============================================================================

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_statistics;

    -- Log the refresh
    INSERT INTO audit_log (
        event_type,
        event_category,
        description,
        severity,
        event_data
    ) VALUES (
        'materialized_view_refreshed',
        'maintenance',
        'Materialized views refreshed successfully',
        'info',
        json_build_object('refreshed_at', NOW(), 'views', 'mv_user_statistics')
    );
END;
$$ LANGUAGE plpgsql;

-- Function to analyze table statistics for query optimization
CREATE OR REPLACE FUNCTION update_table_statistics()
RETURNS VOID AS $$
BEGIN
    -- Update statistics for all major tables
    ANALYZE users;
    ANALYZE couples;
    ANALYZE section_progress;
    ANALYZE translator_sessions;
    ANALYZE mediator_sessions;
    ANALYZE journal_entries;
    ANALYZE game_sessions;
    ANALYZE comprehension_questions;
    ANALYZE comprehension_attempts;
    ANALYZE notifications;
    ANALYZE audit_log;
    ANALYZE user_analytics;

    -- Log the statistics update
    INSERT INTO audit_log (
        event_type,
        event_category,
        description,
        severity,
        event_data
    ) VALUES (
        'statistics_updated',
        'maintenance',
        'Table statistics updated for query optimization',
        'info',
        json_build_object('updated_at', NOW(), 'tables_analyzed', 12)
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON VIEW active_couples_progress IS 'Comprehensive view of active couples with progress metrics and engagement indicators';
COMMENT ON VIEW user_engagement_metrics IS 'Detailed user engagement metrics including tool usage, progress, and activity patterns';
COMMENT ON VIEW section_progress_overview IS 'Section-level progress tracking with gating status and time calculations';
COMMENT ON VIEW daily_activity_summary IS 'Daily aggregated activity metrics across all features';
COMMENT ON VIEW feature_usage_analytics IS 'Feature-specific usage analytics with performance and satisfaction metrics';

COMMENT ON MATERIALIZED VIEW mv_user_statistics IS 'Materialized view for user statistics - refreshed hourly for performance';

-- ============================================================================
-- RECORD MIGRATION COMPLETION
-- ============================================================================

INSERT INTO audit_log (
    event_type,
    event_category,
    description,
    severity,
    event_data
) VALUES (
    'migration_completed',
    'system',
    'Views and performance optimization migration completed successfully',
    'info',
    '{"migration": "003_views_and_indexes.sql", "views_created": 5, "materialized_views_created": 1, "indexes_created": 15}'
);