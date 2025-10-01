import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Animated,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors } from '../../styles/colors';

const PairingSuccessScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { partner } = route.params as any;

  const scaleAnim = new Animated.Value(0);
  const fadeAnim = new Animated.Value(0);

  useEffect(() => {
    // Animation sequence
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleContinue = () => {
    // This will trigger the app to navigate to MainTabNavigator
    // since the user is now paired
    navigation.reset({
      index: 0,
      routes: [{ name: 'Dashboard' as never }],
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.celebration}>
          <Animated.View
            style={[
              styles.heartContainer,
              { transform: [{ scale: scaleAnim }] },
            ]}
          >
            <Text style={styles.heartEmoji}>💕</Text>
          </Animated.View>

          <Animated.View style={[styles.textContainer, { opacity: fadeAnim }]}>
            <Text style={styles.title}>You're Paired!</Text>
            <Text style={styles.subtitle}>
              Congratulations! You're now connected with {partner?.name || 'your partner'}.
            </Text>
          </Animated.View>
        </View>

        <Animated.View style={[styles.infoSection, { opacity: fadeAnim }]}>
          <Text style={styles.infoTitle}>What's Next?</Text>

          <View style={styles.nextSteps}>
            <View style={styles.stepItem}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <Text style={styles.stepText}>
                Start with Level 1, Section 1: "Welcome & Orientation"
              </Text>
            </View>

            <View style={styles.stepItem}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <Text style={styles.stepText}>
                Both of you need to complete each section before moving forward
              </Text>
            </View>

            <View style={styles.stepItem}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <Text style={styles.stepText}>
                Use the Translator and Mediator tools whenever you need help communicating
              </Text>
            </View>

            <View style={styles.stepItem}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>4</Text>
              </View>
              <Text style={styles.stepText}>
                Play relationship games to deepen your connection
              </Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View style={[styles.buttonContainer, { opacity: fadeAnim }]}>
          <TouchableOpacity
            style={styles.continueButton}
            onPress={handleContinue}
          >
            <Text style={styles.continueButtonText}>Begin Your Journey Together</Text>
          </TouchableOpacity>
        </Animated.View>
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
  celebration: {
    alignItems: 'center',
    marginTop: 60,
  },
  heartContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.pink,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  heartEmoji: {
    fontSize: 48,
  },
  textContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 26,
  },
  infoSection: {
    flex: 1,
    justifyContent: 'center',
    marginVertical: 40,
  },
  infoTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 32,
  },
  nextSteps: {
    gap: 20,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.skyBlue,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  stepNumberText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.white,
  },
  stepText: {
    fontSize: 16,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 24,
  },
  buttonContainer: {
    marginBottom: 32,
  },
  continueButton: {
    backgroundColor: colors.skyBlue,
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.white,
  },
});

export default PairingSuccessScreen;