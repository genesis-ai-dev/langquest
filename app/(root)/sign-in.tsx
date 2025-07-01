import { LanguageSelect } from '@/components/LanguageSelect';
import { PasswordInput } from '@/components/PasswordInput';
import { system } from '@/db/powersync/system';
import { useLocalization } from '@/hooks/useLocalization';
import { colors, sharedStyles, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
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

interface LoginFormData {
  email: string;
  password: string;
  selectedLanguageId: string;
}

const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

export default function SignIn() {
  const { supabaseConnector } = system;
  const { t } = useLocalization();
  const router = useRouter();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<LoginFormData>({
    defaultValues: {
      email: '',
      password: ''
    }
  });

  // Clear form when component unmounts
  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  const onSubmit = async (data: LoginFormData) => {
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
      // await system.init();
      reset();
      router.replace('/');
    } catch (error) {
      console.error('Error during sign in:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : t('signInError')
      );
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
                <Text style={sharedStyles.subtitle}>{t('welcome')}</Text>
              </View>

              {/* Language section */}
              <View style={{ gap: spacing.medium, width: '100%' }}>
                <LanguageSelect containerStyle={{ width: '100%' }} />

                {/* Login section */}
                <View
                  style={{
                    alignItems: 'center',
                    width: '100%',
                    gap: spacing.medium
                  }}
                >
                  <Ionicons
                    name="person-outline"
                    size={32}
                    color={colors.text}
                  />

                  <View style={{ gap: spacing.medium }}>
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

                    <View style={{ gap: spacing.small, width: '100%' }}>
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

                      <Link
                        href="/request-reset-password"
                        style={[sharedStyles.link]}
                        push
                      >
                        {t('forgotPassword')}
                      </Link>
                    </View>

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
                      <Text style={sharedStyles.buttonText}>{t('signIn')}</Text>
                    </TouchableOpacity>

                    {/* More prominent registration link */}
                    <Link
                      href="/register"
                      style={[
                        sharedStyles.link,
                        {
                          marginTop: spacing.medium,
                          paddingVertical: spacing.small,
                          paddingHorizontal: spacing.medium,
                          borderWidth: 1,
                          borderColor: colors.primary,
                          borderRadius: 8,
                          backgroundColor: 'transparent',
                          alignSelf: 'center'
                        }
                      ]}
                      push
                    >
                      <Text
                        style={[sharedStyles.link, { textAlign: 'center' }]}
                      >
                        {t('newUser')} {t('register')}
                      </Text>
                    </Link>
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
