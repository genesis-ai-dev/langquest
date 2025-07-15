import { LanguageSelect } from '@/components/LanguageSelect';
import { PasswordInput } from '@/components/PasswordInput';
import { system } from '@/db/powersync/system';
import { useLocalization } from '@/hooks/useLocalization';
import { useLocalStore } from '@/store/localStore';
import { colors, sharedStyles, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
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

type LoginMode =
  | 'sign-in'
  | 'register'
  | 'reset-password'
  | 'reset-password-form';

interface LoginFormData {
  email: string;
  password: string;
  confirmPassword?: string;
  username?: string;
  termsAccepted?: boolean;
  selectedLanguageId?: string;
}

interface LoginViewProps {
  initialMode?: LoginMode;
}

const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

export default function LoginView({ initialMode }: LoginViewProps) {
  const { supabaseConnector } = system;
  const { t } = useLocalization();
  const router = useRouter();
  const [mode, setMode] = useState<LoginMode>(initialMode || 'sign-in');
  const currentLanguage = useLocalStore((state) => state.language);
  const dateTermsAccepted = useLocalStore((state) => state.dateTermsAccepted);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  console.log('[LoginView] initialMode:', initialMode);
  console.log('[LoginView] current mode:', mode);

  // Update mode when initialMode changes
  useEffect(() => {
    if (initialMode && initialMode !== mode) {
      console.log('[LoginView] Updating mode from', mode, 'to', initialMode);
      setMode(initialMode);
    }
  }, [initialMode]);

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

  // Clear form when switching modes (but not for reset-password-form)
  useEffect(() => {
    if (mode !== 'reset-password-form') {
      reset();
    }
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
    setIsRegistering(true);
    try {
      const {
        data: { session },
        error: sessionError
      } = await supabaseConnector.client.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session) {
        const { error: anonError } =
          await supabaseConnector.client.auth.signInAnonymously();
        if (anonError) throw anonError;
      }

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
    } finally {
      setIsRegistering(false);
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

  const onSubmitNewPassword = async (data: LoginFormData) => {
    console.log('[LoginView] onSubmitNewPassword called');
    const setPasswordResetMode = useLocalStore.getState().setPasswordResetMode;
    setIsUpdatingPassword(true);

    try {
      console.log('[LoginView] Starting password update...');

      // Check current auth state
      const {
        data: { session },
        error: sessionError
      } = await supabaseConnector.client.auth.getSession();

      if (sessionError) {
        console.error('[LoginView] Session error:', sessionError);
        throw sessionError;
      }

      console.log('[LoginView] Current session:', {
        hasSession: !!session,
        userId: session?.user?.id,
        email: session?.user?.email,
        isAnonymous: session?.user?.is_anonymous
      });

      // Try to update the password
      console.log('[LoginView] Calling updateUser...');
      const { data: updateData, error } =
        await supabaseConnector.client.auth.updateUser({
          password: data.password.trim()
        });

      console.log('[LoginView] Update response:', {
        success: !error,
        error: error?.message,
        errorCode: error?.code,
        userData: updateData?.user?.email
      });

      if (error) {
        console.error('[LoginView] Password update error details:', {
          message: error.message,
          code: error.code,
          status: error.status,
          name: error.name
        });
        throw error;
      }

      console.log('[LoginView] Password updated successfully');

      // After successful password update, we need to clear the recovery session
      // and sign in with the new password
      Alert.alert(t('success'), t('passwordResetSuccess'), [
        {
          text: t('ok'),
          onPress: async () => {
            console.log(
              '[LoginView] Clearing password reset mode and signing out...'
            );
            // Clear the password reset mode
            setPasswordResetMode(false);

            // Sign out to clear the recovery session
            await supabaseConnector.client.auth.signOut();

            // Set mode to sign-in so user can log in with new password
            setMode('sign-in');

            // Navigate back to main app (which will show login)
            router.replace('/app');
          }
        }
      ]);
    } catch (error) {
      console.error('[LoginView] Error in onSubmitNewPassword:', error);
      Alert.alert(
        t('error'),
        error instanceof Error
          ? error.message
          : 'Password update failed. Please try again.'
      );
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const onSubmit = (data: LoginFormData) => {
    console.log('[LoginView] onSubmit called with mode:', mode);
    console.log('[LoginView] form data:', {
      email: data.email,
      hasPassword: !!data.password,
      hasConfirmPassword: !!data.confirmPassword
    });

    switch (mode) {
      case 'sign-in':
        return onSubmitSignIn(data);
      case 'register':
        return onSubmitRegister(data);
      case 'reset-password':
        return onSubmitResetPassword(data);
      case 'reset-password-form':
        return onSubmitNewPassword(data);
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
      case 'reset-password-form':
        return t('createNewPassword');
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
      case 'reset-password-form':
        return t('updatePassword');
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
              {mode !== 'reset-password' && mode !== 'reset-password-form' && (
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
                  {mode !== 'reset-password-form' && (
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
                  )}

                  {/* Password fields - not for reset password modes */}
                  {mode !== 'reset-password' &&
                    mode !== 'reset-password-form' && (
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

                  {mode === 'reset-password-form' && (
                    <>
                      {/* New Password field */}
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
                                placeholder={t('newPassword')}
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
                    </>
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
                    onPress={() => {
                      console.log(
                        '[LoginView] Submit button pressed, mode:',
                        mode
                      );
                      if (mode === 'reset-password-form') {
                        // For reset password form, manually validate and submit
                        const password = watch('password');
                        const confirmPassword = watch('confirmPassword');

                        if (!password || password.length < 6) {
                          Alert.alert(t('error'), t('passwordMinLength'));
                          return;
                        }

                        if (password !== confirmPassword) {
                          Alert.alert(t('error'), t('passwordsNoMatch'));
                          return;
                        }

                        void onSubmitNewPassword({
                          password,
                          confirmPassword,
                          email: '', // Not needed for password reset
                          username: '', // Not needed for password reset
                          termsAccepted: false
                        });
                      } else {
                        void handleSubmit(onSubmit)();
                      }
                    }}
                    disabled={
                      (mode === 'register' && isRegistering) ||
                      (mode === 'reset-password-form' && isUpdatingPassword)
                    }
                  >
                    {(mode === 'register' && isRegistering) ||
                    (mode === 'reset-password-form' && isUpdatingPassword) ? (
                      <ActivityIndicator color={colors.background} />
                    ) : (
                      <Text style={sharedStyles.buttonText}>
                        {getSubmitButtonText()}
                      </Text>
                    )}
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
