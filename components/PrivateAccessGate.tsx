import { useAuth } from '@/contexts/AuthContext';
import { useSystem } from '@/contexts/SystemContext';
import { profile_project_link, request } from '@/db/drizzleSchema';
import type { PrivateAccessAction } from '@/hooks/usePrivateProjectAccess';
import { usePrivateProjectAccess } from '@/hooks/usePrivateProjectAccess';
import { useTranslation } from '@/hooks/useTranslation';
import {
  borderRadius,
  colors,
  fontSizes,
  sharedStyles,
  spacing
} from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useQuery } from '@powersync/tanstack-react-query';
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

// Helper function to check if request is expired (7 days)
const isRequestExpired = (lastUpdated: string): boolean => {
  const updatedDate = new Date(lastUpdated);
  const now = new Date();
  const daysDiff =
    (now.getTime() - updatedDate.getTime()) / (1000 * 60 * 60 * 24);
  return daysDiff > 7;
};

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
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const { db } = useSystem();
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { hasAccess } = usePrivateProjectAccess({
    projectId,
    isPrivate
  });

  // Query for existing membership request
  const { data: existingRequests = [], refetch } = useQuery({
    queryKey: ['membership-request', projectId, currentUser?.id],
    query: toCompilableQuery(
      db.query.request.findMany({
        where: and(
          eq(request.sender_profile_id, currentUser?.id || ''),
          eq(request.project_id, projectId)
        )
      })
    ),
    enabled: !!currentUser?.id && !!projectId
  });

  // Query for membership status (for modal mode)
  const { data: membershipLinks = [] } = useQuery({
    queryKey: ['membership-status', projectId, currentUser?.id],
    query: toCompilableQuery(
      db.query.profile_project_link.findMany({
        where: and(
          eq(profile_project_link.profile_id, currentUser?.id || ''),
          eq(profile_project_link.project_id, projectId),
          eq(profile_project_link.active, true)
        )
      })
    ),
    enabled: !!currentUser?.id && !!projectId && modal,
    refetchInterval: modal ? 2000 : false // Check every 2 seconds for membership changes in modal mode
  });

  const isMember = membershipLinks.length > 0;
  const existingRequest = existingRequests[0];

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
      isRequestExpired(existingRequest.last_updated)
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

      await refetch();
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

              await refetch();
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
      case 'view-members':
        return 'You need to be a member to view the member list and send invitations. Request access to join this project.';
      case 'vote':
        return 'This project is private. You need to be a member to vote on translations. Request access to join this project.';
      case 'translate':
        return 'This project is private. You need to be a member to submit translations. Request access to join this project.';
      case 'edit-transcription':
        return 'This project is private. You need to be a member to edit transcriptions. Request access to join this project.';
      case 'download':
        return 'This project is private. You need to be a member to download content. Request access to join this project.';
      default:
        return 'This project is private. You need to be a member to access this feature. Request access to join this project.';
    }
  };

  const getActionTitle = () => {
    switch (action) {
      case 'view-members':
        return 'Private Project Members';
      case 'vote':
        return 'Private Project Voting';
      case 'translate':
        return 'Private Project Translation';
      case 'edit-transcription':
        return 'Private Project Editing';
      case 'download':
        return 'Private Project Download';
      default:
        return 'Private Project Access';
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
          <Text
            style={modal ? styles.modalDescription : styles.inlineDescription}
          >
            {modal
              ? t('privateProjectNotLoggedIn')
              : 'You need to be logged in to access this private project.'}
          </Text>
          {modal && (
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
            <Text style={modal ? styles.modalDescription : styles.inlineTitle}>
              {modal ? t('requestPendingDescription') : 'Request Pending'}
            </Text>
            {!modal && (
              <Text style={styles.inlineDescription}>
                Your membership request is pending approval. You'll be notified
                when it's reviewed.
              </Text>
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

      case 'expired':
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
            <Text style={modal ? styles.modalDescription : styles.inlineTitle}>
              {modal ? t('requestExpiredDescription') : 'Request Expired'}
            </Text>
            {!modal && (
              <Text style={styles.inlineDescription}>
                Your previous request expired after 7 days. You can send a new
                request.
              </Text>
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
                {isSubmitting ? t('requesting') : t('requestAgain')}
              </Text>
            </TouchableOpacity>
          </>
        );

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
            <Text style={modal ? styles.modalDescription : styles.inlineTitle}>
              {modal
                ? attemptsLeft > 0
                  ? t('requestDeclinedCanRetry', { attempts: attemptsLeft })
                  : t('requestDeclinedNoRetry')
                : 'Request Declined'}
            </Text>
            {!modal && (
              <Text style={styles.inlineDescription}>
                {attemptsLeft > 0
                  ? `Your request was declined. You have ${attemptsLeft} attempt${attemptsLeft > 1 ? 's' : ''} remaining.`
                  : 'Your request was declined and you have no more attempts remaining.'}
              </Text>
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
            <Text style={modal ? styles.modalDescription : styles.inlineTitle}>
              {modal ? t('requestWithdrawnDescription') : 'Request Withdrawn'}
            </Text>
            {!modal && (
              <Text style={styles.inlineDescription}>
                You withdrew your previous request. You can send a new request
                anytime.
              </Text>
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
            <Text style={modal ? styles.modalDescription : styles.inlineTitle}>
              {modal ? getActionMessage() : getActionTitle()}
            </Text>
            {!modal && (
              <Text style={styles.inlineDescription}>{getActionMessage()}</Text>
            )}
            {modal && (
              <View style={styles.infoBox}>
                <Ionicons
                  name="information-circle"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.infoText}>{t('privateProjectInfo')}</Text>
              </View>
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
                      {viewProjectButtonText || 'View Project'}
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
    minHeight: 300
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
  }
});
