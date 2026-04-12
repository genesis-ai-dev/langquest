import { OfflineAlert } from '@/components/offline-alert';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  FormSubmit,
  transformInputProps
} from '@/components/ui/form';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { system } from '@/db/powersync/system';
import { useLocalization } from '@/hooks/useLocalization';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import RNAlert from '@blazejkustra/react-native-alert';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LockIcon, MailIcon } from 'lucide-react-native';
import React from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Linking, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { z } from 'zod';

const { supabaseConnector } = system;

export default function ForgotPasswordView() {
  const { email: initialEmail } = useLocalSearchParams<{ email?: string }>();
  const router = useRouter();
  const { t } = useLocalization();
  const isOnline = useNetworkStatus();
  const formSchema = z.object({
    email: z
      .email(t('enterValidEmail'))
      .nonempty(t('emailRequired'))
      .toLowerCase()
      .trim()
  });

  const { mutateAsync: resetPassword, isPending } = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      if (!isOnline) {
        throw new Error(t('internetConnectionRequired'));
      }
      const { error } =
        await supabaseConnector.client.auth.resetPasswordForEmail(data.email);
      if (error) throw error;
    },
    onSuccess: () => {
      if (__DEV__ && process.env.EXPO_PUBLIC_APP_VARIANT === 'development')
        Linking.openURL(process.env.EXPO_PUBLIC_RESEND_LOCAL_INBOX_URL!);
      RNAlert.alert(t('success'), t('checkEmailForResetLink'), [
        {
          text: t('ok'),
          isPreferred: true,
          onPress: () => {
            router.dismissTo({
              pathname: '/(auth)/sign-in',
              params: { email }
            });
          }
        }
      ]);
    },
    onError: (error) => {
      RNAlert.alert(
        t('error'),
        error instanceof Error ? error.message : t('failedSendResetEmail')
      );
    }
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: initialEmail || ''
    }
  });

  const email = useWatch({ control: form.control, name: 'email' });

  const handleFormSubmit = form.handleSubmit((data) => resetPassword(data));

  return (
    <Form {...form}>
      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerClassName="m-safe flex flex-col gap-4 p-6"
        bottomOffset={96}
        extraKeyboardSpace={20}
      >
        <View className="flex flex-col items-center justify-center gap-4 text-center">
          <Text className="text-6xl font-semibold text-primary">LangQuest</Text>
          <Text>{t('resetPassword')}</Text>
        </View>
        <View className="flex flex-col items-center gap-4">
          <Icon as={LockIcon} size={32} />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormControl>
                  <Input
                    {...transformInputProps(field)}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    prefix={MailIcon}
                    prefixStyling={false}
                    placeholder={t('enterEmailForPasswordReset')}
                    returnKeyType="done"
                    onSubmitEditing={handleFormSubmit}
                    mask
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <OfflineAlert />
          <View className="flex w-full flex-col">
            <FormSubmit onPress={handleFormSubmit} disabled={!isOnline}>
              <Text>{t('sendResetEmail')}</Text>
            </FormSubmit>

            <Button
              onPress={() =>
                router.dismissTo({
                  pathname: '/(auth)/sign-in',
                  params: { email }
                })
              }
              disabled={isPending}
              variant="plain"
            >
              <Text>{t('backToLogin')}</Text>
            </Button>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </Form>
  );
}
