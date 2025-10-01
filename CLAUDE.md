# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Truth Empowered Relationships (TERI) - Mobile Couples Therapy App**

This is a full-stack mobile application delivering the Truth Empowered Relationships framework through structured training, AI-powered repair tools (Translator & Mediator), relationship games, and synchronized learning with comprehension gates.

**Technical Stack:**
- **Backend**: Node.js + Express (microservices architecture)
- **Database**: Supabase (PostgreSQL with built-in auth, storage, real-time), Redis (cache), ChromaDB (vector search)
- **AI/ML**: Trained LLM for TES/TEL translation, Whisper ASR for transcription
- **Storage**: Supabase Storage (media files, backups)
- **Mobile**: iOS (Swift/SwiftUI) + Android (Kotlin) - planned
- **Infrastructure**: Supabase cloud, optional AWS for additional services

**Mission:** Follow [PRD.md](PRD.md) as the canonical product requirements document. All development must align with the PRD specifications.

## Essential Commands

### Development
```bash
# Start backend server
cd backend
npm run dev                # Development mode (port 3000)
npm start                  # Production mode

# Database operations (Supabase)
node scripts/setup-supabase.js  # Initialize Supabase schema (first time)
# Note: Use Supabase dashboard for migrations: https://app.supabase.com

# Testing
npm run test               # Run all tests
npm run test:watch         # Watch mode
npm run test:coverage      # Coverage report
```

### Docker & Infrastructure
```bash
# Local development environment
docker-compose up -d       # Start all services (PostgreSQL, Redis, ChromaDB)
docker-compose down        # Stop all services

# AWS deployment
cd infrastructure/terraform
terraform init
terraform plan -var="environment=dev"
terraform apply            # Deploy infrastructure
```

### Code Quality
```bash
cd backend
npm run lint               # ESLint check
npm run lint:fix           # Auto-fix linting issues
```

## Architecture & Code Organization

### Backend Structure (`backend/src/`)

**Core Application:**
- [app.js](backend/src/app.js) - Express application entry point with middleware, routes, graceful shutdown
- [config/](backend/src/config/) - Database, Redis, Supabase configuration
  - [supabase.js](backend/src/config/supabase.js) - **PRIMARY DATABASE** - Supabase client with RLS support
  - [database.js](backend/src/config/database.js) - PostgreSQL direct connection (fallback/admin tasks)
  - [redis.js](backend/src/config/redis.js:8) - Redis cache connection

**Data Layer:**
- [models/](backend/src/models/) - Database models using raw SQL queries
  - [User.js](backend/src/models/User.js) - User authentication and profiles
  - [Couple.js](backend/src/models/Couple.js) - Partner pairing and relationship data
  - [SectionProgress.js](backend/src/models/SectionProgress.js) - Training progression tracking
  - [GameSession.js](backend/src/models/GameSession.js) - Game activity tracking

**Business Logic:**
- [services/](backend/src/services/) - Core business logic services
  - [AuthService.js](backend/src/services/AuthService.js) - JWT authentication, bcrypt hashing
  - [PairingService.js](backend/src/services/PairingService.js) - Partner pairing via invite codes
  - [TrainingService.js](backend/src/services/TrainingService.js) - Content delivery, comprehension gates
  - [translatorService.js](backend/src/services/translatorService.js) - TES/TEL translation with LLM
  - [MediatorService.js](backend/src/services/MediatorService.js) - Audio transcription + analysis
  - [GameRecommendationEngine.js](backend/src/services/GameRecommendationEngine.js) - AI-powered game suggestions

**API Endpoints:**
- [routes/](backend/src/routes/) - RESTful API routes (all in `/api/v1` namespace)
  - [auth.js](backend/src/routes/auth.js) - POST /register, /login, /refresh, /logout
  - [pairing.js](backend/src/routes/pairing.js) - POST /generate-code, /join, DELETE /unpair
  - [training.js](backend/src/routes/training.js) - GET /current, /sections/:level/:section, POST /complete
  - [translator.js](backend/src/routes/translator.js) - POST /tes, /tel (Truth Empowered Speaking/Listening)
  - [mediator.js](backend/src/routes/mediator.js) - POST /upload, GET /:session_id (audio analysis)
  - [games.js](backend/src/routes/games.js) - GET /, /:game_id, POST /suggest, /:game_id/start
  - [journal.js](backend/src/routes/journal.js) - CRUD operations for user journal entries
  - [progress.js](backend/src/routes/progress.js) - GET stats, milestones, couple progress

