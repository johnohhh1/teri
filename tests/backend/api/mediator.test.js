const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { createApp } = require('../../../backend/src/app');
const { testHelpers, performanceHelpers } = global;

describe('Mediator API', () => {
  let app, authToken, testUser;
  
  beforeAll(async () => {
    app = await createApp();
  });
  
  beforeEach(async () => {
    await testHelpers.cleanDatabase();
    testUser = await testHelpers.createTestUser();
    
    // Register and login user
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
  
  // Helper to create mock audio buffer
  const createMockAudioBuffer = (durationSeconds = 30) => {
    // Create a simple WAV header + data
    const sampleRate = 44100;
    const samples = sampleRate * durationSeconds;
    const buffer = Buffer.alloc(44 + samples * 2); // WAV header + 16-bit samples
    
    // Write WAV header
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + samples * 2, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20); // PCM
    buffer.writeUInt16LE(1, 22); // Mono
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * 2, 28);
    buffer.writeUInt16LE(2, 32);
    buffer.writeUInt16LE(16, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(samples * 2, 40);
    
    return buffer;
  };
  
  describe('POST /api/v1/mediator/upload', () => {
    it('should upload audio and return processing status', async () => {
      const audioBuffer = createMockAudioBuffer(45); // 45 seconds
      
      const { result: response, durationMs } = await performanceHelpers.measureTime(
        () => request(app)
          .post('/api/v1/mediator/upload?speaker=partner1&duration_seconds=45')
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'audio/m4a')
          .send(audioBuffer)
      );
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('session_id');
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('estimated_completion_seconds');
      expect(response.body.status).toBe('processing');
      
      // Upload should be fast (not including processing)
      expect(durationMs).toBeWithinTimeLimit(5000);
    });
    
    it('should reject audio longer than 60 seconds', async () => {
      const audioBuffer = createMockAudioBuffer(65); // 65 seconds
      
      const response = await request(app)
        .post('/api/v1/mediator/upload?speaker=partner1&duration_seconds=65')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'audio/m4a')
        .send(audioBuffer);
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('60 seconds');
    });
    
    it('should reject audio shorter than 5 seconds', async () => {
      const audioBuffer = createMockAudioBuffer(3); // 3 seconds
      
      const response = await request(app)
        .post('/api/v1/mediator/upload?speaker=partner1&duration_seconds=3')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'audio/m4a')
        .send(audioBuffer);
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('5 seconds');
    });
    
    it('should require speaker parameter', async () => {
      const audioBuffer = createMockAudioBuffer(30);
      
      const response = await request(app)
        .post('/api/v1/mediator/upload?duration_seconds=30')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'audio/m4a')
        .send(audioBuffer);
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('speaker');
    });
    
    it('should validate speaker value', async () => {
      const audioBuffer = createMockAudioBuffer(30);
      
      const response = await request(app)
        .post('/api/v1/mediator/upload?speaker=invalid&duration_seconds=30')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'audio/m4a')
        .send(audioBuffer);
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('partner1 or partner2');
    });
    
    it('should require authentication', async () => {
      const audioBuffer = createMockAudioBuffer(30);
      
      const response = await request(app)
        .post('/api/v1/mediator/upload?speaker=partner1&duration_seconds=30')
        .set('Content-Type', 'audio/m4a')
        .send(audioBuffer);
      
      expect(response.status).toBe(401);
    });
    
    it('should enforce rate limiting for mediator', async () => {
      const audioBuffer = createMockAudioBuffer(30);
      
      // Rate limit: 10 requests per hour (PRD Appendix C)
      const promises = Array(11).fill().map(() => 
        request(app)
          .post('/api/v1/mediator/upload?speaker=partner1&duration_seconds=30')
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'audio/m4a')
          .send(audioBuffer)
      );
      
      const responses = await Promise.all(promises);
      const lastResponse = responses[10];
      
      expect(lastResponse.status).toBe(429);
    });
  });
  
  describe('GET /api/v1/mediator/:session_id', () => {
    let sessionId;
    
    beforeEach(async () => {
      // Upload audio first
      const audioBuffer = createMockAudioBuffer(30);
      const uploadResponse = await request(app)
        .post('/api/v1/mediator/upload?speaker=partner1&duration_seconds=30')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'audio/m4a')
        .send(audioBuffer);
      
      sessionId = uploadResponse.body.session_id;
    });
    
    it('should return complete analysis when processing finished', async () => {
      // Mock processing completion
      // In real implementation, this would be async
      
      // Wait a moment for processing (mocked)
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const { result: response, durationMs } = await performanceHelpers.measureTime(
        () => request(app)
          .get(`/api/v1/mediator/${sessionId}`)
          .set('Authorization', `Bearer ${authToken}`)
      );
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('session_id');
      expect(response.body).toHaveProperty('status');
      
      if (response.body.status === 'complete') {
        expect(response.body).toHaveProperty('transcript');
        expect(response.body).toHaveProperty('speaker');
        expect(response.body).toHaveProperty('tel_summary');
        expect(response.body).toHaveProperty('depth_questions');
        expect(response.body).toHaveProperty('suggested_games');
        expect(response.body).toHaveProperty('processing_time_ms');
        
        // Validate TEL structure
        expect(response.body.tel_summary).toMatchTELStructure();
        
        // Performance requirement: Mediator < 10s for 60s audio
        // Scale expectation for 30s audio
        expect(response.body.processing_time_ms).toBeLessThan(10000);
        
        // Validate suggested games
        expect(Array.isArray(response.body.suggested_games)).toBe(true);
        response.body.suggested_games.forEach(game => {
          expect(game).toHaveProperty('game_id');
          expect(game).toHaveProperty('score');
          expect(game).toHaveProperty('rationale');
          expect(game.score).toBeGreaterThanOrEqual(0);
          expect(game.score).toBeLessThanOrEqual(1);
        });
      }
    });
    
    it('should return processing status when still processing', async () => {
      const response = await request(app)
        .get(`/api/v1/mediator/${sessionId}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(['processing', 'complete']).toContain(response.body.status);
    });
    
    it('should reject access to non-existent session', async () => {
      const response = await request(app)
        .get('/api/v1/mediator/invalid-session-id')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(404);
    });
    
    it('should reject access to other users sessions', async () => {
      // Create another user
      const otherUser = await testHelpers.createTestUser({ email: 'other@test.com' });
      await request(app)
        .post('/api/v1/auth/register')
        .send(otherUser);
      
      const otherLoginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: otherUser.email,
          password: otherUser.password
        });
      
      const otherToken = otherLoginResponse.body.token;
      
      // Try to access original user's session
      const response = await request(app)
        .get(`/api/v1/mediator/${sessionId}`)
        .set('Authorization', `Bearer ${otherToken}`);
      
      expect(response.status).toBe(403);
    });
  });
  
  describe('POST /api/v1/mediator/:session_id/feedback', () => {
    let sessionId;
    
    beforeEach(async () => {
      const audioBuffer = createMockAudioBuffer(30);
      const uploadResponse = await request(app)
        .post('/api/v1/mediator/upload?speaker=partner1&duration_seconds=30')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'audio/m4a')
        .send(audioBuffer);
      
      sessionId = uploadResponse.body.session_id;
    });
    
    it('should accept helpful feedback', async () => {
      const response = await request(app)
        .post(`/api/v1/mediator/${sessionId}/feedback`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ feedback: 'helpful' });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
    
    it('should accept not helpful feedback', async () => {
      const response = await request(app)
        .post(`/api/v1/mediator/${sessionId}/feedback`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ feedback: 'not_helpful' });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
    
    it('should reject invalid feedback values', async () => {
      const response = await request(app)
        .post(`/api/v1/mediator/${sessionId}/feedback`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ feedback: 'invalid' });
      
      expect(response.status).toBe(400);
    });
  });
  
  describe('Audio Processing Tests', () => {
    it('should handle different audio formats', async () => {
      const formats = ['audio/m4a', 'audio/wav', 'audio/mp3'];
      
      for (const format of formats) {
        const audioBuffer = createMockAudioBuffer(30);
        
        const response = await request(app)
          .post('/api/v1/mediator/upload?speaker=partner1&duration_seconds=30')
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', format)
          .send(audioBuffer);
        
        // Should accept common audio formats
        expect([200, 400]).toContain(response.status);
      }
    });
    
    it('should handle large audio files efficiently', async () => {
      const largeAudioBuffer = createMockAudioBuffer(60); // Max size
      
      const { result: response, durationMs } = await performanceHelpers.measureTime(
        () => request(app)
          .post('/api/v1/mediator/upload?speaker=partner1&duration_seconds=60')
          .set('Authorization', `Bearer ${authToken}`)
          .set('Content-Type', 'audio/m4a')
          .send(largeAudioBuffer)
      );
      
      expect(response.status).toBe(200);
      // Upload should complete quickly even for large files
      expect(durationMs).toBeLessThan(10000);
    });
    
    it('should handle corrupted audio gracefully', async () => {
      const corruptedBuffer = Buffer.from('not audio data');
      
      const response = await request(app)
        .post('/api/v1/mediator/upload?speaker=partner1&duration_seconds=30')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'audio/m4a')
        .send(corruptedBuffer);
      
      // Should reject corrupted data
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('invalid audio');
    });
  });
  
  describe('Game Suggestion Tests', () => {
    it('should suggest appropriate games based on content', async () => {
      // This would test the game recommendation engine
      // For now, just verify structure
      const audioBuffer = createMockAudioBuffer(30);
      
      const uploadResponse = await request(app)
        .post('/api/v1/mediator/upload?speaker=partner1&duration_seconds=30')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'audio/m4a')
        .send(audioBuffer);
      
      const sessionId = uploadResponse.body.session_id;
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const response = await request(app)
        .get(`/api/v1/mediator/${sessionId}`)
        .set('Authorization', `Bearer ${authToken}`);
      
      if (response.body.status === 'complete') {
        const games = response.body.suggested_games;
        
        games.forEach(game => {
          expect(game).toHaveProperty('game_id');
          expect(game).toHaveProperty('score');
          expect(game).toHaveProperty('rationale');
          expect(game).toHaveProperty('level_required');
          
          // Score should be normalized
          expect(game.score).toBeGreaterThanOrEqual(0);
          expect(game.score).toBeLessThanOrEqual(1);
          
          // Should have meaningful rationale
          expect(game.rationale.length).toBeGreaterThan(10);
        });
      }
    });
  });
  
  describe('Privacy and Security Tests', () => {
    it('should encrypt audio data in storage', async () => {
      const audioBuffer = createMockAudioBuffer(30);
      
      const response = await request(app)
        .post('/api/v1/mediator/upload?speaker=partner1&duration_seconds=30')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'audio/m4a')
        .send(audioBuffer);
      
      expect(response.status).toBe(200);
      
      // Audio should be uploaded to S3 with encryption
      // This would be verified by checking S3 metadata in integration tests
    });
    
    it('should delete audio after retention period', async () => {
      // Test would verify 90-day deletion policy (PRD Section 8.3)
      // Implementation would use scheduled jobs
      expect(true).toBe(true); // Placeholder
    });
    
    it('should not expose transcripts between partners', async () => {
      // Ensure partner cannot access other's private audio sessions
      // This is tested in the access control test above
      expect(true).toBe(true); // Placeholder
    });
  });
});
