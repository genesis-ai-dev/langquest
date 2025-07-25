import { useAuth } from '@/contexts/AuthContext';
import {
  profile_project_link,
  project as projectTable,
  request
} from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useLocalization } from '@/hooks/useLocalization';
import type { PrivateAccessAction } from '@/hooks/useUserPermissions';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import {
  borderRadius,
  colors,
  fontSizes,
  sharedStyles,
  spacing
} from '@/styles/theme';
import { isExpiredByLastUpdated } from '@/utils/dateUtils';
import { useHybridData } from '@/views/new/useHybridData';
import { Ionicons } from '@expo/vector-icons';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import type { InferSelectModel } from 'drizzle-orm';
import { and, eq } from 'drizzle-orm';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
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
  const { data: existingRequests } = useHybridData<Request>({
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
  const { data: membershipLinks } = useHybridData<ProfileProjectLink>({
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
        .eq('active', true);
      if (error) throw error;
      return data as ProfileProjectLink[];
    },

    // Only run cloud query when in modal mode
    enableCloudQuery: modal
  });

  const isMember = membershipLinks.length > 0;
  const existingRequest = existingRequests[0];

  // Query for project download status using useHybridData
  // This checks if the project has been downloaded (possibly through other actions)
  const { data: downloadStatusData } = useHybridData<{
    id: string;
    download_profiles: string[] | null;
  }>({
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
        // Update existing request
        await db
          .update(request)
          .set({
            status: 'pending',
            count: (existingRequest.count || 0) + 1,
            last_updated: new Date().toISOString()
          })
          .where(eq(request.id, existingRequest.id));
      } else {
        // Create new request
        await db.insert(request).values({
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
              await db
                .update(request)
                .set({
                  status: 'withdrawn',
                  last_updated: new Date().toISOString()
                })
                .where(eq(request.id, existingRequest.id));

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
          <View
            style={
              modal ? styles.modalIconContainer : styles.inlineIconContainer
            }
          >
            <Ionicons name="lock-closed" size={48} color={colors.primary} />
          </View>
          {modal ? (
            <>
              <Text style={styles.modalDescription}>
                {t('privateProjectNotLoggedIn')}
              </Text>
              <View style={styles.infoBox}>
                <Ionicons
                  name="information-circle"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.infoText}>
                  {t('privateProjectLoginRequired')}
                </Text>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.inlineTitle}>{getActionTitle()}</Text>
              <Text style={styles.inlineDescription}>
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
            <View
              style={
                modal ? styles.modalStatusContainer : styles.inlineIconContainer
              }
            >
              <Ionicons name="time-outline" size={48} color={colors.primary} />
              {modal && (
                <Text style={styles.statusTitle}>{t('requestPending')}</Text>
              )}
            </View>
            {modal ? (
              <Text style={styles.modalDescription}>
                {t('requestPendingInline')}
              </Text>
            ) : (
              <>
                <Text style={styles.inlineTitle}>
                  {getActionTitle()} - {t('requestPending')}
                </Text>
                <Text style={styles.inlineDescription}>
                  {t('requestPendingInline')}
                </Text>
              </>
            )}
            <TouchableOpacity
              style={
                modal
                  ? [sharedStyles.button, styles.withdrawButton]
                  : [styles.inlineButton, styles.withdrawButton]
              }
              onPress={handleWithdrawRequest}
              disabled={isSubmitting}
            >
              <Text
                style={
                  modal
                    ? [sharedStyles.buttonText, styles.withdrawButtonText]
                    : [styles.inlineButtonText, styles.withdrawButtonText]
                }
              >
                {isSubmitting ? t('withdrawing') : t('withdrawRequest')}
              </Text>
            </TouchableOpacity>
          </>
        );

      case 'expired': {
        const attemptsLeft = 4 - (existingRequest?.count || 0);
        return (
          <>
            <View
              style={
                modal ? styles.modalStatusContainer : styles.inlineIconContainer
              }
            >
              <Ionicons
                name="alert-circle-outline"
                size={48}
                color={colors.alert}
              />
              {modal && (
                <Text style={styles.statusTitle}>{t('requestExpired')}</Text>
              )}
            </View>
            {modal ? (
              <Text style={styles.modalDescription}>
                {attemptsLeft > 0
                  ? t('requestExpiredAttemptsRemaining', {
                      attempts: attemptsLeft,
                      plural: attemptsLeft > 1 ? 's' : ''
                    })
                  : t('requestExpiredNoAttempts')}
              </Text>
            ) : (
              <>
                <Text style={styles.inlineTitle}>
                  {getActionTitle()} - {t('requestExpired')}
                </Text>
                <Text style={styles.inlineDescription}>
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
              <TouchableOpacity
                style={modal ? sharedStyles.button : styles.inlineButton}
                onPress={handleRequestMembership}
                disabled={isSubmitting}
              >
                <Text
                  style={
                    modal ? sharedStyles.buttonText : styles.inlineButtonText
                  }
                >
                  {isSubmitting ? t('requesting') : t('requestAgain')}
                </Text>
              </TouchableOpacity>
            )}
          </>
        );
      }

      case 'declined': {
        const attemptsLeft = 3 - (existingRequest?.count || 0);
        return (
          <>
            <View
              style={
                modal ? styles.modalStatusContainer : styles.inlineIconContainer
              }
            >
              <Ionicons
                name="close-circle-outline"
                size={48}
                color={colors.error}
              />
              {modal && (
                <Text style={styles.statusTitle}>{t('requestDeclined')}</Text>
              )}
            </View>
            {modal ? (
              <Text style={styles.modalDescription}>
                {attemptsLeft > 0
                  ? t('requestDeclinedCanRetry', { attempts: attemptsLeft })
                  : t('requestDeclinedNoRetry')}
              </Text>
            ) : (
              <>
                <Text style={styles.inlineTitle}>
                  {getActionTitle()} - {t('requestDeclined')}
                </Text>
                <Text style={styles.inlineDescription}>
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
              <TouchableOpacity
                style={modal ? sharedStyles.button : styles.inlineButton}
                onPress={handleRequestMembership}
                disabled={isSubmitting}
              >
                <Text
                  style={
                    modal ? sharedStyles.buttonText : styles.inlineButtonText
                  }
                >
                  {isSubmitting ? t('requesting') : t('requestAgain')}
                </Text>
              </TouchableOpacity>
            )}
          </>
        );
      }

      case 'withdrawn':
        return (
          <>
            <View
              style={
                modal ? styles.modalStatusContainer : styles.inlineIconContainer
              }
            >
              <Ionicons
                name="remove-circle-outline"
                size={48}
                color={colors.textSecondary}
              />
              {modal && (
                <Text style={styles.statusTitle}>{t('requestWithdrawn')}</Text>
              )}
            </View>
            {modal ? (
              <Text style={styles.modalDescription}>
                {t('requestWithdrawnInline')}
              </Text>
            ) : (
              <>
                <Text style={styles.inlineTitle}>
                  {getActionTitle()} - {t('requestWithdrawnTitle')}
                </Text>
                <Text style={styles.inlineDescription}>
                  {t('requestWithdrawnInline')}
                </Text>
              </>
            )}
            <TouchableOpacity
              style={modal ? sharedStyles.button : styles.inlineButton}
              onPress={handleRequestMembership}
              disabled={isSubmitting}
            >
              <Text
                style={
                  modal ? sharedStyles.buttonText : styles.inlineButtonText
                }
              >
                {isSubmitting ? t('requesting') : t('requestMembership')}
              </Text>
            </TouchableOpacity>
          </>
        );

      default:
        // No existing request
        return (
          <>
            <View
              style={
                modal ? styles.modalIconContainer : styles.inlineIconContainer
              }
            >
              <Ionicons name="lock-closed" size={48} color={colors.primary} />
            </View>
            {modal ? (
              <>
                <Text style={styles.modalDescription}>
                  {getActionMessage()}
                </Text>
                <View style={styles.infoBox}>
                  <Ionicons
                    name="information-circle"
                    size={20}
                    color={colors.primary}
                  />
                  <Text style={styles.infoText}>{t('privateProjectInfo')}</Text>
                </View>

                {/* Download status indicator */}
                {isProjectDownloaded && (
                  <View style={styles.downloadStatusBox}>
                    <Ionicons
                      name="cloud-download"
                      size={20}
                      color={colors.success}
                    />
                    <Text style={styles.downloadStatusText}>
                      {t('projectDownloaded')}
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <>
                <Text style={styles.inlineTitle}>{getActionTitle()}</Text>
                <Text style={styles.inlineDescription}>
                  {getActionMessage()}
                </Text>
              </>
            )}
            <TouchableOpacity
              style={modal ? sharedStyles.button : styles.inlineButton}
              onPress={handleRequestMembership}
              disabled={isSubmitting}
            >
              <Text
                style={
                  modal ? sharedStyles.buttonText : styles.inlineButtonText
                }
              >
                {isSubmitting ? t('requesting') : t('requestMembership')}
              </Text>
            </TouchableOpacity>
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
          <Pressable style={sharedStyles.modalOverlay} onPress={onClose}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={[sharedStyles.modal, styles.modalContainer]}>
                <View style={styles.header}>
                  <Text style={sharedStyles.modalTitle}>
                    {t('privateProject')}
                  </Text>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={onClose}
                  >
                    <Ionicons name="close" size={24} color={colors.text} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.projectName}>{projectName}</Text>

                {renderContent()}

                {showViewProjectButton !== false && onBypass && (
                  <TouchableOpacity
                    style={[sharedStyles.button, styles.viewProjectButton]}
                    onPress={handleBypass}
                  >
                    <Text style={sharedStyles.buttonText}>
                      {viewProjectButtonText || t('viewProject')}
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[sharedStyles.button, styles.cancelButton]}
                  onPress={onClose}
                >
                  <Text
                    style={[sharedStyles.buttonText, styles.cancelButtonText]}
                  >
                    {t('goBack')}
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </Pressable>
        </TouchableWithoutFeedback>
      </Modal>
    );
  }

  // Render inline content when access is denied
  if (inline && !hasAccess) {
    return <View style={styles.inlineContainer}>{renderContent()}</View>;
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
                style={sharedStyles.modalOverlay}
                onPress={() => setShowModal(false)}
              >
                <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
                  <View style={[sharedStyles.modal, styles.modalContainer]}>
                    <View style={styles.header}>
                      <Text style={sharedStyles.modalTitle}>
                        {t('privateProject')}
                      </Text>
                      <TouchableOpacity
                        style={styles.closeButton}
                        onPress={() => setShowModal(false)}
                      >
                        <Ionicons name="close" size={24} color={colors.text} />
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.projectName}>{projectName}</Text>

                    {renderContent()}

                    {allowBypass && onBypass && (
                      <TouchableOpacity
                        style={[sharedStyles.button, styles.viewProjectButton]}
                        onPress={() => {
                          setShowModal(false);
                          onBypass();
                        }}
                      >
                        <Text style={sharedStyles.buttonText}>
                          {viewProjectButtonText || t('downloadAnyway')}
                        </Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={[sharedStyles.button, styles.cancelButton]}
                      onPress={() => setShowModal(false)}
                    >
                      <Text
                        style={[
                          sharedStyles.buttonText,
                          styles.cancelButtonText
                        ]}
                      >
                        {t('goBack')}
                      </Text>
                    </TouchableOpacity>
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
      <TouchableOpacity onPress={() => setShowModal(true)}>
        <Ionicons name="lock-closed" size={24} color={colors.text} />
      </TouchableOpacity>
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowModal(false)}>
          <Pressable
            style={sharedStyles.modalOverlay}
            onPress={() => setShowModal(false)}
          >
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={[sharedStyles.modal, styles.modalContainer]}>
                <View style={styles.header}>
                  <Text style={sharedStyles.modalTitle}>
                    {t('privateProject')}
                  </Text>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => setShowModal(false)}
                  >
                    <Ionicons name="close" size={24} color={colors.text} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.projectName}>{projectName}</Text>

                {renderContent()}

                <TouchableOpacity
                  style={[sharedStyles.button, styles.cancelButton]}
                  onPress={() => setShowModal(false)}
                >
                  <Text
                    style={[sharedStyles.buttonText, styles.cancelButtonText]}
                  >
                    {t('goBack')}
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </Pressable>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  // Modal styles
  modalContainer: {
    width: '90%',
    maxWidth: 400
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.medium
  },
  closeButton: {
    padding: spacing.xsmall
  },
  projectName: {
    fontSize: fontSizes.large,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.medium
  },
  modalIconContainer: {
    alignItems: 'center',
    marginBottom: spacing.medium
  },
  modalDescription: {
    fontSize: fontSizes.medium,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.medium,
    lineHeight: 22
  },
  modalStatusContainer: {
    alignItems: 'center',
    marginBottom: spacing.large
  },
  statusTitle: {
    fontSize: fontSizes.large,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.medium,
    marginBottom: spacing.small
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.primaryLight,
    padding: spacing.medium,
    borderRadius: borderRadius.medium,
    marginBottom: spacing.large,
    gap: spacing.small
  },
  infoText: {
    flex: 1,
    fontSize: fontSizes.small,
    color: colors.text,
    lineHeight: 20
  },
  downloadStatusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.1)', // success color with transparency
    padding: spacing.medium,
    borderRadius: borderRadius.medium,
    marginBottom: spacing.large,
    gap: spacing.small
  },
  downloadStatusText: {
    flex: 1,
    fontSize: fontSizes.small,
    color: colors.success,
    lineHeight: 20
  },
  withdrawButton: {
    backgroundColor: colors.error,
    marginBottom: spacing.small
  },
  withdrawButtonText: {
    color: colors.buttonText
  },
  cancelButton: {
    backgroundColor: colors.backgroundSecondary,
    marginTop: spacing.small
  },
  cancelButtonText: {
    color: colors.text
  },
  viewProjectButton: {
    backgroundColor: colors.primary,
    marginTop: spacing.small,
    marginBottom: spacing.small
  },

  // Inline styles
  inlineContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.large,
    minHeight: 300,
    width: '100%'
  },
  inlineIconContainer: {
    alignItems: 'center',
    marginBottom: spacing.medium
  },
  inlineTitle: {
    fontSize: fontSizes.large,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.small,
    textAlign: 'center'
  },
  inlineDescription: {
    fontSize: fontSizes.medium,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.large,
    lineHeight: 22,
    paddingHorizontal: spacing.medium
  },
  inlineButton: {
    padding: spacing.medium,
    backgroundColor: colors.primary,
    borderRadius: 5,
    marginTop: spacing.medium
  },
  inlineButtonText: {
    fontSize: fontSizes.medium,
    fontWeight: '600',
    color: colors.background,
    textAlign: 'center'
  },
  downloadSection: {
    marginTop: spacing.medium,
    marginBottom: spacing.large
  },
  downloadToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.small
  },
  downloadLabel: {
    fontSize: fontSizes.medium,
    color: colors.text,
    flex: 1
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.small,
    backgroundColor: 'rgba(202, 89, 229, 0.1)', // alert color with transparency
    padding: spacing.small,
    borderRadius: borderRadius.small
  },
  warningText: {
    fontSize: fontSizes.small,
    color: colors.alert,
    flex: 1,
    lineHeight: 16
  },
  inlineDownloadSection: {
    width: '100%',
    maxWidth: 400,
    marginTop: spacing.medium,
    marginBottom: spacing.large,
    paddingHorizontal: spacing.medium
  },
  inlineDownloadToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.small,
    width: '100%'
  },
  inlineDownloadLabel: {
    fontSize: fontSizes.medium,
    color: colors.text,
    flex: 1,
    marginRight: spacing.small
  },
  inlineWarningContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.small,
    backgroundColor: 'rgba(202, 89, 229, 0.1)',
    padding: spacing.small,
    borderRadius: borderRadius.small,
    width: '100%'
  },
  inlineWarningText: {
    fontSize: fontSizes.small,
    color: colors.alert,
    flex: 1,
    lineHeight: 16
  }
});
