-- ============================================================================
-- TERI Mobile App - Triggers and Functions Migration
-- Migration: 002_triggers_and_functions.sql
-- Created: 2025-09-30
-- Description: Advanced triggers, functions, and automation
-- ============================================================================

-- ============================================================================
-- UTILITY FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to generate secure random pairing codes
CREATE OR REPLACE FUNCTION generate_pairing_code()
RETURNS VARCHAR(8) AS $$
DECLARE
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Exclude confusing chars
    code VARCHAR(8) := '';
    i INTEGER;
BEGIN
    FOR i IN 1..8 LOOP
        code := code || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate word count
CREATE OR REPLACE FUNCTION calculate_word_count(text_content TEXT)
RETURNS INTEGER AS $$
BEGIN
    IF text_content IS NULL OR LENGTH(TRIM(text_content)) = 0 THEN
        RETURN 0;
    END IF;

    RETURN array_length(string_to_array(TRIM(regexp_replace(text_content, '\s+', ' ', 'g')), ' '), 1);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to estimate reading time (200 words per minute)
CREATE OR REPLACE FUNCTION estimate_reading_time(word_count INTEGER)
RETURNS INTEGER AS $$
BEGIN
    IF word_count IS NULL OR word_count <= 0 THEN
        RETURN 0;
    END IF;

    RETURN GREATEST(1, CEILING(word_count::DECIMAL / 200.0));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to safely pair users with validation
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
    v_user1_exists BOOLEAN;
    v_user2_exists BOOLEAN;
    v_user1_paired BOOLEAN;
    v_user2_paired BOOLEAN;
BEGIN
    -- Validate input parameters
    IF p_user1_id IS NULL OR p_user2_id IS NULL THEN
        RAISE EXCEPTION 'User IDs cannot be null';
    END IF;

    IF p_user1_id = p_user2_id THEN
        RAISE EXCEPTION 'Cannot pair user with themselves';
    END IF;

    -- Check if users exist
    SELECT EXISTS(SELECT 1 FROM users WHERE id = p_user1_id) INTO v_user1_exists;
    SELECT EXISTS(SELECT 1 FROM users WHERE id = p_user2_id) INTO v_user2_exists;

    IF NOT v_user1_exists THEN
        RAISE EXCEPTION 'User 1 does not exist: %', p_user1_id;
    END IF;

    IF NOT v_user2_exists THEN
        RAISE EXCEPTION 'User 2 does not exist: %', p_user2_id;
    END IF;

    -- Check if users are already paired
    SELECT partner_id IS NOT NULL FROM users WHERE id = p_user1_id INTO v_user1_paired;
    SELECT partner_id IS NOT NULL FROM users WHERE id = p_user2_id INTO v_user2_paired;

    IF v_user1_paired THEN
        RAISE EXCEPTION 'User 1 is already paired: %', p_user1_id;
    END IF;

    IF v_user2_paired THEN
        RAISE EXCEPTION 'User 2 is already paired: %', p_user2_id;
    END IF;

    -- Ensure canonical ordering (smaller UUID first)
    IF p_user1_id < p_user2_id THEN
        v_partner1_id := p_user1_id;
        v_partner2_id := p_user2_id;
    ELSE
        v_partner1_id := p_user2_id;
        v_partner2_id := p_user1_id;
    END IF;

    -- Create couple record
    INSERT INTO couples (
        partner1_id,
        partner2_id,
        relationship_start_date,
        shared_timezone,
        last_activity_date
    )
    VALUES (
        v_partner1_id,
        v_partner2_id,
        p_relationship_start_date,
        p_shared_timezone,
        CURRENT_DATE
    )
    RETURNING id INTO v_couple_id;

    -- Update users table with partner references
    UPDATE users
    SET
        partner_id = v_partner2_id,
        pairing_code = NULL,
        pairing_code_expires = NULL,
        last_active = NOW()
    WHERE id = v_partner1_id;

    UPDATE users
    SET
        partner_id = v_partner1_id,
        pairing_code = NULL,
        pairing_code_expires = NULL,
        last_active = NOW()
    WHERE id = v_partner2_id;

    -- Create initial section progress record (Level 1, Section 1)
    INSERT INTO section_progress (couple_id, level, section, first_accessed_at)
    VALUES (v_couple_id, 1, 1, NOW());

    -- Log the pairing event
    INSERT INTO audit_log (
        user_id,
        couple_id,
        event_type,
        event_category,
        description,
        event_data,
        severity
    ) VALUES (
        v_partner1_id,
        v_couple_id,
        'users_paired',
        'relationship',
        'Two users successfully paired as partners',
        json_build_object(
            'partner1_id', v_partner1_id,
            'partner2_id', v_partner2_id,
            'relationship_start_date', p_relationship_start_date,
            'shared_timezone', p_shared_timezone
        ),
        'info'
    );

    RETURN v_couple_id;
