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
import { useLocalStore } from '@/store/localStore';
import { useHybridData } from './useHybridData';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import type { asset_content_link, language } from '@/db/drizzleSchema';
import { project } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useLocalization } from '@/hooks/useLocalization';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { resolveTable } from '@/utils/dbUtils';
import { SHOW_DEV_ELEMENTS } from '@/utils/featureFlags';
import { deleteIfExists } from '@/utils/fileUtils';
import { cn } from '@/utils/styleUtils';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { eq } from 'drizzle-orm';
import {
  MicIcon,
  Lightbulb,
  TextIcon,
  EyeIcon,
  XIcon,
  RefreshCwIcon
} from 'lucide-react-native';
import React, { useState, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import {
  Alert,
  ActivityIndicator,
  View,
  Pressable,
  Modal,
  ScrollView,
  TouchableWithoutFeedback,
  type TextInput
} from 'react-native';
import { z } from 'zod';
import { useNearbyTranslations } from '@/hooks/useNearbyTranslations';
import { useTranslationPrediction } from '@/hooks/useTranslationPrediction';
import { useLanguageById } from '@/hooks/db/useLanguages';
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
  const { currentProjectId, currentQuestId, currentProjectData } =
    useAppNavigation();
  const { t } = useLocalization();
  const { currentUser, isAuthenticated } = useAuth();
  const setAuthView = useLocalStore((state) => state.setAuthView);
  const isOnline = useNetworkStatus();
  const enableAiSuggestions = useLocalStore(
    (state) => state.enableAiSuggestions
  );
  const [translationType, setTranslationType] =
    useState<TranslationType>('text');

  // Query project data using hybrid data (supports anonymous users)
  const isPowerSyncReady = React.useMemo(
    () => system.isPowerSyncInitialized(),
    []
  );

  const projectOfflineQuery = React.useMemo(() => {
    if (!isPowerSyncReady || !isAuthenticated) {
      return 'SELECT * FROM project WHERE 1=0' as any;
    }
    return toCompilableQuery(
      system.db.query.project.findFirst({
        where: currentProjectId ? eq(project.id, currentProjectId) : undefined
      })
    );
  }, [currentProjectId, isPowerSyncReady, isAuthenticated]);

  const { data: queriedProjectDataArray } = useHybridData({
    dataType: 'project-new-translation',
    queryKeyParams: [currentProjectId || ''],
    offlineQuery: projectOfflineQuery,
    cloudQueryFn: async () => {
      if (!currentProjectId) return [];
      const { data, error } = await system.supabaseConnector.client
        .from('project')
        .select('*')
        .eq('id', currentProjectId)
        .limit(1)
        .overrideTypes<(typeof project.$inferSelect)[]>();
      if (error) throw error;
      return data;
    },
    enableCloudQuery: !!currentProjectId && !currentProjectData,
    enableOfflineQuery: !!currentProjectId && !currentProjectData
  });

  const queriedProjectData = queriedProjectDataArray?.[0];

  // Prefer passed project data for instant rendering
  const projectData = currentProjectData || queriedProjectData;

  const { hasAccess: canTranslate } = useUserPermissions(
    currentProjectId || '',
    'translate',
    (projectData as Record<string, unknown>)?.private as boolean | undefined
  );

  React.useEffect(() => {
    if (__DEV__ && visible && !translationLanguageId) {
      console.error(
        '[NEW TRANSLATION MODAL] ERROR: translationLanguageId is empty!'
      );
    }
  }, [visible, translationLanguageId]);

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
    disabled: !currentUser?.id || !canTranslate,
    mode: 'onChange'
  });

  const subscription = useWatch({ control: form.control });
  const isValid =
    canTranslate &&
    ((translationType === 'text' && !!subscription.text) ||
      (translationType === 'audio' && !!subscription.audioUri));

  // State for AI prediction
  const [predictedTranslation, setPredictedTranslation] = useState<
    string | null
  >(null);
  const [predictionDetails, setPredictionDetails] = useState<{
    rawResponse: string;
    examples: { source: string; target: string }[];
  } | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Track cursor position for word insertion
  const [cursorPosition, setCursorPosition] = useState<number | null>(null);
  const textareaRef = useRef<TextInput>(null);

  // Handle word insertion at cursor position
  const handleWordTap = (word: string) => {
    const currentText = form.getValues('text') || '';
    const insertPosition = cursorPosition ?? currentText.length;

    // Insert word with a space before it if not at start and previous char is not space
    const spaceBefore =
      insertPosition > 0 && currentText[insertPosition - 1] !== ' ' ? ' ' : '';
    // Don't add space after punctuation
    const spaceAfter = word && !/[.,!?;:]$/.test(word) ? ' ' : '';

    const newText =
      currentText.slice(0, insertPosition) +
      spaceBefore +
      word +
      spaceAfter +
      currentText.slice(insertPosition);

    form.setValue('text', newText);

    // Update cursor position to after the inserted word
    const newCursorPosition =
      insertPosition + spaceBefore.length + word.length + spaceAfter.length;
    setCursorPosition(newCursorPosition);

    // Set selection on the textarea without changing focus
    setTimeout(() => {
      try {
        textareaRef.current?.setNativeProps({
          selection: { start: newCursorPosition, end: newCursorPosition }
        });
      } catch (error) {
        // Fallback if ref is not available
        console.warn('[WORD TAP] Could not set cursor position:', error);
      }
    }, 0);
  };

  // Split translation into words for tapping
  const splitIntoWords = (text: string): string[] => {
    // Split on whitespace but keep punctuation attached to words
    return text.split(/\s+/).filter((word) => word.length > 0);
  };

  // Get source language ID from asset content or prop
  const sourceLanguageId =
    assetContent?.[0]?.source_language_id || sourceLanguage?.id || null;

  // Query language names (source language is optional, target is required)
  // Only query when modal is visible to avoid unnecessary queries
  const { language: sourceLanguageData } = useLanguageById(
    visible ? sourceLanguageId || undefined : undefined
  );
  const { language: targetLanguageData } = useLanguageById(
    visible ? translationLanguageId : ''
  );

  // Get nearby translations for examples (only when modal is visible to avoid unnecessary queries)
  // Note: useNearbyTranslations now automatically selects only the highest-rated translation per asset
  // and limits to 30 examples maximum (hardcoded)
  const { data: nearbyExamples = [], isLoading: isLoadingExamples } =
    useNearbyTranslations(
      visible ? currentQuestId || undefined : undefined,
      visible ? translationLanguageId : ''
    );

  // Translation prediction hook
  const { mutateAsync: predictTranslation, isPending: isPredicting } =
    useTranslationPrediction();

  // Get first content text as preview
  const contentPreview = assetContent?.[0]?.text || '';

  // Button disabled only when actively predicting (prevents double-clicks)
  const isButtonDisabled = isPredicting;

  React.useEffect(() => {
    if (visible) {
      form.reset();
      setPredictedTranslation(null);
      setPredictionDetails(null);
      setShowDetailsModal(false);
      setCursorPosition(null);
    }
  }, [visible, form]);

  // Warn if modal opens without permission or if anonymous
  React.useEffect(() => {
    if (visible && (!isAuthenticated || !canTranslate)) {
      console.warn(
        '[NEW TRANSLATION MODAL] Modal opened without permission or anonymous user'
      );
      if (!isAuthenticated) {
        Alert.alert(t('signInRequired'), t('signInToSaveOrContribute'));
        setAuthView('sign-in');
      } else {
        Alert.alert(t('error'), t('membersOnly'));
      }
      onClose();
    }
  }, [visible, canTranslate, isAuthenticated, onClose, t, setAuthView]);

  const { mutateAsync: createTranslation } = useMutation({
    mutationFn: async (data: TranslationFormData) => {
      if (translationType === 'text' && !data.text) {
        throw new Error(t('enterTranslation'));
      }
      if (translationType === 'audio' && !data.audioUri) {
        throw new Error('Please record audio');
      }

      if (!translationLanguageId || !currentProjectId || !currentQuestId) {
        throw new Error('Missing required context');
      }

      let audioAttachment: string | null = null;
      if (data.audioUri && system.permAttachmentQueue) {
        if (data.audioUri.includes('blob:')) {
          throw new Error(
            'Audio recording failed to save locally. Please try recording again.'
          );
        }

        const attachment = await system.permAttachmentQueue.saveAudio(
          data.audioUri
        );
        audioAttachment = attachment.filename;
      }

      // Guard against anonymous users
      if (!currentUser?.id || !isAuthenticated) {
        throw new Error('Must be logged in to create translations');
      }

      // Guard against PowerSync not being initialized
      if (!system.isPowerSyncInitialized()) {
        throw new Error('System not initialized - cannot create translations');
      }

      console.log('[CREATE TRANSLATION] Starting transaction...');
      await system.db.transaction(async (tx) => {
        const [newAsset] = await tx
          .insert(resolveTable('asset'))
          .values({
            source_asset_id: assetId,
            source_language_id: translationLanguageId,
            project_id: currentProjectId,
            creator_id: currentUser!.id,
            download_profiles: [currentUser!.id]
          })
          .returning();

        if (!newAsset) {
          throw new Error('Failed to insert asset');
        }

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

        if (translationType === 'text' && data.text) {
          contentValues.text = data.text;
        } else if (translationType === 'audio' && audioAttachment) {
          contentValues.audio = [audioAttachment];
        }

        await tx
          .insert(resolveTable('asset_content_link'))
          .values(contentValues);

        await tx.insert(resolveTable('quest_asset_link')).values({
          quest_id: currentQuestId,
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
    setPredictedTranslation(null);
    onClose();
  };

  const handlePredictTranslation = async () => {
    if (!contentPreview.trim()) {
      Alert.alert(
        'No Source Text',
        'There is no source text to translate. Please select an asset with content.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (!isOnline) {
      Alert.alert(
        'Offline',
        'AI translation requires an internet connection. Please check your network and try again.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (!targetLanguageData) {
      Alert.alert(
        'Missing Language Info',
        'Target language information is not available. Please select a target language.',
        [{ text: 'OK' }]
      );
      return;
    }

    const sourceText = contentPreview.trim();

    try {
      // Source language is optional - use "Unknown" if not available
      const sourceLanguageName =
        sourceLanguageData?.native_name ||
        sourceLanguageData?.english_name ||
        sourceLanguage?.native_name ||
        sourceLanguage?.english_name ||
        'Unknown';
      const targetLanguageName =
        targetLanguageData.native_name ||
        targetLanguageData.english_name ||
        'Unknown';

      if (__DEV__) {
        console.log(
          '[AI PREDICTION] Nearby examples count:',
          nearbyExamples.length
        );
        console.log('[AI PREDICTION] Quest ID:', currentQuestId);
        console.log(
          '[AI PREDICTION] Target language ID:',
          translationLanguageId
        );
        if (nearbyExamples.length > 0) {
          console.log('[AI PREDICTION] First example:', nearbyExamples[0]);
        }
      }

      const result = await predictTranslation({
        sourceText,
        examples: nearbyExamples,
        sourceLanguageName,
        targetLanguageName
      });

      if (__DEV__) {
        console.log(
          '[AI PREDICTION] Raw response received:',
          result.rawResponse?.substring(0, 100)
        );
      }

      setPredictedTranslation(result.translation);
      setPredictionDetails({
        rawResponse: result.rawResponse || result.translation,
        examples: nearbyExamples || []
      });
    } catch (error) {
      console.error('[AI PREDICTION] Error:', error);
      Alert.alert(
        t('error'),
        `Failed to predict translation: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  };

  return (
    <Drawer
      open={visible}
      onOpenChange={(open) => !open && handleClose()}
      snapPoints={['80%']}
      enableDynamicSizing={false}
    >
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
                <TabsContent value="text" className="min-h-36">
                  <View className="gap-3">
                    {/* AI Prediction Preview */}
                    {enableAiSuggestions && predictedTranslation ? (
                      <View className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
                        <View className="mb-3 flex-row items-center justify-between">
                          <View className="flex-row items-center gap-2">
                            <Icon
                              as={Lightbulb}
                              size={18}
                              className="text-primary"
                            />
                          </View>
                          <View className="flex-row items-center gap-2">
                            {predictionDetails && (
                              <Pressable
                                onPress={() => setShowDetailsModal(true)}
                                className="rounded-md border border-primary/30 bg-background p-2"
                              >
                                <Icon
                                  as={EyeIcon}
                                  size={18}
                                  className="text-primary"
                                />
                              </Pressable>
                            )}
                            <Pressable
                              onPress={() => {
                                void handlePredictTranslation();
                              }}
                              disabled={isButtonDisabled}
                              className={cn(
                                'rounded-md border border-primary/30 bg-background p-2',
                                isButtonDisabled && 'opacity-50'
                              )}
                            >
                              {isPredicting || isLoadingExamples ? (
                                <ActivityIndicator size="small" color="#000" />
                              ) : (
                                <Icon
                                  as={RefreshCwIcon}
                                  size={18}
                                  className="text-primary"
                                />
                              )}
                            </Pressable>
                          </View>
                        </View>
                        <View
                          className="flex-row flex-wrap gap-1"
                          onStartShouldSetResponder={() => true}
                          onResponderTerminationRequest={() => false}
                        >
                          {predictedTranslation &&
                            splitIntoWords(predictedTranslation).map(
                              (word, idx) => (
                                <Pressable
                                  key={`${word}-${idx}`}
                                  onPress={() => handleWordTap(word)}
                                  className="rounded-md bg-primary/10 px-2 py-1 active:bg-primary/20"
                                >
                                  <Text className="text-base leading-6 text-foreground">
                                    {word}
                                  </Text>
                                </Pressable>
                              )
                            )}
                        </View>
                      </View>
                    ) : (
                      enableAiSuggestions &&
                      translationType === 'text' && (
                        <View className="flex-row justify-end">
                          <Pressable
                            onPress={() => {
                              void handlePredictTranslation();
                            }}
                            disabled={isButtonDisabled}
                            className={cn(
                              'flex-row items-center gap-2 rounded-lg border-2 px-4 py-2',
                              isButtonDisabled
                                ? 'border-muted-foreground bg-muted opacity-50'
                                : 'border-primary bg-primary shadow-md'
                            )}
                          >
                            {isPredicting || isLoadingExamples ? (
                              <>
                                <ActivityIndicator size="small" color="#fff" />
                                <Text className="text-sm font-semibold text-primary-foreground">
                                  {isPredicting
                                    ? 'Predicting...'
                                    : 'Loading...'}
                                </Text>
                              </>
                            ) : (
                              <>
                                <Icon
                                  as={Lightbulb}
                                  size={18}
                                  className="text-primary-foreground"
                                />
                                <Text className="text-sm font-semibold text-primary-foreground">
                                  Predict Translation
                                </Text>
                              </>
                            )}
                          </Pressable>
                        </View>
                      )
                    )}
                    <FormField
                      control={form.control}
                      name="text"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Textarea
                              {...transformInputProps(field)}
                              ref={textareaRef}
                              placeholder={t('enterTranslation')}
                              drawerInput
                              onSelectionChange={(e) => {
                                setCursorPosition(
                                  e.nativeEvent.selection.start
                                );
                              }}
                              onFocus={() => {
                                const text = form.getValues('text') || '';
                                setCursorPosition(text.length);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </View>
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
                (data) => createTranslation(data),
                () => {
                  if (__DEV__) {
                    console.error(
                      '[CREATE TRANSLATION] Form validation failed'
                    );
                  }
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

      {/* AI Prediction Details Modal */}
      {enableAiSuggestions && (
        <Modal
          visible={showDetailsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDetailsModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowDetailsModal(false)}>
          <Pressable className="flex-1 items-center justify-center bg-black/50">
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View className="w-[90%] max-w-lg rounded-lg bg-background p-6">
                <View className="mb-4 flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <Icon as={Lightbulb} size={20} className="text-primary" />
                    <Text className="text-lg font-bold text-foreground">
                      Translation Details
                    </Text>
                  </View>
                  <Pressable
                    className="p-1"
                    onPress={() => setShowDetailsModal(false)}
                  >
                    <Icon as={XIcon} size={24} className="text-foreground" />
                  </Pressable>
                </View>

                <ScrollView className="max-h-[80%]">
                  {/* Examples Section */}
                  {predictionDetails && (
                    <View className="mb-6">
                      <Text className="mb-3 text-base font-semibold text-foreground">
                        Examples Used ({predictionDetails.examples.length})
                      </Text>
                      {predictionDetails.examples.length > 0 ? (
                        <View className="gap-3">
                          {predictionDetails.examples.map((example, index) => (
                            <View
                              key={index}
                              className="rounded-lg border border-border bg-muted/30 p-3"
                            >
                              <View className="mb-2">
                                <Text className="text-xs font-semibold uppercase text-muted-foreground">
                                  Source
                                </Text>
                                <Text className="mt-1 text-sm leading-5 text-foreground">
                                  {example.source}
                                </Text>
                              </View>
                              <View>
                                <Text className="text-xs font-semibold uppercase text-muted-foreground">
                                  Target
                                </Text>
                                <Text className="mt-1 text-sm leading-5 text-foreground">
                                  {example.target}
                                </Text>
                              </View>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <View className="rounded-lg border border-border bg-muted/30 p-4">
                          <Text className="text-sm text-muted-foreground">
                            No examples were available. Examples are retrieved
                            from other assets in the same quest/chapter that
                            have translations in the target language.
                          </Text>
                          <Text className="mt-2 text-xs text-muted-foreground">
                            This means either:
                          </Text>
                          <Text className="mt-1 text-xs text-muted-foreground">
                            • No translations exist yet in{' '}
                            {targetLanguageData?.native_name ||
                              targetLanguageData?.english_name ||
                              'the target language'}{' '}
                            for assets in this quest
                          </Text>
                          <Text className="mt-1 text-xs text-muted-foreground">
                            • The quest has no other assets with text content
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Raw Response Section */}
                  {predictionDetails && (
                    <View>
                      <Text className="mb-3 text-base font-semibold text-foreground">
                        Raw Model Response
                      </Text>
                      <View className="rounded-lg border border-border bg-muted/30 p-3">
                        <Text className="font-mono text-sm leading-5 text-foreground">
                          {predictionDetails.rawResponse}
                        </Text>
                      </View>
                    </View>
                  )}
                </ScrollView>

                <Pressable
                  className="mt-4 rounded-md bg-primary px-4 py-2.5"
                  onPress={() => setShowDetailsModal(false)}
                >
                  <Text className="text-center text-sm font-semibold text-primary-foreground">
                    Close
                  </Text>
                </Pressable>
              </View>
            </TouchableWithoutFeedback>
          </Pressable>
        </TouchableWithoutFeedback>
        </Modal>
      )}
    </Drawer>
  );
}
