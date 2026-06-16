import { RegisterLegalConsent } from '@/components/RegisterLegalConsent';
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
import { CURRENT_LEGAL_VERSION } from '@/constants/legalVersions';
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
  const acceptTerms = useLocalStore((state) => state.acceptTerms);
  const formSchema = z
    .object({
      legalConsent: z.literal(true, t('termsRequired')),
      email: z
        .email(t('enterValidEmail'))
        .nonempty(t('emailRequired'))
        .toLowerCase()
        .trim(),
      password: z
        .string(t('passwordRequired'))
        .nonempty(t('passwordRequired'))
        .min(6, t('passwordMinLength')),
      confirmPassword: z
        .string(t('passwordRequired'))
        .nonempty(t('passwordRequired')),
      username: z
        .string(t('usernameRequired'))
        .nonempty(t('usernameRequired'))
        .min(3, t('usernameRequired'))
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('passwordsNoMatch'),
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

      const acceptedAt = new Date().toISOString();
      acceptTerms();

      const { error } = await supabaseConnector.client.auth.signUp({
        email: data.email.toLowerCase().trim(),
        password: data.password.trim(),
        options: {
          data: {
            username: data.username.trim(),
            terms_accepted: true,
            terms_accepted_at: acceptedAt,
            privacy_policy_version: CURRENT_LEGAL_VERSION,
            ui_language: languoidName.toLowerCase(),
            ui_languoid_id: currentLanguage?.id, // New languoid reference
            ui_language_id: currentLanguage?.id, // Keep for backward compatibility
            email_verified: false
          },
          emailRedirectTo: process.env.EXPO_PUBLIC_SITE_URL
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
        t('error'),
        error instanceof Error ? error.message : t('registrationFail')
      );
    }
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    mode: 'onChange',
    defaultValues: {
      legalConsent: false as unknown as true,
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
        contentContainerClassName="flex flex-col gap-2.5 px-6 pt-4 pb-6"
        bottomOffset={96}
        extraKeyboardSpace={20}
        showsVerticalScrollIndicator={false}
      >
        <Form {...form}>
          <View className="mb-1 flex flex-col items-center text-center">
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
              <FormItem className="gap-1">
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
              <FormItem className="gap-1">
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
              <FormItem className="gap-1">
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
              <FormItem className="gap-1">
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
          <FormField
            control={form.control}
            name="legalConsent"
            render={({ field }) => (
              <FormItem className="gap-1">
                <FormControl>
                  <RegisterLegalConsent
                    checked={field.value === true}
                    onCheckedChange={(checked) =>
                      field.onChange(
                        checked ? true : (false as unknown as true)
                      )
                    }
                    disabled={isPending}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <View className="flex flex-col gap-2">
            <FormSubmit onPress={handleFormSubmit}>
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
