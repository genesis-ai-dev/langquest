import { useAuth } from '@/contexts/AuthContext';
import { useSystem } from '@/contexts/SystemContext';
import { request } from '@/db/drizzleSchema';
import type { PrivateAccessAction } from '@/hooks/usePrivateProjectAccess';
import { usePrivateProjectAccess } from '@/hooks/usePrivateProjectAccess';
import { useTranslation } from '@/hooks/useTranslation';
import { colors, fontSizes, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useQuery } from '@powersync/tanstack-react-query';
import { and, eq } from 'drizzle-orm';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PrivateProjectAccessModal } from './PrivateProjectAccessModal';

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
  allowBypass?: boolean; // For download scenario
  onBypass?: () => void;
}

const actionMessages: Record<
  PrivateAccessAction,
  { title: string; description: string }
> = {
  'view-members': {
    title: 'Private Project Members',
    description:
      'This project is private. You need to be a member to view the member list and send invitations. Request access to join this project.'
  },
  vote: {
    title: 'privateProjectVote',
    description: 'privateProjectVoteDescription'
  },
  translate: {
    title: 'privateProjectTranslate',
    description: 'privateProjectTranslateDescription'
  },
  'edit-transcription': {
    title: 'privateProjectEdit',
    description: 'privateProjectEditDescription'
  },
  download: {
    title: 'privateProjectDownload',
    description: 'privateProjectDownloadDescription'
  }
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
  allowBypass = false,
  onBypass
}) => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const { db } = useSystem();
  const [showModal, setShowModal] = useState(false);
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

  const existingRequest = existingRequests[0];

  // Helper function to check if request is expired (7 days)
  const isRequestExpired = (lastUpdated: string): boolean => {
    const updatedDate = new Date(lastUpdated);
    const now = new Date();
    const daysDiff =
      (now.getTime() - updatedDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff > 7;
  };

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
      Alert.alert('Success', 'Membership request sent successfully!');
    } catch (error) {
      console.error('Error requesting membership:', error);
      Alert.alert(
        'Error',
        'Failed to send membership request. Please try again.'
      );
    }
  };

  const handleWithdrawRequest = () => {
    if (!existingRequest) return;

    Alert.alert(
      'Withdraw Request',
      'Are you sure you want to withdraw your membership request?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Withdraw',
          style: 'destructive',
          onPress: async () => {
            try {
              await db
                .update(request)
                .set({
                  status: 'withdrawn',
                  last_updated: new Date().toISOString()
                })
                .where(eq(request.id, existingRequest.id));

              await refetch();
              Alert.alert('Success', 'Request withdrawn successfully.');
            } catch (error) {
              console.error('Error withdrawing request:', error);
              Alert.alert(
                'Error',
                'Failed to withdraw request. Please try again.'
              );
            }
          }
        }
      ]
    );
  };

  const handlePress = () => {
    if (hasAccess) {
      onAccessGranted?.();
    } else {
      setShowModal(true);
    }
  };

  const handleMembershipGranted = () => {
    setShowModal(false);
    onAccessGranted?.();
  };

  const handleBypass = () => {
    setShowModal(false);
    onBypass?.();
  };

  // Render inline content when access is denied
  if (inline && !hasAccess) {
    const getActionMessage = () => {
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

    // Handle not logged in case
    if (!currentUser) {
      return (
        <View style={styles.inlineContainer}>
          <View style={styles.inlineIconContainer}>
            <Ionicons name="lock-closed" size={48} color={colors.primary} />
          </View>
          <Text style={styles.inlineTitle}>{getActionTitle()}</Text>
          <Text style={styles.inlineDescription}>
            You need to be logged in to access this private project.
          </Text>
        </View>
      );
    }

    // Show different content based on request status
    switch (currentStatus) {
      case 'pending':
        return (
          <View style={styles.inlineContainer}>
            <View style={styles.inlineIconContainer}>
              <Ionicons name="time-outline" size={48} color={colors.primary} />
            </View>
            <Text style={styles.inlineTitle}>Request Pending</Text>
            <Text style={styles.inlineDescription}>
              Your membership request is pending approval. You'll be notified
              when it's reviewed.
            </Text>
            <TouchableOpacity
              style={[styles.inlineButton, styles.withdrawButton]}
              onPress={() => void handleWithdrawRequest()}
            >
              <Text
                style={[styles.inlineButtonText, styles.withdrawButtonText]}
              >
                Withdraw Request
              </Text>
            </TouchableOpacity>
          </View>
        );

      case 'expired':
        return (
          <View style={styles.inlineContainer}>
            <View style={styles.inlineIconContainer}>
              <Ionicons
                name="alert-circle-outline"
                size={48}
                color={colors.alert}
              />
            </View>
            <Text style={styles.inlineTitle}>Request Expired</Text>
            <Text style={styles.inlineDescription}>
              Your previous request expired after 7 days. You can send a new
              request.
            </Text>
            <TouchableOpacity
              style={styles.inlineButton}
              onPress={() => void handleRequestMembership()}
            >
              <Text style={styles.inlineButtonText}>Request Again</Text>
            </TouchableOpacity>
          </View>
        );

      case 'declined': {
        const attemptsLeft = 3 - (existingRequest?.count || 0);
        return (
          <View style={styles.inlineContainer}>
            <View style={styles.inlineIconContainer}>
              <Ionicons
                name="close-circle-outline"
                size={48}
                color={colors.error}
              />
            </View>
            <Text style={styles.inlineTitle}>Request Declined</Text>
            <Text style={styles.inlineDescription}>
              {attemptsLeft > 0
                ? `Your request was declined. You have ${attemptsLeft} attempt${attemptsLeft > 1 ? 's' : ''} remaining.`
                : 'Your request was declined and you have no more attempts remaining.'}
            </Text>
            {attemptsLeft > 0 && (
              <TouchableOpacity
                style={styles.inlineButton}
                onPress={() => void handleRequestMembership()}
              >
                <Text style={styles.inlineButtonText}>Request Again</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      }

      case 'withdrawn':
        return (
          <View style={styles.inlineContainer}>
            <View style={styles.inlineIconContainer}>
              <Ionicons
                name="remove-circle-outline"
                size={48}
                color={colors.textSecondary}
              />
            </View>
            <Text style={styles.inlineTitle}>Request Withdrawn</Text>
            <Text style={styles.inlineDescription}>
              You withdrew your previous request. You can send a new request
              anytime.
            </Text>
            <TouchableOpacity
              style={styles.inlineButton}
              onPress={() => void handleRequestMembership()}
            >
              <Text style={styles.inlineButtonText}>Request Membership</Text>
            </TouchableOpacity>
          </View>
        );

      default:
        // No existing request
        return (
          <View style={styles.inlineContainer}>
            <View style={styles.inlineIconContainer}>
              <Ionicons name="lock-closed" size={48} color={colors.primary} />
            </View>
            <Text style={styles.inlineTitle}>{getActionTitle()}</Text>
            <Text style={styles.inlineDescription}>{getActionMessage()}</Text>
            <TouchableOpacity
              style={styles.inlineButton}
              onPress={() => void handleRequestMembership()}
            >
              <Text style={styles.inlineButtonText}>Request Access</Text>
            </TouchableOpacity>
          </View>
        );
    }
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
          <PrivateProjectAccessModal
            isVisible={showModal}
            onClose={() => setShowModal(false)}
            projectId={projectId}
            projectName={projectName}
            onMembershipGranted={handleMembershipGranted}
            onViewProject={allowBypass ? handleBypass : undefined}
            customMessage={t(actionMessages[action].description)}
            showViewProjectButton={allowBypass}
            viewProjectButtonText={
              allowBypass ? t('downloadAnyway') : undefined
            }
          />
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
      <PrivateProjectAccessModal
        isVisible={showModal}
        onClose={() => setShowModal(false)}
        projectId={projectId}
        projectName={projectName}
        onMembershipGranted={handleMembershipGranted}
        customMessage={t(actionMessages[action].description)}
      />
    </>
  );
};

const styles = StyleSheet.create({
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
  requestButton: {
    marginTop: spacing.medium
  },
  loginHint: {
    fontSize: fontSizes.small,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.small
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
  withdrawButton: {
    backgroundColor: colors.error
  },
  withdrawButtonText: {
    color: colors.background
  }
});
