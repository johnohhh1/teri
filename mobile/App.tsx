import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import FlashMessage from 'react-native-flash-message';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Auth Screens
import SplashScreen from './src/screens/auth/SplashScreen';
import WelcomeScreen from './src/screens/auth/WelcomeScreen';
import SignUpScreen from './src/screens/auth/SignUpScreen';
import LoginScreen from './src/screens/auth/LoginScreen';
import ForgotPasswordScreen from './src/screens/auth/ForgotPasswordScreen';

// Pairing Screens
import PairingIntroScreen from './src/screens/pairing/PairingIntroScreen';
import GenerateCodeScreen from './src/screens/pairing/GenerateCodeScreen';
import EnterCodeScreen from './src/screens/pairing/EnterCodeScreen';
import PairingSuccessScreen from './src/screens/pairing/PairingSuccessScreen';

// Main App Navigation
import MainTabNavigator from './src/navigation/MainTabNavigator';

// Context
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ApiProvider } from './src/context/ApiContext';

const Stack = createStackNavigator();

const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Splash" component={SplashScreen} />
    <Stack.Screen name="Welcome" component={WelcomeScreen} />
    <Stack.Screen name="SignUp" component={SignUpScreen} />
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
  </Stack.Navigator>
);

const PairingStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="PairingIntro" component={PairingIntroScreen} />
    <Stack.Screen name="GenerateCode" component={GenerateCodeScreen} />
    <Stack.Screen name="EnterCode" component={EnterCodeScreen} />
    <Stack.Screen name="PairingSuccess" component={PairingSuccessScreen} />
  </Stack.Navigator>
);

const AppNavigator = () => {
  const { user, loading, isAuthenticated, isPaired } = useAuth();

  if (loading) {
    return <SplashScreen />;
  }

  if (!isAuthenticated) {
    return <AuthStack />;
  }

  if (!isPaired) {
    return <PairingStack />;
  }

  return <MainTabNavigator />;
};

const App: React.FC = () => {
  return (
    <SafeAreaProvider>
      <ApiProvider>
        <AuthProvider>
          <NavigationContainer>
            <AppNavigator />
          </NavigationContainer>
          <FlashMessage position="top" />
        </AuthProvider>
      </ApiProvider>
    </SafeAreaProvider>
  );
};

export default App;