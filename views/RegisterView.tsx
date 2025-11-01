import { LanguageSelect } from '@/components/language-select';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  transformInputProps
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { system } from '@/db/powersync/system';
import { useLocalization } from '@/hooks/useLocalization';
import type { SharedAuthInfo } from '@/navigators/AuthNavigator';
import { useLocalStore } from '@/store/localStore';
import { safeNavigate } from '@/utils/sharedUtils';
import { cn } from '@/utils/styleUtils';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { LockIcon, MailIcon, UserIcon } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Alert, Pressable, View } from 'react-native';
import { z } from 'zod';

const { supabaseConnector } = system;

export default function RegisterView({
  onNavigate,
  sharedAuthInfo
}: {
  onNavigate: (view: 'sign-in', sharedAuthInfo: SharedAuthInfo) => void;
  sharedAuthInfo?: SharedAuthInfo;
}) {
  const { t } = useLocalization();
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
        ),
      termsAccepted: z.boolean().refine((val) => val === true, {
        message: t('termsRequired') || 'You must agree to the Terms and Privacy'
      })
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('passwordsNoMatch') || 'Passwords do not match',
      path: ['confirmPassword']
    });

  const { mutateAsync: register, isPending } = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      const { error } = await supabaseConnector.client.auth.signUp({
        email: data.email.toLowerCase().trim(),
        password: data.password.trim(),
        options: {
          data: {
            username: data.username.trim(),
            terms_accepted: data.termsAccepted,
            terms_accepted_at: dateTermsAccepted || new Date().toISOString(),
            ui_language:
              currentLanguage?.english_name?.toLowerCase() || 'english',
            ui_language_id: currentLanguage?.id,
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
      safeNavigate(() =>
        onNavigate('sign-in', { email: form.getValues('email') })
      );
    },
    onError: (error) => {
      Alert.alert(
        t('error') || 'Error',
        error instanceof Error
          ? error.message
          : t('registrationFail') || 'Registration failed'
      );
    }
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    disabled: isPending,
    defaultValues: {
      email: sharedAuthInfo?.email || '',
      password: '',
      confirmPassword: '',
      username: '',
      termsAccepted: false
    }
  });

  useEffect(() => {
    if (sharedAuthInfo?.email) {
      form.reset({
        email: sharedAuthInfo.email
      });
    }
  }, [form, sharedAuthInfo?.email]);

  return (
    <Form {...form}>
      <View className="m-safe flex flex-col gap-4 p-6">
        <View className="flex flex-col items-center justify-center gap-4 text-center">
          <Text className="text-6xl font-semibold text-primary">LangQuest</Text>
          <Text>{t('newUserRegistration') || 'New User Registration'}</Text>
        </View>
        <LanguageSelect />
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  {...transformInputProps(field)}
                  mask
                  prefix={UserIcon}
                  prefixStyling={false}
                  placeholder={t('username') || 'Username'}
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
                  autoCapitalize="none"
                  keyboardType="email-address"
                  prefix={MailIcon}
                  prefixStyling={false}
                  placeholder={t('enterYourEmail') || 'Enter your email'}
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
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="password"
                  autoComplete="password"
                  prefix={LockIcon}
                  prefixStyling={false}
                  placeholder={t('password') || 'Password'}
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
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="password"
                  autoComplete="password"
                  prefix={LockIcon}
                  prefixStyling={false}
                  placeholder={t('confirmPassword') || 'Confirm Password'}
                  secureTextEntry
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="termsAccepted"
          render={({ field }) => {
            const error = form.formState.errors.termsAccepted;
            return (
              <FormItem>
                <FormControl>
                  <Pressable
                    onPress={() => field.onChange(!field.value)}
                    className={cn(
                      'flex flex-row items-center gap-2 rounded-lg border p-3',
                      error
                        ? 'border-destructive bg-destructive/10'
                        : 'border-transparent'
                    )}
                  >
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                    <Text className={cn('text-sm', error && 'text-destructive')}>
                      {t('agreeToTerms') || 'I accept the terms and conditions'}
                    </Text>
                  </Pressable>
                </FormControl>
                <FormMessage />
              </FormItem>
            );
          }}
        />
        <View className="flex flex-col gap-2">
          <Button
            onPress={form.handleSubmit((data) => register(data))}
            loading={isPending}
          >
            <Text>{t('register') || 'Register'}</Text>
          </Button>
          <Button
            onPress={() =>
              safeNavigate(() =>
                onNavigate('sign-in', { email: form.watch('email') })
              )
            }
            variant="outline"
            className="border-border bg-input"
            disabled={isPending}
          >
            <Text>
              {t('returningHero') || 'Already have an account? Sign In'}
            </Text>
          </Button>
        </View>
      </View>
    </Form>
  );
}
