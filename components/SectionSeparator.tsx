import { Text, View } from 'react-native';

type SectionSeparatorVariant = 'default' | 'small' | 'xs';

interface SectionSeparatorProps {
  text: string;
  variant?: SectionSeparatorVariant;
  className?: string;
  textClassName?: string;
}

const variantStyles = {
  default: {
    line: 'bg-primary',
    text: 'text-base text-primary'
  },
  small: {
    line: 'bg-primary/60',
    text: 'text-sm text-primary/60'
  },
  xs: {
    line: 'bg-primary/40',
    text: 'text-xs text-primary/40'
  }
};

export function SectionSeparator({
  text,
  variant = 'default',
  className = '',
  textClassName = ''
}: SectionSeparatorProps) {
  const styles = variantStyles[variant];

  return (
    <View className={`w-full flex-row items-center ${className}`}>
      <View className={`h-px flex-1 ${styles.line}`} />
      <Text className={`px-3 ${styles.text} ${textClassName}`}>{text}</Text>
      <View className={`h-px flex-1 ${styles.line}`} />
    </View>
  );
}
