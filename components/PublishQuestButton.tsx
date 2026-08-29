import { QuestUploadDetailsDrawer } from '@/components/QuestUploadDetailsDrawer';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useLocalization } from '@/hooks/useLocalization';
import { useQuestUploadProgress } from '@/hooks/useQuestUploadProgress';
import { cn } from '@/utils/styleUtils';
import RNAlert from '@blazejkustra/react-native-alert';
import { CloudUpload, ListChecks } from 'lucide-react-native';
import React from 'react';

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

  // Show queued upload progress whenever there are published records or audio
  // files still awaiting server confirmation. The button remains the publish
  // trigger throughout; the percent is purely indicative.
  const showProgress = !isPublishing && progress.isPending;

  return (
    <>
      <Button
        variant={isHighlighted ? 'default' : 'outline'}
        size={showProgress ? 'auto' : 'icon'}
        className={cn(
          showProgress && 'h-10 flex-row items-center gap-1 px-2.5'
        )}
        disabled={disabled}
        loading={isPublishing}
        onPress={() => setIsDrawerOpen(true)}
      >
        {!isPublishing && showProgress && (
          <>
            <Icon as={ListChecks} size={16} className={foregroundClass} />
            <Text
              className={cn(
                'native:text-xs text-xs font-semibold',
                foregroundClass
              )}
            >
              {progress.percent}%
            </Text>
          </>
        )}
        {!isPublishing && !showProgress && (
          <Icon as={CloudUpload} size={18} className={foregroundClass} />
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
