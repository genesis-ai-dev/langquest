import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

// Type definitions for voice activity detection
export interface VoiceActivityConfig {
    // Threshold for detecting speech (dB)
    speechThreshold: number;
    // Minimum duration of speech to trigger start (ms)
    minimumSpeechDuration: number;
    // Maximum silence duration before stopping (ms)
    maximumSilenceDuration: number;
    // Sampling rate for audio level checking (per second)
    sampleRate: number;
    // Noise gate threshold (dB)
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

// Default configuration based on platform
const DEFAULT_CONFIG: VoiceActivityConfig = {
    speechThreshold: Platform.OS === 'ios' ? -30 : -40,
    minimumSpeechDuration: 300, // 300ms
    maximumSilenceDuration: 1500, // 1.5 seconds
    sampleRate: 10, // 10 samples per second
    noiseGate: Platform.OS === 'ios' ? -50 : -60
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
        currentLevel: -100,
        averageLevel: -100,
        speechDuration: 0,
        silenceDuration: 0
    });

    // Audio level history for smoothing
    const levelHistoryRef = useRef<number[]>([]);
    const speechStartTimeRef = useRef<number | null>(null);
    const lastSpeechTimeRef = useRef<number | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

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
    const processAudioLevel = useCallback((rawLevel: number) => {
        const currentTime = Date.now();
        const smoothedLevel = smoothAudioLevel(rawLevel);

        const previousState = { ...stateRef.current };
        stateRef.current.currentLevel = rawLevel;
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
    }, [finalConfig, callbacks, smoothAudioLevel]);

    // Start listening for voice activity
    const startListening = useCallback(() => {
        if (stateRef.current.isListening) return;

        stateRef.current.isListening = true;
        levelHistoryRef.current = [];
        speechStartTimeRef.current = null;
        lastSpeechTimeRef.current = null;

        // For now, this is a placeholder for the actual audio monitoring
        // In a real implementation, you would:
        // 1. Initialize audio recording/monitoring
        // 2. Set up audio level callbacks
        // 3. Start the monitoring loop

        // Simulated audio monitoring (replace with actual implementation)
        intervalRef.current = setInterval(() => {
            // This would be replaced with actual audio level from device
            // For now, just simulate some audio levels
            const simulatedLevel = -100 + Math.random() * 40;
            processAudioLevel(simulatedLevel);
        }, 1000 / finalConfig.sampleRate);

        callbacks.onStateChange({ ...stateRef.current });
    }, [processAudioLevel, finalConfig.sampleRate, callbacks]);

    // Stop listening for voice activity
    const stopListening = useCallback(() => {
        if (!stateRef.current.isListening) return;

        stateRef.current.isListening = false;
        stateRef.current.isSpeaking = false;
        stateRef.current.speechDuration = 0;
        stateRef.current.silenceDuration = 0;

        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        // Clean up audio monitoring
        speechStartTimeRef.current = null;
        lastSpeechTimeRef.current = null;
        levelHistoryRef.current = [];

        callbacks.onStateChange({ ...stateRef.current });
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
    const callbacks: VoiceActivityCallbacks = {
        onSpeechStart,
        onSpeechEnd,
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        onLevelChange: () => { }, // No-op for simple version
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        onStateChange: () => { }  // No-op for simple version
    };

    const config: Partial<VoiceActivityConfig> = {};

    if (options.sensitive) {
        config.speechThreshold = Platform.OS === 'ios' ? -35 : -45;
        config.noiseGate = Platform.OS === 'ios' ? -55 : -65;
    }

    if (options.fastResponse) {
        config.minimumSpeechDuration = 200;
        config.maximumSilenceDuration = 1000;
        config.sampleRate = 15;
    }

    const vad = useVoiceActivityDetection(callbacks, config);

    return {
        startListening: vad.startListening,
        stopListening: vad.stopListening,
        isListening: vad.isListening,
        isSpeaking: vad.isSpeaking,
        currentLevel: vad.currentLevel
    };
}; 