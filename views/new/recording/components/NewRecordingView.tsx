/**
 * NewRecordingView - Focused recording view for creating new assets with verse labels
 *
 * Features:
 * - Shows only assets created during current session
 * - Receives initial verse label from selected card
 * - Button to advance to next available verse
 * - Auto-applies verse labels to new recordings
 * - Clears on exit (stateless between sessions)
 */

import { VerseSeparator } from '@/components/VerseSeparator';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/contexts/AuthContext';
import type { AssetMetadata } from '@/database_services/assetService';
import { updateAssetMetadata } from '@/database_services/assetService';
import { project_language_link } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useProjectById } from '@/hooks/db/useProjects';
import { useCurrentNavigation } from '@/hooks/useAppNavigation';
import { useLocalization } from '@/hooks/useLocalization';
import { useLocalStore } from '@/store/localStore';
import { saveAudioLocally } from '@/utils/fileUtils';
import { LegendList } from '@legendapp/list';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useQueryClient } from '@tanstack/react-query';
import { and, eq } from 'drizzle-orm';
import { ArrowLeft, PlusCircleIcon } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHybridData } from '../../useHybridData';
import { useVADRecording } from '../hooks/useVADRecording';
import { getNextOrderIndex, saveRecording } from '../services/recordingService';
import { RecordingControls } from './RecordingControls';
import { VADSettingsDrawer } from './VADSettingsDrawer';

interface SessionAsset {
  id: string;
  name: string;
  created_at: string;
  order_index: number;
  verseFrom: number;
  verseTo: number;
}

interface NewRecordingViewProps {
  onBack: () => void;
  /** Initial verse label from selected card (from/to). If undefined, starts from last used verse + 1 */
  initialVerseLabel?: { from: number; to: number };
  /** Maximum verse number in the current chapter */
  maxVerseInChapter: number;
  /** Set of verse numbers already used by existing assets */
  usedVerses: Set<number>;
  /** Book/chapter label for display (e.g., "Gen 1") */
  bookChapterLabel: string;
}

