'use client';
'use no memo';

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
  BottomSheetTextInput as DrawerInput,
  BottomSheetScrollView as DrawerScrollView
} from '@gorhom/bottom-sheet';
import { cssInterop } from 'nativewind';
import * as React from 'react';
import { Pressable, View } from 'react-native';
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
    } else if (!isOpen && ref.current) {
      ref.current.dismiss();
    }
  }, [isOpen]);

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
    context?.setOpen(false);
  };

  const Component = asChild ? Slot.Pressable : Pressable;

  return (
    <TextClassContext.Provider
      value={buttonTextVariants({
        variant: 'outline'
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

  // Convert snapPoints from string percentages to numbers if needed
  // BottomSheetModal expects numbers: 0-1 for percentages, pixel numbers for pixels
  const processedSnapPoints = React.useMemo(() => {
    const snapPoints =
      'snapPoints' in modalProps ? modalProps.snapPoints : undefined;
    if (!snapPoints) return undefined;

    const converted = snapPoints.map((point: string | number) => {
      // Already a number, return as-is
      if (typeof point === 'number') return point;

      // Handle percentage strings like "85%" -> 0.85
      if (typeof point === 'string' && point.includes('%')) {
        return Number(point.replace('%', '')) / 100;
      }

      // Handle pixel strings like "500px" -> 500
      if (typeof point === 'string' && point.includes('px')) {
        return Number(point.replace('px', ''));
      }

      // Fallback: try to parse as number
      return Number(point);
    });

    return converted;
  }, [modalProps]);

  // Extract snapPoints from modalProps to avoid passing it twice
  // TypeScript doesn't recognize snapPoints in the spread type, but it's safe to extract
  const { snapPoints: _snapPoints, ...restModalProps } =
    modalProps as typeof modalProps & { snapPoints?: (string | number)[] };

  return (
    <BottomSheetModal
      ref={context?.ref}
      onChange={handleSheetChanges}
      {...(processedSnapPoints ? { snapPoints: processedSnapPoints } : {})}
      backdropComponent={({ animatedIndex, animatedPosition }) => (
        <BottomSheetBackdrop
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.5}
          animatedIndex={animatedIndex}
          animatedPosition={animatedPosition}
          {...props}
        />
      )}
      handleComponent={({ animatedIndex, animatedPosition, ...props }) => (
        <BSHandle
          className={cn('bg-background pt-4', className)}
          animatedIndex={animatedIndex}
          indicatorClassName="h-1.5 w-[100px] shrink-0 rounded-full bg-secondary-foreground"
          animatedPosition={animatedPosition}
          {...props}
        />
      )}
      backgroundStyle={{ backgroundColor: getThemeColor('background') }}
      enablePanDownToClose={true}
      enableContentPanningGesture={false}
      enableOverDrag={false}
      enableDynamicSizing={!processedSnapPoints}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      topInset={0}
      {...restModalProps}
    >
      <BottomSheetView
        className={cn('z-[9998] bg-background', className)}
        {...props}
      >
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
  DrawerHeader,
  DrawerInput,
  DrawerScrollView,
  DrawerTitle,
  DrawerTrigger
};
