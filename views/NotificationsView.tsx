import { useAuth } from '@/contexts/AuthContext';
import { useSessionCache } from '@/contexts/SessionCacheContext';
import type { project } from '@/db/drizzleSchema';
import {
  invite,
  profile,
  profile_project_link,
  request
} from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { downloadRecord } from '@/hooks/useDownloads';
import { useHybridQuery } from '@/hooks/useHybridQuery';
import { useLocalization } from '@/hooks/useLocalization';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { borderRadius, colors, fontSizes, spacing } from '@/styles/theme';
import { isExpiredByLastUpdated } from '@/utils/dateUtils';
import { Ionicons } from '@expo/vector-icons';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { and, eq, inArray } from 'drizzle-orm';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Type definitions for query results
type InviteWithRelations = typeof invite.$inferSelect & {
  project: typeof project.$inferSelect | null;
};

type RequestWithRelations = typeof request.$inferSelect & {
  project: typeof project.$inferSelect | null;
};

interface NotificationItem {
  id: string;
  type: 'invite' | 'request';
  status: string;
  email?: string;
  project_id: string;
  project_name: string;
  sender_profile_id: string;
  sender_name: string;
  sender_email: string;
  as_owner: boolean;
  created_at: string;
  last_updated: string;
}

interface SenderProfile {
  id: string;
  username: string | null;
  email: string | null;
}

