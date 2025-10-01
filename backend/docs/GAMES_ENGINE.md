# TERI Games Engine - Technical Implementation

## Overview

The TERI Games Engine is a comprehensive system for recommending, tracking, and analyzing relationship games based on the Truth Empowered Relationships framework. This implementation fulfills all requirements from PRD Section 4.

## Architecture

### Core Components

1. **EnhancedGameRecommendationEngine** - AI-powered game suggestion system
2. **GameSession Model** - Database model for tracking game sessions
3. **Games Routes** - REST API endpoints for game functionality
4. **ChromaDB Integration** - Vector database for semantic similarity

### Database Schema

#### Game Sessions Table
```sql
CREATE TABLE game_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    couple_id UUID NOT NULL REFERENCES couples(id),
    game_id VARCHAR(50) NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    duration_minutes INTEGER,
    feedback VARCHAR(20), -- 'helpful', 'neutral', 'not_helpful'
    notes TEXT,
    context JSONB -- Stores suggestion context
);
```

## Complete Game Roster

### Level 1 Games (Available Immediately)

#### 1. Internal Weather Report (IWR)
- **Duration**: 2-3 minutes
- **Themes**: communication, vulnerability
- **Objective**: Build emotional awareness and vulnerability
- **How to Play**: Share emotional state using weather metaphors
- **Safety**: Low-risk game, no contraindications

#### 2. Pause
- **Duration**: 1-2 minutes
- **Themes**: elevation, repair
- **Objective**: Stop escalating conversations and rewind
- **How to Play**: Either partner calls "Pause", owns their part, rewinds conversation
- **Safety**: Stop if elevation above 7/10

#### 3. Pillar Talk
- **Duration**: 5-10 minutes
- **Themes**: communication, foundation
- **Objective**: Examine the Four Pillars (Freeness, Wholesomeness, Non-Meanness, Fairness)
- **How to Play**: Pick one pillar, each partner shares how they honor/struggle with it
- **Safety**: Foundational conversation, very safe

### Level 2 Games (Unlock after Level 1)

#### 4. And What Else?
- **Duration**: 10-20 minutes
- **Themes**: resentment, vulnerability
- **Objective**: Clear built-up resentments to restore intimacy
- **How to Play**: One partner shares resentments, other only responds "And what else?"
- **Safety**: Can bring intense emotions, stop if elevation >8/10
- **Contraindications**: active_conflict, recent_betrayal

#### 5. Closeness Counter
- **Duration**: 30-60 minutes
- **Themes**: intimacy, disconnection
- **Objective**: Use physical space to mirror emotional connection
- **How to Play**: Partner shares while other moves closer/further based on felt connection
- **Safety**: Requires physical space, stop if either feels unsafe

### Level 3+ Games

#### 6. Switch
- **Duration**: 10-15 minutes
- **Themes**: empathy, communication
- **Objective**: Build empathy by defending partner's viewpoint
- **How to Play**: Argue from your partner's perspective until they feel understood
- **Safety**: Avoid highly triggering topics initially

#### 7. Bomb Squad
- **Duration**: Exactly 45 minutes
- **Themes**: repair, communication
- **Objective**: Defuse sensitive topics within time constraint
- **How to Play**: Address one "bomb" topic using Truth Empowered conversation
- **Safety**: No blame for "failure", some bombs take multiple sessions
- **Contraindications**: high_elevation

#### 8. Seven Nights of Truth
- **Duration**: 5 minutes daily for 7 days
- **Themes**: vulnerability, intimacy
- **Objective**: Build vulnerability muscle through progressive truth-sharing
- **How to Play**: Share one truth each night, building to deeper truths
- **Safety**: Can be emotionally intense by days 5-7

## Recommendation Algorithm

### Context-Aware Suggestions

The recommendation engine uses a sophisticated scoring system based on:

1. **Theme Matching (40% weight)** - Semantic similarity between context and game themes
2. **Time Fit (20% weight)** - How well game duration fits available time
3. **Level Appropriateness (15% weight)** - User's current level vs game requirements
4. **Freshness (15% weight)** - Prefer less recently played games
5. **User Preference (10% weight)** - Based on past feedback ratings

### Theme Extraction

Themes are extracted using two methods:

1. **Vector Similarity** - ChromaDB semantic search against relationship themes
2. **Keyword Matching** - Fallback using weighted keyword detection

