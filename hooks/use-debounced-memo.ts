'use client';

import * as React from 'react';
import { useDebouncedCallback } from './use-debounced-callback';

export function useDebouncedMemo<T>(
  factory: () => T,
  deps: React.DependencyList,
  delay: number
) {
  const [state, setState] = React.useState<T>(() => factory());

  const debouncedSetState = useDebouncedCallback(
    (value: T) => {
      setState(value);
    },
    [setState],
    delay
  );

  React.useEffect(() => {
    debouncedSetState(factory());
    // eslint-disable-next-line react-compiler/react-compiler
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, debouncedSetState, factory]);

  return state;
}
