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
import { Input } from '@/components/ui/input';
import { Link } from '@/components/ui/link';
import { Text } from '@/components/ui/text';
import { useSystem } from '@/contexts/SystemContext';
import { useTranslation } from '@/hooks/useTranslation';
import { Lock } from '@/lib/icons/Lock';
import { Mail } from '@/lib/icons/Mail';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { z } from 'zod';
export default function NewSignIn() {
  const { supabaseConnector } = useSystem();
  const { t } = useTranslation();
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
    }
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    disabled: isPending
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
                  prefix={<Mail size={16} className="text-muted-foreground" />}
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
                  prefix={<Lock size={16} className="text-muted-foreground" />}
                  secureTextEntry
                />
              </FormControl>
              <FormDescription>{t('enterYourPassword')}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Link href="/request-reset-password">{t('forgotPassword')}</Link>
        <View className="flex flex-col gap-2">
          <Button
            onPress={form.handleSubmit((data) => login(data))}
            disabled={isPending}
          >
            <Text>{t('signIn')}</Text>
          </Button>
          <Button
            onPress={() => router.push('/register')}
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
