import { Audio } from 'expo-av';
import React, { createContext, useContext, useRef, useState } from 'react';

interface AudioContextType {
  playSound: (uri: string, audioId?: string) => Promise<void>;
  stopCurrentSound: () => Promise<void>;
  isPlaying: boolean;
  currentAudioId: string | null;
  position: number;
  duration: number;
  setPosition: (position: number) => Promise<void>;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAudioId, setCurrentAudioId] = useState<string | null>(null);
  const [position, setPositionState] = useState(0);
  const [duration, setDuration] = useState(0);
  const soundRef = useRef<Audio.Sound | null>(null);
  const positionUpdateInterval = useRef<ReturnType<typeof setInterval> | null>(
    null
  );

  // Clear the position update interval
  const clearPositionInterval = () => {
    if (positionUpdateInterval.current) {
      clearInterval(positionUpdateInterval.current);
      positionUpdateInterval.current = null;
    }
  };

  // Start updating position at regular intervals when playing
  const startPositionTracking = () => {
    clearPositionInterval();

    positionUpdateInterval.current = setInterval(() => {
      if (soundRef.current) {
        void soundRef.current.getStatusAsync().then((status) => {
          if (status.isLoaded) {
            setPositionState(status.positionMillis);
          }
        });
      }
    }, 500); // Update every 500ms
  };

  const stopCurrentSound = async () => {
    clearPositionInterval();

    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
      setIsPlaying(false);
      setCurrentAudioId(null);
      setPositionState(0);
    }
  };

  const setPosition = async (newPosition: number) => {
    if (soundRef.current && isPlaying) {
      await soundRef.current.setPositionAsync(newPosition);
      setPositionState(newPosition);
    }
  };

  const playSound = async (uri: string, audioId?: string) => {
    // Stop current sound if any is playing
    await stopCurrentSound();

    // Set up audio mode
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true
    });

    // Load and play new sound
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true }
      );

      soundRef.current = sound;
      setIsPlaying(true);
      setPositionState(0);

      if (audioId) {
        setCurrentAudioId(audioId);
      }

      // Get initial status to set the duration
      const status = await sound.getStatusAsync();
      if (status.isLoaded) {
        setDuration(status.durationMillis ?? 0);
      }

      // Start tracking position
      startPositionTracking();

      // Set up listener for when sound finishes playing
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;

        if (status.didJustFinish) {
          clearPositionInterval();
          setIsPlaying(false);
          setCurrentAudioId(null);
          setPositionState(0);
          void sound.unloadAsync();
          soundRef.current = null;
        }
      });
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  };

  // Ensure cleanup when the component unmounts
  React.useEffect(() => {
    return () => {
      clearPositionInterval();
      if (soundRef.current) {
        void soundRef.current.unloadAsync();
      }
    };
  }, []);

  return (
    <AudioContext.Provider
      value={{
        playSound,
        stopCurrentSound,
        isPlaying,
        currentAudioId,
        position,
        duration,
        setPosition
      }}
    >
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const context = useContext(AudioContext);
  if (context === undefined) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
}
