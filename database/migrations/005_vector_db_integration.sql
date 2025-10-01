-- ============================================================================
-- TERI Mobile App - Vector Database Integration Migration
-- Migration: 005_vector_db_integration.sql
-- Created: 2025-09-30
-- Description: Integration with ChromaDB and vector search capabilities
-- ============================================================================

-- ============================================================================
-- VECTOR STORAGE TRACKING TABLES
-- ============================================================================

-- Table to track embeddings stored in ChromaDB
CREATE TABLE vector_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Source information
    source_table VARCHAR(100) NOT NULL,
    source_record_id UUID NOT NULL,
    source_field VARCHAR(100), -- Which field was embedded (e.g., 'content', 'transcript')

    -- ChromaDB reference
    collection_name VARCHAR(100) NOT NULL,
    chroma_document_id VARCHAR(255) NOT NULL, -- ChromaDB's document ID

    -- Content metadata
    content_text TEXT NOT NULL, -- Original text that was embedded
    content_hash VARCHAR(64) NOT NULL, -- SHA-256 hash for deduplication
    content_language VARCHAR(10) DEFAULT 'en',
    content_type VARCHAR(50), -- 'journal_entry', 'translator_input', 'mediator_transcript', etc.

    -- Embedding metadata
    embedding_model VARCHAR(100) NOT NULL, -- Model used for embedding
    embedding_dimension INTEGER NOT NULL,
    embedding_created_at TIMESTAMP DEFAULT NOW(),

    -- Semantic categorization
    themes JSONB DEFAULT '[]', -- Array of detected themes
    emotions JSONB DEFAULT '[]', -- Array of detected emotions
    sentiment_score DECIMAL(3,2), -- -1.00 to 1.00

    -- Usage tracking
    search_count INTEGER DEFAULT 0,
    last_searched_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Constraints
    UNIQUE(source_table, source_record_id, source_field),
    UNIQUE(collection_name, chroma_document_id),
    CHECK (content_language IN ('en', 'es', 'fr', 'de', 'pt')),
    CHECK (embedding_dimension > 0),
    CHECK (sentiment_score IS NULL OR (sentiment_score >= -1 AND sentiment_score <= 1)),
    CHECK (search_count >= 0)
);

-- Indexes for vector embeddings
CREATE INDEX idx_vector_embeddings_source ON vector_embeddings(source_table, source_record_id);
CREATE INDEX idx_vector_embeddings_collection ON vector_embeddings(collection_name);
CREATE INDEX idx_vector_embeddings_content_type ON vector_embeddings(content_type);
CREATE INDEX idx_vector_embeddings_hash ON vector_embeddings(content_hash);
CREATE INDEX idx_vector_embeddings_themes ON vector_embeddings USING GIN(themes);
CREATE INDEX idx_vector_embeddings_emotions ON vector_embeddings USING GIN(emotions);
CREATE INDEX idx_vector_embeddings_created_at ON vector_embeddings(created_at);

-- ============================================================================
-- SEMANTIC SEARCH RESULTS TRACKING
-- ============================================================================

-- Table to track semantic search queries and results
CREATE TABLE semantic_searches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Search context
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    couple_id UUID REFERENCES couples(id) ON DELETE SET NULL,
    search_type VARCHAR(50) NOT NULL, -- 'game_suggestion', 'theme_analysis', 'content_similarity'

    -- Query information
    query_text TEXT NOT NULL,
    query_context JSONB DEFAULT '{}', -- Additional context for the search

    -- ChromaDB search parameters
    collection_name VARCHAR(100) NOT NULL,
    search_embedding_model VARCHAR(100) NOT NULL,
    max_results INTEGER DEFAULT 10,
    similarity_threshold DECIMAL(3,2) DEFAULT 0.7,

    -- Results
    results_count INTEGER NOT NULL,
    results_data JSONB NOT NULL, -- Array of results with similarities and metadata
    top_similarity_score DECIMAL(3,2),

    -- Performance metrics
    search_duration_ms INTEGER,
    embedding_time_ms INTEGER,
    vector_search_time_ms INTEGER,

    -- Follow-up actions
    action_taken VARCHAR(100), -- What was done with the search results
    result_used BOOLEAN DEFAULT false, -- Whether any result was actually used
    user_feedback VARCHAR(20), -- helpful, neutral, not_helpful

    created_at TIMESTAMP DEFAULT NOW(),

    CHECK (search_type IN ('game_suggestion', 'theme_analysis', 'content_similarity', 'mediator_analysis', 'journal_insights')),
    CHECK (max_results > 0 AND max_results <= 100),
    CHECK (similarity_threshold >= 0 AND similarity_threshold <= 1),
    CHECK (results_count >= 0),
    CHECK (top_similarity_score IS NULL OR (top_similarity_score >= 0 AND top_similarity_score <= 1)),
    CHECK (search_duration_ms IS NULL OR search_duration_ms >= 0),
    CHECK (user_feedback IS NULL OR user_feedback IN ('helpful', 'neutral', 'not_helpful'))
);

