# Truth Empowered Relationships - Mobile App PRD

**Version:** 3.0  
**Document Type:** Technical Product Requirements  
**Last Updated:** September 30, 2025  
**Status:** Build-Ready

---

## 1. Product Overview

### 1.1 What We're Building

A mobile-first couples therapy app that delivers the Truth Empowered Relationships framework through:
- **Structured training** via digital workbook with 7 levels
- **AI-powered repair tools** (Translator & Mediator) using trained LLM + vector DB
- **Relationship games** with contextual suggestions
- **Synchronized learning** with comprehension gates

### 1.2 Technical Stack Assumptions

**Already Built:**
- Trained LLM model for TES/TEL translation
- Vector database for semantic search
- Content library (workbook pages, videos)

**To Build:**
- Mobile apps (iOS/Android native)
- Backend API services
- Partner pairing system
- Progress tracking system
- Game recommendation engine

### 1.3 Core User Flow

```
1. Download app → Create individual account
2. Pair with partner via invite code
3. Begin Level 1, Section 1 training
4. Both complete content → 24hr settle timer
5. Both pass comprehension (≥80%) → Next section unlocks
6. During conflicts: Use Translator/Mediator tools
7. Receive contextual game suggestions
8. Progress through 7 levels over ~90 days
```

---

## 2. Technical Architecture

### 2.1 System Components

```
┌─────────────────────────────────────────────┐
│           Mobile Apps (Native)              │
│     iOS (Swift/SwiftUI) + Android (Kotlin)  │
└────────────────┬────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────┐
│            API Gateway (REST)               │
│         JWT Authentication + Rate Limiting   │
└────────────────┬────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────┐
│          Microservices Layer                │
├─────────────────────────────────────────────┤
│  • Auth Service                             │
│  • Training Service                         │
│  • Translator Service (→ LLM)              │
│  • Mediator Service (→ ASR + LLM)          │
│  • Games Service                            │
│  • Progress Service                         │
│  • Notification Service                     │
└────────────────┬────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────┐
│            Data Layer                       │
├─────────────────────────────────────────────┤
│  • PostgreSQL (primary)                     │
│  • Redis (sessions/cache)                   │
│  • Vector DB (embeddings)                   │
│  • S3 (media storage)                       │
└─────────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────┐
│            AI/ML Services                   │
├─────────────────────────────────────────────┤
│  • Trained LLM (TES/TEL)                   │
│  • ASR (Whisper for transcription)         │
│  • Vector Search (semantic similarity)      │
└─────────────────────────────────────────────┘
```

### 2.2 Data Models

#### Users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    partner_id UUID REFERENCES users(id),
    pairing_code VARCHAR(8) UNIQUE,
    pairing_code_expires TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    last_active TIMESTAMP DEFAULT NOW(),
    preferences JSONB DEFAULT '{
        "notifications": true,
        "reminder_time": "20:00",
        "theme": "auto",
        "text_size": "medium"
    }'
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_pairing ON users(pairing_code) WHERE pairing_code IS NOT NULL;
```

#### Couples Table
```sql
CREATE TABLE couples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner1_id UUID NOT NULL REFERENCES users(id),
    partner2_id UUID NOT NULL REFERENCES users(id),
    current_level INTEGER DEFAULT 1,
    current_section INTEGER DEFAULT 1,
    relationship_start_date DATE,
    paired_at TIMESTAMP DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'active', -- active, paused, ended
    UNIQUE(partner1_id, partner2_id),
    CHECK (partner1_id < partner2_id) -- Enforce canonical ordering
);

CREATE INDEX idx_couples_partners ON couples(partner1_id, partner2_id);
```

#### Section Progress Table
```sql
CREATE TABLE section_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    couple_id UUID NOT NULL REFERENCES couples(id),
    level INTEGER NOT NULL,
    section INTEGER NOT NULL,
    
    -- Partner 1 progress
    partner1_content_complete BOOLEAN DEFAULT false,
    partner1_completed_at TIMESTAMP,
    partner1_comprehension_score DECIMAL(3,2),
    partner1_comprehension_attempts INTEGER DEFAULT 0,
    
    -- Partner 2 progress
    partner2_content_complete BOOLEAN DEFAULT false,
    partner2_completed_at TIMESTAMP,
    partner2_comprehension_score DECIMAL(3,2),
    partner2_comprehension_attempts INTEGER DEFAULT 0,
    
    -- Shared gating
    settle_timer_start TIMESTAMP,
    comprehension_unlocked_at TIMESTAMP,
    section_unlocked BOOLEAN DEFAULT false,
    section_unlocked_at TIMESTAMP,
    
    UNIQUE(couple_id, level, section)
);

CREATE INDEX idx_progress_couple ON section_progress(couple_id);
CREATE INDEX idx_progress_level_section ON section_progress(level, section);
```

#### Translator Sessions Table
```sql
CREATE TABLE translator_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    couple_id UUID NOT NULL REFERENCES couples(id),
    mode VARCHAR(10) NOT NULL, -- 'TES' or 'TEL'
    
    -- Input
    input_text TEXT NOT NULL,
    
    -- Output (stored as JSONB for flexibility)
    output_data JSONB NOT NULL,
    -- Example TES output:
    -- {
    --   "outer": "...",
    --   "inner": "...",
    --   "under": "...",
    --   "why": "...",
    --   "ask": "...",
    --   "checks": {...}
    -- }
    
    processing_time_ms INTEGER,
    feedback VARCHAR(20), -- helpful, neutral, not_helpful
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_translator_user ON translator_sessions(user_id);
CREATE INDEX idx_translator_couple ON translator_sessions(couple_id);
```

#### Mediator Sessions Table
```sql
CREATE TABLE mediator_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    couple_id UUID NOT NULL REFERENCES couples(id),
    
    -- Audio
    audio_url TEXT NOT NULL, -- S3 path
    audio_duration_seconds INTEGER NOT NULL,
    
    -- Transcription
    transcript TEXT NOT NULL,
    speaker VARCHAR(10) NOT NULL, -- 'partner1' or 'partner2'
    
    -- Analysis (JSONB)
    tel_summary JSONB NOT NULL,
    -- {
    --   "outer": "...",
    --   "undercurrents": "...",
    --   "what_matters": "..."
    -- }
    
    depth_questions JSONB NOT NULL, -- ["question1", "question2", ...]
    suggested_games JSONB NOT NULL, -- [{game_id, score, rationale}, ...]
    
    processing_time_ms INTEGER,
    feedback VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_mediator_couple ON mediator_sessions(couple_id);
```

#### Journal Entries Table
```sql
CREATE TABLE journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    level INTEGER,
    section INTEGER,
    prompt TEXT,
    content TEXT NOT NULL,
    shared_with_partner BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_journal_user ON journal_entries(user_id);
CREATE INDEX idx_journal_section ON journal_entries(level, section);
```

#### Game Sessions Table
```sql
CREATE TABLE game_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    couple_id UUID NOT NULL REFERENCES couples(id),
    game_id VARCHAR(50) NOT NULL,
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    duration_minutes INTEGER,
    feedback VARCHAR(20), -- helpful, neutral, not_helpful
    notes TEXT
);

CREATE INDEX idx_games_couple ON game_sessions(couple_id);
CREATE INDEX idx_games_game_id ON game_sessions(game_id);
```

### 2.3 API Endpoints

#### Authentication
```
POST   /api/v1/auth/register
Body: { email, password, name }
Response: { user_id, token }

POST   /api/v1/auth/login
Body: { email, password }
Response: { user_id, token, partner_id? }

POST   /api/v1/auth/refresh
Headers: { Authorization: Bearer <token> }
Response: { token }

POST   /api/v1/auth/logout
Headers: { Authorization: Bearer <token> }
Response: { success: true }
```

#### Pairing
```
POST   /api/v1/pairing/generate-code
Headers: { Authorization: Bearer <token> }
Response: { pairing_code: "ABC12345", expires_at: "..." }

POST   /api/v1/pairing/join
Headers: { Authorization: Bearer <token> }
Body: { pairing_code: "ABC12345" }
Response: { couple_id, partner: {...} }

