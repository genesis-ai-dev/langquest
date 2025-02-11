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

const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

export type ResetPasswordParams = {
  access_token?: string;
  refresh_token?: string;
  type?: string;
};

export default function ResetPassword() {
  const { supabaseConnector } = useSystem();
  const [email, setEmail] = useState('');
  const router = useRouter();
  const params = useLocalSearchParams<ResetPasswordParams>();

  useEffect(() => {
    // Handle deep link parameters with proper type checking
    if (params.access_token && params.refresh_token) {
      console.log('Received tokens from deep link');
      // Now TypeScript knows these are strings
      console.log('Access token:', params.access_token);
      console.log('Refresh token:', params.refresh_token);
    }
  }, [params]);

  const onRequestReset = async () => {
    try {
      if (!EMAIL_REGEX.test(email)) {
        Alert.alert('Error', 'Please enter a valid email');
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
        'Success',
        'Check your email for the password reset link',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error requesting password reset:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to send reset email'
      );
    }
  };

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: 'center' }}>
      <Text style={{ fontSize: 24, marginBottom: 20 }}>Reset Password</Text>
      <TextInput
        style={{
          borderWidth: 1,
          borderColor: '#ccc',
          padding: 10,
          marginBottom: 20,
          borderRadius: 5
        }}
        placeholder="Enter your email"
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
        <Text style={{ color: 'white' }}>Send Reset Email</Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={{ marginTop: 20, alignItems: 'center' }}
        onPress={() => router.replace('/')}
      >
        <Text style={{ color: '#0066cc' }}>Back to Login</Text>
      </TouchableOpacity>
    </View>
  );
}