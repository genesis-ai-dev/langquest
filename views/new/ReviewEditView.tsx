import AudioRecorder from '@/components/AudioRecorder';
import { ReviewAssetCard } from '@/components/ReviewAssetCard';
import { ReviewLabelDrawer } from '@/components/ReviewLabelDrawer';
import {
  OVERALL_FEEDBACK_AUDIO_ID,
  ReviewAudioPlayButton
} from '@/components/ReviewAudioPlayButton';
import {
  ReviewAudioPlayer,
  ReviewAudioPlayerSpacer
} from '@/components/ReviewAudioPlayer';
import { ResultOptions, ResultSoftBadge } from '@/components/ReviewResult';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from '@/components/ui/drawer';
import { Icon } from '@/components/ui/icon';
import { Progress } from '@/components/ui/progress';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import type {
  AssetResult,
  QuestResult
} from '@/database_services/reviewService';
import { findIncompleteSuggestedChanges } from '@/database_services/reviewService';
import { useAutosaveText } from '@/hooks/useAutosaveText';
import { useLocalization } from '@/hooks/useLocalization';
import type { AssetReviewContent } from '@/hooks/useReviewEditor';
import {
  EMPTY_ASSET_CONTENT,
  EMPTY_REVIEW_ASSET,
  ReviewDraftContext,
  useReviewDraft,
  useReviewDraftStore,
  useReviewEditor
} from '@/hooks/useReviewEditor';
import { useReviewUploadProgress } from '@/hooks/useReviewUploadProgress';
import {
  deleteIfExists,
  getLocalAttachmentUri,
  saveAudioLocally
} from '@/utils/fileUtils';
import { cn } from '@/utils/styleUtils';
import {
  formatVerseRangeLabel,
  getAssetVerseRange
} from '@/utils/verseLabelUtils';
import { router } from 'expo-router';
import type { LucideIcon } from 'lucide-react-native';
import {
  AudioLinesIcon,
  CheckCircleIcon,
  DatabaseIcon,
  MicIcon,
  SendIcon,
  Trash2Icon,
  TriangleAlertIcon,
  XIcon
} from 'lucide-react-native';
import { useImperativeHandle, useRef, useState } from 'react';
import type { Ref } from 'react';
import type { ScrollViewProps } from 'react-native';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  View
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import type { KeyboardAwareScrollViewRef } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';

interface ReviewEditViewProps {
  projectId: string;
  questId: string;
  reviewId?: string;
  origin?: string;
  subjectName?: string;
  /** Set when this screen is the first open of a new review. */
  promptReviewLabel?: string;
}

const MEASURE_METHODS = new Set<PropertyKey>([
  'measure',
  'measureInWindow',
  'measureLayout'
]);

// Lists may measure their scroll ref, but KeyboardAwareScrollView's handle only
// copies the scroll methods, so measuring is delegated to a same-sized frame.
function KeyboardAwareListScroll({
  ref,
  style,
  ...props
}: ScrollViewProps & { ref?: Ref<unknown> }) {
  const frameRef = useRef<View>(null);
  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);

  useImperativeHandle(
    ref,
    () =>
      new Proxy(
        {},
        {
          get: (_target, key): unknown => {
            const source = MEASURE_METHODS.has(key)
              ? frameRef.current
              : scrollRef.current;
            const value = (source as Record<PropertyKey, unknown> | null)?.[
              key
            ];
            return typeof value === 'function'
              ? (value as (...args: unknown[]) => unknown).bind(source)
              : value;
          }
        }
      ),
    []
  );

  return (
    <View ref={frameRef} style={style} collapsable={false}>
      <KeyboardAwareScrollView
        {...props}
        ref={scrollRef}
        style={{ flex: 1 }}
        bottomOffset={24}
      />
    </View>
  );
}

function renderKeyboardAwareScroll(props: ScrollViewProps) {
  return <KeyboardAwareListScroll {...props} />;
}

function ItemSeparator() {
  return <View className="h-3" />;
}

function deleteAudioFiles(values: string[]) {
  for (const value of values) {
    void deleteIfExists(getLocalAttachmentUri(value));
  }
}

