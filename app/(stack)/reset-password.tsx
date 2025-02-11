import { useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import {
  Alert,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
  ActivityIndicator
} from 'react-native';
import { useSystem } from '@/db/powersync/system';
import { colors, sharedStyles, spacing } from '@/styles/theme';

export default function ResetPassword() {
  const { supabaseConnector } = useSystem();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [canResetPassword, setCanResetPassword] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const subscription = supabaseConnector.client.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[Reset Password] Auth event:', event);
        if (event === 'PASSWORD_RECOVERY') {
          setCanResetPassword(true);
        }
      }
    );

    // Check current session
    supabaseConnector.client.auth.getSession().then(({ data: { session } }) => {
      console.log('[Reset Password] Current session:', session?.user);
      setCanResetPassword(!!session?.user);
      setIsLoading(false);
    });

    return () => {
      subscription.data.subscription.unsubscribe();
    };
  }, []);

  const onResetPassword = async () => {
    try {
      if (newPassword.length < 6) {
        Alert.alert('Error', 'Password must be at least 6 characters');
        return;
      }

      if (newPassword !== confirmPassword) {
        Alert.alert('Error', 'Passwords do not match');
        return;
      }

      const { error } = await supabaseConnector.client.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      Alert.alert(
        'Success',
        'Password has been reset successfully',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/projects')
          }
        ]
      );
    } catch (error) {
      console.error('Error resetting password:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to reset password'
      );
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!canResetPassword) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.title}>Invalid or expired reset link</Text>
        <TouchableOpacity
          style={[sharedStyles.button, styles.button]}
          onPress={() => router.replace('/')}
        >
          <Text style={sharedStyles.buttonText}>Back to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Reset Password</Text>
      
      <TextInput
        style={styles.input}
        placeholder="New Password"
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry
        placeholderTextColor={colors.text}
      />
      
      <TextInput
        style={styles.input}
        placeholder="Confirm New Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        placeholderTextColor={colors.text}
      />
      
      <TouchableOpacity
        style={[sharedStyles.button, styles.button]}
        onPress={onResetPassword}
      >
        <Text style={sharedStyles.buttonText}>Reset Password</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.large,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    marginBottom: spacing.large,
    color: colors.text,
    textAlign: 'center',
  },
  input: {
    ...sharedStyles.input,
    width: '100%',
    marginBottom: spacing.medium,
  },
  button: {
    width: '100%',
    marginTop: spacing.medium,
  }
}); 