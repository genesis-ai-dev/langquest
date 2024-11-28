import React, { useState, useEffect, useRef } from 'react';
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

const TEMP_SEGMENTS_DIR = `${FileSystem.cacheDirectory}temp_segments/`;
const TEMP_CONCAT_DIR = `${FileSystem.cacheDirectory}temp_concat/`;
const RECORDINGS_DIR = `${FileSystem.documentDirectory}recordings/`;

const ensureDirectories = async () => {
  try {
    // Clean temp directories
    await FileSystem.deleteAsync(TEMP_SEGMENTS_DIR, { idempotent: true });
    await FileSystem.deleteAsync(TEMP_CONCAT_DIR, { idempotent: true });
    await FileSystem.makeDirectoryAsync(TEMP_SEGMENTS_DIR, { intermediates: true });
    await FileSystem.makeDirectoryAsync(TEMP_CONCAT_DIR, { intermediates: true });
    
    // Just ensure permanent directory exists (don't clean)
    const permanentDirInfo = await FileSystem.getInfoAsync(RECORDINGS_DIR);
    if (!permanentDirInfo.exists) {
      await FileSystem.makeDirectoryAsync(RECORDINGS_DIR, { intermediates: true });
    }
  } catch (error) {
    console.error('Error managing directories:', error);
  }
};

