import { AssetSkeleton } from '@/components/AssetSkeleton';
import { SourceContent } from '@/components/SourceContent';
import { asset, asset_content_link } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import type { Asset, AssetContent } from '@/hooks/db/useAssets';
import { useLanguageById } from '@/hooks/db/useLanguages';
import { useCurrentNavigation } from '@/hooks/useAppNavigation';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { colors, fontSizes, sharedStyles, spacing } from '@/styles/theme';
import { useQuery } from '@tanstack/react-query';
import { eq } from 'drizzle-orm';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

interface AssetWithContent extends Asset {
  content?: AssetContent[];
  source?: string;
}

function useNextGenOfflineAsset(assetId: string) {
  return useQuery({
    queryKey: ['asset', 'offline', assetId],
    queryFn: async () => {
      // Get asset with content
      const assetResult = await system.db
        .select()
        .from(asset)
        .where(eq(asset.id, assetId))
        .limit(1);

      if (!assetResult.length) return null;

      const assetData = assetResult[0];

      // Get asset content
      const contentResult = await system.db
        .select()
        .from(asset_content_link)
        .where(eq(asset_content_link.asset_id, assetId));

      return {
        ...assetData,
        content: contentResult,
        source: 'localSqlite'
      } as AssetWithContent;
    },
    enabled: !!assetId
  });
}

async function useNextGenCloudAsset(
  assetId: string
): Promise<AssetWithContent | null> {
  const { data: assetData, error: assetError } =
    await system.supabaseConnector.client
      .from('asset')
      .select('*')
      .eq('id', assetId)
      .limit(1)
      .overrideTypes<Asset[]>();

  if (assetError) throw assetError;
  if (!assetData.length) return null;

  const { data: contentData, error: contentError } =
    await system.supabaseConnector.client
      .from('asset_content_link')
      .select('*')
      .eq('asset_id', assetId)
      .overrideTypes<AssetContent[]>();

  if (contentError) throw contentError;

  return {
    ...assetData[0],
    content: contentData,
    source: 'cloudSupabase'
  } as AssetWithContent;
}