#### Supported Themes
- resentment, disconnection, household_labor, appreciation
- communication, intimacy, trust, time, money, family
- boundaries, conflict, growth, stress, support

### Safety Checking

Games are safety-checked before suggestion:
- **Contraindications** - Some games not suitable for certain emotional states
- **Elevation Level** - High elevation (>7/10) limits game options
- **Time Constraints** - Insufficient time filters out longer games

## API Endpoints

### GET /api/v1/games
Returns all available games with analytics and availability status.

**Response:**
```json
{
  "available_games": [
    {
      "id": "iwr",
      "title": "Internal Weather Report",
      "description": "Share your emotional state like weather",
      "duration_minutes": {"min": 2, "max": 3},
      "level_required": 1,
      "themes": ["communication", "vulnerability"],
      "tags": ["quick", "daily"],
      "played_count": 15,
      "last_played_at": "2025-09-28T20:00:00Z",
      "avg_rating": 4.2,
      "available": true
    }
  ]
}
```

### GET /api/v1/games/:game_id
Returns detailed information about a specific game.

**Response:**
```json
{
  "id": "pause",
  "title": "Pause",
  "description": "Stop conversations from spiraling",
  "objective": "Recognize when conversation is going off track...",
  "how_to_play": "1. Either partner calls 'Pause'...",
  "safety_notes": "Stop if elevation above 7/10",
  "debrief_questions": ["What triggered the escalation?"],
  "duration_minutes": {"min": 1, "max": 2},
  "themes": ["elevation", "repair"],
  "tags": ["quick", "crisis"],
  "history": {
    "last_played": "2 days ago",
    "total_times": 8,
    "average_rating": 4.5
  }
}
```

### POST /api/v1/games/suggest
Generates context-aware game suggestions.

**Request:**
```json
{
  "context": {
    "transcript": "We keep fighting about household chores",
    "time_available_minutes": 20,
    "emotional_state": "frustrated",
    "elevation_level": 6
  }
}
```

**Response:**
```json
{
  "suggestions": [
    {
      "game_id": "and_what_else",
      "title": "And What Else?",
      "score": 0.92,
      "rationale": "Perfect for clearing resentments about household tasks",
      "duration": "10-20 min",
      "level_required": 2,
      "available": true,
      "themes": ["resentment", "vulnerability"],
      "safety_notes": "Can bring up intense emotions",
      "safety_check": {
        "safe": true,
        "warnings": []
      }
    }
  ]
}
```

### POST /api/v1/games/:game_id/start
Starts a new game session with safety checks.

**Request:**
```json
{
  "context": {
    "emotional_state": "calm"
  }
}
```

**Response:**
```json
{
  "session_id": "uuid",
  "started_at": "2025-09-30T20:00:00Z",
  "game": {
    "id": "iwr",
    "title": "Internal Weather Report",
    "duration_minutes": {"min": 2, "max": 3},
    "safety_notes": "None - this is a low-risk game"
  }
}
```

### POST /api/v1/games/:game_id/complete
Completes a game session and records analytics.

**Request:**
```json
{
  "session_id": "uuid",
  "duration_minutes": 3,
  "feedback": "helpful",
  "notes": "This helped us connect better"
}
```

### GET /api/v1/games/analytics
Returns comprehensive game analytics for the couple.

**Response:**
```json
{
  "total_sessions": 45,
  "unique_games_played": 6,
  "avg_session_duration": 8.5,
  "satisfaction_rate": 87.5,
  "last_game_played": "2025-09-29T19:30:00Z",
  "recent_sessions": [...],
  "favorite_games": [
    {
      "game_id": "iwr",
      "title": "Internal Weather Report",
      "play_count": 12
    }
  ]
}
```

## ChromaDB Integration

### Vector Collections

1. **teri_embeddings** - General TERI framework embeddings
2. **game_embeddings** - Game descriptions and metadata
3. **relationship_themes** - Relationship theme descriptions

### Initialization

The engine automatically initializes vector databases with:
- All 8 games with full metadata and embeddings
- 15+ relationship themes with keywords and descriptions
- Automatic re-initialization when game roster changes

### Theme Matching

Vector similarity search enables semantic matching:
```javascript
// "We always fight about money" -> ["money", "conflict", "stress"]
// "I feel disconnected" -> ["disconnection", "intimacy"]
// "You never help" -> ["resentment", "household_labor"]
```

## Analytics & Tracking

### Session Tracking
- Start/completion times
- Duration and feedback
- Context that led to game suggestion
- User notes and ratings

