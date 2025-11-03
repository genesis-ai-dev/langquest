import AudioRecorder from '@/components/AudioRecorder';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerScrollView,
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
import { project } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useLocalization } from '@/hooks/useLocalization';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useQuery } from '@tanstack/react-query';
import { eq } from 'drizzle-orm';
import { resolveTable } from '@/utils/dbUtils';
import { SHOW_DEV_ELEMENTS } from '@/utils/featureFlags';
import { deleteIfExists } from '@/utils/fileUtils';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { MicIcon, TextIcon } from 'lucide-react-native';
import React, { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Alert, View } from 'react-native';
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
  translationLanguageId: string; // The language of the new translation asset being created
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
  translationLanguageId
}: NextGenNewTranslationModalProps) {
  const { currentProjectId, currentQuestId, currentProjectData } = useAppNavigation();
  const { t } = useLocalization();
  const { currentUser } = useAuth();
  const isOnline = useNetworkStatus();
  const [translationType, setTranslationType] =
    useState<TranslationType>('text');

  // Query project data to get privacy status for permission check
  const { data: queriedProjectData } = useQuery({
    queryKey: ['project', 'offline', currentProjectId],
    queryFn: async () => {
      if (!currentProjectId) return null;
      // Try local first then cloud
      let result = await system.db
        .select()
        .from(project)
        .where(eq(project.id, currentProjectId))
        .limit(1);
      if (!result[0]) {
        result = await system.db
          .select()
          .from(project)
          .where(eq(project.id, currentProjectId))
          .limit(1);
      }
      return result[0] || null;
    },
    enabled: !!currentProjectId && !currentProjectData,
    staleTime: 30000
  });

  // Prefer passed project data for instant rendering
  const projectData = currentProjectData || queriedProjectData;

  // Check translate permission
  const { hasAccess: canTranslate } = useUserPermissions(
    currentProjectId || '',
    'translate',
    projectData?.private as boolean | undefined
  );

  // Debug logging for context
  React.useEffect(() => {
    if (visible) {
      console.log('[NEW TRANSLATION MODAL] Modal opened with context:', {
        assetId,
        currentQuestId,
        currentProjectId,
        translationLanguageId,
        hasCurrentUser: !!currentUser
      });

      if (!translationLanguageId) {
        console.error(
          '[NEW TRANSLATION MODAL] ERROR: translationLanguageId is empty! This should never happen.'
        );
      }
    }
  }, [
    visible,
    assetId,
    currentQuestId,
    currentProjectId,
    translationLanguageId,
    currentUser
  ]);

  // Simpler schema - just validate that fields exist when provided
  const translationSchema = z.object({
    text: z.string().trim().optional(),
    audioUri: z.string().optional()
  });

  type TranslationFormData = z.infer<typeof translationSchema>;

  const form = useForm<TranslationFormData>({
    defaultValues: {
      text: '',
      audioUri: ''
    },
    resolver: zodResolver(translationSchema),
    disabled: !currentUser?.id || !canTranslate
  });

  const subscription = useWatch({ control: form.control });
  const isValid =
    canTranslate &&
    ((translationType === 'text' && !!subscription.text) ||
      (translationType === 'audio' && !!subscription.audioUri));

  // Reset form when modal opens
  React.useEffect(() => {
    if (visible) {
      form.reset();
    }
  }, [visible, form]);

  // Warn if modal opens without permission
  React.useEffect(() => {
    if (visible && !canTranslate) {
      console.warn('[NEW TRANSLATION MODAL] Modal opened without translate permission');
      Alert.alert(
        t('error'),
        t('membersOnly')
      );
      onClose();
    }
  }, [visible, canTranslate, onClose, t]);

  const { mutateAsync: createTranslation } = useMutation({
    mutationFn: async (data: TranslationFormData) => {
      console.log('[CREATE TRANSLATION] Starting with data:', {
        translationType,
        hasText: !!data.text,
        hasAudioUri: !!data.audioUri,
        audioUri: data.audioUri?.substring(0, 50),
        translationLanguageId,
        currentProjectId,
        currentQuestId
      });

      // Validate that the appropriate field is filled based on translation type
      if (translationType === 'text' && !data.text) {
        throw new Error(t('enterTranslation'));
      }
      if (translationType === 'audio' && !data.audioUri) {
        throw new Error('Please record audio');
      }

      // Validate required context - these should never be missing if the modal opened correctly
      if (!translationLanguageId) {
        throw new Error(
          'Translation language is missing. This is an unexpected error.'
        );
      }
      if (!currentProjectId) {
        throw new Error(
          'Project context is missing. This is an unexpected error.'
        );
      }
      if (!currentQuestId) {
        throw new Error(
          'Quest context is missing. This is an unexpected error.'
        );
      }

      let audioAttachment: string | null = null;
      if (data.audioUri && system.permAttachmentQueue) {
        // Validate that the audio URI is not a blob URL
        if (data.audioUri.includes('blob:')) {
          throw new Error(
            'Audio recording failed to save locally. Please try recording again.'
          );
        }

        console.log('[CREATE TRANSLATION] Saving audio to permanent queue...');
        const attachment = await system.permAttachmentQueue.saveAudio(
          data.audioUri
        );
        audioAttachment = attachment.filename;
        console.log('[CREATE TRANSLATION] Audio saved:', audioAttachment);
      }

      console.log('[CREATE TRANSLATION] Starting transaction...');
      await system.db.transaction(async (tx) => {
        // Create a new asset that points to the original asset (translation variant)
        // In the new schema: translation = asset with source_asset_id pointing to original
        console.log(
          '[CREATE TRANSLATION] Inserting asset (translation variant)...'
        );
        const [newAsset] = await tx
          .insert(resolveTable('asset')) // only insert into synced table
          .values({
            source_asset_id: assetId, // Points to the original asset being translated
            source_language_id: translationLanguageId, // The language this translation is IN
            project_id: currentProjectId,
            creator_id: currentUser!.id,
            download_profiles: [currentUser!.id]
          })
          .returning();

        if (!newAsset) {
          throw new Error('Failed to insert asset');
        }
        console.log(
          '[CREATE TRANSLATION] Translation asset created:',
          newAsset.id
        );

        // Create asset_content_link with the actual text/audio content
        const contentValues: {
          asset_id: string;
          source_language_id: string;
          download_profiles: string[];
          text?: string;
          audio?: string[];
        } = {
          asset_id: newAsset.id,
          source_language_id: translationLanguageId,
          download_profiles: [currentUser!.id]
        };

        // Add text or audio depending on translation type
        if (translationType === 'text' && data.text) {
          contentValues.text = data.text;
        } else if (translationType === 'audio' && audioAttachment) {
          contentValues.audio = [audioAttachment];
        }

        console.log(
          '[CREATE TRANSLATION] Inserting asset_content_link:',
          JSON.stringify(contentValues, null, 2)
        );

        await tx
          .insert(resolveTable('asset_content_link'))
          .values(contentValues);

        console.log('[CREATE TRANSLATION] Content link created');

        // Create quest_asset_link (composite primary key: quest_id + asset_id, no id field)
        console.log('[CREATE TRANSLATION] Inserting quest_asset_link...');
        await tx.insert(resolveTable('quest_asset_link')).values({
          quest_id: currentQuestId,
          asset_id: newAsset.id,
          download_profiles: [currentUser!.id]
        });

        console.log('[CREATE TRANSLATION] Quest asset link created');
      });

      console.log('[CREATE TRANSLATION] Transaction complete!');
    },
    onSuccess: () => {
      form.reset();
      Alert.alert(t('success'), t('translationSubmittedSuccessfully'));
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      console.error('[CREATE TRANSLATION] Error creating translation:', error);
      console.error('[CREATE TRANSLATION] Error stack:', error.stack);
      Alert.alert(
        t('error'),
        t('failedCreateTranslation') + '\n\n' + error.message
      );
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

          <DrawerScrollView className="pb-safe flex-1 flex-col gap-4 px-4">
            {/* Translation Type Tabs */}
            <Tabs
              value={translationType}
              onValueChange={(value) =>
                setTranslationType(value as TranslationType)
              }
            >
              <TabsList className="w-full flex-row">
                <TabsTrigger value="text" className="flex-1 items-center py-2">
                  <Icon as={TextIcon} size={20} />
                  <Text className="text-base">{t('text')}</Text>
                </TabsTrigger>
                <TabsTrigger value="audio" className="flex-1 items-center py-2">
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
                  {translationType === 'text' ? t('translation') : t('audio')}:
                </Text>

                <TabsContent value="text" className="min-h-36">
                  <FormField
                    control={form.control}
                    name="text"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Textarea
                            {...transformInputProps(field)}
                            placeholder={t('enterTranslation')}
                            drawerInput
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
          </DrawerScrollView>

          <DrawerFooter>
            {!canTranslate && (
              <View className="mb-4 rounded-md bg-destructive/10 p-3">
                <Text className="text-center text-sm text-destructive">
                  {t('membersOnly')}
                </Text>
              </View>
            )}
            <FormSubmit
              disabled={!isValid || !canTranslate}
              onPress={form.handleSubmit(
                (data) => {
                  console.log(
                    '[CREATE TRANSLATION] Form validation passed, submitting:',
                    {
                      translationType,
                      hasText: !!data.text,
                      hasAudioUri: !!data.audioUri,
                      audioUri: data.audioUri?.substring(0, 100)
                    }
                  );
                  return createTranslation(data);
                },
                (errors) => {
                  console.error(
                    '[CREATE TRANSLATION] Form validation failed:',
                    {
                      errors,
                      translationType,
                      formValues: form.getValues()
                    }
                  );
                  Alert.alert(t('error'), t('fillFields'));
                }
              )}
            >
              <Text className="text-base font-bold">{t('createObject')}</Text>
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
