/**
 * useVADRecording - Hook for Voice Activity Detection based recording
 * Automatically starts/stops recording based on microphone energy levels
 * 
 * Strategy:
 * 1. Use MicrophoneEnergyModule to detect when to START recording (pre-recording monitoring)
 * 2. Once recording starts, expo-av takes mic access - can't monitor energy externally
 * 3. Pass current metering from expo-av back to this hook to detect silence during recording
 * 4. Stop recording after silence duration, then resume monitoring for next segment
 */

import { useMicrophoneEnergy } from '@/hooks/useMicrophoneEnergy';
import React from 'react';

interface UseVADRecordingProps {
    threshold: number;
    silenceDuration: number;
    isVADActive: boolean;
    onRecordingStart: () => void;
    onRecordingStop: () => void;
    isManualRecording: boolean;
    currentRecordingEnergy?: number; // Energy from expo-av metering during recording
}

interface UseVADRecordingReturn {
    isVADRecording: boolean;
    currentEnergy: number;
    isPreparingRecording: boolean;
}

export function useVADRecording({
    threshold,
    silenceDuration,
    isVADActive,
    onRecordingStart,
    onRecordingStop,
    isManualRecording,
    currentRecordingEnergy
}: UseVADRecordingProps): UseVADRecordingReturn {
    const { isActive, energyResult, startEnergyDetection, stopEnergyDetection } =
        useMicrophoneEnergy();

    const [isVADRecording, setIsVADRecording] = React.useState(false);
    const [isPreparingRecording, setIsPreparingRecording] = React.useState(false);
    const vadRecordingStartTime = React.useRef<number>(0);
    const silenceTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSpeechTime = React.useRef<number>(0);

    // Use energy from MicrophoneModule when not recording, expo-av metering when recording
    const currentEnergy = isVADRecording
        ? (currentRecordingEnergy ?? 0)
        : (energyResult?.energy ?? 0);

    const MIN_RECORDING_DURATION = 500;

    // Predictive threshold: Start recording earlier to capture onset
    // Lower threshold triggers recording start, main threshold keeps it going
    // Balanced - captures onset without being too noise-sensitive
    const PREDICTIVE_MULTIPLIER = 0.35; // Start at 35% of main threshold (balanced)
    const predictiveThreshold = threshold * PREDICTIVE_MULTIPLIER;

    // Audio tail capture: Keep recording after silence to capture natural decay
    const AUDIO_TAIL_DELAY = 300; // Keep recording 300ms after silence threshold reached

    // Start energy detection when VAD becomes active
    React.useEffect(() => {
        if (isVADActive && !isActive && !isManualRecording) {
            console.log('🎯 VAD mode activated - starting energy detection');
            void startEnergyDetection();
        } else if (!isVADActive && isActive && !isManualRecording) {
            console.log('🎯 VAD mode deactivated - stopping energy detection');
            void stopEnergyDetection();

            // Stop any ongoing VAD recording
            if (isVADRecording) {
                setIsVADRecording(false);
                onRecordingStop();
            }

            // Clear any timers
            if (silenceTimer.current) {
                clearTimeout(silenceTimer.current);
                silenceTimer.current = null;
            }
        }
    }, [
        isVADActive,
        isActive,
        isManualRecording,
        startEnergyDetection,
        stopEnergyDetection,
        isVADRecording,
        onRecordingStop
    ]);

    // Update last speech time when energy is above threshold
    React.useEffect(() => {
        if (!isVADActive || !isActive || isManualRecording) {
            return;
        }

        const isAboveThreshold = currentEnergy > threshold;

        if (isAboveThreshold) {
            lastSpeechTime.current = Date.now();
        }
    }, [isVADActive, isActive, isManualRecording, currentEnergy, threshold]);

    // Detect speech to START recording
    // Use predictive threshold to start earlier and capture onset
    React.useEffect(() => {
        if (!isVADActive || !isActive || isManualRecording || isVADRecording) {
            return;
        }

        const isAbovePredictiveThreshold = currentEnergy > predictiveThreshold;

        if (isAbovePredictiveThreshold) {
            console.log(
                `🎤 VAD: Speech detected (${currentEnergy.toFixed(3)} > ${predictiveThreshold.toFixed(3)} predictive [main: ${threshold.toFixed(3)}]) - starting recording`
            );

            setIsVADRecording(true);
            setIsPreparingRecording(false);
            vadRecordingStartTime.current = Date.now();
            lastSpeechTime.current = Date.now();
            onRecordingStart();
        }
    }, [
        isVADActive,
        isActive,
        isManualRecording,
        isVADRecording,
        currentEnergy,
        threshold,
        predictiveThreshold,
        onRecordingStart
    ]);

    // Monitor silence during recording using a polling interval (not effect-based)
    React.useEffect(() => {
        if (!isVADRecording) return;

        console.log('🎯 VAD: Starting silence monitoring interval');

        const checkInterval = setInterval(() => {
            const timeSinceLastSpeech = Date.now() - lastSpeechTime.current;
            const recordingDuration = Date.now() - vadRecordingStartTime.current;

            // Check if we've been silent long enough (silence threshold + tail delay)
            const totalSilenceRequired = silenceDuration + AUDIO_TAIL_DELAY;

            if (timeSinceLastSpeech >= totalSilenceRequired && recordingDuration >= MIN_RECORDING_DURATION) {
                console.log(
                    `💤 VAD: ${timeSinceLastSpeech}ms silence detected (threshold: ${silenceDuration}ms + tail: ${AUDIO_TAIL_DELAY}ms) - stopping recording (${recordingDuration}ms total)`
                );
                setIsVADRecording(false);
                onRecordingStop();
                setIsPreparingRecording(true);
            }
        }, 100); // Check every 100ms

        return () => {
            console.log('🎯 VAD: Stopping silence monitoring interval');
            clearInterval(checkInterval);
        };
    }, [isVADRecording, silenceDuration, onRecordingStop]);

    // Cleanup on unmount
    React.useEffect(() => {
        return () => {
            if (silenceTimer.current) {
                clearTimeout(silenceTimer.current);
            }
        };
    }, []);

    return {
        isVADRecording,
        currentEnergy,
        isPreparingRecording
    };
}
