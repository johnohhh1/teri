-- ============================================================================
-- TERI Mobile App - Database Maintenance and Administration
-- File: maintenance.sql
-- Created: 2025-09-30
-- Description: Comprehensive maintenance procedures and monitoring queries
-- ============================================================================

-- ============================================================================
-- DAILY MAINTENANCE PROCEDURES
-- ============================================================================

-- Daily maintenance function to be run via cron job
CREATE OR REPLACE FUNCTION daily_maintenance()
RETURNS JSONB AS $$
DECLARE
    v_result JSONB := '{}';
    v_start_time TIMESTAMP := NOW();
    v_cleanup_counts JSONB := '{}';
BEGIN
    -- Start maintenance transaction
    v_result := v_result || jsonb_build_object('started_at', v_start_time);

    -- 1. Update user engagement streaks
    v_cleanup_counts := v_cleanup_counts || jsonb_build_object(
        'streaks_updated', update_user_streaks()
    );

    -- 2. Process scheduled notifications
    v_cleanup_counts := v_cleanup_counts || jsonb_build_object(
        'notifications_processed', process_scheduled_notifications()
    );

    -- 3. Clean up expired pairing codes
    v_cleanup_counts := v_cleanup_counts || jsonb_build_object(
        'expired_codes_cleaned', cleanup_expired_pairing_codes()
    );

    -- 4. Clean up old notifications
    v_cleanup_counts := v_cleanup_counts || jsonb_build_object(
        'old_notifications_cleaned', cleanup_old_notifications()
    );

    -- 5. Auto-delete old mediator sessions
    v_cleanup_counts := v_cleanup_counts || jsonb_build_object(
        'mediator_sessions_deleted', cleanup_old_mediator_sessions()
    );

    -- 6. Clean up vector search logs
    v_cleanup_counts := v_cleanup_counts || jsonb_build_object(
        'vector_searches_cleaned', cleanup_vector_search_logs()
    );

    -- 7. Update table statistics
    PERFORM update_table_statistics();

    -- Log maintenance completion
    INSERT INTO audit_log (
        event_type,
        event_category,
        description,
        event_data,
        severity
    ) VALUES (
        'daily_maintenance_completed',
        'maintenance',
        'Daily maintenance procedures completed successfully',
        json_build_object(
            'duration_seconds', EXTRACT(EPOCH FROM (NOW() - v_start_time)),
            'cleanup_counts', v_cleanup_counts
        ),
        'info'
    );

    v_result := v_result || jsonb_build_object(
        'completed_at', NOW(),
        'duration_seconds', EXTRACT(EPOCH FROM (NOW() - v_start_time)),
        'cleanup_results', v_cleanup_counts,
        'status', 'success'
    );

    RETURN v_result;

