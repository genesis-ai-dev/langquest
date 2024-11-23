import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { colors, fontSizes, spacing, borderRadius } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import AudioPlayer from './AudioPlayer';
import { VoteCommentModal } from './VoteCommentModal';
import { TranslationWithRelations } from '@/database_components/translationService';
import { voteService } from '@/database_components/voteService';
import { translationService } from '@/database_components/translationService';
import { vote } from '@/db/drizzleSchema';
import { Alert } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';

interface TranslationModalProps {
  translation: TranslationWithRelations;
  onClose: () => void;
  onVoteSubmitted: () => void;
}

export const TranslationModal: React.FC<TranslationModalProps> = ({ 
  translation: initialTranslation, 
  onClose, 
  onVoteSubmitted,
}) => {
  const { currentUser } = useAuth();
  const [translation, setTranslation] = useState(initialTranslation);
  const [showVoteModal, setShowVoteModal] = useState(false);
  const [currentVoteType, setCurrentVoteType] = useState<'up' | 'down'>('up');
  const [userVote, setUserVote] = useState<typeof vote.$inferSelect | null>(null);

  useEffect(() => {
    if (currentUser) {
      loadUserVote();
    }
  }, [currentUser]);

  useEffect(() => {
    loadUserVote();
  }, []);

  useEffect(() => {
    setTranslation(initialTranslation);
  }, [initialTranslation]);

  const loadUserVote = async () => {
    try {
      const vote = await voteService.getUserVoteForTranslation(translation.id, currentUser!.id);
      setUserVote(vote);
    } catch (error) {
      console.error('Error loading user vote:', error);
    }
  };

  const handleVote = async (voteType: 'up' | 'down') => {
    if (!currentUser) {
      Alert.alert('Error', 'You must be logged in to vote');
      return;
    }
    // If clicking the same vote type, remove the vote without showing modal
    if (userVote?.polarity === voteType) {
      try {
        await voteService.addVote({
          translationId: translation.id,
          creatorId: currentUser.id,
          polarity: voteType,
        });
        
        // Get updated translation data after vote removal
        const updatedTranslations = await translationService.getTranslationsByAssetId(translation.assetId);
        const updatedTranslation = updatedTranslations.find(t => t.id === translation.id);
        if (updatedTranslation) {
          setTranslation(updatedTranslation);
        }

        onVoteSubmitted();
        await loadUserVote();
      } catch (error) {
        console.error('Error removing vote:', error);
        Alert.alert('Error', 'Failed to remove vote');
      }
      return;
    }

    // Otherwise, show the comment modal for new/changed votes
    setCurrentVoteType(voteType);
    setShowVoteModal(true);
  };

  const handleVoteSubmit = async (comment: string) => {
    try {
      await voteService.addVote({
        translationId: translation.id,
        creatorId: currentUser!.id,
        polarity: currentVoteType,
        comment: comment || undefined,
      });
      
      // Get updated translation data after vote
      const updatedTranslations = await translationService.getTranslationsByAssetId(translation.assetId);
      const updatedTranslation = updatedTranslations.find(t => t.id === translation.id);
      if (updatedTranslation) {
        setTranslation(updatedTranslation);
      }

      onVoteSubmitted();
      await loadUserVote();
      setShowVoteModal(false);
    } catch (error) {
      console.error('Error submitting vote:', error);
      Alert.alert('Error', 'Failed to submit vote');
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.overlay} onPress={onClose} />
      <View style={styles.modal}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={20} color={colors.text} />
        </TouchableOpacity>
        
        <ScrollView style={styles.scrollView}>
          {/* <Text style={styles.translatorInfo}>
            Translated by {translation.creator.username} in{' '}
            {translation.targetLanguage.nativeName || translation.targetLanguage.englishName}
          </Text> */}
          <Text style={styles.text}>{translation.text}</Text>
        </ScrollView>

        <View style={styles.audioPlayerContainer}>
          <AudioPlayer 
            audioFiles={[]}
            useCarousel={false}
            mini={true}
          />
        </View>

        <View style={styles.feedbackContainer}>
        <TouchableOpacity style={styles.feedbackButton} onPress={() => handleVote('up')}>
          <Ionicons
            name={userVote?.polarity === 'up' ? "thumbs-up" : "thumbs-up-outline"}
            size={24}
            color={colors.text}
          />
        </TouchableOpacity>
        <Text style={styles.voteRank}>{translation.voteCount}</Text>
        <TouchableOpacity style={styles.feedbackButton} onPress={() => handleVote('down')}>
          <Ionicons
            name={userVote?.polarity === 'down' ? "thumbs-down" : "thumbs-down-outline"}
            size={24}
            color={colors.text}
          />
        </TouchableOpacity>
        </View>
      </View>

      <VoteCommentModal
        isVisible={showVoteModal}
        onClose={() => setShowVoteModal(false)}
        onSubmit={handleVoteSubmit}
        voteType={currentVoteType}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modal: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.large,
    padding: spacing.large,
    width: '90%',
    maxHeight: '80%',
    paddingTop: spacing.xlarge,
    paddingBottom: spacing.small,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.medium,
  },
  closeButton: {
    position: 'absolute',
    top: spacing.small,
    right: spacing.small,
    padding: spacing.small,
  },
  title: {
    fontSize: fontSizes.large,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.medium,
  },
  scrollView: {
    maxHeight: '70%', 
  },
  audioPlayerContainer: {
    marginTop: spacing.medium, // Add space above the audio player
  },
  feedbackContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.medium,
    paddingHorizontal: spacing.large,
  },
  voteRank: {
    fontSize: fontSizes.medium,
    color: colors.text,
    fontWeight: 'bold',
  },
  feedbackButton: {
    padding: spacing.medium,
    marginHorizontal: spacing.large,
  },
  text: {
    fontSize: fontSizes.medium,
    color: colors.text,
  },
});