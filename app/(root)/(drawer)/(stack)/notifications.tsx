import { PageHeader } from '@/components/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useSystem } from '@/contexts/SystemContext';
import type { profile, project } from '@/db/drizzleSchema';
import { invite_request, profile_project_link } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { borderRadius, colors, fontSizes, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useQuery } from '@powersync/tanstack-react-query';
import { and, eq } from 'drizzle-orm';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Type definitions for query results
type InviteRequestWithRelations = typeof invite_request.$inferSelect & {
  project: typeof project.$inferSelect;
  sender: typeof profile.$inferSelect;
};

type ProfileProjectLink = typeof profile_project_link.$inferSelect;

// Expiration constant - 7 days in milliseconds
const INVITATION_EXPIRY_DAYS = 7;
const INVITATION_EXPIRY_MS = INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

interface NotificationItem {
  id: string;
  type: string;
  status: string;
  email: string;
  project_id: string;
  project_name: string;
  sender_profile_id: string;
  sender_name: string;
  sender_email: string;
  as_owner: boolean;
  created_at: string;
  last_updated: string;
}

const { db } = system;

export default function NotificationsPage() {
  const { currentUser } = useAuth();
  const { db: drizzleDb } = useSystem();
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  // Helper function to check if invitation is expired
  const isExpired = (lastUpdated: string): boolean => {
    const updatedDate = new Date(lastUpdated);
    const now = new Date();
    return now.getTime() - updatedDate.getTime() > INVITATION_EXPIRY_MS;
  };

  // Query for invite notifications (where user's email matches)
  const { data: inviteData = [], refetch: refetchInvites } = useQuery({
    queryKey: ['invite-notifications', currentUser?.email],
    query: toCompilableQuery(
      drizzleDb.query.invite_request.findMany({
        where: and(
          eq(invite_request.type, 'invite'),
          eq(invite_request.email, currentUser?.email || ''),
          eq(invite_request.status, 'pending'),
          eq(invite_request.active, true)
        ),
        with: {
          project: true,
          sender: true
        }
      })
    ),
    enabled: !!currentUser?.email
  });

  const inviteNotifications: NotificationItem[] = inviteData.map(
    (item: InviteRequestWithRelations) => ({
      id: item.id,
      type: item.type,
      status: item.status,
      email: item.email,
      project_id: item.project_id,
      project_name: item.project.name,
      sender_profile_id: item.sender_profile_id,
      sender_name: item.sender.username || '',
      sender_email: item.sender.email || '',
      as_owner: item.as_owner || false,
      created_at: item.created_at,
      last_updated: item.last_updated
    })
  );

  // Query for request notifications (where user is project owner)
  // First get all projects where the user is an owner
  const { data: ownerProjects = [] } = useQuery({
    queryKey: ['owner-projects', currentUser?.id],
    query: toCompilableQuery(
      drizzleDb.query.profile_project_link.findMany({
        where: and(
          eq(profile_project_link.profile_id, currentUser?.id || ''),
          eq(profile_project_link.membership, 'owner'),
          eq(profile_project_link.active, true)
        )
      })
    ),
    enabled: !!currentUser?.id
  });

  const ownerProjectIds = ownerProjects.map(
    (link: ProfileProjectLink) => link.project_id
  );

  // Then get all pending requests for those projects
  const { data: requestData = [], refetch: refetchRequests } = useQuery({
    queryKey: ['request-notifications', ownerProjectIds],
    query: toCompilableQuery(
      drizzleDb.query.invite_request.findMany({
        where: and(
          eq(invite_request.type, 'request'),
          eq(invite_request.status, 'pending'),
          eq(invite_request.active, true)
        ),
        with: {
          project: true,
          sender: true
        }
      })
    ),
    enabled: ownerProjectIds.length > 0
  });

  // Filter to only include requests for projects where the user is an owner
  const requestNotifications: NotificationItem[] = requestData
    .filter((item: InviteRequestWithRelations) =>
      ownerProjectIds.includes(item.project_id)
    )
    .map((item: InviteRequestWithRelations) => ({
      id: item.id,
      type: item.type,
      status: item.status,
      email: item.email,
      project_id: item.project_id,
      project_name: item.project.name,
      sender_profile_id: item.sender_profile_id,
      sender_name: item.sender.username || '',
      sender_email: item.sender.email || '',
      as_owner: item.as_owner || false,
      created_at: item.created_at,
      last_updated: item.last_updated
    }));

  // Filter out expired notifications
  const validInviteNotifications = inviteNotifications.filter(
    (item) => !isExpired(item.last_updated)
  );
  const validRequestNotifications = requestNotifications.filter(
    (item) => !isExpired(item.last_updated)
  );

  const allNotifications = [
    ...validInviteNotifications,
    ...validRequestNotifications
  ];

  const handleAccept = async (
    notificationId: string,
    type: string,
    projectId: string,
    asOwner: boolean
  ) => {
    if (processingIds.has(notificationId)) return;

    console.log('[handleAccept] Starting with params:', {
      notificationId,
      type,
      projectId,
      asOwner,
      currentUserId: currentUser?.id
    });

    setProcessingIds((prev) => new Set(prev).add(notificationId));

    try {
      // Update invite_request status to accepted
      console.log('[handleAccept] Updating invite_request to accepted...');
      const updateResult = await db
        .update(invite_request)
        .set({
          status: 'accepted',
          last_updated: new Date().toISOString()
        })
        .where(eq(invite_request.id, notificationId));

      console.log('[handleAccept] Update result:', updateResult);

      // Verify the update worked by querying the record
      const updatedRecord = await db
        .select()
        .from(invite_request)
        .where(eq(invite_request.id, notificationId));

      console.log('[handleAccept] Record after update:', updatedRecord);

      if (type === 'invite') {
        console.log(
          '[handleAccept] Processing invite type - checking for existing link...'
        );

        // Create or update profile_project_link for the current user
        const existingLink = await db
          .select()
          .from(profile_project_link)
          .where(
            and(
              eq(profile_project_link.profile_id, currentUser!.id),
              eq(profile_project_link.project_id, projectId)
            )
          );

        console.log('[handleAccept] Existing link found:', existingLink);

        if (existingLink.length > 0) {
          console.log('[handleAccept] Updating existing link...');
          // Update existing link
          const linkUpdateResult = await db
            .update(profile_project_link)
            .set({
              active: true,
              membership: asOwner ? 'owner' : 'member',
              last_updated: new Date().toISOString()
            })
            .where(
              and(
                eq(profile_project_link.profile_id, currentUser!.id),
                eq(profile_project_link.project_id, projectId)
              )
            );
          console.log('[handleAccept] Link update result:', linkUpdateResult);
        } else {
          console.log('[handleAccept] Creating new link...');
          // Create new link
          const newLinkData = {
            id: `${currentUser!.id}_${projectId}`,
            profile_id: currentUser!.id,
            project_id: projectId,
            membership: asOwner ? 'owner' : 'member',
            active: true
          };
          console.log('[handleAccept] New link data:', newLinkData);

          const insertResult = await db
            .insert(profile_project_link)
            .values(newLinkData);
          console.log('[handleAccept] Insert result:', insertResult);
        }
      }

      console.log('[handleAccept] Refetching notifications...');
      // Refetch notifications
      void refetchInvites();
      void refetchRequests();

      Alert.alert('Success', 'Invitation accepted successfully!');
      console.log('[handleAccept] Success - operation completed');
    } catch (error) {
      console.error('[handleAccept] Error accepting invitation:', error);
      console.error('[handleAccept] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      Alert.alert('Error', 'Failed to accept invitation. Please try again.');
    } finally {
      console.log('[handleAccept] Cleaning up processing state...');
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(notificationId);
        return newSet;
      });
    }
  };

  const handleDecline = async (notificationId: string) => {
    if (processingIds.has(notificationId)) return;

    setProcessingIds((prev) => new Set(prev).add(notificationId));

    try {
      // Update invite_request status to declined
      await db
        .update(invite_request)
        .set({
          status: 'declined',
          last_updated: new Date().toISOString()
        })
        .where(eq(invite_request.id, notificationId));

      // Refetch notifications
      void refetchInvites();
      void refetchRequests();

      Alert.alert('Success', 'Invitation declined.');
    } catch (error) {
      console.error('Error declining invitation:', error);
      Alert.alert('Error', 'Failed to decline invitation. Please try again.');
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(notificationId);
        return newSet;
      });
    }
  };

  const renderNotificationItem = (item: NotificationItem) => {
    const isProcessing = processingIds.has(item.id);
    const roleText = item.as_owner ? 'owner' : 'member';

    return (
      <View key={item.id} style={styles.notificationItem}>
        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <Ionicons
              name={item.type === 'invite' ? 'mail' : 'person-add'}
              size={24}
              color={colors.primary}
            />
            <Text style={styles.notificationTitle}>
              {item.type === 'invite' ? 'Project Invitation' : 'Join Request'}
            </Text>
          </View>

          <Text style={styles.notificationMessage}>
            {item.type === 'invite'
              ? `${item.sender_name || item.sender_email} has invited you to join project "${item.project_name}" as ${roleText}`
              : `${item.sender_name || item.sender_email} has requested to join project "${item.project_name}" as ${roleText}`}
          </Text>

          <Text style={styles.notificationDate}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>

        <View style={styles.notificationActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.acceptButton]}
            onPress={() =>
              handleAccept(item.id, item.type, item.project_id, item.as_owner)
            }
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color={colors.buttonText} />
            ) : (
              <>
                <Ionicons
                  name="checkmark"
                  size={16}
                  color={colors.buttonText}
                />
                <Text style={styles.actionButtonText}>Accept</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.declineButton]}
            onPress={() => handleDecline(item.id)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color={colors.buttonText} />
            ) : (
              <>
                <Ionicons name="close" size={16} color={colors.buttonText} />
                <Text style={styles.actionButtonText}>Decline</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <View style={styles.container}>
          <PageHeader title="Notifications" />

          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
          >
            {allNotifications.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons
                  name="notifications-outline"
                  size={64}
                  color={colors.textSecondary}
                />
                <Text style={styles.emptyStateText}>No notifications</Text>
                <Text style={styles.emptyStateSubtext}>
                  You'll see project invitations and join requests here
                </Text>
              </View>
            ) : (
              <View style={styles.notificationsList}>
                {allNotifications.map(renderNotificationItem)}
              </View>
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.medium,
    paddingTop: spacing.medium
  },
  scrollView: {
    flex: 1,
    marginTop: spacing.medium
  },
  notificationsList: {
    gap: spacing.medium,
    paddingBottom: spacing.medium
  },
  notificationItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary
  },
  notificationContent: {
    marginBottom: spacing.medium
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    marginBottom: spacing.small
  },
  notificationTitle: {
    fontSize: fontSizes.medium,
    fontWeight: '600',
    color: colors.text
  },
  notificationMessage: {
    fontSize: fontSizes.medium,
    color: colors.text,
    lineHeight: 20,
    marginBottom: spacing.small
  },
  notificationDate: {
    fontSize: fontSizes.small,
    color: colors.textSecondary
  },
  notificationActions: {
    flexDirection: 'row',
    gap: spacing.small
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xsmall,
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.medium,
    borderRadius: borderRadius.small,
    minHeight: 40
  },
  acceptButton: {
    backgroundColor: colors.success
  },
  declineButton: {
    backgroundColor: colors.error
  },
  actionButtonText: {
    color: colors.buttonText,
    fontSize: fontSizes.small,
    fontWeight: '600'
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxlarge
  },
  emptyStateText: {
    fontSize: fontSizes.large,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.medium,
    marginBottom: spacing.small
  },
  emptyStateSubtext: {
    fontSize: fontSizes.medium,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.large
  }
});