DELETE /api/v1/pairing/unpair
Headers: { Authorization: Bearer <token> }
Response: { success: true }
```

#### Training
```
GET    /api/v1/training/current
Headers: { Authorization: Bearer <token> }
Response: {
  couple_id,
  current_level,
  current_section,
  available_sections: [
    {
      level: 1,
      section: 1,
      title: "Welcome & Orientation",
      status: "complete|in_progress|locked",
      my_progress: {
        content_complete: true,
        comprehension_score: 0.85
      },
      partner_progress: {
        content_complete: true,
        comprehension_score: 0.90
      },
      settle_timer_remaining_seconds: 3600,
      comprehension_available: true
    },
    ...
  ]
}

GET    /api/v1/training/sections/:level/:section
Headers: { Authorization: Bearer <token> }
Response: {
  level,
  section,
  title,
  content: {
    book_pages: [1, 2, 3, 4, 5],
    videos: [{id, title, url, duration_seconds}],
    journal_prompt: "What brought you here?",
    activities: [...]
  },
  my_status: "not_started|in_progress|complete"
}

POST   /api/v1/training/sections/:level/:section/complete
Headers: { Authorization: Bearer <token> }
Response: {
  success: true,
  settle_timer_starts_at: "2025-09-30T20:00:00Z",
  comprehension_available_at: "2025-10-01T20:00:00Z"
}

GET    /api/v1/training/sections/:level/:section/comprehension
Headers: { Authorization: Bearer <token> }
Response: {
  questions: [
    {
      id: "q1",
      type: "multiple_choice",
      question: "Which is an Outer?",
      options: ["A", "B", "C", "D"],
      correct_answer_hint: null // Not provided until submission
    },
    {
      id: "q2",
      type: "translation",
      question: "Translate: 'You're so selfish!'",
      expected_elements: ["outer", "inner", "under", "ask"]
    }
  ]
}

POST   /api/v1/training/sections/:level/:section/comprehension
Headers: { Authorization: Bearer <token> }
Body: {
  answers: {
    "q1": "B",
    "q2": {
      "outer": "You made plans without asking me",
      "inner": "I feel hurt and unimportant",
      "under": "I'm afraid I don't matter to you",
      "ask": "Can we check with each other before making plans?"
    }
  }
}
Response: {
  score: 0.85,
  passed: true,
  feedback: [
    {
      question_id: "q1",
      correct: true
    },
    {
      question_id: "q2",
      score: 0.7,
      feedback: "Good Outer and Inner. The Under could be more vulnerable..."
    }
  ],
  next_section_unlocked: true
}
```

#### Translator
```
POST   /api/v1/translator/tes
Headers: { Authorization: Bearer <token> }
Body: {
  input_text: "You never help with anything!"
}
Response: {
  session_id: "uuid",
  translation: {
    outer: "I did dishes and laundry alone this week",
    inner: "I feel exhausted and overwhelmed",
    under: "I'm afraid I'm alone in this relationship",
    why: "I need partnership to feel loved",
    ask: "Can we create a chore schedule together?",
    checks: {
      non_meanness: true,
      pillars_aligned: true,
      instructions_followed: [1, 5, 8]
    }
  },
  alternates: ["...", "..."], // 2 other ways to say it
  processing_time_ms: 2847
}

POST   /api/v1/translator/tel
Headers: { Authorization: Bearer <token> }
Body: {
  input_text: "I felt so alone at the party last night..."
}
Response: {
  session_id: "uuid",
  listening: {
    outer: "Partner felt alone at party",
    undercurrents: "Feeling invisible and unimportant",
    what_matters: "Being seen and included as a couple"
  },
  depth_questions: [
    "What specifically helped you feel included before?",
    "What would full support look like to you?"
  ],
  processing_time_ms: 3124
}

POST   /api/v1/translator/:session_id/feedback
Headers: { Authorization: Bearer <token> }
Body: { feedback: "helpful" }
Response: { success: true }
```

#### Mediator
```
POST   /api/v1/mediator/upload
Headers: { Authorization: Bearer <token>, Content-Type: audio/m4a }
Body: <binary audio data>
Query: ?speaker=partner1&duration_seconds=45
Response: {
  session_id: "uuid",
  status: "processing",
  estimated_completion_seconds: 10
}

GET    /api/v1/mediator/:session_id
Headers: { Authorization: Bearer <token> }
Response: {
  session_id: "uuid",
  status: "complete",
  transcript: "You never help with anything! I'm so tired...",
  speaker: "partner1",
  tel_summary: {
    outer: "Partner expressed frustration about household tasks",
    undercurrents: "Feeling unsupported and alone",
    what_matters: "Partnership and shared effort"
  },
  depth_questions: [
    "What would true partnership look like in daily tasks?",
    "What support do you most need?"
  ],
  suggested_games: [
    {
      game_id: "and_what_else",
      score: 0.89,
      rationale: "Clear resentments about household tasks",
      duration: "10-20 min",
      level_required: 2
    }
  ],
  processing_time_ms: 8934
}

POST   /api/v1/mediator/:session_id/feedback
Headers: { Authorization: Bearer <token> }
Body: { feedback: "helpful" }
Response: { success: true }
```

#### Games
```
GET    /api/v1/games
Headers: { Authorization: Bearer <token> }
Response: {
  available_games: [
    {
      id: "iwr",
      title: "Internal Weather Report",
      description: "Share your emotional state in 2-3 minutes",
      duration_minutes: {min: 2, max: 3},
      level_required: 1,
      themes: ["communication"],
      tags: ["quick", "daily"],
      played_count: 15,
      last_played_at: "2025-09-28T..."
    },
    ...
  ]
}

GET    /api/v1/games/:game_id
Headers: { Authorization: Bearer <token> }
Response: {
  id: "and_what_else",
  title: "And What Else?",
  description: "Release layers of resentment",
  duration_minutes: {min: 10, max: 20},
  level_required: 2,
  objective: "Clear unspoken resentments to restore intimacy",
  how_to_play: "1. Set timer for 10 minutes...",
  safety_notes: "Stop if elevation gets above 7/10...",
  debrief: "After both partners share, discuss what came up..."
}

POST   /api/v1/games/suggest
Headers: { Authorization: Bearer <token> }
Body: {
  context?: {
    transcript: "We keep fighting about the same thing",
    time_available_minutes: 15,
    emotional_state: "frustrated"
  }
}
Response: {
  suggestions: [
    {
      game_id: "bomb_squad",
      score: 0.92,
      rationale: "Perfect for recurring conflicts. 45 minutes to defuse one issue.",
      level_required: 3,
      available: false, // User is only Level 1
      unlock_at_level: 3
    },
    {
      game_id: "pause",
      score: 0.87,
      rationale: "Quick reset for frustration. 1-2 minutes.",
      level_required: 1,
      available: true
    }
  ]
}

POST   /api/v1/games/:game_id/start
Headers: { Authorization: Bearer <token> }
Response: {
  session_id: "uuid",
  started_at: "2025-09-30T20:00:00Z"
}

POST   /api/v1/games/:game_id/complete
Headers: { Authorization: Bearer <token> }
Body: {
  session_id: "uuid",
  duration_minutes: 12,
  feedback: "helpful",
  notes: "Discovered resentment about household tasks"
}
Response: { success: true }
```

#### Journal
```
GET    /api/v1/journal
Headers: { Authorization: Bearer <token> }
Query: ?level=1&section=5
Response: {
  entries: [
    {
      id: "uuid",
      level: 1,
      section: 5,
      prompt: "What's your deepest relationship fear?",
      content: "I'm afraid...",
      shared_with_partner: false,
      created_at: "...",
      updated_at: "..."
    },
    ...
  ]
}

POST   /api/v1/journal
Headers: { Authorization: Bearer <token> }
Body: {
  level: 1,
  section: 5,
  prompt: "What's your deepest relationship fear?",
  content: "I'm afraid that if they see the real me..."
}
Response: {
  entry_id: "uuid",
  created_at: "..."
}

PUT    /api/v1/journal/:entry_id
Headers: { Authorization: Bearer <token> }
Body: { content: "Updated content..." }
Response: { success: true, updated_at: "..." }

POST   /api/v1/journal/:entry_id/share
Headers: { Authorization: Bearer <token> }
Body: { share: true }
Response: { success: true, shared_with_partner: true }