const AudioRecorder: React.FC<AudioRecorderProps> = ({ onRecordingComplete }) => {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [recordingUris, setRecordingUris] = useState<string[]>([]);
  const [finalRecordingUri, setFinalRecordingUri] = useState<string | null>(null);
  const [state, setState] = useState<RecorderState>('RECORD_STOP');
  const [duration, setDuration] = useState<string>('00:00');
  const [isRecordingInProgress, setIsRecordingInProgress] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  const [totalRecordingDuration, setTotalRecordingDuration] = useState(0);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const [shouldFlash, setShouldFlash] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<number | null>(null);

  // Helper function to format time
  const formatTime = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const setup = async () => {
      await setupAudio();
      await ensureDirectories();
    };
    setup();

    return () => {
      const cleanup = async () => {
        if (recording) {
          await recording.stopAndUnloadAsync();
          setRecording(null);
        }
        if (sound) {
          await sound.unloadAsync();
          setSound(null);
        }
        await FileSystem.deleteAsync(TEMP_SEGMENTS_DIR, { idempotent: true });
        await FileSystem.deleteAsync(TEMP_CONCAT_DIR, { idempotent: true });
      };
      cleanup();
    };
  }, []);

  // Recording timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
  
    if (isRecordingInProgress || (!isRecordingInProgress && recordingUris.length > 0)) {
      interval = setInterval(() => {
        if (!isRecordingInProgress && recordingUris.length > 0) {
          // Just handle flashing for paused state
          setShouldFlash(prev => !prev);
        } else if (isRecordingInProgress) {
          // Handle recording timer
          const now = Date.now();
          if (lastUpdateTime) {
            const elapsed = now - lastUpdateTime;
            setTotalRecordingDuration(prev => prev + elapsed);
          }
          setLastUpdateTime(now);
        }
      }, 1000);
    } else {
      // Reset lastUpdateTime when not recording
      setLastUpdateTime(null);
    }
  
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isRecordingInProgress, recordingUris.length, lastUpdateTime]);
  
  const getCounterDisplay = () => {
    if (isRecordingInProgress || recordingUris.length > 0) {
      // For active recording or paused state
      if (!isRecordingInProgress && recordingUris.length > 0) {
        // Paused state with cached recordings
        return shouldFlash ? 
          '--:--/--:--' : 
          `00:00/${formatTime(totalRecordingDuration)}`;
      }
      // Active recording
      return `00:00/${formatTime(totalRecordingDuration)}`;
    }
    
    // Playback state
    if (finalRecordingUri) {
      return `${formatTime(playbackPosition)}/${formatTime(playbackDuration)}`;
    }
    
    // Initial state
    return '00:00/00:00';
  };

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
      // Clean both temp directories when starting new recording
      // await FileSystem.deleteAsync(TEMP_SEGMENTS_DIR, { idempotent: true });
      await FileSystem.deleteAsync(TEMP_CONCAT_DIR, { idempotent: true });
    
      // Ensure both directories exist after cleaning
      await FileSystem.makeDirectoryAsync(TEMP_SEGMENTS_DIR, { intermediates: true });
      await FileSystem.makeDirectoryAsync(TEMP_CONCAT_DIR, { intermediates: true });
  
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
      }
  
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(newRecording);
      setLastUpdateTime(Date.now());
      setIsRecordingInProgress(true);
      setState('PAUSE_STOP');
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const pauseRecording = async () => {
    try {
      if (recording) {
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        if (uri) {
          const segmentName = `segment_${Date.now()}.m4a`;
          const segmentPath = `${TEMP_SEGMENTS_DIR}${segmentName}`;
          await FileSystem.moveAsync({ from: uri, to: segmentPath });
          setRecordingUris(prev => [...prev, segmentPath]);
        }
        setRecording(null);
        setIsRecordingInProgress(false);
        setLastUpdateTime(null);
        setState('RECORD_STOP');
      }
    } catch (error) {
      console.error('Failed to pause recording:', error);
    }
  };

  const concatenateAudioFiles = async (uris: string[], outputPath: string): Promise<boolean> => {
    try {
      if (uris.length === 0) return false;
      if (uris.length === 1) {
        await FileSystem.copyAsync({ from: uris[0], to: outputPath });
        return true;
      }
      
      await FileSystem.makeDirectoryAsync(TEMP_CONCAT_DIR, { intermediates: true });
      const listPath = `${TEMP_CONCAT_DIR}list.txt`;
  
      // Create a list file for FFmpeg
      const listContent = uris.map(uri => `file '${uri}'`).join('\n');
      await FileSystem.writeAsStringAsync(listPath, listContent);
  
      // Execute FFmpeg command to concatenate files
      await FFmpegKit.execute(
        `-f concat -safe 0 -i ${listPath} -c copy -y ${outputPath}`
      );

      //console.log outputpath
      console.log('outputPath:', outputPath);
  
      return true;
    } catch (error) {
      console.error('Error concatenating audio files:', error);
      return false;
    }
  };

  const stopRecording = async () => {
    try {
      if (recording) {
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        if (uri) {
          // Ensure segments directory exists before moving file
          await FileSystem.makeDirectoryAsync(TEMP_SEGMENTS_DIR, { intermediates: true });
          const segmentName = `segment_${Date.now()}.m4a`;
          const segmentPath = `${TEMP_SEGMENTS_DIR}${segmentName}`;
          await FileSystem.moveAsync({ from: uri, to: segmentPath });
          setRecordingUris(prev => [...prev, segmentPath]);
        }
      }
  
      // Concatenate all segments
      if (recordingUris.length > 0) {
        // Ensure concat directory exists before creating concatenated file
        await FileSystem.makeDirectoryAsync(TEMP_CONCAT_DIR, { intermediates: true });
        const concatPath = `${TEMP_CONCAT_DIR}concat_${Date.now()}.m4a`;
        const success = await concatenateAudioFiles(recordingUris, concatPath);
        
        if (success) {
          setFinalRecordingUri(concatPath);
          onRecordingComplete(concatPath);
          // Clear segments cache
          setRecordingUris([]);
          await FileSystem.deleteAsync(TEMP_SEGMENTS_DIR, { idempotent: true });
          await FileSystem.makeDirectoryAsync(TEMP_SEGMENTS_DIR, { intermediates: true });
        } else {
          console.error('Failed to concatenate audio files');
          // Handle failure - maybe keep the last segment as the final recording
          // if (recordingUris.length > 0) {
          //   setFinalRecordingUri(recordingUris[recordingUris.length - 1]);
          //   onRecordingComplete(recordingUris[recordingUris.length - 1]);
          // }
        }
      }
  
      setRecording(null);
      setIsRecordingInProgress(false);
      setState('RECORD_PLAY');
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  };

  const pausePlayback = async () => {
    try {
      if (!sound) return;
      
      const status = await sound.getStatusAsync();
      if (!status.isLoaded) return;

      await sound.pauseAsync();
      setPlaybackPosition(status.positionMillis);
      setState('RECORD_PLAY');
    } catch (error) {
      console.error('Failed to pause playback:', error);
    }
  };
  
  const playRecording = async () => {
    try {
      if (!finalRecordingUri) return;

      // Unload existing sound if it exists
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
      }

      // Create and load new sound
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: finalRecordingUri },
        { 
          shouldPlay: true,
          positionMillis: playbackPosition,
        },
        onPlaybackStatusUpdate
      );
      
      setSound(newSound);
      setState('RECORD_PAUSE');

      // Actually start playing
      await newSound.playAsync();
    } catch (error) {
      console.error('Failed to play recording:', error);
      setState('RECORD_PLAY'); // Revert to play state on error
    }
  };

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    
    setPlaybackPosition(status.positionMillis);
    setPlaybackDuration(status.durationMillis || 0);

    if (status.didJustFinish) {
      setPlaybackPosition(0);
      setState('RECORD_PLAY');
    }
  };

  const getButtonConfig = (): [ButtonConfig, ButtonConfig] => {
    switch (state) {
      case 'RECORD_STOP':
        return [
          { icon: 'mic', onPress: startRecording },
          { 
            icon: 'stop', 
            onPress: recordingUris.length > 0 ? stopRecording : undefined,
            disabled: recordingUris.length === 0 
          },
        ];
      case 'PAUSE_STOP':
        return [
          { icon: 'pause', onPress: pauseRecording },
          { icon: 'stop', onPress: stopRecording },
        ];
      case 'RECORD_PLAY':
        return [
          { icon: 'mic', onPress: startRecording },
          { 
            icon: 'play', 
            onPress: playRecording,
            disabled: !finalRecordingUri 
          },
        ];
      case 'RECORD_PAUSE':
        return [
          { icon: 'mic', onPress: startRecording },
          { icon: 'pause', onPress: pausePlayback },
        ];
    }
  };

  const buttons = getButtonConfig();

  return (
    <View style={styles.container}>
      <Text style={[
        styles.duration,
        !isRecordingInProgress && recordingUris.length > 0 && styles.flashingDuration
      ]}>
        {getCounterDisplay()}
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