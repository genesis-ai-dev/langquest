import type { language } from '@/db/drizzleSchema';
import { borderRadius, colors, fontSizes, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

type Language = typeof language.$inferSelect;

interface LanguagePickerModalProps {
  visible: boolean;
  title: string;
  languages: Language[];
  selectedLanguageId: string | null;
  onSelect: (languageId: string) => void;
  onClose: () => void;
}

export const LanguagePickerModal: React.FC<LanguagePickerModalProps> = ({
  visible,
  title,
  languages,
  selectedLanguageId,
  onSelect,
  onClose
}) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return languages;
    return languages.filter((l) => {
      const a = l.english_name?.toLowerCase() || '';
      const b = l.native_name?.toLowerCase() || '';
      const c = l.iso_639_3?.toLowerCase() || '';
      return a.includes(q) || b.includes(q) || c.includes(q);
    });
  }, [languages, query]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={onClose}
      transparent={false}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerIconButton}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={styles.headerIconButton} />
        </View>

        <View style={styles.searchRow}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search languages, names or codes"
            placeholderTextColor={colors.textSecondary}
            autoFocus
            returnKeyType="search"
          />
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const selected = item.id === selectedLanguageId;
            return (
              <TouchableOpacity
                style={[styles.row, selected && styles.rowSelected]}
                onPress={() => {
                  onSelect(item.id);
                  onClose();
                }}
              >
                <View style={styles.rowTextContainer}>
                  <Text style={styles.rowPrimary} numberOfLines={1}>
                    {item.native_name || item.english_name}
                  </Text>
                  {item.native_name && item.english_name && (
                    <Text style={styles.rowSecondary} numberOfLines={1}>
                      {item.english_name}
                    </Text>
                  )}
                </View>
                {selected && (
                  <Ionicons name="checkmark" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={styles.listContent}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: colors.inputBackground
  },
  headerIconButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerTitle: {
    fontSize: fontSizes.large,
    fontWeight: '600',
    color: colors.text
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    backgroundColor: colors.inputBackground,
    marginHorizontal: spacing.medium,
    marginTop: spacing.medium,
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
    borderRadius: borderRadius.medium
  },
  searchInput: {
    flex: 1,
    fontSize: fontSizes.medium,
    color: colors.text
  },
  listContent: {
    paddingVertical: spacing.small
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: colors.inputBackground
  },
  rowSelected: {
    backgroundColor: colors.primary + '10'
  },
  rowTextContainer: {
    flex: 1,
    paddingRight: spacing.medium
  },
  rowPrimary: {
    fontSize: fontSizes.medium,
    color: colors.text,
    fontWeight: '600'
  },
  rowSecondary: {
    fontSize: fontSizes.small,
    color: colors.textSecondary,
    marginTop: 2
  }
});

export default LanguagePickerModal;
