import { LanguageSelect } from '@/components/LanguageSelect';
import { PasswordInput } from '@/components/PasswordInput';
import { system } from '@/db/powersync/system';
import { useLocalization } from '@/hooks/useLocalization';
import { useLocalStore } from '@/store/localStore';
import { colors, sharedStyles, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
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

type LoginMode = 'sign-in' | 'register' | 'reset-password';

interface LoginFormData {
  email: string;
  password: string;
  confirmPassword?: string;
  username?: string;
  termsAccepted?: boolean;
  selectedLanguageId?: string;
}

const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

export default function LoginView() {
  const { supabaseConnector } = system;
  const { t } = useLocalization();
  const [mode, setMode] = useState<LoginMode>('sign-in');
  const currentLanguage = useLocalStore((state) => state.language);
  const dateTermsAccepted = useLocalStore((state) => state.dateTermsAccepted);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors }
  } = useForm<LoginFormData>({
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      username: '',
      termsAccepted: false
    }
  });

  // Clear form when switching modes
  useEffect(() => {
    reset();
  }, [mode, reset]);

  const onSubmitSignIn = async (data: LoginFormData) => {
    try {
      // Attempt to sign in with password
      const { data: signInData, error: signInError } =
        await supabaseConnector.client.auth.signInWithPassword({
          email: data.email.toLowerCase().trim(),
          password: data.password.trim()
        });

      if (signInError) {
        throw signInError;
      }

      // Check if email is verified
      if (!signInData.user.email_confirmed_at) {
        Alert.alert(t('verificationRequired'), t('accountNotVerified'), [
          { text: 'OK' }
        ]);
        return;
      }

      // Email is verified, proceed with login
      reset();
      // Navigation will be handled automatically by app.tsx when user is authenticated
    } catch (error) {
      console.error('Error during sign in:', error);

      Alert.alert(t('error'), t('signInError'), [
        {
          text: t('ok')
        },
        {
          text: t('newUser'),
          onPress: () => setMode('register')
        }
      ]);
    }
  };

  const onSubmitRegister = async (data: LoginFormData) => {
    try {
      if (!data.termsAccepted) {
        Alert.alert(t('error'), t('termsRequired'));
        return;
      }

      if (!data.email || !data.username) {
        Alert.alert(t('error'), 'Required fields are missing');
        return;
      }

      // Update the anonymous user with credentials
      const { error: authError } =
        await supabaseConnector.client.auth.updateUser({
          email: data.email.trim(),
          password: data.password.trim(),
          data: {
            username: data.username.trim(),
            ui_language_id: currentLanguage?.id,
            ui_language:
              currentLanguage?.english_name?.toLowerCase() || 'english',
            terms_accepted: data.termsAccepted,
            terms_accepted_at: dateTermsAccepted
          }
        });

      if (authError) {
        throw authError;
      }

      console.log('User updated with terms acceptance in auth metadata');

      // Email confirmation is required
      Alert.alert(t('success'), t('checkEmail'), [
        { text: 'OK', onPress: () => setMode('sign-in') }
      ]);
      return;
    } catch (error) {
      console.error('Error registering user:', error);
      Alert.alert(
        t('error'),
        error instanceof Error ? error.message : t('registrationFail')
      );
    }
  };

  const onSubmitResetPassword = async (data: LoginFormData) => {
    try {
      const { error } =
        await supabaseConnector.client.auth.resetPasswordForEmail(
          data.email.toLowerCase().trim(),
          {
            redirectTo: `${process.env.EXPO_PUBLIC_SITE_URL}/reset-password${process.env.EXPO_PUBLIC_APP_VARIANT !== 'production' ? `?env=${process.env.EXPO_PUBLIC_APP_VARIANT}` : ''}`
          }
        );

      if (error) throw error;

      Alert.alert(t('success'), t('checkEmailForResetLink'), [
        { text: t('ok'), onPress: () => setMode('sign-in') }
      ]);
    } catch (error) {
      console.error('Error requesting password reset:', error);
      Alert.alert(
        t('error'),
        error instanceof Error ? error.message : t('failedSendResetEmail')
      );
    }
  };

  const onSubmit = (data: LoginFormData) => {
    switch (mode) {
      case 'sign-in':
        return onSubmitSignIn(data);
      case 'register':
        return onSubmitRegister(data);
      case 'reset-password':
        return onSubmitResetPassword(data);
    }
  };

  const getTitle = () => {
    switch (mode) {
      case 'sign-in':
        return t('welcome');
      case 'register':
        return t('newUserRegistration');
      case 'reset-password':
        return t('resetPassword');
    }
  };

  const getSubmitButtonText = () => {
    switch (mode) {
      case 'sign-in':
        return t('signIn');
      case 'register':
        return t('register');
      case 'reset-password':
        return t('sendResetEmail');
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
                <Text style={sharedStyles.subtitle}>{getTitle()}</Text>
              </View>

              {/* Language section */}
              {mode !== 'reset-password' && (
                <View style={{ gap: spacing.medium, width: '100%' }}>
                  <LanguageSelect containerStyle={{ width: '100%' }} />
                </View>
              )}

              {/* Form section */}
              <View
                style={{
                  alignItems: 'center',
                  width: '100%',
                  gap: spacing.medium
                }}
              >
                <Ionicons name="person-outline" size={32} color={colors.text} />

                <View style={{ gap: spacing.medium, width: '100%' }}>
                  {/* Username field - only for register */}
                  {mode === 'register' && (
                    <View style={{ gap: spacing.small }}>
                      <Controller
                        control={control}
                        name="username"
                        rules={{
                          required: t('usernameRequired'),
                          minLength: {
                            value: 3,
                            message: t('usernameRequired')
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
                              placeholder={t('username')}
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
                  )}

                  {/* Email field */}
                  <View style={{ gap: spacing.small }}>
                    <Controller
                      control={control}
                      name="email"
                      rules={{
                        required: t('emailRequired'),
                        pattern: {
                          value: EMAIL_REGEX,
                          message: t('emailRequired')
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
                            placeholder={t('enterYourEmail')}
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

                  {/* Password fields - not for reset password */}
                  {mode !== 'reset-password' && (
                    <>
                      {/* Password field */}
                      <View style={{ gap: spacing.small }}>
                        <Controller
                          control={control}
                          name="password"
                          rules={{
                            required: t('passwordRequired'),
                            minLength: {
                              value: 6,
                              message: t('passwordMinLength')
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
                                placeholder={t('password')}
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

                        {/* Forgot password link - only for sign-in */}
                        {mode === 'sign-in' && (
                          <TouchableOpacity
                            onPress={() => setMode('reset-password')}
                          >
                            <Text style={[sharedStyles.link]}>
                              {t('forgotPassword')}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Confirm password field - only for register */}
                      {mode === 'register' && (
                        <View style={{ gap: spacing.small }}>
                          <Controller
                            control={control}
                            name="confirmPassword"
                            rules={{
                              required: t('confirmPassword'),
                              validate: (value) =>
                                value === watch('password') ||
                                t('passwordsNoMatch')
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
                                  placeholder={t('confirmPassword')}
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
                      )}
                    </>
                  )}

                  {/* Terms checkbox - only for register */}
                  {mode === 'register' && (
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
                        render={({ field: { onChange, value } }) => (
                          <TouchableOpacity
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: spacing.small
                            }}
                            onPress={() => onChange(!value)}
                          >
                            <View
                              style={[
                                styles.checkbox,
                                value ? styles.checkboxChecked : null
                              ]}
                            >
                              {value && (
                                <Ionicons
                                  name="checkmark"
                                  size={16}
                                  color={colors.background}
                                />
                              )}
                            </View>
                            <Text style={{ color: colors.text, fontSize: 14 }}>
                              {t('agreeToTerms')}
                            </Text>
                          </TouchableOpacity>
                        )}
                      />
                    </View>
                  )}

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
                  >
                    <Text style={sharedStyles.buttonText}>
                      {getSubmitButtonText()}
                    </Text>
                  </TouchableOpacity>

                  {/* Mode switching links */}
                  <View style={{ alignItems: 'center', gap: spacing.medium }}>
                    {mode === 'sign-in' && (
                      <TouchableOpacity
                        onPress={() => setMode('register')}
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
                          {t('newUser')} {t('register')}
                        </Text>
                      </TouchableOpacity>
                    )}

                    {mode === 'register' && (
                      <TouchableOpacity
                        onPress={() => setMode('sign-in')}
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
                          {t('returningHero')}
                        </Text>
                      </TouchableOpacity>
                    )}

                    {mode === 'reset-password' && (
                      <TouchableOpacity onPress={() => setMode('sign-in')}>
                        <Text
                          style={[sharedStyles.link, { textAlign: 'center' }]}
                        >
                          {t('backToLogin')}
                        </Text>
                      </TouchableOpacity>
                    )}
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
  },
  checkboxChecked: {
    backgroundColor: colors.primary
  }
});
