import { QuestUploadDetailsDrawer } from '@/components/QuestUploadDetailsDrawer';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { useLocalization } from '@/hooks/useLocalization';
import { useQuestUploadProgress } from '@/hooks/useQuestUploadProgress';
import RNAlert from '@blazejkustra/react-native-alert';
import { CloudUpload } from 'lucide-react-native';
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

  // No percent here: this button only renders for a draft, and a draft has
  // nothing uploaded to report on. Confirmation progress belongs to
  // QuestSyncedBadge, which replaces this button once published_at is set.
  return (
    <>
      <Button
        variant={isHighlighted ? 'default' : 'outline'}
        size="icon"
        disabled={disabled}
        loading={isPublishing}
        onPress={() => setIsDrawerOpen(true)}
      >
        {!isPublishing && (
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
