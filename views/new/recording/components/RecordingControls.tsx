/**
 * RecordingControls - Bottom bar with WalkieTalkie recorder and VAD settings
 *
 * Pure presentation component that wraps the recording button with settings
 */

import WalkieTalkieRecorder from '@/components/WalkieTalkieRecorder';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Settings } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';

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

export const RecordingControls = React.memo(function RecordingControls({
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
  return (
    <View
      className="absolute bottom-0 left-0 right-0 border-t border-border bg-background"
      onLayout={(e) => onLayout?.(e.nativeEvent.layout.height)}
    >
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
            // VAD visual feedback (native module handles recording)
            currentEnergy={currentEnergy}
            vadThreshold={vadThreshold}
          />
        </View>

        {/* Spacer to balance layout */}
        <View className="h-20 w-20" />
      </View>
    </View>
  );
});
