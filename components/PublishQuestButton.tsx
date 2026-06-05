import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { useLocalization } from '@/hooks/useLocalization';
import { cn } from '@/utils/styleUtils';
import RNAlert from '@blazejkustra/react-native-alert';
import { CloudUpload } from 'lucide-react-native';
import React from 'react';

interface PublishQuestButtonProps {
  questName?: string;
  disabled?: boolean;
  isPublishing: boolean;
  isOnline: boolean;
  isMember: boolean;
  hasLocalAssets?: boolean;
  onPublish: () => void;
}

export function PublishQuestButton({
  questName,
  disabled,
  isPublishing,
  isOnline,
  isMember,
  hasLocalAssets = false,
  onPublish
}: PublishQuestButtonProps) {
  const { t } = useLocalization();

  const handlePress = () => {
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
          onPress: onPublish
        }
      ]
    );
  };

  const isHighlighted = hasLocalAssets;

  return (
    <Button
      variant={isHighlighted ? 'default' : 'outline'}
      size="icon"
      disabled={disabled}
      loading={isPublishing}
      onPress={handlePress}
    >
      {!isPublishing && (
        <Icon
          as={CloudUpload}
          size={18}
          className={cn(
            isHighlighted ? 'text-primary-foreground' : 'text-foreground'
          )}
        />
      )}
    </Button>
  );
}
