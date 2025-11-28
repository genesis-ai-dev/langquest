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
import { useAuth } from '@/contexts/AuthContext';
import { system } from '@/db/powersync/system';
import { useLocalization } from '@/hooks/useLocalization';
import { safeNavigate } from '@/utils/sharedUtils';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { LockIcon } from 'lucide-react-native';
import { useForm } from 'react-hook-form';
import { Alert, Keyboard, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { z } from 'zod';

export default function ResetPasswordView() {
  const { signOut } = useAuth();
  const { t } = useLocalization();

  const formSchema = z
    .object({
      password: z
        .string(t('passwordRequired'))
        .min(6, t('passwordMinLength'))
        .trim(),
      confirmPassword: z.string(t('confirmPassword')).trim()
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('passwordsNoMatch'),
      path: ['confirmPassword']
    });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema)
  });

  const { mutateAsync: updatePassword, isPending } = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      const { error } = await system.supabaseConnector.client.auth.updateUser({
        password: data.password.trim()
      });

      if (error) throw error;

      Keyboard.dismiss();

      Alert.alert(t('success'), t('passwordResetSuccess'), [
        {
          text: t('ok'),
          // Sign out and let auth context handle navigation to sign in
          // ** It is needed to wait the keyboard be hidden, otherwise can cause some components to be flickering
          // at next page.
          onPress: () => safeNavigate(() => void signOut())
        }
      ]);

      // Reset form
      form.reset();
    },
    onError: (error) => {
      Alert.alert(
        t('error'),
        error instanceof Error ? error.message : t('passwordUpdateFailed')
      );
    }
  });

  return (
    <Form {...form}>
      <KeyboardAwareScrollView
        className="flex-1"
        contentContainerClassName="m-safe flex flex-col gap-4 p-6"
        bottomOffset={96}
        extraKeyboardSpace={20}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex flex-col items-center justify-center gap-4 text-center">
          <Text className="text-6xl font-semibold text-primary">LangQuest</Text>
          <Text>{t('createNewPassword')}</Text>
        </View>

        <View className="flex flex-col items-center gap-4">
          <Icon as={LockIcon} size={32} />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormControl>
                  <Input
                    {...transformInputProps(field)}
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="newPassword"
                    autoComplete="new-password"
                    prefix={LockIcon}
                    prefixStyling={false}
                    placeholder={t('newPassword')}
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
              <FormItem className="w-full">
                <FormControl>
                  <Input
                    {...transformInputProps(field)}
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="newPassword"
                    autoComplete="new-password"
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

          <View className="flex w-full flex-col">
            <Button
              onPress={form.handleSubmit((data) => updatePassword(data))}
              disabled={isPending}
            >
              <Text>{t('updatePassword')}</Text>
            </Button>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </Form>
  );
}
