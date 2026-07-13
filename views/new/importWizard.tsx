import { DownloadConfirmationModal } from '@/components/DownloadConfirmationModal';
import { DownloadIndicator } from '@/components/DownloadIndicator';
import { QuestDownloadDiscoveryDrawer } from '@/components/QuestDownloadDiscoveryDrawer';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAudio } from '@/contexts/AudioContext';
import { useAuth } from '@/contexts/AuthContext';
import type { asset, quest as questTable } from '@/db/drizzleSchema';
import { quest } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { AppConfig } from '@/db/supabase/AppConfig';
import { useAssetsByQuest } from '@/hooks/db/useAssets';
import { useAudioPlaybackCheckpoint } from '@/hooks/useAudioPlaybackCheckpoint';
import { useQuestDownloadDiscovery } from '@/hooks/useQuestDownloadDiscovery';
import { useQuestDownloadStatusLive } from '@/hooks/useQuestDownloadStatusLive';
import { useSingleAudioController } from '@/hooks/useSingleAudioController';
import { syncCallbackService } from '@/services/syncCallbackService';
import { bulkDownloadQuest } from '@/utils/bulkDownload';
import { resolveTable, type WithSource } from '@/utils/dbUtils';
import { fileExists, getLocalAttachmentUriWithOPFS } from '@/utils/fileUtils';
import { cn } from '@/utils/styleUtils';
import { useHybridData } from '@/views/new/useHybridData';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { LegendList } from '@legendapp/list';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { and, eq } from 'drizzle-orm';
import {
  AlertCircleIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloudIcon,
  Edit3Icon,
  HardDriveIcon,
  InfoIcon,
  PauseIcon,
  PlayIcon,
  XIcon
} from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, Modal, Pressable, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Quest = typeof questTable.$inferSelect;
type Asset = typeof asset.$inferSelect;

interface AssetMetadata {
  verse?: {
    from: number;
    to?: number;
  };
  recordingSessionId?: string;
}

type ImportAsset = Asset & {
  quest_active?: boolean;
  quest_visible?: boolean;
  tag_ids?: string[];
  metadata?: AssetMetadata | null;
  source?: 'local' | 'synced' | 'cloud';
};

export interface ImportWizardVerseLabel {
  key: string;
  from: number;
  to: number;
  label?: string;
  source: 'asset' | 'manual';
}

interface ImportWizardProps {
  visible: boolean;
  onClose: () => void;
  projectId: string;
  currentQuest: Quest;
  currentAssets: ImportAsset[];
  targetVerseLabels?: ImportWizardVerseLabel[];
  formatVerse?: (position: number) => string | null;
}

type ImportStep = 'instructions' | 'quest' | 'assets' | 'validation';

const IMPORT_STEPS: { id: ImportStep; label: string }[] = [
  { id: 'instructions', label: 'Instructions' },
  { id: 'quest', label: 'Quest' },
  { id: 'assets', label: 'Assets' },
  { id: 'validation', label: 'Validation' }
];

type QuestContext =
  | { type: 'bible'; book: string; chapter: number }
  | { type: 'fia'; bookId: string; pericopeId?: string; verseRange?: string }
  | null;

