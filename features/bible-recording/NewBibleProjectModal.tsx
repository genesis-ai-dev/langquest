import type { BibleBook, BibleReference } from '@/constants/bibleStructure';
import { BIBLE_BOOKS, formatBibleReference } from '@/constants/bibleStructure';
import { useAuth } from '@/contexts/AuthContext';
import { useSessionLanguages } from '@/contexts/SessionCacheContext';
import { useLocalization } from '@/hooks/useLocalization';
import { borderRadius, colors, fontSizes, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { randomUUID } from 'expo-crypto';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

interface NewBibleProjectModalProps {
  isVisible: boolean;
  onClose: () => void;
  onProjectCreated: (project: {
    id: string;
    name: string;
    sourceLanguageId: string;
    targetLanguageId: string;
    initialReference: BibleReference;
  }) => void;
}

export const NewBibleProjectModal: React.FC<NewBibleProjectModalProps> = ({
  isVisible,
  onClose,
  onProjectCreated
}) => {
  const { t } = useLocalization();
  const { currentUser } = useAuth();
  const { languages } = useSessionLanguages();

  // Form state
  const [projectName, setProjectName] = useState('');
  const [sourceLanguageId, setSourceLanguageId] = useState('');
  const [targetLanguageId, setTargetLanguageId] = useState('');
  const [selectedBook, setSelectedBook] = useState<BibleBook | null>(null);
  const [selectedChapter, setSelectedChapter] = useState(1);
  const [selectedVerse, setSelectedVerse] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // UI state
  const [showBookSelector, setShowBookSelector] = useState(false);
  const [showSourceLanguageSelector, setShowSourceLanguageSelector] =
    useState(false);
  const [showTargetLanguageSelector, setShowTargetLanguageSelector] =
    useState(false);

  // Get available languages
  const sourceLanguages = languages?.filter((lang) => lang.ui_ready) || [];
  const targetLanguages = languages || [];

  // Get selected language names
  const selectedSourceLanguage = sourceLanguages.find(
    (lang) => lang.id === sourceLanguageId
  );
  const selectedTargetLanguage = targetLanguages.find(
    (lang) => lang.id === targetLanguageId
  );

  // Generate chapters for selected book
  const availableChapters = selectedBook
    ? Array.from({ length: selectedBook.chapters }, (_, i) => i + 1)
    : [];

  // Generate verses for selected chapter
  const availableVerses =
    selectedBook && selectedChapter
      ? Array.from(
          { length: selectedBook.verses[selectedChapter - 1] || 1 },
          (_, i) => i + 1
        )
      : [];

  // Handle book selection
  const handleBookSelection = useCallback(
    (book: BibleBook) => {
      setSelectedBook(book);
      setSelectedChapter(1);
      setSelectedVerse(1);
      setShowBookSelector(false);

      // Auto-generate project name if not set
      if (!projectName) {
        setProjectName(`${book.name} Translation`);
      }
    },
    [projectName]
  );

  // Handle chapter selection
  const handleChapterSelection = useCallback((chapter: number) => {
    setSelectedChapter(chapter);
    setSelectedVerse(1); // Reset to verse 1 when chapter changes
  }, []);

  // Validate form
  const isFormValid = useCallback(() => {
    return (
      projectName.trim() !== '' &&
      sourceLanguageId !== '' &&
      targetLanguageId !== '' &&
      selectedBook !== null &&
      selectedChapter > 0 &&
      selectedVerse > 0
    );
  }, [
    projectName,
    sourceLanguageId,
    targetLanguageId,
    selectedBook,
    selectedChapter,
    selectedVerse
  ]);

  // Handle project creation
  const handleCreateProject = useCallback(async () => {
    if (!isFormValid() || !currentUser || !selectedBook) {
      Alert.alert(t('error'), t('pleaseCompleteAllFields'));
      return;
    }

    setIsSubmitting(true);

    try {
      // Create the project object
      const newProject = {
        id: randomUUID(),
        name: projectName.trim(),
        sourceLanguageId,
        targetLanguageId,
        initialReference: {
          book: selectedBook.id,
          chapter: selectedChapter,
          verse: selectedVerse
        } as BibleReference
      };

      // Call the callback to handle project creation
      onProjectCreated(newProject);

      // Reset form
      setProjectName('');
      setSourceLanguageId('');
      setTargetLanguageId('');
      setSelectedBook(null);
      setSelectedChapter(1);
      setSelectedVerse(1);

      onClose();
    } catch (error) {
      console.error('Error creating Bible project:', error);
      Alert.alert(t('error'), t('failedToCreateProject'));
    } finally {
      setIsSubmitting(false);
    }
  }, [
    isFormValid,
    currentUser,
    selectedBook,
    projectName,
    sourceLanguageId,
    targetLanguageId,
    selectedChapter,
    selectedVerse,
    onProjectCreated,
    onClose,
    t
  ]);

  // Handle modal close
  const handleClose = useCallback(() => {
    if (isSubmitting) return;
    onClose();
  }, [isSubmitting, onClose]);

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} disabled={isSubmitting}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>

          <Text style={styles.title}>{t('newBibleProject')}</Text>

          <TouchableOpacity
            onPress={handleCreateProject}
            disabled={!isFormValid() || isSubmitting}
            style={[
              styles.createButton,
              (!isFormValid() || isSubmitting) && styles.createButtonDisabled
            ]}
          >
            <Text
              style={[
                styles.createButtonText,
                (!isFormValid() || isSubmitting) &&
                  styles.createButtonTextDisabled
              ]}
            >
              {isSubmitting ? t('creating') : t('create')}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {/* Project Name */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('projectName')}</Text>
            <TextInput
              style={styles.textInput}
              placeholder={t('enterProjectName')}
              placeholderTextColor={colors.textSecondary}
              value={projectName}
              onChangeText={setProjectName}
              editable={!isSubmitting}
            />
          </View>

          {/* Source Language */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('sourceLanguage')}</Text>
            <TouchableOpacity
              style={styles.selector}
              onPress={() => setShowSourceLanguageSelector(true)}
              disabled={isSubmitting}
            >
              <Text
                style={[
                  styles.selectorText,
                  !selectedSourceLanguage && styles.selectorPlaceholder
                ]}
              >
                {selectedSourceLanguage?.native_name ||
                  selectedSourceLanguage?.english_name ||
                  t('selectSourceLanguage')}
              </Text>
              <Ionicons
                name="chevron-down"
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* Target Language */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('targetLanguage')}</Text>
            <TouchableOpacity
              style={styles.selector}
              onPress={() => setShowTargetLanguageSelector(true)}
              disabled={isSubmitting}
            >
              <Text
                style={[
                  styles.selectorText,
                  !selectedTargetLanguage && styles.selectorPlaceholder
                ]}
              >
                {selectedTargetLanguage?.native_name ||
                  selectedTargetLanguage?.english_name ||
                  t('selectTargetLanguage')}
              </Text>
              <Ionicons
                name="chevron-down"
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* Starting Book */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('startingBook')}</Text>
            <TouchableOpacity
              style={styles.selector}
              onPress={() => setShowBookSelector(true)}
              disabled={isSubmitting}
            >
              <Text
                style={[
                  styles.selectorText,
                  !selectedBook && styles.selectorPlaceholder
                ]}
              >
                {selectedBook?.name || t('selectBook')}
              </Text>
              <Ionicons
                name="chevron-down"
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* Chapter and Verse Selection */}
          {selectedBook && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('startingVerse')}</Text>

              <View style={styles.verseSelector}>
                {/* Chapter Selection */}
                <View style={styles.versePickerContainer}>
                  <Text style={styles.versePickerLabel}>{t('chapter')}</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.versePickerScroll}
                  >
                    {availableChapters.map((chapter) => (
                      <TouchableOpacity
                        key={chapter}
                        style={[
                          styles.versePickerButton,
                          chapter === selectedChapter &&
                            styles.versePickerButtonActive
                        ]}
                        onPress={() => handleChapterSelection(chapter)}
                        disabled={isSubmitting}
                      >
                        <Text
                          style={[
                            styles.versePickerButtonText,
                            chapter === selectedChapter &&
                              styles.versePickerButtonTextActive
                          ]}
                        >
                          {chapter}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Verse Selection */}
                <View style={styles.versePickerContainer}>
                  <Text style={styles.versePickerLabel}>{t('verse')}</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.versePickerScroll}
                  >
                    {availableVerses.map((verse) => (
                      <TouchableOpacity
                        key={verse}
                        style={[
                          styles.versePickerButton,
                          verse === selectedVerse &&
                            styles.versePickerButtonActive
                        ]}
                        onPress={() => setSelectedVerse(verse)}
                        disabled={isSubmitting}
                      >
                        <Text
                          style={[
                            styles.versePickerButtonText,
                            verse === selectedVerse &&
                              styles.versePickerButtonTextActive
                          ]}
                        >
                          {verse}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>

              {/* Reference Preview */}
              <View style={styles.referencePreview}>
                <Text style={styles.referencePreviewText}>
                  {t('startingAt')}:{' '}
                  {formatBibleReference({
                    book: selectedBook.id,
                    chapter: selectedChapter,
                    verse: selectedVerse
                  })}
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Book Selector Modal */}
        <Modal
          visible={showBookSelector}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowBookSelector(false)}
        >
          <View style={styles.selectorModal}>
            <View style={styles.selectorHeader}>
              <TouchableOpacity onPress={() => setShowBookSelector(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={styles.selectorTitle}>{t('selectBook')}</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.selectorList}>
              {BIBLE_BOOKS.map((book) => (
                <TouchableOpacity
                  key={book.id}
                  style={styles.selectorItem}
                  onPress={() => handleBookSelection(book)}
                >
                  <Text style={styles.selectorItemText}>{book.name}</Text>
                  <Text style={styles.selectorItemSubtext}>
                    {book.chapters} {t('chapters')}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Modal>

        {/* Source Language Selector Modal */}
        <Modal
          visible={showSourceLanguageSelector}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowSourceLanguageSelector(false)}
        >
          <View style={styles.selectorModal}>
            <View style={styles.selectorHeader}>
              <TouchableOpacity
                onPress={() => setShowSourceLanguageSelector(false)}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={styles.selectorTitle}>
                {t('selectSourceLanguage')}
              </Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.selectorList}>
              {sourceLanguages.map((language) => (
                <TouchableOpacity
                  key={language.id}
                  style={styles.selectorItem}
                  onPress={() => {
                    setSourceLanguageId(language.id);
                    setShowSourceLanguageSelector(false);
                  }}
                >
                  <Text style={styles.selectorItemText}>
                    {language.native_name || language.english_name}
                  </Text>
                  {language.native_name && language.english_name && (
                    <Text style={styles.selectorItemSubtext}>
                      {language.english_name}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Modal>

        {/* Target Language Selector Modal */}
        <Modal
          visible={showTargetLanguageSelector}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowTargetLanguageSelector(false)}
        >
          <View style={styles.selectorModal}>
            <View style={styles.selectorHeader}>
              <TouchableOpacity
                onPress={() => setShowTargetLanguageSelector(false)}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={styles.selectorTitle}>
                {t('selectTargetLanguage')}
              </Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.selectorList}>
              {targetLanguages.map((language) => (
                <TouchableOpacity
                  key={language.id}
                  style={styles.selectorItem}
                  onPress={() => {
                    setTargetLanguageId(language.id);
                    setShowTargetLanguageSelector(false);
                  }}
                >
                  <Text style={styles.selectorItemText}>
                    {language.native_name || language.english_name}
                  </Text>
                  {language.native_name && language.english_name && (
                    <Text style={styles.selectorItemSubtext}>
                      {language.english_name}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Modal>
      </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  title: {
    fontSize: fontSizes.large,
    fontWeight: 'bold',
    color: colors.text
  },
  createButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
    borderRadius: borderRadius.medium
  },
  createButtonDisabled: {
    backgroundColor: colors.backgroundSecondary
  },
  createButtonText: {
    color: colors.buttonText,
    fontSize: fontSizes.medium,
    fontWeight: '600'
  },
  createButtonTextDisabled: {
    color: colors.textSecondary
  },
  content: {
    flex: 1,
    padding: spacing.medium
  },
  section: {
    marginBottom: spacing.large
  },
  sectionTitle: {
    fontSize: fontSizes.medium,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.small
  },
  textInput: {
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
    fontSize: fontSizes.medium,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border
  },
  selector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
    borderWidth: 1,
    borderColor: colors.border
  },
  selectorText: {
    fontSize: fontSizes.medium,
    color: colors.text
  },
  selectorPlaceholder: {
    color: colors.textSecondary
  },
  verseSelector: {
    gap: spacing.medium
  },
  versePickerContainer: {
    gap: spacing.small
  },
  versePickerLabel: {
    fontSize: fontSizes.small,
    fontWeight: '600',
    color: colors.textSecondary
  },
  versePickerScroll: {
    flexGrow: 0
  },
  versePickerButton: {
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.medium,
    marginRight: spacing.small
  },
  versePickerButtonActive: {
    backgroundColor: colors.primary
  },
  versePickerButtonText: {
    fontSize: fontSizes.medium,
    color: colors.text,
    fontWeight: '500'
  },
  versePickerButtonTextActive: {
    color: colors.buttonText,
    fontWeight: '600'
  },
  referencePreview: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
    marginTop: spacing.small
  },
  referencePreviewText: {
    fontSize: fontSizes.medium,
    color: colors.text,
    fontWeight: '600',
    textAlign: 'center'
  },
  selectorModal: {
    flex: 1,
    backgroundColor: colors.background
  },
  selectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  selectorTitle: {
    fontSize: fontSizes.large,
    fontWeight: 'bold',
    color: colors.text
  },
  selectorList: {
    flex: 1,
    padding: spacing.medium
  },
  selectorItem: {
    paddingVertical: spacing.medium,
    paddingHorizontal: spacing.small,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  selectorItemText: {
    fontSize: fontSizes.medium,
    color: colors.text,
    fontWeight: '500'
  },
  selectorItemSubtext: {
    fontSize: fontSizes.small,
    color: colors.textSecondary,
    marginTop: spacing.xsmall
  }
});

export default NewBibleProjectModal;
