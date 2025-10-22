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
import { system } from '@/db/powersync/system';
import { useUserMemberships } from '@/hooks/db/useProfiles';
import { useLocalization } from '@/hooks/useLocalization';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { colors } from '@/styles/theme';
import { isExpiredByLastUpdated } from '@/utils/dateUtils';
import { resolveTable } from '@/utils/dbUtils';
import { getThemeColor } from '@/utils/styleUtils';
import { useHybridData } from '@/views/new/useHybridData';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { and, eq, inArray } from 'drizzle-orm';
import {
  BellIcon,
  CheckIcon,
  MailIcon,
  UserPlusIcon,
  WifiIcon,
  XIcon
} from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
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
  const isConnected = useNetworkStatus();
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  // const [refreshKey, setRefreshKey] = useState(0);

  // Resolve the local tables for updates (PowerSync requires local table updates)
  const inviteLocal = useMemo(
    () => resolveTable('invite', { localOverride: true }),
    []
  );
  const requestLocal = useMemo(
    () => resolveTable('request', { localOverride: true }),
    []
  );
  const profileProjectLinkLocal = useMemo(
    () => resolveTable('profile_project_link', { localOverride: true }),
    []
  );

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

          // Check if record exists in local table
          const localRecord = await system.db
            .select()
            .from(inviteLocal)
            .where(eq(inviteLocal.id, notificationId))
            .limit(1);

          console.log(
            '[handleAccept] Local invite record exists:',
            localRecord.length > 0
          );

          if (localRecord.length > 0) {
            // Update existing local record
            const updateResult = await system.db
              .update(inviteLocal)
              .set({
                status: 'accepted',
                count: 1,
                receiver_profile_id:
                  record.receiver_profile_id || currentUser!.id,
                last_updated: new Date().toISOString()
              })
              .where(eq(inviteLocal.id, notificationId));
            console.log('[handleAccept] Invite update result:', updateResult);
          } else {
            // Insert new local record (this creates a CRUD operation for PowerSync to sync)
            const insertResult = await system.db.insert(inviteLocal).values({
              id: record.id,
              sender_profile_id: record.sender_profile_id,
              receiver_profile_id:
                record.receiver_profile_id || currentUser!.id,
              project_id: record.project_id,
              email: record.email,
              as_owner: record.as_owner,
              status: 'accepted',
              count: 1,
              last_updated: new Date().toISOString(),
              created_at: record.created_at,
              active: record.active
            });
            console.log('[handleAccept] Invite insert result:', insertResult);
          }

          // Also update any corresponding request from this user
          if (record.receiver_profile_id) {
            // Find the corresponding request
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

              // Check if exists in local
              const localReq = await system.db
                .select()
                .from(requestLocal)
                .where(eq(requestLocal.id, req.id))
                .limit(1);

              if (localReq.length > 0) {
                await system.db
                  .update(requestLocal)
                  .set({
                    status: 'accepted',
                    count: 1,
                    last_updated: new Date().toISOString()
                  })
                  .where(eq(requestLocal.id, req.id));
              } else {
                await system.db.insert(requestLocal).values({
                  id: req.id,
                  sender_profile_id: req.sender_profile_id,
                  project_id: req.project_id,
                  status: 'accepted',
                  count: 1,
                  last_updated: new Date().toISOString(),
                  created_at: req.created_at,
                  active: req.active
                });
              }
            }
          }
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
            .update(profileProjectLinkLocal)
            .set({
              active: true,
              membership: asOwner ? 'owner' : 'member',
              last_updated: new Date().toISOString()
            })
            .where(
              and(
                eq(profileProjectLinkLocal.profile_id, currentUser!.id),
                eq(profileProjectLinkLocal.project_id, projectId)
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
          } satisfies typeof profile_project_link.$inferInsert;
          console.log('[handleAccept] New link data:', newLinkData);

          const insertResult = await system.db
            .insert(profileProjectLinkLocal)
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

        if (existingRequestRecord.length > 0 && existingRequestRecord[0]) {
          const req = existingRequestRecord[0];

          // Check if exists in local
          const localReq = await system.db
            .select()
            .from(requestLocal)
            .where(eq(requestLocal.id, notificationId))
            .limit(1);

          console.log(
            '[handleAccept] Local request record exists:',
            localReq.length > 0
          );

          if (localReq.length > 0) {
            const updateResult = await system.db
              .update(requestLocal)
              .set({
                status: 'accepted',
                count: 1,
                last_updated: new Date().toISOString()
              })
              .where(eq(requestLocal.id, notificationId));
            console.log('[handleAccept] Request update result:', updateResult);
          } else {
            const insertResult = await system.db.insert(requestLocal).values({
              id: req.id,
              sender_profile_id: req.sender_profile_id,
              project_id: req.project_id,
              status: 'accepted',
              count: 1,
              last_updated: new Date().toISOString(),
              created_at: req.created_at,
              active: req.active
            });
            console.log('[handleAccept] Request insert result:', insertResult);
          }

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

            // Check if exists in local
            const localInv = await system.db
              .select()
              .from(inviteLocal)
              .where(eq(inviteLocal.id, inv.id))
              .limit(1);

            if (localInv.length > 0) {
              await system.db
                .update(inviteLocal)
                .set({
                  count: 1,
                  last_updated: new Date().toISOString()
                })
                .where(eq(inviteLocal.id, inv.id));
            } else {
              await system.db.insert(inviteLocal).values({
                id: inv.id,
                sender_profile_id: inv.sender_profile_id,
                receiver_profile_id: inv.receiver_profile_id,
                project_id: inv.project_id,
                email: inv.email,
                as_owner: inv.as_owner,
                status: inv.status,
                count: 1,
                last_updated: new Date().toISOString(),
                created_at: inv.created_at,
                active: inv.active
              });
            }
          }

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
              .update(profileProjectLinkLocal)
              .set({
                active: true,
                membership: asOwner ? 'owner' : 'member',
                last_updated: new Date().toISOString()
              })
              .where(
                and(
                  eq(profileProjectLinkLocal.profile_id, senderProfileId),
                  eq(profileProjectLinkLocal.project_id, projectId)
                )
              );
          } else {
            // Create new link
            await system.db.insert(profileProjectLinkLocal).values({
              id: `${senderProfileId}_${projectId}`,
              profile_id: senderProfileId,
              project_id: projectId,
              membership: asOwner ? 'owner' : 'member',
              active: true
            });
          }
        }
      }

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

          // Check if exists in local
          const localInv = await system.db
            .select()
            .from(inviteLocal)
            .where(eq(inviteLocal.id, notificationId))
            .limit(1);

          if (localInv.length > 0) {
            await system.db
              .update(inviteLocal)
              .set({
                status: 'declined',
                last_updated: new Date().toISOString()
              })
              .where(eq(inviteLocal.id, notificationId));
          } else {
            await system.db.insert(inviteLocal).values({
              id: inv.id,
              sender_profile_id: inv.sender_profile_id,
              receiver_profile_id: inv.receiver_profile_id,
              project_id: inv.project_id,
              email: inv.email,
              as_owner: inv.as_owner,
              status: 'declined',
              count: inv.count,
              last_updated: new Date().toISOString(),
              created_at: inv.created_at,
              active: inv.active
            });
          }
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

          // Check if exists in local
          const localReq = await system.db
            .select()
            .from(requestLocal)
            .where(eq(requestLocal.id, notificationId))
            .limit(1);

          if (localReq.length > 0) {
            await system.db
              .update(requestLocal)
              .set({
                status: 'declined',
                count: newCount,
                last_updated: new Date().toISOString()
              })
              .where(eq(requestLocal.id, notificationId));
          } else {
            await system.db.insert(requestLocal).values({
              id: currentRequest.id,
              sender_profile_id: currentRequest.sender_profile_id,
              project_id: currentRequest.project_id,
              status: 'declined',
              count: newCount,
              last_updated: new Date().toISOString(),
              created_at: currentRequest.created_at,
              active: currentRequest.active
            });
          }
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
                    <Icon as={CheckIcon} />
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
      <Text className="text-2xl font-bold">{t('settings')}</Text>

      {!isConnected && (
        <Alert icon={WifiIcon}>
          <AlertTitle>{t('offlineNotificationMessage')}</AlertTitle>
        </Alert>
      )}

      <View className="flex-1 flex-col gap-4">
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
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
