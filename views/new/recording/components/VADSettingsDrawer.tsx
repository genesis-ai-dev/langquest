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
import { HelpCircle, Maximize2, Minus, Plus, RectangleHorizontal } from 'lucide-react-native';
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
  const { isActive, energyResult, startEnergyDetection, stopEnergyDetection } =
    useMicrophoneEnergy();
  const { t } = useLocalization();
  const [showHelp, setShowHelp] = React.useState(false);

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

  // Preset thresholds with localized labels
  const presets = [
    { label: t('vadSensitive'), value: 0.01 },
    { label: t('vadNormal'), value: 0.03 },
    { label: t('vadLoud'), value: 0.06 }
  ];

  // Increment/decrement handlers for threshold
  const incrementThreshold = () => {
    const newValue = Math.min(0.1, threshold + 0.005);
    onThresholdChange(Number(newValue.toFixed(3)));
  };

  const decrementThreshold = () => {
    const newValue = Math.max(0.005, threshold - 0.005);
    onThresholdChange(Number(newValue.toFixed(3)));
  };

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
  }, [currentEnergy, threshold]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: pulseScale.value }]
    };
  });

  return (
    <Drawer
      open={isOpen}
      onOpenChange={onOpenChange}
      snapPoints={['65%', '90%']}
    >
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
                className="flex-1 h-24 flex-col gap-2"
              >
                <Icon 
                  as={Maximize2} 
                  size={28} 
                  className={displayMode === 'fullscreen' ? 'text-primary-foreground' : 'text-foreground'}
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
                className="flex-1 h-24 flex-col gap-2"
              >
                <Icon 
                  as={RectangleHorizontal} 
                  size={28} 
                  className={displayMode === 'footer' ? 'text-primary-foreground' : 'text-foreground'}
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

          {/* Live Energy Visualization */}
          <View className="gap-3">
            <Text className="text-sm font-medium text-foreground">
              {t('vadCurrentLevel')}: {currentDb.toFixed(1)} dB
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
                ? `🎤 ${t('vadRecordingNow')}`
                : `💤 ${t('vadWaiting')}`}
            </Text>
          </View>

          {/* Threshold Adjustment */}
          <View className="gap-3">
            <Text className="text-sm font-medium text-foreground">
              {t('vadThreshold')}
            </Text>

            {/* Increment/Decrement Controls */}
            <View className="flex-row items-center gap-3">
              <Button
                variant="outline"
                size="lg"
                onPress={decrementThreshold}
                disabled={threshold <= 0.005}
                className="size-14"
              >
                <Icon as={Minus} size={24} />
              </Button>

              <View className="flex-1 items-center rounded-lg border border-border bg-muted p-3">
                <Text className="text-2xl font-bold text-foreground">
                  {(threshold * 100).toFixed(1)}%
                </Text>
                <Text className="text-xs text-muted-foreground">
                  {threshold <= 0.015
                    ? t('vadVerySensitive')
                    : threshold <= 0.035
                      ? t('vadNormal')
                      : threshold <= 0.07
                        ? t('vadLoudOnly')
                        : t('vadVeryLoud')}
                </Text>
              </View>

              <Button
                variant="outline"
                size="lg"
                onPress={incrementThreshold}
                disabled={threshold >= 0.1}
                className="size-14"
              >
                <Icon as={Plus} size={24} />
              </Button>
            </View>

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
