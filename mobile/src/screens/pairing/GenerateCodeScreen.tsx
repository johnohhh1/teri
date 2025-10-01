import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Share,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Clipboard from '@react-native-clipboard/clipboard';
import { useApi } from '../../context/ApiContext';
import { colors } from '../../styles/colors';

const GenerateCodeScreen: React.FC = () => {
  const navigation = useNavigation();
  const { api } = useApi();
  const [pairingCode, setPairingCode] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);

  useEffect(() => {
    generateCode();
  }, []);

  const generateCode = async () => {
    setLoading(true);
    try {
      const response = await api.post('/api/v1/pairing/generate-code');
      setPairingCode(response.data.pairing_code);
      setExpiresAt(new Date(response.data.expires_at));
    } catch (error: any) {
      Alert.alert('Error', 'Failed to generate pairing code');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    Clipboard.setString(pairingCode);
    Alert.alert('Copied!', 'Pairing code copied to clipboard');
  };

  const shareCode = async () => {
    try {
      await Share.share({
        message: `Join me on Truth Empowered Relationships! Use this code to pair with me: ${pairingCode}`,
        title: 'TER Pairing Code',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const getTimeRemaining = () => {
    if (!expiresAt) return '';

    const now = new Date();
    const timeLeft = expiresAt.getTime() - now.getTime();
    const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

    if (hoursLeft > 0) {
      return `Expires in ${hoursLeft}h ${minutesLeft}m`;
    }
    return `Expires in ${minutesLeft}m`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Your Pairing Code</Text>
          <Text style={styles.subtitle}>
            Share this code with your partner so they can connect with you
          </Text>
        </View>

        <View style={styles.codeContainer}>
          {loading ? (
            <ActivityIndicator size="large" color={colors.skyBlue} />
          ) : (
            <>
              <View style={styles.codeBox}>
                <Text style={styles.codeText}>{pairingCode}</Text>
              </View>

              <Text style={styles.expiryText}>{getTimeRemaining()}</Text>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.copyButton}
                  onPress={copyToClipboard}
                >
                  <Text style={styles.actionButtonText}>📋 Copy Code</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.shareButton}
                  onPress={shareCode}
                >
                  <Text style={styles.actionButtonText}>📤 Share Code</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        <View style={styles.instructions}>
          <Text style={styles.instructionsTitle}>How to Share:</Text>
          <View style={styles.instructionItem}>
            <Text style={styles.instructionNumber}>1</Text>
            <Text style={styles.instructionText}>
              Send the code to your partner via text, email, or any messaging app
            </Text>
          </View>
          <View style={styles.instructionItem}>
            <Text style={styles.instructionNumber}>2</Text>
            <Text style={styles.instructionText}>
              Your partner should download the app and choose "Enter Partner's Code"
            </Text>
          </View>
          <View style={styles.instructionItem}>
            <Text style={styles.instructionNumber}>3</Text>
            <Text style={styles.instructionText}>
              Once they enter your code, you'll both be paired and ready to start!
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.regenerateButton}
          onPress={generateCode}
          disabled={loading}
        >
          <Text style={styles.regenerateButtonText}>Generate New Code</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgLight,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  header: {
    marginTop: 20,
    marginBottom: 40,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
  backText: {
    fontSize: 16,
    color: colors.skyBlue,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  codeContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  codeBox: {
    backgroundColor: colors.white,
    borderWidth: 3,
    borderColor: colors.skyBlue,
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 32,
    marginBottom: 16,
  },
  codeText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.textPrimary,
    letterSpacing: 4,
    textAlign: 'center',
  },
  expiryText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  actions: {
    flexDirection: 'row',
    gap: 16,
  },
  copyButton: {
    backgroundColor: colors.gold,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  shareButton: {
    backgroundColor: colors.olive,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
  instructions: {
    marginBottom: 40,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  instructionNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.skyBlue,
    color: colors.white,
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 24,
    marginRight: 12,
  },
  instructionText: {
    fontSize: 16,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 22,
  },
  regenerateButton: {
    backgroundColor: 'transparent',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.textSecondary,
  },
  regenerateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});

export default GenerateCodeScreen;