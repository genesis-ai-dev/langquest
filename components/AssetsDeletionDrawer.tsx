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
import { Text } from '@/components/ui/text';
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
  countdown?: number; // Countdown duration in seconds (default: 10)
}

export const AssetsDeletionDrawer: React.FC<AssetsDeletionDrawerProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  countdown = 10
}) => {
  const [timeLeft, setTimeLeft] = React.useState(countdown);
  const [isExecuting, setIsExecuting] = React.useState(false);

  // Reset timer when drawer opens
  React.useEffect(() => {
    if (isOpen) {
      setTimeLeft(countdown);
      setIsExecuting(false);
    }
  }, [isOpen, countdown]);

  // Countdown timer
  React.useEffect(() => {
    if (!isOpen || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, timeLeft]);

  const handleConfirm = async () => {
    if (timeLeft > 0 || isExecuting) return;

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

  const isButtonDisabled = timeLeft > 0 || isExecuting;

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

        <DrawerFooter className="gap-2">
          <Button
            variant="destructive"
            onPress={handleConfirm}
            disabled={isButtonDisabled}
            className={isButtonDisabled ? 'opacity-50' : ''}
          >
            {isExecuting ? (
              <Text className="font-semibold text-destructive-foreground">
                Deleting...
              </Text>
            ) : timeLeft > 0 ? (
              <Text className="font-semibold text-destructive-foreground">
                Wait {timeLeft}s to confirm
              </Text>
            ) : (
              <Text className="font-semibold text-destructive-foreground">
                Confirm Deletion
              </Text>
            )}
          </Button>

          <DrawerClose asChild>
            <Button variant="outline" disabled={isExecuting}>
              <Text className="font-semibold">Cancel</Text>
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
