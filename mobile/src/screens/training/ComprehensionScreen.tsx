import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useApi } from '../../context/ApiContext';
import { colors } from '../../styles/colors';

interface Question {
  id: string;
  type: 'multiple_choice' | 'translation' | 'scenario';
  question: string;
  options?: Array<{ id: string; text: string }>;
  correct_answer?: string;
}

interface ComprehensionData {
  questions: Question[];
  available: boolean;
  reason?: string;
}

const ComprehensionScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { level, section } = route.params as { level: number; section: number };
  const { api } = useApi();

  const [comprehensionData, setComprehensionData] = useState<ComprehensionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});

  useEffect(() => {
    loadComprehensionData();
  }, [level, section]);

  const loadComprehensionData = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/v1/training/sections/${level}/${section}/comprehension`);
      setComprehensionData(response.data);
    } catch (error: any) {
      console.error('Error loading comprehension data:', error);
      if (error.response?.status === 423) {
        Alert.alert(
          'Not Ready',
          'The comprehension check is not available yet. Please complete the section content first.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        Alert.alert('Error', 'Failed to load comprehension check');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (questionId: string, answer: any) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer,
    }));
  };

  const submitAnswers = async () => {
    if (!comprehensionData) return;

    // Check if all questions are answered
    const unansweredQuestions = comprehensionData.questions.filter(
      q => !answers[q.id]
    );

    if (unansweredQuestions.length > 0) {
      Alert.alert('Incomplete', 'Please answer all questions before submitting.');
      return;
    }

    setSubmitting(true);

    try {
      const response = await api.post(
        `/api/v1/training/sections/${level}/${section}/comprehension`,
        { answers }
      );

      navigation.navigate('Results' as never, {
        level,
        section,
        results: response.data,
      });
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to submit answers');
    } finally {
      setSubmitting(false);
    }
  };

  const renderQuestion = (question: Question, index: number) => {
    switch (question.type) {
      case 'multiple_choice':
        return (
          <View key={question.id} style={styles.questionCard}>
            <Text style={styles.questionText}>{question.question}</Text>
            {question.options?.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.optionButton,
                  answers[question.id] === option.id && styles.selectedOption,
                ]}
                onPress={() => handleAnswer(question.id, option.id)}
              >
                <Text
                  style={[
                    styles.optionText,
                    answers[question.id] === option.id && styles.selectedOptionText,
                  ]}
                >
                  {option.id}. {option.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        );

      case 'translation':
        return (
          <View key={question.id} style={styles.questionCard}>
            <Text style={styles.questionText}>{question.question}</Text>
            <View style={styles.translationInputs}>
              {['outer', 'inner', 'under', 'ask'].map((field) => (
                <View key={field} style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    {field.toUpperCase()}:
                  </Text>
                  <TextInput
                    style={styles.textInput}
                    value={answers[question.id]?.[field] || ''}
                    onChangeText={(text) =>
                      handleAnswer(question.id, {
                        ...answers[question.id],
                        [field]: text,
                      })
                    }
                    placeholder={`Enter ${field}...`}
                    multiline
                  />
                </View>
              ))}
            </View>
          </View>
        );

      case 'scenario':
        return (
          <View key={question.id} style={styles.questionCard}>
            <Text style={styles.questionText}>{question.question}</Text>
            <TextInput
              style={styles.scenarioInput}
              value={answers[question.id] || ''}
              onChangeText={(text) => handleAnswer(question.id, text)}
              placeholder="Type your response here..."
              multiline
              textAlignVertical="top"
            />
          </View>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.skyBlue} />
          <Text style={styles.loadingText}>Loading comprehension check...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!comprehensionData?.available) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.notAvailableContainer}>
          <Text style={styles.notAvailableTitle}>Comprehension Check Not Ready</Text>
          <Text style={styles.notAvailableText}>
            {comprehensionData?.reason || 'Please complete the section content first.'}
          </Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBackButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Comprehension Check</Text>
          <Text style={styles.headerSubtitle}>
            Level {level}, Section {section}
          </Text>
        </View>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${((currentQuestion + 1) / comprehensionData.questions.length) * 100}%` },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          Question {currentQuestion + 1} of {comprehensionData.questions.length}
        </Text>
      </View>

      <ScrollView style={styles.content}>
        {comprehensionData.questions.map((question, index) =>
          renderQuestion(question, index)
        )}

        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.buttonDisabled]}
          onPress={submitAnswers}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.submitButtonText}>Submit Answers</Text>
          )}
        </TouchableOpacity>
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
  headerBackButton: {
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  backText: {
    fontSize: 16,
    color: colors.skyBlue,
    fontWeight: '600',
  },
  headerInfo: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  progressContainer: {
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.lightGray,
    borderRadius: 3,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.skyBlue,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  questionCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  questionText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 20,
    lineHeight: 26,
  },
  optionButton: {
    borderWidth: 2,
    borderColor: colors.lightGray,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  selectedOption: {
    borderColor: colors.skyBlue,
    backgroundColor: colors.skyBlue + '10',
  },
  optionText: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  selectedOptionText: {
    color: colors.skyBlue,
    fontWeight: '600',
  },
  translationInputs: {},
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.lightGray,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
  },
  scenarioInput: {
    borderWidth: 1,
    borderColor: colors.lightGray,
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    minHeight: 120,
  },
  submitButton: {
    backgroundColor: colors.skyBlue,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.white,
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
  notAvailableContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  notAvailableTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 16,
  },
  notAvailableText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  backButton: {
    backgroundColor: colors.skyBlue,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
});

export default ComprehensionScreen;