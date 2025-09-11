import { asset, project, quest, quest_asset_link } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import {
  useAppNavigation,
  useCurrentNavigation
} from '@/hooks/useAppNavigation';
import { useAttachmentStates } from '@/hooks/useAttachmentStates';
import { useLocalization } from '@/hooks/useLocalization';
import { useRabbitModeVAD } from '@/hooks/useRabbitModeVAD';
import { useLocalStore } from '@/store/localStore';
import { colors, fontSizes, sharedStyles, spacing } from '@/styles/theme';
import { BIBLE_TEMPLATE } from '@/utils/projectTemplates';
import { RabbitModeFileManager } from '@/utils/rabbitModeFileManager';
import { generateWaveformData } from '@/utils/waveformGenerator';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { eq } from 'drizzle-orm';
import React from 'react';
import {
  Alert,
  FlatList,
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View
} from 'react-native';
import { useHybridData, useSimpleHybridInfiniteData } from './useHybridData';

// Component imports
import { LiveWaveform } from '@/components/LiveWaveform';
import { PlayableWaveform } from '@/components/PlayableWaveform';
import { ProjectListSkeleton } from '@/components/ProjectListSkeleton';
import { RabbitModeSwitch } from '@/components/RabbitModeSwitch';

// Enable LayoutAnimation on Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Asset = typeof asset.$inferSelect;

// Sine wave waveform generator for placeholders
const generateSineWaveform = (
  length = 40,
  amplitude = 0.5,
  frequency = 0.1
): number[] => {
  return Array.from({ length }, (_, i) => {
    const phase = (i / length) * Math.PI * 2 * frequency;
    return (Math.sin(phase) * amplitude + amplitude) * 0.8; // Normalize to 0-0.8 range
  });
};

