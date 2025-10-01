import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import AudioRecorderPlayer, {
  AudioEncoderAndroidType,
  AudioSourceAndroidType,
  AVEncoderAudioQualityIOSType,
  AVEncodingOption,
} from 'react-native-audio-recorder-player';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import HapticFeedback from 'react-native-haptic-feedback';
import { showMessage } from 'react-native-flash-message';
import { useApi } from '../../context/ApiContext';
import { colors } from '../../styles/colors';

interface MediatorResult {
  session_id: string;
  transcript: string;
  speaker: string;
  tel_summary: {
    outer: string;
    undercurrents: string;
    what_matters: string;
  };
  depth_questions: string[];
  suggested_games: Array<{
    game_id: string;
    score: number;
    rationale: string;
    duration: string;
    level_required: number;
  }>;
}

const MediatorScreen: React.FC = () => {
  const { api } = useApi();
  const [audioRecorderPlayer] = useState(new AudioRecorderPlayer());
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingPath, setRecordingPath] = useState<string>('');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [hasPermission, setHasPermission] = useState(false);
  const [speaker, setSpeaker] = useState<'partner1' | 'partner2'>('partner1');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<MediatorResult | null>(null);

  useEffect(() => {
    checkPermissions();
    return () => {
      audioRecorderPlayer.removeRecordBackListener();
      audioRecorderPlayer.removePlayBackListener();
    };
  }, []);

  const checkPermissions = async () => {
    try {
      let permission;

      if (Platform.OS === 'android') {
        permission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
        );
        setHasPermission(permission === PermissionsAndroid.RESULTS.GRANTED);
      } else {
        permission = await request(PERMISSIONS.IOS.MICROPHONE);
        setHasPermission(permission === RESULTS.GRANTED);
      }
    } catch (error) {
      console.error('Permission error:', error);
      setHasPermission(false);
    }
  };

  const startRecording = async () => {
    if (!hasPermission) {
      Alert.alert(
        'Microphone Permission Required',
        'Please enable microphone access in your device settings',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Settings', onPress: () => checkPermissions() },
        ]
      );
      return;
    }

    try {
      setIsRecording(true);
      setRecordingDuration(0);
      setResult(null);

      const audioSet = {
        AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
        AudioSourceAndroid: AudioSourceAndroidType.MIC,
        AVEncoderAudioQualityKeyIOS: AVEncoderAudioQualityIOSType.high,
        AVNumberOfChannelsKeyIOS: 2,
        AVFormatIDKeyIOS: AVEncodingOption.aac,
      };

      const path = await audioRecorderPlayer.startRecorder(undefined, audioSet);
      setRecordingPath(path);

      audioRecorderPlayer.addRecordBackListener((e) => {
        const seconds = Math.floor(e.currentPosition / 1000);
        setRecordingDuration(seconds);

        // Auto-stop at 60 seconds
        if (seconds >= 60) {
          stopRecording();
        }

        // Haptic feedback every 10 seconds
        if (seconds > 0 && seconds % 10 === 0) {
          HapticFeedback.trigger('impactLight');
        }
      });

      HapticFeedback.trigger('impactMedium');
    } catch (error) {
      console.error('Recording error:', error);
      Alert.alert('Recording Error', 'Failed to start recording');
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    try {
      const result = await audioRecorderPlayer.stopRecorder();
      audioRecorderPlayer.removeRecordBackListener();
      setIsRecording(false);
      HapticFeedback.trigger('impactMedium');

      // Minimum 5 seconds to prevent accidental taps
      if (recordingDuration < 5) {
        Alert.alert('Recording Too Short', 'Please record for at least 5 seconds');
        setRecordingPath('');
        setRecordingDuration(0);
        return;
      }

      console.log('Recording finished:', result);
    } catch (error) {
      console.error('Stop recording error:', error);
      setIsRecording(false);
    }
  };

  const playRecording = async () => {
    if (!recordingPath) return;

    try {
      setIsPlaying(true);
      await audioRecorderPlayer.startPlayer(recordingPath);

      audioRecorderPlayer.addPlayBackListener((e) => {
        if (e.currentPosition === e.duration) {
          stopPlaying();
        }
      });
    } catch (error) {
      console.error('Play error:', error);
      setIsPlaying(false);
    }
  };

  const stopPlaying = async () => {
    try {
      await audioRecorderPlayer.stopPlayer();
      audioRecorderPlayer.removePlayBackListener();
      setIsPlaying(false);
    } catch (error) {
      console.error('Stop playing error:', error);
    }
  };

  const deleteRecording = () => {
    Alert.alert(
      'Delete Recording',
      'Are you sure you want to delete this recording?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setRecordingPath('');
            setRecordingDuration(0);
            setResult(null);
          },
        },
      ]
    );
  };

  const analyzeRecording = async () => {
    if (!recordingPath) return;

    setProcessing(true);

    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('audio', {
        uri: recordingPath,
        type: 'audio/m4a',
        name: 'recording.m4a',
      } as any);

      // Upload audio with query parameters
      const uploadResponse = await api.post(
        `/api/v1/mediator/upload?speaker=${speaker}&duration_seconds=${recordingDuration}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          timeout: 60000, // 60 second timeout
        }
      );

      const sessionId = uploadResponse.data.session_id;

      // Poll for results
      let attempts = 0;
      const maxAttempts = 30; // 30 attempts = ~60 seconds

      const pollResults = async (): Promise<void> => {
        try {
          const resultResponse = await api.get(`/api/v1/mediator/${sessionId}`);

          if (resultResponse.data.status === 'complete') {
            setResult(resultResponse.data);
            setProcessing(false);
            HapticFeedback.trigger('notificationSuccess');
            showMessage({
              message: 'Analysis complete!',
              type: 'success',
              duration: 3000,
            });
          } else if (resultResponse.data.status === 'processing') {
            attempts++;
            if (attempts < maxAttempts) {
              setTimeout(pollResults, 2000); // Check every 2 seconds
            } else {
              throw new Error('Processing timeout');
            }
          } else {
            throw new Error('Processing failed');
          }
        } catch (error) {
          if (attempts < maxAttempts) {
            attempts++;
            setTimeout(pollResults, 2000);
          } else {
            throw error;
          }
        }
      };

      await pollResults();
    } catch (error: any) {
      console.error('Analysis error:', error);
      setProcessing(false);
      HapticFeedback.trigger('notificationError');

      let errorMessage = 'Failed to analyze recording';
      if (error.response?.status === 413) {
        errorMessage = 'Recording file is too large';
      } else if (error.message === 'Processing timeout') {
        errorMessage = 'Analysis is taking longer than usual. Please try again.';
      }

      Alert.alert('Analysis Failed', errorMessage);
    }
  };

  const handleFeedback = async (helpful: boolean) => {
    if (!result) return;

    try {
      await api.post(`/api/v1/mediator/${result.session_id}/feedback`, {
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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const ResultCard: React.FC<{
    emoji: string;
    title: string;
    content: string;
  }> = ({ emoji, title, content }) => (
    <View style={styles.resultCard}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardEmoji}>{emoji}</Text>
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      <Text style={styles.cardContent}>{content}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mediator</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.description}>
          <Text style={styles.descriptionText}>
            Record a Moment{'\n'}Hold to record (max 60 seconds)
          </Text>
        </View>

        {/* Recording Interface */}
        <View style={styles.recordingContainer}>
          <View style={styles.microphoneContainer}>
            <TouchableOpacity
              style={[
                styles.microphoneButton,
                isRecording && styles.recordingActive,
              ]}
              onPressIn={startRecording}
              onPressOut={stopRecording}
              disabled={processing}
            >
              <Text style={styles.microphoneIcon}>🎤</Text>
            </TouchableOpacity>

            <Text style={styles.recordingInstruction}>
              {isRecording ? 'Recording...' : 'Hold to Record'}
            </Text>

            <Text style={styles.timeDisplay}>
              ⏱️ {formatTime(recordingDuration)} / 1:00
            </Text>
          </View>

          {/* Speaker Selection */}
          <View style={styles.speakerSelection}>
            <Text style={styles.speakerLabel}>Speaker:</Text>
            <TouchableOpacity
              style={[
                styles.speakerButton,
                speaker === 'partner1' && styles.activeSpeaker,
              ]}
              onPress={() => setSpeaker('partner1')}
            >
              <Text style={styles.speakerText}>You</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.speakerButton,
                speaker === 'partner2' && styles.activeSpeaker,
              ]}
              onPress={() => setSpeaker('partner2')}
            >
              <Text style={styles.speakerText}>Partner</Text>
            </TouchableOpacity>
          </View>

          {/* Consent Notice */}
          <Text style={styles.consentText}>
            ℹ️ By recording, both partners consent to AI processing
          </Text>
        </View>

        {/* Recording Actions */}
        {recordingPath && !processing && !result && (
          <View style={styles.recordingActions}>
            <Text style={styles.recordingInfo}>
              🎵 Audio clip ({formatTime(recordingDuration)})
            </Text>

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={isPlaying ? stopPlaying : playRecording}
              >
                <Text style={styles.actionButtonText}>
                  {isPlaying ? '⏹️ Stop' : '▶️ Play'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.deleteButton]}
                onPress={deleteRecording}
              >
                <Text style={styles.actionButtonText}>🗑️ Delete</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.analyzeButton]}
                onPress={analyzeRecording}
              >
                <Text style={styles.actionButtonText}>✓ Analyze</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Processing State */}
        {processing && (
          <View style={styles.processingContainer}>
            <Text style={styles.processingTitle}>🔄 Analyzing your moment...</Text>
            <View style={styles.processingSteps}>
              <Text style={styles.processingStep}>• Transcribing audio</Text>
              <Text style={styles.processingStep}>• Understanding emotions</Text>
              <Text style={styles.processingStep}>• Suggesting next steps</Text>
            </View>
            <ActivityIndicator size="large" color={colors.skyBlue} style={styles.processingSpinner} />
          </View>
        )}

        {/* Results */}
        {result && (
          <View style={styles.resultsSection}>
            <Text style={styles.resultsTitle}>— Analysis Results —</Text>

            {/* Transcript */}
            <View style={styles.transcriptCard}>
              <Text style={styles.transcriptTitle}>📝 Transcript</Text>
              <Text style={styles.transcriptText}>"{result.transcript}"</Text>
              <Text style={styles.speakerInfo}>Speaker: {result.speaker}</Text>
            </View>

            {/* TEL Summary */}
            <ResultCard
              emoji="📝"
              title="OUTER (What Was Said)"
              content={result.tel_summary.outer}
            />

            <ResultCard
              emoji="💭"
              title="UNDERCURRENTS (What Might Be Felt)"
              content={result.tel_summary.undercurrents}
            />

            <ResultCard
              emoji="❤️"
              title="WHAT MATTERS (Core Values)"
              content={result.tel_summary.what_matters}
            />

            {/* Depth Questions */}
            <View style={styles.questionsCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardEmoji}>❓</Text>
                <Text style={styles.cardTitle}>DEPTH QUESTIONS</Text>
              </View>
              {result.depth_questions.map((question, index) => (
                <Text key={index} style={styles.questionText}>
                  • {question}
                </Text>
              ))}
            </View>

            {/* Suggested Games */}
            {result.suggested_games.length > 0 && (
              <View style={styles.gamesCard}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardEmoji}>🎮</Text>
                  <Text style={styles.cardTitle}>SUGGESTED GAMES</Text>
                </View>
                {result.suggested_games.map((game, index) => (
                  <View key={index} style={styles.gameItem}>
                    <View style={styles.gameInfo}>
                      <Text style={styles.gameTitle}>{game.game_id.replace('_', ' ').toUpperCase()}</Text>
                      <Text style={styles.gameDetails}>
                        {game.duration} • Level {game.level_required} • Score: {Math.round(game.score * 100)}%
                      </Text>
                      <Text style={styles.gameRationale}>{game.rationale}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Feedback */}
            <View style={styles.feedbackSection}>
              <Text style={styles.feedbackLabel}>Was this analysis helpful?</Text>
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
  description: {
    alignItems: 'center',
    marginBottom: 32,
  },
  descriptionText: {
    fontSize: 18,
    textAlign: 'center',
    color: colors.textSecondary,
    lineHeight: 26,
  },
  recordingContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  microphoneContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  microphoneButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.olive,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  recordingActive: {
    backgroundColor: colors.error,
    transform: [{ scale: 1.1 }],
  },
  microphoneIcon: {
    fontSize: 48,
  },
  recordingInstruction: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  timeDisplay: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  speakerSelection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  speakerLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  speakerButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.lightGray,
  },
  activeSpeaker: {
    backgroundColor: colors.skyBlue,
  },
  speakerText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  consentText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  recordingActions: {
    alignItems: 'center',
    marginBottom: 32,
  },
  recordingInfo: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    backgroundColor: colors.skyBlue,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  deleteButton: {
    backgroundColor: colors.error,
  },
  analyzeButton: {
    backgroundColor: colors.success,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },
  processingContainer: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: colors.white,
    borderRadius: 12,
    marginBottom: 32,
  },
  processingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 20,
  },
  processingSteps: {
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  processingStep: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  processingSpinner: {
    marginTop: 12,
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
  transcriptCard: {
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
  transcriptTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  transcriptText: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textPrimary,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  speakerInfo: {
    fontSize: 12,
    color: colors.textSecondary,
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
    fontSize: 14,
    fontWeight: 'bold',
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
  questionText: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  gamesCard: {
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
  gameItem: {
    marginBottom: 16,
  },
  gameInfo: {},
  gameTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  gameDetails: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  gameRationale: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  feedbackSection: {
    alignItems: 'center',
    marginTop: 24,
  },
  feedbackLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  feedbackButtons: {
    flexDirection: 'row',
    gap: 20,
  },
  feedbackButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedbackEmoji: {
    fontSize: 24,
  },
});

export default MediatorScreen;