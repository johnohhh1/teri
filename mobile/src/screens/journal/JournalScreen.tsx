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
import { useApi } from '../../context/ApiContext';
import { colors } from '../../styles/colors';

interface JournalEntry {
  id: string;
  level?: number;
  section?: number;
  prompt: string;
  content: string;
  shared_with_partner: boolean;
  created_at: string;
  updated_at: string;
}

const JournalScreen: React.FC = () => {
  const { api } = useApi();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadJournalEntries();
  }, []);

  const loadJournalEntries = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/v1/journal');
      setEntries(response.data.entries || []);
    } catch (error) {
      console.error('Error loading journal entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const JournalEntryCard: React.FC<{ entry: JournalEntry }> = ({ entry }) => (
    <View style={styles.entryCard}>
      <View style={styles.entryHeader}>
        <View style={styles.entryInfo}>
          {entry.level && entry.section ? (
            <Text style={styles.entryLevel}>
              Level {entry.level}, Section {entry.section}
            </Text>
          ) : (
            <Text style={styles.entryLevel}>Personal Entry</Text>
          )}
          <Text style={styles.entryDate}>{formatDate(entry.created_at)}</Text>
        </View>
        {entry.shared_with_partner && (
          <Text style={styles.sharedIcon}>👥</Text>
        )}
      </View>

      <Text style={styles.entryPrompt}>{entry.prompt}</Text>

      <Text
        style={styles.entryContent}
        numberOfLines={3}
        ellipsizeMode="tail"
      >
        {entry.content}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.skyBlue} />
          <Text style={styles.loadingText}>Loading your journal...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Journal</Text>
        <TouchableOpacity style={styles.addButton}>
          <Text style={styles.addButtonText}>+ Add Entry</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {entries.length > 0 ? (
          entries.map((entry) => (
            <JournalEntryCard key={entry.id} entry={entry} />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No Journal Entries Yet</Text>
            <Text style={styles.emptyText}>
              Your journal entries from training sections will appear here.
              You can also create personal entries to reflect on your relationship journey.
            </Text>
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
  addButton: {
    backgroundColor: colors.lavender,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  entryCard: {
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
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  entryInfo: {},
  entryLevel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.skyBlue,
    marginBottom: 2,
  },
  entryDate: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  sharedIcon: {
    fontSize: 16,
  },
  entryPrompt: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 12,
    lineHeight: 22,
  },
  entryContent: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
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
});

export default JournalScreen;