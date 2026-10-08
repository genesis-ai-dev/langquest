import AudioRecorder from '@/components/AudioRecorder';
import { ExternalReviewDrawer } from '@/components/ExternalReviewDrawer';
import type { ReviewAssetEditTarget } from '@/components/ReviewAssetEditCard';
import {
  ReviewAssetEditCard,
  ReviewAssetEditDrawer
} from '@/components/ReviewAssetEditCard';
import {
  OVERALL_FEEDBACK_AUDIO_ID,
  ReviewAudioPlayButton
} from '@/components/ReviewAudioPlayButton';
import {
  ReviewAudioPlayer,
  ReviewAudioPlayerSpacer
} from '@/components/ReviewAudioPlayer';
import { ReviewLabelDrawer } from '@/components/ReviewLabelDrawer';
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
import { LegendList } from '@/components/ui/legend-list';
import { Progress } from '@/components/ui/progress';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import type {
  AssetResult,
  QuestResult
} from '@/database_services/reviewService';
import {
  deleteLocalReview,
  findIncompleteSuggestedChanges
} from '@/database_services/reviewService';
import { useAutosaveText } from '@/hooks/useAutosaveText';
import { useLocalization } from '@/hooks/useLocalization';
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
  ClipboardIcon,
  DatabaseIcon,
  MicIcon,
  SendIcon,
  Trash2Icon,
  TriangleAlertIcon,
  XIcon
} from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  Alert as RNAlert,
  View
} from 'react-native';
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
              <DrawerTitle>Publish Review</DrawerTitle>
              <Text className="text-sm text-muted-foreground">
                {progress.isEmpty
                  ? 'Nothing has been submitted yet'
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
              Once submitted, no changes can be made.
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
        `${pluralizeAssets(notReviewed)} will be submitted with no status.`
      );
    }
    if (state.questResult === 'approved' && suggested > 0) {
      nextWarnings.push(
        `The overall status is Approved, but ${pluralizeAssets(suggested)} ${suggested === 1 ? 'is' : 'are'} marked as Suggested Changes.`
      );
    }
    return { drafts, nextWarnings, state };
  };

  const blockingMessage = () => {
    const { drafts, state } = collectWarnings();
    const incomplete = findIncompleteSuggestedChanges(drafts);
    if (incomplete.length > 0) {
      const names = incomplete
        .map((assetId) => assetNames.get(assetId) || assetId)
        .join(', ');
      return {
        title: 'Missing feedback',
        description: `Add a comment or audio to every asset marked as Suggested Changes: ${names}`
      };
    }
    if (!state.questResult) {
      return {
        title: 'Missing overall status',
        description: 'Choose an overall status before submitting the review.'
      };
    }
    if (
      state.questResult === 'suggested_changes' &&
      !state.conclusion.trim() &&
      state.conclusionAudio.length === 0
    ) {
      return {
        title: 'Missing overall feedback',
        description:
          'An overall status of Suggested Changes needs a comment or audio explaining what should change.'
      };
    }
    return null;
  };

  const handleOpen = () => {
    Keyboard.dismiss();
    if (store.getState().accessToken) {
      toast.error('This review is waiting for an external response.');
      return;
    }
    const blocked = blockingMessage();
    if (blocked) {
      toast.error(blocked.title, { description: blocked.description });
      return;
    }
    setWarnings(collectWarnings().nextWarnings);
    setIsOpen(true);
  };

  const handleConfirm = async () => {
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

function ReviewDraftToolbar() {
  const store = useReviewDraftStore();
  const [isExternalOpen, setIsExternalOpen] = useState(false);

  const removeDraft = async () => {
    const state = store.getState();
    const audio = [
      ...state.conclusionAudio,
      ...Object.values(state.assets).flatMap((asset) => asset.audio)
    ];
    try {
      if (state.reviewId) {
        const result = await deleteLocalReview(state.reviewId);
        if (result === 'deleted') deleteAudioFiles(audio);
      }
      router.back();
    } catch (error) {
      toast.error(
        error instanceof Error && error.message === 'OFFLINE'
          ? 'You need to be online to delete this review.'
          : 'Could not delete the review.'
      );
    }
  };

  const confirmDelete = () => {
    const hasExternalLink = store.getState().accessToken != null;
    RNAlert.alert(
      'Delete review',
      hasExternalLink
        ? 'This shared draft will be removed from the lists. You need to be online.'
        : 'This review will be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => void removeDraft()
        }
      ]
    );
  };

  return (
    <View className="flex-row items-center justify-between pt-4">
      <Button
        variant="outline"
        size="icon"
        accessibilityLabel="Delete review"
        onPress={confirmDelete}
      >
        <Icon as={Trash2Icon} size={18} className="text-destructive" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        accessibilityLabel="Request external review"
        className="px-4"
        onPress={() => setIsExternalOpen(true)}
      >
        <Icon as={ClipboardIcon} size={20} className="text-foreground" />
        <Icon as={SendIcon} size={20} className="text-foreground" />
      </Button>
      <ExternalReviewDrawer
        open={isExternalOpen}
        onOpenChange={setIsExternalOpen}
      />
    </View>
  );
}

