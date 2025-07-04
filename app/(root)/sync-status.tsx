import { PageHeader } from '@/components/PageHeader';
import { system } from '@/db/powersync/system';
import { useLocalStore } from '@/store/localStore';
import { borderRadius, colors, fontSizes, spacing } from '@/styles/theme';
import { formatTimeSinceLastSync } from '@/utils/dateUtils';
import { Ionicons } from '@expo/vector-icons';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useQuery } from '@powersync/tanstack-react-query';
import { sql } from 'drizzle-orm';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ProgressBarAndroid,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface UploadQueueStats {
  count: number;
  size: number | null;
}

interface LocalDataStats {
  projects: number;
  quests: number;
  assets: number;
  translations: number;
  attachments: number;
  totalAttachmentSize?: number;
}

export default function SyncStatusScreen() {
  const [syncStatus, setSyncStatus] = useState(system.powersync.currentStatus);
  const [uploadQueueStats, setUploadQueueStats] = useState<UploadQueueStats>({
    count: 0,
    size: null
  });

  const attachmentSyncProgress = useLocalStore(
    (state) => state.attachmentSyncProgress
  );

  // Query for local data counts
  const { data: localStats } = useQuery({
    queryKey: ['local-data-stats'],
    query: toCompilableQuery(
      system.db
        .select({
          projects: sql<number>`(SELECT COUNT(*) FROM project)`,
          quests: sql<number>`(SELECT COUNT(*) FROM quest)`,
          assets: sql<number>`(SELECT COUNT(*) FROM asset)`,
          translations: sql<number>`(SELECT COUNT(*) FROM translation)`,
          attachments: sql<number>`(SELECT COUNT(*) FROM attachments)`
        })
        .from(sql`(SELECT 1) AS dummy`)
    )
  });

  const localDataStats: LocalDataStats = {
    projects: localStats?.[0]?.projects ?? 0,
    quests: localStats?.[0]?.quests ?? 0,
    assets: localStats?.[0]?.assets ?? 0,
    translations: localStats?.[0]?.translations ?? 0,
    attachments: localStats?.[0]?.attachments ?? 0
  };

  useEffect(() => {
    // Register listener for sync status updates
    const unsubscribe = system.powersync.registerListener({
      statusChanged: (status) => {
        setSyncStatus(status);
      }
    });

    // Fetch upload queue stats
    const fetchUploadQueueStats = async () => {
      try {
        const stats = await system.powersync.getUploadQueueStats(true);
        setUploadQueueStats(stats);
      } catch (error) {
        console.error('Error fetching upload queue stats:', error);
      }
    };

    void fetchUploadQueueStats();
    const interval = setInterval(() => void fetchUploadQueueStats(), 2000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const formatBytes = (bytes?: number | null) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const formatDate = (date?: Date) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleString();
  };

  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <PageHeader title="Sync Status" />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Connection Overview */}
          <View style={styles.overviewCard}>
            <View style={styles.overviewRow}>
              <View style={styles.overviewItem}>
                <Ionicons
                  name={
                    syncStatus.connected
                      ? 'cloud-done'
                      : syncStatus.connecting
                        ? 'cloud-outline'
                        : 'cloud-offline'
                  }
                  size={32}
                  color={
                    syncStatus.connected
                      ? colors.success
                      : syncStatus.connecting
                        ? colors.primary
                        : colors.error
                  }
                />
                <Text style={styles.overviewLabel}>
                  {syncStatus.connected
                    ? 'Connected'
                    : syncStatus.connecting
                      ? 'Connecting'
                      : 'Offline'}
                </Text>
              </View>
              <View style={styles.overviewItem}>
                <Text style={styles.overviewValue}>
                  {formatTimeSinceLastSync(syncStatus.lastSyncedAt)}
                </Text>
                <Text style={styles.overviewLabel}>Last Sync</Text>
              </View>
            </View>
          </View>

          {/* Database Sync Status */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="server" size={24} color={colors.primary} />
              <Text style={styles.sectionTitle}>Database Sync</Text>
            </View>

            <View style={styles.statusRow}>
              <Text style={styles.label}>Status:</Text>
              <View style={styles.statusIndicator}>
                {syncStatus.dataFlowStatus.downloading ? (
                  <>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.statusText}>
                      Downloading updates...
                    </Text>
                  </>
                ) : syncStatus.dataFlowStatus.uploading ? (
                  <>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.statusText}>Uploading changes...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={colors.success}
                    />
                    <Text style={styles.statusText}>Synced</Text>
                  </>
                )}
              </View>
            </View>

            {/* Show progress if downloading */}
            {syncStatus.dataFlowStatus.downloading && (
              <View style={styles.progressSection}>
                <ProgressBarAndroid
                  styleAttr="Horizontal"
                  indeterminate={true}
                  color={colors.primary}
                  style={styles.progressBar}
                />
              </View>
            )}

            <View style={styles.statusRow}>
              <Text style={styles.label}>Upload Queue:</Text>
              <Text style={styles.value}>
                {uploadQueueStats.count}{' '}
                {uploadQueueStats.count === 1 ? 'record' : 'records'}
                {uploadQueueStats.size
                  ? ` (${formatBytes(uploadQueueStats.size)})`
                  : ''}
              </Text>
            </View>

            {/* Show upload progress if uploading */}
            {syncStatus.dataFlowStatus.uploading &&
              uploadQueueStats.count > 0 && (
                <View style={styles.progressSection}>
                  <ProgressBarAndroid
                    styleAttr="Horizontal"
                    indeterminate={true}
                    color={colors.primary}
                    style={styles.progressBar}
                  />
                </View>
              )}
          </View>

          {/* Attachment Sync Status */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="attach" size={24} color={colors.primary} />
              <Text style={styles.sectionTitle}>Attachment Sync</Text>
            </View>

            <View style={styles.statusRow}>
              <Text style={styles.label}>Status:</Text>
              <View style={styles.statusIndicator}>
                {attachmentSyncProgress.downloading ? (
                  <>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.statusText}>
                      Downloading attachments...
                    </Text>
                  </>
                ) : attachmentSyncProgress.uploading ? (
                  <>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.statusText}>
                      Uploading attachments...
                    </Text>
                  </>
                ) : (
                  <>
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={colors.success}
                    />
                    <Text style={styles.statusText}>Synced</Text>
                  </>
                )}
              </View>
            </View>

            {/* Show attachment progress if syncing */}
            {(attachmentSyncProgress.downloading ||
              attachmentSyncProgress.uploading) && (
              <View style={styles.progressSection}>
                <ProgressBarAndroid
                  styleAttr="Horizontal"
                  indeterminate={true}
                  color={colors.primary}
                  style={styles.progressBar}
                />
              </View>
            )}

            <View style={styles.statusRow}>
              <Text style={styles.label}>Local Attachments:</Text>
              <Text style={styles.value}>{localDataStats.attachments}</Text>
            </View>
          </View>

          {/* Local Data Statistics */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="stats-chart" size={24} color={colors.primary} />
              <Text style={styles.sectionTitle}>Local Data</Text>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{localDataStats.projects}</Text>
                <Text style={styles.statLabel}>Projects</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{localDataStats.quests}</Text>
                <Text style={styles.statLabel}>Quests</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{localDataStats.assets}</Text>
                <Text style={styles.statLabel}>Assets</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {localDataStats.translations}
                </Text>
                <Text style={styles.statLabel}>Translations</Text>
              </View>
            </View>
          </View>

          {/* Error Information */}
          {(syncStatus.dataFlowStatus.downloadError ||
            syncStatus.dataFlowStatus.uploadError) && (
            <View style={[styles.section, styles.errorSection]}>
              <View style={styles.sectionHeader}>
                <Ionicons name="warning" size={24} color={colors.error} />
                <Text style={[styles.sectionTitle, { color: colors.error }]}>
                  Sync Errors
                </Text>
              </View>
              {syncStatus.dataFlowStatus.downloadError && (
                <View style={styles.errorItem}>
                  <Text style={styles.errorLabel}>Download Error:</Text>
                  <Text style={styles.errorText}>
                    {syncStatus.dataFlowStatus.downloadError.message}
                  </Text>
                </View>
              )}
              {syncStatus.dataFlowStatus.uploadError && (
                <View style={styles.errorItem}>
                  <Text style={styles.errorLabel}>Upload Error:</Text>
                  <Text style={styles.errorText}>
                    {syncStatus.dataFlowStatus.uploadError.message}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Connection Details */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons
                name="information-circle"
                size={24}
                color={colors.primary}
              />
              <Text style={styles.sectionTitle}>Connection Details</Text>
            </View>

            <View style={styles.statusRow}>
              <Text style={styles.label}>Last Sync:</Text>
              <Text style={styles.value}>
                {formatDate(syncStatus.lastSyncedAt)}
              </Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  header: {
    padding: spacing.medium
  },
  content: {
    flex: 1,
    padding: spacing.medium
  },
  section: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
    marginBottom: spacing.medium
  },
  sectionTitle: {
    fontSize: fontSizes.large,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.medium
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.small
  },
  label: {
    fontSize: fontSizes.medium,
    color: colors.textSecondary
  },
  value: {
    fontSize: fontSizes.medium,
    color: colors.text,
    fontWeight: '500'
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xsmall
  },
  statusText: {
    fontSize: fontSizes.medium,
    color: colors.text
  },
  progressSection: {
    marginTop: spacing.medium
  },
  progressLabel: {
    fontSize: fontSizes.small,
    color: colors.text,
    marginBottom: spacing.xsmall
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.small,
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary
  },
  errorSection: {
    backgroundColor: colors.error + '20'
  },
  errorText: {
    fontSize: fontSizes.small,
    color: colors.error,
    marginBottom: spacing.xsmall
  },
  overviewCard: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
    marginBottom: spacing.medium
  },
  overviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  overviewItem: {
    flexDirection: 'column',
    alignItems: 'center'
  },
  overviewLabel: {
    fontSize: fontSizes.medium,
    color: colors.textSecondary,
    marginTop: spacing.xsmall
  },
  overviewValue: {
    fontSize: fontSizes.large,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: spacing.xsmall
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.medium
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.medium
  },
  statItem: {
    flexDirection: 'column',
    alignItems: 'center'
  },
  statValue: {
    fontSize: fontSizes.large,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xsmall
  },
  statLabel: {
    fontSize: fontSizes.medium,
    color: colors.textSecondary
  },
  errorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xsmall
  },
  errorLabel: {
    fontSize: fontSizes.medium,
    fontWeight: 'bold',
    color: colors.textSecondary,
    marginRight: spacing.xsmall
  }
});
