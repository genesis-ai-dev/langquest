import React, { useState, useCallback, useEffect } from 'react';
import { useFocusEffect } from 'expo-router';
import { Text, View, TextInput, TouchableOpacity, ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSizes, spacing, borderRadius, sharedStyles } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { CustomDropdown } from '@/components/CustomDropdown';
import { BreadcrumbBanner } from '@/components/BreadcrumbBanner';
import { userService } from '@/database_services/userService';
import { languageService } from '@/database_services/languageService';
import { language } from '@/db/drizzleSchema';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Language = typeof language.$inferSelect;


// Repository instances
// const languageRepository = new LanguageRepository();
// const userRepository = new UserRepository();

export default function Register() {
  const [languages, setLanguages] = useState<Language[]>([]);
  const [selectedLanguageId, setSelectedLanguageId] = useState<string>('');
  const selectedLanguage = languages.find(l => l.id === selectedLanguageId);
  const { t } = useTranslation(selectedLanguage?.englishName?.toLowerCase());
  const router = useRouter();
  const { setCurrentUser } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showLanguages, setShowLanguages] = useState(false);

  // Clear passwords when component unmounts
  useEffect(() => {
    return () => {
      setPassword('');
      setConfirmPassword('');
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadLanguages();
    }, [])
  );

  // Load saved language on mount
  useEffect(() => {
    const loadSavedLanguage = async () => {
      try {
        const savedLanguageId = await AsyncStorage.getItem('selectedLanguageId');
        if (savedLanguageId) {
          setSelectedLanguageId(savedLanguageId);
        }
      } catch (error) {
        console.error('Error loading saved language:', error);
      }
    };
    loadSavedLanguage();
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

  const loadLanguages = async () => {
    try {
      const loadedLanguages = await languageService.getUiReadyLanguages();
      setLanguages(loadedLanguages);
      // Set default language if available
      if (!selectedLanguageId && loadedLanguages.length > 0) {
        const englishLang = loadedLanguages.find(l => 
          l.englishName?.toLowerCase() === 'english' || 
          l.nativeName?.toLowerCase() === 'english'
        );
        setSelectedLanguageId(englishLang?.id || loadedLanguages[0].id);
      }
    } catch (error) {
      console.error('Error loading languages:', error);
      Alert.alert('Error', t('failedLoadLanguages'));
    }
  };


  const handleRegister = async () => {
    if (password !== confirmPassword) {
      Alert.alert('Error', t('passwordsNoMatch'));
      return;
    }
  
    if (!selectedLanguageId) {
      Alert.alert('Error', t('selectLanguage'));
      return;
    }
  
    try {
      const userData = {
        username: username.trim(),
        password,
        uiLanguageId: selectedLanguageId
      };
      
      const newUser = await userService.createNew(userData);
      const authenticatedUser = await userService.validateCredentials(username, password);
      if (newUser) {
        setPassword('');
        setConfirmPassword('');
        setCurrentUser(authenticatedUser); // Set the newly created user as current user
        Alert.alert('Success', t('registrationSuccess'), [
          { text: t('ok'), onPress: () => router.push("/projects") } // Go directly to projects
        ]);
      }
    } catch (error) {
      console.error('Error registering user:', error);
      Alert.alert('Error', error instanceof Error ? error.message : t('registrationFail'));
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
      <ScrollView style={sharedStyles.container}>
        <View style={{ alignItems: 'center' }}>
          <Text style={sharedStyles.title}>LangQuest</Text>
          <Text style={sharedStyles.subtitle}>{t('neewUserRegistration')}</Text>
          
          <CustomDropdown
            value={languages.find(l => l.id === selectedLanguageId)?.nativeName || ''}
            options={languages.map(l => l.nativeName).filter((name): name is string => name !== null)}
            onSelect={(langName) => {
              const lang = languages.find(l => l.nativeName === langName);
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
          
          <View style={[sharedStyles.input, { flexDirection: 'row', alignItems: 'center' }]}>
            <Ionicons name="person-outline" size={20} color={colors.text} style={{ marginRight: spacing.medium }} />
            <TextInput
              style={{ flex: 1, color: colors.text }}
              placeholder={t('username')}
              placeholderTextColor={colors.text}
              value={username}
              onChangeText={setUsername}
            />
          </View>
          
          <View style={[sharedStyles.input, { flexDirection: 'row', alignItems: 'center' }]}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.text} style={{ marginRight: spacing.medium }} />
            <TextInput
              style={{ flex: 1, color: colors.text }}
              placeholder={t('password')}
              placeholderTextColor={colors.text}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>
          
          <View style={[sharedStyles.input, { flexDirection: 'row', alignItems: 'center' }]}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.text} style={{ marginRight: spacing.medium }} />
            <TextInput
              style={{ flex: 1, color: colors.text }}
              placeholder={t('confirmPassword')}
              placeholderTextColor={colors.text}
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
          </View>
          
          <View style={{ width: '100%', marginBottom: spacing.medium }}>
            <Text style={{ color: colors.text, marginBottom: spacing.small }}>{t('avatar')}:</Text>
            <TouchableOpacity style={[sharedStyles.button, { backgroundColor: colors.inputBackground }]}>
              <Ionicons name="camera-outline" size={24} color={colors.text} />
              <Text style={[sharedStyles.buttonText, { color: colors.text }]}>{t('select')}</Text>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity style={sharedStyles.button} onPress={handleRegister}>
            <Text style={sharedStyles.buttonText}>{t('becomeHero')}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => router.push("/")}>
            <Text style={sharedStyles.link}>{t('returningHero')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}