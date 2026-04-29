import { LanguageCombobox } from '@/components/language-combobox';
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
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { system } from '@/db/powersync/system';
import type { Languoid } from '@/hooks/db/useLanguoids';
import { useLocalization } from '@/hooks/useLocalization';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import type { Language } from '@/store/localStore';
import { useLocalStore } from '@/store/localStore';

import RNAlert from '@blazejkustra/react-native-alert';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LockIcon, MailIcon, UserIcon } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { z } from 'zod';

const { supabaseConnector } = system;

export default function RegisterView() {
  const { email: initialEmail } = useLocalSearchParams<{ email?: string }>();
  const router = useRouter();
  const { t } = useLocalization();
  const isOnline = useNetworkStatus();
  const currentLanguage = useLocalStore((state) => state.uiLanguage);
  const dateTermsAccepted = useLocalStore((state) => state.dateTermsAccepted);
  const formSchema = z
    .object({
      email: z
        .string()
        .email(t('enterValidEmail'))
        .nonempty(t('emailRequired'))
        .toLowerCase()
        .trim(),
      password: z.string(t('passwordRequired')).min(6, t('passwordMinLength')),
      confirmPassword: z.string(t('confirmPassword')),
      username: z
        .string(t('usernameRequired'))
        .min(
          3,
          t('usernameRequired') || 'Username must be at least 3 characters'
        )
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('passwordsNoMatch') || 'Passwords do not match',
      path: ['confirmPassword']
    });

  const { mutateAsync: register, isPending } = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      if (!isOnline) {
        throw new Error(t('internetConnectionRequired'));
      }
      // Get languoid name - handle both Languoid (name) and old Language (english_name) types
      const languoidName =
        (currentLanguage as unknown as Languoid | undefined)?.name ||
        (currentLanguage as unknown as Language | undefined)?.english_name ||
        'english';

      const { error } = await supabaseConnector.client.auth.signUp({
        email: data.email.toLowerCase().trim(),
        password: data.password.trim(),
        options: {
          data: {
            username: data.username.trim(),
            terms_accepted: true,
            terms_accepted_at: dateTermsAccepted || new Date().toISOString(),
            ui_language: languoidName.toLowerCase(),
            ui_languoid_id: currentLanguage?.id, // New languoid reference
            ui_language_id: currentLanguage?.id, // Keep for backward compatibility
            email_verified: false
          },
          emailRedirectTo: `${process.env.EXPO_PUBLIC_SITE_URL}${
            process.env.EXPO_PUBLIC_APP_VARIANT !== 'production'
              ? `?env=${process.env.EXPO_PUBLIC_APP_VARIANT}`
              : ''
          }`
        }
      });

      if (error) throw error;
    },
    onSuccess: () => {
      router.dismissTo({
        pathname: '/(auth)/sign-in',
        params: { email }
      });
    },
    onError: (error) => {
      RNAlert.alert(
        t('error') || 'Error',
        error instanceof Error
          ? error.message
          : t('registrationFail') || 'Registration failed'
      );
    }
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    mode: 'onChange',
    defaultValues: {
      email: initialEmail || '',
      password: '',
      confirmPassword: '',
      username: ''
    }
  });

  useEffect(() => {
    if (initialEmail) {
      form.setValue('email', initialEmail);
    }
  }, [form, initialEmail]);

  const email = useWatch({ control: form.control, name: 'email' });

  const handleFormSubmit = form.handleSubmit((data) => register(data));

  return (
    <>
      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerClassName="m-safe flex flex-col gap-4 p-6"
        bottomOffset={96}
        extraKeyboardSpace={20}
        showsVerticalScrollIndicator={false}
      >
        <Form {...form}>
          <View className="flex flex-col items-center justify-center gap-4 text-center">
            <Text className="text-6xl font-semibold text-primary">
              LangQuest
            </Text>
            <Text>{t('newUserRegistration')}</Text>
          </View>
          <LanguageCombobox uiReadyOnly toggleUILocalization />
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    {...transformInputProps(field)}
                    type="next"
                    mask
                    autoComplete="username-new"
                    returnKeyType="next"
                    submitBehavior="submit"
                    autoCapitalize="none"
                    prefix={UserIcon}
                    prefixStyling={false}
                    placeholder={t('username')}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
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
                    submitBehavior="submit"
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
                    type="next"
                    submitBehavior="submit"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="password"
                    prefix={LockIcon}
                    prefixStyling={false}
                    placeholder={t('password')}
                    secureTextEntry
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    {...transformInputProps(field)}
                    type="next"
                    submitBehavior="blurAndSubmit"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="password"
                    prefix={LockIcon}
                    prefixStyling={false}
                    placeholder={t('confirmPassword')}
                    secureTextEntry
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <OfflineAlert />
          <View className="flex flex-col gap-2">
            <FormSubmit onPress={handleFormSubmit} disabled={!isOnline}>
              <Text>{t('register')}</Text>
            </FormSubmit>
            <Button
              onPress={() =>
                router.dismissTo({
                  pathname: '/(auth)/sign-in',
                  params: { email }
                })
              }
              variant="outline"
              className="border-border bg-input"
              disabled={isPending}
            >
              <Text>{t('returningHero')}</Text>
            </Button>
          </View>
        </Form>
      </KeyboardAwareScrollView>
    </>
  );
}
