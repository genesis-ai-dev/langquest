/**
 * RecordingControls - Bottom bar with WalkieTalkie recorder and VAD settings
 *
 * - Waveform displayed above the controls
 * - Prevents re-renders from frequent currentEnergy updates
 * - Only re-renders when critical props change (isRecording, isVADLocked)
 */

import WalkieTalkieRecorder from '@/components/WalkieTalkieRecorder';
import { WaveformVisualization } from '@/components/WaveformVisualization';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useLocalization } from '@/hooks/useLocalization';
import { MicOffIcon, Settings } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface RecordingControlsProps {
  isRecording: boolean;
  onRecordingStart: () => void;
  onRecordingStop: () => void;
  onRecordingComplete: (
    uri: string,
    duration: number,
    waveformData: number[]
  ) => void;
  onRecordingDiscarded?: () => void;
  onLayout?: (height: number) => void;
  // VAD props
  isVADLocked?: boolean;
  onVADLockChange?: (locked: boolean) => void;
  onSettingsPress?: () => void;
  // VAD visual feedback (native module handles recording)
  currentEnergy?: number; // Keep for backward compat
  vadThreshold?: number;
  energyShared?: SharedValue<number>; // For UI performance
  isRecordingShared?: SharedValue<boolean>; // NEW: For instant waveform updates
  displayMode?: 'fullscreen' | 'footer'; // Display mode preference
}

export const RecordingControls = React.memo(
  function RecordingControls({
    isRecording,
    onRecordingStart,
    onRecordingStop,
    onRecordingComplete,
    onRecordingDiscarded,
    onLayout,
    isVADLocked,
    onVADLockChange,
    onSettingsPress,
    currentEnergy,
    vadThreshold,
    energyShared,
    isRecordingShared,
    displayMode = 'footer'
  }: RecordingControlsProps) {
    const { t } = useLocalization();
    const insets = useSafeAreaInsets();
    // Permissions are handled by native module
    const hasPermission = true;

    const requestPermission = async () => {
      // Native module handles permissions
    };

    // Fallback SharedValues for backward compatibility
    const { useSharedValue } = require('react-native-reanimated');
    const fallbackEnergyShared = useSharedValue(currentEnergy ?? 0);
    const fallbackIsRecordingShared = useSharedValue(isRecording);

    // Update fallbacks if not provided (backward compat)
    useEffect(() => {
      if (!energyShared && currentEnergy !== undefined) {
        fallbackEnergyShared.value = currentEnergy;
      }
      if (!isRecordingShared) {
        fallbackIsRecordingShared.value = isRecording;
      }
    }, [
      currentEnergy,
      energyShared,
      fallbackEnergyShared,
      isRecording,
      isRecordingShared,
      fallbackIsRecordingShared
    ]);

    // Show permission UI only if we explicitly know permission is denied
    if (!hasPermission) {
      return (
        <View
          className="absolute bottom-0 left-0 right-0 border-t border-border bg-background"
          style={{ paddingBottom: insets.bottom }}
          onLayout={(e) => onLayout?.(e.nativeEvent.layout.height)}
        >
          <View className="flex w-full items-center justify-center py-6">
            <View className="mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <Icon as={MicOffIcon} size={32} className="text-red-500" />
            </View>
            <Button
              variant="destructive"
              onPress={requestPermission}
              className="w-48"
            >
              <Text className="text-base font-bold">
                {t('grantMicrophonePermission')}
              </Text>
            </Button>
          </View>
        </View>
      );
    }

    return (
      <View
        className="absolute bottom-0 left-0 right-0 border-t border-border bg-background"
        style={{ paddingBottom: insets.bottom }}
        onLayout={(e) => onLayout?.(e.nativeEvent.layout.height)}
      >
        {/* Waveform visualization above controls - only visible in footer mode */}
        <WaveformVisualization
          isVisible={isVADLocked ?? false}
          energyShared={energyShared ?? fallbackEnergyShared}
          vadThreshold={vadThreshold ?? 0.085}
          isRecordingShared={isRecordingShared ?? fallbackIsRecordingShared}
          barCount={60}
          maxHeight={24}
        />

        {/* Controls row */}
        <View className="flex-row items-center justify-between px-4 py-2">
          {/* Settings button on the left */}
          <Button
            variant="ghost"
            size="lg"
            onPress={onSettingsPress}
            className="h-20 w-20"
          >
            <Icon as={Settings} size={24} />
          </Button>

          {/* Recorder in center - takes remaining space */}
          <View className="flex-1 items-center">
            <WalkieTalkieRecorder
              onRecordingComplete={onRecordingComplete}
              onRecordingStart={onRecordingStart}
              onRecordingStop={onRecordingStop}
              onRecordingDiscarded={onRecordingDiscarded}
              onWaveformUpdate={undefined}
              isRecording={isRecording}
              isVADLocked={isVADLocked}
              onVADLockChange={onVADLockChange}
              // Energy values passed directly - ring buffer handles updates efficiently
              currentEnergy={currentEnergy}
              vadThreshold={vadThreshold}
              canRecord={hasPermission}
            />
          </View>

          {/* Spacer to balance layout */}
          <View className="h-20 w-20" />
        </View>
      </View>
    );
  },
  // **OPTIMIZATION: Custom equality check - only re-render for critical prop changes**
  (prevProps, nextProps) => {
    // FIX: Allow immediate re-render when VAD lock changes for responsive cancel button
    if (prevProps.isVADLocked !== nextProps.isVADLocked) {
      return false; // Force re-render immediately on VAD lock change
    }

    // Re-render ONLY if these props change:
    // Note: We DO pass currentEnergy through now, but the ring buffer
    // implementation handles the frequent updates efficiently on the UI thread
    return (
      prevProps.isRecording === nextProps.isRecording &&
      // isVADLocked already checked above
      prevProps.onRecordingStart === nextProps.onRecordingStart &&
      prevProps.onRecordingStop === nextProps.onRecordingStop &&
      prevProps.onRecordingComplete === nextProps.onRecordingComplete &&
      prevProps.onRecordingDiscarded === nextProps.onRecordingDiscarded &&
      prevProps.onVADLockChange === nextProps.onVADLockChange &&
      prevProps.onSettingsPress === nextProps.onSettingsPress
      // Still ignoring currentEnergy and vadThreshold changes to prevent cascade
    );
  }
);
