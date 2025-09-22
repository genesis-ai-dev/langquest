import { LanguageSelect } from '@/components/LanguageSelect';
import { PasswordInput } from '@/components/PasswordInput';
import { useAuth } from '@/contexts/AuthContext';
import { useLocalization } from '@/hooks/useLocalization';
import type { SharedAuthInfo } from '@/navigators/AuthNavigator';
import { useLocalStore } from '@/store/localStore';
import { colors, sharedStyles, spacing } from '@/styles/theme';
import { safeNavigate } from '@/utils/sharedUtils';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Alert,
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

interface RegisterFormData {
  email: string;
  password: string;
  confirmPassword: string;
  username: string;
  termsAccepted: boolean;
}

const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

export default function RegisterView2({
  onNavigate,
  sharedAuthInfo
}: {
  onNavigate: (view: 'sign-in', sharedAuthInfo: SharedAuthInfo) => void;
  sharedAuthInfo?: SharedAuthInfo;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const { signUp } = useAuth();
  const { t } = useLocalization();
  const currentLanguage = useLocalStore((state) => state.uiLanguage);
  const dateTermsAccepted = useLocalStore((state) => state.dateTermsAccepted);

  useEffect(() => {
    if (sharedAuthInfo?.email) {
      reset({
        email: sharedAuthInfo.email || ''
      });
    }
  }, [sharedAuthInfo?.email]);

  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors }
  } = useForm<RegisterFormData>({
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      username: '',
      termsAccepted: false
    }
  });

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    try {
      const { error } = await signUp(
        data.email.toLowerCase().trim(),
        data.password.trim(),
        {
          username: data.username.trim(),
          terms_accepted: data.termsAccepted,
          terms_accepted_at: dateTermsAccepted || new Date().toISOString(),
          ui_language:
            currentLanguage?.english_name?.toLowerCase() || 'english',
          ui_language_id: currentLanguage?.id,
          email_verified: false
        }
      );

      if (error) throw error;

      // Success
      // Alert.alert(
      //   t('success') || 'Success',
      //   t('checkEmail') || 'Please check your email to confirm your account',
      //   [{ text: t('ok') || 'OK', onPress: () => safeNavigate(() =>onNavigate('sign-in', { email: watch('email')}) })]
      // );
      // Reset form
      reset();
    } catch (error) {
      Alert.alert(
        t('error') || 'Error',
        error instanceof Error
          ? error.message
          : t('registrationFail') || 'Registration failed'
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
                  {t('newUserRegistration') || 'New User Registration'}
                </Text>
              </View>

              {/* Language section */}
              <View style={{ gap: spacing.medium, width: '100%' }}>
                <LanguageSelect containerStyle={{ width: '100%' }} />
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
                  name="person-add-outline"
                  size={32}
                  color={colors.text}
                />

                <View style={{ gap: spacing.medium, width: '100%' }}>
                  {/* Username field */}
                  <View style={{ gap: spacing.small }}>
                    <Controller
                      control={control}
                      name="username"
                      rules={{
                        required:
                          t('usernameRequired') || 'Username is required',
                        minLength: {
                          value: 3,
                          message:
                            t('usernameRequired') ||
                            'Username must be at least 3 characters'
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
                            name="person-outline"
                            size={20}
                            color={colors.text}
                          />
                          <TextInput
                            style={{ flex: 1, color: colors.text }}
                            placeholder={t('username') || 'Username'}
                            placeholderTextColor={colors.text}
                            value={value}
                            onChangeText={onChange}
                            accessibilityLabel="ph-no-capture"
                          />
                        </View>
                      )}
                    />
                    {errors.username && (
                      <Text style={styles.errorText}>
                        {errors.username.message}
                      </Text>
                    )}
                  </View>

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

                  {/* Password field */}
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
                            placeholder={t('password') || 'Password'}
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

                  {/* Confirm password field */}
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
                              t('confirmPassword') || 'Confirm Password'
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

                  {/* Terms checkbox */}
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: spacing.small
                    }}
                  >
                    <Controller
                      control={control}
                      name="termsAccepted"
                      rules={{
                        required:
                          t('termsRequired') ||
                          'You must agree to the Terms and Privacy'
                      }}
                      render={({ field: { onChange, value } }) => (
                        <TouchableOpacity
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: spacing.small
                          }}
                          onPress={() => onChange(!value)}
                        >
                          <View style={[styles.checkbox]}>
                            {value && (
                              <Ionicons
                                name="checkmark"
                                size={16}
                                color={colors.text}
                              />
                            )}
                          </View>
                          <Text style={{ color: colors.text, fontSize: 14 }}>
                            {t('agreeToTerms') ||
                              'I accept the terms and conditions'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    />
                    {errors.termsAccepted && (
                      <Text style={styles.errorText}>
                        {errors.termsAccepted.message}
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
                        alignSelf: 'center'
                      }
                    ]}
                    onPress={handleSubmit(onSubmit)}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator color={colors.background} />
                    ) : (
                      <Text style={sharedStyles.buttonText}>
                        {t('register') || 'Register'}
                      </Text>
                    )}
                  </TouchableOpacity>

                  {/* Sign in link */}
                  <View style={{ alignItems: 'center', gap: spacing.medium }}>
                    <TouchableOpacity
                      onPress={() =>
                        safeNavigate(() =>
                          onNavigate('sign-in', { email: watch('email') })
                        )
                      }
                      style={[
                        {
                          paddingVertical: spacing.small,
                          paddingHorizontal: spacing.medium,
                          borderWidth: 1,
                          borderColor: colors.primary,
                          borderRadius: 8,
                          backgroundColor: 'transparent'
                        }
                      ]}
                    >
                      <Text
                        style={[sharedStyles.link, { textAlign: 'center' }]}
                      >
                        {t('returningHero') ||
                          'Already have an account? Sign In'}
                      </Text>
                    </TouchableOpacity>
                  </View>
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
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: colors.text,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center'
  }
  // checkboxChecked: {
  //   backgroundColor: colors.primary
  // },
});
