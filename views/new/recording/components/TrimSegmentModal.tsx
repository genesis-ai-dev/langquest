import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import WaveformVisualizer from '@/components/WaveformVisualizer';
import { useDebouncedCallback } from '@/hooks/use-debounced-callback';
import { useLocalization } from '@/hooks/useLocalization';
import { useThemeColor, useThemeToken } from '@/utils/styleUtils';
import { Audio } from 'expo-av';
import React from 'react';
import {
    Modal,
    PanResponder,
    Pressable,
    View,
    useWindowDimensions
} from 'react-native';

interface TrimSegmentModalProps {
  isOpen: boolean;
  segmentName?: string | null;
  waveformData?: number[];
  audioUri?: string;
  onClose: () => void;
  onConfirm?: () => void;
}

export function TrimSegmentModal({
  isOpen,
  segmentName,
  waveformData,
  audioUri,
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
  const [audioDuration, setAudioDuration] = React.useState<number | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const hasUserInteractedRef = React.useRef(false);

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

  React.useEffect(() => {
    if (!isOpen) {
      // Reset interaction flag when modal closes
      hasUserInteractedRef.current = false;
      return;
    }
    // Reset trim points when modal opens (but don't trigger playback)
    setSelectionStart(0);
    setSelectionEnd(1);
    hasUserInteractedRef.current = false;
  }, [isOpen, segmentName, waveformData]);

  React.useEffect(() => {
    selectionStartRef.current = selectionStart;
  }, [selectionStart]);

  React.useEffect(() => {
    selectionEndRef.current = selectionEnd;
  }, [selectionEnd]);

  // Load audio duration when URI is available
  const cancelledRef = React.useRef(false);
  React.useEffect(() => {
    if (!audioUri || !isOpen) {
      setAudioDuration(null);
      return;
    }

    cancelledRef.current = false;

    void (async () => {
      try {
        const { sound } = await Audio.Sound.createAsync({ uri: audioUri });
        const status = await sound.getStatusAsync();
        await sound.unloadAsync();

        if (!cancelledRef.current && status.isLoaded) {
          const duration = status.durationMillis;
          if (duration) {
            setAudioDuration(duration);
          }
        }
      } catch (error) {
        console.error('Failed to load audio duration:', error);
        if (!cancelledRef.current) {
          setAudioDuration(null);
        }
      }
    })();

    return () => {
      cancelledRef.current = true;
    };
  }, [audioUri, isOpen]);

  // Play audio segment between trim points (debounced)
  const playSegment = React.useCallback(async () => {
    if (!audioUri || !audioDuration) return;

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
      const startTime = selectionStart * audioDuration;
      const endTime = selectionEnd * audioDuration;
      const segmentDuration = endTime - startTime;

      if (segmentDuration <= 0) return;

      // Create and load sound
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: false }
      );
      soundRef.current = sound;

      // Seek to start position
      await sound.setPositionAsync(startTime);

      // Set up listener to stop at end time
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;

        const currentPosition = status.positionMillis || 0;

        // Stop if we've reached or passed the end time
        if (currentPosition >= endTime) {
          void sound.stopAsync().then(() => {
            void sound.unloadAsync();
            soundRef.current = null;
          });
        }
      });

      // Start playing
      await sound.playAsync();
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
  }, [audioUri, audioDuration, selectionStart, selectionEnd]);

  // Debounced playback trigger (300ms delay)
  const debouncedPlaySegment = useDebouncedCallback(
    playSegment,
    [audioUri, audioDuration, selectionStart, selectionEnd],
    300
  );

  // Trigger playback when trim points change (debounced) - but only when not dragging and user has interacted
  React.useEffect(() => {
    if (!isOpen || !audioUri || !audioDuration || isDragging || !hasUserInteractedRef.current) return;
    debouncedPlaySegment();
  }, [isOpen, audioUri, audioDuration, selectionStart, selectionEnd, isDragging, debouncedPlaySegment]);

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
          0,
          selectionEndRef.current - minSelectionFraction
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
          selectionStartRef.current + minSelectionFraction,
          1
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
  }, [clamp, minSelectionFraction, waveformWidth]);

  const selectionStartPx = waveformWidth * selectionStart;
  const selectionEndPx = waveformWidth * selectionEnd;
  const selectionWidthPx = Math.max(0, selectionEndPx - selectionStartPx);

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
          0,
          selectionEnd - minSelectionFraction
        );
        setSelectionStart(nextStart);
      } else {
        const nextEnd = clamp(
          fraction,
          selectionStart + minSelectionFraction,
          1
        );
        setSelectionEnd(nextEnd);
      }
    },
    [
      clamp,
      minSelectionFraction,
      selectionEnd,
      selectionStart,
      waveformWidth
    ]
  );

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
