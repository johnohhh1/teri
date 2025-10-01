const { Pool } = require('pg');
const Redis = require('redis');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.DB_NAME = 'teri_test';
process.env.REDIS_URL = 'redis://localhost:6379/1';

// Global test timeout
jest.setTimeout(30000);

// Mock external services
jest.mock('openai', () => ({
  Configuration: jest.fn(),
  OpenAIApi: jest.fn(() => ({
    createCompletion: jest.fn(),
    createTranscription: jest.fn()
  }))
}));

// Mock AWS S3
jest.mock('aws-sdk', () => ({
  S3: jest.fn(() => ({
    upload: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        Location: 'https://test-bucket.s3.amazonaws.com/test-file.m4a'
      })
    }),
    getSignedUrl: jest.fn().mockReturnValue('https://signed-url.com')
  }))
}));

// Global test utilities
global.testHelpers = {
  // Create test user
  createTestUser: async (overrides = {}) => {
    const defaultUser = {
      email: `test-${Date.now()}@example.com`,
      name: 'Test User',
      password: 'TestPassword123!',
      ...overrides
    };
    return defaultUser;
  },
  
  // Create test couple
  createTestCouple: async () => {
    const user1 = await global.testHelpers.createTestUser({ email: 'user1@test.com' });
    const user2 = await global.testHelpers.createTestUser({ email: 'user2@test.com' });
    return { user1, user2 };
  },
  
  // Generate JWT token for testing
  generateTestToken: (userId) => {
    const jwt = require('jsonwebtoken');
    return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
  },
  
  // Clean test database
  cleanDatabase: async () => {
    const db = require('../../backend/src/config/database');
    if (db && db.query) {
      await db.query('TRUNCATE TABLE users, couples, section_progress, translator_sessions, mediator_sessions, journal_entries, game_sessions RESTART IDENTITY CASCADE');
    }
  },
  
  // Redis test client
  getTestRedisClient: () => {
    return Redis.createClient({
      url: process.env.REDIS_URL
    });
  }
};

// Performance testing utilities
global.performanceHelpers = {
  // Measure function execution time
  measureTime: async (fn) => {
    const start = process.hrtime.bigint();
    const result = await fn();
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1000000;
    return { result, durationMs };
  },
  
  // Check if response time meets PRD requirements
  validateResponseTime: (actualMs, maxMs, operation) => {
    if (actualMs > maxMs) {
      throw new Error(`${operation} took ${actualMs}ms, exceeds limit of ${maxMs}ms`);
    }
  }
};

// Custom matchers
expect.extend({
  toBeWithinTimeLimit(received, limit) {
    const pass = received <= limit;
    if (pass) {
      return {
        message: () => `Expected ${received}ms to exceed ${limit}ms`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected ${received}ms to be within ${limit}ms`,
        pass: false,
      };
    }
  },
  
  toMatchTESStructure(received) {
    const requiredFields = ['outer', 'inner', 'under', 'ask', 'checks'];
    const hasAllFields = requiredFields.every(field => 
      received.hasOwnProperty(field) && received[field] !== null && received[field] !== undefined
    );
    
    if (hasAllFields) {
      return {
        message: () => `Expected object not to have TES structure`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected object to have TES structure with fields: ${requiredFields.join(', ')}`,
        pass: false,
      };
    }
  },
  
  toMatchTELStructure(received) {
    const requiredFields = ['outer', 'undercurrents', 'what_matters', 'depth_questions'];
    const hasAllFields = requiredFields.every(field => 
      received.hasOwnProperty(field) && received[field] !== null && received[field] !== undefined
    );
    
    if (hasAllFields) {
      return {
        message: () => `Expected object not to have TEL structure`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected object to have TEL structure with fields: ${requiredFields.join(', ')}`,
        pass: false,
      };
    }
  }
});

// Console override for cleaner test output
if (process.env.NODE_ENV === 'test') {
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
  // Keep console.error for debugging
}

// Cleanup after all tests
afterAll(async () => {
  // Close database connections
  const db = require('../../backend/src/config/database');
  if (db && db.end) {
    await db.end();
  }
  
  // Close Redis connections
  const redis = global.testHelpers.getTestRedisClient();
  if (redis && redis.quit) {
    await redis.quit();
  }
});
