/**
 * VADSettingsDrawer - Settings drawer for voice activity detection
 * Shows live energy levels and allows threshold adjustment
 */

import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from '@/components/ui/drawer';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip';
import { useLocalization } from '@/hooks/useLocalization';
import { useMicrophoneEnergy } from '@/hooks/useMicrophoneEnergy';
import { useThemeColor } from '@/utils/styleUtils';
import { useGestureEventsHandlersDefault } from '@gorhom/bottom-sheet';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowBigLeft,
  ArrowBigRight,
  ChevronUp,
  HelpCircle,
  Maximize2,
  Mic,
  Minus,
  Plus,
  RectangleHorizontal,
  RotateCcw,
  Sparkles,
  Volume1
} from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, useWindowDimensions, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue
} from 'react-native-reanimated';
import Svg, {
  Defs,
  Mask,
  Rect,
  Stop,
  LinearGradient as SvgLinearGradient
} from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

// Dimmed gradient for sensitivity bar background
const ENERGY_GRADIENT_COLORS_DIMMED = [
  '#22c55e40',
  '#84cc1640',
  '#eab30840',
  '#f9731640',
  '#ef444440'
] as const;

// Segmented energy bar constants
const ENERGY_BAR_PILL_WIDTH = 6; // Individual pill width in px
const ENERGY_BAR_HEIGHT = 28; // Bar height in px
const ENERGY_BAR_SPACING = 10; // Gap between pills in px
const ENERGY_BAR_RADIUS = 2; // Pill corner radius in px
// Total horizontal padding: DrawerContent px-6 (24px × 2) + BottomSheetScrollView paddingHorizontal (16px × 2)
const ENERGY_BAR_HORIZONTAL_PADDING = 48;

const SHOULD_SHOW_DISPLAY_MODE_SELECTION = false;

// Threshold constants
const THRESHOLD_MIN = 0.001;
const THRESHOLD_MAX = 1.0;
const THRESHOLD_DEFAULT = 0.03;
const CALIBRATION_DURATION_MS = 3000; // 3 seconds
const CALIBRATION_SAMPLE_INTERVAL_MS = 50; // Sample every 50ms
const CALIBRATION_MULTIPLIER = 4.0; // 12 dB = ~4x multiplier

// dB scale constants for logarithmic visualization
const DB_MIN = -60; // Minimum dB (very quiet)
const DB_MAX = 0; // Maximum dB (maximum level)

// Pure helper functions (no component dependencies)
const normalizeEnergy = (energy: number): number => {
  const MAX_ENERGY = 20.0;
  return Math.min(1.0, Math.max(0, energy / MAX_ENERGY));
};

const energyToDb = (energy: number): number => {
  const normalized = energy > 1.0 ? normalizeEnergy(energy) : energy;
  if (normalized <= 0) return DB_MIN;
  const db = 20 * Math.log10(Math.max(normalized, 0.001));
  return Math.max(DB_MIN, Math.min(DB_MAX, db));
};

const dbToVisualPosition = (db: number): number => {
  const clampedDb = Math.max(DB_MIN, Math.min(DB_MAX, db));
  return ((clampedDb - DB_MIN) / (DB_MAX - DB_MIN)) * 100;
};

const visualPositionToDb = (percent: number): number => {
  const clampedPercent = Math.max(0, Math.min(100, percent));
  return DB_MIN + (clampedPercent / 100) * (DB_MAX - DB_MIN);
};

// Factory to create a gesture handler hook that tracks dragging state
function createDraggingGestureHandler(
  isDraggingRef: React.MutableRefObject<SharedValue<boolean>>
) {
  // Return a hook function that will be called by BottomSheet
  return function useDraggingGestureHandler() {
    const defaultHandlers = useGestureEventsHandlersDefault();
    const draggingShared = isDraggingRef.current;

    return {
      handleOnStart: (
        ...args: Parameters<typeof defaultHandlers.handleOnStart>
      ) => {
        'worklet';
        draggingShared.value = true;
        defaultHandlers.handleOnStart(...args);
      },
      handleOnChange: (
        ...args: Parameters<typeof defaultHandlers.handleOnChange>
      ) => {
        'worklet';
        defaultHandlers.handleOnChange(...args);
      },
      handleOnEnd: (
        ...args: Parameters<typeof defaultHandlers.handleOnEnd>
      ) => {
        'worklet';
        draggingShared.value = false;
        defaultHandlers.handleOnEnd(...args);
      },
      handleOnFinalize: (
        ...args: Parameters<typeof defaultHandlers.handleOnFinalize>
      ) => {
        'worklet';
        draggingShared.value = false;
        defaultHandlers.handleOnFinalize(...args);
      }
    };
  };
}

