import React, { useState, useCallback, useEffect } from 'react';
import { useFocusEffect } from 'expo-router';
import { Text, View, TextInput, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSizes, spacing, borderRadius, sharedStyles } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { CustomDropdown } from '@/components/CustomDropdown';
import { BreadcrumbBanner } from '@/components/BreadcrumbBanner';
import { userService } from '@/database_services/userService';
import { languageService } from '@/database_services/languageService';
import { language } from '@/db/drizzleSchema';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/contexts/AuthContext';
import { useSystem } from '@/db/powersync/system';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Language = typeof language.$inferSelect;

export default function Register() {
  const [languages, setLanguages] = useState<Language[]>([]);
  const [selectedLanguageId, setSelectedLanguageId] = useState<string>('');
  const selectedLanguage = languages.find(l => l.id === selectedLanguageId);
  const { t } = useTranslation(selectedLanguage?.english_name?.toLowerCase());
  const router = useRouter();
  const { setCurrentUser } = useAuth();
  // const [username, setUsername] = useState('');
  // const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [showLanguages, setShowLanguages] = useState(false);
  const { supabaseConnector } = useSystem();

  // Clear passwords when component unmounts
  useEffect(() => {
    return () => {
      // setPassword('');
      setCredentials({ username: '', password: '' });
      setConfirmPassword('');
    };
  }, []);

  // Load saved language on mount
  useEffect(() => {
    const initializeLanguages = async () => {
      try {
        // Load languages first
        const loadedLanguages = await languageService.getUiReadyLanguages();
        setLanguages(loadedLanguages);
         // Then get saved language ID
        const savedLanguageId = await AsyncStorage.getItem('selectedLanguageId');
        
        if (savedLanguageId && loadedLanguages.some(l => l.id === savedLanguageId)) {
          setSelectedLanguageId(savedLanguageId);
        } else if (loadedLanguages.length > 0) {
          // Fallback to English or first language
          const englishLang = loadedLanguages.find(l => 
            l.english_name?.toLowerCase() === 'english' || 
            l.native_name?.toLowerCase() === 'english'
          );
          setSelectedLanguageId(englishLang?.id || loadedLanguages[0].id);
        }
      } catch (error) {
        console.error('Error initializing languages:', error);
        Alert.alert('Error', t('failedLoadLanguages'));
      }
    };
     initializeLanguages();
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

  const handleRegister = async () => {
    if (credentials.password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
  
    if (!selectedLanguageId) {
      Alert.alert('Error', t('selectLanguage'));
      return;
    }
  
    try {
      const userData = {
        credentials,
        ui_language_id: selectedLanguageId
      };
      
      const newUser = await userService.createNew(userData);
      setCredentials({ username: '', password: '' });
      setConfirmPassword('');
      setCurrentUser(newUser); // Set the newly created user as current user
      router.push("/projects");
    } catch (error) {
      console.error('Error registering user:', error);
      Alert.alert('Error', error instanceof Error ? error.message : t('registrationFail'));
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
              <View style={{ alignItems: 'center', width: '100%' }}>
                <Text style={sharedStyles.appTitle}>LangQuest</Text>
                <Text style={sharedStyles.subtitle}>{t('newUserRegistration')}</Text>
              </View>
              
              {/* Language section */}
              <View style={{ alignItems: 'center', marginBottom: spacing.medium, width: '100%' }}>
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
              <View style={{ alignItems: 'center', marginBottom: spacing.medium, width: '100%' }}>
                <Ionicons 
                  name="person-outline" 
                  size={32} 
                  color={colors.text} 
                  style={{ marginBottom: spacing.small }}
                />
                <View style={[sharedStyles.input, { flexDirection: 'row', alignItems: 'center', width: '100%' }]}>
                  <Ionicons name="person-outline" size={20} color={colors.text} style={{ marginRight: spacing.medium }} />
                  <TextInput
                    style={{ flex: 1, color: colors.text }}
                    placeholder={t('email')}
                    placeholderTextColor={colors.text}
                    value={credentials.username}
                    onChangeText={(text) => setCredentials(prev => ({ ...prev, username: text.toLowerCase().trim() }))}
                  />
                </View>
                
                <View style={[sharedStyles.input, { flexDirection: 'row', alignItems: 'center', width: '100%' }]}>
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
                
                <View style={[sharedStyles.input, { flexDirection: 'row', alignItems: 'center', width: '100%' }]}>
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
              </View>
              
              {/* Avatar section */}
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
              
              <View style={{ alignItems: 'center', width: '100%' }}>
                <TouchableOpacity onPress={() => router.push("/")}>
                  <Text style={sharedStyles.link}>{t('returningHero')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}