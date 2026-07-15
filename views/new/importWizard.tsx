import { DownloadConfirmationModal } from '@/components/DownloadConfirmationModal';
import { DownloadIndicator } from '@/components/DownloadIndicator';
import { QuestDownloadDiscoveryDrawer } from '@/components/QuestDownloadDiscoveryDrawer';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { VerseAssigner } from '@/components/VerseAssigner';
import { useAudio } from '@/contexts/AudioContext';
import { useAuth } from '@/contexts/AuthContext';
import type { quest as questTable } from '@/db/drizzleSchema';
import {
  asset as assetTable,
  profile,
  quest,
  quest_asset_link
} from '@/db/drizzleSchema';
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
import { cn, useThemeColor } from '@/utils/styleUtils';
import { useHybridData } from '@/views/new/useHybridData';
import { LegendList } from '@legendapp/list';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { and, eq, getTableColumns, sql } from 'drizzle-orm';
import {
  CheckIcon,
  CheckSquareIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  Edit3Icon,
  InfoIcon,
  PauseIcon,
  PlayIcon,
  SquareIcon,
  XIcon
} from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, Modal, Pressable, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Quest = typeof questTable.$inferSelect;
type Asset = typeof assetTable.$inferSelect;
type ImportQuest = Quest & {
  creatorName?: string | null;
  assetCount?: number | null;
};

interface AssetMetadata {
  verse?: {
    from: number;
    to?: number;
  };
  recordingSessionId?: string;
}

