import React, { useState } from 'react';
import { Text, View, TextInput, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontSizes, spacing, borderRadius, sharedStyles } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { CustomDropdown } from '@/components/CustomDropdown';
import { BreadcrumbBanner } from '@/components/BreadcrumbBanner';

export default function Register() {
  const router = useRouter();
  const [showLanguages, setShowLanguages] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('English');

  const languages = ['English', 'Spanish', 'French', 'German', 'Italian'];

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
          />
          
          <View style={[sharedStyles.input, { flexDirection: 'row', alignItems: 'center' }]}>
            <Ionicons name="person-outline" size={20} color={colors.text} style={{ marginRight: spacing.medium }} />
            <TextInput
              style={{ flex: 1, color: colors.text }}
              placeholder="Username"
              placeholderTextColor={colors.text}
            />
          </View>
          
          <View style={[sharedStyles.input, { flexDirection: 'row', alignItems: 'center' }]}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.text} style={{ marginRight: spacing.medium }} />
            <TextInput
              style={{ flex: 1, color: colors.text }}
              placeholder="Password"
              placeholderTextColor={colors.text}
              secureTextEntry
            />
          </View>
          
          <View style={[sharedStyles.input, { flexDirection: 'row', alignItems: 'center' }]}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.text} style={{ marginRight: spacing.medium }} />
            <TextInput
              style={{ flex: 1, color: colors.text }}
              placeholder="Confirm Password"
              placeholderTextColor={colors.text}
              secureTextEntry
            />
          </View>
          
          <View style={{ width: '100%', marginBottom: spacing.medium }}>
            <Text style={{ color: colors.text, marginBottom: spacing.small }}>Avatar:</Text>
            <TouchableOpacity style={[sharedStyles.button, { backgroundColor: colors.inputBackground }]}>
              <Ionicons name="camera-outline" size={24} color={colors.text} />
              <Text style={[sharedStyles.buttonText, { color: colors.text }]}>Select</Text>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity style={sharedStyles.button}>
            <Text style={sharedStyles.buttonText}>Become a Hero</Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => router.push("/")}>
            <Text style={sharedStyles.link}>Returning hero? Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      <BreadcrumbBanner language={selectedLanguage} />
    </SafeAreaView>
  );
}