// Enhanced VAD Component with adaptive baseline sampling
const VoiceActivityDetectionPanel = React.memo(() => {
  const { currentQuestId } = useCurrentNavigation();

  // Properly subscribe to local store updates using the hook pattern
  const activeSession = useLocalStore((state) =>
    currentQuestId
      ? state.rabbitModeSessions.find(
          (s) => s.questId === currentQuestId && !s.isCommitted
        )
      : undefined
  );
  const addRabbitModeSegment = useLocalStore(
    (state) => state.addRabbitModeSegment
  );

  // Recording state with proper typing
  const [isRecording, setIsRecording] = React.useState(false);
  const [isInitializing, setIsInitializing] = React.useState(false);
  const [isCalibrating, setIsCalibrating] = React.useState(false);
  const [adaptiveThreshold, setAdaptiveThreshold] = React.useState(0.7); // 0..1 normalized
  const recordingStartTimeRef = React.useRef<number | null>(null);
  const calibrationLevelsRef = React.useRef<number[]>([]);

  // Local UI VAD state that reacts to hook callbacks
  const [uiVadState, setUiVadState] = React.useState({
    isListening: false,
    isSpeaking: false,
    currentLevel: 0,
    speechDuration: 0,
    silenceDuration: 0
  });

  // Simple CSS-based animated sine wave for initialization only
  const initializationSineWave = React.useMemo(() => {
    if (!isInitializing && !isCalibrating) return undefined;
    return generateSineWaveform(40, 0.3, 1).map(
      (val, i) => val + 0.1 * Math.sin(Date.now() * 0.01 + i * 0.5)
    );
  }, [isInitializing, isCalibrating]);

  // Speech start handler (following original pattern)
  const handleSpeechStart = React.useCallback(() => {
    if (isCalibrating) return; // Don't record during calibration

    console.log('🎙️ REAL: Starting recording (speech detected)');
    const startTime = Date.now();
    setIsRecording(true);
    setIsInitializing(false);

    recordingStartTimeRef.current = startTime;
    console.log('📝 Set recording start time:', startTime);
  }, [isCalibrating]);

  // Speech end handler (following original pattern from useRabbitMode.ts)
  const handleSpeechEnd = React.useCallback(
    async (recordingUri?: string) => {
      if (isCalibrating) return; // Don't save during calibration

      console.log('🔇 REAL: Stopping recording (speech ended)');

      // Get start time from ref
      const recordingStartTime = recordingStartTimeRef.current;

      // Debug logging to understand what's failing
      console.log('🔍 Debug state:', {
        hasRecordingStartTime: !!recordingStartTime,
        hasRecordingUri: !!recordingUri,
        hasActiveSession: !!activeSession,
        currentAssetId: activeSession?.currentAssetId,
        activeSessionId: activeSession?.id,
        assetsCount: activeSession?.assets.length || 0
      });

      if (!recordingUri) {
        console.warn('❌ No recording URI provided by VAD hook');
        setIsRecording(false);
        recordingStartTimeRef.current = null;
        return;
      }

      if (!recordingStartTime) {
        console.warn('❌ Missing recording start time');
        setIsRecording(false);
        recordingStartTimeRef.current = null;
        return;
      }

      if (!activeSession?.currentAssetId) {
        console.warn('❌ No active session or current asset');
        setIsRecording(false);
        recordingStartTimeRef.current = null;
        return;
      }

      try {
        const endTime = Date.now();
        const duration = endTime - recordingStartTime;

        // Generate waveform from actual recording (like original)
        const waveformData = await generateWaveformData(recordingUri);

        // Save using proper file manager (following original patterns)
        const permanentUri = await RabbitModeFileManager.saveAudioSegment(
          activeSession.id,
          recordingUri
        );
        console.log('💾 Saved to permanent location:', permanentUri);

        // Create new segment with proper file path
        const newSegment = {
          assetId: activeSession.currentAssetId,
          startTime: recordingStartTime,
          endTime: endTime,
          duration: duration,
          audioUri: permanentUri, // Use permanent URI from file manager
          waveformData: waveformData // Real waveform from actual audio
        };

        console.log('🎯 About to add segment:', newSegment);

        // Add segment to local store with smooth animation
        LayoutAnimation.configureNext({
          duration: 400,
          create: {
            type: LayoutAnimation.Types.easeInEaseOut,
            property: LayoutAnimation.Properties.opacity
          },
          update: {
            type: LayoutAnimation.Types.spring,
            springDamping: 0.8
          }
        });

        addRabbitModeSegment(
          activeSession.id,
          activeSession.currentAssetId,
          newSegment
        );
        console.log(`✨ Added new segment: ${duration}ms duration`);
      } catch (error) {
        console.error('❌ Error saving audio segment:', error);
      }

      setIsRecording(false);
      recordingStartTimeRef.current = null;
    },
    [currentQuestId, activeSession, addRabbitModeSegment, isCalibrating]
  );

  // Use RabbitModeVAD with dynamic threshold
  const {
    startListening,
    stopListening,
    resetVAD: _resetVAD
  } = useRabbitModeVAD(
    {
      onSpeechStart: handleSpeechStart,
      onSpeechEnd: (recordingUri?: string) => {
        void handleSpeechEnd(recordingUri);
      },
      onLevelChange: (level: number) => {
        // Collect calibration data
        if (isCalibrating) {
          calibrationLevelsRef.current.push(level);
        }

        // Minimal logging for level debugging (only when listening and not calibrating)
        if (uiVadState.isListening && !isCalibrating && Math.random() < 0.05) {
          // Reduced to 5%
          console.log(
            `🎵 Level(n): ${level.toFixed(3)} thr=${adaptiveThreshold.toFixed(3)} speaking=${uiVadState.isSpeaking}`
          );
        }
      },
      onStateChange: (state) => {
        setUiVadState({
          isListening: state.isListening,
          isSpeaking: state.isSpeaking,
          currentLevel: state.currentLevel,
          speechDuration: state.speechDuration,
          silenceDuration: state.silenceDuration
        });
        // Minimal log
        if (!isCalibrating && Math.random() < 0.02) {
          console.log(
            `🎯 VAD: listening=${state.isListening}, speaking=${state.isSpeaking}`
          );
        }
      }
    },
    {
      saveRecordings: true,
      speechThreshold: adaptiveThreshold, // Use dynamic threshold
      minimumSpeechDuration: 200,
      maximumSilenceDuration: 1000,
      sampleInterval: 80
    }
  );

  // Determine what waveform data to show
  const displayWaveformData = React.useMemo(() => {
    if (!uiVadState.isListening) return undefined;
    if (isInitializing || isCalibrating) return initializationSineWave;
    return undefined;
  }, [
    uiVadState.isListening,
    isInitializing,
    isCalibrating,
    initializationSineWave
  ]);

  // Adaptive calibration process
  const performCalibration = React.useCallback(async () => {
    console.log('🎯 Starting adaptive baseline calibration...');
    setIsCalibrating(true);
    calibrationLevelsRef.current = [];

    // Calibrate for 2 seconds of ambient noise
    await new Promise((resolve) => setTimeout(resolve, 2000));

    if (calibrationLevelsRef.current.length > 0) {
      // Calculate adaptive threshold
      const maxLevel = Math.max(...calibrationLevelsRef.current);
      const avgLevel =
        calibrationLevelsRef.current.reduce((a, b) => a + b, 0) /
        calibrationLevelsRef.current.length;
      // Place threshold above ambient but not too close to 1.0
      const margin = 0.12;
      const newThreshold = Math.min(
        0.95,
        Math.max(0.05, Math.max(maxLevel + margin, avgLevel + margin * 1.5))
      );

      setAdaptiveThreshold(newThreshold);

      console.log(
        `🎯 Calibration complete! Background: avg=${avgLevel.toFixed(3)}, max=${maxLevel.toFixed(3)} → Threshold: ${newThreshold.toFixed(3)}`
      );
    } else {
      console.log('🎯 Calibration failed, using fallback threshold: 0.6');
      setAdaptiveThreshold(0.6);
    }

    setIsCalibrating(false);
  }, []);

  // Enhanced VAD handlers with calibration
  const handleStartListening = React.useCallback(async () => {
    try {
      setIsInitializing(true);
      await startListening();
      console.log('🎧 Started listening for voice activity');

      // Perform adaptive calibration first
      await performCalibration();

      setIsInitializing(false);
      console.log('✅ Ready for voice detection with adaptive threshold');
    } catch (error) {
      console.error('❌ Error starting VAD:', error);
      setIsInitializing(false);
      setIsCalibrating(false);
    }
  }, [startListening, performCalibration]);

  const handleStopListening = React.useCallback(async () => {
    try {
      await stopListening();
      console.log('🔇 Stopped listening for voice activity');

      // Clean up any ongoing recording
      if (isRecording) {
        setIsRecording(false);
        recordingStartTimeRef.current = null;
      }
      setIsInitializing(false);
      setIsCalibrating(false);
    } catch (error) {
      console.error('❌ Error stopping VAD:', error);
    }
  }, [stopListening, isRecording]);

  return (
    <View style={styles.vadContainer}>
      <LiveWaveform
        isListening={uiVadState.isListening}
        isRecording={isRecording}
        isSpeaking={uiVadState.isSpeaking}
        currentLevel={displayWaveformData ? 0 : uiVadState.currentLevel}
        waveformData={displayWaveformData}
        onStartListening={handleStartListening}
        onStopListening={handleStopListening}
        style={styles.liveWaveform}
      />
      <View style={{ alignItems: 'center', marginTop: 6 }}>
        {isCalibrating ? (
          <Text style={styles.calibrationText}>
            🎯 Calibrating background noise…
          </Text>
        ) : (
          <Text style={styles.calibrationText}>
            Sensitivity: {(1 - adaptiveThreshold).toFixed(2)} (tap to adjust)
          </Text>
        )}
      </View>

      {/* Sensitivity controls: quick presets and fine tuning */}
      {!isCalibrating && (
        <View style={styles.sensitivityRow}>
          <Text style={styles.sensitivityLabel}>Sensitivity</Text>
          <View style={styles.sensitivityButtons}>
            <Text
              style={[
                styles.sensitivityPill,
                adaptiveThreshold <= 0.45
                  ? styles.sensitivityPillActive
                  : undefined
              ]}
              onPress={() => setAdaptiveThreshold(0.45)}
            >
              High
            </Text>
            <Text
              style={[
                styles.sensitivityPill,
                adaptiveThreshold > 0.45 && adaptiveThreshold < 0.7
                  ? styles.sensitivityPillActive
                  : undefined
              ]}
              onPress={() => setAdaptiveThreshold(0.6)}
            >
              Normal
            </Text>
            <Text
              style={[
                styles.sensitivityPill,
                adaptiveThreshold >= 0.7
                  ? styles.sensitivityPillActive
                  : undefined
              ]}
              onPress={() => setAdaptiveThreshold(0.75)}
            >
              Low
            </Text>
          </View>
          <Text
            style={styles.recalibrateLink}
            onPress={() => {
              void performCalibration();
            }}
          >
            Recalibrate
          </Text>
        </View>
      )}
    </View>
  );
});