DELETE /api/v1/journal/:entry_id
Headers: { Authorization: Bearer <token> }
Response: { success: true }
```

---

## 3. Mobile App Specifications

### 3.1 Screen Inventory

#### Authentication Flow
1. **Splash Screen** → Show logo, check auth token
2. **Welcome Screen** → "Transform Your Relationship" + Sign Up / Log In buttons
3. **Sign Up Screen** → Email, password, name fields
4. **Log In Screen** → Email, password fields
5. **Forgot Password Screen** → Email field

#### Pairing Flow
6. **Pairing Intro** → "Connect with Your Partner"
7. **Generate Code Screen** → Display 8-char code, share options
8. **Enter Code Screen** → Input field for partner's code
9. **Pairing Success** → Celebration animation, "You're Paired!"

#### Main App (After Pairing)
10. **Dashboard (Home)** → 4×2 grid of feature tiles
11. **Training Screen** → Level/section list with progress
12. **Section Detail Screen** → Content viewer (book pages, videos, journal)
13. **Comprehension Screen** → Quiz interface
14. **Results Screen** → Score, feedback, unlock status
15. **Pillars Reference Screen** → Four Pillars + Ten Instructions
16. **Translator Screen (TES)** → Input field, translate button, results cards
17. **Translator Screen (TEL)** → Input field, translate button, results cards
18. **Mediator Screen** → Record button, processing state, results
19. **Games Library Screen** → Filterable list of games
20. **Game Detail Screen** → How to play, timer, debrief
21. **Progress Screen** → Individual + couple stats, streaks
22. **Journal Screen** → List of entries, add/edit
23. **Settings Screen** → Account, notifications, preferences

### 3.2 Dashboard (Home Screen)

**Layout: 4×2 Grid**

```
┌─────────────────────────────────────────┐
│  TER                          [Profile] │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────────┐  ┌──────────────┐   │
│  │   TRAINING   │  │   PILLARS    │   │
│  │   Sky Blue   │  │    Taupe     │   │
│  │              │  │              │   │
│  │  Level 1     │  │  Quick Ref   │   │
│  │  Section 3   │  │              │   │
│  └──────────────┘  └──────────────┘   │
│                                         │
│  ┌──────────────┐  ┌──────────────┐   │
│  │  TRANSLATOR  │  │   MEDIATOR   │   │
│  │     Gold     │  │    Olive     │   │
│  │              │  │              │   │
│  │  Translate   │  │  Record &    │   │
│  │  Your Words  │  │  Analyze     │   │
│  └──────────────┘  └──────────────┘   │
│                                         │
│  ┌──────────────┐  ┌──────────────┐   │
│  │   PROGRESS   │  │    GAMES     │   │
│  │  Dark Brown  │  │     Pink     │   │
│  │              │  │              │   │
│  │  🔥 7 day    │  │  8 Games     │   │
│  │  streak      │  │  Available   │   │
│  └──────────────┘  └──────────────┘   │
│                                         │
│  ┌──────────────┐  ┌──────────────┐   │
│  │   JOURNAL    │  │   SETTINGS   │   │
│  │   Lavender   │  │     Gray     │   │
│  │              │  │              │   │
│  │  12 entries  │  │              │   │
│  └──────────────┘  └──────────────┘   │
└─────────────────────────────────────────┘
```

**Tile Specifications:**
- Size: Equal width/height, 8px gap between tiles
- Border Radius: 12px
- Shadow: 0 2px 8px rgba(0,0,0,0.08)
- Tap: Scale to 0.98 with haptic feedback
- Badge: Red dot for new content/notifications

### 3.3 Training Flow

#### Section Detail Screen

**Components:**
1. **Header**
   - Back button
   - Section title: "Level 1, Section 3: Truth Empowered Speaking"
   - Progress indicator: Partner 1 (you) vs Partner 2

2. **Content Tabs**
   - Book (default)
   - Videos
   - Journal
   - Activities

3. **Book Tab**
   - Page viewer with pinch-to-zoom
   - Page counter: "Page 16 of 25"
   - Swipe left/right for navigation
   - Toggle: Image View ↔ Text View (accessibility)

4. **Videos Tab**
   - List of videos with thumbnails
   - Duration badges
   - Checkmarks for completed videos
   - Tap to play (full-screen player)

5. **Journal Tab**
   - Prompt displayed prominently
   - Text input (grows with content)
   - "Save Draft" and "Mark Complete" buttons
   - Privacy toggle: "Share with partner" (off by default)

6. **Activities Tab**
   - Checklist of activities
   - Instructions for each
   - Mark complete button

7. **Footer**
   - "Mark Section Complete" button (disabled until all content consumed)
   - Shows partner status: "Waiting for partner to finish" or "Partner completed ✓"

#### Comprehension Screen

**Flow:**
1. **Unlock Check**
   - If settle timer not elapsed: Show countdown
   - If partner not complete: Show "Waiting for [partner name]"
   - If both ready: Show "Start Comprehension Check" button

2. **Quiz Interface**
   - Question counter: "Question 3 of 5"
   - Progress bar
   - Question text
   - Input type varies:
     - Multiple choice: Radio buttons
     - Translation: Multi-field form (Outer, Inner, Under, Ask)
     - Scenario: Text area

3. **Submit & Results**
   - "Submit Answers" button
   - Processing spinner
   - Results screen:
     - Score: Large percentage (e.g., "85%")
     - Pass/Fail indicator
     - Per-question feedback
     - If passed: "Next Section Unlocked! 🎉"
     - If failed: "Review and try again in 24 hours"

### 3.4 Translator Interface

#### TES Mode

```
┌─────────────────────────────────────────┐
│  ← Translator                     [TEL] │
├─────────────────────────────────────────┤
│                                         │
│  Truth Empowered Speaking               │
│  Transform reactive language            │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ What do you want to say?        │   │
│  │                                 │   │
│  │ [Text input area]               │   │
│  │                                 │   │
│  │                                 │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [Translate]                            │
│                                         │
│  ─── Results (after translation) ───    │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 📝 OUTER (Observable)           │   │
│  │ "I did dishes and laundry       │   │
│  │  alone this week"               │   │
│  │                          [Copy] │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 💭 INNER (My Experience)        │   │
│  │ "I feel exhausted and           │   │
│  │  overwhelmed"                   │   │
│  │                          [Copy] │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 💔 UNDER (What I Fear)          │   │
│  │ "I'm afraid I'm alone in this   │   │
│  │  relationship"                  │   │
│  │                          [Copy] │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 🎯 ASK (Clear Request)          │   │
│  │ "Can we create a chore schedule │   │
│  │  together?"                     │   │
│  │                          [Copy] │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [Try Another Way] [Helpful? 👍 👎]    │
└─────────────────────────────────────────┘
```

**Interaction Details:**
- Input: Auto-expands up to 5 lines, then scrolls
- Translate button: Shows spinner during processing (~3s)
- Result cards: Swipeable carousel, color-coded
- Copy buttons: Copy to clipboard with haptic + toast
- "Try Another Way": Generates alternate translation
- Feedback: Inline thumbs up/down

#### TEL Mode

Similar layout but:
- Input prompt: "What did your partner say?"
- Result cards:
  - 📝 OUTER (What They Said)
  - 💭 UNDERCURRENTS (What They Might Feel)
  - ❤️ WHAT MATTERS (Their Values)
  - ❓ QUESTIONS TO ASK (Deepen Understanding)

### 3.5 Mediator Interface

```
┌─────────────────────────────────────────┐
│  ← Mediator                             │
├─────────────────────────────────────────┤
│                                         │
│  Record a Moment                        │
│  Hold to record (max 60 seconds)        │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │                                 │   │
│  │         ┌─────────┐             │   │
│  │         │         │             │   │
│  │         │   🎤    │             │   │
│  │         │         │             │   │
│  │         └─────────┘             │   │
│  │                                 │   │
│  │     [Hold to Record]            │   │
│  │                                 │   │
│  │       ⏱️ 0:00 / 1:00            │   │
│  │                                 │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Speaker: [You ▼] [Partner]            │
│                                         │
│  ℹ️ By recording, both partners         │
│     consent to AI processing            │
│                                         │
│  ─── After Recording ───                │
│                                         │
│  🎵 Audio clip (0:45)                   │
│  [▶️ Play] [🗑️ Delete] [✓ Analyze]     │
│                                         │
│  ─── Processing (10-15s) ───            │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  🔄 Analyzing your moment...    │   │
│  │                                 │   │
│  │  • Transcribing audio           │   │
│  │  • Understanding emotions       │   │
│  │  • Suggesting next steps        │   │
│  │                                 │   │
│  │  [Progress spinner]             │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ─── Results ───                        │
│                                         │
│  [Same card layout as TEL mode]         │
│  + Transcript section at top            │
│  + Suggested games at bottom            │
└─────────────────────────────────────────┘
```

**Recording Interaction:**
1. Press and hold record button
2. Haptic feedback on press, hold vibration every 10s
3. Visual waveform animation while recording
4. Timer counts up: "0:45 / 1:00"
5. Release to stop, auto-stops at 60s
6. Minimum 5 seconds to prevent accidental taps

**Error States:**
- Microphone permission denied: Show settings prompt
- Upload failed: Retry button
- Processing timeout: "Taking longer than usual..." + retry
- No speech detected: "No speech detected in audio"

### 3.6 Games Interface

#### Games Library Screen

```
┌─────────────────────────────────────────┐
│  ← Games                          [?]   │
├─────────────────────────────────────────┤
│                                         │
│  Filters: [All] [Quick] [Deep] [Daily]  │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Internal Weather Report         │   │
│  │ 2-3 minutes • Level 1           │   │
│  │                                 │   │
│  │ Share your emotional state      │   │
│  │                                 │   │
│  │ Played 15 times • Last: 2 days  │   │
│  │                                 │   │
│  │              [Play] [Details >] │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Pause                           │   │
│  │ 1-2 minutes • Level 1           │   │
│  │                                 │   │
│  │ Stop conversations from         │   │
│  │ spiraling                       │   │
│  │                                 │   │
│  │ Played 8 times • Last: 1 week   │   │
│  │                                 │   │
│  │              [Play] [Details >] │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ And What Else? 🔒               │   │
│  │ 10-20 minutes • Level 2         │   │
│  │                                 │   │
│  │ Release unspoken resentment     │   │
│  │                                 │   │
│  │ Unlocks at Level 2              │   │
│  │                                 │   │
│  │                   [Locked 🔒]   │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

