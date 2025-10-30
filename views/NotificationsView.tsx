import { Alert, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/contexts/AuthContext';
import {
  invite,
  profile,
  profile_project_link,
  project,
  request
} from '@/db/drizzleSchema';
import {
  invite_synced,
  profile_project_link_synced,
  request_synced
} from '@/db/drizzleSchemaSynced';
import { system } from '@/db/powersync/system';
import { useUserMemberships } from '@/hooks/db/useProfiles';
import { useAppNavigation } from '@/hooks/useAppNavigation';
import { useLocalization } from '@/hooks/useLocalization';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { colors } from '@/styles/theme';
import { isExpiredByLastUpdated } from '@/utils/dateUtils';
import { getThemeColor } from '@/utils/styleUtils';
import { useHybridData } from '@/views/new/useHybridData';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useQueryClient } from '@tanstack/react-query';
import { and, eq, inArray } from 'drizzle-orm';
import {
  BellIcon,
  CheckIcon,
  HomeIcon,
  MailIcon,
  UserPlusIcon,
  WifiIcon,
  XIcon
} from 'lucide-react-native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert as RNAlert,
  ScrollView,
  View
} from 'react-native';

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
  const { goToProjects } = useAppNavigation();
  const queryClient = useQueryClient();
  const isConnected = useNetworkStatus();
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  // const [refreshKey, setRefreshKey] = useState(0);

  // All operations on invites, requests, and notifications go through synced tables
  // PowerSync will automatically sync changes to Supabase and back down

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
  const { data: inviteData } = useHybridData({
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
  const { data: requestData } = useHybridData({
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
  const { data: projects } = useHybridData({
    dataType: 'notification-projects',
    queryKeyParams: [...projectIds],

    // PowerSync query using Drizzle
    offlineQuery: toCompilableQuery(
      system.db.query.project.findMany({
        where: inArray(project.id, projectIds)
      })
    ), // Empty query when no project IDs

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
    },
    enableOfflineQuery: projectIds.length > 0
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
  const { data: senderProfiles } = useHybridData({
    dataType: 'sender-profiles',
    queryKeyParams: [...senderProfileIds],

    // PowerSync query using Drizzle
    offlineQuery: toCompilableQuery(
      system.db.query.profile.findMany({
        where: inArray(profile.id, senderProfileIds)
      })
    ),

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
    },
    enableOfflineQuery: senderProfileIds.length > 0
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

        // First check if the record exists in the merged view
        const existingRecord = await system.db
          .select()
          .from(invite)
          .where(eq(invite.id, notificationId));
        console.log('[handleAccept] Existing invite record:', existingRecord);

        if (existingRecord.length > 0 && existingRecord[0]) {
          const record = existingRecord[0];

          // Update invite via synced table - PowerSync will sync changes to Supabase
          await system.db
            .update(invite_synced)
            .set({
              status: 'accepted',
              count: 1,
              receiver_profile_id:
                record.receiver_profile_id || currentUser!.id,
              last_updated: new Date().toISOString()
            })
            .where(eq(invite_synced.id, notificationId));

          console.log('[handleAccept] Invite updated via synced table');

          // Also update any corresponding request from this user via synced table
          if (record.receiver_profile_id) {
            // Find the corresponding request from the merged view
            const correspondingRequest = await system.db
              .select()
              .from(request)
              .where(
                and(
                  eq(request.sender_profile_id, record.receiver_profile_id),
                  eq(request.project_id, record.project_id),
                  eq(request.active, true)
                )
              )
              .limit(1);

            if (correspondingRequest.length > 0 && correspondingRequest[0]) {
              const req = correspondingRequest[0];

              // Update request via synced table
              await system.db
                .update(request_synced)
                .set({
                  status: 'accepted',
                  count: 1,
                  last_updated: new Date().toISOString()
                })
                .where(eq(request_synced.id, req.id));

              console.log(
                '[handleAccept] Corresponding request updated via synced table'
              );
            }
          }
        }

        // Create or update profile_project_link via synced table
        const existingLink = await system.db
          .select()
          .from(profile_project_link)
          .where(
            and(
              eq(profile_project_link.profile_id, currentUser!.id),
              eq(profile_project_link.project_id, projectId)
            )
          )
          .limit(1);

        if (existingLink.length > 0) {
          // Update existing link via synced table
          await system.db
            .update(profile_project_link_synced)
            .set({
              active: true,
              membership: asOwner ? 'owner' : 'member',
              last_updated: new Date().toISOString()
            })
            .where(
              and(
                eq(profile_project_link_synced.profile_id, currentUser!.id),
                eq(profile_project_link_synced.project_id, projectId)
              )
            );
          console.log(
            '[handleAccept] Profile project link updated via synced table'
          );
        } else {
          // Create new link via synced table
          await system.db.insert(profile_project_link_synced).values({
            profile_id: currentUser!.id,
            project_id: projectId,
            membership: asOwner ? 'owner' : 'member',
            active: true
          });
          console.log(
            '[handleAccept] Profile project link created via synced table'
          );
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

        if (existingRequestRecord.length > 0 && existingRequestRecord[0]) {
          const req = existingRequestRecord[0];

          // Update request via synced table - PowerSync will sync changes to Supabase
          await system.db
            .update(request_synced)
            .set({
              status: 'accepted',
              count: 1,
              last_updated: new Date().toISOString()
            })
            .where(eq(request_synced.id, notificationId));

          console.log('[handleAccept] Request updated via synced table');

          const senderProfileId = req.sender_profile_id;

          console.log('[handleAccept] Updating invite for request:', {
            senderProfileId,
            projectId
          });

          // Also update any corresponding invite
          const correspondingInvite = await system.db
            .select()
            .from(invite)
            .where(
              and(
                eq(invite.receiver_profile_id, senderProfileId),
                eq(invite.project_id, projectId),
                eq(invite.active, true)
              )
            )
            .limit(1);

          if (correspondingInvite.length > 0 && correspondingInvite[0]) {
            const inv = correspondingInvite[0];

            // Update corresponding invite via synced table
            await system.db
              .update(invite_synced)
              .set({
                count: 1,
                last_updated: new Date().toISOString()
              })
              .where(eq(invite_synced.id, inv.id));

            console.log(
              '[handleAccept] Corresponding invite updated via synced table'
            );
          }

          // Create or update profile_project_link for the requester via synced table
          const existingRequesterLink = await system.db
            .select()
            .from(profile_project_link)
            .where(
              and(
                eq(profile_project_link.profile_id, senderProfileId),
                eq(profile_project_link.project_id, projectId)
              )
            )
            .limit(1);

          if (existingRequesterLink.length > 0) {
            // Update existing link via synced table
            await system.db
              .update(profile_project_link_synced)
              .set({
                active: true,
                membership: asOwner ? 'owner' : 'member',
                last_updated: new Date().toISOString()
              })
              .where(
                and(
                  eq(profile_project_link_synced.profile_id, senderProfileId),
                  eq(profile_project_link_synced.project_id, projectId)
                )
              );
            console.log(
              '[handleAccept] Requester profile project link updated via synced table'
            );
          } else {
            // Create new link via synced table
            await system.db.insert(profile_project_link_synced).values({
              profile_id: senderProfileId,
              project_id: projectId,
              membership: asOwner ? 'owner' : 'member',
              active: true
            });
            console.log(
              '[handleAccept] Requester profile project link created via synced table'
            );
          }
        }
      }

      // Invalidate project queries to refresh the projects list
      void queryClient.invalidateQueries({ queryKey: ['my-projects'] });
      void queryClient.invalidateQueries({ queryKey: ['invited-projects'] });
      void queryClient.invalidateQueries({ queryKey: ['all-projects'] });
      void queryClient.invalidateQueries({
        queryKey: ['notification-projects']
      });

      RNAlert.alert(t('success'), t('invitationAcceptedSuccessfully'));
      console.log('[handleAccept] Success - operation completed');
    } catch (error) {
      console.error('[handleAccept] Error accepting invitation:', error);
      console.error('[handleAccept] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      RNAlert.alert(t('error'), t('failedToAcceptInvite'));
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
        // Get the existing record
        const existingInvite = await system.db
          .select()
          .from(invite)
          .where(eq(invite.id, notificationId));

        if (existingInvite.length > 0 && existingInvite[0]) {
          const inv = existingInvite[0];

          // Update invite via synced table - PowerSync will sync changes to Supabase
          await system.db
            .update(invite_synced)
            .set({
              status: 'declined',
              last_updated: new Date().toISOString()
            })
            .where(eq(invite_synced.id, notificationId));

          console.log('[handleDecline] Invite declined via synced table');
        }
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

          // Update request via synced table - PowerSync will sync changes to Supabase
          await system.db
            .update(request_synced)
            .set({
              status: 'declined',
              count: newCount,
              last_updated: new Date().toISOString()
            })
            .where(eq(request_synced.id, notificationId));

          console.log('[handleDecline] Request declined via synced table');
        }
      }

      RNAlert.alert(t('success'), t('invitationDeclinedSuccessfully'));
    } catch (error) {
      console.error('Error declining invitation:', error);
      RNAlert.alert(t('error'), t('failedToDeclineInvite'));
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
      <Card key={item.id}>
        <CardContent className="p-4">
          <View className="flex gap-4">
            <View className="flex gap-2">
              <View className="flex-row items-center gap-2">
                <Icon
                  as={item.type === 'invite' ? MailIcon : UserPlusIcon}
                  size={24}
                  color={colors.primary}
                />
                <Text className="text-sm font-semibold text-foreground">
                  {item.type === 'invite'
                    ? t('projectInvitationTitle')
                    : t('joinRequestTitle')}
                </Text>
              </View>

              <Text className="text-sm leading-5 text-foreground" ph-no-capture>
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

              <Text className="text-xs text-muted-foreground">
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

            <View className="flex-row gap-2">
              <Button
                size="sm"
                className="flex-1 flex-row items-center gap-2"
                onPress={() =>
                  handleAccept(
                    item.id,
                    item.type,
                    item.project_id,
                    item.as_owner
                  )
                }
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator
                    size="small"
                    color={getThemeColor('foreground')}
                  />
                ) : (
                  <>
                    <Icon as={CheckIcon} className="text-foreground" />
                    <Text className="text-foreground">{t('accept')}</Text>
                  </>
                )}
              </Button>

              <Button
                variant="secondary"
                size="sm"
                className="flex-1 flex-row items-center gap-2"
                onPress={() => handleDecline(item.id, item.type)}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator
                    size="small"
                    color={getThemeColor('foreground')}
                  />
                ) : (
                  <>
                    <Icon as={XIcon} />
                    <Text>{t('decline')}</Text>
                  </>
                )}
              </Button>
            </View>
          </View>
        </CardContent>
      </Card>
    );
  };

  return (
    <View className="flex-1 gap-4 px-4 pt-4">
      <Text className="text-2xl font-bold">{t('notifications')}</Text>

      {!isConnected && (
        <Alert icon={WifiIcon}>
          <AlertTitle>{t('offlineNotificationMessage')}</AlertTitle>
        </Alert>
      )}

      <View className="flex-1 flex-col gap-4">
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {allNotifications.length === 0 ? (
            <View className="flex-1 items-center justify-center py-14">
              <View className="flex-col items-center gap-4">
                <Icon as={BellIcon} size={64} color={colors.textSecondary} />
                <View className="flex-col items-center gap-2">
                  <Text className="text-base font-semibold text-foreground">
                    {t('noNotificationsTitle')}
                  </Text>
                  <Text className="px-6 text-center text-sm text-muted-foreground">
                    {t('noNotificationsMessage')}
                  </Text>
                  <Button
                    variant="default"
                    size="icon-lg"
                    onPress={goToProjects}
                    className="mt-4"
                  >
                    <Icon as={HomeIcon} className="text-primary-foreground" />
                  </Button>
                </View>
              </View>
            </View>
          ) : (
            <View className="flex-col gap-4 pb-4">
              {allNotifications.map(renderNotificationItem)}
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

// Tailwind classes (via NativeWind) are now used instead of StyleSheet styles
