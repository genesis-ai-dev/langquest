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
import type { BibleBrainBible } from '@/hooks/useBibleBrainBibles';
import { useBibleBrainBibles } from '@/hooks/useBibleBrainBibles';
import {
  useBibleBookDownload,
  type BookDownloadStatus
} from '@/hooks/useBibleBookDownload';
import type { FiaBook } from '@/hooks/useFiaBooks';
import { cn, useThemeColor } from '@/utils/styleUtils';
import {
  AlertCircleIcon,
  BookOpenIcon,
  CheckCircle2Icon,
  HeadphonesIcon,
  TypeIcon
} from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, Switch, TouchableOpacity, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

function ProgressRing({
  progress,
  size = 40,
  strokeWidth = 3
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
}) {
  const primaryColor = useThemeColor('primary');
  const mutedColor = useThemeColor('border');
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - Math.min(progress, 1));

  return (
    <Svg width={size} height={size}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={mutedColor}
        strokeWidth={strokeWidth}
        fill="none"
      />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={primaryColor}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

const PHASE_LABELS = {
  'downloading-bible': 'Bible content',
  'downloading-fia': 'Guide content'
} as const;

function StatusDisplay({ status, onReset }: { status: BookDownloadStatus; onReset: () => void }) {
  if (status.phase === 'downloading-bible' || status.phase === 'downloading-fia') {
    const progress = status.total > 0 ? status.current / status.total : 0;
    const phaseLabel = PHASE_LABELS[status.phase];
    const stepNumber = status.phase === 'downloading-bible' ? 1 : 2;
    return (
      <View className="items-center gap-3 py-4">
        <ProgressRing progress={progress} size={56} strokeWidth={4} />
        <View className="items-center gap-1">
          <Text className="text-xs text-muted-foreground">
            Step {stepNumber}/2: {phaseLabel}
          </Text>
          <Text className="text-sm font-semibold">
            {status.current}/{status.total}
          </Text>
          <Text className="text-xs text-muted-foreground">
            {status.currentLabel}
          </Text>
        </View>
      </View>
    );
  }

  if (status.phase === 'done') {
    const parts: string[] = [];
    if (status.textCount > 0) parts.push(`${status.textCount} passages`);
    if (status.audioCount > 0) parts.push(`${status.audioCount} audio`);
    if (status.fiaCount > 0) parts.push(`${status.fiaCount} guide sections`);

    return (
      <View className="items-center gap-3 py-4">
        <View className="h-14 w-14 items-center justify-center rounded-full bg-green-500/15">
          <Icon as={CheckCircle2Icon} size={32} className="text-green-600 dark:text-green-400" />
        </View>
        <View className="items-center gap-1">
          <Text className="text-sm font-semibold text-green-700 dark:text-green-400">
            Download complete
          </Text>
          <Text className="text-xs text-muted-foreground">
            {parts.join(', ')}
          </Text>
        </View>
        <Button variant="outline" size="sm" onPress={onReset}>
          <Text>Download another</Text>
        </Button>
      </View>
    );
  }

  if (status.phase === 'error') {
    return (
      <View className="items-center gap-3 py-4">
        <View className="h-14 w-14 items-center justify-center rounded-full bg-destructive/15">
          <Icon as={AlertCircleIcon} size={32} className="text-destructive" />
        </View>
        <View className="items-center gap-1">
          <Text className="text-sm font-semibold text-destructive">
            Download failed
          </Text>
          <Text className="text-center text-xs text-muted-foreground">
            Completed {status.completed}/{status.total} — {status.message}
          </Text>
        </View>
        <Button variant="outline" size="sm" onPress={onReset}>
          <Text>Try again</Text>
        </Button>
      </View>
    );
  }

  return null;
}

function TranslationRow({
  bible,
  onSelect,
  disabled
}: {
  bible: BibleBrainBible;
  onSelect: (bible: BibleBrainBible) => void;
  disabled: boolean;
}) {
  const label = bible.vname || bible.name;

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
      </View>
      <View className="flex-row items-center gap-1.5">
        {bible.hasText && (
          <View className="rounded-full bg-secondary/50 px-1.5 py-0.5">
            <Icon as={TypeIcon} size={10} className="text-muted-foreground" />
          </View>
        )}
        {bible.hasAudio && (
          <View className="rounded-full bg-secondary/50 px-1.5 py-0.5">
            <Icon as={HeadphonesIcon} size={10} className="text-muted-foreground" />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

interface BibleBookDownloadDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  book: FiaBook;
}

export function BibleBookDownloadDrawer({
  open,
  onOpenChange,
  projectId,
  book
}: BibleBookDownloadDrawerProps) {
  const primaryColor = useThemeColor('primary');
  const { bibles, isLoading: biblesLoading } = useBibleBrainBibles(projectId);
  const { status, downloadBook, cancel, reset } = useBibleBookDownload();
  const [includeAudio, setIncludeAudio] = React.useState(true);

  const isDownloading =
    status.phase === 'downloading-bible' || status.phase === 'downloading-fia';

  const handleSelect = (bible: BibleBrainBible) => {
    void downloadBook(bible, book.pericopes, book.id, projectId, {
      includeAudio
    });
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen && isDownloading) {
      cancel();
    }
    if (!nextOpen) {
      reset();
    }
    onOpenChange(nextOpen);
  };

  return (
    <Drawer open={open} onOpenChange={handleClose}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Download Bible for {book.title}</DrawerTitle>
          <DrawerDescription>
            {book.pericopes.length} passages — text
            {includeAudio ? ' + audio' : ' only'}
          </DrawerDescription>
        </DrawerHeader>

        {status.phase !== 'idle' ? (
          <View className="px-4">
            <StatusDisplay status={status} onReset={reset} />
          </View>
        ) : biblesLoading ? (
          <View className="items-center py-8">
            <ActivityIndicator size="large" color={primaryColor} />
            <Text className="mt-3 text-sm text-muted-foreground">
              Loading translations...
            </Text>
          </View>
        ) : bibles.length === 0 ? (
          <View className="items-center py-8">
            <Text className="text-sm text-muted-foreground">
              No translations available for this language.
            </Text>
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
              <View className="gap-2 px-4 pb-6">
                {bibles
                  .filter((b) => b.hasText || b.hasAudio)
                  .map((bible) => (
                    <TranslationRow
                      key={bible.id}
                      bible={bible}
                      onSelect={handleSelect}
                      disabled={isDownloading}
                    />
                  ))}
              </View>
            </DrawerScrollView>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
