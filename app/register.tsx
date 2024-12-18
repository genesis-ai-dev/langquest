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
import { useAuth } from '@/contexts/AuthContext';
import { useSystem } from '@/db/powersync/system';

type Language = typeof language.$inferSelect;


// Repository instances
// const languageRepository = new LanguageRepository();
// const userRepository = new UserRepository();

export default function Register() {
  const router = useRouter();
  const { setCurrentUser } = useAuth();
  const [languages, setLanguages] = useState<Language[]>([]);
  const [selectedLanguageId, setSelectedLanguageId] = useState<string>('');
  // const [username, setUsername] = useState('');
  // const [password, setPassword] = useState('');
  
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showLanguages, setShowLanguages] = useState(false);
  const { supabaseConnector } = useSystem();
  const [credentials, setCredentials] = useState({ username: '', password: '' });

  // Clear passwords when component unmounts
  useEffect(() => {
    return () => {
      // setPassword('');
      setCredentials({ username: '', password: '' });
      setConfirmPassword('');
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadLanguages();
    }, [])
  );

  const loadLanguages = async () => {
    try {
      const loadedLanguages = await languageService.getUi_readyLanguages();
      setLanguages(loadedLanguages);
      // Set default language if available
      if (!selectedLanguageId && loadedLanguages.length > 0) {
        const englishLang = loadedLanguages.find(l => 
          l.english_name?.toLowerCase() === 'english' || 
          l.native_name?.toLowerCase() === 'english'
        );
        setSelectedLanguageId(englishLang?.id || loadedLanguages[0].id);
      }
    } catch (error) {
      console.error('Error loading languages:', error);
      Alert.alert('Error', 'Failed to load available languages');
    }
  };


  const handleRegister = async () => {
    if (credentials.password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
  
    if (!selectedLanguageId) {
      Alert.alert('Error', 'Please select a language');
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
      Alert.alert('Error', error instanceof Error ? error.message : 'Registration failed');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
      <ScrollView style={sharedStyles.container}>
        <View style={{ alignItems: 'center' }}>
          <Text style={sharedStyles.title}>LangQuest</Text>
          <Text style={sharedStyles.subtitle}>New User Registration</Text>
          
          <CustomDropdown
            label="App Language"
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
            fullWidth={true}
            containerStyle={{ marginBottom: spacing.medium }}
          />
          
          <View style={[sharedStyles.input, { flexDirection: 'row', alignItems: 'center' }]}>
            <Ionicons name="person-outline" size={20} color={colors.text} style={{ marginRight: spacing.medium }} />
            <TextInput
              style={{ flex: 1, color: colors.text }}
              placeholder="Username"
              placeholderTextColor={colors.text}
              value={credentials.username}
              onChangeText={(text) => setCredentials({ ...credentials, username: text.toLowerCase().trim() })}
            />
          </View>
          
          <View style={[sharedStyles.input, { flexDirection: 'row', alignItems: 'center' }]}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.text} style={{ marginRight: spacing.medium }} />
            <TextInput
              style={{ flex: 1, color: colors.text }}
              placeholder="Password"
              placeholderTextColor={colors.text}
              secureTextEntry
              value={credentials.password}
              onChangeText={(password) => setCredentials({ ...credentials, password })}
            />
          </View>
          
          <View style={[sharedStyles.input, { flexDirection: 'row', alignItems: 'center' }]}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.text} style={{ marginRight: spacing.medium }} />
            <TextInput
              style={{ flex: 1, color: colors.text }}
              placeholder="Confirm Password"
              placeholderTextColor={colors.text}
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
          </View>
          
          <View style={{ width: '100%', marginBottom: spacing.medium }}>
            <Text style={{ color: colors.text, marginBottom: spacing.small }}>Avatar:</Text>
            <TouchableOpacity style={[sharedStyles.button, { backgroundColor: colors.inputBackground }]}>
              <Ionicons name="camera-outline" size={24} color={colors.text} />
              <Text style={[sharedStyles.buttonText, { color: colors.text }]}>Select</Text>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity style={sharedStyles.button} onPress={handleRegister}>
            <Text style={sharedStyles.buttonText}>Become a Hero</Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => router.push("/")}>
            <Text style={sharedStyles.link}>Returning hero? Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}