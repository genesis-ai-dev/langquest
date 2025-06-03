import { PageHeader } from '@/components/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { invite_request, profile_project_link } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import {
  borderRadius,
  colors,
  fontSizes,
  sharedStyles,
  spacing
} from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@powersync/tanstack-react-query';
import { and, eq } from 'drizzle-orm';
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
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  // Helper function to check if invitation is expired
  const isExpired = (lastUpdated: string): boolean => {
    const updatedDate = new Date(lastUpdated);
    const now = new Date();
    return now.getTime() - updatedDate.getTime() > INVITATION_EXPIRY_MS;
  };

  // Query for invite notifications (where user's email matches)
  const { data: inviteNotifications = [], refetch: refetchInvites } =
    useQuery<NotificationItem>({
      queryKey: ['invite-notifications', currentUser?.email],
      query: `
      SELECT 
        ir.id,
        ir.type,
        ir.status,
        ir.email,
        ir.project_id,
        p.name as project_name,
        ir.sender_profile_id,
        sender.username as sender_name,
        sender.email as sender_email,
        ir.as_owner,
        ir.created_at,
        ir.last_updated
      FROM invite_request ir
      JOIN project p ON p.id = ir.project_id
      JOIN profile sender ON sender.id = ir.sender_profile_id
      WHERE ir.type = 'invite'
        AND ir.email = ?
        AND ir.status = 'pending'
        AND ir.active = 1
    `,
      parameters: [currentUser?.email || ''],
      enabled: !!currentUser?.email
    });

  // Query for request notifications (where user is project owner)
  const { data: requestNotifications = [], refetch: refetchRequests } =
    useQuery<NotificationItem>({
      queryKey: ['request-notifications', currentUser?.id],
      query: `
      SELECT 
        ir.id,
        ir.type,
        ir.status,
        ir.email,
        ir.project_id,
        p.name as project_name,
        ir.sender_profile_id,
        sender.username as sender_name,
        sender.email as sender_email,
        ir.as_owner,
        ir.created_at,
        ir.last_updated
      FROM invite_request ir
      JOIN project p ON p.id = ir.project_id
      JOIN profile sender ON sender.id = ir.sender_profile_id
      JOIN profile_project_link ppl ON ppl.project_id = ir.project_id
      WHERE ir.type = 'request'
        AND ir.status = 'pending'
        AND ir.active = 1
        AND ppl.profile_id = ?
        AND ppl.membership = 'owner'
        AND ppl.active = 1
    `,
      parameters: [currentUser?.id || ''],
      enabled: !!currentUser?.id
    });

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

    setProcessingIds((prev) => new Set(prev).add(notificationId));

    try {
      // Update invite_request status to accepted
      await db
        .update(invite_request)
        .set({
          status: 'accepted',
          last_updated: new Date().toISOString()
        })
        .where(eq(invite_request.id, notificationId));

      if (type === 'invite') {
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

        if (existingLink.length > 0) {
          // Update existing link
          await db
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
        } else {
          // Create new link
          await db.insert(profile_project_link).values({
            profile_id: currentUser!.id,
            project_id: projectId,
            membership: asOwner ? 'owner' : 'member',
            active: true
          });
        }
      }

      // Refetch notifications
      void refetchInvites();
      void refetchRequests();

      Alert.alert('Success', 'Invitation accepted successfully!');
    } catch (error) {
      console.error('Error accepting invitation:', error);
      Alert.alert('Error', 'Failed to accept invitation. Please try again.');
    } finally {
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
    <SafeAreaView
      style={sharedStyles.container}
      edges={['top', 'left', 'right']}
    >
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    marginTop: spacing.medium
  },
  notificationsList: {
    gap: spacing.medium
  },
  notificationItem: {
    backgroundColor: colors.backgroundSecondary,
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