export function NewRecordingView({
  onBack,
  initialVerseLabel,
  maxVerseInChapter,
  usedVerses,
  bookChapterLabel
}: NewRecordingViewProps) {
  const queryClient = useQueryClient();
  const { t } = useLocalization();
  const navigation = useCurrentNavigation();
  const { currentQuestId, currentProjectId, currentBookId } = navigation;
  const { currentUser } = useAuth();
  const { project: currentProject } = useProjectById(currentProjectId);
  const insets = useSafeAreaInsets();

  // Get target languoid_id from project_language_link
  const { data: targetLanguoidLink = [] } = useHybridData<{
    languoid_id: string | null;
  }>({
    dataType: 'project-target-languoid-id',
    queryKeyParams: [currentProjectId || ''],
    offlineQuery: toCompilableQuery(
      system.db
        .select({ languoid_id: project_language_link.languoid_id })
        .from(project_language_link)
        .where(
          and(
            eq(project_language_link.project_id, currentProjectId!),
            eq(project_language_link.language_type, 'target')
          )
        )
        .limit(1)
    ),
    cloudQueryFn: async () => {
      if (!currentProjectId) return [];
      const { data, error } = await system.supabaseConnector.client
        .from('project_language_link')
        .select('languoid_id')
        .eq('project_id', currentProjectId)
        .eq('language_type', 'target')
        .not('languoid_id', 'is', null)
        .limit(1)
        .overrideTypes<{ languoid_id: string | null }[]>();
      if (error) throw error;
      return data;
    },
    enableCloudQuery: !!currentProjectId,
    enableOfflineQuery: !!currentProjectId
  });

  const targetLanguoidId = targetLanguoidLink[0]?.languoid_id;

  // Session-only assets (cleared when view unmounts)
  const [sessionAssets, setSessionAssets] = React.useState<SessionAsset[]>([]);

  // Current verse label being applied to new recordings
  const [currentVerse, setCurrentVerse] = React.useState<{
    from: number;
    to: number;
  }>(() => {
    console.log('🏷️ Initializing currentVerse:', {
      initialVerseLabel,
      maxVerseInChapter,
      usedVersesSize: usedVerses.size,
      usedVersesArray: Array.from(usedVerses)
    });
    if (initialVerseLabel) {
      console.log('🏷️ Using initialVerseLabel:', initialVerseLabel);
      return initialVerseLabel;
    }
    // Find next available verse after highest used
    const maxUsed = usedVerses.size > 0 ? Math.max(...usedVerses) : 0;
    const nextVerse = Math.min(maxUsed + 1, maxVerseInChapter);
    console.log('🏷️ Calculated nextVerse:', {
      maxUsed,
      nextVerse,
      maxVerseInChapter
    });
    return { from: nextVerse, to: nextVerse };
  });

  // Calculate next available verse (for the "add verse" button)
  const nextAvailableVerse = React.useMemo(() => {
    const currentMax = currentVerse.to;
    // Find next verse that's not used
    for (let v = currentMax + 1; v <= maxVerseInChapter; v++) {
      if (!usedVerses.has(v)) {
        // Check if it's before the next used verse
        const nextUsed = Array.from(usedVerses)
          .filter((u) => u > currentMax)
          .sort((a, b) => a - b)[0];
        if (nextUsed === undefined || v < nextUsed) {
          return v;
        }
        break;
      }
    }
    return null;
  }, [currentVerse.to, maxVerseInChapter, usedVerses]);

  // Can we add more verses?
  const canAddVerse = nextAvailableVerse !== null;

  // Recording state
  const [isRecording, setIsRecording] = React.useState(false);
  const [isVADLocked, setIsVADLocked] = React.useState(false);

  // VAD settings
  const vadThreshold = useLocalStore((state) => state.vadThreshold);
  const vadSilenceDuration = useLocalStore((state) => state.vadSilenceDuration);
  const vadDisplayMode = useLocalStore((state) => state.vadDisplayMode);
  const [showVADSettings, setShowVADSettings] = React.useState(false);
  const [autoCalibrateOnOpen, setAutoCalibrateOnOpen] = React.useState(false);

  // Track recording order
  const currentRecordingOrderRef = React.useRef<number>(0);
  const vadCounterRef = React.useRef<number | null>(null);
  const pendingAssetNamesRef = React.useRef<Set<string>>(new Set());

  // Footer height for proper scrolling
  const [footerHeight, setFooterHeight] = React.useState(0);

  // Initialize order index
  React.useEffect(() => {
    const initOrderIndex = async () => {
      if (!currentQuestId) return;
      const nextOrder = await getNextOrderIndex(currentQuestId);
      console.log(
        '🔢 Initialized order index:',
        nextOrder,
        'for quest:',
        currentQuestId
      );
      currentRecordingOrderRef.current = nextOrder;
      vadCounterRef.current = nextOrder;
    };
    void initOrderIndex();
  }, [currentQuestId]);

  // Debug: Log session assets changes
  React.useEffect(() => {
    console.log('📋 Session assets updated:', sessionAssets.length, 'items');
    if (sessionAssets.length > 0) {
      console.log('📋 Last asset:', sessionAssets[sessionAssets.length - 1]);
    }
  }, [sessionAssets]);

  // Handle recording start
  const handleRecordingStart = React.useCallback(() => {
    if (!isVADLocked) {
      setIsRecording(true);
    }
  }, [isVADLocked]);

  // Handle recording stop
  const handleRecordingStop = React.useCallback(() => {
    setIsRecording(false);
  }, []);

  // Handle recording complete
  const handleRecordingComplete = React.useCallback(
    async (uri: string, _duration: number, _waveformData: number[]) => {
      const targetOrder = currentRecordingOrderRef.current;
      // Capture current verse values at recording time (for VAD mode)
      const verseFrom = currentVerse.from;
      const verseTo = currentVerse.to;

      console.log('🎤 Recording complete:', {
        uri,
        targetOrder,
        verseFrom,
        verseTo,
        currentQuestId,
        currentProjectId
      });

      try {
        if (
          !currentProjectId ||
          !currentQuestId ||
          !currentProject ||
          !currentUser ||
          !targetLanguoidId
        ) {
          console.error('❌ Missing required data:', {
            currentProjectId,
            currentQuestId,
            currentProject: !!currentProject,
            currentUser: !!currentUser,
            targetLanguoidId
          });
          return;
        }

        // Generate asset name
        const nextNumber = isVADLocked
          ? targetOrder + 1
          : sessionAssets.length + pendingAssetNamesRef.current.size + 1;
        const assetName = String(nextNumber).padStart(3, '0');
        pendingAssetNamesRef.current.add(assetName);

        console.log('💾 Saving audio locally...', { assetName });

        // Save audio file locally
        const savedUri = await saveAudioLocally(uri);
        console.log('✅ Audio saved locally:', savedUri);

        // Save to database directly (simpler approach)
        console.log('📝 Saving to database...', {
          questId: currentQuestId,
          projectId: currentProjectId
        });

        let newAssetId: string | undefined;
        try {
          newAssetId = await saveRecording({
            questId: currentQuestId,
            projectId: currentProjectId,
            targetLanguoidId: targetLanguoidId,
            userId: currentUser.id,
            orderIndex: targetOrder,
            audioUri: savedUri,
            assetName: assetName
          });
          pendingAssetNamesRef.current.delete(assetName);
          console.log('✅ Asset saved:', newAssetId);
        } catch (dbError) {
          pendingAssetNamesRef.current.delete(assetName);
          console.error('❌ DB write failed:', dbError);
          throw dbError;
        }

        // Apply verse metadata
        if (newAssetId) {
          console.log('🏷️ Applying verse metadata:', { verseFrom, verseTo });
          const verseMetadata: AssetMetadata = {
            verse: {
              from: verseFrom,
              to: verseTo
            }
          };
          await updateAssetMetadata(newAssetId, verseMetadata);
          console.log('✅ Verse metadata applied');

          // Add to session assets
          const newSessionAsset = {
            id: newAssetId,
            name: assetName,
            created_at: new Date().toISOString(),
            order_index: targetOrder,
            verseFrom: verseFrom,
            verseTo: verseTo
          };
          console.log('📋 Adding to session assets:', newSessionAsset);
          setSessionAssets((prev) => {
            const newAssets = [...prev, newSessionAsset];
            console.log('📋 Session assets count:', newAssets.length);
            return newAssets;
          });
        } else {
          console.error('❌ No asset ID returned from save');
        }

        // Increment order for next recording
        currentRecordingOrderRef.current = targetOrder + 1;

        // Invalidate queries to update list
        await queryClient.invalidateQueries({
          queryKey: ['assets', 'by-quest', currentQuestId],
          exact: false
        });

        setIsRecording(false);
      } catch (error) {
        console.error('❌ Failed to save recording:', error);
        setIsRecording(false);
      }
    },
    [
      currentProjectId,
      currentQuestId,
      currentProject,
      currentUser,
      targetLanguoidId,
      isVADLocked,
      sessionAssets.length,
      currentVerse,
      queryClient
    ]
  );

  // Handle recording discarded
  const handleRecordingDiscarded = React.useCallback(() => {
    setIsRecording(false);
  }, []);

  // VAD segment handlers
  const handleVADSegmentStart = React.useCallback(() => {
    console.log('🎬 VAD Segment Start - vadCounterRef:', vadCounterRef.current);
    if (vadCounterRef.current === null) {
      console.error('❌ VAD counter not initialized!');
      return;
    }
    const targetOrder = vadCounterRef.current;
    currentRecordingOrderRef.current = targetOrder;
    vadCounterRef.current = targetOrder + 1;
    console.log('✅ VAD Segment Start - order set to:', targetOrder);
  }, []);

  const handleVADSegmentComplete = React.useCallback(
    (uri: string) => {
      console.log(
        '📼 VAD Segment Complete - uri:',
        uri ? uri.slice(0, 50) + '...' : 'EMPTY'
      );
      if (!uri || uri === '') {
        console.log('⏭️ VAD Segment discarded (empty URI)');
        return;
      }
      console.log('🎤 Calling handleRecordingComplete...');
      void handleRecordingComplete(uri, 0, []);
    },
    [handleRecordingComplete]
  );

  // Hook up native VAD recording
  const {
    currentEnergy,
    isRecording: isVADRecording,
    energyShared,
    isRecordingShared
  } = useVADRecording({
    threshold: vadThreshold,
    silenceDuration: vadSilenceDuration,
    isVADActive: isVADLocked,
    onSegmentStart: handleVADSegmentStart,
    onSegmentComplete: handleVADSegmentComplete,
    isManualRecording: isRecording
  });

  // Advance to next verse
  const handleAdvanceVerse = () => {
    if (nextAvailableVerse !== null) {
      setCurrentVerse({
        from: nextAvailableVerse,
        to: nextAvailableVerse
      });
    }
  };

  // Group session assets by verse for display
  const groupedAssets = React.useMemo(() => {
    const groups = new Map<string, SessionAsset[]>();
    for (const asset of sessionAssets) {
      const key = `${asset.verseFrom}-${asset.verseTo}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(asset);
    }
    return groups;
  }, [sessionAssets]);

  // Build list items with verse separators
  const listItems = React.useMemo(() => {
    console.log(
      '📝 Building listItems from sessionAssets:',
      sessionAssets.length
    );
    const result: (
      | { type: 'separator'; from: number; to: number; key: string }
      | { type: 'asset'; asset: SessionAsset; key: string }
    )[] = [];

    let currentFrom: number | undefined;
    let currentTo: number | undefined;

    for (const asset of sessionAssets) {
      if (asset.verseFrom !== currentFrom || asset.verseTo !== currentTo) {
        result.push({
          type: 'separator',
          from: asset.verseFrom,
          to: asset.verseTo,
          key: `sep-${asset.verseFrom}-${asset.verseTo}`
        });
        currentFrom = asset.verseFrom;
        currentTo = asset.verseTo;
      }
      result.push({
        type: 'asset',
        asset,
        key: asset.id
      });
    }

    console.log('📝 listItems built:', result.length, 'items');
    return result;
  }, [sessionAssets]);

  // Render list item
  const renderItem = React.useCallback(
    ({ item }: { item: (typeof listItems)[number] }) => {
      if (item.type === 'separator') {
        return (
          <VerseSeparator
            from={item.from}
            to={item.to}
            label={bookChapterLabel}
            largeText={true}
          />
        );
      }

      const asset = item.asset;
      return (
        <View className="rounded-lg border border-border bg-card p-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <View className="min-w-[28px] items-center justify-center rounded border border-border bg-muted px-2 py-0.5">
                <Text className="text-xs font-semibold text-muted-foreground">
                  {asset.name}
                </Text>
              </View>
              <Text className="text-sm text-foreground">
                {bookChapterLabel}:{asset.verseFrom}
                {asset.verseTo !== asset.verseFrom ? `-${asset.verseTo}` : ''}
              </Text>
            </View>
          </View>
        </View>
      );
    },
    [bookChapterLabel]
  );

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center gap-3 border-b border-border p-4">
        <Button variant="ghost" size="icon" onPress={onBack}>
          <Icon as={ArrowLeft} size={24} className="text-foreground" />
        </Button>
        <View className="flex-1">
          <Text variant="h4">{t('recording') || 'Recording'}</Text>
          <Text className="text-sm text-muted-foreground">
            {bookChapterLabel}:{currentVerse.from}
            {currentVerse.to !== currentVerse.from ? `-${currentVerse.to}` : ''}
          </Text>
        </View>

        {/* Advance verse button */}
        {canAddVerse && (
          <Button
            variant="outline"
            size="sm"
            onPress={handleAdvanceVerse}
            className="flex-row items-center gap-1"
          >
            <Icon as={PlusCircleIcon} size={16} className="text-primary" />
            <Text className="text-sm">v{nextAvailableVerse}</Text>
          </Button>
        )}
      </View>

      {/* Session assets list */}
      <View className="flex-1 px-4 pt-4">
        {sessionAssets.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-center text-muted-foreground">
              {t('startRecording')}
            </Text>
            <Text className="mt-2 text-center text-lg font-semibold text-primary">
              {bookChapterLabel}:{currentVerse.from}
              {currentVerse.to !== currentVerse.from
                ? `-${currentVerse.to}`
                : ''}
            </Text>
          </View>
        ) : (
          <LegendList
            data={listItems}
            keyExtractor={(item) => item.key}
            estimatedItemSize={60}
            contentContainerStyle={{ paddingBottom: footerHeight + 16 }}
            renderItem={renderItem}
            recycleItems
          />
        )}
      </View>

      {/* Recording controls */}
      <View className="absolute bottom-0 left-0 right-0">
        <RecordingControls
          isRecording={isRecording || isVADRecording}
          onRecordingStart={handleRecordingStart}
          onRecordingStop={handleRecordingStop}
          onRecordingComplete={handleRecordingComplete}
          onRecordingDiscarded={handleRecordingDiscarded}
          onLayout={setFooterHeight}
          isVADLocked={isVADLocked}
          onVADLockChange={setIsVADLocked}
          onSettingsPress={() => setShowVADSettings(true)}
          onAutoCalibratePress={() => {
            setAutoCalibrateOnOpen(true);
            setShowVADSettings(true);
          }}
          currentEnergy={currentEnergy}
          vadThreshold={vadThreshold}
          energyShared={energyShared}
          isRecordingShared={isRecordingShared}
          displayMode={vadDisplayMode}
        />
      </View>

      {/* VAD Settings Drawer */}
      <VADSettingsDrawer
        isOpen={showVADSettings}
        onOpenChange={(open) => {
          setShowVADSettings(open);
          if (!open) {
            setAutoCalibrateOnOpen(false);
          }
        }}
        threshold={vadThreshold}
        onThresholdChange={useLocalStore.getState().setVadThreshold}
        silenceDuration={vadSilenceDuration}
        onSilenceDurationChange={useLocalStore.getState().setVadSilenceDuration}
        isVADLocked={isVADLocked}
        displayMode={vadDisplayMode}
        onDisplayModeChange={useLocalStore.getState().setVadDisplayMode}
        autoCalibrateOnOpen={autoCalibrateOnOpen}
      />
    </View>
  );
}
