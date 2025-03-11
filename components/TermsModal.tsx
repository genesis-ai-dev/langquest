import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking
} from 'react-native';
import { colors, sharedStyles, spacing } from '@/styles/theme';
import { useTranslation } from '@/hooks/useTranslation';
import { Ionicons } from '@expo/vector-icons';
import { LanguageSelect } from '@/components/LanguageSelect';
import { language } from '@/db/drizzleSchema';

type Language = typeof language.$inferSelect;

interface TermsModalProps {
  visible: boolean;
  onClose: () => void;
  onAccept?: () => void;
  showAcceptButton?: boolean;
  canDismiss?: boolean;
  initialLanguage?: Language | null;
}

export function TermsModal({
  visible,
  onClose,
  onAccept,
  showAcceptButton = false,
  canDismiss = true,
  initialLanguage = null
}: TermsModalProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<Language | null>(
    initialLanguage
  );
  const { t } = useTranslation(selectedLanguage?.english_name);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAccept = async () => {
    if (isProcessing) return;

    try {
      setIsProcessing(true);

      if (onAccept) {
        await onAccept();
      }

      // Close the modal after successful acceptance
      onClose();
    } catch (error) {
      console.error('Error accepting terms:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={() => {
        if (canDismiss) {
          onClose();
        }
      }}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {t('termsAndConditionsTitle')}
            </Text>
            <Text style={styles.modalVersion}>{t('termsVersion')}</Text>
            {canDismiss && (
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            )}
          </View>

          {/* Language Selector */}
          <View style={styles.languageSelector}>
            <LanguageSelect
              value={selectedLanguage?.id || ''}
              onChange={(lang) => setSelectedLanguage(lang)}
              containerStyle={{ flex: 1 }}
            />
          </View>

          <ScrollView
            style={styles.modalBody}
            contentContainerStyle={styles.modalBodyContent}
          >
            <Text style={styles.modalText}>
              {t('termsAndConditionsContent')}
            </Text>
            <Text style={styles.modalText}>{t('termsContributionInfo')}</Text>
            <Text style={styles.modalText}>{t('termsDataInfo')}</Text>
            <TouchableOpacity
              onPress={() => {
                // Open the full data policy in browser
                Linking.openURL(t('dataPolicyUrl'));
              }}
              style={{ marginTop: spacing.medium }}
            >
              <Text style={[sharedStyles.link, styles.linkText]}>
                {t('viewFullDataPolicy')}
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {showAcceptButton && (
            <>
              <View style={styles.termsCheckbox}>
                <TouchableOpacity
                  onPress={() => setTermsAccepted(!termsAccepted)}
                  style={styles.checkboxContainer}
                >
                  <Ionicons
                    name={termsAccepted ? 'checkbox' : 'square-outline'}
                    size={24}
                    color={colors.text}
                    style={styles.checkboxIcon}
                  />
                  <Text style={styles.checkboxText}>{t('agreeToTerms')}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={[
                    sharedStyles.button,
                    { flex: 1 },
                    !termsAccepted && styles.disabledButton
                  ]}
                  onPress={handleAccept}
                  disabled={!termsAccepted || isProcessing}
                >
                  <Text style={sharedStyles.buttonText}>
                    {isProcessing ? t('processing') : t('accept')}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 20
  },
  modalContent: {
    backgroundColor: colors.background || 'white',
    padding: 20,
    borderRadius: 20,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    alignItems: 'center'
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 15
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    flex: 1
  },
  modalVersion: {
    fontSize: 14,
    color: colors.textSecondary
  },
  languageSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 15,
    gap: 10
  },
  languageLabel: {
    fontSize: 16,
    color: colors.text
  },
  modalBody: {
    width: '100%',
    maxHeight: '60%'
  },
  modalBodyContent: {
    padding: 10
  },
  modalText: {
    color: colors.text,
    marginBottom: 15,
    fontSize: 16,
    lineHeight: 24
  },
  linkText: {
    fontSize: 16,
    textAlign: 'center'
  },
  termsCheckbox: {
    width: '100%',
    marginTop: 20,
    marginBottom: 10
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.small
  },
  checkboxIcon: {
    marginTop: 2
  },
  checkboxText: {
    color: colors.text,
    flex: 1,
    flexWrap: 'wrap'
  },
  modalFooter: {
    flexDirection: 'row',
    width: '100%',
    marginTop: 10
  },
  disabledButton: {
    opacity: 0.5
  },
  closeButton: {
    padding: 5,
    marginLeft: 10
  }
});
