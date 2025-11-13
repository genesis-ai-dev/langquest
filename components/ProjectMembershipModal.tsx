import { PrivateAccessGate } from '@/components/PrivateAccessGate';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/contexts/AuthContext';
import type { profile, request } from '@/db/drizzleSchema';
import { invite, project as projectTable } from '@/db/drizzleSchema';
import {
  invite_synced,
  profile_project_link_synced,
  request_synced
} from '@/db/drizzleSchemaSynced';
import { system } from '@/db/powersync/system';
import { useLocalization } from '@/hooks/useLocalization';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useHybridData } from '@/views/new/useHybridData';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { and, eq } from 'drizzle-orm';
import {
  CircleCheckIcon,
  CircleXIcon,
  CrownIcon,
  InfoIcon,
  LogOutIcon,
  RefreshCcwIcon,
  Trash2Icon,
  UserIcon,
  XIcon
} from 'lucide-react-native';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View
} from 'react-native';

const MAX_INVITE_ATTEMPTS = 3;

interface ProjectMembershipModalProps {
  isVisible: boolean;
  onClose: () => void;
  projectId: string;
}

interface Member {
  id: string;
  email: string;
  name: string;
  role: 'owner' | 'member';
  active: boolean;
}

interface Invitation {
  id: string;
  email: string;
  name: string;
  role: 'owner' | 'member';
  status: string;
  created_at: string;
  last_updated: string;
  receiver_profile_id: string | null;
  count?: number;
}

// Email validation regex
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const { db } = system;

