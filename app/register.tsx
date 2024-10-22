import React, { useState } from 'react';
import { Text, View, TextInput, TouchableOpacity, ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSizes, spacing, borderRadius, sharedStyles } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { CustomDropdown } from '@/components/CustomDropdown';
import { BreadcrumbBanner } from '@/components/BreadcrumbBanner';
import { addUser, getAllUsers } from '@/utils/databaseService';

export default function Register() {
  const router = useRouter();
  const [showLanguages, setShowLanguages] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const languages = ['English', 'Spanish'];

  const handleRegister = async () => {
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
  
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters long');
      return;
    }
  
    try {
      const userId = await addUser(username, password, selectedLanguage);
      if (userId) {
        Alert.alert('Success', 'User registered successfully');
        
        // Log all registered users
        const allUsers = await getAllUsers();
        console.log('All registered users:');
        allUsers.forEach(user => {
          console.log(`Username: ${user.username}, Password: ${user.password}`);
        });
        
        router.push("/");
      } else {
        Alert.alert('Error', 'Username already exists. Please choose a different username.');
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
            value={selectedLanguage}
            options={languages}
            onSelect={setSelectedLanguage}
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