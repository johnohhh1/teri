const request = require('supertest');
const { createApp } = require('../../backend/src/app');
const { testHelpers, performanceHelpers } = global;

/**
 * TERI Model Performance Tests
 * 
 * Validates performance requirements from PRD Section 8.1:
 * - Authentication: <300ms
 * - Training content fetch: <500ms
 * - Translator (TES/TEL): <3s
 * - Mediator transcription: <10s for 60s audio
 * - Comprehension grading: <5s
 */
describe('TERI Performance Tests', () => {
  let app;
  
  beforeAll(async () => {
    app = await createApp();
  });
  
  beforeEach(async () => {
    await testHelpers.cleanDatabase();
  });
  
  describe('API Response Time Requirements', () => {
    let authToken, testUser;
    
    beforeEach(async () => {
      testUser = await testHelpers.createTestUser();
      
      // Register user for token
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
    
    it('should authenticate within 300ms (p95)', async () => {
      const measurements = [];
      
      // Take multiple measurements for p95 calculation
      for (let i = 0; i < 20; i++) {
        const { durationMs } = await performanceHelpers.measureTime(
          () => request(app)
            .post('/api/v1/auth/login')
            .send({
              email: testUser.email,
              password: testUser.password
            })
        );
        
        measurements.push(durationMs);
      }
      
      const p95Time = calculatePercentile(measurements, 95);
      
      expect(p95Time).toBeLessThan(300);
      console.log(`Authentication p95: ${p95Time.toFixed(2)}ms`);
    });
    
    it('should fetch training content within 500ms (p95)', async () => {
      const measurements = [];
      
      for (let i = 0; i < 20; i++) {
        const { durationMs } = await performanceHelpers.measureTime(
          () => request(app)
            .get('/api/v1/training/current')
            .set('Authorization', `Bearer ${authToken}`)
        );
        
        measurements.push(durationMs);
      }
      
      const p95Time = calculatePercentile(measurements, 95);
      
      expect(p95Time).toBeLessThan(500);
      console.log(`Training content fetch p95: ${p95Time.toFixed(2)}ms`);
    });
    
    it('should complete TES translation within 3 seconds (p95)', async () => {
      const testInputs = [
        "You never help with anything!",
        "I can't believe you forgot again!",
        "You're always on your phone!",
        "This is so frustrating!",
        "You don't care about my feelings!"
      ];
      
      const measurements = [];
      
      for (const input of testInputs) {
        const { durationMs } = await performanceHelpers.measureTime(
          () => request(app)
            .post('/api/v1/translator/tes')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ input_text: input })
        );
        
        measurements.push(durationMs);
      }
      
      const p95Time = calculatePercentile(measurements, 95);
      
      expect(p95Time).toBeLessThan(3000);
      console.log(`TES translation p95: ${p95Time.toFixed(2)}ms`);
    });
    
    it('should complete TEL translation within 3 seconds (p95)', async () => {
      const testInputs = [
        "I felt so alone at the party last night",
        "Work has been really stressful lately",
        "I don't think you understand how hard this is",
        "Sometimes I wonder if we're growing apart",
        "I need more support from you"
      ];
      
      const measurements = [];
      
      for (const input of testInputs) {
        const { durationMs } = await performanceHelpers.measureTime(
          () => request(app)
            .post('/api/v1/translator/tel')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ input_text: input })
        );
        
        measurements.push(durationMs);
      }
      
      const p95Time = calculatePercentile(measurements, 95);
      
      expect(p95Time).toBeLessThan(3000);
      console.log(`TEL translation p95: ${p95Time.toFixed(2)}ms`);
    });
    
    it('should process mediator audio within 10 seconds for 60s audio', async () => {
      // Create mock 60-second audio file
      const audioBuffer = createMockAudioBuffer(60);
      
      // Upload audio
      const uploadResponse = await request(app)
        .post('/api/v1/mediator/upload?speaker=partner1&duration_seconds=60')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'audio/m4a')
        .send(audioBuffer);
      
      const sessionId = uploadResponse.body.session_id;
      
      // Monitor processing time
      const startTime = performance.now();
      let completed = false;
      let processingTime;
      
      while (!completed && (performance.now() - startTime) < 15000) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResponse = await request(app)
          .get(`/api/v1/mediator/${sessionId}`)
          .set('Authorization', `Bearer ${authToken}`);
        
        if (statusResponse.body.status === 'complete') {
          completed = true;
          processingTime = statusResponse.body.processing_time_ms;
        }
      }
      
      expect(completed).toBe(true);
      expect(processingTime).toBeLessThan(10000);
      console.log(`Mediator processing (60s audio): ${processingTime}ms`);
    });
    
    it('should grade comprehension within 5 seconds', async () => {
      // Setup a section ready for comprehension
      await setupComprehensionTest();
      
      const answers = {
        "q1": "B",
        "q2": {
          "outer": "You made plans without asking me",
          "inner": "I feel hurt and unimportant",
          "under": "I'm afraid I don't matter to you",
          "ask": "Can we check with each other before making plans?"
        }
      };
      
      const { result: response, durationMs } = await performanceHelpers.measureTime(
        () => request(app)
          .post('/api/v1/training/sections/1/1/comprehension')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ answers })
      );
      
      expect(response.status).toBe(200);
      expect(durationMs).toBeLessThan(5000);
      console.log(`Comprehension grading: ${durationMs.toFixed(2)}ms`);
    });
  });
  
  describe('Concurrent Load Performance', () => {
    let authTokens = [];
    
    beforeEach(async () => {
      // Create multiple test users for load testing
      for (let i = 0; i < 10; i++) {
        const user = await testHelpers.createTestUser({ email: `load${i}@test.com` });
        
        await request(app)
          .post('/api/v1/auth/register')
          .send(user);
        
        const loginResponse = await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: user.email,
            password: user.password
          });
        
        authTokens.push(loginResponse.body.token);
      }
    });
    
    it('should handle 100 concurrent translation requests', async () => {
      const concurrentRequests = [];
      
      // Create 100 concurrent requests (10 users x 10 requests each)
      for (let user = 0; user < 10; user++) {
        for (let req = 0; req < 10; req++) {
          concurrentRequests.push(
            request(app)
              .post('/api/v1/translator/tes')
              .set('Authorization', `Bearer ${authTokens[user]}`)
              .send({ input_text: `Concurrent test ${user}-${req}` })
          );
        }
      }
      
      const { result: responses, durationMs } = await performanceHelpers.measureTime(
        () => Promise.all(concurrentRequests)
      );
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
      
      // Total time should be reasonable
      expect(durationMs).toBeLessThan(30000); // 30s for 100 concurrent requests
      
      const avgTimePerRequest = durationMs / responses.length;
      console.log(`Avg time per concurrent request: ${avgTimePerRequest.toFixed(2)}ms`);
    });
    
    it('should maintain database performance under load', async () => {
      const databaseQueries = [];
      
      // Generate database-heavy operations
      for (let i = 0; i < 50; i++) {
        databaseQueries.push(
          request(app)
            .get('/api/v1/training/current')
            .set('Authorization', `Bearer ${authTokens[i % 10]}`)
        );
      }
      
      const { result: responses, durationMs } = await performanceHelpers.measureTime(
        () => Promise.all(databaseQueries)
      );
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
      
      // Database queries should remain fast under load
      const avgQueryTime = durationMs / responses.length;
      expect(avgQueryTime).toBeLessThan(100); // <100ms average per query
      
      console.log(`Avg database query time under load: ${avgQueryTime.toFixed(2)}ms`);
    });
  });
  
  describe('Memory and Resource Usage', () => {
    it('should not leak memory during extended usage', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      const user = await testHelpers.createTestUser();
      await request(app).post('/api/v1/auth/register').send(user);
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: user.password });
      const token = loginResponse.body.token;
      
      // Simulate extended usage
      for (let i = 0; i < 100; i++) {
        await request(app)
          .post('/api/v1/translator/tes')
          .set('Authorization', `Bearer ${token}`)
          .send({ input_text: `Memory test ${i}` });
      }
      
      // Force garbage collection
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (<50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
      
      console.log(`Memory increase after 100 operations: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    });
    
    it('should efficiently handle large payloads', async () => {
      const user = await testHelpers.createTestUser();
      await request(app).post('/api/v1/auth/register').send(user);
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: user.password });
      const token = loginResponse.body.token;
      
      // Test with maximum allowed input size
      const largeInput = 'a'.repeat(500); // 500 characters (max per PRD)
      
      const { result: response, durationMs } = await performanceHelpers.measureTime(
        () => request(app)
          .post('/api/v1/translator/tes')
          .set('Authorization', `Bearer ${token}`)
          .send({ input_text: largeInput })
      );
      
      expect(response.status).toBe(200);
      
      // Should handle large input efficiently
      expect(durationMs).toBeLessThan(5000);
      
      console.log(`Large payload processing time: ${durationMs.toFixed(2)}ms`);
    });
  });
  
  describe('Scalability Tests', () => {
    it('should maintain performance with database growth', async () => {
      // Populate database with test data to simulate growth
      await populateTestData(1000); // 1000 users worth of data
      
      const user = await testHelpers.createTestUser();
      await request(app).post('/api/v1/auth/register').send(user);
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: user.password });
      const token = loginResponse.body.token;
      
      // Test operations with large dataset
      const operations = [
        () => request(app).get('/api/v1/training/current').set('Authorization', `Bearer ${token}`),
        () => request(app).post('/api/v1/translator/tes').set('Authorization', `Bearer ${token}`).send({ input_text: 'Scale test' }),
        () => request(app).get('/api/v1/games').set('Authorization', `Bearer ${token}`)
      ];
      
      for (const operation of operations) {
        const { durationMs } = await performanceHelpers.measureTime(operation);
        
        // Performance should not degrade significantly with data growth
        expect(durationMs).toBeLessThan(1000);
      }
    });
    
    it('should handle rate limiting efficiently', async () => {
      const user = await testHelpers.createTestUser();
      await request(app).post('/api/v1/auth/register').send(user);
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: user.password });
      const token = loginResponse.body.token;
      
      // Test rate limiting performance
      const requests = [];
      for (let i = 0; i < 25; i++) {
        requests.push(
          request(app)
            .post('/api/v1/translator/tes')
            .set('Authorization', `Bearer ${token}`)
            .send({ input_text: `Rate limit test ${i}` })
        );
      }
      
      const { result: responses, durationMs } = await performanceHelpers.measureTime(
        () => Promise.all(requests)
      );
      
      // Some requests should be rate limited (429)
      const successCount = responses.filter(r => r.status === 200).length;
      const rateLimitedCount = responses.filter(r => r.status === 429).length;
      
      expect(successCount).toBeLessThanOrEqual(20); // Rate limit should kick in
      expect(rateLimitedCount).toBeGreaterThan(0);
      
      // Rate limiting should be fast (not cause delays)
      const avgResponseTime = durationMs / responses.length;
      expect(avgResponseTime).toBeLessThan(100);
      
      console.log(`Rate limiting avg response time: ${avgResponseTime.toFixed(2)}ms`);
    });
  });
  
  describe('Stress Testing', () => {
    it('should handle rapid successive requests gracefully', async () => {
      const user = await testHelpers.createTestUser();
      await request(app).post('/api/v1/auth/register').send(user);
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: user.password });
      const token = loginResponse.body.token;
      
      // Fire requests in rapid succession
      const rapidRequests = [];
      for (let i = 0; i < 10; i++) {
        rapidRequests.push(
          request(app)
            .get('/api/v1/training/current')
            .set('Authorization', `Bearer ${token}`)
        );
      }
      
      const responses = await Promise.all(rapidRequests);
      
      // All should complete successfully
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status);
      });
    });
    
    it('should recover from high load scenarios', async () => {
      // Create a high load scenario
      const users = [];
      for (let i = 0; i < 5; i++) {
        const user = await testHelpers.createTestUser({ email: `stress${i}@test.com` });
        await request(app).post('/api/v1/auth/register').send(user);
        const loginResponse = await request(app)
          .post('/api/v1/auth/login')
          .send({ email: user.email, password: user.password });
        users.push({ token: loginResponse.body.token });
      }
      
      // Generate high load
      const highLoadRequests = [];
      users.forEach(user => {
        for (let i = 0; i < 20; i++) {
          highLoadRequests.push(
            request(app)
              .post('/api/v1/translator/tes')
              .set('Authorization', `Bearer ${user.token}`)
              .send({ input_text: `High load test ${i}` })
          );
        }
      });
      
      await Promise.all(highLoadRequests);
      
      // System should recover and respond normally
      const recoveryRequest = await request(app)
        .post('/api/v1/translator/tes')
        .set('Authorization', `Bearer ${users[0].token}`)
        .send({ input_text: 'Recovery test' });
      
      expect(recoveryRequest.status).toBe(200);
    });
  });
  
  // Helper functions
  
  function calculatePercentile(values, percentile) {
    const sorted = values.sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index];
  }
  
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
  
  async function setupComprehensionTest() {
    // Create mock comprehension questions for testing
    // This would typically be done via database seeding
    const mockQuestions = [
      {
        id: 'q1',
        type: 'multiple_choice',
        question: 'Which is an Outer?',
        options: ['A', 'B', 'C', 'D'],
        correct_answer: 'B'
      },
      {
        id: 'q2',
        type: 'translation',
        question: 'Translate: You\'re so selfish!',
        expected_elements: ['outer', 'inner', 'under', 'ask']
      }
    ];
    
    // Setup section progress to enable comprehension
    await testHelpers.setupSectionForComprehension(1, 1);
  }
  
  async function populateTestData(userCount) {
    // Generate test data to simulate database growth
    for (let i = 0; i < userCount; i++) {
      const user = await testHelpers.createTestUser({ email: `testdata${i}@test.com` });
      
      // Create some translator sessions
      await testHelpers.createTranslatorSession(user.id, 'tes', 'Test input');
      
      // Create some progress records
      await testHelpers.createProgressRecord(user.id, 1, 1);
    }
  }
});
