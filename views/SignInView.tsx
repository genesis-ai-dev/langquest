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
import { useLocalization } from '@/hooks/useLocalization';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import RNAlert from '@blazejkustra/react-native-alert';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LockIcon, MailIcon } from 'lucide-react-native';
import React from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { z } from 'zod';

const { supabaseConnector } = system;

export default function SignInView() {
  const { email: initialEmail } = useLocalSearchParams<{ email?: string }>();
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

  const { mutateAsync: login, isPending } = useMutation({
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
          { text: t('ok') || 'OK', isPreferred: true },
          {
            text: t('newUser'),
            onPress: () =>
              router.navigate({
                pathname: '/(auth)/register',
                params: { email }
              })
          }
        ]
      );
    }
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: initialEmail
    }
  });

  const email = useWatch({ control: form.control, name: 'email' });

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
          <Button
            variant="plain"
            onPress={() =>
              router.navigate({
                pathname: '/(auth)/forgot-password',
                params: { email }
              })
            }
            size="auto"
            className="self-start"
            // className="native:px-0 native:py-0 h-auto self-start px-0 py-0"
          >
            <Text className="text-left">{t('forgotPassword')}</Text>
          </Button>
          <OfflineAlert />
          <View className="flex flex-col gap-2">
            <FormSubmit onPress={handleFormSubmit} disabled={!isOnline}>
              <Text>{t('signIn')}</Text>
            </FormSubmit>
            <Button
              onPress={() =>
                router.navigate({
                  pathname: '/(auth)/register',
                  params: { email }
                })
              }
              variant="outline"
              className="border-border bg-input"
              disabled={isPending}
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
