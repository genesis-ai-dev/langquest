import { LanguageCombobox } from '@/components/language-combobox';
import { Button, buttonTextVariants } from '@/components/ui/button';
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
import type { SharedAuthInfo } from '@/navigators/AuthNavigator';
import { safeNavigate } from '@/utils/sharedUtils';
import { cn } from '@/utils/styleUtils';
import RNAlert from '@blazejkustra/react-native-alert';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { LockIcon, MailIcon, WifiOffIcon } from 'lucide-react-native';
import React from 'react';
import { useForm } from 'react-hook-form';
import { Pressable, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { z } from 'zod';

const { supabaseConnector } = system;

export default function SignInView({
  onNavigate,
  sharedAuthInfo
}: {
  onNavigate: (
    view: 'register' | 'forgot-password',
    sharedAuthInfo?: SharedAuthInfo
  ) => void;
  sharedAuthInfo?: SharedAuthInfo;
}) {
  const { t } = useLocalization();
  const router = useRouter();
  const isOnline = useNetworkStatus();
  const formSchema = z.object({
    email: z
      .email(t('enterValidEmail'))
      .nonempty(t('emailRequired'))
      .toLowerCase()
      .trim(),
    // No password min length for sign in
    password: z.string(t('passwordRequired')).nonempty(t('passwordRequired'))
  });

  const { mutateAsync: login } = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      if (!isOnline) {
        throw new Error(t('internetConnectionRequired'));
      }
      await supabaseConnector.login(
        data.email.toLowerCase().trim(),
        data.password.trim()
      );
      router.replace('/');
    },
    onError: (error) => {
      RNAlert.alert(
        t('error') || 'Error',
        error instanceof Error
          ? error.message
          : t('signInError') || 'Sign in failed',
        [
          { text: t('ok') || 'OK' },
          {
            text: t('newUser'),
            onPress: () =>
              safeNavigate(() =>
                onNavigate('register', { email: form.getValues('email') })
              )
          }
        ]
      );
    }
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: sharedAuthInfo?.email
    },
    disabled: !isOnline
  });

  const handleFormSubmit = form.handleSubmit((data) => login(data));

  return (
    <Form {...form}>
      <View className="relative flex-1">
        <KeyboardAwareScrollView
          className="mb-[62px] flex-1"
          contentContainerClassName="m-safe flex flex-col gap-4 p-6"
          showsVerticalScrollIndicator={false}
          bottomOffset={96}
          extraKeyboardSpace={20}
        >
          <View className="mb-8 flex flex-col items-center justify-center text-center">
            <Text className="text-6xl font-semibold text-primary">
              LangQuest
            </Text>
            <Text>{t('welcome')}</Text>
          </View>
          <LanguageCombobox uiReadyOnly toggleUILocalization />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    {...transformInputProps(field)}
                    mask
                    type="next"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    prefix={MailIcon}
                    prefixStyling={false}
                    placeholder={t('enterYourEmail')}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    {...transformInputProps(field)}
                    onSubmitEditing={handleFormSubmit}
                    returnKeyType="done"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="password"
                    prefix={LockIcon}
                    prefixStyling={false}
                    placeholder={t('enterYourPassword')}
                    secureTextEntry
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Pressable
            onPress={() =>
              safeNavigate(() =>
                onNavigate('forgot-password', { email: form.watch('email') })
              )
            }
          >
            <Text
              className={cn(
                buttonTextVariants({ variant: 'link' }),
                'text-left'
              )}
            >
              {t('forgotPassword')}
            </Text>
          </Pressable>
          {!isOnline && (
            <View className="flex flex-row items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3">
              <Icon as={WifiOffIcon} size={20} className="text-destructive" />
              <Text className="flex-1 text-sm text-destructive">
                {t('internetConnectionRequired')}
              </Text>
            </View>
          )}
          <View className="flex flex-col gap-2">
            <FormSubmit onPress={handleFormSubmit}>
              <Text>{t('signIn')}</Text>
            </FormSubmit>
            <Button
              onPress={() =>
                safeNavigate(() =>
                  onNavigate('register', { email: form.watch('email') })
                )
              }
              variant="outline"
              className="border-border bg-input"
            >
              <Text>
                {t('newUser')} {t('register')}
              </Text>
            </Button>
          </View>
        </KeyboardAwareScrollView>
      </View>
    </Form>
  );
}
