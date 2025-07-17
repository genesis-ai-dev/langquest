import { useAuth } from '@/contexts/AuthContext';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

export default function ForgotPasswordView2({
  onNavigate
}: {
  onNavigate: (view: 'sign-in') => void;
}) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { resetPassword } = useAuth();

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await resetPassword(email.toLowerCase().trim());

      if (error) throw error;

      Alert.alert('Success', 'Check your email for a password reset link', [
        { text: 'OK', onPress: () => onNavigate('sign-in') }
      ]);

      // Reset form
      setEmail('');
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to send reset email'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: 'center' }}>
      <Text style={{ fontSize: 24, textAlign: 'center', marginBottom: 20 }}>
        Reset Password
      </Text>

      <Text style={{ textAlign: 'center', marginBottom: 20 }}>
        Enter your email and we'll send you a link to reset your password
      </Text>

      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={{
          borderWidth: 1,
          borderColor: '#ccc',
          padding: 10,
          marginBottom: 10,
          borderRadius: 5
        }}
      />

      <TouchableOpacity
        onPress={handleResetPassword}
        disabled={isLoading}
        style={{
          backgroundColor: '#007AFF',
          padding: 15,
          borderRadius: 5,
          marginBottom: 10
        }}
      >
        {isLoading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={{ color: 'white', textAlign: 'center' }}>
            Send Reset Email
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => onNavigate('sign-in')}>
        <Text style={{ color: '#007AFF', textAlign: 'center' }}>
          Back to Sign In
        </Text>
      </TouchableOpacity>
    </View>
  );
}