interface VADSettingsDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  threshold: number;
  onThresholdChange: (threshold: number) => void;
  silenceDuration: number;
  onSilenceDurationChange: (duration: number) => void;
  isVADLocked?: boolean; // Don't stop detection if VAD is locked
  displayMode: 'fullscreen' | 'footer';
  onDisplayModeChange: (mode: 'fullscreen' | 'footer') => void;
  autoCalibrateOnOpen?: boolean; // Automatically start calibration when drawer opens
}

function VADSettingsDrawerInternal({
  isOpen,
  onOpenChange,
  threshold,
  onThresholdChange,
  silenceDuration,
  onSilenceDurationChange,
  isVADLocked = false,
  displayMode,
  onDisplayModeChange,
  autoCalibrateOnOpen = false
}: VADSettingsDrawerProps) {
  const {
    isActive,
    energyResult: _energyResult,
    startEnergyDetection,
    stopEnergyDetection,
    energyShared
  } = useMicrophoneEnergy();
  const { t } = useLocalization();
  const { width: screenWidth } = useWindowDimensions();
  const accentColor = useThemeColor('accent');
  const mutedForegroundColor = useThemeColor('muted-foreground');
  const primaryForegroundColor = useThemeColor('primary-foreground');

  // Track dragging state on JS thread for SVG color changes
  const [isDraggingJS, setIsDraggingJS] = React.useState(false);

  // Calculate energy bar dimensions based on available width
  const { energyBarSegments, energyBarTotalWidth } = React.useMemo(() => {
    const availableWidth = screenWidth - ENERGY_BAR_HORIZONTAL_PADDING;
    // N pills + (N-1) gaps = availableWidth
    // N = (availableWidth + spacing) / (pillWidth + spacing)
    const segments = Math.floor(
      (availableWidth + ENERGY_BAR_SPACING) /
        (ENERGY_BAR_PILL_WIDTH + ENERGY_BAR_SPACING)
    );
    // Actual width: N pills + (N-1) gaps
    const totalWidth =
      segments * ENERGY_BAR_PILL_WIDTH + (segments - 1) * ENERGY_BAR_SPACING;
    return { energyBarSegments: segments, energyBarTotalWidth: totalWidth };
  }, [screenWidth]);

  // Calibration state
  const [isCalibrating, setIsCalibrating] = React.useState(false);
  const [calibrationProgress, setCalibrationProgress] = React.useState(0);
  const [calibrationError, setCalibrationError] = React.useState<string | null>(
    null
  );
  // Status text removed - was causing re-renders. Use worklet-based approach if needed.
  const calibrationSamplesRef = React.useRef<number[]>([]);
  const calibrationIntervalRef = React.useRef<ReturnType<
    typeof setInterval
  > | null>(null);
  const calibrationTimeoutRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  // Ref to track latest energy value for calibration sampling
  const latestEnergyRef = React.useRef<number>(0);

  // Sync threshold to SharedValue for UI thread access
  const thresholdShared = useSharedValue(threshold);
  const prevThresholdRef = React.useRef(threshold);

  React.useEffect(() => {
    // Only update if threshold actually changed (prevents infinite loops)
    if (prevThresholdRef.current !== threshold) {
      thresholdShared.value = threshold;
      prevThresholdRef.current = threshold;
    }
  }, [threshold, thresholdShared]);

  // JS thread callback to update the ref (called from worklet via scheduleOnRN)
  // CRITICAL: Must be a named function reference, not inline arrow function
  const updateLatestEnergy = React.useCallback((energy: number) => {
    latestEnergyRef.current = energy;
  }, []);

  // Update latest energy ref for calibration sampling
  // IMPORTANT: Must use scheduleOnRN to properly bridge UI thread to JS thread
  // No throttling - calibration samples every 50ms and needs fresh values
  useAnimatedReaction(
    () => energyShared.value,
    (currentEnergy) => {
      'worklet';
      // Pass function reference + value, not inline arrow function (would crash)
      scheduleOnRN(updateLatestEnergy, currentEnergy);
    }
  );

  // Simplified: Single derived value for dB calculation
  // Reduced from 2 derived values to 1 to reduce UI thread overhead
  const currentDbShared = useDerivedValue(() => {
    'worklet';
    const energy = energyShared.value;
    const MAX_ENERGY = 20.0;
    const normalized = Math.min(1.0, Math.max(0, energy / MAX_ENERGY));
    if (normalized <= 0) return DB_MIN;
    const db = 20 * Math.log10(Math.max(normalized, 0.001));
    return Math.max(DB_MIN, Math.min(DB_MAX, db));
  });

  // Calculate threshold position - only recalculate when threshold actually changes
  const initialThresholdPosition = React.useMemo(() => {
    const thresholdDb = energyToDb(threshold);
    return dbToVisualPosition(thresholdDb);
  }, [threshold]);

  const thresholdPositionShared = useSharedValue(initialThresholdPosition);

  // Update SharedValue when threshold changes
  React.useEffect(() => {
    const thresholdDb = energyToDb(threshold);
    thresholdPositionShared.value = dbToVisualPosition(thresholdDb);
  }, [threshold, thresholdPositionShared]);

  // JS thread version for button handlers (only recalculates when threshold prop changes)
  const thresholdPosition = React.useMemo(() => {
    const thresholdDb = energyToDb(threshold);
    return dbToVisualPosition(thresholdDb);
  }, [threshold]);

  // Cancel any in-progress calibration
  const cancelCalibration = React.useCallback(() => {
    if (calibrationIntervalRef.current) {
      clearInterval(calibrationIntervalRef.current);
      calibrationIntervalRef.current = null;
    }
    if (calibrationTimeoutRef.current) {
      clearTimeout(calibrationTimeoutRef.current);
      calibrationTimeoutRef.current = null;
    }
    calibrationSamplesRef.current = [];
    setIsCalibrating(false);
    setCalibrationProgress(0);
  }, []);

  // Start monitoring when drawer opens, stop when it closes (unless VAD is locked)
  // Use refs to track previous state and avoid infinite loops from isActive dependency
  const prevIsOpenRef = React.useRef(isOpen);
  const startEnergyDetectionRef = React.useRef(startEnergyDetection);
  const stopEnergyDetectionRef = React.useRef(stopEnergyDetection);
  const isActiveRef = React.useRef(isActive);

  // Keep refs updated with latest values (safe - refs don't trigger re-renders)
  startEnergyDetectionRef.current = startEnergyDetection;
  stopEnergyDetectionRef.current = stopEnergyDetection;
  isActiveRef.current = isActive;

  React.useEffect(() => {
    const wasOpen = prevIsOpenRef.current;
    const currentIsActive = isActiveRef.current;

    // Only act on actual changes, not on every render
    if (isOpen && !wasOpen && !currentIsActive) {
      // Drawer just opened - start energy detection
      console.log(
        '🎯 VAD Settings: Starting energy detection for live preview'
      );
      void startEnergyDetectionRef.current();
    } else if (!isOpen && wasOpen) {
      // Drawer just closed - cancel any in-progress calibration
      cancelCalibration();

      if (currentIsActive && !isVADLocked) {
        // Stop energy detection only if VAD is not locked
        // If VAD is locked, let useVADRecording manage the energy detection
        console.log(
          '🎯 VAD Settings: Stopping energy detection (drawer closed, VAD not locked)'
        );
        void stopEnergyDetectionRef.current();
      }
    }

    // Update refs for next render
    prevIsOpenRef.current = isOpen;
  }, [isOpen, isVADLocked, cancelCalibration]);

  // Logging completely disabled for performance
  // To enable: uncomment the effects below and set ENABLE_VAD_LOGGING = true
  // const ENABLE_VAD_LOGGING = false;
  // Logging effects removed to prevent any potential re-render triggers

  // Reset to default threshold
  const handleResetToDefault = () => {
    onThresholdChange(THRESHOLD_DEFAULT);
  };

  // Auto-calibrate function
  // Use refs for isCalibrating and isActive to avoid dependency loops
  const isCalibratingRefForCallback = React.useRef(isCalibrating);
  const isActiveRefForCallback = React.useRef(isActive);
  isCalibratingRefForCallback.current = isCalibrating;
  isActiveRefForCallback.current = isActive;

  const handleAutoCalibrate = React.useCallback(async () => {
    if (isCalibratingRefForCallback.current) return;

    // Ensure energy detection is active
    if (!isActiveRefForCallback.current) {
      try {
        await startEnergyDetectionRef.current();
        // Wait a bit for energy detection to stabilize
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch {
        setCalibrationError(
          t('vadCalibrationFailed') || 'Failed to start microphone'
        );
        return;
      }
    }

    setIsCalibrating(true);
    setCalibrationProgress(0);
    setCalibrationError(null);
    calibrationSamplesRef.current = [];

    const startTime = Date.now();
    const totalDuration = CALIBRATION_DURATION_MS;

    // Update progress every 100ms
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(100, (elapsed / totalDuration) * 100);
      setCalibrationProgress(progress);
    }, 100);

    // Sample energy levels - use ref to avoid stale closure and worklet issues
    const sampleInterval = setInterval(() => {
      // Use ref to get latest energy value (updated from useAnimatedReaction)
      const currentEnergy = latestEnergyRef.current;
      if (!isNaN(currentEnergy) && currentEnergy > 0) {
        calibrationSamplesRef.current.push(currentEnergy);
      }
    }, CALIBRATION_SAMPLE_INTERVAL_MS);

    calibrationIntervalRef.current = sampleInterval;

    // Complete calibration after duration
    const timeout = setTimeout(() => {
      clearInterval(progressInterval);
      clearInterval(sampleInterval);

      const samples = calibrationSamplesRef.current;
      if (samples.length === 0) {
        setCalibrationError(
          t('vadCalibrationFailed') ||
            'Calibration failed. Please try again in a quieter environment.'
        );
        setIsCalibrating(false);
        setCalibrationProgress(0);
        return;
      }

      // Calculate average background noise (raw RMS energy)
      const average =
        samples.reduce((sum, val) => sum + val, 0) / samples.length;

      // Normalize the average energy to 0-1 range (matching visualization)
      // Swift/Android send raw RMS energy values that need normalization
      const MAX_ENERGY = 20.0;
      const normalizedAverage = Math.min(
        1.0,
        Math.max(0, average / MAX_ENERGY)
      );

      // Check for reasonable noise level (only check if too quiet - allow loud environments)
      if (normalizedAverage < 0.0001) {
        setCalibrationError(
          t('vadCalibrationFailed') ||
            'Calibration failed. Please ensure there is some background noise.'
        );
        setIsCalibrating(false);
        setCalibrationProgress(0);
        return;
      }

      // Calculate new threshold: 4x normalized background noise (12 dB above)
      // Threshold is stored in normalized 0-1 range
      const newThreshold = Math.max(
        THRESHOLD_MIN,
        Math.min(THRESHOLD_MAX, normalizedAverage * CALIBRATION_MULTIPLIER)
      );

      // Apply threshold automatically (use ref to avoid dependency issues)
      onThresholdChangeRef.current(Number(newThreshold.toFixed(4)));

      setIsCalibrating(false);
      setCalibrationProgress(0);
      calibrationSamplesRef.current = [];
    }, totalDuration);

    calibrationTimeoutRef.current = timeout;
  }, [t]); // Removed isCalibrating, isActive, startEnergyDetection from deps - using refs instead

  // Auto-calibrate when drawer opens with autoCalibrateOnOpen flag
  const hasAutoCalibratedRef = React.useRef(false);
  const handleAutoCalibrateRef = React.useRef(handleAutoCalibrate);
  const onThresholdChangeRef = React.useRef(onThresholdChange);

  // Keep refs updated with latest callbacks (use refs to avoid dependency loops)
  // Update refs directly without effect to prevent infinite loops
  handleAutoCalibrateRef.current = handleAutoCalibrate;
  onThresholdChangeRef.current = onThresholdChange;

  // Track isCalibrating with ref to avoid dependency loop
  const isCalibratingRef = React.useRef(isCalibrating);
  isCalibratingRef.current = isCalibrating;

  React.useEffect(() => {
    // Reset flag when drawer closes
    if (!isOpen) {
      hasAutoCalibratedRef.current = false;
      return;
    }

    // Trigger auto-calibration once when drawer opens with flag
    // Use ref for isCalibrating to avoid dependency loop
    // Note: isOpen is guaranteed true here due to early return above
    if (
      autoCalibrateOnOpen &&
      !isCalibratingRef.current &&
      !hasAutoCalibratedRef.current
    ) {
      hasAutoCalibratedRef.current = true;
      // Small delay to ensure drawer is fully open and energy detection can start
      const timer = setTimeout(() => {
        void handleAutoCalibrateRef.current();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoCalibrateOnOpen]); // Removed isCalibrating from deps to prevent infinite loop

  // Cleanup calibration on unmount
  React.useEffect(() => {
    return () => {
      cancelCalibration();
    };
  }, [cancelCalibration]);

  // Increment/decrement handlers for silence duration
  const incrementSilence = () => {
    const newValue = Math.min(3000, silenceDuration + 100);
    onSilenceDurationChange(newValue);
  };

  const decrementSilence = () => {
    const newValue = Math.max(500, silenceDuration - 100);
    onSilenceDurationChange(newValue);
  };

  // Energy level as pixel width for SVG (with frame skipping to match native ~21fps)
  const frameCounter = useSharedValue(0);
  const cachedEnergyLevel = useSharedValue(0);
  // SharedValue for energy bar width (so worklets can access it)
  const energyBarWidthShared = useSharedValue(energyBarTotalWidth);
  // Track if drawer is being dragged (to pause calculations)
  const isDragging = useSharedValue(false);
  const isDraggingRef = React.useRef(isDragging);

  // Create custom gesture handler hook using factory
  const gestureHandlerHook = React.useMemo(
    () => createDraggingGestureHandler(isDraggingRef),
    []
  );

  // Sync isDragging to JS thread for SVG color changes
  // CRITICAL: Must use function reference with scheduleOnRN, not inline arrow
  const updateIsDraggingJS = React.useCallback((dragging: boolean) => {
    setIsDraggingJS(dragging);
  }, []);

  useAnimatedReaction(
    () => isDragging.value,
    (dragging) => {
      'worklet';
      scheduleOnRN(updateIsDraggingJS, dragging);
    }
  );

  // Keep shared value in sync with memoized value
  React.useEffect(() => {
    energyBarWidthShared.value = energyBarTotalWidth;
  }, [energyBarTotalWidth, energyBarWidthShared]);

  // Animated style for the energy fill overlay (clips the gradient SVG)
  const energyFillStyle = useAnimatedStyle(() => {
    'worklet';
    // Skip calculations when drawer is being dragged
    if (isDragging.value) {
      return {
        width: (cachedEnergyLevel.value / 100) * energyBarWidthShared.value
      };
    }

    const counter = frameCounter.value;
    frameCounter.value = (counter + 1) % 3;

    // Calculate energy level every 3rd frame (~20fps to match native ~21fps)
    let energyLevel: number;
    if (counter === 0) {
      const db = currentDbShared.value;
      // Convert dB to percentage (DB_MIN to DB_MAX -> 0 to 100%)
      energyLevel = Math.min(
        100,
        Math.max(0, ((db - DB_MIN) / (DB_MAX - DB_MIN)) * 100)
      );
      cachedEnergyLevel.value = energyLevel;
    } else {
      energyLevel = cachedEnergyLevel.value;
    }

    // Convert percentage to pixel width for SVG
    const fillWidth = (energyLevel / 100) * energyBarWidthShared.value;
    return { width: fillWidth };
  });

  // Animated styles for threshold marker on energy bar (pixel position)
  const thresholdMarkerStyle = useAnimatedStyle(() => {
    'worklet';
    const posPercent = Math.min(
      100,
      Math.max(0, thresholdPositionShared.value)
    );
    // Convert percentage to pixels for the SVG energy bar
    const posPixels = (posPercent / 100) * energyBarWidthShared.value;
    return { left: posPixels };
  });

  // Animated styles for threshold marker on sensitivity bar (percentage)
  const thresholdMarkerPercentStyle = useAnimatedStyle(() => {
    'worklet';
    const pos = Math.min(100, Math.max(0, thresholdPositionShared.value));
    return { left: `${pos}%` };
  });

  // Animated styles for status indicator (runs entirely on UI thread, instant - no animation)
  const recordingStatusStyle = useAnimatedStyle(() => {
    'worklet';
    if (isDragging.value) return { opacity: 0 };
    const isAbove = cachedEnergyLevel.value > thresholdPositionShared.value;
    return { opacity: isAbove ? 1 : 0 };
  });

  const waitingStatusStyle = useAnimatedStyle(() => {
    'worklet';
    if (isDragging.value) return { opacity: 0 };
    const isAbove = cachedEnergyLevel.value > thresholdPositionShared.value;
    return { opacity: isAbove ? 0 : 1 };
  });

  const pausedStatusStyle = useAnimatedStyle(() => {
    'worklet';
    return { opacity: isDragging.value ? 1 : 0 };
  });

  return (
    <Drawer
      open={isOpen}
      onOpenChange={onOpenChange}
      snapPoints={[730, 900]}
      gestureEventsHandlersHook={gestureHandlerHook}
    >
      <DrawerContent className="max-h-[90%]">
        <DrawerHeader className="flex-row items-start justify-between">
          <View className="flex-1">
            <DrawerTitle>{t('vadTitle')}</DrawerTitle>
            <DrawerDescription>{t('vadDescription')}</DrawerDescription>
          </View>
          <Tooltip>
            <TooltipTrigger hitSlop={10}>
              <Icon as={HelpCircle} size={20} />
            </TooltipTrigger>
            <TooltipContent
              className="w-64"
              side="bottom"
              align="end"
              variant="outline"
            >
              <Text>
                {t('vadHelpTitle')}
                {'\n'}
                {'\n'}
                {t('vadHelpAutomatic')}
                {'\n'}
                {'\n'}
                {t('vadHelpSensitivity')}
                {'\n'}
                {'\n'}
                {t('vadHelpPause')}
              </Text>
            </TooltipContent>
          </Tooltip>
        </DrawerHeader>

        <View className="flex flex-col gap-6">
          {/* Display Mode Selection */}
          {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */}
          {SHOULD_SHOW_DISPLAY_MODE_SELECTION && (
            <View className="gap-3">
              <View>
                <Text className="text-sm font-medium text-foreground">
                  {t('vadDisplayMode')}
                </Text>
                <Text className="text-xs text-muted-foreground">
                  {t('vadDisplayDescription')}
                </Text>
              </View>

              <View className="flex-row gap-3">
                {/* Full Screen Option */}
                <Button
                  variant={displayMode === 'fullscreen' ? 'default' : 'outline'}
                  onPress={() => onDisplayModeChange('fullscreen')}
                  className="h-24 flex-1 flex-col gap-2"
                >
                  <Icon
                    as={Maximize2}
                    size={28}
                    className={
                      displayMode === 'fullscreen'
                        ? 'text-primary-foreground'
                        : 'text-foreground'
                    }
                  />
                  <Text
                    className={`text-sm font-medium ${
                      displayMode === 'fullscreen'
                        ? 'text-primary-foreground'
                        : 'text-foreground'
                    }`}
                  >
                    {t('vadFullScreen')}
                  </Text>
                </Button>

                {/* Footer Option */}
                <Button
                  variant={displayMode === 'footer' ? 'default' : 'outline'}
                  onPress={() => onDisplayModeChange('footer')}
                  className="h-24 flex-1 flex-col gap-2"
                >
                  <Icon
                    as={RectangleHorizontal}
                    size={28}
                    className={
                      displayMode === 'footer'
                        ? 'text-primary-foreground'
                        : 'text-foreground'
                    }
                  />
                  <Text
                    className={`text-sm font-medium ${
                      displayMode === 'footer'
                        ? 'text-primary-foreground'
                        : 'text-foreground'
                    }`}
                  >
                    {t('vadFooter')}
                  </Text>
                </Button>
              </View>
            </View>
          )}
          {/* Input Level Visualization */}
          <View className="gap-3">
            <View className="flex-row items-center gap-2">
              <Icon as={Mic} size={18} className="text-foreground" />
              <Text className="text-sm font-medium text-foreground">
                {t('vadCurrentLevel')}
              </Text>
            </View>

            <View className="items-center justify-center py-2">
              <View
                style={{
                  width: energyBarTotalWidth,
                  height: ENERGY_BAR_HEIGHT,
                  position: 'relative'
                }}
              >
                <Svg
                  width={energyBarTotalWidth}
                  height={ENERGY_BAR_HEIGHT}
                  style={{ position: 'absolute', top: 0, left: 0 }}
                >
                  {Array.from({ length: energyBarSegments }).map((_, i) => (
                    <Rect
                      key={i}
                      x={i * (ENERGY_BAR_PILL_WIDTH + ENERGY_BAR_SPACING)}
                      y={0}
                      width={ENERGY_BAR_PILL_WIDTH}
                      height={ENERGY_BAR_HEIGHT}
                      rx={ENERGY_BAR_RADIUS}
                      ry={ENERGY_BAR_RADIUS}
                      fill={accentColor}
                    />
                  ))}
                </Svg>

                <Animated.View
                  style={[
                    {
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      height: ENERGY_BAR_HEIGHT,
                      overflow: 'hidden'
                    },
                    energyFillStyle
                  ]}
                >
                  <Svg width={energyBarTotalWidth} height={ENERGY_BAR_HEIGHT}>
                    <Defs>
                      <SvgLinearGradient
                        id="energyGrad"
                        x1="0"
                        y1="0"
                        x2="1"
                        y2="0"
                      >
                        <Stop
                          offset="0%"
                          stopColor={
                            isDraggingJS ? mutedForegroundColor : '#22c55e'
                          }
                        />
                        <Stop
                          offset="25%"
                          stopColor={
                            isDraggingJS ? mutedForegroundColor : '#84cc16'
                          }
                        />
                        <Stop
                          offset="50%"
                          stopColor={
                            isDraggingJS ? mutedForegroundColor : '#eab308'
                          }
                        />
                        <Stop
                          offset="75%"
                          stopColor={
                            isDraggingJS ? mutedForegroundColor : '#f97316'
                          }
                        />
                        <Stop
                          offset="100%"
                          stopColor={
                            isDraggingJS ? mutedForegroundColor : '#ef4444'
                          }
                        />
                      </SvgLinearGradient>
                      <Mask id="pillMask">
                        {Array.from({ length: energyBarSegments }).map(
                          (_, i) => (
                            <Rect
                              key={i}
                              x={
                                i * (ENERGY_BAR_PILL_WIDTH + ENERGY_BAR_SPACING)
                              }
                              y={0}
                              width={ENERGY_BAR_PILL_WIDTH}
                              height={ENERGY_BAR_HEIGHT}
                              rx={ENERGY_BAR_RADIUS}
                              ry={ENERGY_BAR_RADIUS}
                              fill="white"
                            />
                          )
                        )}
                      </Mask>
                    </Defs>
                    <Rect
                      width={energyBarTotalWidth}
                      height={ENERGY_BAR_HEIGHT}
                      fill="url(#energyGrad)"
                      mask="url(#pillMask)"
                    />
                  </Svg>
                </Animated.View>

                <Animated.View
                  style={[
                    {
                      position: 'absolute',
                      top: 0,
                      height: ENERGY_BAR_HEIGHT,
                      width: 3,
                      zIndex: 10
                    },
                    thresholdMarkerStyle
                  ]}
                  className="bg-destructive shadow-lg"
                />
              </View>
            </View>

            <View className="relative h-5">
              <Animated.View
                style={[{ position: 'absolute', left: 0 }, waitingStatusStyle]}
              >
                <Text className="text-xs text-muted-foreground">
                  💤 {t('vadWaiting')}
                </Text>
              </Animated.View>
              <Animated.View
                style={[
                  { position: 'absolute', left: 0 },
                  recordingStatusStyle
                ]}
              >
                <Text className="text-xs text-muted-foreground">
                  🎤 {t('vadRecordingNow')}
                </Text>
              </Animated.View>
              <Animated.View
                style={[{ position: 'absolute', left: 0 }, pausedStatusStyle]}
              >
                <Text className="text-xs text-muted-foreground">⏸️ Paused</Text>
              </Animated.View>
            </View>
          </View>

          <View className="gap-3">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Icon as={Volume1} size={18} className="text-foreground" />
                <Text className="text-sm font-medium text-foreground">
                  {t('vadThreshold')}
                </Text>
              </View>
              <Button
                variant="ghost"
                size="sm"
                onPress={handleResetToDefault}
                className="h-8"
              >
                <Icon as={RotateCcw} size={16} />
              </Button>
            </View>

            <View className="relative h-16 w-full overflow-hidden rounded-lg">
              <LinearGradient
                colors={ENERGY_GRADIENT_COLORS_DIMMED}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ position: 'absolute', width: '100%', height: '100%' }}
              />
              <Animated.View
                style={[
                  {
                    position: 'absolute',
                    top: 0,
                    height: '100%',
                    width: 4,
                    marginLeft: -2
                  },
                  thresholdMarkerPercentStyle
                ]}
                className="bg-destructive shadow-lg"
              >
                <View className="absolute -top-2 left-1/2 -translate-x-1/2">
                  <Icon as={ChevronUp} size={16} className="text-destructive" />
                </View>
              </Animated.View>

              <View className="absolute inset-0 flex-row items-center justify-between px-2">
                <Button
                  variant="secondary"
                  onPress={() => {
                    const currentPos = thresholdPosition;
                    const stepPercent = 2; // 2% visual step
                    const newPos = Math.max(0, currentPos - stepPercent);
                    const newDb = visualPositionToDb(newPos);
                    // Convert dB back to energy (0-1), clamp dB to valid range first
                    const clampedDb = Math.max(DB_MIN, Math.min(DB_MAX, newDb));
                    const newEnergy =
                      clampedDb <= DB_MIN
                        ? THRESHOLD_MIN
                        : Math.pow(10, clampedDb / 20);
                    const newThreshold = Math.max(
                      THRESHOLD_MIN,
                      Math.min(THRESHOLD_MAX, newEnergy)
                    );
                    onThresholdChange(Number(newThreshold.toFixed(4)));
                  }}
                  disabled={threshold <= THRESHOLD_MIN}
                  className="size-12"
                >
                  <Icon as={ArrowBigLeft} size={20} />
                </Button>

                <Button
                  variant="secondary"
                  onPress={() => {
                    const currentPos = thresholdPosition;
                    const stepPercent = 2; // 2% visual step
                    const newPos = Math.min(100, currentPos + stepPercent);
                    const newDb = visualPositionToDb(newPos);
                    // Convert dB back to energy (0-1), clamp dB to valid range first
                    const clampedDb = Math.max(DB_MIN, Math.min(DB_MAX, newDb));
                    const newEnergy =
                      clampedDb <= DB_MIN
                        ? THRESHOLD_MIN
                        : Math.pow(10, clampedDb / 20);
                    const newThreshold = Math.max(
                      THRESHOLD_MIN,
                      Math.min(THRESHOLD_MAX, newEnergy)
                    );
                    onThresholdChange(Number(newThreshold.toFixed(4)));
                  }}
                  disabled={threshold >= THRESHOLD_MAX}
                  className="size-12"
                >
                  <Icon as={ArrowBigRight} size={20} />
                </Button>
              </View>
            </View>

            <View className="gap-2">
              <Button
                onPress={handleAutoCalibrate}
                disabled={isCalibrating}
                className="w-full"
              >
                {isCalibrating ? (
                  <View className="flex-row items-center gap-2">
                    <ActivityIndicator
                      size="small"
                      color={primaryForegroundColor}
                    />
                    <Text className="text-primary-foreground">
                      {t('vadCalibrating') || 'Calibrating...'}{' '}
                      {Math.round(calibrationProgress)}%
                    </Text>
                  </View>
                ) : (
                  <View className="flex-row items-center gap-2">
                    <Icon
                      as={Sparkles}
                      size={20}
                      className="text-primary-foreground"
                    />
                    <Text className="text-primary-foreground">
                      {t('vadAutoCalibrate') || 'Auto-Calibrate'}
                    </Text>
                  </View>
                )}
              </Button>

              {calibrationError && (
                <Text className="text-xs text-destructive">
                  {calibrationError}
                </Text>
              )}
            </View>
          </View>

          <View className="gap-3">
            <Text className="text-sm font-medium text-foreground">
              {t('vadSilenceDuration')}
            </Text>

            <View className="flex-row items-center gap-3">
              <Button
                variant="outline"
                size="icon-2xl"
                onPress={decrementSilence}
                disabled={silenceDuration <= 500}
              >
                <Icon as={Minus} size={24} />
              </Button>

              <View className="flex-1 items-center rounded-lg border border-border bg-muted p-3">
                <Text className="text-2xl font-bold text-foreground">
                  {(silenceDuration / 1000).toFixed(1)}s
                </Text>
                <Text className="text-xs text-muted-foreground">
                  {silenceDuration < 1000
                    ? t('vadQuickSegments')
                    : silenceDuration <= 1500
                      ? t('vadBalanced')
                      : t('vadCompleteThoughts')}
                </Text>
              </View>

              <Button
                variant="outline"
                size="icon-2xl"
                onPress={incrementSilence}
                disabled={silenceDuration >= 3000}
              >
                <Icon as={Plus} size={24} />
              </Button>
            </View>

            <Text className="text-xs text-muted-foreground">
              {t('vadSilenceDescription')}
            </Text>
          </View>
        </View>

        <DrawerFooter>
          <DrawerClose>
            <Text>{t('done')}</Text>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

// Memoize with custom comparison to prevent re-renders from useMicrophoneEnergy's energyResult updates
// CRITICAL: Must allow re-renders when isOpen changes, but ignore callback changes
export const VADSettingsDrawer = React.memo(
  VADSettingsDrawerInternal,
  (prevProps, nextProps) => {
    // React.memo: return true = props equal (skip re-render), false = props different (re-render)

    // CRITICAL: Always re-render when isOpen changes (drawer open/close)
    if (prevProps.isOpen !== nextProps.isOpen) {
      return false; // Props changed, must re-render
    }

    // Check other primitive props (not callbacks - they cause infinite loops)
    const primitivePropsEqual =
      prevProps.threshold === nextProps.threshold &&
      prevProps.silenceDuration === nextProps.silenceDuration &&
      prevProps.isVADLocked === nextProps.isVADLocked &&
      prevProps.displayMode === nextProps.displayMode &&
      prevProps.autoCalibrateOnOpen === nextProps.autoCalibrateOnOpen;

    // Return true if primitive props are equal (skip re-render)
    // This prevents re-renders from useMicrophoneEnergy's internal state updates
    return primitivePropsEqual;
  }
);
