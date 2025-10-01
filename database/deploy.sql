-- ============================================================================
-- TERI Mobile App - Complete Database Deployment Script
-- File: deploy.sql
-- Created: 2025-09-30
-- Description: Master deployment script for complete database setup
-- ============================================================================

-- ============================================================================
-- DEPLOYMENT CONFIGURATION
-- ============================================================================

-- Ensure we're using the correct database
\echo 'Starting TERI Mobile App Database Deployment...'
\echo 'Database: ' :DBNAME
\echo 'User: ' :USER
\echo 'Host: ' :HOST
\echo 'Port: ' :PORT
\echo ''

-- Set deployment parameters
SET client_min_messages = WARNING;
SET log_statement = 'none';

-- Create deployment tracking table if it doesn't exist
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(50) PRIMARY KEY,
    description TEXT NOT NULL,
    applied_at TIMESTAMP DEFAULT NOW(),
    applied_by VARCHAR(100) DEFAULT current_user,
    execution_time_ms INTEGER,
    checksum VARCHAR(64)
);

-- Function to log migration execution
CREATE OR REPLACE FUNCTION log_migration_execution(
    p_version VARCHAR(50),
    p_description TEXT,
    p_start_time TIMESTAMP,
    p_checksum VARCHAR(64) DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_execution_time_ms INTEGER;
BEGIN
    v_execution_time_ms := EXTRACT(EPOCH FROM (NOW() - p_start_time)) * 1000;

    INSERT INTO schema_migrations (version, description, execution_time_ms, checksum)
    VALUES (p_version, p_description, v_execution_time_ms, p_checksum)
    ON CONFLICT (version) DO UPDATE SET
        applied_at = NOW(),
        applied_by = current_user,
        execution_time_ms = v_execution_time_ms,
        checksum = COALESCE(EXCLUDED.checksum, schema_migrations.checksum);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- MIGRATION 001: INITIAL SCHEMA
-- ============================================================================

DO $$
DECLARE
    v_start_time TIMESTAMP := NOW();
    v_version VARCHAR(50) := '001_initial_schema';
BEGIN
    -- Check if migration already applied
    IF EXISTS (SELECT 1 FROM schema_migrations WHERE version = v_version) THEN
        RAISE NOTICE 'Migration % already applied, skipping...', v_version;
        RETURN;
    END IF;

    RAISE NOTICE 'Applying migration: %', v_version;

    -- Run the migration
    \ir migrations/001_initial_schema.sql

    -- Log completion
    PERFORM log_migration_execution(v_version, 'Initial database schema with all core tables and indexes', v_start_time);

    RAISE NOTICE 'Migration % completed successfully', v_version;
END
$$;

-- ============================================================================
-- MIGRATION 002: TRIGGERS AND FUNCTIONS
-- ============================================================================

DO $$
DECLARE
    v_start_time TIMESTAMP := NOW();
    v_version VARCHAR(50) := '002_triggers_and_functions';
BEGIN
    IF EXISTS (SELECT 1 FROM schema_migrations WHERE version = v_version) THEN
        RAISE NOTICE 'Migration % already applied, skipping...', v_version;
        RETURN;
    END IF;

    RAISE NOTICE 'Applying migration: %', v_version;

    \ir migrations/002_triggers_and_functions.sql

    PERFORM log_migration_execution(v_version, 'Advanced triggers, functions, and automation', v_start_time);

    RAISE NOTICE 'Migration % completed successfully', v_version;
END
$$;

-- ============================================================================
-- MIGRATION 003: VIEWS AND INDEXES
-- ============================================================================

DO $$
DECLARE
    v_start_time TIMESTAMP := NOW();
    v_version VARCHAR(50) := '003_views_and_indexes';
BEGIN
    IF EXISTS (SELECT 1 FROM schema_migrations WHERE version = v_version) THEN
        RAISE NOTICE 'Migration % already applied, skipping...', v_version;
        RETURN;
    END IF;

    RAISE NOTICE 'Applying migration: %', v_version;

    \ir migrations/003_views_and_indexes.sql

    PERFORM log_migration_execution(v_version, 'Advanced views, materialized views, and performance indexes', v_start_time);

    RAISE NOTICE 'Migration % completed successfully', v_version;
END
$$;

-- ============================================================================
-- MIGRATION 004: SEED DATA
-- ============================================================================

DO $$
DECLARE
    v_start_time TIMESTAMP := NOW();
    v_version VARCHAR(50) := '004_seed_data';
BEGIN
    IF EXISTS (SELECT 1 FROM schema_migrations WHERE version = v_version) THEN
        RAISE NOTICE 'Migration % already applied, skipping...', v_version;
        RETURN;
    END IF;

    RAISE NOTICE 'Applying migration: %', v_version;

    \ir migrations/004_seed_data.sql

    PERFORM log_migration_execution(v_version, 'Initial seed data for comprehension questions and reference data', v_start_time);

    RAISE NOTICE 'Migration % completed successfully', v_version;
END
$$;

-- ============================================================================
-- MIGRATION 005: VECTOR DB INTEGRATION
-- ============================================================================

DO $$
DECLARE
    v_start_time TIMESTAMP := NOW();
    v_version VARCHAR(50) := '005_vector_db_integration';
BEGIN
    IF EXISTS (SELECT 1 FROM schema_migrations WHERE version = v_version) THEN
        RAISE NOTICE 'Migration % already applied, skipping...', v_version;
        RETURN;
    END IF;

    RAISE NOTICE 'Applying migration: %', v_version;

    \ir migrations/005_vector_db_integration.sql

    PERFORM log_migration_execution(v_version, 'Integration with ChromaDB and vector search capabilities', v_start_time);

    RAISE NOTICE 'Migration % completed successfully', v_version;
END
$$;

-- ============================================================================
-- MAINTENANCE PROCEDURES
-- ============================================================================

\echo 'Installing maintenance procedures...'
\ir maintenance.sql

-- ============================================================================
-- POST-DEPLOYMENT VERIFICATION
-- ============================================================================

-- Verify all tables exist
DO $$
DECLARE
    v_expected_tables TEXT[] := ARRAY[
        'users', 'couples', 'section_progress', 'translator_sessions',
        'mediator_sessions', 'journal_entries', 'game_sessions',
        'comprehension_questions', 'comprehension_attempts', 'notifications',
        'audit_log', 'user_analytics', 'vector_embeddings', 'semantic_searches',
        'relationship_themes', 'schema_migrations'
    ];
    v_table TEXT;
    v_missing_tables TEXT[] := '{}';
BEGIN
    FOREACH v_table IN ARRAY v_expected_tables LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = v_table
        ) THEN
            v_missing_tables := array_append(v_missing_tables, v_table);
        END IF;
    END LOOP;

    IF array_length(v_missing_tables, 1) > 0 THEN
        RAISE EXCEPTION 'Missing tables: %', array_to_string(v_missing_tables, ', ');
    ELSE
        RAISE NOTICE 'All expected tables present ✓';
    END IF;
