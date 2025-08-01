import { colors, fontSizes, spacing } from '@/styles/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

interface RabbitModeSwitchProps {
  value: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export const RabbitModeSwitch: React.FC<RabbitModeSwitchProps> = ({
  value,
  onToggle,
  disabled = false
}) => {
  const animatedValue = React.useRef(new Animated.Value(value ? 1 : 0)).current;

  React.useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: value ? 1 : 0,
      duration: 200,
      useNativeDriver: false
    }).start();
  }, [value, animatedValue]);

  const thumbTranslateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 27]
  });

  const backgroundColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.inputBackground, colors.success]
  });

  return (
    <View style={styles.container}>
      <MaterialCommunityIcons
        name="tortoise"
        size={20}
        color={!value ? colors.primary : colors.textSecondary}
        style={styles.icon}
      />

      <TouchableOpacity
        onPress={onToggle}
        disabled={disabled}
        activeOpacity={0.8}
        style={styles.touchable}
      >
        <Animated.View
          style={[
            styles.switch,
            { backgroundColor },
            disabled && styles.disabled
          ]}
        >
          <Animated.View
            style={[
              styles.thumb,
              {
                transform: [{ translateX: thumbTranslateX }]
              }
            ]}
          />
        </Animated.View>
      </TouchableOpacity>

      <MaterialCommunityIcons
        name="rabbit"
        size={20}
        color={value ? colors.primary : colors.textSecondary}
        style={styles.icon}
      />

      <Text style={[styles.label, value && styles.activeLabel]}>
        {value ? 'Rabbit' : 'Normal'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: 20,
    paddingVertical: spacing.xsmall,
    paddingHorizontal: spacing.small,
    borderWidth: 1,
    borderColor: colors.inputBorder
  },
  touchable: {
    marginHorizontal: spacing.xsmall
  },
  switch: {
    width: 50,
    height: 25,
    borderRadius: 12.5,
    justifyContent: 'center'
  },
  thumb: {
    width: 21,
    height: 21,
    borderRadius: 10.5,
    backgroundColor: colors.background,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1
    },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2
  },
  disabled: {
    opacity: 0.5
  },
  icon: {
    marginHorizontal: 2
  },
  label: {
    marginLeft: spacing.xsmall,
    fontSize: fontSizes.small,
    fontWeight: '600',
    color: colors.textSecondary
  },
  activeLabel: {
    color: colors.primary
  }
});
