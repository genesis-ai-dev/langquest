import { colors } from '@/styles/theme';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

interface WaveformVisualizerProps {
  waveformData: number[];
  isRecording?: boolean;
  width?: number;
  height?: number;
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  barCount?: number; // When provided, render at most this many bars (last N → scrolling)
}

const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({
  waveformData,
  isRecording = false,
  width = 300,
  height = 60,
  color = colors.primary,
  backgroundColor = colors.inputBackground,
  borderColor,
  borderWidth,
  barCount
}) => {
  const displayedData = React.useMemo(() => {
    if (!barCount || waveformData.length <= barCount) return waveformData;
    // Side-scroll: show last N samples
    return waveformData.slice(-barCount);
  }, [waveformData, barCount]);

  const barWidth = width / Math.max(1, displayedData.length);
  const maxHeight = height - 4; // Leave some padding

  const resolvedBorderColor = borderColor ?? colors.inputBorder;
  const resolvedBorderWidth = borderWidth ?? styles.container.borderWidth ?? 0;

  return (
    <View
      style={[
        styles.container,
        {
          width,
          height,
          backgroundColor,
          borderColor: resolvedBorderColor,
          borderWidth: resolvedBorderWidth
        }
      ]}
    >
      <Svg width={width} height={height}>
        {displayedData.map((amplitude, index) => {
          const barHeight = Math.max(2, amplitude * maxHeight);
          const x = index * barWidth;
          const y = (height - barHeight) / 2;

          return (
            <Rect
              key={index}
              x={x + 1} // Small gap between bars
              y={y}
              width={Math.max(1, barWidth - 2)}
              height={barHeight}
              fill={isRecording ? colors.error : color}
              opacity={isRecording ? 0.8 : 0.6}
            />
          );
        })}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.inputBorder
  }
});

export default WaveformVisualizer;
