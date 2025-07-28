import { Audio } from 'expo-av';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

// Type definitions for voice activity detection
export interface VoiceActivityConfig {
    // Threshold for detecting speech (normalized 0-1)
    speechThreshold: number;
    // Minimum duration of speech to trigger start (ms)
    minimumSpeechDuration: number;
    // Maximum silence duration before stopping (ms)
    maximumSilenceDuration: number;
    // How often to check audio levels (ms)
    sampleInterval: number;
    // Noise gate threshold (normalized 0-1)
    noiseGate: number;
}

export interface VoiceActivityState {
    isListening: boolean;
    isSpeaking: boolean;
    currentLevel: number;
    averageLevel: number;
    speechDuration: number;
    silenceDuration: number;
}

export interface VoiceActivityCallbacks {
    onSpeechStart: () => void;
    onSpeechEnd: () => void;
    onLevelChange: (level: number) => void;
    onStateChange: (state: VoiceActivityState) => void;
}

// Default configuration optimized for React Native
const DEFAULT_CONFIG: VoiceActivityConfig = {
    speechThreshold: Platform.OS === 'ios' ? 0.15 : 0.2,
    minimumSpeechDuration: 300, // 300ms
    maximumSilenceDuration: 1500, // 1.5 seconds
    sampleInterval: 100, // Check every 100ms
    noiseGate: Platform.OS === 'ios' ? 0.05 : 0.08
};

export const useVoiceActivityDetection = (
    callbacks: VoiceActivityCallbacks,
    config: Partial<VoiceActivityConfig> = {}
) => {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };

    // State tracking
    const stateRef = useRef<VoiceActivityState>({
        isListening: false,
        isSpeaking: false,
        currentLevel: 0,
        averageLevel: 0,
        speechDuration: 0,
        silenceDuration: 0
    });

    // Audio monitoring
    const recordingRef = useRef<Audio.Recording | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const levelHistoryRef = useRef<number[]>([]);
    const speechStartTimeRef = useRef<number | null>(null);
    const lastSpeechTimeRef = useRef<number | null>(null);

    // Smoothing function for audio levels
    const smoothAudioLevel = useCallback((newLevel: number): number => {
        levelHistoryRef.current.push(newLevel);

        // Keep only last 5 samples for smoothing
        if (levelHistoryRef.current.length > 5) {
            levelHistoryRef.current.shift();
        }

        // Calculate weighted average (more weight to recent samples)
        const weights = [0.1, 0.15, 0.2, 0.25, 0.3];
        let weightedSum = 0;
        let totalWeight = 0;

        for (let i = 0; i < levelHistoryRef.current.length; i++) {
            const weight = weights[i] ?? 0.1;
            const level = levelHistoryRef.current[i] ?? 0;
            weightedSum += level * weight;
            totalWeight += weight;
        }

        return weightedSum / totalWeight;
    }, []);

    // Process audio level and determine speech state
    const processAudioLevel = useCallback(async () => {
        if (!recordingRef.current) return;

        try {
            const status = await recordingRef.current.getStatusAsync();

            if (!status.isRecording || !status.metering) return;

            // Get audio level from metering (expo-av provides this in dB, convert to 0-1)
            // metering is typically between -120 (silence) and 0 (loudest)
            const dbLevel = status.metering;
            const normalizedLevel = Math.max(0, Math.min(1, (dbLevel + 60) / 60));

            const currentTime = Date.now();
            const smoothedLevel = smoothAudioLevel(normalizedLevel);

            const previousState = { ...stateRef.current };
            stateRef.current.currentLevel = normalizedLevel;
            stateRef.current.averageLevel = smoothedLevel;

            // Check if audio level indicates speech
            const isSpeechLevel = smoothedLevel > finalConfig.speechThreshold &&
                smoothedLevel > finalConfig.noiseGate;

            if (isSpeechLevel) {
                // Potential speech detected
                if (!speechStartTimeRef.current) {
                    speechStartTimeRef.current = currentTime;
                }

                lastSpeechTimeRef.current = currentTime;
                stateRef.current.speechDuration = currentTime - speechStartTimeRef.current;
                stateRef.current.silenceDuration = 0;

                // Check if we've had speech long enough to trigger start
                if (!stateRef.current.isSpeaking &&
                    stateRef.current.speechDuration >= finalConfig.minimumSpeechDuration) {
                    stateRef.current.isSpeaking = true;
                    callbacks.onSpeechStart();
                }
            } else {
                // No speech detected
                if (lastSpeechTimeRef.current) {
                    stateRef.current.silenceDuration = currentTime - lastSpeechTimeRef.current;
                }

                // Check if we should stop speech detection
                if (stateRef.current.isSpeaking &&
                    stateRef.current.silenceDuration >= finalConfig.maximumSilenceDuration) {
                    stateRef.current.isSpeaking = false;
                    speechStartTimeRef.current = null;
                    stateRef.current.speechDuration = 0;
                    callbacks.onSpeechEnd();
                }
            }

            // Notify level change
            callbacks.onLevelChange(smoothedLevel);

            // Notify state change if state changed
            if (JSON.stringify(previousState) !== JSON.stringify(stateRef.current)) {
                callbacks.onStateChange({ ...stateRef.current });
            }
        } catch (error) {
            console.error('Error processing audio level:', error);
        }
    }, [finalConfig, callbacks, smoothAudioLevel]);

    // Start listening for voice activity
    const startListening = useCallback(async () => {
        if (stateRef.current.isListening) return;

        try {
            // Request permissions
            const { status } = await Audio.requestPermissionsAsync();
            if (status !== Audio.PermissionStatus.GRANTED) {
                throw new Error('Microphone permission not granted');
            }

            // Set audio mode for recording
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
                staysActiveInBackground: false,
                shouldDuckAndroid: true,
                playThroughEarpieceAndroid: false,
            });

            // Create recording for metering only (we don't save this audio)
            const recording = new Audio.Recording();
            await recording.prepareToRecordAsync({
                isMeteringEnabled: true,
                android: {
                    extension: '.m4a',
                    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
                    audioEncoder: Audio.AndroidAudioEncoder.AAC,
                    sampleRate: 44100,
                    numberOfChannels: 2,
                    bitRate: 128000,
                },
                ios: {
                    extension: '.m4a',
                    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
                    audioQuality: Audio.IOSAudioQuality.MEDIUM,
                    sampleRate: 44100,
                    numberOfChannels: 2,
                    bitRate: 128000,
                    linearPCMBitDepth: 16,
                    linearPCMIsBigEndian: false,
                    linearPCMIsFloat: false,
                },
                web: {
                    mimeType: 'audio/webm',
                    bitsPerSecond: 128000,
                },
            });

            await recording.startAsync();
            recordingRef.current = recording;

            stateRef.current.isListening = true;
            levelHistoryRef.current = [];
            speechStartTimeRef.current = null;
            lastSpeechTimeRef.current = null;

            // Start monitoring audio levels
            intervalRef.current = setInterval(() => {
                void processAudioLevel();
            }, finalConfig.sampleInterval);

            callbacks.onStateChange({ ...stateRef.current });
        } catch (error) {
            console.error('Failed to start VAD:', error);
            throw error;
        }
    }, [processAudioLevel, finalConfig.sampleInterval, callbacks]);

    // Stop listening for voice activity
    const stopListening = useCallback(async () => {
        if (!stateRef.current.isListening) return;

        try {
            // Stop monitoring
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }

            // Stop and cleanup recording
            if (recordingRef.current) {
                await recordingRef.current.stopAndUnloadAsync();
                recordingRef.current = null;
            }

            // Reset state
            stateRef.current.isListening = false;
            stateRef.current.isSpeaking = false;
            stateRef.current.speechDuration = 0;
            stateRef.current.silenceDuration = 0;
            stateRef.current.currentLevel = 0;
            stateRef.current.averageLevel = 0;

            speechStartTimeRef.current = null;
            lastSpeechTimeRef.current = null;
            levelHistoryRef.current = [];

            callbacks.onStateChange({ ...stateRef.current });
        } catch (error) {
            console.error('Error stopping VAD:', error);
        }
    }, [callbacks]);

    // Reset the VAD state
    const resetVAD = useCallback(() => {
        speechStartTimeRef.current = null;
        lastSpeechTimeRef.current = null;
        levelHistoryRef.current = [];
        stateRef.current.isSpeaking = false;
        stateRef.current.speechDuration = 0;
        stateRef.current.silenceDuration = 0;

        callbacks.onStateChange({ ...stateRef.current });
    }, [callbacks]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            if (recordingRef.current) {
                recordingRef.current.stopAndUnloadAsync().catch(console.error);
            }
        };
    }, []);

    // Get current state
    const getCurrentState = useCallback(() => {
        return { ...stateRef.current };
    }, []);

    // Update configuration
    const updateConfig = useCallback((newConfig: Partial<VoiceActivityConfig>) => {
        Object.assign(finalConfig, newConfig);
    }, [finalConfig]);

    return {
        // Core functions
        startListening,
        stopListening,
        resetVAD,

        // State access
        getCurrentState,

        // Configuration
        updateConfig,
        currentConfig: finalConfig,

        // Current state (for reactive updates)
        isListening: stateRef.current.isListening,
        isSpeaking: stateRef.current.isSpeaking,
        currentLevel: stateRef.current.currentLevel,

        // For external audio processing
        processAudioLevel
    };
};

