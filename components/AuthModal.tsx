import type { AuthView } from '@/navigators/AuthNavigator';
import { AuthNavigator } from '@/navigators/AuthNavigator';
import { useThemeColor } from '@/utils/styleUtils';
import { XIcon } from 'lucide-react-native';
import React from 'react';
import { Modal, Pressable, View } from 'react-native';
import { Icon } from './ui/icon';

interface AuthModalProps {
  visible: boolean;
  initialView?: AuthView;
  onClose: () => void;
}

export function AuthModal({
  visible,
  initialView = 'sign-in',
  onClose
}: AuthModalProps) {
  const backgroundColor = useThemeColor('background');

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ backgroundColor }} className="flex-1">
        {/* Close button */}
        <View className="absolute right-4 top-4 z-10">
          <Pressable
            onPress={onClose}
            className="rounded-full bg-background/80 p-2"
            hitSlop={10}
          >
            <Icon as={XIcon} size={24} className="text-foreground" />
          </Pressable>
        </View>
        <AuthNavigator key={initialView} initialView={initialView} />
      </View>
    </Modal>
  );
}
