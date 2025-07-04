import { system } from '@/db/powersync/system';
import { useLocalization } from '@/hooks/useLocalization';
import { colors, sharedStyles, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import React from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

interface RequestResetFormData {
  email: string;
}

export default function RequestResetPassword() {
  const { t } = useLocalization();
  const { supabaseConnector } = system;

  const {
    control,
    handleSubmit,
    formState: { errors }
  } = useForm<RequestResetFormData>({
    defaultValues: {
      email: ''
    }
  });

  const onSubmit = async (data: RequestResetFormData) => {
    try {
      const { error } =
        await supabaseConnector.client.auth.resetPasswordForEmail(
          data.email.toLowerCase().trim(),
          {
            redirectTo: `${process.env.EXPO_PUBLIC_SITE_URL}/reset-password${process.env.EXPO_PUBLIC_APP_VARIANT !== 'production' ? `?env=${process.env.EXPO_PUBLIC_APP_VARIANT}` : ''}`
          }
        );

      if (error) throw error;

      Alert.alert(t('success'), t('checkEmailForResetLink'), [
        { text: t('ok') }
      ]);
    } catch (error) {
      console.error('Error requesting password reset:', error);
      Alert.alert(
        t('error'),
        error instanceof Error ? error.message : t('failedSendResetEmail')
      );
    }
  };

  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <View style={{ flex: 1, padding: spacing.large }}>
          <Text
            style={[sharedStyles.subtitle, { marginBottom: spacing.xlarge }]}
          >
            {t('resetPassword')}
          </Text>

          <View style={styles.centerSection}>
            <Controller
              control={control}
              name="email"
              rules={{
                required: t('emailRequired'),
                pattern: {
                  value: EMAIL_REGEX,
                  message: t('enterValidEmail')
                }
              }}
              render={({ field: { onChange, value } }) => (
                <View
                  style={[
                    sharedStyles.input,
                    {
                      flexDirection: 'row',
                      alignItems: 'center',
                      marginBottom: spacing.medium
                    }
                  ]}
                >
                  <Ionicons name="mail-outline" size={20} color={colors.text} />
                  <TextInput
                    style={{
                      flex: 1,
                      color: colors.text,
                      marginLeft: spacing.medium
                    }}
                    placeholder={t('enterYourEmail')}
                    placeholderTextColor={colors.text}
                    value={value}
                    onChangeText={onChange}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    accessibilityLabel="ph-no-capture"
                  />
                </View>
              )}
            />
            {errors.email && (
              <Text style={styles.errorText}>{errors.email.message}</Text>
            )}

            <TouchableOpacity
              style={[sharedStyles.button, { marginBottom: 0 }]}
              onPress={handleSubmit(onSubmit)}
            >
              <Text style={sharedStyles.buttonText}>{t('sendResetEmail')}</Text>
            </TouchableOpacity>
          </View>

          <Link
            href="/sign-in"
            style={[sharedStyles.link, { textAlign: 'center' }]}
            push
          >
            {t('backToLogin')}
          </Link>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  errorText: {
    color: colors.error || '#ff0000',
    fontSize: 12,
    alignSelf: 'flex-start',
    marginBottom: spacing.medium
  },
  centerSection: {
    flex: 1,
    justifyContent: 'center',
    marginTop: -spacing.xxxlarge
  },
  bottomLink: {
    marginBottom: spacing.large
  }
});
