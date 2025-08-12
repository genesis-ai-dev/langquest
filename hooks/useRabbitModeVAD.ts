import { Audio } from 'expo-av';
import { useCallback, useEffect, useRef } from 'react';

export interface RabbitModeVADCallbacks {
    onSpeechStart: () => void;
    onSpeechEnd: (recordingUri?: string) => void;
    onLevelChange: (level: number) => void;
    onStateChange: (state: RabbitModeVADState) => void;
}

export interface RabbitModeVADConfig {
    /** Threshold for detecting speech (0-1) */
    speechThreshold: number;
    /** Minimum duration of speech before triggering start (ms) */
    minimumSpeechDuration: number;
    /** Maximum silence duration before triggering end (ms) */
    maximumSilenceDuration: number;
    /** How often to sample audio levels (ms) */
    sampleInterval: number;
    /** Whether to save recordings when speech ends */
    saveRecordings: boolean;
}

export interface RabbitModeVADState {
    isListening: boolean;
    isSpeaking: boolean;
    currentLevel: number;
    averageLevel: number;
    speechDuration: number;
    silenceDuration: number;
}

const DEFAULT_CONFIG: RabbitModeVADConfig = {
    speechThreshold: 0.6, // Increased from 0.4 - silence between speeches was ~0.57
    minimumSpeechDuration: 200, // Reduced from 300ms for faster response
    maximumSilenceDuration: 600, // Reduced from 800ms for quicker cutoff
    sampleInterval: 30,
    saveRecordings: true
};

export const useRabbitModeVAD = (
    callbacks: RabbitModeVADCallbacks,
    config: Partial<RabbitModeVADConfig> = {}
) => {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };

    // State tracking
    const stateRef = useRef<RabbitModeVADState>({
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
    const stoppingRef = useRef<boolean>(false);
    const levelHistoryRef = useRef<number[]>([]);
    const speechStartTimeRef = useRef<number | null>(null);
    const lastSpeechTimeRef = useRef<number | null>(null);

    // Smoothing function for audio levels
    const smoothAudioLevel = useCallback((newLevel: number): number => {
        // Exponential moving average for snappy response
        const prev = levelHistoryRef.current.length > 0 ? levelHistoryRef.current[levelHistoryRef.current.length - 1] ?? 0 : 0;
        const alpha = 0.2; // 0.1-0.2 is snappy; increase for more smoothing
        const ema = prev * (1 - alpha) + newLevel * alpha;
        levelHistoryRef.current.push(ema);
        if (levelHistoryRef.current.length > 10) levelHistoryRef.current.shift();
        return ema;
    }, []);

    // Process audio levels and detect speech
    const processStatusUpdate = useCallback((status: Audio.RecordingStatus) => {
        if (stoppingRef.current || !stateRef.current.isListening) return;
        try {
            if (!status.isRecording) return;

            const currentTime = Date.now();
            const rawLevel = status.metering ?? 0;
            const normalizedLevel = Math.max(0, Math.min(1, (rawLevel + 160) / 160));
            const smoothedLevel = smoothAudioLevel(normalizedLevel);

            // Normalize relative to threshold so 0 ~ threshold
            // Use the final configured threshold (can be calibrated at runtime)
            const threshold = (finalConfig.speechThreshold);
            const relativeLevel = Math.max(0, (smoothedLevel - threshold) / Math.max(0.0001, 1 - threshold));

            // Update state
            const previousState = { ...stateRef.current };
            stateRef.current.currentLevel = relativeLevel;
            stateRef.current.averageLevel = levelHistoryRef.current.length > 0
                ? levelHistoryRef.current.reduce((a, b) => a + b, 0) / levelHistoryRef.current.length
                : relativeLevel;

            // Lightweight diagnostics (1% sampled) to help tune thresholds without spamming logs
            if (Math.random() < 0.01) {
                const rawStr = typeof rawLevel === 'number' ? rawLevel.toFixed(1) : String(rawLevel);
                console.log(
                    `[VAD] lvl(raw=${rawStr}, norm=${normalizedLevel.toFixed(3)}, smooth=${smoothedLevel.toFixed(3)}) thresh=${threshold.toFixed(3)} rel=${relativeLevel.toFixed(3)} speaking=${stateRef.current.isSpeaking}`
                );
            }

            // Detect speech
            if (smoothedLevel > finalConfig.speechThreshold) {
                // Speech detected
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

                    // Stop recording and get URI if we're saving recordings
                    const finalizeSegment = async () => {
                        let recordingUri: string | undefined;
                        if (finalConfig.saveRecordings && recordingRef.current) {
                            try {
                                await recordingRef.current.stopAndUnloadAsync();
                                const uri = recordingRef.current.getURI();
                                recordingUri = uri || undefined;
                                console.log('📁 Saved speech recording:', recordingUri);
                                await startNewRecording();
                            } catch (error) {
                                console.error('❌ Error saving recording:', error);
                            }
                        }
                        callbacks.onSpeechEnd(recordingUri);
                    };
                    void finalizeSegment();
                }
            }

            // Notify level change
            callbacks.onLevelChange(relativeLevel);

            // Notify state change if state changed
            if (JSON.stringify(previousState) !== JSON.stringify(stateRef.current)) {
                callbacks.onStateChange({ ...stateRef.current });
            }
        } catch (error) {
            console.error('Error processing audio level:', error);
        }
    }, [finalConfig, callbacks, smoothAudioLevel]);

    // Helper to start a new recording
    const startNewRecording = useCallback(async () => {
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
        // Native-driven status updates for low latency
        recording.setOnRecordingStatusUpdate((status: Audio.RecordingStatus) => {
            processStatusUpdate(status);
        });
        // Update cadence (ms) if available on platform
        if (typeof (recording as unknown as { setProgressUpdateInterval?: (ms: number) => void }).setProgressUpdateInterval === 'function') {
            (recording as unknown as { setProgressUpdateInterval: (ms: number) => void }).setProgressUpdateInterval(finalConfig.sampleInterval);
        }
        recordingRef.current = recording;
    }, [finalConfig.sampleInterval, processStatusUpdate]);

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

            // Start initial recording
            await startNewRecording();

            stateRef.current.isListening = true;
            levelHistoryRef.current = [];
            speechStartTimeRef.current = null;
            lastSpeechTimeRef.current = null;

            callbacks.onStateChange({ ...stateRef.current });
        } catch (error) {
            console.error('Error starting rabbit mode VAD:', error);
            throw error;
        }
    }, [callbacks, startNewRecording]);

    // Stop listening
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
                stoppingRef.current = true;
                // Detach listener before stopping
                recordingRef.current.setOnRecordingStatusUpdate(null);
                await recordingRef.current.stopAndUnloadAsync();
                recordingRef.current = null;
                stoppingRef.current = false;
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
            console.error('Error stopping rabbit mode VAD:', error);
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

    return {
        startListening,
        stopListening,
        resetVAD,
        state: stateRef.current
    };
}; 