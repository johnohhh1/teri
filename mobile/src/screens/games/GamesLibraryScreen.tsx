import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useApi } from '../../context/ApiContext';
import { colors } from '../../styles/colors';

interface Game {
  id: string;
  title: string;
  description: string;
  duration_minutes: { min: number; max: number };
  level_required: number;
  themes: string[];
  tags: string[];
  played_count: number;
  last_played_at?: string;
  available: boolean;
}

const GamesLibraryScreen: React.FC = () => {
  const navigation = useNavigation();
  const { api } = useApi();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'quick' | 'deep' | 'daily'>('all');

  useEffect(() => {
    loadGames();
  }, []);

  const loadGames = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/v1/games');
      setGames(response.data.available_games || []);
    } catch (error) {
      console.error('Error loading games:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredGames = games.filter((game) => {
    switch (filter) {
      case 'quick':
        return game.tags.includes('quick');
      case 'deep':
        return game.tags.includes('deep');
      case 'daily':
        return game.tags.includes('daily');
      default:
        return true;
    }
  });

  const formatDuration = (duration: { min: number; max: number }) => {
    if (duration.min === duration.max) {
      return `${duration.min} minutes`;
    }
    return `${duration.min}-${duration.max} minutes`;
  };

  const getTimeSinceLastPlayed = (dateString?: string) => {
    if (!dateString) return 'Never played';

    const lastPlayed = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - lastPlayed.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  const FilterButton: React.FC<{
    title: string;
    filterValue: 'all' | 'quick' | 'deep' | 'daily';
  }> = ({ title, filterValue }) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        filter === filterValue && styles.activeFilter,
      ]}
      onPress={() => setFilter(filterValue)}
    >
      <Text
        style={[
          styles.filterText,
          filter === filterValue && styles.activeFilterText,
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );

  const GameCard: React.FC<{ game: Game }> = ({ game }) => (
    <TouchableOpacity
      style={[styles.gameCard, !game.available && styles.lockedCard]}
      onPress={() => {
        if (game.available) {
          navigation.navigate('GameDetail' as never, { gameId: game.id });
        }
      }}
      disabled={!game.available}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.gameTitle}>
          {game.title} {!game.available && '🔒'}
        </Text>
        <Text style={styles.gameDuration}>
          {formatDuration(game.duration_minutes)} • Level {game.level_required}
        </Text>
      </View>

      <Text style={styles.gameDescription}>{game.description}</Text>

      <View style={styles.cardFooter}>
        <Text style={styles.gameStats}>
          Played {game.played_count} times • Last: {getTimeSinceLastPlayed(game.last_played_at)}
        </Text>

        <View style={styles.gameActions}>
          {game.available ? (
            <>
              <TouchableOpacity style={styles.playButton}>
                <Text style={styles.playButtonText}>Play</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.detailsButton}>
                <Text style={styles.detailsButtonText}>Details ></Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={styles.lockedButton} disabled>
              <Text style={styles.lockedButtonText}>Unlocks at Level {game.level_required}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.skyBlue} />
          <Text style={styles.loadingText}>Loading games...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Games</Text>
        <TouchableOpacity style={styles.helpButton}>
          <Text style={styles.helpText}>?</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filters}>
        <FilterButton title="All" filterValue="all" />
        <FilterButton title="Quick" filterValue="quick" />
        <FilterButton title="Deep" filterValue="deep" />
        <FilterButton title="Daily" filterValue="daily" />
      </View>

      <ScrollView style={styles.gamesList}>
        {filteredGames.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}

        {filteredGames.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No games found for this filter</Text>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  helpButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  helpText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  filters: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginBottom: 20,
    gap: 8,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: colors.lightGray,
  },
  activeFilter: {
    backgroundColor: colors.skyBlue,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  activeFilterText: {
    color: colors.white,
  },
  gamesList: {
    flex: 1,
    paddingHorizontal: 24,
  },
  gameCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 20,
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
  lockedCard: {
    opacity: 0.6,
  },
  cardHeader: {
    marginBottom: 12,
  },
  gameTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  gameDuration: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  gameDescription: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textPrimary,
    marginBottom: 16,
  },
  cardFooter: {},
  gameStats: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  gameActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  playButton: {
    backgroundColor: colors.skyBlue,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  playButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },
  detailsButton: {
    backgroundColor: 'transparent',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.skyBlue,
  },
  detailsButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.skyBlue,
  },
  lockedButton: {
    backgroundColor: colors.lightGray,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  lockedButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
});

export default GamesLibraryScreen;