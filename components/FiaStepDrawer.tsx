import { BibleReaderContent } from '@/components/BibleReaderContent';
import { FiaIcon } from '@/components/icons/FiaIcon';
import { Icon } from '@/components/ui/icon';
import { Slider } from '@/components/ui/slider';
import { Text } from '@/components/ui/text';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerScrollView,
  DrawerTitle
} from '@/components/ui/drawer';
import { useAudio } from '@/contexts/AudioContext';
import { cn } from '@/utils/styleUtils';
import type {
  FiaBlock,
  FiaMap,
  FiaMediaItem,
  FiaPericopeStepsResponse,
  FiaStepData,
  FiaTerm
} from '@/hooks/useFiaPericopeSteps';
import { useFiaPericopeSteps } from '@/hooks/useFiaPericopeSteps';
import { Ionicons } from '@expo/vector-icons';
import {
  BookOpenIcon,
  CheckIcon,
  ChevronDownIcon,
  ClapperboardIcon,
  HeartIcon,
  ImageIcon,
  MessageCircleIcon,
  PuzzleIcon,
  TheaterIcon,
  UsersIcon
} from 'lucide-react-native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  TouchableOpacity,
  useWindowDimensions,
  View
} from 'react-native';
import { ReactNativeZoomableView } from '@openspacelabs/react-native-zoomable-view';

// --- Step config ---

const STEP_CONFIG = [
  { id: 'hear-and-heart', label: 'Hear', icon: HeartIcon },
  { id: 'setting-the-stage', label: 'Stage', icon: TheaterIcon },
  { id: 'defining-the-scenes', label: 'Scenes', icon: ClapperboardIcon },
  { id: 'embodying-the-text', label: 'Embody', icon: UsersIcon },
  { id: 'filling-the-gaps', label: 'Gaps', icon: PuzzleIcon },
  { id: 'speaking-the-word', label: 'Speak', icon: MessageCircleIcon }
] as const;

// --- Persisted state ---

export interface FiaDrawerState {
  activeTab: 'guide' | 'bible' | 'media';
  activeStep: string;
  completedSteps: string[];
}

export const INITIAL_FIA_DRAWER_STATE: FiaDrawerState = {
  activeTab: 'guide',
  activeStep: 'hear-and-heart',
  completedSteps: []
};

// --- Props ---

interface FiaStepDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | undefined;
  pericopeId: string | undefined;
  questName?: string;
  fiaBookId?: string;
  verseRange?: string;
  persistedState?: React.MutableRefObject<FiaDrawerState>;
}

// --- Audio Player ---