**Card States:**
- **Available**: Full color, "Play" button enabled
- **Locked**: Grayed out, lock icon, "Unlocks at Level X"
- **Suggested**: Yellow border, "⭐ Suggested for you"

#### Game Detail Screen

```
┌─────────────────────────────────────────┐
│  ← Pause Game                           │
├─────────────────────────────────────────┤
│                                         │
│  Pause                                  │
│  Stop conversations from spiraling      │
│                                         │
│  ⏱️ 1-2 minutes                         │
│  📊 Level 1                             │
│  🏷️ Quick, Crisis, Verbal              │
│                                         │
│  ─── Objective ───                      │
│                                         │
│  Recognize when a conversation is       │
│  going off track, take accountability,  │
│  and rewind to a better moment.         │
│                                         │
│  ─── How to Play ───                    │
│                                         │
│  1. Either partner calls "Pause"        │
│  2. Caller has 15 seconds to identify   │
│     where things went wrong             │
│  3. Must own their part: "I got         │
│     defensive when..."                  │
│  4. If no ownership in 15 seconds,      │
│     conversation resumes                │
│  5. Other partner shares their          │
│     responsibility                      │
│  6. Both say "Rewind" to restart        │
│  7. Say "Play!" together to continue    │
│                                         │
│  ⚠️ Safety Notes                        │
│                                         │
│  Stop if elevation gets above 7/10.     │
│  Take a longer break if needed.         │
│                                         │
│  [Start Game]                           │
│                                         │
│  ─── History ───                        │
│                                         │
│  Last played: 2 days ago                │
│  Total times: 8                         │
│  Average rating: 4.5/5 ⭐              │
└─────────────────────────────────────────┘
```

**During Game:**
- Timer displayed prominently
- "Mark Complete" button appears
- Debrief questions appear after completion

### 3.7 Progress Screen

```
┌─────────────────────────────────────────┐
│  ← Progress                             │
├─────────────────────────────────────────┤
│                                         │
│  Your Journey Together                  │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ 🔥 Current Streak: 7 days       │   │
│  │ 🏆 Longest Streak: 14 days      │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ─── Level Progress ───                 │
│                                         │
│  Level 1: Foundation                    │
│  ████████████░░░░ 75%                   │
│  9 of 12 sections complete              │
│                                         │
│  Level 2: Deepening                     │
│  ░░░░░░░░░░░░░░░░ 0%                    │
│  🔒 Unlocks after Level 1               │
│                                         │
│  ─── Tool Usage ───                     │
│                                         │
│  Translator: 23 uses                    │
│  Mediator: 8 uses                       │
│  Games played: 15                       │
│                                         │
│  ─── Individual Stats ───               │
│                                         │
│  You                    Partner         │
│  ────────────────────────────────       │
│  Sections: 9/12         Sections: 9/12  │
│  Avg Score: 87%         Avg Score: 91%  │
│  Journal: 12 entries    Journal: 10     │
│                                         │
│  ─── Milestones ───                     │
│                                         │
│  ✅ First Section Complete              │
│  ✅ First Game Played                   │
│  ✅ 7-Day Streak                        │
│  ⬜ Level 1 Complete                    │
│  ⬜ 30-Day Streak                       │
└─────────────────────────────────────────┘
```

---

## 4. Game Specifications

### 4.1 Game Metadata Structure

**All games stored in database with:**
```json
{
  "id": "iwr",
  "title": "Internal Weather Report",
  "description": "Share your emotional state like weather",
  "objective": "Build emotional awareness and vulnerability",
  "duration_minutes": {"min": 2, "max": 3},
  "level_required": 1,
  "themes": ["communication", "vulnerability"],
  "tags": ["quick", "daily", "verbal"],
  "contraindications": [],
  "how_to_play": "1. One partner shares...",
  "safety_notes": "None - this is a low-risk game",
  "debrief_questions": [
    "What weather pattern do you notice most often?",
    "What helps your weather shift?"
  ]
}
```

### 4.2 Complete Game Roster

#### Level 1 Games (Available Immediately)

**1. Internal Weather Report (IWR)**
```json
{
  "id": "iwr",
  "title": "Internal Weather Report",
  "duration_minutes": {"min": 2, "max": 3},
  "level_required": 1,
  "themes": ["communication"],
  "tags": ["quick", "daily"],
  "how_to_play": "One partner shares their emotional state using weather metaphors. 'I'm sunny with clouds of anxiety' or 'I'm stormy with lightning bolts of anger.' No response needed, just witness.",
  "debrief_questions": [
    "What weather pattern shows up most often?",
    "What helps shift your weather?"
  ]
}
```

**2. Pause**
```json
{
  "id": "pause",
  "title": "Pause",
  "duration_minutes": {"min": 1, "max": 2},
  "level_required": 1,
  "themes": ["elevation", "repair"],
  "tags": ["quick", "crisis"],
  "how_to_play": "1. Either partner calls 'Pause'\n2. Caller has 15 seconds to identify where things went wrong\n3. Must own their part: 'I got defensive when...'\n4. If no ownership in 15 seconds, conversation resumes\n5. Other partner shares their responsibility\n6. Both say 'Rewind' to restart before the misstep\n7. Say 'Play!' together to continue",
  "safety_notes": "Stop if elevation above 7/10"
}
```

**3. Pillar Talk**
```json
{
  "id": "pillar_talk",
  "title": "Pillar Talk",
  "duration_minutes": {"min": 5, "max": 10},
  "level_required": 1,
  "themes": ["communication", "foundation"],
  "tags": ["quick", "verbal"],
  "how_to_play": "1. Pick one of the Four Pillars (Freeness, Wholesomeness, Non-Meanness, Fairness)\n2. Each partner shares: How am I honoring this pillar? Where am I struggling?\n3. Listen without fixing or defending\n4. End with appreciation for honesty",
  "debrief_questions": [
    "Which pillar needs most attention right now?",
    "How can we support each other with this?"
  ]
}
```

