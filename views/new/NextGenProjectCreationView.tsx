import { useAuth } from '@/contexts/AuthContext';
import { projectService } from '@/database_services/projectService';
import { questService } from '@/database_services/questService';
import type { language } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import type { DraftProject, DraftQuest } from '@/store/localStore';
import { useLocalStore } from '@/store/localStore';
import { borderRadius, colors, fontSizes, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSimpleHybridData } from './useHybridData';

type Language = typeof language.$inferSelect;

interface LanguageSelectProps {
  label: string;
  selectedLanguageId: string | null;
  onSelect: (languageId: string) => void;
  languages: Language[];
  placeholder: string;
}

const LanguageSelect: React.FC<LanguageSelectProps> = ({
  label,
  selectedLanguageId,
  onSelect,
  languages,
  placeholder
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const selectedLanguage = languages.find(
    (lang) => lang.id === selectedLanguageId
  );

  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TouchableOpacity
        style={styles.languageSelect}
        onPress={() => setIsOpen(!isOpen)}
      >
        <Text
          style={[
            styles.languageSelectText,
            !selectedLanguage && styles.placeholderText
          ]}
        >
          {selectedLanguage
            ? selectedLanguage.native_name || selectedLanguage.english_name
            : placeholder}
        </Text>
        <Ionicons
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.textSecondary}
        />
      </TouchableOpacity>

      {isOpen && (
        <View style={styles.languageDropdown}>
          <ScrollView style={styles.languageList} nestedScrollEnabled>
            {languages.map((language) => (
              <TouchableOpacity
                key={language.id}
                style={[
                  styles.languageOption,
                  selectedLanguageId === language.id &&
                    styles.selectedLanguageOption
                ]}
                onPress={() => {
                  onSelect(language.id);
                  setIsOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.languageOptionText,
                    selectedLanguageId === language.id &&
                      styles.selectedLanguageOptionText
                  ]}
                >
                  {language.native_name || language.english_name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

interface QuestItemProps {
  quest: DraftQuest;
  onEdit: (quest: DraftQuest) => void;
  onDelete: (questId: string) => void;
}

const QuestItem: React.FC<QuestItemProps> = ({ quest, onEdit, onDelete }) => {
  return (
    <View style={styles.questItem}>
      <View style={styles.questItemContent}>
        <Text style={styles.questName}>{quest.name}</Text>
        {quest.description && (
          <Text style={styles.questDescription}>{quest.description}</Text>
        )}
      </View>
      <View style={styles.questActions}>
        <TouchableOpacity onPress={() => onEdit(quest)}>
          <Ionicons name="create-outline" size={20} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onDelete(quest.id)}>
          <Ionicons name="trash-outline" size={20} color={colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default function NextGenProjectCreationView() {
  const { goBack } = useAppNavigation();
  const { currentUser } = useAuth();

  // Local state for project creation
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [sourceLanguageId, setSourceLanguageId] = useState<string | null>(null);
  const [targetLanguageId, setTargetLanguageId] = useState<string | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // Quest editing state
  const [editingQuest, setEditingQuest] = useState<DraftQuest | null>(null);
  const [questName, setQuestName] = useState('');
  const [questDescription, setQuestDescription] = useState('');
  const [showQuestForm, setShowQuestForm] = useState(false);

  // Draft project ID (will be set when project is created)
  const [draftProjectId, setDraftProjectId] = useState<string | null>(null);

  // Local store methods
  const {
    addDraftProject,
    updateDraftProject,
    removeDraftProject,
    addDraftQuest,
    updateDraftQuest,
    removeDraftQuest,
    getDraftQuestsByProjectId,
    draftProjects,
    getDraftProject
  } = useLocalStore();

  // Get languages using hybrid data approach
  const { data: languages, isLoading: isLanguagesLoading } =
    useSimpleHybridData<Language>(
      'languages',
      [],
      // Offline query - use SQL string instead of Drizzle query
      'SELECT * FROM language WHERE active = true ORDER BY english_name ASC',
      // Cloud query
      async () => {
        const { data, error } = await system.supabaseConnector.client
          .from('language')
          .select('*')
          .eq('active', true)
          .order('english_name');

        if (error) throw error;
        return data || [];
      }
    );

  // Get current draft project and its quests
  const currentDraftProject = draftProjectId
    ? getDraftProject(draftProjectId)
    : null;
  const draftQuests = draftProjectId
    ? getDraftQuestsByProjectId(draftProjectId)
    : [];

  // Validation
  const isProjectValid =
    projectName.trim() &&
    sourceLanguageId &&
    targetLanguageId &&
    sourceLanguageId !== targetLanguageId;

  const handleCreateDraftProject = () => {
    if (!currentUser) {
      Alert.alert('Error', 'You must be logged in to create a project');
      return;
    }

    if (!isProjectValid) {
      Alert.alert(
        'Validation Error',
        'Please fill in all required fields and ensure source and target languages are different'
      );
      return;
    }

    const projectData: Omit<
      DraftProject,
      'id' | 'created_at' | 'last_updated'
    > = {
      name: projectName.trim(),
      description: projectDescription.trim() || undefined,
      source_language_id: sourceLanguageId,
      target_language_id: targetLanguageId,
      private: isPrivate,
      visible: true
    };

    const newDraftId = addDraftProject(projectData);
    setDraftProjectId(newDraftId);
  };

  const handleUpdateDraftProject = () => {
    if (!draftProjectId || !isProjectValid) return;

    updateDraftProject(draftProjectId, {
      name: projectName.trim(),
      description: projectDescription.trim() || undefined,
      source_language_id: sourceLanguageId,
      target_language_id: targetLanguageId,
      private: isPrivate,
      visible: true
    });
  };

  const handleAddQuest = () => {
    if (!draftProjectId) return;

    if (!questName.trim()) {
      Alert.alert('Validation Error', 'Quest name is required');
      return;
    }

    if (editingQuest) {
      // Update existing quest
      updateDraftQuest(editingQuest.id, {
        name: questName.trim(),
        description: questDescription.trim() || undefined
      });
      setEditingQuest(null);
    } else {
      // Add new quest
      addDraftQuest({
        project_id: draftProjectId,
        name: questName.trim(),
        description: questDescription.trim() || undefined,
        visible: true
      });
    }

    // Reset quest form
    setQuestName('');
    setQuestDescription('');
    setShowQuestForm(false);
  };

  const handleEditQuest = (quest: DraftQuest) => {
    setEditingQuest(quest);
    setQuestName(quest.name);
    setQuestDescription(quest.description || '');
    setShowQuestForm(true);
  };

  const handleDeleteQuest = (questId: string) => {
    Alert.alert('Delete Quest', 'Are you sure you want to delete this quest?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => removeDraftQuest(questId)
      }
    ]);
  };

  const handleCancel = () => {
    if (draftProjectId) {
      Alert.alert(
        'Discard Draft',
        'Are you sure you want to discard this draft project?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              removeDraftProject(draftProjectId);
              goBack();
            }
          }
        ]
      );
    } else {
      goBack();
    }
  };

  const handlePublish = async () => {
    if (!currentDraftProject || !currentUser) {
      Alert.alert('Error', 'Cannot publish project');
      return;
    }

    setIsPublishing(true);

    try {
      console.log('Publishing project:', currentDraftProject);
      console.log('With quests:', draftQuests);

      // 1. Create the project in the database
      const newProject = await projectService.createProjectFromDraft(
        currentDraftProject,
        currentUser.id
      );

      console.log('Created project:', newProject);

      // 2. Create all associated quests
      let createdQuests: any[] = [];
      if (draftQuests.length > 0) {
        createdQuests = await questService.createMultipleQuestsFromDrafts(
          draftQuests,
          newProject.id,
          currentUser.id
        );
        console.log('Created quests:', createdQuests);
      }

      // 3. Remove from draft state once confirmed
      removeDraftProject(draftProjectId!);

      Alert.alert(
        'Project Published!',
        `Successfully published "${newProject.name}" with ${createdQuests.length} quest${createdQuests.length !== 1 ? 's' : ''}.`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate back to projects view
              goBack();
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error publishing project:', error);
      Alert.alert(
        'Publishing Error',
        `Failed to publish project: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsPublishing(false);
    }
  };

  // Initialize form with existing draft project data
  React.useEffect(() => {
    if (currentDraftProject) {
      setProjectName(currentDraftProject.name);
      setProjectDescription(currentDraftProject.description || '');
      setSourceLanguageId(currentDraftProject.source_language_id);
      setTargetLanguageId(currentDraftProject.target_language_id);
      setIsPrivate(currentDraftProject.private);
    }
  }, [currentDraftProject]);

  // Check if we have any existing draft project for this user
  React.useEffect(() => {
    const existingDrafts = draftProjects.filter(
      (p) => p.name === projectName.trim()
    );
    if (existingDrafts.length > 0 && !draftProjectId && existingDrafts[0]) {
      setDraftProjectId(existingDrafts[0].id);
    }
  }, [draftProjects, projectName, draftProjectId]);

  if (isLanguagesLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading languages...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {currentDraftProject ? 'Edit Draft Project' : 'Create New Project'}
        </Text>
        <TouchableOpacity
          onPress={currentDraftProject ? handlePublish : undefined}
          disabled={!currentDraftProject || isPublishing}
          style={[
            styles.publishButton,
            (!currentDraftProject || isPublishing) &&
              styles.publishButtonDisabled
          ]}
        >
          <Text
            style={[
              styles.publishButtonText,
              (!currentDraftProject || isPublishing) &&
                styles.publishButtonTextDisabled
            ]}
          >
            {isPublishing ? 'Publishing...' : 'Publish'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Project Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Project Details</Text>

          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Project Name *</Text>
            <TextInput
              style={styles.textInput}
              value={projectName}
              onChangeText={setProjectName}
              placeholder="Enter project name"
              placeholderTextColor={colors.textSecondary}
              onBlur={
                currentDraftProject ? handleUpdateDraftProject : undefined
              }
            />
          </View>

          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.textInput, styles.multilineInput]}
              value={projectDescription}
              onChangeText={setProjectDescription}
              placeholder="Enter project description (optional)"
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={3}
              onBlur={
                currentDraftProject ? handleUpdateDraftProject : undefined
              }
            />
          </View>

          <LanguageSelect
            label="Source Language *"
            selectedLanguageId={sourceLanguageId}
            onSelect={(languageId) => {
              setSourceLanguageId(languageId);
              if (currentDraftProject) {
                updateDraftProject(draftProjectId!, {
                  source_language_id: languageId
                });
              }
            }}
            languages={languages}
            placeholder="Select source language"
          />

          <LanguageSelect
            label="Target Language *"
            selectedLanguageId={targetLanguageId}
            onSelect={(languageId) => {
              setTargetLanguageId(languageId);
              if (currentDraftProject) {
                updateDraftProject(draftProjectId!, {
                  target_language_id: languageId
                });
              }
            }}
            languages={languages}
            placeholder="Select target language"
          />

          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => {
              const newPrivate = !isPrivate;
              setIsPrivate(newPrivate);
              if (currentDraftProject) {
                updateDraftProject(draftProjectId!, { private: newPrivate });
              }
            }}
          >
            <Ionicons
              name={isPrivate ? 'checkbox' : 'checkbox-outline'}
              size={24}
              color={colors.primary}
            />
            <Text style={styles.checkboxLabel}>Make this project private</Text>
          </TouchableOpacity>

          {!currentDraftProject && (
            <TouchableOpacity
              style={[
                styles.createDraftButton,
                !isProjectValid && styles.createDraftButtonDisabled
              ]}
              onPress={handleCreateDraftProject}
              disabled={!isProjectValid}
            >
              <Text
                style={[
                  styles.createDraftButtonText,
                  !isProjectValid && styles.createDraftButtonTextDisabled
                ]}
              >
                Create Draft Project
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Quests Section */}
        {currentDraftProject && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Quests ({draftQuests.length})
              </Text>
              <TouchableOpacity
                style={styles.addQuestButton}
                onPress={() => {
                  setEditingQuest(null);
                  setQuestName('');
                  setQuestDescription('');
                  setShowQuestForm(true);
                }}
              >
                <Ionicons name="add" size={20} color={colors.primary} />
                <Text style={styles.addQuestButtonText}>Add Quest</Text>
              </TouchableOpacity>
            </View>

            {/* Quest Form */}
            {showQuestForm && (
              <View style={styles.questForm}>
                <Text style={styles.questFormTitle}>
                  {editingQuest ? 'Edit Quest' : 'Add New Quest'}
                </Text>

                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldLabel}>Quest Name *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={questName}
                    onChangeText={setQuestName}
                    placeholder="Enter quest name"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>

                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldLabel}>Quest Description</Text>
                  <TextInput
                    style={[styles.textInput, styles.multilineInput]}
                    value={questDescription}
                    onChangeText={setQuestDescription}
                    placeholder="Enter quest description (optional)"
                    placeholderTextColor={colors.textSecondary}
                    multiline
                    numberOfLines={2}
                  />
                </View>

                <View style={styles.questFormActions}>
                  <TouchableOpacity
                    style={styles.questFormCancelButton}
                    onPress={() => {
                      setShowQuestForm(false);
                      setEditingQuest(null);
                      setQuestName('');
                      setQuestDescription('');
                    }}
                  >
                    <Text style={styles.questFormCancelText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.questFormSaveButton,
                      !questName.trim() && styles.questFormSaveButtonDisabled
                    ]}
                    onPress={handleAddQuest}
                    disabled={!questName.trim()}
                  >
                    <Text
                      style={[
                        styles.questFormSaveText,
                        !questName.trim() && styles.questFormSaveTextDisabled
                      ]}
                    >
                      {editingQuest ? 'Update Quest' : 'Add Quest'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Quest List */}
            {draftQuests.map((quest) => (
              <QuestItem
                key={quest.id}
                quest={quest}
                onEdit={handleEditQuest}
                onDelete={handleDeleteQuest}
              />
            ))}

            {draftQuests.length === 0 && !showQuestForm && (
              <View style={styles.emptyQuests}>
                <Text style={styles.emptyQuestsText}>
                  No quests added yet. Add your first quest to get started.
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background
  },
  loadingText: {
    fontSize: fontSizes.medium,
    color: colors.text
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  headerTitle: {
    fontSize: fontSizes.large,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    textAlign: 'center'
  },
  publishButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
    borderRadius: borderRadius.small
  },
  publishButtonDisabled: {
    backgroundColor: colors.inputBackground
  },
  publishButtonText: {
    color: colors.buttonText,
    fontSize: fontSizes.medium,
    fontWeight: '600'
  },
  publishButtonTextDisabled: {
    color: colors.textSecondary
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.medium
  },
  section: {
    marginVertical: spacing.medium
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.medium
  },
  sectionTitle: {
    fontSize: fontSizes.large,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.medium
  },
  fieldContainer: {
    marginBottom: spacing.medium
  },
  fieldLabel: {
    fontSize: fontSizes.medium,
    fontWeight: '500',
    color: colors.text,
    marginBottom: spacing.xsmall
  },
  textInput: {
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.medium,
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.medium,
    fontSize: fontSizes.medium,
    color: colors.text,
    minHeight: 48
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top'
  },
  languageSelect: {
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.medium,
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.medium,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48
  },
  languageSelectText: {
    fontSize: fontSizes.medium,
    color: colors.text,
    flex: 1
  },
  placeholderText: {
    color: colors.textSecondary
  },
  languageDropdown: {
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.medium,
    marginTop: spacing.xsmall,
    maxHeight: 200,
    borderWidth: 1,
    borderColor: colors.border
  },
  languageList: {
    maxHeight: 200
  },
  languageOption: {
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  selectedLanguageOption: {
    backgroundColor: colors.primary + '20'
  },
  languageOptionText: {
    fontSize: fontSizes.medium,
    color: colors.text
  },
  selectedLanguageOptionText: {
    color: colors.primary,
    fontWeight: '600'
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.medium
  },
  checkboxLabel: {
    fontSize: fontSizes.medium,
    color: colors.text,
    marginLeft: spacing.small
  },
  createDraftButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.medium,
    paddingVertical: spacing.medium,
    alignItems: 'center',
    marginTop: spacing.medium
  },
  createDraftButtonDisabled: {
    backgroundColor: colors.inputBackground
  },
  createDraftButtonText: {
    color: colors.buttonText,
    fontSize: fontSizes.medium,
    fontWeight: '600'
  },
  createDraftButtonTextDisabled: {
    color: colors.textSecondary
  },
  addQuestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
    borderRadius: borderRadius.small
  },
  addQuestButtonText: {
    color: colors.primary,
    fontSize: fontSizes.medium,
    fontWeight: '500',
    marginLeft: spacing.xsmall
  },
  questForm: {
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
    marginBottom: spacing.medium
  },
  questFormTitle: {
    fontSize: fontSizes.medium,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.medium
  },
  questFormActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.medium,
    marginTop: spacing.medium
  },
  questFormCancelButton: {
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small
  },
  questFormCancelText: {
    color: colors.textSecondary,
    fontSize: fontSizes.medium
  },
  questFormSaveButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
    borderRadius: borderRadius.small
  },
  questFormSaveButtonDisabled: {
    backgroundColor: colors.inputBackground
  },
  questFormSaveText: {
    color: colors.buttonText,
    fontSize: fontSizes.medium,
    fontWeight: '600'
  },
  questFormSaveTextDisabled: {
    color: colors.textSecondary
  },
  questItem: {
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
    marginBottom: spacing.small,
    flexDirection: 'row',
    alignItems: 'center'
  },
  questItemContent: {
    flex: 1
  },
  questName: {
    fontSize: fontSizes.medium,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xsmall
  },
  questDescription: {
    fontSize: fontSizes.small,
    color: colors.textSecondary
  },
  questActions: {
    flexDirection: 'row',
    gap: spacing.medium
  },
  emptyQuests: {
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.medium,
    padding: spacing.large,
    alignItems: 'center'
  },
  emptyQuestsText: {
    fontSize: fontSizes.medium,
    color: colors.textSecondary,
    textAlign: 'center'
  }
});
