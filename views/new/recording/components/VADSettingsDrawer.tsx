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
import { useLocalization } from '@/hooks/useLocalization';
import { useMicrophoneEnergy } from '@/hooks/useMicrophoneEnergy';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import {
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Maximize2,
  Mic,
  Minus,
  Plus,
  RectangleHorizontal,
  RotateCcw,
  Sparkles,
  Volume1,
  Volume2,
  VolumeX
} from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

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

// Input pill definitions - 10 equal-width pills with logarithmically increasing dB ranges
interface InputPill {
  minDb: number;
  maxDb: number;
  color: string;
}

// Generate 10 pills with logarithmically increasing dB ranges
// Each pill is equal width (10% of visual space)
// dB ranges increase exponentially from left to right
const generateInputPills = (): InputPill[] => {
  const NUM_PILLS = 10;
  const pills: InputPill[] = [];
  
  // Use exponential distribution: each pill covers an exponentially larger dB range
  // Total range: DB_MIN (-60) to DB_MAX (0) = 60 dB
  // We'll use a logarithmic distribution
  
  for (let i = 0; i < NUM_PILLS; i++) {
    // Normalize position (0 to 1)
    const normalizedPos = i / NUM_PILLS;
    const normalizedNextPos = (i + 1) / NUM_PILLS;
    
    // Apply exponential curve: earlier positions map to smaller dB ranges
    // Use power curve: position^1.4 for less aggressive distribution
    // Goal: ambient noise (-3 to -2 dB) should fill pills 7-8, not pill 9
    // Pill 9 should only fill for very loud sounds close to 0 dB
    const logStart = Math.pow(normalizedPos, 1.4);
    const logEnd = Math.pow(normalizedNextPos, 1.4);
    
    // Map back to dB range
    const minDb = DB_MIN + logStart * (DB_MAX - DB_MIN);
    const maxDb = DB_MIN + logEnd * (DB_MAX - DB_MIN);
    
    // Color gradient: Blue -> Green -> Yellow -> Red
    const colorProgress = i / (NUM_PILLS - 1);
    let color: string;
    if (colorProgress < 0.33) {
      // Blue to Green
      const t = colorProgress / 0.33;
      color = `rgba(${59 + (34 - 59) * t}, ${130 + (197 - 130) * t}, ${246 + (94 - 246) * t}, ${0.6 + 0.2 * t})`;
    } else if (colorProgress < 0.66) {
      // Green to Yellow
      const t = (colorProgress - 0.33) / 0.33;
      color = `rgba(${34 + (234 - 34) * t}, ${197 + (179 - 197) * t}, ${94 + (8 - 94) * t}, ${0.8 + 0.1 * t})`;
    } else {
      // Yellow to Red
      const t = (colorProgress - 0.66) / 0.34;
      color = `rgba(${234 + (239 - 234) * t}, ${179 + (68 - 179) * t}, ${8 + (68 - 8) * t}, ${0.9 + 0.1 * t})`;
    }
    
    pills.push({
      minDb,
      maxDb,
      color
    });
  }
  
  return pills;
};

const INPUT_PILLS = generateInputPills();

// Circular Progress Component for calibration countdown
interface CircularProgressProps {
  progress: number; // 0-100
  size: number;
}

