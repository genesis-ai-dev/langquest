import { CheckpointMediaPlayer } from '@/components/CheckpointMediaPlayer';
import { Button } from '@/components/ui/button';
import { DrawerScrollView } from '@/components/ui/drawer';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useAudio } from '@/contexts/AudioContext';
import {
  useBibleBrainBibles,
  type BibleBrainBible
} from '@/hooks/useBibleBrainBibles';
import {
  useBibleBrainContent,
  type BibleBrainAudioChapter,
  type BibleBrainCopyright,
  type BibleBrainVerse
} from '@/hooks/useBibleBrainContent';
import {
  useLocalStore,
  type BibleDownloadTranslation
} from '@/store/localStore';
import { cn, getThemeColor, useThemeColor } from '@/utils/styleUtils';
import {
  BookOpenIcon,
  HeadphonesIcon,
  PlusIcon,
  SearchIcon,
  TypeIcon
} from 'lucide-react-native';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import {
  ActivityIndicator,
  Linking,
  TouchableOpacity,
  View
} from 'react-native';
import { Dropdown } from 'react-native-element-dropdown';

const EMPTY_STRING_ARRAY: string[] = [];
const EMPTY_DOWNLOAD_TRANSLATIONS: BibleDownloadTranslation[] = [];

const NT_BOOKS = new Set([
  'MAT',
  'MRK',
  'LUK',
  'JHN',
  'ACT',
  'ROM',
  '1CO',
  '2CO',
  'GAL',
  'EPH',
  'PHP',
  'COL',
  '1TH',
  '2TH',
  '1TI',
  '2TI',
  'TIT',
  'PHM',
  'HEB',
  'JAS',
  '1PE',
  '2PE',
  '1JN',
  '2JN',
  '3JN',
  'JUD',
  'REV'
]);

function guessTestament(bookId: string): 'OT' | 'NT' {
  return NT_BOOKS.has(bookId.toUpperCase()) ? 'NT' : 'OT';
}

const AUDIO_SEEK_STEP_MS = 10000;

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

// --- Translation Picker (searchable Dropdown) ---

interface DropdownItem {
  value: string;
  label: string;
  hasText: boolean;
  hasAudio: boolean;
  textTestaments: string[];
  audioTestaments: string[];
  isRecent: boolean;
  languageName: string;
}

