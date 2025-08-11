import { useAuth } from '@/contexts/AuthContext';
import { projectService } from '@/database_services/projectService';
import { questService } from '@/database_services/questService';
import type { language } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import type { DraftProject, DraftQuest } from '@/store/localStore';
import { useLocalStore } from '@/store/localStore';
import { borderRadius, colors, fontSizes, spacing } from '@/styles/theme';
import type {
  StructuredProjectCreationProgress,
  StructuredProjectPreparationResult
} from '@/utils/structuredProjectCreator';
import { structuredProjectCreator } from '@/utils/structuredProjectCreator';
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
import { PaginatedQuestList } from './components/PaginatedQuestList';
import { ProjectTemplateSelector } from './components/ProjectTemplateSelector';
import { StructuredProjectConfirmationModal } from './components/StructuredProjectConfirmationModal';
import { useSimpleHybridData } from './useHybridData';

type Language = typeof language.$inferSelect;
type ProjectType = 'custom' | 'template';

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

// Progress Modal Component
interface ProgressModalProps {
  visible: boolean;
  progress: StructuredProjectCreationProgress;
}

const ProgressModal: React.FC<ProgressModalProps> = ({ visible, progress }) => {
  if (!visible) return null;

  const progressPercentage =
    progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  return (
    <View style={styles.progressOverlay}>
      <View style={styles.progressModal}>
        <Text style={styles.progressTitle}>Creating Project</Text>
        <Text style={styles.progressMessage}>{progress.message}</Text>

        <View style={styles.progressBarContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${progressPercentage}%` }
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {progress.current} / {progress.total}
          </Text>
        </View>

        <View style={styles.progressStages}>
          {(['project', 'quests', 'assets'] as const).map((stage) => (
            <View
              key={stage}
              style={[
                styles.progressStage,
                progress.stage === stage && styles.progressStageActive,
                (['project', 'quests', 'assets'] as const).indexOf(stage) <
                (['project', 'quests', 'assets'] as const).indexOf(
                  progress.stage
                )
                  ? styles.progressStageComplete
                  : {}
              ]}
            >
              <Text style={styles.progressStageText}>
                {stage.charAt(0).toUpperCase() + stage.slice(1)}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

export default function NextGenProjectCreationView() {
  const { goBack } = useAppNavigation();
  const { currentUser } = useAuth();

  // Project type and template selection
  const [projectType, setProjectType] = useState<ProjectType>('custom');
  const [selectedTemplateId, setSelectedTemplateId] = useState<
    string | undefined
  >();

  // Local state for project creation
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [sourceLanguageId, setSourceLanguageId] = useState<string | null>(null);
  const [targetLanguageId, setTargetLanguageId] = useState<string | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // Progress tracking for structured projects
  const [creationProgress, setCreationProgress] =
    useState<StructuredProjectCreationProgress>({
      stage: 'project',
      current: 0,
      total: 1,
      message: ''
    });

  // Confirmation modal for structured projects
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [preparedProjectData, setPreparedProjectData] =
    useState<StructuredProjectPreparationResult | null>(null);

  // Quest editing state (only for custom projects)
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
    if (!currentUser) {
      Alert.alert('Error', 'Cannot publish project - user not logged in');
      return;
    }

    if (!isProjectValid) {
      Alert.alert('Error', 'Please complete all required project fields');
      return;
    }

    // Create project data from current form state
    const projectData: DraftProject = {
      id: 'temp', // Will be ignored
      name: projectName.trim(),
      description: projectDescription.trim() || undefined,
      source_language_id: sourceLanguageId,
      target_language_id: targetLanguageId,
      private: isPrivate,
      visible: true,
      created_at: new Date(),
      last_updated: new Date()
    };

    console.log(
      `Publishing project: "${projectData.name}" (type: ${projectType})`
    );

    if (projectType === 'template' && selectedTemplateId) {
      // Template-based project creation with confirmation
      try {
        console.log(
          `Preparing structured project from template: ${selectedTemplateId}`
        );

        // Optionally prepare data, but we will confirm lazily with templateId
        let preparedData: StructuredProjectPreparationResult | null = null;
        try {
          preparedData = structuredProjectCreator.prepareProjectFromTemplate(
            selectedTemplateId,
            projectData
          );
          console.log('Prepared data:', {
            questCount: preparedData.stats.questCount,
            assetCount: preparedData.stats.assetCount,
            contentCount: preparedData.stats.contentCount
          });
        } catch (e) {
          console.warn(
            'Preparation optional step failed; proceeding with templateId only',
            e
          );
        }

        setPreparedProjectData(preparedData);
        setShowConfirmationModal(true);
      } catch (error) {
        console.error('Error preparing project:', error);
        Alert.alert(
          'Preparation Error',
          `Failed to prepare project: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    } else {
      // Custom project creation (no confirmation needed)
      await handleCustomProjectCreation(projectData);
    }
  };

  const handleConfirmStructuredProject = async () => {
    if (!currentUser || !preparedProjectData) return;

    setIsPublishing(true);
    setShowConfirmationModal(false);

    try {
      const projectData: DraftProject = {
        id: 'temp',
        name: projectName.trim(),
        description: projectDescription.trim() || undefined,
        source_language_id: sourceLanguageId!,
        target_language_id: targetLanguageId!,
        private: isPrivate,
        visible: true,
        created_at: new Date(),
        last_updated: new Date()
      };

      console.log('Creating templated project with lazy materialization flag');

      // Store the template flag on the project; defer record creation
      const newProject = await projectService.createProjectFromDraft(
        projectData,
        currentUser.id,
        { templates: ['every-language-bible'] }
      );

      Alert.alert(
        'Project Created!',
        `Created "${newProject.name}". Content will be backed up to the cloud as you translate.`,
        [{ text: 'OK', onPress: () => goBack() }]
      );
    } catch (error) {
      console.error('Error creating templated project:', error);
      Alert.alert(
        'Creation Error',
        `Failed to create templated project: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsPublishing(false);
      setPreparedProjectData(null);
    }
  };

  const handleCancelStructuredProject = () => {
    setShowConfirmationModal(false);
    setPreparedProjectData(null);
    console.log('User cancelled structured project creation');
  };

  const handleCustomProjectCreation = async (projectData: DraftProject) => {
    if (!currentUser) return;

    setIsPublishing(true);

    try {
      // Custom project creation with manual quests
      console.log('Creating custom project:', projectData);
      console.log('With quests:', draftQuests);

      // 1. Create the project in the database
      const newProject = await projectService.createProjectFromDraft(
        projectData,
        currentUser.id
      );

      console.log('Custom project created:', newProject.id);

      // 2. Create all associated quests
      let createdQuests: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
      if (draftQuests.length > 0) {
        createdQuests = await questService.createMultipleQuestsFromDrafts(
          draftQuests,
          newProject.id,
          currentUser.id
        );
        console.log('Created quests:', createdQuests.length);
      }

      // 3. Clean up draft state
      if (draftProjectId) {
        console.log('Cleaning up draft project:', draftProjectId);
        removeDraftProject(draftProjectId);
      }

      Alert.alert(
        'Project Published!',
        `Successfully published "${newProject.name}" with ${createdQuests.length} quest${createdQuests.length !== 1 ? 's' : ''}.`,
        [{ text: 'OK', onPress: () => goBack() }]
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

  // Clean up draft project when switching to template mode
  React.useEffect(() => {
    if (projectType === 'template' && draftProjectId) {
      console.log(
        'Switching to template mode - cleaning up draft project:',
        draftProjectId
      );
      removeDraftProject(draftProjectId);
      setDraftProjectId(null);
    }
  }, [projectType, draftProjectId, removeDraftProject]);

  if (isLanguagesLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading languages...</Text>
      </View>
    );
  }

  const canPublish =
    isProjectValid &&
    (projectType === 'template' ||
      currentDraftProject ||
      draftQuests.length > 0);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create New Project</Text>
        <TouchableOpacity
          onPress={canPublish ? handlePublish : undefined}
          disabled={!canPublish || isPublishing}
          style={[
            styles.publishButton,
            (!canPublish || isPublishing) && styles.publishButtonDisabled
          ]}
        >
          <Text
            style={[
              styles.publishButtonText,
              (!canPublish || isPublishing) && styles.publishButtonTextDisabled
            ]}
          >
            {isPublishing ? 'Publishing...' : 'Publish'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Project Template Selection */}
        <ProjectTemplateSelector
          selectedType={projectType}
          selectedTemplateId={selectedTemplateId}
          onTypeChange={setProjectType}
          onTemplateChange={setSelectedTemplateId}
        />

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
                currentDraftProject && projectType === 'custom'
                  ? handleUpdateDraftProject
                  : undefined
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
                currentDraftProject && projectType === 'custom'
                  ? handleUpdateDraftProject
                  : undefined
              }
            />
          </View>

          <LanguageSelect
            label="Source Language *"
            selectedLanguageId={sourceLanguageId}
            onSelect={(languageId) => {
              setSourceLanguageId(languageId);
              if (currentDraftProject && projectType === 'custom') {
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
              if (currentDraftProject && projectType === 'custom') {
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
              if (currentDraftProject && projectType === 'custom') {
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

          {projectType === 'custom' && !currentDraftProject && (
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

        {/* Quests Section - Only for Custom Projects */}
        {projectType === 'custom' && currentDraftProject && (
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

            {/* Paginated Quest List */}
            <PaginatedQuestList
              quests={draftQuests}
              onEditQuest={handleEditQuest}
              onDeleteQuest={handleDeleteQuest}
            />
          </View>
        )}
      </ScrollView>

      {/* Progress Modal for Structured Project Creation */}
      <ProgressModal
        visible={isPublishing && projectType === 'template'}
        progress={creationProgress}
      />

      {/* Confirmation Modal for Structured Project Creation */}
      <StructuredProjectConfirmationModal
        visible={showConfirmationModal}
        projectName={projectName}
        preparedData={preparedProjectData}
        templateId={selectedTemplateId}
        onConfirm={handleConfirmStructuredProject}
        onCancel={handleCancelStructuredProject}
        isLoading={isPublishing}
      />
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
    borderBottomColor: colors.inputBackground
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
    borderColor: colors.inputBackground
  },
  languageList: {
    maxHeight: 200
  },
  languageOption: {
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: colors.inputBackground
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
  },
  progressOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  },
  progressModal: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.large,
    padding: spacing.large,
    alignItems: 'center',
    width: '80%'
  },
  progressTitle: {
    fontSize: fontSizes.large,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.small
  },
  progressMessage: {
    fontSize: fontSizes.medium,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.medium
  },
  progressBarContainer: {
    width: '100%',
    height: 10,
    backgroundColor: colors.inputBackground,
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: spacing.medium
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 5
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 5
  },
  progressText: {
    fontSize: fontSizes.small,
    color: colors.textSecondary
  },
  progressStages: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: spacing.medium
  },
  progressStage: {
    paddingVertical: spacing.xsmall,
    paddingHorizontal: spacing.medium,
    borderRadius: borderRadius.small,
    backgroundColor: colors.inputBackground
  },
  progressStageActive: {
    backgroundColor: colors.primary + '20',
    borderWidth: 1,
    borderColor: colors.primary
  },
  progressStageComplete: {
    backgroundColor: colors.primary + '20',
    borderWidth: 1,
    borderColor: colors.primary
  },
  progressStageText: {
    fontSize: fontSizes.small,
    color: colors.text,
    fontWeight: '500'
  }
});
