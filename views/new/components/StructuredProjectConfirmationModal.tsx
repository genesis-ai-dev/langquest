import { borderRadius, colors, fontSizes, spacing } from '@/styles/theme';
import { getTemplateById } from '@/utils/projectTemplates';
import type { StructuredProjectPreparationResult } from '@/utils/structuredProjectCreator';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

interface StructuredProjectConfirmationModalProps {
  visible: boolean;
  projectName: string;
  preparedData: StructuredProjectPreparationResult | null;
  templateId?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const StructuredProjectConfirmationModal: React.FC<
  StructuredProjectConfirmationModalProps
> = ({
  visible,
  projectName,
  preparedData,
  templateId,
  onConfirm,
  onCancel,
  isLoading = false
}) => {
  // If preparedData not provided, compute minimal stats dynamically from templateId
  let stats = preparedData?.stats;
  let templateName: string | undefined;
  if (!stats && templateId) {
    const template = getTemplateById(templateId);
    if (!template) return null;
    templateName = template.name;
    // Compute counts directly from template metadata
    stats = {
      questCount: template.questCount,
      assetCount: template.assetCount,
      contentCount: template.assetCount // content entries mirror assets for bible template
    };
  } else {
    // Use prepared stats/template
    const tmpl = preparedData?.template as { name?: string } | undefined;
    templateName = tmpl?.name;
  }

  if (!stats) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons
                name="library-outline"
                size={24}
                color={colors.primary}
              />
              <Text style={styles.headerTitle}>Confirm Project Creation</Text>
            </View>
            <TouchableOpacity onPress={onCancel} disabled={isLoading}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.projectInfo}>
              <Text style={styles.projectName}>{projectName}</Text>
              <Text style={styles.templateName}>Using: {templateName}</Text>
            </View>

            <View style={styles.warningSection}>
              <View style={styles.warningHeader}>
                <Ionicons
                  name="warning-outline"
                  size={20}
                  color={colors.alert}
                />
                <Text style={styles.warningTitle}>Large Project Creation</Text>
              </View>
              <Text style={styles.warningText}>
                This will create a substantial amount of content. Please review
                the details below before proceeding.
              </Text>
            </View>

            <View style={styles.statsSection}>
              <Text style={styles.statsTitle}>What will be created:</Text>

