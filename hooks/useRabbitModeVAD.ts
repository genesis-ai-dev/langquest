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
    // Expo recorder path deprecated by native segmented recording
    const recordingRef = useRef<Audio.Recording | null>(null);
    const stoppingRef = useRef<boolean>(false);
    const isRecorderActiveRef = useRef<boolean>(false);
    const levelHistoryRef = useRef<number[]>([]);
    const speechStartTimeRef = useRef<number | null>(null);
    const lastSpeechTimeRef = useRef<number | null>(null);
    const isStartingRecorderRef = useRef<boolean>(false);
    const recorderNotifiedStartRef = useRef<boolean>(false);
    const lastStartAttemptTsRef = useRef<number>(0);
    const startAttemptedForThisSpeechRef = useRef<boolean>(false);

    // Native energy monitor hook (second microphone dedicated to metering)
    const {
        isActive: isEnergyActive,
        energyResult,
        startEnergyDetection,
        stopEnergyDetection,
        requestPermissions: requestEnergyPermissions,
        startSegment,
        stopSegment
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

            // Detect speech (use raw level for rising edge to reduce latency)
            if (normalizedLevel > threshold) {
                const wasSpeechStarted = !!speechStartTimeRef.current;
                if (!wasSpeechStarted) {
                    speechStartTimeRef.current = currentTime;
                    startAttemptedForThisSpeechRef.current = false;
                }

                lastSpeechTimeRef.current = currentTime;
                stateRef.current.speechDuration = speechStartTimeRef.current
                    ? currentTime - speechStartTimeRef.current
                    : 0;
                stateRef.current.silenceDuration = 0;

                // Start recorder immediately on threshold crossing for minimal latency
                const ensureRecorderStarted = async () => {
                    try {
                        if (isStartingRecorderRef.current || isRecorderActiveRef.current) return;
                        if (startAttemptedForThisSpeechRef.current) return;
                        // Throttle start attempts to avoid native contention
                        const now = Date.now();
                        if (now - lastStartAttemptTsRef.current < 150) return;
                        lastStartAttemptTsRef.current = now;
                        // Start a bit earlier using hysteresis; create and start fresh to avoid stale state
                        const earlyThreshold = Math.max(0.01, threshold - 0.15);
                        if (normalizedLevel >= earlyThreshold) {
                            isStartingRecorderRef.current = true;
                            startAttemptedForThisSpeechRef.current = true;
                            // Start native segmented recording with preroll
                            await startSegment({ prerollMs: 350 });
                            isRecorderActiveRef.current = true;
                            if (!recorderNotifiedStartRef.current) {
                                recorderNotifiedStartRef.current = true;
                                callbacks.onSpeechStart();
                            }
                        }
                    } catch (error) {
                        console.error('Error ensuring recorder started:', error);
                        isRecorderActiveRef.current = false;
                        recordingRef.current = null;
                        // allow a retry on next crossing if this failed
                        startAttemptedForThisSpeechRef.current = false;
                    } finally {
                        isStartingRecorderRef.current = false;
                    }
                };
                // Only try to start on the rising edge / first frames of speech
                if (!wasSpeechStarted) {
                    void ensureRecorderStarted();
                }

                if (!stateRef.current.isSpeaking && stateRef.current.speechDuration >= finalConfig.minimumSpeechDuration) {
                    stateRef.current.isSpeaking = true;
                    // onSpeechStart may already be sent when recorder began; avoid duplicate UX flicker
                    if (!recorderNotifiedStartRef.current) {
                        callbacks.onSpeechStart();
                        recorderNotifiedStartRef.current = true;
                    }
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
                        try {
                            if (finalConfig.saveRecordings) {
                                const uri = await stopSegment();
                                recordingUri = uri || undefined;
                                isRecorderActiveRef.current = false;
                            }
                        } catch (error) {
                            console.error('❌ Error stopping segment:', error);
                        }
                        callbacks.onSpeechEnd(recordingUri);
                        // Allow next onSpeechStart to fire on next speech
                        recorderNotifiedStartRef.current = false;
                    };
                    void finalizeSegment();
                    startAttemptedForThisSpeechRef.current = false;
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

            // Set audio mode for recording (defensive)
            try {
                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: true,
                    playsInSilentModeIOS: true,
                    staysActiveInBackground: false,
                    shouldDuckAndroid: true,
                    playThroughEarpieceAndroid: false,
                });
            } catch (err) {
                console.log('Audio mode setup warning:', err);
            }

            // Start native energy detection (dedicated metering stream)
            await startEnergyDetection();

            // Pre-warm recorder so startAsync is near-instant on threshold crossing
            try {
                if (!recordingRef.current) {
                    const preRec = new Audio.Recording();
                    await preRec.prepareToRecordAsync({
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
                    recordingRef.current = preRec;
                    isRecorderActiveRef.current = false;
                }
            } catch (prepErr) {
                console.error('Pre-warm recorder failed:', prepErr);
                recordingRef.current = null;
            }

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
            // Stop native energy detection (ignore benign errors)
            try {
                if (isEnergyActive) {
                    await stopEnergyDetection();
                }
            } catch {
                console.log('Energy detection already stopped.');
            }

            // Stop and cleanup recording if active
            if (isRecorderActiveRef.current && recordingRef.current) {
                try {
                    stoppingRef.current = true;
                    await recordingRef.current.stopAndUnloadAsync();
                } catch {
                    console.log('Recorder already stopped.');
                } finally {
                    recordingRef.current = null;
                    stoppingRef.current = false;
                    isRecorderActiveRef.current = false;
                }
            } else if (recordingRef.current) {
                // Pre-warmed recorder that never started
                try {
                    await recordingRef.current.stopAndUnloadAsync();
                } catch {
                    // already stopped or never started
                }
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
        // We intentionally keep dependencies minimal to avoid re-binding
    }, [energyResult?.timestamp]);

    return {
        startListening,
        stopListening,
        resetVAD,
        state: stateRef.current
    };
}; 