import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/Ionicons';

// Dashboard
import DashboardScreen from '../screens/main/DashboardScreen';

// Training
import TrainingScreen from '../screens/training/TrainingScreen';
import SectionDetailScreen from '../screens/training/SectionDetailScreen';
import ComprehensionScreen from '../screens/training/ComprehensionScreen';
import ResultsScreen from '../screens/training/ResultsScreen';
import PillarsReferenceScreen from '../screens/training/PillarsReferenceScreen';

// Tools
import TranslatorScreen from '../screens/tools/TranslatorScreen';
import MediatorScreen from '../screens/tools/MediatorScreen';

// Games
import GamesLibraryScreen from '../screens/games/GamesLibraryScreen';
import GameDetailScreen from '../screens/games/GameDetailScreen';

// Progress & Journal
import ProgressScreen from '../screens/progress/ProgressScreen';
import JournalScreen from '../screens/journal/JournalScreen';

// Settings
import SettingsScreen from '../screens/settings/SettingsScreen';

import { colors } from '../styles/colors';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Training Stack
const TrainingStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="TrainingMain" component={TrainingScreen} />
    <Stack.Screen name="SectionDetail" component={SectionDetailScreen} />
    <Stack.Screen name="Comprehension" component={ComprehensionScreen} />
    <Stack.Screen name="Results" component={ResultsScreen} />
    <Stack.Screen name="PillarsReference" component={PillarsReferenceScreen} />
  </Stack.Navigator>
);

// Tools Stack
const ToolsStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Translator" component={TranslatorScreen} />
    <Stack.Screen name="Mediator" component={MediatorScreen} />
  </Stack.Navigator>
);

// Games Stack
const GamesStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="GamesLibrary" component={GamesLibraryScreen} />
    <Stack.Screen name="GameDetail" component={GameDetailScreen} />
  </Stack.Navigator>
);

// Progress Stack
const ProgressStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ProgressMain" component={ProgressScreen} />
    <Stack.Screen name="Journal" component={JournalScreen} />
  </Stack.Navigator>
);

const MainTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;

          switch (route.name) {
            case 'Dashboard':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Training':
              iconName = focused ? 'school' : 'school-outline';
              break;
            case 'Tools':
              iconName = focused ? 'build' : 'build-outline';
              break;
            case 'Games':
              iconName = focused ? 'game-controller' : 'game-controller-outline';
              break;
            case 'Progress':
              iconName = focused ? 'stats-chart' : 'stats-chart-outline';
              break;
            default:
              iconName = 'circle';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.skyBlue,
        tabBarInactiveTintColor: colors.gray,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.lightGray,
          paddingBottom: 8,
          height: 88,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Training" component={TrainingStack} />
      <Tab.Screen name="Tools" component={ToolsStack} />
      <Tab.Screen name="Games" component={GamesStack} />
      <Tab.Screen name="Progress" component={ProgressStack} />
    </Tab.Navigator>
  );
};

export default MainTabNavigator;