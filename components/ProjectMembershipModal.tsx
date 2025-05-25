import { useTranslation } from '@/hooks/useTranslation';
import {
  borderRadius,
  colors,
  fontSizes,
  sharedStyles,
  spacing
} from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
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

interface Member {
  id: string;
  email: string;
  name: string;
  role: 'owner' | 'member';
  status: 'active' | 'invited';
  invitedAt?: Date;
}

interface ProjectMembershipModalProps {
  isVisible: boolean;
  onClose: () => void;
  projectId: string;
}

// Email validation regex
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const ProjectMembershipModal: React.FC<ProjectMembershipModalProps> = ({
  isVisible,
  onClose,
  projectId: _projectId
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'members' | 'invited'>('members');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteAsOwner, setInviteAsOwner] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  // Mock data for now
  const mockMembers: Member[] = [
    {
      id: '1',
      email: 'current@user.com',
      name: 'Current User',
      role: 'owner',
      status: 'active'
    },
    {
      id: '2',
      email: 'john@example.com',
      name: 'John Doe',
      role: 'member',
      status: 'active'
    },
    {
      id: '3',
      email: 'jane@example.com',
      name: 'Jane Smith',
      role: 'owner',
      status: 'active'
    },
    {
      id: '4',
      email: 'bob@example.com',
      name: 'Bob Wilson',
      role: 'member',
      status: 'invited',
      invitedAt: new Date()
    }
  ];

  const activeMembers = mockMembers.filter((m) => m.status === 'active');
  const invitedMembers = mockMembers.filter((m) => m.status === 'invited');
  const currentUserId = '1'; // Mock current user
  const currentUserIsOwner =
    mockMembers.find((m) => m.id === currentUserId)?.role === 'owner';

  const renderMember = (member: Member) => {
    const isCurrentUser = member.id === currentUserId;

    return (
      <View key={member.id} style={styles.memberItem}>
        <View style={styles.memberInfo}>
          <View style={styles.memberAvatar}>
            <Text style={styles.memberAvatarText}>
              {member.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.memberDetails}>
            <View style={styles.memberNameRow}>
              <Text style={styles.memberName}>
                {member.name} {isCurrentUser && `(${t('you')})`}
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
            {member.status === 'invited' && (
              <View style={styles.invitedTag}>
                <Text style={styles.invitedTagText}>
                  {t('pendingInvitation')}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.memberActions}>
          {currentUserIsOwner && !isCurrentUser && (
            <>
              {member.status === 'active' && member.role === 'member' && (
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={() => console.log('Promote to owner')}
                >
                  <Ionicons
                    name="ribbon-outline"
                    size={20}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => console.log('Remove member')}
              >
                <Ionicons name="trash-outline" size={20} color={colors.error} />
              </TouchableOpacity>
            </>
          )}
          {isCurrentUser && (
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => console.log('Leave project')}
            >
              <Ionicons name="exit-outline" size={20} color={colors.error} />
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
                      {t('members')} ({activeMembers.length})
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
                      {t('invited')} ({invitedMembers.length})
                    </Text>
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.membersList}>
                  {activeTab === 'members' ? (
                    activeMembers.length > 0 ? (
                      activeMembers.map(renderMember)
                    ) : (
                      <Text style={styles.emptyText}>{t('noMembers')}</Text>
                    )
                  ) : invitedMembers.length > 0 ? (
                    invitedMembers.map(renderMember)
                  ) : (
                    <Text style={styles.emptyText}>{t('noInvitations')}</Text>
                  )}
                </ScrollView>

                {currentUserIsOwner && (
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
                      onPress={() => console.log('Send invitation')}
                      disabled={!isInviteButtonEnabled}
                    >
                      <Text style={sharedStyles.buttonText}>
                        {t('sendInvitation')}
                      </Text>
                    </TouchableOpacity>
                  </View>
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
  }
});
