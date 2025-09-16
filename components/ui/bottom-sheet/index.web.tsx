import { cn } from '@/utils/styleUtils';
import type { ComponentProps, FC } from 'react';
import { Fragment, forwardRef, useMemo } from 'react';
import { Platform } from 'react-native';
import { Drawer } from 'vaul';
import type { BSHandleProps } from './types';
import { convertSnapPoints } from './util';

const BottomSheet = Fragment;

const BottomSheetView = forwardRef<
  HTMLDivElement,
  {
    children: React.ReactNode;
    ref?: React.Ref<HTMLDivElement>;
    className?: string;
  }
>(({ children, className }, ref) => (
  <Drawer.Portal>
    <Drawer.Overlay className="fixed inset-0 bg-white/40 dark:bg-black/40" />
    <Drawer.Content
      ref={ref}
      className={cn(
        'fixed bottom-0 left-0 right-0 mt-24 flex h-full flex-col rounded-t-[10px] bg-background shadow-lg',
        className
      )}
    >
      {children}
    </Drawer.Content>
  </Drawer.Portal>
));

const BottomSheetModalProvider = Fragment;

type BottomSheetModal = ComponentProps<typeof Drawer.Content>;

const BottomSheetModal = ({
  children,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isOpen,
  snapPoints,
  ...rest
}: {
  children: React.ReactNode;
  isOpen?: boolean;
  snapPoints?: string[];
}) => {
  const combinedSnapPoints = useMemo(() => {
    // Vaul uses different snap points format
    return convertSnapPoints(snapPoints || []);
  }, [snapPoints]);

  return (
    <Drawer.Root {...rest} snapPoints={combinedSnapPoints}>
      {children}
    </Drawer.Root>
  );
};

const BottomSheetScrollView = ({ children }: { children: React.ReactNode }) => (
  <>{children} </>
);

const BottomSheetTrigger = Platform.OS === 'web' ? Drawer.Trigger : Fragment;

const BottomSheetHandle: FC<
  BSHandleProps & {
    className?: string;
    animatedIndex?: number;
    animatedPosition?: number;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
> = ({ animatedIndex = undefined, animatedPosition = undefined, ...rest }) => {
  if (Platform.OS === 'web') return <Drawer.Handle {...rest} />;
  return <Fragment />;
};

export {
  BottomSheet,
  BottomSheetHandle,
  BottomSheetModal,
  BottomSheetModalProvider,
  BottomSheetScrollView,
  BottomSheetTrigger,
  BottomSheetView
};
