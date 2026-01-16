/**
 * VADSettingsDrawer - Settings drawer for voice activity detection
 * Shows live energy levels and allows threshold adjustment
 *
 */

import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerScrollView,
  DrawerTitle
} from '@/components/ui/drawer';
import { Icon } from '@/components/ui/icon';
import { Slider } from '@/components/ui/slider';
import { Text } from '@/components/ui/text';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip';
import { useLocalization } from '@/hooks/useLocalization';
import { useMicrophoneEnergy } from '@/hooks/useMicrophoneEnergy';
import {
  VAD_MIN_SEGMENT_LENGTH_DEFAULT,
  VAD_MIN_SEGMENT_LENGTH_MAX,
  VAD_MIN_SEGMENT_LENGTH_MIN,
  VAD_SILENCE_DURATION_DEFAULT,
  VAD_SILENCE_DURATION_MAX,
  VAD_SILENCE_DURATION_MIN,
  VAD_THRESHOLD_DEFAULT,
  VAD_THRESHOLD_MAX,
  VAD_THRESHOLD_MIN
} from '@/store/localStore';
import { useThemeColor } from '@/utils/styleUtils';
import { PortalHost } from '@rn-primitives/portal';
import {
  HelpCircle,
  Maximize2,
  Mic,
  Minus,
  Plus,
  RectangleHorizontal,
  RotateCcw,
  Sparkles
} from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import Animated, {
  cancelAnimation,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  Mask,
  Rect,
  Stop,
  LinearGradient as SvgLinearGradient
} from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

// Segmented energy bar constants
const ENERGY_BAR_PILL_WIDTH = 18; // Individual pill width in px
const ENERGY_BAR_HEIGHT = 28; // Bar height in px
const ENERGY_BAR_SPACING = 4; // Gap between pills in px
const ENERGY_BAR_RADIUS = 4; // Pill corner radius in px
// Energy bar width is now measured dynamically via onLayout

// Animated circle for Reanimated
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SHOULD_SHOW_DISPLAY_MODE_SELECTION = false;

// Calibration constants
const CALIBRATION_DURATION_MS = 3000; // 3 seconds
const CALIBRATION_SAMPLE_INTERVAL_MS = 50; // Sample every 50ms
const CALIBRATION_MULTIPLIER = 4.0; // 12 dB = ~4x multiplier

// dB scale constants for logarithmic visualization
const DB_MIN = -60; // Minimum dB (very quiet)
const DB_MAX = 0; // Maximum dB (maximum level)

// Pure helper functions (no component dependencies)
// CRITICAL: Native module sends energy as normalized amplitude (0-1 range)
// NOT raw RMS energy, so normalizeEnergy should only clamp, not divide
const _normalizeEnergy = (energy: number): number => {
  // Energy from native is already normalized amplitude (0-1)
  // Only clamp to ensure it's in valid range
  return Math.min(1.0, Math.max(0, energy));
};

const energyToDb = (energy: number): number => {
  // Energy is already normalized (0-1), just clamp if needed
  const normalized = energy > 1.0 ? 1.0 : Math.max(0, energy);
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

// Linear UI to exponential energy conversion (for intuitive slider)
// Maps linear UI value (0-1) to energy value (VAD_THRESHOLD_MIN to VAD_THRESHOLD_MAX)
// Uses logarithmic interpolation so the slider feels linear to users
const linearUIToEnergy = (linearValue: number): number => {
  // Validate input
  if (!isFinite(linearValue)) return VAD_THRESHOLD_DEFAULT;

  const clamped = Math.max(0, Math.min(1, linearValue));
  if (clamped === 0) return VAD_THRESHOLD_MIN;
  if (clamped === 1) return VAD_THRESHOLD_MAX;

  // Logarithmic interpolation: e = min * (max/min)^u
  // This makes the slider feel linear while mapping to exponential energy values
  const ratio = VAD_THRESHOLD_MAX / VAD_THRESHOLD_MIN;
  const energy = VAD_THRESHOLD_MIN * Math.pow(ratio, clamped);

  // Validate result and clamp to avoid precision issues
  if (!isFinite(energy)) return VAD_THRESHOLD_DEFAULT;

  const result = Math.max(
    VAD_THRESHOLD_MIN,
    Math.min(VAD_THRESHOLD_MAX, Number(energy.toFixed(6)))
  );

  return isFinite(result) ? result : VAD_THRESHOLD_DEFAULT;
};

// Exponential energy to linear UI conversion (inverse of above)
const energyToLinearUI = (energy: number): number => {
  // Validate input
  if (!isFinite(energy) || energy <= 0) return 0;
  if (energy >= VAD_THRESHOLD_MAX) return 1;

  const clamped = Math.max(
    VAD_THRESHOLD_MIN,
    Math.min(VAD_THRESHOLD_MAX, energy)
  );
  if (clamped <= VAD_THRESHOLD_MIN) return 0;
  if (clamped >= VAD_THRESHOLD_MAX) return 1;

  // Inverse logarithmic interpolation: u = log(e/min) / log(max/min)
  const ratio = VAD_THRESHOLD_MAX / VAD_THRESHOLD_MIN;
  const logRatio = Math.log(ratio);

  // Avoid division by zero or invalid log calculations
  if (!isFinite(logRatio) || logRatio === 0) return 0;

  const numerator = Math.log(clamped / VAD_THRESHOLD_MIN);
  if (!isFinite(numerator)) return 0;

  const linearValue = numerator / logRatio;

  // Ensure result is valid and clamped
  const result = Math.max(0, Math.min(1, linearValue));
  return isFinite(result) ? result : 0;
};

// Using gorhom Drawer with custom slider that handles gestures properly

interface VADSettingsDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  threshold: number;
  onThresholdChange: (threshold: number) => void;
  silenceDuration: number;
  onSilenceDurationChange: (duration: number) => void;
  minSegmentLength: number;
  onMinSegmentLengthChange: (duration: number) => void;
  isVADLocked?: boolean; // Don't stop detection if VAD is locked
  displayMode: 'fullscreen' | 'footer';
  onDisplayModeChange: (mode: 'fullscreen' | 'footer') => void;
  autoCalibrateOnOpen?: boolean; // Automatically start calibration when drawer opens
  energyShared?: SharedValue<number>; // Optional: Use this energy source when VAD is locked
}