function ReviewEditorLock({ children }: { children: ReactNode }) {
  const accessToken = useReviewDraft((state) => state.accessToken);
  const locked = accessToken != null;

  return (
    <View className="flex-1">
      {locked ? (
        <Text className="pt-4 text-sm text-muted-foreground">
          This review is waiting for an external response. You can't edit it
          while the link is active.
        </Text>
      ) : null}
      <View
        key={accessToken ?? 'draft'}
        className={cn('flex-1', locked && 'opacity-50')}
        pointerEvents={locked ? 'none' : 'auto'}
      >
        {children}
      </View>
    </View>
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
          onPress={() => {
            RNAlert.alert(
              'Remove audio',
              'This audio feedback will be deleted.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Remove',
                  style: 'destructive',
                  onPress: () => void handleRemove()
                }
              ]
            );
          }}
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
  sourceAudio,
  isResultPickerOpen,
  onToggleResult,
  onOpen
}: {
  assetId: string;
  name: string;
  verseLabel: string | null;
  sourceAudio: string[];
  isResultPickerOpen: boolean;
  onToggleResult: (assetId: string) => void;
  onOpen: (assetId: string) => void;
}) {
  const draft =
    useReviewDraft((state) => state.assets[assetId]) ?? EMPTY_REVIEW_ASSET;
  const patchAsset = useReviewDraft((state) => state.patchAsset);
  const hasContent = draft.comment.trim().length > 0 || draft.audio.length > 0;

  return (
    <ReviewAssetEditCard
      assetId={assetId}
      name={name}
      verseLabel={verseLabel}
      sourceAudio={sourceAudio}
      result={draft.asset_result}
      hasContent={hasContent}
      isResultPickerOpen={isResultPickerOpen}
      onToggleResult={() => onToggleResult(assetId)}
      onSelectResult={(result) => {
        onToggleResult(assetId);
        if (result !== draft.asset_result) {
          void patchAsset(assetId, { asset_result: result });
        }
      }}
      onOpen={() => onOpen(assetId)}
    />
  );
}

const RECORDING_DRAWER_HEIGHT = 300;

