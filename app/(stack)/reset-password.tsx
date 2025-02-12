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
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/contexts/AuthContext';

export default function ResetPassword() {
  const { supabaseConnector } = useSystem();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [canResetPassword, setCanResetPassword] = useState(false);
  const { t } = useTranslation(); // This will use currentUser's language preference
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
        Alert.alert(t('error'), t('passwordMinLength'));
        return;
      }

      if (newPassword !== confirmPassword) {
        Alert.alert(t('error'), t('passwordsNoMatch'));
        return;
      }

      const { error } = await supabaseConnector.client.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      Alert.alert(
        t('success'),
        t('passwordResetSuccess'),
        [
          {
            text: t('ok'),
            onPress: () => router.replace('/projects')
          }
        ]
      );
    } catch (error) {
      console.error('Error resetting password:', error);
      Alert.alert(
        t('error'),
        error instanceof Error ? error.message : t('failedResetPassword')
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
        <Text style={styles.title}>{t('invalidResetLink')}</Text>
        <TouchableOpacity
          style={[sharedStyles.button, styles.button]}
          onPress={() => router.replace('/')}
        >
          <Text style={sharedStyles.buttonText}>{t('backToLogin')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('resetPassword')}</Text>
      
      <TextInput
        style={styles.input}
        placeholder={t('newPassword')}
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry
        placeholderTextColor={colors.text}
      />
      
      <TextInput
        style={styles.input}
        placeholder={t('confirmNewPassword')}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        placeholderTextColor={colors.text}
      />
      
      <TouchableOpacity
        style={[sharedStyles.button, styles.button]}
        onPress={onResetPassword}
      >
        <Text style={sharedStyles.buttonText}>{t('resetPassword')}</Text>
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