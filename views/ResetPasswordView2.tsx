import { useAuth } from '@/contexts/AuthContext';
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

export default function ResetPasswordView2() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signOut } = useAuth();

  const handleUpdatePassword = async () => {
    // Basic validation
    if (!newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await system.supabaseConnector.client.auth.updateUser({
        password: newPassword.trim()
      });

      if (error) throw error;

      Alert.alert('Success', 'Your password has been updated successfully', [
        {
          text: 'OK',
          onPress: () => {
            // Sign out and let auth context handle navigation to sign in
            void signOut();
          }
        }
      ]);

      // Reset form
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to update password'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: 'center' }}>
      <Text style={{ fontSize: 24, textAlign: 'center', marginBottom: 20 }}>
        Create New Password
      </Text>

      <TextInput
        placeholder="New Password"
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry
        style={{
          borderWidth: 1,
          borderColor: '#ccc',
          padding: 10,
          marginBottom: 10,
          borderRadius: 5
        }}
      />

      <TextInput
        placeholder="Confirm New Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
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
        onPress={handleUpdatePassword}
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
            Update Password
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