function TranslationPicker({
  bibles,
  selectedId,
  onSelect,
  recentIds,
  onAddPress
}: {
  bibles: BibleBrainBible[];
  selectedId: string | null;
  onSelect: (bible: BibleBrainBible) => void;
  recentIds: string[];
  onAddPress: () => void;
}) {
  const [search, setSearch] = useState('');

  const dropdownData = useMemo(() => {
    const recentSet = new Set(recentIds);
    const items: DropdownItem[] = bibles.map((b) => ({
      value: b.id,
      label: formatBibleLabel(b),
      hasText: b.hasText,
      hasAudio: b.hasAudio,
      textTestaments: b.textTestaments ?? [],
      audioTestaments: b.audioTestaments ?? [],
      isRecent: recentSet.has(b.id),
      languageName: b.languageName || b.iso
    }));

    const langOrder = new Map<string, number>();
    for (const id of recentIds) {
      const item = items.find((i) => i.value === id);
      if (item && !langOrder.has(item.languageName)) {
        langOrder.set(item.languageName, langOrder.size);
      }
    }
    for (const item of items) {
      if (!langOrder.has(item.languageName)) {
        langOrder.set(item.languageName, langOrder.size);
      }
    }

    items.sort((a, b) => {
      const langA = langOrder.get(a.languageName) ?? 0;
      const langB = langOrder.get(b.languageName) ?? 0;
      if (langA !== langB) return langA - langB;
      const recentA = recentIds.indexOf(a.value);
      const recentB = recentIds.indexOf(b.value);
      if (recentA !== -1 && recentB !== -1) return recentA - recentB;
      if (recentA !== -1) return -1;
      if (recentB !== -1) return 1;
      return a.label.localeCompare(b.label);
    });

    return items;
  }, [bibles, recentIds]);

  const categoryHeaders = useMemo(() => {
    const headers = new Set<string>();
    let lastLang = '';
    for (const item of dropdownData) {
      if (item.languageName !== lastLang) {
        headers.add(item.value);
        lastLang = item.languageName;
      }
    }
    return headers;
  }, [dropdownData]);

  return (
    <View className="flex-row items-center gap-2">
      <View className="flex-1">
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
            <View>
              {categoryHeaders.has(item.value) && (
                <View className="border-t border-border bg-muted/50 px-3 py-1.5">
                  <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {item.languageName}
                  </Text>
                </View>
              )}
              <View
                className={cn(
                  'flex-row items-center px-3 py-3',
                  selected && 'bg-accent'
                )}
              >
                <View className="flex-1">
                  <Text
                    className={cn(
                      'text-sm',
                      selected
                        ? 'font-medium text-accent-foreground'
                        : 'text-foreground'
                    )}
                    numberOfLines={2}
                  >
                    {item.label}
                  </Text>
                </View>
                <View className="ml-2 flex-row gap-1">
                  {item.hasText && (
                    <View className="flex-row items-center gap-0.5 rounded-full bg-secondary/50 px-1.5 py-0.5">
                      <Icon
                        as={TypeIcon}
                        size={10}
                        className="text-muted-foreground"
                      />
                      {item.textTestaments.length === 1 && (
                        <Text className="text-[9px] text-muted-foreground">
                          {item.textTestaments[0]}
                        </Text>
                      )}
                    </View>
                  )}
                  {item.hasAudio && (
                    <View className="flex-row items-center gap-0.5 rounded-full bg-secondary/50 px-1.5 py-0.5">
                      <Icon
                        as={HeadphonesIcon}
                        size={10}
                        className="text-muted-foreground"
                      />
                      {item.audioTestaments.length === 1 && (
                        <Text className="text-[9px] text-muted-foreground">
                          {item.audioTestaments[0]}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              </View>
            </View>
          )}
        />
      </View>
      <TouchableOpacity
        onPress={onAddPress}
        className="h-11 w-11 items-center justify-center rounded-lg border border-border bg-card"
        hitSlop={8}
      >
        <Icon as={PlusIcon} size={18} className="text-primary" />
      </TouchableOpacity>
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
            className={cn('rounded px-1 py-0.5', isActive && 'bg-primary/15')}
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

// --- Copyright Notice ---

function CopyrightNotice({
  copyright
}: {
  copyright: BibleBrainCopyright | null;
}) {
  if (!copyright?.copyright) return null;

  const isPublicDomain =
    copyright.copyright.toLowerCase().includes('public domain');

  return (
    <View className="px-4 py-3">
      <Text className="text-xs leading-5 text-muted-foreground">
        {copyright.copyright}
      </Text>
      {!isPublicDomain &&
        copyright.organizations
          .filter((org) => org.url)
          .map((org) => (
          <Button
            key={org.name}
            variant="plain"
            size="sm"
            className="mt-2 self-start px-0"
            onPress={() => Linking.openURL(org.url!)}
          >
            <Text className="native:text-xs text-xs text-primary">
              {org.name}
            </Text>
          </Button>
        ))}
    </View>
  );
}

// --- Main Component ---

interface BibleReaderContentProps {
  projectId: string | undefined;
  pericopeId: string | undefined;
  fiaBookId: string | undefined;
  verseRange: string | undefined;
  onOpenTranslationDrawer?: () => void;
}

export function BibleReaderContent({
  projectId,
  pericopeId,
  fiaBookId,
  verseRange,
  onOpenTranslationDrawer
}: BibleReaderContentProps) {
  const {
    bibles: apiBibles,
    isLoading: biblesLoading,
    error: biblesError
  } = useBibleBrainBibles(projectId);
  const [selectedBible, setSelectedBible] = useState<BibleBrainBible | null>(
    null
  );
  // Saved translations from the store (user-curated list)
  const savedDownloads = useLocalStore((s) =>
    projectId
      ? (s.bibleDownloadTranslations[projectId] ?? EMPTY_DOWNLOAD_TRANSLATIONS)
      : EMPTY_DOWNLOAD_TRANSLATIONS
  );

  // When the user has curated translations, show those; otherwise show all API bibles
  const displayBibles: BibleBrainBible[] = useMemo(() => {
    if (savedDownloads.length > 0) {
      return savedDownloads.map((t) => ({
        id: t.bibleId,
        name: t.name,
        vname: t.vname,
        hasText: t.hasText,
        hasAudio: t.hasAudio,
        textTestaments: t.textTestaments ?? [],
        audioTestaments: t.audioTestaments ?? [],
        iso: t.iso,
        languageName: t.languageName
      }));
    }
    return apiBibles;
  }, [savedDownloads, apiBibles]);

  // Persistence
  const savedTranslation = useLocalStore((s) =>
    projectId ? s.bibleTranslationByProject[projectId] : undefined
  );
  const recentIds = useLocalStore((s) =>
    projectId
      ? (s.bibleRecentTranslations[projectId] ?? EMPTY_STRING_ARRAY)
      : EMPTY_STRING_ARRAY
  );
  const setBibleTranslation = useLocalStore((s) => s.setBibleTranslation);

  // Auto-select: saved translation > best match > first
  useEffect(() => {
    if (displayBibles.length === 0) return;

    if (savedTranslation) {
      const saved = displayBibles.find(
        (b) => b.id === savedTranslation.bibleId
      );
      if (saved) {
        if (saved.id !== selectedBible?.id) {
          setSelectedBible(saved);
        }
        return;
      }
    }

    if (
      !selectedBible ||
      !displayBibles.some((b) => b.id === selectedBible.id)
    ) {
      const best =
        displayBibles.find((b) => b.hasText && b.hasAudio) ?? displayBibles[0]!;
      if (best.id !== selectedBible?.id) {
        setSelectedBible(best);
      }
    }
  }, [displayBibles, selectedBible, savedTranslation]);

  const handleSelectBible = useCallback(
    (bible: BibleBrainBible) => {
      setSelectedBible(bible);
      if (projectId) {
        setBibleTranslation(projectId, {
          bibleId: bible.id,
          name: bible.name,
          vname: bible.vname,
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
  } = useBibleBrainContent(selectedBible?.id, fiaBookId, verseRange);

  const passageLoadingColor = useThemeColor('primary');

  const audioUrls = useMemo(
    () => (content?.audio ?? []).map((a) => a.url).filter(Boolean),
    [content?.audio]
  );

  const bibleModelKeyPart = selectedBible?.id
    ? `bible-model:${selectedBible.id}`
    : 'bible-model:default';
  const bibleAudioCheckpointKey =
    projectId && pericopeId
      ? `${projectId}:${pericopeId}:${bibleModelKeyPart}`
      : null;

  const audioContext = useAudio({
    stopOnUnmount: false
  });

  const { isPlaying, isPaused, currentAudioId, position } = audioContext;

  const isThisAudioActive =
    (isPlaying || isPaused) && currentAudioId === bibleAudioCheckpointKey;

  // --- Verse highlighting ---
  const activeVerseKey = useMemo(() => {
    if (!isThisAudioActive || !isPlaying || !content?.audio?.length)
      return null;
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

  // Loading states
  if (biblesLoading && displayBibles.length === 0) {
    return (
      <View className="flex-1 items-center justify-center p-8">
        <ActivityIndicator size="large" />
        <Text className="mt-3 text-muted-foreground">
          Loading translations...
        </Text>
      </View>
    );
  }

  if (biblesError && displayBibles.length === 0) {
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

  if (displayBibles.length === 0) {
    return (
      <View className="flex-1 items-center justify-center p-8">
        <Text className="text-muted-foreground">
          No Bible translations available.
        </Text>
        <Text className="mt-1 text-sm text-muted-foreground">
          Tap the + button to add translations.
        </Text>
        <TouchableOpacity
          onPress={onOpenTranslationDrawer}
          className="mt-4 h-11 w-11 items-center justify-center rounded-lg border border-border bg-card"
        >
          <Icon as={PlusIcon} size={18} className="text-primary" />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex flex-1 flex-col gap-2">
      <TranslationPicker
        bibles={displayBibles}
        selectedId={selectedBible?.id ?? null}
        onSelect={handleSelectBible}
        recentIds={recentIds}
        onAddPress={onOpenTranslationDrawer ?? (() => {})}
      />

      {selectedBible?.hasAudio && audioUrls.length > 0 && (
        <CheckpointMediaPlayer
          className="rounded-none border-0 border-b border-border bg-card px-4 py-2"
          title={formatBibleLabel(selectedBible)}
          checkpointKey={bibleAudioCheckpointKey}
          audioUris={audioUrls}
          seekStepMs={AUDIO_SEEK_STEP_MS}
        />
      )}

      {contentLoading ? (
        <View className="flex-1 items-center justify-center p-8">
          <ActivityIndicator color={passageLoadingColor} size="small" />
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
          ) : (
            <View className="items-center justify-center p-8">
              <Text className="text-center text-muted-foreground">
                {(() => {
                  const testament = fiaBookId
                    ? guessTestament(fiaBookId)
                    : null;
                  const testaments = selectedBible?.textTestaments ?? [];
                  if (
                    testament &&
                    testaments.length > 0 &&
                    !testaments.includes(testament)
                  ) {
                    const available = testaments.join(' & ');
                    return `This translation only has text for the ${available === 'OT' ? 'Old' : available === 'NT' ? 'New' : available} Testament.`;
                  }
                  if (!selectedBible?.hasText) {
                    const audioTs = selectedBible?.audioTestaments ?? [];
                    if (
                      testament &&
                      audioTs.length > 0 &&
                      !audioTs.includes(testament)
                    ) {
                      const available = audioTs.join(' & ');
                      return `This translation only has audio for the ${available === 'OT' ? 'Old' : available === 'NT' ? 'New' : available} Testament.`;
                    }
                    if (selectedBible?.hasAudio) {
                      return 'This translation has audio only.';
                    }
                    return 'No content available for this translation.';
                  }
                  return 'No text found for this passage.';
                })()}
              </Text>
            </View>
          )}
          <CopyrightNotice copyright={content?.copyright ?? null} />
        </DrawerScrollView>
      )}
    </View>
  );
}
