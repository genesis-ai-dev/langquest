import { DrawerScrollView } from '@/components/ui/drawer';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Text } from '@/components/ui/text';
import { useAudio } from '@/contexts/AudioContext';
import {
  useBibleBrainBibles,
  type BibleBrainBible
} from '@/hooks/useBibleBrainBibles';
import {
  useBibleBrainContent,
  type BibleBrainAudioChapter,
  type BibleBrainVerse
} from '@/hooks/useBibleBrainContent';
import { useLocalStore } from '@/store/localStore';
import { getThemeColor } from '@/utils/styleUtils';
import { Ionicons } from '@expo/vector-icons';
import {
  BookOpenIcon,
  HeadphonesIcon,
  SearchIcon,
  TypeIcon
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  TouchableOpacity,
  View
} from 'react-native';
import { Dropdown } from 'react-native-element-dropdown';

const EMPTY_STRING_ARRAY: string[] = [];

// --- Verse highlighting from timestamps ---

function verseKeyFromTimestamps(
  chapter: BibleBrainAudioChapter,
  localSec: number
): string {
  if (!chapter.timestamps?.length) {
    return `${chapter.chapter}-0`;
  }

  let activeVerse = chapter.timestamps[0]!.verseStart;
  for (const ts of chapter.timestamps) {
    if (localSec >= ts.timestamp) {
      activeVerse = ts.verseStart;
    } else {
      break;
    }
  }
  return `${chapter.chapter}-${activeVerse}`;
}

function getActiveVerseKey(
  positionMs: number,
  audioChapters: BibleBrainAudioChapter[]
): string | null {
  if (!audioChapters.length) return null;

  let cumulativeMs = 0;
  for (const chapter of audioChapters) {
    const chapterDurationMs = chapter.duration * 1000;
    if (positionMs < cumulativeMs + chapterDurationMs) {
      const localSec = (positionMs - cumulativeMs) / 1000;
      return verseKeyFromTimestamps(chapter, localSec);
    }
    cumulativeMs += chapterDurationMs;
  }

  // Position exceeds reported durations (seek overshoot or rounding) --
  // clamp to the last chapter
  const last = audioChapters[audioChapters.length - 1]!;
  const localSec = (positionMs - (cumulativeMs - last.duration * 1000)) / 1000;
  return verseKeyFromTimestamps(last, localSec);
}

// --- Audio Player ---

