import { LanguageSelect } from '@/components/LanguageSelect';
import { PageHeader } from '@/components/PageHeader';
import { useAuth } from '@/contexts/AuthProvider';
import { profileService } from '@/database_services/profileService';
import { useLocalization } from '@/hooks/useLocalization';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useLocalStore } from '@/store/localStore';
import { colors, sharedStyles, spacing } from '@/styles/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import { usePostHog } from 'posthog-react-native';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Analytics storage key
export const ANALYTICS_OPT_OUT_KEY = 'analytics_opt_out';

interface ProfileFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  selectedLanguageId: string;
  // selectedAvatar: string;
  termsAccepted: boolean;
  analyticsOptOut: boolean;
}

export default function Profile() {
  const { currentUser, setCurrentUser } = useAuth();
  const { t } = useLocalization();
  const isOnline = useNetworkStatus();
  const posthog = usePostHog();
  const setAnalyticsOptOut = useLocalStore((state) => state.setAnalyticsOptOut);
  const analyticsOptOut = useLocalStore((state) => state.analyticsOptOut);
  // Handle analytics opt-out toggle
  const handleAnalyticsToggle = async (value: boolean) => {
    try {
      setAnalyticsOptOut(value);
      await posthog[`opt${value ? 'Out' : 'In'}`]();
    } catch (error) {
      console.error('Error saving analytics preference:', error);
      Alert.alert('Error', t('failedSaveAnalyticsPreference'));
    }
  };

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors }
  } = useForm<ProfileFormData>({
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
      selectedLanguageId: currentUser?.ui_language_id ?? '',
      // selectedAvatar: 'cat',
      termsAccepted: !!currentUser?.terms_accepted
    }
  });

  // Set initial values from user's profile
  useEffect(() => {
    if (currentUser) {
      reset({
        selectedLanguageId: currentUser.ui_language_id ?? '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
        // selectedAvatar: 'cat',
        termsAccepted: !!currentUser.terms_accepted
      });
    }
  }, [currentUser, reset, analyticsOptOut]);

  const onSubmit = async (data: ProfileFormData) => {
    if (!currentUser) return;

    try {
      // Validate password change if attempted
      if (data.newPassword || data.confirmPassword || data.currentPassword) {
        if (!data.currentPassword) {
          Alert.alert('Error', t('currentPasswordRequired'));
          return;
        }
        if (data.newPassword !== data.confirmPassword) {
          Alert.alert('Error', t('passwordsNoMatch'));
          return;
        }
      }

      // Update analytics preference

      // Update user profile
      const updatedUser = await profileService.updateProfile({
        id: currentUser.id,
        ui_language_id: data.selectedLanguageId,
        ...(isOnline && data.newPassword ? { password: data.newPassword } : {}),
        terms_accepted: data.termsAccepted,
        terms_accepted_at: data.termsAccepted
          ? new Date().toISOString()
          : undefined
      });

      if (updatedUser) {
        setCurrentUser(updatedUser);
        Alert.alert('Success', t('profileUpdateSuccess'));

        // Clear password fields
        reset({
          ...data,
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', t('failedUpdateProfile'));
    }
  };

  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView style={styles.container}>
          <View style={styles.contentContainer}>
            <PageHeader title={t('profile')} />

            {!posthog.isDisabled && (
              <TouchableOpacity
                style={styles.saveButton}
                onPress={async () => {
                  posthog.capture('feedback button pressed');
                  await posthog.flush();
                }}
              >
                <Text style={styles.saveButtonText}>{t('submitFeedback')}</Text>
              </TouchableOpacity>
            )}

            {/* Analytics Opt-Out */}
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>
                {t('analyticsOptOutLabel')}
              </Text>
              <Switch
                value={analyticsOptOut}
                onValueChange={handleAnalyticsToggle}
                trackColor={{
                  false: colors.inputBorder,
                  true: colors.primary
                }}
              />
            </View>
            <Text style={styles.settingDescription}>
              {t('analyticsOptOutDescription')}
            </Text>

            {/* Language Selection - Always available */}
            <View style={styles.controllerContainer}>
              <Controller
                control={control}
                name="selectedLanguageId"
                rules={{ required: t('selectLanguage') }}
                render={({ field: { onChange, value } }) => (
                  <LanguageSelect
                    value={value}
                    onChange={(lang) => onChange(lang.id)}
                  />
                )}
              />
              {errors.selectedLanguageId && (
                <Text style={styles.errorText}>
                  {errors.selectedLanguageId.message}
                </Text>
              )}
            </View>
            {/* Password Change - Only when online */}
            {isOnline ? (
              <View style={styles.passwordSection}>
                <Text style={styles.sectionTitle}>{t('changePassword')}</Text>
                <View style={styles.controllerContainer}>
                  <Controller
                    control={control}
                    name="currentPassword"
                    rules={{
                      validate: (value) =>
                        !watch('newPassword') ||
                        value.length > 0 ||
                        'Current password is required'
                    }}
                    render={({ field: { onChange, value } }) => (
                      <TextInput
                        style={styles.input}
                        placeholderTextColor={colors.textSecondary}
                        placeholder={t('currentPassword')}
                        secureTextEntry
                        value={value}
                        onChangeText={onChange}
                      />
                    )}
                  />
                  {errors.currentPassword && (
                    <Text style={styles.errorText}>
                      {errors.currentPassword.message}
                    </Text>
                  )}
                </View>

                <View style={styles.controllerContainer}>
                  <Controller
                    control={control}
                    name="newPassword"
                    rules={{
                      minLength: {
                        value: 6,
                        message: 'Password must be at least 6 characters'
                      }
                    }}
                    render={({ field: { onChange, value } }) => (
                      <TextInput
                        style={styles.input}
                        placeholderTextColor={colors.textSecondary}
                        placeholder={t('newPassword')}
                        secureTextEntry
                        value={value}
                        onChangeText={onChange}
                      />
                    )}
                  />
                  {errors.newPassword && (
                    <Text style={styles.errorText}>
                      {errors.newPassword.message}
                    </Text>
                  )}
                </View>

                <View style={styles.controllerContainer}>
                  <Controller
                    control={control}
                    name="confirmPassword"
                    rules={{
                      validate: (value) =>
                        value === watch('newPassword') || t('passwordsNoMatch')
                    }}
                    render={({ field: { onChange, value } }) => (
                      <TextInput
                        style={styles.input}
                        placeholder={t('confirmPassword')}
                        placeholderTextColor={colors.textSecondary}
                        secureTextEntry
                        value={value}
                        onChangeText={onChange}
                      />
                    )}
                  />
                  {errors.confirmPassword && (
                    <Text style={styles.errorText}>
                      {errors.confirmPassword.message}
                    </Text>
                  )}
                </View>
              </View>
            ) : (
              <View style={styles.offlineMessage}>
                <Text style={styles.offlineText}>
                  {t('onlineOnlyFeatures')}
                </Text>
              </View>
            )}

            {/* Save Button */}
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSubmit(onSubmit)}
            >
              <Text style={styles.saveButtonText}>{t('submit')}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.termsSection}>
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
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.medium
  },
  contentContainer: {
    gap: spacing.large
  },
  passwordSection: {
    gap: spacing.medium
  },
  termsSection: {
    gap: spacing.medium
  },
  termsStatus: {
    backgroundColor: colors.inputBackground,
    padding: spacing.medium,
    borderRadius: 8,
    gap: spacing.small
  },
  controllerContainer: {
    gap: spacing.small
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text
  },
  label: {
    fontSize: 16,
    color: colors.text
  },
  input: {
    backgroundColor: colors.inputBackground,
    padding: spacing.medium,
    borderRadius: 8,
    color: colors.text
  },
  saveButton: {
    backgroundColor: colors.primary,
    padding: spacing.medium,
    borderRadius: 8,
    alignItems: 'center'
  },
  saveButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: 'bold'
  },
  offlineMessage: {
    backgroundColor: colors.inputBackground,
    padding: spacing.medium,
    borderRadius: 8,
    alignItems: 'center'
  },
  offlineText: {
    color: colors.textSecondary,
    textAlign: 'center'
  },
  errorText: {
    color: colors.error || '#ff0000',
    fontSize: 12
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)'
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 20,
    width: '80%',
    maxHeight: '80%',
    alignItems: 'center'
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%'
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10
  },
  modalVersion: {
    fontSize: 14,
    color: colors.text
  },
  closeButton: {
    padding: 5
  },
  modalBody: {
    flex: 1,
    width: '100%',
    padding: 10
  },
  modalText: {
    color: colors.text,
    marginBottom: 10
  },
  modalFooter: {
    flexDirection: 'row',
    width: '100%',
    marginTop: 20
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    padding: spacing.medium,
    borderRadius: 8
  },
  settingLabel: {
    fontSize: 16,
    color: colors.text
  },
  settingDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.small
  }
});
