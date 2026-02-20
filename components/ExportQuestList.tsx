import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Text } from '@/components/ui/text';
import { useAssetsByQuest } from '@/hooks/db/useAssets';
import { useQuestById } from '@/hooks/db/useQuests';
import { LegendList } from '@legendapp/list';
import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ExportQuestListProps {
  isOpen: boolean;
  onClose: () => void;
  currentProjectId: string;
  currentQuestId: string;
}

interface AssetItem {
  id: string;
  name: string | null;
  source?: 'cloud' | 'local' | 'synced';
}

export function ExportQuestList({
  isOpen,
  onClose,
  currentProjectId,
  currentQuestId
}: ExportQuestListProps) {
  const { quest } = useQuestById(currentQuestId);
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useAssetsByQuest(currentQuestId, '', true);

  const [selectedAssetIds, setSelectedAssetIds] = React.useState<Set<string>>(
    () => new Set()
  );
  const [hasUserTouchedSelection, setHasUserTouchedSelection] =
    React.useState(false);

  const assets = React.useMemo(() => {
    const allAssets = data.pages.flatMap((page) => page.data) as AssetItem[];
    const assetMap = new Map<string, AssetItem>();

    for (const asset of allAssets) {
      const existing = assetMap.get(asset.id);
      if (!existing) {
        assetMap.set(asset.id, asset);
      } else if (asset.source === 'synced' && existing.source !== 'synced') {
        assetMap.set(asset.id, asset);
      }
    }

    return Array.from(assetMap.values());
  }, [data.pages]);

  React.useEffect(() => {
    if (isOpen && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [isOpen, hasNextPage, isFetchingNextPage, fetchNextPage]);

  React.useEffect(() => {
    if (!hasUserTouchedSelection) {
      setSelectedAssetIds(new Set(assets.map((asset) => asset.id)));
    }
  }, [assets, hasUserTouchedSelection]);

  React.useEffect(() => {
    if (!isOpen) {
      setHasUserTouchedSelection(false);
      setSelectedAssetIds(new Set());
    }
  }, [isOpen, currentProjectId, currentQuestId]);

  const isAllSelected = React.useMemo(() => {
    if (assets.length === 0) return false;
    return assets.every((asset) => selectedAssetIds.has(asset.id));
  }, [assets, selectedAssetIds]);

  const selectedCount = React.useMemo(
    () =>
      assets.reduce(
        (count, asset) => count + (selectedAssetIds.has(asset.id) ? 1 : 0),
        0
      ),
    [assets, selectedAssetIds]
  );

  const handleToggleAll = React.useCallback(() => {
    setHasUserTouchedSelection(true);
    setSelectedAssetIds((prev) => {
      const currentlyAllSelected = assets.every((asset) => prev.has(asset.id));
      if (currentlyAllSelected) return new Set<string>();
      return new Set(assets.map((asset) => asset.id));
    });
  }, [assets]);

  const insets = useSafeAreaInsets();

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const noop = React.useCallback((_: boolean) => {}, []);

  const handleToggleAsset = React.useCallback((assetId: string) => {
    setHasUserTouchedSelection(true);
    setSelectedAssetIds((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) {
        next.delete(assetId);
      } else {
        next.add(assetId);
      }
      return next;
    });
  }, []);

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-background">
        {/* ── Fixed header (Tarefa 1: pt respeita a safe area do smartphone) ── */}
        <View
          style={{ paddingTop: insets.top + 16 }}
          className="border-b border-border px-6 pb-4"
        >
          <Text variant="h4">Export Quest</Text>
          <Text className="text-sm text-muted-foreground">
            {quest?.name || '-'}
          </Text>
        </View>

        {/* ── Fixed list-header (Tarefa 2: sem card, apenas linha simples) ── */}
        <View className="mx-6 mt-4 flex-row items-center justify-between border-b border-border pb-2">
          <View className="flex-row items-center gap-3">
            <Checkbox
              checked={isAllSelected}
              onCheckedChange={handleToggleAll}
            />
            <Text className="font-medium">Assets</Text>
          </View>
          <Text className="text-sm text-muted-foreground">
            {selectedCount}/{assets.length}
          </Text>
        </View>

        {/* ── Scrollable list (fills all remaining space) ── */}
        <View className="flex-1 px-6 pt-3">
          {isLoading && assets.length === 0 ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator />
            </View>
          ) : (
            <LegendList
              data={assets}
              estimatedItemSize={56}
              keyExtractor={(item) => item.id}
              extraData={selectedAssetIds}
              contentContainerStyle={{ paddingBottom: 8 }}
              renderItem={({ item }) => {
                const checked = selectedAssetIds.has(item.id);
                return (
                  <Pressable
                    onPress={() => handleToggleAsset(item.id)}
                    className="mb-2 flex-row items-center gap-3 rounded-lg border border-border px-3 py-3"
                  >
                    {/* pointerEvents="none" evita duplo disparo:
                        só o Pressable do row gerencia o toggle */}
                    <View pointerEvents="none">
                      <Checkbox checked={checked} onCheckedChange={noop} />
                    </View>
                    <Text className="flex-1" numberOfLines={1}>
                      {item.name || 'Untitled asset'}
                    </Text>
                  </Pressable>
                );
              }}
              ListEmptyComponent={() => (
                <View className="items-center justify-center py-16">
                  <Text className="text-muted-foreground">
                    No assets found for this quest.
                  </Text>
                </View>
              )}
              ListFooterComponent={() =>
                isFetchingNextPage ? (
                  <View className="py-3">
                    <ActivityIndicator />
                  </View>
                ) : null
              }
            />
          )}
        </View>

        {/* ── Fixed footer ── */}
        <View className="border-t border-border px-6 pb-4 pt-4">
          <Button>
            <Text>Export</Text>
          </Button>
          <Button onPress={onClose} variant="outline" className="mb-2">
            <Text>Cancel</Text>
          </Button>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
