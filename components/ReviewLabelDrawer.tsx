import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerInput,
  DrawerTitle,
  DrawerView
} from '@/components/ui/drawer';
import { Text } from '@/components/ui/text';
import { cn } from '@/utils/styleUtils';
import React from 'react';
import type { TextInput } from 'react-native';
import { View } from 'react-native';

interface ReviewLabelDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reviewLabel: string) => void;
}

export function ReviewLabelDrawer({
  isOpen,
  onOpenChange,
  onConfirm
}: ReviewLabelDrawerProps) {
  const [label, setLabel] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<TextInput>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    setLabel('');
    setError(null);
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;
    const focusTimer = setTimeout(() => {
      inputRef.current?.focus();
    }, 200);
    return () => clearTimeout(focusTimer);
  }, [isOpen]);

  const handleSave = () => {
    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      setError('Review label cannot be empty');
      return;
    }
    onConfirm(trimmedLabel);
    onOpenChange(false);
  };

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange} dismissible>
      <DrawerContent asChild>
        <DrawerView className="gap-4">
          <DrawerHeader>
            <DrawerTitle>Review Label</DrawerTitle>
          </DrawerHeader>

          <View className="gap-2">
            <View
              className={cn(
                'w-full rounded-md border border-border bg-card px-3 py-3',
                'shadow-sm shadow-black/5'
              )}
            >
              <DrawerInput
                // @ts-expect-error - DrawerInput ref type differs from RN TextInput
                ref={inputRef}
                className="w-full py-0 text-base leading-5 text-foreground"
                value={label}
                onChangeText={setLabel}
                placeholder="#1"
                selectTextOnFocus
                onSubmitEditing={handleSave}
                returnKeyType="done"
              />
            </View>
            {error ? (
              <Text className="text-sm text-destructive">{error}</Text>
            ) : null}
          </View>

          <DrawerFooter className="flex flex-row gap-3">
            <DrawerClose className="flex-1">
              <Text>Cancel</Text>
            </DrawerClose>
            <Button onPress={handleSave} className="flex-1">
              <Text>Save</Text>
            </Button>
          </DrawerFooter>
        </DrawerView>
      </DrawerContent>
    </Drawer>
  );
}
