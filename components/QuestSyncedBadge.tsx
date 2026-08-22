import { QuestUploadDetailsDrawer } from '@/components/QuestUploadDetailsDrawer';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useQuestUploadProgress } from '@/hooks/useQuestUploadProgress';
import { CheckCheck, CloudUpload, ListChecks } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';

interface QuestSyncedBadgeProps {
  questId?: string | null;
  questName?: string;
}

/**
 * Badge shown in place of the publish button once a quest is published.
 * Tapping it opens the upload-status drawer (read-only: no publish action).
 * Shows a check while everything is confirmed, or a queue icon + percent
 * while records/audio are still awaiting server confirmation.
 */
export function QuestSyncedBadge({ questId, questName }: QuestSyncedBadgeProps) {
  const progress = useQuestUploadProgress(questId);
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);

  return (
    <>
      <Button
        variant="outline"
        className="h-10 border-border/50 px-4 py-0"
        onPress={() => setIsDrawerOpen(true)}
      >
        <View className="flex-row items-center gap-0.5">
          <Icon as={CloudUpload} size={18} />
          {progress.isPending ? (
            <>
              <Icon as={ListChecks} size={14} />
              <Text className="native:text-xs text-xs font-semibold">
                {progress.percent}%
              </Text>
            </>
          ) : (
            <Icon as={CheckCheck} size={14} />
          )}
        </View>
      </Button>

      <QuestUploadDetailsDrawer
        isOpen={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        questName={questName}
        progress={progress}
      />
    </>
  );
}
