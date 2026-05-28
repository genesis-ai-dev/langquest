import { DrawerScrollView } from '@/components/ui/drawer';
import { cn } from '@/utils/styleUtils';
import type { ReactNode } from 'react';
import { View } from 'react-native';

export const CREATE_PROJECT_FOOTER_BOTTOM_PADDING = 16;
export const CREATE_PROJECT_FOOTER_TOP_SPACING = 16;
export const CREATE_PROJECT_FOOTER_ACTION_HEIGHT = 48;

export function getCreateProjectFooterBarHeight(footerBottomPadding: number) {
  return CREATE_PROJECT_FOOTER_ACTION_HEIGHT + 8 + footerBottomPadding;
}

interface CreateProjectStepLayoutProps {
  children: ReactNode;
  footer: ReactNode;
  scrollGap?: 'none' | 'default';
  scrollPaddingBottom?: number;
  footerTopSpacing?: number;
  footerBottomPadding: number;
  /** Pinned to drawer bottom (scrollable steps). Inline sits directly under content. */
  footerPlacement?: 'fixed' | 'inline';
}

export function CreateProjectStepLayout({
  children,
  footer,
  scrollGap = 'default',
  scrollPaddingBottom = 0,
  footerTopSpacing = 8,
  footerBottomPadding,
  footerPlacement = 'fixed'
}: CreateProjectStepLayoutProps) {
  const scrollContentClassName = cn(
    'flex-col px-6',
    scrollGap === 'none' ? 'gap-0' : 'gap-6'
  );

  const footerNode = (
    <View
      className="bg-background"
      style={{
        paddingTop: footerTopSpacing,
        paddingBottom: footerBottomPadding
      }}
    >
      {footer}
    </View>
  );

  if (footerPlacement === 'inline') {
    return (
      <View className="min-h-0 flex-1 flex-col">
        <DrawerScrollView
          className="min-h-0"
          contentContainerClassName={scrollContentClassName}
          contentContainerStyle={{ flexGrow: 0 }}
          keyboardShouldPersistTaps="handled"
        >
          {children}
          {footerNode}
        </DrawerScrollView>
      </View>
    );
  }

  return (
    <View className="min-h-0 flex-1 flex-col">
      <DrawerScrollView
        className="min-h-0 flex-1"
        contentContainerClassName={scrollContentClassName}
        contentContainerStyle={{ paddingBottom: scrollPaddingBottom }}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </DrawerScrollView>

      <View className="shrink-0 px-6">{footerNode}</View>
    </View>
  );
}