**Middleware:**
- [middleware/](backend/src/middleware/)
  - [auth.js](backend/src/middleware/auth.js:12) - `authenticate()` - JWT token verification
  - [errorHandler.js](backend/src/middleware/errorHandler.js) - Global error handling
  - [rateLimiter.js](backend/src/middleware/rateLimiter.js) - Per-endpoint rate limiting
  - [validation.js](backend/src/middleware/validation.js) - Request validation with express-validator

**Utilities:**
- [utils/](backend/src/utils/)
  - [logger.js](backend/src/utils/logger.js) - Winston logger configuration
  - [database.js](backend/src/utils/database.js) - Database helper utilities
  - [redis.js](backend/src/utils/redis.js) - Redis cache utilities

### Key Architecture Patterns

**Supabase Integration:**
- **Two client types**:
  - `supabase` - Respects Row Level Security (RLS), used for user-facing operations
  - `supabaseAdmin` - Bypasses RLS, used for backend admin operations
- **Direct PostgreSQL access**: Available via `DATABASE_URL` for complex queries or migrations
- **Schema location**: [database/schema.sql](database/schema.sql) - Complete schema with all tables
- **Setup script**: [scripts/setup-supabase.js](backend/scripts/setup-supabase.js) - Initialize database schema

**Microservices Mindset:**
Each service (Auth, Training, Translator, Mediator, Games, Progress) is designed to be independently deployable. Services communicate via internal APIs and shared data layer.

**Gating & Progression:**
- Both partners must complete content → 24-hour settle timer starts
- After settle timer → comprehension check unlocked
- Both partners pass (≥80%) → next section unlocked
- Implemented in [TrainingService.js](backend/src/services/TrainingService.js) via `checkSectionProgression()`

**AI/ML Integration:**
- **Translator Service**: Uses trained LLM to convert reactive language to TES (Outer/Inner/Under/Ask) or TEL (listening framework)
- **Mediator Service**: Whisper ASR transcribes audio → LLM analyzes emotions → Game recommendation engine suggests contextual games
- **Game Recommendations**: Vector similarity search in ChromaDB to match user context with game themes

**Security:**
- JWT authentication with 1-hour access tokens, 30-day refresh tokens
- bcrypt password hashing (12 rounds)
- Rate limiting: 100 req/min global, stricter on auth endpoints
- CORS configured for mobile app origins
- Helmet.js for security headers
- Supabase RLS for row-level security (optional enhancement)

**Database Schema:**
Critical tables defined in [PRD.md](PRD.md) lines 100-274:
- `users` - Authentication, pairing codes, preferences
- `couples` - Partner relationships, current level/section
- `section_progress` - Both partners' completion status, settle timers, comprehension scores
- `translator_sessions` - TES/TEL outputs for feedback loop
- `mediator_sessions` - Audio transcripts, analysis, game suggestions
- `journal_entries` - Private user reflections with partner sharing toggle
- `game_sessions` - Game completion tracking

### Data Flow Examples

**Partner Pairing Flow:**
1. Partner 1: POST `/api/v1/pairing/generate-code` → Returns 8-char code
2. Partner 2: POST `/api/v1/pairing/join` with code → Creates `couples` record
3. Both now see shared progress via GET `/api/v1/training/current`

**Content Progression Flow:**
1. GET `/api/v1/training/sections/1/1` → Fetch Level 1 Section 1 content
2. User consumes content (book pages, videos, journal prompts)
3. POST `/api/v1/training/sections/1/1/complete` → Mark complete
4. System checks if both partners done → Start 24hr settle timer
5. After 24hrs → GET `/api/v1/training/sections/1/1/comprehension` → Quiz unlocked
6. POST `/api/v1/training/sections/1/1/comprehension` with answers → LLM grades
7. If both ≥80% → Next section unlocks, notifications sent