#### Level 2 Games (Unlock after Level 1)

**4. And What Else?**
```json
{
  "id": "and_what_else",
  "title": "And What Else?",
  "duration_minutes": {"min": 10, "max": 20},
  "level_required": 2,
  "themes": ["resentment", "vulnerability"],
  "tags": ["deep"],
  "how_to_play": "1. Set timer for 10 minutes per person\n2. Partner 1 shares: 'I resent you for...'\n3. Partner 2 only responds: 'And what else?'\n4. Continue for 10 minutes or until complete\n5. No defending, explaining, or reacting\n6. Resentments may transform to appreciations\n7. Switch roles\n8. Discuss afterward",
  "safety_notes": "This game can bring up intense emotions. Stop if either partner exceeds 8/10 elevation.",
  "contraindications": ["active_conflict", "recent_betrayal"]
}
```

**5. Closeness Counter**
```json
{
  "id": "closeness_counter",
  "title": "Closeness Counter",
  "duration_minutes": {"min": 30, "max": 60},
  "level_required": 2,
  "themes": ["intimacy", "disconnection"],
  "tags": ["deep", "physical"],
  "how_to_play": "1. Clear room, create space to move\n2. Partner 1 shares stream of consciousness for 2 minutes\n3. Partner 2 moves closer or further based on connection felt\n4. Can move multiple times while listening\n5. After share, Partner 2 explains movements\n6. Partner 1 asks clarifying questions\n7. Switch roles\n8. Continue alternating\n9. Max closeness = embracing, Max distance = opposite walls",
  "safety_notes": "Requires physical space. Stop if either feels unsafe."
}
```

#### Level 3+ Games

**6. Switch**
```json
{
  "id": "switch",
  "title": "Switch",
  "duration_minutes": {"min": 10, "max": 15},
  "level_required": 3,
  "themes": ["empathy", "communication"],
  "tags": ["deep", "verbal"],
  "how_to_play": "1. Pick topic with different views\n2. Partner 1 shares perspective fully\n3. Partner 2 listens, asks clarifying questions only\n4. Partner 2 expresses Partner 1's view as their own\n5. Partner 1 gives thumbs up or asks for adjustment\n6. Repeat until Partner 1 feels fully understood\n7. Switch roles",
  "debrief_questions": [
    "What was hardest about arguing their position?",
    "What did you learn about their perspective?"
  ]
}
```

**7. Bomb Squad**
```json
{
  "id": "bomb_squad",
  "title": "Bomb Squad",
  "duration_minutes": {"min": 45, "max": 45},
  "level_required": 3,
  "themes": ["repair", "communication"],
  "tags": ["deep"],
  "how_to_play": "1. Identify the 'bomb' (sensitive topic)\n2. Set timer for EXACTLY 45 minutes\n3. Have Truth Empowered conversation to lower charge\n4. Use 'protein words' (essential) not 'empty carbs' (filler)\n5. If elevated, use Pause before continuing\n6. If harmony reached before timer - celebrate!\n7. If timer runs out - acknowledge progress, schedule round 2",
  "safety_notes": "No blame for 'failure' - some bombs take multiple sessions",
  "contraindications": ["high_elevation"]
}
```

**8. Seven Nights of Truth**
```json
{
  "id": "seven_nights",
  "title": "Seven Nights of Truth",
  "duration_minutes": {"min": 5, "max": 5},
  "level_required": 3,
  "themes": ["vulnerability", "intimacy"],
  "tags": ["daily", "deep"],
  "how_to_play": "1. Each night for 7 nights\n2. Share one truth with partner\n3. Start small, build to deeper truths\n4. No response required, just witness\n5. Builds the 'noticing muscle'",
  "debrief_questions": [
    "What was hardest to share?",
    "What changed after sharing?"
  ]
}
```

### 4.3 Game Suggestion Algorithm

**Input Context Schema:**
```typescript
interface SuggestionContext {
  transcript?: string;
  time_available_minutes?: number;
  emotional_state?: "calm" | "frustrated" | "sad" | "angry" | "elevated";
  recent_games: string[]; // Last 7 days
  relationship_themes?: string[]; // Extracted from translator/mediator history
}
```

**Algorithm (Pseudocode):**
```typescript
function suggestGames(context: SuggestionContext, userLevel: number): GameSuggestion[] {
  // 1. Extract themes from transcript (if provided)
  const themes = extractThemes(context.transcript);
  // Uses vector DB for semantic similarity:
  // "we keep fighting about chores" → ["resentment", "fairness", "household"]
  
  // 2. Filter eligible games
  const eligible = ALL_GAMES.filter(game => 
    game.level_required <= userLevel &&
    (!context.time_available_minutes || game.duration_minutes.min <= context.time_available_minutes) &&
    !context.recent_games.slice(0, 3).includes(game.id) && // Not in last 3 games
    !game.contraindications.includes(context.emotional_state)
  );
  
  // 3. Score each game
  const scored = eligible.map(game => {
    const themeScore = calculateThemeMatch(themes, game.themes) * 0.45;
    const timeScore = context.time_available_minutes 
      ? calculateTimeFit(context.time_available_minutes, game.duration_minutes) * 0.20
      : 0.10;
    const levelScore = (userLevel - game.level_required + 1) / userLevel * 0.20;
    const freshnessScore = calculateFreshness(game.id, context.recent_games) * 0.10;
    const preferenceScore = getUserPreference(game.id) * 0.05;
    
    return {
      game,
      score: themeScore + timeScore + levelScore + freshnessScore + preferenceScore,
      rationale: generateRationale(game, themes, context)
    };
  });
  
  // 4. Sort and return top 3
  return scored.sort((a, b) => b.score - a.score).slice(0, 3);
}

function extractThemes(transcript: string): string[] {
  // Use vector DB to find semantically similar themes
  const embedding = getEmbedding(transcript);
  const similarThemes = vectorDB.search(embedding, k=5);
  return similarThemes.map(t => t.theme);
}

function calculateThemeMatch(inputThemes: string[], gameThemes: string[]): number {
  const matches = inputThemes.filter(t => gameThemes.includes(t)).length;
  return matches / Math.max(inputThemes.length, gameThemes.length);
}

function generateRationale(game: Game, themes: string[], context: SuggestionContext): string {
  // Template-based rationale generation
  if (themes.includes("resentment") && game.id === "and_what_else") {
    return "Clear built-up resentments to restore intimacy";
  }
  if (context.emotional_state === "elevated" && game.id === "pause") {
    return "Quick reset to get back on track";
  }
  // ... more templates
  return game.description;
}
```

**Example Scenarios:**

```typescript
// Scenario 1: High conflict
const context1 = {
  transcript: "You never help! I'm so tired of this!",
  time_available_minutes: 5,
  emotional_state: "elevated",
  recent_games: []
};
// Output: Pause (0.92), IWR (0.78), Pillar Talk (0.65)

// Scenario 2: Feeling disconnected
const context2 = {
  transcript: "We feel like roommates. I miss us.",
  time_available_minutes: 60,
  emotional_state: "sad",
  recent_games: ["iwr", "pause"]
};
// Output: Closeness Counter (0.89), Seven Nights (0.81), And What Else (0.74)

// Scenario 3: Recurring fight
const context3 = {
  transcript: "This is the third time we've fought about money this month",
  time_available_minutes: 45,
  emotional_state: "frustrated",
  recent_games: ["pause", "iwr", "pillar_talk"]
};
// Output: Bomb Squad (0.94), Switch (0.82), And What Else (0.76)
```

---

## 5. LLM Integration Specifications

### 5.1 Translator Service Architecture

**Service:** Dedicated microservice handling TES/TEL translation

**Input:**
```json
{
  "mode": "TES",
  "input_text": "You never help with anything!",
  "user_context": {
    "current_level": 1,
    "recent_topics": ["household_tasks", "appreciation"]
  }
}
```

**Processing Pipeline:**
```
1. Input validation (max 500 chars, profanity filter)
2. Load system prompt from templates
3. Inject user context into prompt
4. Call trained LLM model
5. Parse structured output (JSON schema validation)
6. Store session in database
7. Return formatted response
```

