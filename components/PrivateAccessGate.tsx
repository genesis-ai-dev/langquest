import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/contexts/AuthContext';
import {
  profile_project_link,
  project as projectTable,
  request
} from '@/db/drizzleSchema';
import { request_synced } from '@/db/drizzleSchemaSynced';
import { system } from '@/db/powersync/system';
import { useLocalization } from '@/hooks/useLocalization';
import type { PrivateAccessAction } from '@/hooks/useUserPermissions';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { isExpiredByLastUpdated } from '@/utils/dateUtils';
import { useHybridData } from '@/views/new/useHybridData';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import type { InferSelectModel } from 'drizzle-orm';
import { and, eq } from 'drizzle-orm';
import {
  CircleAlertIcon,
  CircleArrowDownIcon,
  CircleMinusIcon,
  CircleXIcon,
  ClockIcon,
  InfoIcon,
  LockIcon,
  LockOpenIcon,
  XIcon
} from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  TouchableWithoutFeedback,
  View
} from 'react-native';

// Type definitions
type Request = InferSelectModel<typeof request>;
type ProfileProjectLink = InferSelectModel<typeof profile_project_link>;

interface PrivateAccessGateProps {
  projectId: string;
  projectName: string;
  isPrivate: boolean;
  action: PrivateAccessAction;
  children?: React.ReactNode;
  onAccessGranted?: () => void;
  renderTrigger?: (props: {
    onPress: () => void;
    hasAccess: boolean;
  }) => React.ReactNode;
  inline?: boolean;
  modal?: boolean; // New prop to show as modal instead of inline
  allowBypass?: boolean; // For download scenario
  onBypass?: () => void;
  customMessage?: string;
  showViewProjectButton?: boolean;
  viewProjectButtonText?: string;
  onMembershipGranted?: () => void;
  onClose?: () => void;
  isVisible?: boolean; // For modal mode
}

