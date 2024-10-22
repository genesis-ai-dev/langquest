import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal, TouchableWithoutFeedback } from 'react-native';
import { colors, fontSizes, spacing, borderRadius } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import AudioPlayer from './AudioPlayer';
import { VoteCommentModal } from './VoteCommentModal';

interface TranslationModalProps {
    isVisible: boolean;
    onClose: () => void;
    translation: {
      id: string;
      text: string;
      fullText: string;
      audioUri: any; 
      voteRank: number;
    };
  }

export const TranslationModal: React.FC<TranslationModalProps> = ({ isVisible, onClose, translation }) => {
  const [showVoteModal, setShowVoteModal] = useState(false);
  const [currentVote, setCurrentVote] = useState<'up' | 'down' | null>(null);
  const [voteComment, setVoteComment] = useState('');

  if (!isVisible) return null;

  const handleVote = (voteType: 'up' | 'down') => {
    setCurrentVote(voteType);
    setShowVoteModal(true);
  };

  const handleVoteSubmit = (comment: string) => {
    setVoteComment(comment);
    // Send the vote and comment to a backend later
    // For now, just store it in the component's state
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.overlay} onPress={onClose} />
      <View style={styles.modal}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={20} color={colors.text} />
        </TouchableOpacity>
        <ScrollView style={styles.scrollView}>
          <Text style={styles.text}>{translation.fullText}</Text>
        </ScrollView>
        <View style={styles.audioPlayerContainer}>
          <AudioPlayer 
            audioFiles={[{ id: translation.id, title: `Translation ${translation.id}`, uri: translation.audioUri }]}
            useCarousel={false}
            mini={true}
          />
        </View>

        <View style={styles.feedbackContainer}>
          <TouchableOpacity style={styles.feedbackButton} onPress={() => handleVote('up')}>
            <Ionicons
              name={currentVote === 'up' ? "thumbs-up" : "thumbs-up-outline"}
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
          <Text style={styles.voteRank}>{translation.voteRank}</Text>
          <TouchableOpacity style={styles.feedbackButton} onPress={() => handleVote('down')}>
            <Ionicons
              name={currentVote === 'down' ? "thumbs-down" : "thumbs-down-outline"}
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
        voteType={currentVote || 'up'}
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