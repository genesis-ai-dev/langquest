import { LanguageSelect } from '@/components/LanguageSelect';
import { useAuth } from '@/contexts/AuthContext';
import { profileService } from '@/database_services/profileService';
import { language } from '@/db/drizzleSchema';
import { useSystem } from '@/db/powersync/system';
import { useTranslation } from '@/hooks/useTranslation';
import { colors, sharedStyles, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

type Language = typeof language.$inferSelect;

export default function Terms() {
  const router = useRouter();
  const [selectedLanguage, setSelectedLanguage] = useState<Language | null>();
  const { currentUser, setCurrentUser, isLoading } = useAuth();
  const { powersync, supabaseConnector } = useSystem();
  const { t } = useTranslation(selectedLanguage?.english_name);
  const [isProcessing, setIsProcessing] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    if (!isLoading && currentUser) {
      if (!currentUser.terms_accepted) powersync.disconnect();
      else if (!powersync.connected) powersync.connect(supabaseConnector);
    }
  }, [currentUser, isLoading, powersync, supabaseConnector]);

  const handleAcceptTerms = async () => {
    if (!currentUser) return;

    try {
      console.log('Accepting terms...');

      // Update the user's metadata in auth
      const updatedUser = await profileService.updateProfile({
        id: currentUser.id,
        terms_accepted: true,
        terms_version: '1.0'
      });

      // Close the modal
      router.navigate('/');

      // Resume syncing
      if (!powersync.connected) {
        powersync.connect(supabaseConnector);
      }

      // Refresh the current user
      if (updatedUser) {
        setCurrentUser(updatedUser);
      }
    } catch (error) {
      console.error('Error accepting terms:', error);
    }
  };

  const canAcceptTerms = currentUser && !currentUser.terms_accepted;

  return (
    <View style={styles.modalContainer}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>{t('termsAndConditionsTitle')}</Text>
        {currentUser?.terms_accepted && (
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace('/')
            }
          >
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

      {canAcceptTerms && (
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
              onPress={handleAcceptTerms}
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
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.background || 'white',
    padding: spacing.medium,
    paddingTop: spacing.xxxlarge
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
    flex: 1
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
