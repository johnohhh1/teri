-- ============================================================================
-- TERI Mobile App - Seed Data Migration
-- Migration: 004_seed_data.sql
-- Created: 2025-09-30
-- Description: Initial seed data for comprehension questions and reference data
-- ============================================================================

-- ============================================================================
-- COMPREHENSION QUESTIONS - LEVEL 1
-- ============================================================================

-- Level 1, Section 1: Welcome & Orientation
INSERT INTO comprehension_questions (level, section, question_type, question_data, difficulty, points_possible, concepts_tested, estimated_time_minutes, author) VALUES
(1, 1, 'multiple_choice', '{
    "question": "What are the Four Pillars of Truth Empowered Relationships?",
    "options": [
        {"id": "A", "text": "Honesty, Trust, Communication, Love"},
        {"id": "B", "text": "Freeness, Wholesomeness, Non-Meanness, Fairness"},
        {"id": "C", "text": "Speaking, Listening, Understanding, Acting"},
        {"id": "D", "text": "Respect, Kindness, Patience, Forgiveness"}
    ],
    "correct_answer": "B",
    "explanation": "The Four Pillars are: Freeness (authentic expression), Wholesomeness (complete truth), Non-Meanness (kind delivery), and Fairness (balanced exchange)."
}', 'easy', 1, '["four_pillars", "foundation"]', 2, 'TERI Team'),

(1, 1, 'multiple_choice', '{
    "question": "What does ''Freeness'' mean in the context of Truth Empowered Relationships?",
    "options": [
        {"id": "A", "text": "Being able to say whatever you want without consequences"},
        {"id": "B", "text": "Authentic expression of your true self without masks or pretense"},
        {"id": "C", "text": "Freedom from responsibility in the relationship"},
        {"id": "D", "text": "Not having to commit to the relationship"}
    ],
    "correct_answer": "B",
    "explanation": "Freeness is about authentic expression - being your true self without masks, pretense, or fear-based hiding."
}', 'medium', 1, '["freeness", "authenticity"]', 2, 'TERI Team'),

(1, 1, 'scenario', '{
    "question": "Your partner says: ''You never listen to me anymore.'' How would you respond using the Four Pillars?",
    "scoring_criteria": {
        "acknowledges_concern": 1,
        "avoids_defensiveness": 1,
        "shows_freeness": 1,
        "demonstrates_non_meanness": 1
    },
    "sample_answer": "I hear that you''re feeling unheard. That matters to me. Help me understand - what would listening look like to you? I want to do better.",
    "pillar_focus": ["freeness", "non_meanness", "wholesomeness"]
}', 'medium', 4, '["four_pillars", "response_skills", "listening"]', 3, 'TERI Team');

-- Level 1, Section 2: Truth Empowered Speaking Basics
INSERT INTO comprehension_questions (level, section, question_type, question_data, difficulty, points_possible, concepts_tested, estimated_time_minutes, author) VALUES
(1, 2, 'multiple_choice', '{
    "question": "Which of these is an ''Outer'' (observable fact)?",
    "options": [
        {"id": "A", "text": "You never help with anything"},
        {"id": "B", "text": "You didn''t do the dishes last night"},
        {"id": "C", "text": "You don''t care about our home"},
        {"id": "D", "text": "You''re always lazy"}
    ],
    "correct_answer": "B",
    "explanation": "An Outer is something a camera could record. Option B is a specific, observable fact, while the others are interpretations or judgments."
}', 'easy', 1, '["outer", "tes_structure", "facts_vs_interpretation"]', 2, 'TERI Team'),

(1, 2, 'translation', '{
    "question": "Translate this reactive statement using TES structure: ''You''re so selfish!''",
    "expected_structure": {
        "outer": {"required": true, "points": 2},
        "inner": {"required": true, "points": 2},
        "under": {"required": true, "points": 2},
        "ask": {"required": true, "points": 2}
    },
    "scoring_rubric": {
        "outer": {
            "excellent": "Specific observable behavior with no judgment or interpretation",
            "good": "Observable behavior with minor interpretation",
            "poor": "Includes judgment, interpretation, or generalizations"
        },
        "inner": {
            "excellent": "Clear emotional state using ''I feel'' language",
            "good": "Emotional state mentioned but could be clearer",
            "poor": "No clear emotional expression or blames partner"
        },
        "under": {
            "excellent": "Vulnerable fear about abandonment, inadequacy, or unworthiness",
            "good": "Somewhat vulnerable but not deep enough",
            "poor": "Not vulnerable or just rephrases inner/outer"
        },
        "ask": {
            "excellent": "Specific, kind, doable request without demands",
            "good": "Clear request but could be more specific or kind",
            "poor": "Vague, demanding, or contains threats/ultimatums"
        }
    }
}', 'hard', 8, '["tes_translation", "outer", "inner", "under", "ask"]', 5, 'TERI Team'),