**System Prompt Template (TES):**
```
You are a Truth Empowered Speaking translator. Your job is to transform reactive, triggered language into conscious, vulnerable communication using the TES framework.

FRAMEWORK:
- OUTER: Observable facts only (what a camera would record)
- INNER: Internal experience (feelings, thoughts, needs)
- UNDER: Deepest fear or vulnerability
- WHY: Core need or value
- ASK: Clear, kind, specific request

RULES:
1. Never include judgment in OUTER (e.g., "you ignored me" → "you looked at your phone")
2. INNER must use "I feel/think/need" statements
3. UNDER must be vulnerable (fears of abandonment, inadequacy, unworthiness)
4. ASK must be specific and doable
5. Check against Four Pillars: Freeness, Wholesomeness, Non-Meanness, Fairness
6. Follow Ten Instructions (especially #1: speak truth consciously, #8: own your emotions)

CONTEXT:
User is at Level {{current_level}} and has been working on {{recent_topics}}.

TASK:
Translate the following reactive statement into Truth Empowered Speaking:

"{{input_text}}"

Return ONLY valid JSON with this structure:
{
  "outer": "...",
  "inner": "...",
  "under": "...",
  "why": "...",
  "ask": "...",
  "checks": {
    "non_meanness": true|false,
    "pillars_aligned": true|false,
    "instructions_followed": [1, 5, 8]
  }
}
```

**System Prompt Template (TEL):**
```
You are a Truth Empowered Listening coach. Your job is to help someone deeply understand what their partner just shared, even if it was said reactively.

FRAMEWORK:
- OUTER: What they actually said (facts)
- UNDERCURRENTS: What they might be feeling beneath the words
- WHAT MATTERS: The core values or needs at stake
- QUESTIONS: Curiosity-based questions to deepen understanding

RULES:
1. OUTER repeats key facts without interpretation
2. UNDERCURRENTS uses empathy, not mind-reading ("seems to be feeling...")
3. WHAT MATTERS identifies values (connection, respect, safety, etc.)
4. QUESTIONS are open-ended and curious, never defensive

TASK:
Help the user listen deeply to this message from their partner:

"{{input_text}}"

Return ONLY valid JSON with this structure:
{
  "outer": "...",
  "undercurrents": "...",
  "what_matters": "...",
  "depth_questions": ["...", "..."]
}
```

**Output Schema Validation:**
```typescript
// TES Output
interface TESOutput {
  outer: string;     // Max 200 chars
  inner: string;     // Max 200 chars
  under: string;     // Max 200 chars
  why: string;       // Max 200 chars
  ask: string;       // Max 200 chars
  checks: {
    non_meanness: boolean;
    pillars_aligned: boolean;
    instructions_followed: number[];
  };
}

// TEL Output
interface TELOutput {
  outer: string;           // Max 200 chars
  undercurrents: string;   // Max 200 chars
  what_matters: string;    // Max 200 chars
  depth_questions: string[]; // 2-3 questions, max 150 chars each
}
```

**Error Handling:**
```typescript
// Retry logic
async function translateWithRetry(input, mode, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await llmService.translate(input, mode);
      if (validateSchema(result, mode)) {
        return result;
      }
      throw new Error("Invalid schema");
    } catch (error) {
      if (attempt === maxRetries) {
        // Fallback to template-based response
        return generateFallbackResponse(input, mode);
      }
      await sleep(1000 * attempt); // Exponential backoff
    }
  }
}

function generateFallbackResponse(input, mode) {
  if (mode === "TES") {
    return {
      outer: "I noticed [specific behavior]",
      inner: "I felt [emotion]",
      under: "I'm afraid [fear]",
      why: "Because I need [need]",
      ask: "Would you be willing to [request]?",
      checks: { non_meanness: true, pillars_aligned: true, instructions_followed: [1] }
    };
  }
  // Similar for TEL
}
```

### 5.2 Mediator Service Architecture

**Components:**
1. Audio upload handler
2. ASR (Whisper) transcription
3. Speaker diarization (if multi-speaker)
4. LLM analysis (same as TEL mode)
5. Game suggestion engine

**Flow:**
```
User records audio (60s max)
  ↓
Upload to S3 (signed URL)
  ↓
Trigger ASR job (Whisper API)
  ↓ (10-15 seconds)
Transcript ready
  ↓
Extract themes via vector search
  ↓
Send to LLM (TEL mode)
  ↓ (3-5 seconds)
TEL summary ready
  ↓
Generate game suggestions
  ↓ (1 second)
Return full analysis
```

**Whisper Configuration:**
```python
import openai

def transcribe_audio(audio_file_path):
    with open(audio_file_path, "rb") as audio_file:
        transcript = openai.Audio.transcribe(
            model="whisper-1",
            file=audio_file,
            language="en",
            response_format="verbose_json",  # Includes word timestamps
            temperature=0.2,
            prompt="Relationship conversation with potential conflict or vulnerability."
        )
    return transcript
```

**Theme Extraction via Vector DB:**
```typescript
async function extractThemesFromTranscript(transcript: string): Promise<string[]> {
  // 1. Generate embedding for transcript
  const embedding = await generateEmbedding(transcript);
  
  // 2. Search vector DB for similar themes
  const results = await vectorDB.search({
    vector: embedding,
    collection: "relationship_themes",
    k: 5,
    threshold: 0.7
  });
  
  // 3. Return theme labels
  return results.map(r => r.metadata.theme);
}

// Example themes in vector DB:
const themes = [
  { id: 1, theme: "resentment", embedding: [...] },
  { id: 2, theme: "disconnection", embedding: [...] },
  { id: 3, theme: "household_labor", embedding: [...] },
  { id: 4, theme: "appreciation", embedding: [...] },
  // ... 100+ themes
];
```

---

## 6. Comprehension System

### 6.1 Question Types

**1. Multiple Choice (Distinction)**
```json
{
  "type": "multiple_choice",
  "question": "Which of these is an Outer (observable fact)?",
  "options": [
    {"id": "A", "text": "You never listen to me"},
    {"id": "B", "text": "You looked at your phone while I was talking"},
    {"id": "C", "text": "You don't care about my feelings"},
    {"id": "D", "text": "You're always distracted"}
  ],
  "correct_answer": "B",
  "explanation": "B is the only statement describing something a camera could record. A, C, and D are interpretations or judgments."
}
```

**2. Translation Task**
```json
{
  "type": "translation",
  "question": "Translate this reactive statement using TES structure:\n\n'You're so selfish!'",
  "expected_structure": {
    "outer": { "required": true, "points": 2 },
    "inner": { "required": true, "points": 2 },
    "under": { "required": true, "points": 2 },
    "ask": { "required": true, "points": 2 }
  },
  "scoring_rubric": {
    "outer": {
      "excellent": "Specific observable behavior with no judgment",
      "good": "Observable behavior with minor interpretation",
      "poor": "Includes judgment or interpretation"
    },
    "under": {
      "excellent": "Vulnerable fear about abandonment/inadequacy/unworthiness",
      "good": "Somewhat vulnerable but not deep enough",
      "poor": "Not vulnerable or just rephrases inner"
    }
  }
}
```

**3. Scenario Application**
```json
{
  "type": "scenario",
  "question": "Your partner says: 'You're late again. I guess I don't matter to you.'\n\nHow would you respond using Truth Empowered Listening?",
  "scoring_criteria": {
    "identifies_outer": 1,
    "acknowledges_emotion": 1,
    "asks_curious_question": 1,
    "avoids_defensiveness": 1
  },
  "sample_answer": "I hear that you're upset because I was late. It sounds like you're feeling unimportant. Can you help me understand what it's like for you when I'm late?"
}
```

### 6.2 Scoring Algorithm

**Multiple Choice:**
```typescript
function scoreMCQ(userAnswer: string, correctAnswer: string): number {
  return userAnswer === correctAnswer ? 1 : 0;
}
```

