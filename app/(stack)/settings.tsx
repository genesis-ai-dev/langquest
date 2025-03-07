import { useTranslation } from '@/hooks/useTranslation';
import { colors, sharedStyles } from '@/styles/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Settings() {
  const { t } = useTranslation();
  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      style={{ flex: 1 }}
    >
      <SafeAreaView>
        <Text style={sharedStyles.title}>{t('settings')}</Text>
      </SafeAreaView>
    </LinearGradient>
  );
}
