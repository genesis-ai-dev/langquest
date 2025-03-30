import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
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
// import { userRepository } from '@/database_services/repositories';
// import { initDatabase } from '@/database_services/dbInit';

// import { userd, languaged } from '../db/drizzleSchema';
import { profileService } from '@/database_services/profileService';
import { system } from '@/db/powersync/system';
// import { seedDatabase } from '../db/seedDatabase';
import { LanguageSelect } from '@/components/LanguageSelect';
import { useAuth } from '@/contexts/AuthContext';
import { language } from '@/db/drizzleSchema';
import { useTranslation } from '@/hooks/useTranslation';
import { colors, sharedStyles, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { Session } from '@supabase/supabase-js';
import { LinearGradient } from 'expo-linear-gradient';
import { Controller, useForm } from 'react-hook-form';
import { PasswordInput } from '@/components/PasswordInput';

// const { profile, language } = schema;
const { supabaseConnector } = system;

// const userRepository = new UserRepository();
type Language = typeof language.$inferSelect;

type LoginFormData = {
  email: string;
  password: string;
  selectedLanguageId: string;
};

const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

export default function SignIn() {
  const [currentLanguage, setCurrentLanguage] = useState<Language | null>(null);
  const { t } = useTranslation(currentLanguage?.english_name);
  const router = useRouter();
  const { setCurrentUser, isAuthenticated } = useAuth();
  const [dbStatus, setDbStatus] = useState('Initializing...');
  // const [username, setUsername] = useState('');
  // const [password, setPassword] = useState('');

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<LoginFormData>({
    defaultValues: {
      email: '',
      password: '',
      selectedLanguageId: ''
    }
  });

  // Clear form when component unmounts
  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  // useEffect(() => {
  //   let mounted = true;

  //   const initializeDatabase = async () => {
  //     if (system.isInitialized()) {
  //       console.log('System is already initialized');
  //       return;
  //     }

  //     try {
  //       const { data: sessionData } =
  //         await supabaseConnector.client.auth.getSession();

  //       if (!sessionData.session) {
  //         console.log('No session - signing in anonymously');
  //         const { data, error: signInError } =
  //           await supabaseConnector.client.auth.signInAnonymously();
  //         if (signInError) {
  //           console.error('Error signing in anonymously:', signInError);
  //           return;
  //         }
  //       } else {
  //         const isAnonymous = await supabaseConnector.isAnonymousSession();
  //         if (!isAnonymous && mounted) {
  //           await system.init();
  //           router.replace('/projects');
  //           return;
  //         }
  //       }

  //       await system.init();
  //     } catch (error) {
  //       console.error('Session check error:', error);
  //       if (mounted) {
  //         router.replace('/register');
  //       }
  //     }
  //   };

  //   initializeDatabase();

  //   return () => {
  //     mounted = false;
  //   };
  // }, []);

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
      if (!signInData.user?.email_confirmed_at) {
        Alert.alert('Verification Required', t('accountNotVerified'), [
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
              {dbStatus && <Text>{dbStatus}</Text>}
              <View style={{ alignItems: 'center', width: '100%' }}>
                <Text style={sharedStyles.appTitle}>LangQuest</Text>
                <Text style={sharedStyles.subtitle}>{t('welcome')}</Text>
              </View>

              {/* Language section */}
              <View style={{ gap: spacing.medium, width: '100%' }}>
                <View
                  style={{
                    alignItems: 'center',
                    width: '100%',
                    gap: spacing.medium
                  }}
                >
                  <Controller
                    control={control}
                    name="selectedLanguageId"
                    render={({ field: { onChange, value } }) => (
                      <LanguageSelect
                        value={value}
                        onChange={(lang) => {
                          onChange(lang.id);
                          setCurrentLanguage(lang);
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
                        <Text style={styles.errorText}>
                          {errors.email.message}
                        </Text>
                      )}
                    </View>

                    <Controller
                      control={control}
                      name="password"
                      rules={{
                        required: t('passwordRequired')
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
                </View>
              </View>

              <TouchableOpacity
                style={{ marginTop: spacing.medium, alignSelf: 'center' }}
                onPress={() => router.push('/requestResetPassword')}
              >
                <Text style={sharedStyles.link}>{t('forgotPassword')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[sharedStyles.button, { marginTop: 'auto' }]}
                onPress={handleSubmit(onSubmit)}
              >
                <Text style={sharedStyles.buttonText}>{t('signIn')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ marginTop: spacing.medium, alignSelf: 'center' }}
                onPress={() => router.push('/register')}
              >
                <Text style={sharedStyles.link}>{t('newUser')}</Text>
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
    color: colors.error || '#ff0000'
    // fontSize: 12
    // alignSelf: 'flex-start'
  }
});
