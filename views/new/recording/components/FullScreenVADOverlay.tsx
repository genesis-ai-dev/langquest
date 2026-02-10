/**
 * FullScreenVADOverlay - Full-screen overlay for VAD recording mode
 * Shows large waveform and cancel button during voice activity detection
 */

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { WaveformVisualization } from '@/components/WaveformVisualization';
import { useLocalization } from '@/hooks/useLocalization';
import React from 'react';
import { View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface FullScreenVADOverlayProps {
  isVisible: boolean;
  energyShared: SharedValue<number>;
  vadThreshold: number;
  isRecordingShared: SharedValue<boolean>;
  isDiscardedShared?: SharedValue<number>;
  onCancel: () => void;
}

export function FullScreenVADOverlay({
  isVisible,
  energyShared,
  vadThreshold,
  isRecordingShared,
  isDiscardedShared,
  onCancel
}: FullScreenVADOverlayProps) {
  const { t } = useLocalization();
  const insets = useSafeAreaInsets();

  if (!isVisible) {
    return null;
  }

  return (
    <Animated.View
      entering={FadeIn.duration(250)}
      exiting={FadeOut.duration(200)}
      className="absolute inset-0 z-[100] flex items-center justify-center bg-background"
    >
      <View className="w-full flex-1 items-center justify-center px-8">
        {/* Large waveform visualization */}
        <Animated.View
          entering={FadeIn.duration(300).delay(50)}
          className="mb-8 w-full"
        >
          <WaveformVisualization
            isVisible={true}
            energyShared={energyShared}
            vadThreshold={vadThreshold}
            isRecordingShared={isRecordingShared}
            isDiscardedShared={isDiscardedShared}
            barCount={60}
            maxHeight={80}
          />
        </Animated.View>

        {/* Status text */}
        <Animated.View entering={FadeIn.duration(300).delay(100)}>
          <Text className="mb-12 text-center text-xl font-medium text-muted-foreground">
            {t('vadRecordingNow')}
          </Text>
        </Animated.View>

        {/* Cancel button */}
        <Animated.View
          entering={FadeIn.duration(300).delay(150)}
          exiting={FadeOut.duration(200)}
        >
          <Button
            variant="destructive"
            size="lg"
            onPress={onCancel}
            className="h-16 w-64"
            style={{ marginBottom: insets.bottom + 32 }}
          >
            <Icon name="x" size={24} className="mr-2" />
            <Text className="text-lg font-semibold text-destructive-foreground">
              {t('vadStop')}
            </Text>
          </Button>
        </Animated.View>
      </View>
    </Animated.View>
  );
}
