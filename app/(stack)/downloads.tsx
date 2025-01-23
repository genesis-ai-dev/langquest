import { colors } from '@/styles/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, Text } from 'react-native';

export default function Downloads() {
  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      style={{ flex: 1 }}
    >
      <SafeAreaView>
        <Text style={{ color: colors.text }}>Downloads</Text>
      </SafeAreaView>
    </LinearGradient>
  );
}
