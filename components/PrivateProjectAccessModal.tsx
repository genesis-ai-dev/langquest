import { useAuth } from '@/contexts/AuthContext';
import { useSystem } from '@/contexts/SystemContext';
import { profile_project_link, request } from '@/db/drizzleSchema';
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

interface PrivateProjectAccessModalProps {
  isVisible: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  onMembershipGranted?: () => void;
  onViewProject?: () => void;
  customMessage?: string;
  showViewProjectButton?: boolean;
  viewProjectButtonText?: string;
}

// Helper function to check if request is expired (7 days)
const isRequestExpired = (lastUpdated: string): boolean => {
  const updatedDate = new Date(lastUpdated);
  const now = new Date();
  const daysDiff =
    (now.getTime() - updatedDate.getTime()) / (1000 * 60 * 60 * 24);
  return daysDiff > 7;
};

export const PrivateProjectAccessModal: React.FC<
  PrivateProjectAccessModalProps
> = ({
  isVisible,
  onClose,
  projectId,
  projectName,
  onMembershipGranted,
  onViewProject,
  customMessage,
  showViewProjectButton,
  viewProjectButtonText
}) => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const { db } = useSystem();
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // Query for membership status
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
    enabled: !!currentUser?.id && !!projectId,
    refetchInterval: 2000 // Check every 2 seconds for membership changes
  });

  const isMember = membershipLinks.length > 0;

  // Auto-close modal and trigger navigation when user becomes a member
  useEffect(() => {
    if (isMember && isVisible) {
      onClose();
      onMembershipGranted?.();
    }
  }, [isMember, isVisible, onClose, onMembershipGranted]);

  const existingRequest = existingRequests[0];

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

  const renderContent = () => {
    // Handle not logged in case
    if (!currentUser) {
      return (
        <>
          <View style={styles.iconContainer}>
            <Ionicons name="lock-closed" size={48} color={colors.primary} />
          </View>
          <Text style={styles.description}>
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
      );
    }

    switch (currentStatus) {
      case 'pending':
        return (
          <>
            <View style={styles.statusContainer}>
              <Ionicons name="time-outline" size={48} color={colors.primary} />
              <Text style={styles.statusTitle}>{t('requestPending')}</Text>
              <Text style={styles.statusDescription}>
                {t('requestPendingDescription')}
              </Text>
            </View>
            <TouchableOpacity
              style={[sharedStyles.button, styles.withdrawButton]}
              onPress={handleWithdrawRequest}
              disabled={isSubmitting}
            >
              <Text
                style={[sharedStyles.buttonText, styles.withdrawButtonText]}
              >
                {isSubmitting ? t('withdrawing') : t('withdrawRequest')}
              </Text>
            </TouchableOpacity>
          </>
        );

      case 'expired':
        return (
          <>
            <View style={styles.statusContainer}>
              <Ionicons
                name="alert-circle-outline"
                size={48}
                color={colors.alert}
              />
              <Text style={styles.statusTitle}>{t('requestExpired')}</Text>
              <Text style={styles.statusDescription}>
                {t('requestExpiredDescription')}
              </Text>
            </View>
            <TouchableOpacity
              style={sharedStyles.button}
              onPress={handleRequestMembership}
              disabled={isSubmitting}
            >
              <Text style={sharedStyles.buttonText}>
                {isSubmitting ? t('requesting') : t('requestAgain')}
              </Text>
            </TouchableOpacity>
          </>
        );

      case 'declined': {
        const attemptsLeft = 3 - (existingRequest?.count || 0);
        return (
          <>
            <View style={styles.statusContainer}>
              <Ionicons
                name="close-circle-outline"
                size={48}
                color={colors.error}
              />
              <Text style={styles.statusTitle}>{t('requestDeclined')}</Text>
              <Text style={styles.statusDescription}>
                {attemptsLeft > 0
                  ? t('requestDeclinedCanRetry', { attempts: attemptsLeft })
                  : t('requestDeclinedNoRetry')}
              </Text>
            </View>
            {attemptsLeft > 0 && (
              <TouchableOpacity
                style={sharedStyles.button}
                onPress={handleRequestMembership}
                disabled={isSubmitting}
              >
                <Text style={sharedStyles.buttonText}>
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
            <View style={styles.statusContainer}>
              <Ionicons
                name="remove-circle-outline"
                size={48}
                color={colors.textSecondary}
              />
              <Text style={styles.statusTitle}>{t('requestWithdrawn')}</Text>
              <Text style={styles.statusDescription}>
                {t('requestWithdrawnDescription')}
              </Text>
            </View>
            <TouchableOpacity
              style={sharedStyles.button}
              onPress={handleRequestMembership}
              disabled={isSubmitting}
            >
              <Text style={sharedStyles.buttonText}>
                {isSubmitting ? t('requesting') : t('requestMembership')}
              </Text>
            </TouchableOpacity>
          </>
        );

      default:
        // No existing request
        return (
          <>
            <View style={styles.iconContainer}>
              <Ionicons name="lock-closed" size={48} color={colors.primary} />
            </View>
            <Text style={styles.description}>
              {customMessage || t('privateProjectDescription')}
            </Text>
            <View style={styles.infoBox}>
              <Ionicons
                name="information-circle"
                size={20}
                color={colors.primary}
              />
              <Text style={styles.infoText}>{t('privateProjectInfo')}</Text>
            </View>
            <TouchableOpacity
              style={sharedStyles.button}
              onPress={handleRequestMembership}
              disabled={isSubmitting}
            >
              <Text style={sharedStyles.buttonText}>
                {isSubmitting ? t('requesting') : t('requestMembership')}
              </Text>
            </TouchableOpacity>
          </>
        );
    }
  };

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
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <Text style={styles.projectName}>{projectName}</Text>

              {renderContent()}

              {showViewProjectButton !== false && onViewProject && (
                <TouchableOpacity
                  style={[sharedStyles.button, styles.viewProjectButton]}
                  onPress={() => {
                    onClose();
                    onViewProject();
                  }}
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
};

const styles = StyleSheet.create({
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
  iconContainer: {
    alignItems: 'center',
    marginBottom: spacing.medium
  },
  description: {
    fontSize: fontSizes.medium,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.medium,
    lineHeight: 22
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
  statusContainer: {
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
  statusDescription: {
    fontSize: fontSizes.medium,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22
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
  }
});