END
$$;

-- Verify key functions exist
DO $$
DECLARE
    v_expected_functions TEXT[] := ARRAY[
        'pair_users', 'check_section_progression', 'update_user_engagement',
        'daily_maintenance', 'database_health_check', 'data_integrity_check'
    ];
    v_function TEXT;
    v_missing_functions TEXT[] := '{}';
BEGIN
    FOREACH v_function IN ARRAY v_expected_functions LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.routines
            WHERE routine_schema = 'public' AND routine_name = v_function
        ) THEN
            v_missing_functions := array_append(v_missing_functions, v_function);
        END IF;
    END LOOP;

    IF array_length(v_missing_functions, 1) > 0 THEN
        RAISE EXCEPTION 'Missing functions: %', array_to_string(v_missing_functions, ', ');
    ELSE
        RAISE NOTICE 'All expected functions present ✓';
    END IF;
END
$$;

-- Verify indexes exist
DO $$
DECLARE
    v_critical_indexes TEXT[] := ARRAY[
        'idx_users_email', 'idx_couples_partners', 'idx_progress_couple',
        'idx_translator_user', 'idx_mediator_user', 'idx_journal_user'
    ];
    v_index TEXT;
    v_missing_indexes TEXT[] := '{}';
BEGIN
    FOREACH v_index IN ARRAY v_critical_indexes LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes
            WHERE schemaname = 'public' AND indexname = v_index
        ) THEN
            v_missing_indexes := array_append(v_missing_indexes, v_index);
        END IF;
    END LOOP;

    IF array_length(v_missing_indexes, 1) > 0 THEN
        RAISE EXCEPTION 'Missing indexes: %', array_to_string(v_missing_indexes, ', ');
    ELSE
        RAISE NOTICE 'All critical indexes present ✓';
    END IF;
