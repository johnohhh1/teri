import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import HapticFeedback from 'react-native-haptic-feedback';
import { showMessage } from 'react-native-flash-message';
import { useApi } from '../../context/ApiContext';
import { colors } from '../../styles/colors';

interface TESOutput {
  outer: string;
  inner: string;
  under: string;
  why: string;
  ask: string;
  checks: {
    non_meanness: boolean;
    pillars_aligned: boolean;
    instructions_followed: number[];
  };
}

interface TELOutput {
  outer: string;
  undercurrents: string;
  what_matters: string;
  depth_questions: string[];
}

type TranslatorMode = 'TES' | 'TEL';

const TranslatorScreen: React.FC = () => {
  const { api } = useApi();
  const [mode, setMode] = useState<TranslatorMode>('TES');
  const [inputText, setInputText] = useState('');
  const [tesOutput, setTesOutput] = useState<TESOutput | null>(null);
  const [telOutput, setTelOutput] = useState<TELOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const handleTranslate = async () => {
    if (!inputText.trim()) {
      Alert.alert('Error', 'Please enter some text to translate');
      return;
    }

    if (inputText.length > 500) {
      Alert.alert('Error', 'Text must be 500 characters or less');
      return;
    }

    setLoading(true);

    try {
      const endpoint = mode === 'TES' ? '/api/v1/translator/tes' : '/api/v1/translator/tel';
      const response = await api.post(endpoint, {
        input_text: inputText,
      });

      setSessionId(response.data.session_id);

      if (mode === 'TES') {
        setTesOutput(response.data.translation);
        setTelOutput(null);
      } else {
        setTelOutput(response.data.listening);
        setTesOutput(null);
      }

      HapticFeedback.trigger('notificationSuccess');
    } catch (error: any) {
      console.error('Translation error:', error);
      Alert.alert(
        'Translation Failed',
        error.response?.data?.message || 'Please try again in a moment'
      );
      HapticFeedback.trigger('notificationError');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, label: string) => {
    Clipboard.setString(text);
    HapticFeedback.trigger('impactLight');
    showMessage({
      message: `${label} copied to clipboard`,
      type: 'success',
      duration: 2000,
    });
  };

  const handleFeedback = async (helpful: boolean) => {
    if (!sessionId) return;

    try {
      await api.post(`/api/v1/translator/${sessionId}/feedback`, {
        feedback: helpful ? 'helpful' : 'not_helpful',
      });

      showMessage({
        message: 'Thank you for your feedback!',
        type: 'success',
        duration: 2000,
      });
    } catch (error) {
      console.error('Feedback error:', error);
    }
  };

  const handleTryAnother = () => {
    if (mode === 'TES') {
      setTesOutput(null);
    } else {
      setTelOutput(null);
    }
    setSessionId(null);
    handleTranslate();
  };

  const clearResults = () => {
    setTesOutput(null);
    setTelOutput(null);
    setSessionId(null);
    setInputText('');
  };

  const ResultCard: React.FC<{
    emoji: string;
    title: string;
    content: string;
    backgroundColor?: string;
  }> = ({ emoji, title, content, backgroundColor = colors.white }) => (
    <View style={[styles.resultCard, { backgroundColor }]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardEmoji}>{emoji}</Text>
        <Text style={styles.cardTitle}>{title}</Text>
        <TouchableOpacity
          style={styles.copyButton}
          onPress={() => handleCopy(content, title)}
        >
          <Text style={styles.copyText}>Copy</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.cardContent}>{content}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Translator</Text>
        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'TES' && styles.activeModeButton]}
            onPress={() => setMode('TES')}
          >
            <Text style={[styles.modeText, mode === 'TES' && styles.activeModeText]}>
              TES
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'TEL' && styles.activeModeButton]}
            onPress={() => setMode('TEL')}
          >
            <Text style={[styles.modeText, mode === 'TEL' && styles.activeModeText]}>
              TEL
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.modeDescription}>
          <Text style={styles.modeDescriptionText}>
            {mode === 'TES'
              ? 'Truth Empowered Speaking\nTransform reactive language'
              : 'Truth Empowered Listening\nUnderstand your partner deeply'}
          </Text>
        </View>

        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>
            {mode === 'TES' ? 'What do you want to say?' : 'What did your partner say?'}
          </Text>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder={
              mode === 'TES'
                ? 'Type your reactive thoughts here...'
                : 'Type what your partner said...'
            }
            multiline
            maxLength={500}
            textAlignVertical="top"
          />
          <Text style={styles.characterCount}>{inputText.length}/500</Text>

          <TouchableOpacity
            style={[styles.translateButton, loading && styles.buttonDisabled]}
            onPress={handleTranslate}
            disabled={loading || !inputText.trim()}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.translateButtonText}>Translate</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* TES Results */}
        {tesOutput && (
          <View style={styles.resultsSection}>
            <Text style={styles.resultsTitle}>— Results —</Text>

            <ResultCard
              emoji="📝"
              title="OUTER (Observable)"
              content={tesOutput.outer}
            />

            <ResultCard
              emoji="💭"
              title="INNER (My Experience)"
              content={tesOutput.inner}
            />

            <ResultCard
              emoji="💔"
              title="UNDER (What I Fear)"
              content={tesOutput.under}
            />

            <ResultCard
              emoji="❤️"
              title="WHY (What I Need)"
              content={tesOutput.why}
            />

            <ResultCard
              emoji="🎯"
              title="ASK (Clear Request)"
              content={tesOutput.ask}
            />

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.alternateButton}
                onPress={handleTryAnother}
              >
                <Text style={styles.alternateButtonText}>Try Another Way</Text>
              </TouchableOpacity>

              <View style={styles.feedbackButtons}>
                <TouchableOpacity
                  style={styles.feedbackButton}
                  onPress={() => handleFeedback(true)}
                >
                  <Text style={styles.feedbackEmoji}>👍</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.feedbackButton}
                  onPress={() => handleFeedback(false)}
                >
                  <Text style={styles.feedbackEmoji}>👎</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* TEL Results */}
        {telOutput && (
          <View style={styles.resultsSection}>
            <Text style={styles.resultsTitle}>— Results —</Text>

            <ResultCard
              emoji="📝"
              title="OUTER (What They Said)"
              content={telOutput.outer}
            />

            <ResultCard
              emoji="💭"
              title="UNDERCURRENTS (What They Might Feel)"
              content={telOutput.undercurrents}
            />

            <ResultCard
              emoji="❤️"
              title="WHAT MATTERS (Their Values)"
              content={telOutput.what_matters}
            />

            <View style={styles.questionsCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardEmoji}>❓</Text>
                <Text style={styles.cardTitle}>QUESTIONS TO ASK</Text>
              </View>
              {telOutput.depth_questions.map((question, index) => (
                <View key={index} style={styles.questionItem}>
                  <Text style={styles.questionText}>• {question}</Text>
                  <TouchableOpacity
                    style={styles.copyButton}
                    onPress={() => handleCopy(question, 'Question')}
                  >
                    <Text style={styles.copyText}>Copy</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.alternateButton}
                onPress={handleTryAnother}
              >
                <Text style={styles.alternateButtonText}>Try Another Way</Text>
              </TouchableOpacity>

              <View style={styles.feedbackButtons}>
                <TouchableOpacity
                  style={styles.feedbackButton}
                  onPress={() => handleFeedback(true)}
                >
                  <Text style={styles.feedbackEmoji}>👍</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.feedbackButton}
                  onPress={() => handleFeedback(false)}
                >
                  <Text style={styles.feedbackEmoji}>👎</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {(tesOutput || telOutput) && (
          <TouchableOpacity style={styles.clearButton} onPress={clearResults}>
            <Text style={styles.clearButtonText}>Start New Translation</Text>
          </TouchableOpacity>
        )}
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
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.lightGray,
    borderRadius: 8,
    padding: 2,
  },
  modeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  activeModeButton: {
    backgroundColor: colors.skyBlue,
  },
  modeText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  activeModeText: {
    color: colors.white,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  modeDescription: {
    alignItems: 'center',
    marginBottom: 32,
  },
  modeDescriptionText: {
    fontSize: 18,
    textAlign: 'center',
    color: colors.textSecondary,
    lineHeight: 26,
  },
  inputSection: {
    marginBottom: 32,
  },
  inputLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  textInput: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    lineHeight: 24,
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.lightGray,
    marginBottom: 8,
  },
  characterCount: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'right',
    marginBottom: 20,
  },
  translateButton: {
    backgroundColor: colors.skyBlue,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  translateButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.white,
  },
  resultsSection: {
    marginBottom: 32,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 24,
  },
  resultCard: {
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  copyButton: {
    backgroundColor: colors.lightGray,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  copyText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  cardContent: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  questionsCard: {
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
  questionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  questionText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textPrimary,
    marginRight: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  alternateButton: {
    backgroundColor: colors.gold,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  alternateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },
  feedbackButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  feedbackButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedbackEmoji: {
    fontSize: 20,
  },
  clearButton: {
    backgroundColor: 'transparent',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.textSecondary,
    marginBottom: 32,
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});

export default TranslatorScreen;