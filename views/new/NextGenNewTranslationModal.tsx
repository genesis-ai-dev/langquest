import AudioRecorder from '@/components/AudioRecorder';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from '@/components/ui/drawer';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  FormSubmit,
  transformInputProps
} from '@/components/ui/form';
import { Icon } from '@/components/ui/icon';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import type { asset_content_link, language } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useLocalization } from '@/hooks/useLocalization';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { resolveTable } from '@/utils/dbUtils';
import { SHOW_DEV_ELEMENTS } from '@/utils/devConfig';
import { deleteIfExists } from '@/utils/fileUtils';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { MicIcon, TextIcon } from 'lucide-react-native';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert, ScrollView, View } from 'react-native';
import { z } from 'zod';
type AssetContent = typeof asset_content_link.$inferSelect;

interface NextGenNewTranslationModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  assetId: string;
  assetName?: string | null;
  assetContent?: AssetContent[];
  sourceLanguage?: typeof language.$inferSelect | null;
  targetLanguageId: string;
}

type TranslationType = 'text' | 'audio';

export default function NextGenNewTranslationModal({
  visible,
  onClose,
  onSuccess,
  assetId,
  assetName,
  assetContent,
  sourceLanguage,
  targetLanguageId
}: NextGenNewTranslationModalProps) {
  const { currentProjectId } = useAppNavigation();
  const { t } = useLocalization();
  const { currentUser } = useAuth();
  const isOnline = useNetworkStatus();
  const [translationType, setTranslationType] =
    useState<TranslationType>('text');

  const { currentQuestId } = useAppNavigation();

  const translationSchema = z
    .object({
      text: z.string().nonempty().trim().optional(),
      audioUri: z.string().nonempty().optional()
    })
    .refine(
      (data) =>
        (translationType === 'text' && data.text) ||
        (translationType === 'audio' && data.audioUri),
      {
        message: t('fillFields'),
        path: translationType === 'text' ? ['text'] : ['audioUri']
      }
    );

  type TranslationFormData = z.infer<typeof translationSchema>;

  const form = useForm<TranslationFormData>({
    resolver: zodResolver(translationSchema),
    disabled: !currentUser?.id
  });

  // Note: source language options restriction will be handled by parent; modal displays the selected sourceLanguage if provided

  const { mutateAsync: createTranslation } = useMutation({
    mutationFn: async (data: TranslationFormData) => {
      let audioAttachment: string | null = null;
      if (data.audioUri && system.permAttachmentQueue) {
        const attachment = await system.permAttachmentQueue.saveAudio(
          data.audioUri
        );
        audioAttachment = attachment.filename;
      }

      await system.db.transaction(async (tx) => {
        const [newAsset] = await tx
          .insert(resolveTable('asset')) // only insert into synced table
          .values({
            ...(translationType === 'text' && { text: data.text }),
            ...(translationType === 'audio' && { audio: audioAttachment }),
            source_asset_id: assetId,
            source_language_id: sourceLanguage?.id,
            project_id: currentProjectId!,
            creator_id: currentUser!.id,
            download_profiles: [currentUser!.id]
          })
          .returning();

        if (!newAsset) {
          throw new Error('Failed to insert asset');
        }

        // Create quest_asset_link
        await tx
          .insert(
            resolveTable('quest_asset_link') // only insert into synced table
          )
          .values({
            id: `${currentQuestId}_${newAsset.id}`,
            quest_id: currentQuestId!,
            asset_id: newAsset.id,
            download_profiles: [currentUser!.id]
          });
      });
    },
    onSuccess: () => {
      form.reset();
      Alert.alert(t('success'), t('translationSubmittedSuccessfully'));
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      console.error('Error creating translation:', error);
      Alert.alert(t('error'), t('failedCreateTranslation'));
    }
  });

  const handleClose = () => {
    // Clean up audio file if exists
    const audioUri = form.getValues('audioUri');
    if (audioUri) void deleteIfExists(audioUri);
    form.reset();
    onClose();
  };

  // Get first content text as preview
  const contentPreview = assetContent?.[0]?.text || '';

  return (
    <Drawer open={visible} onOpenChange={(open) => !open && handleClose()}>
      <DrawerContent className="pb-safe">
        <Form {...form}>
          <DrawerHeader>
            <DrawerTitle>{t('newTranslation')}</DrawerTitle>
          </DrawerHeader>

          <ScrollView
            className="flex-1"
            contentContainerStyle={{ flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View className="flex-col gap-4 px-4">
              {/* Translation Type Tabs */}
              <Tabs
                value={translationType}
                onValueChange={(value) =>
                  setTranslationType(value as TranslationType)
                }
              >
                <TabsList className="w-full flex-row">
                  <TabsTrigger
                    value="text"
                    className="flex-1 items-center py-2"
                  >
                    <Icon as={TextIcon} size={20} />
                    <Text className="text-base">{t('text')}</Text>
                  </TabsTrigger>
                  <TabsTrigger
                    value="audio"
                    className="flex-1 items-center py-2"
                  >
                    <Icon as={MicIcon} size={20} />
                    <Text className="text-base">{t('audio')}</Text>
                  </TabsTrigger>
                </TabsList>

                {/* Asset Info */}
                <View className="flex-col gap-1">
                  <Text className="text-lg font-bold text-foreground">
                    {assetName || t('unknown')}
                  </Text>
                  <Text className="text-sm text-muted-foreground">
                    {sourceLanguage?.native_name ||
                      sourceLanguage?.english_name ||
                      t('unknown')}{' '}
                    → {t('targetLanguage')}
                  </Text>
                </View>

                {/* Source Content Preview */}
                {contentPreview ? (
                  <View className="gap-1 rounded-lg bg-muted p-4">
                    <Text className="text-sm text-muted-foreground">
                      {t('source')}:
                    </Text>
                    <Text
                      className="text-base leading-6 text-foreground"
                      numberOfLines={3}
                    >
                      {contentPreview}
                    </Text>
                  </View>
                ) : null}

                {/* Translation Input */}
                <View className="flex-col gap-2">
                  <Text className="text-base font-bold text-foreground">
                    {t('your')}{' '}
                    {translationType === 'text' ? t('translation') : t('audio')}
                    :
                  </Text>

                  <TabsContent value="text" className="min-h-36">
                    <FormField
                      control={form.control}
                      name="text"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Textarea
                              placeholder={t('enterTranslation')}
                              autoFocus
                              {...transformInputProps(field)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TabsContent>

                  <TabsContent value="audio" className="min-h-36">
                    <FormField
                      control={form.control}
                      name="audioUri"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <AudioRecorder
                              onRecordingComplete={field.onChange}
                              resetRecording={() => field.onChange(null)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </TabsContent>
                </View>
              </Tabs>

              {/* Network Status */}
              {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */}
              {SHOW_DEV_ELEMENTS && (
                <View>
                  <Text className="text-center text-sm text-muted-foreground">
                    {isOnline ? `🟢 ${t('online')}` : `🔴 ${t('offline')}`} -{' '}
                    {t('readyToSubmit')}
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>

          <DrawerFooter>
            <FormSubmit
              onPress={form.handleSubmit((data) => createTranslation(data))}
              disabled={!currentQuestId}
              className="w-full"
            >
              <Text className="text-base font-bold">{t('submit')}</Text>
            </FormSubmit>
            <DrawerClose>
              <Text>{t('cancel')}</Text>
            </DrawerClose>
          </DrawerFooter>
        </Form>
      </DrawerContent>
    </Drawer>
  );
}
