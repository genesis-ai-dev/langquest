/**
 * RenameAssetModal - Modal for renaming assets
 */

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import React from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  type TextInput,
  View
} from 'react-native';

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
  const inputRef = React.useRef<TextInput>(null);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.9)).current;

  // Update local state when currentName changes
  React.useEffect(() => {
    setName(currentName);
  }, [currentName]);

  // Animate in/out and focus
  React.useEffect(() => {
    if (isVisible) {
      // Animate in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 65,
          useNativeDriver: true
        })
      ]).start(() => {
        // Focus after animation completes
        setTimeout(() => {
          inputRef.current?.focus();
        }, 50);
      });

      // Backup focus attempt in case animation callback doesn't fire
      const backupTimer = setTimeout(() => {
        inputRef.current?.focus();
      }, 300);

      return () => {
        clearTimeout(backupTimer);
      };
    } else {
      // Reset animations
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.9);
    }
  }, [isVisible, fadeAnim, scaleAnim]);

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

  if (!isVisible) return null;

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="none"
      onRequestClose={handleCancel}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <Pressable
          className="flex-1 items-center justify-center bg-black/50"
          onPress={handleCancel}
        >
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }]
            }}
          >
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
      </KeyboardAvoidingView>
    </Modal>
  );
}