function VADSettingsDrawerInternal({
  isOpen,
  onOpenChange,
  threshold,
  onThresholdChange,
  silenceDuration,
  onSilenceDurationChange,
  minSegmentLength,
  onMinSegmentLengthChange,
  isVADLocked = false,
  displayMode,
  onDisplayModeChange,
  autoCalibrateOnOpen = false,
  energyShared: externalEnergyShared
}: VADSettingsDrawerProps) {
  const {
    isActive,
    startEnergyDetection,
    stopEnergyDetection,
    resetEnergy,
    energyShared: internalEnergyShared
  } = useMicrophoneEnergy();

  // Use external energy source when VAD is locked, otherwise use internal
  const energyShared =
    isVADLocked && externalEnergyShared
      ? externalEnergyShared
      : internalEnergyShared;

  // Ref to store latest energy value for calibration (updated via worklet bridge)
  const latestEnergyRef = React.useRef(0);
  const { t } = useLocalization();
  const accentColor = useThemeColor('accent');
  const mutedForegroundColor = useThemeColor('muted-foreground');
  const primaryForegroundColor = useThemeColor('primary-foreground');
  const borderColor = useThemeColor('border');

  // Track dragging state on JS thread for SVG color changes
  const [isDraggingJS] = React.useState(false);

  // Measure actual container width for energy bar (adapts to any padding)
  const [energyBarContainerWidth, setEnergyBarContainerWidth] =
    React.useState(0);

  // Calculate energy bar dimensions based on measured container width
  const { energyBarSegments, energyBarTotalWidth } = React.useMemo(() => {
    if (energyBarContainerWidth === 0) {
      return { energyBarSegments: 0, energyBarTotalWidth: 0 };
    }
    // N pills + (N-1) gaps = availableWidth
    // N = (availableWidth + spacing) / (pillWidth + spacing)
    const segments = Math.floor(
      (energyBarContainerWidth + ENERGY_BAR_SPACING) /
        (ENERGY_BAR_PILL_WIDTH + ENERGY_BAR_SPACING)
    );
    // Actual width: N pills + (N-1) gaps
    const totalWidth =
      segments * ENERGY_BAR_PILL_WIDTH + (segments - 1) * ENERGY_BAR_SPACING;
    return { energyBarSegments: segments, energyBarTotalWidth: totalWidth };
  }, [energyBarContainerWidth]);

  // Local state for immediate UI updates (bypasses store persistence delay)
  const [localThreshold, setLocalThreshold] = React.useState(threshold);
  const [localSilenceDuration, setLocalSilenceDuration] =
    React.useState(silenceDuration);
  const [localMinSegmentLength, setLocalMinSegmentLength] =
    React.useState(minSegmentLength);
  const storeUpdateTimeoutRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const silenceStoreUpdateTimeoutRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const minSegmentStoreUpdateTimeoutRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  // Sync local threshold with prop when it changes externally
  React.useEffect(() => {
    setLocalThreshold(threshold);
  }, [threshold]);

  // Sync local silence duration with prop when it changes externally
  React.useEffect(() => {
    setLocalSilenceDuration(silenceDuration);
  }, [silenceDuration]);

  // Sync local min segment length with prop when it changes externally
  React.useEffect(() => {
    setLocalMinSegmentLength(minSegmentLength);
  }, [minSegmentLength]);

  // Immediate UI update function - updates local state instantly
  const updateThresholdImmediate = React.useCallback(
    (newThreshold: number) => {
      // Update local state immediately - instant UI feedback, NO DELAYS
      setLocalThreshold(newThreshold);

      // Clear any pending store update
      if (storeUpdateTimeoutRef.current) {
        clearTimeout(storeUpdateTimeoutRef.current);
      }

      // Save to store in background (don't block UI thread)
      storeUpdateTimeoutRef.current = setTimeout(() => {
        onThresholdChange(newThreshold);
        storeUpdateTimeoutRef.current = null;
      }, 500);
    },
    [onThresholdChange]
  );

  // Save settings when drawer closes (flush immediately)
  React.useEffect(() => {
    if (!isOpen) {
      // Flush any pending threshold update
      if (storeUpdateTimeoutRef.current) {
        clearTimeout(storeUpdateTimeoutRef.current);
        storeUpdateTimeoutRef.current = null;
      }
      if (localThreshold !== threshold) {
        onThresholdChange(localThreshold);
      }

      // Flush any pending silence duration update
      if (silenceStoreUpdateTimeoutRef.current) {
        clearTimeout(silenceStoreUpdateTimeoutRef.current);
        silenceStoreUpdateTimeoutRef.current = null;
      }
      if (localSilenceDuration !== silenceDuration) {
        onSilenceDurationChange(localSilenceDuration);
      }

      // Flush any pending min segment length update
      if (minSegmentStoreUpdateTimeoutRef.current) {
        clearTimeout(minSegmentStoreUpdateTimeoutRef.current);
        minSegmentStoreUpdateTimeoutRef.current = null;
      }
      if (localMinSegmentLength !== minSegmentLength) {
        onMinSegmentLengthChange(localMinSegmentLength);
      }
    }
  }, [isOpen]); // Only depend on isOpen to avoid unnecessary runs

  // Cleanup timeouts on unmount
  React.useEffect(() => {
    return () => {
      if (storeUpdateTimeoutRef.current) {
        clearTimeout(storeUpdateTimeoutRef.current);
      }
      if (silenceStoreUpdateTimeoutRef.current) {
        clearTimeout(silenceStoreUpdateTimeoutRef.current);
      }
      if (minSegmentStoreUpdateTimeoutRef.current) {
        clearTimeout(minSegmentStoreUpdateTimeoutRef.current);
      }
    };
  }, []);

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
  // CRITICAL: Native module sends smoothedEnergy as normalized amplitude (0-1 range)
  // NOT raw RMS energy, so we should NOT divide by MAX_ENERGY
  const currentDbShared = useDerivedValue(() => {
    'worklet';
    const energy = energyShared.value;
    // Energy is already normalized amplitude (0-1) from native module
    // Native module: peak amplitude → dB → amplitude (0-1) → EMA smoothed
    const normalized = Math.min(1.0, Math.max(0, energy));
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

  // JS thread version for button handlers (uses localThreshold for instant UI response)
  const thresholdPosition = React.useMemo(() => {
    const thresholdDb = energyToDb(localThreshold);
    return dbToVisualPosition(thresholdDb);
  }, [localThreshold]);

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

  // Button handlers for threshold adjustment
  const handleDecreaseThreshold = React.useCallback(() => {
    const currentPos = thresholdPosition;
    const stepPercent = 2;
    const newPos = Math.max(0, currentPos - stepPercent);
    const newDb = visualPositionToDb(newPos);
    const clampedDb = Math.max(DB_MIN, Math.min(DB_MAX, newDb));
    const newEnergy =
      clampedDb <= DB_MIN ? VAD_THRESHOLD_MIN : Math.pow(10, clampedDb / 20);
    const newThreshold = Math.max(
      VAD_THRESHOLD_MIN,
      Math.min(VAD_THRESHOLD_MAX, newEnergy)
    );
    updateThresholdImmediate(Number(newThreshold.toFixed(4)));
  }, [thresholdPosition, updateThresholdImmediate]);

  const handleIncreaseThreshold = React.useCallback(() => {
    const currentPos = thresholdPosition;
    const stepPercent = 2;
    const newPos = Math.min(100, currentPos + stepPercent);
    const newDb = visualPositionToDb(newPos);
    const clampedDb = Math.max(DB_MIN, Math.min(DB_MAX, newDb));
    const newEnergy =
      clampedDb <= DB_MIN ? VAD_THRESHOLD_MIN : Math.pow(10, clampedDb / 20);
    const newThreshold = Math.max(
      VAD_THRESHOLD_MIN,
      Math.min(VAD_THRESHOLD_MAX, newEnergy)
    );
    updateThresholdImmediate(Number(newThreshold.toFixed(4)));
  }, [thresholdPosition, updateThresholdImmediate]);

  // Start monitoring when drawer opens, stop when it closes (unless VAD is locked)
  // Use refs to track previous state and avoid infinite loops from isActive dependency
  const prevIsOpenRef = React.useRef(isOpen);
  const startEnergyDetectionRef = React.useRef(startEnergyDetection);
  const stopEnergyDetectionRef = React.useRef(stopEnergyDetection);
  const isActiveRef = React.useRef(isActive);

  // Keep refs updated with latest values (safe - refs don't trigger re-renders)
  React.useEffect(() => {
    startEnergyDetectionRef.current = startEnergyDetection;
    stopEnergyDetectionRef.current = stopEnergyDetection;
    isActiveRef.current = isActive;
  }, [startEnergyDetection, stopEnergyDetection, isActive]);

  React.useEffect(() => {
    const wasOpen = prevIsOpenRef.current;
    const currentIsActive = isActiveRef.current;

    // Only act on actual changes, not on every render
    if (isOpen && !wasOpen) {
      // Drawer just opened
      // CRITICAL: If VAD is locked, energy detection is already running via useVADRecording
      // Don't call startEnergyDetection() again - it would interfere with the native module
      if (isVADLocked) {
        console.log(
          '🎯 VAD Settings: Drawer opened with VAD locked - using existing energy detection'
        );
        // Don't reset energy or start detection - let useVADRecording manage it
      } else {
        // Reset energy values to prevent stuck values from previous session
        resetEnergy();
        latestEnergyRef.current = 0;

        if (!currentIsActive) {
          console.log(
            '🎯 VAD Settings: Starting energy detection for live preview'
          );
          void startEnergyDetectionRef.current();
        } else {
          console.log(
            '🎯 VAD Settings: Drawer opened but energy detection already active (skipping start)'
          );
        }
      }
    } else if (!isOpen && wasOpen) {
      // Drawer just closed - cancel any in-progress calibration
      cancelCalibration();

      // CRITICAL: If VAD is locked, don't touch energy detection or reset values
      // useVADRecording is managing the native module and needs consistent state
      if (!isVADLocked) {
        // Reset energy values only when VAD is not locked
        resetEnergy();
        latestEnergyRef.current = 0;

        if (currentIsActive) {
          // Stop energy detection only if VAD is not locked
          // If VAD is locked, let useVADRecording manage the energy detection
          console.log(
            '🎯 VAD Settings: Stopping energy detection (drawer closed, VAD not locked)'
          );
          void stopEnergyDetectionRef.current();
        }
      } else {
        console.log(
          '🎯 VAD Settings: Drawer closed with VAD locked - leaving energy detection running'
        );
      }
    }

    // Update refs for next render
    prevIsOpenRef.current = isOpen;
  }, [isOpen, isVADLocked, cancelCalibration, resetEnergy]);

  // Reset to default threshold
  const handleResetToDefault = React.useCallback(() => {
    updateThresholdImmediate(VAD_THRESHOLD_DEFAULT);
  }, [updateThresholdImmediate]);

  // Auto-calibrate function
  // Use refs for isCalibrating and isActive to avoid dependency loops
  const isCalibratingRefForCallback = React.useRef(isCalibrating);
  const isActiveRefForCallback = React.useRef(isActive);
  React.useEffect(() => {
    isCalibratingRefForCallback.current = isCalibrating;
    isActiveRefForCallback.current = isActive;
  }, [isCalibrating, isActive]);

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

      // Calculate average background noise
      // CRITICAL: Native module sends normalized amplitude (0-1), not raw RMS
      // So we should use the values directly without dividing by MAX_ENERGY
      const average =
        samples.reduce((sum, val) => sum + val, 0) / samples.length;

      // Energy is already normalized amplitude (0-1) from native module
      // Just clamp to ensure valid range
      const normalizedAverage = Math.min(1.0, Math.max(0, average));

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
        VAD_THRESHOLD_MIN,
        Math.min(VAD_THRESHOLD_MAX, normalizedAverage * CALIBRATION_MULTIPLIER)
      );

      // Apply threshold automatically
      updateThresholdImmediate(Number(newThreshold.toFixed(4)));

      setIsCalibrating(false);
      setCalibrationProgress(0);
      calibrationSamplesRef.current = [];
    }, totalDuration);

    calibrationTimeoutRef.current = timeout;
  }, [t, updateThresholdImmediate]); // Removed isCalibrating, isActive, startEnergyDetection from deps - using refs instead

  // Auto-calibrate when drawer opens with autoCalibrateOnOpen flag
  const hasAutoCalibratedRef = React.useRef(false);
  const handleAutoCalibrateRef = React.useRef<
    typeof handleAutoCalibrate | null
  >(null);
  const onThresholdChangeRef = React.useRef<typeof onThresholdChange | null>(
    null
  );

  // Keep refs updated with latest callbacks (use refs to avoid dependency loops)
  // Update refs in effect to satisfy linter (refs are still updated synchronously before use)
  React.useEffect(() => {
    handleAutoCalibrateRef.current = handleAutoCalibrate;
    onThresholdChangeRef.current = onThresholdChange;
  }, [handleAutoCalibrate, onThresholdChange]);

  // Track isCalibrating with ref to avoid dependency loop
  const isCalibratingRef = React.useRef(isCalibrating);
  React.useEffect(() => {
    isCalibratingRef.current = isCalibrating;
  }, [isCalibrating]);

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
        void handleAutoCalibrateRef.current?.();
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

  // Immediate update function for silence duration
  const updateSilenceDurationImmediate = React.useCallback(
    (newDuration: number) => {
      // Update local state immediately - instant UI feedback
      setLocalSilenceDuration(newDuration);

      // Clear any pending store update
      if (silenceStoreUpdateTimeoutRef.current) {
        clearTimeout(silenceStoreUpdateTimeoutRef.current);
      }

      // Save to store in background (don't block UI)
      silenceStoreUpdateTimeoutRef.current = setTimeout(() => {
        onSilenceDurationChange(newDuration);
        silenceStoreUpdateTimeoutRef.current = null;
      }, 300);
    },
    [onSilenceDurationChange]
  );

  // Increment/decrement handlers for silence duration
  const incrementSilence = React.useCallback(() => {
    const newValue = Math.min(
      VAD_SILENCE_DURATION_MAX,
      localSilenceDuration + 100
    );
    updateSilenceDurationImmediate(newValue);
  }, [localSilenceDuration, updateSilenceDurationImmediate]);

  const decrementSilence = React.useCallback(() => {
    const newValue = Math.max(
      VAD_SILENCE_DURATION_MIN,
      localSilenceDuration - 100
    );
    updateSilenceDurationImmediate(newValue);
  }, [localSilenceDuration, updateSilenceDurationImmediate]);

  const resetSilenceDuration = React.useCallback(() => {
    updateSilenceDurationImmediate(VAD_SILENCE_DURATION_DEFAULT);
  }, [updateSilenceDurationImmediate]);

  // Immediate update function for min segment length
  const updateMinSegmentLengthImmediate = React.useCallback(
    (newLength: number) => {
      // Update local state immediately - instant UI feedback
      setLocalMinSegmentLength(newLength);

      // Clear any pending store update
      if (minSegmentStoreUpdateTimeoutRef.current) {
        clearTimeout(minSegmentStoreUpdateTimeoutRef.current);
      }

      // Save to store in background (don't block UI)
      minSegmentStoreUpdateTimeoutRef.current = setTimeout(() => {
        onMinSegmentLengthChange(newLength);
        minSegmentStoreUpdateTimeoutRef.current = null;
      }, 300);
    },
    [onMinSegmentLengthChange]
  );

  // Increment/decrement handlers for min segment length (50ms steps)
  const incrementMinSegmentLength = React.useCallback(() => {
    const newValue = Math.min(
      VAD_MIN_SEGMENT_LENGTH_MAX,
      localMinSegmentLength + 50
    );
    updateMinSegmentLengthImmediate(newValue);
  }, [localMinSegmentLength, updateMinSegmentLengthImmediate]);

  const decrementMinSegmentLength = React.useCallback(() => {
    const newValue = Math.max(
      VAD_MIN_SEGMENT_LENGTH_MIN,
      localMinSegmentLength - 50
    );
    updateMinSegmentLengthImmediate(newValue);
  }, [localMinSegmentLength, updateMinSegmentLengthImmediate]);

  const resetMinSegmentLength = React.useCallback(() => {
    updateMinSegmentLengthImmediate(VAD_MIN_SEGMENT_LENGTH_DEFAULT);
  }, [updateMinSegmentLengthImmediate]);

  // Energy level as pixel width for SVG (with frame skipping to match native ~21fps)
  const frameCounter = useSharedValue(0);
  const cachedEnergyLevel = useSharedValue(0);
  // SharedValue for energy bar width (so worklets can access it)
  const energyBarWidthShared = useSharedValue(energyBarTotalWidth);
  // Custom slider handles gesture conflicts with BottomSheet

  // Keep shared value in sync with memoized value
  React.useEffect(() => {
    energyBarWidthShared.value = energyBarTotalWidth;
  }, [energyBarTotalWidth, energyBarWidthShared]);

  // Animated style for the energy fill overlay (clips the gradient SVG)
  const energyFillStyle = useAnimatedStyle(() => {
    'worklet';
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

  // Animated styles for status indicator (runs entirely on UI thread, instant - no animation)
  const recordingStatusStyle = useAnimatedStyle(() => {
    'worklet';
    const isAbove = cachedEnergyLevel.value > thresholdPositionShared.value;
    return { opacity: isAbove ? 1 : 0 };
  });

  const waitingStatusStyle = useAnimatedStyle(() => {
    'worklet';
    const isAbove = cachedEnergyLevel.value > thresholdPositionShared.value;
    return { opacity: isAbove ? 0 : 1 };
  });

  // Silence timer progress (1 = full/speaking, 0 = empty/will split)
  const silenceTimerProgress = useSharedValue(0);
  const wasAboveThreshold = useSharedValue(false);
  const silenceDurationShared = useSharedValue(localSilenceDuration);

  // Keep silence duration shared value in sync
  React.useEffect(() => {
    silenceDurationShared.value = localSilenceDuration;
  }, [localSilenceDuration, silenceDurationShared]);

  // Track silence timer on UI thread: fills instantly when speaking, drains when quiet
  useAnimatedReaction(
    () => ({
      energyLevel: cachedEnergyLevel.value,
      threshold: thresholdPositionShared.value
    }),
    (current) => {
      'worklet';
      const isAboveThreshold = current.energyLevel > current.threshold;

      if (isAboveThreshold) {
        // Speaking: instantly fill to 100%
        cancelAnimation(silenceTimerProgress);
        silenceTimerProgress.value = 1;
        wasAboveThreshold.value = true;
      } else if (wasAboveThreshold.value) {
        // Just went quiet: start draining over silenceDuration
        wasAboveThreshold.value = false;
        silenceTimerProgress.value = withTiming(0, {
          duration: silenceDurationShared.value
        });
      }
    }
  );

  // Circular progress indicator props
  const CIRCLE_SIZE = 40;
  const STROKE_WIDTH = 5;
  const RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

  const animatedCircleProps = useAnimatedProps(() => {
    const progress = silenceTimerProgress.value;
    const strokeDashoffset = CIRCUMFERENCE * (1 - progress);
    return { strokeDashoffset };
  });

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange} snapPoints={['100%']}>
      <DrawerContent asChild>
        <View style={{ flex: 1 }} className="px-6">
          <DrawerScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 16 }}
          >
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
                  className="w-72"
                  side="bottom"
                  align="end"
                  sideOffset={2}
                  portalHost="vad-settings-drawer"
                >
                  <View>
                    <Text className="font-bold">{t('vadHelpTitle')}</Text>
                    <Text className="mt-2">{t('vadHelpAutomatic')}</Text>
                    <Text className="mt-2">{t('vadHelpSensitivity')}</Text>
                    <Text className="mt-2">{t('vadHelpPause')}</Text>
                    <Text className="mt-2">{t('vadHelpMinSegment')}</Text>
                  </View>
                </TooltipContent>
              </Tooltip>
            </DrawerHeader>

            <View className="flex flex-col gap-6">
              {/* ═══════════════════════════════════════════════════════════════
              SECTION 1: Display Mode Selection (currently hidden)
              Choose between fullscreen overlay or footer-based VAD display
              ═══════════════════════════════════════════════════════════════ */}
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
                      variant={
                        displayMode === 'fullscreen' ? 'default' : 'outline'
                      }
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
              {/* ═══════════════════════════════════════════════════════════════
              SECTION 2: Input Level Visualization
              Live microphone energy meter showing current audio level
              Red threshold marker shows where VAD will trigger
              ═══════════════════════════════════════════════════════════════ */}
              <View className="gap-1">
                <View className="flex-row items-center gap-2">
                  <Icon as={Mic} size={18} className="text-foreground" />
                  <Text className="text-sm font-medium text-foreground">
                    {t('vadCurrentLevel')}
                  </Text>
                </View>

                <View
                  className="py-2"
                  onLayout={(e) =>
                    setEnergyBarContainerWidth(e.nativeEvent.layout.width)
                  }
                >
                  <View
                    style={{
                      width: energyBarContainerWidth || '100%',
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
                      <Svg
                        width={energyBarTotalWidth}
                        height={ENERGY_BAR_HEIGHT}
                      >
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
                                    i *
                                    (ENERGY_BAR_PILL_WIDTH + ENERGY_BAR_SPACING)
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
                    style={[
                      { position: 'absolute', left: 0 },
                      waitingStatusStyle
                    ]}
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
                </View>
              </View>

              {/* ═══════════════════════════════════════════════════════════════
              SECTION 3: Threshold Settings
              Adjust VAD sensitivity - lower = more sensitive, higher = less
              Includes auto-calibration button that samples background noise
              ═══════════════════════════════════════════════════════════════ */}
              <View className="gap-2">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-foreground">
                      {t('vadThreshold')}
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      Lower = more sensitive, higher = less sensitive
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

                <View className="mt-1 flex-row items-center justify-center gap-1">
                  <Text className="text-base font-semibold text-foreground">
                    {energyToLinearUI(localThreshold).toFixed(2)}
                  </Text>
                  <Text className="text-sm text-muted-foreground">
                    (
                    {energyToLinearUI(localThreshold) <= 0.2
                      ? 'very sensitive'
                      : energyToLinearUI(localThreshold) <= 0.4
                        ? 'sensitive'
                        : energyToLinearUI(localThreshold) <= 0.6
                          ? 'balanced'
                          : energyToLinearUI(localThreshold) <= 0.8
                            ? 'less sensitive'
                            : 'not sensitive'}
                    )
                  </Text>
                </View>

                <View className="flex-row items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onPress={handleDecreaseThreshold}
                    disabled={localThreshold <= VAD_THRESHOLD_MIN}
                  >
                    <Icon as={Minus} size={16} />
                  </Button>

                  {/* Slider uses linear UI (0-1) for intuitive feel, converts to exponential energy under the hood */}
                  <Slider
                    style={{ width: '100%', height: 40, flex: 1, zIndex: 10 }}
                    minimumValue={0}
                    maximumValue={1}
                    step={0.01}
                    animated={false}
                    value={energyToLinearUI(localThreshold)}
                    onValueChange={(linearValue: number) => {
                      // Validate input before conversion
                      if (
                        !isFinite(linearValue) ||
                        linearValue < 0 ||
                        linearValue > 1
                      )
                        return;
                      // Convert linear UI value to energy value
                      const newEnergy = linearUIToEnergy(linearValue);
                      if (isFinite(newEnergy)) {
                        updateThresholdImmediate(newEnergy);
                      }
                    }}
                    minimumTrackTintColor={useThemeColor('primary')}
                    maximumTrackTintColor={borderColor}
                    thumbTintColor={useThemeColor('primary')}
                  />

                  <Button
                    variant="outline"
                    size="icon-sm"
                    onPress={handleIncreaseThreshold}
                    disabled={localThreshold >= VAD_THRESHOLD_MAX}
                  >
                    <Icon as={Plus} size={16} />
                  </Button>
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

                  <Text className="text-xs text-muted-foreground">
                    {t('vadCalibrateHint')}
                  </Text>
                </View>
              </View>

              {/* ═══════════════════════════════════════════════════════════════
              SECTION 4: Silence Duration (Pause Length)
              How long to wait after audio drops below threshold before
              ending the current segment. Longer = complete thoughts,
              shorter = quick segments.
              ═══════════════════════════════════════════════════════════════ */}
              <View className="gap-3">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-foreground">
                      {t('vadSilenceDuration')}
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      {t('vadSilenceDescription')}
                    </Text>
                  </View>
                  <Button
                    variant="ghost"
                    size="sm"
                    onPress={resetSilenceDuration}
                    className="h-8"
                  >
                    <Icon as={RotateCcw} size={16} />
                  </Button>
                </View>

                <View className="flex-row items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon-xl"
                    onPress={decrementSilence}
                    disabled={localSilenceDuration <= VAD_SILENCE_DURATION_MIN}
                    className="size-14"
                  >
                    <Icon as={Minus} size={24} />
                  </Button>

                  <View className="flex-1 flex-row items-center justify-center gap-3 rounded-lg border border-border bg-muted p-3">
                    {/* Duration text */}
                    <View className="items-center">
                      <Text className="text-2xl font-bold text-foreground">
                        {(localSilenceDuration / 1000).toFixed(1)}s
                      </Text>
                      <Text className="text-xs text-muted-foreground">
                        {localSilenceDuration < 1000
                          ? t('vadQuickSegments')
                          : localSilenceDuration <= 1500
                            ? t('vadBalanced')
                            : t('vadCompleteThoughts')}
                      </Text>
                    </View>

                    {/* Circular silence timer indicator */}
                    <View style={{ width: CIRCLE_SIZE, height: CIRCLE_SIZE }}>
                      <Svg
                        width={CIRCLE_SIZE}
                        height={CIRCLE_SIZE}
                        style={{
                          transform: [{ scaleX: -1 }, { rotate: '-90deg' }]
                        }}
                      >
                        {/* Background circle */}
                        <Circle
                          cx={CIRCLE_SIZE / 2}
                          cy={CIRCLE_SIZE / 2}
                          r={RADIUS}
                          stroke="#cccccc"
                          strokeWidth={STROKE_WIDTH}
                          fill="transparent"
                        />
                        {/* Animated progress circle */}
                        <AnimatedCircle
                          cx={CIRCLE_SIZE / 2}
                          cy={CIRCLE_SIZE / 2}
                          r={RADIUS}
                          stroke="#22c55e"
                          strokeWidth={STROKE_WIDTH}
                          fill="transparent"
                          strokeDasharray={CIRCUMFERENCE}
                          animatedProps={animatedCircleProps}
                          strokeLinecap="round"
                        />
                      </Svg>
                    </View>
                  </View>

                  <Button
                    variant="outline"
                    size="icon-xl"
                    onPress={incrementSilence}
                    disabled={localSilenceDuration >= VAD_SILENCE_DURATION_MAX}
                    className="size-14"
                  >
                    <Icon as={Plus} size={24} />
                  </Button>
                </View>
              </View>

              {/* ═══════════════════════════════════════════════════════════════
              SECTION 5: Min Segment Length (Transient Filter)
              Discard segments shorter than this duration to filter out
              brief noises like claps, coughs, and other transients.
              NOTE: Slider dragging has known issues with bottom sheet
              gesture handling - use +/- buttons or tap on slider track.
              ═══════════════════════════════════════════════════════════════ */}
              <View className="gap-2">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-foreground">
                      {t('vadMinSegmentLength')}
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      {t('vadMinSegmentLengthDescription')}
                    </Text>
                  </View>
                  <Button
                    variant="ghost"
                    size="sm"
                    onPress={resetMinSegmentLength}
                    className="h-8"
                  >
                    <Icon as={RotateCcw} size={16} />
                  </Button>
                </View>

                <View className="mt-1 flex-row items-center justify-center gap-1">
                  <Text className="text-base font-semibold text-foreground">
                    {(localMinSegmentLength / 1000).toFixed(2)}s
                  </Text>
                  <Text className="text-sm text-muted-foreground">
                    (
                    {localMinSegmentLength === 0
                      ? t('vadNoFilter')
                      : localMinSegmentLength <= 150
                        ? t('vadLightFilter')
                        : localMinSegmentLength <= 300
                          ? t('vadMediumFilter')
                          : t('vadStrongFilter')}
                    )
                  </Text>
                </View>

                <View className="flex-row items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onPress={decrementMinSegmentLength}
                    disabled={
                      localMinSegmentLength <= VAD_MIN_SEGMENT_LENGTH_MIN
                    }
                  >
                    <Icon as={Minus} size={16} />
                  </Button>

                  <Slider
                    style={{ width: '100%', height: 40, flex: 1, zIndex: 10 }}
                    minimumValue={VAD_MIN_SEGMENT_LENGTH_MIN}
                    maximumValue={VAD_MIN_SEGMENT_LENGTH_MAX}
                    step={50}
                    animated={false}
                    value={localMinSegmentLength}
                    onValueChange={updateMinSegmentLengthImmediate}
                    minimumTrackTintColor={useThemeColor('primary')}
                    maximumTrackTintColor={borderColor}
                    thumbTintColor={useThemeColor('primary')}
                  />

                  <Button
                    variant="outline"
                    size="icon-sm"
                    onPress={incrementMinSegmentLength}
                    disabled={
                      localMinSegmentLength >= VAD_MIN_SEGMENT_LENGTH_MAX
                    }
                  >
                    <Icon as={Plus} size={16} />
                  </Button>
                </View>
              </View>
            </View>
          </DrawerScrollView>

          {/* Footer pinned to bottom, outside scroll view */}
          <View className="border-t border-border bg-background pb-6 pt-2">
            <DrawerClose variant="default">
              <Text>{t('done')}</Text>
            </DrawerClose>
          </View>

          {/* PortalHost for tooltips - must be LAST to render on top */}
          <PortalHost name="vad-settings-drawer" />
        </View>
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
      prevProps.minSegmentLength === nextProps.minSegmentLength &&
      prevProps.isVADLocked === nextProps.isVADLocked &&
      prevProps.displayMode === nextProps.displayMode &&
      prevProps.autoCalibrateOnOpen === nextProps.autoCalibrateOnOpen &&
      prevProps.energyShared === nextProps.energyShared;

    // Return true if primitive props are equal (skip re-render)
    // This prevents re-renders from useMicrophoneEnergy's internal state updates
    return primitivePropsEqual;
  }
);
