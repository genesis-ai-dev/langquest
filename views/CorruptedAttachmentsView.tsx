import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useLocalization } from '@/hooks/useLocalization';
import type { CorruptedAttachment } from '@/services/corruptedAttachmentsService';
import {
    cleanupAllCorrupted,
    cleanupCorruptedAttachment,
    findCorruptedAttachments
} from '@/services/corruptedAttachmentsService';
import {
    AlertTriangle,
    CheckCircle,
    ChevronDown,
    ChevronRight,
    Loader2,
    Trash2
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';

export default function CorruptedAttachmentsView() {
  const { t } = useLocalization();
  const [corrupted, setCorrupted] = useState<CorruptedAttachment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [cleaningIds, setCleaningIds] = useState<Set<string>>(new Set());
  const [cleaningAll, setCleaningAll] = useState(false);

  const loadCorrupted = useCallback(async () => {
    try {
      setIsLoading(true);
      const found = await findCorruptedAttachments();
      setCorrupted(found);
    } catch (error) {
      console.error('Failed to load corrupted attachments:', error);
      Alert.alert(
        'Error',
        'Failed to load corrupted attachments. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    try {
      setIsRefreshing(true);
      await loadCorrupted();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadCorrupted]);

  useEffect(() => {
    void loadCorrupted();
  }, [loadCorrupted]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleCleanOne = useCallback(
    async (attachmentId: string) => {
      Alert.alert(
        'Clean Corrupted Attachment',
        'This will remove the corrupted attachment record and its references from the database. This action cannot be undone.',
        [
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Clean',
            style: 'destructive',
            onPress: async () => {
              try {
                setCleaningIds((prev) => new Set(prev).add(attachmentId));
                await cleanupCorruptedAttachment(attachmentId);
                
                // Remove from list
                setCorrupted((prev) =>
                  prev.filter((c) => c.attachmentRecord.id !== attachmentId)
                );
                
                Alert.alert('Success', 'Corrupted attachment cleaned successfully.');
              } catch (error) {
                console.error('Failed to clean attachment:', error);
                Alert.alert(
                  'Error',
                  `Failed to clean attachment: ${error instanceof Error ? error.message : String(error)}`
                );
              } finally {
                setCleaningIds((prev) => {
                  const next = new Set(prev);
                  next.delete(attachmentId);
                  return next;
                });
              }
            }
          }
        ]
      );
    },
    []
  );

  const handleCleanAll = useCallback(async () => {
    if (corrupted.length === 0) return;

    Alert.alert(
      'Clean All Corrupted Attachments',
      `This will clean up ${corrupted.length} corrupted attachment${corrupted.length > 1 ? 's' : ''}. This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Clean All',
          style: 'destructive',
          onPress: async () => {
            try {
              setCleaningAll(true);
              const result = await cleanupAllCorrupted();
              
              // Reload the list
              await loadCorrupted();
              
              if (result.errors.length > 0) {
                Alert.alert(
                  'Partial Success',
                  `Cleaned ${result.cleaned} attachment${result.cleaned > 1 ? 's' : ''}. ${result.errors.length} error${result.errors.length > 1 ? 's' : ''} occurred:\n\n${result.errors.join('\n')}`
                );
              } else {
                Alert.alert(
                  'Success',
                  `Successfully cleaned ${result.cleaned} corrupted attachment${result.cleaned > 1 ? 's' : ''}.`
                );
              }
            } catch (error) {
              console.error('Failed to clean all:', error);
              Alert.alert(
                'Error',
                `Failed to clean attachments: ${error instanceof Error ? error.message : String(error)}`
              );
            } finally {
              setCleaningAll(false);
            }
          }
        }
      ]
    );
  }, [corrupted.length, loadCorrupted]);

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatSize = (bytes: number | null | undefined) => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <Icon as={Loader2} size={40} className="animate-spin text-primary" />
          <Text className="mt-4 text-muted-foreground">
            Scanning for corrupted attachments...
          </Text>
        </View>
      </View>
    );
  }

  if (corrupted.length === 0) {
    return (
      <View className="flex-1 bg-background">
        <ScrollView
          className="flex-1"
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
          }
        >
          <View className="flex-1 items-center justify-center p-8">
            <Icon as={CheckCircle} size={64} className="text-green-500" />
            <Text className="mt-4 text-center text-xl font-bold text-foreground">
              No Corrupted Attachments
            </Text>
            <Text className="mt-2 text-center text-muted-foreground">
              Your attachment database is healthy. All attachment records are valid.
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <View className="p-4">
        <View className="mb-4 flex-row items-center gap-3">
          <Icon as={AlertTriangle} size={24} className="text-destructive" />
          <Text className="flex-1 text-xl font-bold text-foreground">
            Corrupted Attachments
          </Text>
        </View>

        <View className="mb-4 rounded-lg bg-destructive/10 p-4">
          <Text className="text-sm text-foreground">
            Found {corrupted.length} corrupted attachment
            {corrupted.length > 1 ? 's' : ''} with blob URLs in the database.
            These are causing sync errors and should be cleaned up.
          </Text>
        </View>

        {corrupted.length > 0 && (
          <Button
            variant="destructive"
            onPress={handleCleanAll}
            disabled={cleaningAll}
            className="mb-4"
          >
            {cleaningAll ? (
              <>
                <Icon as={Loader2} className="animate-spin" />
                <Text className="font-bold text-destructive-foreground">
                  Cleaning...
                </Text>
              </>
            ) : (
              <>
                <Icon as={Trash2} />
                <Text className="font-bold text-destructive-foreground">
                  Clean All ({corrupted.length})
                </Text>
              </>
            )}
          </Button>
        )}
      </View>

      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        <View className="flex-col gap-2 p-4 pt-0">
          {corrupted.map((item) => {
            const isExpanded = expandedIds.has(item.attachmentRecord.id);
            const isCleaning = cleaningIds.has(item.attachmentRecord.id);
            const truncatedId = item.attachmentRecord.id.substring(0, 30);

            return (
              <View
                key={item.attachmentRecord.id}
                className="rounded-lg border border-border bg-card p-4"
              >
                {/* Header */}
                <View className="flex-row items-start justify-between">
                  <View className="flex-1">
                    <Text className="font-mono text-xs text-muted-foreground">
                      {truncatedId}...
                    </Text>
                    <View className="mt-1 flex-row flex-wrap gap-2">
                      <Text className="text-xs text-muted-foreground">
                        State: {item.attachmentRecord.state}
                      </Text>
                      <Text className="text-xs text-muted-foreground">
                        Size: {formatSize(item.attachmentRecord.size)}
                      </Text>
                    </View>
                    <Text className="mt-1 text-xs text-muted-foreground">
                      {formatTimestamp(item.attachmentRecord.timestamp)}
                    </Text>
                  </View>

                  <View className="flex-row gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onPress={() => toggleExpand(item.attachmentRecord.id)}
                    >
                      <Icon
                        as={isExpanded ? ChevronDown : ChevronRight}
                        size={20}
                      />
                    </Button>
                  </View>
                </View>

                {/* Expanded Details */}
                {isExpanded && (
                  <View className="mt-4 gap-3 border-t border-border pt-4">
                    {/* Full IDs */}
                    <View>
                      <Text className="text-xs font-bold text-foreground">
                        Attachment ID:
                      </Text>
                      <Text className="mt-1 font-mono text-xs text-muted-foreground">
                        {item.attachmentRecord.id}
                      </Text>
                    </View>

                    {item.attachmentRecord.local_uri && (
                      <View>
                        <Text className="text-xs font-bold text-foreground">
                          Local URI:
                        </Text>
                        <Text className="mt-1 font-mono text-xs text-muted-foreground">
                          {item.attachmentRecord.local_uri}
                        </Text>
                      </View>
                    )}

                    {/* Associated Assets */}
                    {item.assets.length > 0 && (
                      <View>
                        <Text className="text-xs font-bold text-foreground">
                          Associated Assets ({item.assets.length}):
                        </Text>
                        <View className="mt-1 gap-1">
                          {item.assets.map((asset) => (
                            <Text
                              key={asset.id}
                              className="text-xs text-muted-foreground"
                            >
                              • {asset.name || 'Unnamed'} ({asset.id.substring(0, 8)}...)
                            </Text>
                          ))}
                        </View>
                      </View>
                    )}

                    {/* Content Links */}
                    {item.assetContentLinks.length > 0 && (
                      <View>
                        <Text className="text-xs font-bold text-foreground">
                          Content Links ({item.assetContentLinks.length}):
                        </Text>
                        <View className="mt-1 gap-1">
                          {item.assetContentLinks.map((link) => (
                            <Text
                              key={link.id}
                              className="text-xs text-muted-foreground"
                            >
                              • {link.id.substring(0, 8)}... (Asset: {link.asset_id.substring(0, 8)}...)
                            </Text>
                          ))}
                        </View>
                      </View>
                    )}

                    {/* Clean Button */}
                    <Button
                      variant="destructive"
                      size="sm"
                      onPress={() => handleCleanOne(item.attachmentRecord.id)}
                      disabled={isCleaning}
                      className="mt-2"
                    >
                      {isCleaning ? (
                        <>
                          <Icon as={Loader2} className="animate-spin" size={16} />
                          <Text className="text-sm font-bold text-destructive-foreground">
                            Cleaning...
                          </Text>
                        </>
                      ) : (
                        <>
                          <Icon as={Trash2} size={16} />
                          <Text className="text-sm font-bold text-destructive-foreground">
                            Clean This
                          </Text>
                        </>
                      )}
                    </Button>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

