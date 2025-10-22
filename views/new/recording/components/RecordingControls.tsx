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
import { Audio } from 'expo-av';
import { MicOffIcon, Settings } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
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
  currentEnergy?: number;
  vadThreshold?: number;
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
    vadThreshold
  }: RecordingControlsProps) {
    const { t } = useLocalization();
    const [hasPermission, setHasPermission] = useState<boolean>(true);
    const insets = useSafeAreaInsets();

    // Check permissions after render
    useEffect(() => {
      void Audio.getPermissionsAsync().then((response) => {
        setHasPermission(response.status === Audio.PermissionStatus.GRANTED);
      });
    }, []);

    const requestPermission = async () => {
      const response = await Audio.requestPermissionsAsync();
      setHasPermission(response.status === Audio.PermissionStatus.GRANTED);
    };

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
        {/* Waveform visualization above controls */}
        <WaveformVisualization
          isVisible={isVADLocked ?? false}
          currentEnergy={currentEnergy ?? 0}
          vadThreshold={vadThreshold ?? 0.03}
          isRecording={isRecording}
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
    // Re-render ONLY if these props change:
    // Note: We DO pass currentEnergy through now, but the ring buffer
    // implementation handles the frequent updates efficiently on the UI thread
    return (
      prevProps.isRecording === nextProps.isRecording &&
      prevProps.isVADLocked === nextProps.isVADLocked &&
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