**Translator Usage:**
1. User types: "You never help with anything!"
2. POST `/api/v1/translator/tes` → LLM translates to TES format
3. Returns: { outer: "I did dishes alone this week", inner: "I feel exhausted", under: "I'm afraid I'm alone", ask: "Can we create a chore schedule?" }
4. User can provide feedback: POST `/api/v1/translator/:session_id/feedback`

## Environment & Configuration

**Required Environment Variables:**
```bash
# Supabase (PRIMARY DATABASE)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # For admin operations
DATABASE_URL=postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres  # Direct connection

# Redis Cache (optional)
REDIS_URL=redis://localhost:6379

# API Keys
JWT_SECRET=your-jwt-secret-min-32-chars
JWT_EXPIRES_IN=1h
REFRESH_TOKEN_SECRET=your-refresh-secret
REFRESH_TOKEN_EXPIRES_IN=30d
LLM_API_KEY=your-llm-provider-key
WHISPER_API_KEY=your-whisper-key

# Rate Limiting
RATE_LIMIT_WINDOW=15  # minutes
RATE_LIMIT_MAX=100    # requests

# Server
PORT=3000
NODE_ENV=development|staging|production
API_VERSION=v1
CORS_ORIGIN=http://localhost:3001,https://app.teri.com
```

**Copy template:** `cp .env.example .env` (if available)

## Testing Strategy

**Test Organization:**
- [backend/src/tests/](backend/src/tests/) - Test suites
- [backend/src/tests/integration/](backend/src/tests/integration/) - Full API flow tests

**Test Approach:**
- Unit tests for services, models, utilities
- Integration tests for API endpoints with database
- Load tests planned for translator/mediator (per PRD section 9.4)

**Running Tests:**
```bash
cd backend
npm run test              # All tests
npm run test:watch        # Watch mode for TDD
npm run test:coverage     # Generate coverage report (80% target)
```

## Critical Development Rules

1. **Follow PRD.md** - All features, data models, and APIs must match the PRD specification exactly
2. **Use Supabase First** - Primary database is Supabase; use `supabase` or `supabaseAdmin` clients from [config/supabase.js](backend/src/config/supabase.js)
3. **No Breaking Changes** - Partner progression data is sensitive; migrations must be backward compatible
4. **Security First** - Never log sensitive data (passwords, tokens, partner info)
5. **Error Handling** - Use structured error responses with codes (see [errorHandler.js](backend/src/middleware/errorHandler.js))
6. **Rate Limiting** - Respect rate limits to prevent abuse of AI/ML services
7. **Graceful Degradation** - Services should handle LLM/DB unavailability gracefully
8. **Privacy** - Partners cannot access each other's private journal entries or detailed scores

## Common Development Tasks

**Add a new API endpoint:**
1. Create route handler in `backend/src/routes/[feature].js`
2. Implement business logic in `backend/src/services/[Feature]Service.js`
3. Add validation middleware using express-validator
4. Add rate limiting if needed in `backend/src/middleware/rateLimiter.js`
5. Update this CLAUDE.md with endpoint reference
6. Add integration tests in `backend/src/tests/integration/`

**Add a new database table:**
1. Define schema following PRD.md structure
2. Add table definition to `database/schema.sql`
3. Run via Supabase SQL Editor OR use setup script: `node scripts/setup-supabase.js`
4. Add model in `backend/src/models/[Model].js` with CRUD methods using Supabase client
5. Update services to use the new model
6. Add indexes for query optimization

**Query with Supabase:**
```javascript
// Import clients
const { supabase, supabaseAdmin } = require('../config/supabase');

// User-facing query (respects RLS)
const { data, error } = await supabase
  .from('users')
  .select('id, name, email')
  .eq('id', userId)
  .single();

// Admin query (bypasses RLS)
const { data, error } = await supabaseAdmin
  .from('users')
  .select('*')
  .eq('email', email)
  .single();

// Complex query with joins
const { data, error } = await supabase
  .from('section_progress')
  .select(`
    *,
    couples:couple_id (
      partner1_id,
      partner2_id,
      current_level
    )
  `)
  .eq('couple_id', coupleId);
```

