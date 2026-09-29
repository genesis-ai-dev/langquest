import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { useDismissAuthSheet } from '@/hooks/useDismissAuthSheet';
import { useLocalization } from '@/hooks/useLocalization';
import { XIcon } from 'lucide-react-native';
import { View } from 'react-native';

export function AuthSheetCloseButton() {
  const { t } = useLocalization();
  const { dismissAuthSheet } = useDismissAuthSheet();

  return (
    <View className="flex-row items-center justify-end">
      <Button
        variant="ghost"
        size="icon"
        onPress={dismissAuthSheet}
        accessibilityLabel={t('close')}
        testID="auth-sheet-close"
      >
        <Icon as={XIcon} size={24} className="text-muted-foreground" />
      </Button>
    </View>
  );
}