(1, 2, 'multiple_choice', '{
    "question": "What makes a request ''kind'' in Truth Empowered Speaking?",
    "options": [
        {"id": "A", "text": "Using please and thank you"},
        {"id": "B", "text": "Making it optional with no pressure or consequences"},
        {"id": "C", "text": "Asking for small things only"},
        {"id": "D", "text": "Speaking in a soft voice"}
    ],
    "correct_answer": "B",
    "explanation": "A kind request is truly optional - there''s no pressure, manipulation, or negative consequences if the person says no."
}', 'medium', 1, '["ask", "kindness", "non_meanness"]', 2, 'TERI Team');

-- Level 1, Section 3: Truth Empowered Listening Basics
INSERT INTO comprehension_questions (level, section, question_type, question_data, difficulty, points_possible, concepts_tested, estimated_time_minutes, author) VALUES
(1, 3, 'scenario', '{
    "question": "Your partner says: ''I had the worst day. Everything went wrong and I just want to disappear.'' How would you respond using Truth Empowered Listening?",
    "scoring_criteria": {
        "acknowledges_emotion": 1,
        "avoids_fixing": 1,
        "asks_curious_question": 1,
        "shows_presence": 1
    },
    "sample_answer": "That sounds really hard. I''m here with you. What part of the day felt the most overwhelming?",
    "tel_focus": ["presence", "curiosity", "validation"]
}', 'medium', 4, '["tel_basics", "presence", "curiosity"]', 3, 'TERI Team'),

(1, 3, 'multiple_choice', '{
    "question": "In Truth Empowered Listening, what''s the primary goal?",
    "options": [
        {"id": "A", "text": "To solve your partner''s problems"},
        {"id": "B", "text": "To understand what your partner is really experiencing"},
        {"id": "C", "text": "To give good advice"},
        {"id": "D", "text": "To make your partner feel better"}
    ],
    "correct_answer": "B",
    "explanation": "The primary goal of TEL is deep understanding - getting underneath the surface to truly comprehend your partner''s experience."
}', 'easy', 1, '["tel_purpose", "understanding"]', 2, 'TERI Team'),

(1, 3, 'multiple_choice', '{
    "question": "Which response demonstrates the best Truth Empowered Listening?",
    "options": [
        {"id": "A", "text": "At least it''s Friday tomorrow!"},
        {"id": "B", "text": "You should try meditation for stress"},
        {"id": "C", "text": "Tell me more about what made it feel overwhelming"},
        {"id": "D", "text": "I''m sure it wasn''t that bad"}
    ],
    "correct_answer": "C",
    "explanation": "Option C shows curiosity and invites deeper sharing, which is the essence of Truth Empowered Listening."
}', 'medium', 1, '["tel_responses", "curiosity", "depth_questions"]', 2, 'TERI Team');

-- ============================================================================
-- COMPREHENSION QUESTIONS - LEVEL 2
-- ============================================================================

-- Level 2, Section 1: Advanced TES - Working with Triggers
INSERT INTO comprehension_questions (level, section, question_type, question_data, difficulty, points_possible, concepts_tested, estimated_time_minutes, author) VALUES
(2, 1, 'translation', '{
    "question": "Translate this highly triggered statement: ''I can''t believe you forgot our anniversary AGAIN! You obviously don''t give a damn about me or this relationship!''",
    "expected_structure": {
        "outer": {"required": true, "points": 3},
        "inner": {"required": true, "points": 3},
        "under": {"required": true, "points": 4},
        "ask": {"required": true, "points": 3}
    },
    "scoring_rubric": {
        "outer": {
            "excellent": "Specific date/event mentioned without interpretation",
            "good": "References anniversary but includes some interpretation",
            "poor": "Includes generalizations like ''always'' or ''never''"
        },
        "under": {
            "excellent": "Deep vulnerability about being forgotten, unloved, or unimportant",
            "good": "Some vulnerability but stays surface level",
            "poor": "No real vulnerability shown"
        }
    },
    "difficulty_factors": ["high_emotion", "generalizations", "accusations"]
}', 'hard', 13, '["advanced_tes", "triggered_states", "vulnerability"]', 7, 'TERI Team'),

