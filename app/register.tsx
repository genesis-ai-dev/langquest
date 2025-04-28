import { LanguageSelect } from '@/components/LanguageSelect';
import { PasswordInput } from '@/components/PasswordInput';
import { languageService } from '@/database_services/languageService';
import { language } from '@/db/drizzleSchema';
import { useSystem } from '@/contexts/SystemContext';
import { useTranslation } from '@/hooks/useTranslation';
import { colors, sharedStyles, spacing } from '@/styles/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Href, Link, useRouter } from 'expo-router';
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
import AsyncStorage from '@react-native-async-storage/async-storage';

type Language = typeof language.$inferSelect;

type RegisterFormData = {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  selectedLanguageId: string;
  termsAccepted: boolean;
};

const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

export default function Register() {
  const { currentLanguage, setLanguage } = useLanguage();
  const { t } = useTranslation();
  const router = useRouter();
  const { supabaseConnector } = useSystem();

  const {
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors }
  } = useForm<RegisterFormData>({
    defaultValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      selectedLanguageId: currentLanguage?.id || '',
      termsAccepted: false
    }
  });

  // Set language ID in form when it loads from context
  useEffect(() => {
    if (currentLanguage?.id) {
      setValue('selectedLanguageId', currentLanguage.id);
    }
  }, [currentLanguage, setValue]);

  // Clear form when component unmounts
  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  const onSubmit = async (data: RegisterFormData) => {
    try {
      if (!data.termsAccepted) {
        Alert.alert(t('error'), t('termsRequired'));
        return;
      }

      // Get the language object first
      const selectedLanguage = await languageService.getLanguageById(
        data.selectedLanguageId
      );
      if (!selectedLanguage) {
        throw new Error('Selected language not found');
      }

      // Update the anonymous user with credentials
      const { data: authData, error: authError } =
        await supabaseConnector.client.auth.updateUser(
          {
            email: data.email.trim(),
            password: data.password.trim(),
            data: {
              username: data.username.trim(),
              ui_language_id: data.selectedLanguageId,
              ui_language:
                selectedLanguage.english_name?.toLowerCase() || 'english',
              terms_accepted: true,
              terms_version: '1.0'
            }
          },
          {
            emailRedirectTo: `${process.env.EXPO_PUBLIC_SITE_URL}/registration-confirmation`
          }
        );

      if (authError) {
        throw authError;
      }

      console.log('User updated with terms acceptance in auth metadata');

      // Email confirmation is required
      Alert.alert(t('success'), t('checkEmail'), [
        { text: 'OK', onPress: () => router.replace('/') }
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
              <Text style={sharedStyles.appTitle}>LangQuest</Text>
              <Text style={sharedStyles.subtitle}>
                {t('newUserRegistration')}
              </Text>

              {/* Language section */}
              <View style={{ alignItems: 'center', gap: spacing.medium }}>
                <Controller
                  control={control}
                  name="selectedLanguageId"
                  rules={{ required: t('selectLanguage') }}
                  render={({ field: { onChange, value } }) => (
                    <LanguageSelect
                      value={value}
                      onChange={(lang) => {
                        onChange(lang.id);
                        setLanguage(lang);
                      }}
                      containerStyle={{ width: '100%' }}
                    />
                  )}
                />
                {errors.selectedLanguageId && (
                  <Text style={styles.errorText}>
                    {errors.selectedLanguageId.message}
                  </Text>
                )}
              </View>

              {/* User section */}
              <View
                style={{
                  alignItems: 'center',
                  gap: spacing.medium,
                  width: '100%'
                }}
              >
                <Ionicons name="person-outline" size={32} color={colors.text} />

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
                          placeholder={t('email')}
                          placeholderTextColor={colors.text}
                          value={value}
                          onChangeText={onChange}
                          autoCapitalize="none"
                          keyboardType="email-address"
                        />
                      </View>
                    )}
                  />
                  {errors.email && (
                    <Text style={styles.errorText}>{errors.email.message}</Text>
                  )}
                </View>

                <View style={{ gap: spacing.small }}>
                  <Controller
                    control={control}
                    name="password"
                    rules={{
                      required: t('password'),
                      minLength: {
                        value: 6,
                        message: t('password')
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
                          value={value}
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
              </View>

              {/* Terms & Privacy section */}
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
                <TouchableOpacity
                  onPress={() => router.replace('/terms' as Href<string>)}
                >
                  <Text
                    style={{
                      color: colors.primary,
                      textDecorationLine: 'underline',
                      fontSize: 14
                    }}
                  >
                    {t('viewTerms')}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Register button */}
              <TouchableOpacity
                style={[sharedStyles.button, { width: '100%' }]}
                onPress={handleSubmit(onSubmit)}
              >
                <Text style={sharedStyles.buttonText}>{t('register')}</Text>
              </TouchableOpacity>

              {/* Sign in link */}
              <TouchableOpacity
                style={{
                  alignSelf: 'center',
                  marginTop: spacing.medium,
                  paddingVertical: spacing.small,
                  paddingHorizontal: spacing.medium,
                  borderWidth: 1,
                  borderColor: colors.primary,
                  borderRadius: 8,
                  backgroundColor: 'transparent'
                }}
                onPress={() => router.replace('/sign-in' as Href<string>)}
              >
                <Text style={[sharedStyles.link, { textAlign: 'center' }]}>
                  {t('returningHero')}
                </Text>
              </TouchableOpacity>
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
    backgroundColor: colors.text
  }
});
