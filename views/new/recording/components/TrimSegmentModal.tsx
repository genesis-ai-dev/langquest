import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import WaveformVisualizer from '@/components/WaveformVisualizer';
import { useDebouncedCallback } from '@/hooks/use-debounced-callback';
import { useLocalization } from '@/hooks/useLocalization';
import { useLocalStore } from '@/store/localStore';
import { useThemeColor, useThemeToken } from '@/utils/styleUtils';
import { Audio } from 'expo-av';
import { Sparkles } from 'lucide-react-native';
import React from 'react';
import {
    Modal,
    PanResponder,
    Pressable,
    View,
    useWindowDimensions
} from 'react-native';

const TRIM_EDGE_BUFFER_MS = 200;

interface TrimSegmentModalProps {
  isOpen: boolean;
  segmentName?: string | null;
  waveformData?: number[];
  audioUris?: string[];
  audioDurations?: number[];
  onClose: () => void;
  onConfirm?: () => void;
}

export function TrimSegmentModal({
  isOpen,
  segmentName,
  waveformData,
  audioUris,
  audioDurations,
  onClose,
  onConfirm
}: TrimSegmentModalProps) {
  const { t } = useLocalization();
  const { width } = useWindowDimensions();
  const barCount = 128;
  const waveformHeight = 64;
  const minSelectionWidthPx = 32;
  const [waveformContainerWidth, setWaveformContainerWidth] =
    React.useState(0);
  const [selectionStart, setSelectionStart] = React.useState(0.1);
  const [selectionEnd, setSelectionEnd] = React.useState(0.9);
  const selectionStartRef = React.useRef(selectionStart);
  const selectionEndRef = React.useRef(selectionEnd);
  const leftDragStartRef = React.useRef(selectionStart);
  const rightDragStartRef = React.useRef(selectionEnd);

  // Audio playback state
  const soundRef = React.useRef<Audio.Sound | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const hasUserInteractedRef = React.useRef(false);
  const trimPlayPreview = useLocalStore((state) => state.trimPlayPreview);
  const setTrimPlayPreview = useLocalStore(
    (state) => state.setTrimPlayPreview
  );

  const clipDurations = React.useMemo(
    () => audioDurations ?? [],
    [audioDurations]
  );
  const totalDuration = React.useMemo(
    () => clipDurations.reduce((sum, d) => sum + d, 0),
    [clipDurations]
  );
  const hasAudioSequence = (audioUris?.length ?? 0) > 0 && totalDuration > 0;

  const primaryColor = useThemeColor('primary');
  const primaryToken = useThemeToken('primary');
  const backgroundColor = useThemeColor('background');
  const cardColor = useThemeColor('card');

  const hslToRgb = React.useCallback((h: number, s: number, l: number) => {
    const sNorm = s / 100;
    const lNorm = l / 100;
    const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = lNorm - c / 2;

    let r = 0;
    let g = 0;
    let b = 0;

    if (h < 60) {
      r = c;
      g = x;
    } else if (h < 120) {
      r = x;
      g = c;
    } else if (h < 180) {
      g = c;
      b = x;
    } else if (h < 240) {
      g = x;
      b = c;
    } else if (h < 300) {
      r = x;
      b = c;
    } else {
      r = c;
      b = x;
    }

    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255)
    };
  }, []);

  const baseBarColor = React.useMemo(() => {
    const [hRaw, sRaw, lRaw] = primaryToken.split(' ');
    const h = Number.parseFloat(hRaw ?? '0');
    const s = Number.parseFloat((sRaw ?? '0').replace('%', ''));
    const l = Number.parseFloat((lRaw ?? '0').replace('%', ''));
    const { r, g, b } = hslToRgb(h, s, l);
    return `rgba(${r}, ${g}, ${b}, 0.45)`;
  }, [hslToRgb, primaryToken]);

  const overlayBarColor = React.useMemo(() => {
    const [hRaw, sRaw, lRaw] = primaryToken.split(' ');
    const h = Number.parseFloat(hRaw ?? '0');
    const s = Number.parseFloat((sRaw ?? '0').replace('%', ''));
    const l = Number.parseFloat((lRaw ?? '0').replace('%', ''));
    const { r, g, b } = hslToRgb(h, s, l);
    return `rgba(${r}, ${g}, ${b}, 0.75)`;
  }, [hslToRgb, primaryToken]);

  const hasWaveform = !!waveformData && waveformData.length > 0;

  const resolvedWaveform = React.useMemo(() => {
    return hasWaveform ? waveformData : [];
  }, [hasWaveform, waveformData]);

  const normalizedWaveform = React.useMemo(() => {
    if (resolvedWaveform.length === 0) return resolvedWaveform;
    const maxValue = Math.max(...resolvedWaveform);
    if (!isFinite(maxValue) || maxValue <= 0) return resolvedWaveform;
    return resolvedWaveform.map((value) => {
      if (!isFinite(value) || value <= 0) return 0;
      return Math.min(1, value / maxValue);
    });
  }, [resolvedWaveform]);

  const resampledWaveform = React.useMemo(() => {
    if (normalizedWaveform.length === 0) return normalizedWaveform;
    if (normalizedWaveform.length === barCount) return normalizedWaveform;

    const result = new Array<number>(barCount);
    const lastIndex = normalizedWaveform.length - 1;

    for (let i = 0; i < barCount; i++) {
      const position = (i / (barCount - 1)) * lastIndex;
      const leftIndex = Math.floor(position);
      const rightIndex = Math.min(lastIndex, leftIndex + 1);
      const weight = position - leftIndex;
      const leftValue = normalizedWaveform[leftIndex] ?? 0;
      const rightValue = normalizedWaveform[rightIndex] ?? leftValue;
      result[i] = leftValue + (rightValue - leftValue) * weight;
    }

    return result;
  }, [normalizedWaveform, barCount]);

  const waveformWidth =
    waveformContainerWidth > 0
      ? waveformContainerWidth
      : Math.max(220, Math.min(width - 80, 340));

  const trimBounds = React.useMemo(() => {
    if (totalDuration <= 0) {
      return {
        minStartFraction: 0,
        maxStartFraction: 1,
        minEndFraction: 0,
        maxEndFraction: 1
      };
    }

    const firstClipDuration = clipDurations[0] ?? totalDuration;
    const lastClipDuration = clipDurations[clipDurations.length - 1] ?? totalDuration;

    const minStartFraction = 0;
    const maxEndFraction = 1;

    const rawMaxStart =
      totalDuration > 0
        ? (firstClipDuration - TRIM_EDGE_BUFFER_MS) / totalDuration
        : 1;
    const maxStartFraction = Math.min(1, Math.max(0, rawMaxStart));

    const rawMinEnd =
      totalDuration > 0
        ? (totalDuration - lastClipDuration + TRIM_EDGE_BUFFER_MS) / totalDuration
        : 0;
    const minEndFraction = Math.max(0, Math.min(1, rawMinEnd));

    return {
      minStartFraction,
      maxStartFraction,
      minEndFraction,
      maxEndFraction
    };
  }, [clipDurations, totalDuration]);

  React.useEffect(() => {
    if (!isOpen) {
      // Reset interaction flag when modal closes
      hasUserInteractedRef.current = false;
      return;
    }
    const nextStart = trimBounds.minStartFraction;
    const nextEnd = trimBounds.maxEndFraction;
    // Reset trim points when modal opens (but don't trigger playback)
    setSelectionStart(nextStart);
    setSelectionEnd(nextEnd > nextStart ? nextEnd : 1);
    hasUserInteractedRef.current = false;
  }, [isOpen, segmentName, waveformData, trimBounds]);

  React.useEffect(() => {
    selectionStartRef.current = selectionStart;
  }, [selectionStart]);

  React.useEffect(() => {
    selectionEndRef.current = selectionEnd;
  }, [selectionEnd]);

  // Play audio segment between trim points (debounced)
  const playSegment = React.useCallback(async () => {
    if (!hasAudioSequence || !audioUris || clipDurations.length === 0) return;

    // Stop any currently playing sound
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch (error) {
        console.error('Error stopping previous sound:', error);
      }
      soundRef.current = null;
    }

    try {
      // Calculate start and end times in milliseconds
      const startTime = selectionStart * totalDuration;
      const endTime = selectionEnd * totalDuration;
      const segmentDuration = endTime - startTime;

      if (segmentDuration <= 0) return;

      const findClipIndex = (timeMs: number) => {
        let acc = 0;
        for (let i = 0; i < clipDurations.length; i++) {
          const next = acc + (clipDurations[i] ?? 0);
          if (timeMs < next) {
            return { index: i, offset: timeMs - acc };
          }
          acc = next;
        }
        return {
          index: Math.max(0, clipDurations.length - 1),
          offset: clipDurations[clipDurations.length - 1] ?? 0
        };
      };

      const { index: startIdx, offset: startOffset } = findClipIndex(startTime);
      const { index: endIdx, offset: endOffset } = findClipIndex(endTime);

      for (let i = startIdx; i <= endIdx; i++) {
        const uri = audioUris[i];
        if (!uri) continue;
        const clipStart = i === startIdx ? startOffset : 0;
        const clipEnd =
          i === endIdx ? endOffset : (clipDurations[i] ?? 0);

        if (clipEnd <= clipStart) continue;

        const { sound } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: false }
        );
        soundRef.current = sound;

        await sound.setPositionAsync(clipStart);

        await new Promise<void>((resolve) => {
          sound.setOnPlaybackStatusUpdate((status) => {
            if (!status.isLoaded) return;
            const currentPosition = status.positionMillis || 0;
            if (currentPosition >= clipEnd) {
              void sound.stopAsync().then(() => {
                void sound.unloadAsync();
                if (soundRef.current === sound) {
                  soundRef.current = null;
                }
                resolve();
              });
            }
          });
          void sound.playAsync();
        });
      }
    } catch (error) {
      console.error('Failed to play audio segment:', error);
      if (soundRef.current) {
        try {
          await soundRef.current.unloadAsync();
        } catch {
          // Ignore cleanup errors
        }
        soundRef.current = null;
      }
    }
  }, [audioUris, clipDurations, hasAudioSequence, selectionStart, selectionEnd, totalDuration]);

  // Debounced playback trigger (300ms delay)
  const debouncedPlaySegment = useDebouncedCallback(
    playSegment,
    [audioUris, clipDurations, selectionStart, selectionEnd, totalDuration],
    300
  );

  // Trigger playback when trim points change (debounced) - but only when not dragging and user has interacted
  React.useEffect(() => {
    if (
      !isOpen ||
      !hasAudioSequence ||
      !trimPlayPreview ||
      isDragging ||
      !hasUserInteractedRef.current
    ) {
      return;
    }
    debouncedPlaySegment();
  }, [
    isOpen,
    hasAudioSequence,
    trimPlayPreview,
    selectionStart,
    selectionEnd,
    isDragging,
    debouncedPlaySegment
  ]);

  // Cleanup: stop and unload sound when modal closes or component unmounts
  React.useEffect(() => {
    if (!isOpen && soundRef.current) {
      void soundRef.current
        .stopAsync()
        .then(() => soundRef.current?.unloadAsync())
        .catch(() => {
          // Ignore errors during cleanup
        });
      soundRef.current = null;
    }

    return () => {
      if (soundRef.current) {
        void soundRef.current
          .stopAsync()
          .then(() => soundRef.current?.unloadAsync())
          .catch(() => {
            // Ignore errors during cleanup
          });
        soundRef.current = null;
      }
    };
  }, [isOpen]);

  const clamp = React.useCallback(
    (value: number, min: number, max: number) =>
      Math.min(max, Math.max(min, value)),
    []
  );

  const minSelectionFraction = React.useMemo(() => {
    if (waveformWidth <= 0) return 0.05;
    return Math.max(0.05, minSelectionWidthPx / waveformWidth);
  }, [minSelectionWidthPx, waveformWidth]);

  const [leftPanHandlers, setLeftPanHandlers] = React.useState<
    ReturnType<typeof PanResponder.create>['panHandlers'] | undefined
  >(undefined);
  const [rightPanHandlers, setRightPanHandlers] = React.useState<
    ReturnType<typeof PanResponder.create>['panHandlers'] | undefined
  >(undefined);

  React.useEffect(() => {
    const leftResponder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setIsDragging(true);
        hasUserInteractedRef.current = true; // Mark that user has interacted
        // Stop any currently playing audio when drag starts
        if (soundRef.current) {
          void soundRef.current.stopAsync().catch(() => {
            // Ignore errors
          });
        }
        leftDragStartRef.current = selectionStartRef.current;
      },
      onPanResponderMove: (_, gesture) => {
        if (waveformWidth <= 0) return;
        const delta = gesture.dx / waveformWidth;
        const nextStart = clamp(
          leftDragStartRef.current + delta,
          trimBounds.minStartFraction,
          Math.min(
            trimBounds.maxStartFraction,
            selectionEndRef.current - minSelectionFraction
          )
        );
        setSelectionStart(nextStart);
      },
      onPanResponderRelease: () => {
        setIsDragging(false);
      },
      onPanResponderTerminate: () => {
        setIsDragging(false);
      }
    });

    const rightResponder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setIsDragging(true);
        hasUserInteractedRef.current = true; // Mark that user has interacted
        // Stop any currently playing audio when drag starts
        if (soundRef.current) {
          void soundRef.current.stopAsync().catch(() => {
            // Ignore errors
          });
        }
        rightDragStartRef.current = selectionEndRef.current;
      },
      onPanResponderMove: (_, gesture) => {
        if (waveformWidth <= 0) return;
        const delta = gesture.dx / waveformWidth;
        const nextEnd = clamp(
          rightDragStartRef.current + delta,
          Math.max(
            trimBounds.minEndFraction,
            selectionStartRef.current + minSelectionFraction
          ),
          trimBounds.maxEndFraction
        );
        setSelectionEnd(nextEnd);
      },
      onPanResponderRelease: () => {
        setIsDragging(false);
      },
      onPanResponderTerminate: () => {
        setIsDragging(false);
      }
    });

    setLeftPanHandlers(leftResponder.panHandlers);
    setRightPanHandlers(rightResponder.panHandlers);
  }, [clamp, minSelectionFraction, trimBounds, waveformWidth]);

  const selectionStartPx = waveformWidth * selectionStart;
  const selectionEndPx = waveformWidth * selectionEnd;
  const selectionWidthPx = Math.max(0, selectionEndPx - selectionStartPx);
  const clipBoundaryPositions = React.useMemo(() => {
    if (!hasAudioSequence || clipDurations.length <= 1 || totalDuration <= 0) {
      return [];
    }
    const positions: number[] = [];
    let acc = 0;
    for (let i = 0; i < clipDurations.length - 1; i++) {
      acc += clipDurations[i] ?? 0;
      const fraction = acc / totalDuration;
      positions.push(fraction * waveformWidth);
    }
    return positions;
  }, [clipDurations, hasAudioSequence, totalDuration, waveformWidth]);

  const handleWaveformTap = React.useCallback(
    (locationX: number) => {
      if (waveformWidth <= 0) return;
      hasUserInteractedRef.current = true; // Mark that user has interacted
      const clampedX = clamp(locationX, 0, waveformWidth);
      const fraction = clampedX / waveformWidth;
      const distanceToStart = Math.abs(fraction - selectionStart);
      const distanceToEnd = Math.abs(fraction - selectionEnd);

      if (distanceToStart <= distanceToEnd) {
        const nextStart = clamp(
          fraction,
          trimBounds.minStartFraction,
          Math.min(
            trimBounds.maxStartFraction,
            selectionEnd - minSelectionFraction
          )
        );
        setSelectionStart(nextStart);
      } else {
        const nextEnd = clamp(
          fraction,
          Math.max(
            trimBounds.minEndFraction,
            selectionStart + minSelectionFraction
          ),
          trimBounds.maxEndFraction
        );
        setSelectionEnd(nextEnd);
      }
    },
    [
      clamp,
      minSelectionFraction,
      selectionEnd,
      selectionStart,
      trimBounds,
      waveformWidth
    ]
  );

  // Auto-trim: detect silence thresholds and set trim points automatically
  const handleAutoTrim = React.useCallback(() => {
    if (!resampledWaveform.length || totalDuration <= 0) return;

    const SILENCE_THRESHOLD = 0.12; // Reasonable threshold for silence (12% of max amplitude)
    const BUFFER_MS = 50; // Buffer before/after detected audio (50ms)
    const bufferFraction = BUFFER_MS / totalDuration;

    // Find first non-silent bar from left
    let leftBarIndex = 0;
    for (let i = 0; i < resampledWaveform.length; i++) {
      if ((resampledWaveform[i] ?? 0) > SILENCE_THRESHOLD) {
        leftBarIndex = i;
        break;
      }
    }

    // Find last non-silent bar from right
    let rightBarIndex = resampledWaveform.length - 1;
    for (let i = resampledWaveform.length - 1; i >= 0; i--) {
      if ((resampledWaveform[i] ?? 0) > SILENCE_THRESHOLD) {
        rightBarIndex = i;
        break;
      }
    }

    // Convert bar indices to fractions (0-1)
    const leftFraction = leftBarIndex / (resampledWaveform.length - 1);
    const rightFraction = rightBarIndex / (resampledWaveform.length - 1);

    // Apply buffer (subtract from left, add to right)
    const newStart = Math.min(
      trimBounds.maxStartFraction,
      Math.max(trimBounds.minStartFraction, leftFraction - bufferFraction)
    );
    const newEnd = Math.max(
      trimBounds.minEndFraction,
      Math.min(trimBounds.maxEndFraction, rightFraction + bufferFraction)
    );

    // Ensure minimum selection width
    if (newEnd - newStart < minSelectionFraction) {
      // If selection is too small, center it
      const center = (newStart + newEnd) / 2;
      const halfWidth = minSelectionFraction / 2;
      setSelectionStart(Math.max(0, center - halfWidth));
      setSelectionEnd(Math.min(1, center + halfWidth));
    } else {
      setSelectionStart(newStart);
      setSelectionEnd(newEnd);
    }

    // Mark that user has interacted (so playback will trigger)
    hasUserInteractedRef.current = true;
  }, [resampledWaveform, totalDuration, minSelectionFraction, trimBounds]);

  return (
    <Modal
      visible={isOpen}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 items-center justify-center bg-black/50"
        onPress={onClose}
      >
        <Pressable
          className="mx-6 w-full max-w-md rounded-2xl bg-card p-6"
          onPress={(event) => event.stopPropagation()}
        >
          <Text className="text-xl font-bold text-foreground">
            {t('trimSegment')}
          </Text>
          {segmentName ? (
            <Text className="mt-2 text-sm text-muted-foreground">
              {segmentName}
              {audioUris && audioUris.length > 1
                ? ` (${t('mergedAudio')})`
                : ''}
            </Text>
          ) : null}

          <View
            className="mt-5 w-full items-center"
            onLayout={(event) => {
              setWaveformContainerWidth(event.nativeEvent.layout.width);
            }}
          >
            <View style={{ width: waveformWidth, height: waveformHeight }}>
              {!hasWaveform ? (
                <View
                  style={{
                    width: waveformWidth,
                    height: waveformHeight,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: primaryColor,
                    backgroundColor: backgroundColor
                  }}
                />
              ) : (
                <>
                  <View pointerEvents="none">
                <WaveformVisualizer
                  waveformData={resampledWaveform}
                  width={waveformWidth}
                  height={waveformHeight}
                  barCount={barCount}
                  color={baseBarColor}
                  backgroundColor={backgroundColor}
                  borderWidth={0}
                />
              </View>

              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: selectionStartPx,
                  width: selectionWidthPx,
                  height: waveformHeight,
                  overflow: 'hidden'
                }}
                pointerEvents="none"
              >
                <View style={{ position: 'absolute', left: -selectionStartPx }}>
                  <WaveformVisualizer
                    waveformData={resampledWaveform}
                    width={waveformWidth}
                    height={waveformHeight}
                    barCount={barCount}
                  color={overlayBarColor}
                    backgroundColor={cardColor}
                    borderWidth={0}
                  />
                </View>
              </View>

              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: selectionStartPx,
                  width: selectionWidthPx,
                  height: waveformHeight,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: primaryColor
                }}
                pointerEvents="none"
              />

              {clipBoundaryPositions.map((left, index) => (
                <View
                  key={`clip-divider-${index}`}
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left,
                    height: waveformHeight,
                    borderLeftWidth: 1,
                    borderLeftColor: primaryColor,
                    borderStyle: 'dashed',
                    opacity: 0.7
                  }}
                />
              ))}

              <Pressable
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 1
                }}
                onPressIn={(event) =>
                  handleWaveformTap(event.nativeEvent.locationX)
                }
              />

              <View
                style={{
                  position: 'absolute',
                  top: -8,
                  left: Math.max(0, selectionStartPx - 16),
                  width: 32,
                  height: waveformHeight + 16,
                  backgroundColor: 'transparent',
                  zIndex: 2
                }}
                {...leftPanHandlers}
              />
              <View
                style={{
                  position: 'absolute',
                  top: -8,
                  left: Math.min(waveformWidth - 32, selectionEndPx - 16),
                  width: 32,
                  height: waveformHeight + 16,
                  backgroundColor: 'transparent',
                  zIndex: 2
                }}
                {...rightPanHandlers}
              />
                </>
              )}
            </View>
          </View>

          {/* Auto-trim button */}
          {hasWaveform && totalDuration > 0 && (
            <View className="mt-4 gap-3">
              <Pressable
                className="flex-row items-center justify-center gap-2"
                onPress={() => setTrimPlayPreview(!trimPlayPreview)}
              >
                <Checkbox
                  checked={trimPlayPreview}
                  onCheckedChange={(checked) =>
                    setTrimPlayPreview(Boolean(checked))
                  }
                />
                <Text className="text-muted-foreground text-sm">
                  {t('playPreview')}
                </Text>
              </Pressable>
              <Button
                variant="outline"
                onPress={handleAutoTrim}
                className="w-full min-h-[48px] items-center justify-center"
              >
                <View className="flex-row flex-wrap items-center justify-center gap-2">
                  <Icon
                    as={Sparkles}
                    size={18}
                    className="text-primary"
                  />
                  <Text className="text-primary text-sm flex-wrap">
                    {t('autoTrim')}
                  </Text>
                </View>
              </Button>
            </View>
          )}

          <View className="mt-6">
            <View className="flex-row gap-3">
              <Button
                variant="outline"
                onPress={onClose}
                className="flex-1"
              >
                <Text>{t('cancel')}</Text>
              </Button>
              <Button
                variant="default"
                onPress={onConfirm ?? onClose}
                className="flex-1"
              >
                <Text>{t('ok')}</Text>
              </Button>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
