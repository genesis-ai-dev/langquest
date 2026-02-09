import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useLocalization } from '@/hooks/useLocalization';
import { storage } from '@/utils/storage';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

interface RecordingHelpDialogProps {
  onClose?: () => void;
}

export function RecordingHelpDialog({ onClose }: RecordingHelpDialogProps) {
  const { t } = useLocalization();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if help has been shown before
    const checkIfShouldShow = async () => {
      const hasBeenShown = await storage.hasRecordingHelpBeenShown();
      if (!hasBeenShown) {
        setIsVisible(true);
      }
    };
    checkIfShouldShow();
  }, []);

  const handleOk = async () => {
    await storage.setRecordingHelpShown();
    setIsVisible(false);
    onClose?.();
  };

  const handleBackdropPress = async () => {
    await storage.setRecordingHelpShown();
    setIsVisible(false);
    onClose?.();
  };

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleBackdropPress}
    >
      <Pressable
        className="flex-1 items-center justify-center bg-black/50"
        onPress={handleBackdropPress}
      >
        <Pressable
          className="mx-6 max-w-md rounded-2xl bg-card p-6"
          onPress={(e) => e.stopPropagation()}
        >
          {/* Title */}
          <Text className="text-xl font-bold text-foreground">
            {t('recordingHelpTitle')}
          </Text>

          {/* Content */}
          <View className="mt-4">
            <Text className="text-base leading-relaxed text-foreground">
              1. <Text className="font-bold">{t('tap')}</Text>{' '}
              {t('recordingHelpVAD')}
            </Text>
            <Text className="mt-3 text-base leading-relaxed text-foreground">
              2. <Text className="font-bold">{t('pressAndHold')}</Text>{' '}
              {t('recordingHelpPushToTalk')}
            </Text>
          </View>

          {/* Button */}
          <View className="mt-6">
            <Button variant="default" onPress={handleOk} className="w-full">
              <Text>{t('ok')}</Text>
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