export default function NotificationsView() {
  const { t } = useLocalization();
  const { currentUser } = useAuth();
  const isConnected = useNetworkStatus();
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [downloadToggles, setDownloadToggles] = useState<
    Record<string, boolean>
  >({});

  // Use session cache for user memberships instead of separate query
  const { userMemberships } = useSessionCache();

  // Get owner project IDs from session cache
  const ownerProjectIds = React.useMemo(() => {
    return (
      userMemberships
        ?.filter(
          (membership) => membership.membership === 'owner' && membership.active
        )
        .map((membership) => membership.project_id) ?? []
    );
  }, [userMemberships]);

  // Query for invite notifications (where user's email matches) - without sender relation
  const { data: inviteData = [], refetch: refetchInvites } = useHybridQuery({
    queryKey: ['invite-notifications', currentUser?.email],
    onlineFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('invite')
        .select(
          `
          *,
          project!inner(id, name)
        `
        )
        .eq('email', currentUser?.email || '')
        .eq('status', 'pending')
        .eq('active', true);
      if (error) {
        console.error('Invite query error:', error);
        throw error;
      }
      console.log('Invite query result:', data);
      return data as InviteWithRelations[];
    },
    offlineQuery: toCompilableQuery(
      system.db.query.invite.findMany({
        where: and(
          eq(invite.email, currentUser?.email || ''),
          eq(invite.status, 'pending'),
          eq(invite.active, true)
        ),
        with: {
          project: true
        }
      })
    ),
    enabled: !!currentUser?.email
  });

  // Get pending requests for owner projects (using session cache for owner project IDs) - without sender relation
  const { data: requestData = [], refetch: refetchRequests } = useHybridQuery({
    queryKey: ['request-notifications', ownerProjectIds],
    onlineFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('request')
        .select(
          `
          *,
          project!inner(id, name)
        `
        )
        .eq('status', 'pending')
        .eq('active', true);
      if (error) {
        console.error('Request query error:', error);
        throw error;
      }
      console.log('Request query result:', data);
      return data as RequestWithRelations[];
    },
    offlineQuery: toCompilableQuery(
      system.db.query.request.findMany({
        where: and(eq(request.status, 'pending'), eq(request.active, true)),
        with: {
          project: true
        }
      })
    ),
    enabled: ownerProjectIds.length > 0
  });

  // Filter to only include requests for projects where the user is an owner
  const filteredRequestData = requestData.filter((item: RequestWithRelations) =>
    ownerProjectIds.includes(item.project_id)
  );

  // Get unique sender profile IDs from both invites and requests
  const senderProfileIds = React.useMemo(() => {
    const ids = [
      ...inviteData.map((invite) => invite.sender_profile_id),
      ...filteredRequestData.map((request) => request.sender_profile_id)
    ];
    return [...new Set(ids)]; // Remove duplicates
  }, [inviteData, filteredRequestData]);

  // Query for sender profiles from local database
  const { data: senderProfiles = [] } = useHybridQuery({
    queryKey: ['sender-profiles', senderProfileIds],
    onlineFn: async () => {
      // For online, we still use the local database since profiles are always synced
      const profiles = await system.db.query.profile.findMany({
        where: inArray(profile.id, senderProfileIds)
      });
      return profiles;
    },
    offlineQuery: toCompilableQuery(
      system.db.query.profile.findMany({
        where: inArray(profile.id, senderProfileIds)
      })
    ),
    enabled: senderProfileIds.length > 0
  });

  // Create a map of profile ID to profile data for easy lookup
  const senderProfileMap = React.useMemo(() => {
    const map: Record<string, SenderProfile> = {};
    senderProfiles.forEach((senderProfile) => {
      map[senderProfile.id] = senderProfile;
    });
    return map;
  }, [senderProfiles]);

  const inviteNotifications: NotificationItem[] = inviteData.map(
    (item: InviteWithRelations) => {
      const senderProfile = senderProfileMap[item.sender_profile_id];
      return {
        id: item.id,
        type: 'invite' as const,
        status: item.status,
        email: item.email,
        project_id: item.project_id,
        project_name: item.project?.name || t('unknownProject'),
        sender_profile_id: item.sender_profile_id,
        sender_name: senderProfile?.username || '',
        sender_email: senderProfile?.email || '',
        as_owner: item.as_owner || false,
        created_at: item.created_at,
        last_updated: item.last_updated
      };
    }
  );

  const requestNotifications: NotificationItem[] = filteredRequestData.map(
    (item: RequestWithRelations) => {
      const senderProfile = senderProfileMap[item.sender_profile_id];
      return {
        id: item.id,
        type: 'request' as const,
        status: item.status,
        email: undefined,
        project_id: item.project_id,
        project_name: item.project?.name || t('unknownProject'),
        sender_profile_id: item.sender_profile_id,
        sender_name: senderProfile?.username || '',
        sender_email: senderProfile?.email || '',
        as_owner: false,
        created_at: item.created_at,
        last_updated: item.last_updated
      };
    }
  );

  // Memoize notification IDs to prevent unnecessary re-renders
  const notificationIds = React.useMemo(
    () =>
      inviteNotifications
        .map((n) => n.id)
        .sort()
        .join(','),
    [inviteNotifications]
  );

  // Initialize download toggles for invites
  useEffect(() => {
    if (inviteNotifications.length === 0) return;

    setDownloadToggles((prev) => {
      const newToggles = { ...prev };

      inviteNotifications.forEach((notification) => {
        // Only initialize if not already set
        if (newToggles[notification.id] === undefined) {
          // Default to true (download) since we can't check existing status easily
          newToggles[notification.id] = true;
        }
      });

      return newToggles;
    });
  }, [notificationIds]);

  // Filter out expired notifications
  const validInviteNotifications = inviteNotifications.filter(
    (item) => !isExpiredByLastUpdated(item.last_updated)
  );
  const validRequestNotifications = requestNotifications.filter(
    (item) => !isExpiredByLastUpdated(item.last_updated)
  );

  const allNotifications = [
    ...validInviteNotifications,
    ...validRequestNotifications
  ];

  const handleAccept = async (
    notificationId: string,
    type: 'invite' | 'request',
    projectId: string,
    asOwner: boolean,
    shouldDownload = false
  ) => {
    if (processingIds.has(notificationId)) return;

    console.log('[handleAccept] Starting with params:', {
      notificationId,
      type,
      projectId,
      asOwner,
      currentUserId: currentUser?.id,
      shouldDownload
    });

    setProcessingIds((prev) => new Set(prev).add(notificationId));

    try {
      // Update the appropriate table based on type
      if (type === 'invite') {
        console.log('[handleAccept] Updating invite to accepted...');

        // First check if the record exists
        const existingRecord = await system.db
          .select()
          .from(invite)
          .where(eq(invite.id, notificationId));
        console.log('[handleAccept] Existing invite record:', existingRecord);

        const updateResult = await system.db
          .update(invite)
          .set({
            status: 'accepted',
            last_updated: new Date().toISOString()
          })
          .where(eq(invite.id, notificationId));
        console.log('[handleAccept] Invite update result:', updateResult);

        // Verify the update worked by querying the record
        const updatedRecord = await system.db
          .select()
          .from(invite)
          .where(eq(invite.id, notificationId));
        console.log('[handleAccept] Updated invite record:', updatedRecord);

        const existingLink = await system.db
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
          await system.db
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
          const newLinkData = {
            id: `${currentUser!.id}_${projectId}`,
            profile_id: currentUser!.id,
            project_id: projectId,
            membership: asOwner ? 'owner' : 'member',
            active: true
          };
          console.log('[handleAccept] New link data:', newLinkData);

          const insertResult = await system.db
            .insert(profile_project_link)
            .values(newLinkData);
          console.log('[handleAccept] Insert result:', insertResult);
        }

        // Handle project download if requested
        if (shouldDownload && currentUser) {
          try {
            await downloadRecord('project', projectId, false);
          } catch (downloadError) {
            console.error(
              '[handleAccept] Error setting project download:',
              downloadError
            );
            // Don't fail the entire operation if download fails
            Alert.alert(t('warning'), t('invitationAcceptedDownloadFailed'));
          }
        }
      } else {
        // type === 'request'
        console.log('[handleAccept] Updating request to accepted...');

        // First check if the record exists
        const existingRequestRecord = await system.db
          .select()
          .from(request)
          .where(eq(request.id, notificationId));
        console.log(
          '[handleAccept] Existing request record:',
          existingRequestRecord
        );

        const updateResult = await system.db
          .update(request)
          .set({
            status: 'accepted',
            last_updated: new Date().toISOString()
          })
          .where(eq(request.id, notificationId));

        console.log('[handleAccept] Request update result:', updateResult);

        // For requests, we need to get the sender_profile_id from the request
        const requestRecord = await system.db
          .select()
          .from(request)
          .where(eq(request.id, notificationId));

        if (requestRecord.length > 0 && requestRecord[0]) {
          const senderProfileId = requestRecord[0].sender_profile_id;

          // Create or update profile_project_link for the requester
          const existingLink = await system.db
            .select()
            .from(profile_project_link)
            .where(
              and(
                eq(profile_project_link.profile_id, senderProfileId),
                eq(profile_project_link.project_id, projectId)
              )
            );

          if (existingLink.length > 0) {
            // Update existing link
            await system.db
              .update(profile_project_link)
              .set({
                active: true,
                membership: asOwner ? 'owner' : 'member',
                last_updated: new Date().toISOString()
              })
              .where(
                and(
                  eq(profile_project_link.profile_id, senderProfileId),
                  eq(profile_project_link.project_id, projectId)
                )
              );
          } else {
            // Create new link
            await system.db.insert(profile_project_link).values({
              id: `${senderProfileId}_${projectId}`,
              profile_id: senderProfileId,
              project_id: projectId,
              membership: asOwner ? 'owner' : 'member',
              active: true
            });
          }
        }
      }

      console.log('[handleAccept] Refetching notifications...');
      // Refetch notifications
      void refetchInvites();
      void refetchRequests();

      Alert.alert(t('success'), t('invitationAcceptedSuccessfully'));
      console.log('[handleAccept] Success - operation completed');
    } catch (error) {
      console.error('[handleAccept] Error accepting invitation:', error);
      console.error('[handleAccept] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      Alert.alert(t('error'), t('failedToAcceptInvite'));
    } finally {
      console.log('[handleAccept] Cleaning up processing state...');
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(notificationId);
        return newSet;
      });
    }
  };

  const handleDecline = async (
    notificationId: string,
    type: 'invite' | 'request'
  ) => {
    if (processingIds.has(notificationId)) return;

    setProcessingIds((prev) => new Set(prev).add(notificationId));

    try {
      // Update the appropriate table based on type
      if (type === 'invite') {
        await system.db
          .update(invite)
          .set({
            status: 'declined',
            last_updated: new Date().toISOString()
          })
          .where(eq(invite.id, notificationId));
      } else {
        // type === 'request'
        await system.db
          .update(request)
          .set({
            status: 'declined',
            last_updated: new Date().toISOString()
          })
          .where(eq(request.id, notificationId));
      }

      // Refetch notifications
      void refetchInvites();
      void refetchRequests();

      Alert.alert(t('success'), t('invitationDeclinedSuccessfully'));
    } catch (error) {
      console.error('Error declining invitation:', error);
      Alert.alert(t('error'), t('failedToDeclineInvite'));
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
    const roleText = item.as_owner ? t('ownerRole') : t('memberRole');
    const shouldDownload = downloadToggles[item.id] ?? true;

    console.log(
      'Rendering notification:',
      item.id,
      'shouldDownload:',
      shouldDownload,
      'downloadToggles:',
      downloadToggles
    );

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
              {item.type === 'invite'
                ? t('projectInvitationTitle')
                : t('joinRequestTitle')}
            </Text>
          </View>

          <Text style={styles.notificationMessage}>
            {item.type === 'invite'
              ? t('invitedYouToJoin', {
                  sender: `${item.sender_name}${item.sender_email ? ` (${item.sender_email})` : ''}`,
                  project: item.project_name,
                  role: roleText
                })
              : t('requestedToJoin', {
                  sender: `${item.sender_name}${item.sender_email ? ` (${item.sender_email})` : ''}`,
                  project: item.project_name,
                  role: roleText
                })}
          </Text>

          <Text style={styles.notificationDate}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>

          {/* Download toggle for invites */}
          {item.type === 'invite' && (
            <View style={styles.downloadSection}>
              <View style={styles.downloadToggleRow}>
                <Text style={styles.downloadLabel}>
                  {t('downloadProjectLabel')}
                </Text>
                <Switch
                  value={shouldDownload}
                  onValueChange={(value) => {
                    console.log(
                      'Toggle changed for notification:',
                      item.id,
                      'New value:',
                      value
                    );
                    setDownloadToggles((prev) => {
                      const newToggles = {
                        ...prev,
                        [item.id]: value
                      };
                      console.log('Updated toggles:', newToggles);
                      return newToggles;
                    });
                  }}
                  trackColor={{
                    false: colors.textSecondary,
                    true: colors.primary
                  }}
                  thumbColor={
                    shouldDownload ? colors.primary : colors.inputBackground
                  }
                  disabled={isProcessing}
                />
              </View>
              {!shouldDownload && (
                <View style={styles.warningContainer}>
                  <Ionicons name="warning" size={16} color={colors.alert} />
                  <Text style={styles.warningText}>
                    {t('projectNotAvailableOfflineWarning')}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        <View style={styles.notificationActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.acceptButton]}
            onPress={() =>
              handleAccept(
                item.id,
                item.type,
                item.project_id,
                item.as_owner,
                shouldDownload
              )
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
                <Text style={styles.actionButtonText}>{t('accept')}</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.declineButton]}
            onPress={() => handleDecline(item.id, item.type)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color={colors.buttonText} />
            ) : (
              <>
                <Ionicons name="close" size={16} color={colors.buttonText} />
                <Text style={styles.actionButtonText}>{t('decline')}</Text>
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
          <Text style={styles.pageTitle}>{t('notifications')}</Text>

          {!isConnected && (
            <View style={styles.offlineBanner}>
              <Ionicons name="wifi-outline" size={20} color={colors.alert} />
              <Text style={styles.offlineBannerText}>
                {t('offlineNotificationMessage')}
              </Text>
            </View>
          )}

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
                <Text style={styles.emptyStateText}>
                  {t('noNotificationsTitle')}
                </Text>
                <Text style={styles.emptyStateSubtext}>
                  {t('noNotificationsMessage')}
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
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.large
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
  },
  downloadSection: {
    marginTop: spacing.medium,
    gap: spacing.small
  },
  downloadToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
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
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.medium,
    borderRadius: borderRadius.small,
    marginBottom: spacing.medium,
    borderLeftWidth: 4,
    borderLeftColor: colors.alert
  },
  offlineBannerText: {
    fontSize: fontSizes.medium,
    color: colors.text,
    marginLeft: spacing.small
  }
});
