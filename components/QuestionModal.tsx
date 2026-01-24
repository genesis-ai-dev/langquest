import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from '@/components/ui/drawer';
import { Text } from '@/components/ui/text';
import React from 'react';
import { View } from 'react-native';

interface QuestionModalProps {
  visible: boolean;
  title: string;
  description: string;
  onYes: () => void;
  onNo: () => void;
  onClose?: () => void;
}

export function QuestionModal({
  visible,
  title,
  description,
  onYes,
  onNo,
  onClose
}: QuestionModalProps) {
  const [isOpen, setIsOpen] = React.useState(visible);

  // Sync internal state with prop
  React.useEffect(() => {
    setIsOpen(visible);
  }, [visible]);

  const handleYes = () => {
    onYes();
    setIsOpen(false);
    onClose?.();
  };

  const handleNo = () => {
    onNo();
    setIsOpen(false);
    onClose?.();
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      onClose?.();
    }
  };

  return (
    <Drawer open={isOpen} onOpenChange={handleOpenChange}>
      <DrawerContent className="pb-safe">
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>

        <DrawerFooter>
          <View className="flex-row gap-3">
            <Button variant="secondary" className="flex-1" onPress={handleNo}>
              <Text>No</Text>
            </Button>
            <Button variant="default" className="flex-1" onPress={handleYes}>
              <Text>Yes</Text>
            </Button>
          </View>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
