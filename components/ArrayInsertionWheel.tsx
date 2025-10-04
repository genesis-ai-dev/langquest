import React from 'react';
import { Platform } from 'react-native';
import type { ArrayInsertionListHandle } from './ArrayInsertionList';
import ArrayInsertionList from './ArrayInsertionList';

export interface ArrayInsertionWheelHandle {
  scrollToInsertionIndex: (index: number, animated?: boolean) => void;
  getInsertionIndex: () => number;
  scrollItemToTop: (index: number, animated?: boolean) => void;
}

interface Props {
  children: React.ReactNode[];
  value: number;
  onChange?: (index: number) => void;
  rowHeight: number;
  className?: string;
  topInset?: number;
  bottomInset?: number;
}

const ArrayInsertionWheel = React.forwardRef<ArrayInsertionWheelHandle, Props>(
  function ArrayInsertionWheelInner(
    { children, className, ...rest }: Props,
    ref
  ) {
    if (Platform.OS === 'web') {
      return (
        <ArrayInsertionList
          ref={ref as React.Ref<ArrayInsertionListHandle>}
          className={className}
          {...rest}
        >
          {children}
        </ArrayInsertionList>
      );
    }
    // Dynamically require native to satisfy TS resolution without platform suffix support
    const NativeWheel = require('./ArrayInsertionWheel.native')
      .default as React.ComponentType<
      Props & { ref?: React.Ref<ArrayInsertionWheelHandle> }
    >;
    return (
      <NativeWheel ref={ref} className={className} {...rest}>
        {children}
      </NativeWheel>
    );
  }
);

export default ArrayInsertionWheel;
