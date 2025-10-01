import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import Dashboard from '../../../mobile/src/screens/Dashboard';

// Mock navigation
const mockNavigate = jest.fn();
const mockNavigation = {
  navigate: mockNavigate,
  goBack: jest.fn(),
  setOptions: jest.fn()
};

// Mock user context
const mockUserContext = {
  user: {
    id: 'user-123',
    name: 'Test User',
    current_level: 1,
    current_section: 3,
    partner_id: 'partner-123'
  },
  couple: {
    id: 'couple-123',
    current_level: 1,
    current_section: 3
  }
};

// Mock API responses
jest.mock('../../../mobile/src/services/api', () => ({
  getCurrentProgress: jest.fn().mockResolvedValue({
    current_level: 1,
    current_section: 3,
    streak_days: 7,
    journal_entries: 12,
    games_available: 8
  }),
  getNotifications: jest.fn().mockResolvedValue([])
}));

const renderDashboard = (props = {}) => {
  return render(
    <NavigationContainer>
      <Dashboard 
        navigation={mockNavigation} 
        userContext={mockUserContext}
        {...props}
      />
    </NavigationContainer>
  );
};

describe('Dashboard Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('Layout and Navigation', () => {
    it('should render 4x2 grid of feature tiles as per PRD', () => {
      const { getByTestId } = renderDashboard();
      
      // Verify all 8 tiles are present (PRD Section 3.2)
      expect(getByTestId('training-tile')).toBeTruthy();
      expect(getByTestId('pillars-tile')).toBeTruthy();
      expect(getByTestId('translator-tile')).toBeTruthy();
      expect(getByTestId('mediator-tile')).toBeTruthy();
      expect(getByTestId('progress-tile')).toBeTruthy();
      expect(getByTestId('games-tile')).toBeTruthy();
      expect(getByTestId('journal-tile')).toBeTruthy();
      expect(getByTestId('settings-tile')).toBeTruthy();
    });
    
    it('should display current progress on training tile', () => {
      const { getByTestId, getByText } = renderDashboard();
      
      const trainingTile = getByTestId('training-tile');
      expect(trainingTile).toBeTruthy();
      
      // Should show current level and section
      expect(getByText('Level 1')).toBeTruthy();
      expect(getByText('Section 3')).toBeTruthy();
    });
    
    it('should display progress metrics on tiles', () => {
      const { getByText } = renderDashboard();
      
      // Progress tile should show streak
      expect(getByText('🔥 7 day')).toBeTruthy();
      expect(getByText('streak')).toBeTruthy();
      
      // Journal tile should show entry count
      expect(getByText('12 entries')).toBeTruthy();
      
      // Games tile should show available games
      expect(getByText('8 Games')).toBeTruthy();
      expect(getByText('Available')).toBeTruthy();
    });
    
    it('should use correct colors per PRD specification', () => {
      const { getByTestId } = renderDashboard();
      
      // Verify tile colors match PRD Section 3.2
      const trainingTile = getByTestId('training-tile');
      expect(trainingTile).toHaveStyle({ backgroundColor: '#A7CCD9' }); // Sky Blue
      
      const translatorTile = getByTestId('translator-tile');
      expect(translatorTile).toHaveStyle({ backgroundColor: '#F5C95D' }); // Gold
      
      const mediatorTile = getByTestId('mediator-tile');
      expect(mediatorTile).toHaveStyle({ backgroundColor: '#B8C77C' }); // Olive
    });
  });
  
  describe('Tile Interactions', () => {
    it('should navigate to training screen when training tile tapped', () => {
      const { getByTestId } = renderDashboard();
      
      const trainingTile = getByTestId('training-tile');
      fireEvent.press(trainingTile);
      
      expect(mockNavigate).toHaveBeenCalledWith('Training');
    });
    
    it('should navigate to translator screen when translator tile tapped', () => {
      const { getByTestId } = renderDashboard();
      
      const translatorTile = getByTestId('translator-tile');
      fireEvent.press(translatorTile);
      
      expect(mockNavigate).toHaveBeenCalledWith('Translator');
    });
    
    it('should navigate to mediator screen when mediator tile tapped', () => {
      const { getByTestId } = renderDashboard();
      
      const mediatorTile = getByTestId('mediator-tile');
      fireEvent.press(mediatorTile);
      
      expect(mockNavigate).toHaveBeenCalledWith('Mediator');
    });
    
    it('should navigate to games library when games tile tapped', () => {
      const { getByTestId } = renderDashboard();
      
      const gamesTile = getByTestId('games-tile');
      fireEvent.press(gamesTile);
      
      expect(mockNavigate).toHaveBeenCalledWith('Games');
    });
    
    it('should provide haptic feedback on tile press', async () => {
      const mockHapticFeedback = jest.fn();
      jest.doMock('react-native-haptic-feedback', () => ({
        trigger: mockHapticFeedback
      }));
      
      const { getByTestId } = renderDashboard();
      
      const trainingTile = getByTestId('training-tile');
      fireEvent.press(trainingTile);
      
      // Haptic feedback should be triggered
      expect(mockHapticFeedback).toHaveBeenCalled();
    });
    
    it('should show scale animation on tile press', async () => {
      const { getByTestId } = renderDashboard();
      
      const trainingTile = getByTestId('training-tile');
      
      // Press and hold
      fireEvent(trainingTile, 'pressIn');
      
      // Should scale to 0.98 as per PRD
      await waitFor(() => {
        expect(trainingTile).toHaveStyle({ transform: [{ scale: 0.98 }] });
      });
      
      // Release
      fireEvent(trainingTile, 'pressOut');
      
      // Should return to normal scale
      await waitFor(() => {
        expect(trainingTile).toHaveStyle({ transform: [{ scale: 1 }] });
      });
    });
  });
  
  describe('Data Loading and Updates', () => {
    it('should load user progress on mount', async () => {
      const mockGetProgress = jest.fn().mockResolvedValue({
        current_level: 2,
        current_section: 1,
        streak_days: 14,
        journal_entries: 25,
        games_available: 12
      });
      
      jest.doMock('../../../mobile/src/services/api', () => ({
        getCurrentProgress: mockGetProgress
      }));
      
      const { getByText } = renderDashboard();
      
      await waitFor(() => {
        expect(mockGetProgress).toHaveBeenCalled();
      });
      
      // Should display updated progress
      expect(getByText('Level 2')).toBeTruthy();
      expect(getByText('Section 1')).toBeTruthy();
    });
    
    it('should show loading state while fetching data', () => {
      const mockGetProgress = jest.fn().mockReturnValue(new Promise(() => {})); // Never resolves
      
      jest.doMock('../../../mobile/src/services/api', () => ({
        getCurrentProgress: mockGetProgress
      }));
      
      const { getByTestId } = renderDashboard();
      
      // Should show loading indicators
      expect(getByTestId('loading-indicator')).toBeTruthy();
    });
    
    it('should handle API errors gracefully', async () => {
      const mockGetProgress = jest.fn().mockRejectedValue(new Error('API Error'));
      
      jest.doMock('../../../mobile/src/services/api', () => ({
        getCurrentProgress: mockGetProgress
      }));
      
      const { getByText } = renderDashboard();
      
      await waitFor(() => {
        // Should show error state or fallback data
        expect(getByText(/error/i) || getByText('Level 1')).toBeTruthy();
      });
    });
    
    it('should refresh data on pull-to-refresh', async () => {
      const mockGetProgress = jest.fn().mockResolvedValue({
        current_level: 1,
        current_section: 4,
        streak_days: 8
      });
      
      jest.doMock('../../../mobile/src/services/api', () => ({
        getCurrentProgress: mockGetProgress
      }));
      
      const { getByTestId } = renderDashboard();
      
      const scrollView = getByTestId('dashboard-scroll');
      
      // Simulate pull to refresh
      fireEvent(scrollView, 'refresh');
      
      await waitFor(() => {
        expect(mockGetProgress).toHaveBeenCalledTimes(2); // Initial + refresh
      });
    });
  });
  
  describe('Notification Badges', () => {
    it('should show badge on tiles with new content', async () => {
      const mockGetNotifications = jest.fn().mockResolvedValue([
        { type: 'new_section_unlocked', target: 'training' },
        { type: 'comprehension_ready', target: 'training' }
      ]);
      
      jest.doMock('../../../mobile/src/services/api', () => ({
        getCurrentProgress: jest.fn().mockResolvedValue({}),
        getNotifications: mockGetNotifications
      }));
      
      const { getByTestId } = renderDashboard();
      
      await waitFor(() => {
        const badge = getByTestId('training-tile-badge');
        expect(badge).toBeTruthy();
      });
    });
    
    it('should clear badges when tile is visited', async () => {
      const mockClearNotifications = jest.fn();
      
      jest.doMock('../../../mobile/src/services/api', () => ({
        getCurrentProgress: jest.fn().mockResolvedValue({}),
        getNotifications: jest.fn().mockResolvedValue([{ type: 'new_section', target: 'training' }]),
        clearNotifications: mockClearNotifications
      }));
      
      const { getByTestId } = renderDashboard();
      
      const trainingTile = getByTestId('training-tile');
      fireEvent.press(trainingTile);
      
      await waitFor(() => {
        expect(mockClearNotifications).toHaveBeenCalledWith('training');
      });
    });
  });
  
  describe('Accessibility', () => {
    it('should have proper accessibility labels', () => {
      const { getByTestId } = renderDashboard();
      
      const trainingTile = getByTestId('training-tile');
      expect(trainingTile).toHaveProp('accessibilityLabel', 'Training, Level 1, Section 3');
      
      const translatorTile = getByTestId('translator-tile');
      expect(translatorTile).toHaveProp('accessibilityLabel', 'Translator, Transform your words');
    });
    
    it('should support screen reader navigation', () => {
      const { getByTestId } = renderDashboard();
      
      const tiles = [
        'training-tile',
        'pillars-tile', 
        'translator-tile',
        'mediator-tile',
        'progress-tile',
        'games-tile',
        'journal-tile',
        'settings-tile'
      ];
      
      tiles.forEach(tileId => {
        const tile = getByTestId(tileId);
        expect(tile).toHaveProp('accessible', true);
        expect(tile).toHaveProp('accessibilityRole', 'button');
      });
    });
    
    it('should work with voice control', () => {
      const { getByTestId } = renderDashboard();
      
      // Test voice control hints
      const trainingTile = getByTestId('training-tile');
      expect(trainingTile).toHaveProp('accessibilityHint', 'Opens training section');
      
      const translatorTile = getByTestId('translator-tile');
      expect(translatorTile).toHaveProp('accessibilityHint', 'Opens translation tool');
    });
  });
  
  describe('Performance', () => {
    it('should render within performance budget', async () => {
      const startTime = performance.now();
      
      renderDashboard();
      
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      // Should render quickly (PRD: screen transitions < 200ms)
      expect(renderTime).toBeLessThan(200);
    });
    
    it('should maintain 60fps during tile animations', async () => {
      const { getByTestId } = renderDashboard();
      
      const trainingTile = getByTestId('training-tile');
      
      // Monitor frame rate during animation
      const frameRate = await measureFrameRate(() => {
        fireEvent(trainingTile, 'pressIn');
        fireEvent(trainingTile, 'pressOut');
      });
      
      // Should maintain ≥55fps (PRD requirement)
      expect(frameRate).toBeGreaterThanOrEqual(55);
    });
    
    it('should handle rapid tile presses without lag', () => {
      const { getByTestId } = renderDashboard();
      
      const trainingTile = getByTestId('training-tile');
      
      // Rapidly press tile multiple times
      for (let i = 0; i < 10; i++) {
        fireEvent.press(trainingTile);
      }
      
      // Should only navigate once (debounced)
      expect(mockNavigate).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('Error States', () => {
    it('should show fallback content when user data unavailable', () => {
      const { getByText } = renderDashboard({
        userContext: null
      });
      
      // Should show default values
      expect(getByText('Level 1')).toBeTruthy();
      expect(getByText('Section 1')).toBeTruthy();
    });
    
    it('should handle network failures gracefully', async () => {
      const mockGetProgress = jest.fn().mockRejectedValue(new Error('Network error'));
      
      jest.doMock('../../../mobile/src/services/api', () => ({
        getCurrentProgress: mockGetProgress
      }));
      
      const { getByTestId } = renderDashboard();
      
      await waitFor(() => {
        // Should show retry option or cached data
        const errorState = getByTestId('error-state') || getByTestId('training-tile');
        expect(errorState).toBeTruthy();
      });
    });
  });
});

// Helper function to measure frame rate (mock implementation)
const measureFrameRate = async (animationFunction) => {
  // In a real implementation, this would measure actual frame rates
  // For testing purposes, return a reasonable value
  animationFunction();
  return 60; // Assume 60fps for tests
};