-- Indexes for semantic searches
CREATE INDEX idx_semantic_searches_user ON semantic_searches(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_semantic_searches_couple ON semantic_searches(couple_id) WHERE couple_id IS NOT NULL;
CREATE INDEX idx_semantic_searches_type ON semantic_searches(search_type);
CREATE INDEX idx_semantic_searches_created_at ON semantic_searches(created_at);
CREATE INDEX idx_semantic_searches_feedback ON semantic_searches(user_feedback) WHERE user_feedback IS NOT NULL;

-- ============================================================================
-- RELATIONSHIP THEMES CATALOG
-- ============================================================================

-- Predefined catalog of relationship themes for consistent categorization
CREATE TABLE relationship_themes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Theme identification
    theme_name VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(50) NOT NULL, -- communication, conflict, intimacy, etc.
    subcategory VARCHAR(50),

    -- Description and examples
    description TEXT NOT NULL,
    keywords JSONB DEFAULT '[]', -- Array of related keywords
    example_phrases JSONB DEFAULT '[]', -- Example phrases that indicate this theme

    -- Vector embedding for theme matching
    has_embedding BOOLEAN DEFAULT false,
    embedding_model VARCHAR(100),
    chroma_document_id VARCHAR(255),

    -- Usage statistics
    detection_count INTEGER DEFAULT 0,
    last_detected_at TIMESTAMP,

    -- Metadata
    severity_level VARCHAR(20), -- low, medium, high, critical
    recommended_games JSONB DEFAULT '[]', -- Array of game IDs that address this theme
    professional_help_indicator BOOLEAN DEFAULT false, -- Whether this theme suggests need for professional help

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    CHECK (category IN ('communication', 'conflict', 'intimacy', 'trust', 'boundaries', 'goals', 'family', 'finance', 'personal_growth', 'other')),
    CHECK (severity_level IS NULL OR severity_level IN ('low', 'medium', 'high', 'critical')),
    CHECK (detection_count >= 0)
);

-- Indexes for relationship themes
CREATE INDEX idx_relationship_themes_category ON relationship_themes(category);
CREATE INDEX idx_relationship_themes_severity ON relationship_themes(severity_level) WHERE severity_level IS NOT NULL;
CREATE INDEX idx_relationship_themes_keywords ON relationship_themes USING GIN(keywords);
CREATE UNIQUE INDEX idx_relationship_themes_chroma ON relationship_themes(chroma_document_id) WHERE chroma_document_id IS NOT NULL;

-- ============================================================================
-- FUNCTIONS FOR VECTOR OPERATIONS
-- ============================================================================

