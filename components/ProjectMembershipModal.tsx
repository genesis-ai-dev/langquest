import { PrivateAccessGate } from '@/components/PrivateAccessGate';
import { useAuth } from '@/contexts/AuthContext';
import {
  invite,
  profile_project_link,
  project as projectTable
} from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useTranslation } from '@/hooks/useTranslation';
import {
  borderRadius,
  colors,
  fontSizes,
  sharedStyles,
  spacing
} from '@/styles/theme';
import { isInvitationExpired, shouldHideInvitation } from '@/utils/dateUtils';
import { Ionicons } from '@expo/vector-icons';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useQuery } from '@powersync/tanstack-react-query';
import { and, eq } from 'drizzle-orm';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';

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
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'members' | 'invited'>('members');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteAsOwner, setInviteAsOwner] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Query for project details to check if it's private
  const { data: [project] = [], isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    query: toCompilableQuery(
      db.query.project.findFirst({
        where: eq(projectTable.id, projectId)
      })
    )
  });

  // Query for active project members
  const { data: memberData = [], refetch: refetchMembers } = useQuery({
    queryKey: ['project-members', projectId],
    query: toCompilableQuery(
      db.query.profile_project_link.findMany({
        where: and(
          eq(profile_project_link.project_id, projectId),
          eq(profile_project_link.active, true)
        ),
        with: {
          profile: true
        }
      })
    )
  });

  const members: Member[] = memberData.map((link) => ({
    id: link.profile.id,
    email: link.profile.email || '',
    name: link.profile.username || link.profile.email || '',
    role: link.membership as 'owner' | 'member',
    active: true
  }));

  // Sort members: current user first, then owners alphabetically, then members alphabetically
  const sortedMembers = [...members].sort((a, b) => {
    // Current user always comes first
    if (a.id === currentUser?.id) return -1;
    if (b.id === currentUser?.id) return 1;

    // Then sort by role (owners before members)
    if (a.role !== b.role) {
      if (a.role === 'owner') return -1;
      if (b.role === 'owner') return 1;
    }

    // Within same role, sort alphabetically by name
    return a.name.localeCompare(b.name);
  });

  console.log('members', members);

  // Query for invited users
  const { data: invitationData = [], refetch: refetchInvitations } = useQuery({
    queryKey: ['project-invitations', projectId],
    query: toCompilableQuery(
      db.query.invite.findMany({
        where: and(
          eq(invite.project_id, projectId)
          // Include pending, expired, declined, and withdrawn statuses
        ),
        with: {
          receiver: true
        }
      })
    )
  });

  const invitations: Invitation[] = invitationData
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

  // Filter invitations based on visibility rules
  const visibleInvitations = invitations.filter((inv) => {
    if (shouldHideInvitation(inv.status, inv.last_updated, inv.created_at)) {
      return false;
    }
    // Update status to expired if needed
    if (inv.status === 'pending' && isInvitationExpired(inv.created_at)) {
      inv.status = 'expired';
    }
    return true;
  });

  // Check if current user is an owner
  const currentUserMembership = members.find((m) => m.id === currentUser?.id);
  const currentUserIsOwner = currentUserMembership?.role === 'owner';

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
                  .update(profile_project_link)
                  .set({
                    active: false,
                    last_updated: new Date().toISOString()
                  })
                  .where(
                    and(
                      eq(profile_project_link.profile_id, memberId),
                      eq(profile_project_link.project_id, projectId)
                    )
                  );
                void refetchMembers();
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
                  .update(profile_project_link)
                  .set({
                    membership: 'owner',
                    last_updated: new Date().toISOString()
                  })
                  .where(
                    and(
                      eq(profile_project_link.profile_id, memberId),
                      eq(profile_project_link.project_id, projectId)
                    )
                  );
                void refetchMembers();
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
    console.log('Attempting to leave project');
    if (activeOwnerCount <= 1 && currentUserIsOwner) {
      Alert.alert(t('error'), t('cannotLeaveAsOnlyOwner'));
      return;
    }

    Alert.alert(t('confirmLeave'), t('confirmLeaveMessage'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('confirm'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            console.log('Leaving project');
            try {
              await db
                .update(profile_project_link)
                .set({ active: false, last_updated: new Date().toISOString() })
                .where(
                  and(
                    eq(profile_project_link.profile_id, currentUser!.id),
                    eq(profile_project_link.project_id, projectId)
                  )
                );
              console.log('Project left');
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
    try {
      // Find the invitation first
      const invitation = invitations.find((i) => i.id === inviteId);

      await db
        .update(invite)
        .set({ status: 'withdrawn', last_updated: new Date().toISOString() })
        .where(eq(invite.id, inviteId));

      // Also deactivate any profile_project_link if exists
      if (invitation?.receiver_profile_id) {
        await db
          .update(profile_project_link)
          .set({ active: false, last_updated: new Date().toISOString() })
          .where(
            and(
              eq(
                profile_project_link.profile_id,
                invitation.receiver_profile_id
              ),
              eq(profile_project_link.project_id, projectId)
            )
          );
      }
      void refetchInvitations();
    } catch (error) {
      console.error('Error withdrawing invitation:', error);
      Alert.alert(t('error'), t('failedToWithdrawInvitation'));
    }
  };

  const handleResendInvitation = async (inviteId: string) => {
    try {
      // Find the invitation first
      const invitation = invitations.find((i) => i.id === inviteId);
      if (!invitation) return;

      const MAX_INVITE_ATTEMPTS = 3;

      // Check if we can re-invite
      if ((invitation.count || 0) < MAX_INVITE_ATTEMPTS) {
        // Update existing invitation to pending and increment count
        await db
          .update(invite)
          .set({
            status: 'pending',
            count: (invitation.count || 0) + 1,
            last_updated: new Date().toISOString(),
            sender_profile_id: currentUser!.id // Update sender in case it's different
          })
          .where(eq(invite.id, inviteId));

        void refetchInvitations();
        Alert.alert(t('success'), t('invitationResent'));
      } else {
        Alert.alert(
          t('error'),
          'Maximum invitation attempts reached for this email address.'
        );
      }
    } catch (error) {
      console.error('Error resending invitation:', error);
      Alert.alert(t('error'), t('failedToResendInvitation'));
    }
  };

  const handleSendInvitation = async () => {
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
          `This email address is already a ${existingMember.role} of this project.`
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
        const MAX_INVITE_ATTEMPTS = 5; // Configure max attempts as needed

        // Check if the invitee has an inactive profile_project_link
        let hasInactiveLink = false;
        if (existingInvite.receiver_profile_id) {
          const profileLinks = await db.query.profile_project_link.findMany({
            where: and(
              eq(
                profile_project_link.profile_id,
                existingInvite.receiver_profile_id
              ),
              eq(profile_project_link.project_id, projectId)
            )
          });
          hasInactiveLink =
            profileLinks.some((link) => link.active === false) ||
            profileLinks.length === 0;
        }

        // Check if we can re-invite
        if (
          ['declined', 'withdrawn', 'expired'].includes(
            existingInvite.status
          ) ||
          hasInactiveLink
        ) {
          if ((existingInvite.count || 0) < MAX_INVITE_ATTEMPTS) {
            // Update existing invitation
            await db
              .update(invite)
              .set({
                status: 'pending',
                as_owner: inviteAsOwner,
                count: (existingInvite.count || 0) + 1,
                last_updated: new Date().toISOString(),
                sender_profile_id: currentUser!.id // Update sender in case it's different
              })
              .where(eq(invite.id, existingInvite.id));

            setInviteEmail('');
            setInviteAsOwner(false);
            void refetchInvitations();
            Alert.alert(t('success'), t('invitationResent'));
            return;
          } else {
            Alert.alert(
              t('error'),
              'Maximum invitation attempts reached for this email address.'
            );
            setIsSubmitting(false);
            return;
          }
        } else {
          // Invitation is still pending or in another active state
          Alert.alert(
            t('error'),
            'An invitation has already been sent to this email address.'
          );
          setIsSubmitting(false);
          return;
        }
      }

      // Create new invitation
      await db.insert(invite).values({
        sender_profile_id: currentUser!.id,
        email: inviteEmail,
        project_id: projectId,
        status: 'pending',
        as_owner: inviteAsOwner,
        count: 1
      });

      setInviteEmail('');
      setInviteAsOwner(false);
      void refetchInvitations();
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
    const isCurrentUser = member.id === currentUser?.id;

    return (
      <View key={member.id} style={styles.memberItem}>
        <View style={styles.memberInfo}>
          <View style={styles.memberAvatar}>
            <Text style={styles.memberAvatarText}>
              {(member.name || member.email).charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.memberDetails}>
            <View style={styles.memberNameRow}>
              <Text style={styles.memberName}>
                {member.name || member.email} {isCurrentUser && `(${t('you')})`}
              </Text>
              {member.role === 'owner' ? (
                <Ionicons name="ribbon" size={16} color={colors.primary} />
              ) : (
                <Ionicons
                  name="person"
                  size={16}
                  color={colors.textSecondary}
                />
              )}
            </View>
            <Text style={styles.memberEmail}>{member.email}</Text>
          </View>
        </View>

        <View style={styles.memberActions}>
          {currentUserIsOwner && !isCurrentUser && (
            <>
              {member.role === 'member' && (
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={() =>
                    handlePromoteToOwner(member.id, member.name || member.email)
                  }
                >
                  <Ionicons
                    name="ribbon-outline"
                    size={20}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              )}
              {member.role === 'member' && (
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={() =>
                    handleRemoveMember(member.id, member.name || member.email)
                  }
                >
                  <Ionicons
                    name="trash-outline"
                    size={20}
                    color={colors.error}
                  />
                </TouchableOpacity>
              )}
            </>
          )}
          {isCurrentUser && (
            <TouchableOpacity
              style={styles.iconButton}
              onPress={handleLeaveProject}
            >
              <Ionicons name="exit-outline" size={20} color={colors.error} />
            </TouchableOpacity>
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

    const getStatusColor = (status: string) => {
      switch (status) {
        case 'pending':
          return colors.primaryLight;
        case 'expired':
        case 'declined':
        case 'withdrawn':
          return colors.disabled;
        default:
          return colors.backgroundSecondary;
      }
    };

    return (
      <View key={invitation.id} style={styles.memberItem}>
        <View style={styles.memberInfo}>
          <View style={styles.memberAvatar}>
            <Text style={styles.memberAvatarText}>
              {invitation.email.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.memberDetails}>
            <View style={styles.memberNameRow}>
              <Text style={styles.memberName}>{invitation.email}</Text>
              {invitation.role === 'owner' && (
                <Ionicons name="ribbon" size={16} color={colors.primary} />
              )}
            </View>
            <View
              style={[
                styles.invitedTag,
                { backgroundColor: getStatusColor(invitation.status) }
              ]}
            >
              <Text style={styles.invitedTagText}>
                {getStatusDisplay(invitation.status)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.memberActions}>
          {currentUserIsOwner && invitation.status === 'expired' && (
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => void handleResendInvitation(invitation.id)}
            >
              <Ionicons
                name="refresh-outline"
                size={20}
                color={colors.primary}
              />
            </TouchableOpacity>
          )}
          {currentUserIsOwner && invitation.status !== 'withdrawn' && (
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => void handleWithdrawInvitation(invitation.id)}
            >
              <Ionicons
                name="close-circle-outline"
                size={20}
                color={colors.error}
              />
            </TouchableOpacity>
          )}
        </View>
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
        <TouchableWithoutFeedback onPress={onClose}>
          <Pressable style={sharedStyles.modalOverlay} onPress={onClose}>
            <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
              <View style={[sharedStyles.modal, styles.modalContainer]}>
                <View style={styles.header}>
                  <Text style={sharedStyles.modalTitle}>
                    {t('projectMembers')}
                  </Text>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={onClose}
                  >
                    <Ionicons name="close" size={24} color={colors.text} />
                  </TouchableOpacity>
                </View>

                {projectLoading ? (
                  <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>
                      Loading project details...
                    </Text>
                  </View>
                ) : (
                  <PrivateAccessGate
                    projectId={projectId}
                    projectName={project?.name || ''}
                    isPrivate={true}
                    action="view-members"
                    inline={true}
                  >
                    <View style={styles.tabContainer}>
                      <TouchableOpacity
                        style={[
                          styles.tab,
                          activeTab === 'members' && styles.activeTab
                        ]}
                        onPress={() => setActiveTab('members')}
                      >
                        <Text
                          style={[
                            styles.tabText,
                            activeTab === 'members' && styles.activeTabText
                          ]}
                        >
                          {t('members')} ({sortedMembers.length})
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.tab,
                          activeTab === 'invited' && styles.activeTab
                        ]}
                        onPress={() => setActiveTab('invited')}
                      >
                        <Text
                          style={[
                            styles.tabText,
                            activeTab === 'invited' && styles.activeTabText
                          ]}
                        >
                          {t('invited')} ({visibleInvitations.length})
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.membersList}>
                      {activeTab === 'members' ? (
                        sortedMembers.length > 0 ? (
                          sortedMembers.map(renderMember)
                        ) : (
                          <Text style={styles.emptyText}>{t('noMembers')}</Text>
                        )
                      ) : visibleInvitations.length > 0 ? (
                        visibleInvitations.map(renderInvitation)
                      ) : (
                        <Text style={styles.emptyText}>
                          {t('noInvitations')}
                        </Text>
                      )}
                    </ScrollView>

                    <View style={styles.inviteSection}>
                      {currentUserIsOwner ? (
                        <>
                          <Text style={styles.inviteTitle}>
                            {t('inviteMembers')}
                          </Text>
                          <TextInput
                            style={styles.input}
                            placeholder={t('email')}
                            placeholderTextColor={colors.textSecondary}
                            value={inviteEmail}
                            onChangeText={setInviteEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                          />
                          <View style={styles.checkboxContainer}>
                            <TouchableOpacity
                              style={styles.checkboxRow}
                              onPress={() => setInviteAsOwner(!inviteAsOwner)}
                            >
                              <View
                                style={[
                                  styles.checkbox,
                                  inviteAsOwner && styles.checkboxChecked
                                ]}
                              >
                                {inviteAsOwner && (
                                  <Ionicons
                                    name="checkmark"
                                    size={16}
                                    color={colors.buttonText}
                                  />
                                )}
                              </View>
                              <Text style={styles.checkboxLabel}>
                                {t('inviteAsOwner')}
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.tooltipButton}
                              onPress={() => setShowTooltip(!showTooltip)}
                            >
                              <Ionicons
                                name="help-circle-outline"
                                size={20}
                                color={colors.primary}
                              />
                            </TouchableOpacity>
                          </View>
                          {showTooltip && (
                            <View style={styles.tooltip}>
                              <Text style={styles.tooltipText}>
                                {t('ownerTooltip')}
                              </Text>
                            </View>
                          )}
                          <TouchableOpacity
                            style={[
                              sharedStyles.button,
                              !isInviteButtonEnabled &&
                                styles.inviteButtonDisabled
                            ]}
                            onPress={handleSendInvitation}
                            disabled={!isInviteButtonEnabled || isSubmitting}
                          >
                            <Text style={sharedStyles.buttonText}>
                              {isSubmitting
                                ? t('sending')
                                : t('sendInvitation')}
                            </Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        <View style={styles.ownerOnlyMessage}>
                          <Ionicons
                            name="ribbon"
                            size={24}
                            color={colors.textSecondary}
                          />
                          <Text style={styles.ownerOnlyText}>
                            Only project owners can invite new members
                          </Text>
                        </View>
                      )}
                    </View>
                  </PrivateAccessGate>
                )}
              </View>
            </TouchableWithoutFeedback>
          </Pressable>
        </TouchableWithoutFeedback>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    width: '90%',
    maxHeight: '85%'
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
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.inputBorder,
    marginBottom: spacing.small
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.medium,
    alignItems: 'center',
    backgroundColor: 'transparent'
  },
  activeTab: {
    backgroundColor: colors.primaryLight,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary
  },
  tabText: {
    fontSize: fontSizes.medium,
    color: colors.textSecondary
  },
  activeTabText: {
    color: colors.text,
    fontWeight: '600'
  },
  membersList: {
    maxHeight: 300,
    paddingHorizontal: spacing.medium
  },
  memberItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: colors.inputBorder
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.small
  },
  memberAvatarText: {
    color: colors.buttonText,
    fontSize: fontSizes.medium,
    fontWeight: 'bold'
  },
  memberDetails: {
    flex: 1
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xsmall
  },
  memberName: {
    fontSize: fontSizes.medium,
    fontWeight: '600',
    color: colors.text
  },
  memberEmail: {
    fontSize: fontSizes.small,
    color: colors.textSecondary,
    marginTop: 2
  },
  invitedTag: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.xsmall,
    borderRadius: borderRadius.small,
    marginTop: spacing.xsmall,
    alignSelf: 'flex-start'
  },
  invitedTagText: {
    fontSize: fontSizes.xsmall,
    color: colors.text,
    fontWeight: '500'
  },
  memberActions: {
    flexDirection: 'row',
    gap: spacing.xsmall
  },
  iconButton: {
    padding: spacing.xsmall,
    borderRadius: borderRadius.small,
    borderWidth: 1,
    borderColor: colors.inputBorder
  },
  inviteSection: {
    padding: spacing.medium,
    borderTopWidth: 1,
    borderTopColor: colors.inputBorder
  },
  inviteTitle: {
    fontSize: fontSizes.medium,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.small
  },
  input: {
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.medium,
    padding: spacing.small,
    color: colors.text,
    fontSize: fontSizes.medium,
    marginBottom: spacing.small,
    borderWidth: 1,
    borderColor: colors.inputBorder
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.small
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: borderRadius.small,
    marginRight: spacing.xsmall,
    justifyContent: 'center',
    alignItems: 'center'
  },
  checkboxChecked: {
    backgroundColor: colors.primary
  },
  checkboxLabel: {
    fontSize: fontSizes.medium,
    color: colors.text
  },
  tooltipButton: {
    padding: spacing.xsmall
  },
  tooltip: {
    backgroundColor: colors.backgroundSecondary,
    padding: spacing.small,
    borderRadius: borderRadius.small,
    marginBottom: spacing.small
  },
  tooltipText: {
    fontSize: fontSizes.small,
    color: colors.text
  },
  inviteButtonDisabled: {
    backgroundColor: colors.disabled
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: fontSizes.medium,
    paddingVertical: spacing.large
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    fontSize: fontSizes.medium,
    color: colors.text
  },
  ownerOnlyMessage: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.large,
    gap: spacing.small
  },
  ownerOnlyText: {
    fontSize: fontSizes.medium,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20
  }
});