function toAssetResult(questResult: QuestResult | null): AssetResult {
  return questResult ?? 'not_reviewed';
}

function pluralizeAssets(count: number) {
  return count === 1 ? '1 asset' : `${count} assets`;
}

function UploadProgressRow({
  label,
  icon,
  total,
  confirmed
}: {
  label: string;
  icon: LucideIcon;
  total: number;
  confirmed: number;
}) {
  const isComplete = total > 0 && confirmed >= total;
  const percent = total === 0 ? 0 : Math.round((confirmed / total) * 100);

  return (
    <View className="gap-1.5 py-2">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Icon as={icon} size={16} className="text-muted-foreground" />
          <Text className="text-sm">{label}</Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <Text className="font-mono text-xs text-muted-foreground">
            {confirmed}/{total}
          </Text>
          {isComplete ? (
            <Icon as={CheckCircleIcon} size={14} className="text-green-600" />
          ) : null}
        </View>
      </View>
      <Progress
        value={percent}
        indicatorClassName={cn(isComplete ? 'bg-green-600' : 'bg-primary')}
      />
    </View>
  );
}

function SubmitReviewDrawer({
  open,
  warnings,
  isSubmitting,
  isSubmitted,
  onConfirm,
  onClose
}: {
  open: boolean;
  warnings: string[];
  isSubmitting: boolean;
  isSubmitted: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useLocalization();
  const reviewId = useReviewDraft((state) => (open ? state.reviewId : null));
  const progress = useReviewUploadProgress(isSubmitted ? reviewId : null);

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next && !isSubmitting) onClose();
      }}
      snapPoints={[620]}
    >
      <DrawerContent className="pb-safe">
        <DrawerHeader>
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <DrawerTitle>{t('uploadStatus')}</DrawerTitle>
              <Text className="text-sm text-muted-foreground">
                {progress.isEmpty
                  ? t('nothingPublishedYet')
                  : progress.isComplete
                    ? t('allUploadsConfirmed')
                    : t('percentConfirmedByServer').replace(
                        '{percent}',
                        String(progress.percent)
                      )}
              </Text>
            </View>
            <DrawerClose variant="ghost" size="icon">
              <Icon as={XIcon} size={24} />
            </DrawerClose>
          </View>
        </DrawerHeader>

        <View className="gap-4">
          {!isSubmitted ? (
            <Text className="text-base leading-6">
              Once submitted, your review will be shared with every member of
              this project and can no longer be edited. Please make sure your
              statuses, comments and audio feedback are final before continuing.
            </Text>
          ) : null}

          {warnings.length > 0 && !isSubmitted ? (
            <Alert
              variant="warn"
              icon={TriangleAlertIcon}
              iconClassName="text-warning"
            >
              <AlertTitle>Before you submit</AlertTitle>
              {warnings.map((warning) => (
                <AlertDescription key={warning}>• {warning}</AlertDescription>
              ))}
            </Alert>
          ) : null}

          <View className="flex-col pb-2">
            <UploadProgressRow
              label={t('informationRecords')}
              icon={DatabaseIcon}
              total={progress.totalRecords}
              confirmed={progress.confirmedRecords}
            />
            <UploadProgressRow
              label={t('audioFiles')}
              icon={AudioLinesIcon}
              total={progress.breakdown.audio.total}
              confirmed={progress.breakdown.audio.confirmed}
            />
          </View>

          <View className="flex-row items-center justify-between rounded-lg bg-muted p-3">
            <Text className="text-sm font-semibold">{t('totalRecords')}:</Text>
            <Text className="font-mono text-sm text-muted-foreground">
              {progress.confirmedRecords + progress.confirmedAudio}/
              {progress.totalRecords + progress.totalAudio}
            </Text>
          </View>
        </View>

        <DrawerFooter>
          {!isSubmitted ? (
            <Button loading={isSubmitting} onPress={onConfirm}>
              <Text className="font-bold">Submit</Text>
            </Button>
          ) : null}
          <DrawerClose variant="outline" disabled={isSubmitting}>
            <Text>{isSubmitted ? t('close') : t('cancel')}</Text>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function SubmitReviewButton({
  assetNames
}: {
  assetNames: Map<string, string>;
}) {
  const store = useReviewDraftStore();
  const isSubmitted = useReviewDraft((state) => state.isSubmitted);
  const [isOpen, setIsOpen] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const collectWarnings = () => {
    const state = store.getState();
    const drafts = [...assetNames.keys()].map((assetId) => ({
      asset_id: assetId,
      ...EMPTY_REVIEW_ASSET,
      ...state.assets[assetId]
    }));
    const notReviewed = drafts.filter(
      (draft) => draft.asset_result === 'not_reviewed'
    ).length;
    const suggested = drafts.filter(
      (draft) => draft.asset_result === 'suggested_changes'
    ).length;
    const nextWarnings: string[] = [];
    if (notReviewed > 0) {
      nextWarnings.push(
        `${pluralizeAssets(notReviewed)} still ${notReviewed === 1 ? 'has' : 'have'} no status and will be submitted as not reviewed.`
      );
    }
    if (state.questResult === 'approved' && suggested > 0) {
      nextWarnings.push(
        `The overall status is Approved, but ${pluralizeAssets(suggested)} ${suggested === 1 ? 'is' : 'are'} marked as Suggested Changes.`
      );
    }
    return { drafts, nextWarnings, state };
  };

  const handleOpen = () => {
    Keyboard.dismiss();
    setWarnings(collectWarnings().nextWarnings);
    setIsOpen(true);
  };

  const handleConfirm = async () => {
    const { drafts, state } = collectWarnings();

    const incomplete = findIncompleteSuggestedChanges(drafts);
    if (incomplete.length > 0) {
      const names = incomplete
        .map((assetId) => assetNames.get(assetId) || assetId)
        .join(', ');
      toast.error('Missing feedback', {
        description: `Add a comment or audio to every asset marked as Suggested Changes: ${names}`
      });
      return;
    }

    if (!state.questResult) {
      toast.error('Missing overall status', {
        description: 'Choose an overall status before submitting the review.'
      });
      return;
    }

    if (
      state.questResult === 'suggested_changes' &&
      !state.conclusion.trim() &&
      state.conclusionAudio.length === 0
    ) {
      toast.error('Missing overall feedback', {
        description:
          'An overall status of Suggested Changes needs a comment or audio explaining what should change.'
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await store.getState().submit();
      toast.success('Review submitted');
    } catch (error) {
      console.error('[ReviewDraft] Failed to submit review:', error);
      toast.error(
        error instanceof Error && error.message === 'OFFLINE'
          ? 'Cannot submit while offline'
          : 'Could not submit the review. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    if (store.getState().isSubmitted) router.back();
  };

  return (
    <>
      <Button size="sm" onPress={handleOpen}>
        <Text>Submit</Text>
        <Icon as={SendIcon} size={16} />
      </Button>
      <SubmitReviewDrawer
        open={isOpen}
        warnings={warnings}
        isSubmitting={isSubmitting}
        isSubmitted={isSubmitted}
        onConfirm={() => void handleConfirm()}
        onClose={handleClose}
      />
    </>
  );
}

function OverallFeedback() {
  const questResult = useReviewDraft((state) => state.questResult);
  const setQuestResult = useReviewDraft((state) => state.setQuestResult);
  const [isResultPickerOpen, setIsResultPickerOpen] = useState(false);
  const status = toAssetResult(questResult);

  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="font-semibold">Overall Feedback</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Change overall status"
          hitSlop={8}
          onPress={() => setIsResultPickerOpen((open) => !open)}
          className="active:opacity-70"
        >
          <ResultSoftBadge result={status} />
        </Pressable>
      </View>

      {isResultPickerOpen ? (
        <ResultOptions
          result={status}
          onSelect={(value) => {
            setIsResultPickerOpen(false);
            if (value !== status) {
              void setQuestResult(value === 'not_reviewed' ? null : value);
            }
          }}
        />
      ) : null}

      <ConclusionField />
      <ConclusionAudio />
    </View>
  );
}

function ConclusionField() {
  const conclusion = useReviewDraft((state) => state.conclusion);
  const setConclusion = useReviewDraft((state) => state.setConclusion);
  const field = useAutosaveText(
    conclusion,
    (value) => void setConclusion(value)
  );

  return (
    <Textarea
      drawerInput={false}
      className="min-h-20"
      numberOfLines={Platform.select({ web: 2, native: 4 })}
      placeholder="Comment"
      value={field.text}
      onChangeText={field.change}
      onBlur={field.flush}
    />
  );
}

function ConclusionAudio() {
  const store = useReviewDraftStore();
  const audio = useReviewDraft((state) => state.conclusionAudio[0] ?? null);
  const setConclusionAudio = useReviewDraft(
    (state) => state.setConclusionAudio
  );
  const setRecordingAssetId = useReviewDraft(
    (state) => state.setRecordingAssetId
  );

  const handleRemove = async () => {
    const previous = store.getState().conclusionAudio;
    await setConclusionAudio([]);
    deleteAudioFiles(previous);
  };

  if (audio) {
    return (
      <View className="flex-row items-center gap-2">
        <ReviewAudioPlayButton
          size="icon-sm"
          audioId={OVERALL_FEEDBACK_AUDIO_ID}
          audioValues={[audio]}
        />
        <Text className="flex-1 text-sm">Audio feedback</Text>
        <Button
          variant="ghost"
          size="icon-sm"
          accessibilityLabel="Remove audio"
          onPress={() => void handleRemove()}
        >
          <Icon as={Trash2Icon} size={16} className="text-destructive" />
        </Button>
      </View>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="w-full rounded-xl border-primary"
      onPress={() => setRecordingAssetId(OVERALL_FEEDBACK_AUDIO_ID)}
    >
      <Icon as={MicIcon} size={16} className="text-primary" />
      <Text className="text-primary">Add audio</Text>
    </Button>
  );
}

function ReviewAssetListItem({
  assetId,
  name,
  verseLabel,
  content
}: {
  assetId: string;
  name: string;
  verseLabel: string | null;
  content: AssetReviewContent;
}) {
  const draft =
    useReviewDraft((state) => state.assets[assetId]) ?? EMPTY_REVIEW_ASSET;
  const patchAsset = useReviewDraft((state) => state.patchAsset);
  const setRecordingAssetId = useReviewDraft(
    (state) => state.setRecordingAssetId
  );

  const handleRemoveAudio = async () => {
    const previous = draft.audio;
    await patchAsset(assetId, { audio: [] });
    deleteAudioFiles(previous);
  };

  return (
    <ReviewAssetCard
      assetId={assetId}
      name={name}
      verseLabel={verseLabel}
      texts={content.texts}
      sourceAudio={content.audio}
      result={draft.asset_result}
      comment={draft.comment}
      audio={draft.audio[0] ?? null}
      onResultChange={(result) =>
        void patchAsset(assetId, { asset_result: result })
      }
      onCommentChange={(comment) => void patchAsset(assetId, { comment })}
      onRequestRecord={() => setRecordingAssetId(assetId)}
      onRemoveAudio={() => void handleRemoveAudio()}
    />
  );
}

const RECORDING_DRAWER_HEIGHT = 300;

function RecordingDrawer({ assetNames }: { assetNames: Map<string, string> }) {
  const recordingAssetId = useReviewDraft((state) => state.recordingAssetId);
  const setRecordingAssetId = useReviewDraft(
    (state) => state.setRecordingAssetId
  );
  const patchAsset = useReviewDraft((state) => state.patchAsset);
  const setConclusionAudio = useReviewDraft(
    (state) => state.setConclusionAudio
  );
  const store = useReviewDraftStore();
  const isOverall = recordingAssetId === OVERALL_FEEDBACK_AUDIO_ID;

  const handleRecordingComplete = async (
    assetId: string,
    recordingUri: string
  ) => {
    const state = store.getState();
    const previous =
      assetId === OVERALL_FEEDBACK_AUDIO_ID
        ? state.conclusionAudio
        : (state.assets[assetId]?.audio ?? []);
    const savedPath = await saveAudioLocally(recordingUri);
    if (assetId === OVERALL_FEEDBACK_AUDIO_ID) {
      await setConclusionAudio([savedPath]);
    } else {
      await patchAsset(assetId, { audio: [savedPath] });
    }
    deleteAudioFiles(previous);
    setRecordingAssetId(null);
  };

  return (
    <Drawer
      open={!!recordingAssetId}
      onOpenChange={(open) => {
        if (!open) setRecordingAssetId(null);
      }}
      snapPoints={[RECORDING_DRAWER_HEIGHT]}
      enableDynamicSizing={false}
    >
      <DrawerContent className="pb-6">
        <DrawerHeader>
          <DrawerTitle>
            {isOverall
              ? 'Overall Feedback'
              : recordingAssetId
                ? assetNames.get(recordingAssetId)
                : ''}
          </DrawerTitle>
        </DrawerHeader>
        {recordingAssetId ? (
          <AudioRecorder
            key={recordingAssetId}
            onRecordingComplete={(uri) =>
              void handleRecordingComplete(recordingAssetId, uri)
            }
          />
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}

function ReviewTitle() {
  const reviewLabel = useReviewDraft((state) => state.reviewLabel);

  return (
    <View className="flex-row items-baseline">
      <Text variant="h4">Review</Text>
      {reviewLabel ? (
        <Text className="text-base font-normal text-muted-foreground">
          {` · ${reviewLabel}`}
        </Text>
      ) : null}
    </View>
  );
}

export default function ReviewEditView({
  projectId,
  questId,
  reviewId,
  origin = 'Internal',
  subjectName,
  promptReviewLabel
}: ReviewEditViewProps) {
  const { store, assets, contentByAsset, formatVerse, isLoading } =
    useReviewEditor({
      projectId,
      questId,
      reviewId,
      origin
    });
  const [labelPromptDismissed, setLabelPromptDismissed] = useState(false);
  const showLabelDrawer =
    promptReviewLabel === '1' && !isLoading && !labelPromptDismissed;

  const closeLabelDrawer = () => {
    setLabelPromptDismissed(true);
    router.setParams({ promptReviewLabel: undefined });
  };

  const { bottom: bottomInset } = useSafeAreaInsets();
  const assetNames = new Map(assets.map((item) => [item.id, item.name ?? '']));

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ReviewDraftContext.Provider value={store}>
      <View className="flex-1">
        <View className="flex-1 px-4">
          <View className="flex-row items-center justify-between gap-3">
            <View className="min-w-0 flex-1">
              <ReviewTitle />
              {subjectName ? (
                <Text className="text-sm text-muted-foreground">
                  {subjectName}
                </Text>
              ) : null}
            </View>
            <SubmitReviewButton assetNames={assetNames} />
          </View>

          <FlatList
            style={{ flex: 1 }}
            data={assets}
            keyExtractor={(item) => item.id}
            initialNumToRender={8}
            windowSize={11}
            removeClippedSubviews={false}
            keyboardShouldPersistTaps="handled"
            renderScrollComponent={renderKeyboardAwareScroll}
            contentContainerStyle={{ paddingBottom: bottomInset + 24 }}
            ItemSeparatorComponent={ItemSeparator}
            ListHeaderComponent={
              <View className="gap-6 pb-6 pt-6">
                <OverallFeedback />
                <Text variant="h4">Assets</Text>
              </View>
            }
            renderItem={({ item }) => {
              const verse = getAssetVerseRange(item.metadata);
              return (
                <ReviewAssetListItem
                  assetId={item.id}
                  name={item.name ?? ''}
                  verseLabel={formatVerseRangeLabel(
                    verse.from,
                    verse.to,
                    formatVerse
                  )}
                  content={contentByAsset.get(item.id) ?? EMPTY_ASSET_CONTENT}
                />
              );
            }}
            ListFooterComponent={
              <ReviewAudioPlayerSpacer assetNames={assetNames} />
            }
          />
        </View>
        <ReviewAudioPlayer assetNames={assetNames} />
      </View>
      <RecordingDrawer assetNames={assetNames} />
      <ReviewLabelDrawer
        isOpen={showLabelDrawer}
        onOpenChange={(open) => {
          if (!open) closeLabelDrawer();
        }}
        onConfirm={(reviewLabel) => {
          void store.getState().setReviewLabel(reviewLabel);
        }}
      />
    </ReviewDraftContext.Provider>
  );
}
