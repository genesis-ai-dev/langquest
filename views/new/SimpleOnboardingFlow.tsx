import type { OnboardingStep } from '@/components/OnboardingProgressIndicator';
import { OnboardingProgressIndicator } from '@/components/OnboardingProgressIndicator';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useLocalization } from '@/hooks/useLocalization';
import { useLocalStore } from '@/store/localStore';
import { PortalHost } from '@rn-primitives/portal';
import {
  BookOpenIcon,
  FolderIcon,
  HelpCircle,
  MicIcon,
  UserPlusIcon,
  XIcon
} from 'lucide-react-native';
import React, { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import {
  KeyboardAwareScrollView,
  KeyboardToolbar
} from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedOnboardingIcon } from './onboarding/AnimatedOnboardingIcon';
import { AnimatedStepContent } from './onboarding/AnimatedStepContent';
import { BibleBookListAnimation } from './onboarding/BibleBookListAnimation';
import { BibleChapterGrid } from './onboarding/BibleChapterGrid';
import { InviteAnimation } from './onboarding/InviteAnimation';
import { ProjectCreationAnimation } from './onboarding/ProjectCreationAnimation';
import { QuestListAnimation } from './onboarding/QuestListAnimation';
import { RecordingAnimation } from './onboarding/RecordingAnimation';
import { VisionScreen } from './onboarding/VisionScreen';

interface SimpleOnboardingFlowProps {
  visible: boolean;
  onClose: () => void;
  onCreateProject?: () => void;
  onCreateQuest?: () => void;
  onStartRecording?: () => void;
  onInviteCollaborators?: () => void;
}

