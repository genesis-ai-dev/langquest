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

export default function ResetPasswordView() {
  const { supabaseConnector } = system;
  const { t } = useLocalization();
  const { signOut } = useAuth();
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm<ResetPasswordFormData>({
    defaultValues: {
      password: '',
      confirmPassword: ''
    }
  });

  // Listen for PASSWORD_RECOVERY auth event
  // useEffect(() => {
  //   console.log('[ResetPasswordView] Setting up auth state listener');

  //   // First, let's test if the Supabase client is working
  //   console.log('[ResetPasswordView] Testing Supabase client...');
  //   console.log(
  //     '[ResetPasswordView] Has auth client:',
  //     !!supabaseConnector.client.auth
  //   );
  //   console.log(
  //     '[ResetPasswordView] Supabase client exists:',
  //     !!supabaseConnector.client
  //   );

  //   let mounted = true;

  //   const { data: authListener } =
  //     supabaseConnector.client.auth.onAuthStateChange((event, _session) => {
  //       if (!mounted) return;
  //       console.log('[ResetPasswordView] Auth event:', event);
  //       if (event === 'PASSWORD_RECOVERY') {
  //         console.log('[ResetPasswordView] PASSWORD_RECOVERY event detected');
  //         // setIsRecoverySession(true); // This line is removed
  //       }
  //     });

  //   // Check if we already have a recovery session with timeout
  //   const checkSession = async () => {
  //     try {
  //       console.log('[ResetPasswordView] Checking session...');

  //       // Create a timeout promise
  //       let timeoutId: NodeJS.Timeout;
  //       const timeoutPromise = new Promise<never>((_, reject) => {
  //         timeoutId = setTimeout(
  //           () => reject(new Error('getSession timed out')),
  //           5000
  //         );
  //       });

  //       try {
  //         const result = await Promise.race([
  //           supabaseConnector.client.auth.getSession(),
  //           timeoutPromise
  //         ]);

  //         clearTimeout(timeoutId!);

  //         if (!mounted) return;

  //         const {
  //           data: { session }
  //         } = result;

  //         if (session) {
  //           console.log('[ResetPasswordView] Current session check:', {
  //             hasSession: true,
  //             userEmail: session.user.email,
  //             recoveryAt: session.user.recovery_sent_at,
  //             lastSignIn: session.user.last_sign_in_at,
  //             emailConfirmed: session.user.email_confirmed_at
  //           });

  //           // If we have a session with recovery_sent_at, treat it as a recovery session
  //           if (session.user.recovery_sent_at) {
  //             console.log(
  //               '[ResetPasswordView] Session has recovery_sent_at, marking as recovery session'
  //             );
  //             // setIsRecoverySession(true); // This line is removed
  //           }
  //         } else {
  //           console.log('[ResetPasswordView] No session found');
  //         }
  //       } catch (error) {
  //         clearTimeout(timeoutId!);
  //         throw error;
  //       }
  //     } catch (error) {
  //       console.error('[ResetPasswordView] Error checking session:', error);
  //       if (error instanceof Error && error.message.includes('timed out')) {
  //         console.error('[ResetPasswordView] getSession call timed out!');
  //       }
  //     }
  //   };

  //   void checkSession();

  //   return () => {
  //     mounted = false;
  //     authListener.subscription.unsubscribe();
  //   };
  // }, [supabaseConnector.client.auth]);

  const onSubmit = async (data: ResetPasswordFormData) => {
    console.log('[ResetPasswordView] onSubmit called');
    console.log('[ResetPasswordView] Password length:', data.password.length);
    setIsUpdatingPassword(true);

    try {
      console.log('[ResetPasswordView] Starting password update...');

      // Skip the session check - we know we have a session because we're here
      // Just try to update the password directly
      console.log('[ResetPasswordView] Attempting direct password update...');

      const startTime = Date.now();

      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error('Password update timed out after 10 seconds')),
          10000
        );
      });

      try {
        // Just try the update directly
        console.log('[ResetPasswordView] Calling updateUser...');
        // Why can't I update the user here?
        // Log details of the user with auth.getUser()
        const user = await supabaseConnector.client.auth.getUser();
        console.log('[ResetPasswordView] User details:', user);
        const updatePromise = supabaseConnector.client.auth.updateUser({
          password: data.password.trim()
        });

        console.log(
          '[ResetPasswordView] Update request sent, waiting for response...'
        );

        const { data: updateData, error } = await Promise.race([
          updatePromise,
          timeoutPromise
        ]);

        const duration = Date.now() - startTime;
        console.log('[ResetPasswordView] Update completed in', duration, 'ms');

        console.log('[ResetPasswordView] Update response:', {
          success: !error,
          error: error?.message,
          errorCode: error?.code,
          errorStatus: error?.status,
          hasData: !!updateData
        });

        if (error) {
          console.error('[ResetPasswordView] Password update error details:', {
            message: error.message,
            code: error.code,
            status: error.status,
            name: error.name,
            fullError: JSON.stringify(error)
          });

          // Check for specific error types
          if (
            error.message.includes('expired') ||
            error.message.includes('invalid')
          ) {
            Alert.alert(
              t('error'),
              t('sessionExpired') ||
                'Your password reset link has expired. Please request a new one.',
              [{ text: t('ok') }]
            );
            await signOut();
            return;
          }

          // Check for reauthentication needed error
          if (
            error.code === 'reauthentication_needed' ||
            error.message.includes('reauthentication')
          ) {
            Alert.alert(
              t('error'),
              'Password update requires reauthentication. Please try again.',
              [{ text: t('ok') }]
            );
            return;
          }

          throw error;
        }

        console.log('[ResetPasswordView] Password updated successfully');

        // After successful password update, sign out and redirect to login
        Alert.alert(t('success'), t('passwordResetSuccess'), [
          {
            text: t('ok'),
            onPress: () => {
              console.log('[ResetPasswordView] Signing out...');
              // Use the signOut from auth context which handles all cleanup
              void signOut();
            }
          }
        ]);
      } catch (timeoutError) {
        if (
          timeoutError instanceof Error &&
          timeoutError.message.includes('timed out')
        ) {
          console.error('[ResetPasswordView] Password update timed out');
          Alert.alert(
            t('error'),
            'The password update is taking too long. This might be a network issue. Please check your connection and try again.',
            [{ text: t('ok') }]
          );
          return;
        }
        throw timeoutError;
      }
    } catch (error) {
      console.error('[ResetPasswordView] Error in onSubmit:', error);
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
                  {t('createNewPassword')}
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
                          value === watch('password') || t('passwordsNoMatch')
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

                  {/* Submit button */}
                  <TouchableOpacity
                    style={[
                      sharedStyles.button,
                      {
                        width: '100%',
                        marginTop: spacing.large,
                        alignSelf: 'center',
                        opacity: isUpdatingPassword ? 0.7 : 1
                      }
                    ]}
                    onPress={handleSubmit(onSubmit)}
                    disabled={isUpdatingPassword}
                  >
                    {isUpdatingPassword ? (
                      <ActivityIndicator color={colors.background} />
                    ) : (
                      <Text style={sharedStyles.buttonText}>
                        {t('updatePassword')}
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
