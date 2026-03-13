import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerScrollView,
  DrawerTitle
} from '@/components/ui/drawer';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/contexts/AuthContext';
import type { BibleBrainBible } from '@/hooks/useBibleBrainBibles';
import { useBibleBrainBibles } from '@/hooks/useBibleBrainBibles';
import type { BibleBrainContentResponse } from '@/hooks/useBibleBrainContent';
import type { FiaPericope } from '@/hooks/useFiaBooks';
import { useLocalStore } from '@/store/localStore';
import {
  cacheBibleText,
  downloadBibleAudio,
  isBibleAudioCached,
  isBibleTextCached
} from '@/utils/bible-cache';
import {
  fetchAndCacheFiaPericope,
  isFiaPericopeCached
} from '@/utils/fia-cache';
import { cn, useThemeColor } from '@/utils/styleUtils';
import {
  AlertCircleIcon,
  BookOpenIcon,
  CheckCircle2Icon,
  HeadphonesIcon,
  SkipForwardIcon,
  TypeIcon
} from 'lucide-react-native';
import React from 'react';
import {
  ActivityIndicator,
  Switch,
  TouchableOpacity,
  View
} from 'react-native';

type DownloadPhase = 'idle' | 'downloading' | 'done' | 'error';

function parseFiaVerseRange(verseRange: string) {
  const match = verseRange.match(/^(\d+):(\d+)[a-z]?-(?:(\d+):)?(\d+)[a-z]?$/);
  if (!match) return null;
  return {
    startChapter: parseInt(match[1]!, 10),
    startVerse: parseInt(match[2]!, 10),
    endChapter: match[3] ? parseInt(match[3], 10) : parseInt(match[1]!, 10),
    endVerse: parseInt(match[4]!, 10)
  };
}

