import { Audio } from 'expo-av';
import React, { createContext, useContext, useRef, useState } from 'react';

interface AudioContextType {
  playSound: (uri: string, audioId?: string) => Promise<void>;
  playSoundSequence: (uris: string[], audioId?: string) => Promise<void>;
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
  const sequenceQueue = useRef<string[]>([]);
  const currentSequenceIndex = useRef<number>(0);

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

    // Reset sequence state
    sequenceQueue.current = [];
    currentSequenceIndex.current = 0;

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

  const playNextInSequence = async () => {
    currentSequenceIndex.current++;
    if (currentSequenceIndex.current < sequenceQueue.current.length) {
      const nextUri = sequenceQueue.current[currentSequenceIndex.current];
      if (nextUri) {
        await playSound(nextUri, currentAudioId || undefined);
      }
    } else {
      // Sequence finished
      sequenceQueue.current = [];
      currentSequenceIndex.current = 0;
    }
  };

  const playSound = async (uri: string, audioId?: string) => {
    console.log('🎵 AudioContext.playSound - URI:', uri.slice(0, 80));
    console.log('🎵 AudioContext.playSound - audioId:', audioId?.slice(0, 12));

    // Stop current sound if any is playing (but preserve sequence state)
    if (soundRef.current) {
      console.log('🛑 Stopping previous sound');
      clearPositionInterval();
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }

    // Set up audio mode
    console.log('🔊 Setting audio mode...');
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true
    });

    // Load and play new sound
    try {
      console.log('📂 Creating Audio.Sound from URI...');
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true }
      );
      console.log('✅ Sound created successfully');

      soundRef.current = sound;
      setIsPlaying(true);
      setPositionState(0);

      if (audioId) {
        setCurrentAudioId(audioId);
      }

      // Get initial status to set the duration
      const status = await sound.getStatusAsync();
      console.log(
        '📊 Sound status:',
        status.isLoaded ? 'loaded' : 'not loaded'
      );
      if (status.isLoaded) {
        const durationMs = status.durationMillis ?? 0;
        setDuration(durationMs);
        console.log(
          '⏱️ Duration:',
          durationMs,
          'ms (',
          (durationMs / 1000).toFixed(1),
          's)'
        );
        console.log('▶️ Is playing:', status.isPlaying);
      }

      // Start tracking position
      startPositionTracking();

      // Set up listener for when sound finishes playing
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) {
          console.warn('⚠️ Status update - sound not loaded');
          return;
        }

        if (status.didJustFinish) {
          console.log('🏁 Sound finished playing');
          clearPositionInterval();
          void sound.unloadAsync();
          soundRef.current = null;

          // Check if there are more sounds in the sequence
          if (sequenceQueue.current.length > 0) {
            console.log('▶️ Next in sequence...');
            void playNextInSequence();
          } else {
            // No more sounds in sequence
            console.log('✅ Playback complete');
            setIsPlaying(false);
            setCurrentAudioId(null);
            setPositionState(0);
          }
        }
      });
    } catch (error) {
      console.error('❌ Error in AudioContext.playSound:', error);
      console.error('❌ Error details:', JSON.stringify(error));
      setIsPlaying(false);
      setCurrentAudioId(null);
    }
  };

  const playSoundSequence = async (uris: string[], audioId?: string) => {
    if (uris.length === 0) return;

    // Stop any current playback
    await stopCurrentSound();

    // Set up sequence
    sequenceQueue.current = uris;
    currentSequenceIndex.current = 0;

    // Play first sound
    await playSound(uris[0]!, audioId);
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
        playSoundSequence,
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