// Utility hook for simple VAD with minimal configuration
export const useSimpleVAD = (
    onSpeechStart: () => void,
    onSpeechEnd: () => void,
    options: {
        sensitive?: boolean;
        fastResponse?: boolean;
    } = {}
) => {
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [currentLevel, setCurrentLevel] = useState(0);

    const callbacks: VoiceActivityCallbacks = {
        onSpeechStart: () => {
            setIsSpeaking(true);
            onSpeechStart();
        },
        onSpeechEnd: () => {
            setIsSpeaking(false);
            onSpeechEnd();
        },
        onLevelChange: (level) => {
            setCurrentLevel(level);
        },
        onStateChange: (state) => {
            setIsListening(state.isListening);
            setIsSpeaking(state.isSpeaking);
            setCurrentLevel(state.currentLevel);
        }
    };

    const config: Partial<VoiceActivityConfig> = {};

    if (options.sensitive) {
        config.speechThreshold = Platform.OS === 'ios' ? 0.12 : 0.15;
        config.noiseGate = Platform.OS === 'ios' ? 0.03 : 0.05;
    }

    if (options.fastResponse) {
        config.minimumSpeechDuration = 200;
        config.maximumSilenceDuration = 1000;
        config.sampleInterval = 80;
    }

    const vad = useVoiceActivityDetection(callbacks, config);

    return {
        startListening: vad.startListening,
        stopListening: vad.stopListening,
        isListening,
        isSpeaking,
        currentLevel
    };
}; 