              <View style={styles.statItem}>
                <View style={styles.statIcon}>
                  <Ionicons
                    name="list-outline"
                    size={20}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.statContent}>
                  <Text style={styles.statNumber}>
                    {stats.questCount.toLocaleString()}
                  </Text>
                  <Text style={styles.statLabel}>Quests (Bible chapters)</Text>
                  <Text style={styles.statDescription}>
                    One quest for each chapter across all 66 books
                  </Text>
                </View>
              </View>

              <View style={styles.statItem}>
                <View style={styles.statIcon}>
                  <Ionicons
                    name="document-text-outline"
                    size={20}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.statContent}>
                  <Text style={styles.statNumber}>
                    {stats.assetCount.toLocaleString()}
                  </Text>
                  <Text style={styles.statLabel}>Assets (Bible verses)</Text>
                  <Text style={styles.statDescription}>
                    Individual translation units, one for each verse
                  </Text>
                </View>
              </View>

              <View style={styles.statItem}>
                <View style={styles.statIcon}>
                  <Ionicons
                    name="reader-outline"
                    size={20}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.statContent}>
                  <Text style={styles.statNumber}>
                    {stats.contentCount.toLocaleString()}
                  </Text>
                  <Text style={styles.statLabel}>Content entries</Text>
                  <Text style={styles.statDescription}>
                    Source text placeholders ready for translation
                  </Text>
                </View>
              </View>

              <View style={styles.totalSection}>
                <View style={styles.totalItem}>
                  <Text style={styles.totalLabel}>Total items:</Text>
                  <Text style={styles.totalNumber}>
                    {(
                      1 +
                      stats.questCount +
                      stats.assetCount +
                      stats.contentCount
                    ).toLocaleString()}
                  </Text>
                </View>
                <Text style={styles.totalSubtext}>
                  This is a complete Bible translation framework
                </Text>
              </View>
            </View>
          </ScrollView>

          <View style={styles.timeEstimate}>
            <Ionicons
              name="time-outline"
              size={16}
              color={colors.textSecondary}
            />
            <Text style={styles.timeText}>
              Estimated creation time: 5-10 seconds
            </Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
              disabled={isLoading}
            >
              <Text style={[styles.buttonText, styles.cancelButtonText]}>
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.confirmButton,
                isLoading && styles.confirmButtonDisabled
              ]}
              onPress={onConfirm}
              disabled={isLoading}
            >
              <Text style={[styles.buttonText, styles.confirmButtonText]}>
                {isLoading ? 'Creating...' : 'Yes, Create Project'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.medium
  },
  modal: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.large,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.large,
    borderBottomWidth: 1,
    borderBottomColor: colors.inputBackground
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  headerTitle: {
    fontSize: fontSizes.large,
    fontWeight: '700',
    color: colors.text,
    marginLeft: spacing.medium
  },
  content: {
    padding: spacing.large,
    maxHeight: 400
  },
  projectInfo: {
    marginBottom: spacing.large
  },
  projectName: {
    fontSize: fontSizes.large,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xsmall
  },
  templateName: {
    fontSize: fontSizes.medium,
    color: colors.textSecondary
  },
  warningSection: {
    backgroundColor: colors.alert + '10',
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
    marginBottom: spacing.large,
    borderLeftWidth: 4,
    borderLeftColor: colors.alert
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.small
  },
  warningTitle: {
    fontSize: fontSizes.medium,
    fontWeight: '600',
    color: colors.alert,
    marginLeft: spacing.small
  },
  warningText: {
    fontSize: fontSizes.small,
    color: colors.text,
    lineHeight: 20
  },
  statsSection: {
    marginBottom: spacing.large
  },
  statsTitle: {
    fontSize: fontSizes.medium,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.medium
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.large
  },
  statIcon: {
    width: 40,
    alignItems: 'center',
    marginTop: 2
  },
  statContent: {
    flex: 1,
    marginLeft: spacing.small
  },
  statNumber: {
    fontSize: fontSizes.large,
    fontWeight: '700',
    color: colors.primary
  },
  statLabel: {
    fontSize: fontSizes.medium,
    fontWeight: '600',
    color: colors.text,
    marginTop: 2
  },
  statDescription: {
    fontSize: fontSizes.small,
    color: colors.textSecondary,
    marginTop: spacing.xsmall,
    lineHeight: 18
  },
  totalSection: {
    backgroundColor: colors.primary + '10',
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
    marginTop: spacing.medium
  },
  totalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  totalLabel: {
    fontSize: fontSizes.medium,
    fontWeight: '600',
    color: colors.text
  },
  totalNumber: {
    fontSize: fontSizes.large,
    fontWeight: '700',
    color: colors.primary
  },
  totalSubtext: {
    fontSize: fontSizes.small,
    color: colors.textSecondary,
    marginTop: spacing.xsmall,
    textAlign: 'center'
  },
  timeEstimate: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.medium
  },
  timeText: {
    fontSize: fontSizes.small,
    color: colors.textSecondary,
    marginLeft: spacing.xsmall
  },
  actions: {
    flexDirection: 'row',
    padding: spacing.large,
    borderTopWidth: 1,
    borderTopColor: colors.inputBackground,
    gap: spacing.medium
  },
  button: {
    flex: 1,
    paddingVertical: spacing.medium,
    borderRadius: borderRadius.medium,
    alignItems: 'center',
    justifyContent: 'center'
  },
  cancelButton: {
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.inputBackground
  },
  confirmButton: {
    backgroundColor: colors.primary
  },
  confirmButtonDisabled: {
    backgroundColor: colors.primary + '60'
  },
  buttonText: {
    fontSize: fontSizes.medium,
    fontWeight: '600'
  },
  cancelButtonText: {
    color: colors.text
  },
  confirmButtonText: {
    color: colors.background
  }
});