function TranslationRow({
  bible,
  onSelect,
  disabled,
  bookId,
  verseRange
}: {
  bible: BibleBrainBible;
  onSelect: (bible: BibleBrainBible) => void;
  disabled: boolean;
  bookId: string;
  verseRange: string;
}) {
  const label = bible.vname || bible.name;
  const hasTextCached = bible.textFilesetId
    ? isBibleTextCached(bible.textFilesetId, bookId, verseRange)
    : false;
  const hasAudioCached = bible.audioFilesetId
    ? isBibleAudioCached(bible.audioFilesetId, bookId, verseRange)
    : false;

  return (
    <TouchableOpacity
      onPress={() => onSelect(bible)}
      disabled={disabled}
      className={cn(
        'flex-row items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 active:bg-accent',
        disabled && 'opacity-50'
      )}
      activeOpacity={0.7}
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
        <Icon as={BookOpenIcon} size={18} className="text-primary" />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-medium" numberOfLines={2}>
          {label}
        </Text>
        {(hasTextCached || hasAudioCached) && (
          <Text className="text-xs text-green-600 dark:text-green-400">
            Already cached
          </Text>
        )}
      </View>
      <View className="flex-row items-center gap-1.5">
        {bible.hasText && (
          <View className="rounded-full bg-secondary/50 px-1.5 py-0.5">
            <Icon as={TypeIcon} size={10} className="text-muted-foreground" />
          </View>
        )}
        {bible.hasAudio && (
          <View className="rounded-full bg-secondary/50 px-1.5 py-0.5">
            <Icon
              as={HeadphonesIcon}
              size={10}
              className="text-muted-foreground"
            />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

interface PericopeBibleDownloadDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  pericope: FiaPericope | null;
  fiaBookId: string;
  onComplete: () => void;
  onSkip: () => void;
}

export function PericopeBibleDownloadDrawer({
  open,
  onOpenChange,
  projectId,
  pericope,
  fiaBookId,
  onComplete,
  onSkip
}: PericopeBibleDownloadDrawerProps) {
  const { session } = useAuth();
  const primaryColor = useThemeColor('primary');
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const { bibles, isLoading: biblesLoading } = useBibleBrainBibles(projectId);
  const setBibleTranslation = useLocalStore((s) => s.setBibleTranslation);

  const [phase, setPhase] = React.useState<DownloadPhase>('idle');
  const [includeAudio, setIncludeAudio] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState('');
  const [downloadLabel, setDownloadLabel] = React.useState('');

  const bookId = fiaBookId.toUpperCase();
  const parsed = pericope ? parseFiaVerseRange(pericope.verseRange) : null;

  React.useEffect(() => {
    if (open) {
      setPhase('idle');
      setErrorMessage('');
      setDownloadLabel('');
    }
  }, [open]);

  const handleSelect = async (bible: BibleBrainBible) => {
    if (!parsed || !supabaseUrl || !pericope) return;

    setPhase('downloading');
    setDownloadLabel('Downloading Bible content...');

    try {
      const textCached = bible.textFilesetId
        ? isBibleTextCached(bible.textFilesetId, bookId, pericope.verseRange)
        : false;
      const audioCached =
        includeAudio && bible.audioFilesetId
          ? isBibleAudioCached(
              bible.audioFilesetId,
              bookId,
              pericope.verseRange
            )
          : false;

      if (!textCached || (includeAudio && bible.hasAudio && !audioCached)) {
        const response = await fetch(
          `${supabaseUrl}/functions/v1/bible-brain-content`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session?.access_token ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({
              action: 'get-content',
              textFilesetId: bible.textFilesetId ?? null,
              audioFilesetId:
                includeAudio && bible.hasAudio
                  ? (bible.audioFilesetId ?? null)
                  : null,
              bookId,
              startChapter: parsed.startChapter,
              startVerse: parsed.startVerse,
              endChapter: parsed.endChapter,
              endVerse: parsed.endVerse
            })
          }
        );

        if (response.ok) {
          const data: BibleBrainContentResponse = await response.json();

          if (bible.textFilesetId && data.verses.length > 0 && !textCached) {
            await cacheBibleText(
              bible.textFilesetId,
              bookId,
              pericope.verseRange,
              data
            );
          }

          if (
            includeAudio &&
            bible.audioFilesetId &&
            data.audio.length > 0 &&
            !audioCached
          ) {
            setDownloadLabel('Downloading audio...');
            await downloadBibleAudio(
              bible.audioFilesetId,
              bookId,
              pericope.verseRange,
              data.audio
            );
          }
        }
      }

      setDownloadLabel('Downloading guide content...');
      if (!isFiaPericopeCached(pericope.id)) {
        await fetchAndCacheFiaPericope(
          projectId,
          pericope.id,
          session?.access_token
        );
      }

      setBibleTranslation(projectId, {
        bibleId: bible.id,
        name: bible.name,
        vname: bible.vname,
        textFilesetId: bible.textFilesetId,
        audioFilesetId: bible.audioFilesetId,
        hasText: bible.hasText,
        hasAudio: bible.hasAudio
      });

      setPhase('done');

      setTimeout(() => {
        onOpenChange(false);
        onComplete();
      }, 600);
    } catch (e) {
      setPhase('error');
      setErrorMessage(e instanceof Error ? e.message : 'Download failed');
    }
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen && phase === 'downloading') return;
    if (!nextOpen) {
      setPhase('idle');
      setErrorMessage('');
    }
    onOpenChange(nextOpen);
  };

  const handleSkip = () => {
    onOpenChange(false);
    onSkip();
  };

  return (
    <Drawer open={open} onOpenChange={handleClose}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>
            Download {pericope?.verseRange ?? 'Pericope'}
          </DrawerTitle>
          <DrawerDescription>
            Choose a Bible translation to download for this pericope
          </DrawerDescription>
        </DrawerHeader>

        {phase === 'downloading' ? (
          <View className="items-center gap-3 px-4 py-8">
            <ActivityIndicator size="large" color={primaryColor} />
            <Text className="text-sm text-muted-foreground">
              {downloadLabel}
            </Text>
          </View>
        ) : phase === 'done' ? (
          <View className="items-center gap-3 px-4 py-8">
            <View className="h-14 w-14 items-center justify-center rounded-full bg-green-500/15">
              <Icon
                as={CheckCircle2Icon}
                size={32}
                className="text-green-600 dark:text-green-400"
              />
            </View>
            <Text className="text-sm font-semibold text-green-700 dark:text-green-400">
              Ready to go!
            </Text>
          </View>
        ) : phase === 'error' ? (
          <View className="items-center gap-3 px-4 py-8">
            <View className="h-14 w-14 items-center justify-center rounded-full bg-destructive/15">
              <Icon
                as={AlertCircleIcon}
                size={32}
                className="text-destructive"
              />
            </View>
            <Text className="text-center text-sm text-destructive">
              {errorMessage}
            </Text>
            <View className="flex-row gap-3">
              <Button
                variant="outline"
                size="sm"
                onPress={() => setPhase('idle')}
              >
                <Text>Try again</Text>
              </Button>
              <Button variant="ghost" size="sm" onPress={handleSkip}>
                <Icon
                  as={SkipForwardIcon}
                  size={14}
                  className="mr-1 text-muted-foreground"
                />
                <Text className="text-muted-foreground">Skip</Text>
              </Button>
            </View>
          </View>
        ) : biblesLoading ? (
          <View className="items-center py-8">
            <ActivityIndicator size="large" color={primaryColor} />
            <Text className="mt-3 text-sm text-muted-foreground">
              Loading translations...
            </Text>
          </View>
        ) : bibles.length === 0 ? (
          <View className="items-center gap-3 py-8">
            <Text className="text-sm text-muted-foreground">
              No translations available.
            </Text>
            <Button variant="outline" size="sm" onPress={handleSkip}>
              <Text>Continue without Bible</Text>
            </Button>
          </View>
        ) : (
          <>
            <View className="flex-row items-center justify-between px-4 py-2">
              <Text className="text-sm text-muted-foreground">
                Include audio
              </Text>
              <Switch
                value={includeAudio}
                onValueChange={setIncludeAudio}
                trackColor={{ false: '#767577', true: primaryColor }}
              />
            </View>

            <DrawerScrollView style={{ maxHeight: 360 }}>
              <View className="gap-2 px-4 pb-4">
                {bibles
                  .filter((b) => b.hasText || b.hasAudio)
                  .map((bible) => (
                    <TranslationRow
                      key={bible.id}
                      bible={bible}
                      onSelect={handleSelect}
                      disabled={false}
                      bookId={bookId}
                      verseRange={pericope?.verseRange ?? ''}
                    />
                  ))}
              </View>
            </DrawerScrollView>

            <View className="items-center px-4 pb-4">
              <Button variant="ghost" size="sm" onPress={handleSkip}>
                <Icon
                  as={SkipForwardIcon}
                  size={14}
                  className="mr-1 text-muted-foreground"
                />
                <Text className="text-muted-foreground">
                  Skip — download later
                </Text>
              </Button>
            </View>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
