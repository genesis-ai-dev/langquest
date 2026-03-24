import {
  SpeedDial,
  SpeedDialItem,
  SpeedDialItems,
  SpeedDialTrigger
} from '@/components/ui/speed-dial';
import { useChapterExport } from '@/hooks/useChapterExport';
import { useLocalization } from '@/hooks/useLocalization';
import { useQuestPublishStatus } from '@/hooks/useQuestPublishStatus';
import type { MembershipRole } from '@/hooks/useUserPermissions';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import {
  DownloadIcon,
  HardDriveDownload,
  Share,
  Share2Icon
} from 'lucide-react-native';
import React, { useState } from 'react';
import { View } from 'react-native';
import { ExportQuestList } from './ExportQuestList';

interface ExportButtonProps {
  questId: string;
  projectId: string;
  questName?: string;
  disabled?: boolean;
  menuDirection?: 'up' | 'down';
  // Optional: pass membership from parent to avoid duplicate queries
  membership?: MembershipRole;
  passedQuestPublished?: boolean;
}

export function ExportButton({
  questId,
  projectId,
  // questName,
  disabled,
  menuDirection = 'down',
  membership: passedMembership,
  passedQuestPublished = false
}: ExportButtonProps) {
  const { t } = useLocalization();
  // Use passed membership if available, otherwise fetch it
  const { membership: fetchedMembership, isMembershipLoading } =
    useUserPermissions(projectId, 'open_project');
  const membership = passedMembership ?? fetchedMembership;
  const exportMutation = useChapterExport();
  // const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [showExportQuestList, setShowExportQuestList] = useState(false);
  const [initialShareEnable, setInitialShareEnable] = useState(false);
  // const [currentExportId, setCurrentExportId] = useState<string | null>(null);
  // const [isConcatenating, setIsConcatenating] = useState(false);
  const [isConcatenating] = useState(false);

  // Check feature flag
  // const enableQuestExport = useLocalStore((state) => state.enableQuestExport);

  // Fetch quest publish status
  const { isPublished: isQuestPublished } = useQuestPublishStatus(questId);

  const canExport = membership === 'member' || membership === 'owner';
  const canExportDistribution = membership === 'owner';

  // Determine visibility conditions
  // const showFeedbackExport = isQuestPublished;
  const showDistributionExport = canExportDistribution && isQuestPublished;

  // Debug logging (remove in production)
  React.useEffect(() => {
    if (__DEV__) {
      console.log('[ExportButton] Debug:', {
        //enableQuestExport,
        membership,
        passedMembership,
        fetchedMembership,
        isMembershipLoading,
        canExport,
        canExportDistribution,
        isQuestPublished,
        showDistributionExport,
        projectId,
        questId
      });
    }
  }, [
    //enableQuestExport,
    membership,
    passedMembership,
    fetchedMembership,
    isMembershipLoading,
    canExport,
    canExportDistribution,
    isQuestPublished,
    showDistributionExport,
    projectId,
    questId
  ]);

  // Don't show export button if feature flag is disabled or user doesn't have permissions
  // Wait for membership to load if we don't have passed membership
  // Feature is no longer experimental
  // if (!enableQuestExport) {
  //     return null;
  // }

  // Allow export only for local content
  if (isQuestPublished || passedQuestPublished) {
    return null;
  }

  // If membership is still loading and we don't have passed membership, don't show button yet
  if (!passedMembership && isMembershipLoading) {
    return null;
  }

  if (!canExport) {
    return null;
  }

  const openExportList = (shareEnabledByDefault: boolean) => {
    setInitialShareEnable(shareEnabledByDefault);
    setShowExportQuestList(true);
  };

  return (
    <View className="z-50" style={{ elevation: 50 }}>
      <SpeedDial className="relative z-50 items-start">
        {menuDirection === 'up' && (
          <SpeedDialItems
            className="absolute bottom-full z-50 mb-2"
            style={{ elevation: 60 }}
          >
            <SpeedDialItem
              icon={Share2Icon}
              variant="outline"
              size="icon"
              className="rounded-md border border-input bg-background"
              iconClassName="text-foreground"
              onPress={() => openExportList(true)}
            />
            <SpeedDialItem
              icon={DownloadIcon}
              variant="outline"
              size="icon"
              className="rounded-md border border-input bg-background"
              iconClassName="text-foreground"
              onPress={() => openExportList(false)}
            />
          </SpeedDialItems>
        )}

        <SpeedDialTrigger
          variant="outline"
          size="icon"
          iconClosed={Share}
          iconOpen={undefined}
          iconSize={16}
          disableIconRotation
          disabled={disabled || exportMutation.isPending || isConcatenating}
          className="rounded-md border border-input bg-background"
          openClassName="bg-accent border-input "
          iconClassName="text-foreground"
        />

        {menuDirection === 'down' && (
          <SpeedDialItems
            className="absolute top-full z-50 mt-2"
            style={{ elevation: 60 }}
          >
            <SpeedDialItem
              icon={Share2Icon}
              variant="outline"
              size="icon"
              className="rounded-md border border-input bg-background"
              iconClassName="text-foreground"
              onPress={() => openExportList(true)}
            />
            <SpeedDialItem
              icon={HardDriveDownload}
              variant="outline"
              size="icon"
              className="rounded-md border border-input bg-background"
              iconClassName="text-foreground"
              onPress={() => openExportList(false)}
            />
          </SpeedDialItems>
        )}
      </SpeedDial>

      <ExportQuestList
        isOpen={showExportQuestList}
        onClose={() => setShowExportQuestList(false)}
        currentProjectId={projectId}
        currentQuestId={questId}
        initialShareEnable={initialShareEnable}
      />
    </View>
  );
}
