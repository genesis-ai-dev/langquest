import { useAuth } from '@/contexts/AuthContext';
import type { asset, translation } from '@/db/drizzleSchema';
import { useRabbitModeVAD } from '@/hooks/useRabbitModeVAD';
import { useLocalStore } from '@/store/localStore';
import { RabbitModeFileManager } from '@/utils/rabbitModeFileManager';
import { generateWaveformData } from '@/utils/waveformGenerator';
import React from 'react';
import { Alert } from 'react-native';

type Asset = typeof asset.$inferSelect;
type Translation = typeof translation.$inferSelect;

// Rabbit Mode Types
interface RecordingSegment {
    id: string;
    assetId: string;
    startTime: number;
    endTime: number;
    duration: number;
    audioUri?: string;
    waveformData?: number[];
}

interface AssetWithTranslations extends Asset {
    translations: Translation[];
    hasRecording: boolean;
    recordingSegments: RecordingSegment[];
}

interface RabbitModeState {
    isRecording: boolean;
    currentAssetIndex: number;
    pulledAssets: AssetWithTranslations[];
    isHoldingCard: boolean;
    recordingStartTime: number | null;
    recordingSegments: RecordingSegment[];
    audioRecording: null; // Handled by VAD hook
}

interface UseRabbitModeOptions {
    currentQuestId: string | null;
    assets: Asset[];
}

