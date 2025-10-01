const { device, element, by, expect: detoxExpect } = require('detox');
const request = require('supertest');
const { testHelpers, performanceHelpers } = global;

/**
 * End-to-End User Journey Tests
 * 
 * Tests complete user flows from PRD Section 1.3:
 * 1. Download app → Create individual account
 * 2. Pair with partner via invite code
 * 3. Begin Level 1, Section 1 training
 * 4. Both complete content → 24hr settle timer
 * 5. Both pass comprehension (≥80%) → Next section unlocks
 * 6. During conflicts: Use Translator/Mediator tools
 * 7. Receive contextual game suggestions
 * 8. Progress through 7 levels over ~90 days
 */
describe('End-to-End User Journey', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });
  
  beforeEach(async () => {
    await device.reloadReactNative();
    await testHelpers.cleanDatabase();
  });
  
  describe('Complete Onboarding Flow', () => {
    it('should complete full registration and pairing flow', async () => {
      // Step 1: App launch and welcome screen
      await detoxExpect(element(by.text('Transform Your Relationship'))).toBeVisible();
      
      // Step 2: Registration
      await element(by.text('Sign Up')).tap();
      
      await element(by.id('email-input')).typeText('user1@e2etest.com');
      await element(by.id('password-input')).typeText('SecurePass123!');
      await element(by.id('name-input')).typeText('Test User 1');
      
      const registrationStart = performance.now();
      await element(by.text('Create Account')).tap();
      
      // Should navigate to pairing screen
      await detoxExpect(element(by.text('Connect with Your Partner'))).toBeVisible();
      const registrationTime = performance.now() - registrationStart;
      
      // Performance: Registration should be fast
      expect(registrationTime).toBeLessThan(3000);
      
      // Step 3: Generate pairing code
      await element(by.text('Generate Code')).tap();
      
      // Should display 8-character code
      await detoxExpect(element(by.id('pairing-code'))).toBeVisible();
      
      // Simulate partner joining (in real test, would use second device)
      const pairingCode = await element(by.id('pairing-code')).getText();
      
      // Register second user via API (simulating partner's device)
      const partner = await testHelpers.createTestUser({ email: 'user2@e2etest.com' });
      
      // Complete pairing flow
      await element(by.text('Enter Partner Code')).tap();
      await element(by.id('code-input')).typeText(pairingCode);
      await element(by.text('Join')).tap();
      
      // Should show pairing success
      await detoxExpect(element(by.text('You\'re Paired!'))).toBeVisible();
      
      // Should navigate to dashboard
      await element(by.text('Continue')).tap();
      await detoxExpect(element(by.id('dashboard'))).toBeVisible();
    });
    
    it('should handle pairing errors gracefully', async () => {
      // Register first user
      await element(by.text('Sign Up')).tap();
      await element(by.id('email-input')).typeText('error@e2etest.com');
      await element(by.id('password-input')).typeText('SecurePass123!');
      await element(by.id('name-input')).typeText('Error Test');
      await element(by.text('Create Account')).tap();
      
      // Try invalid pairing code
      await element(by.text('Enter Partner Code')).tap();
      await element(by.id('code-input')).typeText('INVALID1');
      await element(by.text('Join')).tap();
      
      // Should show error message
      await detoxExpect(element(by.text('Invalid pairing code'))).toBeVisible();
      
      // Should allow retry
      await element(by.id('code-input')).clearText();
      await element(by.id('code-input')).typeText('EXPIRED2');
      await element(by.text('Join')).tap();
      
      await detoxExpect(element(by.text('Code expired'))).toBeVisible();
    });
  });
  
  describe('Training Flow Journey', () => {
    let pairingCode;
    
    beforeEach(async () => {
      // Setup paired users
      await setupPairedUsers();
    });
    
    it('should complete Level 1, Section 1 training flow', async () => {
      // Navigate to training
      await element(by.id('training-tile')).tap();
      
      // Should show training overview
      await detoxExpect(element(by.text('Level 1'))).toBeVisible();
      await detoxExpect(element(by.text('Foundation'))).toBeVisible();
      
      // Start first section
      await element(by.text('Section 1: Welcome & Orientation')).tap();
      
      // Should show section content
      await detoxExpect(element(by.id('section-detail'))).toBeVisible();
      
      // Navigate through book pages
      await element(by.id('book-tab')).tap();
      
      // Swipe through pages
      for (let page = 1; page <= 5; page++) {
        await detoxExpect(element(by.text(`Page ${page} of 5`))).toBeVisible();
        if (page < 5) {
          await element(by.id('book-viewer')).swipe('left');
        }
      }
      
      // Watch videos
      await element(by.id('videos-tab')).tap();
      await element(by.text('Welcome Video')).tap();
      
      // Video should play (mock player)
      await detoxExpected(element(by.id('video-player'))).toBeVisible();
      await element(by.id('video-close')).tap();
      
      // Complete journal entry
      await element(by.id('journal-tab')).tap();
      
      const journalPrompt = 'What brought you to this relationship program?';
      await detoxExpect(element(by.text(journalPrompt))).toBeVisible();
      
      await element(by.id('journal-input')).typeText(
        'We want to improve our communication and build a stronger relationship together.'
      );
      
      await element(by.text('Save')).tap();
      
      // Mark section complete
      await element(by.text('Mark Section Complete')).tap();
      
      // Should show completion confirmation
      await detoxExpect(element(by.text('Section Completed!'))).toBeVisible();
      
      // Should show settle timer message
      await detoxExpect(element(by.text('24-hour settle timer started'))).toBeVisible();
    });
    
    it('should enforce settle timer and comprehension gates', async () => {
      // Complete section as both partners
      await completeSectionAsBothPartners(1, 1);
      
      // Try to access comprehension immediately
      await element(by.text('Take Comprehension Check')).tap();
      
      // Should show timer
      await detoxExpect(element(by.text('Settle timer active'))).toBeVisible();
      await detoxExpect(element(by.text(/hours? remaining/))).toBeVisible();
      
      // Fast-forward timer (API call to simulate)
      await fastForwardSettleTimer();
      
      // Refresh view
      await device.reloadReactNative();
      await navigateToSection(1, 1);
      
      // Should now allow comprehension
      await element(by.text('Take Comprehension Check')).tap();
      
      // Should show quiz interface
      await detoxExpect(element(by.text('Question 1 of 5'))).toBeVisible();
      
      // Answer all questions
      await answerComprehensionQuestions();
      
      // Submit answers
      await element(by.text('Submit Answers')).tap();
      
      // Should show results
      await detoxExpect(element(by.text(/\d+%/))).toBeVisible(); // Score percentage
      
      // If passed (≥80%), should unlock next section
      const scoreText = await element(by.id('score-display')).getText();
      const score = parseInt(scoreText.match(/\d+/)[0]);
      
      if (score >= 80) {
        await detoxExpect(element(by.text('Next Section Unlocked!'))).toBeVisible();
      } else {
        await detoxExpect(element(by.text('Review and try again'))).toBeVisible();
      }
    });
    
    it('should handle comprehension failure flow', async () => {
      // Setup section ready for comprehension
      await setupSectionForComprehension(1, 1);
      
      // Take comprehension and deliberately answer incorrectly
      await element(by.text('Take Comprehension Check')).tap();
      
      // Answer questions incorrectly
      await answerComprehensionQuestions(false); // false = incorrect answers
      
      await element(by.text('Submit Answers')).tap();
      
      // Should show failure result
      await detoxExpect(element(by.text(/[1-7]\d%/))).toBeVisible(); // Score < 80%
      await detoxExpect(element(by.text('Review and try again in 24 hours'))).toBeVisible();
      
      // Should not unlock next section
      await element(by.text('Back to Training')).tap();
      
      await detoxExpect(element(by.text('Section 2'))).not.toBeVisible();
    });
  });
  
  describe('Translator Tool Journey', () => {
    beforeEach(async () => {
      await setupPairedUsers();
    });
    
    it('should complete TES (Truth Empowered Speaking) workflow', async () => {
      // Navigate to translator
      await element(by.id('translator-tile')).tap();
      
      // Should default to TES mode
      await detoxExpect(element(by.text('Truth Empowered Speaking'))).toBeVisible();
      
      // Enter reactive statement
      const reactiveText = "You never help with anything!";
      await element(by.id('input-text')).typeText(reactiveText);
      
      // Translate
      const translationStart = performance.now();
      await element(by.text('Translate')).tap();
      
      // Should show loading state
      await detoxExpect(element(by.id('translation-loading'))).toBeVisible();
      
      // Should show results within 3 seconds (PRD requirement)
      await detoxExpect(element(by.id('translation-results'))).toBeVisible();
      const translationTime = performance.now() - translationStart;
      expect(translationTime).toBeLessThan(3000);
      
      // Verify TES structure
      await detoxExpect(element(by.text('OUTER (Observable)'))).toBeVisible();
      await detoxExpect(element(by.text('INNER (My Experience)'))).toBeVisible();
      await detoxExpect(element(by.text('UNDER (What I Fear)'))).toBeVisible();
      await detoxExpect(element(by.text('ASK (Clear Request)'))).toBeVisible();
      
      // Test copy functionality
      await element(by.id('copy-outer')).tap();
      
      // Should show copy confirmation
      await detoxExpect(element(by.text('Copied to clipboard'))).toBeVisible();
      
      // Test alternative translations
      await element(by.text('Try Another Way')).tap();
      
      // Should show different translation
      await detoxExpect(element(by.id('translation-results'))).toBeVisible();
      
      // Provide feedback
      await element(by.id('helpful-button')).tap();
      
      // Should show thank you message
      await detoxExpect(element(by.text('Thank you for your feedback'))).toBeVisible();
    });
    
    it('should complete TEL (Truth Empowered Listening) workflow', async () => {
      await element(by.id('translator-tile')).tap();
      
      // Switch to TEL mode
      await element(by.text('TEL')).tap();
      
      await detoxExpect(element(by.text('Truth Empowered Listening'))).toBeVisible();
      
      // Enter partner's message
      const partnerMessage = "I felt so alone at the party last night...";
      await element(by.id('input-text')).typeText(partnerMessage);
      
      await element(by.text('Translate')).tap();
      
      // Should show TEL results
      await detoxExpect(element(by.text('OUTER (What They Said)'))).toBeVisible();
      await detoxExpect(element(by.text('UNDERCURRENTS (What They Might Feel)'))).toBeVisible();
      await detoxExpect(element(by.text('WHAT MATTERS (Their Values)'))).toBeVisible();
      await detoxExpected(element(by.text('QUESTIONS TO ASK'))).toBeVisible();
      
      // Verify depth questions are present
      const questions = await element(by.id('depth-questions'));
      await detoxExpect(questions).toBeVisible();
    });
    
    it('should handle translator errors gracefully', async () => {
      await element(by.id('translator-tile')).tap();
      
      // Try empty input
      await element(by.text('Translate')).tap();
      
      await detoxExpect(element(by.text('Please enter some text'))).toBeVisible();
      
      // Try overly long input
      const longText = 'a'.repeat(501);
      await element(by.id('input-text')).typeText(longText);
      await element(by.text('Translate')).tap();
      
      await detoxExpect(element(by.text('Text is too long'))).toBeVisible();
    });
  });
  
  describe('Mediator Tool Journey', () => {
    beforeEach(async () => {
      await setupPairedUsers();
    });
    
    it('should complete audio recording and analysis workflow', async () => {
      // Navigate to mediator
      await element(by.id('mediator-tile')).tap();
      
      await detoxExpect(element(by.text('Record a Moment'))).toBeVisible();
      
      // Start recording
      await element(by.id('record-button')).longPress(3000);
      
      // Should show recording UI
      await detoxExpect(element(by.text('Recording...'))).toBeVisible();
      await detoxExpect(element(by.text(/0:0[1-3]/))).toBeVisible();
      
      // Release to stop
      // Note: In real E2E, this would record actual audio
      
      // Should show audio clip
      await detoxExpect(element(by.text('Audio clip'))).toBeVisible();
      await detoxExpect(element(by.id('play-button'))).toBeVisible();
      
      // Analyze audio
      const analysisStart = performance.now();
      await element(by.text('Analyze')).tap();
      
      // Should show processing state
      await detoxExpect(element(by.text('Analyzing your moment...'))).toBeVisible();
      
      // Should complete within 10 seconds (PRD requirement)
      await detoxExpect(element(by.id('analysis-results'))).toBeVisible();
      const analysisTime = performance.now() - analysisStart;
      expect(analysisTime).toBeLessThan(10000);
      
      // Verify analysis components
      await detoxExpect(element(by.text('Transcript'))).toBeVisible();
      await detoxExpect(element(by.text('What We Heard'))).toBeVisible();
      await detoxExpect(element(by.text('Suggested Games'))).toBeVisible();
      
      // Test game suggestions
      await element(by.id('suggested-game')).tap();
      
      // Should navigate to game detail
      await detoxExpect(element(by.id('game-detail'))).toBeVisible();
    });
    
    it('should enforce recording limits and validation', async () => {
      await element(by.id('mediator-tile')).tap();
      
      // Try very short recording (< 5 seconds)
      await element(by.id('record-button')).longPress(2000);
      
      await detoxExpect(element(by.text('Recording too short'))).toBeVisible();
      
      // Try maximum length recording (60 seconds)
      await element(by.id('record-button')).longPress(61000);
      
      // Should auto-stop at 60 seconds
      await detoxExpect(element(by.text('Maximum recording time reached'))).toBeVisible();
    });
  });
  
  describe('Games Integration Journey', () => {
    beforeEach(async () => {
      await setupPairedUsers();
    });
    
    it('should browse and play available games', async () => {
      await element(by.id('games-tile')).tap();
      
      // Should show games library
      await detoxExpect(element(by.text('Games'))).toBeVisible();
      
      // Should show Level 1 games
      await detoxExpect(element(by.text('Internal Weather Report'))).toBeVisible();
      await detoxExpect(element(by.text('Pause'))).toBeVisible();
      await detoxExpect(element(by.text('Pillar Talk'))).toBeVisible();
      
      // Should show locked games
      await detoxExpect(element(by.text('And What Else? 🔒'))).toBeVisible();
      await detoxExpect(element(by.text('Unlocks at Level 2'))).toBeVisible();
      
      // Play a game
      await element(by.text('Internal Weather Report')).tap();
      
      // Should show game details
      await detoxExpect(element(by.text('2-3 minutes'))).toBeVisible();
      await detoxExpect(element(by.text('Level 1'))).toBeVisible();
      
      await element(by.text('Start Game')).tap();
      
      // Should show game interface
      await detoxExpect(element(by.id('game-timer'))).toBeVisible();
      
      // Complete game
      await element(by.text('Mark Complete')).tap();
      
      // Should show debrief
      await detoxExpect(element(by.text('How was that?'))).toBeVisible();
      
      await element(by.text('Helpful')).tap();
      
      // Should return to games list
      await detoxExpect(element(by.text('Games'))).toBeVisible();
    });
    
    it('should provide contextual game suggestions', async () => {
      // Use translator first to create context
      await element(by.id('translator-tile')).tap();
      await element(by.id('input-text')).typeText('We keep fighting about the same thing');
      await element(by.text('Translate')).tap();
      
      // Navigate to games
      await element(by.text('< Back')).tap();
      await element(by.id('games-tile')).tap();
      
      // Should show suggestions based on context
      await detoxExpect(element(by.text('⭐ Suggested for you'))).toBeVisible();
      
      // Suggested games should be relevant
      await detoxExpect(element(by.text('Bomb Squad')) || element(by.text('Pause'))).toBeVisible();
    });
  });
  
  describe('Progress Tracking Journey', () => {
    beforeEach(async () => {
      await setupPairedUsers();
    });
    
    it('should track and display progress accurately', async () => {
      await element(by.id('progress-tile')).tap();
      
      // Should show progress overview
      await detoxExpect(element(by.text('Your Journey Together'))).toBeVisible();
      
      // Should show streak
      await detoxExpect(element(by.text('🔥 Current Streak: 1 days'))).toBeVisible();
      
      // Should show level progress
      await detoxExpect(element(by.text('Level 1: Foundation'))).toBeVisible();
      await detoxExpect(element(by.text(/\d+% /))).toBeVisible(); // Progress percentage
      
      // Should show individual vs partner stats
      await detoxExpect(element(by.text('You'))).toBeVisible();
      await detoxExpect(element(by.text('Partner'))).toBeVisible();
      
      // Should show tool usage
      await detoxExpect(element(by.text('Translator:'))).toBeVisible();
      await detoxExpect(element(by.text('Mediator:'))).toBeVisible();
      await detoxExpect(element(by.text('Games played:'))).toBeVisible();
    });
    
    it('should update progress in real-time', async () => {
      // Check initial state
      await element(by.id('progress-tile')).tap();
      const initialSections = await element(by.text(/Sections: \d+\/\d+/)).getText();
      
      // Go back and complete a section
      await element(by.text('< Back')).tap();
      await completeSection(1, 1);
      
      // Check updated progress
      await element(by.id('progress-tile')).tap();
      const updatedSections = await element(by.text(/Sections: \d+\/\d+/)).getText();
      
      expect(updatedSections).not.toEqual(initialSections);
    });
  });
  
  describe('Performance and Reliability', () => {
    it('should maintain smooth performance throughout journey', async () => {
      // Test app responsiveness during heavy usage
      const actions = [
        () => element(by.id('training-tile')).tap(),
        () => element(by.text('< Back')).tap(),
        () => element(by.id('translator-tile')).tap(),
        () => element(by.text('< Back')).tap(),
        () => element(by.id('games-tile')).tap(),
        () => element(by.text('< Back')).tap()
      ];
      
      for (const action of actions) {
        const startTime = performance.now();
        await action();
        const actionTime = performance.now() - startTime;
        
        // Each navigation should be under 200ms (PRD requirement)
        expect(actionTime).toBeLessThan(200);
      }
    });
    
    it('should handle network interruptions gracefully', async () => {
      // Simulate network failure
      await device.shake(); // Trigger network failure simulation
      
      await element(by.id('translator-tile')).tap();
      await element(by.id('input-text')).typeText('Network test');
      await element(by.text('Translate')).tap();
      
      // Should show offline message
      await detoxExpect(element(by.text('No internet connection'))).toBeVisible();
      
      // Should offer retry
      await detoxExpected(element(by.text('Retry'))).toBeVisible();
    });
    
    it('should maintain data consistency across app restarts', async () => {
      // Complete some actions
      await completeSection(1, 1);
      await useTranslator('Test message');
      
      // Restart app
      await device.reloadReactNative();
      
      // Verify data is still there
      await element(by.id('progress-tile')).tap();
      
      // Progress should be maintained
      await detoxExpect(element(by.text(/Sections: [1-9]/+\//d))).toBeVisible();
    });
  });
  
  // Helper functions
  
  async function setupPairedUsers() {
    // Register and pair two users for testing
    await element(by.text('Sign Up')).tap();
    await element(by.id('email-input')).typeText('paired1@e2etest.com');
    await element(by.id('password-input')).typeText('SecurePass123!');
    await element(by.id('name-input')).typeText('User 1');
    await element(by.text('Create Account')).tap();
    
    await element(by.text('Generate Code')).tap();
    pairingCode = await element(by.id('pairing-code')).getText();
    
    // Simulate partner joining
    await element(by.text('Enter Partner Code')).tap();
    await element(by.id('code-input')).typeText(pairingCode);
    await element(by.text('Join')).tap();
    
    await element(by.text('Continue')).tap();
  }
  
  async function completeSection(level, section) {
    await element(by.id('training-tile')).tap();
    await element(by.text(`Section ${section}`)).tap();
    
    // Go through all content
    await element(by.id('book-tab')).tap();
    await element(by.id('book-viewer')).swipe('left');
    await element(by.id('videos-tab')).tap();
    await element(by.id('journal-tab')).tap();
    await element(by.id('journal-input')).typeText('Test journal entry');
    await element(by.text('Save')).tap();
    
    await element(by.text('Mark Section Complete')).tap();
  }
  
  async function completeSectionAsBothPartners(level, section) {
    // In a real test, this would involve two devices
    // For now, simulate both partners completing via API
    await testHelpers.completeSection('user1', level, section);
    await testHelpers.completeSection('user2', level, section);
  }
  
  async function setupSectionForComprehension(level, section) {
    await completeSectionAsBothPartners(level, section);
    await fastForwardSettleTimer();
  }
  
  async function fastForwardSettleTimer() {
    // API call to simulate 24 hour passage
    await testHelpers.fastForwardTime(24 * 60 * 60 * 1000);
  }
  
  async function answerComprehensionQuestions(correct = true) {
    for (let i = 1; i <= 5; i++) {
      if (correct) {
        await element(by.id('answer-a')).tap(); // Assume A is correct
      } else {
        await element(by.id('answer-b')).tap(); // Assume B is incorrect
      }
      
      if (i < 5) {
        await element(by.text('Next')).tap();
      }
    }
  }
  
  async function useTranslator(text) {
    await element(by.id('translator-tile')).tap();
    await element(by.id('input-text')).typeText(text);
    await element(by.text('Translate')).tap();
    await detoxExpect(element(by.id('translation-results'))).toBeVisible();
    await element(by.text('< Back')).tap();
  }
  
  async function navigateToSection(level, section) {
    await element(by.id('training-tile')).tap();
    await element(by.text(`Section ${section}`)).tap();
  }
});
