/**
 * SimpleDrawer - A lightweight bottom sheet drawer without gesture conflicts
 * Provides the same visual appearance as gorhom/bottom-sheet but with instant button response
 * Uses Reanimated for smooth animations and measures content height dynamically
 */

import { cn, useThemeColor } from '@/utils/styleUtils';
import React from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View
} from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import Animated, {
  FadeIn,
  FadeOut,
  runOnJS,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './text';
import { Button } from './button';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface SimpleDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  maxHeight?: number; // 0-1, percentage of screen height (default: 0.9)
  dismissible?: boolean; // Allow backdrop tap to close (default: true)
  className?: string;
}

interface SimpleDrawerContextValue {
  close: () => void;
}

const SimpleDrawerContext = React.createContext<SimpleDrawerContextValue | null>(
  null
);

// SimpleDrawerFooter - footer container (defined early for type checking)
export function SimpleDrawerFooter({
  className,
  children,
  ...props
}: React.ComponentProps<typeof View> & { className?: string }) {
  return (
    <View className={cn('mt-auto flex-col gap-2 py-4', className)} {...props}>
      {children}
    </View>
  );
}

export function SimpleDrawer({
  open,
  onOpenChange,
  children,
  maxHeight = 0.9,
  dismissible = true,
  className
}: SimpleDrawerProps) {
  const { height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const backgroundColor = useThemeColor('background');
  const secondaryForegroundColor = useThemeColor('secondary-foreground');

  // Measure content height and footer height
  const [contentHeight, setContentHeight] = React.useState(0);
  const [footerHeight, setFooterHeight] = React.useState(0);
  const measuredHeight = useSharedValue(0);
  const translateY = useSharedValue(screenHeight);
  const isDragging = useSharedValue(false);
  const dragStartY = useSharedValue(0);
  const dragStartTranslateY = useSharedValue(0);
  
  // Extract footer from children
  const { scrollableChildren, footerContent } = React.useMemo(() => {
    const scrollable: React.ReactNode[] = [];
    let footer: React.ReactNode = null;
    
    React.Children.forEach(children, (child) => {
      if (React.isValidElement(child) && child.type === SimpleDrawerFooter) {
        footer = child;
      } else {
        scrollable.push(child);
      }
    });
    
    return { scrollableChildren: scrollable, footerContent: footer };
  }, [children]);
  
  // Store callback in ref for worklet access
  const onOpenChangeRef = React.useRef(onOpenChange);
  React.useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  }, [onOpenChange]);
  
  // Wrapper function for runOnJS
  const handleClose = React.useCallback(() => {
    onOpenChangeRef.current(false);
  }, []);

  // Calculate max drawer height accounting for safe area insets at top
  // screenHeight includes the status bar/notch area, so we need to subtract insets.top
  // to get the actual usable screen height
  const usableScreenHeight = screenHeight - insets.top;
  const handleHeight = Math.max(insets.top, 8) + 12 + 4; // paddingTop + handle height + paddingBottom
  const maxDrawerHeight = usableScreenHeight * maxHeight;
  
  // When at 100%, max content height is usable screen height minus handle and footer height
  // For other percentages, use the percentage directly (handle and footer are included in the percentage)
  const maxContentHeight = maxHeight >= 1.0 
    ? usableScreenHeight - handleHeight - footerHeight
    : maxDrawerHeight - handleHeight - footerHeight;
  
  // Use content height, but ensure minimum 50% and allow up to maxContentHeight if content is tall
  const targetContentHeight = contentHeight > 0 
    ? Math.min(Math.max(contentHeight, usableScreenHeight * 0.5), maxContentHeight)
    : maxContentHeight;
  
  // Total drawer height = content height + handle height + footer height
  // This should never exceed usableScreenHeight
  const targetDrawerHeight = Math.min(targetContentHeight + handleHeight + footerHeight, usableScreenHeight);

  // Content measurement handled via onContentSizeChange in ScrollView

  // Initialize translateY when component mounts or screenHeight changes
  React.useEffect(() => {
    if (!open) {
      translateY.value = screenHeight;
    }
  }, [screenHeight, translateY, open, insets.top]);

  // Animate drawer open/close - simple slide, no spring
  React.useEffect(() => {
    if (open) {
      // Open: slide up - use target drawer height
      // Position drawer so it ends at insets.top from the top of the screen
      measuredHeight.value = targetDrawerHeight;
      const targetTranslateY = screenHeight - targetDrawerHeight;
      translateY.value = withTiming(targetTranslateY, {
        duration: 300
      });
    } else {
      // Close: slide down
      translateY.value = withTiming(screenHeight, {
        duration: 250
      });
    }
  }, [open, screenHeight, targetDrawerHeight, translateY, measuredHeight, footerHeight]);

  // Removed duplicate effect - handled in handleContentLayout now

  // Pan gesture for drag handle (only on handle, not content)
  const panGesture = Gesture.Pan()
    .onStart(() => {
      'worklet';
      isDragging.value = true;
      dragStartY.value = 0;
      dragStartTranslateY.value = translateY.value;
    })
    .onUpdate((event) => {
      'worklet';
      // Can't drag above the safe area (status bar/notch)
      const minTranslateY = insets.top;
      const maxTranslateY = screenHeight - handleHeight;
      const newTranslateY = Math.max(
        minTranslateY,
        Math.min(maxTranslateY, dragStartTranslateY.value + event.translationY)
      );
      translateY.value = newTranslateY;
    })
    .onEnd((event) => {
      'worklet';
      isDragging.value = false;
      const currentHeight = screenHeight - translateY.value;
      const threshold = measuredHeight.value * 0.3; // Close if dragged down more than 30% of height

      if (event.translationY > threshold || translateY.value > screenHeight - 50) {
        // Close drawer
        translateY.value = withTiming(screenHeight, { duration: 250 });
        // Use runOnJS with wrapper function to avoid crash
        runOnJS(handleClose)();
      } else {
        // Snap back to open position - simple timing, no spring
        translateY.value = withTiming(screenHeight - measuredHeight.value, {
          duration: 250
        });
      }
    });

  // Animated styles
  const drawerStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
      height: isDragging.value ? undefined : measuredHeight.value
    };
  });

  const backdropStyle = useAnimatedStyle(() => {
    const opacity = open ? 0.5 : 0;
    return {
      opacity: withTiming(opacity, { duration: 200 })
    };
  });

  const contextValue: SimpleDrawerContextValue = {
    close: () => onOpenChange(false)
  };

  // Don't render at all when closed (after animation completes)
  if (!open) {
    return null;
  }

  return (
    <SimpleDrawerContext.Provider value={contextValue}>
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(200)}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 5000 }}
        pointerEvents="auto"
      >
        {/* Backdrop */}
        <AnimatedPressable
          style={backdropStyle}
          className="absolute inset-0 bg-black"
          onPress={dismissible ? () => onOpenChange(false) : undefined}
        />

        {/* Drawer panel */}
        <Animated.View
          entering={SlideInDown.duration(300)}
          exiting={SlideOutDown.duration(250)}
          style={[
            drawerStyle,
            {
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor,
              borderTopLeftRadius: 12,
              borderTopRightRadius: 12,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 8
            }
          ]}
          className={cn('overflow-hidden', className)}
        >
          {/* Drag handle */}
          <GestureDetector gesture={panGesture}>
            <View
              className="w-full items-center py-3"
              style={{ paddingTop: Math.max(insets.top, 8) }}
            >
              <View
                className="h-1 w-[50px] rounded-full"
                style={{ backgroundColor: secondaryForegroundColor }}
              />
            </View>
          </GestureDetector>

          {/* Scrollable content */}
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingBottom: footerContent ? 0 : Math.max(insets.bottom, 16) }}
            showsVerticalScrollIndicator={true}
            scrollEventThrottle={16}
            bounces={true}
            onContentSizeChange={(width, height) => {
              if (height > 0 && height !== contentHeight) {
                setContentHeight(height);
                // Content height is just the ScrollView content, not including handle or footer
                // Calculate drawer height = content + handle + footer, capped at usableScreenHeight
                const newContentHeight = Math.min(Math.max(height, usableScreenHeight * 0.5), maxContentHeight);
                const newDrawerHeight = newContentHeight + handleHeight + footerHeight;
                // Cap at usableScreenHeight to prevent exceeding safe area
                const finalDrawerHeight = Math.min(newDrawerHeight, usableScreenHeight);
                measuredHeight.value = finalDrawerHeight;
                if (open) {
                  translateY.value = withTiming(screenHeight - finalDrawerHeight, {
                    duration: 300
                  });
                }
              }
            }}
          >
            {scrollableChildren}
          </ScrollView>

          {/* Fixed footer at bottom */}
          {footerContent && (
            <View
              style={{
                borderTopWidth: 1,
                borderTopColor: useThemeColor('border'),
                backgroundColor,
                paddingBottom: Math.max(insets.bottom, 16),
                paddingTop: 16,
                paddingHorizontal: 24
              }}
              onLayout={(e) => {
                const height = e.nativeEvent.layout.height;
                if (height !== footerHeight) {
                  setFooterHeight(height);
                }
              }}
            >
              {footerContent}
            </View>
          )}
        </Animated.View>
      </Animated.View>
    </SimpleDrawerContext.Provider>
  );
}

