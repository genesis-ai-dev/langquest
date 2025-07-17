import { system } from '@/db/powersync/system';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

export default function SignInView2({
  onNavigate
}: {
  onNavigate: (view: 'register' | 'forgot-password') => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setIsLoading(true);
    try {
      const { error } =
        await system.supabaseConnector.client.auth.signInWithPassword({
          email: email.toLowerCase().trim(),
          password: password.trim()
        });

      if (error) throw error;

      // Success - auth context will handle navigation
      setEmail('');
      setPassword('');
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Sign in failed'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: 'center' }}>
      <Text style={{ fontSize: 24, textAlign: 'center', marginBottom: 20 }}>
        Sign In
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

      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={{
          borderWidth: 1,
          borderColor: '#ccc',
          padding: 10,
          marginBottom: 10,
          borderRadius: 5
        }}
      />

      <TouchableOpacity
        onPress={handleSignIn}
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
          <Text style={{ color: 'white', textAlign: 'center' }}>Sign In</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => onNavigate('forgot-password')}>
        <Text
          style={{ color: '#007AFF', textAlign: 'center', marginBottom: 10 }}
        >
          Forgot Password?
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => onNavigate('register')}>
        <Text style={{ color: '#007AFF', textAlign: 'center' }}>
          New User? Register
        </Text>
      </TouchableOpacity>
    </View>
  );
}
