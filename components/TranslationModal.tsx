import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { colors, fontSizes, spacing, borderRadius } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';

interface TranslationModalProps {
  isVisible: boolean;
  onClose: () => void;
  translation: {
    id: string;
    text: string;
    fullText: string;
  };
}

export const TranslationModal: React.FC<TranslationModalProps> = ({ isVisible, onClose, translation }) => {
  if (!isVisible) return null;

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.overlay} onPress={onClose} />
      <View style={styles.modal}>
        <View style={styles.header}>
          <Text style={styles.title}>Translation {translation.id}</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.scrollView}>
          <Text style={styles.text}>{translation.fullText}</Text>
        </ScrollView>
      </View>
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.medium,
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: spacing.small,
  },
  title: {
    fontSize: fontSizes.large,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.medium,
  },
  scrollView: {
    maxHeight: '80%',
  },
  text: {
    fontSize: fontSizes.medium,
    color: colors.text,
  },
});