import { LanguageSelect } from '@/components/LanguageSelect';
import { useAuth } from '@/contexts/AuthContext';
import { profileService } from '@/database_services/profileService';
import { language } from '@/db/drizzleSchema';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useTranslation } from '@/hooks/useTranslation';
import { colors, sharedStyles, spacing } from '@/styles/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
  Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { Ionicons } from '@expo/vector-icons';
import { PageHeader } from '@/components/PageHeader';
import { Link } from 'expo-router';

type Language = typeof language.$inferSelect;

type ProfileFormData = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  selectedLanguageId: string;
  // selectedAvatar: string;
  termsAccepted: boolean;
};

export default function Profile() {
  const { currentUser, setCurrentUser } = useAuth();
  const { t } = useTranslation();
  const isOnline = useNetworkStatus();
  const [termsModalVisible, setTermsModalVisible] = useState(false);

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
      selectedLanguageId: (currentUser?.ui_language_id as string) ?? '',
      // selectedAvatar: 'cat',
      termsAccepted: !!currentUser?.terms_accepted
    }
  });

  // Set initial values from user's profile
  useEffect(() => {
    if (currentUser) {
      reset({
        selectedLanguageId: (currentUser.ui_language_id as string) ?? '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
        // selectedAvatar: 'cat',
        termsAccepted: !!currentUser.terms_accepted
      });
    }
  }, [currentUser, reset]);

  const onSubmit = async (data: ProfileFormData) => {
    if (!currentUser) return;

    try {
      // Validate password change if attempted
      if (data.newPassword || data.confirmPassword || data.currentPassword) {
        if (!data.currentPassword) {
          Alert.alert('Error', 'Current password is required');
          return;
        }
        if (data.newPassword !== data.confirmPassword) {
          Alert.alert('Error', t('passwordsNoMatch'));
          return;
        }
      }

      // Update user profile
      const updatedUser = await profileService.updateProfile({
        id: currentUser.id,
        ui_language_id: data.selectedLanguageId,
        ...(isOnline && data.newPassword ? { password: data.newPassword } : {}),
        terms_accepted: data.termsAccepted,
        terms_version: data.termsAccepted ? '1.0' : undefined
      });

      if (updatedUser) {
        setCurrentUser(updatedUser);
        Alert.alert('Success', 'Profile updated successfully');

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
      Alert.alert('Error', 'Failed to update profile');
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

            {/* Terms and Conditions Section */}
            <View style={styles.termsSection}>
              <Text style={styles.sectionTitle}>
                {t('termsAndConditionsTitle')}
              </Text>

              <View style={styles.termsStatus}>
                <Text style={styles.label}>
                  v1.0: {currentUser?.terms_version || t('notAccepted')}
                </Text>
                <Text style={styles.label}>
                  {t('status')}:{' '}
                  {currentUser?.terms_accepted
                    ? t('accepted')
                    : t('notAccepted')}
                </Text>
              </View>

              <View style={styles.controllerContainer}>
                <Controller
                  control={control}
                  name="termsAccepted"
                  render={({ field: { onChange, value } }) => (
                    <TouchableOpacity
                      onPress={() => onChange(!value)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing.small
                      }}
                    >
                      <Ionicons
                        name={value ? 'checkbox' : 'square-outline'}
                        size={24}
                        color={colors.text}
                      />
                      <Text style={{ color: colors.text }}>
                        {t('agreeToTerms')}
                      </Text>
                    </TouchableOpacity>
                  )}
                />
              </View>

              <Link
                href="/terms"
                style={[sharedStyles.link, { fontSize: 14 }]}
                push
              >
                {t('viewTerms')}
              </Link>
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
  }
});