function RecordingDrawer() {
  const recordingAssetId = useReviewDraft((state) => state.recordingAssetId);
  const setRecordingAssetId = useReviewDraft(
    (state) => state.setRecordingAssetId
  );
  const setConclusionAudio = useReviewDraft(
    (state) => state.setConclusionAudio
  );
  const store = useReviewDraftStore();
  const isOverall = recordingAssetId === OVERALL_FEEDBACK_AUDIO_ID;

  const handleRecordingComplete = async (recordingUri: string) => {
    const previous = store.getState().conclusionAudio;
    const savedPath = await saveAudioLocally(recordingUri);
    await setConclusionAudio([savedPath]);
    deleteAudioFiles(previous);
    setRecordingAssetId(null);
  };

  return (
    <Drawer
      open={isOverall}
      onOpenChange={(open) => {
        if (!open) setRecordingAssetId(null);
      }}
      snapPoints={[RECORDING_DRAWER_HEIGHT]}
      enableDynamicSizing={false}
    >
      <DrawerContent className="pb-6">
        <DrawerHeader>
          <DrawerTitle>Overall Feedback</DrawerTitle>
        </DrawerHeader>
        {isOverall ? (
          <AudioRecorder
            key={OVERALL_FEEDBACK_AUDIO_ID}
            onRecordingComplete={(uri) => void handleRecordingComplete(uri)}
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

function ConnectedAssetDrawer({
  target,
  onClose
}: {
  target: ReviewAssetEditTarget | null;
  onClose: () => void;
}) {
  const assetId = target?.assetId ?? '';
  const draft =
    useReviewDraft((state) => state.assets[assetId]) ?? EMPTY_REVIEW_ASSET;
  const patchAsset = useReviewDraft((state) => state.patchAsset);
  const store = useReviewDraftStore();

  const saveRecording = async (uri: string) => {
    if (!target) return;
    const previous = store.getState().assets[target.assetId]?.audio ?? [];
    const savedPath = await saveAudioLocally(uri);
    await patchAsset(target.assetId, { audio: [savedPath] });
    deleteAudioFiles(previous);
  };

  const removeAudio = () => {
    if (!target) return;
    const previous = store.getState().assets[target.assetId]?.audio ?? [];
    void patchAsset(target.assetId, { audio: [] });
    deleteAudioFiles(previous);
  };

  return (
    <ReviewAssetEditDrawer
      target={target}
      comment={draft.comment}
      audio={draft.audio[0] ?? null}
      onClose={onClose}
      onCommentChange={(comment) => {
        if (target) void patchAsset(target.assetId, { comment });
      }}
      onRecordingComplete={(uri) => void saveRecording(uri)}
      onRemoveAudio={removeAudio}
    />
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
  const [resultPickerAssetId, setResultPickerAssetId] = useState<string | null>(
    null
  );
  const [editingAsset, setEditingAsset] =
    useState<ReviewAssetEditTarget | null>(null);
  const [labelPromptDismissed, setLabelPromptDismissed] = useState(false);
  const showLabelDrawer =
    promptReviewLabel === '1' && !isLoading && !labelPromptDismissed;

  const closeLabelDrawer = () => {
    setLabelPromptDismissed(true);
    router.setParams({ promptReviewLabel: undefined });
  };

  const assetNames = new Map(assets.map((item) => [item.id, item.name ?? '']));

  const toggleResultPicker = (assetId: string) => {
    setResultPickerAssetId((current) => (current === assetId ? null : assetId));
  };

  const openAsset = (assetId: string) => {
    const asset = assets.find((item) => item.id === assetId);
    if (!asset) return;
    const verse = getAssetVerseRange(asset.metadata);
    const content = contentByAsset.get(assetId) ?? EMPTY_ASSET_CONTENT;
    setEditingAsset({
      assetId,
      name: asset.name ?? '',
      verseLabel: formatVerseRangeLabel(verse.from, verse.to, formatVerse),
      sourceAudio: content.audio
    });
  };

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
          <ReviewDraftToolbar />

          <ReviewEditorLock>
            <LegendList
              style={{ flex: 1 }}
              data={assets}
              keyExtractor={(item) => item.id}
              estimatedItemSize={80}
              extraData={resultPickerAssetId}
              recycleItems
              keyboardShouldPersistTaps="handled"
              ItemSeparatorComponent={ItemSeparator}
              ListHeaderComponent={
                <View className="gap-6 pb-6 pt-4">
                  <OverallFeedback />
                  <Text variant="h4">Assets</Text>
                </View>
              }
              renderItem={({ item }) => {
                const verse = getAssetVerseRange(item.metadata);
                const content =
                  contentByAsset.get(item.id) ?? EMPTY_ASSET_CONTENT;
                return (
                  <ReviewAssetListItem
                    assetId={item.id}
                    name={item.name ?? ''}
                    verseLabel={formatVerseRangeLabel(
                      verse.from,
                      verse.to,
                      formatVerse
                    )}
                    sourceAudio={content.audio}
                    isResultPickerOpen={resultPickerAssetId === item.id}
                    onToggleResult={toggleResultPicker}
                    onOpen={openAsset}
                  />
                );
              }}
              ListFooterComponent={
                <ReviewAudioPlayerSpacer assetNames={assetNames} />
              }
            />
          </ReviewEditorLock>
        </View>
        <ReviewAudioPlayer assetNames={assetNames} />
      </View>
      <RecordingDrawer />
      <ConnectedAssetDrawer
        target={editingAsset}
        onClose={() => setEditingAsset(null)}
      />
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
