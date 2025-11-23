/**
 * ContextMenu Component
 *
 * A flexible context menu component that displays a popup menu when triggered.
 * Automatically positions itself to avoid screen edges and can be dismissed by
 * clicking outside the menu.
 *
 * Features:
 * - Auto-positioning: Automatically flips to opposite side if menu would go off-screen
 * - Smart alignment: Adjusts horizontal position to stay within screen bounds
 * - Outside click dismissal: Clicking anywhere outside the menu closes it
 * - Customizable trigger: Use default "..." icon or provide custom trigger element
 * - Icon support: Menu items can include icons
 * - Destructive styling: Mark items as destructive for delete/remove actions
 *
 * Usage:
 * ```tsx
 * <ContextMenu
 *   side="bottom"        // Menu appears below trigger (or "top" for above)
 *   align="end"          // Aligns to right edge of trigger (or "start"/"left"/"right")
 *   items={[
 *     {
 *       label: "Edit",
 *       icon: EditIcon,
 *       onPress: () => handleEdit()
 *     },
 *     {
 *       label: "Delete",
 *       icon: TrashIcon,
 *       destructive: true,
 *       onPress: () => handleDelete()
 *     }
 *   ]}
 * />
 *
 * // With custom trigger:
 * <ContextMenu
 *   trigger={<Button>Actions</Button>}
 *   items={[...]}
 * />
 * ```
 *
 * Positioning Logic:
 * - The menu measures both the trigger position and its own dimensions
 * - If the menu would overflow the screen, it automatically flips to the opposite side
 * - If it still doesn't fit, it positions itself at the screen edge with padding
 * - Position is calculated once and locked to prevent jittering during layout measurements
 */

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/utils/styleUtils';
import type { LucideIcon } from 'lucide-react-native';
import { EllipsisVerticalIcon } from 'lucide-react-native';
import React, { useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Modal, Pressable, View, useWindowDimensions } from 'react-native';

/**
 * Menu item configuration
 */
export interface ContextMenuItem {
  label: string;
  icon?: LucideIcon;
  onPress: () => void;
  destructive?: boolean;
}

/**
 * ContextMenu component props
 */
interface ContextMenuProps {
  /** Custom trigger element. If not provided, defaults to "..." icon */
  trigger?: React.ReactNode;
  /** Array of menu items to display */
  items: ContextMenuItem[];
  /** Which side of the trigger to show the menu (default: "bottom") */
  side?: 'top' | 'bottom';
  /** Horizontal alignment relative to trigger (default: "end" = right-aligned) */
  align?: 'left' | 'right' | 'start' | 'end';
}

export function ContextMenu({
  trigger,
  items,
  side = 'top',
  align = 'end'
}: ContextMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPositioned, setIsPositioned] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerLayoutRef = useRef({
    x: 0,
    y: 0,
    width: 0,
    height: 0
  });
  const triggerRef = useRef<View>(null);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  /**
   * Opens the menu and measures the trigger's position on screen
   * Uses measureInWindow to get absolute screen coordinates
   */
  const handleOpen = () => {
    setIsPositioned(false);
    triggerRef.current?.measureInWindow((pageX, pageY, width, height) => {
      triggerLayoutRef.current = {
        x: Math.round(pageX),
        y: Math.round(pageY),
        width: Math.round(width),
        height: Math.round(height)
      };
      setIsOpen(true);
    });
  };

  /**
   * Calculates menu position based on trigger location and menu dimensions.
   * Returns position locked to screen bounds.
   */
  const calculatePosition = (
    menuWidth: number,
    menuHeight: number,
    trigger: { x: number; y: number; width: number; height: number }
  ) => {
    const spacing = 8;
    let top = 0;
    let left = 0;

    // Vertical positioning
    if (side === 'bottom') {
      top = trigger.y + trigger.height + spacing;
      if (top + menuHeight > screenHeight) {
        top = trigger.y - menuHeight - spacing;
        if (top < 0) {
          top = screenHeight - menuHeight - 16;
        }
      }
    } else {
      top = trigger.y - menuHeight - spacing;
      if (top < 0) {
        top = trigger.y + trigger.height + spacing;
        if (top + menuHeight > screenHeight) {
          top = 16;
        }
      }
    }

    // Horizontal positioning
    if (align === 'end' || align === 'right') {
      left = trigger.x + trigger.width - menuWidth;
      if (left < 0) {
        left = screenWidth - menuWidth - 16;
      }
    } else {
      left = trigger.x;
      if (left + menuWidth > screenWidth) {
        left = 16;
      }
    }

    // Clamp to screen bounds
    return {
      top: Math.max(16, Math.min(top, screenHeight - menuHeight - 16)),
      left: Math.max(16, Math.min(left, screenWidth - menuWidth - 16))
    };
  };

  /**
   * Called when the menu's layout is measured.
   * Calculates position once and locks it to prevent feedback loops.
   */
  const handleMenuLayout = (event: LayoutChangeEvent) => {
    if (isPositioned) return;

    const { width, height } = event.nativeEvent.layout;
    const menuWidth = Math.round(width);
    const menuHeight = Math.round(height);

    if (menuWidth === 0 || menuHeight === 0) return;

    const newPosition = calculatePosition(
      menuWidth,
      menuHeight,
      triggerLayoutRef.current
    );

    setPosition({
      top: Math.round(newPosition.top),
      left: Math.round(newPosition.left)
    });
    setIsPositioned(true);
  };

  const handleItemPress = (item: ContextMenuItem) => {
    setIsOpen(false);
    setIsPositioned(false);
    item.onPress();
  };

  return (
    <>
      <View ref={triggerRef} collapsable={false} className="self-start">
        <Pressable onPress={handleOpen}>
          {trigger || (
            <Icon
              as={EllipsisVerticalIcon}
              size={20}
              className="text-muted-foreground"
            />
          )}
        </Pressable>
      </View>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable style={{ flex: 1 }} onPress={() => setIsOpen(false)}>
          <View
            onLayout={handleMenuLayout}
            style={{
              position: 'absolute',
              top: position.top,
              left: position.left,
              minWidth: 160
            }}
            className="rounded-md border border-input bg-popover p-1 shadow-lg shadow-foreground/10"
          >
            {items.map((item, index) => (
              <Pressable
                key={index}
                onPress={() => handleItemPress(item)}
                className={cn(
                  'flex flex-row items-center gap-2 rounded-sm px-3 py-2 active:bg-accent',
                  item.destructive && 'text-destructive'
                )}
              >
                {item.icon && (
                  <Icon
                    as={item.icon}
                    size={16}
                    className={cn(
                      'text-foreground',
                      item.destructive && 'text-destructive'
                    )}
                  />
                )}
                <Text
                  className={cn(
                    'text-sm',
                    item.destructive ? 'text-destructive' : 'text-foreground'
                  )}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
