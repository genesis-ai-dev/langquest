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
import { Slider } from '@/components/ui/slider';
import { Text } from '@/components/ui/text';
import { useLocalization } from '@/hooks/useLocalization';
import { useMicrophoneEnergy } from '@/hooks/useMicrophoneEnergy';
import React from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming
} from 'react-native-reanimated';

interface VADSettingsDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  threshold: number;
  onThresholdChange: (threshold: number) => void;
  silenceDuration: number;
  onSilenceDurationChange: (duration: number) => void;
  isVADLocked?: boolean; // Don't stop detection if VAD is locked
}

export function VADSettingsDrawer({
  isOpen,
  onOpenChange,
  threshold,
  onThresholdChange,
  silenceDuration,
  onSilenceDurationChange,
  isVADLocked = false
}: VADSettingsDrawerProps) {
  const { isActive, energyResult, startEnergyDetection, stopEnergyDetection } =
    useMicrophoneEnergy();

  const currentEnergy = energyResult?.energy ?? 0;

  // Convert energy (0-1) to approximate dB (-60 to 0)
  const energyToDb = (energy: number) => {
    if (energy <= 0) return -60;
    return 20 * Math.log10(energy);
  };

  const currentDb = energyToDb(currentEnergy);

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

  const { t } = useLocalization();

  // Preset thresholds
  const presets = [
    { label: 'Sensitive', value: 0.01 },
    { label: 'Normal', value: 0.03 },
    { label: 'Loud', value: 0.06 }
  ];

  // Scale functions to convert between 0.005-0.1 range and 5-100 range
  // This avoids precision loss with very small decimals in the native slider
  const thresholdToSlider = (threshold: number) => threshold * 1000;
  const sliderToThreshold = (sliderValue: number) => sliderValue / 1000;

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
    <Drawer
      open={isOpen}
      onOpenChange={onOpenChange}
      snapPoints={['50%', '75%']}
    >
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Voice Activity Detection</DrawerTitle>
          <DrawerDescription>
            Adjust the sensitivity for automatic recording
          </DrawerDescription>
        </DrawerHeader>

        <View className="flex-1 gap-6 px-4">
          {/* Live Energy Visualization */}
          <View className="gap-3">
            <Text className="text-sm font-medium text-foreground">
              Current Level: {currentDb.toFixed(1)} dB
            </Text>

            {/* Energy Bar */}
            <View className="relative h-12 w-full overflow-hidden rounded-lg bg-muted">
              <Animated.View
                style={[
                  {
                    width: `${Math.min(100, currentEnergy * 1000)}%`
                  },
                  animatedStyle
                ]}
                className={`h-full ${
                  currentEnergy > threshold
                    ? 'bg-primary'
                    : 'bg-muted-foreground'
                }`}
              />

              {/* Threshold marker */}
              <View
                style={{ left: `${Math.min(100, threshold * 1000)}%` }}
                className="absolute top-0 h-full w-0.5 bg-destructive"
              />
            </View>

            <Text className="text-xs text-muted-foreground">
              {currentEnergy > threshold
                ? '🎤 Would be recording'
                : '💤 Silent - waiting for speech'}
            </Text>
          </View>

          {/* Threshold Adjustment */}
          <View className="gap-3">
            <Text className="text-sm font-medium text-foreground">
              Recording Threshold: {(threshold * 100).toFixed(1)}%
            </Text>

            <Slider
              value={thresholdToSlider(threshold)}
              onValueChange={(value) =>
                onThresholdChange(sliderToThreshold(value[0]!))
              }
              min={5}
              max={100}
              step={1}
              className="h-10 w-full"
            />

            {/* Preset buttons */}
            <View className="flex-row justify-between gap-2">
              {presets.map((preset) => (
                <Button
                  key={preset.label}
                  variant={threshold === preset.value ? 'default' : 'outline'}
                  size="sm"
                  onPress={() => onThresholdChange(preset.value)}
                  className="flex-1"
                >
                  <Text
                    className={`text-xs ${
                      threshold === preset.value
                        ? 'text-primary-foreground'
                        : 'text-foreground'
                    }`}
                  >
                    {preset.label}
                  </Text>
                </Button>
              ))}
            </View>
          </View>

          {/* Silence Duration Control */}
          <View className="gap-3">
            <Text className="text-sm font-medium text-foreground">
              Silence Duration: {(silenceDuration / 1000).toFixed(1)}s
            </Text>

            <Slider
              value={silenceDuration}
              onValueChange={(value) => onSilenceDurationChange(value[0]!)}
              min={500}
              max={3000}
              step={100}
              className="h-10 w-full"
            />

            <Text className="text-xs text-muted-foreground">
              How long to wait in silence before stopping the recording
            </Text>
          </View>

          {/* Info text */}
          <View className="gap-2 rounded-lg bg-muted p-3">
            <Text className="text-xs text-muted-foreground">
              💡 When VAD mode is active (lock icon enabled), recording will
              automatically start when your voice crosses the threshold and stop
              after the silence duration.
            </Text>
            <Text className="text-xs text-muted-foreground">
              Lower threshold = more sensitive (picks up quiet speech)
            </Text>
            <Text className="text-xs text-muted-foreground">
              Shorter silence = faster segments (may cut off speech)
            </Text>
            <Text className="text-xs text-muted-foreground">
              Longer silence = complete thoughts (may include pauses)
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
