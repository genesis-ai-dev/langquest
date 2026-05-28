import { FiaIcon } from '@/components/icons/FiaIcon';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage
} from '@/components/ui/form';
import { Icon } from '@/components/ui/icon';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Text } from '@/components/ui/text';
import { templateOptions } from '@/db/constants';
import { useLocalization } from '@/hooks/useLocalization';
import { useLocalStore } from '@/store/localStore';
import { cn } from '@/utils/styleUtils';
import RNAlert from '@blazejkustra/react-native-alert';
import { zodResolver } from '@hookform/resolvers/zod';
import { BookOpenIcon, LayoutGridIcon } from 'lucide-react-native';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { CreateProjectStepLayout } from './CreateProjectStepLayout';
import {
  createProjectTemplateStepSchema,
  type CreateProjectTemplateStepValues
} from './schema';

type ProjectTemplate = (typeof templateOptions)[number];

const templateIcons: Record<ProjectTemplate, typeof LayoutGridIcon> = {
  unstructured: LayoutGridIcon,
  bible: BookOpenIcon,
  fia: FiaIcon
};

interface CreateProjectTemplateStepProps {
  initialTemplate?: ProjectTemplate;
  onComplete: (values: CreateProjectTemplateStepValues) => void;
}

export function CreateProjectTemplateStep({
  initialTemplate,
  onComplete
}: CreateProjectTemplateStepProps) {
  const { t } = useLocalization();
  const enableFia = useLocalStore((state) => state.enableFia);
  const setEnableFia = useLocalStore((state) => state.setEnableFia);

  const form = useForm<CreateProjectTemplateStepValues>({
    resolver: zodResolver(createProjectTemplateStepSchema(t)),
    defaultValues: initialTemplate ? { template: initialTemplate } : {},
    mode: 'onSubmit'
  });

  const handleTemplateSelect = (
    value: ProjectTemplate,
    onChange: (value: ProjectTemplate) => void
  ) => {
    if (value === 'fia' && !enableFia) {
      RNAlert.alert(t('fiaExperimentalTitle'), t('enableFiaPrompt'), [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('enable'),
          onPress: () => {
            setEnableFia(true);
            onChange(value);
          }
        }
      ]);
      return;
    }
    onChange(value);
  };

  return (
    <Form {...form}>
      <CreateProjectStepLayout
        scrollGap="none"
        footerPlacement="inline"
        footerTopSpacing={16}
        footerBottomPadding={0}
        footer={
          <Button onPress={() => void form.handleSubmit(onComplete)()}>
            <Text>{t('continue')}</Text>
          </Button>
        }
      >
        <FormField
          control={form.control}
          name="template"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <RadioGroup
                  value={field.value ?? ''}
                  onValueChange={(value) =>
                    handleTemplateSelect(
                      value as ProjectTemplate,
                      field.onChange
                    )
                  }
                >
                  {templateOptions.map((option) => {
                    const TemplateIcon = templateIcons[option];
                    return (
                      <RadioGroupItem
                        key={option}
                        value={option}
                        className="flex-row-reverse rounded-md p-4"
                      >
                        <View className="flex flex-row items-center gap-3">
                          <Icon
                            as={TemplateIcon}
                            size={22}
                            className="text-primary"
                          />
                          <Text
                            className={cn(
                              'flex-1 font-medium',
                              option === 'fia' ? 'uppercase' : 'capitalize'
                            )}
                          >
                            {t(option)}
                          </Text>
                        </View>
                      </RadioGroupItem>
                    );
                  })}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </CreateProjectStepLayout>
    </Form>
  );
}
