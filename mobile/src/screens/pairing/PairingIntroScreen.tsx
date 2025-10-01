import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../styles/colors';

const PairingIntroScreen: React.FC = () => {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Connect with Your Partner</Text>
          <Text style={styles.subtitle}>
            Truth Empowered Relationships works best when both partners participate together.
            Let's connect you with your partner to begin your synchronized journey.
          </Text>
        </View>

        <View style={styles.illustration}>
          <View style={styles.heartContainer}>
            <Text style={styles.heartEmoji}>💕</Text>
          </View>
        </View>

        <View style={styles.benefits}>
          <Text style={styles.benefitsTitle}>Together You'll:</Text>
          <View style={styles.benefitItem}>
            <Text style={styles.benefitBullet}>•</Text>
            <Text style={styles.benefitText}>Progress through levels at the same pace</Text>
          </View>
          <View style={styles.benefitItem}>
            <Text style={styles.benefitBullet}>•</Text>
            <Text style={styles.benefitText}>Share synchronized learning experiences</Text>
          </View>
          <View style={styles.benefitItem}>
            <Text style={styles.benefitBullet}>•</Text>
            <Text style={styles.benefitText}>Use AI tools to improve communication</Text>
          </View>
          <View style={styles.benefitItem}>
            <Text style={styles.benefitBullet}>•</Text>
            <Text style={styles.benefitText}>Track progress and celebrate milestones</Text>
          </View>
        </View>

        <View style={styles.buttons}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('GenerateCode' as never)}
          >
            <Text style={styles.primaryButtonText}>Generate Pairing Code</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('EnterCode' as never)}
          >
            <Text style={styles.secondaryButtonText}>Enter Partner's Code</Text>
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
    marginTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  illustration: {
    alignItems: 'center',
    marginVertical: 40,
  },
  heartContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.pink,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heartEmoji: {
    fontSize: 48,
  },
  benefits: {
    marginBottom: 40,
  },
  benefitsTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 20,
    textAlign: 'center',
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  benefitBullet: {
    fontSize: 18,
    color: colors.skyBlue,
    marginRight: 12,
    fontWeight: 'bold',
  },
  benefitText: {
    fontSize: 16,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 22,
  },
  buttons: {
    gap: 16,
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

export default PairingIntroScreen;