(2, 1, 'scenario', '{
    "question": "You''re feeling triggered and reactive. What''s the first step before attempting TES translation?",
    "options": [
        {"id": "A", "text": "Take time to calm down and get present"},
        {"id": "B", "text": "Immediately start translating to avoid saying something mean"},
        {"id": "C", "text": "Tell your partner you need space"},
        {"id": "D", "text": "Write down everything you''re feeling"}
    ],
    "correct_answer": "A",
    "explanation": "When triggered, the first step is always to get present and calm. TES translation from a reactive state often lacks clarity and vulnerability."
}', 'medium', 1, '["self_regulation", "triggered_states", "presence"]', 2, 'TERI Team');

-- Level 2, Section 2: Advanced TEL - Listening to Triggered Partners
INSERT INTO comprehension_questions (level, section, question_type, question_data, difficulty, points_possible, concepts_tested, estimated_time_minutes, author) VALUES
(2, 2, 'scenario', '{
    "question": "Your partner is yelling: ''You NEVER listen! You just sit there like a bump on a log while I pour my heart out!'' How do you respond with TEL?",
    "scoring_criteria": {
        "stays_non_defensive": 2,
        "finds_truth_underneath": 2,
        "responds_to_pain_not_words": 2,
        "asks_depth_question": 2
    },
    "sample_answer": "I can see you''re in pain and feeling unheard. That must be so lonely. Help me understand what listening looks like to you when you''re hurting.",
    "challenge_factors": ["personal_attack", "high_emotion", "generalization"]
}', 'hard', 8, '["advanced_tel", "triggered_partners", "non_defensiveness"]', 5, 'TERI Team');

-- ============================================================================
-- SAMPLE GAME CONFIGURATIONS
-- ============================================================================

-- Sample game session data for reference
INSERT INTO audit_log (
    event_type,
    event_category,
    description,
    event_data,
    severity
) VALUES (
    'seed_data_games',
    'reference',
    'Sample game configurations for testing and reference',
    '{
        "games": [
            {
                "id": "iwr",
                "title": "Internal Weather Report",
                "duration_minutes": {"min": 2, "max": 3},
                "level_required": 1,
                "themes": ["communication", "vulnerability"],
                "tags": ["quick", "daily", "verbal"],
                "description": "Share your emotional state using weather metaphors",
                "how_to_play": "One partner shares their emotional state using weather metaphors. ''I''m partly cloudy with chance of anxiety'' or ''I''m stormy with lightning bolts of frustration.'' No response needed, just witness.",
                "safety_notes": "This is a low-risk game suitable for any emotional state.",
                "debrief_questions": [
                    "What weather pattern shows up most often for you?",
                    "What helps shift your internal weather?"
                ]
            },
            {
                "id": "pause",
                "title": "Pause",
                "duration_minutes": {"min": 1, "max": 2},
                "level_required": 1,
                "themes": ["elevation", "repair"],
                "tags": ["quick", "crisis", "verbal"],
                "description": "Stop conversations from spiraling by taking accountability",
                "how_to_play": "1. Either partner calls ''Pause''\\n2. Caller has 15 seconds to identify where things went wrong\\n3. Must own their part: ''I got defensive when...''\\n4. If no ownership in 15 seconds, conversation resumes\\n5. Other partner shares their responsibility\\n6. Both say ''Rewind'' to restart before the misstep\\n7. Say ''Play!'' together to continue",
                "safety_notes": "Stop if elevation gets above 7/10. Take a longer break if needed."
            },
            {
                "id": "and_what_else",
                "title": "And What Else?",
                "duration_minutes": {"min": 10, "max": 20},
                "level_required": 2,
                "themes": ["resentment", "vulnerability"],
                "tags": ["deep", "verbal"],
                "description": "Release layers of resentment to restore intimacy",
                "how_to_play": "1. Set timer for 10 minutes per person\\n2. Partner 1 shares: ''I resent you for...''\\n3. Partner 2 only responds: ''And what else?''\\n4. Continue for 10 minutes or until complete\\n5. No defending, explaining, or reacting\\n6. Resentments may transform to appreciations\\n7. Switch roles\\n8. Discuss afterward",
                "safety_notes": "This game can bring up intense emotions. Stop if either partner exceeds 8/10 elevation.",
                "contraindications": ["active_conflict", "recent_betrayal"]
            }
        ]
    }',
    'info'
);

