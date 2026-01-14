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
import { View } from 'react-native';
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
import type { KeyboardAwareScrollViewProps } from 'react-native-keyboard-controller';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Reanimated from 'react-native-reanimated';

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

  React.useEffect(() => {
    setIsOpen(open);
  }, [open]);

  // Use a separate effect to handle presenting/dismissing to ensure ref is ready
  React.useEffect(() => {
    if (isOpen) {
      // Wait for ref to be available and allow layout to stabilize
      // This prevents positioning issues when views are still loading/rendering
      const presentModal = () => {
        if (ref.current) {
          // Present immediately - no delay needed with fullscreen snapPoints
          ref.current.present();
        } else {
          // Retry after a short delay if ref isn't ready yet
          setTimeout(presentModal, 50);
        }
      };
      presentModal();
    } else if (ref.current) {
      ref.current.dismiss();
    }
  }, [isOpen]);

  // Use ref to store onOpenChange to avoid recreating handleSetOpen when it changes
  const onOpenChangeRef = React.useRef(onOpenChange);
  React.useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  }, [onOpenChange]);

  const handleSetOpen = React.useCallback(
    (newOpen: boolean) => {
      setIsOpen(newOpen);
      onOpenChangeRef.current?.(newOpen);
      if (newOpen) {
        ref.current?.present();
      } else {
        ref.current?.dismiss();
      }
    },
    [] // Empty deps - use ref to access latest onOpenChange
  );

  // Extract only stable props we need from drawerProps
  // Don't spread drawerProps directly as it's a new object reference on every render
  const stableSnapPoints = drawerProps.snapPoints;
  const stableEnableDynamicSizing = drawerProps.enableDynamicSizing;
  const stableGestureEventsHandlersHook = drawerProps.gestureEventsHandlersHook;

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
      setOpen: handleSetOpen,
      snapPoints: memoizedSnapPoints,
      enableDynamicSizing: stableEnableDynamicSizing,
      gestureEventsHandlersHook: stableGestureEventsHandlersHook,
      dismissible
    };
  }, [
    ref,
    isOpen,
    handleSetOpen,
    memoizedSnapPoints,
    stableEnableDynamicSizing,
    stableGestureEventsHandlersHook,
    dismissible
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
    <Button variant={variant} onPress={() => context?.setOpen(true)} {...props}>
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
    open: _open,
    setOpen: _setOpen,
    ref: _ref,
    snapPoints: _snapPoints,
    gestureEventsHandlersHook,
    dismissible,
    ...modalProps
  } = context ?? {};
  // Extract setOpen to avoid depending on entire context object (which changes on every render)
  const setOpen = context?.setOpen;

  const handleSheetChanges = React.useCallback(
    (index: number) => {
      if (index === -1) {
        setOpen?.(false);
      }
    },
    [setOpen]
  );

  const backgroundColor = useThemeColor('background');

  const { top, bottom } = useSafeAreaInsets();

  const Component = asChild
    ? Slot.Generic<React.ComponentPropsWithoutRef<typeof DrawerView>>
    : DrawerKeyboardAwareScrollView;

  return (
    <BottomSheetModal
      ref={context?.ref}
      onChange={handleSheetChanges}
      backdropComponent={({ animatedIndex, animatedPosition }) => (
        <BottomSheetBackdrop
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.5}
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
      enableDismissOnClose={dismissible !== false}
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
  ...props
}: React.ComponentProps<typeof Text> & { className?: string }) {
  return (
    <Text className={className} variant="h4" {...props}>
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

const AnimatedScrollView =
  Reanimated.createAnimatedComponent<KeyboardAwareScrollViewProps>(
    KeyboardAwareScrollView as any
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
