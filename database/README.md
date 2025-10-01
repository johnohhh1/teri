# TERI Mobile App Database Schema

## Overview

This directory contains the complete PostgreSQL database schema for the Truth Empowered Relationships (TERI) mobile application. The schema is designed to support a comprehensive couples therapy platform with AI-powered tools, progress tracking, and vector-based semantic search.

## Database Architecture

### Core Features
- **User Management**: Secure authentication, partner pairing, preferences
- **Training System**: Level-based progression with gating mechanisms
- **AI Tools**: TES/TEL translation, mediator analysis with LLM integration
- **Content Management**: Journal entries, game sessions, progress tracking
- **Vector Search**: ChromaDB integration for semantic analysis
- **Analytics**: Comprehensive user engagement and performance metrics

### Key Statistics
- **16 core tables** with comprehensive relationships
- **80+ optimized indexes** for high performance
- **20+ stored functions** for business logic
- **5 views + 1 materialized view** for reporting
- **Vector database integration** with ChromaDB
- **Comprehensive audit logging** and security features

## File Structure

```
database/
├── README.md                          # This file
├── schema.sql                         # Legacy schema (use migrations instead)
├── deploy.sql                         # Master deployment script
├── maintenance.sql                    # Database maintenance procedures
└── migrations/
    ├── 001_initial_schema.sql         # Core tables and indexes
    ├── 002_triggers_and_functions.sql # Business logic and automation
    ├── 003_views_and_indexes.sql      # Reporting views and performance
    ├── 004_seed_data.sql              # Initial data and test users
    └── 005_vector_db_integration.sql  # ChromaDB integration
```

## Deployment

### Quick Start
```bash
# Deploy complete database
psql -d your_database_name -f deploy.sql

# Or run individual migrations
psql -d your_database_name -f migrations/001_initial_schema.sql
psql -d your_database_name -f migrations/002_triggers_and_functions.sql
# ... etc
```

### Prerequisites
- PostgreSQL 14+ (requires gen_random_uuid())
- Extensions: uuid-ossp, pgcrypto, pg_trgm
- Sufficient privileges for creating extensions and functions

### Environment Setup
```sql
-- Create database
CREATE DATABASE teri_app;

-- Create application user
CREATE USER teri_app_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE teri_app TO teri_app_user;

-- Connect and deploy
\c teri_app
\i deploy.sql
```

## Core Tables

### User Management
- **users**: User accounts, authentication, preferences
- **couples**: Partner relationships with canonical ordering
- **notifications**: System notifications and messaging

### Training System
- **section_progress**: Level/section progress with gating logic
- **comprehension_questions**: Quiz questions for section completion
- **comprehension_attempts**: User quiz attempts and scoring

### AI-Powered Tools
- **translator_sessions**: TES/TEL translation with LLM outputs
- **mediator_sessions**: Audio analysis with transcription and insights
- **vector_embeddings**: ChromaDB integration tracking
- **semantic_searches**: Vector search queries and results

### Content & Engagement
- **journal_entries**: Personal reflections with privacy controls
- **game_sessions**: Relationship games and activities
- **user_analytics**: Behavioral tracking and engagement metrics

### System
- **audit_log**: Comprehensive security and debugging trail
- **relationship_themes**: Predefined themes for content analysis

## Key Features

### Security & Privacy
- Encrypted passwords with bcrypt
- Partner data isolation (no cross-access)
- Automatic data retention policies
- Comprehensive audit logging
- Privacy controls for shared content

### Performance Optimization
- Strategic indexing for common query patterns
- Materialized views for heavy analytics
- Partitioned tables for large datasets
- Connection pooling recommendations
- Query performance monitoring

### AI Integration
- Vector embeddings tracking for ChromaDB
- Semantic search result caching
- Theme detection and categorization
- Sentiment analysis integration
- LLM response validation

### Business Logic
- 24-hour settle timer for section progression
- Partner synchronization requirements
- Automatic streak calculation
- Usage analytics and engagement scoring
- Notification scheduling and delivery

## Maintenance

### Daily Tasks (Automated)
```sql
SELECT daily_maintenance(); -- Run via cron at 2 AM
```
- Update user streaks
- Process scheduled notifications
- Clean expired pairing codes
- Auto-delete old mediator sessions
- Update statistics

### Weekly Tasks (Automated)
```sql
SELECT weekly_maintenance(); -- Run via cron on Sundays
```
- Refresh materialized views
- Reindex critical tables
- Vacuum and analyze
- Clean old audit logs

### Monitoring
```sql
-- Real-time system status
SELECT * FROM admin_system_monitor;

-- Comprehensive health check
SELECT database_health_check();

-- Data integrity verification
SELECT data_integrity_check();

-- Performance recommendations
SELECT performance_recommendations();
```

## Vector Database Integration

### ChromaDB Collections
- **relationship_content**: User-generated content embeddings
- **relationship_themes**: Predefined theme embeddings
- **game_suggestions**: Game matching embeddings
- **mediator_analysis**: Audio analysis embeddings

### Usage
```sql
-- Register new embedding
SELECT register_vector_embedding(
    'journal_entries',
    entry_id,
    'content',
    'relationship_content',
    chroma_doc_id,
    entry_text,
    'sentence-transformers/all-MiniLM-L6-v2',
    384
);

-- Log semantic search
SELECT log_semantic_search(
    user_id,
    couple_id,
    'game_suggestion',
    'We keep fighting about household chores',
    'game_suggestions',
    search_results_json
);
```

## API Integration Points

### Authentication
- User registration/login with secure password hashing
- Partner pairing via 8-character codes
- Session management with JWT integration

### Progress Tracking
- Section completion with partner synchronization
- Comprehension testing with 80% pass requirement
- Automatic next-section unlocking

### AI Tools
- TES/TEL translation request/response tracking
- Mediator audio upload and analysis results
- Game suggestion based on conversation context

### Analytics
- User engagement scoring
- Feature usage tracking
- Performance metrics collection

## Security Considerations

### Data Protection
- Partner data isolation enforced at database level
- Automatic audio deletion after 90 days
- Personal journal entries private by default
- Comprehensive audit trail for sensitive operations

### Performance
- Optimized for 10,000+ active couples
- Horizontal scaling through couple-based sharding
- Efficient indexing for real-time operations
- Background processing for heavy analytics

### Compliance
- GDPR-ready with data deletion capabilities
- Audit logging for compliance requirements
- Privacy controls for user data sharing
- Consent tracking for AI processing

## Development

### Testing
- Sample test users created in development mode
- Comprehensive data integrity checks
- Performance monitoring and alerting
- Load testing recommendations

### Migration Management
- Version-controlled schema changes
- Rollback procedures for failed migrations
- Checksum verification for migration integrity
- Automated deployment verification

## Support

For issues or questions:
1. Check the audit_log table for error details
2. Run database_health_check() for system status
3. Review performance_recommendations() for optimization
4. Consult the admin_system_monitor view for real-time metrics

## Version History

- **v1.0**: Initial schema with core functionality
- **v1.1**: Added vector database integration
- **v1.2**: Enhanced analytics and performance optimization
- **v1.3**: Comprehensive maintenance and monitoring procedures

---

**Note**: This schema is designed for production use with a focus on scalability, security, and maintainability. All migrations are thoroughly tested and include rollback procedures.