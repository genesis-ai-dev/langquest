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
import { userService } from '@/database_services/userService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { system } from '@/db/powersync/system';
// import { seedDatabase } from '../db/seedDatabase';
import { CustomDropdown } from '@/components/CustomDropdown';
import { useAuth } from '@/contexts/AuthContext';
import { languageService } from '@/database_services/languageService';
import { language } from '@/db/drizzleSchema';
import { useTranslation } from '@/hooks/useTranslation';
import { colors, sharedStyles, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { LanguageSelect } from '@/components/LanguageSelect';
import { useForm, Controller } from 'react-hook-form';

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

export default function Index() {
  const [currentLanguage, setCurrentLanguage] = useState<Language | null>(null);
  const { t } = useTranslation(currentLanguage?.english_name);
  const router = useRouter();
  const { setCurrentUser, isAuthenticated } = useAuth();
  const [dbStatus, setDbStatus] = useState('Initializing...');
  const [isDbReady, setIsDbReady] = useState(false);

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

  useEffect(() => {
    let mounted = true;

    const initializeDatabase = async () => {
      if (system.isInitialized()) {
        console.log('System is already initialized');
        return;
      }

      try {
        console.log('signing in anonymously');
        const { data, error: signInError } =
          await supabaseConnector.client.auth.signInAnonymously();

        if (signInError || !mounted) {
          console.error('Error signing in anonymously:', signInError);
          return;
        }

        const { data: sessionData } =
          await supabaseConnector.client.auth.getSession();

        if (!mounted) return;

        if (sessionData.session) {
          await system.init();
          if (mounted) {
            router.replace('/projects');
          }
        }
      } catch (error) {
        console.error('Session check error:', error);
        if (mounted) {
          router.replace('/register');
        }
      }
    };

    initializeDatabase();

    return () => {
      mounted = false;
    };
  }, []);

  const onSubmit = async (data: LoginFormData) => {
    try {
      const authenticatedUser = await userService.validateCredentials({
        email: data.email.toLowerCase().trim(),
        password: data.password.trim()
      });

      if (authenticatedUser) {
        await system.init(); // Initialize PowerSync after successful login
        reset();
        setCurrentUser(authenticatedUser);
        router.replace('/projects');
      } else {
        Alert.alert('Error', t('invalidAuth'));
      }
    } catch (error) {
      console.error('Error during sign in:', error);
      Alert.alert('Error', t('signInError'));
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
                  <Ionicons name="language" size={32} color={colors.text} />
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
                          <TextInput
                            style={{ flex: 1, color: colors.text }}
                            placeholder={t('password')}
                            placeholderTextColor={colors.text}
                            value={value}
                            onChangeText={onChange}
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
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={[sharedStyles.button, { marginTop: 'auto' }]}
                onPress={handleSubmit(onSubmit)}
              >
                <Text style={sharedStyles.buttonText}>{t('signIn')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ marginTop: spacing.medium }}
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
