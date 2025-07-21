import { LanguageSelect } from '@/components/LanguageSelect';
import { PasswordInput } from '@/components/PasswordInput';
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
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface SignInFormData {
  email: string;
  password: string;
}

const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

export default function SignInView2({
  onNavigate
}: {
  onNavigate: (view: 'register' | 'forgot-password') => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useLocalization();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<SignInFormData>({
    defaultValues: {
      email: '',
      password: ''
    }
  });

  const onSubmit = async (data: SignInFormData) => {
    setIsLoading(true);
    try {
      const { error } =
        await system.supabaseConnector.client.auth.signInWithPassword({
          email: data.email.toLowerCase().trim(),
          password: data.password.trim()
        });

      if (error) throw error;

      // Success - auth context will handle navigation
      reset();
    } catch (error) {
      Alert.alert(
        t('error') || 'Error',
        error instanceof Error
          ? error.message
          : t('signInError') || 'Sign in failed'
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
                  {t('welcome') || 'Welcome'}
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
                <Ionicons name="person-outline" size={32} color={colors.text} />

                <View style={{ gap: spacing.medium, width: '100%' }}>
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

                    {/* Forgot password link */}
                    <TouchableOpacity
                      onPress={() => onNavigate('forgot-password')}
                    >
                      <Text style={[sharedStyles.link]}>
                        {t('forgotPassword') || 'Forgot Password?'}
                      </Text>
                    </TouchableOpacity>
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
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text style={sharedStyles.buttonText}>
                        {t('signIn') || 'Sign In'}
                      </Text>
                    )}
                  </TouchableOpacity>

                  {/* Register link */}
                  <View style={{ alignItems: 'center', gap: spacing.medium }}>
                    <TouchableOpacity
                      onPress={() => onNavigate('register')}
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
                        {t('newUser') || 'New User?'}{' '}
                        {t('register') || 'Register'}
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
  }
});
