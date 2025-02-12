import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import React, { useState, useEffect } from 'react';
import {
  Alert,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSystem } from '@/db/powersync/system';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from '@/hooks/useTranslation';
import { languageService } from '@/database_services/languageService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { language } from '@/db/drizzleSchema';

const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

export type ResetPasswordParams = {
  access_token?: string;
  refresh_token?: string;
  type?: string;
};

export default function ResetPassword() {
  const { supabaseConnector } = useSystem();
  const [email, setEmail] = useState('');
  const [currentLanguage, setCurrentLanguage] = useState<typeof language.$inferSelect | null>(null);
  const { t } = useTranslation(currentLanguage?.english_name);
  const router = useRouter();
  const params = useLocalSearchParams<ResetPasswordParams>();

  // Load saved language
  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const savedLanguageId = await AsyncStorage.getItem('selectedLanguageId');
        if (savedLanguageId) {
          const languageData = await languageService.getLanguageById(savedLanguageId);
          if (languageData) {
            setCurrentLanguage(languageData);
          }
        }
      } catch (error) {
        console.error('Error loading language:', error);
      }
    };
    loadLanguage();
  }, []);

  useEffect(() => {
    // Handle deep link parameters with proper type checking
    if (params.access_token && params.refresh_token) {
      console.log('Received tokens from deep link');
      console.log('Access token:', params.access_token);
      console.log('Refresh token:', params.refresh_token);
    }
  }, [params]);

  const onRequestReset = async () => {
    try {
      if (!EMAIL_REGEX.test(email)) {
        Alert.alert(t('error'), t('enterValidEmail'));
        return;
      }

      const { error } = await supabaseConnector.client.auth.resetPasswordForEmail(
        email.toLowerCase().trim(),
        {
          redirectTo: `langquest://reset-password`
        }
      );

      if (error) throw error;

      Alert.alert(
        t('success'),
        t('checkEmailForResetLink'),
        [{ text: t('ok') }]
      );
    } catch (error) {
      console.error('Error requesting password reset:', error);
      Alert.alert(
        t('error'),
        error instanceof Error ? error.message : t('failedSendResetEmail')
      );
    }
  };

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: 'center' }}>
      <Text style={{ fontSize: 24, marginBottom: 20 }}>{t('resetPassword')}</Text>
      <TextInput
        style={{
          borderWidth: 1,
          borderColor: '#ccc',
          padding: 10,
          marginBottom: 20,
          borderRadius: 5
        }}
        placeholder={t('enterYourEmail')}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TouchableOpacity
        style={{
          backgroundColor: '#0066cc',
          padding: 15,
          borderRadius: 5,
          alignItems: 'center'
        }}
        onPress={onRequestReset}
      >
        <Text style={{ color: 'white' }}>{t('sendResetEmail')}</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={{ marginTop: 20, alignItems: 'center' }}
        onPress={() => router.replace('/')}
      >
        <Text style={{ color: '#0066cc' }}>{t('backToLogin')}</Text>
      </TouchableOpacity>
    </View>
  );
}