export const useRabbitMode = ({ currentQuestId, assets }: UseRabbitModeOptions) => {
    const { currentUser } = useAuth();
    const [isRabbitMode, setIsRabbitMode] = React.useState(false);
    const [showFlaggingModal, setShowFlaggingModal] = React.useState(false);
    const [currentSessionId, setCurrentSessionId] = React.useState<string | null>(null);
    const [rabbitState, setRabbitState] = React.useState<RabbitModeState>({
        isRecording: false,
        currentAssetIndex: 0,
        pulledAssets: [],
        isHoldingCard: false,
        recordingStartTime: null,
        recordingSegments: [],
        audioRecording: null
    });

    // Use ref to store current rabbit state for callbacks
    const rabbitStateRef = React.useRef<RabbitModeState>(rabbitState);
    const recordingStartTimeRef = React.useRef<number | null>(null);
    const listeningTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    // Update ref whenever state changes
    React.useEffect(() => {
        rabbitStateRef.current = rabbitState;
    }, [rabbitState]);

    // Voice Activity Detection
    const vadFunctionsRef = React.useRef<{
        startListening: () => Promise<void>;
        stopListening: () => Promise<void>;
        resetVAD: () => void;
    } | null>(null);

    const handleSpeechStart = React.useCallback(() => {
        if (!currentSessionId || !currentQuestId || !currentUser) {
            console.warn('❌ Cannot start recording - missing session, quest, or user');
            return;
        }

        const session = useLocalStore.getState().getRabbitModeSession(currentSessionId);
        if (!session) {
            console.warn('❌ Cannot start recording - no active session found');
            return;
        }

        const currentAsset = session.assets.find(
            (asset) => asset.id === session.currentAssetId
        );

        if (!currentAsset) {
            console.warn('❌ Cannot start recording - no current asset available');
            return;
        }

        console.log('🎤 Recording started for asset:', currentAsset.name);

        const startTime = Date.now();
        recordingStartTimeRef.current = startTime;

        setRabbitState((prev) => ({
            ...prev,
            isRecording: true,
            recordingStartTime: startTime
        }));
    }, [currentSessionId, currentQuestId, currentUser]);

    const handleSpeechEnd = React.useCallback(
        async (recordingUri?: string) => {
            if (!currentUser || !currentQuestId || !currentSessionId) {
                console.warn('❌ Missing required data for saving recording');
                return;
            }

            const session = useLocalStore.getState().getRabbitModeSession(currentSessionId);
            if (!session) {
                console.warn('❌ No active session found');
                return;
            }

            const currentAsset = session.assets.find(
                (a) => a.id === session.currentAssetId
            );
            if (!currentAsset) {
                console.warn('❌ No current asset found in session');
                return;
            }

            if (!recordingUri) {
                console.warn('❌ No recording URI provided by VAD hook');
                return;
            }

            if (!recordingStartTimeRef.current) {
                console.warn('❌ Missing recording start time');
                return;
            }

            try {
                const endTime = Date.now();
                const duration = endTime - recordingStartTimeRef.current;

                const waveformData = await generateWaveformData(recordingUri);
                const savedUri = await RabbitModeFileManager.saveAudioSegment(
                    currentSessionId,
                    recordingUri
                );

                useLocalStore.getState().addRabbitModeSegment(currentSessionId, currentAsset.id, {
                    assetId: currentAsset.id,
                    startTime: recordingStartTimeRef.current,
                    endTime,
                    duration,
                    audioUri: savedUri,
                    waveformData: waveformData
                });

                console.log(`✅ Saved ${(duration / 1000).toFixed(1)}s recording for ${currentAsset.name}`);

                setRabbitState((prev) => ({
                    ...prev,
                    isRecording: false,
                    recordingStartTime: null
                }));
            } catch (error) {
                console.error('❌ Error saving recording segment:', error);
            }
        },
        [currentUser, currentQuestId, currentSessionId]
    );

    const {
        startListening: vadStartListening,
        stopListening: vadStopListening,
        resetVAD: vadReset,
        state: vadState
    } = useRabbitModeVAD(
        {
            onSpeechStart: handleSpeechStart,
            onSpeechEnd: (recordingUri?: string) => {
                void handleSpeechEnd(recordingUri);
            },
            onLevelChange: (_level: number) => {
                // Removed excessive logging for performance
            },
            onStateChange: (_state) => {
                // Removed excessive logging for performance
            }
        },
        { saveRecordings: true }
    );

    // Update ref whenever VAD functions change
    React.useEffect(() => {
        vadFunctionsRef.current = {
            startListening: vadStartListening,
            stopListening: vadStopListening,
            resetVAD: vadReset
        };
        console.log('🔄 VAD functions updated:', {
            hasStart: !!vadStartListening,
            hasStop: !!vadStopListening,
            hasReset: !!vadReset
        });
    }, [vadStartListening, vadStopListening, vadReset]);

    // Debug VAD state changes and manage listening timeout
    React.useEffect(() => {
        console.log('🎯 VAD State:', {
            isListening: vadState.isListening,
            isSpeaking: vadState.isSpeaking,
            currentLevel: vadState.currentLevel.toFixed(3)
        });

        // Set timeout when listening starts
        if (vadState.isListening && !listeningTimeoutRef.current) {
            listeningTimeoutRef.current = setTimeout(() => {
                console.warn('⏰ Listening timeout - force stopping VAD');
                if (vadFunctionsRef.current?.stopListening) {
                    vadFunctionsRef.current.stopListening().catch(console.error);
                }
            }, 30000); // 30 second timeout
        }

        // Clear timeout when listening stops
        if (!vadState.isListening && listeningTimeoutRef.current) {
            clearTimeout(listeningTimeoutRef.current);
            listeningTimeoutRef.current = null;
        }
    }, [vadState.isListening, vadState.isSpeaking]);

    // Cleanup VAD when hook unmounts or rabbit mode is disabled
    React.useEffect(() => {
        return () => {
            if (isRabbitMode && vadFunctionsRef.current?.stopListening) {
                vadFunctionsRef.current.stopListening().catch((error) => {
                    console.warn('VAD cleanup on unmount:', error);
                });
            }
        };
    }, [isRabbitMode]);

    const handleEnterRabbitMode = React.useCallback(() => {
        if (!currentQuestId || assets.length === 0) {
            console.warn('⚠️ Cannot enter rabbit mode without quest or assets');
            return;
        }

        let sessionId = useLocalStore
            .getState()
            .getActiveRabbitModeSession(currentQuestId)?.id;

        if (!sessionId) {
            const assetIds = assets.map((a) => a.id);
            const assetNames = new Map(assets.map((a) => [a.id, a.name]));

            sessionId = useLocalStore.getState().createRabbitModeSession(
                currentQuestId,
                'Quest Recording Session',
                'project-id', // TODO: Get actual project ID
                assetIds
            );

            const session = useLocalStore.getState().getRabbitModeSession(sessionId);
            if (session) {
                session.assets.forEach((asset) => {
                    asset.name = assetNames.get(asset.id) || asset.name;
                });
            }

            console.log(`🐰 Created rabbit mode session with ${assets.length} assets`);
        } else {
            console.log(`🐰 Resuming rabbit mode session with ${assets.length} assets`);
        }

        setCurrentSessionId(sessionId);
        setIsRabbitMode(true);

        const session = useLocalStore.getState().getRabbitModeSession(sessionId);
        if (session) {
            const currentAsset = session.assets.find((a) => !a.isLocked) || session.assets[0];
            if (currentAsset) {
                useLocalStore.getState().setCurrentAsset(sessionId, currentAsset.id);
                console.log(`👉 Starting with: ${currentAsset.name}`);
            }
        }
    }, [currentQuestId, assets]);

    const handleExitRabbitMode = React.useCallback(() => {
        console.log('🚪 Exiting rabbit mode');

        // Clear any listening timeout
        if (listeningTimeoutRef.current) {
            clearTimeout(listeningTimeoutRef.current);
            listeningTimeoutRef.current = null;
        }

        // Try to stop VAD gracefully, but don't crash if it's already cleaned up
        if (vadFunctionsRef.current?.stopListening) {
            vadFunctionsRef.current.stopListening().catch((error) => {
                console.warn('VAD already cleaned up:', error);
            });
        }

        setIsRabbitMode(false);
        setCurrentSessionId(null);
        setRabbitState({
            isRecording: false,
            currentAssetIndex: 0,
            pulledAssets: [],
            isHoldingCard: false,
            recordingStartTime: null,
            recordingSegments: [],
            audioRecording: null
        });
    }, []);

    const handleDeleteSegment = React.useCallback((segmentId: string) => {
        if (!currentSessionId) return;

        const session = useLocalStore.getState().getRabbitModeSession(currentSessionId);
        const currentAsset = session?.assets.find(
            (a) => a.id === session.currentAssetId
        );

        if (currentAsset) {
            useLocalStore.getState().deleteRabbitModeSegment(
                currentSessionId,
                currentAsset.id,
                segmentId
            );
        }
    }, [currentSessionId]);

    const handleReorderSegment = React.useCallback((segmentId: string, direction: 'up' | 'down') => {
        if (!currentSessionId) return;

        const session = useLocalStore.getState().getRabbitModeSession(currentSessionId);
        const currentAsset = session?.assets.find(
            (a) => a.id === session.currentAssetId
        );

        if (!currentAsset) return;

        const segments = [...currentAsset.segments];
        const segmentIndex = segments.findIndex((seg) => seg.id === segmentId);

        if (segmentIndex === -1) return;

        const newIndex = direction === 'up' ? segmentIndex - 1 : segmentIndex + 1;
        if (newIndex < 0 || newIndex >= segments.length) return;

        const segmentIds = segments.map((s) => s.id);
        const [movedId] = segmentIds.splice(segmentIndex, 1);
        if (movedId) {
            segmentIds.splice(newIndex, 0, movedId);
        }

        useLocalStore.getState().reorderRabbitModeSegments(
            currentSessionId,
            currentAsset.id,
            segmentIds
        );
    }, [currentSessionId]);

    const handleFlagSubmit = React.useCallback((flagData: { type: string; description: string }) => {
        try {
            console.log('Flag submitted:', flagData);
            Alert.alert(
                'Flag Submitted',
                'Thank you for your feedback. Our team will review this content.',
                [{ text: 'OK' }]
            );
        } catch (error) {
            console.error('Error submitting flag:', error);
            Alert.alert('Error', 'Failed to submit flag. Please try again.');
        }
    }, []);

    // Force reset VAD if things get stuck
    const handleForceReset = React.useCallback(() => {
        console.log('🔥 FORCE RESETTING VAD');

        // Clear any listening timeout
        if (listeningTimeoutRef.current) {
            clearTimeout(listeningTimeoutRef.current);
            listeningTimeoutRef.current = null;
        }

        // Reset VAD
        if (vadFunctionsRef.current?.resetVAD) {
            vadFunctionsRef.current.resetVAD();
        }

        // Reset local state
        setRabbitState((prev) => ({
            ...prev,
            isRecording: false,
            recordingStartTime: null
        }));
    }, []);

    return {
        // State
        isRabbitMode,
        showFlaggingModal,
        currentSessionId,
        rabbitState,
        vadState,

        // Actions
        setShowFlaggingModal,
        handleEnterRabbitMode,
        handleExitRabbitMode,
        handleDeleteSegment,
        handleReorderSegment,
        handleFlagSubmit,
        handleForceReset,

        // VAD functions
        vadFunctions: vadFunctionsRef.current
    };
}; 