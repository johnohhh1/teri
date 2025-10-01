import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors } from '../../styles/colors';

interface Results {
  score: number;
  passed: boolean;
  feedback: Array<{
    question_id: string;
    correct?: boolean;
    score?: number;
    feedback?: string;
  }>;
  next_section_unlocked?: boolean;
}

const ResultsScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { level, section, results } = route.params as {
    level: number;
    section: number;
    results: Results;
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return colors.success;
    if (score >= 0.6) return colors.warning;
    return colors.error;
  };

  const getScoreMessage = (score: number, passed: boolean) => {
    if (passed) {
      if (score >= 0.9) return 'Excellent work! 🎉';
      if (score >= 0.8) return 'Great job! ✨';
      return 'Well done! 👏';
    } else {
      return 'Keep studying and try again! 📚';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Results</Text>
        <Text style={styles.subtitle}>
          Level {level}, Section {section}
        </Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Score Display */}
        <View style={styles.scoreCard}>
          <Text
            style={[
              styles.scoreText,
              { color: getScoreColor(results.score) },
            ]}
          >
            {Math.round(results.score * 100)}%
          </Text>

          <View
            style={[
              styles.passBadge,
              {
                backgroundColor: results.passed
                  ? colors.success
                  : colors.error,
              },
            ]}
          >
            <Text style={styles.passBadgeText}>
              {results.passed ? 'PASSED' : 'FAILED'}
            </Text>
          </View>

          <Text style={styles.scoreMessage}>
            {getScoreMessage(results.score, results.passed)}
          </Text>
        </View>

        {/* Feedback */}
        {results.feedback && results.feedback.length > 0 && (
          <View style={styles.feedbackSection}>
            <Text style={styles.feedbackTitle}>— Detailed Feedback —</Text>

            {results.feedback.map((item, index) => (
              <View key={index} style={styles.feedbackItem}>
                <View style={styles.feedbackHeader}>
                  <Text style={styles.feedbackQuestionTitle}>
                    Question {index + 1}
                  </Text>
                  {item.correct !== undefined ? (
                    <Text
                      style={[
                        styles.feedbackResult,
                        { color: item.correct ? colors.success : colors.error },
                      ]}
                    >
                      {item.correct ? '✓ Correct' : '✗ Incorrect'}
                    </Text>
                  ) : item.score !== undefined ? (
                    <Text
                      style={[
                        styles.feedbackResult,
                        { color: getScoreColor(item.score) },
                      ]}
                    >
                      {Math.round(item.score * 100)}%
                    </Text>
                  ) : null}
                </View>

                {item.feedback && (
                  <Text style={styles.feedbackText}>{item.feedback}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Next Steps */}
        <View style={styles.nextStepsSection}>
          <Text style={styles.nextStepsTitle}>— What's Next? —</Text>

          {results.passed ? (
            results.next_section_unlocked ? (
              <View style={styles.nextStepCard}>
                <Text style={styles.successIcon}>🎉</Text>
                <Text style={styles.nextStepText}>
                  Congratulations! You've unlocked the next section.
                  Continue your journey together!
                </Text>
              </View>
            ) : (
              <View style={styles.nextStepCard}>
                <Text style={styles.waitingIcon}>⏳</Text>
                <Text style={styles.nextStepText}>
                  Great work! Wait for your partner to complete their
                  comprehension check, then you'll both unlock the next section.
                </Text>
              </View>
            )
          ) : (
            <View style={styles.nextStepCard}>
              <Text style={styles.retryIcon}>📚</Text>
              <Text style={styles.nextStepText}>
                Review the section materials and try again in 24 hours.
                You need 80% or higher to pass.
              </Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {results.passed && results.next_section_unlocked ? (
            <TouchableOpacity
              style={styles.continueButton}
              onPress={() => {
                navigation.navigate('Training' as never);
              }}
            >
              <Text style={styles.continueButtonText}>Continue to Next Section</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.reviewButton}
              onPress={() => {
                navigation.navigate('SectionDetail' as never, {
                  level,
                  section,
                });
              }}
            >
              <Text style={styles.reviewButtonText}>Review Section</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.dashboardButton}
            onPress={() => {
              navigation.navigate('Dashboard' as never);
            }}
          >
            <Text style={styles.dashboardButtonText}>Back to Dashboard</Text>
          </TouchableOpacity>
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
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  scoreCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginBottom: 32,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  scoreText: {
    fontSize: 64,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  passBadge: {
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 20,
    marginBottom: 16,
  },
  passBadgeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.white,
  },
  scoreMessage: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  feedbackSection: {
    marginBottom: 32,
  },
  feedbackTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 20,
  },
  feedbackItem: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  feedbackHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  feedbackQuestionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  feedbackResult: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  feedbackText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  nextStepsSection: {
    marginBottom: 32,
  },
  nextStepsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 20,
  },
  nextStepCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 24,
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
  successIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  waitingIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  retryIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  nextStepText: {
    fontSize: 16,
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 24,
  },
  actionButtons: {
    gap: 16,
    marginBottom: 32,
  },
  continueButton: {
    backgroundColor: colors.skyBlue,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.white,
  },
  reviewButton: {
    backgroundColor: colors.gold,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  reviewButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.white,
  },
  dashboardButton: {
    backgroundColor: 'transparent',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.textSecondary,
  },
  dashboardButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});

export default ResultsScreen;