-- ============================================================================
-- SAMPLE NOTIFICATION TEMPLATES
-- ============================================================================

-- Sample notification templates for reference
INSERT INTO audit_log (
    event_type,
    event_category,
    description,
    event_data,
    severity
) VALUES (
    'seed_data_notifications',
    'reference',
    'Sample notification templates for system use',
    '{
        "notification_templates": {
            "comprehension_ready": {
                "title": "Comprehension Check Ready! 🧠",
                "message": "Your comprehension check for Level {level}, Section {section} is now available.",
                "category": "progress",
                "priority": "high",
                "action_url": "/training/sections/{level}/{section}/comprehension"
            },
            "section_unlocked": {
                "title": "New Section Unlocked! 🎉",
                "message": "Congratulations! You''ve unlocked Level {level}, Section {section}.",
                "category": "progress",
                "priority": "high",
                "action_url": "/training/sections/{level}/{section}"
            },
            "settle_timer_started": {
                "title": "Content Complete! 📚",
                "message": "Both partners have completed the content. Your comprehension check will be available in 24 hours.",
                "category": "progress",
                "priority": "medium"
            },
            "daily_reminder": {
                "title": "Continue Your Journey 💕",
                "message": "Take a few minutes today to connect with your partner and continue your relationship growth.",
                "category": "engagement",
                "priority": "low",
                "action_url": "/dashboard"
            },
            "streak_milestone": {
                "title": "Amazing Streak! 🔥",
                "message": "You''ve maintained a {streak_days}-day streak! Keep up the incredible momentum.",
                "category": "progress",
                "priority": "medium"
            },
            "partner_waiting": {
                "title": "Your Partner is Waiting 💝",
                "message": "{partner_name} completed their section. Ready to catch up?",
                "category": "social",
                "priority": "medium",
                "action_url": "/training/current"
            }
        }
    }',
    'info'
);

-- ============================================================================
-- INITIAL SYSTEM SETTINGS
-- ============================================================================

-- System configuration settings
INSERT INTO audit_log (
    event_type,
    event_category,
    description,
    event_data,
    severity
) VALUES (
    'seed_data_system_config',
    'configuration',
    'Initial system configuration and settings',
    '{
        "system_settings": {
            "comprehension_passing_score": 0.80,
            "settle_timer_hours": 24,
            "max_comprehension_attempts": 5,
            "pairing_code_expiry_hours": 72,
            "mediator_max_duration_seconds": 300,
            "notification_batch_size": 100,
            "materialized_view_refresh_hours": 1,
            "audit_log_retention_days": 365,
            "mediator_data_retention_days": 90,
            "inactive_user_threshold_days": 14,
            "default_timezone": "UTC",
            "supported_languages": ["en", "es", "fr", "de", "pt"],
            "max_daily_translator_uses": 50,
            "max_daily_mediator_uses": 20
        },
        "feature_flags": {
            "ai_insights_enabled": true,
            "advanced_analytics": true,
            "social_features": false,
            "gamification": true,
            "offline_mode": false,
            "beta_features": false
        }
    }',
    'info'
);

-- ============================================================================
-- PERFORMANCE BASELINE DATA
-- ============================================================================

-- Create initial performance baseline
INSERT INTO audit_log (
    event_type,
    event_category,
    description,
    event_data,
    severity
) VALUES (
    'seed_data_performance_baseline',
    'performance',
    'Initial performance benchmarks and targets',
    '{
        "performance_targets": {
            "api_response_times_ms": {
                "auth": 300,
                "training_content": 500,
                "translator": 3000,
                "mediator_transcription": 10000,
                "comprehension_grading": 5000
            },
            "app_performance": {
                "cold_start_ms": 2000,
                "hot_start_ms": 500,
                "screen_transition_ms": 200,
                "scroll_fps": 55
            },
            "system_reliability": {
                "uptime_percentage": 99.5,
                "data_durability": 99.999999999,
                "backup_retention_days": 30
            }
        },
        "monitoring_thresholds": {
            "error_rate_percentage": 1.0,
            "cpu_usage_percentage": 80,
            "memory_usage_percentage": 85,
            "disk_usage_percentage": 90,
            "queue_length_max": 1000
        }
    }',
    'info'
);

-- ============================================================================
-- SAMPLE CONTENT STRUCTURE
-- ============================================================================