interface VerseRange {
  from: number;
  to: number;
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
  availableVerses: number[];
  verseCount: number;
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

function rangesOverlap(left: VerseRange, right: VerseRange) {
  return left.from <= right.to && right.from <= left.to;
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

function formatQuestCreatedAt(createdAt?: string | null) {
  if (!createdAt) return null;
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;

  const pad = (value: number) => value.toString().padStart(2, '0');
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const year = date.getFullYear();
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());

  return `${month}/${day}/${year} - ${hours}:${minutes}`;
}

function getCreatorDisplayName(questItem: ImportQuest) {
  return questItem.creatorName?.trim() || 'Unknown';
}

function getCreatorInitials(displayName: string) {
  const parts = displayName
    .replace(/@.*/, '')
    .split(/[\s._-]+/)
    .filter(Boolean);

  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

function formatAssetCount(assetCount?: number | null) {
  const count = assetCount ?? 0;
  return `${count} ${count === 1 ? 'asset' : 'assets'}`;
}

function normalizeId(id: string | null | undefined) {
  return id?.toLowerCase() ?? null;
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
  questItem: WithSource<ImportQuest>;
  selected: boolean;
  downloading: boolean;
  onSelect: () => void;
  onDownload: () => void;
}) {
  const isDownloaded = useQuestDownloadStatusLive(
    questItem.source === 'cloud' ? questItem.id : null
  );
  const canUseQuest = questItem.source !== 'cloud' || isDownloaded;
  const needsDownload = questItem.source === 'cloud' && !isDownloaded;
  const creatorName = getCreatorDisplayName(questItem);
  const initials = getCreatorInitials(creatorName);
  const createdAtLabel = formatQuestCreatedAt(questItem.created_at);
  const primaryColor = useThemeColor('primary');

  return (
    <Pressable
      onPress={canUseQuest ? onSelect : onDownload}
      className={cn(
        'flex-row items-center gap-2 rounded-lg border bg-card px-3 py-2.5 active:opacity-80',
        selected ? 'bg-secondary/50' : 'border-border',
        !canUseQuest && 'opacity-70'
      )}
      style={
        selected ? { borderColor: primaryColor, borderWidth: 1 } : undefined
      }
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <View
        className={cn(
          'size-9 items-center justify-center rounded-full',
          selected ? 'bg-primary' : needsDownload ? 'bg-muted' : 'bg-primary'
        )}
      >
        <Text
          className={
            selected || !needsDownload
              ? 'font-semibold text-primary-foreground'
              : 'font-semibold text-secondary-foreground'
          }
        >
          {initials}
        </Text>
      </View>
      <View className="flex-1 gap-1">
        <Text className="text-sm font-semibold" numberOfLines={1}>
          {questItem.name}
          {createdAtLabel ? ` (${createdAtLabel})` : ''}
        </Text>
        <Text className="text-xs text-muted-foreground" numberOfLines={1}>
          {formatAssetCount(questItem.assetCount)}
        </Text>
      </View>
      {downloading && needsDownload ? (
        <ActivityIndicator size="small" />
      ) : needsDownload ? (
        <DownloadIndicator
          isFlaggedForDownload={isDownloaded}
          isLoading={downloading && !isDownloaded}
          onPress={onDownload}
          size={18}
        />
      ) : (
        <Icon as={CircleCheckIcon} size={20} className="text-primary" />
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
  quests: WithSource<ImportQuest>[];
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
        extraData={[selectedQuestId, downloadingQuestIds]}
        estimatedItemSize={68}
        contentContainerStyle={{ gap: 8, paddingBottom: 16 }}
        renderItem={({ item }) => (
          <QuestCard
            questItem={item}
            selected={normalizeId(selectedQuestId) === normalizeId(item.id)}
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
  const primaryColor = useThemeColor('primary');

  return (
    <Pressable
      onPress={onToggle}
      className={cn(
        'flex-row items-center gap-3 rounded-lg border bg-card p-3 active:opacity-80',
        selected ? 'bg-secondary/50' : 'border-border'
      )}
      style={
        selected ? { borderColor: primaryColor, borderWidth: 2 } : undefined
      }
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={assetItem.name || 'Untitled asset'}
    >
      <Pressable
        onPress={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        className="size-7 items-center justify-center"
        hitSlop={8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={selected ? 'Deselect asset' : 'Select asset'}
      >
        <Icon
          as={selected ? CheckSquareIcon : SquareIcon}
          size={22}
          className={selected ? 'text-primary' : 'text-muted-foreground'}
        />
      </Pressable>
      <Pressable
        onPress={(event) => {
          event.stopPropagation();
          onPlay();
        }}
        className="size-7 items-center justify-center rounded-full bg-primary/20 active:bg-primary/40"
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? 'Pause asset' : 'Play asset'}
      >
        <Icon
          as={isPlaying ? PauseIcon : PlayIcon}
          size={14}
          className={isPlaying ? 'text-primary' : 'text-primary/80'}
        />
      </Pressable>
      <View className="flex-1 justify-center">
        <Text className="font-medium" numberOfLines={1}>
          {assetItem.name || 'Untitled asset'}
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
    <View className="flex-1 gap-4 px-6 pb-4 pt-6">
      <StepHeader
        title="Select assets"
        description="Choose one or more assets to prepare for validation."
      />
      <LegendList
        data={assets}
        keyExtractor={(item) => item.id}
        extraData={[selectedAssetIds, playingAssetId]}
        estimatedItemSize={76}
        contentContainerStyle={{ gap: 6, paddingBottom: 16 }}
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
  isPlaying,
  onPlay,
  range,
  onEditRange,
  formatVerse
}: {
  assetItem: ImportAsset;
  conflict: boolean;
  isPlaying: boolean;
  onPlay: () => void;
  range: VerseRange | null;
  onEditRange: () => void;
  formatVerse?: (position: number) => string | null;
}) {
  return (
    <View
      className={cn(
        'flex-row items-center gap-3 rounded-lg border bg-card p-3',
        conflict ? 'border-destructive' : 'border-border'
      )}
    >
      <Pressable
        onPress={onPlay}
        className="size-7 items-center justify-center rounded-full bg-primary/20 active:bg-primary/40"
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? 'Pause asset' : 'Play asset'}
      >
        <Icon
          as={isPlaying ? PauseIcon : PlayIcon}
          size={14}
          className={isPlaying ? 'text-primary' : 'text-primary/80'}
        />
      </Pressable>
      <View className="flex-1 justify-center">
        <Text className="font-medium" numberOfLines={1}>
          {assetItem.name || 'Untitled asset'}
        </Text>
      </View>
      <Pressable
        onPress={onEditRange}
        className={cn(
          'flex-row items-center gap-1.5 rounded-full px-3 py-1 active:opacity-70',
          conflict ? 'bg-destructive/15' : range ? 'bg-primary/10' : 'bg-muted'
        )}
        accessibilityRole="button"
        accessibilityLabel={`Edit verse range for ${assetItem.name || 'asset'}`}
      >
        <Text
          className={cn(
            'text-xs font-medium',
            conflict
              ? 'text-destructive'
              : range
                ? 'text-primary'
                : 'text-muted-foreground'
          )}
        >
          {formatRange(range, formatVerse)}
        </Text>
        <Icon
          as={Edit3Icon}
          size={12}
          className={
            conflict
              ? 'text-destructive'
              : range
                ? 'text-primary'
                : 'text-muted-foreground'
          }
        />
      </Pressable>
    </View>
  );
}

function ValidationStep({
  selectedAssets,
  usedLabels,
  conflictingAssetIds,
  effectiveVerseRanges,
  playingAssetId,
  onPlayAsset,
  onEditRange,
  formatVerse
}: {
  selectedAssets: ImportAsset[];
  usedLabels: ImportWizardVerseLabel[];
  conflictingAssetIds: Set<string>;
  effectiveVerseRanges: Map<string, VerseRange>;
  playingAssetId: string | null;
  onPlayAsset: (assetId: string) => void;
  onEditRange: (assetId: string) => void;
  formatVerse?: (position: number) => string | null;
}) {
  return (
    <View className="flex-1 gap-4 p-6">
      <StepHeader
        title="Validate before import"
        description="Review selected assets and the verse labels already used in the destination quest."
      />

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 pb-4"
        contentInsetAdjustmentBehavior="automatic"
      >
        <View className="gap-2">
          <Text className="font-semibold">Selected assets</Text>
          {selectedAssets.map((assetItem) => {
            const range = effectiveVerseRanges.get(assetItem.id) ?? null;
            return (
              <ValidationAssetCard
                key={assetItem.id}
                assetItem={assetItem}
                conflict={conflictingAssetIds.has(assetItem.id)}
                isPlaying={playingAssetId === assetItem.id}
                onPlay={() => onPlayAsset(assetItem.id)}
                range={range}
                onEditRange={() => onEditRange(assetItem.id)}
                formatVerse={formatVerse}
              />
            );
          })}
        </View>

        {/* <View className="gap-3">
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
      </View> */}
      </ScrollView>
    </View>
  );
}

export function ImportWizard({
  visible,
  onClose,
  projectId,
  currentQuest,
  currentAssets,
  availableVerses,
  verseCount,
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
  const [hideWizardForDownloadOverlay, setHideWizardForDownloadOverlay] =
    React.useState(false);
  const [playingAssetId, setPlayingAssetId] = React.useState<string | null>(
    null
  );
  const [pendingVerseRanges, setPendingVerseRanges] = React.useState<
    Map<string, VerseRange>
  >(() => new Map());
  const [assetIdToAssignRange, setAssetIdToAssignRange] = React.useState<
    string | null
  >(null);
  const startedDiscoveryRef = React.useRef<string | null>(null);
  const isTransitioningToConfirmationRef = React.useRef(false);
  const confirmationTimerRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const stopCurrentSoundRef = React.useRef(audioContext.stopCurrentSound);

  React.useEffect(() => {
    stopCurrentSoundRef.current = audioContext.stopCurrentSound;
  }, [audioContext.stopCurrentSound]);

  React.useEffect(() => {
    return () => {
      if (confirmationTimerRef.current) {
        clearTimeout(confirmationTimerRef.current);
      }
    };
  }, []);

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
      setPendingVerseRanges(new Map());
      setAssetIdToAssignRange(null);
      setHideWizardForDownloadOverlay(false);
      return;
    }
    void stopCurrentSoundRef.current();
  }, [visible]);

  const compatibleQuestsQuery = useHybridData<ImportQuest>({
    dataType: 'import-compatible-quests',
    queryKeyParams: [projectId, currentQuest.id],
    offlineQuery: toCompilableQuery(
      system.db
        .select({
          ...getTableColumns(quest),
          creatorName: sql<
            string | null
          >`coalesce(${profile.username}, ${profile.email})`,
          assetCount: sql<number>`(
            select count(distinct ${quest_asset_link.asset_id})
            from ${quest_asset_link}
            inner join ${assetTable}
              on ${assetTable.id} = ${quest_asset_link.asset_id}
            where ${quest_asset_link.quest_id} = ${quest.id}
              and ${quest_asset_link.active} = 1
              and ${quest_asset_link.visible} = 1
              and ${assetTable.active} = 1
              and ${assetTable.visible} = 1
              and ${assetTable.source_asset_id} is null
          )`
        })
        .from(quest)
        .leftJoin(profile, eq(profile.id, quest.creator_id))
        .where(
          and(
            eq(quest.project_id, projectId),
            eq(quest.active, true),
            eq(quest.visible, true)
          )
        )
    ),
    cloudQueryFn: async () => {
      const { data: questsData, error: questsError } =
        await system.supabaseConnector.client
          .from('quest')
          .select('*')
          .eq('project_id', projectId)
          .eq('active', true)
          .eq('visible', true)
          .order('created_at', { ascending: false })
          .overrideTypes<Quest[]>();

      if (questsError) throw questsError;

      const questIds = questsData.map((questItem) => questItem.id);
      const creatorIds = Array.from(
        new Set(
          questsData
            .map((questItem) => questItem.creator_id)
            .filter((id): id is string => Boolean(id))
        )
      );

      const [
        { data: profilesData, error: profilesError },
        { data: assetCountsData, error: assetCountsError }
      ] = await Promise.all([
        creatorIds.length > 0
          ? system.supabaseConnector.client
              .from('profile')
              .select('id, username, email')
              .in('id', creatorIds)
          : Promise.resolve({ data: [], error: null }),
        questIds.length > 0
          ? system.supabaseConnector.client
              .from('quest_asset_link')
              .select(
                'quest_id, asset_id, asset:asset_id!inner(id, active, visible, source_asset_id)'
              )
              .in('quest_id', questIds)
              .eq('active', true)
              .eq('visible', true)
              .eq('asset.active', true)
              .eq('asset.visible', true)
              .is('asset.source_asset_id', null)
          : Promise.resolve({ data: [], error: null })
      ]);

      if (profilesError) throw profilesError;
      if (assetCountsError) throw assetCountsError;

      const profileMap = new Map(
        (profilesData ?? []).map((profileItem) => [
          profileItem.id,
          profileItem.username ?? profileItem.email ?? null
        ])
      );
      const assetIdsByQuest = new Map<string, Set<string>>();
      for (const item of assetCountsData ?? []) {
        if (!assetIdsByQuest.has(item.quest_id)) {
          assetIdsByQuest.set(item.quest_id, new Set());
        }
        assetIdsByQuest.get(item.quest_id)?.add(item.asset_id);
      }
      const assetCountMap = new Map(
        Array.from(assetIdsByQuest.entries()).map(([questId, assetIds]) => [
          questId,
          assetIds.size
        ])
      );

      return questsData.map((questItem) => ({
        ...questItem,
        creatorName: questItem.creator_id
          ? (profileMap.get(questItem.creator_id) ?? null)
          : null,
        assetCount: assetCountMap.get(questItem.id) ?? 0
      }));
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

  const effectiveVerseRanges = React.useMemo(() => {
    const ranges = new Map<string, VerseRange>();
    for (const assetItem of selectedAssets) {
      const range =
        pendingVerseRanges.get(assetItem.id) ??
        normalizeRange(assetItem.metadata);
      if (range) {
        ranges.set(assetItem.id, range);
      }
    }
    return ranges;
  }, [pendingVerseRanges, selectedAssets]);

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

  const existingVerseLabels = React.useMemo(() => {
    const labels = new Map<string, VerseRange>();
    for (const label of usedLabels) {
      const range = { from: label.from, to: label.to };
      labels.set(`${range.from}-${range.to}`, range);
    }
    return Array.from(labels.values()).sort((left, right) => {
      return left.from - right.from || left.to - right.to;
    });
  }, [usedLabels]);

  const conflictingAssetIds = React.useMemo(() => {
    const conflicts = new Set<string>();
    for (const assetItem of selectedAssets) {
      const range = effectiveVerseRanges.get(assetItem.id);
      if (!range) continue;

      const overlappingLabels = existingVerseLabels.filter((label) =>
        rangesOverlap(range, label)
      );
      if (overlappingLabels.length === 0) continue;

      const matchesExistingLabel = overlappingLabels.some(
        (label) => label.from === range.from && label.to === range.to
      );
      if (!matchesExistingLabel) {
        conflicts.add(assetItem.id);
      }
    }

    return conflicts;
  }, [effectiveVerseRanges, existingVerseLabels, selectedAssets]);

  const assignerExistingLabels = React.useMemo(() => {
    const labels = new Map<string, VerseRange>();

    for (const label of existingVerseLabels) {
      labels.set(`${label.from}-${label.to}`, label);
    }

    for (const [assetId, range] of effectiveVerseRanges) {
      if (assetId === assetIdToAssignRange) continue;
      labels.set(`${range.from}-${range.to}`, range);
    }

    return Array.from(labels.values()).sort((left, right) => {
      return left.from - right.from || left.to - right.to;
    });
  }, [assetIdToAssignRange, effectiveVerseRanges, existingVerseLabels]);

  const hasConflicts = conflictingAssetIds.size > 0;
  const activeVerseRange = assetIdToAssignRange
    ? (effectiveVerseRanges.get(assetIdToAssignRange) ?? null)
    : null;
  const getMaxAssignableTo = React.useCallback(
    (selectedFrom: number) => {
      const available = new Set(availableVerses);
      if (!available.has(selectedFrom)) return selectedFrom;

      let maxTo = selectedFrom;
      while (available.has(maxTo + 1)) {
        maxTo++;
      }
      return maxTo;
    },
    [availableVerses]
  );
  const currentStepIndex = IMPORT_STEPS.findIndex((item) => item.id === step);
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === IMPORT_STEPS.length - 1;
  const areAllAssetsSelected =
    sourceAssets.length > 0 &&
    sourceAssets.every((assetItem) => selectedAssetIds.has(assetItem.id));

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

  const toggleAllAssets = () => {
    setSelectedAssetIds(
      areAllAssetsSelected
        ? new Set()
        : new Set(sourceAssets.map((assetItem) => assetItem.id))
    );
  };

  const handleEditVerseRange = (assetId: string) => {
    setAssetIdToAssignRange(assetId);
  };

  const handleApplyVerseRange = (from: number, to: number) => {
    if (!assetIdToAssignRange) return;

    // Virtual only. Persist this range later on quest_asset_link.metadata.verse
    // when the import operation itself is implemented.
    setPendingVerseRanges((previous) => {
      const next = new Map(previous);
      next.set(assetIdToAssignRange, { from, to });
      return next;
    });
    setAssetIdToAssignRange(null);
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
      if (
        !currentUser?.id ||
        discoveryState.discoveredIds.questIds.length === 0
      ) {
        throw new Error('Missing user or discovered IDs');
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
    isTransitioningToConfirmationRef.current = false;
    setQuestIdToDownload(questId);
    setHideWizardForDownloadOverlay(true);
    setShowDiscoveryDrawer(true);
  };

  const handleCancelDiscovery = () => {
    discoveryState.cancel();
    if (questIdToDownload) {
      syncCallbackService.cancelCallback(questIdToDownload);
      setDownloadingQuestIds((prev) => {
        const next = new Set(prev);
        next.delete(questIdToDownload);
        return next;
      });
    }
    setShowDiscoveryDrawer(false);
    setHideWizardForDownloadOverlay(false);
    setQuestIdToDownload(null);
  };

  const handleDiscoveryContinue = () => {
    isTransitioningToConfirmationRef.current = true;
    setShowDiscoveryDrawer(false);
    if (confirmationTimerRef.current) {
      clearTimeout(confirmationTimerRef.current);
    }
    confirmationTimerRef.current = setTimeout(() => {
      setShowConfirmationModal(true);
      confirmationTimerRef.current = null;
    }, 350);
  };

  const handleConfirmDownload = async () => {
    isTransitioningToConfirmationRef.current = false;
    setShowConfirmationModal(false);
    setHideWizardForDownloadOverlay(false);
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
    isTransitioningToConfirmationRef.current = false;
    if (questIdToDownload) {
      syncCallbackService.cancelCallback(questIdToDownload);
      const questIdsToClear = discoveryState.discoveredIds.questIds;
      setDownloadingQuestIds((prev) => {
        const next = new Set(prev);
        questIdsToClear.forEach((id) => next.delete(id));
        return next;
      });
    }
    setShowConfirmationModal(false);
    setHideWizardForDownloadOverlay(false);
    setQuestIdToDownload(null);
  };

  const handleSelectQuest = (questId: string) => {
    setSelectedQuestId(questId);
    setSelectedAssetIds(new Set());
    setPendingVerseRanges(new Map());
    setAssetIdToAssignRange(null);
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
    <>
      <Modal
        visible={visible && !hideWizardForDownloadOverlay}
        transparent={false}
        animationType="slide"
        onRequestClose={onClose}
      >
        <View
          className="flex-1 bg-background"
          style={{ paddingTop: insets.top }}
        >
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

          <ImportProgressIndicator currentStep={step} />

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
                conflictingAssetIds={conflictingAssetIds}
                effectiveVerseRanges={effectiveVerseRanges}
                playingAssetId={playingAssetId}
                onPlayAsset={handlePlayAsset}
                onEditRange={handleEditVerseRange}
                formatVerse={formatVerse}
              />
            )}
          </View>

          {step === 'assets' && (
            <View className="px-6 pb-2 pt-0">
              <Pressable
                onPress={toggleAllAssets}
                disabled={sourceAssets.length === 0}
                className="flex-row items-center gap-2 self-start pt-0 disabled:opacity-50"
                accessibilityRole="checkbox"
                accessibilityState={{
                  checked: areAllAssetsSelected,
                  disabled: sourceAssets.length === 0
                }}
                accessibilityLabel="Select all assets"
              >
                <Icon
                  as={areAllAssetsSelected ? CheckSquareIcon : SquareIcon}
                  size={22}
                  className={
                    areAllAssetsSelected
                      ? 'text-primary'
                      : 'text-muted-foreground'
                  }
                />
                <Text className="font-medium">Select All</Text>
              </Pressable>
            </View>
          )}
          {step === 'validation' && hasConflicts && (
            <View className="flex-row items-center justify-center gap-2 px-6 pb-2 pt-0">
              {/* <View className="flex-row items-center gap-2 rounded-lg bg-destructive/10 px-3"> */}
              <Icon
                as={CircleAlertIcon}
                size={18}
                className="text-destructive"
              />
              <Text className="text-sm text-destructive">
                Resolve conflicts before proceeding.
              </Text>
              {/* </View> */}
            </View>
          )}
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
      </Modal>

      <Modal
        visible={assetIdToAssignRange !== null}
        transparent
        animationType="slide"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setAssetIdToAssignRange(null)}
      >
        <View className="flex-1 justify-end">
          <Pressable
            className="absolute inset-0 bg-black/50"
            onPress={() => setAssetIdToAssignRange(null)}
            accessibilityRole="button"
            accessibilityLabel="Close verse range selector"
          />
          <View
            className="gap-4 rounded-t-3xl bg-background px-4 pt-4"
            style={{ paddingBottom: insets.bottom + 16 }}
          >
            <View className="flex-row items-start justify-between gap-4 px-2">
              <View className="flex-1 gap-1">
                <Text className="text-lg font-semibold">
                  Assign verse label
                </Text>
                <Text className="text-sm text-muted-foreground">
                  This assignment will only be applied when the assets are
                  imported.
                </Text>
              </View>
              <Pressable
                onPress={() => setAssetIdToAssignRange(null)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close verse range selector"
              >
                <Icon as={XIcon} size={22} className="text-muted-foreground" />
              </Pressable>
            </View>
            {assetIdToAssignRange && (
              <VerseAssigner
                key={assetIdToAssignRange}
                availableVerses={availableVerses}
                existingLabels={assignerExistingLabels}
                verseCount={verseCount}
                selectedFrom={activeVerseRange?.from}
                selectedTo={activeVerseRange?.to}
                getMaxToForFrom={getMaxAssignableTo}
                onApply={handleApplyVerseRange}
                onCancel={() => setAssetIdToAssignRange(null)}
              />
            )}
          </View>
        </View>
      </Modal>

      <QuestDownloadDiscoveryDrawer
        isOpen={showDiscoveryDrawer}
        onOpenChange={(open) => {
          if (!open && !isTransitioningToConfirmationRef.current) {
            handleCancelDiscovery();
          }
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
    </>
  );
}