export default function NextGenAssetDetailView() {
  const { currentAssetId } = useCurrentNavigation();
  const isOnline = useNetworkStatus();

  const [useOfflineData, setUseOfflineData] = useState(true);
  const [cloudAsset, setCloudAsset] = useState<AssetWithContent | null>(null);
  const [isCloudLoading, setIsCloudLoading] = useState(true);
  const [cloudError, setCloudError] = useState<Error | null>(null);

  const { data: offlineAsset, isLoading: isOfflineLoading } =
    useNextGenOfflineAsset(currentAssetId || '');

  // Fetch cloud asset directly - only when online
  useEffect(() => {
    if (!currentAssetId) return;

    const fetchCloudAsset = async () => {
      try {
        setIsCloudLoading(true);
        setCloudError(null);

        // Check network status before making cloud query
        if (!isOnline) {
          console.log('📱 [ASSET DETAIL] Skipping cloud query - offline');
          setCloudAsset(null);
          setIsCloudLoading(false);
          return;
        }

        console.log('🌐 [ASSET DETAIL] Making cloud query - online');
        const asset = await useNextGenCloudAsset(currentAssetId);
        setCloudAsset(asset);
      } catch (error) {
        console.error('Error fetching cloud asset:', error);
        setCloudError(error as Error);
        setCloudAsset(null);
      } finally {
        setIsCloudLoading(false);
      }
    };

    void fetchCloudAsset();
  }, [currentAssetId, isOnline]);

  // Determine which asset to display
  const activeAsset = useOfflineData ? offlineAsset : cloudAsset;
  const isLoading = useOfflineData ? isOfflineLoading : isCloudLoading;

  const {
    language: sourceLanguage,
    isLanguageLoading: isSourceLanguageLoading
  } = useLanguageById(activeAsset?.source_language_id || '');

  console.log({
    assetId: currentAssetId,
    isOnline,
    useOfflineData,
    offlineAsset: offlineAsset
      ? {
          id: offlineAsset.id,
          name: offlineAsset.name,
          source: offlineAsset.source
        }
      : null,
    cloudAsset: cloudAsset
      ? { id: cloudAsset.id, name: cloudAsset.name, source: cloudAsset.source }
      : null,
    activeAsset: activeAsset
      ? {
          id: activeAsset.id,
          name: activeAsset.name,
          source: activeAsset.source
        }
      : null,
    cloudError: cloudError?.message ?? null
  });

  if (!currentAssetId) {
    return (
      <View style={sharedStyles.container}>
        <Text style={sharedStyles.title}>No Asset Selected</Text>
      </View>
    );
  }

  const renderSourceTag = (source: string | undefined) => {
    if (source === 'cloudSupabase') {
      return <Text style={styles.sourceTag}>🌐 Cloud</Text>;
    }
    return <Text style={styles.sourceTag}>💾 Offline</Text>;
  };

  const renderErrorMessage = () => {
    if (isLoading || isSourceLanguageLoading) {
      return <AssetSkeleton />;
    }

    if (!activeAsset) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            {useOfflineData
              ? 'Asset not available offline'
              : cloudError
                ? `Cloud error: ${cloudError.message}`
                : 'Asset not found online'}
          </Text>
          <Text style={styles.errorHint}>
            {useOfflineData && cloudAsset
              ? 'Try switching to Cloud data source above'
              : !useOfflineData && offlineAsset
                ? 'Try switching to Offline data source above'
                : 'This asset may not be synchronized or may not exist'}
          </Text>
        </View>
      );
    }
    return null;
  };

  return (
    <ScrollView style={sharedStyles.container}>
      {/* Data Source Toggle - Always visible */}
      <View style={styles.toggleContainer}>
        <Text style={styles.toggleLabel}>Data Source:</Text>
        <View style={styles.toggleRow}>
          <Text
            style={[
              styles.toggleText,
              !useOfflineData && styles.inactiveToggleText
            ]}
          >
            💾 Offline {offlineAsset ? '✅' : '❌'}
          </Text>
          <Switch
            value={!useOfflineData}
            onValueChange={(value) => setUseOfflineData(!value)}
            trackColor={{ false: colors.inputBackground, true: colors.primary }}
            thumbColor={colors.buttonText}
          />
          <Text
            style={[
              styles.toggleText,
              useOfflineData && styles.inactiveToggleText
            ]}
          >
            🌐 Cloud{' '}
            {isOnline ? (cloudAsset ? '✅' : cloudError ? '❌' : '⏳') : '🔴'}
          </Text>
        </View>
      </View>

      {/* Error Message or Asset Content */}
      {renderErrorMessage() || (
        <>
          {/* Asset Header */}
          <View style={styles.header}>
            {renderSourceTag(activeAsset!.source)}
            <Text style={styles.assetName}>{activeAsset!.name}</Text>
            <Text style={styles.assetInfo}>
              Language:{' '}
              {sourceLanguage?.native_name ??
                sourceLanguage?.english_name ??
                'Unknown'}
            </Text>
            <Text style={styles.assetInfo}>
              ID: {activeAsset!.id.substring(0, 8)}...
            </Text>
          </View>

          {/* Content Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Content</Text>
            {activeAsset!.content && activeAsset!.content.length > 0 ? (
              activeAsset!.content.map((content, index) => (
                <View key={index} style={styles.contentItem}>
                  <SourceContent
                    content={content}
                    sourceLanguage={sourceLanguage ?? null}
                    audioUri={null} // Simplified - no audio handling for now
                    isLoading={false}
                  />
                </View>
              ))
            ) : (
              <Text style={styles.noContentText}>No content available</Text>
            )}
          </View>

          {/* Images Section */}
          {activeAsset!.images && activeAsset!.images.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Images</Text>
              <Text style={styles.imageCount}>
                {activeAsset!.images.length} image(s) available
              </Text>
              {/* Simplified - just show count for now */}
            </View>
          )}
        </>
      )}

      {/* Debug Info */}
      <View style={styles.debugSection}>
        <Text style={styles.debugTitle}>Debug Info</Text>
        <Text style={styles.debugText}>
          Network Status: {isOnline ? '🟢 Online' : '🔴 Offline'}
        </Text>
        <Text style={styles.debugText}>
          Offline Available: {offlineAsset ? '✅' : '❌'}
        </Text>
        <Text style={styles.debugText}>
          Cloud Available:{' '}
          {isOnline ? (cloudAsset ? '✅' : cloudError ? '❌' : '⏳') : '🔴 N/A'}
        </Text>
        {cloudError && (
          <Text style={styles.debugError}>
            Cloud Error: {cloudError.message}
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  toggleContainer: {
    padding: spacing.medium,
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    margin: spacing.medium
  },
  toggleLabel: {
    color: colors.text,
    fontSize: fontSizes.medium,
    fontWeight: 'bold',
    marginBottom: spacing.small
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.medium
  },
  toggleText: {
    color: colors.text,
    fontSize: fontSizes.medium,
    fontWeight: 'bold'
  },
  inactiveToggleText: {
    opacity: 0.5
  },
  header: {
    padding: spacing.medium,
    alignItems: 'center'
  },
  sourceTag: {
    fontSize: fontSizes.small,
    color: colors.textSecondary,
    marginBottom: spacing.small
  },
  assetName: {
    color: colors.text,
    fontSize: fontSizes.xlarge,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: spacing.small
  },
  assetInfo: {
    color: colors.textSecondary,
    fontSize: fontSizes.small,
    marginBottom: spacing.xsmall
  },
  section: {
    padding: spacing.medium,
    marginBottom: spacing.medium
  },
  sectionTitle: {
    color: colors.text,
    fontSize: fontSizes.large,
    fontWeight: 'bold',
    marginBottom: spacing.medium
  },
  contentItem: {
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    padding: spacing.medium,
    marginBottom: spacing.small
  },
  noContentText: {
    color: colors.textSecondary,
    fontSize: fontSizes.medium,
    textAlign: 'center',
    fontStyle: 'italic'
  },
  imageCount: {
    color: colors.textSecondary,
    fontSize: fontSizes.medium
  },
  debugSection: {
    padding: spacing.medium,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 8,
    margin: spacing.medium
  },
  debugTitle: {
    color: colors.text,
    fontSize: fontSizes.medium,
    fontWeight: 'bold',
    marginBottom: spacing.small
  },
  debugText: {
    color: colors.textSecondary,
    fontSize: fontSizes.small,
    marginBottom: spacing.xsmall
  },
  debugError: {
    color: colors.error,
    fontSize: fontSizes.small,
    marginBottom: spacing.xsmall
  },
  errorText: {
    color: colors.error,
    fontSize: fontSizes.medium,
    textAlign: 'center',
    marginTop: spacing.medium
  },
  errorContainer: {
    padding: spacing.medium,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.large
  },
  errorHint: {
    color: colors.textSecondary,
    fontSize: fontSizes.small,
    textAlign: 'center',
    marginTop: spacing.small,
    fontStyle: 'italic'
  }
});
