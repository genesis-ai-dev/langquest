'use no memo';

import * as Slot from '@/components/ui/slot';
import { cn, useThemeColor } from '@/utils/styleUtils';
import type {
  BottomSheetModalProps,
  BottomSheetModal as BSModalType
} from '@gorhom/bottom-sheet';
import {
  BottomSheetBackdrop,
  BottomSheetHandle,
  BottomSheetModal,
  BottomSheetModalProvider,
  BottomSheetTextInput as DrawerInput,
  BottomSheetScrollView as DrawerScrollView,
  BottomSheetView as DrawerView
} from '@gorhom/bottom-sheet';
import { cssInterop } from 'nativewind';
import * as React from 'react';
import { Keyboard, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../button';
import { Text } from '../text';

import type { BottomSheetScrollViewMethods } from '@gorhom/bottom-sheet';
import {
  createBottomSheetScrollableComponent,
  SCROLLABLE_TYPE
} from '@gorhom/bottom-sheet';
import type { BottomSheetScrollViewProps } from '@gorhom/bottom-sheet/src/components/bottomSheetScrollable/types';
import { memo } from 'react';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated from 'react-native-reanimated';

interface DrawerContextValue extends DrawerProps {
  ref: React.RefObject<BSModalType | null> | null;
  open: boolean;
  setOpen: (open: boolean) => void;
  dismissible?: boolean;
}

interface DrawerProps extends Omit<BottomSheetModalProps, 'children'> {
  snapPoints?: (string | number)[];
}

const DrawerContext = React.createContext<DrawerContextValue | null>(null);

// Drawer root component - wraps everything with context and provider
function Drawer({
  children,
  open = false,
  onOpenChange,
  direction: _direction,
  dismissible,
  ...drawerProps
}: {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  direction?: 'top' | 'bottom' | 'left' | 'right';
  dismissible?: boolean;
} & DrawerProps) {
  const ref = React.useRef<BSModalType | null>(null);
  const [isOpen, setIsOpen] = React.useState(open);
  const isOpenRef = React.useRef(open);
  // iOS fires onDismiss if present() runs in the same turn the portal mounts.
  const suppressDismissUntilRef = React.useRef(0);

  const onOpenChangeRef = React.useRef(onOpenChange);
  React.useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  }, [onOpenChange]);

  const syncOpen = React.useCallback((nextOpen: boolean) => {
    if (
      nextOpen === false &&
      Date.now() < suppressDismissUntilRef.current
    ) {
      return;
    }
    if (isOpenRef.current === nextOpen) return;
    isOpenRef.current = nextOpen;
    if (!nextOpen) {
      Keyboard.dismiss();
    }
    setIsOpen(nextOpen);
    onOpenChangeRef.current?.(nextOpen);
  }, []);

  React.useEffect(() => {
    syncOpen(open);
  }, [open, syncOpen]);

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    suppressDismissUntilRef.current = Date.now() + 500;
    const timer = setTimeout(() => {
      ref.current?.present();
    }, 50);
    return () => {
      clearTimeout(timer);
    };
  }, [isOpen]);

  // Extract only stable props we need from drawerProps
  // Don't spread drawerProps directly as it's a new object reference on every render
  const stableSnapPoints = drawerProps.snapPoints;
  const stableEnableDynamicSizing = drawerProps.enableDynamicSizing;
  const stableGestureEventsHandlersHook = drawerProps.gestureEventsHandlersHook;
  const stableAndroidKeyboardInputMode = drawerProps.android_keyboardInputMode;
  const stableStackBehavior = drawerProps.stackBehavior;

  // Memoize snapPoints array to prevent unnecessary re-renders
  const memoizedSnapPoints = React.useMemo(() => {
    return stableSnapPoints;
  }, [stableSnapPoints]);

  // Memoize context value to prevent re-renders when only isOpen changes
  // Only include stable props that are actually used by DrawerContent
  // Don't spread drawerProps - only include what's needed
  const contextValue = React.useMemo(() => {
    return {
      ref,
      open: isOpen,
      setOpen: syncOpen,
      snapPoints: memoizedSnapPoints,
      enableDynamicSizing: stableEnableDynamicSizing,
      gestureEventsHandlersHook: stableGestureEventsHandlersHook,
      dismissible,
      android_keyboardInputMode: stableAndroidKeyboardInputMode,
      stackBehavior: stableStackBehavior
    };
  }, [
    ref,
    isOpen,
    syncOpen,
    memoizedSnapPoints,
    stableEnableDynamicSizing,
    stableGestureEventsHandlersHook,
    dismissible,
    stableAndroidKeyboardInputMode,
    stableStackBehavior
  ]);

  return (
    <DrawerContext.Provider value={contextValue}>
      {children}
    </DrawerContext.Provider>
  );
}

// DrawerTrigger - button that opens the drawer
function DrawerTrigger({
  children,
  variant = 'default',
  ...props
}: {
  children: React.ReactNode;
} & React.ComponentProps<typeof Button>) {
  const context = React.useContext(DrawerContext);

  return (
    <Button
      variant={variant}
      onPress={() => {
        context?.setOpen(true);
      }}
      {...props}
    >
      {children}
    </Button>
  );
}

