import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../styles/colors';

const WelcomeScreen: React.FC = () => {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={colors.bgLight} barStyle="dark-content" />

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.logo}>TER</Text>
          <Text style={styles.tagline}>Transform Your Relationship</Text>
        </View>

        <View style={styles.description}>
          <Text style={styles.descriptionText}>
            Truth Empowered Relationships helps couples build deeper connection through:
          </Text>

          <View style={styles.features}>
            <Text style={styles.feature}>• Structured learning in 7 levels</Text>
            <Text style={styles.feature}>• AI-powered communication tools</Text>
            <Text style={styles.feature}>• Relationship games and exercises</Text>
            <Text style={styles.feature}>• Synchronized progress with your partner</Text>
          </View>
        </View>

        <View style={styles.buttons}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('SignUp' as never)}
          >
            <Text style={styles.primaryButtonText}>Create Account</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('Login' as never)}
          >
            <Text style={styles.secondaryButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
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
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginTop: 60,
  },
  logo: {
    fontSize: 72,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 24,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  description: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  descriptionText: {
    fontSize: 18,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 26,
  },
  features: {
    alignItems: 'flex-start',
  },
  feature: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 12,
    lineHeight: 24,
  },
  buttons: {
    gap: 16,
    marginBottom: 32,
  },
  primaryButton: {
    backgroundColor: colors.skyBlue,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.white,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.skyBlue,
  },
  secondaryButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.skyBlue,
  },
});

export default WelcomeScreen;