function BibleAudioPlayer({
  audioUrls,
  audioId,
  savedPositionMs
}: {
  audioUrls: string[];
  audioId: string;
  savedPositionMs?: number;
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
      if (savedPositionMs && savedPositionMs > 0) {
        await setPosition(savedPositionMs);
      }
    } else {
      await playSoundSequence(audioUrls, audioId);
      if (savedPositionMs && savedPositionMs > 0) {
        await setPosition(savedPositionMs);
      }
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

// --- Translation Picker (searchable Dropdown) ---

interface DropdownItem {
  value: string;
  label: string;
  hasText: boolean;
  hasAudio: boolean;
  isRecent: boolean;
}

function TranslationPicker({
  bibles,
  selectedId,
  onSelect,
  recentIds
}: {
  bibles: BibleBrainBible[];
  selectedId: string | null;
  onSelect: (bible: BibleBrainBible) => void;
  recentIds: string[];
}) {
  const [search, setSearch] = useState('');

  const dropdownData = useMemo(() => {
    const recentSet = new Set(recentIds);
    const items: DropdownItem[] = bibles.map((b) => ({
      value: b.id,
      label: formatBibleLabel(b),
      hasText: b.hasText,
      hasAudio: b.hasAudio,
      isRecent: recentSet.has(b.id)
    }));

    // Sort: recent first (in order), then the rest by name
    items.sort((a, b) => {
      if (a.isRecent && !b.isRecent) return -1;
      if (!a.isRecent && b.isRecent) return 1;
      if (a.isRecent && b.isRecent) {
        return recentIds.indexOf(a.value) - recentIds.indexOf(b.value);
      }
      return a.label.localeCompare(b.label);
    });

    return items;
  }, [bibles, recentIds]);

  return (
    <View className="px-4 py-2">
      <Dropdown
        style={{
          height: 44,
          borderWidth: 1,
          borderRadius: 8,
          paddingHorizontal: 12,
          backgroundColor: getThemeColor('card'),
          borderColor: getThemeColor('border')
        }}
        placeholderStyle={{
          fontSize: 14,
          color: getThemeColor('muted-foreground')
        }}
        selectedTextStyle={{
          fontSize: 14,
          color: getThemeColor('foreground')
        }}
        containerStyle={{
          borderRadius: 8,
          overflow: 'hidden',
          borderWidth: 1,
          marginTop: 4,
          backgroundColor: getThemeColor('card'),
          borderColor: getThemeColor('border')
        }}
        dropdownPosition="auto"
        itemTextStyle={{
          fontSize: 14,
          color: getThemeColor('foreground')
        }}
        itemContainerStyle={{
          borderRadius: 6,
          overflow: 'hidden'
        }}
        activeColor={getThemeColor('accent')}
        data={dropdownData}
        search
        maxHeight={350}
        labelField="label"
        valueField="value"
        placeholder="Select translation..."
        value={selectedId}
        onChange={(item) => {
          const bible = bibles.find((b) => b.id === item.value);
          if (bible) onSelect(bible);
          setSearch('');
        }}
        renderInputSearch={(onSearchInternal) => (
          <View className="overflow-hidden border-b border-border">
            <Input
              value={search}
              onChangeText={(text) => {
                setSearch(text);
                onSearchInternal(text);
              }}
              placeholder="Search translations..."
              prefix={SearchIcon}
              size="sm"
              className="border-0"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        )}
        flatListProps={{
          style: { backgroundColor: getThemeColor('card') },
          keyboardShouldPersistTaps: 'handled' as const,
          nestedScrollEnabled: true
        }}
        renderLeftIcon={() => (
          <Icon
            as={BookOpenIcon}
            className="mr-2 text-muted-foreground"
            size={16}
          />
        )}
        renderItem={(item, selected) => (
          <View
            className={`flex-row items-center px-3 py-3 ${selected ? 'bg-accent' : ''}`}
          >
            <View className="flex-1">
              <Text
                className={`text-sm ${selected ? 'font-medium text-accent-foreground' : 'text-foreground'}`}
                numberOfLines={2}
              >
                {item.label}
              </Text>
              {item.isRecent && (
                <Text className="text-xs text-muted-foreground">
                  Recently used
                </Text>
              )}
            </View>
            <View className="ml-2 flex-row gap-1">
              {item.hasText && (
                <View className="rounded-full bg-secondary/50 px-1.5 py-0.5">
                  <Icon
                    as={TypeIcon}
                    size={10}
                    className="text-muted-foreground"
                  />
                </View>
              )}
              {item.hasAudio && (
                <View className="rounded-full bg-secondary/50 px-1.5 py-0.5">
                  <Icon
                    as={HeadphonesIcon}
                    size={10}
                    className="text-muted-foreground"
                  />
                </View>
              )}
            </View>
          </View>
        )}
      />
    </View>
  );
}

function formatBibleLabel(bible: BibleBrainBible): string {
  return bible.vname || bible.name;
}

// --- Verse Display with highlighting + onLayout for auto-scroll ---

function VerseDisplay({
  verses,
  activeVerseKey,
  onVerseLayout
}: {
  verses: BibleBrainVerse[];
  activeVerseKey: string | null;
  onVerseLayout: (key: string, y: number) => void;
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
      {verses.map((v) => {
        const key = `${v.chapter}-${v.verseStart}`;
        const isActive = activeVerseKey === key;
        return (
          <View
            key={key}
            onLayout={(e) => onVerseLayout(key, e.nativeEvent.layout.y)}
            className={`rounded px-1 py-0.5 ${isActive ? 'bg-primary/15' : ''}`}
          >
            <Text className="text-base leading-7">
              <Text className="text-xs font-bold text-primary">
                {v.verseStart}{' '}
              </Text>
              {v.verseText}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// --- Main Component ---

interface BibleReaderContentProps {
  projectId: string | undefined;
  fiaBookId: string | undefined;
  verseRange: string | undefined;
}

export function BibleReaderContent({
  projectId,
  fiaBookId,
  verseRange
}: BibleReaderContentProps) {
  const { bibles, isLoading: biblesLoading, error: biblesError } =
    useBibleBrainBibles(projectId);
  const [selectedBible, setSelectedBible] = useState<BibleBrainBible | null>(
    null
  );

  // Persistence
  const savedTranslation = useLocalStore(
    (s) => (projectId ? s.bibleTranslationByProject[projectId] : undefined)
  );
  const recentIds = useLocalStore(
    (s) =>
      projectId
        ? (s.bibleRecentTranslations[projectId] ?? EMPTY_STRING_ARRAY)
        : EMPTY_STRING_ARRAY
  );
  const setBibleTranslation = useLocalStore((s) => s.setBibleTranslation);
  const bibleAudioPositions = useLocalStore((s) => s.bibleAudioPositions);
  const setBibleAudioPosition = useLocalStore((s) => s.setBibleAudioPosition);

  // Auto-select: saved translation > best match > first
  useEffect(() => {
    if (bibles.length === 0 || selectedBible) return;

    if (savedTranslation) {
      const saved = bibles.find((b) => b.id === savedTranslation.bibleId);
      if (saved) {
        setSelectedBible(saved);
        return;
      }
    }

    const best = bibles.find((b) => b.hasText && b.hasAudio) ?? bibles[0]!;
    setSelectedBible(best);
  }, [bibles, selectedBible, savedTranslation]);

  const handleSelectBible = useCallback(
    (bible: BibleBrainBible) => {
      setSelectedBible(bible);
      if (projectId) {
        setBibleTranslation(projectId, {
          bibleId: bible.id,
          name: bible.name,
          vname: bible.vname,
          textFilesetId: bible.textFilesetId,
          audioFilesetId: bible.audioFilesetId,
          hasText: bible.hasText,
          hasAudio: bible.hasAudio
        });
      }
    },
    [projectId, setBibleTranslation]
  );

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

  // --- Audio state (single call) ---
  const {
    isPlaying,
    isPaused,
    currentAudioId,
    position
  } = useAudio({ stopOnUnmount: false });

  const isThisAudioActive =
    (isPlaying || isPaused) && currentAudioId === audioId;

  // --- Verse highlighting ---
  const activeVerseKey = useMemo(() => {
    if (!isThisAudioActive || !isPlaying || !content?.audio?.length) return null;
    return getActiveVerseKey(position, content.audio);
  }, [isThisAudioActive, isPlaying, position, content?.audio]);

  // --- Auto-scroll ---
  const scrollRef = useRef<any>(null);
  const verseOffsetsRef = useRef<Map<string, number>>(new Map());
  const lastScrolledVerseRef = useRef<string | null>(null);

  const handleVerseLayout = useCallback((key: string, y: number) => {
    verseOffsetsRef.current.set(key, y);
  }, []);

  useEffect(() => {
    if (!activeVerseKey || activeVerseKey === lastScrolledVerseRef.current) {
      return;
    }
    lastScrolledVerseRef.current = activeVerseKey;
    const y = verseOffsetsRef.current.get(activeVerseKey);
    if (y !== undefined) {
      scrollRef.current?.scrollTo?.({ y: Math.max(0, y - 40), animated: true });
    }
  }, [activeVerseKey]);

  // --- Audio position persistence ---
  const positionKey = `${selectedBible?.id}:${fiaBookId}:${verseRange}`;
  const savedPosition = bibleAudioPositions[positionKey];

  const prevPlayingRef = useRef(false);

  useEffect(() => {
    const wasPlaying = prevPlayingRef.current;
    const nowPaused = isPaused && currentAudioId === audioId;
    prevPlayingRef.current = isPlaying && currentAudioId === audioId;

    if (wasPlaying && nowPaused && position > 0) {
      setBibleAudioPosition(positionKey, position);
    }
  }, [
    isPaused,
    isPlaying,
    currentAudioId,
    audioId,
    position,
    positionKey,
    setBibleAudioPosition
  ]);

  // Save position on unmount
  useEffect(() => {
    return () => {
      const pos = prevPlayingRef.current ? position : 0;
      if (pos > 0) {
        setBibleAudioPosition(positionKey, pos);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionKey]);

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
        onSelect={handleSelectBible}
        recentIds={recentIds}
      />

      {selectedBible?.hasAudio && audioUrls.length > 0 && (
        <BibleAudioPlayer
          audioUrls={audioUrls}
          audioId={audioId}
          savedPositionMs={savedPosition}
        />
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
        <DrawerScrollView ref={scrollRef} style={{ flex: 1 }}>
          {content?.verses && content.verses.length > 0 ? (
            <VerseDisplay
              verses={content.verses}
              activeVerseKey={activeVerseKey}
              onVerseLayout={handleVerseLayout}
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
