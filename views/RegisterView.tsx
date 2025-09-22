import { LanguageSelect } from '@/components/LanguageSelect';
import { PasswordInput } from '@/components/PasswordInput';
import { system } from '@/db/powersync/system';
import { useLocalization } from '@/hooks/useLocalization';
import { useLocalStore } from '@/store/localStore';
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

interface RegisterFormData {
  email: string;
  password: string;
  confirmPassword: string;
  username: string;
  termsAccepted: boolean;
}

const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

export default function RegisterView() {
  const { supabaseConnector } = system;
  const { t } = useLocalization();
  const currentLanguage = useLocalStore((state) => state.uiLanguage);
  const dateTermsAccepted = useLocalStore((state) => state.dateTermsAccepted);
  const setAuthView = useLocalStore((state) => state.setAuthView);
  const [isRegistering, setIsRegistering] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
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
        { text: 'OK', onPress: () => setAuthView('sign-in') }
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
                  {t('newUserRegistration')}
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
                  </View>

                  {/* Confirm password field */}
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
                    disabled={isRegistering}
                  >
                    {isRegistering ? (
                      <ActivityIndicator color={colors.background} />
                    ) : (
                      <Text style={sharedStyles.buttonText}>
                        {t('register')}
                      </Text>
                    )}
                  </TouchableOpacity>

                  {/* Sign in link */}
                  <View style={{ alignItems: 'center', gap: spacing.medium }}>
                    <TouchableOpacity
                      onPress={() => setAuthView('sign-in')}
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
