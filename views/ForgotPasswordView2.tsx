import { useAuth } from '@/contexts/AuthContext';
import { useLocalization } from '@/hooks/useLocalization';
import { colors, sharedStyles, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Alert,
  InteractionManager,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ForgotPasswordFormData {
  email: string;
}

const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

export default function ForgotPasswordView2({
  onNavigate
}: {
  onNavigate: (view: 'sign-in') => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const { resetPassword } = useAuth();
  const { t } = useLocalization();

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<ForgotPasswordFormData>({
    defaultValues: {
      email: ''
    },
    shouldUnregister: true
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);
    try {
      const { error } = await resetPassword(data.email.toLowerCase().trim());

      if (error) throw error;

      // Reset form (may not be needed, once the page will change)
      reset();
      Keyboard.dismiss();

      Alert.alert(
        t('success') || 'Success',
        t('checkEmailForResetLink') ||
          'Check your email for a password reset link',
        [
          {
            text: t('ok') || 'OK',
            onPress: () => {
              InteractionManager.runAfterInteractions(() => {
                requestAnimationFrame(() => {
                  onNavigate('sign-in');
                });
              });
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert(
        t('error') || 'Error',
        error instanceof Error
          ? error.message
          : t('failedSendResetEmail') || 'Failed to send reset email'
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
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
                  {t('resetPassword') || 'Reset Password'}
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
                  <Text style={{ color: colors.text, textAlign: 'center' }}>
                    {t('enterEmailForPasswordReset') ||
                      "Enter your email address and we'll send you a link to reset your password."}
                  </Text>

                  {/* Email field */}
                  <View style={{ gap: spacing.small }}>
                    <Controller
                      control={control}
                      name="email"
                      rules={{
                        required: t('emailRequired') || 'Email is required',
                        pattern: {
                          value: EMAIL_REGEX,
                          message:
                            t('emailRequired') || 'Please enter a valid email'
                        }
                      }}
                      render={({ field: { onChange, value } }) => (
                        <View style={[sharedStyles.input, styles.emailInput]}>
                          <Ionicons
                            name="mail-outline"
                            size={20}
                            color={colors.text}
                          />
                          <TextInput
                            style={{ flex: 1, color: colors.text }}
                            placeholder={
                              t('enterYourEmail') || 'Enter your email'
                            }
                            placeholderTextColor={colors.text}
                            value={value}
                            onChangeText={onChange}
                            autoCapitalize="none"
                            keyboardType="email-address"
                            accessibilityLabel="ph-no-capture"
                          />
                        </View>
                      )}
                    />
                    {errors.email && (
                      <Text style={styles.errorText}>
                        {errors.email.message}
                      </Text>
                    )}
                  </View>

                  {/* Submit button */}
                  <TouchableOpacity
                    style={[sharedStyles.button, styles.submitButton]}
                    onPress={handleSubmit(onSubmit)}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text style={sharedStyles.buttonText}>
                        {t('sendResetEmail') || 'Send Reset Email'}
                      </Text>
                    )}
                  </TouchableOpacity>

                  {/* Back to login link */}
                  <View style={{ alignItems: 'center', gap: spacing.medium }}>
                    <TouchableOpacity onPress={() => onNavigate('sign-in')}>
                      <Text
                        style={[sharedStyles.link, { textAlign: 'center' }]}
                      >
                        {t('backToLogin') || 'Back to Sign In'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  errorText: {
    color: colors.error || '#ff0000',
    fontSize: 12,
    alignSelf: 'flex-start'
  },
  submitButton: {
    width: '100%',
    marginTop: spacing.large,
    alignSelf: 'center'
  },
  emailInput: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: spacing.medium
  }
});
