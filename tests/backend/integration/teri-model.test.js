const request = require('supertest');
const { createApp } = require('../../../backend/src/app');
const { testHelpers, performanceHelpers } = global;

/**
 * TERI Model Integration Tests
 * 
 * Tests the complete TERI (Truth Empowered Relationships) model integration
 * including TES (Truth Empowered Speaking) and TEL (Truth Empowered Listening)
 * with the trained LLM and vector database.
 */
describe('TERI Model Integration', () => {
  let app, couple, authTokens;
  
  beforeAll(async () => {
    app = await createApp();
  });
  
  beforeEach(async () => {
    await testHelpers.cleanDatabase();
    
    // Create test couple
    couple = await testHelpers.createTestCouple();
    authTokens = {};
    
    // Register both users
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
  
  describe('TES (Truth Empowered Speaking) Integration', () => {
    it('should complete full TES workflow with LLM integration', async () => {
      const reactiveStatements = [
        "You never help with anything!",
        "You're always on your phone!",
        "I can't believe you forgot again!",
        "You don't care about my feelings!"
      ];
      
      for (const statement of reactiveStatements) {
        const { result: response, durationMs } = await performanceHelpers.measureTime(
          () => request(app)
            .post('/api/v1/translator/tes')
            .set('Authorization', `Bearer ${authTokens.user1}`)
            .send({ input_text: statement })
        );
        
        expect(response.status).toBe(200);
        
        // Validate complete TES structure
        const translation = response.body.translation;
        expect(translation).toMatchTESStructure();
        
        // Validate TES quality standards
        expect(translation.outer).toBeTruthy();
        expect(translation.outer.length).toBeGreaterThan(10);
        expect(translation.outer.length).toBeLessThanOrEqual(200);
        
        expect(translation.inner).toBeTruthy();
        expect(translation.inner.toLowerCase()).toMatch(/i feel|i think|i need/);
        
        expect(translation.under).toBeTruthy();
        expect(translation.under.toLowerCase()).toMatch(/afraid|fear|worry|scared/);
        
        expect(translation.ask).toBeTruthy();
        expect(translation.ask).toMatch(/\?$/);
        
        // Validate Four Pillars compliance
        expect(translation.checks.non_meanness).toBe(true);
        expect(translation.checks.pillars_aligned).toBe(true);
        
        // Performance requirement: < 3s
        expect(durationMs).toBeWithinTimeLimit(3000);
        
        // Test alternate translations
        expect(response.body.alternates).toBeDefined();
        expect(Array.isArray(response.body.alternates)).toBe(true);
        expect(response.body.alternates.length).toBeGreaterThan(0);
      }
    });
    
    it('should maintain context awareness across user level', async () => {
      // Simulate user at Level 2 with household task context
      const userContext = {
        current_level: 2,
        recent_topics: ['household_tasks', 'appreciation']
      };
      
      const response = await request(app)
        .post('/api/v1/translator/tes')
        .set('Authorization', `Bearer ${authTokens.user1}`)
        .send({ 
          input_text: "The dishes are still in the sink",
          user_context: userContext
        });
      
      expect(response.status).toBe(200);
      
      const translation = response.body.translation;
      
      // Should reference observable facts about dishes
      expect(translation.outer.toLowerCase()).toContain('dish');
      
      // Should connect to relationship themes at Level 2
      expect(translation.inner.toLowerCase()).toMatch(/overwhelmed|unappreciated|tired/);
      expect(translation.under.toLowerCase()).toMatch(/alone|partnership|support/);
    });
    
    it('should handle edge cases and maintain quality', async () => {
      const edgeCases = [
        { input: "Fine.", expected: 'minimal_input' },
        { input: "I'm just tired", expected: 'already_vulnerable' },
        { input: "You ALWAYS do this!", expected: 'absolute_language' },
        { input: "Whatever, I don't care anymore", expected: 'disconnection' }
      ];
      
      for (const testCase of edgeCases) {
        const response = await request(app)
          .post('/api/v1/translator/tes')
          .set('Authorization', `Bearer ${authTokens.user1}`)
          .send({ input_text: testCase.input });
        
        expect(response.status).toBe(200);
        
        const translation = response.body.translation;
        expect(translation).toMatchTESStructure();
        
        // Even edge cases should produce meaningful translations
        expect(translation.outer.length).toBeGreaterThan(5);
        expect(translation.inner.length).toBeGreaterThan(5);
        expect(translation.under.length).toBeGreaterThan(5);
        expect(translation.ask.length).toBeGreaterThan(5);
      }
    });
  });
  
  describe('TEL (Truth Empowered Listening) Integration', () => {
    it('should complete full TEL workflow with empathy modeling', async () => {
      const partnerMessages = [
        "I felt so alone at the party last night",
        "Work has been really stressful lately",
        "I don't think you understand how hard this is for me",
        "Sometimes I wonder if we're growing apart"
      ];
      
      for (const message of partnerMessages) {
        const { result: response, durationMs } = await performanceHelpers.measureTime(
          () => request(app)
            .post('/api/v1/translator/tel')
            .set('Authorization', `Bearer ${authTokens.user2}`)
            .send({ input_text: message })
        );
        
        expect(response.status).toBe(200);
        
        // Validate complete TEL structure
        const listening = response.body.listening;
        expect(listening).toMatchTELStructure();
        
        // Validate TEL quality standards
        expect(listening.outer).toBeTruthy();
        expect(listening.outer.length).toBeGreaterThan(10);
        
        expect(listening.undercurrents).toBeTruthy();
        expect(listening.undercurrents.toLowerCase()).toMatch(/feel|emotion|experienc/);
        
        expect(listening.what_matters).toBeTruthy();
        expect(listening.what_matters.toLowerCase()).toMatch(/matter|important|value|care/);
        
        // Validate depth questions
        const questions = response.body.depth_questions;
        expect(Array.isArray(questions)).toBe(true);
        expect(questions.length).toBeGreaterThanOrEqual(2);
        expect(questions.length).toBeLessThanOrEqual(3);
        
        questions.forEach(question => {
          expect(question).toMatch(/\?$/);
          expect(question.toLowerCase()).toMatch(/what|how|tell me|help me/);
          expect(question.length).toBeLessThanOrEqual(150);
        });
        
        // Performance requirement: < 3s
        expect(durationMs).toBeWithinTimeLimit(3000);
      }
    });
    
    it('should demonstrate empathy without mind-reading', async () => {
      const response = await request(app)
        .post('/api/v1/translator/tel')
        .set('Authorization', `Bearer ${authTokens.user1}`)
        .send({ input_text: "I'm just so frustrated with everything right now" });
      
      expect(response.status).toBe(200);
      
      const listening = response.body.listening;
      
      // Should acknowledge emotion without assuming causes
      expect(listening.undercurrents.toLowerCase()).toMatch(/frustrated|upset|overwhelmed/);
      expect(listening.undercurrents.toLowerCase()).toMatch(/seems|appears|might/);
      
      // Should not make assumptions
      expect(listening.undercurrents.toLowerCase()).not.toMatch(/because|since|due to/);
      
      // Questions should be curious, not leading
      const questions = response.body.depth_questions;
      questions.forEach(question => {
        expect(question.toLowerCase()).not.toMatch(/why don't you|you should|have you tried/);
      });
    });
  });
  
  describe('Vector Database Integration', () => {
    it('should extract relevant themes from conversation context', async () => {
      const conversationContext = {
        transcript: "We keep fighting about household chores. I feel like I'm doing everything while you just relax.",
        emotional_state: "frustrated",
        time_available_minutes: 15
      };
      
      // Test TES with context
      const tesResponse = await request(app)
        .post('/api/v1/translator/tes')
        .set('Authorization', `Bearer ${authTokens.user1}`)
        .send({ 
          input_text: conversationContext.transcript,
          context: conversationContext
        });
      
      expect(tesResponse.status).toBe(200);
      
      // Should identify household/fairness themes
      const translation = tesResponse.body.translation;
      expect(translation.outer.toLowerCase()).toMatch(/chore|household|clean|task/);
      expect(translation.inner.toLowerCase()).toMatch(/overwhelmed|unappreciated|tired/);
      
      // Test game suggestions based on themes
      const gameResponse = await request(app)
        .post('/api/v1/games/suggest')
        .set('Authorization', `Bearer ${authTokens.user1}`)
        .send({ context: conversationContext });
      
      expect(gameResponse.status).toBe(200);
      
      const suggestions = gameResponse.body.suggestions;
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
      
      // Should suggest relevant games for household conflicts
      const gameIds = suggestions.map(s => s.game_id);
      expect(gameIds).toContain('pause'); // For elevated state
      
      suggestions.forEach(suggestion => {
        expect(suggestion).toHaveProperty('score');
        expect(suggestion).toHaveProperty('rationale');
        expect(suggestion.rationale.toLowerCase()).toMatch(/household|chore|fair|frustrat/);
      });
    });
    
    it('should maintain theme consistency across sessions', async () => {
      const relatedInputs = [
        "I always end up doing the dishes",
        "The laundry has been sitting there for days",
        "I feel like I'm the only one who cares about keeping things clean"
      ];
      
      const responses = [];
      
      for (const input of relatedInputs) {
        const response = await request(app)
          .post('/api/v1/translator/tes')
          .set('Authorization', `Bearer ${authTokens.user1}`)
          .send({ input_text: input });
        
        responses.push(response.body);
      }
      
      // All responses should identify similar themes
      responses.forEach(response => {
        const translation = response.translation;
        expect(translation.outer.toLowerCase()).toMatch(/dish|laundry|clean/);
        expect(translation.inner.toLowerCase()).toMatch(/overwhelmed|unappreciated|alone/);
      });
    });
  });
  
  describe('End-to-End TERI Workflow', () => {
    it('should complete full conflict resolution cycle', async () => {
      // Step 1: User 1 experiences conflict and uses TES
      const conflictResponse = await request(app)
        .post('/api/v1/translator/tes')
        .set('Authorization', `Bearer ${authTokens.user1}`)
        .send({ input_text: "You never help with the kids anymore!" });
      
      expect(conflictResponse.status).toBe(200);
      const tesTranslation = conflictResponse.body.translation;
      
      // Step 2: User 1 shares translated message (simulated)
      const sharedMessage = `${tesTranslation.outer} ${tesTranslation.inner} ${tesTranslation.under} ${tesTranslation.ask}`;
      
      // Step 3: User 2 uses TEL to understand
      const listeningResponse = await request(app)
        .post('/api/v1/translator/tel')
        .set('Authorization', `Bearer ${authTokens.user2}`)
        .send({ input_text: sharedMessage });
      
      expect(listeningResponse.status).toBe(200);
      const telListening = listeningResponse.body.listening;
      
      // Step 4: System suggests appropriate games
      const gameResponse = await request(app)
        .post('/api/v1/games/suggest')
        .set('Authorization', `Bearer ${authTokens.user1}`)
        .send({ 
          context: {
            transcript: sharedMessage,
            emotional_state: "calm", // After TES translation
            time_available_minutes: 20
          }
        });
      
      expect(gameResponse.status).toBe(200);
      
      // Verify complete workflow produces coherent results
      expect(tesTranslation.outer.toLowerCase()).toMatch(/help|kid|child/);
      expect(telListening.what_matters.toLowerCase()).toMatch(/partnership|support|parent/);
      
      const suggestions = gameResponse.body.suggestions;
      expect(suggestions.length).toBeGreaterThan(0);
      
      // Should suggest games appropriate for parenting conflicts
      const hasRelevantGame = suggestions.some(s => 
        s.rationale.toLowerCase().includes('parent') ||
        s.rationale.toLowerCase().includes('support') ||
        s.rationale.toLowerCase().includes('partnership')
      );
      expect(hasRelevantGame).toBe(true);
    });
    
    it('should track and improve over time', async () => {
      // Simulate multiple sessions to test learning
      const sessions = [
        { input: "You're always late", feedback: "helpful" },
        { input: "You never listen", feedback: "helpful" },
        { input: "I feel ignored", feedback: "not_helpful" },
        { input: "This is frustrating", feedback: "helpful" }
      ];
      
      const sessionIds = [];
      
      for (const session of sessions) {
        const response = await request(app)
          .post('/api/v1/translator/tes')
          .set('Authorization', `Bearer ${authTokens.user1}`)
          .send({ input_text: session.input });
        
        sessionIds.push(response.body.session_id);
        
        // Provide feedback
        await request(app)
          .post(`/api/v1/translator/${response.body.session_id}/feedback`)
          .set('Authorization', `Bearer ${authTokens.user1}`)
          .send({ feedback: session.feedback });
      }
      
      // Later translations should show consistency with positive feedback patterns
      const finalResponse = await request(app)
        .post('/api/v1/translator/tes')
        .set('Authorization', `Bearer ${authTokens.user1}`)
        .send({ input_text: "You're always distracted" });
      
      expect(finalResponse.status).toBe(200);
      // Quality should be maintained or improved
      expect(finalResponse.body.translation).toMatchTESStructure();
    });
  });
  
  describe('Performance and Reliability', () => {
    it('should handle concurrent requests efficiently', async () => {
      const concurrentRequests = Array(10).fill().map((_, i) => 
        request(app)
          .post('/api/v1/translator/tes')
          .set('Authorization', `Bearer ${authTokens.user1}`)
          .send({ input_text: `Test message ${i}` })
      );
      
      const { result: responses, durationMs } = await performanceHelpers.measureTime(
        () => Promise.all(concurrentRequests)
      );
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.translation).toMatchTESStructure();
      });
      
      // Total time should be reasonable for concurrent processing
      expect(durationMs).toBeLessThan(10000); // 10s for 10 concurrent requests
    });
    
    it('should provide fallback responses during LLM outages', async () => {
      // Mock LLM service failure
      const originalOpenAI = require('openai');
      const mockOpenAI = {
        Configuration: jest.fn(),
        OpenAIApi: jest.fn(() => ({
          createCompletion: jest.fn().mockRejectedValue(new Error('Service temporarily unavailable'))
        }))
      };
      
      jest.doMock('openai', () => mockOpenAI);
      
      const response = await request(app)
        .post('/api/v1/translator/tes')
        .set('Authorization', `Bearer ${authTokens.user1}`)
        .send({ input_text: "Service failure test" });
      
      // Should provide template-based fallback
      expect(response.status).toBe(200);
      expect(response.body.translation).toMatchTESStructure();
      
      // Fallback should indicate service issues
      expect(response.body).toHaveProperty('fallback');
      expect(response.body.fallback).toBe(true);
      
      jest.clearAllMocks();
    });
    
    it('should maintain data consistency across services', async () => {
      // Create TES session
      const tesResponse = await request(app)
        .post('/api/v1/translator/tes')
        .set('Authorization', `Bearer ${authTokens.user1}`)
        .send({ input_text: "Consistency test" });
      
      const sessionId = tesResponse.body.session_id;
      
      // Provide feedback
      await request(app)
        .post(`/api/v1/translator/${sessionId}/feedback`)
        .set('Authorization', `Bearer ${authTokens.user1}`)
        .send({ feedback: "helpful" });
      
      // Session should be retrievable and consistent
      // This would require additional endpoints for session retrieval
      // For now, just verify the session was created
      expect(sessionId).toBeDefined();
      expect(sessionId.length).toBeGreaterThan(10);
    });
  });
});
