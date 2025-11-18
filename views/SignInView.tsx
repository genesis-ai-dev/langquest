import { LanguageSelect } from '@/components/language-select';
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
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { system } from '@/db/powersync/system';
import { useLocalization } from '@/hooks/useLocalization';
import type { SharedAuthInfo } from '@/navigators/AuthNavigator';
import { safeNavigate } from '@/utils/sharedUtils';
import { cn } from '@/utils/styleUtils';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { LockIcon, MailIcon } from 'lucide-react-native';
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
      await supabaseConnector.login(data.email.toLowerCase(), data.password);
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
    resolver: zodResolver(formSchema)
    // defaultValues: {
    // email: sharedAuthInfo?.email
    // }
  });

  console.log(form.formState);

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
        <View className="flex flex-col gap-2">
          <FormSubmit onPress={form.handleSubmit((data) => login(data))}>
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
