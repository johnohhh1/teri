import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors } from '../../styles/colors';

const GameDetailScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { gameId } = route.params as { gameId: string };

  // Mock game data - in real app, this would come from API
  const gameData = {
    id: gameId,
    title: 'Internal Weather Report',
    description: 'Share your emotional state like weather',
    duration: '2-3 minutes',
    level: 1,
    tags: ['Quick', 'Daily', 'Verbal'],
    objective: 'Recognize when a conversation is going off track, take accountability, and rewind to a better moment.',
    howToPlay: `1. Either partner calls "Pause"
2. Caller has 15 seconds to identify where things went wrong
3. Must own their part: "I got defensive when..."
4. If no ownership in 15 seconds, conversation resumes
5. Other partner shares their responsibility
6. Both say "Rewind" to restart
7. Say "Play!" together to continue`,
    safetyNotes: 'Stop if elevation gets above 7/10. Take a longer break if needed.',
    history: {
      lastPlayed: '2 days ago',
      totalTimes: 8,
      averageRating: 4.5,
    },
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backText}>← {gameData.title}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.gameInfo}>
          <Text style={styles.title}>{gameData.title}</Text>
          <Text style={styles.description}>{gameData.description}</Text>

          <View style={styles.gameMetrics}>
            <Text style={styles.metric}>⏱️ {gameData.duration}</Text>
            <Text style={styles.metric}>📊 Level {gameData.level}</Text>
            <Text style={styles.metric}>
              🏷️ {gameData.tags.join(', ')}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>— Objective —</Text>
          <Text style={styles.sectionContent}>{gameData.objective}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>— How to Play —</Text>
          <Text style={styles.sectionContent}>{gameData.howToPlay}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚠️ Safety Notes</Text>
          <Text style={styles.sectionContent}>{gameData.safetyNotes}</Text>
        </View>

        <TouchableOpacity style={styles.startButton}>
          <Text style={styles.startButtonText}>Start Game</Text>
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>— History —</Text>
          <View style={styles.historyStats}>
            <Text style={styles.historyStat}>
              Last played: {gameData.history.lastPlayed}
            </Text>
            <Text style={styles.historyStat}>
              Total times: {gameData.history.totalTimes}
            </Text>
            <Text style={styles.historyStat}>
              Average rating: {gameData.history.averageRating}/5 ⭐
            </Text>
          </View>
        </View>
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
  backButton: {
    alignSelf: 'flex-start',
  },
  backText: {
    fontSize: 16,
    color: colors.skyBlue,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  gameInfo: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 18,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  gameMetrics: {
    alignItems: 'center',
    gap: 8,
  },
  metric: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 16,
  },
  sectionContent: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  startButton: {
    backgroundColor: colors.skyBlue,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 32,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.white,
  },
  historyStats: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  historyStat: {
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: 8,
  },
});

export default GameDetailScreen;