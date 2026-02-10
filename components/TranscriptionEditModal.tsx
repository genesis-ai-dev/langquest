import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/contexts/AuthContext';
import { system } from '@/db/powersync/system';
import { useLocalization } from '@/hooks/useLocalization';
import { resolveTable } from '@/utils/dbUtils';
import RNAlert from '@blazejkustra/react-native-alert';
import { useMutation } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface TranscriptionEditModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialText: string;
  sourceAssetId: string;
  projectId: string;
  languoidId: string;
  isLocalSource?: boolean; // Whether the source asset is local (prepublished) - transcriptions will be stored locally
}

export default function TranscriptionEditModal({
  visible,
  onClose,
  onSuccess,
  initialText,
  sourceAssetId,
  projectId,
  languoidId,
  isLocalSource = false
}: TranscriptionEditModalProps) {
  const { t } = useLocalization();
  const { currentUser, isAuthenticated } = useAuth();
  const [editedText, setEditedText] = useState(initialText);

  useEffect(() => {
    if (visible) {
      setEditedText(initialText);
    }
  }, [visible, initialText]);

  const saveTranscriptionMutation = useMutation({
    mutationFn: async (text: string) => {
      if (!currentUser?.id || !isAuthenticated) {
        throw new Error('Must be logged in to save transcription');
      }

      if (!system.isPowerSyncInitialized()) {
        throw new Error('System not initialized');
      }

      if (!text.trim()) {
        throw new Error('Transcription text cannot be empty');
      }

      // Use local tables for prepublished content, synced tables for published content
      const tableOptions = { localOverride: isLocalSource };
      console.log(
        `[SAVE TRANSCRIPTION] Starting transaction... (isLocalSource: ${isLocalSource})`
      );
      await system.db.transaction(async (tx) => {
        const [newAsset] = await tx
          .insert(resolveTable('asset', tableOptions))
          .values({
            source_asset_id: sourceAssetId,
            content_type: 'transcription',
            project_id: projectId,
            creator_id: currentUser.id,
            download_profiles: [currentUser.id]
          })
          .returning();

        if (!newAsset) {
          throw new Error('Failed to create transcription asset');
        }

        await tx
          .insert(resolveTable('asset_content_link', tableOptions))
          .values({
            asset_id: newAsset.id,
            languoid_id: languoidId,
            text: text.trim(),
            download_profiles: [currentUser.id]
          });

        console.log(
          '[SAVE TRANSCRIPTION] Created transcription asset:',
          newAsset.id
        );
      });
    },
    onSuccess: () => {
      RNAlert.alert(
        t('success') || 'Success',
        'Transcription saved successfully'
      );
      onSuccess?.();
      onClose();
    },
    onError: (error: Error) => {
      console.error('[SAVE TRANSCRIPTION] Error:', error);
      RNAlert.alert(
        t('error') || 'Error',
        error.message || 'Failed to save transcription'
      );
    }
  });

  const handleSave = () => {
    if (!editedText.trim()) {
      RNAlert.alert(t('error') || 'Error', 'Please enter some text');
      return;
    }
    saveTranscriptionMutation.mutate(editedText);
  };

  const handleClose = () => {
    if (editedText !== initialText && editedText.trim()) {
      RNAlert.alert(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to close?',
        [
          { text: t('cancel') || 'Cancel', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: onClose }
        ]
      );
    } else {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView className="flex-1 bg-background">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          {/* Header with X and Check buttons */}
          <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
            <TouchableOpacity onPress={handleClose} className="p-2">
              <Icon name="x" size={24} className="text-foreground" />
            </TouchableOpacity>

            <Text className="text-lg font-semibold">Edit Transcription</Text>

            <TouchableOpacity
              onPress={handleSave}
              disabled={
                saveTranscriptionMutation.isPending || !editedText.trim()
              }
              className="p-2"
            >
              {saveTranscriptionMutation.isPending ? (
                <ActivityIndicator size="small" />
              ) : (
                <Icon
                  name="check"
                  size={24}
                  className={
                    editedText.trim() ? 'text-primary' : 'text-muted-foreground'
                  }
                />
              )}
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View className="flex-1 p-4">
            <Text className="mb-2 text-sm text-muted-foreground">
              Review and edit the transcription before saving:
            </Text>
            <TextInput
              value={editedText}
              onChangeText={setEditedText}
              placeholder="Enter transcription text..."
              multiline
              textAlignVertical="top"
              className="flex-1 rounded-md border border-border bg-input p-3 text-base text-foreground"
              style={{ minHeight: 200 }}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
