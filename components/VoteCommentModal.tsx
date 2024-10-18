import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Modal, TouchableWithoutFeedback } from 'react-native';
import { colors, fontSizes, spacing, borderRadius } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';

interface VoteCommentModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSubmit: (comment: string) => void;
  voteType: 'up' | 'down';
}

export const VoteCommentModal: React.FC<VoteCommentModalProps> = ({ isVisible, onClose, onSubmit, voteType }) => {
  const [comment, setComment] = useState('');

  const handleSubmit = () => {
    onSubmit(comment);
    setComment('');
    onClose();
  };

  const handleNoComment = () => {
    onSubmit('');
    onClose();
  };

  return (
    <Modal 
      visible={isVisible} 
      transparent 
      animationType="slide"
      onRequestClose={onClose} // Handle back button press
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.container}>
              <View style={styles.modal}>
                <Ionicons
                  name={voteType === 'up' ? 'thumbs-up' : 'thumbs-down'}
                  size={40}
                  color={colors.primary}
                  style={styles.icon}
                />
                <TextInput
                  style={styles.textInput}
                  multiline
                  placeholder="Enter your comment (optional)"
                  placeholderTextColor={colors.textSecondary}
                  value={comment}
                  onChangeText={setComment}
                />
                <View style={styles.buttonContainer}>
                  <TouchableOpacity style={styles.button} onPress={handleNoComment}>
                    <Text style={styles.buttonText}>No Comment</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.button} onPress={handleSubmit}>
                    <Text style={styles.buttonText}>Submit</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '90%',
    maxWidth: 400,
  },
  modal: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.large,
    padding: spacing.large,
  },
  icon: {
    alignSelf: 'center',
    marginBottom: spacing.medium,
  },
  textInput: {
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
    color: colors.text,
    fontSize: fontSizes.medium,
    minHeight: 100,
    marginBottom: spacing.medium,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
    alignItems: 'center',
    marginHorizontal: spacing.small,
  },
  buttonText: {
    color: colors.buttonText,
    fontSize: fontSizes.medium,
    fontWeight: 'bold',
  },
});