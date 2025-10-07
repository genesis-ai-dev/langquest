'use client';

import * as Slot from '@/components/ui/slot';
import { cn, getThemeColor } from '@/utils/styleUtils';
import type {
  BottomSheetModalProps,
  BottomSheetModal as BSModalType
} from '@gorhom/bottom-sheet';
import {
  BottomSheetBackdrop,
  BottomSheetHandle,
  BottomSheetModal,
  BottomSheetModalProvider,
  BottomSheetView,
  useBottomSheet
} from '@gorhom/bottom-sheet';
import { Portal, PortalHost } from '@rn-primitives/portal';
import { cssInterop } from 'nativewind';
import * as React from 'react';
import { Pressable, View } from 'react-native';
import { buttonVariants } from '../button';
import { Text } from '../text';
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
    if (open !== isOpen) {
      setIsOpen(open);
      if (open) {
        ref.current?.present();
      } else {
        ref.current?.dismiss();
      }
    }
  }, [open, isOpen]);

  const handleSetOpen = React.useCallback(
    (newOpen: boolean) => {
      setIsOpen(newOpen);
      onOpenChange?.(newOpen);
      if (newOpen) {
        ref.current?.present();
      } else {
        ref.current?.dismiss();
      }
    },
    [onOpenChange]
  );

  return (
    <DrawerContext.Provider
      value={{
        ref,
        open: isOpen,
        setOpen: handleSetOpen,
        ...drawerProps
      }}
    >
      <BottomSheetModalProvider>{children}</BottomSheetModalProvider>
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

  // Render directly as Pressable to avoid Slot navigation context issues during transitions
  if (!asChild) {
    return (
      <Pressable onPress={() => context?.setOpen(true)} {...props}>
        {children}
      </Pressable>
    );
  }

  return (
    <Slot.Pressable onPress={() => context?.setOpen(true)} {...props}>
      {children}
    </Slot.Pressable>
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
    context?.setOpen(false);
  };

  // Render directly as Pressable to avoid Slot navigation context issues during transitions
  if (!asChild) {
    return (
      <Pressable
        onPress={handlePress}
        {...props}
        className={cn(buttonVariants({ variant: 'outline', className }))}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <Slot.Pressable
      onPress={handlePress}
      {...props}
      className={cn(buttonVariants({ variant: 'outline', className }))}
    >
      {children}
    </Slot.Pressable>
  );
}

// DrawerOverlay - backdrop component
const DrawerOverlay = React.forwardRef<
  View,
  Omit<
    React.ComponentProps<typeof BottomSheetBackdrop>,
    'animatedIndex' | 'animatedPosition'
  >
>((props, _ref) => {
  const { animatedIndex, animatedPosition } = useBottomSheet();
  return (
    <Portal name="drawer-overlay" hostName="drawer-overlay-host">
      <BottomSheetBackdrop
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.5}
        animatedIndex={animatedIndex}
        animatedPosition={animatedPosition}
        {...props}
      />
    </Portal>
  );
});

function DrawerHandle({
  className,
  ...props
}: Omit<
  React.ComponentProps<typeof BSHandle>,
  'animatedIndex' | 'animatedPosition'
>) {
  const { animatedIndex, animatedPosition } = useBottomSheet();
  return (
    <Portal name="drawer-handle" hostName="drawer-handle-host">
      <BSHandle
        className={cn('bg-background pt-4', className)}
        animatedIndex={animatedIndex}
        indicatorClassName="h-1.5 w-[100px] shrink-0 rounded-full bg-secondary-foreground"
        animatedPosition={animatedPosition}
        {...props}
      />
    </Portal>
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
  const {
    open: _open,
    setOpen: _setOpen,
    ref: _ref,
    ...modalProps
  } = context ?? {};
  const handleSheetChanges = React.useCallback(
    (index: number) => {
      if (index === -1) {
        context?.setOpen(false);
      }
    },
    [context]
  );
  return (
    <BottomSheetModal
      ref={context?.ref}
      onChange={handleSheetChanges}
      backdropComponent={() => <PortalHost name="drawer-overlay-host" />}
      handleComponent={() => <PortalHost name="drawer-handle-host" />}
      backgroundStyle={{ backgroundColor: getThemeColor('background') }}
      enablePanDownToClose={true}
      enableOverDrag={false}
      {...modalProps}
    >
      <BottomSheetView
        className={cn('flex-1 bg-background', className)}
        {...props}
      >
        <DrawerHandle />
        <DrawerOverlay />
        {children}
      </BottomSheetView>
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
        'flex-col gap-0.5 p-4 text-center md:gap-1.5 md:text-left',
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
  DrawerHandle,
  DrawerHeader,
  DrawerOverlay,
  DrawerTitle,
  DrawerTrigger
};