END;
$$ LANGUAGE plpgsql;

-- Function to check and update section progression with comprehensive logic
CREATE OR REPLACE FUNCTION check_section_progression(
    p_couple_id UUID,
    p_level INTEGER,
    p_section INTEGER
) RETURNS JSON AS $$
DECLARE
    v_progress section_progress%ROWTYPE;
    v_couple couples%ROWTYPE;
    v_result JSON;
    v_both_content_complete BOOLEAN;
    v_settle_elapsed BOOLEAN;
    v_both_passed BOOLEAN;
    v_settle_hours_remaining DECIMAL;
BEGIN
    -- Validate inputs
    IF p_couple_id IS NULL OR p_level IS NULL OR p_section IS NULL THEN
        RETURN json_build_object('status', 'invalid_input', 'error', 'Missing required parameters');
    END IF;

    -- Get couple information
    SELECT * INTO v_couple FROM couples WHERE id = p_couple_id;
    IF v_couple.id IS NULL THEN
        RETURN json_build_object('status', 'couple_not_found');
    END IF;

    -- Get current progress
    SELECT * INTO v_progress
    FROM section_progress
    WHERE couple_id = p_couple_id AND level = p_level AND section = p_section;

    IF v_progress.id IS NULL THEN
        RETURN json_build_object('status', 'section_not_found');
    END IF;

    -- Check if both partners completed content
    v_both_content_complete := v_progress.partner1_content_complete AND v_progress.partner2_content_complete;

    -- Start settle timer if both complete and timer not started
    IF v_both_content_complete AND v_progress.settle_timer_start IS NULL THEN
        UPDATE section_progress
        SET settle_timer_start = NOW(), updated_at = NOW()
        WHERE id = v_progress.id;

        -- Update couple's last activity
        UPDATE couples
        SET last_activity_date = CURRENT_DATE
        WHERE id = p_couple_id;

        -- Create notifications for both partners
        INSERT INTO notifications (user_id, type, title, message, category, priority, scheduled_for)
        SELECT
            u.id,
            'settle_timer_started',
            'Content Complete! 📚',
            'Both partners have completed the content. Your comprehension check will be available in 24 hours.',
            'progress',
            'medium',
            NOW() + INTERVAL '24 hours'
        FROM users u
        WHERE u.id IN (v_couple.partner1_id, v_couple.partner2_id);

        RETURN json_build_object(
            'status', 'settle_timer_started',
            'unlocks_at', NOW() + INTERVAL '24 hours',
            'settle_hours', 24
        );
    END IF;

    -- Check if 24 hours elapsed since both completed
    IF v_progress.settle_timer_start IS NOT NULL THEN
        v_settle_hours_remaining := 24 - EXTRACT(EPOCH FROM (NOW() - v_progress.settle_timer_start)) / 3600;
        v_settle_elapsed := v_settle_hours_remaining <= 0;
    ELSE
        v_settle_elapsed := false;
        v_settle_hours_remaining := NULL;
    END IF;

    -- Unlock comprehension if settle time elapsed and not already unlocked
    IF v_settle_elapsed AND v_progress.comprehension_unlocked_at IS NULL THEN
        UPDATE section_progress
        SET comprehension_unlocked_at = NOW(), updated_at = NOW()
        WHERE id = v_progress.id;

        -- Create notifications for comprehension availability
        INSERT INTO notifications (user_id, type, title, message, category, priority, action_url)
        SELECT
            u.id,
            'comprehension_ready',
            'Comprehension Check Ready! 🧠',
            format('Your comprehension check for Level %s, Section %s is now available.', p_level, p_section),
            'progress',
            'high',
            format('/training/sections/%s/%s/comprehension', p_level, p_section)
        FROM users u
        WHERE u.id IN (v_couple.partner1_id, v_couple.partner2_id);

        RETURN json_build_object(
            'status', 'comprehension_unlocked',
            'level', p_level,
            'section', p_section
        );
    END IF;

    -- Check if both partners passed comprehension (≥80%)
    v_both_passed := (v_progress.partner1_comprehension_score >= 0.80) AND
                     (v_progress.partner2_comprehension_score >= 0.80);

    -- Unlock next section if both passed and not already unlocked
    IF v_both_passed AND NOT v_progress.section_unlocked THEN
        UPDATE section_progress
        SET
            section_unlocked = TRUE,
            section_unlocked_at = NOW(),
            updated_at = NOW()
        WHERE id = v_progress.id;

        -- Update couple's progress
        UPDATE couples
        SET
            total_sections_completed = total_sections_completed + 1,
            last_activity_date = CURRENT_DATE,
            current_section = CASE
                WHEN current_level = p_level THEN GREATEST(current_section, p_section + 1)
                ELSE current_section
            END
        WHERE id = p_couple_id;

        -- Create next section record if it doesn't exist
        INSERT INTO section_progress (couple_id, level, section, first_accessed_at)
        VALUES (p_couple_id, p_level, p_section + 1, NOW())
        ON CONFLICT (couple_id, level, section) DO NOTHING;

        -- Create celebration notifications
        INSERT INTO notifications (user_id, type, title, message, category, priority, action_url)
        SELECT
            u.id,
            'section_unlocked',
            'Section Unlocked! 🎉',
            format('Congratulations! You''ve unlocked Level %s, Section %s.', p_level, p_section + 1),
            'progress',
            'high',
            format('/training/sections/%s/%s', p_level, p_section + 1)
        FROM users u
        WHERE u.id IN (v_couple.partner1_id, v_couple.partner2_id);

        RETURN json_build_object(
            'status', 'section_unlocked',
            'next_level', p_level,
            'next_section', p_section + 1,
            'celebration', true
        );
    END IF;

    -- Return current status with detailed information
    RETURN json_build_object(
        'status', 'waiting',
        'both_content_complete', v_both_content_complete,
        'settle_timer_started', v_progress.settle_timer_start IS NOT NULL,
        'settle_hours_remaining', CASE
            WHEN v_settle_hours_remaining IS NOT NULL THEN ROUND(GREATEST(0, v_settle_hours_remaining), 2)
            ELSE NULL
        END,
        'comprehension_available', v_progress.comprehension_unlocked_at IS NOT NULL,
        'both_passed_comprehension', v_both_passed,
        'section_unlocked', v_progress.section_unlocked,
        'partner1_complete', v_progress.partner1_content_complete,
        'partner2_complete', v_progress.partner2_content_complete,
        'partner1_score', v_progress.partner1_comprehension_score,
        'partner2_score', v_progress.partner2_comprehension_score
    );
