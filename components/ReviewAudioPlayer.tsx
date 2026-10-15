import { AudioPlayerControls } from '@/components/AudioPlayerControls';
import { parseReviewAudioId } from '@/components/ReviewAudioPlayButton';
import { useAudio, useAudioControls } from '@/contexts/AudioContext';
import { View } from 'react-native';

const SEEK_STEP_MS = 5000;
const AUDIO_PLAYER_SPACER_HEIGHT = 120;

function useReviewAudioTitle(assetNames: Map<string, string>) {
  const { currentAudioId, isPlaying, isPaused } = useAudioControls();
  const parsed = parseReviewAudioId(currentAudioId);
  if (!parsed || (!isPlaying && !isPaused)) return null;
  if (parsed.kind === 'overall') return 'Overall Feedback';

  const assetName = assetNames.get(parsed.assetId) ?? '';
  return parsed.kind === 'feedback' ? `Feedback · ${assetName}` : assetName;
}

/**
 * Footer player shared by every review audio button on the screen. It stays
 * mounted with the screen, so its `useAudio` stops playback when leaving.
 */
export function ReviewAudioPlayer({
  assetNames
}: {
  assetNames: Map<string, string>;
}) {
  const audio = useAudio();
  const title = useReviewAudioTitle(assetNames);
  if (title === null) return null;

  const seekBy = (deltaMs: number) => {
    const duration = Math.max(0, audio.duration);
    const target = audio.position + deltaMs;
    void audio.setPosition(
      duration > 0
        ? Math.max(0, Math.min(target, duration))
        : Math.max(0, target)
    );
  };

  return (
    <AudioPlayerControls
      mode="individual"
      position="footer"
      currentAssetName={title}
      isPlaying={audio.isPlaying}
      isPaused={audio.isPaused}
      positionShared={audio.positionShared}
      durationShared={audio.durationShared}
      onRewind={() => seekBy(-SEEK_STEP_MS)}
      onForward={() => seekBy(SEEK_STEP_MS)}
      onPlayPause={() =>
        void (audio.isPlaying ? audio.pauseSound() : audio.resumeSound())
      }
      onStop={() => void audio.stopCurrentSound()}
    />
  );
}

// Keeps the last card clear of the floating player without re-rendering the
// whole view on every audio position update.
export function ReviewAudioPlayerSpacer({
  assetNames
}: {
  assetNames: Map<string, string>;
}) {
  const title = useReviewAudioTitle(assetNames);
  return title === null ? null : (
    <View style={{ height: AUDIO_PLAYER_SPACER_HEIGHT }} />
  );
}