// SimpleDrawerHeader - header container
export function SimpleDrawerHeader({
  className,
  children,
  ...props
}: React.ComponentProps<typeof View> & { className?: string }) {
  return (
    <View
      className={cn(
        'flex-col gap-0.5 py-4 text-center md:gap-1.5 md:text-left',
        className
      )}
      {...props}
    >
      {children}
    </View>
  );
}

// SimpleDrawerTitle - title text component
export function SimpleDrawerTitle({
  className,
  children,
  ...props
}: React.ComponentProps<typeof Text> & { className?: string }) {
  return (
    <Text className={className} variant="h4" {...props}>
      {children}
    </Text>
  );
}

// SimpleDrawerDescription - description text component
export function SimpleDrawerDescription({
  className,
  children,
  ...props
}: React.ComponentProps<typeof Text> & { className?: string }) {
  return (
    <Text className={cn('text-sm text-muted-foreground', className)} {...props}>
      {children}
    </Text>
  );
}

// SimpleDrawerClose - button that closes the drawer
export function SimpleDrawerClose({
  children,
  variant,
  ...props
}: {
  children: React.ReactNode;
} & React.ComponentProps<typeof Button>) {
  const context = React.useContext(SimpleDrawerContext);

  return (
    <Button
      variant={variant ?? 'outline'}
      onPress={() => context?.close()}
      {...props}
    >
      {children}
    </Button>
  );
}
