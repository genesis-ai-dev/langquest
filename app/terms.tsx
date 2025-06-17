import { LanguageSelect } from '@/components/LanguageSelect';
import { useLocalization } from '@/hooks/useLocalization';
import { useLocalStore } from '@/store/localStore';
import { colors, sharedStyles, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

export default function Terms() {
  const router = useRouter();
  const dateTermsAccepted = useLocalStore((state) => state.dateTermsAccepted);
  const acceptTerms = useLocalStore((state) => state.acceptTerms);
  const { t } = useLocalization();
  const [termsAccepted, setTermsAccepted] = useState(false);

  const handleAcceptTerms = () => {
    console.log('Accepting terms...');
    acceptTerms();
    router.navigate('/');
  };

  const canAcceptTerms = !dateTermsAccepted;

  return (
    <View style={styles.modalContainer}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>{t('termsAndPrivacyTitle')}</Text>
        {!canAcceptTerms && (
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
        <LanguageSelect containerStyle={{ flex: 1 }} />
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
              disabled={!termsAccepted}
            >
              <Text style={sharedStyles.buttonText}>{t('accept')}</Text>
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