-- Function to register an embedding in the tracking system
CREATE OR REPLACE FUNCTION register_vector_embedding(
    p_source_table VARCHAR(100),
    p_source_record_id UUID,
    p_source_field VARCHAR(100),
    p_collection_name VARCHAR(100),
    p_chroma_document_id VARCHAR(255),
    p_content_text TEXT,
    p_embedding_model VARCHAR(100),
    p_embedding_dimension INTEGER,
    p_content_type VARCHAR(50) DEFAULT NULL,
    p_themes JSONB DEFAULT '[]',
    p_emotions JSONB DEFAULT '[]',
    p_sentiment_score DECIMAL(3,2) DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_embedding_id UUID;
    v_content_hash VARCHAR(64);
BEGIN
    -- Calculate content hash
    v_content_hash := encode(sha256(p_content_text::bytea), 'hex');

    -- Insert or update embedding record
    INSERT INTO vector_embeddings (
        source_table,
        source_record_id,
        source_field,
        collection_name,
        chroma_document_id,
        content_text,
        content_hash,
        content_type,
        embedding_model,
        embedding_dimension,
        themes,
        emotions,
        sentiment_score
    ) VALUES (
        p_source_table,
        p_source_record_id,
        p_source_field,
        p_collection_name,
        p_chroma_document_id,
        p_content_text,
        v_content_hash,
        p_content_type,
        p_embedding_model,
        p_embedding_dimension,
        p_themes,
        p_emotions,
        p_sentiment_score
    )
    ON CONFLICT (source_table, source_record_id, source_field)
    DO UPDATE SET
        collection_name = EXCLUDED.collection_name,
        chroma_document_id = EXCLUDED.chroma_document_id,
        content_text = EXCLUDED.content_text,
        content_hash = EXCLUDED.content_hash,
        content_type = EXCLUDED.content_type,
        embedding_model = EXCLUDED.embedding_model,
        embedding_dimension = EXCLUDED.embedding_dimension,
        themes = EXCLUDED.themes,
        emotions = EXCLUDED.emotions,
        sentiment_score = EXCLUDED.sentiment_score,
        updated_at = NOW()
    RETURNING id INTO v_embedding_id;

    RETURN v_embedding_id;
END;
$$ LANGUAGE plpgsql;

-- Function to log a semantic search
CREATE OR REPLACE FUNCTION log_semantic_search(
    p_user_id UUID,
    p_couple_id UUID,
    p_search_type VARCHAR(50),
    p_query_text TEXT,
    p_collection_name VARCHAR(100),
    p_results_data JSONB,
    p_search_duration_ms INTEGER DEFAULT NULL,
    p_query_context JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    v_search_id UUID;
    v_results_count INTEGER;
    v_top_similarity DECIMAL(3,2);
BEGIN
    -- Extract results metadata
    v_results_count := jsonb_array_length(p_results_data);

    -- Get top similarity score if results exist
    IF v_results_count > 0 THEN
        v_top_similarity := (p_results_data->0->>'similarity')::DECIMAL(3,2);
    END IF;

    -- Insert search record
    INSERT INTO semantic_searches (
        user_id,
        couple_id,
        search_type,
        query_text,
        query_context,
        collection_name,
        search_embedding_model,
        results_count,
        results_data,
        top_similarity_score,
        search_duration_ms
    ) VALUES (
        p_user_id,
        p_couple_id,
        p_search_type,
        p_query_text,
        p_query_context,
        p_collection_name,
        'sentence-transformers/all-MiniLM-L6-v2', -- Default model
        v_results_count,
        p_results_data,
        v_top_similarity,
        p_search_duration_ms
    ) RETURNING id INTO v_search_id;

    RETURN v_search_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update search count for used embeddings
CREATE OR REPLACE FUNCTION track_embedding_usage(
    p_chroma_document_ids TEXT[]
) RETURNS INTEGER AS $$
DECLARE
    v_updated_count INTEGER;
BEGIN
    WITH updated AS (
        UPDATE vector_embeddings
        SET
            search_count = search_count + 1,
            last_searched_at = NOW()
        WHERE chroma_document_id = ANY(p_chroma_document_ids)
        RETURNING id
    )
    SELECT COUNT(*) INTO v_updated_count FROM updated;

    RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql;

-- Function to detect themes in text content
CREATE OR REPLACE FUNCTION detect_themes_in_content(
    p_content TEXT,
    p_similarity_threshold DECIMAL(3,2) DEFAULT 0.7
) RETURNS JSONB AS $$
DECLARE
    v_detected_themes JSONB := '[]';
    v_theme relationship_themes%ROWTYPE;
BEGIN
    -- This is a simplified keyword-based theme detection
    -- In practice, this would integrate with ChromaDB for semantic similarity

    FOR v_theme IN
        SELECT * FROM relationship_themes
        WHERE keywords IS NOT NULL
    LOOP
        -- Check if any keywords match the content
        IF EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(v_theme.keywords) AS keyword
            WHERE LOWER(p_content) LIKE '%' || LOWER(keyword) || '%'
        ) THEN
            v_detected_themes := v_detected_themes || jsonb_build_object(
                'theme_id', v_theme.id,
                'theme_name', v_theme.theme_name,
                'category', v_theme.category,
                'confidence', 0.8 -- Simplified confidence score
            );

            -- Update theme detection count
            UPDATE relationship_themes
            SET
                detection_count = detection_count + 1,
                last_detected_at = NOW()
            WHERE id = v_theme.id;
        END IF;
    END LOOP;

    RETURN v_detected_themes;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS FOR AUTOMATIC EMBEDDING CREATION
-- ============================================================================

-- Function to handle automatic embedding creation for new content
CREATE OR REPLACE FUNCTION trigger_embedding_creation()
RETURNS TRIGGER AS $$
BEGIN
    -- This would typically queue the content for embedding creation
    -- The actual embedding creation would be handled by the application layer

    INSERT INTO audit_log (
        user_id,
        event_type,
        event_category,
        description,
        event_data,
        severity
    ) VALUES (
        COALESCE(NEW.user_id, (SELECT partner1_id FROM couples WHERE id = NEW.couple_id LIMIT 1)),
        'embedding_queued',
        'vector_db',
        format('Content queued for embedding creation in table %s', TG_TABLE_NAME),
        json_build_object(
            'table', TG_TABLE_NAME,
            'record_id', NEW.id,
            'content_length', CASE
                WHEN TG_TABLE_NAME = 'journal_entries' THEN LENGTH(NEW.content)
                WHEN TG_TABLE_NAME = 'translator_sessions' THEN LENGTH(NEW.input_text)
                WHEN TG_TABLE_NAME = 'mediator_sessions' THEN LENGTH(NEW.transcript)
                ELSE 0
            END
        ),
        'debug'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply embedding triggers to relevant tables
CREATE TRIGGER queue_journal_embedding
    AFTER INSERT ON journal_entries
    FOR EACH ROW
    WHEN (LENGTH(NEW.content) > 50) -- Only for substantial content
    EXECUTE FUNCTION trigger_embedding_creation();

CREATE TRIGGER queue_translator_embedding
    AFTER INSERT ON translator_sessions
    FOR EACH ROW
    WHEN (LENGTH(NEW.input_text) > 20)
    EXECUTE FUNCTION trigger_embedding_creation();

CREATE TRIGGER queue_mediator_embedding
    AFTER INSERT ON mediator_sessions
    FOR EACH ROW
    WHEN (LENGTH(NEW.transcript) > 50)
    EXECUTE FUNCTION trigger_embedding_creation();

-- ============================================================================
-- POPULATE INITIAL RELATIONSHIP THEMES
-- ============================================================================

-- Insert common relationship themes
INSERT INTO relationship_themes (theme_name, category, subcategory, description, keywords, recommended_games, severity_level) VALUES
('Communication Issues', 'communication', 'general', 'General communication problems and misunderstandings', '["communication", "talking", "listening", "understand", "hear"]', '["iwr", "pause", "pillar_talk"]', 'medium'),

('Household Tasks', 'conflict', 'responsibilities', 'Disagreements about household responsibilities and chores', '["chores", "dishes", "cleaning", "housework", "tasks", "help", "lazy"]', '["and_what_else", "switch", "bomb_squad"]', 'low'),

('Feeling Unheard', 'communication', 'validation', 'One partner feels their voice is not being heard or validated', '["listen", "hear", "ignore", "dismiss", "voice", "understand"]', '["iwr", "switch"]', 'medium'),

('Financial Stress', 'conflict', 'money', 'Money-related tensions and disagreements', '["money", "spend", "budget", "expensive", "financial", "bills", "debt"]', '["bomb_squad", "switch"]', 'high'),

('Intimacy Concerns', 'intimacy', 'connection', 'Issues related to physical or emotional intimacy', '["intimacy", "close", "distance", "connection", "touch", "sex"]', '["closeness_counter", "seven_nights"]', 'medium'),

('Trust Issues', 'trust', 'security', 'Concerns about honesty, reliability, or faithfulness', '["trust", "lie", "honest", "secret", "faithful", "betray"]', '["seven_nights", "bomb_squad"]', 'high'),

('Time Together', 'intimacy', 'quality_time', 'Concerns about not spending enough quality time together', '["time", "together", "busy", "schedule", "priority", "attention"]', '["iwr", "closeness_counter"]', 'medium'),

('Past Resentments', 'conflict', 'history', 'Unresolved issues from the past affecting the present', '["always", "never", "past", "again", "history", "resentment"]', '["and_what_else", "bomb_squad"]', 'high'),

('Decision Making', 'conflict', 'power', 'Disagreements about how decisions are made in the relationship', '["decide", "choice", "control", "power", "agree", "opinion"]', '["switch", "bomb_squad"]', 'medium'),

('Family Issues', 'family', 'external', 'Stress from extended family or in-laws', '["family", "mother", "father", "parents", "in-laws", "relatives"]', '["switch", "bomb_squad"]', 'medium'),

('Appreciation', 'intimacy', 'recognition', 'Feeling unappreciated or taken for granted', '["appreciate", "thank", "notice", "effort", "acknowledge", "grateful"]', '["iwr", "pillar_talk"]', 'low'),

('Personal Space', 'boundaries', 'autonomy', 'Need for individual space and independence', '["space", "alone", "independent", "freedom", "personal", "individual"]', '["pillar_talk", "iwr"]', 'low'),

('Future Plans', 'goals', 'direction', 'Disagreements about future goals and direction', '["future", "plans", "goals", "dreams", "direction", "vision"]', '["switch", "bomb_squad"]', 'medium'),

('Jealousy', 'trust', 'insecurity', 'Jealousy and insecurity issues', '["jealous", "insecure", "worry", "suspicious", "doubt", "other"]', '["seven_nights", "closeness_counter"]', 'high'),

('Work Stress', 'external', 'career', 'Work-related stress affecting the relationship', '["work", "job", "career", "boss", "stress", "tired", "busy"]', '["iwr", "pause"]', 'medium');

-- ============================================================================
-- VECTOR DATABASE CONFIGURATION
-- ============================================================================

-- Store ChromaDB configuration and connection info
INSERT INTO audit_log (
    event_type,
    event_category,
    description,
    event_data,
    severity
) VALUES (
    'vector_db_config',
    'configuration',
    'ChromaDB configuration and collection setup',
    '{
        "chroma_config": {
            "host": "localhost",
            "port": 8000,
            "api_version": "v1",
            "default_embedding_model": "sentence-transformers/all-MiniLM-L6-v2",
            "embedding_dimension": 384
        },
        "collections": {
            "relationship_content": {
                "description": "User-generated content like journal entries and translator inputs",
                "metadata_fields": ["user_id", "couple_id", "content_type", "theme", "emotion"],
                "distance_metric": "cosine"
            },
            "relationship_themes": {
                "description": "Predefined relationship themes and patterns",
                "metadata_fields": ["category", "severity", "keywords"],
                "distance_metric": "cosine"
            },
            "game_suggestions": {
                "description": "Game descriptions and contexts for semantic matching",
                "metadata_fields": ["game_id", "level_required", "themes", "duration"],
                "distance_metric": "cosine"
            },
            "mediator_analysis": {
                "description": "Mediator transcripts and analysis for pattern detection",
                "metadata_fields": ["couple_id", "speaker", "emotion_level", "conflict_themes"],
                "distance_metric": "cosine"
            }
        },
        "search_parameters": {
            "default_max_results": 10,
            "similarity_threshold": 0.7,
            "timeout_seconds": 30
        }
    }',
    'info'
);

-- ============================================================================
-- PERFORMANCE MONITORING FOR VECTOR OPERATIONS
-- ============================================================================

-- Create materialized view for vector operation analytics
CREATE MATERIALIZED VIEW mv_vector_analytics AS
SELECT
    DATE_TRUNC('day', created_at) as date,
    search_type,
    collection_name,
    COUNT(*) as search_count,
    AVG(search_duration_ms) as avg_duration_ms,
    AVG(results_count) as avg_results_count,
    AVG(top_similarity_score) as avg_top_similarity,
    COUNT(CASE WHEN result_used THEN 1 END)::DECIMAL / COUNT(*) as usage_rate,
    COUNT(CASE WHEN user_feedback = 'helpful' THEN 1 END)::DECIMAL /
        NULLIF(COUNT(CASE WHEN user_feedback IS NOT NULL THEN 1 END), 0) as helpfulness_rate
FROM semantic_searches
WHERE created_at > NOW() - INTERVAL '90 days'
GROUP BY DATE_TRUNC('day', created_at), search_type, collection_name
ORDER BY date DESC, search_count DESC;

CREATE UNIQUE INDEX idx_mv_vector_analytics_unique
    ON mv_vector_analytics(date, search_type, collection_name);

-- ============================================================================
-- CLEANUP AND MAINTENANCE FUNCTIONS
-- ============================================================================

-- Function to clean up old vector search logs
CREATE OR REPLACE FUNCTION cleanup_vector_search_logs()
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    WITH deleted AS (
        DELETE FROM semantic_searches
        WHERE created_at < NOW() - INTERVAL '90 days'
        RETURNING id
    )
    SELECT COUNT(*) INTO v_deleted_count FROM deleted;

    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh vector analytics
CREATE OR REPLACE FUNCTION refresh_vector_analytics()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_vector_analytics;

    INSERT INTO audit_log (
        event_type,
        event_category,
        description,
        severity
    ) VALUES (
        'vector_analytics_refreshed',
        'maintenance',
        'Vector database analytics materialized view refreshed',
        'info'
    );
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
    'Vector database integration migration completed successfully',
    'info',
    '{"migration": "005_vector_db_integration.sql", "tables_created": 3, "themes_added": 15, "functions_created": 8}'
);