export function SimpleOnboardingFlow({
  visible,
  onClose,
  onCreateProject: _onCreateProject,
  onCreateQuest: _onCreateQuest,
  onStartRecording: _onStartRecording,
  onInviteCollaborators: _onInviteCollaborators
}: SimpleOnboardingFlowProps) {
  const { t } = useLocalization();
  const insets = useSafeAreaInsets();
  // Always start with vision step - language selection happens on terms page
  const [step, setStep] = useState<OnboardingStep>('vision');
  const [projectType, setProjectType] = useState<'bible' | 'other' | null>(
    null
  );
  const [showBibleChapters, setShowBibleChapters] = useState(false);

  // Reset step when modal opens - always start with vision
  React.useEffect(() => {
    if (visible) {
      setStep('vision');
    }
  }, [visible]);

  const handleNext = () => {
    if (step === 'vision') {
      setStep('create-project-simple');
    } else if (step === 'create-project-simple') {
      // This shouldn't happen - type selection handles navigation
      return;
    } else if (step === 'bible-select-book') {
      // First continue: show chapters below Genesis
      if (!showBibleChapters) {
        setShowBibleChapters(true);
      } else {
        // Second continue: move to recording step
        setStep('record-audio');
      }
    } else if (step === 'create-quest') {
      setStep('record-audio');
    } else if (step === 'record-audio') {
      setStep('invite-collaborators');
    } else {
      handleClose();
    }
  };

  const handleBack = () => {
    if (step === 'vision') {
      // Can't go back from vision - close onboarding
      handleClose();
    } else if (step === 'bible-select-book') {
      if (showBibleChapters) {
        setShowBibleChapters(false);
      } else {
        setStep('create-project-simple');
        setProjectType(null);
      }
    } else if (step === 'create-quest') {
      setStep('create-project-simple');
      setProjectType(null);
    } else if (step === 'record-audio') {
      if (projectType === 'bible') {
        setStep('bible-select-book');
        setShowBibleChapters(true); // Keep chapters visible when going back
      } else {
        setStep('create-quest');
      }
    } else if (step === 'invite-collaborators') {
      setStep('record-audio');
    } else if (step === 'create-project-simple') {
      setStep('vision');
    }
  };

  const setOnboardingCompleted = useLocalStore(
    (state) => state.setOnboardingCompleted
  );
  const setOnboardingIsOpen = useLocalStore(
    (state) => state.setOnboardingIsOpen
  );

  // Mark as open when this instance becomes visible
  // The parent component already prevents multiple instances by checking onboardingIsOpen
  // before setting showSimpleOnboarding to true
  React.useEffect(() => {
    if (visible) {
      setOnboardingIsOpen(true);
    } else {
      setOnboardingIsOpen(false);
    }
  }, [visible, setOnboardingIsOpen]);

  const handleClose = () => {
    // Reset to initial step (vision)
    setStep('vision');
    setProjectType(null);
    setShowBibleChapters(false);
    // Mark onboarding as completed so it doesn't show again
    setOnboardingCompleted(true);
    // Mark as closed in store
    setOnboardingIsOpen(false);
    onClose();
  };

  // Guard: Don't render if not visible
  if (!visible) {
    return null;
  }

  const handleAction = () => {
    // Just continue to next step - buttons are informational, not action buttons
    handleNext();
  };

  const handleProjectTypeSelect = (type: 'bible' | 'other') => {
    setProjectType(type);
    setShowBibleChapters(false);
    if (type === 'bible') {
      setStep('bible-select-book');
    } else {
      setStep('create-quest');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        {/* PortalHost for Select dropdowns inside Modal */}
        <PortalHost />

        {/* Progress Indicator */}
        <OnboardingProgressIndicator currentStep={step} />

        {/* Header */}
        <View className="flex-row items-center justify-between border-b border-border px-6 py-4">
          <View className="flex-1" />
          <Pressable onPress={handleClose} testID="onboarding-close-button">
            <Icon as={XIcon} size={24} className="text-muted-foreground" />
          </Pressable>
        </View>

        {/* Content */}
        <KeyboardAwareScrollView
          className="flex-1"
          contentContainerClassName="p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]"
          bottomOffset={96}
          extraKeyboardSpace={20}
        >
          {/* Step 0: Vision Screen */}
          {step === 'vision' && (
            <View className="flex-1">
              <VisionScreen />
              <AnimatedStepContent delay={1200}>
                <Button
                  variant="default"
                  size="lg"
                  onPress={handleAction}
                  className="mt-8 w-full"
                >
                  <Text className="text-primary-foreground">
                    {t('onboardingContinue')}
                  </Text>
                </Button>
              </AnimatedStepContent>
            </View>
          )}

          {/* Step 1: Create Project - Type Selection */}
          {step === 'create-project-simple' && (
            <View className="flex-1 items-center justify-center gap-8">
              <AnimatedStepContent>
                <View className="items-center gap-4">
                  <ProjectCreationAnimation />
                  <Text variant="h2" className="text-center">
                    {t('onboardingCreateProjectTitle')}
                  </Text>
                  <Text
                    variant="default"
                    className="text-center text-muted-foreground"
                  >
                    {t('onboardingCreateProjectSubtitle')}
                  </Text>
                </View>
              </AnimatedStepContent>

              <AnimatedStepContent delay={200}>
                <View className="w-full flex-row flex-wrap gap-4">
                  {/* Bible Project Button */}
                  <Button
                    variant="outline"
                    className="min-h-48 flex-1 basis-[40%] flex-col gap-3 p-6"
                    onPress={() => handleProjectTypeSelect('bible')}
                  >
                    <Icon
                      as={BookOpenIcon}
                      size={48}
                      className="text-primary"
                    />
                    <Text variant="h4" className="text-center">
                      {t('onboardingBible')}
                    </Text>
                  </Button>

                  {/* Custom Project Button */}
                  <Button
                    variant="outline"
                    className="min-h-48 flex-1 basis-[40%] flex-col gap-3 p-6"
                    onPress={() => handleProjectTypeSelect('other')}
                  >
                    <Icon as={FolderIcon} size={48} className="text-primary" />
                    <Text variant="h4" className="text-center">
                      {t('onboardingOther')}
                    </Text>
                  </Button>
                </View>
              </AnimatedStepContent>
            </View>
          )}

          {/* Bible Flow: Step 2 - Select Book (with chapters on second continue) */}
          {step === 'bible-select-book' && (
            <View className="flex-1 items-center justify-center gap-8">
              <AnimatedStepContent>
                <View className="items-center gap-4">
                  <AnimatedOnboardingIcon
                    icon={BookOpenIcon}
                    size={48}
                    animationType="float"
                  />
                  <Text variant="h2" className="text-center">
                    {showBibleChapters
                      ? t('onboardingBibleCreateChapterTitle')
                      : t('onboardingBibleSelectBookTitle')}
                  </Text>
                  <Text
                    variant="default"
                    className="text-center text-muted-foreground"
                  >
                    {showBibleChapters
                      ? t('onboardingBibleCreateChapterSubtitle')
                      : t('onboardingBibleSelectBookSubtitle')}
                  </Text>
                </View>
              </AnimatedStepContent>

              <AnimatedStepContent delay={200}>
                <Card className="w-full p-6">
                  <View className="gap-4">
                    {/* Animated book list */}
                    <View className="w-full gap-3">
                      {/* Genesis with chapters below */}
                      <View className="gap-2">
                        <BibleBookListAnimation
                          showChapters={showBibleChapters}
                          renderGenesis={(
                            genesisElement: React.ReactElement
                          ) => (
                            <View className="gap-2">
                              {genesisElement}
                              {/* Show chapters below Genesis when showBibleChapters is true */}
                              {showBibleChapters && (
                                <View className="ml-9 gap-2">
                                  <BibleChapterGrid
                                    visible={showBibleChapters}
                                  />
                                </View>
                              )}
                            </View>
                          )}
                        />
                      </View>
                    </View>
                  </View>
                </Card>
              </AnimatedStepContent>

              <AnimatedStepContent delay={400}>
                <Button
                  variant="default"
                  size="lg"
                  onPress={handleAction}
                  className="w-72"
                >
                  <Text className="text-left text-primary-foreground">
                    {t('onboardingContinue')}
                  </Text>
                </Button>
              </AnimatedStepContent>
            </View>
          )}

          {/* Step 2: Create Quest */}
          {step === 'create-quest' && (
            <View className="flex-1 items-center justify-center gap-8">
              <AnimatedStepContent>
                <View className="items-center gap-4">
                  <AnimatedOnboardingIcon
                    icon={BookOpenIcon}
                    size={48}
                    animationType="float"
                  />
                  <Text variant="h2" className="text-center">
                    {t('onboardingCreateQuestTitle')}
                  </Text>
                  <Text
                    variant="default"
                    className="text-center text-muted-foreground"
                  >
                    {t('onboardingCreateQuestSubtitle')}
                  </Text>
                </View>
              </AnimatedStepContent>

              <AnimatedStepContent delay={200}>
                <Card className="w-full p-6">
                  <View className="items-center gap-4">
                    <QuestListAnimation />
                    <View className="w-full gap-3">
                      <View className="flex-row items-center gap-3">
                        <Icon
                          as={BookOpenIcon}
                          size={24}
                          className="text-primary"
                        />
                        <Text variant="default">
                          {t('onboardingQuestExample1')}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-3">
                        <Icon
                          as={BookOpenIcon}
                          size={24}
                          className="text-primary"
                        />
                        <Text variant="default">
                          {t('onboardingQuestExample2')}
                        </Text>
                      </View>
                    </View>
                  </View>
                </Card>
              </AnimatedStepContent>

              <AnimatedStepContent delay={400}>
                <Button
                  variant="default"
                  size="lg"
                  onPress={handleAction}
                  className="w-72"
                >
                  <Text className="text-primary-foreground">
                    {t('onboardingContinue')}
                  </Text>
                </Button>
              </AnimatedStepContent>
            </View>
          )}

          {/* Step 3: Record Audio */}
          {step === 'record-audio' && (
            <View className="flex-1 items-center justify-center gap-8">
              <AnimatedStepContent>
                <View className="items-center gap-4">
                  <View className="relative h-24 w-24 items-center justify-center">
                    <RecordingAnimation size={96} />
                    <View className="absolute h-24 w-24 items-center justify-center rounded-full bg-primary/10">
                      <Icon as={MicIcon} size={48} className="text-primary" />
                    </View>
                  </View>
                  <Text variant="h2" className="text-center">
                    {t('onboardingRecordAudioTitle')}
                  </Text>
                  <Text
                    variant="default"
                    className="text-center text-muted-foreground"
                  >
                    {t('onboardingRecordAudioSubtitle')}
                  </Text>
                </View>
              </AnimatedStepContent>

              <AnimatedStepContent delay={200}>
                <Card className="w-full p-6">
                  <View className="gap-4">
                    <View className="flex-row items-center gap-3">
                      <Icon as={MicIcon} size={24} className="text-primary" />
                      <Text variant="default">
                        {t('onboardingRecordMethod1')}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-3">
                      <Icon as={MicIcon} size={24} className="text-primary" />
                      <Text variant="default">
                        {t('onboardingRecordMethod2')}
                      </Text>
                    </View>
                  </View>
                </Card>
              </AnimatedStepContent>

              <AnimatedStepContent delay={400}>
                <Button
                  variant="default"
                  size="lg"
                  onPress={handleAction}
                  className="w-72"
                >
                  <Text className="text-primary-foreground">
                    {t('onboardingContinue')}
                  </Text>
                </Button>
              </AnimatedStepContent>
            </View>
          )}

          {/* Step 4: Invite Collaborators */}
          {step === 'invite-collaborators' && (
            <View className="flex-1 items-center justify-center gap-8">
              <AnimatedStepContent>
                <View className="items-center gap-4">
                  <AnimatedOnboardingIcon
                    icon={UserPlusIcon}
                    size={48}
                    animationType="pulse"
                  />
                  <Text variant="h2" className="text-center">
                    {t('onboardingInviteTitle')}
                  </Text>
                  <Text
                    variant="default"
                    className="text-center text-muted-foreground"
                  >
                    {t('onboardingInviteSubtitle')}
                  </Text>
                </View>
              </AnimatedStepContent>

              <AnimatedStepContent delay={200}>
                <Card className="w-full p-6">
                  <View className="items-center gap-6">
                    <InviteAnimation />
                    <View className="w-full gap-4">
                      <View className="flex-row items-center gap-3">
                        <Icon
                          as={UserPlusIcon}
                          size={24}
                          className="text-primary"
                        />
                        <Text variant="default">
                          {t('onboardingInviteBenefit1')}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-3">
                        <Icon
                          as={HelpCircle}
                          size={24}
                          className="text-primary"
                        />
                        <Text variant="default">
                          {t('onboardingInviteBenefit2')}
                        </Text>
                      </View>
                    </View>
                  </View>
                </Card>
              </AnimatedStepContent>

              <AnimatedStepContent delay={400}>
                <Button
                  variant="default"
                  size="lg"
                  onPress={handleAction}
                  className="w-72"
                >
                  <Text className="text-primary-foreground">
                    {t('onboardingContinue')}
                  </Text>
                </Button>
              </AnimatedStepContent>
            </View>
          )}
        </KeyboardAwareScrollView>

        {/* Footer with Back button */}
        {step !== 'vision' && step !== 'create-project-simple' && (
          <View className="border-t border-border px-6 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4">
            <Button variant="ghost" onPress={handleBack}>
              <Text>{t('back')}</Text>
            </Button>
          </View>
        )}
      </View>
      <KeyboardToolbar />
    </Modal>
  );
}
