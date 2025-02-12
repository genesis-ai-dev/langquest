import { useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import {
  Alert,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSystem } from '@/db/powersync/system';
import { colors, sharedStyles, spacing } from '@/styles/theme';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/contexts/AuthContext';
import { useForm, Controller } from 'react-hook-form';

type ResetPasswordFormData = {
  newPassword: string;
  confirmPassword: string;
};

export default function ResetPassword() {
  const { supabaseConnector } = useSystem();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [canResetPassword, setCanResetPassword] = useState(false);
  const { t } = useTranslation(); // This will use currentUser's language preference
  const router = useRouter();

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm<ResetPasswordFormData>({
    defaultValues: {
      newPassword: '',
      confirmPassword: ''
    }
  });

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

  const onSubmit = async (data: ResetPasswordFormData) => {
    try {
      if (data.newPassword.length < 6) {
        Alert.alert(t('error'), t('passwordMinLength'));
        return;
      }

      if (data.newPassword !== data.confirmPassword) {
        Alert.alert(t('error'), t('passwordsNoMatch'));
        return;
      }

      const { error } = await supabaseConnector.client.auth.updateUser({
        password: data.newPassword
      });

      if (error) throw error;

      Alert.alert(t('success'), t('passwordResetSuccess'), [
        {
          text: t('ok'),
          onPress: () => router.replace('/projects')
        }
      ]);
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
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={{ flex: 1 }}
      >
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
          <View style={[styles.container, styles.centered]}>
            <Text style={sharedStyles.subtitle}>{t('invalidResetLink')}</Text>
            <TouchableOpacity
              style={[sharedStyles.button, styles.button]}
              onPress={() => router.replace('/')}
            >
              <Text style={sharedStyles.buttonText}>{t('backToLogin')}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <View style={{ flex: 1, padding: spacing.large }}>
          <Text style={[sharedStyles.subtitle, { marginBottom: spacing.xlarge }]}>
            {t('resetPassword')}
          </Text>

          <View style={styles.centerSection}>
            <Controller
              control={control}
              name="newPassword"
              rules={{
                required: t('passwordRequired'),
                minLength: {
                  value: 6,
                  message: t('passwordMinLength')
                }
              }}
              render={({ field: { onChange, value } }) => (
                <View
                  style={[
                    sharedStyles.input,
                    {
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.medium
                    }
                  ]}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color={colors.text}
                  />
                  <TextInput
                    style={{ flex: 1, color: colors.text }}
                    placeholder={t('newPassword')}
                    placeholderTextColor={colors.text}
                    value={value}
                    onChangeText={onChange}
                    secureTextEntry
                  />
                </View>
              )}
            />
            {errors.newPassword && (
              <Text style={styles.errorText}>
                {errors.newPassword.message}
              </Text>
            )}

            <Controller
              control={control}
              name="confirmPassword"
              rules={{
                required: t('confirmPassword'),
                validate: (value) =>
                  value === watch('newPassword') || t('passwordsNoMatch')
              }}
              render={({ field: { onChange, value } }) => (
                <View
                  style={[
                    sharedStyles.input,
                    {
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.medium
                    }
                  ]}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color={colors.text}
                  />
                  <TextInput
                    style={{ flex: 1, color: colors.text }}
                    placeholder={t('confirmNewPassword')}
                    placeholderTextColor={colors.text}
                    value={value}
                    onChangeText={onChange}
                    secureTextEntry
                  />
                </View>
              )}
            />
            {errors.confirmPassword && (
              <Text style={styles.errorText}>
                {errors.confirmPassword.message}
              </Text>
            )}

            <TouchableOpacity
              style={[sharedStyles.button, { marginBottom: 0 }]}
              onPress={handleSubmit(onSubmit)}
            >
              <Text style={sharedStyles.buttonText}>{t('resetPassword')}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.bottomLink}
            onPress={() => router.replace('/')}
          >
            <Text style={sharedStyles.link}>{t('backToLogin')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.large
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center'
  },
  errorText: {
    color: colors.error || '#ff0000',
    fontSize: 12,
    alignSelf: 'flex-start'
  },
  button: {
    width: '100%',
    marginTop: spacing.medium
  },
  centerSection: {
    flex: 1,
    justifyContent: 'center',
    marginTop: -spacing.xxxlarge
  },
  bottomLink: {
    alignItems: 'center',
    marginBottom: spacing.large
  }
}); 