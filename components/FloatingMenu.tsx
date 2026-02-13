import { colors } from '@/styles/theme';
import { Icon } from '@/components/ui/icon';
import type { LucideIcon } from 'lucide-react-native';
import { Menu, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, TouchableOpacity, View } from 'react-native';

export interface FloatingMenuItem {
  icon: LucideIcon;
  label: string;
  action: () => void;
}

// const { width, height } = Dimensions.get('window');

interface FloatingMenuProps {
  items: FloatingMenuItem[];
  showLabel?: boolean;
}

export const FloatingMenu = ({
  items
  // showLabel = false
}: FloatingMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [shouldRenderItems, setShouldRenderItems] = useState(false);

  const animatedValues = useRef(items.map(() => new Animated.Value(0))).current;
  const rotateValue = useRef(new Animated.Value(0)).current;
  const scaleValue = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isOpen) {
      setShouldRenderItems(true);

      const openAnimations = animatedValues.map((value, index) =>
        Animated.timing(value, {
          toValue: 1,
          duration: 200,
          delay: (items.length - 1 - index) * 60,
          useNativeDriver: true
        })
      );

      Animated.parallel([
        ...openAnimations,
        Animated.timing(rotateValue, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true
        })
      ]).start();
    } else {
      const closeAnimations = animatedValues.map((value, index) =>
        Animated.timing(value, {
          toValue: 0,
          duration: 200,
          delay: index * 60,
          useNativeDriver: true
        })
      );

      Animated.parallel([
        ...closeAnimations,
        Animated.timing(rotateValue, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true
        })
      ]).start(() => {
        setShouldRenderItems(false);
      });
    }
  }, [isOpen, animatedValues, items.length, rotateValue]);

  const toggleMenu = () => {
    Animated.sequence([
      Animated.timing(scaleValue, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true
      }),
      Animated.timing(scaleValue, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true
      })
    ]).start();

    setIsOpen(!isOpen);
  };

  const handleClick = (action: () => void) => {
    toggleMenu();
    action();
  };

  const rotation = rotateValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg']
  });

  return (
    <View style={styles.container}>
      {/* Menu Items */}
      {shouldRenderItems && (
        <View style={styles.menuContainer}>
          {items.map((item, index) => {
            const animatedValue = animatedValues[index];
            // const translateY = animatedValue
            //   ? animatedValue.interpolate({
            //       inputRange: [0, 1],
            //       outputRange: [40, 0] // Movimento de baixo (40) para cima (0)
            //     })
            //   : 0;
            const opacity = animatedValue
              ? animatedValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1]
                })
              : 1;
            const scale = animatedValue
              ? animatedValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 1]
                })
              : 1;

            return (
              <Animated.View
                key={item.label}
                style={[
                  styles.menuItem,
                  {
                    transform: [
                      //  { translateY },
                      { scale }
                    ],
                    opacity
                  }
                ]}
              >
                <ItemButton
                  icon={item.icon}
                  label={item.label}
                  action={() => handleClick(item.action)}
                />
              </Animated.View>
            );
          })}
        </View>
      )}

      {/* Toggle Button */}
      <Animated.View
        style={[
          styles.toggleButton,
          {
            transform: [{ rotate: rotation }, { scale: scaleValue }]
          }
        ]}
      >
        <TouchableOpacity
          style={styles.toggleButtonInner}
          onPress={toggleMenu}
          activeOpacity={0.8}
        >
          <View style={styles.buttonBackground}></View>
          <Icon as={isOpen ? X : Menu} size={20} className="text-foreground" />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const ItemButton = ({ icon, action }: FloatingMenuItem) => {
  const IconComponent = icon;
  return (
    <TouchableOpacity
      style={styles.menuButton}
      onPress={action}
      activeOpacity={0.7}
    >
      <View style={styles.buttonBackground}></View>
      <Icon as={IconComponent} size={20} className="text-foreground" />
    </TouchableOpacity>
  );
};

export function createMenuItem(
  icon: LucideIcon,
  label: string,
  onClick: () => void
) {
  return {
    icon,
    label,
    action: () => {
      onClick();
      return null;
    }
  };
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    alignItems: 'flex-end'
  },
  menuContainer: {
    marginBottom: 16,
    alignItems: 'flex-end'
  },
  menuItem: {
    marginBottom: 12
  },
  menuButton: {
    backgroundColor: 'rgba(255, 255, 255, .6)',
    borderRadius: 28,
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5
  },
  buttonBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 28,
    backgroundColor: 'rgba(77, 77, 77, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    // boxShadow: 'inset 8px 8px 16px #333, inset -8px -8px 16px #444'
    boxShadow: 'inset -1px -1px 2px #301934'
  },
  toggleButton: {
    width: 56,
    height: 56,
    borderRadius: 28
  },
  toggleButtonInner: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.5)', //'rgba(147, 51, 234, 0.9)',
    // borderWidth: 1,
    // borderColor: 'rgba(115, 103, 165, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 6
    },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12
    // boxShadow: 'inset -2px -2px 2px #301934'
  }
});
