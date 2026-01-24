import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useLocalization } from '@/hooks/useLocalization';
import { AlertTriangleIcon } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';
import { Icon } from './ui/icon';

interface AssetsDeletionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmationString: string; // String that user must type to confirm deletion
}

export const AssetsDeletionDrawer: React.FC<AssetsDeletionDrawerProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmationString
}) => {
  const { t } = useLocalization();
  const [inputValue, setInputValue] = React.useState('');
  const [isExecuting, setIsExecuting] = React.useState(false);

  // Reset input when drawer opens
  React.useEffect(() => {
    if (isOpen) {
      setInputValue('');
      setIsExecuting(false);
    }
  }, [isOpen]);

  const handleConfirm = async () => {
    if (inputValue !== confirmationString || isExecuting) return;

    setIsExecuting(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      console.error('Error executing deletion:', error);
    } finally {
      setIsExecuting(false);
    }
  };

  const isButtonDisabled = inputValue !== confirmationString || isExecuting;

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent>
        <DrawerHeader className="items-center">
          <View className="mb-4 rounded-full bg-destructive/10 p-4">
            <Icon
              as={AlertTriangleIcon}
              size={32}
              className="text-destructive"
            />
          </View>
          <DrawerTitle className="text-center text-xl">{title}</DrawerTitle>
          <DrawerDescription className="text-center">
            {description}
          </DrawerDescription>
        </DrawerHeader>

        <View className="px-4 pb-4">
          <Text className="mb-2 text-sm text-muted-foreground">
            {t('typeToConfirm').replace('{text}', `"${confirmationString}"`)}
          </Text>
          <Input
            value={inputValue}
            onChangeText={setInputValue}
            placeholder={confirmationString}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isExecuting}
          />
        </View>

        <DrawerFooter className="gap-2">
          <Button
            variant="destructive"
            onPress={handleConfirm}
            disabled={isButtonDisabled}
            className={isButtonDisabled ? 'opacity-50' : ''}
          >
            {isExecuting ? (
              <Text className="font-semibold text-destructive-foreground">
                {t('deleting')}
              </Text>
            ) : (
              <Text className="font-semibold text-destructive-foreground">
                {t('confirmDeletion')}
              </Text>
            )}
          </Button>

          <DrawerClose asChild>
            <Button variant="outline" disabled={isExecuting}>
              <Text className="font-semibold">{t('cancel')}</Text>
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
