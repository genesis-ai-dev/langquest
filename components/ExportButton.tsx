import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { shareExportLink, useChapterExport } from '@/hooks/useChapterExport';
import { useLocalization } from '@/hooks/useLocalization';
import { useQuestPublishStatus } from '@/hooks/useQuestPublishStatus';
import type { MembershipRole } from '@/hooks/useUserPermissions';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useLocalStore } from '@/store/localStore';
import { concatenateAndShareQuestAudio } from '@/utils/localAudioConcat';
import { useThemeColor } from '@/utils/styleUtils';
import RNAlert from '@blazejkustra/react-native-alert';
import React, { useState } from 'react';
import { View } from 'react-native';
import { ExportProgressModal } from './ExportProgressModal';
import { ExportTypeSelector } from './ExportTypeSelector';

interface ExportButtonProps {
  questId: string;
  projectId: string;
  questName?: string;
  disabled?: boolean;
  // Optional: pass membership from parent to avoid duplicate queries
  membership?: MembershipRole;
}

export function ExportButton({
  questId,
  projectId,
  questName,
  disabled,
  membership: passedMembership
}: ExportButtonProps) {
  const { t } = useLocalization();
  const primaryColor = useThemeColor('primary');
  // Use passed membership if available, otherwise fetch it
  const { membership: fetchedMembership, isMembershipLoading } =
    useUserPermissions(projectId, 'open_project');
  const membership = passedMembership ?? fetchedMembership;
  const exportMutation = useChapterExport();
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [currentExportId, setCurrentExportId] = useState<string | null>(null);
  const [isConcatenating, setIsConcatenating] = useState(false);

  // Check feature flag
  const enableQuestExport = useLocalStore((state) => state.enableQuestExport);

  // Fetch quest publish status
  const { isPublished: isQuestPublished } = useQuestPublishStatus(questId);

  const canExport = membership === 'member' || membership === 'owner';
  const canExportDistribution = membership === 'owner';

  // Determine visibility conditions
  const showFeedbackExport = isQuestPublished;
  const showDistributionExport = canExportDistribution && isQuestPublished;

  // Debug logging (remove in production)
  React.useEffect(() => {
    if (__DEV__) {
      console.log('[ExportButton] Debug:', {
        enableQuestExport,
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
    enableQuestExport,
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
  if (!enableQuestExport) {
    return null;
  }

  // If membership is still loading and we don't have passed membership, don't show button yet
  if (!passedMembership && isMembershipLoading) {
    return null;
  }

  if (!canExport) {
    return null;
  }

  const handleExport = async (
    exportType: 'local' | 'feedback' | 'distribution'
  ) => {
    setShowTypeSelector(false);

    // Handle local share
    if (exportType === 'local') {
      setIsConcatenating(true);
      try {
        await concatenateAndShareQuestAudio(questId, questName);
        setIsConcatenating(false);
      } catch (error) {
        setIsConcatenating(false);
        RNAlert.alert(
          t('error'),
          error instanceof Error ? error.message : 'Failed to share audio'
        );
      }
      return;
    }

    exportMutation.mutate(
      {
        quest_id: questId,
        export_type: exportType
      },
      {
        onSuccess: (data) => {
          // Only show share sheet if export is ready and has share_url
          // Don't share immediately if still processing
          if (data.status === 'ready' && data.share_url) {
            // Show share sheet for feedback exports
            shareExportLink(data.share_url).catch((error) => {
              console.error('Failed to share:', error);
            });
          }

          if (data.status === 'processing' || data.status === 'pending') {
            setCurrentExportId(data.id);
          } else if (data.status === 'ready') {
            // Don't show alert if we're sharing (share sheet will show)
            if (!data.share_url) {
              RNAlert.alert(
                t('success'),
                t('exportReady') || 'Export is ready!'
              );
            }
          }
        },
        onError: (error) => {
          RNAlert.alert(
            t('error'),
            error.message || t('exportFailed') || 'Export failed'
          );
        }
      }
    );
  };

  return (
    <View>
      <Button
        variant="outline"
        size="icon"
        onPress={() => setShowTypeSelector(true)}
        disabled={disabled || exportMutation.isPending || isConcatenating}
        className="border-[1.5px] border-primary"
        loading={isConcatenating}
      >
        <Icon name="share-2" className="text-primary" />
      </Button>

      <ExportTypeSelector
        visible={showTypeSelector}
        onClose={() => setShowTypeSelector(false)}
        onSelect={handleExport}
        showFeedbackExport={showFeedbackExport}
        showDistributionExport={showDistributionExport}
        questId={questId}
      />

      {currentExportId && (
        <ExportProgressModal
          exportId={currentExportId}
          visible={!!currentExportId}
          onClose={() => setCurrentExportId(null)}
        />
      )}
    </View>
  );
}
