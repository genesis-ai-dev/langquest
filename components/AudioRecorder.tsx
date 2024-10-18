import React, { useState, useEffect, useRef } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Animated } from 'react-native';
import AudioRecorderPlayer, {
  AVEncoderAudioQualityIOSType,
  AVEncodingOption,
  AudioEncoderAndroidType,
  AudioSourceAndroidType,
} from 'react-native-audio-recorder-player';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSizes, spacing, borderRadius } from '@/styles/theme';

interface AudioRecorderProps {
  onRecordingComplete: (uri: string) => void;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({ onRecordingComplete }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordTime, setRecordTime] = useState('00:00:00');
  const [playTime, setPlayTime] = useState('00:00:00');
  const [duration, setDuration] = useState('00:00:00');
  const [totalRecordTime, setTotalRecordTime] = useState(0);
  const [recordingComplete, setRecordingComplete] = useState(false);

  const audioRecorderPlayer = useRef(new AudioRecorderPlayer());
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    audioRecorderPlayer.current.setSubscriptionDuration(0.1);
    return () => {
      audioRecorderPlayer.current.removeRecordBackListener();
      audioRecorderPlayer.current.removePlayBackListener();
      if (pulseAnimRef.current) {
        pulseAnimRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    if (isRecording && !isPaused) {
      pulseAnimRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      );
      pulseAnimRef.current.start();
    } else {
      if (pulseAnimRef.current) {
        pulseAnimRef.current.stop();
      }
      pulseAnim.setValue(1);
    }
  }, [isRecording, isPaused]);

  const onStartRecord = async () => {
    if (recordingComplete) {
      // Reset the recorder if a recording was completed
      await resetRecorder();
    }
    try {
      await audioRecorderPlayer.current.startRecorder(undefined, {
        AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
        AudioSourceAndroid: AudioSourceAndroidType.MIC,
        AVEncoderAudioQualityKeyIOS: AVEncoderAudioQualityIOSType.high,
        AVNumberOfChannelsKeyIOS: 2,
        AVFormatIDKeyIOS: AVEncodingOption.aac,
      });
      audioRecorderPlayer.current.addRecordBackListener((e) => {
        setRecordTime(audioRecorderPlayer.current.mmssss(Math.floor(e.currentPosition)));
        setTotalRecordTime(e.currentPosition);
      });
      setIsRecording(true);
      setRecordingComplete(false);
    } catch (error) {
      console.error('Failed to start recording', error);
    }
  };

  const onPauseRecord = async () => {
    try {
      await audioRecorderPlayer.current.pauseRecorder();
      setIsPaused(true);
    } catch (error) {
      console.error('Failed to pause recording', error);
    }
  };

  const onResumeRecord = async () => {
    try {
      await audioRecorderPlayer.current.resumeRecorder();
      setIsPaused(false);
    } catch (error) {
      console.error('Failed to resume recording', error);
    }
  };

  const onStopRecord = async () => {
    try {
      const result = await audioRecorderPlayer.current.stopRecorder();
      audioRecorderPlayer.current.removeRecordBackListener();
      setIsRecording(false);
      setIsPaused(false);
      setRecordingComplete(true);
      onRecordingComplete(result);
      setDuration(audioRecorderPlayer.current.mmssss(Math.floor(totalRecordTime)));
    } catch (error) {
      console.error('Failed to stop recording', error);
    }
  };

  const onStartPlay = async () => {
    try {
      await audioRecorderPlayer.current.startPlayer();
      audioRecorderPlayer.current.addPlayBackListener((e) => {
        setPlayTime(audioRecorderPlayer.current.mmssss(Math.floor(e.currentPosition)));
        setDuration(audioRecorderPlayer.current.mmssss(Math.floor(e.duration)));
        if (e.currentPosition === e.duration) {
          audioRecorderPlayer.current.stopPlayer();
          setIsPlaying(false);
        }
      });
      setIsPlaying(true);
    } catch (error) {
      console.error('Failed to start playback', error);
    }
  };

  const onStopPlay = async () => {
    try {
      await audioRecorderPlayer.current.stopPlayer();
      audioRecorderPlayer.current.removePlayBackListener();
      setIsPlaying(false);
    } catch (error) {
      console.error('Failed to stop playback', error);
    }
  };

  const resetRecorder = async () => {
    try {
      await audioRecorderPlayer.current.stopRecorder();
      audioRecorderPlayer.current.removeRecordBackListener();
      setIsRecording(false);
      setIsPaused(false);
      setRecordTime('00:00:00');
      setTotalRecordTime(0);
      setRecordingComplete(false);
    } catch (error) {
      console.error('Failed to reset recorder', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.timeContainer}>
        <Text style={styles.timeText}>
          {isRecording || isPaused ? recordTime : isPlaying ? playTime : duration}
        </Text>
      </View>
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.roundButton}
          onPress={isRecording ? (isPaused ? onResumeRecord : onPauseRecord) : onStartRecord}
        >
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <Ionicons
              name={isRecording ? (isPaused ? "play" : "pause") : "mic"}
              size={24}
              color={colors.buttonText}
            />
          </Animated.View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.roundButton}
          onPress={isRecording ? onStopRecord : isPlaying ? onStopPlay : onStartPlay}
        >
          <Ionicons
            name={isRecording ? "stop" : isPlaying ? "stop" : "play"}
            size={24}
            color={colors.buttonText}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.medium,
  },
  timeContainer: {
    alignItems: 'center',
    marginBottom: spacing.small,
  },
  timeText: {
    fontSize: fontSizes.medium,
    color: colors.text,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  roundButton: {
    backgroundColor: colors.primary,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AudioRecorder;