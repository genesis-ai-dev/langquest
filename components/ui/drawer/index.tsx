'use no memo';

import * as Slot from '@/components/ui/slot';
import { cn, useThemeColor } from '@/utils/styleUtils';
import type {
  BottomSheetModalProps,
  BottomSheetView,
  BottomSheetModal as BSModalType
} from '@gorhom/bottom-sheet';
import {
  BottomSheetBackdrop,
  BottomSheetHandle,
  BottomSheetModal,
  BottomSheetModalProvider,
  BottomSheetTextInput as DrawerInput,
  BottomSheetScrollView as DrawerScrollView
} from '@gorhom/bottom-sheet';
import { cssInterop } from 'nativewind';
import * as React from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { buttonTextVariants, buttonVariants } from '../button';
import { Text, TextClassContext } from '../text';
interface DrawerContextValue extends DrawerProps {
  ref: React.RefObject<BSModalType | null> | null;
  open: boolean;
  setOpen: (open: boolean) => void;
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
  dismissible: _dismissible,
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

  // Memoize snapPoints array to prevent unnecessary re-renders
  const memoizedSnapPoints = React.useMemo(() => {
    const serialized = JSON.stringify(stableSnapPoints);
    if (__DEV__) {
      console.log('[Drawer] Memoizing snapPoints:', serialized);
    }
    return stableSnapPoints;
  }, [JSON.stringify(stableSnapPoints)]);

  // Track previous values for debugging
  const prevValuesRef = React.useRef({
    ref,
    isOpen,
    handleSetOpen,
    memoizedSnapPoints,
    stableEnableDynamicSizing
  });

  // Memoize context value to prevent re-renders when only isOpen changes
  // Only include stable props that are actually used by DrawerContent
  // Don't spread drawerProps - only include what's needed
  const contextValue = React.useMemo(() => {
    const newValue = {
      ref,
      open: isOpen,
      setOpen: handleSetOpen,
      snapPoints: memoizedSnapPoints,
      enableDynamicSizing: stableEnableDynamicSizing
    };

    if (__DEV__) {
      const prev = prevValuesRef.current;
      const changes: string[] = [];
      if (prev.ref !== newValue.ref) changes.push('ref');
      if (prev.isOpen !== newValue.open)
        changes.push(`isOpen: ${prev.isOpen} -> ${newValue.open}`);
      if (prev.handleSetOpen !== newValue.setOpen)
        changes.push('handleSetOpen');
      if (prev.memoizedSnapPoints !== newValue.snapPoints)
        changes.push('snapPoints');
      if (prev.stableEnableDynamicSizing !== newValue.enableDynamicSizing)
        changes.push('enableDynamicSizing');

      if (changes.length > 0) {
        console.log('[Drawer] Context value changed:', changes.join(', '));
      }

      prevValuesRef.current = {
        ref: newValue.ref,
        isOpen: newValue.open,
        handleSetOpen: newValue.setOpen,
        memoizedSnapPoints: newValue.snapPoints,
        stableEnableDynamicSizing: newValue.enableDynamicSizing
      };
    }

    return newValue;
  }, [
    ref,
    isOpen,
    handleSetOpen,
    memoizedSnapPoints,
    stableEnableDynamicSizing
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
  asChild,
  ...props
}: {
  children: React.ReactNode;
  asChild?: boolean;
} & React.ComponentProps<typeof Pressable>) {
  const context = React.useContext(DrawerContext);

  const Component = asChild ? Slot.Pressable : Pressable;

  return (
    <Component onPress={() => context?.setOpen(true)} {...props}>
      {children}
    </Component>
  );
}

// DrawerClose - button that closes the drawer
function DrawerClose({
  children,
  asChild,
  className,
  ...props
}: {
  children: React.ReactNode;
  asChild?: boolean;
} & React.ComponentProps<typeof Pressable>) {
  const context = React.useContext(DrawerContext);

  const handlePress = () => {
    // Also update state to keep things in sync
    context?.setOpen(false);
  };

  const Component = asChild ? Slot.Pressable : Pressable;

  return (
    <TextClassContext.Provider
      value={buttonTextVariants({
        variant: 'outline',
        className: cn('web:pointer-events-none', props.disabled && 'opacity-50')
      })}
    >
      <Component
        onPress={handlePress}
        className={cn(buttonVariants({ variant: 'outline' }), className)}
        {...props}
      >
        {children}
      </Component>
    </TextClassContext.Provider>
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
  } & Partial<React.ComponentProps<typeof BottomSheetView>>
>(({ className, children, ...props }, _forwardedRef) => {
  const context = React.useContext(DrawerContext);

  // Track renders for debugging
  const renderCountRef = React.useRef(0);
  const prevContextRef = React.useRef(context);

  if (__DEV__) {
    renderCountRef.current += 1;
    const renderCount = renderCountRef.current;

    if (renderCount > 1 && prevContextRef.current !== context) {
      const prev = prevContextRef.current;
      const changes: string[] = [];
      if (prev?.open !== context?.open)
        changes.push(`open: ${prev?.open} -> ${context?.open}`);
      if (prev?.setOpen !== context?.setOpen) changes.push('setOpen');
      if (prev?.snapPoints !== context?.snapPoints) changes.push('snapPoints');
      if (prev?.enableDynamicSizing !== context?.enableDynamicSizing)
        changes.push('enableDynamicSizing');
      if (prev?.ref !== context?.ref) changes.push('ref');

      console.log(
        `[DrawerContent] Render #${renderCount} - Context changed:`,
        changes.join(', ')
      );

      if (renderCount > 10) {
        console.warn(
          `[DrawerContent] ⚠️ High render count: ${renderCount} renders detected!`
        );
      }
    } else if (renderCount > 1) {
      console.log(
        `[DrawerContent] Render #${renderCount} - Context unchanged (same reference)`
      );
    }

    prevContextRef.current = context;
  }

  const {
    open: _open,
    setOpen: _setOpen,
    ref: _ref,
    snapPoints: _snapPoints,
    ...modalProps
  } = context ?? {};
  // Extract setOpen to avoid depending on entire context object (which changes on every render)
  const setOpen = context?.setOpen;

  const prevSetOpenRef = React.useRef(setOpen);
  if (__DEV__ && prevSetOpenRef.current !== setOpen) {
    console.log(
      '[DrawerContent] setOpen changed:',
      prevSetOpenRef.current !== setOpen
    );
    prevSetOpenRef.current = setOpen;
  }

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
          className={cn('rounded-t-xl bg-background', className)}
          animatedIndex={animatedIndex}
          animatedPosition={animatedPosition}
          indicatorClassName="h-1 w-[50px] shrink-0 rounded-full bg-secondary-foreground"
          {...props}
        />
      )}
      snapPoints={(_snapPoints ?? [])
        .filter((point) => point !== '100%')
        .concat(['100%'])}
      backgroundStyle={{ backgroundColor }}
      // enableContentPanningGesture={false}
      // enableDynamicSizing={typeof context?.snapPoints === 'undefined'}
      // enableOverDrag={false}
      enableBlurKeyboardOnGesture
      keyboardBlurBehavior="restore"
      // android_keyboardInputMode=""
      {...modalProps}
    >
      {/* Re-provide DrawerContext inside the portal so children can access it */}
      <DrawerContext.Provider value={context}>
        <DrawerScrollView
          className={cn('z-[9998] flex-1 bg-background px-4', className)}
          {...props}
        >
          {children}
        </DrawerScrollView>
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
    <View className={cn('mt-auto flex-col gap-2 p-4', className)} {...props}>
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
  DrawerScrollView,
  DrawerTitle,
  DrawerTrigger
};
