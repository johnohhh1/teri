import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { colors } from '../../styles/colors';

const SplashScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <StatusBar backgroundColor={colors.bgDark} barStyle="light-content" />

      <View style={styles.content}>
        <Text style={styles.logo}>TER</Text>
        <Text style={styles.subtitle}>Truth Empowered Relationships</Text>

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  logo: {
    fontSize: 64,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 48,
  },
  loadingContainer: {
    marginTop: 32,
  },
});

export default SplashScreen;