/**
 * RenameAssetDrawer - Drawer for renaming assets
 */

import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import React from 'react';
import type { TextInput } from 'react-native';
import { View } from 'react-native';

interface RenameAssetDrawerProps {
  isOpen: boolean;
  currentName: string;
  onOpenChange: (open: boolean) => void;
  onSave: (newName: string) => void;
}

export function RenameAssetDrawer({
  isOpen,
  currentName,
  onOpenChange,
  onSave
}: RenameAssetDrawerProps) {
  const [name, setName] = React.useState(currentName);
  const inputRef = React.useRef<TextInput>(null);

  React.useEffect(() => {
    setName(currentName);
  }, [currentName]);

  React.useEffect(() => {
    if (!isOpen) {
      setName(currentName);
      return;
    }

    const focusTimer = setTimeout(() => {
      inputRef.current?.focus();
    }, 200);

    return () => clearTimeout(focusTimer);
  }, [isOpen, currentName]);

  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) {
        setName(currentName);
      }
      onOpenChange(open);
    },
    [currentName, onOpenChange]
  );

  const handleSave = React.useCallback(() => {
    const trimmedName = name.trim();
    if (trimmedName && trimmedName !== currentName) {
      onSave(trimmedName);
    }
    handleOpenChange(false);
  }, [name, currentName, onSave, handleOpenChange]);

  return (
    <Drawer open={isOpen} onOpenChange={handleOpenChange} dismissible>
      <DrawerContent className="gap-4">
        <DrawerHeader>
          <DrawerTitle>Rename Asset</DrawerTitle>
        </DrawerHeader>

        <View className="gap-4">
          <Input
            ref={inputRef}
            value={name}
            onChangeText={setName}
            placeholder="Enter asset name"
            selectTextOnFocus
            onSubmitEditing={handleSave}
            returnKeyType="done"
            drawerInput
          />
        </View>

        <DrawerFooter className="flex flex-row gap-3">
          <DrawerClose className="flex-1">
            <Text>Cancel</Text>
          </DrawerClose>
          <Button onPress={handleSave} className="flex-1">
            <Text>Save</Text>
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