export const ProjectMembershipModal: React.FC<ProjectMembershipModalProps> = ({
  isVisible,
  onClose,
  projectId
}) => {
  const { t } = useLocalization();
  const { currentUser } = useAuth();

  // Get comprehensive user permissions for this project
  const managePermissions = useUserPermissions(projectId, 'manage');
  const sendInvitePermissions = useUserPermissions(
    projectId,
    'send_invite_section'
  );
  const promotePermissions = useUserPermissions(
    projectId,
    'promote_member_button'
  );
  const removePermissions = useUserPermissions(
    projectId,
    'remove_member_button'
  );
  const withdrawInvitePermissions = useUserPermissions(
    projectId,
    'withdraw_invite_button'
  );

  const [activeTab, setActiveTab] = useState<
    'members' | 'invited' | 'requests'
  >('members');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteAsOwner, setInviteAsOwner] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // All operations on invites, requests, and notifications go through synced tables or Supabase
  // Query for project details to check if it's private
  const { data: projectData, isLoading: projectLoading } = useHybridData<
    typeof projectTable.$inferSelect
  >({
    dataType: 'project-membership',
    queryKeyParams: [projectId],

    // Only offline query - no cloud query needed
    offlineQuery: toCompilableQuery(
      db.query.project.findMany({
        where: eq(projectTable.id, projectId),
        limit: 1
      })
    )
  });

  const project = projectData[0];

  // Query for active project members - get links first
  const { data: memberLinks } = useHybridData<
    typeof profile_project_link_synced.$inferSelect
  >({
    dataType: 'project-member-links',
    queryKeyParams: [projectId],

    // Only offline query - no cloud query needed
    offlineQuery: toCompilableQuery(
      db.query.profile_project_link.findMany({
        where: (table) =>
          and(eq(table.project_id, projectId), eq(table.active, true))
      })
    )
  });

  // Get unique profile IDs from member links
  const profileIds = React.useMemo(() => {
    return [...new Set(memberLinks.map((link) => link.profile_id))];
  }, [memberLinks]);

  // Query for profiles separately
  const { data: profiles } = useHybridData<typeof profile.$inferSelect>({
    dataType: 'member-profiles',
    queryKeyParams: [...profileIds],

    // Only offline query - no cloud query needed
    offlineQuery:
      profileIds.length > 0
        ? toCompilableQuery(
            db.query.profile.findMany({
              where: (profile, { inArray }) => inArray(profile.id, profileIds)
            })
          )
        : 'SELECT * FROM profile WHERE 1=0' // Empty query when no profile IDs
  });

  // Create a map of profile ID to profile for easy lookup
  const profileMap = React.useMemo(() => {
    const map: Record<string, typeof profile.$inferSelect> = {};
    profiles.forEach((p) => {
      map[p.id] = p;
    });
    return map;
  }, [profiles]);

  // Combine the data
  const members: Member[] = React.useMemo(() => {
    return memberLinks
      .map((link) => {
        const profile = profileMap[link.profile_id];
        if (!profile) return null;

        return {
          id: profile.id,
          email: profile.email || '',
          name: profile.username || profile.email || '',
          role: link.membership,
          active: true
        };
      })
      .filter((member): member is Member => member !== null);
  }, [memberLinks, profileMap]);

  // Sort members: current user first, then owners alphabetically, then members alphabetically
  const sortedMembers = [...members].sort((a, b) => {
    if (!currentUser) return 0;

    // Current user always comes first
    if (a.id === currentUser.id) return -1;
    if (b.id === currentUser.id) return 1;

    // Then sort by role (owners before members)
    if (a.role !== b.role) {
      if (a.role === 'owner') return -1;
      if (b.role === 'owner') return 1;
    }

    // Within same role, sort alphabetically by name
    return a.name.localeCompare(b.name);
  });

  // console.log('members', members);

  // Query for invited users - get invites first
  const { data: invites } = useHybridData({
    dataType: 'project-invites',
    queryKeyParams: [projectId],

    // Only offline query - no cloud query needed
    offlineQuery: toCompilableQuery(
      db.query.invite.findMany({
        where: eq(invite.project_id, projectId)
      })
    )
  });

  // Get unique receiver profile IDs from invites
  const receiverProfileIds = React.useMemo(() => {
    return [
      ...new Set(
        invites
          .map((inv) => inv.receiver_profile_id)
          .filter((id): id is string => id !== null)
      )
    ];
  }, [invites]);

  // Query for receiver profiles separately
  const { data: receiverProfiles } = useHybridData<typeof profile.$inferSelect>(
    {
      dataType: 'receiver-profiles',
      queryKeyParams: [...receiverProfileIds],

      // Only offline query - no cloud query needed
      offlineQuery:
        receiverProfileIds.length > 0
          ? toCompilableQuery(
              db.query.profile.findMany({
                where: (profile, { inArray }) =>
                  inArray(profile.id, receiverProfileIds)
              })
            )
          : 'SELECT * FROM profile WHERE 1=0' // Empty query when no receiver IDs
    }
  );

  // Create a map of profile ID to profile for receivers
  const _receiverProfileMap = React.useMemo(() => {
    const map: Record<string, typeof profile.$inferSelect> = {};
    receiverProfiles.forEach((p) => {
      map[p.id] = p;
    });
    return map;
  }, [receiverProfiles]);

  const invitations: Invitation[] = React.useMemo(() => {
    return invites
      .filter((inv) =>
        ['pending', 'expired', 'declined', 'withdrawn'].includes(inv.status)
      )
      .map((inv) => ({
        id: inv.id,
        email: inv.email,
        name: inv.email,
        role: inv.as_owner ? 'owner' : 'member',
        status: inv.status,
        created_at: inv.created_at,
        last_updated: inv.last_updated,
        receiver_profile_id: inv.receiver_profile_id,
        count: inv.count
      }));
  }, [invites]);

  // Query for pending membership requests (owners only)
  const { data: requestsData = [] } = useHybridData({
    dataType: 'project-requests',
    queryKeyParams: [projectId],

    offlineQuery: toCompilableQuery(
      db.query.request.findMany({
        where: (table) =>
          and(
            eq(table.project_id, projectId),
            eq(table.status, 'pending'),
            eq(table.active, true)
          )
      })
    ),

    enableOfflineQuery: sendInvitePermissions.hasAccess // Only fetch if user can manage
  });

  // Get requester profile IDs
  const requesterIds = React.useMemo(() => {
    return [...new Set(requestsData.map((r) => r.sender_profile_id))];
  }, [requestsData]);

  // Query for requester profiles
  const { data: requesterProfiles = [] } = useHybridData<
    typeof profile.$inferSelect
  >({
    dataType: 'requester-profiles',
    queryKeyParams: [...requesterIds],

    offlineQuery:
      requesterIds.length > 0
        ? toCompilableQuery(
            db.query.profile.findMany({
              where: (profile, { inArray }) => inArray(profile.id, requesterIds)
            })
          )
        : 'SELECT * FROM profile WHERE 1=0'
  });

  // Create requester profile map
  const requesterProfileMap = React.useMemo(() => {
    const map: Record<string, typeof profile.$inferSelect> = {};
    requesterProfiles.forEach((p) => {
      map[p.id] = p;
    });
    return map;
  }, [requesterProfiles]);

  // Count active owners
  const activeOwnerCount = members.filter((m) => m.role === 'owner').length;

  const handleRemoveMember = (memberId: string, memberName: string) => {
    Alert.alert(
      t('confirmRemove'),
      t('confirmRemoveMessage', { name: memberName }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('remove'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await db
                  .update(profile_project_link_synced)
                  .set({
                    active: false,
                    membership: 'member', // Demote to member when removed
                    last_updated: new Date().toISOString()
                  })
                  .where(
                    and(
                      eq(profile_project_link_synced.profile_id, memberId),
                      eq(profile_project_link_synced.project_id, projectId)
                    )
                  );
                // void refetchMembers(); // Removed refetch
              } catch (error) {
                console.error('Error removing member:', error);
                Alert.alert(t('error'), t('failedToRemoveMember'));
              }
            })();
          }
        }
      ]
    );
  };

  const handlePromoteToOwner = (memberId: string, memberName: string) => {
    Alert.alert(
      t('confirmPromote'),
      t('confirmPromoteMessage', { name: memberName }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('confirm'),
          onPress: () => {
            void (async () => {
              try {
                await db
                  .update(profile_project_link_synced)
                  .set({
                    membership: 'owner',
                    last_updated: new Date().toISOString()
                  })
                  .where(
                    and(
                      eq(profile_project_link_synced.profile_id, memberId),
                      eq(profile_project_link_synced.project_id, projectId)
                    )
                  );
                // void refetchMembers(); // Removed refetch
              } catch (error) {
                console.error('Error promoting member:', error);
                Alert.alert(t('error'), t('failedToPromoteMember'));
              }
            })();
          }
        }
      ]
    );
  };

  const handleLeaveProject = () => {
    if (activeOwnerCount <= 1 && managePermissions.hasAccess) {
      Alert.alert(t('error'), t('cannotLeaveAsOnlyOwner'));
      return;
    }

    if (!currentUser) {
      return null;
    }

    Alert.alert(t('confirmLeave'), t('confirmLeaveMessage'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('confirm'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await db
                .update(profile_project_link_synced)
                .set({
                  active: false,
                  membership: 'member', // Demote to member when leaving
                  last_updated: new Date().toISOString()
                })
                .where(
                  and(
                    eq(profile_project_link_synced.profile_id, currentUser.id),
                    eq(profile_project_link_synced.project_id, projectId)
                  )
                );
              onClose();
            } catch (error) {
              console.error('Error leaving project:', error);
              Alert.alert(t('error'), t('failedToLeaveProject'));
            }
          })();
        }
      }
    ]);
  };

  const handleWithdrawInvitation = async (inviteId: string) => {
    // Guard clause: Don't render if currentUser is null
    if (!currentUser) {
      return null;
    }

    try {
      // Find the invitation first
      const invitation = invitations.find((i) => i.id === inviteId);

      await db
        .update(invite_synced)
        .set({ status: 'withdrawn', last_updated: new Date().toISOString() })
        .where(eq(invite_synced.id, inviteId));

      // Also deactivate any profile_project_link_synced if exists
      if (invitation?.receiver_profile_id) {
        await db
          .update(profile_project_link_synced)
          .set({ active: false, last_updated: new Date().toISOString() })
          .where(
            and(
              eq(
                profile_project_link_synced.profile_id,
                invitation.receiver_profile_id
              ),
              eq(profile_project_link_synced.project_id, projectId)
            )
          );
      }
      // void refetchInvitations(); // Removed refetch
    } catch (error) {
      console.error('Error withdrawing invitation:', error);
      Alert.alert(t('error'), t('failedToWithdrawInvitation'));
    }
  };

  const handleResendInvitation = async (inviteId: string) => {
    // Guard clause: Don't render if currentUser is null
    if (!currentUser) {
      return null;
    }

    try {
      // Find the invitation first
      const invitation = invitations.find((i) => i.id === inviteId);
      if (!invitation) return;

      // Check if we can re-invite
      if ((invitation.count || 0) < MAX_INVITE_ATTEMPTS) {
        // Update existing invitation to pending and increment count
        await db
          .update(invite_synced)
          .set({
            status: 'pending',
            count: (invitation.count || 0) + 1,
            last_updated: new Date().toISOString(),
            sender_profile_id: currentUser.id // Update sender in case it's different
          })
          .where(eq(invite_synced.id, inviteId));

        // void refetchInvitations(); // Removed refetch
        Alert.alert(t('success'), t('invitationResent'));
      } else {
        Alert.alert(t('error'), t('maxInviteAttemptsReached'));
      }
    } catch (error) {
      console.error('Error resending invitation:', error);
      Alert.alert(t('error'), t('failedToResendInvitation'));
    }
  };

  const handleApproveRequest = (
    requestId: string,
    senderId: string,
    senderName: string
  ) => {
    Alert.alert(
      t('confirmApprove'),
      t('confirmApproveMessage', { name: senderName }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('confirm'),
          onPress: () => {
            void (async () => {
              setIsSubmitting(true);
              try {
                // Update request status to accepted
                await db
                  .update(request_synced)
                  .set({
                    status: 'accepted',
                    last_updated: new Date().toISOString()
                  })
                  .where(eq(request_synced.id, requestId));

                // Create or update profile_project_link_synced
                const existingLink = await db
                  .select()
                  .from(profile_project_link_synced)
                  .where(
                    and(
                      eq(profile_project_link_synced.profile_id, senderId),
                      eq(profile_project_link_synced.project_id, projectId)
                    )
                  );

                if (existingLink.length > 0) {
                  await db
                    .update(profile_project_link_synced)
                    .set({
                      active: true,
                      membership: 'member',
                      last_updated: new Date().toISOString()
                    })
                    .where(
                      and(
                        eq(profile_project_link_synced.profile_id, senderId),
                        eq(profile_project_link_synced.project_id, projectId)
                      )
                    );
                } else {
                  await db.insert(profile_project_link_synced).values({
                    id: `${senderId}_${projectId}`,
                    profile_id: senderId,
                    project_id: projectId,
                    membership: 'member',
                    active: true
                  });
                }

                Alert.alert(t('success'), t('requestApproved'));
              } catch (error) {
                console.error('Error approving request:', error);
                Alert.alert(t('error'), t('failedToApproveRequest'));
              } finally {
                setIsSubmitting(false);
              }
            })();
          }
        }
      ]
    );
  };

  const handleDenyRequest = (requestId: string, senderName: string) => {
    Alert.alert(
      t('confirmDeny'),
      t('confirmDenyMessage', { name: senderName }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('confirm'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setIsSubmitting(true);
              try {
                await db
                  .update(request_synced)
                  .set({
                    status: 'declined',
                    last_updated: new Date().toISOString()
                  })
                  .where(eq(request_synced.id, requestId));

                Alert.alert(t('success'), t('requestDenied'));
              } catch (error) {
                console.error('Error denying request:', error);
                Alert.alert(t('error'), t('failedToDenyRequest'));
              } finally {
                setIsSubmitting(false);
              }
            })();
          }
        }
      ]
    );
  };

  const handleSendInvitation = async () => {
    // Guard clause: Don't render if currentUser is null
    if (!currentUser) {
      return null;
    }

    if (!isValidEmail(inviteEmail)) {
      Alert.alert(t('error'), t('enterValidEmail'));
      return;
    }

    setIsSubmitting(true);
    try {
      // Check if the email belongs to an existing member/owner
      const existingMember = sortedMembers.find(
        (member) => member.email.toLowerCase() === inviteEmail.toLowerCase()
      );

      if (existingMember) {
        Alert.alert(
          t('error'),
          t('emailAlreadyMemberMessage', { role: t(existingMember.role) })
        );
        setIsSubmitting(false);
        return;
      }

      // Check for any existing invitation (including declined, withdrawn, expired)
      const existingInvites = await db.query.invite.findMany({
        where: and(
          eq(invite.email, inviteEmail),
          eq(invite.project_id, projectId)
        ),
        with: {
          receiver: true
        }
      });
      const existingInvite = existingInvites[0];

      if (existingInvite) {
        // Check if the invitee has an inactive profile_project_link_synced
        let hasInactiveLink = false;
        if (existingInvite.receiver_profile_id) {
          const profileLinks = await db.query.profile_project_link.findMany({
            where: (table) =>
              and(
                eq(table.profile_id, existingInvite.receiver_profile_id!),
                eq(table.project_id, projectId)
              )
          });
          hasInactiveLink =
            profileLinks.some((link) => !link.active) ||
            profileLinks.length === 0;
        }

        // Check if we can re-invite
        if (
          ['declined', 'withdrawn', 'expired'].includes(
            existingInvite.status
          ) ||
          (existingInvite.status === 'accepted' && hasInactiveLink) // Allow reinvitation if user was removed after accepting
        ) {
          if ((existingInvite.count || 0) < MAX_INVITE_ATTEMPTS) {
            // Update existing invitation
            // Only increment count if previous invite was declined (user actively rejected)
            // Don't count: accepted+inactive (successful then removed), withdrawn (sender cancelled), expired (timed out)
            const newCount =
              existingInvite.status === 'declined'
                ? (existingInvite.count || 0) + 1
                : existingInvite.count || 0;

            await db
              .update(invite_synced)
              .set({
                status: 'pending',
                as_owner: inviteAsOwner,
                count: newCount,
                last_updated: new Date().toISOString(),
                sender_profile_id: currentUser.id // Update sender in case it's different
              })
              .where(eq(invite_synced.id, existingInvite.id));

            setInviteEmail('');
            setInviteAsOwner(false);
            // void refetchInvitations(); // Removed refetch
            Alert.alert(t('success'), t('invitationResent'));
            return;
          } else {
            Alert.alert(t('error'), t('maxInviteAttemptsReached'));
            setIsSubmitting(false);
            return;
          }
        } else {
          // Invitation is still pending or in another active state
          Alert.alert(t('error'), t('invitationAlreadySent'));
          setIsSubmitting(false);
          return;
        }
      }

      // Create new invitation
      await db.insert(invite_synced).values({
        sender_profile_id: currentUser.id,
        email: inviteEmail,
        project_id: projectId,
        status: 'pending',
        as_owner: inviteAsOwner,
        count: 1
      });

      setInviteEmail('');
      setInviteAsOwner(false);
      // void refetchInvitations(); // Removed refetch
      Alert.alert(t('success'), t('invitationSent'));
    } catch (error) {
      console.error('Error sending invitation:', error);
      Alert.alert(
        t('error'),
        error instanceof Error ? error.message : t('failedToSendInvitation')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderMember = (member: Member) => {
    // Guard clause: Don't render if currentUser is null
    if (!currentUser) {
      return null;
    }

    const isCurrentUser = member.id === currentUser.id;

    return (
      <View
        key={member.id}
        className="flex-row items-center justify-between border-b border-border py-3"
      >
        <View className="flex-1 flex-row items-center">
          <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-primary">
            <Text className="font-semibold text-primary-foreground">
              {(member.name || member.email).charAt(0).toUpperCase()}
            </Text>
          </View>
          <View className="flex-1">
            <View className="flex-row items-center gap-1">
              <Text variant="large" className="font-semibold">
                {member.name || member.email} {isCurrentUser && `(${t('you')})`}
              </Text>
              {member.role === 'owner' ? (
                <Icon as={CrownIcon} size={16} className="text-primary" />
              ) : (
                <Icon
                  as={UserIcon}
                  size={16}
                  className="text-muted-foreground"
                />
              )}
            </View>
            <Text variant="small" className="mt-0.5 text-muted-foreground">
              {member.email}
            </Text>
          </View>
        </View>

        <View className="flex-row gap-1">
          {!isCurrentUser && (
            <>
              {member.role === 'member' && promotePermissions.hasAccess && (
                <Button
                  variant="outline"
                  size="icon-sm"
                  onPress={() =>
                    handlePromoteToOwner(member.id, member.name || member.email)
                  }
                >
                  <Icon as={CrownIcon} size={20} className="text-primary" />
                </Button>
              )}
              {member.role === 'member' && removePermissions.hasAccess && (
                <Button
                  variant="outline"
                  size="icon-sm"
                  onPress={() =>
                    handleRemoveMember(member.id, member.name || member.email)
                  }
                >
                  <Icon
                    as={Trash2Icon}
                    size={20}
                    className="text-destructive"
                  />
                </Button>
              )}
            </>
          )}
          {isCurrentUser && (
            <Button
              variant="outline"
              size="icon-sm"
              onPress={handleLeaveProject}
            >
              <Icon as={LogOutIcon} size={20} className="text-destructive" />
            </Button>
          )}
        </View>
      </View>
    );
  };

  const renderInvitation = (invitation: Invitation) => {
    const getStatusDisplay = (status: string) => {
      switch (status) {
        case 'pending':
          return t('pendingInvitation');
        case 'expired':
          return t('expiredInvitation');
        case 'declined':
          return t('declinedInvitation');
        case 'withdrawn':
          return t('withdrawnInvitation');
        default:
          return status;
      }
    };

    const getStatusVariant = (
      status: string
    ): 'default' | 'secondary' | 'destructive' | 'outline' => {
      switch (status) {
        case 'pending':
          return 'default';
        case 'expired':
        case 'declined':
        case 'withdrawn':
          return 'secondary';
        default:
          return 'outline';
      }
    };

    return (
      <View
        key={invitation.id}
        className="flex-row items-center justify-between border-b border-border py-3"
      >
        <View className="flex-1 flex-row items-center">
          <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-primary">
            <Text className="font-semibold text-primary-foreground">
              {invitation.email.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View className="flex-1">
            <View className="flex-row items-center gap-1">
              <Text variant="large" className="font-semibold">
                {invitation.email}
              </Text>
              {invitation.role === 'owner' && (
                <Icon as={CrownIcon} size={16} className="text-primary" />
              )}
            </View>
            <Badge
              variant={getStatusVariant(invitation.status)}
              className="mt-1 self-start"
            >
              <Text variant="small">{getStatusDisplay(invitation.status)}</Text>
            </Badge>
          </View>
        </View>

        <View className="flex-row gap-1">
          {withdrawInvitePermissions.hasAccess &&
            invitation.status === 'expired' && (
              <Button
                variant="outline"
                size="icon-sm"
                onPress={() => void handleResendInvitation(invitation.id)}
              >
                <Icon as={RefreshCcwIcon} size={20} className="text-primary" />
              </Button>
            )}
          {withdrawInvitePermissions.hasAccess &&
            invitation.status === 'pending' && (
              <Button
                variant="outline"
                size="icon-sm"
                onPress={() => void handleWithdrawInvitation(invitation.id)}
              >
                <Icon as={CircleXIcon} size={20} className="text-destructive" />
              </Button>
            )}
        </View>
      </View>
    );
  };

  const renderRequest = (req: typeof request.$inferSelect) => {
    const requester = requesterProfileMap[req.sender_profile_id];
    if (!requester) return null;

    return (
      <View
        key={req.id}
        className="flex-row items-center justify-between border-b border-border py-3"
      >
        <View className="flex-1 flex-row items-center">
          <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-primary">
            <Text className="font-semibold text-primary-foreground">
              {(requester.username || requester.email || '?')
                .charAt(0)
                .toUpperCase()}
            </Text>
          </View>
          <View className="flex-1">
            <Text variant="large" className="font-semibold">
              {requester.username || requester.email}
            </Text>
            {requester.email && (
              <Text variant="small" className="mt-0.5 text-muted-foreground">
                {requester.email}
              </Text>
            )}
          </View>
        </View>

        {sendInvitePermissions.hasAccess && (
          <View className="flex-row gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onPress={() =>
                handleApproveRequest(
                  req.id,
                  req.sender_profile_id,
                  requester.username || requester.email || ''
                )
              }
            >
              <Icon as={CircleCheckIcon} size={20} className="text-green-600" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onPress={() =>
                handleDenyRequest(
                  req.id,
                  requester.username || requester.email || ''
                )
              }
            >
              <Icon as={CircleXIcon} size={20} className="text-destructive" />
            </Button>
          </View>
        )}
      </View>
    );
  };

  const isInviteButtonEnabled = inviteEmail.trim() && isValidEmail(inviteEmail);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Modal
        visible={isVisible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <View className="flex-1 items-center justify-center bg-black/50">
          <View className="h-[70%] max-h-[600px] w-[95%] rounded-lg bg-background px-4 py-6">
            <View className="mb-4 flex-row items-center justify-between">
              <Text variant="h3">{t('projectMembers')}</Text>
              <Pressable className="p-1" onPress={onClose}>
                <Icon as={XIcon} size={24} className="text-foreground" />
              </Pressable>
            </View>

            <View className="flex-1 overflow-hidden">
              {projectLoading ? (
                <View className="flex-1 items-center justify-center">
                  <Text>{t('loadingProjectDetails')}</Text>
                </View>
              ) : (
                <PrivateAccessGate
                  projectId={projectId}
                  projectName={project?.name || ''}
                  isPrivate={project?.private || false}
                  action="view_membership"
                  inline={true}
                >
                  {/* Tabs Header */}
                  <Tabs
                    value={activeTab}
                    onValueChange={(value) =>
                      setActiveTab(value as 'members' | 'invited' | 'requests')
                    }
                  >
                    <TabsList className="mb-2 w-full">
                      <TabsTrigger value="members" className="min-w-0 flex-1">
                        <Text
                          variant="small"
                          numberOfLines={1}
                          className="truncate"
                        >
                          {t('members')} ({sortedMembers.length})
                        </Text>
                      </TabsTrigger>
                      <TabsTrigger value="invited" className="min-w-0 flex-1">
                        <Text
                          variant="small"
                          numberOfLines={1}
                          className="truncate"
                        >
                          {t('invited')} ({invitations.length})
                        </Text>
                      </TabsTrigger>
                      {sendInvitePermissions.hasAccess && (
                        <TabsTrigger
                          value="requests"
                          className="min-w-0 flex-1"
                        >
                          <Text
                            variant="small"
                            numberOfLines={1}
                            className="truncate"
                          >
                            {t('requests')} ({requestsData.length})
                          </Text>
                        </TabsTrigger>
                      )}
                    </TabsList>
                  </Tabs>

                  {/* Tab Content - Manual switching for better control */}
                  <View className="min-h-0 flex-1">
                    {activeTab === 'members' && (
                      <ScrollView
                        className="flex-1"
                        contentContainerStyle={{
                          paddingBottom: 16,
                          paddingHorizontal: 8
                        }}
                        showsVerticalScrollIndicator={true}
                        keyboardShouldPersistTaps="handled"
                      >
                        {sortedMembers.length > 0 ? (
                          sortedMembers.map(renderMember)
                        ) : (
                          <Text className="py-6 text-center text-muted-foreground">
                            {t('noMembers')}
                          </Text>
                        )}
                      </ScrollView>
                    )}

                    {activeTab === 'invited' && (
                      <ScrollView
                        className="flex-1"
                        contentContainerStyle={{
                          paddingBottom: 16,
                          paddingHorizontal: 8
                        }}
                        showsVerticalScrollIndicator={true}
                        keyboardShouldPersistTaps="handled"
                      >
                        {invitations.length > 0 ? (
                          invitations.map(renderInvitation)
                        ) : (
                          <Text className="py-6 text-center text-muted-foreground">
                            {t('noInvitations')}
                          </Text>
                        )}
                      </ScrollView>
                    )}

                    {activeTab === 'requests' && (
                      <ScrollView
                        className="flex-1"
                        contentContainerStyle={{
                          paddingBottom: 16,
                          paddingHorizontal: 8
                        }}
                        showsVerticalScrollIndicator={true}
                        keyboardShouldPersistTaps="handled"
                      >
                        {requestsData.length > 0 ? (
                          requestsData.map(renderRequest)
                        ) : (
                          <Text className="py-6 text-center text-muted-foreground">
                            {t('noPendingRequests')}
                          </Text>
                        )}
                      </ScrollView>
                    )}
                  </View>

                  {/* Invite Section */}
                  <View className="border-t border-border px-4 py-4">
                    {sendInvitePermissions.hasAccess ? (
                      <>
                        <Text variant="large" className="mb-2">
                          {t('inviteMembers')}
                        </Text>
                        <Input
                          placeholder={t('email')}
                          value={inviteEmail}
                          onChangeText={setInviteEmail}
                          keyboardType="email-address"
                          autoCapitalize="none"
                          className="mb-2"
                        />
                        <View className="mb-2 flex-row items-center justify-between">
                          <Pressable
                            className="flex-row items-center"
                            onPress={() => setInviteAsOwner(!inviteAsOwner)}
                          >
                            <Checkbox
                              checked={inviteAsOwner}
                              onCheckedChange={setInviteAsOwner}
                            />
                            <Label className="ml-2">{t('inviteAsOwner')}</Label>
                          </Pressable>
                          <Pressable
                            className="p-1"
                            onPress={() => setShowTooltip(!showTooltip)}
                          >
                            <Icon
                              as={InfoIcon}
                              size={20}
                              className="text-primary"
                            />
                          </Pressable>
                        </View>
                        {showTooltip && (
                          <View className="mb-2 rounded-md bg-muted p-2">
                            <Text variant="small">{t('ownerTooltip')}</Text>
                          </View>
                        )}
                        <Button
                          onPress={handleSendInvitation}
                          disabled={!isInviteButtonEnabled || isSubmitting}
                          loading={isSubmitting}
                        >
                          <Text>
                            {isSubmitting ? t('sending') : t('sendInvitation')}
                          </Text>
                        </Button>
                      </>
                    ) : (
                      <View className="items-center justify-center gap-2 py-6">
                        <Icon
                          as={CrownIcon}
                          size={24}
                          className="text-muted-foreground"
                        />
                        <Text className="text-center leading-5 text-muted-foreground">
                          {t('onlyOwnersCanInvite')}
                        </Text>
                      </View>
                    )}
                  </View>
                </PrivateAccessGate>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};
