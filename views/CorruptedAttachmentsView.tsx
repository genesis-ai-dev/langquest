import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useLocalization } from '@/hooks/useLocalization';
import { useThemeColor } from '@/utils/styleUtils';
import type { CorruptedAttachment } from '@/services/corruptedAttachmentsService';
import {
  cleanupAllCorrupted,
  cleanupCorruptedAttachment,
  findCorruptedAttachments
} from '@/services/corruptedAttachmentsService';
import RNAlert from '@blazejkustra/react-native-alert';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  View
} from 'react-native';

export default function CorruptedAttachmentsView() {
  const { t } = useLocalization();
  const { goToProjects } = useAppNavigation();
  const primaryColor = useThemeColor('primary');
  const destructiveForegroundColor = useThemeColor('destructive-foreground');
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
      RNAlert.alert(t('error'), t('failedToLoadCorruptedAttachments'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

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
      RNAlert.alert(
        t('cleanCorruptedAttachment'),
        t('cleanCorruptedAttachmentConfirm'),
        [
          {
            text: t('cancel'),
            style: 'cancel'
          },
          {
            text: t('clean'),
            style: 'destructive',
            onPress: async () => {
              try {
                setCleaningIds((prev) => new Set(prev).add(attachmentId));
                await cleanupCorruptedAttachment(attachmentId);

                // Remove from list
                setCorrupted((prev) =>
                  prev.filter((c) => c.attachmentRecord.id !== attachmentId)
                );

                RNAlert.alert(
                  t('success'),
                  t('corruptedAttachmentCleanedSuccess')
                );
              } catch (error) {
                console.error('Failed to clean attachment:', error);
                RNAlert.alert(
                  t('error'),
                  t('failedToCleanAttachment', {
                    error:
                      error instanceof Error ? error.message : String(error)
                  })
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
    [t]
  );

  const handleCleanAll = useCallback(async () => {
    if (corrupted.length === 0) return;

    const confirmMsg =
      corrupted.length > 1
        ? t('cleanAllConfirmPlural', { count: corrupted.length })
        : t('cleanAllConfirm', { count: corrupted.length });

    RNAlert.alert(t('cleanAllCorruptedAttachments'), confirmMsg, [
      {
        text: t('cancel'),
        style: 'cancel'
      },
      {
        text: t('clean'),
        style: 'destructive',
        onPress: async () => {
          try {
            setCleaningAll(true);
            const result = await cleanupAllCorrupted();

            // Reload the list
            await loadCorrupted();

            if (result.errors.length > 0) {
              const errorMsg =
                result.cleaned > 1 || result.errors.length > 1
                  ? t('cleanedAttachmentsWithErrorsPlural', {
                      cleaned: result.cleaned,
                      errorCount: result.errors.length,
                      errors: result.errors.join('\n')
                    })
                  : t('cleanedAttachmentsWithErrors', {
                      cleaned: result.cleaned,
                      errorCount: result.errors.length,
                      errors: result.errors.join('\n')
                    });
              RNAlert.alert(t('partialSuccess'), errorMsg);
            } else {
              const successMsg =
                result.cleaned > 1
                  ? t('successfullyCleanedAttachmentsPlural', {
                      cleaned: result.cleaned
                    })
                  : t('successfullyCleanedAttachments', {
                      cleaned: result.cleaned
                    });
              RNAlert.alert(t('success'), successMsg);
            }
          } catch (error) {
            console.error('Failed to clean all:', error);
            RNAlert.alert(
              t('error'),
              t('failedToCleanAttachments', {
                error: error instanceof Error ? error.message : String(error)
              })
            );
          } finally {
            setCleaningAll(false);
          }
        }
      }
    ]);
  }, [corrupted.length, loadCorrupted, t]);

  const formatTimestamp = useCallback(
    (timestamp: number | undefined) => {
      if (!timestamp) return t('unknown');
      return new Date(timestamp).toLocaleString();
    },
    [t]
  );

  const formatSize = useCallback(
    (bytes: number | null | undefined) => {
      if (!bytes) return t('unknown');
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    },
    [t]
  );

  if (isLoading) {
    return (
      <View className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={primaryColor} />
          <Text className="mt-4 text-muted-foreground">
            {t('scanningCorruptedAttachments')}
          </Text>
        </View>
      </View>
    );
  }

  if (corrupted.length === 0) {
    return (
      <View className="flex-1 bg-background">
        <View className="p-4">
          <Button
            variant="default"
            size="icon-lg"
            onPress={goToProjects}
            className="self-start"
          >
            <Icon name="house" className="text-primary-foreground" />
          </Button>
        </View>
        <ScrollView
          className="flex-1"
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
            />
          }
        >
          <View className="flex-1 items-center justify-center p-8">
            <Icon name="circle-check" size={64} className="text-green-500" />
            <Text className="mt-4 text-center text-xl font-bold text-foreground">
              {t('noCorruptedAttachments')}
            </Text>
            <Text className="mt-2 text-center text-muted-foreground">
              {t('attachmentDatabaseHealthy')}
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <View className="p-4">
        <Button
          variant="default"
          size="icon-lg"
          onPress={goToProjects}
          className="mb-4 self-start"
        >
          <Icon name="house" className="text-primary-foreground" />
        </Button>

        <View className="mb-4 flex-row items-center gap-3">
          <Icon name="triangle-alert" size={24} className="text-destructive" />
          <Text className="flex-1 text-xl font-bold text-foreground">
            {t('corruptedAttachments')}
          </Text>
        </View>

        <View className="mb-4 rounded-lg bg-destructive/10 p-4">
          <Text className="text-sm text-foreground">
            {corrupted.length > 1
              ? t('foundCorruptedAttachmentsPlural', {
                  count: corrupted.length
                })
              : t('foundCorruptedAttachments', { count: corrupted.length })}
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
                <ActivityIndicator
                  size="small"
                  color={destructiveForegroundColor}
                />
                <Text className="font-bold text-destructive-foreground">
                  {t('cleaning')}
                </Text>
              </>
            ) : (
              <>
                <Icon name="trash-2" />
                <Text className="font-bold text-destructive-foreground">
                  {t('cleanAll', { count: corrupted.length })}
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
                        {t('state')}: {item.attachmentRecord.state}
                      </Text>
                      <Text className="text-xs text-muted-foreground">
                        {t('size')}: {formatSize(item.attachmentRecord.size)}
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
                        name={isExpanded ? 'chevron-down' : 'chevron-right'}
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
                        {t('attachmentId')}:
                      </Text>
                      <Text className="mt-1 font-mono text-xs text-muted-foreground">
                        {item.attachmentRecord.id}
                      </Text>
                    </View>

                    {item.attachmentRecord.local_uri && (
                      <View>
                        <Text className="text-xs font-bold text-foreground">
                          {t('localUri')}:
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
                          {t('associatedAssets', { count: item.assets.length })}
                          :
                        </Text>
                        <View className="mt-1 gap-1">
                          {item.assets.map((asset) => (
                            <Text
                              key={asset.id}
                              className="text-xs text-muted-foreground"
                            >
                              • {asset.name || t('unnamed')} (
                              {asset.id.substring(0, 8)}...)
                            </Text>
                          ))}
                        </View>
                      </View>
                    )}

                    {/* Content Links */}
                    {item.assetContentLinks.length > 0 && (
                      <View>
                        <Text className="text-xs font-bold text-foreground">
                          {t('contentLinks', {
                            count: item.assetContentLinks.length
                          })}
                          :
                        </Text>
                        <View className="mt-1 gap-1">
                          {item.assetContentLinks.map((link) => (
                            <Text
                              key={link.id}
                              className="text-xs text-muted-foreground"
                            >
                              • {link.id.substring(0, 8)}... (Asset:{' '}
                              {link.asset_id.substring(0, 8)}...)
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
                          <ActivityIndicator
                            size="small"
                            color={destructiveForegroundColor}
                          />
                          <Text className="text-sm font-bold text-destructive-foreground">
                            {t('cleaning')}
                          </Text>
                        </>
                      ) : (
                        <>
                          <Icon name="trash-2" size={16} />
                          <Text className="text-sm font-bold text-destructive-foreground">
                            {t('cleanThis')}
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
