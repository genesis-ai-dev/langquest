import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormSubmit,
  transformInputProps,
  transformSwitchProps
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { templateOptions } from '@/db/constants';
import { useLanguoidById } from '@/hooks/db/useLanguoids';
import { useLocalization } from '@/hooks/useLocalization';
import { zodResolver } from '@hookform/resolvers/zod';
import { FolderPenIcon } from 'lucide-react-native';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import {
  CREATE_PROJECT_FOOTER_TOP_SPACING,
  CreateProjectStepLayout
} from './CreateProjectStepLayout';
import {
  createProjectDetailsStepSchema,
  type CreateProjectDetailsStepFormValues,
  type CreateProjectDetailsStepValues
} from './schema';

type ProjectTemplate = (typeof templateOptions)[number];

function buildProjectName(languageName: string, templateLabel: string): string {
  return `${languageName} ${templateLabel} Project`.trim();
}

interface CreateProjectDetailsStepProps {
  footerBottomPadding: number;
  template: ProjectTemplate;
  targetLanguoidId: string;
  onComplete: (values: CreateProjectDetailsStepValues) => Promise<void>;
}

export function CreateProjectDetailsStep({
  footerBottomPadding,
  template,
  targetLanguoidId,
  onComplete
}: CreateProjectDetailsStepProps) {
  const { t } = useLocalization();
  const { languoid: targetLanguoid } = useLanguoidById(targetLanguoidId);

  const form = useForm<
    CreateProjectDetailsStepFormValues,
    unknown,
    CreateProjectDetailsStepValues
  >({
    resolver: zodResolver(createProjectDetailsStepSchema(t)),
    defaultValues: {
      name: '',
      description: '',
      private: true,
      visible: true
    },
    mode: 'onSubmit'
  });

  const nameIsDirty = form.formState.dirtyFields.name;

  useEffect(() => {
    if (nameIsDirty || !targetLanguoid?.name) return;
    form.setValue('name', buildProjectName(targetLanguoid.name, t(template)), {
      shouldValidate: false,
      shouldDirty: false
    });
  }, [template, targetLanguoid?.name, nameIsDirty, form, t]);

  const handleContinue = async (details: CreateProjectDetailsStepValues) => {
    let name = details.name;

    if (!name.trim() && targetLanguoid?.name) {
      name = buildProjectName(targetLanguoid.name, t(template));
      form.setValue('name', name, { shouldValidate: false });
    }

    await onComplete({ ...details, name });
  };

  return (
    <Form {...form}>
      <CreateProjectStepLayout
        footerTopSpacing={CREATE_PROJECT_FOOTER_TOP_SPACING}
        footerBottomPadding={footerBottomPadding}
        footer={
          <FormSubmit onPress={() => void form.handleSubmit(handleContinue)()}>
            <Text>{t('createObject')}</Text>
          </FormSubmit>
        }
      >
        <View className="flex flex-col gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('projectName')}</FormLabel>
                <FormControl>
                  <Input
                    {...transformInputProps(field)}
                    placeholder={t('projectName')}
                    size="sm"
                    prefix={FolderPenIcon}
                    drawerInput
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('description')}</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder={t('description')}
                    value={field.value ?? ''}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    size="sm"
                    maxLength={1024}
                    drawerInput
                  />
                </FormControl>
                <Text className="text-right text-xs text-muted-foreground">
                  {(field.value ?? '').length}/1024
                </Text>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="private"
            render={({ field }) => (
              <FormItem>
                <View className="flex-row items-center justify-between">
                  <FormLabel>{t('private')}</FormLabel>
                  <FormControl>
                    <Switch {...transformSwitchProps(field)} />
                  </FormControl>
                </View>
                <FormMessage />
              </FormItem>
            )}
          />
        </View>
      </CreateProjectStepLayout>
    </Form>
  );
}
