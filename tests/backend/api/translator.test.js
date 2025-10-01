const request = require('supertest');
const { createApp } = require('../../../backend/src/app');
const { testHelpers, performanceHelpers } = global;

describe('Translator API', () => {
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
  
  describe('POST /api/v1/translator/tes', () => {
    it('should translate reactive statement to TES format', async () => {
      const input = {
        input_text: "You never help with anything!"
      };
      
      const { result: response, durationMs } = await performanceHelpers.measureTime(
        () => request(app)
          .post('/api/v1/translator/tes')
          .set('Authorization', `Bearer ${authToken}`)
          .send(input)
      );
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('session_id');
      expect(response.body).toHaveProperty('translation');
      expect(response.body).toHaveProperty('processing_time_ms');
      
      // Validate TES structure
      expect(response.body.translation).toMatchTESStructure();
      
      // Performance requirement: TES < 3s (PRD Section 8.1)
      expect(durationMs).toBeWithinTimeLimit(3000);
      
      // Validate specific TES fields
      const translation = response.body.translation;
      expect(translation.outer).toBeTruthy();
      expect(translation.inner).toBeTruthy();
      expect(translation.under).toBeTruthy();
      expect(translation.ask).toBeTruthy();
      expect(translation.checks).toHaveProperty('non_meanness');
      expect(translation.checks).toHaveProperty('pillars_aligned');
    });
    
    it('should provide alternative translations', async () => {
      const input = {
        input_text: "This is so frustrating!"
      };
      
      const response = await request(app)
        .post('/api/v1/translator/tes')
        .set('Authorization', `Bearer ${authToken}`)
        .send(input);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('alternates');
      expect(Array.isArray(response.body.alternates)).toBe(true);
      expect(response.body.alternates.length).toBeGreaterThan(0);
    });
    
    it('should reject empty input', async () => {
      const input = {
        input_text: ""
      };
      
      const response = await request(app)
        .post('/api/v1/translator/tes')
        .set('Authorization', `Bearer ${authToken}`)
        .send(input);
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
    
    it('should reject overly long input', async () => {
      const input = {
        input_text: 'a'.repeat(501) // Exceeds 500 char limit per PRD
      };
      
      const response = await request(app)
        .post('/api/v1/translator/tes')
        .set('Authorization', `Bearer ${authToken}`)
        .send(input);
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('too long');
    });
    
    it('should require authentication', async () => {
      const input = {
        input_text: "You never listen to me"
      };
      
      const response = await request(app)
        .post('/api/v1/translator/tes')
        .send(input);
      
      expect(response.status).toBe(401);
    });
    
    it('should enforce rate limiting for translator', async () => {
      const input = {
        input_text: "Rate limit test"
      };
      
      // Rate limit: 20 requests per hour (PRD Appendix C)
      const promises = Array(21).fill().map(() => 
        request(app)
          .post('/api/v1/translator/tes')
          .set('Authorization', `Bearer ${authToken}`)
          .send(input)
      );
      
      const responses = await Promise.all(promises);
      const lastResponse = responses[20];
      
      expect(lastResponse.status).toBe(429);
    });
    
    it('should handle LLM service failure gracefully', async () => {
      // Mock LLM service failure
      const originalOpenAI = require('openai');
      const mockOpenAI = {
        Configuration: jest.fn(),
        OpenAIApi: jest.fn(() => ({
          createCompletion: jest.fn().mockRejectedValue(new Error('Service unavailable'))
        }))
      };
      
      jest.doMock('openai', () => mockOpenAI);
      
      const input = {
        input_text: "Service failure test"
      };
      
      const response = await request(app)
        .post('/api/v1/translator/tes')
        .set('Authorization', `Bearer ${authToken}`)
        .send(input);
      
      // Should provide fallback response
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('translation');
      expect(response.body.translation).toMatchTESStructure();
      
      // Restore mock
      jest.clearAllMocks();
    });
  });
  
  describe('POST /api/v1/translator/tel', () => {
    it('should translate message to TEL format', async () => {
      const input = {
        input_text: "I felt so alone at the party last night..."
      };
      
      const { result: response, durationMs } = await performanceHelpers.measureTime(
        () => request(app)
          .post('/api/v1/translator/tel')
          .set('Authorization', `Bearer ${authToken}`)
          .send(input)
      );
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('session_id');
      expect(response.body).toHaveProperty('listening');
      expect(response.body).toHaveProperty('depth_questions');
      
      // Validate TEL structure
      expect(response.body.listening).toMatchTELStructure();
      
      // Performance requirement: TEL < 3s
      expect(durationMs).toBeWithinTimeLimit(3000);
      
      // Validate specific TEL fields
      const listening = response.body.listening;
      expect(listening.outer).toBeTruthy();
      expect(listening.undercurrents).toBeTruthy();
      expect(listening.what_matters).toBeTruthy();
      
      // Validate depth questions
      expect(Array.isArray(response.body.depth_questions)).toBe(true);
      expect(response.body.depth_questions.length).toBeGreaterThanOrEqual(2);
      expect(response.body.depth_questions.length).toBeLessThanOrEqual(3);
    });
    
    it('should provide empathetic responses', async () => {
      const input = {
        input_text: "I'm so hurt and angry right now"
      };
      
      const response = await request(app)
        .post('/api/v1/translator/tel')
        .set('Authorization', `Bearer ${authToken}`)
        .send(input);
      
      expect(response.status).toBe(200);
      
      const listening = response.body.listening;
      expect(listening.undercurrents.toLowerCase()).toMatch(/hurt|pain|angry|emotion/);
      expect(listening.what_matters.toLowerCase()).toMatch(/matter|value|important|care/);
    });
    
    it('should generate curious questions', async () => {
      const input = {
        input_text: "Work has been really stressful lately"
      };
      
      const response = await request(app)
        .post('/api/v1/translator/tel')
        .set('Authorization', `Bearer ${authToken}`)
        .send(input);
      
      expect(response.status).toBe(200);
      
      // Questions should be open-ended and curious
      const questions = response.body.depth_questions;
      questions.forEach(question => {
        expect(question).toMatch(/\?$/);
        expect(question.toLowerCase()).toMatch(/what|how|when|where|tell me|help me understand/);
      });
    });
  });
  
  describe('POST /api/v1/translator/:session_id/feedback', () => {
    let sessionId;
    
    beforeEach(async () => {
      // Create a translation session first
      const translateResponse = await request(app)
        .post('/api/v1/translator/tes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ input_text: "Test message" });
      
      sessionId = translateResponse.body.session_id;
    });
    
    it('should accept helpful feedback', async () => {
      const response = await request(app)
        .post(`/api/v1/translator/${sessionId}/feedback`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ feedback: 'helpful' });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
    
    it('should accept not helpful feedback', async () => {
      const response = await request(app)
        .post(`/api/v1/translator/${sessionId}/feedback`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ feedback: 'not_helpful' });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
    
    it('should reject invalid feedback values', async () => {
      const response = await request(app)
        .post(`/api/v1/translator/${sessionId}/feedback`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ feedback: 'invalid' });
      
      expect(response.status).toBe(400);
    });
    
    it('should reject feedback for non-existent session', async () => {
      const response = await request(app)
        .post('/api/v1/translator/invalid-session-id/feedback')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ feedback: 'helpful' });
      
      expect(response.status).toBe(404);
    });
  });
  
  describe('Translation Quality Tests', () => {
    it('should maintain consistency across similar inputs', async () => {
      const similarInputs = [
        "You're always late",
        "You are always late",
        "You're constantly late"
      ];
      
      const responses = await Promise.all(
        similarInputs.map(input => 
          request(app)
            .post('/api/v1/translator/tes')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ input_text: input })
        )
      );
      
      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.translation).toMatchTESStructure();
      });
      
      // Outer statements should all reference being late
      responses.forEach(response => {
        expect(response.body.translation.outer.toLowerCase()).toContain('late');
      });
    });
    
    it('should handle emotional intensity appropriately', async () => {
      const intensiveInput = {
        input_text: "I HATE when you do that! It makes me SO ANGRY!"
      };
      
      const response = await request(app)
        .post('/api/v1/translator/tes')
        .set('Authorization', `Bearer ${authToken}`)
        .send(intensiveInput);
      
      expect(response.status).toBe(200);
      
      const translation = response.body.translation;
      // Should transform intensity to vulnerability
      expect(translation.inner.toLowerCase()).toMatch(/angry|frustrated|upset/);
      expect(translation.under.toLowerCase()).toMatch(/afraid|fear|worry|scared/);
      expect(translation.checks.non_meanness).toBe(true);
    });
    
    it('should preserve important context', async () => {
      const contextualInput = {
        input_text: "After working all day, coming home to a messy house makes me feel unappreciated"
      };
      
      const response = await request(app)
        .post('/api/v1/translator/tes')
        .set('Authorization', `Bearer ${authToken}`)
        .send(contextualInput);
      
      expect(response.status).toBe(200);
      
      const translation = response.body.translation;
      // Should preserve work context and house context
      expect(translation.outer.toLowerCase()).toMatch(/work|house|messy/);
      expect(translation.inner.toLowerCase()).toMatch(/unappreciated|tired|overwhelmed/);
    });
  });
});