EXCEPTION WHEN OTHERS THEN
    -- Log maintenance failure
    INSERT INTO audit_log (
        event_type,
        event_category,
        description,
        event_data,
        severity
    ) VALUES (
        'daily_maintenance_failed',
        'maintenance',
        'Daily maintenance procedures failed: ' || SQLERRM,
        json_build_object(
            'error_message', SQLERRM,
            'error_state', SQLSTATE,
            'duration_seconds', EXTRACT(EPOCH FROM (NOW() - v_start_time))
        ),
        'error'
    );

    v_result := v_result || jsonb_build_object(
        'failed_at', NOW(),
        'error', SQLERRM,
        'status', 'failed'
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- WEEKLY MAINTENANCE PROCEDURES
-- ============================================================================

-- Weekly maintenance function
CREATE OR REPLACE FUNCTION weekly_maintenance()
RETURNS JSONB AS $$
DECLARE
    v_result JSONB := '{}';
    v_start_time TIMESTAMP := NOW();
BEGIN
    v_result := v_result || jsonb_build_object('started_at', v_start_time);

    -- 1. Refresh materialized views
    PERFORM refresh_materialized_views();
    PERFORM refresh_vector_analytics();

    -- 2. Reindex heavily used tables
    REINDEX INDEX CONCURRENTLY idx_users_email;
    REINDEX INDEX CONCURRENTLY idx_couples_partners;
    REINDEX INDEX CONCURRENTLY idx_translator_sessions_composite;
    REINDEX INDEX CONCURRENTLY idx_mediator_sessions_composite;

    -- 3. Vacuum and analyze large tables
    VACUUM ANALYZE users;
    VACUUM ANALYZE couples;
    VACUUM ANALYZE section_progress;
    VACUUM ANALYZE translator_sessions;
    VACUUM ANALYZE mediator_sessions;
    VACUUM ANALYZE audit_log;

    -- 4. Clean up old audit logs (keep 1 year)
    WITH deleted AS (
        DELETE FROM audit_log
        WHERE created_at < NOW() - INTERVAL '365 days'
        AND severity IN ('debug', 'info')
        RETURNING id
    )
    SELECT COUNT(*) FROM deleted;

    -- 5. Update comprehensive statistics
    ANALYZE;

    -- Log completion
    INSERT INTO audit_log (
        event_type,
        event_category,
        description,
        event_data,
        severity
    ) VALUES (
        'weekly_maintenance_completed',
        'maintenance',
        'Weekly maintenance procedures completed successfully',
        json_build_object(
            'duration_seconds', EXTRACT(EPOCH FROM (NOW() - v_start_time))
        ),
        'info'
    );

    v_result := v_result || jsonb_build_object(
        'completed_at', NOW(),
        'duration_seconds', EXTRACT(EPOCH FROM (NOW() - v_start_time)),
        'status', 'success'
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- MONITORING AND HEALTH CHECK FUNCTIONS
-- ============================================================================

-- Database health check function
CREATE OR REPLACE FUNCTION database_health_check()
RETURNS JSONB AS $$
DECLARE
    v_health JSONB := '{}';
    v_table_sizes JSONB := '{}';
    v_index_usage JSONB := '{}';
    v_slow_queries JSONB := '[]';
BEGIN
    -- Basic database info
    v_health := v_health || jsonb_build_object(
        'timestamp', NOW(),
        'database_size', pg_size_pretty(pg_database_size(current_database())),
        'active_connections', (
            SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active'
        ),
        'total_connections', (
            SELECT COUNT(*) FROM pg_stat_activity
        )
    );

    -- Table sizes
    SELECT jsonb_object_agg(
        table_name,
        jsonb_build_object(
            'size', pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)),
            'rows', n_tup_ins - n_tup_del
        )
    ) INTO v_table_sizes
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    LIMIT 10;

    v_health := v_health || jsonb_build_object('table_sizes', v_table_sizes);

    -- Index usage efficiency
    SELECT jsonb_object_agg(
        indexrelname,
        jsonb_build_object(
            'scans', idx_scan,
            'tuples_read', idx_tup_read,
            'tuples_fetched', idx_tup_fetch,
            'size', pg_size_pretty(pg_relation_size(indexrelid))
        )
    ) INTO v_index_usage
    FROM pg_stat_user_indexes
    WHERE idx_scan > 0
    ORDER BY idx_scan DESC
    LIMIT 10;

    v_health := v_health || jsonb_build_object('top_indexes', v_index_usage);

    -- Performance metrics
    v_health := v_health || jsonb_build_object(
        'cache_hit_ratio', (
            SELECT round(
                100.0 * sum(blks_hit) / (sum(blks_hit) + sum(blks_read)), 2
            )
            FROM pg_stat_database
            WHERE datname = current_database()
        ),
        'transaction_rollback_ratio', (
            SELECT round(
                100.0 * sum(xact_rollback) / (sum(xact_commit) + sum(xact_rollback)), 2
            )
            FROM pg_stat_database
            WHERE datname = current_database()
        )
    );

    -- Recent activity metrics
    v_health := v_health || jsonb_build_object(
        'recent_activity', jsonb_build_object(
            'active_users_24h', (
                SELECT COUNT(DISTINCT user_id)
                FROM user_analytics
                WHERE created_at > NOW() - INTERVAL '24 hours'
            ),
            'new_registrations_24h', (
                SELECT COUNT(*)
                FROM users
                WHERE created_at > NOW() - INTERVAL '24 hours'
            ),
            'new_couples_24h', (
                SELECT COUNT(*)
                FROM couples
                WHERE paired_at > NOW() - INTERVAL '24 hours'
            ),
            'translator_sessions_24h', (
                SELECT COUNT(*)
                FROM translator_sessions
                WHERE created_at > NOW() - INTERVAL '24 hours'
            ),
            'mediator_sessions_24h', (
                SELECT COUNT(*)
                FROM mediator_sessions
                WHERE created_at > NOW() - INTERVAL '24 hours'
            )
        )
    );

    RETURN v_health;
