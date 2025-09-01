import { LanguageSelect } from '@/components/LanguageSelect';
import { useLocalization } from '@/hooks/useLocalization';
import { useLocalStore } from '@/store/localStore';
import { colors, sharedStyles, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';
import React, { memo, useCallback, useState } from 'react';
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

function TermsView() {
  const dateTermsAccepted = useLocalStore((state) => state.dateTermsAccepted);
  const acceptTerms = useLocalStore((state) => state.acceptTerms);
  const { t } = useLocalization();
  const [termsAccepted, setTermsAccepted] = useState(false);

  const handleAcceptTerms = useCallback(() => {
    console.log('Accepting terms...');

    // Update local store immediately for UI responsiveness
    acceptTerms();

    // Navigation will be handled automatically by app.tsx when terms are accepted
  }, [acceptTerms]);

  const handleToggleTerms = useCallback(() => {
    setTermsAccepted(!termsAccepted);
  }, [termsAccepted]);

  const handleViewTerms = useCallback(() => {
    void Linking.openURL(`${process.env.EXPO_PUBLIC_SITE_URL}/terms`);
  }, []);

  const handleViewPrivacy = useCallback(() => {
    void Linking.openURL(`${process.env.EXPO_PUBLIC_SITE_URL}/privacy`);
  }, []);

  // Check terms acceptance from database first, fall back to local store
  const hasAcceptedTerms = !!dateTermsAccepted;
  const canAcceptTerms = !hasAcceptedTerms;

  const [languagesLoaded, setLanguagesLoaded] = useState(false);
  const onLayoutView = useCallback(() => {
    if (languagesLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [languagesLoaded]);

  return (
    <View style={styles.modalContainer} onLayout={onLayoutView}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>{t('termsAndPrivacyTitle')}</Text>
      </View>

      {/* Language Selector */}
      <View style={styles.languageSelector}>
        <LanguageSelect
          setLanguagesLoaded={setLanguagesLoaded}
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
          onPress={handleViewTerms}
          style={{ marginTop: spacing.medium }}
        >
          <Text style={[sharedStyles.link, styles.linkText]}>
            {t('viewFullTerms')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleViewPrivacy}
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
              onPress={handleToggleTerms}
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

export default memo(TermsView);

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
  languageSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 15,
    gap: 10
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
    color: colors.text,
    textDecorationLine: 'underline'
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
