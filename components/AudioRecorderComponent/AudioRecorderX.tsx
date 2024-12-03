import React, { useState, useEffect, useRef } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Audio, AVPlaybackStatus } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSizes, spacing } from '@/styles/theme';
import { FFmpegKit, FFmpegKitConfig } from 'ffmpeg-kit-react-native';
import { createActor } from 'xstate';
import { audioRecorderMachine } from './audioRecorderMachine';
import { AudioManager } from './AudioManager';

interface ButtonConfig {
  icon: 'mic' | 'pause' | 'play' | 'checkmark';
  onPress: (() => Promise<void>) | undefined;
  disabled?: boolean;
}

interface AudioRecorderProps {
  onRecordingComplete: (uri: string) => void;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({ onRecordingComplete }) => {
  const [audioManager] = useState(() => new AudioManager());
  const [actor, setActor] = useState(() => 
    createActor(audioRecorderMachine, {
      input: {
        audioManager
      }
    })
  );
    const [snapshot, setSnapshot] = useState(() => actor.getSnapshot());
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [playbackPosition, setPlaybackPosition] = useState(0);
    const flashingInterval = useRef<NodeJS.Timeout>();
  
    // Effect for actor initialization
    useEffect(() => {
      const subscription = actor.subscribe(setSnapshot);
      actor.start();
      return () => {
        subscription.unsubscribe();
        audioManager.cleanup();
      };
    }, [actor, audioManager]);

    // Separate effect for recording status
    useEffect(() => {
      let recordingStatusInterval: NodeJS.Timeout | null = null;

      if (snapshot.value === 'recording') {
        // Reset playback position when starting to record
        setPlaybackPosition(0);

        recordingStatusInterval = setInterval(async () => {
          const status = await audioManager.getRecordingStatus();
          if (status?.isRecording) {
            setRecordingDuration(status.durationMillis || 0);
          }
        }, 100);
      }

      return () => {
        if (recordingStatusInterval) {
          clearInterval(recordingStatusInterval);
        }
      };
    }, [snapshot.value, audioManager]);

    // Separate effect for playback status
    useEffect(() => {
      audioManager.setPlaybackStatusCallback((status) => {
        if (status.isLoaded) {
          setPlaybackPosition(status.positionMillis);
          if (status.didJustFinish) {
          setPlaybackPosition(0); // Reset position when playback ends
            actor.send({ type: 'PLAYBACK_COMPLETE' });
          }
        }
      });
    }, [audioManager, actor]);

    // Separate effect for flashing state
    useEffect(() => {
      if (snapshot.value === 'recordingPaused') {
        flashingInterval.current = setInterval(() => {
          setSnapshot(prev => ({
            ...prev,
            context: { ...prev.context, isFlashing: !prev.context.isFlashing }
          }));
        }, 500);
      }

      return () => {
        if (flashingInterval.current) {
          clearInterval(flashingInterval.current);
        }
      };
    }, [snapshot.value]);

    // Reset playback position when entering certain states
    useEffect(() => {
      const currentState = typeof snapshot.value === 'string' ? snapshot.value : Object.keys(snapshot.value)[0];
      if (['idle', 'recording', 'recordingStopped'].includes(currentState)) {
        setPlaybackPosition(0);
      }
    }, [snapshot.value]);

    const formatTime = (milliseconds: number): string => {
      const totalSeconds = Math.floor(milliseconds / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };
  
    const getDurationDisplay = (): string => {
      const playbackTime = formatTime(playbackPosition);
      const totalTime = formatTime(recordingDuration);
      
      if (snapshot.value === 'recordingPaused' && snapshot.context.isFlashing) {
        return `${playbackTime}/--:--`;
      }
      
      return `${playbackTime}/${totalTime}`;
    };
  
    const getButtonConfig = (): [ButtonConfig, ButtonConfig] => {
      switch (snapshot.value) {
        case 'idle':
          return [
            { 
              icon: 'mic', 
              onPress: async () => actor.send({ type: 'PRESS_MIC' }) 
            },
            { 
              icon: 'checkmark', 
              onPress: undefined,
              disabled: true 
            },
          ];
        case 'recording':
          return [
            { 
              icon: 'pause', 
              onPress: async () => actor.send({ type: 'PRESS_PAUSE' }) 
            },
            { 
              icon: 'checkmark', 
              onPress: async () => actor.send({ type: 'PRESS_CHECK' }) 
            },
          ];
        case 'recordingPaused':
          return [
            { 
              icon: 'mic', 
              onPress: async () => actor.send({ type: 'PRESS_MIC' }) 
            },
            { 
              icon: 'checkmark', 
              onPress: async () => actor.send({ type: 'PRESS_CHECK' }) 
            },
          ];
        case 'recordingStopped':
          return [
            { 
              icon: 'mic', 
              onPress: async () => actor.send({ type: 'PRESS_MIC' }) 
            },
            { 
              icon: 'play', 
              onPress: async () => actor.send({ type: 'PRESS_PLAY' }) 
            },
          ];
        case 'playing':
          return [
            { 
              icon: 'mic', 
              onPress: async () => actor.send({ type: 'PRESS_MIC' }) 
            },
            { 
              icon: 'pause', 
              onPress: async () => actor.send({ type: 'PRESS_PAUSE' }) 
            },
          ];
        case 'playbackPaused':
          return [
            { 
              icon: 'mic', 
              onPress: async () => actor.send({ type: 'PRESS_MIC' }) 
            },
            { 
              icon: 'play', 
              onPress: async () => actor.send({ type: 'PRESS_PLAY' }) 
            },
          ];
        case 'playbackEnded':
          return [
            { 
              icon: 'mic', 
              onPress: async () => actor.send({ type: 'PRESS_MIC' }) 
            },
            { 
              icon: 'play', 
              onPress: async () => actor.send({ type: 'PRESS_PLAY' }) 
            },
          ];
        default:
          return [
            { icon: 'mic', onPress: undefined },
            { icon: 'checkmark', onPress: undefined, disabled: true },
          ];
      }
    };
  
    const buttons = getButtonConfig();
  
    return (
      <View style={styles.container}>
        <Text style={[
          styles.duration,
          snapshot.value === 'recordingPaused' && styles.flashingDuration
        ]}>
          {getDurationDisplay()}
        </Text>
        <View style={styles.buttonContainer}>
          {buttons.map((button, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.button, button.disabled && styles.buttonDisabled]}
              onPress={button.onPress}
              disabled={button.disabled}
            >
              <Ionicons name={button.icon} size={24} color={colors.buttonText} />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };




const styles = StyleSheet.create({
    container: {
      alignItems: 'center',
      padding: spacing.medium,
    },
    buttonContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      width: '100%',
    },
    button: {
      backgroundColor: colors.primary,
      width: 60,
      height: 60,
      borderRadius: 30,
      justifyContent: 'center',
      alignItems: 'center',
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    duration: {
      fontSize: fontSizes.medium,
      color: colors.text,
      marginBottom: spacing.small,
    },
    flashingDuration: {
      opacity: 0.5,
    },
  });
  
  export default AudioRecorder;