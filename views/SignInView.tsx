import { LanguageSelect } from '@/components/language-select';
import { Button, buttonTextVariants } from '@/components/ui/button';
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
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import type { SharedAuthInfo } from '@/navigators/AuthNavigator';
import { safeNavigate } from '@/utils/sharedUtils';
import { cn } from '@/utils/styleUtils';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { LockIcon, MailIcon, WifiOffIcon } from 'lucide-react-native';
import { useForm } from 'react-hook-form';
import { Alert, Pressable, View } from 'react-native';
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
    password: z.string(t('passwordRequired')).min(6, t('passwordMinLength'))
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
      <View className="m-safe flex flex-col gap-4 p-6">
        <View className="flex flex-col items-center justify-center gap-4 text-center">
          <Text className="text-6xl font-semibold text-primary">LangQuest</Text>
          <Text>{t('welcome')}</Text>
        </View>
        <LanguageSelect uiReadyOnly />
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
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="password"
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
            className={cn(buttonTextVariants({ variant: 'link' }), 'text-left')}
          >
            {t('forgotPassword')}
          </Text>
        </Pressable>
        {!isOnline && (
          <View className="flex flex-row items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3">
            <WifiOffIcon size={20} className="text-destructive" />
            <Text className="flex-1 text-sm text-destructive">
              {t('internetConnectionRequired')}
            </Text>
          </View>
        )}
        <View className="flex flex-col gap-2">
          <Button
            onPress={form.handleSubmit((data) => login(data))}
            loading={isPending}
            disabled={!isOnline || isPending}
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
            className="border-border bg-input"
            disabled={isPending || !isOnline}
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
