import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormSubmit,
  transformInputProps
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { requestTypeOptions } from '@/db/constants';
import { feedback_synced } from '@/db/drizzleSchemaSynced';
import { system } from '@/db/powersync/system';
import { useLocalization } from '@/hooks/useLocalization';
import { useNavigationHelpers } from '@/hooks/useNavigation';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { colors } from '@/styles/theme';
import RNAlert from '@blazejkustra/react-native-alert';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { useForm } from 'react-hook-form';
import { Keyboard, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { z } from 'zod';

interface FeedbackViewProps {
  onClose?: () => void;
}

export default function FeedbackView({ onClose }: FeedbackViewProps) {
  const { t } = useLocalization();
  const { currentUser } = useAuth();
  const isOnline = useNetworkStatus();
  const { router } = useNavigationHelpers();

  // Get app version
  const appVersion = Constants.expoConfig?.version ?? 'unknown';

  // Form schema with validation
  const formSchema = z.object({
    name: z.string().trim().optional(),
    title: z
      .string()
      .trim()
      .min(1, t('feedbackTitleRequired'))
      .max(100, t('feedbackTitleMaxLength')),
    request_type: z
      .enum(requestTypeOptions)
      .refine((val) => val !== undefined, {
        message: t('feedbackTypeRequired')
      }),
    description: z
      .string()
      .trim()
      .min(1, t('feedbackDescriptionRequired'))
      .max(2000, t('feedbackDescriptionMaxLength'))
  });

  type FormData = z.infer<typeof formSchema>;

  const defaultValues: FormData = {
    name: '',
    title: '',
    request_type: 'general',
    description: ''
  };

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues,
    mode: 'onBlur'
  });

  const { mutateAsync: submitFeedback, isPending } = useMutation({
    mutationFn: async (data: FormData) =>
      await system.db.insert(feedback_synced).values({
        profile_id: currentUser!.id,
        name: data.name || null,
        title: data.title,
        request_type: data.request_type,
        description: data.description,
        app_version: appVersion
      }),
    onSuccess: () => {
      Keyboard.dismiss();
      RNAlert.alert(t('success'), t('feedbackSubmittedSuccess'), [
        {
          text: t('ok'),
          onPress: () => {
            form.reset(defaultValues);
            onClose?.() ?? router.back();
          }
        }
      ]);
    },
    onError: (error) => {
      console.error('Error submitting feedback:', error);
      RNAlert.alert(t('error'), t('feedbackSubmitError'));
    }
  });

  const handleFormSubmit = form.handleSubmit((data) => submitFeedback(data));

  const requestTypeLabels: Record<(typeof requestTypeOptions)[number], string> =
    {
      bug: t('feedbackTypeBug'),
      feature_request: t('feedbackTypeFeature'),
      general: t('feedbackTypeGeneral'),
      other: t('feedbackTypeOther')
    };

  return (
    <Form {...form}>
      <KeyboardAwareScrollView
        className="flex-1 bg-background"
        contentContainerClassName="pb-safe android:pb-[calc(env(safe-area-inset-bottom)+1rem)] flex flex-col gap-4 p-6"
        bottomOffset={96}
        extraKeyboardSpace={20}
      >
        {/* Header */}
        <Text className="text-2xl font-bold text-foreground">
          {t('submitFeedback')}
        </Text>

        {/* Name Field (optional) */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('feedbackNameLabel')}</FormLabel>
              <FormControl>
                <Input
                  {...transformInputProps(field)}
                  type="next"
                  placeholder={t('feedbackNamePlaceholder')}
                  placeholderTextColor={colors.textSecondary}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Title Field (required) */}
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('feedbackTitleLabel')}</FormLabel>
              <FormControl>
                <Input
                  {...transformInputProps(field)}
                  type="next"
                  placeholder={t('feedbackTitlePlaceholder')}
                  placeholderTextColor={colors.textSecondary}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Request Type Field (required) */}
        <FormField
          control={form.control}
          name="request_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('feedbackTypeLabel')}</FormLabel>
              <FormControl>
                <RadioGroup
                  value={field.value}
                  onValueChange={(value) =>
                    field.onChange(value as (typeof requestTypeOptions)[number])
                  }
                >
                  {requestTypeOptions.map((option) => (
                    <RadioGroupItem
                      key={option}
                      value={option}
                      label={requestTypeLabels[option]}
                    />
                  ))}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Description Field (required) */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('feedbackDescriptionLabel')}</FormLabel>
              <FormControl>
                <Textarea
                  placeholder={t('feedbackDescriptionPlaceholder')}
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  drawerInput={false}
                  numberOfLines={6}
                  maxLength={2000}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Character count indicator */}
        <View className="flex-row justify-end">
          <Text className="text-sm text-muted-foreground">
            {form.watch('description')?.length ?? 0}/2000
          </Text>
        </View>

        {/* Offline warning */}
        {!isOnline && (
          <View className="rounded-lg bg-warning/10 p-4">
            <Text className="text-sm text-warning">
              {t('feedbackOfflineWarning')}
            </Text>
          </View>
        )}

        {/* Submit Button */}
        <FormSubmit onPress={handleFormSubmit}>
          <Text>{t('submit')}</Text>
        </FormSubmit>
      </KeyboardAwareScrollView>
    </Form>
  );
}
