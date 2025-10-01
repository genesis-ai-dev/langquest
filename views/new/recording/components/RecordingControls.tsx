/**
 * RecordingControls - Bottom bar with WalkieTalkie recorder
 *
 * Pure presentation component that wraps the recording button
 */

import WalkieTalkieRecorder from '@/components/WalkieTalkieRecorder';
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
}

export const RecordingControls = React.memo(function RecordingControls({
  isRecording,
  onRecordingStart,
  onRecordingStop,
  onRecordingComplete,
  onLayout
}: RecordingControlsProps) {
  return (
    <View
      className="absolute bottom-0 left-0 right-0 border-t border-border bg-background px-4 pb-8 pt-4"
      onLayout={(e) => onLayout?.(e.nativeEvent.layout.height)}
    >
      <WalkieTalkieRecorder
        onRecordingComplete={onRecordingComplete}
        onRecordingStart={onRecordingStart}
        onRecordingStop={onRecordingStop}
        onWaveformUpdate={undefined}
        isRecording={isRecording}
      />
    </View>
  );
});