**Translation Task:**
```typescript
async function scoreTranslation(userAnswer: TESOutput, questionId: string): Promise<number> {
  // 1. Check structure completeness
  const structureScore = checkStructure(userAnswer) * 0.3;
  
  // 2. Use LLM to evaluate quality
  const qualityScores = await evaluateWithLLM(userAnswer, questionId);
  // Returns: { outer: 0-1, inner: 0-1, under: 0-1, ask: 0-1 }
  
  const avgQuality = (qualityScores.outer + qualityScores.inner + 
                      qualityScores.under + qualityScores.ask) / 4;
  
  // 3. Weighted score
  return structureScore + (avgQuality * 0.7);
}

async function evaluateWithLLM(userAnswer: TESOutput, questionId: string): Promise<Scores> {
  const prompt = `
Evaluate this Truth Empowered Speaking translation:

User's answer:
- Outer: "${userAnswer.outer}"
- Inner: "${userAnswer.inner}"
- Under: "${userAnswer.under}"
- Ask: "${userAnswer.ask}"

Scoring rubric:
[Include rubric from question]

Return JSON with scores 0-1 for each component:
{
  "outer": 0.9,
  "inner": 0.8,
  "under": 0.7,
  "ask": 0.9,
  "feedback": "Your Outer was excellent..."
}
  `;
  
  const result = await llm.evaluate(prompt);
  return result;
}
```

**Passing Threshold:**
- Overall score ≥ 0.80 (80%)
- Minimum 0.60 on any individual question
- If failed: Wait 24 hours before retry
- After 3 failures: Offer review materials or coach booking

### 6.3 Question Bank Structure

**Database Schema:**
```sql
CREATE TABLE comprehension_questions (
    id UUID PRIMARY KEY,
    level INTEGER NOT NULL,
    section INTEGER NOT NULL,
    type VARCHAR(20) NOT NULL, -- multiple_choice, translation, scenario
    question_data JSONB NOT NULL, -- Full question object
    difficulty VARCHAR(20) DEFAULT 'medium', -- easy, medium, hard
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_questions_level_section ON comprehension_questions(level, section);
```

**Question Selection:**
```typescript
async function getComprehensionQuestions(level: number, section: number): Promise<Question[]> {
  // Get 5 questions: 2 easy, 2 medium, 1 hard
  const questions = await db.query(`
    (SELECT * FROM comprehension_questions 
     WHERE level = $1 AND section = $2 AND difficulty = 'easy' 
     ORDER BY RANDOM() LIMIT 2)
    UNION
    (SELECT * FROM comprehension_questions 
     WHERE level = $1 AND section = $2 AND difficulty = 'medium' 
     ORDER BY RANDOM() LIMIT 2)
    UNION
    (SELECT * FROM comprehension_questions 
     WHERE level = $1 AND section = $2 AND difficulty = 'hard' 
     ORDER BY RANDOM() LIMIT 1)
  `, [level, section]);
  
  return shuffleArray(questions);
}
```

---

## 7. Gating & Progression Logic

### 7.1 Section Unlock Flow

```typescript
interface SectionStatus {
  couple_id: string;
  level: number;
  section: number;
  partner1_content_complete: boolean;
  partner1_completed_at?: Date;
  partner2_content_complete: boolean;
  partner2_completed_at?: Date;
  settle_timer_start?: Date;
  comprehension_unlocked_at?: Date;
  section_unlocked: boolean;
}

async function checkSectionProgression(coupleId: string, level: number, section: number) {
  const status = await getSectionStatus(coupleId, level, section);
  
  // Step 1: Check if both partners completed content
  if (status.partner1_content_complete && status.partner2_content_complete) {
    if (!status.settle_timer_start) {
      // Start 24-hour settle timer
      const now = new Date();
      await db.query(`
        UPDATE section_progress 
        SET settle_timer_start = $1 
        WHERE couple_id = $2 AND level = $3 AND section = $4
      `, [now, coupleId, level, section]);
      
      // Don't send notification yet
      return { status: "settling", unlocks_at: addHours(now, 24) };
    }
  }
  
  // Step 2: Check if 24 hours elapsed
  if (status.settle_timer_start) {
    const elapsed = Date.now() - status.settle_timer_start.getTime();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    
    if (elapsed >= TWENTY_FOUR_HOURS && !status.comprehension_unlocked_at) {
      // Unlock comprehension check
      await db.query(`
        UPDATE section_progress 
        SET comprehension_unlocked_at = NOW() 
        WHERE couple_id = $1 AND level = $2 AND section = $3
      `, [coupleId, level, section]);
      
      // Send notifications to both partners
      await sendNotification(status.partner1_id, "Comprehension check ready!");
      await sendNotification(status.partner2_id, "Comprehension check ready!");
      
      return { status: "comprehension_ready" };
    }
  }
  
  // Step 3: Check if both passed comprehension
  const scores = await getComprehensionScores(coupleId, level, section);
  if (scores.partner1 >= 0.80 && scores.partner2 >= 0.80) {
    if (!status.section_unlocked) {
      // Unlock next section
      await db.query(`
        UPDATE section_progress 
        SET section_unlocked = TRUE, section_unlocked_at = NOW() 
        WHERE couple_id = $1 AND level = $2 AND section = $3
      `, [coupleId, level, section]);
      
      // Create next section record
      await db.query(`
        INSERT INTO section_progress (couple_id, level, section) 
        VALUES ($1, $2, $3)
      `, [coupleId, level, section + 1]);
      
      // Send celebration notifications
      await sendNotification(status.partner1_id, "Next section unlocked! 🎉");
      await sendNotification(status.partner2_id, "Next section unlocked! 🎉");
      
      return { status: "unlocked", next_section: section + 1 };
    }
  }
  
  return { status: "waiting" };
}
```

### 7.2 Edge Cases

**Case 1: Partners in Different Timezones**
```typescript
// Use couple's shared timezone (set during pairing)
const coupleTimezone = await getCoupleTimezone(coupleId);
const settleTime = moment(status.settle_timer_start)
  .tz(coupleTimezone)
  .add(24, 'hours');
```

**Case 2: One Partner Goes Inactive**
```typescript
// If partner inactive for 14 days, offer solo path
async function checkInactivePartner(coupleId: string) {
  const lastActive = await getPartnerLastActive(coupleId);
  const daysSince = daysSinceDate(lastActive);
  
  if (daysSince >= 14) {
    // Notify active partner
    await sendNotification(activePartnerId, {
      title: "Continue Solo?",
      body: "Your partner has been inactive for 2 weeks. You can continue learning solo or wait for them to return.",
      actions: ["Continue Solo", "Wait"]
    });
  }
}
```

**Case 3: Repeated Comprehension Failures**
```typescript
async function handleComprehensionAttempt(userId: string, coupleId: string, level: number, section: number, score: number) {
  const attempts = await getAttemptCount(userId, level, section);
  
  if (score < 0.80) {
    if (attempts >= 3) {
      // Offer help after 3 failures
      await sendNotification(userId, {
        title: "Need Help?",
        body: "This section seems challenging. We can offer review materials or connect you with a coach.",
        actions: ["Review Materials", "Book Coach", "Try Again"]
      });
    } else {
      // Standard retry message
      await sendNotification(userId, {
        title: "Review & Retry",
        body: "Your score was {score}%. Review the materials and try again in 24 hours."
      });
    }
  }
}
```

**Case 4: Partner Drops Out Mid-Section**
```typescript
// Allow active partner to continue reading content
// Block only at comprehension gate
async function getContentAccess(userId: string, level: number, section: number) {
  const sectionStatus = await getSectionStatus(coupleId, level, section);
  const myCompletion = (userId === partner1_id) 
    ? sectionStatus.partner1_content_complete 
    : sectionStatus.partner2_content_complete;
  
  return {
    can_read_content: true, // Always allow reading
    can_take_comprehension: sectionStatus.comprehension_unlocked_at !== null,
    waiting_for_partner: !myCompletion && partnerContentComplete
  };
}
```

---

## 8. Non-Functional Requirements

### 8.1 Performance Requirements

**API Response Times (p95):**
- Authentication: <300ms
- Training content fetch: <500ms
- Translator (TES/TEL): <3s
- Mediator transcription: <10s for 60s audio
- Comprehension grading: <5s

**App Performance:**
- Cold start: <2s
- Hot start: <500ms
- Screen transitions: <200ms
- Scroll FPS: ≥55fps

**Optimization Strategies:**
- CDN for media assets (book pages, videos)
- Redis caching for user sessions
- Lazy loading for images
- Background processing for mediator