// DrawerClose - button that closes the drawer
function DrawerClose({
  children,
  variant,
  ...props
}: {
  children: React.ReactNode;
} & React.ComponentProps<typeof Button>) {
  const context = React.useContext(DrawerContext);

  return (
    <Button
      variant={variant ?? 'outline'}
      onPress={() => context?.setOpen(false)}
      {...props}
    >
      {children}
    </Button>
  );
}

const BSHandle = cssInterop(BottomSheetHandle, {
  className: 'style',
  indicatorClassName: 'indicatorStyle'
});

// DrawerContent - the main content container
const DrawerContent = React.forwardRef<
  BSModalType,
  {
    className?: string;
    children?: React.ReactNode;
    asChild?: boolean;
  } & Partial<React.ComponentProps<typeof DrawerView>>
>(({ className, children, asChild, ...props }, _forwardedRef) => {
  const context = React.useContext(DrawerContext);

  const {
    open,
    setOpen,
    ref: _ref,
    snapPoints: _snapPoints,
    gestureEventsHandlersHook,
    dismissible,
    ...modalProps
  } = context ?? {};

  const handleDismiss = React.useCallback(() => {
    setOpen?.(false);
  }, [setOpen]);

  const backgroundColor = useThemeColor('background');

  const { top, bottom } = useSafeAreaInsets();

  if (!open) {
    return null;
  }

  const Component = asChild
    ? Slot.Generic<React.ComponentPropsWithoutRef<typeof DrawerView>>
    : DrawerKeyboardAwareScrollView;

  return (
    <BottomSheetModal
      ref={context?.ref}
      accessible={Platform.select({
        // setting it to false on Android seems to cause issues with TalkBack instead
        ios: false
      })}
      onDismiss={handleDismiss}
      backdropComponent={({ animatedIndex, animatedPosition }) => (
        <BottomSheetBackdrop
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.5}
          pressBehavior={dismissible === false ? 'none' : 'close'}
          animatedIndex={animatedIndex}
          animatedPosition={animatedPosition}
          style={{ marginBottom: bottom, marginTop: top }}
        />
      )}
      topInset={top}
      bottomInset={bottom}
      handleComponent={({ animatedIndex, animatedPosition, ...props }) => (
        <BSHandle
          className="rounded-t-xl bg-background"
          animatedIndex={animatedIndex}
          animatedPosition={animatedPosition}
          indicatorClassName="h-1 w-[50px] shrink-0 rounded-full bg-secondary-foreground"
          {...props}
        />
      )}
      snapPoints={
        _snapPoints ?? []
        /*.filter((point) => point !== '100%')
        .concat(['100%'])*/
      }
      backgroundStyle={{ backgroundColor }}
      // enableContentPanningGesture={false}
      // enableDynamicSizing={typeof context?.snapPoints === 'undefined'}
      // enableOverDrag={false}
      enableBlurKeyboardOnGesture
      // keyboardBlurBehavior="restore"
      gestureEventsHandlersHook={gestureEventsHandlersHook}
      enablePanDownToClose={dismissible !== false}
      enableDismissOnClose
      // android_keyboardInputMode=""
      {...modalProps}
    >
      {/* Re-provide DrawerContext inside the portal so children can access it */}
      <DrawerContext.Provider value={context}>
        <Component
          className={cn(
            'flex flex-1 flex-col bg-background px-6',
            'z-[5000]',
            className
          )}
          {...(!asChild
            ? { keyboardShouldPersistTaps: 'handled' as const }
            : {})}
          {...props}
          bottomOffset={16}
        >
          {children as React.ReactElement}
        </Component>
      </DrawerContext.Provider>
    </BottomSheetModal>
  );
});

// DrawerHeader - header container
function DrawerHeader({
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

// DrawerFooter - footer container
function DrawerFooter({
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

// DrawerTitle - title text component
function DrawerTitle({
  className,
  children,
  testID = 'drawer-title',
  ...props
}: React.ComponentProps<typeof Text> & { className?: string }) {
  return (
    <Text
      className={className}
      variant="h4"
      testID={testID}
      accessibilityLabel={testID}
      {...props}
    >
      {children}
    </Text>
  );
}

// DrawerDescription - description text component
function DrawerDescription({
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

const AnimatedScrollView = Animated.createAnimatedComponent(
  KeyboardAwareScrollView
);
const BottomSheetScrollViewComponent = createBottomSheetScrollableComponent<
  BottomSheetScrollViewMethods,
  BottomSheetScrollViewProps
>(SCROLLABLE_TYPE.SCROLLVIEW, AnimatedScrollView);
const DrawerKeyboardAwareScrollView = memo(BottomSheetScrollViewComponent);

DrawerKeyboardAwareScrollView.displayName = 'DrawerKeyboardAwareScrollView';

export {
  BottomSheetModal,
  BottomSheetModalProvider,
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerInput,
  // DrawerKeyboardAwareScrollView,
  DrawerScrollView,
  DrawerTitle,
  DrawerTrigger,
  DrawerView
};
