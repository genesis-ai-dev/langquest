import { Audio } from 'expo-av';
import { useCallback, useEffect, useRef } from 'react';
import { useMicrophoneEnergy } from './useMicrophoneEnergy';

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
    const stoppingRef = useRef<boolean>(false);
    const levelHistoryRef = useRef<number[]>([]);
    const speechStartTimeRef = useRef<number | null>(null);
    const lastSpeechTimeRef = useRef<number | null>(null);
    const isStartingRecorderRef = useRef<boolean>(false);

    // Native energy monitor hook (second microphone dedicated to metering)
    const {
        isActive: isEnergyActive,
        energyResult,
        startEnergyDetection,
        stopEnergyDetection,
        requestPermissions: requestEnergyPermissions
    } = useMicrophoneEnergy();

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
    // Convert dBFS (negative) to normalized [0,1]
    const dbToNormalized = (dbValue: number, floorDb = -60): number => {
        if (Number.isNaN(dbValue)) return 0;
        const clamped = Math.max(floorDb, Math.min(0, dbValue));
        return (clamped - floorDb) / (0 - floorDb);
    };

    const processEnergySample = useCallback((energyDb: number) => {
        if (!stateRef.current.isListening) return;
        try {
            const currentTime = Date.now();
            // Native energy comes in dBFS (~-60..0). Normalize to 0..1.
            const normalizedLevel = Math.max(0, Math.min(1, dbToNormalized(energyDb)));
            const smoothedLevel = smoothAudioLevel(normalizedLevel);

            // Use the final configured threshold (can be calibrated at runtime)
            const threshold = finalConfig.speechThreshold;
            const relativeLevel = Math.max(0, (smoothedLevel - threshold) / Math.max(0.0001, 1 - threshold));

            // Update state
            const previousState = { ...stateRef.current };
            // Expose normalized level for UI purposes
            stateRef.current.currentLevel = smoothedLevel;
            stateRef.current.averageLevel = levelHistoryRef.current.length > 0
                ? levelHistoryRef.current.reduce((a, b) => a + b, 0) / levelHistoryRef.current.length
                : relativeLevel;

            // Detect speech
            if (smoothedLevel > threshold) {
                if (!speechStartTimeRef.current) {
                    speechStartTimeRef.current = currentTime;
                }

                lastSpeechTimeRef.current = currentTime;
                stateRef.current.speechDuration = currentTime - speechStartTimeRef.current;
                stateRef.current.silenceDuration = 0;

                if (!stateRef.current.isSpeaking && stateRef.current.speechDuration >= finalConfig.minimumSpeechDuration) {
                    stateRef.current.isSpeaking = true;
                    callbacks.onSpeechStart();
                    // Start recorder on speech start
                    const startRecorder = async () => {
                        try {
                            if (isStartingRecorderRef.current || recordingRef.current) return;
                            isStartingRecorderRef.current = true;
                            const recording = new Audio.Recording();
                            await recording.prepareToRecordAsync({
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
                        } catch (error) {
                            console.error('Error starting recorder:', error);
                        } finally {
                            isStartingRecorderRef.current = false;
                        }
                    };
                    void startRecorder();
                }
            } else {
                if (lastSpeechTimeRef.current) {
                    stateRef.current.silenceDuration = currentTime - lastSpeechTimeRef.current;
                }

                if (stateRef.current.isSpeaking && stateRef.current.silenceDuration >= finalConfig.maximumSilenceDuration) {
                    stateRef.current.isSpeaking = false;
                    speechStartTimeRef.current = null;
                    stateRef.current.speechDuration = 0;

                    const finalizeSegment = async () => {
                        let recordingUri: string | undefined;
                        if (finalConfig.saveRecordings && recordingRef.current) {
                            try {
                                stoppingRef.current = true;
                                await recordingRef.current.stopAndUnloadAsync();
                                const uri = recordingRef.current.getURI();
                                recordingUri = uri || undefined;
                            } catch (error) {
                                console.error('❌ Error saving recording:', error);
                            } finally {
                                recordingRef.current = null;
                                stoppingRef.current = false;
                            }
                        }
                        callbacks.onSpeechEnd(recordingUri);
                    };
                    void finalizeSegment();
                }
            }

            // Notify level change with normalized level (better for calibration and UI)
            callbacks.onLevelChange(smoothedLevel);

            // Notify state change if state changed
            if (JSON.stringify(previousState) !== JSON.stringify(stateRef.current)) {
                callbacks.onStateChange({ ...stateRef.current });
            }
        } catch (error) {
            console.error('Error processing energy sample:', error);
        }
    }, [finalConfig, callbacks, smoothAudioLevel]);

    // Helper to start a new recording
    // Removed: metering/monitoring handled by native module

    // Start listening for voice activity
    const startListening = useCallback(async () => {
        if (stateRef.current.isListening) return;

        try {
            // Request permissions
            const { status } = await Audio.requestPermissionsAsync();
            if (status !== Audio.PermissionStatus.GRANTED) {
                throw new Error('Microphone permission not granted');
            }
            // Ensure native energy monitor has permissions too
            await requestEnergyPermissions();

            // Set audio mode for recording
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
                staysActiveInBackground: false,
                shouldDuckAndroid: true,
                playThroughEarpieceAndroid: false,
            });

            // Start native energy detection (dedicated metering stream)
            await startEnergyDetection();

            stateRef.current.isListening = true;
            levelHistoryRef.current = [];
            speechStartTimeRef.current = null;
            lastSpeechTimeRef.current = null;

            callbacks.onStateChange({ ...stateRef.current });
        } catch (error) {
            console.error('Error starting rabbit mode VAD:', error);
            throw error;
        }
    }, [callbacks, requestEnergyPermissions, startEnergyDetection]);

    // Stop listening
    const stopListening = useCallback(async () => {
        if (!stateRef.current.isListening) return;

        try {
            // Stop native energy detection
            if (isEnergyActive) {
                await stopEnergyDetection();
            }

            // Stop and cleanup recording
            if (recordingRef.current) {
                stoppingRef.current = true;
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
    }, [callbacks, isEnergyActive, stopEnergyDetection]);

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
            if (recordingRef.current) {
                recordingRef.current.stopAndUnloadAsync().catch(console.error);
            }
        };
    }, []);

    // Feed energy samples into the detector
    useEffect(() => {
        if (!energyResult) return;
        processEnergySample(energyResult.energy);
        // We intentionally depend only on timestamp to sample new values without re-binding
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [energyResult?.timestamp]);

    return {
        startListening,
        stopListening,
        resetVAD,
        state: stateRef.current
    };
}; 