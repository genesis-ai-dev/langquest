import { LanguageSelect } from '@/components/LanguageSelect';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { profileService } from '@/database_services/profileService';
import { language } from '@/db/drizzleSchema';
import { useSystem } from '@/db/powersync/system';
import { useAcceptedTerms } from '@/hooks/useAcceptedTerms';
import { useTranslation } from '@/hooks/useTranslation';
import { colors, sharedStyles, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  const { currentLanguage, setLanguage } = useLanguage();
  const { currentUser, setCurrentUser, isLoading } = useAuth();
  const { powersync, supabaseConnector } = useSystem();
  const { t } = useTranslation();
  const [isProcessing, setIsProcessing] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const { termsAccepted: hasAcceptedTerms } = useAcceptedTerms();

  useEffect(() => {
    if (!isLoading && currentUser) {
      if (!currentUser.terms_accepted) powersync.disconnect();
      else if (!powersync.connected) powersync.connect(supabaseConnector);
    }
  }, [currentUser, isLoading, powersync, supabaseConnector]);

  const handleAcceptTerms = async () => {
    try {
      console.log('Accepting terms...');
      setIsProcessing(true);

      let updatedUser;
      if (!currentUser)
        await AsyncStorage.setItem('terms_accepted', new Date().toISOString());
      else {
        // Update the user's metadata in auth
        updatedUser = await profileService.updateProfile({
          id: currentUser.id,
          terms_accepted: true,
          terms_accepted_at: new Date().toISOString()
        });
      }
      // Close the modal
      router.navigate('/(root)');

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
    } finally {
      setIsProcessing(false);
    }
  };

  const canAcceptTerms = !hasAcceptedTerms;

  return (
    <View style={styles.modalContainer}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>{t('termsAndPrivacyTitle')}</Text>
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
          value={currentLanguage?.id || ''}
          onChange={(lang) => setLanguage(lang)}
          containerStyle={{ flex: 1 }}
        />
      </View>

      <ScrollView
        style={styles.modalBody}
        contentContainerStyle={styles.modalBodyContent}
      >
        <Text style={styles.modalText}>{t('termsContributionInfo')}</Text>
        <Text style={styles.modalText}>{t('termsDataInfo')}</Text>
        <Text style={styles.modalText}>{t('analyticsInfo')}</Text>
        <TouchableOpacity
          onPress={() =>
            Linking.openURL(`${process.env.EXPO_PUBLIC_SITE_URL}/terms`)
          }
          style={{ marginTop: spacing.medium }}
        >
          <Text style={[sharedStyles.link, styles.linkText]}>
            {t('viewFullTerms')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() =>
            Linking.openURL(`${process.env.EXPO_PUBLIC_SITE_URL}/privacy`)
          }
          style={{ marginTop: spacing.medium }}
        >
          <Text style={[sharedStyles.link, styles.linkText]}>
            {t('viewFullPrivacy')}
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
    fontSize: 16
  },
  termsCheckbox: {
    width: '100%',
    marginVertical: 20,
    paddingHorizontal: 10
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  checkboxIcon: {
    marginRight: 10
  },
  checkboxText: {
    color: colors.text,
    fontSize: 16,
    flex: 1,
    flexWrap: 'wrap'
  },
  closeButton: {
    padding: 8
  },
  modalFooter: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingHorizontal: 10,
    paddingBottom: 20
  },
  disabledButton: {
    opacity: 0.5
  }
});