**Integrate a new AI model:**
1. Add service in `backend/src/services/[AI]Service.js`
2. Store API key in environment variables
3. Implement retry logic with exponential backoff
4. Add fallback responses for service unavailability
5. Track usage metrics for cost monitoring

## Mobile App Integration (Planned)

The mobile apps (iOS/Android) will consume the `/api/v1` REST API. Key integration points:
- JWT tokens stored securely in keychain/keystore
- Real-time progress updates via polling (WebSocket/SSE planned for v2)
- Offline content caching for training materials
- Audio recording → multipart/form-data upload to `/api/v1/mediator/upload`

## Performance Targets (PRD Section 8.1)

- API response time (p95): <500ms (training content), <3s (translator), <10s (mediator)
- Cold start: <2s mobile app
- Database queries: Use indexes, connection pooling
- Caching: Redis for session data, frequently accessed content

## Monitoring & Observability

**Logging:** Winston logger configured in [utils/logger.js](backend/src/utils/logger.js)
- Levels: error, warn, info, debug
- Structured JSON format for CloudWatch
- Never log sensitive data

**Metrics:** CloudWatch dashboards (see `monitoring/`)
- API latency (p50, p95, p99)
- Error rates (4xx, 5xx)
- LLM success rate
- Database query times

**Alerts:** SNS notifications for critical issues
- Error rate >1%
- API latency p95 >2s
- Database CPU >80%

## Working with Supabase

**Supabase Dashboard:** https://app.supabase.com
- **SQL Editor**: Run queries, view schema, create migrations
- **Table Editor**: Browse data, edit rows manually
- **Storage**: Manage media files (alternative to S3)
- **Auth**: View users, manage auth settings
- **Logs**: Real-time API logs and database queries

**Common Supabase Operations:**

**Initialize Database (First Time):**
```bash
node backend/scripts/setup-supabase.js
# This runs database/schema.sql against your Supabase instance
```

**Get Connection Info:**
```bash
# From Supabase Dashboard → Settings → Database
# Connection string format:
postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
```

**Run Migrations:**
1. Add SQL to Supabase Dashboard → SQL Editor
2. OR update `database/schema.sql` and re-run setup script
3. OR use direct PostgreSQL connection with migration tool

**Troubleshooting:**
```bash
# Test Supabase connection
curl https://[project-ref].supabase.co/rest/v1/ \
  -H "apikey: [anon-key]"

# Check if tables exist
node -e "
const { supabaseAdmin } = require('./backend/src/config/supabase');
(async () => {
  const { data, error } = await supabaseAdmin.from('users').select('count');
  console.log('Tables exist:', !error);
})();"
```

## Deployment

**Environments:**
- Development: Local Node.js + Supabase cloud
- Staging: Cloud hosting + Supabase (staging project)
- Production: Cloud hosting + Supabase (production project)

**CI/CD:** GitHub Actions (`.github/workflows/ci-cd.yml`)
1. Security scanning (Trivy, Checkov)
2. Unit + integration tests
3. Build and deploy backend
4. Run Supabase migrations
5. Post-deployment smoke tests

**Supabase Projects:**
- Create separate Supabase projects for dev/staging/production
- Use different `SUPABASE_URL` and keys for each environment
- Enable database backups in production (Settings → Database)

## Additional Resources

- **Product Requirements:** [PRD.md](PRD.md) (2,233 lines of detailed specifications)
- **Infrastructure:** [README.md](README.md) (infrastructure overview)
- **API Documentation:** OpenAPI specs (planned)
- **Architecture Decisions:** `/docs/adr/` (planned)

---

**Quick Reference:**
- Backend entry point: [backend/src/app.js](backend/src/app.js:118)
- Database connection: [backend/src/config/database.js](backend/src/config/database.js)
- Authentication: [backend/src/middleware/auth.js](backend/src/middleware/auth.js)
- Main services: [backend/src/services/](backend/src/services/)
- API routes: [backend/src/routes/](backend/src/routes/)