function CircularProgress({ progress, size }: CircularProgressProps) {
  const radius = (size - 4) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {/* Background circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          opacity={0.2}
        />
        {/* Progress circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
    </View>
  );
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
}

export function VADSettingsDrawer({
  isOpen,
  onOpenChange,
  threshold,
  onThresholdChange,
  silenceDuration,
  onSilenceDurationChange,
  isVADLocked = false,
  displayMode,
  onDisplayModeChange
}: VADSettingsDrawerProps) {
  const {
    isActive,
    energyResult,
    startEnergyDetection,
    stopEnergyDetection,
    energyShared
  } = useMicrophoneEnergy();
  const { t } = useLocalization();
  const [showHelp, setShowHelp] = React.useState(false);

  // Calibration state
  const [isCalibrating, setIsCalibrating] = React.useState(false);
  const [calibrationProgress, setCalibrationProgress] = React.useState(0);
  const [calibrationError, setCalibrationError] = React.useState<string | null>(
    null
  );
  const calibrationSamplesRef = React.useRef<number[]>([]);
  const calibrationIntervalRef = React.useRef<ReturnType<
    typeof setInterval
  > | null>(null);
  const calibrationTimeoutRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  // Ref to track latest energy value for calibration sampling
  const latestEnergyRef = React.useRef<number>(0);
  
  // Refs for logging statistics
  const energySamplesRef = React.useRef<number[]>([]);
  const loggingIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const currentEnergy = energyResult?.energy ?? 0;

  // Update latest energy ref whenever energyResult changes
  React.useEffect(() => {
    if (energyResult?.energy !== undefined) {
      latestEnergyRef.current = energyResult.energy;
    }
  }, [energyResult?.energy]);

  // Normalize energy value to 0-1 range
  // The native module returns raw RMS energy values (typically 0-20 range based on logs)
  // We need to normalize them to 0-1 for dB conversion and threshold comparison
  const normalizeEnergy = (energy: number): number => {
    // Based on logs showing values ~9-14, we'll use a dynamic max
    // Normalize to 0-1, clamping at reasonable max
    // Using 20 as max seems reasonable based on observed values
    const MAX_ENERGY = 20.0;
    const normalized = Math.min(1.0, Math.max(0, energy / MAX_ENERGY));
    return normalized;
  };

  // Convert energy (0-1) to approximate dB (-60 to 0)
  const energyToDb = (energy: number) => {
    // First normalize if energy is in raw range
    const normalized = energy > 1.0 ? normalizeEnergy(energy) : energy;
    if (normalized <= 0) return DB_MIN;
    // Convert normalized energy (0-1) to dB (-60 to 0)
    // Use a mapping that gives us -60dB at very low values, 0dB at max
    const db = 20 * Math.log10(Math.max(normalized, 0.001)); // Clamp to avoid -Infinity
    return Math.max(DB_MIN, Math.min(DB_MAX, db));
  };

  // Convert dB to visual position on pill scale
  // Since pills are equal width, each pill is 10% of the visual space
  const dbToVisualPosition = (db: number): number => {
    const clampedDb = Math.max(DB_MIN, Math.min(DB_MAX, db));
    
    // Find which pill contains this dB value
    for (let i = 0; i < INPUT_PILLS.length; i++) {
      const pill = INPUT_PILLS[i]!;
      
      if (clampedDb >= pill.minDb && clampedDb <= pill.maxDb) {
        // This is the pill - calculate position within it
        const positionInPill = (clampedDb - pill.minDb) / (pill.maxDb - pill.minDb);
        const pillStartPercent = i * 10; // Each pill is 10% wide
        return pillStartPercent + positionInPill * 10;
      }
    }
    
    // If above max, return 100%
    if (clampedDb >= INPUT_PILLS[INPUT_PILLS.length - 1]!.maxDb) {
      return 100;
    }
    
    // Fallback (shouldn't happen)
    return 0;
  };

  // Get which pills are active/filled based on current dB
  // Each pill represents a dB range that increases logarithmically from left to right
  // Cumulative fill: all pills below current dB are fully filled, current pill is partially filled
  const getActivePills = (db: number) => {
    const clampedDb = Math.max(DB_MIN, Math.min(DB_MAX, db));
    
    return INPUT_PILLS.map((pill, index) => {
      if (clampedDb < pill.minDb) {
        // Below this pill's range - empty
        return { ...pill, isActive: false, fillPercent: 0 };
      } else if (clampedDb >= pill.maxDb) {
        // Above this pill's range - fully filled (cumulative)
        return { ...pill, isActive: true, fillPercent: 100 };
      } else {
        // Within this pill's range - calculate fill percentage
        const fillPercent = ((clampedDb - pill.minDb) / (pill.maxDb - pill.minDb)) * 100;
        return { ...pill, isActive: true, fillPercent: Math.min(100, Math.max(0, fillPercent)) };
      }
    });
  };

  // Convert visual position (0-100%) back to dB for threshold adjustment
  // Since pills are equal width, each pill is 10% of the visual space
  const visualPositionToDb = (percent: number): number => {
    const clampedPercent = Math.max(0, Math.min(100, percent));
    
    // Each pill is 10% wide
    const pillIndex = Math.floor(clampedPercent / 10);
    const positionInPill = (clampedPercent % 10) / 10;
    
    // Clamp to valid pill range
    const safePillIndex = Math.max(0, Math.min(INPUT_PILLS.length - 1, pillIndex));
    const pill = INPUT_PILLS[safePillIndex]!;
    
    // If at the end of the last pill, use maxDb
    if (pillIndex >= INPUT_PILLS.length - 1 && positionInPill >= 0.99) {
      return pill.maxDb;
    }
    
    // Calculate dB within this pill's range
    const dbInPill = pill.minDb + positionInPill * (pill.maxDb - pill.minDb);
    return dbInPill;
  };

  // Normalize current energy before using it
  const normalizedCurrentEnergy = normalizeEnergy(currentEnergy);
  const currentDb = energyToDb(normalizedCurrentEnergy);
  const thresholdDb = energyToDb(threshold);
  const activePills = getActivePills(currentDb);
  const thresholdPosition = dbToVisualPosition(thresholdDb);

  // Start monitoring when drawer opens, stop when it closes (unless VAD is locked)
  React.useEffect(() => {
    if (isOpen && !isActive) {
      console.log(
        '🎯 VAD Settings: Starting energy detection for live preview'
      );
      void startEnergyDetection();
    } else if (!isOpen && isActive && !isVADLocked) {
      // Only stop if drawer closes AND VAD is not locked
      // If VAD is locked, let useVADRecording manage the energy detection
      console.log(
        '🎯 VAD Settings: Stopping energy detection (drawer closed, VAD not locked)'
      );
      void stopEnergyDetection();
    }
  }, [
    isOpen,
    isActive,
    isVADLocked,
    startEnergyDetection,
    stopEnergyDetection
  ]);

  // Logging: Track energy statistics while drawer is open
  React.useEffect(() => {
    if (isOpen && isActive) {
      // Collect energy samples
      energySamplesRef.current = [];
      
      // Log statistics every 3 seconds
      loggingIntervalRef.current = setInterval(() => {
        const samples = energySamplesRef.current;
        if (samples.length > 0) {
          const min = Math.min(...samples);
          const max = Math.max(...samples);
          const avg = samples.reduce((sum, val) => sum + val, 0) / samples.length;
          const currentDb = energyToDb(avg);
          const thresholdDb = energyToDb(threshold);
          
          const normalizedMin = normalizeEnergy(min);
          const normalizedMax = normalizeEnergy(max);
          const normalizedAvg = normalizeEnergy(avg);
          
          // Find which pill the current dB falls into
          let activePillIndex = -1;
          let activePillFill = 0;
          for (let i = 0; i < INPUT_PILLS.length; i++) {
            const pill = INPUT_PILLS[i]!;
            if (currentDb >= pill.minDb && currentDb < pill.maxDb) {
              activePillIndex = i;
              activePillFill = ((currentDb - pill.minDb) / (pill.maxDb - pill.minDb)) * 100;
              break;
            }
          }
          
          // Log pill ranges for debugging
          const pillRanges = INPUT_PILLS.map((p, i) => 
            `P${i}: ${p.minDb.toFixed(1)} to ${p.maxDb.toFixed(1)} dB`
          ).join(', ');
          
          console.log('📊 VAD Energy Stats:', {
            samples: samples.length,
            rawAvg: avg.toFixed(4),
            normalizedAvg: normalizedAvg.toFixed(4),
            avgDb: currentDb.toFixed(1),
            activePill: activePillIndex >= 0 ? `Pill ${activePillIndex} (${activePillFill.toFixed(1)}% filled)` : 'None',
            threshold: threshold.toFixed(4),
            thresholdDb: thresholdDb.toFixed(1),
            pillRanges
          });
          
          // Reset samples for next interval
          energySamplesRef.current = [];
        }
      }, 3000); // Every 3 seconds
      
      return () => {
        if (loggingIntervalRef.current) {
          clearInterval(loggingIntervalRef.current);
          loggingIntervalRef.current = null;
        }
      };
    } else {
      // Clear interval when drawer closes
      if (loggingIntervalRef.current) {
        clearInterval(loggingIntervalRef.current);
        loggingIntervalRef.current = null;
      }
      energySamplesRef.current = [];
    }
  }, [isOpen, isActive, threshold]);

  // Collect energy samples for logging
  React.useEffect(() => {
    if (isOpen && isActive && currentEnergy > 0) {
      energySamplesRef.current.push(currentEnergy);
      // Keep only last 100 samples to avoid memory issues
      if (energySamplesRef.current.length > 100) {
        energySamplesRef.current.shift();
      }
    }
  }, [isOpen, isActive, currentEnergy]);

  // Reset to default threshold
  const handleResetToDefault = () => {
    onThresholdChange(THRESHOLD_DEFAULT);
  };

  // Auto-calibrate function
  const handleAutoCalibrate = React.useCallback(async () => {
    if (isCalibrating) return;

    // Ensure energy detection is active
    if (!isActive) {
      try {
        await startEnergyDetection();
        // Wait a bit for energy detection to stabilize
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (error) {
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
      // Use ref to get latest energy value (updated from useEffect)
      const currentEnergy = latestEnergyRef.current;
      if (currentEnergy !== undefined && !isNaN(currentEnergy) && currentEnergy > 0) {
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
      const average =
        samples.reduce((sum, val) => sum + val, 0) / samples.length;

      // Check for reasonable noise level (only check if too quiet - allow loud environments)
      if (average < 0.0001) {
        setCalibrationError(
          t('vadCalibrationFailed') ||
            'Calibration failed. Please ensure there is some background noise.'
        );
        setIsCalibrating(false);
        setCalibrationProgress(0);
        return;
      }

      // Calculate new threshold: 4x background noise (12 dB above)
      const newThreshold = Math.max(
        THRESHOLD_MIN,
        Math.min(THRESHOLD_MAX, average * CALIBRATION_MULTIPLIER)
      );

      // Apply threshold automatically
      onThresholdChange(Number(newThreshold.toFixed(4)));

      setIsCalibrating(false);
      setCalibrationProgress(0);
      calibrationSamplesRef.current = [];
    }, totalDuration);

    calibrationTimeoutRef.current = timeout;
  }, [
    isCalibrating,
    isActive,
    startEnergyDetection,
    onThresholdChange,
    t
  ]);

  // Cleanup calibration on unmount
  React.useEffect(() => {
    return () => {
      if (calibrationIntervalRef.current) {
        clearInterval(calibrationIntervalRef.current);
      }
      if (calibrationTimeoutRef.current) {
        clearTimeout(calibrationTimeoutRef.current);
      }
    };
  }, []);

  // Increment/decrement handlers for silence duration
  const incrementSilence = () => {
    const newValue = Math.min(3000, silenceDuration + 100);
    onSilenceDurationChange(newValue);
  };

  const decrementSilence = () => {
    const newValue = Math.max(500, silenceDuration - 100);
    onSilenceDurationChange(newValue);
  };

  // Animated pulse when above threshold
  const pulseScale = useSharedValue(1);

  React.useEffect(() => {
    if (currentEnergy > threshold) {
      pulseScale.value = withSequence(
        withTiming(1.1, { duration: 100 }),
        withTiming(1, { duration: 100 })
      );
    }
  }, [currentEnergy, threshold, pulseScale]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: pulseScale.value }]
    };
  });

  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange} snapPoints={[730, 900]}>
      <DrawerContent className="max-h-[90%]">
        <DrawerHeader className="flex-row items-start justify-between">
          <View className="flex-1">
            <DrawerTitle>{t('vadTitle')}</DrawerTitle>
            <DrawerDescription>{t('vadDescription')}</DrawerDescription>
          </View>
          <Button
            variant="ghost"
            size="sm"
            onPress={() => setShowHelp(!showHelp)}
            className="mt-0"
          >
            <Icon as={HelpCircle} size={20} />
          </Button>
        </DrawerHeader>

        <BottomSheetScrollView
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: 100,
            gap: 20
          }}
        >
          {/* Help Section - Collapsible */}
          {showHelp && (
            <View className="gap-2 rounded-lg border border-border bg-muted/50 p-4">
              <Text className="text-sm font-semibold text-foreground">
                {t('vadHelpTitle')}
              </Text>
              <Text className="text-sm text-muted-foreground">
                {t('vadHelpAutomatic')}
              </Text>
              <Text className="text-sm text-muted-foreground">
                {t('vadHelpSensitivity')}
              </Text>
              <Text className="text-sm text-muted-foreground">
                {t('vadHelpPause')}
              </Text>
            </View>
          )}

          {/* Display Mode Selection */}
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
          {/* Input Level Visualization - Tiered Pills */}
          <View className="gap-3">
            <View className="flex-row items-center gap-2">
              <Icon as={Mic} size={18} className="text-foreground" />
            <Text className="text-sm font-medium text-foreground">
                {t('vadCurrentLevel')}
            </Text>
            </View>

            {/* Input Level Pills - Horizontal Row (10 equal-width pills) */}
            <View className="relative h-12 w-full flex-row gap-1">
              {activePills.map((pill, index) => {
                return (
                  <View key={index} className="relative flex-1">
                    {/* Pill background */}
                    <View className="h-full w-full overflow-hidden rounded-full bg-muted/50">
                      {/* Pill fill */}
              <Animated.View
                style={[
                  {
                            width: `${Math.min(100, pill.fillPercent)}%`,
                            height: '100%'
                          },
                          pill.isActive && animatedStyle
                        ]}
                        className="h-full overflow-hidden rounded-full"
                      >
                        <View
                          style={{ backgroundColor: pill.color }}
                          className="h-full w-full"
                        />
                      </Animated.View>
                    </View>
                  </View>
                );
              })}
              
              {/* Threshold marker spanning all pills vertically */}
              <View
                style={{
                  left: `${Math.min(100, Math.max(0, thresholdPosition))}%`,
                  position: 'absolute',
                  top: 0,
                  height: '100%',
                  width: 3,
                  marginLeft: -1.5,
                  zIndex: 10
                }}
                className="bg-destructive shadow-lg"
              />
            </View>

            <Text className="text-xs text-muted-foreground">
              {normalizedCurrentEnergy > threshold
                ? `🎤 ${t('vadRecordingNow')}`
                : `💤 ${t('vadWaiting')}`}
            </Text>
          </View>

          {/* Threshold Control Bar */}
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

            {/* Threshold Control Bar - Visual representation */}
            <View className="relative h-16 w-full overflow-hidden rounded-lg">
              {/* Background bar matching input pills (10 equal-width segments) */}
              <View className="absolute inset-0 flex-row">
                {INPUT_PILLS.map((pill, index) => {
                  return (
                    <View
                      key={index}
                      style={{
                        flex: 1,
                        height: '100%',
                        backgroundColor: pill.color,
                        opacity: 0.2
                      }}
                    />
                  );
                })}
              </View>

              {/* Threshold marker/indicator */}
              <View
                style={{
                  left: `${Math.min(100, Math.max(0, thresholdPosition))}%`,
                  position: 'absolute',
                  top: 0,
                  height: '100%',
                  width: 4,
                  marginLeft: -2
                }}
                className="bg-destructive shadow-lg"
              >
                {/* Arrow pointing up */}
                <View className="absolute -top-2 left-1/2 -translate-x-1/2">
                  <Icon as={ChevronUp} size={16} className="text-destructive" />
                </View>
              </View>

              {/* Control buttons */}
              <View className="absolute inset-0 flex-row items-center justify-between px-2">
                <Button
                  variant="outline"
                  size="lg"
                  onPress={() => {
                    const currentPos = thresholdPosition;
                    const stepPercent = 2; // 2% visual step
                    const newPos = Math.max(0, currentPos - stepPercent);
                    const newDb = visualPositionToDb(newPos);
                    // Convert dB back to energy (0-1), clamp dB to valid range first
                    const clampedDb = Math.max(DB_MIN, Math.min(DB_MAX, newDb));
                    const newEnergy = clampedDb <= DB_MIN ? THRESHOLD_MIN : Math.pow(10, clampedDb / 20);
                    const newThreshold = Math.max(THRESHOLD_MIN, Math.min(THRESHOLD_MAX, newEnergy));
                    onThresholdChange(Number(newThreshold.toFixed(4)));
                  }}
                  disabled={threshold <= THRESHOLD_MIN}
                  className="size-12 rounded-full"
                >
                  <Icon as={ChevronDown} size={20} />
                </Button>

                <Button
                  variant="outline"
                  size="lg"
                  onPress={() => {
                    const currentPos = thresholdPosition;
                    const stepPercent = 2; // 2% visual step
                    const newPos = Math.min(100, currentPos + stepPercent);
                    const newDb = visualPositionToDb(newPos);
                    // Convert dB back to energy (0-1), clamp dB to valid range first
                    const clampedDb = Math.max(DB_MIN, Math.min(DB_MAX, newDb));
                    const newEnergy = clampedDb <= DB_MIN ? THRESHOLD_MIN : Math.pow(10, clampedDb / 20);
                    const newThreshold = Math.max(THRESHOLD_MIN, Math.min(THRESHOLD_MAX, newEnergy));
                    onThresholdChange(Number(newThreshold.toFixed(4)));
                  }}
                  disabled={threshold >= THRESHOLD_MAX}
                  className="size-12 rounded-full"
                >
                  <Icon as={ChevronUp} size={20} />
                </Button>
              </View>
            </View>

            {/* Auto-Calibrate Button */}
            <View className="gap-2">
              <Button
                variant={isCalibrating ? 'secondary' : 'default'}
                onPress={handleAutoCalibrate}
                disabled={isCalibrating}
                className="w-full"
              >
                {isCalibrating ? (
                  <View className="flex-row items-center gap-2">
                    <CircularProgress
                      progress={calibrationProgress}
                      size={20}
                    />
                    <Text className="text-primary-foreground">
                      {t('vadCalibrating') || 'Calibrating...'}
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

              {/* Calibration Error */}
              {calibrationError && (
                <Text className="text-xs text-destructive">
                  {calibrationError}
                </Text>
              )}
            </View>
          </View>

          {/* Silence Duration Control */}
          <View className="gap-3">
            <Text className="text-sm font-medium text-foreground">
              {t('vadSilenceDuration')}
            </Text>

            {/* Increment/Decrement Controls */}
            <View className="flex-row items-center gap-3">
              <Button
                variant="outline"
                size="lg"
                onPress={decrementSilence}
                disabled={silenceDuration <= 500}
                className="size-14"
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
                size="lg"
                onPress={incrementSilence}
                disabled={silenceDuration >= 3000}
                className="size-14"
              >
                <Icon as={Plus} size={24} />
              </Button>
            </View>

            <Text className="text-xs text-muted-foreground">
              {t('vadSilenceDescription')}
            </Text>
          </View>
        </BottomSheetScrollView>

        <DrawerFooter>
          <DrawerClose>
            <Text>{t('done')}</Text>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