END
$$;

-- ============================================================================
-- DEPLOYMENT SUMMARY
-- ============================================================================

-- Generate deployment summary
DO $$
DECLARE
    v_deployment_summary JSONB;
    v_table_count INTEGER;
    v_index_count INTEGER;
    v_function_count INTEGER;
    v_view_count INTEGER;
    v_trigger_count INTEGER;
BEGIN
    -- Count database objects
    SELECT COUNT(*) INTO v_table_count FROM information_schema.tables WHERE table_schema = 'public';
    SELECT COUNT(*) INTO v_index_count FROM pg_indexes WHERE schemaname = 'public';
    SELECT COUNT(*) INTO v_function_count FROM information_schema.routines WHERE routine_schema = 'public' AND routine_type = 'FUNCTION';
    SELECT COUNT(*) INTO v_view_count FROM information_schema.views WHERE table_schema = 'public';
    SELECT COUNT(*) INTO v_trigger_count FROM information_schema.triggers WHERE trigger_schema = 'public';

    v_deployment_summary := jsonb_build_object(
        'deployment_completed_at', NOW(),
        'database_name', current_database(),
        'database_size', pg_size_pretty(pg_database_size(current_database())),
        'objects_created', jsonb_build_object(
            'tables', v_table_count,
            'indexes', v_index_count,
            'functions', v_function_count,
            'views', v_view_count,
            'triggers', v_trigger_count
        ),
        'migrations_applied', (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'version', version,
                    'description', description,
                    'applied_at', applied_at,
                    'execution_time_ms', execution_time_ms
                )
            )
            FROM schema_migrations
            ORDER BY applied_at
        ),
        'total_migration_time_ms', (
            SELECT SUM(execution_time_ms) FROM schema_migrations
        )
    );

    -- Log deployment completion
    INSERT INTO audit_log (
        event_type,
        event_category,
        description,
        event_data,
        severity
    ) VALUES (
        'database_deployment_completed',
        'deployment',
        'Complete database deployment finished successfully',
        v_deployment_summary,
        'info'
    );

    RAISE NOTICE 'Deployment Summary:';
    RAISE NOTICE '  Database: %', current_database();
    RAISE NOTICE '  Size: %', pg_size_pretty(pg_database_size(current_database()));
    RAISE NOTICE '  Tables: %', v_table_count;
    RAISE NOTICE '  Indexes: %', v_index_count;
    RAISE NOTICE '  Functions: %', v_function_count;
    RAISE NOTICE '  Views: %', v_view_count;
    RAISE NOTICE '  Triggers: %', v_trigger_count;
    RAISE NOTICE '  Total Migration Time: % ms', (SELECT SUM(execution_time_ms) FROM schema_migrations);
END
$$;

-- ============================================================================
-- INITIAL DATA VERIFICATION
-- ============================================================================

-- Run initial health check
\echo 'Running initial health check...'
SELECT database_health_check();

-- Run data integrity check
\echo 'Running data integrity check...'
SELECT data_integrity_check();

-- ============================================================================
-- DEPLOYMENT COMPLETE
-- ============================================================================

\echo ''
\echo '✅ TERI Mobile App Database Deployment Complete!'
\echo ''
\echo 'Next Steps:'
\echo '1. Set up regular maintenance cron jobs (see maintenance.sql comments)'
\echo '2. Configure application database connection strings'
\echo '3. Set up ChromaDB integration (see truth_power_db directory)'
\echo '4. Configure monitoring and alerting'
\echo '5. Test application connectivity'
\echo ''
\echo 'For monitoring, query the admin_system_monitor view:'
\echo 'SELECT * FROM admin_system_monitor;'
\echo ''

-- Reset client messages
SET client_min_messages = NOTICE;