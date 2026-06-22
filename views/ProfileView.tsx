import { AnalyticsConsentCard } from '@/components/AnalyticsConsentCard';
import { SessionReplayMask } from '@/components/SessionReplayMask';
import { usePostHogAvailable } from '@/services/postHogAvailability';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
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
import { Text } from '@/components/ui/text';
import { useAuth } from '@/contexts/AuthContext';
import { profileService } from '@/database_services/profileService';
import { system } from '@/db/powersync/system';
import { useLocalization } from '@/hooks/useLocalization';
import { useNavigationHelpers } from '@/hooks/useNavigation';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { usePostHog } from '@/hooks/usePostHog';
import {
  canCaptureAccountLinkedAnalytics,
  shouldShowAnalyticsDeferredStartDate
} from '@/constants/legalVersions';
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
import {
  ChevronDown,
  ChevronRight,
  InfoIcon,
  MailIcon,
  MoreVertical,
  UserIcon
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { z } from 'zod';

// Validation schema

export default function ProfileView() {
  // const { currentUser, setCurrentUser } = useAuth();
  const { currentUser, isAuthenticated } = useAuth();
  const { t } = useLocalization();
  const { router } = useNavigationHelpers();
  const isOnline = useNetworkStatus();
  const posthog = usePostHog();
  const analyticsOptOut = useLocalStore((state) => state.analyticsOptOut);
  const dateTermsAccepted = useLocalStore((state) => state.dateTermsAccepted);
  const acceptedPrivacyPolicyVersion = useLocalStore(
    (state) => state.acceptedPrivacyPolicyVersion
  );
  const subjectToLegalEffectiveDateWait = useLocalStore(
    (state) => state.subjectToLegalEffectiveDateWait
  );
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [analyticsLearnMoreOpen, setAnalyticsLearnMoreOpen] = useState(false);
  const [isDegraded, setIsDegraded] = useState(false);

  const analyticsEnabled = canCaptureAccountLinkedAnalytics({
    dateTermsAccepted,
    acceptedPrivacyPolicyVersion,
    analyticsOptOut,
    subjectToLegalEffectiveDateWait
  });
  const showDeferredStartDate = shouldShowAnalyticsDeferredStartDate({
    dateTermsAccepted,
    acceptedPrivacyPolicyVersion,
    subjectToLegalEffectiveDateWait
  });
  const showAnalyticsSettings = usePostHogAvailable();

  const handleAnalyticsToggle = async (optedIn: boolean) => {
    try {
      const { saveAnalyticsPreference } =
        await import('@/services/accountPreferences');
      await saveAnalyticsPreference(optedIn);
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
        contentContainerClassName="pb-safe android:pb-[calc(env(safe-area-inset-bottom)+1rem)] flex flex-col gap-4 p-6"
        bottomOffset={96}
        extraKeyboardSpace={20}
      >
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-foreground">
            {t('profile')}
          </Text>
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
                        isPreferred: true,
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
                        isPreferred: true,
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
                      isPreferred: true,
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
                        isPreferred: true,
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
        <Button
          onPress={() => {
            posthog?.capture('feedback button pressed');
            router.push('/(app)/feedback');
          }}
        >
          <Text>{t('submitFeedback')}</Text>
        </Button>
        {/* User Profile Information */}
        {currentUser && (
          <SessionReplayMask className="flex flex-col rounded-lg bg-card p-4">
            <View className="flex flex-row items-center gap-2">
              <Icon as={MailIcon} className="text-muted-foreground" />
              <Text className="flex-1 text-foreground">
                {currentUser.email}
              </Text>
            </View>
            {currentUser.user_metadata.username && (
              <View className="flex-row items-center gap-2">
                <Icon as={UserIcon} className="text-muted-foreground" />
                <Text className="flex-1 text-foreground">
                  {currentUser.user_metadata.username}
                </Text>
              </View>
            )}
          </SessionReplayMask>
        )}

        {showAnalyticsSettings ? (
          <>
            <View className="rounded-lg bg-card p-4">
              <AnalyticsConsentCard
                compact
                showLearnMore
                showDeferredStartDate={showDeferredStartDate}
                optedIn={analyticsEnabled}
                onOptedInChange={(optedIn) =>
                  void handleAnalyticsToggle(optedIn)
                }
                onLearnMorePress={() => setAnalyticsLearnMoreOpen(true)}
              />
            </View>

            <Drawer
              open={analyticsLearnMoreOpen}
              onOpenChange={setAnalyticsLearnMoreOpen}
              snapPoints={['60%']}
              enableDynamicSizing={false}
            >
              <DrawerContent className="pb-safe">
                <AnalyticsConsentCard
                  variant="learnMore"
                  showControls={false}
                  optedIn={analyticsEnabled}
                  onOptedInChange={(optedIn) =>
                    void handleAnalyticsToggle(optedIn)
                  }
                  className="py-4"
                />
              </DrawerContent>
            </Drawer>
          </>
        ) : null}

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
          <Alert icon={InfoIcon}>
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
        {currentUser && isAuthenticated && (
          <View className="flex flex-col gap-4">
            <View className="h-px bg-border" />
            <Button
              variant="ghost"
              onPress={() => setShowAdvancedOptions(!showAdvancedOptions)}
              className="h-auto justify-between p-4"
            >
              <View className="flex flex-row items-center gap-2">
                <Icon
                  as={MoreVertical}
                  size={20}
                  className="text-muted-foreground"
                />
                <Text className="text-base font-medium text-foreground">
                  {t('advanced')}
                </Text>
              </View>
              <Icon
                as={showAdvancedOptions ? ChevronDown : ChevronRight}
                size={20}
                className="text-muted-foreground"
              />
            </Button>

            {showAdvancedOptions && (
              <>
                {!isOnline ? (
                  <Alert icon={InfoIcon}>
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
                        router.push('/(app)/account-deletion');
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
          href="/(app)/terms"
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
