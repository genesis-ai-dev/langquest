import React, { useState, useEffect } from 'react';
import { Text, View, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView  } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSizes, spacing, sharedStyles } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
// import { userRepository } from '@/database_services/repositories';
// import { initDatabase } from '@/database_services/dbInit';

import * as SQLite from 'expo-sqlite';
// import { userd, languaged } from '../db/drizzleSchema';
import * as schema from '../db/drizzleSchema';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '../drizzle/migrations';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { system } from '../db/powersync/system';
import { userService } from '@/database_services/userService';
import { handleMigrations } from '@/db/migrationHandler';
import AsyncStorage from '@react-native-async-storage/async-storage';
// import { seedDatabase } from '../db/seedDatabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/hooks/useTranslation';
import { languageService } from '@/database_services/languageService';
import { language } from '@/db/drizzleSchema';
import { CustomDropdown } from '@/components/CustomDropdown';

// const { profile, language } = schema;
const { supabaseConnector } = system;

// const userRepository = new UserRepository();
type Language = typeof language.$inferSelect;

export default function Index() {
  const [languages, setLanguages] = useState<Language[]>([]);
  const [selectedLanguageId, setSelectedLanguageId] = useState<string>('');
  const [showLanguages, setShowLanguages] = useState(false);
  const selectedLanguage = languages.find(l => l.id === selectedLanguageId);
  const { t } = useTranslation(selectedLanguage?.english_name?.toLowerCase());

  const router = useRouter();
  const { setCurrentUser } = useAuth();
  const [dbStatus, setDbStatus] = useState('Initializing...');
  // const [username, setUsername] = useState('');
  // const [password, setPassword] = useState('');
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [isDbReady, setIsDbReady] = useState(false);

  // Clear passwords when component unmounts
  useEffect(() => {
    return () => {
      // setPassword('');
      setCredentials({ username: '', password: '' });
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    
    const initializeDatabase = async () => {
      if (system.isInitialized()) {
        console.log('System is already initialized');
        return;
      }
  
      try {
        const { data, error: signInError } = await supabaseConnector.client.auth.signInAnonymously();
  
        if (signInError || !mounted) {
          console.error('Error signing in anonymously:', signInError);
          return;
        }
  
        const { data: sessionData } = await supabaseConnector.client.auth.getSession();
        
        if (!mounted) return;
        
        // if (sessionData.session) {
        //   await system.init();
        //   if (mounted) {
        //     router.push("/projects");
        //   }
        // }
      } catch (error) {
        console.error('Session check error:', error);
        if (mounted) {
          router.replace("/register");
        }
      }
    };
  
    initializeDatabase();
  
    return () => {
      mounted = false;
    };
  }, []);

  // Load saved language on mount
  useEffect(() => {
    const loadLanguages = async () => {
      try {
        const loadedLanguages = await languageService.getUiReadyLanguages();
        setLanguages(loadedLanguages);
        
        // Get saved language ID
        const savedLanguageId = await AsyncStorage.getItem('selectedLanguageId');
        if (savedLanguageId && loadedLanguages.some(l => l.id === savedLanguageId)) {
          setSelectedLanguageId(savedLanguageId);
        } else if (loadedLanguages.length > 0) {
          const englishLang = loadedLanguages.find(l => 
            l.english_name?.toLowerCase() === 'english' || 
            l.native_name?.toLowerCase() === 'english'
          );
          setSelectedLanguageId(englishLang?.id || loadedLanguages[0].id);
        }
      } catch (error) {
        console.error('Error loading languages:', error);
        Alert.alert('Error', t('failedLoadLanguages'));
      }
    };
     loadLanguages();
  }, []); 

  // Save language when it changes
  useEffect(() => {
    const saveLanguage = async () => {
      try {
        if (selectedLanguageId) {
          await AsyncStorage.setItem('selectedLanguageId', selectedLanguageId);
        }
      } catch (error) {
        console.error('Error saving language:', error);
      }
    };
    saveLanguage();
  }, [selectedLanguageId]);

  const handleSignIn = async () => {
    try {
      const authenticatedUser = await userService.validateCredentials(credentials);
      if (authenticatedUser) {
        await system.init(); // Initialize PowerSync after successful login
        setCredentials({ username: '', password: '' });
        setCurrentUser(authenticatedUser);
        router.push("/projects");
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
        <View style={[sharedStyles.container, { backgroundColor: 'transparent' }]}>
        <Text>{dbStatus}</Text>
          <View style={{ alignItems: 'center', width: '100%' }}>
            <Text style={sharedStyles.appTitle}>LangQuest</Text>
            <Text style={sharedStyles.subtitle}>{t('welcome')}</Text>
          </View>
          
          {/* Language section */}
          <View style={{ alignItems: 'center', marginBottom: spacing.medium }}>
            <Ionicons 
              name="language" 
              size={32} 
              color={colors.text} 
              style={{ marginBottom: spacing.small }}
            />
            <CustomDropdown
              value={languages.find(l => l.id === selectedLanguageId)?.native_name || ''}
              options={languages.map(l => l.native_name).filter((name): name is string => name !== null)}
              onSelect={(langName) => {
                const lang = languages.find(l => l.native_name === langName);
                if (lang) {
                  setSelectedLanguageId(lang.id);
                }
              }}
              isOpen={showLanguages}
              onToggle={() => setShowLanguages(!showLanguages)}
              search={true}
              searchPlaceholder={t('search')}
              fullWidth={true}
              containerStyle={{ marginBottom: spacing.medium }}
            />
          </View>

          {/* User section */}
          <View style={{ alignItems: 'center', marginBottom: spacing.medium }}>
            <Ionicons 
              name="person-outline" 
              size={32} 
              color={colors.text} 
              style={{ marginBottom: spacing.small }}
            />
          
            <View style={[sharedStyles.input, { flexDirection: 'row', alignItems: 'center' }]}>
              <Ionicons name="person-outline" size={20} color={colors.text} style={{ marginRight: spacing.medium }} />
              <TextInput
                style={{ flex: 1, color: colors.text }}
                placeholder={t('username')}
                placeholderTextColor={colors.text}
                value={credentials.username}
                onChangeText={(text) => setCredentials(prev => ({ ...prev, username: text }))}
              />
            </View>
            
            <View style={[sharedStyles.input, { flexDirection: 'row', alignItems: 'center' }]}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.text} style={{ marginRight: spacing.medium }} />
              <TextInput
                style={{ flex: 1, color: colors.text }}
                placeholder={t('password')}
                placeholderTextColor={colors.text}
                secureTextEntry
                value={credentials.password}
                onChangeText={(text) => setCredentials(prev => ({ ...prev, password: text }))}
              />
            </View>
          </View>
          
          <TouchableOpacity>
            <Text style={[sharedStyles.link, { marginBottom: spacing.medium }]}>{t('forgotPassword')}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={sharedStyles.button} onPress={handleSignIn}>
            <Text style={sharedStyles.buttonText}>{t('signIn')}</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
            <Text style={{ color: colors.text, marginRight: spacing.small }}>{t('newUser')}</Text>
            <TouchableOpacity onPress={() => router.push("/register")}>
              <Text style={sharedStyles.link}>{t('register')}</Text>
            </TouchableOpacity>
          </View>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
  }