END;
$$ LANGUAGE plpgsql;

-- Performance monitoring function
CREATE OR REPLACE FUNCTION performance_metrics()
RETURNS JSONB AS $$
DECLARE
    v_metrics JSONB := '{}';
BEGIN
    -- Query performance
    SELECT jsonb_build_object(
        'slowest_queries', jsonb_agg(
            jsonb_build_object(
                'query', substr(query, 1, 100) || '...',
                'calls', calls,
                'total_time_ms', round(total_time, 2),
                'mean_time_ms', round(mean_time, 2),
                'rows', rows
            )
        )
    ) INTO v_metrics
    FROM pg_stat_statements
    WHERE query NOT LIKE '%pg_stat_statements%'
    ORDER BY mean_time DESC
    LIMIT 10;

    -- Lock monitoring
    v_metrics := v_metrics || jsonb_build_object(
        'current_locks', (
            SELECT COUNT(*)
            FROM pg_locks
            WHERE NOT granted
        ),
        'blocking_queries', (
            SELECT COUNT(*)
            FROM pg_stat_activity
            WHERE wait_event_type = 'Lock'
        )
    );

    RETURN v_metrics;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- BACKUP AND RECOVERY HELPERS
-- ============================================================================

-- Function to prepare database for backup
CREATE OR REPLACE FUNCTION prepare_for_backup()
RETURNS JSONB AS $$
DECLARE
    v_result JSONB := '{}';
    v_start_time TIMESTAMP := NOW();