export default function SimpleAssetsView() {
  const {
    currentQuestId,
    currentProjectId,
    currentQuest: navQuest
  } = useCurrentNavigation();
  const { t } = useLocalization();

  // Fetch current quest and project to support virtual assets from templates
  const { data: questData } = useHybridData<typeof quest.$inferSelect>({
    dataType: 'quest',
    queryKeyParams: [currentQuestId || ''],
    offlineQuery: toCompilableQuery(
      system.db.query.quest.findMany({
        where: eq(quest.id, currentQuestId || ''),
        limit: 1
      })
    ),
    enableCloudQuery: false
  });
  const currentQuest = questData[0];

  const { data: projectData } = useHybridData<typeof project.$inferSelect>({
    dataType: 'project',
    queryKeyParams: [currentProjectId || ''],
    offlineQuery: toCompilableQuery(
      system.db.query.project.findMany({
        where: eq(project.id, currentProjectId || ''),
        limit: 1
      })
    ),
    enableCloudQuery: false
  });
  const currentProject = projectData[0];

  // Properly subscribe to local store updates using the hook
  const activeSession = useLocalStore((state) =>
    currentQuestId
      ? state.rabbitModeSessions.find(
          (s) => s.questId === currentQuestId && !s.isCommitted
        )
      : undefined
  );
  const setCurrentAsset = useLocalStore((state) => state.setCurrentAsset);
  const addMilestone = useLocalStore((state) => state.addRabbitModeMilestone);
  const moveItem = useLocalStore((state) => state.moveRabbitModeItem);
  const deleteItem = useLocalStore((state) => state.deleteRabbitModeItem);
  const createRabbitModeSession = useLocalStore(
    (state) => state.createRabbitModeSession
  );
  const deleteRabbitModeSession = useLocalStore(
    (state) => state.deleteRabbitModeSession
  );
  const currentAssetId = activeSession?.currentAssetId;

  // Rabbit mode state
  const isRabbitMode = !!activeSession;
  const [isEditMode, setIsEditMode] = React.useState(false);

  // Pre-fetch ALL assets for this quest (not paginated)
  const isBibleTemplate = !!currentProject?.templates?.includes(
    'every-language-bible'
  );
  const questNameKey =
    navQuest?.name || (currentQuest ? currentQuest.name : '');

  const { data: allAssetsData, isLoading } = useSimpleHybridInfiniteData<Asset>(
    'assets-complete',
    [currentQuestId || '', isBibleTemplate ? 'bible' : 'none', questNameKey],
    async () => {
      if (!currentQuestId) return [];

      try {
        let assets = await system.db
          .select({
            id: asset.id,
            name: asset.name,
            source_language_id: asset.source_language_id,
            images: asset.images,
            creator_id: asset.creator_id,
            visible: asset.visible,
            active: asset.active,
            created_at: asset.created_at,
            last_updated: asset.last_updated,
            download_profiles: asset.download_profiles
          })
          .from(asset)
          .innerJoin(quest_asset_link, eq(asset.id, quest_asset_link.asset_id))
          .where(eq(quest_asset_link.quest_id, currentQuestId));

        // Inject virtual assets for templated projects (e.g., Bible) based on quest name
        const questName = currentQuest?.name || navQuest?.name;
        if (isBibleTemplate && questName && currentProject) {
          const questIdForTemplate =
            currentQuest?.id || navQuest?.id || `virtual_${questName}`;
          console.log('[ASSETS] Virtual injection conditions:', {
            isBibleTemplate,
            questName,
            currentQuestLoaded: !!currentQuest,
            navQuestLoaded: !!navQuest
          });
          const virtualTemplates = BIBLE_TEMPLATE.createAssets(
            currentProject.source_language_id,
            questIdForTemplate,
            questName
          );

          const virtualAssets: Asset[] = virtualTemplates.map((tpl) => ({
            // Use stable virtual IDs by name
            id: `virtual_${tpl.name}`,
            name: tpl.name,
            source_language_id: tpl.source_language_id,
            images: tpl.images ?? null,
            creator_id: currentProject.creator_id || null,
            visible: tpl.visible ?? true,
            active: true,
            created_at: new Date().toISOString(),
            last_updated: new Date().toISOString(),
            download_profiles: []
          })) as unknown as Asset[];
          console.log('🔍 Virtual assets count:', virtualAssets.length);

          // Deduplicate by name; prefer real assets over virtual
          const byName = new Map<string, Asset>();
          for (const a of assets as Asset[]) byName.set(a.name, a);
          for (const v of virtualAssets)
            if (!byName.has(v.name)) byName.set(v.name, v);

          assets = Array.from(byName.values());
        }

        // Natural sort by name
        (assets as Asset[]).sort((a, b) =>
          a.name.localeCompare(b.name, undefined, {
            numeric: true,
            sensitivity: 'base'
          })
        );

        return assets as Asset[];
      } catch (error) {
        console.error('[ASSETS] Pre-fetch error:', error);
        return [];
      }
    },
    async () => Promise.resolve([] as Asset[]),
    1000
  );

  // Simple, clean data structure
  const assets = React.useMemo(() => {
    const allAssets = allAssetsData.pages.flatMap((page) => page.data);
    const validAssets = allAssets.filter((asset) => asset.id && asset.name);

    // Sort assets once
    return validAssets.sort((a, b) => {
      return a.name.localeCompare(b.name, undefined, {
        numeric: true,
        sensitivity: 'base'
      });
    });
  }, [allAssetsData.pages]);

  // Build item list from session.items (milestones + segments)
  interface SegmentRow {
    id: string;
    startTime: number;
    endTime: number;
    duration: number;
    audioUri: string;
    waveformData?: number[];
  }
  type RowItem =
    | { kind: 'milestone'; id: string; label?: string; assetId?: string }
    | { kind: 'segment'; id: string; segment: SegmentRow };

  const listData: RowItem[] = React.useMemo(() => {
    if (!activeSession?.items) return [];
    return activeSession.items.map((it) =>
      it.kind === 'milestone'
        ? { kind: 'milestone', id: it.id, label: it.label, assetId: it.assetId }
        : {
            kind: 'segment',
            id: it.id,
            segment: {
              id: it.id,
              startTime: it.startTime,
              endTime: it.endTime,
              duration: it.duration,
              audioUri: it.audioUri,
              waveformData: it.waveformData
            }
          }
    );
  }, [activeSession?.items, activeSession?.last_updated]);

  // Track consumed and remaining assets for structured flows
  const consumedAssetIds = React.useMemo(() => {
    const set = new Set<string>();
    if (activeSession?.items) {
      for (const it of activeSession.items) {
        if (it.kind === 'milestone' && it.assetId) set.add(it.assetId);
      }
    }
    return set;
  }, [activeSession?.items]);

  const remainingAssets = React.useMemo(() => {
    return assets.filter((a) => !consumedAssetIds.has(a.id));
  }, [assets, consumedAssetIds]);

  // Watch attachment states
  const assetIds = React.useMemo(
    () => assets.map((asset) => asset.id),
    [assets.length]
  );
  const { attachmentStates } = useAttachmentStates(assetIds);

  // Handlers for milestone-based model
  const handlePlus = React.useCallback(() => {
    if (!activeSession) return;
    if (activeSession.mode === 'structured') {
      // Advance to next remaining asset (skip already consumed)
      const idx = assets.findIndex(
        (a) => a.id === activeSession.currentAssetId
      );
      const nextAsset =
        assets
          .slice(Math.max(idx + 1, 0))
          .find((a) => !consumedAssetIds.has(a.id)) || remainingAssets[0];
      if (!nextAsset) return;
      addMilestone(activeSession.id, {
        assetId: nextAsset.id,
        label: nextAsset.name || undefined
      });
      setCurrentAsset(activeSession.id, nextAsset.id);
    } else {
      // Unstructured: add auto-numbered milestone
      addMilestone(activeSession.id);
    }
  }, [
    activeSession?.id,
    activeSession?.mode,
    activeSession?.currentAssetId,
    assets,
    consumedAssetIds,
    remainingAssets
  ]);

  // Handlers
  const handleDeleteSegment = React.useCallback(
    (segmentId: string) => {
      if (!activeSession?.id || !currentAssetId) return;
      Alert.alert(
        'Delete recording',
        'Are you sure you want to delete this recording?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              const deleteSegment =
                useLocalStore.getState().deleteRabbitModeSegment;
              deleteSegment(activeSession.id, currentAssetId, segmentId);
            }
          }
        ]
      );
    },
    [activeSession?.id, currentAssetId]
  );

  const handleReorderItem = React.useCallback(
    (itemId: string, direction: 'up' | 'down') => {
      if (!activeSession) return;
      moveItem(activeSession.id, itemId, direction);
    },
    [activeSession?.id]
  );

  const { goToAsset } = useAppNavigation();
  const handleAssetPress = React.useCallback(
    (asset: Asset) => {
      if (activeSession) {
        // Rabbit Mode on: change current session asset only
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setCurrentAsset(activeSession.id, asset.id);
        console.log('🎯 Set current asset to:', asset.name);
      } else {
        // Rabbit Mode off: navigate to asset detail
        goToAsset({
          id: asset.id,
          name: asset.name,
          projectId: currentProject?.id,
          questId: currentQuestId || undefined
        });
      }
    },
    [
      activeSession,
      setCurrentAsset,
      goToAsset,
      currentProject?.id,
      currentQuestId
    ]
  );

  // Rabbit mode toggle handlers
  const handleEnterRabbitMode = React.useCallback(() => {
    if (!currentQuestId || !assets.length) return;

    const assetIds = assets.map((asset) => asset.id);
    const sessionId = createRabbitModeSession(
      currentQuestId,
      'Recording Session', // Quest name
      'project-id', // TODO: Get actual project ID
      assetIds
    );

    console.log('🐰 Entered Rabbit Mode:', sessionId);
  }, [currentQuestId, assets, createRabbitModeSession]);

  const handleExitRabbitMode = React.useCallback(() => {
    if (activeSession) {
      deleteRabbitModeSession(activeSession.id);
      console.log('🚪 Exited Rabbit Mode');
    }
  }, [activeSession, deleteRabbitModeSession]);

  if (isLoading) {
    return <ProjectListSkeleton />;
  }

  if (!currentQuestId) {
    return (
      <View style={sharedStyles.container}>
        <Text style={sharedStyles.title}>{t('noQuestSelected')}</Text>
      </View>
    );
  }

  return (
    <View style={sharedStyles.container}>
      <View style={styles.headerContainer}>
        <Text style={[sharedStyles.title, styles.title]}>{t('assets')}</Text>
        <View style={styles.headerControls}>
          <RabbitModeSwitch
            value={isRabbitMode}
            onToggle={() => {
              if (isRabbitMode) {
                handleExitRabbitMode();
                setIsEditMode(false);
              } else {
                handleEnterRabbitMode();
              }
            }}
            disabled={assets.length === 0}
          />
          {isRabbitMode && (
            <TouchableOpacity
              onPress={() => setIsEditMode((v) => !v)}
              style={[
                styles.editToggle,
                isEditMode ? styles.editToggleActive : undefined
              ]}
              accessibilityRole="button"
              accessibilityLabel={
                isEditMode ? 'Exit edit mode' : 'Enter edit mode'
              }
            >
              <Text
                style={[
                  styles.editToggleText,
                  isEditMode ? styles.editToggleTextActive : undefined
                ]}
              >
                {isEditMode ? 'Done' : 'Edit'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Voice Activity Detection Interface - only when Rabbit Mode is ON */}
      {isRabbitMode && <VoiceActivityDetectionPanel />}

      {/* Cursor row: shows current insertion point and + button */}
      {isRabbitMode && (
        <View style={styles.cursorRow}>
          <View style={styles.cursorInfo}>
            <Text style={styles.cursorLabel}>Current</Text>
            <View style={styles.cursorPill}>
              <Text style={styles.cursorPillText}>
                {activeSession?.mode === 'structured'
                  ? assets.find((a) => a.id === activeSession?.currentAssetId)
                      ?.name || '—'
                  : `#${activeSession?.nextAutoNumber ?? 1}`}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.plusButton} onPress={handlePlus}>
            <Text style={styles.plusButtonText}>＋</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={
          isRabbitMode
            ? listData
            : assets.map(
                (a) =>
                  ({
                    kind: 'milestone',
                    id: a.id,
                    label: a.name,
                    assetId: a.id
                  }) as const
              )
        }
        keyExtractor={(item) => `${item.kind}:${item.id}`}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          if (item.kind === 'milestone') {
            const label =
              item.label ||
              (item.assetId
                ? assets.find((a) => a.id === item.assetId)?.name
                : undefined) ||
              'Milestone';
            return (
              <View style={[styles.milestoneRow, styles.centerRow]}>
                <View style={styles.milestonePill}>
                  <Text style={styles.milestoneText}>{label}</Text>
                </View>
                {isEditMode && (
                  <View style={styles.segmentRowControls}>
                    <TouchableOpacity
                      style={styles.controlButton}
                      onPress={() => handleReorderItem(item.id, 'up')}
                    >
                      <Text style={styles.controlButtonText}>↑</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.controlButton}
                      onPress={() => handleReorderItem(item.id, 'down')}
                    >
                      <Text style={styles.controlButtonText}>↓</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => {
                        if (!activeSession) return;
                        deleteItem(activeSession.id, item.id);
                      }}
                    >
                      <Text style={styles.deleteButtonText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          }

          const { segment } = item;
          return (
            <View style={[styles.segmentRow, styles.centerRow]}>
              <View style={styles.segmentRowContent}>
                <PlayableWaveform
                  audioUri={segment.audioUri}
                  waveformData={segment.waveformData}
                  duration={segment.duration}
                  style={styles.segmentWaveform}
                />
              </View>
              {isEditMode && (
                <View style={styles.segmentRowControls}>
                  <TouchableOpacity
                    style={styles.controlButton}
                    onPress={() => handleReorderItem(item.id, 'up')}
                  >
                    <Text style={styles.controlButtonText}>↑</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.controlButton}
                    onPress={() => handleReorderItem(item.id, 'down')}
                  >
                    <Text style={styles.controlButtonText}>↓</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => {
                      if (!activeSession) return;
                      deleteItem(activeSession.id, item.id);
                    }}
                  >
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          isRabbitMode ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                No items yet. Use ＋ to add a marker.
              </Text>
            </View>
          ) : assets.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                No assets found for this quest.
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          isRabbitMode && activeSession?.mode === 'structured' ? (
            <View style={styles.assetPickerContainer}>
              <Text style={styles.assetPickerLabel}>Next asset</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {remainingAssets.map((a) => (
                  <TouchableOpacity
                    key={a.id}
                    style={styles.assetIdPill}
                    onPress={() => {
                      if (!activeSession) return;
                      const idx = remainingAssets.findIndex(
                        (x) => x.id === a.id
                      );
                      const toConsume =
                        idx >= 0 ? remainingAssets.slice(0, idx + 1) : [a];
                      for (const assetToAdd of toConsume) {
                        addMilestone(activeSession.id, {
                          assetId: assetToAdd.id,
                          label: assetToAdd.name || undefined
                        });
                      }
                      setCurrentAsset(activeSession.id, a.id);
                    }}
                  >
                    <Text style={styles.assetIdText}>
                      {a.name || a.id.substring(0, 8)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ) : assets.length > 0 && !activeSession ? (
            <View style={styles.noSessionContainer}>
              <Text style={styles.noSessionText}>
                Toggle Rabbit Mode above to start recording sessions.
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.medium,
    paddingHorizontal: spacing.medium
  },
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small
  },
  title: {
    paddingHorizontal: 0, // Remove padding since it's in headerContainer now
    marginBottom: 0
  },
  scrollView: {
    flex: 1
  },
  listContent: {
    paddingBottom: spacing.large
  },
  assetContainer: {
    marginBottom: spacing.small,
    paddingHorizontal: spacing.medium
  },
  assetIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.medium,
    marginBottom: spacing.xsmall
  },
  assetIdPill: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.inputBackground,
    borderRadius: 999,
    paddingHorizontal: spacing.medium,
    paddingVertical: 8
  },
  assetIdPillActive: {
    backgroundColor: colors.primary
  },
  assetIdText: {
    color: colors.text,
    fontSize: fontSizes.small,
    fontWeight: '600'
  },
  assetIdTextActive: {
    color: colors.background
  },
  assetIdControls: {
    flexDirection: 'row',
    gap: spacing.xsmall
  },
  assetControlButton: {
    paddingHorizontal: spacing.xsmall,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.inputBorder
  },
  segmentsAccordion: {
    marginTop: spacing.small,
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    paddingVertical: spacing.small,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary
  },
  currentIndicator: {
    marginTop: spacing.xsmall,
    alignSelf: 'flex-start'
  },
  currentIndicatorText: {
    fontSize: fontSizes.small,
    color: colors.primary,
    fontWeight: '600'
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xlarge
  },
  emptyText: {
    fontSize: fontSizes.medium,
    color: colors.textSecondary,
    textAlign: 'center'
  },
  noSessionContainer: {
    marginTop: spacing.large,
    paddingHorizontal: spacing.medium
  },
  noSessionText: {
    fontSize: fontSizes.small,
    color: colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic'
  },
  assetPickerContainer: {
    marginTop: spacing.medium,
    paddingHorizontal: spacing.medium,
    gap: spacing.xsmall
  },
  assetPickerLabel: {
    color: colors.textSecondary,
    fontSize: fontSizes.small,
    marginBottom: spacing.xsmall
  },
  vadContainer: {
    marginBottom: spacing.medium,
    paddingHorizontal: spacing.medium
  },
  liveWaveform: {
    // Let the control define its own size and look; keep layout simple
    alignSelf: 'center',
    paddingVertical: spacing.small
  },
  calibrationText: {
    marginTop: spacing.small,
    fontSize: fontSizes.small,
    color: colors.textSecondary,
    textAlign: 'center'
  },
  sensitivityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.medium,
    marginTop: spacing.xsmall
  },
  sensitivityLabel: {
    fontSize: fontSizes.small,
    color: colors.textSecondary
  },
  sensitivityButtons: {
    flexDirection: 'row',
    gap: spacing.xsmall
  },
  sensitivityPill: {
    paddingHorizontal: spacing.small,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.inputBackground,
    color: colors.text,
    overflow: 'hidden'
  },
  sensitivityPillActive: {
    backgroundColor: colors.primary,
    color: colors.background
  },
  recalibrateLink: {
    color: colors.primary,
    fontSize: fontSizes.small,
    textDecorationLine: 'underline'
  },
  editToggle: {
    marginLeft: spacing.small,
    paddingHorizontal: spacing.small,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.inputBorder
  },
  editToggleActive: {
    backgroundColor: colors.primary
  },
  editToggleText: {
    color: colors.text,
    fontSize: fontSizes.small,
    fontWeight: '600'
  },
  editToggleTextActive: {
    color: colors.background
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.medium,
    marginBottom: spacing.xsmall,
    gap: spacing.small
  },
  milestonePill: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.inputBackground,
    borderRadius: 999,
    paddingHorizontal: spacing.medium,
    paddingVertical: 6
  },
  milestoneText: {
    color: colors.text,
    fontSize: fontSizes.small,
    fontWeight: '600'
  },
  centerRow: {
    justifyContent: 'center'
  },
  cursorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.medium,
    marginBottom: spacing.small
  },
  cursorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small
  },
  cursorLabel: {
    color: colors.textSecondary,
    fontSize: fontSizes.small
  },
  cursorPill: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.inputBackground,
    borderRadius: 999,
    paddingHorizontal: spacing.medium,
    paddingVertical: 6
  },
  cursorPillText: {
    color: colors.text,
    fontSize: fontSizes.small,
    fontWeight: '600'
  },
  plusButton: {
    borderRadius: 16,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.medium,
    paddingVertical: 6
  },
  plusButtonText: {
    color: colors.background,
    fontSize: fontSizes.medium,
    fontWeight: '700'
  },
  segmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.medium,
    marginBottom: spacing.xsmall,
    gap: spacing.small
  },
  segmentRowContent: {
    flex: 1
  },
  segmentRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xsmall
  },
  segmentRowNumber: {
    fontSize: fontSizes.small,
    fontWeight: '600',
    color: colors.primary
  },
  segmentRowDuration: {
    fontSize: fontSizes.small,
    color: colors.textSecondary
  },
  segmentWaveform: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 0
  },
  segmentRowControls: {
    alignItems: 'center',
    gap: spacing.xsmall
  },
  controlButton: {
    paddingHorizontal: spacing.xsmall,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.inputBorder
  },
  controlButtonDisabled: {
    opacity: 0.3
  },
  controlButtonText: {
    color: colors.text,
    fontSize: fontSizes.small,
    fontWeight: '600'
  },
  deleteButton: {
    paddingHorizontal: spacing.xsmall,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.inputBorder
  },
  deleteButtonText: {
    color: colors.error,
    fontSize: fontSizes.small,
    fontWeight: '600'
  }
});
