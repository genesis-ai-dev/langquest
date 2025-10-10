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
import { translationService } from '@/database_services/translationService';
import type { asset_content_link, language } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useLocalization } from '@/hooks/useLocalization';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { SHOW_DEV_ELEMENTS } from '@/utils/devConfig';
import { deleteIfExists } from '@/utils/fileUtils';
import { zodResolver } from '@hookform/resolvers/zod';
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
  assetName: string;
  assetContent?: AssetContent[];
  sourceLanguage?: typeof language.$inferSelect | null;
  targetLanguageId: string;
}

type TranslationType = 'text' | 'audio';

const translationSchema = z.object({
  text: z.string().min(1, 'Translation text is required')
});

type TranslationFormData = z.infer<typeof translationSchema>;

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
  const { t } = useLocalization();
  const { currentUser } = useAuth();
  const isOnline = useNetworkStatus();
  const [_isSubmitting, setIsSubmitting] = useState(false);
  const [translationType, setTranslationType] =
    useState<TranslationType>('text');
  const [audioUri, setAudioUri] = useState<string | null>(null);

  const form = useForm<TranslationFormData>({
    resolver: zodResolver(translationSchema),
    defaultValues: {
      text: ''
    }
  });

  // Note: source language options restriction will be handled by parent; modal displays the selected sourceLanguage if provided

  const handleSubmit = async (data: TranslationFormData) => {
    if (!currentUser) {
      Alert.alert(t('error'), t('logInToTranslate'));
      return;
    }

    if (translationType === 'text' && !data.text.trim()) {
      Alert.alert(t('error'), t('fillFields'));
      return;
    }

    if (translationType === 'audio' && !audioUri) {
      Alert.alert(t('error'), t('fillFields'));
      return;
    }

    try {
      setIsSubmitting(true);

      let audioAttachment: string | null = null;
      if (audioUri && system.permAttachmentQueue) {
        const attachment = await system.permAttachmentQueue.saveAudio(audioUri);
        audioAttachment = attachment.filename;
      }

      // Use translationService to create the translation
      await translationService.createTranslation({
        text: translationType === 'text' ? data.text.trim() : '',
        target_language_id: targetLanguageId,
        asset_id: assetId,
        creator_id: currentUser.id,
        audio: audioAttachment
      });

      form.reset();
      setAudioUri(null);
      Alert.alert(t('success'), t('translationSubmittedSuccessfully'));
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error creating translation:', error);
      Alert.alert(t('error'), t('failedCreateTranslation'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecordingComplete = (uri: string) => {
    setAudioUri(uri);
  };

  const handleClose = () => {
    // Clean up audio file if exists
    if (audioUri) void deleteIfExists(audioUri);
    setAudioUri(null);
    form.reset();
    onClose();
  };

  // Get first content text as preview
  const contentPreview = assetContent?.[0]?.text || '';

  const canSubmit =
    (translationType === 'text' && form.watch('text').trim()) ||
    (translationType === 'audio' && audioUri);

  return (
    <Drawer
      open={visible}
      onOpenChange={(open) => !open && handleClose()}
      snapPoints={['85%']}
    >
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
                    {assetName}
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
                    <AudioRecorder
                      onRecordingComplete={handleRecordingComplete}
                      resetRecording={() => setAudioUri(null)}
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
              onPress={form.handleSubmit(handleSubmit)}
              disabled={!canSubmit}
              className="w-full"
            >
              <Text className="text-base font-bold">{t('submit')}</Text>
            </FormSubmit>
            <DrawerClose className="w-full">
              <Text>{t('cancel')}</Text>
            </DrawerClose>
          </DrawerFooter>
        </Form>
      </DrawerContent>
    </Drawer>
  );
}
