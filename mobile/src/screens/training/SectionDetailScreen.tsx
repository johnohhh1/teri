import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useApi } from '../../context/ApiContext';
import { colors } from '../../styles/colors';

interface Video {
  id: string;
  title: string;
  url: string;
  duration_seconds: number;
}

interface SectionContent {
  level: number;
  section: number;
  title: string;
  content: {
    book_pages: number[];
    videos: Video[];
    journal_prompt?: string;
    activities: string[];
  };
  my_status: 'not_started' | 'in_progress' | 'complete';
}

const SectionDetailScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { level, section } = route.params as { level: number; section: number };
  const { api } = useApi();

  const [sectionData, setSectionData] = useState<SectionContent | null>(null);
  const [activeTab, setActiveTab] = useState<'book' | 'videos' | 'journal' | 'activities'>('book');
  const [loading, setLoading] = useState(true);
  const [journalEntry, setJournalEntry] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    loadSectionData();
  }, [level, section]);

  const loadSectionData = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/v1/training/sections/${level}/${section}`);
      setSectionData(response.data);

      // Load existing journal entry if any
      if (response.data.content.journal_prompt) {
        try {
          const journalResponse = await api.get('/api/v1/journal', {
            params: { level, section }
          });
          const existingEntry = journalResponse.data.entries?.find(
            (entry: any) => entry.level === level && entry.section === section
          );
          if (existingEntry) {
            setJournalEntry(existingEntry.content);
          }
        } catch (error) {
          // No existing entry, that's fine
        }
      }
    } catch (error) {
      console.error('Error loading section data:', error);
      Alert.alert('Error', 'Failed to load section content');
    } finally {
      setLoading(false);
    }
  };

  const saveJournalEntry = async () => {
    if (!journalEntry.trim() || !sectionData?.content.journal_prompt) return;

    try {
      await api.post('/api/v1/journal', {
        level,
        section,
        prompt: sectionData.content.journal_prompt,
        content: journalEntry,
      });
    } catch (error) {
      console.error('Error saving journal entry:', error);
    }
  };

  const markSectionComplete = async () => {
    if (!sectionData) return;

    // Check if all content is consumed
    const hasJournalPrompt = !!sectionData.content.journal_prompt;
    const journalComplete = !hasJournalPrompt || journalEntry.trim().length > 0;

    if (!journalComplete) {
      Alert.alert('Complete Journal Entry', 'Please complete the journal prompt before marking this section as complete.');
      setActiveTab('journal');
      return;
    }

    setCompleting(true);

    try {
      // Save journal entry first if needed
      await saveJournalEntry();

      // Mark section as complete
      await api.post(`/api/v1/training/sections/${level}/${section}/complete`);

      Alert.alert(
        'Section Complete!',
        'Great work! Once your partner completes this section, you\'ll both enter a 24-hour integration period.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to complete section');
    } finally {
      setCompleting(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const TabButton: React.FC<{
    title: string;
    tab: 'book' | 'videos' | 'journal' | 'activities';
    badge?: number;
  }> = ({ title, tab, badge }) => (
    <TouchableOpacity
      style={[styles.tabButton, activeTab === tab && styles.activeTab]}
      onPress={() => setActiveTab(tab)}
    >
      <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
        {title}
      </Text>
      {badge && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.skyBlue} />
        </View>
      </SafeAreaView>
    );
  }

  if (!sectionData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load section content</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Level {level}, Section {section}</Text>
          <Text style={styles.headerSubtitle}>{sectionData.title}</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TabButton title="Book" tab="book" badge={sectionData.content.book_pages.length} />
        <TabButton title="Videos" tab="videos" badge={sectionData.content.videos.length} />
        {sectionData.content.journal_prompt && (
          <TabButton title="Journal" tab="journal" />
        )}
        <TabButton title="Activities" tab="activities" badge={sectionData.content.activities.length} />
      </View>

      {/* Content */}
      <ScrollView style={styles.content}>
        {activeTab === 'book' && (
          <View style={styles.bookContent}>
            <View style={styles.pageNavigation}>
              <TouchableOpacity
                style={[styles.pageButton, currentPage === 1 && styles.pageButtonDisabled]}
                onPress={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                <Text style={styles.pageButtonText}>← Previous</Text>
              </TouchableOpacity>

              <Text style={styles.pageIndicator}>
                Page {currentPage} of {sectionData.content.book_pages.length}
              </Text>

              <TouchableOpacity
                style={[
                  styles.pageButton,
                  currentPage === sectionData.content.book_pages.length && styles.pageButtonDisabled
                ]}
                onPress={() => setCurrentPage(Math.min(sectionData.content.book_pages.length, currentPage + 1))}
                disabled={currentPage === sectionData.content.book_pages.length}
              >
                <Text style={styles.pageButtonText}>Next →</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.bookPage}>
              <Text style={styles.pageContent}>
                Page {sectionData.content.book_pages[currentPage - 1]} content would be displayed here.
                This would typically be loaded from your content management system or local assets.
              </Text>
            </View>
          </View>
        )}

        {activeTab === 'videos' && (
          <View style={styles.videosContent}>
            {sectionData.content.videos.map((video) => (
              <TouchableOpacity key={video.id} style={styles.videoCard}>
                <View style={styles.videoInfo}>
                  <Text style={styles.videoTitle}>{video.title}</Text>
                  <Text style={styles.videoDuration}>{formatDuration(video.duration_seconds)}</Text>
                </View>
                <Text style={styles.playIcon}>▶️</Text>
              </TouchableOpacity>
            ))}
            {sectionData.content.videos.length === 0 && (
              <Text style={styles.emptyText}>No videos for this section</Text>
            )}
          </View>
        )}

        {activeTab === 'journal' && sectionData.content.journal_prompt && (
          <View style={styles.journalContent}>
            <Text style={styles.journalPrompt}>{sectionData.content.journal_prompt}</Text>

            <TextInput
              style={styles.journalInput}
              value={journalEntry}
              onChangeText={setJournalEntry}
              placeholder="Write your thoughts here..."
              multiline
              textAlignVertical="top"
              onBlur={saveJournalEntry}
            />

            <View style={styles.journalActions}>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={saveJournalEntry}
              >
                <Text style={styles.saveButtonText}>Save Draft</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {activeTab === 'activities' && (
          <View style={styles.activitiesContent}>
            {sectionData.content.activities.map((activity, index) => (
              <View key={index} style={styles.activityCard}>
                <Text style={styles.activityText}>{activity}</Text>
              </View>
            ))}
            {sectionData.content.activities.length === 0 && (
              <Text style={styles.emptyText}>No activities for this section</Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.completeButton,
            (completing || sectionData.my_status === 'complete') && styles.buttonDisabled
          ]}
          onPress={markSectionComplete}
          disabled={completing || sectionData.my_status === 'complete'}
        >
          {completing ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.completeButtonText}>
              {sectionData.my_status === 'complete' ? 'Section Complete ✓' : 'Mark Section Complete'}
            </Text>
          )}
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
  header: {
    padding: 24,
    paddingBottom: 16,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  backText: {
    fontSize: 16,
    color: colors.skyBlue,
    fontWeight: '600',
  },
  headerInfo: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  activeTab: {
    borderBottomColor: colors.skyBlue,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  activeTabText: {
    color: colors.skyBlue,
    fontWeight: '600',
  },
  badge: {
    backgroundColor: colors.skyBlue,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 4,
  },
  badgeText: {
    fontSize: 10,
    color: colors.white,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  bookContent: {},
  pageNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  pageButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.skyBlue,
  },
  pageButtonDisabled: {
    opacity: 0.5,
  },
  pageButtonText: {
    color: colors.white,
    fontWeight: '600',
  },
  pageIndicator: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  bookPage: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 24,
    minHeight: 400,
  },
  pageContent: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  videosContent: {},
  videoCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  videoInfo: {
    flex: 1,
  },
  videoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  videoDuration: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  playIcon: {
    fontSize: 24,
  },
  journalContent: {},
  journalPrompt: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 16,
    lineHeight: 26,
  },
  journalInput: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    lineHeight: 24,
    minHeight: 200,
    borderWidth: 1,
    borderColor: colors.lightGray,
  },
  journalActions: {
    alignItems: 'center',
    marginTop: 16,
  },
  saveButton: {
    backgroundColor: colors.gold,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  saveButtonText: {
    color: colors.white,
    fontWeight: '600',
  },
  activitiesContent: {},
  activityCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  activityText: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 40,
  },
  footer: {
    padding: 24,
    paddingTop: 16,
  },
  completeButton: {
    backgroundColor: colors.skyBlue,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  completeButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.white,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: colors.error,
  },
});

export default SectionDetailScreen;