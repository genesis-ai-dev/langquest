import React, { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { Text, View, TextInput, TouchableOpacity, ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSizes, spacing, borderRadius, sharedStyles } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { CustomDropdown } from '@/components/CustomDropdown';
import { BreadcrumbBanner } from '@/components/BreadcrumbBanner';
import { Language, getAllUiReadyLanguages, addUser } from '@/utils/databaseService';

export default function Register() {
  const router = useRouter();
  const [languages, setLanguages] = useState<Language[]>([]);
  const [selectedLanguageId, setSelectedLanguageId] = useState<string>('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showLanguages, setShowLanguages] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadLanguages();
    }, [])
  );

  const loadLanguages = async () => {
    try {
      const loadedLanguages = await getAllUiReadyLanguages();
      setLanguages(loadedLanguages);
      // Set default language if available
      if (!selectedLanguageId && loadedLanguages.length > 0) {
        const englishLang = loadedLanguages.find(l => l.englishName.toLowerCase() === 'english');
        setSelectedLanguageId(englishLang?.id || loadedLanguages[0].id);
      }
    } catch (error) {
      console.error('Error loading languages:', error);
      Alert.alert('Error', 'Failed to load available languages');
    }
  };


  const handleRegister = async () => {
    if (!selectedLanguageId) {
      Alert.alert('Error', 'Please select a language');
      return;
    }

    if (!username.trim()) {
      Alert.alert('Error', 'Username is required');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
  
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters long');
      return;
    }
  
    try {
      const userId = await addUser(username, password, selectedLanguageId);
      if (userId) {
        Alert.alert('Success', 'User registered successfully');
        router.push("/");
      }
    } catch (error) {
      console.error('Error registering user:', error);
      Alert.alert('Error', 'An unexpected error occurred while registering');
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
            value={languages.find(l => l.id === selectedLanguageId)?.nativeName || ''}
            options={languages.map(l => l.nativeName)}
            onSelect={(langName) => {
              const lang = languages.find(l => l.nativeName === langName);
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
              value={username}
              onChangeText={setUsername}
            />
          </View>
          
          <View style={[sharedStyles.input, { flexDirection: 'row', alignItems: 'center' }]}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.text} style={{ marginRight: spacing.medium }} />
            <TextInput
              style={{ flex: 1, color: colors.text }}
              placeholder="Password"
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