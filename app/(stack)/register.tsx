import { CustomDropdown } from '@/components/CustomDropdown';
import { useAuth } from '@/contexts/AuthContext';
import { languageService } from '@/database_services/languageService';
import { userService } from '@/database_services/userService';
import { language } from '@/db/drizzleSchema';
import { useTranslation } from '@/hooks/useTranslation';
import { useSystem } from '@/db/powersync/system';
import { colors, sharedStyles, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LanguageSelect } from '@/components/LanguageSelect';
import { useForm, Controller } from 'react-hook-form';

type Language = typeof language.$inferSelect;

type RegisterFormData = {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  selectedLanguageId: string;
};

const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

export default function Register() {
  const { t } = useTranslation();
  const router = useRouter();
  const { setCurrentUser } = useAuth();
  const { supabaseConnector } = useSystem();

  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors }
  } = useForm<RegisterFormData>({
    defaultValues: {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      selectedLanguageId: ''
    }
  });

  // Clear form when component unmounts
  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  const onSubmit = async (data: RegisterFormData) => {
    try {
      const userData = {
        credentials: {
          username: data.username,
          email: data.email,
          password: data.password
        },
        ui_language_id: data.selectedLanguageId
      };

      const newUser = await userService.createNew(userData);
      reset();
      setCurrentUser(newUser); // Set the newly created user as current user
      router.replace('/projects');
    } catch (error) {
      console.error('Error registering user:', error);
      Alert.alert(
        'Error',
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
                { backgroundColor: 'transparent' }
              ]}
            >
              <Text style={sharedStyles.appTitle}>LangQuest</Text>
              <Text style={sharedStyles.subtitle}>
                {t('newUserRegistration')}
              </Text>

              {/* Language section */}
              <View
                style={{ alignItems: 'center', marginBottom: spacing.medium }}
              >
                <Ionicons
                  name="language"
                  size={32}
                  color={colors.text}
                  style={{ marginBottom: spacing.small }}
                />
                <Controller
                  control={control}
                  name="selectedLanguageId"
                  rules={{ required: t('selectLanguage') }}
                  render={({ field: { onChange, value } }) => (
                    <LanguageSelect
                      value={value}
                      onChange={onChange}
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
                  marginBottom: spacing.medium,
                  width: '100%'
                }}
              >
                <Ionicons
                  name="person-outline"
                  size={32}
                  color={colors.text}
                  style={{ marginBottom: spacing.small }}
                />

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
                          width: '100%'
                        }
                      ]}
                    >
                      <Ionicons
                        name="person-outline"
                        size={20}
                        color={colors.text}
                        style={{ marginRight: spacing.medium }}
                      />
                      <TextInput
                        style={{ flex: 1, color: colors.text }}
                        placeholder={t('username')}
                        placeholderTextColor={colors.text}
                        value={value}
                        onChangeText={(text) => onChange(text.trim())}
                      />
                    </View>
                  )}
                />
                {errors.username && (
                  <Text style={styles.errorText}>
                    {errors.username.message}
                  </Text>
                )}

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
                          width: '100%'
                        }
                      ]}
                    >
                      <Ionicons
                        name="mail-outline"
                        size={20}
                        color={colors.text}
                        style={{ marginRight: spacing.medium }}
                      />
                      <TextInput
                        style={{ flex: 1, color: colors.text }}
                        placeholder={t('email')}
                        placeholderTextColor={colors.text}
                        value={value}
                        onChangeText={(text) => onChange(text.trim())}
                        autoCapitalize="none"
                        keyboardType="email-address"
                      />
                    </View>
                  )}
                />
                {errors.email && (
                  <Text style={styles.errorText}>{errors.email.message}</Text>
                )}

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
                          width: '100%'
                        }
                      ]}
                    >
                      <Ionicons
                        name="lock-closed-outline"
                        size={20}
                        color={colors.text}
                        style={{ marginRight: spacing.medium }}
                      />
                      <TextInput
                        style={{ flex: 1, color: colors.text }}
                        placeholder={t('password')}
                        placeholderTextColor={colors.text}
                        value={value}
                        onChangeText={(text) => onChange(text.trim())}
                        secureTextEntry
                      />
                    </View>
                  )}
                />
                {errors.password && (
                  <Text style={styles.errorText}>
                    {errors.password.message}
                  </Text>
                )}

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
                          width: '100%'
                        }
                      ]}
                    >
                      <Ionicons
                        name="lock-closed-outline"
                        size={20}
                        color={colors.text}
                        style={{ marginRight: spacing.medium }}
                      />
                      <TextInput
                        style={{ flex: 1, color: colors.text }}
                        placeholder={t('confirmPassword')}
                        placeholderTextColor={colors.text}
                        value={value}
                        onChangeText={(text) => onChange(text.trim())}
                        secureTextEntry
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

              <TouchableOpacity
                style={[sharedStyles.button, { marginTop: 'auto' }]}
                onPress={handleSubmit(onSubmit)}
              >
                <Text style={sharedStyles.buttonText}>{t('register')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ marginTop: spacing.medium }}
                onPress={() => router.replace('/')}
              >
                <Text style={sharedStyles.link}>{t('returningHero')}</Text>
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
    marginTop: 4,
    marginBottom: spacing.small,
    alignSelf: 'flex-start',
    paddingLeft: spacing.medium
  }
});
