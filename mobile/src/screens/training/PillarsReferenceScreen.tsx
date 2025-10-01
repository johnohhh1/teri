import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../styles/colors';

const PillarsReferenceScreen: React.FC = () => {
  const navigation = useNavigation();

  const pillars = [
    {
      title: 'Freeness',
      description: 'Express yourself authentically without hiding or filtering your truth.',
      color: colors.skyBlue,
    },
    {
      title: 'Wholesomeness',
      description: 'Speak and act from a place of love and genuine care for the relationship.',
      color: colors.olive,
    },
    {
      title: 'Non-Meanness',
      description: 'Communicate without attacking, blaming, or being cruel to your partner.',
      color: colors.gold,
    },
    {
      title: 'Fairness',
      description: 'Consider both perspectives and seek solutions that honor both partners.',
      color: colors.coral,
    },
  ];

  const instructions = [
    'Speak truth consciously',
    'Listen with genuine curiosity',
    'Own your emotions and reactions',
    'Ask for what you need clearly',
    'Express appreciation regularly',
    'Practice vulnerability',
    'Take breaks when triggered',
    'Repair quickly when you mess up',
    'Honor your partner\'s experience',
    'Choose love over being right',
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Four Pillars & Ten Instructions</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Four Pillars */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>— The Four Pillars —</Text>
          <Text style={styles.sectionDescription}>
            The foundation of Truth Empowered Relationships
          </Text>

          {pillars.map((pillar, index) => (
            <View
              key={index}
              style={[styles.pillarCard, { borderLeftColor: pillar.color }]}
            >
              <Text style={[styles.pillarTitle, { color: pillar.color }]}>
                {pillar.title}
              </Text>
              <Text style={styles.pillarDescription}>
                {pillar.description}
              </Text>
            </View>
          ))}
        </View>

        {/* Ten Instructions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>— The Ten Instructions —</Text>
          <Text style={styles.sectionDescription}>
            Practical guidelines for daily relationship success
          </Text>

          <View style={styles.instructionsContainer}>
            {instructions.map((instruction, index) => (
              <View key={index} style={styles.instructionItem}>
                <View style={styles.instructionNumber}>
                  <Text style={styles.instructionNumberText}>
                    {index + 1}
                  </Text>
                </View>
                <Text style={styles.instructionText}>{instruction}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Quick Reference */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>— Quick Reference —</Text>

          <View style={styles.quickRefCard}>
            <Text style={styles.quickRefTitle}>TES Framework</Text>
            <Text style={styles.quickRefItem}>• OUTER: Observable facts</Text>
            <Text style={styles.quickRefItem}>• INNER: Your experience</Text>
            <Text style={styles.quickRefItem}>• UNDER: Deepest fear</Text>
            <Text style={styles.quickRefItem}>• WHY: Core need</Text>
            <Text style={styles.quickRefItem}>• ASK: Clear request</Text>
          </View>

          <View style={styles.quickRefCard}>
            <Text style={styles.quickRefTitle}>TEL Framework</Text>
            <Text style={styles.quickRefItem}>• OUTER: What they said</Text>
            <Text style={styles.quickRefItem}>• UNDERCURRENTS: What they feel</Text>
            <Text style={styles.quickRefItem}>• WHAT MATTERS: Their values</Text>
            <Text style={styles.quickRefItem}>• QUESTIONS: Deepen understanding</Text>
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
    marginBottom: 16,
  },
  backText: {
    fontSize: 16,
    color: colors.skyBlue,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  section: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    fontStyle: 'italic',
  },
  pillarCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderLeftWidth: 4,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  pillarTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  pillarDescription: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  instructionsContainer: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 20,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  instructionNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.skyBlue,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  instructionNumberText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.white,
  },
  instructionText: {
    fontSize: 16,
    color: colors.textPrimary,
    flex: 1,
    lineHeight: 22,
  },
  quickRefCard: {
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
  quickRefTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  quickRefItem: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 6,
    lineHeight: 20,
  },
});

export default PillarsReferenceScreen;