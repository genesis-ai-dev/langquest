/**
 * VerseSegmentModal - Manage audio segments within a Bible verse
 *
 * Shows all segments for a verse, allows:
 * - Play individual segments
 * - Delete segments
 * - Reorder segments (TODO)
 * - Unmerge (if verse is merged)
 */

import { Button, buttonVariants } from '@/components/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from '@/components/ui/drawer';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { asset_content_link } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { getThemeColor } from '@/utils/styleUtils';
import { eq } from 'drizzle-orm';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

interface VerseSegmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  assetId: string;
  assetName: string;
  isMerged?: boolean;
  onPlay: (uri: string, segmentId: string) => Promise<void>;
  onDelete: (segmentId: string) => Promise<void>;
  onUnmerge?: () => void;
  isPlaying: boolean;
  currentAudioId: string | null;
}

interface Segment {
  id: string;
  audio: string[] | null;
  text: string | null;
}

export function VerseSegmentModal({
  isOpen,
  onClose,
  assetId,
  assetName,
  isMerged = false,
  onPlay,
  onDelete,
  onUnmerge,
  isPlaying,
  currentAudioId
}: VerseSegmentModalProps) {
  const [segments, setSegments] = React.useState<Segment[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Load segments when modal opens
  React.useEffect(() => {
    if (!isOpen) return;

    const loadSegments = async () => {
      setIsLoading(true);
      try {
        const results = await system.db
          .select()
          .from(asset_content_link)
          .where(eq(asset_content_link.asset_id, assetId));

        setSegments(results as Segment[]);
      } catch (error) {
        console.error('Failed to load segments:', error);
      } finally {
        setIsLoading(false);
      }
    };

    void loadSegments();
  }, [isOpen, assetId]);

  const getSegmentUri = React.useCallback(
    async (audioId: string): Promise<string | null> => {
      if (!system.permAttachmentQueue) return null;

      const attachment = await system.powersync.getOptional<{
        id: string;
        local_uri: string | null;
      }>(`SELECT * FROM ${system.permAttachmentQueue.table} WHERE id = ?`, [
        audioId
      ]);

      if (!attachment?.local_uri) return null;

      return system.permAttachmentQueue.getLocalUri(attachment.local_uri);
    },
    []
  );

  const handlePlaySegment = async (segment: Segment) => {
    const audioId = segment.audio?.[0];
    if (!audioId) return;

    const uri = await getSegmentUri(audioId);
    if (!uri) {
      console.error('No URI found for segment');
      return;
    }

    await onPlay(uri, segment.id);
  };

  const handleDeleteSegment = async (segmentId: string) => {
    await onDelete(segmentId);
    // Refresh segments
    setSegments((prev) => prev.filter((s) => s.id !== segmentId));
  };

  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{assetName}</DrawerTitle>
          <DrawerDescription>
            {segments.length} segment{segments.length !== 1 ? 's' : ''}
            {isMerged && ' • Merged verse'}
          </DrawerDescription>
        </DrawerHeader>

        <ScrollView className="max-h-96 px-4">
          {isLoading ? (
            <View className="items-center py-8">
              <ActivityIndicator
                size="large"
                color={getThemeColor('primary')}
              />
              <Text className="mt-2 text-muted-foreground">
                Loading segments...
              </Text>
            </View>
          ) : segments.length === 0 ? (
            <View className="items-center py-8">
              <Text className="text-muted-foreground">
                No segments recorded yet
              </Text>
            </View>
          ) : (
            <View className="flex-col gap-2 pb-4">
              {segments.map((segment, index) => {
                const isThisPlaying =
                  isPlaying && currentAudioId === segment.id;
                return (
                  <View
                    key={segment.id}
                    className="flex-row items-center gap-2 rounded-md border border-border bg-card p-3"
                  >
                    <Text className="text-sm text-muted-foreground">
                      {index + 1}
                    </Text>

                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onPress={() => handlePlaySegment(segment)}
                    >
                      <Icon
                        name={isThisPlaying ? 'pause' : 'play'}
                        className="text-foreground"
                        size={16}
                      />
                    </Button>

                    <View className="flex-1">
                      <Text className="text-sm">
                        Segment {index + 1}
                        {segment.audio?.[0] &&
                          ` • ${segment.audio[0].slice(0, 8)}`}
                      </Text>
                    </View>

                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onPress={() => handleDeleteSegment(segment.id)}
                    >
                      <Icon
                        name="trash-2"
                        className="text-destructive"
                        size={16}
                      />
                    </Button>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>

        <DrawerFooter className="flex-row gap-2">
          {isMerged && onUnmerge && (
            <Button variant="outline" onPress={onUnmerge} className="flex-1">
              <Icon name="scissors" size={16} className="mr-2" />
              <Text>Unmerge (Mock)</Text>
            </Button>
          )}
          <DrawerClose className={buttonVariants({ variant: 'default' })}>
            <Text>Close</Text>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
