/**
 * RenameAssetModal - Modal for renaming assets
 */

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import React from 'react';
import type { TextInput } from 'react-native';
import { Modal, Pressable, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated';

interface RenameAssetModalProps {
  isVisible: boolean;
  currentName: string;
  onClose: () => void;
  onSave: (newName: string) => void;
}

export function RenameAssetModal({
  isVisible,
  currentName,
  onClose,
  onSave
}: RenameAssetModalProps) {
  const [name, setName] = React.useState(currentName);
  const [modalVisible, setModalVisible] = React.useState(false);
  const inputRef = React.useRef<TextInput>(null);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.9);

  // Update local state when currentName changes
  React.useEffect(() => {
    setName(currentName);
  }, [currentName]);

  // Handle modal visibility with exit animation
  React.useEffect(() => {
    if (isVisible) {
      // Show modal immediately
      setModalVisible(true);
      // Quick, snappy animation (Emil Kowalski style)
      opacity.value = withTiming(1, {
        duration: 150,
        easing: Easing.out(Easing.ease)
      });
      scale.value = withTiming(1, {
        duration: 150,
        easing: Easing.out(Easing.ease)
      });

      // Focus after animation completes
      const focusTimer = setTimeout(() => {
        inputRef.current?.focus();
      }, 150);

      // Backup focus attempt
      const backupTimer = setTimeout(() => {
        inputRef.current?.focus();
      }, 200);

      return () => {
        clearTimeout(focusTimer);
        clearTimeout(backupTimer);
      };
    } else {
      // Exit animation - quick fade out (ease-out for responsiveness)
      opacity.value = withTiming(0, {
        duration: 100,
        easing: Easing.out(Easing.ease)
      });
      scale.value = withTiming(0.9, {
        duration: 100,
        easing: Easing.out(Easing.ease)
      });

      // Hide modal after exit animation completes
      const hideTimer = setTimeout(() => {
        setModalVisible(false);
      }, 100);

      return () => {
        clearTimeout(hideTimer);
      };
    }
  }, [isVisible, opacity, scale]);

  const handleSave = () => {
    const trimmedName = name.trim();
    if (trimmedName && trimmedName !== currentName) {
      onSave(trimmedName);
    }
    onClose();
  };

  const handleCancel = () => {
    setName(currentName); // Reset to original
    onClose();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }]
  }));

  if (!modalVisible) return null;

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      onRequestClose={handleCancel}
      statusBarTranslucent
    >
      <Pressable
        className="flex-1 items-center justify-center bg-black/50"
        onPress={handleCancel}
      >
        <Animated.View style={animatedStyle}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View className="mx-6 w-80 max-w-full rounded-lg bg-background p-6 shadow-lg">
              <Text className="mb-4 text-xl font-bold text-foreground">
                Rename Asset
              </Text>

              <Input
                ref={inputRef}
                value={name}
                onChangeText={setName}
                placeholder="Enter asset name"
                selectTextOnFocus
                onSubmitEditing={handleSave}
                returnKeyType="done"
                className="mb-6"
              />

              <View className="flex-row gap-3">
                <Button
                  variant="outline"
                  onPress={handleCancel}
                  className="flex-1"
                >
                  <Text>Cancel</Text>
                </Button>
                <Button onPress={handleSave} className="flex-1">
                  <Text>Save</Text>
                </Button>
              </View>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