function parseJsonLike(value: unknown): unknown {
  if (!value) return null;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function getQuestContext(metadataValue: unknown): QuestContext {
  const metadata = parseJsonLike(metadataValue);
  if (!metadata || typeof metadata !== 'object') return null;

  if ('bible' in metadata) {
    const bible = metadata.bible;
    if (
      bible &&
      typeof bible === 'object' &&
      'book' in bible &&
      'chapter' in bible &&
      typeof bible.book === 'string' &&
      typeof bible.chapter === 'number'
    ) {
      return {
        type: 'bible',
        book: bible.book,
        chapter: bible.chapter
      };
    }
  }

  if ('fia' in metadata) {
    const fia = metadata.fia;
    if (
      fia &&
      typeof fia === 'object' &&
      'bookId' in fia &&
      typeof fia.bookId === 'string'
    ) {
      return {
        type: 'fia',
        bookId: fia.bookId,
        pericopeId:
          'pericopeId' in fia && typeof fia.pericopeId === 'string'
            ? fia.pericopeId
            : undefined,
        verseRange:
          'verseRange' in fia && typeof fia.verseRange === 'string'
            ? fia.verseRange
            : undefined
      };
    }
  }

  return null;
}

function contextsMatch(left: QuestContext, right: QuestContext) {
  if (!left || !right || left.type !== right.type) return false;

  if (left.type === 'bible' && right.type === 'bible') {
    return left.book === right.book && left.chapter === right.chapter;
  }

  if (left.type === 'fia' && right.type === 'fia') {
    if (left.pericopeId || right.pericopeId) {
      return (
        left.bookId === right.bookId && left.pericopeId === right.pericopeId
      );
    }
    return left.bookId === right.bookId && left.verseRange === right.verseRange;
  }

  return false;
}

function normalizeRange(metadata?: AssetMetadata | null) {
  const verse = metadata?.verse;
  if (!verse || typeof verse.from !== 'number') return null;
  return {
    from: verse.from,
    to: typeof verse.to === 'number' ? verse.to : verse.from
  };
}

function getRangeKey(range: { from: number; to: number }) {
  return `${range.from}-${range.to}`;
}

function formatRange(
  range: { from: number; to: number } | null,
  formatVerse?: (position: number) => string | null
) {
  if (!range) return 'Unassigned';
  const fromLabel = formatVerse?.(range.from) ?? String(range.from);
  const toLabel = formatVerse?.(range.to) ?? String(range.to);
  return range.from === range.to ? fromLabel : `${fromLabel}-${toLabel}`;
}

function formatQuestSubtitle(questItem: Quest & { source?: string }) {
  if (questItem.description?.trim()) return questItem.description;
  if (questItem.source === 'cloud') return 'Published cloud version';
  if (questItem.source === 'synced') return 'Downloaded published version';
  return 'Published version';
}

function ImportProgressIndicator({ currentStep }: { currentStep: ImportStep }) {
  const currentIndex = IMPORT_STEPS.findIndex(
    (item) => item.id === currentStep
  );

  return (
    <View className="w-full px-6 py-4">
      <View className="relative flex-row items-start justify-between">
        <View className="absolute left-0 right-0 top-3 h-0.5 bg-muted" />
        <View
          className="absolute left-0 top-3 h-0.5 rounded-full bg-primary"
          style={{
            width: `${(currentIndex / (IMPORT_STEPS.length - 1)) * 100}%`
          }}
        />
        {IMPORT_STEPS.map((step, index) => {
          const isActive = index === currentIndex;
          const isCompleted = index < currentIndex;

          return (
            <View key={step.id} className="relative z-10 items-center gap-2">
              <View
                className={cn(
                  'size-6 items-center justify-center rounded-full border-2 bg-background',
                  (isActive || isCompleted) && 'border-primary bg-primary',
                  !isActive && !isCompleted && 'border-muted-foreground'
                )}
              >
                {isCompleted ? (
                  <Icon
                    as={CheckIcon}
                    size={14}
                    className="text-primary-foreground"
                  />
                ) : (
                  <Text
                    className={cn(
                      'text-xs font-semibold',
                      isActive
                        ? 'text-primary-foreground'
                        : 'text-muted-foreground'
                    )}
                  >
                    {index + 1}
                  </Text>
                )}
              </View>
              <Text
                className={cn(
                  'text-xs',
                  isActive
                    ? 'font-medium text-foreground'
                    : 'text-muted-foreground'
                )}
                numberOfLines={1}
              >
                {step.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function StepHeader({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <View className="gap-2">
      <Text variant="h2">{title}</Text>
      <Text className="text-muted-foreground">{description}</Text>
    </View>
  );
}

function InstructionsStep() {
  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="gap-4 p-6"
      contentInsetAdjustmentBehavior="automatic"
    >
      <StepHeader
        title="Import assets from another quest"
        description="Use this flow to copy assets from a published version of the same chapter or pericope."
      />
      {[
        'Choose a published quest version that matches this chapter or pericope.',
        'Download the quest first if it is only available in the cloud.',
        'Select one or more assets to import.',
        'Review names, verse labels, and conflicts before confirming.'
      ].map((item, index) => (
        <View
          key={item}
          className="flex-row items-start gap-3 rounded-lg border border-border bg-card p-4"
        >
          <View className="size-7 items-center justify-center rounded-full bg-primary">
            <Text className="text-sm font-semibold text-primary-foreground">
              {index + 1}
            </Text>
          </View>
          <Text className="flex-1 text-base">{item}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function QuestCard({
  questItem,
  selected,
  downloading,
  onSelect,
  onDownload
}: {
  questItem: WithSource<Quest>;
  selected: boolean;
  downloading: boolean;
  onSelect: () => void;
  onDownload: () => void;
}) {
  const isDownloaded = useQuestDownloadStatusLive(
    questItem.source === 'cloud' ? questItem.id : null
  );
  const canUseQuest = questItem.source !== 'cloud' || isDownloaded;
  const isLocalPublishedCopy = questItem.source === 'synced';

  return (
    <Pressable
      onPress={canUseQuest ? onSelect : onDownload}
      className={cn(
        'flex-row items-center gap-3 rounded-lg border bg-card p-4 active:opacity-80',
        selected ? 'border-primary' : 'border-border',
        !canUseQuest && 'opacity-70'
      )}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <View
        className={cn(
          'size-10 items-center justify-center rounded-full',
          selected ? 'bg-primary' : 'bg-muted'
        )}
      >
        <Icon
          as={isLocalPublishedCopy || isDownloaded ? HardDriveIcon : CloudIcon}
          size={20}
          className={
            selected ? 'text-primary-foreground' : 'text-muted-foreground'
          }
        />
      </View>
      <View className="flex-1 gap-1">
        <Text className="font-semibold" numberOfLines={1}>
          {questItem.name}
        </Text>
        <Text className="text-sm text-muted-foreground" numberOfLines={2}>
          {formatQuestSubtitle(questItem)}
        </Text>
      </View>
      {questItem.source === 'cloud' ? (
        <DownloadIndicator
          isFlaggedForDownload={isDownloaded}
          isLoading={downloading && !isDownloaded}
          onPress={onDownload}
          size={22}
          className="text-primary"
        />
      ) : (
        <View className="rounded-full border border-primary px-3 py-1">
          <Text className="text-xs font-medium text-primary">Downloaded</Text>
        </View>
      )}
    </Pressable>
  );
}

function QuestStep({
  quests,
  selectedQuestId,
  isLoading,
  downloadingQuestIds,
  onSelectQuest,
  onDownloadQuest
}: {
  quests: WithSource<Quest>[];
  selectedQuestId: string | null;
  isLoading: boolean;
  downloadingQuestIds: Set<string>;
  onSelectQuest: (questId: string) => void;
  onDownloadQuest: (questId: string) => void;
}) {
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center gap-3 p-6">
        <ActivityIndicator />
        <Text className="text-muted-foreground">
          Loading compatible quests...
        </Text>
      </View>
    );
  }

  if (quests.length === 0) {
    return (
      <View className="flex-1 items-center justify-center gap-3 p-6">
        <Icon as={InfoIcon} size={40} className="text-muted-foreground" />
        <Text variant="h4" className="text-center">
          No published versions found
        </Text>
        <Text className="text-center text-muted-foreground">
          There are no other published quests for this same chapter or pericope.
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 gap-4 p-6">
      <StepHeader
        title="Choose a source quest"
        description="Only downloaded published quests can be used as an import source."
      />
      <LegendList
        data={quests}
        keyExtractor={(item) => item.id}
        estimatedItemSize={88}
        contentContainerStyle={{ gap: 12, paddingBottom: 16 }}
        renderItem={({ item }) => (
          <QuestCard
            questItem={item}
            selected={selectedQuestId === item.id}
            downloading={downloadingQuestIds.has(item.id)}
            onSelect={() => onSelectQuest(item.id)}
            onDownload={() => onDownloadQuest(item.id)}
          />
        )}
      />
    </View>
  );
}

function AssetCard({
  assetItem,
  selected,
  isPlaying,
  onToggle,
  onPlay,
  formatVerse
}: {
  assetItem: ImportAsset;
  selected: boolean;
  isPlaying: boolean;
  onToggle: () => void;
  onPlay: () => void;
  formatVerse?: (position: number) => string | null;
}) {
  const range = normalizeRange(assetItem.metadata);

  return (
    <Pressable
      onPress={onToggle}
      className={cn(
        'flex-row items-center gap-3 rounded-lg border bg-card p-3 active:opacity-80',
        selected ? 'border-primary' : 'border-border'
      )}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
    >
      <Button
        variant="outline"
        size="icon-sm"
        className="rounded-full border-primary"
        onPress={onPlay}
      >
        <Icon
          as={isPlaying ? PauseIcon : PlayIcon}
          size={16}
          className="text-primary"
        />
      </Button>
      <View className="flex-1 gap-1">
        <Text className="font-medium" numberOfLines={1}>
          {assetItem.name || 'Untitled asset'}
        </Text>
        <Text className="text-xs text-muted-foreground" numberOfLines={1}>
          Audio asset
        </Text>
      </View>
      <View
        className={cn(
          'rounded-full px-3 py-1',
          range ? 'bg-primary/10' : 'bg-muted'
        )}
      >
        <Text
          className={cn(
            'text-xs font-medium',
            range ? 'text-primary' : 'text-muted-foreground'
          )}
        >
          {formatRange(range, formatVerse)}
        </Text>
      </View>
    </Pressable>
  );
}

function AssetsStep({
  assets,
  selectedAssetIds,
  isLoading,
  playingAssetId,
  onToggleAsset,
  onPlayAsset,
  onLoadMore,
  isFetchingNextPage,
  formatVerse
}: {
  assets: ImportAsset[];
  selectedAssetIds: Set<string>;
  isLoading: boolean;
  playingAssetId: string | null;
  onToggleAsset: (assetId: string) => void;
  onPlayAsset: (assetId: string) => void;
  onLoadMore: () => void;
  isFetchingNextPage: boolean;
  formatVerse?: (position: number) => string | null;
}) {
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center gap-3 p-6">
        <ActivityIndicator />
        <Text className="text-muted-foreground">Loading assets...</Text>
      </View>
    );
  }

  if (assets.length === 0) {
    return (
      <View className="flex-1 items-center justify-center gap-3 p-6">
        <Icon as={InfoIcon} size={40} className="text-muted-foreground" />
        <Text variant="h4" className="text-center">
          No assets found
        </Text>
        <Text className="text-center text-muted-foreground">
          This quest does not have visible assets available for import.
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 gap-4 p-6">
      <StepHeader
        title="Select assets"
        description="Choose one or more assets to prepare for validation."
      />
      <LegendList
        data={assets}
        keyExtractor={(item) => item.id}
        estimatedItemSize={76}
        contentContainerStyle={{ gap: 10, paddingBottom: 16 }}
        renderItem={({ item }) => (
          <AssetCard
            assetItem={item}
            selected={selectedAssetIds.has(item.id)}
            isPlaying={playingAssetId === item.id}
            onToggle={() => onToggleAsset(item.id)}
            onPlay={() => onPlayAsset(item.id)}
            formatVerse={formatVerse}
          />
        )}
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View className="items-center p-4">
              <ActivityIndicator size="small" />
            </View>
          ) : null
        }
      />
    </View>
  );
}

function ValidationAssetCard({
  assetItem,
  conflict,
  formatVerse
}: {
  assetItem: ImportAsset;
  conflict: boolean;
  formatVerse?: (position: number) => string | null;
}) {
  const range = normalizeRange(assetItem.metadata);

  return (
    <View
      className={cn(
        'flex-row items-center gap-3 rounded-lg border bg-card p-4',
        conflict ? 'border-destructive' : 'border-border'
      )}
    >
      <View
        className={cn(
          'size-9 items-center justify-center rounded-full',
          conflict ? 'bg-destructive/10' : 'bg-primary/10'
        )}
      >
        <Icon
          as={conflict ? AlertCircleIcon : CheckIcon}
          size={18}
          className={conflict ? 'text-destructive' : 'text-primary'}
        />
      </View>
      <View className="flex-1 gap-1">
        <Text className="font-medium" numberOfLines={1}>
          {assetItem.name || 'Untitled asset'}
        </Text>
        <Text
          className={cn(
            'text-sm',
            conflict ? 'text-destructive' : 'text-muted-foreground'
          )}
        >
          {conflict ? 'Verse label already used' : 'No conflicts detected'} -{' '}
          {formatRange(range, formatVerse)}
        </Text>
      </View>
      <Button variant="ghost" size="icon-sm" disabled>
        <Icon as={Edit3Icon} size={18} className="text-muted-foreground" />
      </Button>
    </View>
  );
}

function ValidationStep({
  selectedAssets,
  usedLabels,
  conflictKeys,
  formatVerse
}: {
  selectedAssets: ImportAsset[];
  usedLabels: ImportWizardVerseLabel[];
  conflictKeys: Set<string>;
  formatVerse?: (position: number) => string | null;
}) {
  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="gap-5 p-6"
      contentInsetAdjustmentBehavior="automatic"
    >
      <StepHeader
        title="Validate before import"
        description="Review selected assets and the verse labels already used in the destination quest."
      />

      <View className="gap-3">
        <Text className="font-semibold">Selected assets</Text>
        {selectedAssets.map((assetItem) => {
          const range = normalizeRange(assetItem.metadata);
          const conflict = range ? conflictKeys.has(getRangeKey(range)) : false;
          return (
            <ValidationAssetCard
              key={assetItem.id}
              assetItem={assetItem}
              conflict={conflict}
              formatVerse={formatVerse}
            />
          );
        })}
      </View>

      <View className="gap-3">
        <Text className="font-semibold">Existing labels in this quest</Text>
        {usedLabels.length === 0 ? (
          <View className="rounded-lg border border-dashed border-border p-4">
            <Text className="text-muted-foreground">
              No existing verse labels were found.
            </Text>
          </View>
        ) : (
          usedLabels.map((label) => (
            <View
              key={label.key}
              className="flex-row items-center justify-between rounded-lg border border-border p-3"
            >
              <View className="gap-1">
                <Text className="font-medium">
                  {label.label ?? formatRange(label, formatVerse)}
                </Text>
                <Text className="text-xs text-muted-foreground">
                  {label.source === 'asset' ? 'Asset label' : 'Manual label'}
                </Text>
              </View>
              <Text className="text-sm text-muted-foreground">
                {formatRange(label, formatVerse)}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

export function ImportWizard({
  visible,
  onClose,
  projectId,
  currentQuest,
  currentAssets,
  targetVerseLabels = [],
  formatVerse
}: ImportWizardProps) {
  const insets = useSafeAreaInsets();
  const { currentUser } = useAuth();
  const audioContext = useAudio();
  const queryClient = useQueryClient();
  const [step, setStep] = React.useState<ImportStep>('instructions');
  const [selectedQuestId, setSelectedQuestId] = React.useState<string | null>(
    null
  );
  const [selectedAssetIds, setSelectedAssetIds] = React.useState<Set<string>>(
    () => new Set()
  );
  const [downloadingQuestIds, setDownloadingQuestIds] = React.useState<
    Set<string>
  >(() => new Set());
  const [questIdToDownload, setQuestIdToDownload] = React.useState<
    string | null
  >(null);
  const [showDiscoveryDrawer, setShowDiscoveryDrawer] = React.useState(false);
  const [showConfirmationModal, setShowConfirmationModal] =
    React.useState(false);
  const [playingAssetId, setPlayingAssetId] = React.useState<string | null>(
    null
  );
  const startedDiscoveryRef = React.useRef<string | null>(null);
  const stopCurrentSoundRef = React.useRef(audioContext.stopCurrentSound);

  React.useEffect(() => {
    stopCurrentSoundRef.current = audioContext.stopCurrentSound;
  }, [audioContext.stopCurrentSound]);

  const currentContext = React.useMemo(
    () => getQuestContext(currentQuest.metadata),
    [currentQuest.metadata]
  );

  React.useEffect(() => {
    if (visible) {
      setStep('instructions');
      setSelectedQuestId(null);
      setSelectedAssetIds(new Set());
      setPlayingAssetId(null);
      return;
    }
    void stopCurrentSoundRef.current();
  }, [visible]);

  const compatibleQuestsQuery = useHybridData<Quest>({
    dataType: 'import-compatible-quests',
    queryKeyParams: [projectId, currentQuest.id],
    offlineQuery: toCompilableQuery(
      system.db.query.quest.findMany({
        where: and(
          eq(quest.project_id, projectId),
          eq(quest.active, true),
          eq(quest.visible, true)
        )
      })
    ),
    cloudQueryFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('quest')
        .select('*')
        .eq('project_id', projectId)
        .eq('active', true)
        .eq('visible', true)
        .order('created_at', { ascending: false })
        .overrideTypes<Quest[]>();

      if (error) throw error;
      return data;
    },
    enableCloudQuery: visible && !!projectId,
    enableOfflineQuery: visible && !!projectId,
    enabled: visible && !!projectId
  });

  const compatibleQuests = React.useMemo(() => {
    return compatibleQuestsQuery.data
      .filter((questItem) => {
        if (questItem.id === currentQuest.id) return false;
        if (questItem.source === 'local') return false;
        return contextsMatch(
          currentContext,
          getQuestContext(questItem.metadata)
        );
      })
      .sort((left, right) => {
        const leftDownloaded = left.source === 'synced' ? 0 : 1;
        const rightDownloaded = right.source === 'synced' ? 0 : 1;
        if (leftDownloaded !== rightDownloaded) {
          return leftDownloaded - rightDownloaded;
        }
        return (right.created_at ?? '').localeCompare(left.created_at ?? '');
      });
  }, [compatibleQuestsQuery.data, currentContext, currentQuest.id]);

  const assetsQuery = useAssetsByQuest(selectedQuestId ?? '', '', true);

  const sourceAssets = React.useMemo(() => {
    const allAssets = assetsQuery.data.pages.flatMap((page) => page.data);
    const map = new Map<string, ImportAsset>();
    for (const item of allAssets) {
      if (!map.has(item.id)) {
        map.set(item.id, item as ImportAsset);
      }
    }
    return Array.from(map.values());
  }, [assetsQuery.data.pages]);

  const selectedAssets = React.useMemo(() => {
    return sourceAssets.filter((assetItem) =>
      selectedAssetIds.has(assetItem.id)
    );
  }, [sourceAssets, selectedAssetIds]);

  const usedLabels = React.useMemo<ImportWizardVerseLabel[]>(() => {
    const fromAssets: ImportWizardVerseLabel[] = [];
    for (const assetItem of currentAssets) {
      const range = normalizeRange(assetItem.metadata);
      if (!range) continue;
      fromAssets.push({
        key: `asset-${assetItem.id}`,
        from: range.from,
        to: range.to,
        label: assetItem.name ?? undefined,
        source: 'asset' as const
      });
    }

    return [...fromAssets, ...targetVerseLabels];
  }, [currentAssets, targetVerseLabels]);

  const usedLabelKeys = React.useMemo(() => {
    return new Set(
      usedLabels.map((label) => getRangeKey({ from: label.from, to: label.to }))
    );
  }, [usedLabels]);

  const conflictKeys = React.useMemo(() => {
    const conflicts = new Set<string>();
    for (const assetItem of selectedAssets) {
      const range = normalizeRange(assetItem.metadata);
      if (!range) continue;
      const key = getRangeKey(range);
      if (usedLabelKeys.has(key)) {
        conflicts.add(key);
      }
    }
    return conflicts;
  }, [selectedAssets, usedLabelKeys]);

  const hasConflicts = conflictKeys.size > 0;
  const currentStepIndex = IMPORT_STEPS.findIndex((item) => item.id === step);
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === IMPORT_STEPS.length - 1;

  const canGoNext =
    step === 'instructions' ||
    (step === 'quest' && !!selectedQuestId) ||
    (step === 'assets' && selectedAssetIds.size > 0);

  const canImport = selectedAssets.length > 0 && !hasConflicts;

  const goToPreviousStep = () => {
    if (isFirstStep) {
      onClose();
      return;
    }
    const previousStep = IMPORT_STEPS[currentStepIndex - 1];
    if (previousStep) {
      setStep(previousStep.id);
    }
  };

  const goToNextStep = () => {
    if (isLastStep) {
      onClose();
      return;
    }
    const nextStep = IMPORT_STEPS[currentStepIndex + 1];
    if (nextStep) {
      setStep(nextStep.id);
    }
  };

  const toggleAsset = (assetId: string) => {
    setSelectedAssetIds((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) {
        next.delete(assetId);
      } else {
        next.add(assetId);
      }
      return next;
    });
  };

  const getAssetAudioUris = React.useCallback(
    async (assetId: string): Promise<string[]> => {
      try {
        const assetContentLinkSynced = resolveTable('asset_content_link', {
          localOverride: false
        });
        const assetContentLinkLocal = resolveTable('asset_content_link', {
          localOverride: true
        });

        const [syncedLinks, localLinks] = await Promise.all([
          system.db
            .select()
            .from(assetContentLinkSynced)
            .where(eq(assetContentLinkSynced.asset_id, assetId)),
          system.db
            .select()
            .from(assetContentLinkLocal)
            .where(eq(assetContentLinkLocal.asset_id, assetId))
        ]);

        const audioValues = [...syncedLinks, ...localLinks]
          .flatMap((link) => link.audio ?? [])
          .filter((value): value is string => Boolean(value));

        const uris: string[] = [];
        for (const audioValue of audioValues) {
          if (audioValue.startsWith('local/')) {
            const uri = await getLocalAttachmentUriWithOPFS(audioValue);
            if (await fileExists(uri)) {
              uris.push(uri);
            }
            continue;
          }

          if (audioValue.startsWith('file://')) {
            if (await fileExists(audioValue)) {
              uris.push(audioValue);
            }
            continue;
          }

          if (system.permAttachmentQueue) {
            const attachment = await system.powersync.getOptional<{
              id: string;
              local_uri: string | null;
            }>(
              `SELECT * FROM ${system.permAttachmentQueue.table} WHERE id = ?`,
              [audioValue]
            );
            if (attachment?.local_uri) {
              const localUri = system.permAttachmentQueue.getLocalUri(
                attachment.local_uri
              );
              if (await fileExists(localUri)) {
                uris.push(localUri);
                continue;
              }
            }
          }

          if (AppConfig.supabaseBucket) {
            const { data } = system.supabaseConnector.client.storage
              .from(AppConfig.supabaseBucket)
              .getPublicUrl(audioValue);
            if (data.publicUrl) {
              uris.push(data.publicUrl);
            }
          }
        }

        return uris;
      } catch (error) {
        console.error('[ImportWizard] Failed to resolve asset audio:', error);
        return [];
      }
    },
    []
  );

  const checkpointStore = useAudioPlaybackCheckpoint();
  const { playAsset } = useSingleAudioController({
    audioContext,
    checkpointStore,
    getAssetAudioUris,
    onCurrentAssetChange: setPlayingAssetId,
    onNoAudioFound: () => setPlayingAssetId(null),
    onError: (error) => {
      console.error('[ImportWizard] Failed to play asset:', error);
      setPlayingAssetId(null);
    }
  });

  const handlePlayAsset = (assetId: string) => {
    void playAsset(assetId);
  };

  const discoveryState = useQuestDownloadDiscovery(questIdToDownload ?? '');

  React.useEffect(() => {
    if (
      showDiscoveryDrawer &&
      questIdToDownload &&
      !discoveryState.isDiscovering &&
      startedDiscoveryRef.current !== questIdToDownload
    ) {
      startedDiscoveryRef.current = questIdToDownload;
      discoveryState.startDiscovery();
    }
    if (!showDiscoveryDrawer) {
      startedDiscoveryRef.current = null;
    }
  }, [
    showDiscoveryDrawer,
    questIdToDownload,
    discoveryState.isDiscovering,
    discoveryState
  ]);

  const bulkDownloadMutation = useMutation({
    mutationFn: async () => {
      if (!currentUser?.id) {
        throw new Error('Missing current user');
      }
      return bulkDownloadQuest(discoveryState.discoveredIds, currentUser.id);
    },
    onSuccess: async () => {
      const questIdsToClear = discoveryState.discoveredIds.questIds;

      const clearAndInvalidate = async () => {
        setDownloadingQuestIds((prev) => {
          const next = new Set(prev);
          questIdsToClear.forEach((id) => next.delete(id));
          return next;
        });
        await queryClient.invalidateQueries({
          queryKey: ['import-compatible-quests'],
          exact: false
        });
        await queryClient.invalidateQueries({
          queryKey: ['assets'],
          exact: false
        });
      };

      if (questIdToDownload) {
        syncCallbackService.registerCallback(
          questIdToDownload,
          clearAndInvalidate
        );
      } else {
        await clearAndInvalidate();
      }
    }
  });

  const handleDownloadQuest = (questId: string) => {
    setQuestIdToDownload(questId);
    setShowDiscoveryDrawer(true);
  };

  const handleCancelDiscovery = () => {
    discoveryState.cancel();
    setShowDiscoveryDrawer(false);
    setQuestIdToDownload(null);
  };

  const handleDiscoveryContinue = () => {
    setShowDiscoveryDrawer(false);
    setShowConfirmationModal(true);
  };

  const handleConfirmDownload = async () => {
    setShowConfirmationModal(false);
    const questIdsToTrack = new Set(discoveryState.discoveredIds.questIds);
    setDownloadingQuestIds((prev) => new Set([...prev, ...questIdsToTrack]));

    try {
      await bulkDownloadMutation.mutateAsync();
    } catch (error) {
      console.error('[ImportWizard] Failed to download quest:', error);
      setDownloadingQuestIds((prev) => {
        const next = new Set(prev);
        questIdsToTrack.forEach((id) => next.delete(id));
        return next;
      });
      setQuestIdToDownload(null);
    }
  };

  const handleCancelConfirmation = () => {
    setShowConfirmationModal(false);
    setQuestIdToDownload(null);
  };

  const handleSelectQuest = (questId: string) => {
    setSelectedQuestId(questId);
    setSelectedAssetIds(new Set());
  };

  const handleLoadMoreAssets = () => {
    if (assetsQuery.hasNextPage && !assetsQuery.isFetchingNextPage) {
      void assetsQuery.fetchNextPage();
    }
  };

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        <ImportProgressIndicator currentStep={step} />

        <View className="flex-row items-center justify-between border-b border-border px-6 py-4">
          <Text className="text-base font-semibold">Import assets</Text>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close import wizard"
          >
            <Icon as={XIcon} size={24} className="text-muted-foreground" />
          </Pressable>
        </View>

        <View className="flex-1">
          {step === 'instructions' && <InstructionsStep />}
          {step === 'quest' && (
            <QuestStep
              quests={compatibleQuests}
              selectedQuestId={selectedQuestId}
              isLoading={compatibleQuestsQuery.isLoading}
              downloadingQuestIds={downloadingQuestIds}
              onSelectQuest={handleSelectQuest}
              onDownloadQuest={handleDownloadQuest}
            />
          )}
          {step === 'assets' && (
            <AssetsStep
              assets={sourceAssets}
              selectedAssetIds={selectedAssetIds}
              isLoading={assetsQuery.isLoading || assetsQuery.isFetching}
              playingAssetId={playingAssetId}
              onToggleAsset={toggleAsset}
              onPlayAsset={handlePlayAsset}
              onLoadMore={handleLoadMoreAssets}
              isFetchingNextPage={assetsQuery.isFetchingNextPage}
              formatVerse={formatVerse}
            />
          )}
          {step === 'validation' && (
            <ValidationStep
              selectedAssets={selectedAssets}
              usedLabels={usedLabels}
              conflictKeys={conflictKeys}
              formatVerse={formatVerse}
            />
          )}
        </View>

        <View
          className="flex-row items-center justify-between gap-3 border-t border-border px-6 py-4"
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          <Button
            variant="outline"
            onPress={goToPreviousStep}
            className="flex-1"
          >
            <Icon as={ChevronLeftIcon} size={16} />
            <Text>{isFirstStep ? 'Close' : 'Previous'}</Text>
          </Button>
          <Button
            onPress={isLastStep ? onClose : goToNextStep}
            disabled={isLastStep ? !canImport : !canGoNext}
            className="flex-1"
          >
            <Text>{isLastStep ? 'Import' : 'Next'}</Text>
            {!isLastStep && (
              <Icon
                as={ChevronRightIcon}
                size={16}
                className="text-primary-foreground"
              />
            )}
          </Button>
        </View>
      </View>

      <QuestDownloadDiscoveryDrawer
        isOpen={showDiscoveryDrawer}
        onOpenChange={(open) => {
          if (!open) handleCancelDiscovery();
        }}
        onContinue={handleDiscoveryContinue}
        discoveryState={discoveryState}
      />

      <DownloadConfirmationModal
        visible={showConfirmationModal}
        onConfirm={handleConfirmDownload}
        onCancel={handleCancelConfirmation}
        downloadType="quest"
        discoveredCounts={{
          Quests: discoveryState.progressSharedValues.quest.value.count,
          Projects: discoveryState.progressSharedValues.project.value.count,
          'Quest-Asset Links':
            discoveryState.progressSharedValues.questAssetLinks.value.count,
          Assets: discoveryState.progressSharedValues.assets.value.count,
          'Asset Content Links':
            discoveryState.progressSharedValues.assetContentLinks.value.count,
          Votes: discoveryState.progressSharedValues.votes.value.count,
          'Quest Tags':
            discoveryState.progressSharedValues.questTagLinks.value.count,
          'Asset Tags':
            discoveryState.progressSharedValues.assetTagLinks.value.count,
          Tags: discoveryState.progressSharedValues.tags.value.count,
          Languages: discoveryState.progressSharedValues.languages.value.count
        }}
      />
    </Modal>
  );
}
