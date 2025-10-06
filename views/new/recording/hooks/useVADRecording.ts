/**
 * useVADRecording - Hook for Voice Activity Detection based recording
 * 
 * ONE-RECORDER STRATEGY (simplest, fastest):
 * 1. Native module does EVERYTHING (monitoring + recording + file writing)
 * 2. Speech detected → Native starts segment (dumps buffer, keeps recording)
 * 3. Silence detected → Native stops segment, emits complete event with URI
 * 4. JavaScript: Just save the URI to database
 * 5. expo-av NOT used for VAD at all!
 */

import { useMicrophoneEnergy } from '@/hooks/useMicrophoneEnergy';
import MicrophoneEnergyModule from '@/modules/microphone-energy';
import React from 'react';

interface UseVADRecordingProps {
    threshold: number;
    silenceDuration: number;
    isVADActive: boolean;
    onSegmentStart: () => void; // Create pending card
    onSegmentComplete: (uri: string) => void; // Save to database
    isManualRecording: boolean;
}

interface UseVADRecordingReturn {
    currentEnergy: number;
    isRecording: boolean;
}

export function useVADRecording({
    threshold,
    silenceDuration,
    isVADActive,
    onSegmentStart,
    onSegmentComplete,
    isManualRecording
}: UseVADRecordingProps): UseVADRecordingReturn {
    const {
        isActive,
        energyResult,
        startEnergyDetection,
        stopEnergyDetection
    } = useMicrophoneEnergy();

    const [isRecording, setIsRecording] = React.useState(false); // Use state not ref!
    const lastSpeechTime = React.useRef<number>(0);
    const recordingStartTime = React.useRef<number>(0);

    // Stable refs for callbacks
    const onSegmentStartRef = React.useRef(onSegmentStart);
    const onSegmentCompleteRef = React.useRef(onSegmentComplete);

    React.useEffect(() => {
        onSegmentStartRef.current = onSegmentStart;
        onSegmentCompleteRef.current = onSegmentComplete;
    }, [onSegmentStart, onSegmentComplete]);

    const currentEnergy = energyResult?.energy ?? 0;

    const MIN_SEGMENT_DURATION = 500;
    const PREDICTIVE_MULTIPLIER = 0.5;
    const predictiveThreshold = threshold * PREDICTIVE_MULTIPLIER;
    const AUDIO_TAIL_DELAY = 300;

    // Start energy detection when VAD becomes active
    React.useEffect(() => {
        if (isVADActive && !isActive && !isManualRecording) {
            console.log('🎯 VAD mode activated - native module takes over');
            void startEnergyDetection();
        } else if (!isVADActive && isActive) {
            console.log('🎯 VAD mode deactivated');

            // Stop any active segment
            if (isRecording) {
                console.log('🛑 Stopping active segment on VAD unlock');
                void MicrophoneEnergyModule.stopSegment();
                setIsRecording(false);
            }

            void stopEnergyDetection();
        }
    }, [isVADActive, isActive, isManualRecording, isRecording, startEnergyDetection, stopEnergyDetection]);

    // Listen for segment complete events from native module
    React.useEffect(() => {
        const subscription = MicrophoneEnergyModule.addListener(
            'onSegmentComplete',
            (payload: { uri: string; duration: number }) => {
                console.log('📼 Native segment complete:', payload.uri, `(${payload.duration}ms)`);
                setIsRecording(false);
                onSegmentCompleteRef.current(payload.uri);
            }
        );

        return () => subscription.remove();
    }, []);

    // Update last speech time
    React.useEffect(() => {
        if (!isVADActive || !isActive || isManualRecording) return;

        if (currentEnergy > threshold) {
            lastSpeechTime.current = Date.now();
        }
    }, [isVADActive, isActive, isManualRecording, currentEnergy, threshold]);

    // Start segment when speech detected
    React.useEffect(() => {
        if (!isVADActive || !isActive || isManualRecording || isRecording) {
            return;
        }

        if (currentEnergy > predictiveThreshold) {
            console.log(
                `🎤 VAD: Speech detected (${currentEnergy.toFixed(3)} > ${predictiveThreshold.toFixed(3)}) - starting native segment`
            );

            setIsRecording(true);
            recordingStartTime.current = Date.now();
            lastSpeechTime.current = Date.now();

            // Tell native module to start segment (dumps buffer + continues recording)
            void MicrophoneEnergyModule.startSegment({ prerollMs: 500 });

            // Tell parent to create pending card
            onSegmentStartRef.current();
        }
    }, [isVADActive, isActive, isManualRecording, isRecording, currentEnergy, predictiveThreshold]);

    // Monitor silence during recording
    React.useEffect(() => {
        if (!isRecording) return; // Now uses state, will re-run when isRecording changes!

        console.log('🎯 VAD: Starting silence monitoring');

        const checkInterval = setInterval(() => {
            const timeSinceLastSpeech = Date.now() - lastSpeechTime.current;
            const recordingDuration = Date.now() - recordingStartTime.current;
            const totalSilenceRequired = silenceDuration + AUDIO_TAIL_DELAY;

            if (timeSinceLastSpeech >= totalSilenceRequired && recordingDuration >= MIN_SEGMENT_DURATION) {
                console.log(`💤 VAD: ${timeSinceLastSpeech}ms silence - stopping native segment`);

                clearInterval(checkInterval);

                // Tell native module to stop (will emit onSegmentComplete event)
                void MicrophoneEnergyModule.stopSegment();
                // Don't set isRecording=false here, wait for onSegmentComplete event
            }
        }, 100);

        return () => {
            console.log('🎯 VAD: Stopping silence monitoring');
            clearInterval(checkInterval);
        };
    }, [isRecording, silenceDuration]); // isRecording is state now!

    return {
        currentEnergy,
        isRecording
    };
}
