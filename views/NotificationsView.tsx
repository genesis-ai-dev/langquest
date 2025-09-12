import { useAuth } from '@/contexts/AuthContext';
import {
  invite,
  profile,
  profile_project_link,
  project,
  request
} from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useUserMemberships } from '@/hooks/db/useProfiles';
import { useLocalization } from '@/hooks/useLocalization';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { borderRadius, colors, fontSizes, spacing } from '@/styles/theme';
import { isExpiredByLastUpdated } from '@/utils/dateUtils';
import { useHybridData } from '@/views/new/useHybridData';
import { Ionicons } from '@expo/vector-icons';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { and, eq, inArray } from 'drizzle-orm';
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
  // const [refreshKey, setRefreshKey] = useState(0);

  // Use user memberships from local DB instead of session cache
  const { userMemberships } = useUserMemberships();

  // Get owner project IDs from user memberships
  const ownerProjectIds = React.useMemo(() => {
    return userMemberships
      .filter(
        (membership) => membership.membership === 'owner' && membership.active
      )
      .map((membership) => membership.project_id);
  }, [userMemberships]);

  // Query for invite notifications (where user's email matches) - without project relation
  const { data: inviteData } = useHybridData<typeof invite.$inferSelect>({
    dataType: 'invite-notifications',
    queryKeyParams: [currentUser?.email || ''],

    // PowerSync query using Drizzle
    offlineQuery: toCompilableQuery(
      system.db.query.invite.findMany({
        where: and(
          eq(invite.email, currentUser?.email || ''),
          eq(invite.status, 'pending'),
          eq(invite.active, true)
        )
      })
    )

    // Cloud query
    // cloudQueryFn: async () => {
    //   const { data, error } = await system.supabaseConnector.client
    //     .from('invite')
    //     .select('*')
    //     .eq('email', currentUser?.email || '')
    //     .eq('status', 'pending')
    //     .eq('active', true)
    //     .overrideTypes<(typeof invite.$inferSelect)[]>();
    //   if (error) throw error;
    //   return data;
    // }
  });

  // Get pending requests for owner projects - without project relation
  const { data: requestData } = useHybridData<typeof request.$inferSelect>({
    dataType: 'request-notifications',
    queryKeyParams: [...ownerProjectIds],

    // PowerSync query using Drizzle
    offlineQuery: toCompilableQuery(
      system.db.query.request.findMany({
        where: and(eq(request.status, 'pending'), eq(request.active, true))
      })
    )

    // Cloud query
    // cloudQueryFn: async () => {
    //   const { data, error } = await system.supabaseConnector.client
    //     .from('request')
    //     .select('*')
    //     .eq('status', 'pending')
    //     .eq('active', true)
    //     .overrideTypes<(typeof request.$inferSelect)[]>();
    //   if (error) throw error;
    //   return data;
    // }
  });

  // Filter to only include requests for projects where the user is an owner
  const filteredRequestData = requestData.filter((item) =>
    ownerProjectIds.includes(item.project_id)
  );

  // Get unique project IDs from both invites and requests
  const projectIds = React.useMemo(() => {
    const ids = [
      ...inviteData.map((invite) => invite.project_id),
      ...filteredRequestData.map((request) => request.project_id)
    ];
    return [...new Set(ids)]; // Remove duplicates
  }, [inviteData, filteredRequestData]);

  // Query for projects separately
  const { data: projects } = useHybridData<typeof project.$inferSelect>({
    dataType: 'notification-projects',
    queryKeyParams: [...projectIds],

    // PowerSync query using Drizzle
    offlineQuery:
      projectIds.length > 0
        ? toCompilableQuery(
            system.db.query.project.findMany({
              where: inArray(project.id, projectIds)
            })
          )
        : 'SELECT * FROM project WHERE 1=0', // Empty query when no project IDs

    // Cloud query
    cloudQueryFn: async () => {
      if (projectIds.length === 0) return [];
      const { data, error } = await system.supabaseConnector.client
        .from('project')
        .select('*')
        .in('id', projectIds)
        .overrideTypes<(typeof project.$inferSelect)[]>();
      if (error) throw error;
      return data;
    }
  });

  // Create a map of project ID to project data for easy lookup
  const projectMap = React.useMemo(() => {
    const map: Record<string, typeof project.$inferSelect> = {};
    projects.forEach((proj) => {
      map[proj.id] = proj;
    });
    return map;
  }, [projects]);

  // Get unique sender profile IDs from both invites and requests
  const senderProfileIds = React.useMemo(() => {
    const ids = [
      ...inviteData.map((invite) => invite.sender_profile_id),
      ...filteredRequestData.map((request) => request.sender_profile_id)
    ];
    return [...new Set(ids)]; // Remove duplicates
  }, [inviteData, filteredRequestData]);

  // Query for sender profiles from local database
  const { data: senderProfiles } = useHybridData<SenderProfile>({
    dataType: 'sender-profiles',
    queryKeyParams: [...senderProfileIds],

    // PowerSync query using Drizzle
    offlineQuery:
      senderProfileIds.length > 0
        ? toCompilableQuery(
            system.db.query.profile.findMany({
              where: inArray(profile.id, senderProfileIds)
            })
          )
        : 'SELECT * FROM profile WHERE 1=0', // Empty query when no sender IDs

    // Cloud query
    cloudQueryFn: async () => {
      if (senderProfileIds.length === 0) return [];
      const { data, error } = await system.supabaseConnector.client
        .from('profile')
        .select('*')
        .in('id', senderProfileIds)
        .overrideTypes<SenderProfile[]>();
      if (error) throw error;
      return data;
    }
  });

  // Create a map of profile ID to profile data for easy lookup
  const senderProfileMap = React.useMemo(() => {
    const map: Record<string, SenderProfile> = {};
    senderProfiles.forEach((senderProfile) => {
      map[senderProfile.id] = senderProfile;
    });
    return map;
  }, [senderProfiles]);

  const inviteNotifications: NotificationItem[] = inviteData.map((item) => {
    const senderProfile = senderProfileMap[item.sender_profile_id];
    const projectData = projectMap[item.project_id];
    return {
      id: item.id,
      type: 'invite' as const,
      status: item.status,
      email: item.email,
      project_id: item.project_id,
      project_name: projectData?.name || t('unknownProject'),
      sender_profile_id: item.sender_profile_id,
      sender_name: senderProfile?.username || '',
      sender_email: senderProfile?.email || '',
      as_owner: item.as_owner || false,
      created_at: item.created_at,
      last_updated: item.last_updated
    };
  });

  console.log('inviteNotifications', inviteNotifications);

  const requestNotifications: NotificationItem[] = filteredRequestData.map(
    (item) => {
      const senderProfile = senderProfileMap[item.sender_profile_id];
      const projectData = projectMap[item.project_id];
      return {
        id: item.id,
        type: 'request' as const,
        status: item.status,
        email: undefined,
        project_id: item.project_id,
        project_name: projectData?.name || t('unknownProject'),
        sender_profile_id: item.sender_profile_id,
        sender_name: senderProfile?.username || '',
        sender_email: senderProfile?.email || '',
        as_owner: false,
        created_at: item.created_at,
        last_updated: item.last_updated
      };
    }
  );

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
            count: 1, // Reset count to 1 on successful acceptance - fresh start for future invites
            last_updated: new Date().toISOString()
          })
          .where(eq(invite.id, notificationId));
        console.log('[handleAccept] Invite update result:', updateResult);

        // Verify the update worked by querying the record
        const [updatedRecord] = await system.db
          .select()
          .from(invite)
          .where(eq(invite.id, notificationId))
          .limit(1);
        console.log('[handleAccept] Updated invite record:', updatedRecord);

        if (updatedRecord?.receiver_profile_id) {
          await system.db
            .update(request)
            .set({
              status: 'accepted',
              count: 1, // Reset count to 1 on successful acceptance - fresh start for future requests
              last_updated: new Date().toISOString()
            })
            .where(
              and(
                eq(
                  request.sender_profile_id,
                  updatedRecord.receiver_profile_id
                ),
                eq(request.project_id, updatedRecord.project_id)
              )
            );
        }

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
            count: 1, // Reset count to 1 on successful acceptance - fresh start for future requests
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

          console.log('[handleAccept] Updating invite for request:', {
            senderProfileId,
            projectId
          });

          await system.db
            .update(invite)
            .set({
              count: 1, // Reset count to 1 on successful acceptance (for invite as well) - fresh start for future invites
              last_updated: new Date().toISOString()
            })
            .where(
              and(
                eq(invite.receiver_profile_id, senderProfileId),
                eq(invite.project_id, projectId)
              )
            );

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
        // First get the existing request to check current status
        const existingRequest = await system.db
          .select()
          .from(request)
          .where(eq(request.id, notificationId));

        if (existingRequest.length > 0 && existingRequest[0]) {
          const currentRequest = existingRequest[0];

          // Only increment count if previous request was declined (user actively rejected)
          // Don't count: accepted+inactive (successful then removed), withdrawn (sender cancelled), expired (timed out)
          const newCount =
            currentRequest.status === 'declined'
              ? (currentRequest.count || 0) + 1
              : currentRequest.count || 0;

          await system.db
            .update(request)
            .set({
              status: 'declined',
              count: newCount,
              last_updated: new Date().toISOString()
            })
            .where(eq(request.id, notificationId));
        }
      }

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

    console.log('Rendering notification:', item.id);

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

          <Text style={styles.notificationMessage} ph-no-capture>
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
          {/* {item.type === 'invite' && (
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
          )} */}
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