export const PrivateAccessGate: React.FC<PrivateAccessGateProps> = ({
  projectId,
  projectName,
  isPrivate,
  action,
  children,
  onAccessGranted,
  renderTrigger,
  inline = false,
  modal = false,
  allowBypass = false,
  onBypass,
  customMessage,
  showViewProjectButton,
  viewProjectButtonText,
  onMembershipGranted,
  onClose,
  isVisible = false
}) => {
  const { t } = useLocalization();
  const { currentUser } = useAuth();
  const { db } = system;
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { hasAccess } = useUserPermissions(projectId, action, isPrivate);


  // Query for existing membership request using useHybridData
  const { data: existingRequests } = useHybridData({
    dataType: 'membership-request',
    queryKeyParams: [projectId, currentUser?.id || '', refreshKey],

    // PowerSync query using Drizzle
    offlineQuery: toCompilableQuery(
      db.query.request.findMany({
        where: and(
          eq(request.sender_profile_id, currentUser?.id || ''),
          eq(request.project_id, projectId)
        )
      })
    ),

    // Cloud query
    cloudQueryFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('request')
        .select('*')
        .eq('sender_profile_id', currentUser?.id || '')
        .eq('project_id', projectId);
      if (error) throw error;
      return data as Request[];
    }
  });

  // Query for membership status (for modal mode) using useHybridData
  const { data: membershipLinks } = useHybridData({
    dataType: 'membership-status',
    queryKeyParams: [projectId, currentUser?.id || ''],

    // PowerSync query using Drizzle
    offlineQuery: toCompilableQuery(
      db.query.profile_project_link.findMany({
        where: and(
          eq(profile_project_link.profile_id, currentUser?.id || ''),
          eq(profile_project_link.project_id, projectId),
          eq(profile_project_link.active, true)
        )
      })
    ),

    // Cloud query
    cloudQueryFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('profile_project_link')
        .select('*')
        .eq('profile_id', currentUser?.id || '')
        .eq('project_id', projectId)
        .eq('active', true)
        .overrideTypes<ProfileProjectLink[]>();
      if (error) throw error;
      return data;
    },

    // Only run cloud query when in modal mode
    enableCloudQuery: modal
  });

  const isMember = membershipLinks.length > 0;
  const existingRequest = existingRequests[0];

  // Query for project download status using useHybridData
  // This checks if the project has been downloaded (possibly through other actions)
  const { data: downloadStatusData } = useHybridData({
    dataType: 'download-status',
    queryKeyParams: ['project', projectId, currentUser?.id || ''],

    // PowerSync query using Drizzle
    offlineQuery: toCompilableQuery(
      db.query.project.findMany({
        where: eq(projectTable.id, projectId),
        columns: {
          id: true,
          download_profiles: true
        }
      })
    ),

    // Cloud query
    cloudQueryFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('project')
        .select('id, download_profiles')
        .eq('id', projectId)
        .overrideTypes<{ id: string; download_profiles: string[] | null }[]>();
      if (error) throw error;
      return data;
    },

    // Transform to check if user is in download_profiles
    getItemId: (item) => item.id
  });

  // Check if current user is in the download_profiles array
  const projectData = downloadStatusData[0];
  const isProjectDownloaded =
    projectData?.download_profiles?.includes(currentUser?.id || '') ?? false;

  // Auto-close modal and trigger navigation when user becomes a member (modal mode only)
  useEffect(() => {
    if (modal && isMember && isVisible) {
      onClose?.();
      onMembershipGranted?.();
    }
  }, [modal, isMember, isVisible, onClose, onMembershipGranted]);

  // Determine the current status
  const getRequestStatus = () => {
    if (!existingRequest) return null;

    if (
      existingRequest.status === 'pending' &&
      isExpiredByLastUpdated(existingRequest.last_updated)
    ) {
      return 'expired';
    }

    return existingRequest.status;
  };

  const currentStatus = getRequestStatus();

  const handleRequestMembership = async () => {
    if (!currentUser) return;

    setIsSubmitting(true);
    try {
      if (existingRequest) {
        // Update existing request via synced table - PowerSync will sync to Supabase
        await db
          .update(request_synced)
          .set({
            status: 'pending',
            count: (existingRequest.count || 0) + 1,
            last_updated: new Date().toISOString()
          })
          .where(eq(request_synced.id, existingRequest.id));
      } else {
        // Create new request via synced table - PowerSync will sync to Supabase
        await db.insert(request_synced).values({
          sender_profile_id: currentUser.id,
          project_id: projectId,
          status: 'pending',
          count: 1
        });
      }

      // Trigger refresh by updating the refresh key
      setRefreshKey((prev) => prev + 1);

      Alert.alert(t('success'), t('membershipRequestSent'));
    } catch (error) {
      console.error('Error requesting membership:', error);
      Alert.alert(t('error'), t('failedToRequestMembership'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdrawRequest = () => {
    if (!existingRequest) return;

    Alert.alert(t('confirmWithdraw'), t('confirmWithdrawRequestMessage'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('confirm'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setIsSubmitting(true);
            try {
              // Update request via synced table - PowerSync will sync to Supabase
              await db
                .update(request_synced)
                .set({
                  status: 'withdrawn',
                  last_updated: new Date().toISOString()
                })
                .where(eq(request_synced.id, existingRequest.id));

              // Trigger refresh
              setRefreshKey((prev) => prev + 1);
              Alert.alert(t('success'), t('requestWithdrawn'));
            } catch (error) {
              console.error('Error withdrawing request:', error);
              Alert.alert(t('error'), t('failedToWithdrawRequest'));
            } finally {
              setIsSubmitting(false);
            }
          })();
        }
      }
    ]);
  };

  const handlePress = () => {
    if (hasAccess) {
      onAccessGranted?.();
    } else {
      setShowModal(true);
    }
  };

  const handleBypass = () => {
    if (modal) {
      onClose?.();
    } else {
      setShowModal(false);
    }
    onBypass?.();
  };

  const getActionMessage = () => {
    if (customMessage) return customMessage;

    switch (action) {
      case 'view_membership':
        return t('privateProjectMembersMessage');
      case 'vote':
        return t('privateProjectVotingMessage');
      case 'translate':
        return t('privateProjectTranslationMessage');
      case 'edit_transcription':
        return t('privateProjectEditingMessage');
      case 'contribute':
        return t('privateProjectTranslationMessage');
      case 'download':
        return t('privateProjectDownloadMessage');
      default:
        return t('privateProjectGenericMessage');
    }
  };

  const getActionTitle = () => {
    switch (action) {
      case 'view_membership':
        return t('privateProjectMembers');
      case 'vote':
        return t('privateProjectVoting');
      case 'translate':
        return t('privateProjectTranslation');
      case 'edit_transcription':
        return t('privateProjectEditing');
      case 'contribute':
        return t('privateProjectTranslation');
      case 'download':
        return t('privateProjectDownload');
      default:
        return t('privateProjectAccess');
    }
  };

  const renderContent = () => {
    // Handle not logged in case
    if (!currentUser) {
      return (
        <>
          <View className={modal ? 'mb-4 items-center' : 'mb-4 items-center'}>
            <Icon as={LockIcon} size={48} className="text-primary" />
          </View>
          {modal ? (
            <>
              <Text className="mb-4 text-center leading-5">
                {t('privateProjectNotLoggedIn')}
              </Text>
              <View className="mb-6 flex-row items-start gap-2 rounded-md bg-primary/10 p-4">
                <Icon as={InfoIcon} size={20} className="text-primary" />
                <Text variant="small" className="flex-1 leading-5">
                  {t('privateProjectLoginRequired')}
                </Text>
              </View>
            </>
          ) : (
            <>
              <Text variant="h4" className="text-center">
                {getActionTitle()}
              </Text>
              <Text className="mb-6 px-4 text-center leading-5 text-muted-foreground">
                {t('privateProjectNotLoggedInInline')}
              </Text>
            </>
          )}
        </>
      );
    }

    switch (currentStatus) {
      case 'pending':
        return (
          <>
            <View className={modal ? 'mb-6 items-center' : 'mb-4 items-center'}>
              <Icon as={ClockIcon} size={48} className="text-primary" />
              {modal && (
                <Text variant="h4" className="mb-2 mt-4">
                  {t('requestPending')}
                </Text>
              )}
            </View>
            {modal ? (
              <Text className="mb-4 text-center leading-5">
                {t('requestPendingInline')}
              </Text>
            ) : (
              <>
                <Text variant="h4" className="text-center">
                  {getActionTitle()} - {t('requestPending')}
                </Text>
                <Text className="mb-6 px-4 text-center leading-5 text-muted-foreground">
                  {t('requestPendingInline')}
                </Text>
              </>
            )}
            <Button
              variant="destructive"
              onPress={handleWithdrawRequest}
              disabled={isSubmitting}
              loading={isSubmitting}
              className={!modal ? 'mt-4' : ''}
            >
              <Text>
                {isSubmitting ? t('withdrawing') : t('withdrawRequest')}
              </Text>
            </Button>
          </>
        );

      case 'expired': {
        const attemptsLeft = 4 - (existingRequest?.count || 0);
        return (
          <>
            <View className={modal ? 'mb-6 items-center' : 'mb-4 items-center'}>
              <Icon
                as={CircleAlertIcon}
                size={48}
                className="text-yellow-500"
              />
              {modal && (
                <Text variant="h4" className="mb-2 mt-4">
                  {t('requestExpired')}
                </Text>
              )}
            </View>
            {modal ? (
              <Text className="mb-4 text-center leading-5">
                {attemptsLeft > 0
                  ? t('requestExpiredAttemptsRemaining', {
                      attempts: attemptsLeft,
                      plural: attemptsLeft > 1 ? 's' : ''
                    })
                  : t('requestExpiredNoAttempts')}
              </Text>
            ) : (
              <>
                <Text variant="h4" className="text-center">
                  {getActionTitle()} - {t('requestExpired')}
                </Text>
                <Text className="mb-6 px-4 text-center leading-5 text-muted-foreground">
                  {attemptsLeft > 0
                    ? t('requestExpiredInline', {
                        attempts: attemptsLeft,
                        plural: attemptsLeft > 1 ? 's' : ''
                      })
                    : t('requestExpiredNoAttemptsInline')}
                </Text>
              </>
            )}
            {attemptsLeft > 0 && (
              <Button
                onPress={handleRequestMembership}
                disabled={isSubmitting}
                loading={isSubmitting}
                className={!modal ? 'mt-4' : ''}
              >
                <Text>
                  {isSubmitting ? t('requesting') : t('requestAgain')}
                </Text>
              </Button>
            )}
          </>
        );
      }

      case 'declined': {
        const attemptsLeft = 3 - (existingRequest?.count || 0);
        return (
          <>
            <View className={modal ? 'mb-6 items-center' : 'mb-4 items-center'}>
              <Icon as={CircleXIcon} size={48} className="text-destructive" />
              {modal && (
                <Text variant="h4" className="mb-2 mt-4">
                  {t('requestDeclined')}
                </Text>
              )}
            </View>
            {modal ? (
              <Text className="mb-4 text-center leading-5">
                {attemptsLeft > 0
                  ? t('requestDeclinedCanRetry', { attempts: attemptsLeft })
                  : t('requestDeclinedNoRetry')}
              </Text>
            ) : (
              <>
                <Text variant="h4" className="text-center">
                  {getActionTitle()} - {t('requestDeclined')}
                </Text>
                <Text className="mb-6 px-4 text-center leading-5 text-muted-foreground">
                  {attemptsLeft > 0
                    ? t('requestDeclinedInline', {
                        attempts: attemptsLeft,
                        plural: attemptsLeft > 1 ? 's' : ''
                      })
                    : t('requestDeclinedNoRetryInline')}
                </Text>
              </>
            )}
            {attemptsLeft > 0 && (
              <Button
                onPress={handleRequestMembership}
                disabled={isSubmitting}
                loading={isSubmitting}
                className={!modal ? 'mt-4' : ''}
              >
                <Text>
                  {isSubmitting ? t('requesting') : t('requestAgain')}
                </Text>
              </Button>
            )}
          </>
        );
      }

      case 'withdrawn':
        return (
          <>
            <View className={modal ? 'mb-6 items-center' : 'mb-4 items-center'}>
              <Icon
                as={CircleMinusIcon}
                size={48}
                className="text-muted-foreground"
              />
              {modal && (
                <Text variant="h4" className="mb-2 mt-4">
                  {t('requestWithdrawn')}
                </Text>
              )}
            </View>
            {modal ? (
              <Text className="mb-4 text-center leading-5">
                {t('requestWithdrawnInline')}
              </Text>
            ) : (
              <>
                <Text variant="h4" className="text-center">
                  {getActionTitle()} - {t('requestWithdrawnTitle')}
                </Text>
                <Text className="mb-6 px-4 text-center leading-5 text-muted-foreground">
                  {t('requestWithdrawnInline')}
                </Text>
              </>
            )}
            <Button
              onPress={handleRequestMembership}
              disabled={isSubmitting}
              loading={isSubmitting}
              className={!modal ? 'mt-4' : ''}
            >
              <Text>
                {isSubmitting ? t('requesting') : t('requestMembership')}
              </Text>
            </Button>
          </>
        );

      default:
        // No existing request
        return (
          <>
            <View className={modal ? 'mb-4 items-center' : 'mb-4 items-center'}>
              <Icon as={LockIcon} size={48} className="text-primary" />
            </View>
            {modal ? (
              <>
                <Text className="mb-4 text-center leading-5">
                  {getActionMessage()}
                </Text>
                <View className="mb-6 flex-row items-start gap-2 rounded-md bg-primary/10 p-4">
                  <Icon as={InfoIcon} size={20} className="text-primary" />
                  <Text variant="small" className="flex-1 leading-5">
                    {t('privateProjectInfo')}
                  </Text>
                </View>

                {/* Download status indicator */}
                {isProjectDownloaded && (
                  <View className="mb-6 flex-row items-center gap-2 rounded-md bg-green-50 p-4 dark:bg-green-900/20">
                    <Icon
                      as={CircleArrowDownIcon}
                      size={20}
                      className="text-green-600"
                    />
                    <Text
                      variant="small"
                      className="flex-1 leading-5 text-green-600"
                    >
                      {t('projectDownloaded')}
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <>
                <Text variant="h4" className="text-center">
                  {getActionTitle()}
                </Text>
                <Text className="mb-6 px-4 text-center leading-5 text-muted-foreground">
                  {getActionMessage()}
                </Text>
              </>
            )}
            <Button
              onPress={handleRequestMembership}
              disabled={isSubmitting}
              loading={isSubmitting}
              className={!modal ? 'mt-4' : ''}
            >
              <Text>
                {isSubmitting ? t('requesting') : t('requestMembership')}
              </Text>
            </Button>
          </>
        );
    }
  };

  // Modal mode
  if (modal) {
    return (
      <Modal
        visible={isVisible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <Pressable
            className="flex-1 items-center justify-center bg-black/50"
            onPress={onClose}
          >
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View className="w-[90%] max-w-md rounded-lg bg-background p-6">
                <View className="mb-4 flex-row items-center justify-between">
                  <Text variant="h3">{t('privateProject')}</Text>
                  <Pressable className="p-1" onPress={onClose}>
                    <Icon as={XIcon} size={24} className="text-foreground" />
                  </Pressable>
                </View>

                <Text variant="large" className="mb-4 text-center">
                  {projectName}
                </Text>

                {renderContent()}

                {showViewProjectButton !== false && onBypass && (
                  <Button className="mb-2 mt-2" onPress={handleBypass}>
                    <Text>{viewProjectButtonText || t('viewProject')}</Text>
                  </Button>
                )}

                <Button variant="secondary" className="mt-2" onPress={onClose}>
                  <Text>{t('goBack')}</Text>
                </Button>
              </View>
            </TouchableWithoutFeedback>
          </Pressable>
        </TouchableWithoutFeedback>
      </Modal>
    );
  }

  // Render inline content when access is denied
  if (inline && !hasAccess) {
    return (
      <View className="min-h-[300px] w-full items-center justify-center p-6">
        {renderContent()}
      </View>
    );
  }

  // If has access and children provided, render children
  if (hasAccess && children) {
    return <>{children}</>;
  }

  // If custom trigger provided, use it
  if (renderTrigger) {
    return (
      <>
        {renderTrigger({ onPress: handlePress, hasAccess })}
        {!hasAccess && (
          <Modal
            visible={showModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowModal(false)}
          >
            <TouchableWithoutFeedback onPress={() => setShowModal(false)}>
              <Pressable
                className="flex-1 items-center justify-center bg-black/50"
                onPress={() => setShowModal(false)}
              >
                <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
                  <View className="w-[90%] max-w-md rounded-lg bg-background p-6">
                    <View className="mb-4 flex-row items-center justify-between">
                      <Text variant="h3">{t('privateProject')}</Text>
                      <Pressable
                        className="p-1"
                        onPress={() => setShowModal(false)}
                      >
                        <Icon
                          as={XIcon}
                          size={24}
                          className="text-foreground"
                        />
                      </Pressable>
                    </View>

                    <Text variant="large" className="mb-4 text-center">
                      {projectName}
                    </Text>

                    {renderContent()}

                    {allowBypass && onBypass && (
                      <Button
                        className="mb-2 mt-2"
                        onPress={() => {
                          setShowModal(false);
                          onBypass();
                        }}
                      >
                        <Text>
                          {viewProjectButtonText || t('downloadAnyway')}
                        </Text>
                      </Button>
                    )}

                    <Button
                      variant="secondary"
                      className="mt-2"
                      onPress={() => setShowModal(false)}
                    >
                      <Text>{t('goBack')}</Text>
                    </Button>
                  </View>
                </TouchableWithoutFeedback>
              </Pressable>
            </TouchableWithoutFeedback>
          </Modal>
        )}
      </>
    );
  }

  // Default: render nothing if has access, show modal trigger if not
  return hasAccess ? null : (
    <>
      <Pressable onPress={() => setShowModal(true)}>
        <Icon as={LockIcon} size={24} className="text-foreground" />
      </Pressable>
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowModal(false)}>
          <Pressable
            className="flex-1 items-center justify-center bg-black/50"
            onPress={() => setShowModal(false)}
          >
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View className="w-[90%] max-w-md rounded-lg bg-background p-6">
                <View className="mb-4 flex-row items-center justify-between">
                  <Text variant="h3">{t('privateProject')}</Text>
                  <Pressable
                    className="p-1"
                    onPress={() => setShowModal(false)}
                  >
                    <Icon
                      as={LockOpenIcon}
                      size={24}
                      className="text-foreground"
                    />
                  </Pressable>
                </View>

                <Text variant="large" className="mb-4 text-center">
                  {projectName}
                </Text>

                {renderContent()}

                <Button
                  variant="secondary"
                  className="mt-2"
                  onPress={() => setShowModal(false)}
                >
                  <Text>{t('goBack')}</Text>
                </Button>
              </View>
            </TouchableWithoutFeedback>
          </Pressable>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
};
