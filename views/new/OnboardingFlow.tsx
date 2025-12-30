import { LanguageListSkeleton } from '@/components/LanguageListSkeleton';
import type { OnboardingStep } from '@/components/OnboardingProgressIndicator';
import { OnboardingProgressIndicator } from '@/components/OnboardingProgressIndicator';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/contexts/AuthContext';
import { system } from '@/db/powersync/system';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useLanguagesByRegion } from '@/hooks/useLanguagesByRegion';
import { useLocalization } from '@/hooks/useLocalization';
import { useProjectsByLanguage } from '@/hooks/useProjectsByLanguage';
import { useRegions } from '@/hooks/useRegions';
import { resolveTable } from '@/utils/dbUtils';
import { createLanguoidOffline } from '@/utils/languoidUtils';
import { getThemeColor } from '@/utils/styleUtils';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BookOpenIcon,
  ChurchIcon,
  GlobeIcon,
  LanguagesIcon,
  PlusIcon,
  XIcon
} from 'lucide-react-native';
import React, { useState } from 'react';
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
import { z } from 'zod';
import { ProjectListItem } from './ProjectListItem';

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
  const [selectedLanguoidId, setSelectedLanguoidId] = useState<string | null>(
    null
  );
  const [showCreateLanguage, setShowCreateLanguage] = useState(false);

  const { db } = system;

  // Languoid creation form schema
  const languoidFormSchema = z.object({
    name: z.string().min(1, t('nameRequired')).trim(),
    iso639_3: z.string().optional().or(z.literal(''))
  });

  type LanguoidFormData = z.infer<typeof languoidFormSchema>;

  const languoidForm = useForm<LanguoidFormData>({
    resolver: zodResolver(languoidFormSchema),
    defaultValues: {
      name: '',
      iso639_3: ''
    }
  });

  // Create languoid mutation
  const { mutateAsync: createLanguoid, isPending: isCreatingLanguoid } =
    useMutation({
      mutationFn: async (values: LanguoidFormData) => {
        if (!currentUser?.id) throw new Error('User not authenticated');

        const result = await createLanguoidOffline({
          name: values.name.trim(),
          level: 'language',
          iso639_3: values.iso639_3?.trim() || undefined,
          creator_id: currentUser.id,
          ui_ready: false
        });

        return result.languoid_id;
      }
    });

  // Query regions
  const { data: regions, isLoading: isLoadingRegions } = useRegions([
    'continent',
    'nation'
  ]);

  // Query languages by region
  const { data: languagesByRegion, isLoading: isLoadingLanguages } =
    useLanguagesByRegion(selectedRegionId);

  // Query projects by selected languoid
  const { data: projectsByLanguage = [], isLoading: isLoadingProjects } =
    useProjectsByLanguage(selectedLanguoidId);

  // Create project mutation
  const { mutateAsync: createProject, isPending: isCreatingProject } =
    useMutation({
      mutationFn: async (languoidId: string) => {
        // Get languoid name for project name
        const { data: languoid } = await system.supabaseConnector.client
          .from('languoid')
          .select('name')
          .eq('id', languoidId)
          .single();

        const languageName =
          (languoid as { name?: string } | null)?.name || 'Unknown Language';
        const projectName =
          projectType === 'bible'
            ? `Bible Translation - ${languageName}`
            : `Translation Project - ${languageName}`;

        let newProject:
          | { id: string; name: string; template: string | null }
          | undefined;
        await db.transaction(async (tx) => {
          const [project] = await tx
            .insert(resolveTable('project', { localOverride: true }))
            .values({
              name: projectName,
              template: projectType!,
              creator_id: currentUser!.id,
              download_profiles: [currentUser!.id],
              private: true,
              visible: true
            })
            .returning();

          if (!project) throw new Error('Failed to create project');

          await tx
            .insert(
              resolveTable('profile_project_link', { localOverride: true })
            )
            .values({
              id: `${currentUser!.id}_${project.id}`,
              project_id: project.id,
              profile_id: currentUser!.id,
              membership: 'owner'
              // download_profiles will be set by database trigger
            });

          // Create project_language_link with languoid_id
          await tx
            .insert(
              resolveTable('project_language_link', { localOverride: true })
            )
            .values({
              project_id: project.id,
              languoid_id: languoidId,
              language_type: 'target',
              active: true,
              download_profiles: [currentUser!.id]
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

  const handleRegionSelect = (regionId: string) => {
    setSelectedRegionId(regionId);
    setStep('language');
  };

  const handleLanguageSelect = (languoidId: string) => {
    setSelectedLanguoidId(languoidId);
    setStep('projects');
  };

  const handleCreateLanguage = async (values: LanguoidFormData) => {
    try {
      const newLanguoidId = await createLanguoid(values);
      setSelectedLanguoidId(newLanguoidId);
      setShowCreateLanguage(false);
      languoidForm.reset();
      setStep('projects');
    } catch (error) {
      console.error('Failed to create languoid', error);
    }
  };

  const handleFormSubmit = languoidForm.handleSubmit(handleCreateLanguage);

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
    if (!selectedLanguoidId) return;
    setProjectType(type);
    try {
      await createProject(selectedLanguoidId);
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
      setSelectedLanguoidId(null);
    } else if (step === 'create-project') {
      setStep('projects');
      setProjectType(null);
    } else if (step === 'create-language') {
      setStep('language');
      setShowCreateLanguage(false);
      languoidForm.reset();
    }
  };

  const handleClose = () => {
    // Reset all state when closing
    setStep('region');
    setProjectType(null);
    setSelectedRegionId(null);
    setSelectedLanguoidId(null);
    setShowCreateLanguage(false);
    languoidForm.reset();
    onClose();
  };

  const isLoading = isCreatingLanguoid || isCreatingProject;

  // Get selected languoid name for display
  const selectedLanguageName =
    languagesByRegion.find((l) => l.id === selectedLanguoidId)?.name || '';

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
            <Icon as={XIcon} size={24} className="text-muted-foreground" />
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
                        <Icon
                          as={GlobeIcon}
                          size={20}
                          className="text-primary"
                        />
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
              ) : languagesByRegion.length === 0 ? (
                <View className="flex-1 items-center justify-center py-8">
                  <Icon
                    as={LanguagesIcon}
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
                    {languagesByRegion.map((languoid) => (
                      <Button
                        key={languoid.id}
                        variant="outline"
                        onPress={() => handleLanguageSelect(languoid.id)}
                        className="h-16 flex-row items-center justify-between px-6"
                        disabled={isLoading}
                      >
                        <View className="flex-row items-center gap-3">
                          <Icon
                            as={LanguagesIcon}
                            size={20}
                            className="text-primary"
                          />
                          <Text variant="default">{languoid.name}</Text>
                        </View>
                      </Button>
                    ))}
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

          {/* Step: Create Language */}
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
                  placeholder={t('name')}
                  value={languoidForm.watch('name')}
                  onChangeText={(text: string) =>
                    languoidForm.setValue('name', text)
                  }
                  type="next"
                  editable={!isLoading}
                />

                <Input
                  placeholder={
                    (t('iso6393Code') || 'ISO 639-3 Code') + ' (Optional)'
                  }
                  value={languoidForm.watch('iso639_3')}
                  onChangeText={(text: string) =>
                    languoidForm.setValue('iso639_3', text)
                  }
                  onSubmitEditing={() => {
                    if (!isLoading && languoidForm.formState.isValid) {
                      void handleFormSubmit();
                    }
                  }}
                  returnKeyType="done"
                  editable={!isLoading}
                />

                <Button
                  onPress={handleFormSubmit}
                  disabled={isLoading || !languoidForm.formState.isValid}
                  className="mt-4"
                >
                  {isCreatingLanguoid ? (
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
                      as={PlusIcon}
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
                          as={BookOpenIcon}
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
                          as={ChurchIcon}
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
