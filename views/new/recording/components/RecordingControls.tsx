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
      <View className="relative flex-row items-center justify-center">
        {/* Settings button on the left */}
        <View className="absolute bottom-2 left-4">
          <Button
            variant="ghost"
            size="icon"
            onPress={onSettingsPress}
            className="h-10 w-10"
          >
            <Icon as={Settings} size={20} />
          </Button>
        </View>

        {/* Recorder in center */}
        <WalkieTalkieRecorder
          onRecordingComplete={onRecordingComplete}
          onRecordingStart={onRecordingStart}
          onRecordingStop={onRecordingStop}
          onWaveformUpdate={undefined}
          isRecording={isRecording}
          isVADLocked={isVADLocked}
          onVADLockChange={onVADLockChange}
          // VAD visual feedback (native module handles recording)
          currentEnergy={currentEnergy}
          vadThreshold={vadThreshold}
        />
      </View>
    </View>
  );
});
