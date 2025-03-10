import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSystem } from '@/db/powersync/system';
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
import { userService } from '@/database_services/userService';

export function TermsGuard({ children }: { children: React.ReactNode }) {
  const { currentUser, setCurrentUser, isLoading } = useAuth();
  const { powersync } = useSystem();
  const { t } = useTranslation();
  const [termsModalVisible, setTermsModalVisible] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Check if the user has accepted the terms and conditions
  useEffect(() => {
    if (!isLoading && currentUser && !currentUser.terms_accepted) {
      setTermsModalVisible(true);
    }
  }, [currentUser, isLoading]);

  // Pause syncing if terms not accepted
  useEffect(() => {
    if (!isLoading && currentUser && !currentUser.terms_accepted) {
      // Pause syncing
      powersync.disconnect();
    } else if (!isLoading && currentUser && currentUser.terms_accepted) {
      // Resume syncing if not connected
      if (!powersync.connected) {
        powersync.connect(useSystem().supabaseConnector);
      }
    }
  }, [currentUser, isLoading, powersync]);

  const handleAcceptTerms = async () => {
    if (!currentUser || isProcessing) return;

    try {
      setIsProcessing(true);

      // Update user profile with terms acceptance
      const updatedUser = await userService.updateUser({
        id: currentUser.id,
        terms_accepted: true,
        terms_version: '1.0'
      });

      if (updatedUser) {
        setCurrentUser(updatedUser);
        setTermsModalVisible(false);

        // Resume syncing
        if (!powersync.connected) {
          powersync.connect(useSystem().supabaseConnector);
        }
      }
    } catch (error) {
      console.error('Error accepting terms:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // If loading, show nothing
  if (isLoading) {
    return null;
  }

  // If user has accepted terms or is not authenticated, render children
  if (!currentUser || currentUser.terms_accepted) {
    return <>{children}</>;
  }

  // Otherwise, show terms modal and block rendering of children
  return (
    <>
      <Modal
        animationType="slide"
        transparent={true}
        visible={termsModalVisible}
        onRequestClose={() => {}}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {t('termsAndConditionsTitle')}
              </Text>
              <Text style={styles.modalVersion}>{t('termsVersion')}</Text>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.modalText}>
                {t('termsAndConditionsContent')}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  // Open the full data policy in browser
                  Linking.openURL('https://www.langquest.org/data-policy');
                }}
                style={{ marginTop: spacing.medium }}
              >
                <Text style={sharedStyles.link}>View Full Data Policy</Text>
              </TouchableOpacity>
            </ScrollView>
            <View style={styles.termsCheckbox}>
              <TouchableOpacity
                onPress={() => setTermsAccepted(!termsAccepted)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.small
                }}
              >
                <Ionicons
                  name={termsAccepted ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={colors.text}
                />
                <Text style={{ color: colors.text }}>{t('agreeToTerms')}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[
                  sharedStyles.button,
                  { flex: 1 },
                  !termsAccepted && styles.disabledButton
                ]}
                onPress={handleAcceptTerms}
                disabled={!termsAccepted || isProcessing}
              >
                <Text style={sharedStyles.buttonText}>
                  {isProcessing ? t('processing') : t('accept')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)'
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 20,
    width: '80%',
    maxHeight: '80%',
    alignItems: 'center'
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%'
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10
  },
  modalVersion: {
    fontSize: 14,
    color: colors.text
  },
  modalBody: {
    flex: 1,
    width: '100%',
    padding: 10
  },
  modalText: {
    color: colors.text,
    marginBottom: 10
  },
  termsCheckbox: {
    width: '100%',
    marginTop: 20,
    marginBottom: 10
  },
  modalFooter: {
    flexDirection: 'row',
    width: '100%',
    marginTop: 10
  },
  disabledButton: {
    opacity: 0.5
  }
});