BEGIN
    -- Force checkpoint to ensure all data is written
    CHECKPOINT;

    -- Update all statistics
    ANALYZE;

    -- Clean up temporary data
    DELETE FROM notifications WHERE expires_at < NOW();

    v_result := jsonb_build_object(
        'prepared_at', NOW(),
        'preparation_time_seconds', EXTRACT(EPOCH FROM (NOW() - v_start_time)),
        'database_size', pg_size_pretty(pg_database_size(current_database())),
        'status', 'ready_for_backup'
    );

    INSERT INTO audit_log (
        event_type,
        event_category,
        description,
        event_data,
        severity
    ) VALUES (
        'backup_preparation_completed',
        'backup',
        'Database prepared for backup',
        v_result,
        'info'
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- DATA INTEGRITY CHECKS
-- ============================================================================

-- Comprehensive data integrity check
CREATE OR REPLACE FUNCTION data_integrity_check()
RETURNS JSONB AS $$
DECLARE
    v_issues JSONB := '[]';
    v_counts JSONB := '{}';
    v_orphaned_count INTEGER;
BEGIN
    -- Check for orphaned records

    -- 1. Users without valid partner references
    SELECT COUNT(*) INTO v_orphaned_count
    FROM users u1
    WHERE u1.partner_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM users u2
        WHERE u2.id = u1.partner_id
        AND u2.partner_id = u1.id
    );

    IF v_orphaned_count > 0 THEN
        v_issues := v_issues || jsonb_build_array(jsonb_build_object(
            'issue', 'orphaned_partner_references',
            'count', v_orphaned_count,
            'severity', 'medium'
        ));
    END IF;

    -- 2. Section progress without valid couples
    SELECT COUNT(*) INTO v_orphaned_count
    FROM section_progress sp
    WHERE NOT EXISTS (
        SELECT 1 FROM couples c WHERE c.id = sp.couple_id
    );

    IF v_orphaned_count > 0 THEN
        v_issues := v_issues || jsonb_build_array(jsonb_build_object(
            'issue', 'section_progress_without_couple',
            'count', v_orphaned_count,
            'severity', 'high'
        ));
    END IF;

    -- 3. Invalid comprehension scores
    SELECT COUNT(*) INTO v_orphaned_count
    FROM section_progress
    WHERE (partner1_comprehension_score IS NOT NULL AND (partner1_comprehension_score < 0 OR partner1_comprehension_score > 1))
       OR (partner2_comprehension_score IS NOT NULL AND (partner2_comprehension_score < 0 OR partner2_comprehension_score > 1));

    IF v_orphaned_count > 0 THEN
        v_issues := v_issues || jsonb_build_array(jsonb_build_object(
            'issue', 'invalid_comprehension_scores',
            'count', v_orphaned_count,
            'severity', 'high'
        ));
    END IF;

    -- 4. Translator sessions without valid users
    SELECT COUNT(*) INTO v_orphaned_count
    FROM translator_sessions ts
    WHERE NOT EXISTS (
        SELECT 1 FROM users u WHERE u.id = ts.user_id
    );

    IF v_orphaned_count > 0 THEN
        v_issues := v_issues || jsonb_build_array(jsonb_build_object(
            'issue', 'translator_sessions_without_user',
            'count', v_orphaned_count,
            'severity', 'medium'
        ));
    END IF;

    -- 5. Game sessions with invalid completion status
    SELECT COUNT(*) INTO v_orphaned_count
    FROM game_sessions
    WHERE completed_at IS NOT NULL
    AND (duration_minutes IS NULL OR duration_minutes <= 0);

    IF v_orphaned_count > 0 THEN
        v_issues := v_issues || jsonb_build_array(jsonb_build_object(
            'issue', 'invalid_game_completion_data',
            'count', v_orphaned_count,
            'severity', 'low'
        ));
    END IF;

    -- Check data consistency
    v_counts := jsonb_build_object(
        'total_users', (SELECT COUNT(*) FROM users),
        'paired_users', (SELECT COUNT(*) FROM users WHERE partner_id IS NOT NULL),
        'active_couples', (SELECT COUNT(*) FROM couples WHERE status = 'active'),
        'total_sections_started', (SELECT COUNT(*) FROM section_progress),
        'total_translator_sessions', (SELECT COUNT(*) FROM translator_sessions),
        'total_mediator_sessions', (SELECT COUNT(*) FROM mediator_sessions),
        'total_journal_entries', (SELECT COUNT(*) FROM journal_entries WHERE deleted_at IS NULL),
        'total_game_sessions', (SELECT COUNT(*) FROM game_sessions),
        'total_notifications', (SELECT COUNT(*) FROM notifications)
    );

    RETURN jsonb_build_object(
        'checked_at', NOW(),
        'issues_found', jsonb_array_length(v_issues),
        'issues', v_issues,
        'data_counts', v_counts,
        'status', CASE WHEN jsonb_array_length(v_issues) = 0 THEN 'healthy' ELSE 'issues_detected' END
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PERFORMANCE OPTIMIZATION RECOMMENDATIONS
-- ============================================================================

-- Function to analyze and recommend performance optimizations
CREATE OR REPLACE FUNCTION performance_recommendations()
RETURNS JSONB AS $$
DECLARE
    v_recommendations JSONB := '[]';
    v_large_tables JSONB := '[]';
    v_unused_indexes JSONB := '[]';
    v_missing_indexes JSONB := '[]';
BEGIN
    -- Find large tables that might need partitioning
    SELECT jsonb_agg(
        jsonb_build_object(
            'table_name', schemaname||'.'||tablename,
            'size', pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)),
            'rows', n_tup_ins - n_tup_del
        )
    ) INTO v_large_tables
    FROM pg_stat_user_tables
    WHERE pg_total_relation_size(schemaname||'.'||tablename) > 1024*1024*100 -- >100MB
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

    IF jsonb_array_length(v_large_tables) > 0 THEN
        v_recommendations := v_recommendations || jsonb_build_array(jsonb_build_object(
            'type', 'large_tables',
            'priority', 'medium',
            'description', 'Consider partitioning or archiving large tables',
            'tables', v_large_tables
        ));
    END IF;

    -- Find unused indexes
    SELECT jsonb_agg(
        jsonb_build_object(
            'index_name', indexrelname,
            'table_name', relname,
            'size', pg_size_pretty(pg_relation_size(indexrelid)),
            'scans', idx_scan
        )
    ) INTO v_unused_indexes
    FROM pg_stat_user_indexes ui
    JOIN pg_stat_user_tables ut ON ui.relid = ut.relid
    WHERE idx_scan < 10 -- Less than 10 scans
    AND pg_relation_size(indexrelid) > 1024*1024 -- >1MB
    ORDER BY pg_relation_size(indexrelid) DESC;

    IF jsonb_array_length(v_unused_indexes) > 0 THEN
        v_recommendations := v_recommendations || jsonb_build_array(jsonb_build_object(
            'type', 'unused_indexes',
            'priority', 'low',
            'description', 'Consider dropping unused indexes to save space',
            'indexes', v_unused_indexes
        ));
    END IF;

    -- Check cache hit ratio
    WITH cache_stats AS (
        SELECT round(
            100.0 * sum(blks_hit) / (sum(blks_hit) + sum(blks_read)), 2
        ) as hit_ratio
        FROM pg_stat_database
        WHERE datname = current_database()
    )
    SELECT CASE
        WHEN hit_ratio < 95 THEN jsonb_build_array(jsonb_build_object(
            'type', 'low_cache_hit_ratio',
            'priority', 'high',
            'description', 'Cache hit ratio is below 95%. Consider increasing shared_buffers.',
            'current_ratio', hit_ratio
        ))
        ELSE '[]'::jsonb
    END INTO v_missing_indexes
    FROM cache_stats;

    v_recommendations := v_recommendations || v_missing_indexes;

    RETURN jsonb_build_object(
        'analyzed_at', NOW(),
        'recommendations', v_recommendations,
        'total_recommendations', jsonb_array_length(v_recommendations)
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- MONITORING QUERIES FOR ADMINS
-- ============================================================================

-- View for real-time system monitoring
CREATE VIEW admin_system_monitor AS
SELECT
    'Database Size' as metric,
    pg_size_pretty(pg_database_size(current_database())) as value,
    'info' as status
UNION ALL
SELECT
    'Active Connections',
    (SELECT COUNT(*)::text FROM pg_stat_activity WHERE state = 'active'),
    CASE
        WHEN (SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'active') > 50 THEN 'warning'
        ELSE 'ok'
    END
UNION ALL
SELECT
    'Cache Hit Ratio',
    round(100.0 * sum(blks_hit) / (sum(blks_hit) + sum(blks_read)), 2)::text || '%',
    CASE
        WHEN round(100.0 * sum(blks_hit) / (sum(blks_hit) + sum(blks_read)), 2) < 95 THEN 'warning'
        ELSE 'ok'
    END
FROM pg_stat_database
WHERE datname = current_database()
UNION ALL
SELECT
    'Active Users (24h)',
    (SELECT COUNT(DISTINCT user_id)::text FROM user_analytics WHERE created_at > NOW() - INTERVAL '24 hours'),
    'info'
UNION ALL
SELECT
    'New Registrations (24h)',
    (SELECT COUNT(*)::text FROM users WHERE created_at > NOW() - INTERVAL '24 hours'),
    'info'
UNION ALL
SELECT
    'Error Rate (24h)',
    (SELECT round(
        100.0 * COUNT(CASE WHEN severity IN ('error', 'critical') THEN 1 END) / COUNT(*), 2
    )::text || '%'
    FROM audit_log
    WHERE created_at > NOW() - INTERVAL '24 hours'),
    CASE
        WHEN (SELECT COUNT(CASE WHEN severity IN ('error', 'critical') THEN 1 END)::DECIMAL / COUNT(*) FROM audit_log WHERE created_at > NOW() - INTERVAL '24 hours') > 0.01 THEN 'warning'
        ELSE 'ok'
    END;

-- ============================================================================
-- SCHEDULED MAINTENANCE COMMANDS
-- ============================================================================

-- The following commands should be added to cron jobs:

/*
# Daily maintenance (run at 2 AM)
0 2 * * * psql -d teri_db -c "SELECT daily_maintenance();"

# Weekly maintenance (run on Sundays at 3 AM)
0 3 * * 0 psql -d teri_db -c "SELECT weekly_maintenance();"

# Health check (every 6 hours)
0 */6 * * * psql -d teri_db -c "SELECT database_health_check();"

# Data integrity check (daily at 1 AM)
0 1 * * * psql -d teri_db -c "SELECT data_integrity_check();"
*/

-- ============================================================================
-- EMERGENCY PROCEDURES
-- ============================================================================

-- Function to handle emergency shutdown preparation
CREATE OR REPLACE FUNCTION emergency_shutdown_prep()
RETURNS JSONB AS $$
DECLARE
    v_result JSONB := '{}';
BEGIN
    -- Stop accepting new connections (would need superuser privileges)
    -- This is typically done at the application level

    -- Finish current transactions gracefully
    CHECKPOINT;

    -- Log the emergency shutdown
    INSERT INTO audit_log (
        event_type,
        event_category,
        description,
        event_data,
        severity
    ) VALUES (
        'emergency_shutdown_initiated',
        'system',
        'Emergency shutdown procedures initiated',
        json_build_object('initiated_at', NOW()),
        'critical'
    );

    RETURN jsonb_build_object(
        'status', 'prepared_for_shutdown',
        'timestamp', NOW(),
        'message', 'Database prepared for emergency shutdown'
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- DOCUMENTATION AND COMMENTS
-- ============================================================================

COMMENT ON FUNCTION daily_maintenance() IS 'Runs daily maintenance tasks including cleanup, updates, and monitoring';
COMMENT ON FUNCTION weekly_maintenance() IS 'Runs weekly maintenance tasks including reindexing and statistics updates';
COMMENT ON FUNCTION database_health_check() IS 'Comprehensive health check returning key metrics and status indicators';
COMMENT ON FUNCTION data_integrity_check() IS 'Checks for data inconsistencies and orphaned records';
COMMENT ON FUNCTION performance_recommendations() IS 'Analyzes database performance and suggests optimizations';
COMMENT ON VIEW admin_system_monitor IS 'Real-time monitoring view for system administrators';

-- Final log entry
INSERT INTO audit_log (
    event_type,
    event_category,
    description,
    severity,
    event_data
) VALUES (
    'maintenance_procedures_installed',
    'system',
    'Database maintenance procedures and monitoring functions installed',
    'info',
    '{"functions_created": 8, "views_created": 1, "procedures": ["daily", "weekly", "health_check", "integrity_check"]}'
);