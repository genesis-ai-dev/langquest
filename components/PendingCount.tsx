import { GemIcon } from '@/components/GemIcon';
import { colors, fontSizes } from '@/styles/theme';
import { StyleSheet, Text, View } from 'react-native';

interface PendingCountProps {
  count: number;
  color?: string;
  iconSize?: number;
}

export const PendingCount = ({
  count,
  color = colors.textSecondary,
  iconSize = 16
}: PendingCountProps) => {
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
