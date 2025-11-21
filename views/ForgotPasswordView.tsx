import { LanguageSelect } from '@/components/language-select';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  transformInputProps
} from '@/components/ui/form';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { system } from '@/db/powersync/system';
import { useLocalization } from '@/hooks/useLocalization';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import type { SharedAuthInfo } from '@/navigators/AuthNavigator';
import { safeNavigate } from '@/utils/sharedUtils';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { LockIcon, MailIcon, WifiOffIcon } from 'lucide-react-native';
import React from 'react';
import { useForm } from 'react-hook-form';
import { Alert, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { z } from 'zod';

const { supabaseConnector } = system;

export default function ForgotPasswordView({
  onNavigate,
  sharedAuthInfo
}: {
  onNavigate: (view: 'sign-in', sharedAuthInfo: SharedAuthInfo) => void;
  sharedAuthInfo?: SharedAuthInfo;
}) {
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
      Alert.alert(t('success'), t('checkEmailForResetLink'), [
        {
          text: t('ok'),
          onPress: () =>
            safeNavigate(() =>
              onNavigate('sign-in', { email: form.getValues('email') })
            )
        }
      ]);
    },
    onError: (error) => {
      Alert.alert(
        t('error'),
        error instanceof Error ? error.message : t('failedSendResetEmail')
      );
    }
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    disabled: isPending,
    defaultValues: {
      email: sharedAuthInfo?.email || ''
    }
  });

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
        <LanguageSelect uiReadyOnly />
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
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {!isOnline && (
            <View className="flex flex-row items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3">
              <WifiOffIcon size={20} className="text-destructive" />
              <Text className="flex-1 text-sm text-destructive">
                {t('internetConnectionRequired')}
              </Text>
            </View>
          )}

          <View className="flex w-full flex-col">
            <Button
              onPress={form.handleSubmit((data) => resetPassword(data))}
              disabled={!isOnline || isPending}
            >
              <Text>{t('sendResetEmail')}</Text>
            </Button>

            <Button
              onPress={() =>
                safeNavigate(() =>
                  onNavigate('sign-in', { email: form.watch('email') })
                )
              }
              disabled={isPending || !isOnline}
              variant="link"
            >
              <Text>{t('backToLogin')}</Text>
            </Button>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </Form>
  );
}
