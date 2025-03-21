import { PageHeader } from '@/components/PageHeader';
import { useTranslation } from '@/hooks/useTranslation';
import { colors, spacing } from '@/styles/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Settings() {
  const { t } = useTranslation();
  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      style={{ flex: 1 }}
    >
      <SafeAreaView
        style={{
          flex: 1,
          paddingHorizontal: spacing.medium,
          paddingTop: spacing.medium
        }}
      >
        <PageHeader title={t('settings')} />
      </SafeAreaView>
    </LinearGradient>
  );
}
