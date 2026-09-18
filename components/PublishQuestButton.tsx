import { QuestUploadDetailsDrawer } from '@/components/QuestUploadDetailsDrawer';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { useLocalization } from '@/hooks/useLocalization';
import { useQuestUploadProgress } from '@/hooks/useQuestUploadProgress';
import { Text } from '@/components/ui/text';
import { cn } from '@/utils/styleUtils';
import RNAlert from '@blazejkustra/react-native-alert';
import { CloudUpload, ListChecks } from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';

interface PublishQuestButtonProps {
  questId?: string | null;
  questName?: string;
  disabled?: boolean;
  isPublishing: boolean;
  isOnline: boolean;
  isMember: boolean;
  hasLocalAssets?: boolean;
  onPublish: () => void;
}

export function PublishQuestButton({
  questId,
  questName,
  disabled,
  isPublishing,
  isOnline,
  isMember,
  hasLocalAssets = false,
  onPublish
}: PublishQuestButtonProps) {
  const { t } = useLocalization();
  const progress = useQuestUploadProgress(questId);
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);

  // Tapping the toolbar button opens the details drawer; the actual publish
  // action (with its confirmation alert) lives in the drawer footer.
  const handlePublishPress = () => {
    if (!isOnline) {
      RNAlert.alert(t('error'), t('cannotPublishWhileOffline'));
      return;
    }

    if (!isMember) {
      RNAlert.alert(t('error'), t('membersOnlyPublish'));
      return;
    }

    const displayQuestName = questName || 'this chapter';

    RNAlert.alert(
      t('publishChapter'),
      t('publishChapterMessage').replace('{questName}', displayQuestName),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('publish'),
          style: 'default',
          isPreferred: true,
          onPress: () => {
            setIsDrawerOpen(false);
            onPublish();
          }
        }
      ]
    );
  };

  const isHighlighted = hasLocalAssets;
  const foregroundClass = isHighlighted
    ? 'text-primary-foreground'
    : 'text-foreground';

  // Draft rows and audio upload as soon as they are created, so a draft has
  // real backup progress to show. Mirror QuestSyncedBadge (which replaces
  // this button once published_at is set): icon only when everything is
  // confirmed, queue icon + percent while something is still in flight.
  const showPercent = !isPublishing && progress.isPending;
  return (
    <>
      <Button
        variant={isHighlighted ? 'default' : 'outline'}
        size={showPercent ? 'sm' : 'icon'}
        className={cn(showPercent && 'py-0')}
        disabled={disabled}
        loading={isPublishing}
        onPress={() => setIsDrawerOpen(true)}
        testID="quest-publish"
      >
        {!isPublishing && (
          <View className="flex-row items-center gap-0.5">
            <Icon as={CloudUpload} size={18} className={foregroundClass} />
            {showPercent && (
              <>
                <Icon as={ListChecks} size={14} className={foregroundClass} />
                <Text
                  className={cn(
                    'native:text-xs text-xs font-semibold',
                    foregroundClass
                  )}
                  testID="quest-publish-percent"
                >
                  {progress.percent}%
                </Text>
              </>
            )}
          </View>
        )}
      </Button>

      <QuestUploadDetailsDrawer
        isOpen={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        questName={questName}
        progress={progress}
        canPublish={!disabled && !isPublishing}
        isPublishing={isPublishing}
        onPublishPress={handlePublishPress}
      />
    </>
  );
}
