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
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View
} from 'react-native';
import { useHybridData, useSimpleHybridInfiniteData } from './useHybridData';

// Component imports
import { LiveWaveform } from '@/components/LiveWaveform';
import { ProjectListSkeleton } from '@/components/ProjectListSkeleton';
import { RabbitModeSegmentDisplay } from '@/components/RabbitModeSegmentDisplay';
import { RabbitModeSwitch } from '@/components/RabbitModeSwitch';
import { AssetListItem } from './AssetListItem';

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
  const [adaptiveThreshold, setAdaptiveThreshold] = React.useState(0.7); // Will be updated by calibration
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
            `🎵 Level: ${level.toFixed(3)}, Speaking: ${uiVadState.isSpeaking}, Threshold: ${adaptiveThreshold.toFixed(3)}`
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

    // Calibrate for 3 seconds
    await new Promise((resolve) => setTimeout(resolve, 3000));

    if (calibrationLevelsRef.current.length > 0) {
      // Calculate adaptive threshold
      const maxLevel = Math.max(...calibrationLevelsRef.current);
      const avgLevel =
        calibrationLevelsRef.current.reduce((a, b) => a + b, 0) /
        calibrationLevelsRef.current.length;
      const adaptiveMargin = 0.15; // Standard margin
      const newThreshold = Math.max(
        maxLevel + adaptiveMargin,
        avgLevel + adaptiveMargin * 2
      );

      setAdaptiveThreshold(Math.min(newThreshold, 0.9)); // Cap at 0.9 to avoid impossible thresholds

      console.log(
        `🎯 Calibration complete! Background: avg=${avgLevel.toFixed(3)}, max=${maxLevel.toFixed(3)} → Threshold: ${newThreshold.toFixed(3)}`
      );
    } else {
      console.log('🎯 Calibration failed, using fallback threshold: 0.7');
      // Use a sane fallback that matches the log statement
      setAdaptiveThreshold(0.7);
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
      {isCalibrating && (
        <Text style={styles.calibrationText}>
          🎯 Calibrating background noise...
        </Text>
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
  const createRabbitModeSession = useLocalStore(
    (state) => state.createRabbitModeSession
  );
  const deleteRabbitModeSession = useLocalStore(
    (state) => state.deleteRabbitModeSession
  );
  const currentAssetId = activeSession?.currentAssetId;

  // Rabbit mode state
  const isRabbitMode = !!activeSession;

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
          for (const a of assets as Asset[]) byName.set(a.name, a as Asset);
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

  // Get segments for current asset - now properly subscribing to store updates
  const currentAssetSegments = React.useMemo(() => {
    if (!activeSession?.assets || !currentAssetId) return [];

    const currentRabbitAsset = activeSession.assets.find(
      (a) => a.id === currentAssetId
    );
    if (!currentRabbitAsset?.segments) return [];

    return currentRabbitAsset.segments.map((seg) => ({
      id: seg.id,
      startTime: seg.startTime,
      endTime: seg.endTime,
      duration: seg.duration,
      audioUri: seg.audioUri,
      waveformData: seg.waveformData,
      order: seg.order
    }));
  }, [activeSession?.assets, currentAssetId, activeSession?.last_updated]); // Include last_updated to trigger on changes

  // Watch attachment states
  const assetIds = React.useMemo(
    () => assets.map((asset) => asset.id),
    [assets.length]
  );
  const { attachmentStates } = useAttachmentStates(assetIds);

  // Handlers
  const handleDeleteSegment = React.useCallback((segmentId: string) => {
    console.log('Mock: Delete segment', segmentId);
  }, []);

  const handleReorderSegment = React.useCallback(
    (segmentId: string, direction: 'up' | 'down') => {
      console.log('Mock: Reorder segment', segmentId, direction);
    },
    []
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

        <RabbitModeSwitch
          value={isRabbitMode}
          onToggle={() => {
            if (isRabbitMode) {
              handleExitRabbitMode();
            } else {
              handleEnterRabbitMode();
            }
          }}
          disabled={assets.length === 0}
        />
      </View>

      {/* Voice Activity Detection Interface - only when Rabbit Mode is ON */}
      {isRabbitMode && <VoiceActivityDetectionPanel />}

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {assets.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              No assets found for this quest.
            </Text>
          </View>
        )}

        {/* All Assets in Natural Order */}
        {assets.map((asset) => {
          const isCurrentAsset = asset.id === currentAssetId;

          return (
            <View key={asset.id} style={styles.assetContainer}>
              {/* Asset Item */}
              <AssetListItem
                asset={asset}
                attachmentState={attachmentStates.get(asset.id)}
                onPress={handleAssetPress}
              />

              {/* Segments Accordion - Expands In Place */}
              {isCurrentAsset && currentAssetSegments.length > 0 && (
                <View style={styles.segmentsAccordion}>
                  <RabbitModeSegmentDisplay
                    segments={currentAssetSegments}
                    onDeleteSegment={handleDeleteSegment}
                    onReorderSegment={handleReorderSegment}
                    readOnly={false}
                  />
                </View>
              )}

              {/* Current Asset Indicator */}
              {isCurrentAsset && (
                <View style={styles.currentIndicator}>
                  <Text style={styles.currentIndicatorText}>📍 Current</Text>
                </View>
              )}
            </View>
          );
        })}

        {assets.length > 0 && !activeSession && (
          <View style={styles.noSessionContainer}>
            <Text style={styles.noSessionText}>
              Toggle Rabbit Mode above to start recording sessions.
            </Text>
          </View>
        )}
      </ScrollView>
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
  title: {
    paddingHorizontal: 0, // Remove padding since it's in headerContainer now
    marginBottom: 0
  },
  scrollView: {
    flex: 1
  },
  assetContainer: {
    marginBottom: spacing.small,
    paddingHorizontal: spacing.medium
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
  }
});
