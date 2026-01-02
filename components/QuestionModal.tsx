import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import React from 'react';
import { Modal, Pressable, TouchableWithoutFeedback, View } from 'react-native';

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
  const handleClose = () => {
    onClose?.();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <Pressable className="flex-1 items-center justify-center bg-black/50">
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View className="w-[90%] max-w-md rounded-lg bg-background p-6">
              <View className="mb-4">
                <Text variant="h3" className="mb-2">
                  {title}
                </Text>
                <Text variant="p" className="text-muted-foreground">
                  {description}
                </Text>
              </View>

              <View className="flex-row gap-3">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onPress={() => {
                    onNo();
                    handleClose();
                  }}
                >
                  <Text>No</Text>
                </Button>
                <Button
                  variant="default"
                  className="flex-1"
                  onPress={() => {
                    onYes();
                    handleClose();
                  }}
                >
                  <Text>Yes</Text>
                </Button>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </Pressable>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
