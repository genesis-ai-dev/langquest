import { LanguageListSkeleton } from '@/components/LanguageListSkeleton';
import type { OnboardingStep } from '@/components/OnboardingProgressIndicator';
import { OnboardingProgressIndicator } from '@/components/OnboardingProgressIndicator';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/contexts/AuthContext';
import type { language as languageTable } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useLanguagesByRegion } from '@/hooks/useLanguagesByRegion';
import { useLocalization } from '@/hooks/useLocalization';
import { useProjectsByLanguage } from '@/hooks/useProjectsByLanguage';
import { useRegions } from '@/hooks/useRegions';
import { resolveTable } from '@/utils/dbUtils';
import { getThemeColor } from '@/utils/styleUtils';
import { useHybridData } from '@/views/new/useHybridData';
import { zodResolver } from '@hookform/resolvers/zod';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  View
} from 'react-native';
import {
  KeyboardAwareScrollView,
  KeyboardToolbar
} from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import uuid from 'react-native-uuid';
import { z } from 'zod';
import { ProjectListItem } from './ProjectListItem';

type Language = typeof languageTable.$inferSelect;

interface OnboardingFlowProps {
  visible: boolean;
  onClose: () => void;
}

type Step = OnboardingStep | 'create-language';

export function OnboardingFlow({ visible, onClose }: OnboardingFlowProps) {
  const { t } = useLocalization();
  const { currentUser } = useAuth();
  const { goToProject } = useAppNavigation();
  const queryClient = useQueryClient();
  const _insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>('region');
  const [projectType, setProjectType] = useState<
    'bible' | 'unstructured' | null
  >(null);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [selectedLanguageId, setSelectedLanguageId] = useState<string | null>(
    null
  );
  const [showCreateLanguage, setShowCreateLanguage] = useState(false);

  const { db } = system;

  // Query regions
  const { data: regions, isLoading: isLoadingRegions } = useRegions([
    'continent',
    'nation'
  ]);

  // Query languages by region
  const { data: languagesByRegion, isLoading: isLoadingLanguages } =
    useLanguagesByRegion(selectedRegionId);

  // Query projects by selected language
  const { data: projectsByLanguage = [], isLoading: isLoadingProjects } =
    useProjectsByLanguage(selectedLanguageId);

  // Query existing languages to map languoids to language records
  const { data: existingLanguages = [] } = useHybridData({
    dataType: 'all-languages-for-onboarding',
    queryKeyParams: [],
    offlineQuery: toCompilableQuery(
      system.db.query.language.findMany({
        where: (language, { eq }) => eq(language.active, true)
      })
    ),
    cloudQueryFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('language')
        .select('*')
        .eq('active', true)
        .overrideTypes<Language[]>();
      if (error) throw error;
      return data;
    },
    enableCloudQuery: true,
    enableOfflineQuery: true
  });

  // Language creation form schema
  const languageFormSchema = z.object({
    native_name: z.string().min(1, t('nameRequired')).trim(),
    english_name: z.string().optional().or(z.literal('')),
    iso639_3: z.string().optional(),
    locale: z.string().optional()
  });

  type LanguageFormData = z.infer<typeof languageFormSchema>;

  const languageForm = useForm<LanguageFormData>({
    resolver: zodResolver(languageFormSchema),
    defaultValues: {
      native_name: '',
      english_name: '',
      iso639_3: '',
      locale: ''
    }
  });

  // Create language mutation (uses synced table for immediate project publishing)
  const { mutateAsync: createLanguage, isPending: isCreatingLanguage } =
    useMutation({
      mutationFn: async (values: LanguageFormData) => {
        const newLanguage = await db
          .insert(resolveTable('language', { localOverride: false }))
          .values({
            id: uuid.v4(),
            native_name: values.native_name,
            english_name: values.english_name || null,
            iso639_3: values.iso639_3 || null,
            locale: values.locale || null,
            ui_ready: false,
            creator_id: currentUser!.id,
            download_profiles: [currentUser!.id]
          })
          .returning();

        if (!newLanguage[0]) throw new Error('Failed to create language');
        return newLanguage[0] as Language;
      }
    });

  // Create project mutation (uses synced tables for immediate project publishing)
  const { mutateAsync: createProject, isPending: isCreatingProject } =
    useMutation({
      mutationFn: async (languageId: string) => {
        const languageName =
          existingLanguages.find((l) => l.id === languageId)?.native_name ||
          existingLanguages.find((l) => l.id === languageId)?.english_name ||
          'Unknown Language';
        const projectName =
          projectType === 'bible'
            ? `Bible Translation - ${languageName}`
            : `Translation Project - ${languageName}`;

        let newProject:
          | { id: string; name: string; template: string | null }
          | undefined;
        await db.transaction(async (tx) => {
          const [project] = await tx
            .insert(resolveTable('project', { localOverride: false }))
            .values({
              name: projectName,
              template: projectType!,
              target_language_id: languageId,
              creator_id: currentUser!.id,
              download_profiles: [currentUser!.id],
              private: true,
              visible: true
            })
            .returning();

          if (!project) throw new Error('Failed to create project');

          await tx
            .insert(
              resolveTable('profile_project_link', { localOverride: false })
            )
            .values({
              id: `${currentUser!.id}_${project.id}`,
              project_id: project.id,
              profile_id: currentUser!.id,
              membership: 'owner'
              // download_profiles will be set by database trigger
            });

          newProject = project as {
            id: string;
            name: string;
            template: string | null;
          };
        });

        if (!newProject) throw new Error('Failed to create project');
        return newProject;
      },
      onSuccess: (newProject) => {
        // Invalidate queries
        void queryClient.invalidateQueries({ queryKey: ['my-projects'] });
        void queryClient.invalidateQueries({
          queryKey: ['projects-by-language']
        });

        // Navigate to the project
        goToProject({
          id: newProject.id,
          name: newProject.name,
          template: newProject.template
        });

        // Close onboarding and reset state
        handleClose();
      },
      onError: (error) => {
        console.error('Failed to create project', error);
      }
    });

  // Map languoids to language records - create language record if it doesn't exist
  const mappedLanguages = useMemo(() => {
    if (!Array.isArray(languagesByRegion) || !Array.isArray(existingLanguages))
      return [];

    return languagesByRegion.map((languoid) => {
      // Try to find existing language by matching names
      const existingLang = existingLanguages.find(
        (lang) =>
          lang.native_name?.toLowerCase() === languoid.name.toLowerCase() ||
          lang.english_name?.toLowerCase() === languoid.name.toLowerCase()
      );

      return {
        ...languoid,
        languageId: existingLang?.id || null,
        language: existingLang || null,
        // Store languoid info for creating language if needed
        languoidName: languoid.name
      };
    });
  }, [languagesByRegion, existingLanguages]);

  const handleRegionSelect = (regionId: string) => {
    setSelectedRegionId(regionId);
    setStep('language');
  };

  const handleLanguageSelect = async (
    languageId: string | null,
    languoidName?: string
  ) => {
    if (!languageId && languoidName) {
      // Need to create language record first
      try {
        const newLanguage = await createLanguage({
          native_name: languoidName,
          english_name: languoidName,
          iso639_3: '',
          locale: ''
        });
        setSelectedLanguageId(newLanguage.id);
        setStep('projects');
      } catch (error) {
        console.error('Failed to create language', error);
      }
    } else if (languageId) {
      setSelectedLanguageId(languageId);
      setStep('projects');
    }
  };

  const handleCreateLanguage = async (values: LanguageFormData) => {
    try {
      const newLanguage = await createLanguage(values);
      setSelectedLanguageId(newLanguage.id);
      setShowCreateLanguage(false);
      languageForm.reset();
      setStep('projects');
    } catch (error) {
      console.error('Failed to create language', error);
    }
  };

  const handleFormSubmit = languageForm.handleSubmit(handleCreateLanguage);

  const handleProjectSelect = (project: (typeof projectsByLanguage)[0]) => {
    // Navigate to existing project
    goToProject({
      id: project.id,
      name: project.name,
      template: project.template,
      projectData: project as Record<string, unknown>
    });
    handleClose();
  };

  const handleCreateNewProject = () => {
    setStep('create-project');
  };

  const handleProjectTypeSelect = async (type: 'bible' | 'unstructured') => {
    if (!selectedLanguageId) return;
    setProjectType(type);
    try {
      await createProject(selectedLanguageId);
    } catch (error) {
      console.error('Failed to create project', error);
    }
  };

  const handleBack = () => {
    if (step === 'language') {
      setStep('region');
      setSelectedRegionId(null);
    } else if (step === 'projects') {
      setStep('language');
      setSelectedLanguageId(null);
    } else if (step === 'create-project') {
      setStep('projects');
      setProjectType(null);
    } else if (step === 'create-language') {
      setStep('language');
      setShowCreateLanguage(false);
      languageForm.reset();
    }
  };

  const handleClose = () => {
    // Reset all state when closing
    setStep('region');
    setProjectType(null);
    setSelectedRegionId(null);
    setSelectedLanguageId(null);
    setShowCreateLanguage(false);
    languageForm.reset();
    onClose();
  };

  const isLoading = isCreatingLanguage || isCreatingProject;

  // Get selected language name for display
  const selectedLanguageName = useMemo(() => {
    if (!selectedLanguageId) return '';
    const lang = existingLanguages.find((l) => l.id === selectedLanguageId);
    return lang?.native_name || lang?.english_name || '';
  }, [selectedLanguageId, existingLanguages]);

  if (!visible) return null;

  // Determine progress step (exclude create-language from progress)
  const progressStep: OnboardingStep =
    step === 'create-language' ? 'language' : step;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View className="pt-safe flex-1 bg-background">
        {/* Progress Indicator */}
        {step !== 'create-language' && (
          <OnboardingProgressIndicator currentStep={progressStep} />
        )}

        {/* Header */}
        <View className="flex-row items-center justify-between border-b border-border px-6 py-4">
          <Text variant="h2" className="flex-1">
            {step === 'region' && t('selectRegion')}
            {step === 'language' && t('selectYourLanguage')}
            {step === 'projects' && t('selectProject')}
            {step === 'create-project' && t('whatWouldYouLikeToCreate')}
            {step === 'create-language' && t('createLanguage')}
          </Text>
          <Pressable onPress={handleClose} disabled={isLoading}>
            <Icon name="x" size={24} className="text-muted-foreground" />
          </Pressable>
        </View>

        {/* Content */}
        <KeyboardAwareScrollView
          className="flex-1"
          contentContainerClassName="p-6"
          bottomOffset={96}
          extraKeyboardSpace={20}
        >
          {/* Step 1: Region Selection */}
          {step === 'region' && (
            <View className="flex-1 gap-6">
              <Text
                variant="default"
                className="text-center text-muted-foreground"
              >
                {t('selectRegionToFilterLanguages')}
              </Text>

              {isLoadingRegions ? (
                <View className="flex-1 items-center justify-center">
                  <ActivityIndicator
                    size="large"
                    color={getThemeColor('primary')}
                  />
                </View>
              ) : (
                <View className="gap-3">
                  {regions.map((region) => (
                    <Button
                      key={region.id}
                      variant="outline"
                      onPress={() => handleRegionSelect(region.id)}
                      className="h-16 flex-row items-center justify-between px-6"
                      disabled={isLoading}
                    >
                      <View className="flex-row items-center gap-3">
                        <Icon name="globe" size={20} className="text-primary" />
                        <Text variant="default">{region.name}</Text>
                        <Text className="text-xs text-muted-foreground">
                          ({region.level})
                        </Text>
                      </View>
                    </Button>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Step 2: Language Selection */}
          {step === 'language' && !showCreateLanguage && (
            <View className="flex-1 gap-6">
              <Text
                variant="default"
                className="text-center text-muted-foreground"
              >
                {t('selectYourLanguage')}
              </Text>

              {isLoadingLanguages ? (
                <LanguageListSkeleton />
              ) : mappedLanguages.length === 0 ? (
                <View className="flex-1 items-center justify-center py-8">
                  <Icon
                    name="languages"
                    size={48}
                    className="mb-4 text-muted-foreground"
                  />
                  <Text
                    variant="default"
                    className="mb-2 text-center text-muted-foreground"
                  >
                    {t('noLanguagesFound')}
                  </Text>
                  <Text className="text-center text-sm text-muted-foreground/80">
                    {t('noLanguagesInRegion')}
                  </Text>
                  <Button
                    variant="default"
                    onPress={() => setShowCreateLanguage(true)}
                    className="mt-6"
                    disabled={isLoading}
                  >
                    <Text>{t('createNewLanguage')}</Text>
                  </Button>
                </View>
              ) : (
                <>
                  <ScrollView
                    className="flex-1"
                    contentContainerStyle={{ gap: 12 }}
                  >
                    {mappedLanguages.map((lang) => {
                      const languageId = lang.languageId;

                      return (
                        <Button
                          key={lang.id}
                          variant="outline"
                          onPress={() =>
                            handleLanguageSelect(languageId, lang.languoidName)
                          }
                          className="h-16 flex-row items-center justify-between px-6"
                          disabled={isLoading}
                        >
                          <View className="flex-row items-center gap-3">
                            <Icon
                              name="languages"
                              size={20}
                              className="text-primary"
                            />
                            <Text variant="default">{lang.name}</Text>
                            {!languageId && (
                              <Text className="text-xs text-muted-foreground">
                                ({t('willCreateLanguage')})
                              </Text>
                            )}
                          </View>
                        </Button>
                      );
                    })}
                  </ScrollView>

                  <Button
                    variant="ghost"
                    onPress={() => setShowCreateLanguage(true)}
                    className="mt-4"
                    disabled={isLoading}
                  >
                    <Text>{t('languageNotInList')}</Text>
                  </Button>
                </>
              )}
            </View>
          )}

          {/* Step 3: Project Selection */}
          {step === 'projects' && (
            <View className="flex-1 gap-6">
              {isLoadingProjects ? (
                <View className="flex-1 items-center justify-center">
                  <ActivityIndicator
                    size="large"
                    color={getThemeColor('primary')}
                  />
                </View>
              ) : (
                <>
                  {/* Create New Project Button - Always prominent */}
                  <Button
                    variant="default"
                    size="lg"
                    onPress={handleCreateNewProject}
                    className="mb-4 flex-row items-center justify-center gap-2"
                    disabled={isLoading}
                  >
                    <Icon
                      name="plus"
                      size={20}
                      className="text-primary-foreground"
                    />
                    <Text className="text-primary-foreground">
                      {projectsByLanguage.length === 0
                        ? t('createFirstProject')
                        : t('createNewProject')}
                    </Text>
                  </Button>

                  {/* Existing Projects List */}
                  {projectsByLanguage.length > 0 ? (
                    <View className="gap-4">
                      <Text
                        variant="default"
                        className="text-center text-muted-foreground"
                      >
                        {t('existingProjectsInLanguage', {
                          language: selectedLanguageName
                        })}
                      </Text>
                      <ScrollView
                        className="flex-1"
                        contentContainerStyle={{ gap: 12 }}
                      >
                        {projectsByLanguage.map((project) => (
                          <Pressable
                            key={project.id}
                            onPress={() => handleProjectSelect(project)}
                          >
                            <ProjectListItem
                              project={{
                                ...project,
                                source: 'cloud' as const
                              }}
                            />
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                  ) : (
                    <View className="flex-1 items-center justify-center py-8">
                      <Text
                        variant="default"
                        className="text-center text-muted-foreground"
                      >
                        {t('noProjectsInLanguage', {
                          language: selectedLanguageName
                        })}
                      </Text>
                    </View>
                  )}
                </>
              )}
            </View>
          )}

          {/* Step 4: Create Project Type Selection */}
          {step === 'create-project' && (
            <View className="flex-1 items-center justify-center gap-8">
              <Text variant="default" className="mb-4 text-center">
                {t('whatWouldYouLikeToCreate')}
              </Text>

              <View className="w-full gap-4">
                {/* Bible Project Card */}
                <Card className="w-full">
                  <Pressable
                    onPress={() => handleProjectTypeSelect('bible')}
                    disabled={isLoading}
                    accessibilityRole="button"
                  >
                    <View className="flex-row items-center p-6">
                      <View className="mr-6 h-16 w-16 items-center justify-center rounded-lg bg-muted">
                        <Icon
                          name="book-open"
                          size={32}
                          className="text-primary"
                        />
                      </View>
                      <View className="flex-1 flex-col items-start">
                        <Text
                          variant="h4"
                          className="mb-1"
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {t('createBibleProject')}
                        </Text>
                        <Text
                          className="text-sm text-muted-foreground"
                          numberOfLines={2}
                          ellipsizeMode="tail"
                        >
                          {t('translateBibleIntoYourLanguage')}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                </Card>

                {/* Other Translation Project Card */}
                <Card className="w-full">
                  <Pressable
                    onPress={() => handleProjectTypeSelect('unstructured')}
                    disabled={isLoading}
                    accessibilityRole="button"
                  >
                    <View className="flex-row items-center p-6">
                      <View className="mr-6 h-16 w-16 items-center justify-center rounded-lg bg-muted">
                        <Icon
                          name="church"
                          size={32}
                          className="text-primary"
                        />
                      </View>
                      <View className="flex-1 flex-col items-start">
                        <Text
                          variant="h4"
                          className="mb-1"
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {t('createOtherProject')}
                        </Text>
                        <Text
                          className="text-sm text-muted-foreground"
                          numberOfLines={2}
                          ellipsizeMode="tail"
                        >
                          {t('createGeneralTranslationProject')}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                </Card>
              </View>
            </View>
          )}

          {/* Step 5: Create Language */}
          {(step === 'create-language' || showCreateLanguage) && (
            <View className="flex-1 gap-6">
              <Text
                variant="default"
                className="text-center text-muted-foreground"
              >
                {t('createNewLanguage')}
              </Text>

              <View className="gap-4">
                <Input
                  placeholder={t('nativeName')}
                  value={languageForm.watch('native_name')}
                  onChangeText={(text) =>
                    languageForm.setValue('native_name', text)
                  }
                  type="next"
                  editable={!isLoading}
                />

                <Input
                  placeholder={t('englishName') + ' (Optional)'}
                  value={languageForm.watch('english_name')}
                  onChangeText={(text) =>
                    languageForm.setValue('english_name', text)
                  }
                  type="next"
                  editable={!isLoading}
                />

                <Input
                  placeholder={t('iso6393Code') + ' (Optional)'}
                  value={languageForm.watch('iso639_3')}
                  onChangeText={(text) =>
                    languageForm.setValue('iso639_3', text)
                  }
                  type="next"
                  editable={!isLoading}
                />

                <Input
                  placeholder={t('locale') + ' (Optional)'}
                  value={languageForm.watch('locale')}
                  onChangeText={(text) => languageForm.setValue('locale', text)}
                  onSubmitEditing={() => {
                    if (!isLoading && languageForm.formState.isValid) {
                      void handleFormSubmit();
                    }
                  }}
                  returnKeyType="done"
                  editable={!isLoading}
                />

                <Button
                  onPress={handleFormSubmit}
                  disabled={isLoading || !languageForm.formState.isValid}
                  className="mt-4"
                >
                  {isCreatingLanguage ? (
                    <ActivityIndicator
                      size="small"
                      color={getThemeColor('primary-foreground')}
                    />
                  ) : (
                    <Text>{t('createAndContinue')}</Text>
                  )}
                </Button>
              </View>
            </View>
          )}
        </KeyboardAwareScrollView>

        {/* Footer with Back button */}
        {step !== 'region' && (
          <View className="border-t border-border px-6 py-4">
            <Button variant="ghost" onPress={handleBack} disabled={isLoading}>
              <Text>{t('back')}</Text>
            </Button>
          </View>
        )}
      </View>
      <KeyboardToolbar />
    </Modal>
  );
}
