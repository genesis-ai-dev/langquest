import { AutoLayout } from '@/components/ui/auto-layout';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/utils/styleUtils';
import { PlusIcon } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';

function RecordAssetCardSkeletonInternal() {
  return (
    <AutoLayout>
      <View
        className={cn(
          'relative overflow-hidden rounded-lg border-2 border-dashed border-border bg-muted/10 p-3'
        )}
      >
        <View className="flex-row items-center justify-center gap-3">
          {/* Número vazio - mantém o tamanho */}
          <View className="w-[28px] h-6 items-center justify-center self-center rounded border border-border px-2 py-0.5 bg-muted">
            {/* Quadro em branco */}
          </View>

          {/* Botão com ícone "+" */}
          <View className="ml-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
            {/* <Icon as={PlusIcon} size={16} className="text-primary/80" /> */}
          </View>

          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text className="text-sm font-medium text-foreground/50">
                New Recording
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Text className="text-xs text-muted-foreground/50">
                Will be inserted here
              </Text>
            </View>
          </View>
          <View className="mr-3">
            <Icon as={PlusIcon} size={16} className="text-primary/30" />
          </View>
        </View>
      </View>
    </AutoLayout>
  );
}

export const RecordAssetCardSkeleton = React.memo(RecordAssetCardSkeletonInternal);