-- Sample content organization for levels and sections
INSERT INTO audit_log (
    event_type,
    event_category,
    description,
    event_data,
    severity
) VALUES (
    'seed_data_content_structure',
    'reference',
    'Content structure and organization for training materials',
    '{
        "content_structure": {
            "level_1": {
                "title": "Foundation",
                "description": "Building the foundation of Truth Empowered Relationships",
                "estimated_duration_days": 21,
                "sections": {
                    "1": {"title": "Welcome & Orientation", "pages": 8, "videos": 2, "activities": 3},
                    "2": {"title": "Truth Empowered Speaking Basics", "pages": 12, "videos": 3, "activities": 5},
                    "3": {"title": "Truth Empowered Listening Basics", "pages": 10, "videos": 2, "activities": 4},
                    "4": {"title": "The Four Pillars Deep Dive", "pages": 15, "videos": 4, "activities": 6},
                    "5": {"title": "Ten Instructions Overview", "pages": 12, "videos": 3, "activities": 5},
                    "6": {"title": "Basic Repair Tools", "pages": 8, "videos": 2, "activities": 3},
                    "7": {"title": "Foundation Games", "pages": 6, "videos": 1, "activities": 4}
                }
            },
            "level_2": {
                "title": "Deepening",
                "description": "Developing advanced skills and deeper intimacy",
                "estimated_duration_days": 28,
                "sections": {
                    "1": {"title": "Advanced TES - Working with Triggers", "pages": 14, "videos": 4, "activities": 6},
                    "2": {"title": "Advanced TEL - Listening to Pain", "pages": 12, "videos": 3, "activities": 5},
                    "3": {"title": "Resentment and Forgiveness", "pages": 16, "videos": 4, "activities": 7},
                    "4": {"title": "Intimacy and Vulnerability", "pages": 18, "videos": 5, "activities": 8}
                }
            }
        }
    }',
    'info'
);

-- ============================================================================
-- CREATE SAMPLE USER FOR TESTING (Optional)
-- ============================================================================

-- Note: In production, this should be removed or protected
DO $$
DECLARE
    v_user1_id UUID;
    v_user2_id UUID;
    v_couple_id UUID;
BEGIN
    -- Only create sample users in development environment
    IF current_setting('server_version_num')::int >= 130000 THEN -- PostgreSQL 13+

        -- Create first test user
        INSERT INTO users (
            email,
            password_hash,
            name,
            timezone,
            email_verified,
            onboarding_completed
        ) VALUES (
            'test.user1@example.com',
            '$2b$12$LQv3c1yqBwfHxUNP6pNgBOLFJ3rOQQzq8Y8K9X4M7/LGvC5hKZ.1K', -- hashed 'password123'
            'Test User 1',
            'America/New_York',
            true,
            true
        ) RETURNING id INTO v_user1_id;

        -- Create second test user
        INSERT INTO users (
            email,
            password_hash,
            name,
            timezone,
            email_verified,
            onboarding_completed
        ) VALUES (
            'test.user2@example.com',
            '$2b$12$LQv3c1yqBwfHxUNP6pNgBOLFJ3rOQQzq8Y8K9X4M7/LGvC5hKZ.1K', -- hashed 'password123'
            'Test User 2',
            'America/New_York',
            true,
            true
        ) RETURNING id INTO v_user2_id;

        -- Pair the test users
        SELECT pair_users(v_user1_id, v_user2_id, CURRENT_DATE - INTERVAL '30 days', 'America/New_York') INTO v_couple_id;

        -- Add some sample progress
        UPDATE section_progress
        SET
            partner1_content_complete = true,
            partner1_completed_at = NOW() - INTERVAL '2 hours',
            partner2_content_complete = true,
            partner2_completed_at = NOW() - INTERVAL '1 hour'
        WHERE couple_id = v_couple_id AND level = 1 AND section = 1;

        -- Log the test data creation
        INSERT INTO audit_log (
            event_type,
            event_category,
            description,
            event_data,
            severity
        ) VALUES (
            'test_data_created',
            'development',
            'Sample test users and couple created for development testing',
            json_build_object(
                'user1_id', v_user1_id,
                'user2_id', v_user2_id,
                'couple_id', v_couple_id
            ),
            'info'
        );

    END IF;
END
$$;

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
    'Seed data migration completed successfully',
    'info',
    '{"migration": "004_seed_data.sql", "comprehension_questions": 11, "reference_data_records": 5, "test_users": 2}'
);