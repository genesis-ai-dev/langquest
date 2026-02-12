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
    FormSubmit,
    transformInputProps
} from '@/components/ui/form';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/contexts/AuthContext';
import { profileService } from '@/database_services/profileService';
import { system } from '@/db/powersync/system';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useLocalization } from '@/hooks/useLocalization';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { usePostHog } from '@/hooks/usePostHog';
import {
    clearDegradedMode,
    isDegradedMode
} from '@/services/degradedModeService';
import { useLocalStore } from '@/store/localStore';
import { colors, sharedStyles, spacing } from '@/styles/theme';
import { resetDatabase } from '@/utils/dbUtils';
import {
    deleteIfExists,
    ensureDir,
    getLocalFilePathSuffix,
    getLocalUri
} from '@/utils/fileUtils';
import RNAlert from '@blazejkustra/react-native-alert';
import { zodResolver } from '@hookform/resolvers/zod';
import { AttachmentState } from '@powersync/attachments';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { z } from 'zod';

// Validation schema

export default function ProfileView() {
  // const { currentUser, setCurrentUser } = useAuth();
  const { currentUser } = useAuth();
  const { t } = useLocalization();
  const { goToProjects, navigate } = useAppNavigation();
  const isOnline = useNetworkStatus();
  const systemReady = useLocalStore((state) => state.systemReady);
  const posthog = usePostHog();
  const setAnalyticsOptOut = useLocalStore((state) => state.setAnalyticsOptOut);
  const analyticsOptOut = useLocalStore((state) => state.analyticsOptOut);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [isDegraded, setIsDegraded] = useState(false);

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
      selectedLanguoidId: z.uuid(t('selectLanguage')),
      currentPassword: z.string().trim().optional(),
      newPassword: z.string().trim().optional(),
      confirmPassword: z.string().trim().optional(),
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
      // Prefer ui_languoid_id, fallback to ui_language_id for backward compatibility
      selectedLanguoidId:
        currentUser?.user_metadata.ui_languoid_id ??
        currentUser?.user_metadata.ui_language_id ??
        '',
      termsAccepted: !!currentUser?.user_metadata.terms_accepted
    }
  });

  // Set initial values from user's profile
  useEffect(() => {
    if (currentUser) {
      form.reset();
    }
  }, [currentUser, form]);

  // Check degraded mode on mount
  useEffect(() => {
    const checkDegradedMode = async () => {
      const degraded = await isDegradedMode();
      setIsDegraded(degraded);
    };
    void checkDegradedMode();
  }, []);

  const { mutateAsync: updateProfile } = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      if (!currentUser) return;

      const updatedUser = await profileService.updateProfile({
        id: currentUser.id,
        ui_languoid_id: data.selectedLanguoidId,
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

  const { mutateAsync: seedDatabase, isPending: seedDatabasePending } =
    useMutation({
      mutationFn: async () => {
        await system.seed();
      }
    });

  const { mutateAsync: deleteDatabase, isPending: deleteDatabasePending } =
    useMutation({
      mutationFn: resetDatabase
    });

  const {
    mutateAsync: deleteAttachments,
    isPending: deleteAttachmentsPending
  } = useMutation({
    mutationFn: async () => {
      await system.powersync.execute(
        `DELETE FROM attachments WHERE state <> ${AttachmentState.SYNCED} OR state <> ${AttachmentState.ARCHIVED}`
      );
      const path = getLocalFilePathSuffix('local');
      await deleteIfExists(getLocalUri(path));
      await ensureDir(getLocalUri(path));
      await system.permAttachmentQueue?.init();
    }
  });

  const {
    mutateAsync: clearDegradedModeState,
    isPending: clearDegradedModePending
  } = useMutation({
    mutationFn: async () => {
      await clearDegradedMode();
      setIsDegraded(false);
    },
    onSuccess: () => {
      RNAlert.alert(t('success'), 'Degraded mode cleared successfully');
    },
    onError: (error) => {
      console.error('Error clearing degraded mode:', error);
      RNAlert.alert(t('error'), 'Failed to clear degraded mode');
    }
  });

  const handleFormSubmit = form.handleSubmit((data) => updateProfile(data));

  return (
    <Form {...form}>
      <KeyboardAwareScrollView
        className="flex-1 bg-background"
        contentContainerClassName="mb-safe flex flex-col gap-4 p-6"
        bottomOffset={96}
        extraKeyboardSpace={20}
      >
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-foreground">
            {t('profile')}
          </Text>
          <Button variant="default" size="icon-lg" onPress={goToProjects}>
            <Icon name="house" className="text-primary-foreground" />
          </Button>
        </View>
        {__DEV__ && (
          <View className="flex flex-col gap-2">
            <View className="flex flex-row gap-2">
              <Button
                variant="destructive"
                loading={seedDatabasePending}
                className="flex-1"
                onPress={() => {
                  RNAlert.alert(
                    'Seed data',
                    'This will reset local development data and seed the database. Continue?',
                    [
                      { text: t('cancel'), style: 'cancel' },
                      {
                        text: t('confirm'),
                        style: 'destructive',
                        onPress: () => {
                          void seedDatabase();
                        }
                      }
                    ]
                  );
                }}
              >
                <Text>Seed data</Text>
              </Button>
              <Button
                variant="secondary"
                loading={deleteDatabasePending}
                className="flex-1"
                onPress={() => {
                  RNAlert.alert(
                    'Delete data',
                    'This will reset local development data. Continue?',
                    [
                      { text: t('cancel'), style: 'cancel' },
                      {
                        text: t('confirm'),
                        style: 'destructive',
                        onPress: () => {
                          void deleteDatabase();
                        }
                      }
                    ]
                  );
                }}
              >
                <Text>Wipe local db</Text>
              </Button>
            </View>
            <Button
              variant="secondary"
              loading={deleteAttachmentsPending}
              className="w-full"
              onPress={() => {
                RNAlert.alert(
                  'Delete local attachments',
                  'This will reset local attachments. Continue?',
                  [
                    { text: t('cancel'), style: 'cancel' },
                    {
                      text: t('confirm'),
                      style: 'destructive',
                      onPress: () => {
                        void deleteAttachments();
                      }
                    }
                  ]
                );
              }}
            >
              <Text>Wipe local attachments</Text>
            </Button>
            {isDegraded && (
              <Button
                variant="secondary"
                loading={clearDegradedModePending}
                className="w-full"
                onPress={() => {
                  RNAlert.alert(
                    'Clear Degraded Mode',
                    'This will clear the degraded mode state and allow migrations to retry. Continue?',
                    [
                      { text: t('cancel'), style: 'cancel' },
                      {
                        text: t('confirm'),
                        onPress: () => {
                          void clearDegradedModeState();
                        }
                      }
                    ]
                  );
                }}
              >
                <Text>Clear degraded mode</Text>
              </Button>
            )}
          </View>
        )}
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
          <View className="flex flex-col rounded-lg bg-card p-4" ph-no-capture>
            <View className="flex flex-row items-center gap-2">
              <Icon name="mail" className="text-muted-foreground" />
              <Text className="flex-1 text-foreground" ph-no-capture>
                {currentUser.email}
              </Text>
            </View>
            {currentUser.user_metadata.username && (
              <View className="flex-row items-center gap-2">
                <Icon name="user" className="text-muted-foreground" />
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
            <Text className="text-lg font-semibold">{t('changePassword')}</Text>
            <View className="flex flex-col gap-2">
              <FormField
                control={form.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        {...transformInputProps(field)}
                        type="next"
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
                      type="next"
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
                      onSubmitEditing={handleFormSubmit}
                      returnKeyType="done"
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
          <Alert icon="info">
            <AlertTitle>{t('onlineOnlyFeatures')}</AlertTitle>
          </Alert>
        )}
        {/* Save Button */}
        <FormSubmit onPress={handleFormSubmit} disabled={!isOnline}>
          <Text>{t('submit')}</Text>
        </FormSubmit>

        {/* Language Selection - Not part of password reset form */}
        <FormField
          control={form.control}
          name="selectedLanguoidId"
          render={({ field }) => (
            <FormItem>
              <LanguageSelect
                {...field}
                uiReadyOnly
                onChange={(languoid) => field.onChange(languoid.id)}
              />
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Advanced Options Section - Always visible when authenticated */}
        {currentUser && systemReady && (
          <View className="flex flex-col gap-4">
            <View className="h-px bg-border" />
            <Button
              variant="ghost"
              onPress={() => setShowAdvancedOptions(!showAdvancedOptions)}
              className="h-auto justify-between p-4"
            >
              <View className="flex flex-row items-center gap-2">
                <Icon
                  name="ellipsis-vertical"
                  size={20}
                  className="text-muted-foreground"
                />
                <Text className="text-base font-medium text-foreground">
                  {t('advanced')}
                </Text>
              </View>
              <Icon
                name={showAdvancedOptions ? 'chevron-down' : 'chevron-right'}
                size={20}
                className="text-muted-foreground"
              />
            </Button>

            {showAdvancedOptions && (
              <>
                {!isOnline ? (
                  <Alert icon="info">
                    <AlertTitle>
                      {t('accountDeletionRequiresOnline')}
                    </AlertTitle>
                  </Alert>
                ) : (
                  <View className="flex flex-col gap-2 rounded-lg border border-destructive/50 bg-destructive/5 p-4">
                    <Text className="text-base font-semibold text-destructive">
                      {t('accountDeletionTitle')}
                    </Text>
                    <Text className="text-sm text-muted-foreground">
                      {t('accountDeletionWarning')}
                    </Text>
                    <Button
                      variant="destructive"
                      onPress={() => {
                        navigate({ view: 'account-deletion' });
                      }}
                      className="mt-2"
                    >
                      <Text>{t('deleteAccount')}</Text>
                    </Button>
                  </View>
                )}
              </>
            )}
          </View>
        )}
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
      </KeyboardAwareScrollView>
    </Form>
  );
}
