import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useApi } from '../../context/ApiContext';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../styles/colors';

const EnterCodeScreen: React.FC = () => {
  const navigation = useNavigation();
  const { api } = useApi();
  const { refreshAuth } = useAuth();
  const [pairingCode, setPairingCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePairWithCode = async () => {
    if (!pairingCode.trim()) {
      Alert.alert('Error', 'Please enter a pairing code');
      return;
    }

    if (pairingCode.length !== 8) {
      Alert.alert('Error', 'Pairing code must be 8 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/api/v1/pairing/join', {
        pairing_code: pairingCode.toUpperCase(),
      });

      // Refresh auth to get updated user data with partner info
      await refreshAuth();

      // Navigate to success screen
      navigation.navigate('PairingSuccess' as never, {
        partner: response.data.partner,
      });
    } catch (error: any) {
      let errorMessage = 'Failed to pair with code';

      if (error.response?.status === 404) {
        errorMessage = 'Invalid pairing code. Please check and try again.';
      } else if (error.response?.status === 410) {
        errorMessage = 'This pairing code has expired. Ask your partner for a new one.';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }

      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const formatCode = (text: string) => {
    // Remove any non-alphanumeric characters and convert to uppercase
    const cleaned = text.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    // Limit to 8 characters
    return cleaned.slice(0, 8);
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

          <Text style={styles.title}>Enter Pairing Code</Text>
          <Text style={styles.subtitle}>
            Enter the 8-character code your partner shared with you
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Pairing Code</Text>
            <TextInput
              style={styles.input}
              value={pairingCode}
              onChangeText={(text) => setPairingCode(formatCode(text))}
              placeholder="ABC12345"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={8}
              textAlign="center"
              letterSpacing={4}
            />
            <Text style={styles.hint}>
              Code should be 8 characters (letters and numbers)
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.pairButton, loading && styles.buttonDisabled]}
            onPress={handlePairWithCode}
            disabled={loading || pairingCode.length !== 8}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.pairButtonText}>Pair with Partner</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.helpSection}>
          <Text style={styles.helpTitle}>Need Help?</Text>
          <Text style={styles.helpText}>
            • Ask your partner to generate a new code if this one doesn't work
          </Text>
          <Text style={styles.helpText}>
            • Codes expire after 24 hours for security
          </Text>
          <Text style={styles.helpText}>
            • Make sure you're both using the latest version of the app
          </Text>
        </View>

        <TouchableOpacity
          style={styles.generateCodeLink}
          onPress={() => navigation.navigate('GenerateCode' as never)}
        >
          <Text style={styles.generateCodeText}>
            Want to generate your own code instead?
          </Text>
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
  form: {
    marginBottom: 40,
  },
  inputContainer: {
    marginBottom: 32,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  input: {
    borderWidth: 2,
    borderColor: colors.skyBlue,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 20,
    fontSize: 24,
    fontWeight: 'bold',
    backgroundColor: colors.white,
    textTransform: 'uppercase',
  },
  hint: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  pairButton: {
    backgroundColor: colors.skyBlue,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  pairButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.white,
  },
  helpSection: {
    marginBottom: 40,
  },
  helpTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
  },
  helpText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
    lineHeight: 20,
  },
  generateCodeLink: {
    alignItems: 'center',
  },
  generateCodeText: {
    fontSize: 16,
    color: colors.skyBlue,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});

export default EnterCodeScreen;