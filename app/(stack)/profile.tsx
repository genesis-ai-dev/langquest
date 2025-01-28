import { LanguageSelect } from '@/components/LanguageSelect';
import { useAuth } from '@/contexts/AuthContext';
import { userService } from '@/database_services/userService';
import { language } from '@/db/drizzleSchema';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useTranslation } from '@/hooks/useTranslation';
import { colors, sharedStyles, spacing } from '@/styles/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';

type Language = typeof language.$inferSelect;

type ProfileFormData = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  selectedLanguageId: string;
  // selectedAvatar: string;
};

export default function Profile() {
  const { currentUser, setCurrentUser } = useAuth();
  const { t } = useTranslation();
  const isOnline = useNetworkStatus();

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
      selectedLanguageId: currentUser?.ui_language_id || ''
      // selectedAvatar: 'cat'
    }
  });

  // Set initial language from user's profile
  useEffect(() => {
    if (currentUser?.ui_language_id) {
      reset({
        selectedLanguageId: currentUser.ui_language_id,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
        // selectedAvatar: 'cat'
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
      const updatedUser = await userService.updateUser({
        id: currentUser.id,
        ui_language_id: data.selectedLanguageId,
        ...(isOnline && data.newPassword ? { password: data.newPassword } : {})
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
            <Text style={sharedStyles.title}>{t('profile')}</Text>

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
  }
});
