import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import WaveformVisualizer from '@/components/WaveformVisualizer';
import { useDebouncedCallback } from '@/hooks/use-debounced-callback';
import { useLocalization } from '@/hooks/useLocalization';
import type { AssetAudio, AssetAudioSegment } from '@/services/assetAudio';
import { useAssetAudio } from '@/services/assetAudio';
import { useLocalStore } from '@/store/localStore';
import { useThemeColor, useThemeToken } from '@/utils/styleUtils';
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
  assetAudio?: AssetAudio | null;
  onClose: () => void;
  onConfirm?: (trimmedAudio: AssetAudio) => void;
}

export function TrimSegmentModal({
  isOpen,
  segmentName,
  waveformData,
  assetAudio,
  onClose,
  onConfirm
}: TrimSegmentModalProps) {
  const { t } = useLocalization();
  const { width } = useWindowDimensions();
  const audio = useAssetAudio();
  const audioRef = React.useRef(audio);
  audioRef.current = audio;
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
  const activeHandleRef = React.useRef<'start' | 'end'>('start');

  const [isDragging, setIsDragging] = React.useState(false);
  const hasUserInteractedRef = React.useRef(false);
  const isOpenRef = React.useRef(isOpen);
  isOpenRef.current = isOpen;
  const trimPlayPreview = useLocalStore((state) => state.trimPlayPreview);
  const setTrimPlayPreview = useLocalStore(
    (state) => state.setTrimPlayPreview
  );

  const clipDurations = React.useMemo(
    () => assetAudio?.segments.map((s) => s.durationMs) ?? [],
    [assetAudio]
  );
  const totalDuration = React.useMemo(
    () => clipDurations.reduce((sum, d) => sum + d, 0),
    [clipDurations]
  );
  const audioUris = React.useMemo(
    () => assetAudio?.segments.map((s) => s.uri) ?? [],
    [assetAudio]
  );
  const hasAudioSequence = audioUris.length > 0 && totalDuration > 0;

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
      hasUserInteractedRef.current = false;
      return;
    }
    const nextStart = trimBounds.minStartFraction;
    const nextEnd = trimBounds.maxEndFraction;
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

  // Build an AssetAudio with current trim points from selection handles,
  // then delegate to useAssetAudio().play() which handles seek, endpoint
  // enforcement, and multi-clip sequencing via AudioContext.
  const buildTrimmedAssetAudio = React.useCallback((): AssetAudio | null => {
    if (!assetAudio || totalDuration <= 0) return null;

    const startTimeMs = selectionStart * totalDuration;
    const endTimeMs = selectionEnd * totalDuration;

    let acc = 0;
    const trimmedSegments: AssetAudioSegment[] = [];

    for (const seg of assetAudio.segments) {
      const segStart = acc;
      acc += seg.durationMs;
      const segEnd = acc;

      if (segEnd <= startTimeMs || segStart >= endTimeMs) continue;

      trimmedSegments.push({
        ...seg,
        trim: {
          startMs: Math.max(0, startTimeMs - segStart),
          endMs: Math.min(seg.durationMs, endTimeMs - segStart)
        }
      });
    }

    const totalDurationMs = trimmedSegments.reduce(
      (sum, seg) =>
        sum + (seg.trim ? seg.trim.endMs - seg.trim.startMs : seg.durationMs),
      0
    );

    return { ...assetAudio, segments: trimmedSegments, totalDurationMs };
  }, [assetAudio, selectionStart, selectionEnd, totalDuration]);

  const playPreview = React.useCallback(async () => {
    if (!isOpenRef.current) return;
    const trimmed = buildTrimmedAssetAudio();
    if (!trimmed) return;
    await audioRef.current.play(trimmed);
  }, [buildTrimmedAssetAudio]);

  const stopPreview = React.useCallback(async () => {
    await audioRef.current.stop();
  }, []);
  const stopPreviewOnInteraction = React.useCallback(() => {
    if (!trimPlayPreview) return;
    void stopPreview();
  }, [trimPlayPreview, stopPreview]);

  const debouncedPlayPreview = useDebouncedCallback(
    playPreview,
    [assetAudio, selectionStart, selectionEnd, totalDuration],
    300
  );

  // Trigger playback when trim points change (debounced)
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
    debouncedPlayPreview();
  }, [
    isOpen,
    hasAudioSequence,
    trimPlayPreview,
    selectionStart,
    selectionEnd,
    isDragging,
    debouncedPlayPreview
  ]);

  // Stop playback when modal closes or component unmounts
  React.useEffect(() => {
    if (!isOpen) {
      void stopPreview();
    }
    return () => {
      void stopPreview();
    };
  }, [isOpen, stopPreview]);

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
  const [waveformPanHandlers, setWaveformPanHandlers] = React.useState<
    ReturnType<typeof PanResponder.create>['panHandlers'] | undefined
  >(undefined);

  React.useEffect(() => {
    const leftResponder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setIsDragging(true);
        hasUserInteractedRef.current = true;
        stopPreviewOnInteraction();
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
        hasUserInteractedRef.current = true;
        stopPreviewOnInteraction();
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
  }, [
    clamp,
    minSelectionFraction,
    trimBounds,
    waveformWidth,
    stopPreviewOnInteraction
  ]);

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

  React.useEffect(() => {
    const responder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        if (waveformWidth <= 0) return;
        setIsDragging(true);
        hasUserInteractedRef.current = true;
        stopPreviewOnInteraction();

        const locationX = event.nativeEvent.locationX;
        const clampedX = clamp(locationX, 0, waveformWidth);
        const fraction = clampedX / waveformWidth;
        const distanceToStart = Math.abs(
          fraction - selectionStartRef.current
        );
        const distanceToEnd = Math.abs(
          fraction - selectionEndRef.current
        );

        if (distanceToStart <= distanceToEnd) {
          const nextStart = clamp(
            fraction,
            trimBounds.minStartFraction,
            Math.min(
              trimBounds.maxStartFraction,
              selectionEndRef.current - minSelectionFraction
            )
          );
          activeHandleRef.current = 'start';
          setSelectionStart(nextStart);
          selectionStartRef.current = nextStart;
          leftDragStartRef.current = nextStart;
        } else {
          const nextEnd = clamp(
            fraction,
            Math.max(
              trimBounds.minEndFraction,
              selectionStartRef.current + minSelectionFraction
            ),
            trimBounds.maxEndFraction
          );
          activeHandleRef.current = 'end';
          setSelectionEnd(nextEnd);
          selectionEndRef.current = nextEnd;
          rightDragStartRef.current = nextEnd;
        }
      },
      onPanResponderMove: (_, gesture) => {
        if (waveformWidth <= 0) return;
        const delta = gesture.dx / waveformWidth;
        if (activeHandleRef.current === 'start') {
          const nextStart = clamp(
            leftDragStartRef.current + delta,
            trimBounds.minStartFraction,
            Math.min(
              trimBounds.maxStartFraction,
              selectionEndRef.current - minSelectionFraction
            )
          );
          setSelectionStart(nextStart);
          selectionStartRef.current = nextStart;
        } else {
          const nextEnd = clamp(
            rightDragStartRef.current + delta,
            Math.max(
              trimBounds.minEndFraction,
              selectionStartRef.current + minSelectionFraction
            ),
            trimBounds.maxEndFraction
          );
          setSelectionEnd(nextEnd);
          selectionEndRef.current = nextEnd;
        }
      },
      onPanResponderRelease: () => {
        setIsDragging(false);
      },
      onPanResponderTerminate: () => {
        setIsDragging(false);
      }
    });
    setWaveformPanHandlers(responder.panHandlers);
  }, [
    clamp,
    minSelectionFraction,
    trimBounds,
    waveformWidth,
    stopPreviewOnInteraction
  ]);

  // Auto-trim: detect silence thresholds and set trim points automatically
  const handleAutoTrim = React.useCallback(() => {
    if (!resampledWaveform.length || totalDuration <= 0) return;

    const SILENCE_THRESHOLD = 0.12;
    const BUFFER_MS = 50;
    const bufferFraction = BUFFER_MS / totalDuration;

    let leftBarIndex = 0;
    for (let i = 0; i < resampledWaveform.length; i++) {
      if ((resampledWaveform[i] ?? 0) > SILENCE_THRESHOLD) {
        leftBarIndex = i;
        break;
      }
    }

    let rightBarIndex = resampledWaveform.length - 1;
    for (let i = resampledWaveform.length - 1; i >= 0; i--) {
      if ((resampledWaveform[i] ?? 0) > SILENCE_THRESHOLD) {
        rightBarIndex = i;
        break;
      }
    }

    const leftFraction = leftBarIndex / (resampledWaveform.length - 1);
    const rightFraction = rightBarIndex / (resampledWaveform.length - 1);

    const newStart = Math.min(
      trimBounds.maxStartFraction,
      Math.max(trimBounds.minStartFraction, leftFraction - bufferFraction)
    );
    const newEnd = Math.max(
      trimBounds.minEndFraction,
      Math.min(trimBounds.maxEndFraction, rightFraction + bufferFraction)
    );

    if (newEnd - newStart < minSelectionFraction) {
      const center = (newStart + newEnd) / 2;
      const halfWidth = minSelectionFraction / 2;
      setSelectionStart(Math.max(0, center - halfWidth));
      setSelectionEnd(Math.min(1, center + halfWidth));
    } else {
      setSelectionStart(newStart);
      setSelectionEnd(newEnd);
    }

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
              {audioUris.length > 1
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

              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 1
                }}
                {...waveformPanHandlers}
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
                onPress={() => {
                  if (onConfirm) {
                    const trimmed = buildTrimmedAssetAudio();
                    if (trimmed) {
                      onConfirm(trimmed);
                      return;
                    }
                  }
                  onClose();
                }}
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
