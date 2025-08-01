import { asset, quest_asset_link } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useCurrentNavigation } from '@/hooks/useAppNavigation';
import { useAttachmentStates } from '@/hooks/useAttachmentStates';
import { useLocalization } from '@/hooks/useLocalization';
import { useSimpleVAD } from '@/hooks/useVoiceActivityDetection';
import { useLocalStore } from '@/store/localStore';
import { colors, fontSizes, sharedStyles, spacing } from '@/styles/theme';
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
import { useSimpleHybridInfiniteData } from './useHybridData';

// Component imports
import { LiveWaveform } from '@/components/LiveWaveform';
import { ProjectListSkeleton } from '@/components/ProjectListSkeleton';
import { RabbitModeSegmentDisplay } from '@/components/RabbitModeSegmentDisplay';
import { AssetListItem } from './AssetListItem';

// Enable LayoutAnimation on Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Asset = typeof asset.$inferSelect;

// Isolated VAD Component to prevent render loops
const VoiceActivityDetectionPanel = React.memo(() => {
  // Voice Activity Detection with mock recording - ISOLATED
  const {
    startListening,
    stopListening,
    isListening,
    isSpeaking,
    currentLevel
  } = useSimpleVAD(
    // Mock onSpeechStart - would start recording here
    () => {
      console.log('🎙️ MOCK: Would start recording now (speech detected)');
      // TODO: In real implementation, start recording audio segment
    },
    // Mock onSpeechEnd - would stop recording here
    () => {
      console.log('🔇 MOCK: Would stop recording now (speech ended)');
      // TODO: In real implementation, stop recording and save audio segment
    },
    {
      sensitive: true, // More sensitive detection for better demo
      fastResponse: true // Faster response for better UX
    }
  );

  // Mock recording state for LiveWaveform (isSpeaking = would be recording)
  const isRecording = isSpeaking;

  // Safe VAD handlers with error handling
  const handleStartListening = React.useCallback(async () => {
    try {
      await startListening();
      console.log('🎧 Started listening for voice activity');
    } catch (error) {
      console.error('❌ Error starting VAD:', error);
    }
  }, [startListening]);

  const handleStopListening = React.useCallback(async () => {
    try {
      await stopListening();
      console.log('🔇 Stopped listening for voice activity');
    } catch (error) {
      console.error('❌ Error stopping VAD:', error);
    }
  }, [stopListening]);

  return (
    <View style={styles.vadContainer}>
      <LiveWaveform
        isListening={isListening}
        isRecording={isRecording}
        currentLevel={currentLevel}
        onStartListening={handleStartListening}
        onStopListening={handleStopListening}
        style={styles.liveWaveform}
      />
    </View>
  );
});

export default function SimpleAssetsView() {
  const { currentQuestId } = useCurrentNavigation();
  const { t } = useLocalization();

  // Get active rabbit mode session from local store
  const { getActiveRabbitModeSession, setCurrentAsset } = useLocalStore();
  const activeSession = currentQuestId
    ? getActiveRabbitModeSession(currentQuestId)
    : undefined;

  // Stable references for useMemo dependencies
  const currentAssetId = activeSession?.currentAssetId;
  const sessionAssets = React.useMemo(
    () => activeSession?.assets || [],
    [activeSession?.id, activeSession ? activeSession.assets.length : 0]
  );

  // Pre-fetch ALL assets for this quest (not paginated)
  const { data: allAssetsData, isLoading } = useSimpleHybridInfiniteData<Asset>(
    'assets-complete',
    [currentQuestId || ''],
    async () => {
      if (!currentQuestId) return [];

      try {
        const assets = await system.db
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

  // Get segments for current asset
  const currentAssetSegments = React.useMemo(() => {
    const currentRabbitAsset = activeSession?.assets?.find(
      (a) => a.id === currentAssetId
    );
    return (
      currentRabbitAsset?.segments?.map((seg) => ({
        id: seg.id,
        startTime: seg.startTime,
        endTime: seg.endTime,
        duration: seg.duration,
        audioUri: seg.audioUri,
        waveformData: seg.waveformData,
        order: seg.order
      })) || []
    );
  }, [currentAssetId, sessionAssets.length]);

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

  const handleAssetPress = React.useCallback(
    (asset: Asset) => {
      if (activeSession) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setCurrentAsset(activeSession.id, asset.id);
        console.log('🎯 Set current asset to:', asset.name);
      }
    },
    [activeSession, setCurrentAsset]
  );

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
      <Text style={[sharedStyles.title, styles.title]}>{t('assets')}</Text>

      {/* Voice Activity Detection Interface */}
      <VoiceActivityDetectionPanel />

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
              No active recording session. Start Rabbit Mode to see current
              asset.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    paddingHorizontal: spacing.medium,
    marginBottom: spacing.medium
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
    height: 100,
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    overflow: 'hidden'
  }
});
