import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Audio, AVPlaybackStatus } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSizes, spacing } from '@/styles/theme';
import { FFmpegKit, FFmpegKitConfig } from 'ffmpeg-kit-react-native';

type IconName = 'mic' | 'mic-outline' | 'stop' | 'stop-outline' | 'play' | 'play-outline' | 'pause' | 'pause-outline';
type RecorderState = 'RECORD_STOP' | 'PAUSE_STOP' | 'RECORD_PLAY' | 'RECORD_PAUSE';

interface ButtonConfig {
  icon: IconName;
  onPress: (() => Promise<void>) | undefined;
  disabled?: boolean;
}

interface AudioRecorderProps {
  onRecordingComplete: (uri: string) => void;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({ onRecordingComplete }) => {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [recordingUris, setRecordingUris] = useState<string[]>([]);
  const [finalRecordingUri, setFinalRecordingUri] = useState<string | null>(null);
  const [state, setState] = useState<RecorderState>('RECORD_STOP');
  const [duration, setDuration] = useState<string>('00:00');
  const [isRecordingInProgress, setIsRecordingInProgress] = useState(false);

  useEffect(() => {
    setupAudio();
    return () => {
      if (recording) recording.stopAndUnloadAsync();
      if (sound) sound.unloadAsync();
    };
  }, []);

  useEffect(() => {
    setupAudio();
    return () => {
      const cleanup = async () => {
        if (recording) {
          await recording.stopAndUnloadAsync();
        }
        if (sound) {
          await sound.unloadAsync();
        }
        // Clean up temp files
        const tempDir = `${FileSystem.cacheDirectory}temp_audio/`;
        const finalRecordingPath = `${FileSystem.cacheDirectory}final_recording.m4a`;
        try {
          await FileSystem.deleteAsync(tempDir, { idempotent: true });
          await FileSystem.deleteAsync(finalRecordingPath, { idempotent: true });
        } catch (error) {
          console.error('Error cleaning up files:', error);
        }
      };
      cleanup();
    };
  }, []);

  const setupAudio = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        console.error('Permission to record was denied');
        return;
      }
      
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
    } catch (error) {
      console.error('Failed to setup audio:', error);
    }
  };

  const startRecording = async () => {
    try {
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
      }

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(newRecording);
      setIsRecordingInProgress(true);
      setState('PAUSE_STOP');
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const resumeRecording = async () => {
    try {
      if (recording) {
        await recording.startAsync();
        setIsRecordingInProgress(true);
        setState('PAUSE_STOP');
      }
    } catch (error) {
      console.error('Failed to resume recording:', error);
      // If we fail to resume, we should clean up and allow starting a new recording
      if (recording) {
        await recording.stopAndUnloadAsync();
        setRecording(null);
        setIsRecordingInProgress(false);
      }
    }
  };

  const pauseRecording = async () => {
    try {
      if (recording) {
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        if (uri) {
          setRecordingUris(prev => [...prev, uri]);
        }
        setRecording(null);
        // Don't set isRecordingInProgress to false since we have cached recordings
        setState('RECORD_STOP');
      }
    } catch (error) {
      console.error('Failed to pause recording:', error);
    }
  };

  const concatenateAudioFiles = async (uris: string[]): Promise<string> => {
    try {
      if (uris.length === 0) return '';
      if (uris.length === 1) return uris[0];
  
      // Create a temporary directory for our files
      const tempDir = `${FileSystem.cacheDirectory}temp_audio/`;
      const outputPath = `${FileSystem.cacheDirectory}final_recording.m4a`;
  
      // Clean up existing files first
      await FileSystem.deleteAsync(tempDir, { idempotent: true });
      await FileSystem.deleteAsync(outputPath, { idempotent: true });
      
      await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });
  
      // Create a list file for FFmpeg
      let listContent = '';
      for (let i = 0; i < uris.length; i++) {
        const fileName = `segment_${i}.m4a`;
        const destUri = `${tempDir}${fileName}`;
        await FileSystem.copyAsync({
          from: uris[i],
          to: destUri
        });
        listContent += `file '${fileName}'\n`;
      }
  
      const listPath = `${tempDir}list.txt`;
      await FileSystem.writeAsStringAsync(listPath, listContent);
  
      
      // Execute FFmpeg command to concatenate files
      await FFmpegKit.execute(
        `-f concat -safe 0 -i ${listPath} -c copy -y ${outputPath}`
      );
  
      return outputPath;
    } catch (error) {
      console.error('Error concatenating audio files:', error);
      return uris[uris.length - 1];
    }
  };

  const stopRecording = async () => {
    try {
      if (recording) {
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        if (uri) {
          const allUris = [...recordingUris, uri];
          const finalUri = await concatenateAudioFiles(allUris);
          setFinalRecordingUri(finalUri);
          setRecordingUris([]);
          onRecordingComplete(finalUri);
        }
        setRecording(null);
        setIsRecordingInProgress(false); // Now safe to set false since we've processed all recordings
        setState('RECORD_PLAY');
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  };

  const playRecording = async () => {
    try {
      if (finalRecordingUri) {
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: finalRecordingUri },
          { shouldPlay: true },
          onPlaybackStatusUpdate
        );
        setSound(newSound);
        setState('RECORD_PAUSE');
      }
    } catch (error) {
      console.error('Failed to play recording:', error);
    }
  };

  const pausePlayback = async () => {
    try {
      if (sound) {
        await sound.pauseAsync();
        setState('RECORD_PLAY');
      }
    } catch (error) {
      console.error('Failed to pause playback:', error);
    }
  };

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      if (status.didJustFinish) {
        setState('RECORD_PLAY');
      }
    }
  };

  const handleRecordPress = async () => {
    switch (state) {
      case 'RECORD_STOP':
        await startRecording();
        break;
      case 'RECORD_PLAY':
      case 'RECORD_PAUSE':
        // Clear everything before starting new recording
        setRecordingUris([]);
        setFinalRecordingUri(null);
        setIsRecordingInProgress(false);
        if (sound) {
          await sound.unloadAsync();
          setSound(null);
        }
        await startRecording();
        break;
    }
  };

  const handleSecondaryPress = async () => {
    switch (state) {
      case 'RECORD_STOP':
        // If we have recordings in cache, finalize them
        if (recordingUris.length > 0) {
          const finalUri = await concatenateAudioFiles(recordingUris);
          setFinalRecordingUri(finalUri);
          setRecordingUris([]); // Empty the cache
          onRecordingComplete(finalUri);
          setState('RECORD_PLAY');
        }
        break;
      case 'PAUSE_STOP':
        await stopRecording();
        break;
      case 'RECORD_PLAY':
        await playRecording();
        break;
      case 'RECORD_PAUSE':
        await pausePlayback();
        break;
    }
  };

  const getButtonConfig = (): [ButtonConfig, ButtonConfig] => {
    switch (state) {
      case 'RECORD_STOP':
        return [
          { icon: 'mic', onPress: handleRecordPress },
          { 
            icon: 'stop', 
            onPress: handleSecondaryPress,
            // Enable stop if either actively recording or have cached recordings
            disabled: !isRecordingInProgress && recordingUris.length === 0
          },
        ];
      case 'PAUSE_STOP':
        return [
          { icon: 'pause', onPress: pauseRecording },
          { icon: 'stop', onPress: handleSecondaryPress },
        ];
      case 'RECORD_PLAY':
        return [
          { icon: 'mic', onPress: handleRecordPress },
          { 
            icon: 'play', 
            onPress: handleSecondaryPress,
            disabled: !finalRecordingUri
          },
        ];
      case 'RECORD_PAUSE':
        return [
          { icon: 'mic', onPress: handleRecordPress },
          { icon: 'pause', onPress: handleSecondaryPress },
        ];
    }
  };

  const buttons = getButtonConfig();

  return (
    <View style={styles.container}>
      <Text style={styles.duration}>{duration}</Text>
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
});

export default AudioRecorder;