END;
$$ LANGUAGE plpgsql;

-- Function to update user engagement metrics
CREATE OR REPLACE FUNCTION update_user_engagement(
    p_user_id UUID,
    p_action VARCHAR(100),
    p_duration_minutes INTEGER DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
) RETURNS VOID AS $$
DECLARE
    v_today DATE := CURRENT_DATE;
    v_couple_id UUID;
BEGIN
    -- Get user's couple_id
    SELECT c.id INTO v_couple_id
    FROM couples c
    WHERE c.partner1_id = p_user_id OR c.partner2_id = p_user_id;

    -- Update last_active timestamp
    UPDATE users
    SET last_active = NOW()
    WHERE id = p_user_id;

    -- Update couple's last_activity_date if applicable
    IF v_couple_id IS NOT NULL THEN
        UPDATE couples
        SET last_activity_date = v_today
        WHERE id = v_couple_id AND (last_activity_date IS NULL OR last_activity_date < v_today);
    END IF;

    -- Log the activity
    INSERT INTO audit_log (
        user_id,
        couple_id,
        event_type,
        event_category,
        description,
        event_data,
        severity
    ) VALUES (
        p_user_id,
        v_couple_id,
        'user_activity',
        'engagement',
        format('User performed action: %s', p_action),
        json_build_object(
            'action', p_action,
            'duration_minutes', p_duration_minutes,
            'metadata', p_metadata
        ),
        'debug'
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS FOR AUTOMATED FUNCTIONALITY
-- ============================================================================

-- Update updated_at timestamp automatically
CREATE TRIGGER update_couples_updated_at
    BEFORE UPDATE ON couples
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_section_progress_updated_at
    BEFORE UPDATE ON section_progress
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_journal_entries_updated_at
    BEFORE UPDATE ON journal_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_game_sessions_updated_at
    BEFORE UPDATE ON game_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comprehension_questions_updated_at
    BEFORE UPDATE ON comprehension_questions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Automatically set auto_delete_at for mediator sessions (90 days)
CREATE OR REPLACE FUNCTION set_mediator_auto_delete()
RETURNS TRIGGER AS $$
BEGIN
    NEW.auto_delete_at = NEW.created_at + INTERVAL '90 days';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_mediator_auto_delete_trigger
    BEFORE INSERT ON mediator_sessions
    FOR EACH ROW EXECUTE FUNCTION set_mediator_auto_delete();

-- Automatically calculate word count and reading time for journal entries
CREATE OR REPLACE FUNCTION update_journal_metrics()
RETURNS TRIGGER AS $$
BEGIN
    NEW.word_count = calculate_word_count(NEW.content);
    NEW.estimated_read_time_minutes = estimate_reading_time(NEW.word_count);
    NEW.last_edited_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_journal_metrics_trigger
    BEFORE INSERT OR UPDATE OF content ON journal_entries
    FOR EACH ROW EXECUTE FUNCTION update_journal_metrics();

-- Automatically update couple statistics when game sessions are completed
CREATE OR REPLACE FUNCTION update_couple_game_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.completed_at IS NOT NULL AND (OLD.completed_at IS NULL OR OLD.completed_at != NEW.completed_at) THEN
        UPDATE couples
        SET
            total_games_played = total_games_played + 1,
            last_activity_date = CURRENT_DATE
        WHERE id = NEW.couple_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_couple_game_stats_trigger
    AFTER UPDATE ON game_sessions
    FOR EACH ROW EXECUTE FUNCTION update_couple_game_stats();

-- Automatically update couple statistics when translator sessions are created
CREATE OR REPLACE FUNCTION update_couple_translator_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE couples
    SET
        total_translator_uses = total_translator_uses + 1,
        last_activity_date = CURRENT_DATE
    WHERE id = NEW.couple_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_couple_translator_stats_trigger
    AFTER INSERT ON translator_sessions
    FOR EACH ROW EXECUTE FUNCTION update_couple_translator_stats();

-- Automatically update couple statistics when mediator sessions are created
CREATE OR REPLACE FUNCTION update_couple_mediator_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE couples
    SET
        total_mediator_uses = total_mediator_uses + 1,
        last_activity_date = CURRENT_DATE
    WHERE id = NEW.couple_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_couple_mediator_stats_trigger
    AFTER INSERT ON mediator_sessions
    FOR EACH ROW EXECUTE FUNCTION update_couple_mediator_stats();

-- Validate and process comprehension attempts
CREATE OR REPLACE FUNCTION process_comprehension_attempt()
RETURNS TRIGGER AS $$
DECLARE
    v_partner_column VARCHAR(50);
    v_partner_score DECIMAL(3,2);
    v_update_query TEXT;
BEGIN
    -- Determine which partner this attempt belongs to
    SELECT
        CASE
            WHEN c.partner1_id = NEW.user_id THEN 'partner1'
            WHEN c.partner2_id = NEW.user_id THEN 'partner2'
            ELSE NULL
        END
    INTO v_partner_column
    FROM couples c
    WHERE c.id = NEW.couple_id;

    IF v_partner_column IS NULL THEN
        RAISE EXCEPTION 'User is not part of the specified couple';
    END IF;

    -- Update section_progress with the attempt results
    v_update_query := format(
        'UPDATE section_progress SET
         %I_comprehension_score = $1,
         %I_comprehension_attempts = %I_comprehension_attempts + 1,
         updated_at = NOW()
         WHERE couple_id = $2 AND level = $3 AND section = $4',
        v_partner_column, v_partner_column, v_partner_column
    );

    EXECUTE v_update_query USING NEW.total_score, NEW.couple_id, NEW.level, NEW.section;

    -- Check if we should trigger section progression
    PERFORM check_section_progression(NEW.couple_id, NEW.level, NEW.section);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER process_comprehension_attempt_trigger
    AFTER INSERT ON comprehension_attempts
    FOR EACH ROW EXECUTE FUNCTION process_comprehension_attempt();

-- Audit sensitive operations
CREATE OR REPLACE FUNCTION audit_sensitive_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_event_type VARCHAR(100);
    v_description TEXT;
    v_old_values JSONB;
    v_new_values JSONB;
BEGIN
    -- Determine event type based on operation
    CASE TG_OP
        WHEN 'INSERT' THEN
            v_event_type := TG_TABLE_NAME || '_created';
            v_description := 'Record created in ' || TG_TABLE_NAME;
            v_old_values := NULL;
            v_new_values := to_jsonb(NEW);
        WHEN 'UPDATE' THEN
            v_event_type := TG_TABLE_NAME || '_updated';
            v_description := 'Record updated in ' || TG_TABLE_NAME;
            v_old_values := to_jsonb(OLD);
            v_new_values := to_jsonb(NEW);
        WHEN 'DELETE' THEN
            v_event_type := TG_TABLE_NAME || '_deleted';
            v_description := 'Record deleted from ' || TG_TABLE_NAME;
            v_old_values := to_jsonb(OLD);
            v_new_values := NULL;
    END CASE;

    -- Insert audit record
    INSERT INTO audit_log (
        user_id,
        event_type,
        event_category,
        description,
        old_values,
        new_values,
        affected_table,
        affected_record_id,
        security_relevant
    ) VALUES (
        COALESCE(NEW.user_id, OLD.user_id),
        v_event_type,
        'data_change',
        v_description,
        v_old_values,
        v_new_values,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        TG_TABLE_NAME IN ('users', 'couples', 'mediator_sessions')
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Apply audit triggers to sensitive tables
CREATE TRIGGER audit_users_changes
    AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION audit_sensitive_changes();

CREATE TRIGGER audit_couples_changes
    AFTER INSERT OR UPDATE OR DELETE ON couples
    FOR EACH ROW EXECUTE FUNCTION audit_sensitive_changes();

CREATE TRIGGER audit_mediator_sessions_changes
    AFTER INSERT OR UPDATE OR DELETE ON mediator_sessions
    FOR EACH ROW EXECUTE FUNCTION audit_sensitive_changes();

-- ============================================================================
-- NOTIFICATION PROCESSING FUNCTIONS
-- ============================================================================

-- Function to process scheduled notifications
CREATE OR REPLACE FUNCTION process_scheduled_notifications()
RETURNS INTEGER AS $$
DECLARE
    v_notification notifications%ROWTYPE;
    v_processed_count INTEGER := 0;
BEGIN
    -- Process notifications that are scheduled and not yet sent
    FOR v_notification IN
        SELECT * FROM notifications
        WHERE scheduled_for <= NOW()
        AND sent_at IS NULL
        AND expires_at > NOW()
        ORDER BY priority DESC, scheduled_for ASC
        LIMIT 100
    LOOP
        -- Mark as sent (actual sending would be handled by application layer)
        UPDATE notifications
        SET
            sent_at = NOW(),
            delivery_method = 'push' -- Default delivery method
        WHERE id = v_notification.id;

        v_processed_count := v_processed_count + 1;
    END LOOP;

    RETURN v_processed_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old notifications
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    -- Delete notifications older than 90 days
    WITH deleted AS (
        DELETE FROM notifications
        WHERE created_at < NOW() - INTERVAL '90 days'
        OR (expires_at IS NOT NULL AND expires_at < NOW() - INTERVAL '7 days')
        RETURNING id
    )
    SELECT count(*) INTO v_deleted_count FROM deleted;

    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- DATA MAINTENANCE FUNCTIONS
-- ============================================================================

-- Function to clean up expired pairing codes
CREATE OR REPLACE FUNCTION cleanup_expired_pairing_codes()
RETURNS INTEGER AS $$
DECLARE
    v_cleaned_count INTEGER;
BEGIN
    WITH cleaned AS (
        UPDATE users
        SET
            pairing_code = NULL,
            pairing_code_expires = NULL
        WHERE pairing_code_expires < NOW()
        AND pairing_code IS NOT NULL
        RETURNING id
    )
    SELECT count(*) INTO v_cleaned_count FROM cleaned;

    RETURN v_cleaned_count;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-delete old mediator sessions
CREATE OR REPLACE FUNCTION cleanup_old_mediator_sessions()
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    WITH deleted AS (
        DELETE FROM mediator_sessions
        WHERE auto_delete_at < NOW()
        RETURNING id
    )
    SELECT count(*) INTO v_deleted_count FROM deleted;

    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to update user streaks (should be called daily)
CREATE OR REPLACE FUNCTION update_user_streaks()
RETURNS INTEGER AS $$
DECLARE
    v_couple couples%ROWTYPE;
    v_updated_count INTEGER := 0;
    v_had_activity BOOLEAN;
    v_yesterday DATE := CURRENT_DATE - INTERVAL '1 day';
BEGIN
    FOR v_couple IN SELECT * FROM couples WHERE status = 'active' LOOP
        -- Check if couple had any activity yesterday
        SELECT EXISTS(
            SELECT 1 FROM (
                SELECT created_at::date as activity_date FROM translator_sessions WHERE couple_id = v_couple.id
                UNION ALL
                SELECT created_at::date FROM mediator_sessions WHERE couple_id = v_couple.id
                UNION ALL
                SELECT started_at::date FROM game_sessions WHERE couple_id = v_couple.id
                UNION ALL
                SELECT updated_at::date FROM section_progress WHERE couple_id = v_couple.id
            ) activities
            WHERE activity_date = v_yesterday
        ) INTO v_had_activity;

        IF v_had_activity THEN
            -- Continue or start streak
            UPDATE couples
            SET
                current_streak_days = CASE
                    WHEN last_activity_date = v_yesterday THEN current_streak_days + 1
                    ELSE 1 -- Reset if there was a gap
                END,
                longest_streak_days = GREATEST(longest_streak_days, current_streak_days + 1),
                last_activity_date = v_yesterday
            WHERE id = v_couple.id;

            v_updated_count := v_updated_count + 1;
        ELSE
            -- Break streak if no activity
            UPDATE couples
            SET current_streak_days = 0
            WHERE id = v_couple.id AND current_streak_days > 0;
        END IF;
    END LOOP;

    RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ANALYTICS AND REPORTING FUNCTIONS
-- ============================================================================

-- Function to calculate engagement score for a user
CREATE OR REPLACE FUNCTION calculate_user_engagement_score(p_user_id UUID)
RETURNS DECIMAL(3,2) AS $$
DECLARE
    v_score DECIMAL(3,2) := 0.0;
    v_days_since_signup INTEGER;
    v_sections_completed INTEGER;
    v_tools_used INTEGER;
    v_recent_activity INTEGER;
BEGIN
    -- Get basic metrics
    SELECT
        EXTRACT(days FROM NOW() - created_at)::INTEGER,
        COALESCE((
            SELECT COUNT(*) FROM section_progress sp
            JOIN couples c ON sp.couple_id = c.id
            WHERE (c.partner1_id = p_user_id AND sp.partner1_content_complete)
               OR (c.partner2_id = p_user_id AND sp.partner2_content_complete)
        ), 0),
        COALESCE((
            SELECT COUNT(*) FROM translator_sessions WHERE user_id = p_user_id
        ), 0) + COALESCE((
            SELECT COUNT(*) FROM mediator_sessions WHERE user_id = p_user_id
        ), 0)
    INTO v_days_since_signup, v_sections_completed, v_tools_used
    FROM users
    WHERE id = p_user_id;

    -- Get recent activity (last 7 days)
    SELECT COUNT(*)
    INTO v_recent_activity
    FROM (
        SELECT created_at FROM translator_sessions WHERE user_id = p_user_id AND created_at > NOW() - INTERVAL '7 days'
        UNION ALL
        SELECT created_at FROM mediator_sessions WHERE user_id = p_user_id AND created_at > NOW() - INTERVAL '7 days'
        UNION ALL
        SELECT created_at FROM journal_entries WHERE user_id = p_user_id AND created_at > NOW() - INTERVAL '7 days'
    ) recent;

    -- Calculate score components
    v_score := v_score + LEAST(0.3, v_sections_completed * 0.05); -- Section completion (max 30%)
    v_score := v_score + LEAST(0.3, v_tools_used * 0.02); -- Tool usage (max 30%)
    v_score := v_score + LEAST(0.2, v_recent_activity * 0.05); -- Recent activity (max 20%)

    -- Longevity bonus
    IF v_days_since_signup > 30 THEN
        v_score := v_score + 0.1;
    ELSIF v_days_since_signup > 7 THEN
        v_score := v_score + 0.05;
    END IF;

    -- Partner interaction bonus
    IF EXISTS(SELECT 1 FROM couples WHERE partner1_id = p_user_id OR partner2_id = p_user_id) THEN
        v_score := v_score + 0.1;
    END IF;

    RETURN LEAST(1.0, v_score);
END;
$$ LANGUAGE plpgsql;

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
    'Triggers and functions migration completed successfully',
    'info',
    '{"migration": "002_triggers_and_functions.sql", "functions_created": 15, "triggers_created": 12}'
);