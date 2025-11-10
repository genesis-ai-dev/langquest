import { AuthNavigator } from '@/navigators/AuthNavigator';
import React from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useThemeColor } from '@/utils/styleUtils';
import { Icon } from './ui/icon';
import { XIcon } from 'lucide-react-native';

interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
}

export function AuthModal({ visible, onClose }: AuthModalProps) {
  const backgroundColor = useThemeColor('background');

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor }} className="flex-1">
        {/* Close button */}
        <View className="absolute right-4 top-4 z-10">
          <Pressable
            onPress={onClose}
            className="rounded-full bg-background/80 p-2"
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
            <Icon as={XIcon} size={24} className="text-foreground" />
          </Pressable>
        </View>
        <AuthNavigator />
      </View>
    </Modal>
  );
}
