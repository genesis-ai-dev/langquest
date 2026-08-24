import { Icon } from '@/components/ui/icon';
import { useLocalization } from '@/hooks/useLocalization';
import { useRouter } from 'expo-router';
import { ChevronLeftIcon } from 'lucide-react-native';
import { Pressable } from 'react-native';

// Explicit back affordance for the mock/prototype screens pushed on top of
// the dashboard. The app's shared header has its own back button, but these
// routes are new enough (and easy to land on directly while iterating) that
// they get their own guaranteed-visible one too.
export function BackButton() {
  const router = useRouter();
  const { t } = useLocalization();

  return (
    <Pressable
      onPress={() => router.back()}
      hitSlop={8}
      accessibilityLabel={t('back')}
      className="h-9 w-9 items-center justify-center self-start rounded-full bg-muted"
    >
      <Icon as={ChevronLeftIcon} size={20} className="text-foreground" />
    </Pressable>
  );
}
