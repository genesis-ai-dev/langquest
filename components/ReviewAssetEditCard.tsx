import AudioRecorder from '@/components/AudioRecorder';
import { AudioPlayerControls } from '@/components/AudioPlayerControls';
import {
  getSourceAudioId,
  ReviewAudioPlayButton
} from '@/components/ReviewAudioPlayButton';
import {
  RESULT_LABEL,
  RESULT_OPTION_CLASS,
  RESULT_OPTION_TEXT_CLASS,
  RESULT_ORDER,
  ResultIcon
} from '@/components/ReviewResult';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerView
} from '@/components/ui/drawer';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { useAudioControls } from '@/contexts/AudioContext';
import type { AudioControlsType } from '@/contexts/AudioContext';
import type { AssetResult } from '@/database_services/reviewService';
import { useAutosaveText } from '@/hooks/useAutosaveText';
import { resolveExistingAudioUri } from '@/utils/attachmentPaths';
import { cn } from '@/utils/styleUtils';
import {
  ClipboardCheckIcon,
  MicIcon,
  PlayIcon,
  Trash2Icon
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const DRAWER_SNAP_POINTS = ['50%'];
const HANDLE_HEIGHT = 24;
const BOTTOM_GAP = 16;
const SEEK_STEP_MS = 5000;
const PLAYER_SLOT_HEIGHT = 120;

export interface ReviewAssetEditTarget {
  assetId: string;
  name: string;
  verseLabel: string | null;
  sourceAudio: string[];
}

function drawerSourceAudioId(assetId: string) {
  return `edit-drawer-source-${assetId}`;
}

function drawerFeedbackAudioId(assetId: string) {
  return `edit-drawer-feedback-${assetId}`;
}

function seekBy(audio: AudioControlsType, deltaMs: number) {
  const position = audio.positionShared.value;
  const duration = Math.max(0, audio.durationShared.value);
  const target = position + deltaMs;
  void audio.setPosition(
    duration > 0 ? Math.max(0, Math.min(target, duration)) : Math.max(0, target)
  );
}

async function startPlayback(
  audio: AudioControlsType,
  audioId: string,
  values: string[]
) {
  const uris = (
    await Promise.all(values.map((value) => resolveExistingAudioUri(value)))
  ).filter((uri): uri is string => !!uri);
  const uri = uris[0];
  if (!uri) return false;
  if (uris.length === 1) {
    await audio.playSound(uri, audioId);
  } else {
    await audio.playSoundSequence(uris, audioId);
  }
  return true;
}

function ReleaseDrawerAudio({ audioId }: { audioId: string }) {
  const { currentAudioId, stopCurrentSound } = useAudioControls();
  const currentIdRef = useRef(currentAudioId);
  const stopRef = useRef(stopCurrentSound);

  useEffect(() => {
    currentIdRef.current = currentAudioId;
    stopRef.current = stopCurrentSound;
  });

  useEffect(() => {
    return () => {
      const currentId = currentIdRef.current;
      if (
        currentId === drawerSourceAudioId(audioId) ||
        currentId === drawerFeedbackAudioId(audioId)
      ) {
        void stopRef.current();
      }
    };
  }, [audioId]);

  return null;
}

function EmbeddedPlayer({
  audioId,
  title
}: {
  audioId: string;
  title: string;
}) {
  const audio = useAudioControls();
  const isActive =
    audio.currentAudioId === audioId && (audio.isPlaying || audio.isPaused);
  if (!isActive) return null;

  return (
    <View
      style={{ height: PLAYER_SLOT_HEIGHT }}
      className="justify-center overflow-hidden"
    >
      <AudioPlayerControls
        mode="individual"
        position="inline"
        className="bg-card"
        currentAssetName={title}
        isPlaying={audio.isPlaying}
        isPaused={audio.isPaused}
        positionShared={audio.positionShared}
        durationShared={audio.durationShared}
        onRewind={() => seekBy(audio, -SEEK_STEP_MS)}
        onForward={() => seekBy(audio, SEEK_STEP_MS)}
        onPlayPause={() =>
          void (audio.isPlaying ? audio.pauseSound() : audio.resumeSound())
        }
        onStop={() => void audio.stopCurrentSound()}
      />
    </View>
  );
}

function CompactResultOptions({
  result,
  onSelect
}: {
  result: AssetResult;
  onSelect: (result: AssetResult) => void;
}) {
  return (
    <View className="min-w-0 flex-1 flex-row gap-1">
      {RESULT_ORDER.map((value) => {
        const isSelected = value === result;
        return (
          <Pressable
            key={value}
            onPress={() => onSelect(value)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            className={cn(
              'min-h-8 flex-1 items-center justify-center rounded-md border border-border px-1 py-1',
              RESULT_OPTION_CLASS[value],
              isSelected && 'border-2 border-foreground'
            )}
          >
            <Text
              className={cn(
                'text-center text-[11px] font-medium leading-tight',
                RESULT_OPTION_TEXT_CLASS[value]
              )}
              numberOfLines={2}
            >
              {RESULT_LABEL[value]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ReviewAssetEditCard({
  assetId,
  name,
  verseLabel,
  sourceAudio,
  result,
  hasContent,
  isResultPickerOpen,
  onToggleResult,
  onSelectResult,
  onOpen
}: {
  assetId: string;
  name: string;
  verseLabel: string | null;
  sourceAudio: string[];
  result: AssetResult;
  hasContent: boolean;
  isResultPickerOpen: boolean;
  onToggleResult: () => void;
  onSelectResult: (result: AssetResult) => void;
  onOpen: () => void;
}) {
  const Row = isResultPickerOpen ? View : Pressable;

  return (
    <Row
      accessibilityRole={isResultPickerOpen ? undefined : 'button'}
      accessibilityLabel={isResultPickerOpen ? undefined : `Review ${name}`}
      onPress={isResultPickerOpen ? undefined : onOpen}
      className="h-20 flex-row items-center gap-2 rounded-lg border border-border bg-card px-3 active:opacity-80"
    >
      <ReviewAudioPlayButton
        audioId={getSourceAudioId(assetId)}
        audioValues={sourceAudio}
      />
      {isResultPickerOpen ? (
        <CompactResultOptions result={result} onSelect={onSelectResult} />
      ) : (
        <View className="min-w-0 flex-1 items-start gap-1">
          <Text className="font-semibold" numberOfLines={1}>
            {name}
          </Text>
          {verseLabel ? (
            <Badge variant="secondary">
              <Text className="text-[10px]">{verseLabel}</Text>
            </Badge>
          ) : null}
        </View>
      )}
      {hasContent && !isResultPickerOpen ? (
        <Icon
          as={ClipboardCheckIcon}
          size={22}
          className="text-primary"
          accessibilityLabel="Has feedback"
        />
      ) : null}
      <Button
        variant="ghost"
        size="icon-sm"
        accessibilityLabel={RESULT_LABEL[result]}
        onPress={onToggleResult}
      >
        <ResultIcon result={result} size={22} />
      </Button>
    </Row>
  );
}

function CommentField({
  comment,
  onSave
}: {
  comment: string;
  onSave: (value: string) => void;
}) {
  const field = useAutosaveText(comment, onSave);
  return (
    <Textarea
      size="sm"
      numberOfLines={5}
      className="min-h-28"
      placeholder="Comment"
      value={field.text}
      onChangeText={field.change}
      onBlur={field.flush}
    />
  );
}

function confirmRemoveAudio(onRemove: () => void) {
  Alert.alert('Remove audio', 'This audio feedback will be deleted.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: onRemove }
  ]);
}

export function ReviewAssetEditDrawer({
  target,
  comment,
  audio,
  onClose,
  onCommentChange,
  onRecordingComplete,
  onRemoveAudio
}: {
  target: ReviewAssetEditTarget | null;
  comment: string;
  audio: string | null;
  onClose: () => void;
  onCommentChange: (comment: string) => void;
  onRecordingComplete: (uri: string) => void;
  onRemoveAudio: () => void;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [activeAudioId, setActiveAudioId] = useState<string | null>(null);
  const controls = useAudioControls();
  const { height: windowHeight } = useWindowDimensions();
  const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();
  const assetId = target?.assetId ?? '';
  const drawerHeight = Math.max(
    280,
    Math.round(
      (windowHeight - topInset - bottomInset) * 0.5 -
        HANDLE_HEIGHT -
        BOTTOM_GAP
    )
  );

  const play = async (audioId: string, values: string[]) => {
    setIsRecording(false);
    const started = await startPlayback(controls, audioId, values);
    if (started) setActiveAudioId(audioId);
  };

  const playerTitle =
    activeAudioId === drawerFeedbackAudioId(assetId)
      ? 'Audio feedback'
      : (target?.name ?? '');

  return (
    <Drawer
      open={target != null}
      onOpenChange={(next) => {
        if (!next) {
          setIsRecording(false);
          setActiveAudioId(null);
          onClose();
        }
      }}
      snapPoints={DRAWER_SNAP_POINTS}
      enableDynamicSizing={false}
      enableContentPanningGesture={false}
      keyboardBehavior="interactive"
    >
      <DrawerContent asChild>
        <DrawerView className="overflow-hidden bg-card">
          {target ? (
            <View
              style={{ height: drawerHeight }}
              className="gap-3 overflow-hidden"
            >
              <ReleaseDrawerAudio audioId={target.assetId} />
              <DrawerHeader className="py-0">
                <DrawerTitle>Review Asset</DrawerTitle>
              </DrawerHeader>
              <View className="flex-row items-center gap-2">
                <Button
                  variant="secondary"
                  size="icon"
                  className="rounded-full"
                  accessibilityLabel="Play"
                  onPress={() =>
                    void play(
                      drawerSourceAudioId(target.assetId),
                      target.sourceAudio
                    )
                  }
                >
                  <Icon as={PlayIcon} size={16} />
                </Button>
                <View className="min-w-0 flex-1 items-start gap-1">
                  <Text className="font-semibold" numberOfLines={1}>
                    {target.name}
                  </Text>
                  {target.verseLabel ? (
                    <Badge variant="secondary">
                      <Text className="text-[10px]">{target.verseLabel}</Text>
                    </Badge>
                  ) : null}
                </View>
              </View>

              <Text className="font-semibold">Feedback</Text>
              <CommentField
                key={target.assetId}
                comment={comment}
                onSave={onCommentChange}
              />

              {isRecording ? (
                <AudioRecorder
                  key={target.assetId}
                  onRecordingComplete={(uri) => {
                    setIsRecording(false);
                    onRecordingComplete(uri);
                  }}
                />
              ) : audio ? (
                <View className="flex-row items-center gap-2">
                  <Button
                    variant="secondary"
                    size="icon-sm"
                    className="rounded-full"
                    accessibilityLabel="Play audio feedback"
                    onPress={() =>
                      void play(drawerFeedbackAudioId(target.assetId), [audio])
                    }
                  >
                    <Icon as={PlayIcon} size={16} />
                  </Button>
                  <Text className="flex-1 text-sm">Audio feedback</Text>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    accessibilityLabel="Remove audio"
                    onPress={() => confirmRemoveAudio(onRemoveAudio)}
                  >
                    <Icon
                      as={Trash2Icon}
                      size={16}
                      className="text-destructive"
                    />
                  </Button>
                </View>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full rounded-xl border-primary"
                  onPress={() => {
                    void controls.stopCurrentSound();
                    setActiveAudioId(null);
                    setIsRecording(true);
                  }}
                >
                  <Icon as={MicIcon} size={16} className="text-primary" />
                  <Text className="text-primary">Add audio</Text>
                </Button>
              )}

              {isRecording ? null : (
                <EmbeddedPlayer
                  audioId={activeAudioId ?? ''}
                  title={playerTitle}
                />
              )}
            </View>
          ) : (
            <View />
          )}
        </DrawerView>
      </DrawerContent>
    </Drawer>
  );
}
