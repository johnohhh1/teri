import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useApi } from '../../context/ApiContext';
import { colors } from '../../styles/colors';

interface Section {
  level: number;
  section: number;
  title: string;
  status: 'complete' | 'in_progress' | 'locked';
  my_progress: {
    content_complete: boolean;
    comprehension_score?: number;
  };
  partner_progress: {
    content_complete: boolean;
    comprehension_score?: number;
  };
  settle_timer_remaining_seconds?: number;
  comprehension_available: boolean;
}

const TrainingScreen: React.FC = () => {
  const navigation = useNavigation();
  const { api } = useApi();
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentLevel, setCurrentLevel] = useState(1);

  useEffect(() => {
    loadTrainingData();
  }, []);

  const loadTrainingData = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/v1/training/current');
      setSections(response.data.available_sections || []);
      setCurrentLevel(response.data.current_level || 1);
    } catch (error) {
      console.error('Error loading training data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (section: Section) => {
    switch (section.status) {
      case 'complete':
        return '✅';
      case 'in_progress':
        return '📖';
      case 'locked':
        return '🔒';
      default:
        return '📖';
    }
  };

  const getStatusText = (section: Section) => {
    if (section.status === 'locked') {
      return 'Locked';
    }

    if (section.status === 'complete') {
      return 'Completed';
    }

    if (!section.my_progress.content_complete) {
      return 'Start Reading';
    }

    if (!section.partner_progress.content_complete) {
      return 'Waiting for Partner';
    }

    if (section.settle_timer_remaining_seconds && section.settle_timer_remaining_seconds > 0) {
      const hours = Math.floor(section.settle_timer_remaining_seconds / 3600);
      const minutes = Math.floor((section.settle_timer_remaining_seconds % 3600) / 60);
      return `Settling: ${hours}h ${minutes}m`;
    }

    if (section.comprehension_available) {
      return 'Take Comprehension Check';
    }

    return 'Ready to Continue';
  };

  const getProgressBar = (section: Section) => {
    let progress = 0;

    if (section.my_progress.content_complete) progress += 25;
    if (section.partner_progress.content_complete) progress += 25;
    if (section.settle_timer_remaining_seconds === 0) progress += 25;
    if (section.status === 'complete') progress = 100;

    return progress;
  };

  const handleSectionPress = (section: Section) => {
    if (section.status === 'locked') {
      return;
    }

    if (section.comprehension_available && section.my_progress.content_complete && section.partner_progress.content_complete) {
      navigation.navigate('Comprehension' as never, {
        level: section.level,
        section: section.section,
      });
    } else {
      navigation.navigate('SectionDetail' as never, {
        level: section.level,
        section: section.section,
      });
    }
  };

  const SectionCard: React.FC<{ section: Section }> = ({ section }) => (
    <TouchableOpacity
      style={[
        styles.sectionCard,
        section.status === 'locked' && styles.lockedCard,
      ]}
      onPress={() => handleSectionPress(section)}
      disabled={section.status === 'locked'}
    >
      <View style={styles.cardHeader}>
        <View style={styles.sectionInfo}>
          <Text style={styles.sectionTitle}>
            Level {section.level}, Section {section.section}
          </Text>
          <Text style={styles.sectionSubtitle}>{section.title}</Text>
        </View>
        <Text style={styles.statusIcon}>{getStatusIcon(section)}</Text>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${getProgressBar(section)}%` },
            ]}
          />
        </View>
        <Text style={styles.progressText}>{getProgressBar(section)}%</Text>
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.statusText}>{getStatusText(section)}</Text>

        <View style={styles.partnerStatus}>
          <View style={styles.partnerIndicator}>
            <Text style={styles.partnerLabel}>You</Text>
            <View
              style={[
                styles.indicator,
                section.my_progress.content_complete && styles.indicatorComplete,
              ]}
            />
          </View>
          <View style={styles.partnerIndicator}>
            <Text style={styles.partnerLabel}>Partner</Text>
            <View
              style={[
                styles.indicator,
                section.partner_progress.content_complete && styles.indicatorComplete,
              ]}
            />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.skyBlue} />
          <Text style={styles.loadingText}>Loading your training...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Training</Text>
        <TouchableOpacity
          style={styles.pillarsButton}
          onPress={() => navigation.navigate('PillarsReference' as never)}
        >
          <Text style={styles.pillarsButtonText}>Four Pillars</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollContainer}>
        <Text style={styles.levelTitle}>Level {currentLevel}: Foundation</Text>

        {sections.map((section) => (
          <SectionCard key={`${section.level}-${section.section}`} section={section} />
        ))}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  pillarsButton: {
    backgroundColor: colors.taupe,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  pillarsButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 24,
  },
  levelTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 20,
  },
  sectionCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 20,
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
  lockedCard: {
    opacity: 0.6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  sectionInfo: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  statusIcon: {
    fontSize: 24,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: colors.lightGray,
    borderRadius: 3,
    marginRight: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.skyBlue,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    minWidth: 32,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.skyBlue,
  },
  partnerStatus: {
    flexDirection: 'row',
    gap: 16,
  },
  partnerIndicator: {
    alignItems: 'center',
  },
  partnerLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  indicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.lightGray,
  },
  indicatorComplete: {
    backgroundColor: colors.success,
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
});

export default TrainingScreen;