### Performance Metrics
- Game popularity and success rates
- Theme extraction accuracy
- Recommendation effectiveness
- User satisfaction trends

### Couple Analytics
- Play frequency and patterns
- Favorite games and themes
- Progress over time
- Satisfaction trends

## Error Handling & Safety

### Safety Features
1. **Contraindication Checking** - Games blocked for certain emotional states
2. **Level Gating** - Higher level games locked until progression
3. **Elevation Monitoring** - High elevation limits game options
4. **Time Validation** - Prevent starting games without sufficient time

### Fallback Mechanisms
1. **Keyword Fallback** - If vector search fails, use keyword matching
2. **Default Suggestions** - Safe fallback games if recommendation fails
3. **Graceful Degradation** - System continues operating if ChromaDB unavailable

### Error Codes
- `GAME_NOT_FOUND` - Invalid game ID
- `INSUFFICIENT_LEVEL` - User level too low for game
- `SAFETY_WARNING` - Game not safe for current context
- `NOT_PAIRED` - User must be paired to play games
- `SESSION_NOT_FOUND` - Invalid session ID
- `ALREADY_COMPLETED` - Session already marked complete

## Performance Considerations

### Database Optimization
- Indexes on couple_id, game_id, started_at for fast queries
- Composite indexes for analytics queries
- Efficient session cleanup for old data

### Caching Strategy
- Game definitions cached in memory
- Analytics cached with Redis for frequently accessed data
- Vector embeddings cached after first initialization

### Response Times
- Game list: <500ms
- Game suggestions: <3s (including AI processing)
- Session start/complete: <300ms
- Analytics: <1s

## Testing Strategy

### Unit Tests
- Game recommendation scoring algorithms
- Theme extraction accuracy
- Safety checking logic
- Analytics calculations

### Integration Tests
- Full API endpoint testing
- Database session tracking
- ChromaDB vector operations
- Error handling scenarios

### Performance Tests
- Concurrent game suggestions
- Large analytics queries
- Vector search performance
- Database session scaling

## Deployment

### Dependencies
- ChromaDB for vector similarity
- PostgreSQL for session storage
- Redis for caching (optional)
- Node.js 18+ with Express

### Environment Variables
```
CHROMA_DB_PATH=/path/to/vector/db
DATABASE_URL=postgresql://...
REDIS_URL=redis://... (optional)
```

### Initialization
1. Database migrations run automatically
2. ChromaDB collections created on first startup
3. Games and themes initialized in vector database
4. Health checks verify all systems operational

## Monitoring & Observability

### Key Metrics
- Game suggestion accuracy (user feedback)
- Session completion rates
- API response times
- Vector search performance
- Database query performance

### Logging
- Structured JSON logging with correlation IDs
- Game suggestions with reasoning traces
- Performance metrics and slow queries
- Error tracking with context

### Alerts
- High error rates on suggestions
- ChromaDB connection failures
- Slow database queries
- Unusual user behavior patterns

## Future Enhancements

### Planned Features
1. **Adaptive Learning** - Recommendation engine learns from user feedback
2. **Couple Matching** - Find games that work well for specific couple dynamics
3. **Progressive Difficulty** - Games adapt difficulty based on couple skill
4. **Multiplayer Games** - Games that can involve other couples
5. **Game Customization** - Allow couples to modify game rules

### Technical Improvements
1. **Real-time Suggestions** - WebSocket-based live recommendations
2. **Advanced Analytics** - Machine learning insights on game effectiveness
3. **Mobile Optimization** - Offline game session tracking
4. **Integration APIs** - Connect with external relationship tools

---

## Implementation Status ✅

All PRD requirements completed:

- ✅ Complete games database with all 8 games from PRD Section 4.2
- ✅ Game recommendation algorithm (PRD Section 4.3)
- ✅ Context-aware suggestion engine using ChromaDB
- ✅ Game session tracking and analytics
- ✅ IWR, Pause, Pillar Talk (Level 1)
- ✅ And What Else, Closeness Counter (Level 2)
- ✅ Switch, Bomb Squad, Seven Nights (Level 3)
- ✅ Vector similarity theme extraction
- ✅ Safety checking and contraindications
- ✅ Performance analytics and user preferences
- ✅ Comprehensive API with error handling
- ✅ Full test coverage and documentation

**Swarm Coordination**: games_engine_complete status stored in swarm namespace for coordination with other agents.