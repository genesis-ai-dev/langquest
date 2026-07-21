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
import {
  parseQuestMetadata,
  updateQuestVersionLabel
} from '@/database_services/questService';
import { getQuestVersionLabel } from '@/utils/questVersionLabel';
import { cn } from '@/utils/styleUtils';
import React from 'react';
import type { TextInput } from 'react-native';
import { View } from 'react-native';

export interface QuestLabelHandlerProps {
  isOpen: boolean;
  questId: string;
  questName?: string | null;
  metadata: unknown;
  isPublished: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (versionLabel: string) => void;
}

export function QuestLabelHandler({
  isOpen,
  questId,
  questName,
  metadata,
  isPublished,
  onOpenChange,
  onSaved
}: QuestLabelHandlerProps) {
  const displayQuestName = questName?.trim() || 'Quest';
  const currentLabel = getQuestVersionLabel(metadata) ?? '';
  const [label, setLabel] = React.useState(currentLabel);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<TextInput>(null);

  React.useEffect(() => {
    setLabel(currentLabel);
    setError(null);
  }, [currentLabel, isOpen]);

  React.useEffect(() => {
    if (!isOpen || isPublished) return;

    const focusTimer = setTimeout(() => {
      inputRef.current?.focus();
    }, 200);

    return () => clearTimeout(focusTimer);
  }, [isOpen, isPublished]);

  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) {
        setLabel(currentLabel);
        setError(null);
      }
      onOpenChange(open);
    },
    [currentLabel, onOpenChange]
  );

  const handleSave = React.useCallback(async () => {
    if (isPublished) return;

    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      setError('Version label cannot be empty');
      return;
    }

    if (trimmedLabel === currentLabel) {
      handleOpenChange(false);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      parseQuestMetadata(metadata);
      await updateQuestVersionLabel(questId, trimmedLabel, metadata);
      onSaved?.(trimmedLabel);
      handleOpenChange(false);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Failed to save version label'
      );
    } finally {
      setIsSaving(false);
    }
  }, [
    currentLabel,
    handleOpenChange,
    isPublished,
    label,
    metadata,
    onSaved,
    questId
  ]);

  return (
    <Drawer open={isOpen} onOpenChange={handleOpenChange} dismissible>
      <DrawerContent asChild>
        <DrawerView className="gap-4">
          <DrawerHeader>
            <DrawerTitle>Quest Version Label</DrawerTitle>
          </DrawerHeader>

          {isPublished ? (
            <Text className="text-sm text-muted-foreground">
              Published quests cannot be renamed.
            </Text>
          ) : (
            <View className="gap-2">
              <View
                className={cn(
                  'w-full rounded-md border border-border bg-card px-3 py-3',
                  'shadow-sm shadow-black/5'
                )}
              >
                <View className="flex-row flex-wrap items-center">
                  <Text className="text-base text-muted-foreground">
                    {displayQuestName} ·{' '}
                  </Text>
                  <DrawerInput
                    // @ts-expect-error - DrawerInput ref type differs from RN TextInput
                    ref={inputRef}
                    className="min-w-20 flex-1 py-0 text-base leading-5 text-foreground"
                    value={label}
                    onChangeText={setLabel}
                    placeholder="#1"
                    selectTextOnFocus
                    onSubmitEditing={() => void handleSave()}
                    returnKeyType="done"
                    editable={!isSaving}
                  />
                </View>
              </View>
              {error ? (
                <Text className="text-sm text-destructive">{error}</Text>
              ) : null}
            </View>
          )}

          <DrawerFooter className="flex flex-row gap-3">
            <DrawerClose className="flex-1" disabled={isSaving}>
              <Text>Cancel</Text>
            </DrawerClose>
            {!isPublished ? (
              <Button
                onPress={() => void handleSave()}
                className="flex-1"
                disabled={isSaving}
              >
                <Text>{isSaving ? 'Saving...' : 'Save'}</Text>
              </Button>
            ) : null}
          </DrawerFooter>
        </DrawerView>
      </DrawerContent>
    </Drawer>
  );
}
