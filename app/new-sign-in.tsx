import { LanguageSelect } from '@/components/language-select';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  transformInputProps
} from '@/components/ui/form';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { system } from '@/db/powersync/system';
import { useLocalization } from '@/hooks/useLocalization';
import type { SharedAuthInfo } from '@/navigators/AuthNavigator';
import { safeNavigate } from '@/utils/sharedUtils';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { LockIcon, MailIcon } from 'lucide-react-native';
import { useForm } from 'react-hook-form';
import { Alert, View } from 'react-native';
import { z } from 'zod';

const { supabaseConnector } = system;

export default function NewSignIn({
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

  const formSchema = z.object({
    email: z
      .string({ required_error: t('emailRequired') })
      .email({ message: t('enterValidEmail') }),
    password: z
      .string({ required_error: t('passwordRequired') })
      .min(6, { message: t('passwordMinLength') })
  });

  const { mutateAsync: login, isPending } = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      await supabaseConnector.login(
        data.email.toLowerCase().trim(),
        data.password.trim()
      );
      router.replace('/');
    },
    onError: (error) => {
      Alert.alert(
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
    disabled: isPending,
    defaultValues: {
      email: sharedAuthInfo?.email
    }
  });

  return (
    <Form {...form}>
      <View className="flex flex-col gap-6 p-6 m-safe">
        <View className="flex items-center justify-center text-center flex-col gap-4">
          <Text className="text-primary text-6xl font-semibold">LangQuest</Text>
          <Text>{t('welcome')}</Text>
        </View>
        <LanguageSelect />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('email')}</FormLabel>
              <FormControl>
                <Input
                  {...transformInputProps(field)}
                  autoCapitalize="none"
                  prefix={
                    <Icon as={MailIcon} className="text-muted-foreground" />
                  }
                  mask
                />
              </FormControl>
              <FormDescription>{t('enterYourEmail')}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('password')}</FormLabel>
              <FormControl>
                <Input
                  {...transformInputProps(field)}
                  prefix={
                    <Icon as={LockIcon} className="text-muted-foreground" />
                  }
                  secureTextEntry
                />
              </FormControl>
              <FormDescription>{t('enterYourPassword')}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          variant="link"
          onPress={() =>
            safeNavigate(() =>
              onNavigate('forgot-password', { email: form.watch('email') })
            )
          }
        >
          {t('forgotPassword')}
        </Button>
        <View className="flex flex-col gap-2">
          <Button
            onPress={form.handleSubmit((data) => login(data))}
            disabled={isPending}
          >
            <Text>{t('signIn')}</Text>
          </Button>
          <Button
            onPress={() =>
              safeNavigate(() =>
                onNavigate('register', { email: form.watch('email') })
              )
            }
            variant="outline"
            disabled={isPending}
          >
            <Text>
              {t('newUser')} {t('register')}
            </Text>
          </Button>
        </View>
      </View>
    </Form>
  );
}
