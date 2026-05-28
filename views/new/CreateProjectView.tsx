import { Drawer, DrawerContent, DrawerView } from '@/components/ui/drawer';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useCreateProject } from '@/hooks/useCreateProject';
import { useLocalization } from '@/hooks/useLocalization';
import { cn } from '@/utils/styleUtils';
import {
  createProjectSubmitSchema,
  getCreateProjectErrorStep,
  type CreateProjectDetailsStepValues,
  type CreateProjectTemplateStepValues,
  type FiaLanguageStepValues,
  type ProjectTemplate
} from '@/views/new/create-project/schema';
import RNAlert from '@blazejkustra/react-native-alert';
import { ChevronLeft } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { Keyboard, Pressable, View } from 'react-native';
import { CreateProjectDetailsStep } from './create-project/CreateProjectDetailsStep';
import { CreateProjectLanguageStep } from './create-project/CreateProjectLanguageStep';
import { CREATE_PROJECT_FOOTER_BOTTOM_PADDING } from './create-project/CreateProjectStepLayout';
import { CreateProjectTemplateStep } from './create-project/CreateProjectTemplateStep';

type Step = 1 | 2 | 3;

const STEP_COUNT = 3;

export interface CreateProjectViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function CreateProjectView({
  open,
  onOpenChange,
  children
}: CreateProjectViewProps) {
  const { t } = useLocalization();

  const [step, setStep] = useState<Step>(1);
  const [template, setTemplate] = useState<ProjectTemplate | undefined>();
  const [targetLanguoidId, setTargetLanguoidId] = useState('');
  const [sourceLanguoidId, setSourceLanguoidId] = useState<
    string | undefined
  >();

  // DrawerContent already passes bottomInset to the sheet; only add visual padding here.
  const footerBottomPadding = CREATE_PROJECT_FOOTER_BOTTOM_PADDING;

  const resetWizard = useCallback(() => {
    setStep(1);
    setTemplate(undefined);
    setTargetLanguoidId('');
    setSourceLanguoidId(undefined);
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        Keyboard.dismiss();
        resetWizard();
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange, resetWizard]
  );

  const { mutateAsync: createProject, isPending: isCreating } =
    useCreateProject({
      onSuccess: () => {
        handleOpenChange(false);
      },
      onError: (error) => {
        console.error('Failed to create project', error);
        RNAlert.alert(t('error'), t('error'));
      }
    });

  const handleBack = () => {
    if (step === 1) {
      handleOpenChange(false);
      return;
    }
    setStep((s) => (s - 1) as Step);
  };

  const handleTemplateComplete = (values: CreateProjectTemplateStepValues) => {
    setTemplate(values.template);
    if (values.template !== 'fia') {
      setSourceLanguoidId(undefined);
    }
    setStep(2);
  };

  const handleFinalSubmit = async (details: CreateProjectDetailsStepValues) => {
    if (!template || !targetLanguoidId) return;

    const parsed = createProjectSubmitSchema(t).safeParse({
      template,
      target_languoid_id: targetLanguoidId,
      ...(template === 'fia' ? { source_languoid_id: sourceLanguoidId } : {}),
      ...details
    });

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const firstField =
        typeof firstIssue?.path[0] === 'string'
          ? firstIssue.path[0]
          : undefined;

      setStep(getCreateProjectErrorStep(firstField));
      RNAlert.alert(t('error'), firstIssue?.message ?? t('error'));
      return;
    }

    await createProject(parsed.data);
  };

  const stepTitle =
    step === 1 ? t('template') : step === 2 ? t('language') : t('details');

  return (
    <Drawer
      open={open}
      onOpenChange={handleOpenChange}
      dismissible={!isCreating}
      snapPoints={['65%']}
      enableDynamicSizing={false}
    >
      {children}
      <DrawerContent asChild className="px-0">
        <DrawerView collapsable={false} className="flex-1 gap-0 bg-background">
          <View className="min-h-0 flex-1 flex-col">
            <View className="shrink-0 flex-col gap-4 px-6 pb-4 pt-2">
              <Text className="text-2xl font-bold text-foreground">
                {t('newProject')}
              </Text>

              <View className="flex flex-row items-center gap-3">
                <Pressable
                  onPress={handleBack}
                  disabled={isCreating}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel={step === 1 ? t('cancel') : t('back')}
                >
                  <Icon as={ChevronLeft} size={24} />
                </Pressable>
                <Text className="flex-1 text-lg font-semibold text-foreground">
                  {stepTitle}
                </Text>
              </View>

              <View className="mt-1 flex flex-row gap-3">
                {Array.from({ length: STEP_COUNT }, (_, i) => (
                  <View
                    key={i}
                    className={cn(
                      'h-1 flex-1 rounded-full',
                      i < step ? 'bg-primary' : 'bg-primary/25'
                    )}
                  />
                ))}
              </View>
            </View>

            {step === 1 && (
              <CreateProjectTemplateStep
                initialTemplate={template}
                onComplete={handleTemplateComplete}
              />
            )}

            {step === 2 && template && (
              <CreateProjectLanguageStep
                template={template}
                footerBottomPadding={footerBottomPadding}
                initialTargetLanguoidId={targetLanguoidId}
                initialSourceLanguoidId={sourceLanguoidId}
                onComplete={(values) => {
                  setTargetLanguoidId(values.target_languoid_id);
                  setSourceLanguoidId(
                    template === 'fia'
                      ? (values as FiaLanguageStepValues).source_languoid_id
                      : undefined
                  );
                  setStep(3);
                }}
              />
            )}

            {step === 3 && template && targetLanguoidId && (
              <CreateProjectDetailsStep
                key={`${template}-${targetLanguoidId}-${sourceLanguoidId ?? ''}`}
                footerBottomPadding={footerBottomPadding}
                template={template}
                targetLanguoidId={targetLanguoidId}
                onComplete={handleFinalSubmit}
              />
            )}
          </View>
        </DrawerView>
      </DrawerContent>
    </Drawer>
  );
}

export default CreateProjectView;