### 8.2 Reliability

**Uptime Target:** 99.5% (excluding scheduled maintenance)

**Data Durability:**
- PostgreSQL: Multi-AZ deployment
- S3: Standard storage class (99.999999999% durability)
- Daily backups retained for 30 days

**Graceful Degradation:**
```typescript
// If LLM service is down
if (translatorServiceDown) {
  return {
    error: "Translation service temporarily unavailable",
    fallback: "Try using the manual TES framework in your notes",
    retry_in_seconds: 300
  };
}

// If comprehension grading slow
if (gradingTimeExceeds(10_000)) {
  return {
    status: "processing",
    message: "This is taking longer than usual. We'll notify you when ready.",
    estimated_completion: "2-3 minutes"
  };
}
```

### 8.3 Security

**Authentication:**
- JWT tokens with 1-hour expiration
- Refresh tokens with 30-day expiration
- Secure password storage (bcrypt, 12 rounds)
- Rate limiting: 100 requests/minute per user

**Data Protection:**
- Encryption at rest: AES-256
- Encryption in transit: TLS 1.3
- No partner can access other's private journal entries
- Audio recordings deleted after 90 days (compliance)

**Privacy Controls:**
```typescript
// Partner cannot see other's progress details
async function getPartnerProgress(requesterId: string, partnerId: string) {
  if (requesterId === partnerId) {
    // Full access to own data
    return await getFullProgress(partnerId);
  } else {
    // Limited view of partner
    return {
      sections_complete: true, // Boolean only
      current_section: 5, // Just the number
      comprehension_passed: true // Boolean only
      // NO scores, NO attempt counts, NO journal entries
    };
  }
}
```

**Abuse Prevention:**
```typescript
// Detect partner pressure patterns
async function detectPressurePatterns(coupleId: string) {
  const p1Activity = await getActivityLog(partner1_id);
  const p2Activity = await getActivityLog(partner2_id);
  
  // Flag if one partner checks other's status >5x/day
  const statusChecks = p1Activity.filter(a => a.action === "view_partner_progress").length;
  if (statusChecks > 5) {
    await logAlert({ type: "excessive_monitoring", coupleId });
  }
  
  // Flag if one partner completes sections suspiciously fast
  const avgSectionTime = calculateAvgTime(p1Activity);
  if (avgSectionTime < 5 * 60) { // Less than 5 minutes
    await logAlert({ type: "rushing", userId: partner1_id });
  }
}
```

### 8.4 Scalability

**Target Scale (12 months):**
- 10,000 active couples (20,000 users)
- 50,000 translator requests/day
- 10,000 mediator sessions/day
- 100GB media storage

**Database Sharding:**
```sql
-- Shard by couple_id using hash partitioning
-- Shard 1: couple_id hash % 4 = 0
-- Shard 2: couple_id hash % 4 = 1
-- Shard 3: couple_id hash % 4 = 2
-- Shard 4: couple_id hash % 4 = 3
```

**Load Balancing:**
- API Gateway: Round-robin across 3+ instances
- LLM Service: Queue-based (RabbitMQ) with 5+ workers
- ASR Service: Separate queue with 3+ workers

---

## 9. Testing Strategy

### 9.1 Unit Tests

**Coverage Target:** 80% minimum

**Critical Paths:**
- Authentication flows
- Section progression logic
- Comprehension scoring
- Game suggestion algorithm
- Translator output validation

### 9.2 Integration Tests

**Key Scenarios:**
1. Full user journey: Sign up → Pair → Complete section → Pass comprehension
2. Translator: Input → LLM → Validation → Store → Return
3. Mediator: Upload → Transcribe → Analyze → Suggest games
4. Edge cases: Inactive partner, failed comprehension, service outage

### 9.3 User Acceptance Testing

**Alpha (50 couples, 2 weeks):**
- Focus: Core training flow, basic repair tools
- Metrics: Completion rate, bug reports, feedback
- Success: >80% complete Section 1, <10 critical bugs

**Beta (500 couples, 4 weeks):**
- Focus: Full Level 1, all tools, 5 games
- Metrics: Retention, engagement, tool usage
- Success: 70% complete Level 1, 60% use translator weekly

### 9.4 Load Testing

**Scenarios:**
- 1,000 concurrent users
- 100 translator requests/second
- 50 mediator uploads/second
- Database: 1M records, complex joins

---

## 10. Deployment & DevOps

### 10.1 Infrastructure

**Cloud Provider:** AWS

**Services:**
- **Compute:** ECS (Fargate) for microservices
- **Database:** RDS PostgreSQL (Multi-AZ)
- **Cache:** ElastiCache Redis
- **Storage:** S3 (media), EBS (logs)
- **CDN:** CloudFront
- **Load Balancer:** Application Load Balancer
- **Monitoring:** CloudWatch + Sentry
- **CI/CD:** GitHub Actions → ECR → ECS

### 10.2 Environments

1. **Development:** Local Docker Compose
2. **Staging:** Mirrors production, uses test LLM endpoints
3. **Production:** Multi-region (primary: us-west-2, backup: us-east-1)

### 10.3 Release Strategy

**Mobile Apps:**
- iOS: TestFlight (alpha/beta) → App Store (production)
- Android: Internal testing → Closed testing → Production

**Backend:**
- Blue-green deployments
- Feature flags for gradual rollouts
- Rollback plan: <5 minutes

### 10.4 Monitoring

**Key Metrics:**
- API latency (p50, p95, p99)
- Error rates (4xx, 5xx)
- LLM success rate
- Database query times
- User engagement (DAU, WAU)

**Alerts:**
- Error rate >1% → Page on-call
- API latency p95 >2s → Slack alert
- Database CPU >80% → Slack alert
- Translator success rate <95% → Investigate

---

## 11. Appendices

### Appendix A: Glossary

- **TES:** Truth Empowered Speaking
- **TEL:** Truth Empowered Listening
- **IWR:** Internal Weather Report
- **Outer:** Observable facts
- **Inner:** Internal experience
- **Under:** Deepest vulnerability/fear
- **Elevation:** Triggered/activated state
- **Settle Timer:** 24-hour integration period
- **Comprehension Gate:** Both-pass quiz to unlock next section

### Appendix B: Color Palette

```css
:root {
  /* Primary */
  --sky-blue: #A7CCD9;
  --gold: #F5C95D;
  --olive: #B8C77C;
  --coral: #E07A5F;
  --taupe: #8D725D;
  --pink: #F4B8C1;
  --lavender: #C5B9D6;
  
  /* Neutrals */
  --bg-dark: #2A2927;
  --bg-light: #F7F4EF;
  --text-primary: #1C1E20;
  --text-secondary: #5A5C5E;
  
  /* Status */
  --success: #B8C77C;
  --warning: #F5C95D;
  --error: #E07A5F;
}
```

### Appendix C: API Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| Auth (login/register) | 5 | 15 min |
| Translator | 20 | 1 hour |
| Mediator | 10 | 1 hour |
| Training content | 100 | 1 hour |
| All others | 100 | 1 min |

### Appendix D: Database Size Estimates

**Per Couple (12 months):**
- Section progress: 1 KB × 84 sections = 84 KB
- Translator sessions: 500 bytes × 100 sessions = 50 KB
- Mediator sessions: 2 KB × 50 sessions = 100 KB
- Journal entries: 1 KB × 50 entries = 50 KB
- Game sessions: 500 bytes × 30 games = 15 KB
- **Total per couple:** ~300 KB

**10,000 couples:** 3 GB (very manageable)

---

## Document Control

**Version:** 3.0  
**Last Updated:** September 30, 2025  
**Next Review:** October 30, 2025

**Changelog:**
- v3.0 (Sep 30, 2025): Complete rebuild focusing on technical implementation
- v2.0 (Sep 15, 2025): Added user research and marketing sections
- v1.0 (Sep 1, 2025): Initial PRD

**Approval Status:**
- [ ] Technical Lead (John)
- [ ] Product Owner (Marshall/Heather)
- [ ] Engineering Team
- [ ] Design Team

**Document Location:** `/project/PRD.md`

---

*This is a living document. Suggest edits via GitHub Issues.*
