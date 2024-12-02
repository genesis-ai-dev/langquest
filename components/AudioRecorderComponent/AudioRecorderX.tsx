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
  
    useEffect(() => {
      const subscription = actor.subscribe(setSnapshot);
      actor.start();
      return () => {
        subscription.unsubscribe();
        audioManager.cleanup();
      };
    }, [actor, audioManager]);
  
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
        <Text style={styles.duration}>00:00/00:00</Text>
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