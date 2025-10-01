import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import HapticFeedback from 'react-native-haptic-feedback';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../context/ApiContext';
import { colors } from '../../styles/colors';

const { width } = Dimensions.get('window');
const TILE_MARGIN = 8;
const TILE_WIDTH = (width - 48 - TILE_MARGIN) / 2; // 24px padding on each side, 8px gap

interface DashboardData {
  currentLevel: number;
  currentSection: number;
  streakDays: number;
  availableGames: number;
  journalEntries: number;
}

const DashboardScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { api } = useApi();
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    currentLevel: 1,
    currentSection: 1,
    streakDays: 0,
    availableGames: 8,
    journalEntries: 0,
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Load current training progress
      const trainingResponse = await api.get('/api/v1/training/current');

      // Load progress stats
      const progressResponse = await api.get('/api/v1/progress/stats');

      // Load journal count
      const journalResponse = await api.get('/api/v1/journal');

      // Load available games
      const gamesResponse = await api.get('/api/v1/games');

      setDashboardData({
        currentLevel: trainingResponse.data.current_level || 1,
        currentSection: trainingResponse.data.current_section || 1,
        streakDays: progressResponse.data.current_streak || 0,
        availableGames: gamesResponse.data.available_games?.length || 8,
        journalEntries: journalResponse.data.entries?.length || 0,
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  const handleTilePress = (destination: string, haptic: boolean = true) => {
    if (haptic) {
      HapticFeedback.trigger('impactLight');
    }

    switch (destination) {
      case 'training':
        navigation.navigate('Training' as never);
        break;
      case 'pillars':
        navigation.navigate('Training' as never, {
          screen: 'PillarsReference'
        } as never);
        break;
      case 'translator':
        navigation.navigate('Tools' as never, {
          screen: 'Translator'
        } as never);
        break;
      case 'mediator':
        navigation.navigate('Tools' as never, {
          screen: 'Mediator'
        } as never);
        break;
      case 'progress':
        navigation.navigate('Progress' as never);
        break;
      case 'games':
        navigation.navigate('Games' as never);
        break;
      case 'journal':
        navigation.navigate('Progress' as never, {
          screen: 'Journal'
        } as never);
        break;
      case 'settings':
        navigation.navigate('Progress' as never, {
          screen: 'Settings'
        } as never);
        break;
    }
  };

  const DashboardTile: React.FC<{
    title: string;
    subtitle: string;
    backgroundColor: string;
    textColor?: string;
    onPress: () => void;
    badge?: boolean;
  }> = ({ title, subtitle, backgroundColor, textColor = colors.white, onPress, badge }) => (
    <TouchableOpacity
      style={[styles.tile, { backgroundColor }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {badge && <View style={styles.badge} />}
      <View style={styles.tileContent}>
        <Text style={[styles.tileTitle, { color: textColor }]}>{title}</Text>
        <Text style={[styles.tileSubtitle, { color: textColor, opacity: 0.8 }]}>
          {subtitle}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>TER</Text>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => handleTilePress('settings')}
          >
            <Text style={styles.profileText}>
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Dashboard Grid */}
        <View style={styles.grid}>
          {/* Row 1 */}
          <View style={styles.row}>
            <DashboardTile
              title="TRAINING"
              subtitle={`Level ${dashboardData.currentLevel}\nSection ${dashboardData.currentSection}`}
              backgroundColor={colors.training}
              onPress={() => handleTilePress('training')}
            />
            <DashboardTile
              title="PILLARS"
              subtitle="Quick Ref"
              backgroundColor={colors.pillars}
              onPress={() => handleTilePress('pillars')}
            />
          </View>

          {/* Row 2 */}
          <View style={styles.row}>
            <DashboardTile
              title="TRANSLATOR"
              subtitle="Translate\nYour Words"
              backgroundColor={colors.translator}
              textColor={colors.textPrimary}
              onPress={() => handleTilePress('translator')}
            />
            <DashboardTile
              title="MEDIATOR"
              subtitle="Record &\nAnalyze"
              backgroundColor={colors.mediator}
              onPress={() => handleTilePress('mediator')}
            />
          </View>

          {/* Row 3 */}
          <View style={styles.row}>
            <DashboardTile
              title="PROGRESS"
              subtitle={`🔥 ${dashboardData.streakDays} day${dashboardData.streakDays !== 1 ? 's' : ''}\nstreak`}
              backgroundColor={colors.progress}
              onPress={() => handleTilePress('progress')}
            />
            <DashboardTile
              title="GAMES"
              subtitle={`${dashboardData.availableGames} Games\nAvailable`}
              backgroundColor={colors.games}
              textColor={colors.textPrimary}
              onPress={() => handleTilePress('games')}
            />
          </View>

          {/* Row 4 */}
          <View style={styles.row}>
            <DashboardTile
              title="JOURNAL"
              subtitle={`${dashboardData.journalEntries} entries`}
              backgroundColor={colors.journal}
              textColor={colors.textPrimary}
              onPress={() => handleTilePress('journal')}
            />
            <DashboardTile
              title="SETTINGS"
              subtitle=""
              backgroundColor={colors.settings}
              onPress={() => handleTilePress('settings')}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgLight,
  },
  scrollContainer: {
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.skyBlue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.white,
  },
  grid: {
    gap: TILE_MARGIN,
  },
  row: {
    flexDirection: 'row',
    gap: TILE_MARGIN,
    marginBottom: TILE_MARGIN,
  },
  tile: {
    width: TILE_WIDTH,
    height: TILE_WIDTH * 0.8, // Slightly rectangular
    borderRadius: 12,
    padding: 16,
    justifyContent: 'space-between',
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  tileContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  tileTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'left',
  },
  tileSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'left',
    lineHeight: 18,
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.error,
  },
});

export default DashboardScreen;