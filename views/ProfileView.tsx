import { LanguageSelect } from '@/components/language-select';
import { ThemeToggle } from '@/components/theme-toggle';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  transformInputProps
} from '@/components/ui/form';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/contexts/AuthContext';
import { profileService } from '@/database_services/profileService';
import { useLocalization } from '@/hooks/useLocalization';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useLocalStore } from '@/store/localStore';
import { colors, sharedStyles, spacing } from '@/styles/theme';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { InfoIcon, MailIcon, UserIcon } from 'lucide-react-native';
import { usePostHog } from 'posthog-react-native';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Alert as RNAlert, ScrollView, View } from 'react-native';
import { z } from 'zod';

// Validation schema

export default function ProfileView() {
  // const { currentUser, setCurrentUser } = useAuth();
  const { currentUser } = useAuth();
  const { t } = useLocalization();
  const isOnline = useNetworkStatus();
  const posthog = usePostHog();
  const setAnalyticsOptOut = useLocalStore((state) => state.setAnalyticsOptOut);
  const analyticsOptOut = useLocalStore((state) => state.analyticsOptOut);

  // Derive analytics enabled state (opposite of opt-out)
  const analyticsEnabled = !analyticsOptOut;

  // Handle analytics toggle - now toggles "enabled" instead of "opt-out"
  const handleAnalyticsToggle = (optedIn: boolean) => {
    try {
      // Convert "enabled" to "opt-out" for storage
      setAnalyticsOptOut(!optedIn);
      console.log('optedOut', posthog.optedOut);
    } catch (error) {
      console.error('Error saving analytics preference:', error);
      RNAlert.alert(t('error'), t('failedSaveAnalyticsPreference'));
    }
  };

  const formSchema = z
    .object({
      selectedLanguageId: z.string().min(1, { message: 'selectLanguage' }),
      currentPassword: z.string().optional(),
      newPassword: z.string().optional(),
      confirmPassword: z.string().optional(),
      termsAccepted: z.boolean().optional()
    })
    .superRefine((data, ctx) => {
      if (data.newPassword && data.newPassword.length > 0) {
        if (!data.currentPassword || data.currentPassword.length === 0) {
          ctx.addIssue({
            code: 'custom',
            message: 'currentPasswordRequired',
            path: ['currentPassword']
          });
        }
        if (data.newPassword.length < 6) {
          ctx.addIssue({
            code: 'custom',
            message: 'passwordMustBeAtLeast6Characters',
            path: ['newPassword']
          });
        }
        if (data.confirmPassword !== data.newPassword) {
          ctx.addIssue({
            code: 'custom',
            message: 'passwordsNoMatch',
            path: ['confirmPassword']
          });
        }
      }
    });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
      selectedLanguageId: currentUser?.user_metadata.ui_language_id ?? '',
      termsAccepted: !!currentUser?.user_metadata.terms_accepted
    }
  });

  // Set initial values from user's profile
  useEffect(() => {
    if (currentUser) {
      form.reset();
    }
  }, [currentUser, form]);

  const { mutateAsync: updateProfile, isPending } = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      if (!currentUser) return;

      const updatedUser = await profileService.updateProfile({
        id: currentUser.id,
        ui_language_id: data.selectedLanguageId,
        ...(isOnline && data.newPassword
          ? { password: data.newPassword.trim() }
          : {}),
        terms_accepted: data.termsAccepted,
        terms_accepted_at: data.termsAccepted
          ? new Date().toISOString()
          : undefined
      });

      if (updatedUser) {
        RNAlert.alert(t('success'), t('profileUpdateSuccess'));
        form.reset({
          ...form.getValues(),
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
      }
    },
    onError: (error) => {
      console.error('Error updating profile:', error);
      RNAlert.alert(t('error'), t('failedUpdateProfile'));
    }
  });

  return (
    <Form {...form}>
      <ScrollView className="flex-1 bg-background">
        <View className="flex flex-col gap-4 p-6">
          <Text className="text-2xl font-bold text-foreground">
            {t('profile')}
          </Text>
          {!posthog.isDisabled && (
            <Button
              onPress={async () => {
                posthog.capture('feedback button pressed');
                await posthog.flush();
              }}
            >
              <Text>{t('submitFeedback')}</Text>
            </Button>
          )}
          {/* User Profile Information */}
          {currentUser && (
            <View className="flex flex-col rounded-lg bg-card p-4">
              <View className="flex flex-row items-center gap-2">
                <Icon as={MailIcon} className="text-muted-foreground" />
                <Text className="flex-1 text-foreground" ph-no-capture>
                  {currentUser.email || 'No email provided'}
                </Text>
              </View>
              {currentUser.user_metadata.username && (
                <View className="flex-row items-center gap-2">
                  <Icon as={UserIcon} className="text-muted-foreground" />
                  <Text className="flex-1 text-foreground" ph-no-capture>
                    {currentUser.user_metadata.username}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Analytics Toggle - Now shows "Enable Analytics" */}
          <View className="flex flex-col gap-1 rounded-lg bg-card p-4">
            <View className="flex flex-row items-center">
              <Text className="flex-1 text-base font-medium text-foreground">
                {t('enableAnalytics')}
              </Text>
              <Switch
                checked={analyticsEnabled}
                onCheckedChange={handleAnalyticsToggle}
              />
            </View>
            <Text className="text-sm leading-5 text-muted-foreground">
              {t('analyticsDescription')}
            </Text>
          </View>

          <ThemeToggle />

          {/* Password Change - Only when online */}
          {isOnline ? (
            <View className="flex flex-col gap-4">
              <Text className="text-lg font-semibold">
                {t('changePassword')}
              </Text>
              <View className="flex flex-col gap-2">
                <FormField
                  control={form.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          {...transformInputProps(field)}
                          placeholder={t('currentPassword')}
                          placeholderTextColor={colors.textSecondary}
                          secureTextEntry
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </View>

              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        {...transformInputProps(field)}
                        placeholder={t('newPassword')}
                        placeholderTextColor={colors.textSecondary}
                        secureTextEntry
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        {...transformInputProps(field)}
                        placeholder={t('confirmPassword')}
                        placeholderTextColor={colors.textSecondary}
                        secureTextEntry
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </View>
          ) : (
            <Alert icon={InfoIcon}>
              <AlertTitle>{t('onlineOnlyFeatures')}</AlertTitle>
            </Alert>
          )}
          {/* Language Selection - Always available */}
          <FormField
            control={form.control}
            name="selectedLanguageId"
            render={({ field: { onChange, value } }) => (
              <FormItem>
                <LanguageSelect
                  value={value}
                  onChange={(lang) => onChange(lang.id)}
                />
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Save Button */}
          <Button
            onPress={form.handleSubmit((data) => updateProfile(data))}
            disabled={isPending}
          >
            <Text>{t('submit')}</Text>
          </Button>
        </View>
        <Link
          href="/terms"
          style={[
            sharedStyles.link,
            { fontSize: 14, textAlign: 'center', marginTop: spacing.medium }
          ]}
          push
        >
          {t('viewTerms')}
        </Link>
      </ScrollView>
    </Form>
  );
}
