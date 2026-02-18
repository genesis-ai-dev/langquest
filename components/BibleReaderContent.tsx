import { DrawerScrollView } from '@/components/ui/drawer';
import { Icon } from '@/components/ui/icon';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Text } from '@/components/ui/text';
import { useAudio } from '@/contexts/AudioContext';
import {
  useBibleBrainBibles,
  type BibleBrainBible
} from '@/hooks/useBibleBrainBibles';
import {
  useBibleBrainContent,
  type BibleBrainVerse
} from '@/hooks/useBibleBrainContent';
import { Ionicons } from '@expo/vector-icons';
import { BookOpenIcon, HeadphonesIcon, TypeIcon } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, TouchableOpacity, View } from 'react-native';

// --- Audio Player (mirrors StepAudioPlayer from FiaStepDrawer) ---

function BibleAudioPlayer({
  audioUrls,
  audioId
}: {
  audioUrls: string[];
  audioId: string;
}) {
  const {
    playSound,
    playSoundSequence,
    pauseSound,
    resumeSound,
    isPlaying,
    isPaused,
    currentAudioId,
    position,
    duration,
    setPosition
  } = useAudio();

  const isThisPlaying = isPlaying && currentAudioId === audioId;
  const isThisPaused = isPaused && currentAudioId === audioId;
  const isThisActive = isThisPlaying || isThisPaused;

  const handlePlayPause = async () => {
    if (audioUrls.length === 0) return;
    if (isThisPlaying) {
      await pauseSound();
    } else if (isThisPaused) {
      await resumeSound();
    } else if (audioUrls.length === 1) {
      await playSound(audioUrls[0]!, audioId);
    } else {
      await playSoundSequence(audioUrls, audioId);
    }
  };

  const handleSeek = (ms: number) => {
    void setPosition(ms);
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  if (audioUrls.length === 0) return null;

  const currentPos = isThisActive ? position : 0;
  const currentDur = isThisActive ? duration : 0;

  return (
    <View className="gap-1 border-b border-border bg-card px-4 py-2">
      <View className="flex-row items-center gap-3">
        <TouchableOpacity
          onPress={handlePlayPause}
          className="h-10 w-10 items-center justify-center rounded-full bg-primary"
        >
          <Ionicons
            name={isThisPlaying ? 'pause' : 'play'}
            size={20}
            color="white"
          />
        </TouchableOpacity>
        <View className="flex-1">
          <Slider
            minimumValue={0}
            maximumValue={currentDur || 1}
            value={currentPos}
            onValueChange={handleSeek}
            disabled={!isThisActive}
            animated={false}
          />
        </View>
      </View>
      <View className="flex-row justify-between px-1">
        <Text className="text-xs text-muted-foreground">
          {formatTime(currentPos)}
        </Text>
        {currentDur > 0 ? (
          <Text className="text-xs text-muted-foreground">
            {formatTime(currentDur)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// --- Translation Picker ---

function TranslationPicker({
  bibles,
  selectedId,
  onSelect,
  portalHost
}: {
  bibles: BibleBrainBible[];
  selectedId: string | null;
  onSelect: (bible: BibleBrainBible) => void;
  portalHost?: string;
}) {
  const selected = bibles.find((b) => b.id === selectedId);
  const selectedOption = selected
    ? { value: selected.id, label: selected.vname || selected.name }
    : undefined;

  return (
    <View className="px-4 py-2">
      <Select
        value={selectedOption}
        onValueChange={(option) => {
          if (!option) return;
          const bible = bibles.find((b) => b.id === option.value);
          if (bible) onSelect(bible);
        }}
      >
        <SelectTrigger className="flex-row items-center gap-2">
          <Icon as={BookOpenIcon} size={16} className="text-muted-foreground" />
          <SelectValue
            className="native:text-sm flex-1 text-sm"
            placeholder="Select translation..."
          />
        </SelectTrigger>
        <SelectContent className="max-w-[90vw]" portalHost={portalHost}>
          {bibles.map((bible) => (
            <SelectItem
              key={bible.id}
              value={bible.id}
              label={formatBibleLabel(bible)}
            />
          ))}
        </SelectContent>
      </Select>
    </View>
  );
}

function formatBibleLabel(bible: BibleBrainBible): string {
  const name = bible.vname || bible.name;
  const badges: string[] = [];
  if (bible.hasText) badges.push('Text');
  if (bible.hasAudio) badges.push('Audio');
  return badges.length > 0 ? `${name} [${badges.join(', ')}]` : name;
}

// --- Verse Display ---

function VerseDisplay({
  verses,
  activeVerse
}: {
  verses: BibleBrainVerse[];
  activeVerse: number | null;
}) {
  if (verses.length === 0) {
    return (
      <View className="items-center justify-center p-8">
        <Text className="text-muted-foreground">
          No text available for this translation.
        </Text>
      </View>
    );
  }

  return (
    <View className="px-4 py-3">
      <Text className="text-base leading-7">
        {verses.map((v) => (
          <Text
            key={`${v.chapter}-${v.verseStart}`}
            className={
              activeVerse === v.verseStart
                ? 'bg-primary/20 text-base leading-7'
                : 'text-base leading-7'
            }
          >
            <Text className="text-xs font-bold text-primary">
              {v.verseStart}{' '}
            </Text>
            {v.verseText}{' '}
          </Text>
        ))}
      </Text>
    </View>
  );
}

// --- Capability badges ---

function CapabilityBadges({ bible }: { bible: BibleBrainBible | undefined }) {
  if (!bible) return null;
  return (
    <View className="flex-row gap-2 px-4 pb-1">
      {bible.hasText && (
        <View className="flex-row items-center gap-1 rounded-full bg-secondary/50 px-2 py-0.5">
          <Icon as={TypeIcon} size={12} className="text-muted-foreground" />
          <Text className="text-xs text-muted-foreground">Text</Text>
        </View>
      )}
      {bible.hasAudio && (
        <View className="flex-row items-center gap-1 rounded-full bg-secondary/50 px-2 py-0.5">
          <Icon
            as={HeadphonesIcon}
            size={12}
            className="text-muted-foreground"
          />
          <Text className="text-xs text-muted-foreground">Audio</Text>
        </View>
      )}
    </View>
  );
}

// --- Main Component ---

interface BibleReaderContentProps {
  projectId: string | undefined;
  fiaBookId: string | undefined;
  verseRange: string | undefined;
  portalHost?: string;
}

export function BibleReaderContent({
  projectId,
  fiaBookId,
  verseRange,
  portalHost
}: BibleReaderContentProps) {
  const { bibles, isLoading: biblesLoading, error: biblesError } =
    useBibleBrainBibles(projectId);
  const [selectedBible, setSelectedBible] = useState<BibleBrainBible | null>(
    null
  );

  // Auto-select first bible with both text + audio when list loads
  useEffect(() => {
    if (bibles.length > 0 && !selectedBible) {
      const best =
        bibles.find((b) => b.hasText && b.hasAudio) ?? bibles[0]!;
      setSelectedBible(best);
    }
  }, [bibles, selectedBible]);

  const {
    data: content,
    isLoading: contentLoading,
    error: contentError
  } = useBibleBrainContent(
    selectedBible?.textFilesetId,
    selectedBible?.audioFilesetId,
    fiaBookId,
    verseRange
  );

  const audioUrls = useMemo(
    () => (content?.audio ?? []).map((a) => a.url).filter(Boolean),
    [content?.audio]
  );

  const audioId = `bible-${selectedBible?.id}-${fiaBookId}-${verseRange}`;

  // Determine active verse from timestamps + audio position
  // (simplified: no active tracking for now, can enhance later)
  const activeVerse: number | null = null;

  // Loading states
  if (biblesLoading) {
    return (
      <View className="flex-1 items-center justify-center p-8">
        <ActivityIndicator size="large" />
        <Text className="mt-3 text-muted-foreground">
          Loading translations...
        </Text>
      </View>
    );
  }

  if (biblesError) {
    return (
      <View className="flex-1 items-center justify-center p-8">
        <Text className="text-destructive">
          Could not load Bible translations.
        </Text>
        <Text className="mt-1 text-sm text-muted-foreground">
          {biblesError instanceof Error ? biblesError.message : 'Unknown error'}
        </Text>
      </View>
    );
  }

  if (bibles.length === 0) {
    return (
      <View className="flex-1 items-center justify-center p-8">
        <Text className="text-muted-foreground">
          No Bible translations available for this language.
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <TranslationPicker
        bibles={bibles}
        selectedId={selectedBible?.id ?? null}
        onSelect={setSelectedBible}
        portalHost={portalHost}
      />
      <CapabilityBadges bible={selectedBible ?? undefined} />

      {selectedBible?.hasAudio && audioUrls.length > 0 && (
        <BibleAudioPlayer audioUrls={audioUrls} audioId={audioId} />
      )}

      {contentLoading ? (
        <View className="flex-1 items-center justify-center p-8">
          <ActivityIndicator size="small" />
          <Text className="mt-2 text-sm text-muted-foreground">
            Loading passage...
          </Text>
        </View>
      ) : contentError ? (
        <View className="flex-1 items-center justify-center p-8">
          <Text className="text-destructive">
            Could not load passage content.
          </Text>
        </View>
      ) : (
        <DrawerScrollView style={{ flex: 1 }}>
          {content?.verses && content.verses.length > 0 ? (
            <VerseDisplay
              verses={content.verses}
              activeVerse={activeVerse}
            />
          ) : selectedBible?.hasText ? (
            <View className="items-center justify-center p-8">
              <Text className="text-muted-foreground">
                No text found for this passage.
              </Text>
            </View>
          ) : (
            <View className="items-center justify-center p-8">
              <Text className="text-muted-foreground">
                This translation has audio only.
              </Text>
            </View>
          )}
        </DrawerScrollView>
      )}
    </View>
  );
}
