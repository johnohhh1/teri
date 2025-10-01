import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useApi } from '../../context/ApiContext';
import { colors } from '../../styles/colors';

interface ProgressData {
  current_streak: number;
  longest_streak: number;
  level_progress: {
    level: number;
    title: string;
    sections_complete: number;
    total_sections: number;
    percentage: number;
    unlocked: boolean;
  }[];
  tool_usage: {
    translator: number;
    mediator: number;
    games_played: number;
  };
  individual_stats: {
    my_stats: {
      sections_complete: number;
      avg_score: number;
      journal_entries: number;
    };
    partner_stats: {
      sections_complete: number;
      avg_score: number;
      journal_entries: number;
    };
  };
  milestones: {
    title: string;
    completed: boolean;
  }[];
}

const ProgressScreen: React.FC = () => {
  const { api } = useApi();
  const [progressData, setProgressData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProgressData();
  }, []);

  const loadProgressData = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/v1/progress/stats');
      setProgressData(response.data);
    } catch (error) {
      console.error('Error loading progress data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.skyBlue} />
          <Text style={styles.loadingText}>Loading your progress...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!progressData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load progress data</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Progress</Text>
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>Your Journey Together</Text>

        {/* Streak Section */}
        <View style={styles.streakCard}>
          <Text style={styles.streakTitle}>🔥 Current Streak: {progressData.current_streak} days</Text>
          <Text style={styles.streakSubtitle}>🏆 Longest Streak: {progressData.longest_streak} days</Text>
        </View>

        {/* Level Progress */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>— Level Progress —</Text>

          {progressData.level_progress.map((level) => (
            <View key={level.level} style={styles.levelCard}>
              <View style={styles.levelHeader}>
                <Text style={styles.levelTitle}>Level {level.level}: {level.title}</Text>
                <Text style={styles.levelPercentage}>{level.percentage}%</Text>
              </View>

              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${level.percentage}%` },
                  ]}
                />
              </View>

              <Text style={styles.levelStats}>
                {level.sections_complete} of {level.total_sections} sections complete
              </Text>

              {!level.unlocked && (
                <Text style={styles.lockedText}>🔒 Unlocks after previous level</Text>
              )}
            </View>
          ))}
        </View>

        {/* Tool Usage */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>— Tool Usage —</Text>
          <View style={styles.toolStats}>
            <Text style={styles.toolStat}>Translator: {progressData.tool_usage.translator} uses</Text>
            <Text style={styles.toolStat}>Mediator: {progressData.tool_usage.mediator} uses</Text>
            <Text style={styles.toolStat}>Games played: {progressData.tool_usage.games_played}</Text>
          </View>
        </View>

        {/* Individual Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>— Individual Stats —</Text>
          <View style={styles.statsComparison}>
            <View style={styles.statsColumn}>
              <Text style={styles.statsColumnTitle}>You</Text>
              <Text style={styles.statItem}>
                Sections: {progressData.individual_stats.my_stats.sections_complete}
              </Text>
              <Text style={styles.statItem}>
                Avg Score: {Math.round(progressData.individual_stats.my_stats.avg_score * 100)}%
              </Text>
              <Text style={styles.statItem}>
                Journal: {progressData.individual_stats.my_stats.journal_entries} entries
              </Text>
            </View>

            <View style={styles.statsColumn}>
              <Text style={styles.statsColumnTitle}>Partner</Text>
              <Text style={styles.statItem}>
                Sections: {progressData.individual_stats.partner_stats.sections_complete}
              </Text>
              <Text style={styles.statItem}>
                Avg Score: {Math.round(progressData.individual_stats.partner_stats.avg_score * 100)}%
              </Text>
              <Text style={styles.statItem}>
                Journal: {progressData.individual_stats.partner_stats.journal_entries} entries
              </Text>
            </View>
          </View>
        </View>

        {/* Milestones */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>— Milestones —</Text>
          {progressData.milestones.map((milestone, index) => (
            <View key={index} style={styles.milestoneItem}>
              <Text style={styles.milestoneIcon}>
                {milestone.completed ? '✅' : '⬜'}
              </Text>
              <Text
                style={[
                  styles.milestoneText,
                  milestone.completed && styles.completedMilestone,
                ]}
              >
                {milestone.title}
              </Text>
            </View>
          ))}
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
  header: {
    padding: 24,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 24,
  },
  streakCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    alignItems: 'center',
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  streakTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  streakSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 20,
  },
  levelCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  levelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  levelTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  levelPercentage: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.skyBlue,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.lightGray,
    borderRadius: 4,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.skyBlue,
    borderRadius: 4,
  },
  levelStats: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  lockedText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 4,
  },
  toolStats: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 20,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  toolStat: {
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  statsComparison: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 20,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statsColumn: {
    flex: 1,
    paddingHorizontal: 8,
  },
  statsColumnTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
    paddingBottom: 8,
  },
  statItem: {
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  milestoneItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  milestoneIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  milestoneText: {
    fontSize: 16,
    color: colors.textSecondary,
    flex: 1,
  },
  completedMilestone: {
    color: colors.textPrimary,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: colors.error,
  },
});

export default ProgressScreen;