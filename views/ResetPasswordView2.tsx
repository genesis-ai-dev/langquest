import { PasswordInput } from '@/components/PasswordInput';
import { useAuth } from '@/contexts/AuthContext';
import { system } from '@/db/powersync/system';
import { useLocalization } from '@/hooks/useLocalization';
import { colors, sharedStyles, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ResetPasswordFormData {
  password: string;
  confirmPassword: string;
}

export default function ResetPasswordView2() {
  const [isLoading, setIsLoading] = useState(false);
  const { signOut } = useAuth();
  const { t } = useLocalization();

  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors }
  } = useForm<ResetPasswordFormData>({
    defaultValues: {
      password: '',
      confirmPassword: ''
    }
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    setIsLoading(true);
    try {
      const { error } = await system.supabaseConnector.client.auth.updateUser({
        password: data.password.trim()
      });

      if (error) throw error;

      Alert.alert(
        t('success') || 'Success',
        t('passwordResetSuccess') ||
          'Your password has been updated successfully',
        [
          {
            text: t('ok') || 'OK',
            onPress: () => {
              // Sign out and let auth context handle navigation to sign in
              void signOut();
            }
          }
        ]
      );

      // Reset form
      reset();
    } catch (error) {
      Alert.alert(
        t('error') || 'Error',
        error instanceof Error ? error.message : 'Failed to update password'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
          >
            <View
              style={[
                sharedStyles.container,
                { backgroundColor: 'transparent', gap: spacing.medium }
              ]}
            >
              <View style={{ alignItems: 'center', width: '100%' }}>
                <Text style={sharedStyles.appTitle}>LangQuest</Text>
                <Text style={sharedStyles.subtitle}>
                  {t('createNewPassword') || 'Create New Password'}
                </Text>
              </View>

              {/* Form section */}
              <View
                style={{
                  alignItems: 'center',
                  width: '100%',
                  gap: spacing.medium
                }}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={32}
                  color={colors.text}
                />

                <View style={{ gap: spacing.medium, width: '100%' }}>
                  {/* New Password field */}
                  <View style={{ gap: spacing.small }}>
                    <Controller
                      control={control}
                      name="password"
                      rules={{
                        required:
                          t('passwordRequired') || 'Password is required',
                        minLength: {
                          value: 6,
                          message:
                            t('passwordMinLength') ||
                            'Password must be at least 6 characters'
                        }
                      }}
                      render={({ field: { onChange, value } }) => (
                        <View
                          style={[
                            sharedStyles.input,
                            {
                              flexDirection: 'row',
                              alignItems: 'center',
                              width: '100%',
                              gap: spacing.medium
                            }
                          ]}
                        >
                          <Ionicons
                            name="lock-closed-outline"
                            size={20}
                            color={colors.text}
                          />
                          <PasswordInput
                            style={{ flex: 1, color: colors.text }}
                            placeholder={t('newPassword') || 'New Password'}
                            placeholderTextColor={colors.text}
                            value={value}
                            onChangeText={onChange}
                          />
                        </View>
                      )}
                    />
                    {errors.password && (
                      <Text style={styles.errorText}>
                        {errors.password.message}
                      </Text>
                    )}
                  </View>

                  {/* Confirm Password field */}
                  <View style={{ gap: spacing.small }}>
                    <Controller
                      control={control}
                      name="confirmPassword"
                      rules={{
                        required:
                          t('confirmPassword') ||
                          'Please confirm your password',
                        validate: (value) =>
                          value === watch('password') ||
                          t('passwordsNoMatch') ||
                          'Passwords do not match'
                      }}
                      render={({ field: { onChange, value } }) => (
                        <View
                          style={[
                            sharedStyles.input,
                            {
                              flexDirection: 'row',
                              alignItems: 'center',
                              width: '100%',
                              gap: spacing.medium
                            }
                          ]}
                        >
                          <Ionicons
                            name="lock-closed-outline"
                            size={20}
                            color={colors.text}
                          />
                          <PasswordInput
                            style={{ flex: 1, color: colors.text }}
                            placeholder={
                              t('confirmPassword') || 'Confirm New Password'
                            }
                            placeholderTextColor={colors.text}
                            value={value || ''}
                            onChangeText={onChange}
                          />
                        </View>
                      )}
                    />
                    {errors.confirmPassword && (
                      <Text style={styles.errorText}>
                        {errors.confirmPassword.message}
                      </Text>
                    )}
                  </View>

                  {/* Submit button */}
                  <TouchableOpacity
                    style={[
                      sharedStyles.button,
                      {
                        width: '100%',
                        marginTop: spacing.large,
                        alignSelf: 'center',
                        opacity: isLoading ? 0.7 : 1
                      }
                    ]}
                    onPress={handleSubmit(onSubmit)}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator color={colors.background} />
                    ) : (
                      <Text style={sharedStyles.buttonText}>
                        {t('updatePassword') || 'Update Password'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  errorText: {
    color: colors.error || '#ff0000',
    fontSize: 12,
    alignSelf: 'flex-start'
  }
});
