import { GemIcon } from '@/components/GemIcon';
import { colors, fontSizes } from '@/styles/theme';
import { StyleSheet, Text, View } from 'react-native';

interface SuccessCountProps {
  count: number;
  color?: string;
  iconSize?: number;
}

export const SuccessCount = ({
  count,
  color = colors.success,
  iconSize = 16
}: SuccessCountProps) => {
  if (count <= 0) return null;

  return (
    <View style={styles.container}>
      <GemIcon color={color} width={iconSize} height={iconSize} />
      <Text style={styles.count}>{count}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.background
  },
  count: {
    color: colors.text,
    fontSize: fontSizes.small
  }
});