function StepAudioPlayer({ audioUrl }: { audioUrl: string | null }) {
  const {
    playSound,
    pauseSound,
    resumeSound,
    stopCurrentSound,
    isPlaying,
    isPaused,
    currentAudioId,
    position,
    duration,
    setPosition
  } = useAudio({ stopOnUnmount: false });

  const audioId = `fia-step-${audioUrl}`;
  const isThisPlaying = isPlaying && currentAudioId === audioId;
  const isThisPaused = isPaused && currentAudioId === audioId;
  const isThisActive = isThisPlaying || isThisPaused;

  const handlePlayPause = async () => {
    if (!audioUrl) return;
    if (isThisPlaying) {
      await pauseSound();
    } else if (isThisPaused) {
      await resumeSound();
    } else {
      await playSound(audioUrl, audioId);
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

  if (!audioUrl) return null;

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

// --- Media matching ---

interface MediaContext {
  mediaItems: FiaMediaItem[];
  terms: FiaTerm[];
  maps: FiaMap[];
  onBrowseMedia?: () => void;
}

function stripMarkSyntax(text: string): string {
  return text.replace(/\[([^\]]+)\]\{\.mark\}/g, '$1');
}

function getCalloutText(block: FiaBlock | string): string {
  if (typeof block === 'string') return stripMarkSyntax(block);
  if (typeof block.content === 'string') return stripMarkSyntax(block.content);
  if (Array.isArray(block.content)) {
    return stripMarkSyntax(block.content.map(getCalloutText).join(''));
  }
  if (block.content && typeof block.content === 'object') {
    return getCalloutText(block.content as FiaBlock);
  }
  return '';
}

type SingleMatch =
  | { type: 'image'; item: FiaMediaItem }
  | { type: 'map'; item: FiaMap }
  | { type: 'term'; item: FiaTerm };

function findAnchorRefs(
  block: FiaBlock | string
): Array<{ url: string; text: string }> {
  if (typeof block === 'string') return [];
  const results: Array<{ url: string; text: string }> = [];
  if (block.type === 'anchor' && typeof block.url === 'string') {
    results.push({
      url: block.url,
      text: typeof block.content === 'string' ? block.content : ''
    });
  }
  if (Array.isArray(block.content)) {
    for (const child of block.content) {
      results.push(...findAnchorRefs(child));
    }
  } else if (block.content && typeof block.content === 'object') {
    results.push(...findAnchorRefs(block.content as FiaBlock));
  }
  return results;
}

function resolveAnchors(block: FiaBlock, ctx: MediaContext): SingleMatch[] {
  const anchors = findAnchorRefs(block);
  const results: SingleMatch[] = [];
  for (const anchor of anchors) {
    const mediaMatch = anchor.url.match(/^#m(\d+)$/);
    if (mediaMatch) {
      const nodeId = mediaMatch[1]!;
      const item = ctx.mediaItems.find((m) => m.nodeId === nodeId);
      if (item) results.push({ type: 'image', item });
    }
    const mapMatch = anchor.url.match(/^#c(\d+)$/);
    if (mapMatch) {
      const nodeId = mapMatch[1]!;
      const item = ctx.maps.find((m) => m.nodeId === nodeId);
      if (item) results.push({ type: 'map', item });
    }
    const termMatch = anchor.url.match(/^#t(\d+)$/);
    if (termMatch) {
      const nodeId = termMatch[1]!;
      const item = ctx.terms.find((t) => t.nodeId === nodeId);
      if (item) results.push({ type: 'term', item });
    }
  }
  return results;
}

// --- Inline markup processing ---
// Handles [text]{.mark} patterns both within single strings
// AND spanning across multiple content array elements (with inline
// blocks like bold/emphasis interspersed).

const MARK_RE = /\[([^\]]+)\]\{\.mark\}/g;

function renderMarkedText(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  MARK_RE.lastIndex = 0;
  while ((match = MARK_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <Text
        key={match.index}
        className="bg-amber-200/40 text-base leading-7 dark:bg-amber-700/30"
      >
        {match[1]}
      </Text>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex === 0) return text;
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return <>{parts}</>;
}

type ContentItem = string | FiaBlock;

function preprocessMarkSpans(items: ContentItem[]): ContentItem[] {
  const result: ContentItem[] = [];
  let i = 0;
  while (i < items.length) {
    const item = items[i]!;
    if (typeof item !== 'string') {
      result.push(item);
      i++;
      continue;
    }

    MARK_RE.lastIndex = 0;
    if (MARK_RE.test(item)) {
      result.push(item);
      i++;
      continue;
    }

    const openIdx = item.lastIndexOf('[');
    if (openIdx === -1 || item.indexOf(']', openIdx) !== -1) {
      result.push(item);
      i++;
      continue;
    }

    let closeElemIdx = -1;
    for (let j = i + 1; j < items.length; j++) {
      const el = items[j];
      if (typeof el === 'string' && el.includes(']{.mark}')) {
        closeElemIdx = j;
        break;
      }
    }

    if (closeElemIdx === -1) {
      result.push(item);
      i++;
      continue;
    }

    const before = item.slice(0, openIdx);
    if (before) result.push(before);

    const markChildren: ContentItem[] = [];
    markChildren.push(item.slice(openIdx + 1));

    for (let j = i + 1; j < closeElemIdx; j++) {
      markChildren.push(items[j]!);
    }

    const closeStr = items[closeElemIdx]! as string;
    const closePos = closeStr.indexOf(']{.mark}');
    markChildren.push(closeStr.slice(0, closePos));
    const after = closeStr.slice(closePos + ']{.mark}'.length);

    result.push({
      type: 'mark',
      content: markChildren
    } as FiaBlock);

    if (after) result.push(after);
    i = closeElemIdx + 1;
  }
  return result;
}

// --- Block renderer ---

function FiaBlockRenderer({
  block,
  mediaCtx,
  index
}: {
  block: FiaBlock;
  mediaCtx: MediaContext;
  index?: number;
}) {
  if (typeof block === 'string') {
    return (
      <Text className="text-base leading-7">{renderMarkedText(block)}</Text>
    );
  }

  const renderContent = (
    content: string | FiaBlock | (string | FiaBlock)[]
  ) => {
    if (typeof content === 'string') {
      return (
        <Text className="text-base leading-7">{renderMarkedText(content)}</Text>
      );
    }
    if (Array.isArray(content)) {
      const processed = preprocessMarkSpans(content as ContentItem[]);
      return (
        <>
          {processed.map((child, i) => (
            <FiaBlockRenderer
              key={i}
              block={child as FiaBlock}
              mediaCtx={mediaCtx}
              index={i}
            />
          ))}
        </>
      );
    }
    return <FiaBlockRenderer block={content} mediaCtx={mediaCtx} index={0} />;
  };

  switch (block.type) {
    case 'paragraph':
      return (
        <View className="mb-3">
          {typeof block.content === 'string' ? (
            <Text className="text-base leading-7">
              {renderMarkedText(block.content)}
            </Text>
          ) : (
            <Text className="text-base leading-7">
              {renderInlineContent(block.content)}
            </Text>
          )}
        </View>
      );

    case 'heading':
      return (
        <View className="mb-2 mt-4">
          <Text
            className={
              block.level === 1
                ? 'text-xl font-bold'
                : block.level === 2
                  ? 'text-lg font-semibold'
                  : 'text-base font-semibold'
            }
          >
            {typeof block.content === 'string'
              ? renderMarkedText(block.content)
              : renderInlineContent(block.content)}
          </Text>
        </View>
      );

    case 'bring-attention':
    case 'strong':
      return (
        <Text className="text-base font-bold leading-7">
          {typeof block.content === 'string'
            ? renderMarkedText(block.content)
            : renderInlineContent(block.content)}
        </Text>
      );

    case 'emphasis':
      return (
        <Text className="text-base italic leading-7">
          {typeof block.content === 'string'
            ? renderMarkedText(block.content)
            : renderInlineContent(block.content)}
        </Text>
      );

    case 'mark':
      return (
        <Text className="bg-amber-200/40 text-base leading-7 dark:bg-amber-700/30">
          {typeof block.content === 'string'
            ? block.content
            : renderInlineContent(block.content)}
        </Text>
      );

    case 'ordered-list':
    case 'unordered-list': {
      const items = Array.isArray(block.content) ? block.content : [];
      return (
        <View className="mb-3 pl-4">
          {items.map((item, i) => (
            <View key={i} className="mb-1 flex-row">
              <Text className="mr-2 text-base leading-7">
                {block.type === 'ordered-list' ? `${i + 1}.` : '\u2022'}
              </Text>
              <View className="flex-1">
                {typeof item === 'string' ? (
                  <Text className="text-base leading-7">
                    {renderMarkedText(item)}
                  </Text>
                ) : typeof item.content === 'string' ? (
                  <Text className="text-base leading-7">
                    {renderMarkedText(item.content)}
                  </Text>
                ) : (
                  renderContent(item.content)
                )}
              </View>
            </View>
          ))}
        </View>
      );
    }

    case 'callout': {
      if (block.style === 'action') {
        return <ActionCallout block={block} mediaCtx={mediaCtx} />;
      }
      return (
        <View className="mb-3 rounded-lg border border-border bg-muted/30 p-3">
          {block.title && (
            <Text className="mb-1 text-sm font-semibold">{block.title}</Text>
          )}
          {renderContent(block.content)}
        </View>
      );
    }

    case 'blockquote':
      return (
        <View className="mb-3 border-l-4 border-primary/40 pl-3">
          {renderContent(block.content)}
        </View>
      );

    default:
      return renderContent(block.content);
  }
}

function renderInlineContent(
  content: string | FiaBlock | (string | FiaBlock)[]
): React.ReactNode {
  if (typeof content === 'string') return renderMarkedText(content);
  if (Array.isArray(content)) {
    const processed = preprocessMarkSpans(content as ContentItem[]);
    return processed.map((child, i) => {
      if (typeof child === 'string') return renderMarkedText(child);
      if (child.type === 'mark') {
        return (
          <Text key={i} className="bg-amber-200/40 dark:bg-amber-700/30">
            {typeof child.content === 'string'
              ? child.content
              : renderInlineContent(child.content)}
          </Text>
        );
      }
      if (child.type === 'bring-attention' || child.type === 'strong') {
        return (
          <Text key={i} className="font-bold">
            {typeof child.content === 'string'
              ? child.content
              : renderInlineContent(child.content)}
          </Text>
        );
      }
      if (child.type === 'emphasis') {
        return (
          <Text key={i} className="italic">
            {typeof child.content === 'string'
              ? child.content
              : renderInlineContent(child.content)}
          </Text>
        );
      }
      if (typeof child.content === 'string')
        return renderMarkedText(child.content);
      if (child.content) return renderInlineContent(child.content);
      return null;
    });
  }
  if (content && typeof content === 'object') {
    if (content.type === 'mark') {
      return (
        <Text className="bg-amber-200/40 dark:bg-amber-700/30">
          {typeof content.content === 'string'
            ? content.content
            : renderInlineContent(content.content)}
        </Text>
      );
    }
    if (content.type === 'bring-attention' || content.type === 'strong') {
      return (
        <Text className="font-bold">
          {typeof content.content === 'string'
            ? renderMarkedText(content.content)
            : renderInlineContent(content.content)}
        </Text>
      );
    }
    if (content.type === 'emphasis') {
      return (
        <Text className="italic">
          {typeof content.content === 'string'
            ? renderMarkedText(content.content)
            : renderInlineContent(content.content)}
        </Text>
      );
    }
    if (typeof content.content === 'string')
      return renderMarkedText(content.content);
    if (content.content) return renderInlineContent(content.content);
  }
  return null;
}

// --- Action callout with collapsible media ---

function ActionCallout({
  block,
  mediaCtx,
  displayText
}: {
  block: FiaBlock;
  mediaCtx: MediaContext;
  displayText?: string;
}) {
  const calloutText = displayText || getCalloutText(block);
  const matches = resolveAnchors(block, mediaCtx);

  const hasUnlinkedMedia =
    matches.length === 0 &&
    (mediaCtx.mediaItems.length > 0 || mediaCtx.maps.length > 0);

  if (matches.length === 0) {
    return (
      <View className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
        <Text className="text-sm italic leading-6 text-amber-800 dark:text-amber-300">
          {calloutText}
        </Text>
        {hasUnlinkedMedia && mediaCtx.onBrowseMedia && (
          <TouchableOpacity
            onPress={mediaCtx.onBrowseMedia}
            className="mt-2 flex-row items-center gap-1.5 self-start rounded-md border border-amber-500/40 bg-amber-500/15 px-2.5 py-1.5"
          >
            <Icon
              as={ImageIcon}
              size={14}
              className="text-amber-700 dark:text-amber-400"
            />
            <Text className="text-xs font-medium text-amber-700 dark:text-amber-400">
              Browse Media
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <Collapsible className="mb-3 overflow-hidden rounded-lg border border-amber-500/30 bg-amber-500/10">
      <CollapsibleTrigger className="flex-row items-center justify-between px-3 py-2">
        <Text className="flex-1 text-sm italic leading-6 text-amber-800 dark:text-amber-300">
          {calloutText}
        </Text>
        <Icon
          as={ChevronDownIcon}
          size={16}
          className="ml-2 text-amber-700 dark:text-amber-400"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="gap-4 px-3 pb-3">
        {matches.map((media, i) => (
          <View key={i}>
            {media.type === 'image' && <MediaItemDisplay item={media.item} />}
            {media.type === 'map' && <MapDisplay item={media.item} />}
            {media.type === 'term' && <TermDisplay item={media.item} />}
          </View>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

// --- Fullscreen image viewer with pinch-to-zoom and pan ---

function ImageViewer({
  uri,
  visible,
  onClose
}: {
  uri: string;
  visible: boolean;
  onClose: () => void;
}) {
  const { width: screenW, height: screenH } = useWindowDimensions();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View className="flex-1 bg-black">
        <TouchableOpacity
          onPress={onClose}
          className="absolute right-4 top-14 z-10 h-10 w-10 items-center justify-center rounded-full bg-white/20"
        >
          <Ionicons name="close" size={24} color="white" />
        </TouchableOpacity>

        <ReactNativeZoomableView
          maxZoom={8}
          minZoom={1}
          initialZoom={1}
          bindToBorders
          contentWidth={screenW}
          contentHeight={screenH}
          style={{ flex: 1 }}
        >
          <Image
            source={{ uri }}
            style={{ width: screenW, height: screenH * 0.8 }}
            resizeMode="contain"
          />
        </ReactNativeZoomableView>
      </View>
    </Modal>
  );
}

function TappableImage({
  uri,
  aspectRatio,
  resizeMode = 'cover'
}: {
  uri: string;
  aspectRatio: number;
  resizeMode?: 'cover' | 'contain';
}) {
  const [viewerOpen, setViewerOpen] = useState(false);

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setViewerOpen(true)}
      >
        <Image
          source={{ uri }}
          className="w-full rounded-md"
          style={{ aspectRatio }}
          resizeMode={resizeMode}
        />
      </TouchableOpacity>
      <ImageViewer
        uri={uri}
        visible={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />
    </>
  );
}

function MediaItemDisplay({ item }: { item: FiaMediaItem }) {
  return (
    <View className="gap-2">
      {item.title ? (
        <Text className="text-sm font-semibold">{item.title}</Text>
      ) : null}
      {item.assets.map((asset, i) => (
        <View key={i}>
          {asset.imageUrl && (
            <TappableImage
              uri={asset.imageUrl}
              aspectRatio={16 / 10}
              resizeMode="cover"
            />
          )}
          {asset.description ? (
            <Text className="mt-1 text-xs text-muted-foreground">
              {asset.description}
            </Text>
          ) : null}
        </View>
      ))}
      {item.description ? (
        <Text className="text-sm text-muted-foreground">
          {item.description}
        </Text>
      ) : null}
    </View>
  );
}

function MapDisplay({ item }: { item: FiaMap }) {
  return (
    <View className="gap-2">
      {item.title ? (
        <Text className="text-sm font-semibold">{item.title}</Text>
      ) : null}
      <TappableImage
        uri={item.imageUrl}
        aspectRatio={4 / 3}
        resizeMode="contain"
      />
    </View>
  );
}

function TermDisplay({ item }: { item: FiaTerm }) {
  return (
    <View className="gap-1">
      <Text className="text-sm font-bold">{item.term}</Text>
      {item.hint ? (
        <Text className="text-xs italic text-muted-foreground">
          {item.hint}
        </Text>
      ) : null}
      {item.definition ? (
        <Text className="mt-1 text-sm leading-6">{item.definition}</Text>
      ) : null}
    </View>
  );
}

// --- Media gallery tab content ---

function MediaGalleryContent({
  mediaItems,
  maps
}: {
  mediaItems: FiaMediaItem[];
  maps: FiaMap[];
}) {
  if (mediaItems.length === 0 && maps.length === 0) {
    return (
      <View className="items-center justify-center py-12">
        <Text className="text-center text-muted-foreground">
          No media available for this pericope.
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-6 px-5 pb-12 pt-3">
      {mediaItems.map((item, i) => (
        <View
          key={`m-${i}`}
          className="overflow-hidden rounded-lg border border-border"
        >
          <View className="gap-2 p-3">
            <MediaItemDisplay item={item} />
          </View>
        </View>
      ))}
      {maps.map((item, i) => (
        <View
          key={`c-${i}`}
          className="overflow-hidden rounded-lg border border-border"
        >
          <View className="gap-2 p-3">
            <MapDisplay item={item} />
          </View>
        </View>
      ))}
    </View>
  );
}

// --- Step content ---

function StepContent({
  step,
  mediaItems,
  terms,
  maps,
  onBrowseMedia
}: {
  step: FiaStepData;
  mediaItems: FiaMediaItem[];
  terms: FiaTerm[];
  maps: FiaMap[];
  onBrowseMedia?: () => void;
}) {
  const mediaCtx: MediaContext = {
    mediaItems,
    terms,
    maps,
    onBrowseMedia
  };

  if (step.textJson && step.textJson.length > 0) {
    return (
      <View className="px-5 pb-12 pt-3">
        {step.textJson.map((block, i) => (
          <FiaBlockRenderer key={i} block={block} mediaCtx={mediaCtx} />
        ))}
      </View>
    );
  }

  if (step.textPlain) {
    const paragraphs = step.textPlain.split(/\n\n+/).filter(Boolean);
    return (
      <View className="px-5 pb-12 pt-3">
        {paragraphs.map((para, i) => (
          <View key={i} className="mb-3">
            <Text className="text-base leading-7">
              {renderMarkedText(para.trim())}
            </Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View className="items-center justify-center py-12">
      <Text className="text-center text-muted-foreground">
        No text available for this step.
      </Text>
    </View>
  );
}

// --- Main drawer component ---

export function FiaStepDrawer({
  open,
  onOpenChange,
  projectId,
  pericopeId,
  questName,
  fiaBookId,
  verseRange,
  persistedState
}: FiaStepDrawerProps) {
  const saved = persistedState?.current;
  const [activeTab, setActiveTab] = React.useState<'guide' | 'bible' | 'media'>(
    saved?.activeTab ?? 'guide'
  );
  const [activeStep, setActiveStep] = React.useState(
    saved?.activeStep ?? 'hear-and-heart'
  );
  const [completedSteps, setCompletedSteps] = React.useState<Set<string>>(
    new Set(saved?.completedSteps ?? [])
  );
  const scrollRef = React.useRef<any>(null);
  const dataLoadedRef = React.useRef(false);
  const { data, isLoading, error } = useFiaPericopeSteps(
    pericopeId ? projectId : undefined,
    pericopeId ?? undefined
  );

  const currentStep = data?.steps.find((s) => s.stepId === activeStep);
  const audioUrl = currentStep?.audioUrl ?? null;
  const currentStepIndex = STEP_CONFIG.findIndex((c) => c.id === activeStep);
  const isLastStep = currentStepIndex === STEP_CONFIG.length - 1;
  const isStepCompleted = completedSteps.has(activeStep);

  // Only reset to defaults on first data load when no persisted state exists
  React.useEffect(() => {
    if (data && !isLoading && !dataLoadedRef.current) {
      dataLoadedRef.current = true;
      if (!saved?.activeStep) {
        setActiveStep('hear-and-heart');
        setCompletedSteps(new Set());
      }
    }
  }, [data, isLoading, saved?.activeStep]);

  // Sync state back to parent ref so it survives drawer unmount
  React.useEffect(() => {
    if (persistedState) {
      persistedState.current = {
        activeTab,
        activeStep,
        completedSteps: Array.from(completedSteps)
      };
    }
  }, [activeTab, activeStep, completedSteps, persistedState]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo?.({ y: 0, animated: false });
  }, [activeStep]);

  const handleStepDone = () => {
    setCompletedSteps((prev) => new Set(prev).add(activeStep));
    if (!isLastStep) {
      for (let i = currentStepIndex + 1; i < STEP_CONFIG.length; i++) {
        const nextId = STEP_CONFIG[i]!.id;
        if (data?.steps.some((s) => s.stepId === nextId)) {
          setActiveStep(nextId);
          return;
        }
      }
    }
  };

  const handleUndoDone = () => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      next.delete(activeStep);
      return next;
    });
  };

  // Pause any drawer audio (FIA step or Bible) when drawer closes
  const {
    pauseSound: pauseGlobal,
    isPlaying: isGlobalPlaying,
    currentAudioId: globalAudioId
  } = useAudio({ stopOnUnmount: false });
  const prevOpenRef = React.useRef(open);
  React.useEffect(() => {
    if (prevOpenRef.current && !open && isGlobalPlaying) {
      const isFiaAudio = globalAudioId?.startsWith('fia-step-');
      const isBibleAudio = globalAudioId?.startsWith('bible-');
      if (isFiaAudio || isBibleAudio) {
        void pauseGlobal();
      }
    }
    prevOpenRef.current = open;
  }, [open, isGlobalPlaying, globalAudioId, pauseGlobal]);

  if (!pericopeId) return null;

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      snapPoints={['94%']}
      enableDynamicSizing={false}
    >
      <DrawerContent asChild>
        <View style={{ flex: 1 }} className="bg-background px-6">
          <DrawerHeader className="pb-0">
            <View className="flex-row items-start justify-between">
              <View className="flex-1 flex-col gap-0.5">
                <DrawerTitle>
                  {activeTab === 'guide'
                    ? currentStep?.title || 'FIA Steps'
                    : activeTab === 'media'
                      ? 'Media'
                      : 'Bible'}
                </DrawerTitle>
                <DrawerDescription>{questName || ''}</DrawerDescription>
              </View>
              <View className="flex-row items-center gap-2">
                {data &&
                  (data.mediaItems.length > 0 || data.maps.length > 0) && (
                    <TouchableOpacity
                      className={cn(
                        'h-10 w-10 items-center justify-center rounded-full shadow-sm',
                        activeTab === 'media' ? 'bg-primary' : 'bg-muted'
                      )}
                      onPress={() =>
                        setActiveTab(activeTab === 'media' ? 'guide' : 'media')
                      }
                    >
                      <Icon
                        as={ImageIcon}
                        size={20}
                        className={
                          activeTab === 'media'
                            ? 'text-primary-foreground'
                            : 'text-muted-foreground'
                        }
                      />
                    </TouchableOpacity>
                  )}
                <View className="h-10 w-10 items-center justify-center rounded-full bg-primary shadow-sm">
                  <Icon
                    as={BookOpenIcon}
                    size={20}
                    className="text-primary-foreground"
                  />
                </View>
              </View>
            </View>
          </DrawerHeader>

          {/* Guide / Bible tab row */}
          <View className="flex-row gap-2 border-b border-border px-2 pb-2">
            <TouchableOpacity
              onPress={() => setActiveTab('guide')}
              className={cn(
                'flex-1 flex-row items-center justify-center gap-2 rounded-lg py-2',
                activeTab === 'guide' ? 'bg-primary' : 'bg-muted'
              )}
            >
              <Icon
                as={FiaIcon}
                size={16}
                className={
                  activeTab === 'guide'
                    ? 'text-primary-foreground'
                    : 'text-muted-foreground'
                }
              />
              <Text
                className={cn(
                  'text-sm font-semibold',
                  activeTab === 'guide'
                    ? 'text-primary-foreground'
                    : 'text-muted-foreground'
                )}
              >
                Guide
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveTab('bible')}
              className={cn(
                'flex-1 flex-row items-center justify-center gap-2 rounded-lg py-2',
                activeTab === 'bible' ? 'bg-primary' : 'bg-muted'
              )}
            >
              <Icon
                as={BookOpenIcon}
                size={16}
                className={
                  activeTab === 'bible'
                    ? 'text-primary-foreground'
                    : 'text-muted-foreground'
                }
              />
              <Text
                className={cn(
                  'text-sm font-semibold',
                  activeTab === 'bible'
                    ? 'text-primary-foreground'
                    : 'text-muted-foreground'
                )}
              >
                Bible
              </Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'bible' ? (
            <BibleReaderContent
              projectId={projectId}
              fiaBookId={fiaBookId}
              verseRange={verseRange}
            />
          ) : activeTab === 'media' ? (
            <DrawerScrollView style={{ flex: 1 }}>
              <MediaGalleryContent
                mediaItems={data?.mediaItems ?? []}
                maps={data?.maps ?? []}
              />
            </DrawerScrollView>
          ) : isLoading ? (
            <View className="flex-1 items-center justify-center py-12">
              <ActivityIndicator size="large" />
              <Text className="mt-3 text-sm text-muted-foreground">
                Loading steps...
              </Text>
            </View>
          ) : error ? (
            <View className="flex-1 items-center justify-center px-6 py-12">
              <Text className="text-center text-sm text-destructive">
                Failed to load content. Please check your connection and try
                again.
              </Text>
            </View>
          ) : data ? (
            <>
              <View className="flex-row items-center justify-around border-b border-border py-2">
                {STEP_CONFIG.map((cfg, idx) => {
                  const isActive = activeStep === cfg.id;
                  const hasStep = data.steps.some((s) => s.stepId === cfg.id);
                  const isDone = completedSteps.has(cfg.id);
                  return (
                    <TouchableOpacity
                      key={cfg.id}
                      onPress={() => hasStep && setActiveStep(cfg.id)}
                      disabled={!hasStep}
                      className={`items-center rounded-lg px-2.5 py-1.5 ${
                        isActive
                          ? 'bg-primary'
                          : hasStep
                            ? 'bg-muted'
                            : 'bg-muted/50 opacity-40'
                      }`}
                    >
                      <View>
                        <View className="flex-row items-center gap-1">
                          <Text
                            className={`text-xs font-bold ${
                              isActive
                                ? 'text-primary-foreground'
                                : 'text-muted-foreground'
                            }`}
                          >
                            {idx + 1}
                          </Text>
                          <Icon
                            as={cfg.icon}
                            size={16}
                            className={
                              isActive
                                ? 'text-primary-foreground'
                                : 'text-muted-foreground'
                            }
                          />
                        </View>
                        {isDone && (
                          <View
                            className="absolute -right-1.5 -top-1.5 items-center justify-center rounded-full bg-green-500"
                            style={{ width: 14, height: 14 }}
                          >
                            <Icon
                              as={CheckIcon}
                              size={9}
                              className="text-white"
                            />
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <StepAudioPlayer audioUrl={audioUrl} />

              <DrawerScrollView ref={scrollRef} style={{ flex: 1 }}>
                {currentStep ? (
                  <>
                    <StepContent
                      step={currentStep}
                      mediaItems={data.mediaItems}
                      terms={data.terms}
                      maps={data.maps}
                      onBrowseMedia={() => setActiveTab('media')}
                    />
                    <View className="items-center gap-2 px-5 pb-8 pt-4">
                      {isStepCompleted ? (
                        <TouchableOpacity
                          onPress={handleUndoDone}
                          className="flex-row items-center gap-2 rounded-xl bg-green-500/20 px-6 py-3"
                        >
                          <Icon
                            as={CheckIcon}
                            size={18}
                            className="text-green-600 dark:text-green-400"
                          />
                          <Text className="font-semibold text-green-600 dark:text-green-400">
                            Done
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          onPress={handleStepDone}
                          className="flex-row items-center gap-2 rounded-xl bg-primary px-6 py-3"
                        >
                          <Text className="font-semibold text-primary-foreground">
                            {isLastStep ? 'Complete' : 'Done \u2014 Next Step'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </>
                ) : (
                  <View className="items-center justify-center py-12">
                    <Text className="text-center text-muted-foreground">
                      Select a step to view its content.
                    </Text>
                  </View>
                )}
              </DrawerScrollView>
            </>
          ) : null}
        </View>
      </DrawerContent>
    </Drawer>
  );
}
