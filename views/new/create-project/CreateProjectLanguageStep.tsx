import { LanguageCombobox } from '@/components/language-combobox';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/contexts/AuthContext';
import { templateOptions } from '@/db/constants';
import { useFiaLanguoids } from '@/hooks/db/useFiaLanguoids';
import { useLocalization } from '@/hooks/useLocalization';
import { useLocalStore } from '@/store/localStore';
import { findOrCreateLanguoidByName } from '@/utils/languoidUtils';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';
import {
  CreateProjectStepLayout,
  getCreateProjectFooterBarHeight
} from './CreateProjectStepLayout';
import {
  createProjectLanguageStepSchema,
  type CreateProjectLanguageStepValues
} from './schema';

type ProjectTemplate = (typeof templateOptions)[number];

function getLanguoidId(
  value: { id: string } | string | null | undefined
): string {
  if (typeof value === 'string') return value.trim();
  return value?.id?.trim() ?? '';
}

interface CreateProjectLanguageStepProps {
  template: ProjectTemplate;
  footerBottomPadding: number;
  initialTargetLanguoidId?: string;
  initialSourceLanguoidId?: string;
  onComplete: (values: CreateProjectLanguageStepValues) => void;
}

export function CreateProjectLanguageStep({
  template,
  footerBottomPadding,
  initialTargetLanguoidId = '',
  initialSourceLanguoidId,
  onComplete
}: CreateProjectLanguageStepProps) {
  const { t } = useLocalization();
  const { currentUser } = useAuth();
  const savedLanguage = useLocalStore((state) => state.savedLanguage);
  const isFiaTemplate = template === 'fia';
  const { fiaDropdownData } = useFiaLanguoids();
  const [persistedTargetId, setPersistedTargetId] = useState(
    initialTargetLanguoidId
  );
  const [persistedSourceId, setPersistedSourceId] = useState(
    initialSourceLanguoidId
  );

  const form = useForm<CreateProjectLanguageStepValues>({
    resolver: zodResolver(createProjectLanguageStepSchema(t, template)),
    defaultValues: isFiaTemplate
      ? {
          target_languoid_id: initialTargetLanguoidId,
          source_languoid_id: initialSourceLanguoidId ?? ''
        }
      : { target_languoid_id: initialTargetLanguoidId },
    mode: 'onSubmit'
  });

  const watchedTargetId = useWatch({
    control: form.control,
    name: 'target_languoid_id'
  });
  const displayTargetId = (watchedTargetId || persistedTargetId || '').trim();

  useEffect(() => {
    if (displayTargetId || !savedLanguage || !currentUser?.id) {
      return;
    }

    if ('name' in savedLanguage && savedLanguage.name) {
      form.setValue('target_languoid_id', savedLanguage.id, {
        shouldValidate: false
      });
      setPersistedTargetId(savedLanguage.id);
      form.clearErrors('target_languoid_id');
      return;
    }

    if ('native_name' in savedLanguage || 'english_name' in savedLanguage) {
      const languageName =
        savedLanguage.native_name || savedLanguage.english_name || '';
      if (languageName) {
        void findOrCreateLanguoidByName(languageName, currentUser.id).then(
          (languoidId) => {
            form.setValue('target_languoid_id', languoidId, {
              shouldValidate: false
            });
            setPersistedTargetId(languoidId);
            form.clearErrors('target_languoid_id');
          }
        );
      }
    }
  }, [savedLanguage, currentUser?.id, form, displayTargetId]);

  const handleComplete = (values: CreateProjectLanguageStepValues) => {
    const targetId = values.target_languoid_id.trim();
    setPersistedTargetId(targetId);

    if (isFiaTemplate && 'source_languoid_id' in values) {
      const sourceId = values.source_languoid_id.trim();
      setPersistedSourceId(sourceId);
      onComplete({
        target_languoid_id: targetId,
        source_languoid_id: sourceId
      });
      return;
    }

    onComplete({ target_languoid_id: targetId });
  };

  const footerBarHeight = getCreateProjectFooterBarHeight(footerBottomPadding);

  return (
    <Form {...form}>
      <CreateProjectStepLayout
        scrollPaddingBottom={footerBarHeight}
        footerBottomPadding={footerBottomPadding}
        footer={
          <Button onPress={() => void form.handleSubmit(handleComplete)()}>
            <Text>{t('continue')}</Text>
          </Button>
        }
      >
        <View className="flex flex-col gap-6">
          <FormField
            control={form.control}
            name="target_languoid_id"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <LanguageCombobox
                    value={field.value || persistedTargetId}
                    onChange={(languoid) => {
                      const id = getLanguoidId(languoid);
                      if (!id) return;
                      field.onChange(id);
                      setPersistedTargetId(id);
                      form.clearErrors('target_languoid_id');
                    }}
                    allowCreate
                    onCreateNew={(languoidId) => {
                      field.onChange(languoidId);
                      setPersistedTargetId(languoidId);
                      form.clearErrors('target_languoid_id');
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {isFiaTemplate && (
            <FormField
              control={form.control}
              name="source_languoid_id"
              render={({ field }) => (
                <FormItem className="relative">
                  <FormLabel>{t('fiaContentLanguage')}</FormLabel>
                  <FormControl className="relative z-10">
                    <Select
                      className="relative w-full"
                      value={
                        field.value || persistedSourceId
                          ? fiaDropdownData.find(
                              (item) =>
                                item.value ===
                                (field.value || persistedSourceId)
                            )
                          : undefined
                      }
                      onValueChange={(option) => {
                        if (!option) return;
                        field.onChange(option.value);
                        setPersistedSourceId(option.value);
                        form.clearErrors('source_languoid_id');
                      }}
                    >
                      <SelectTrigger className="w-full flex-row items-center rounded-md px-3">
                        <SelectValue
                          className="text-sm text-foreground"
                          placeholder={t('fiaContentLanguage')}
                        />
                      </SelectTrigger>
                      <SelectContent inline className="w-full" maxHeight={180}>
                        {fiaDropdownData.map((item) => (
                          <SelectItem
                            key={item.value}
                            value={item.value}
                            label={item.label}
                          >
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage className="relative z-0" />
                </FormItem>
              )}
            />
          )}
        </View>
      </CreateProjectStepLayout>
    </Form>
  );
}
