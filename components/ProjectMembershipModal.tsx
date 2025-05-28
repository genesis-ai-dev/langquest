import { useAuth } from '@/contexts/AuthContext';
import { invite_request, profile_project_link } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useTranslation } from '@/hooks/useTranslation';
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
}

interface ProfileProjectLink {
  id: string;
  profile_id: string;
  project_id: string;
  membership: string;
  active: boolean;
}

// Email validation regex
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Helper function to check if invitation is expired (7 days)
const isInvitationExpired = (createdAt: string): boolean => {
  const createdDate = new Date(createdAt);
  const now = new Date();
  const daysDiff =
    (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
  return daysDiff > 7;
};

// Helper function to check if invitation should be hidden (3 days after expiry/decline)
const shouldHideInvitation = (
  status: string,
  lastUpdated: string,
  createdAt: string
): boolean => {
  if (status === 'declined' || isInvitationExpired(createdAt)) {
    const updatedDate = new Date(lastUpdated);
    const now = new Date();
    const daysDiff =
      (now.getTime() - updatedDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff > 3;
  }
  return false;
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

  // Query for active project members
  const { data: members = [], refetch: refetchMembers } = useQuery<Member>({
    queryKey: ['project-members', projectId],
    query: `
      SELECT 
        p.id,
        p.email,
        p.username as name,
        ppl.membership as role,
        'active' as status
      FROM profile_project_link ppl
      JOIN profile p ON p.id = ppl.profile_id
      WHERE ppl.project_id = ?
        AND ppl.active = 1
    `,
    parameters: [projectId]
  });
  console.log('members', members);

  //retrieve and console log every profile_project_link record
  const { data: projectMembers = [] } = useQuery<ProfileProjectLink>({
    queryKey: ['profile-project-links', projectId],
    query: `
      SELECT * FROM profile_project_link
    `,
    parameters: [projectId]
  });
  console.log('projectMembers', projectMembers);

  // Query for invited users
  const { data: invitations = [], refetch: refetchInvitations } =
    useQuery<Invitation>({
      queryKey: ['project-invitations', projectId],
      query: `
      SELECT 
        ir.id,
        ir.email,
        ir.email as name,
        CASE WHEN ir.as_owner = 1 THEN 'owner' ELSE 'member' END as role,
        ir.status,
        ir.created_at,
        ir.last_updated,
        ir.receiver_profile_id
      FROM invite_request ir
      WHERE ir.project_id = ?
        AND ir.status IN ('awaiting_trigger', 'pending', 'expired', 'declined', 'withdrawn')
    `,
      parameters: [projectId]
    });

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
      await db
        .update(invite_request)
        .set({ status: 'withdrawn', last_updated: new Date().toISOString() })
        .where(eq(invite_request.id, inviteId));

      // Also deactivate any profile_project_link if exists
      const invite = invitations.find((i) => i.id === inviteId);
      if (invite?.receiver_profile_id) {
        await db
          .update(profile_project_link)
          .set({ active: false, last_updated: new Date().toISOString() })
          .where(
            and(
              eq(profile_project_link.profile_id, invite.receiver_profile_id),
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

  const handleSendInvitation = async () => {
    if (!isValidEmail(inviteEmail)) {
      Alert.alert(t('error'), t('enterValidEmail'));
      return;
    }

    setIsSubmitting(true);
    try {
      // Check for any existing invitation (including declined, withdrawn, expired)
      const existingInvite = await system.powersync.getOptional<{
        id: string;
        status: string;
        invite_count: number | null;
      }>(`SELECT * FROM invite_request WHERE email = ? AND project_id = ?`, [
        inviteEmail,
        projectId
      ]);

      if (existingInvite) {
        const MAX_INVITE_ATTEMPTS = 3; // Configure max attempts as needed

        // Check if we can re-invite
        if (
          ['declined', 'withdrawn', 'expired'].includes(existingInvite.status)
        ) {
          if ((existingInvite.invite_count || 0) < MAX_INVITE_ATTEMPTS) {
            // Update existing invitation
            await db
              .update(invite_request)
              .set({
                status: 'awaiting_trigger',
                as_owner: inviteAsOwner,
                invite_count: (existingInvite.invite_count || 0) + 1,
                last_updated: new Date().toISOString(),
                sender_profile_id: currentUser!.id // Update sender in case it's different
              })
              .where(eq(invite_request.id, existingInvite.id));

            setInviteEmail('');
            setInviteAsOwner(false);
            void refetchInvitations();
            Alert.alert(t('success'), t('invitationResent'));
            return;
          } else {
            throw new Error(t('maxInviteAttemptsReached'));
          }
        } else {
          // Invitation is still pending or in another active state
          throw new Error(t('invitationAlreadySent'));
        }
      }

      // Create new invitation
      await db.insert(invite_request).values({
        sender_profile_id: currentUser!.id,
        email: inviteEmail,
        project_id: projectId,
        type: 'invite',
        status: 'awaiting_trigger',
        as_owner: inviteAsOwner,
        invite_count: 1
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
        case 'awaiting_trigger':
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
        case 'awaiting_trigger':
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
                      {t('members')} ({members.length})
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
                    members.length > 0 ? (
                      members.map(renderMember)
                    ) : (
                      <Text style={styles.emptyText}>{t('noMembers')}</Text>
                    )
                  ) : visibleInvitations.length > 0 ? (
                    visibleInvitations.map(renderInvitation)
                  ) : (
                    <Text style={styles.emptyText}>{t('noInvitations')}</Text>
                  )}
                </ScrollView>

                <View style={styles.inviteSection}>
                  <Text style={styles.inviteTitle}>{t('inviteMembers')}</Text>
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
                      !isInviteButtonEnabled && styles.inviteButtonDisabled
                    ]}
                    onPress={handleSendInvitation}
                    disabled={!isInviteButtonEnabled || isSubmitting}
                  >
                    <Text style={sharedStyles.buttonText}>
                      {isSubmitting ? t('sending') : t('sendInvitation')}
                    </Text>
                  </TouchableOpacity>
                </View>
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
  }
});
