import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { useAudio } from '@/contexts/AudioContext';
import { resolveExistingAudioUri } from '@/utils/attachmentPaths';
import { PauseIcon, PlayIcon } from 'lucide-react-native';

const SOURCE_AUDIO_PREFIX = 'source-';
const FEEDBACK_AUDIO_PREFIX = 'review-';
export const OVERALL_FEEDBACK_AUDIO_ID = 'review-overall';

export function getSourceAudioId(assetId: string) {
  return `${SOURCE_AUDIO_PREFIX}${assetId}`;
}

export function getFeedbackAudioId(assetId: string) {
  return `${FEEDBACK_AUDIO_PREFIX}${assetId}`;
}

export type ReviewAudioSource =
  | { kind: 'source' | 'feedback'; assetId: string }
  | { kind: 'overall' };

/** Resolves an AudioContext id started on the review screen to its origin. */
export function parseReviewAudioId(
  audioId: string | null
): ReviewAudioSource | null {
  if (!audioId) return null;
  if (audioId === OVERALL_FEEDBACK_AUDIO_ID) return { kind: 'overall' };
  if (audioId.startsWith(SOURCE_AUDIO_PREFIX)) {
    return {
      kind: 'source',
      assetId: audioId.slice(SOURCE_AUDIO_PREFIX.length)
    };
  }
  if (audioId.startsWith(FEEDBACK_AUDIO_PREFIX)) {
    return {
      kind: 'feedback',
      assetId: audioId.slice(FEEDBACK_AUDIO_PREFIX.length)
    };
  }
  return null;
}

// AudioContext updates position every 100ms; only this small component
// subscribes to it so its parent does not re-render while playing.
export function ReviewAudioPlayButton({
  audioId,
  audioValues,
  size = 'icon'
}: {
  audioId: string;
  audioValues: string[];
  size?: 'icon' | 'icon-sm';
}) {
  const {
    playSoundSequence,
    pauseSound,
    resumeSound,
    isPlaying,
    isPaused,
    currentAudioId
  } = useAudio();
  const isActive = currentAudioId === audioId && (isPlaying || isPaused);
  const isThisPlaying = isActive && isPlaying;

  const toggle = async () => {
    if (isThisPlaying) {
      await pauseSound();
      return;
    }
    if (isActive) {
      await resumeSound();
      return;
    }
    const uris = (
      await Promise.all(
        audioValues.map((value) => resolveExistingAudioUri(value))
      )
    ).filter((uri): uri is string => !!uri);
    if (uris.length) await playSoundSequence(uris, audioId);
  };

  return (
    <Button
      variant="secondary"
      size={size}
      className="rounded-full"
      disabled={!audioValues.length}
      accessibilityLabel={isThisPlaying ? 'Pause' : 'Play'}
      onPress={() => void toggle()}
    >
      <Icon as={isThisPlaying ? PauseIcon : PlayIcon} size={16} />
    </Button>
  );
}
