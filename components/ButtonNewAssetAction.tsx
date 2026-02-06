import { cn, useThemeColor } from '@/utils/styleUtils';
import { PlusIcon, Repeat2 } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { Icon } from './ui/icon';
import { Text } from './ui/text';

interface ButtonNewAssetActionProps {
  type: 'new' | 'replace';
  onPress: () => void;
  direction?: 'reverse';
  showText?: boolean;
  selected?: boolean;
  className?: string;
}

const ButtonNewAssetActionComponent = ({
  type,
  onPress,
  direction,
  showText = false,
  selected = false,
  className
}: ButtonNewAssetActionProps) => {
  const primaryColor = useThemeColor('primary');
  const destructiveColor = useThemeColor('destructive');
  const mutedColor = useThemeColor('muted');
  
  const buttonConfig = useMemo(() => {
    const isNew = type === 'new';
    const baseColor = isNew ? primaryColor : destructiveColor;
    
    // If not selected, use muted color or a semi-transparent version
    const backgroundColor = selected 
      ? baseColor 
      : (mutedColor || `${baseColor}40`);
    
    // Red border when replace is selected
    const borderColor = selected && type === 'replace' ? destructiveColor : undefined;
    
    return {
      backgroundColor,
      borderColor,
      icon: isNew ? PlusIcon : Repeat2,
      text: isNew ? 'Add_new' : 'Replace',
      iconColor: selected 
        ? (isNew ? 'text-primary-foreground' : 'text-destructive-foreground')
        : 'text-muted-foreground'
    };
  }, [type, primaryColor, destructiveColor, mutedColor, selected]);

  const iconElement = (
    <Icon
      as={buttonConfig.icon}
      size={20}
      strokeWidth={2.5}
      className={buttonConfig.iconColor}
    />
  );

  const textElement = showText && (
    <Text className={cn('text-xs font-semibold', buttonConfig.iconColor)}>
      {buttonConfig.text}
    </Text>
  );

  return (
    <Pressable
      onPress={onPress}
      className={cn('active:opacity-80', className)}
    >
      <View
        style={{ 
          backgroundColor: buttonConfig.backgroundColor,
          borderColor: buttonConfig.borderColor,
          borderWidth: buttonConfig.borderColor ? 2 : 0
        }}
        className={cn(
          'rounded-full flex flex-row items-center justify-center gap-2 ',
          showText ? 'px-4 py-2' : 'p-2'
        )}
      >
        {direction === 'reverse' ? (
          <>
            {textElement}
            {iconElement}
          </>
        ) : (
          <>
            {iconElement}
            {textElement}
          </>
        )}
      </View>
    </Pressable>
  );
};

/**
 * Action button for adding or replacing assets
 * 
 * @param type - Defines the action type: "new" (add) or "replace" (replace)
 * @param onPress - Function executed when clicking the button
 * @param direction - (Optional) If "reverse", displays text + icon; otherwise, icon + text
 * @param showText - (Optional) If true, displays the text alongside the icon
 * @param selected - (Optional) If true, shows normal color; if false, shows lighter/muted color. Defaults to true
 * @param className - (Optional) Additional CSS classes
 * 
 * @example
 * ```tsx
 * // Add button with icon only
 * <ButtonNewAssetAction type="new" onPress={() => console.log('Add')} />
 * 
 * // Replace button with text
 * <ButtonNewAssetAction 
 *   type="replace" 
 *   onPress={() => console.log('Replace')} 
 *   showText 
 * />
 * 
 * // Button with text and icon reversed, not selected
 * <ButtonNewAssetAction 
 *   type="new" 
 *   onPress={() => console.log('Add')} 
 *   showText 
 *   direction="reverse"
 *   selected={false}
 * />
 * ```
 */
export const ButtonNewAssetAction = React.memo(ButtonNewAssetActionComponent);

ButtonNewAssetAction.displayName = 'ButtonNewAssetAction';
