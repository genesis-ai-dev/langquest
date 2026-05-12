import { useCallback, useState } from 'react';

export const MAX_UNDO_OPERATIONS = 10;

export interface UndoHistoryAction<
  TPreviousData = unknown,
  TNewData = unknown
> {
  domain: string;
  action: string;
  previousData: TPreviousData;
  newData: TNewData;
  canUndo: boolean;
}

/**
 * Generic undo history stack with a fixed max size.
 * Keeps the most recent actions and drops the oldest when full.
 */
export function useUndoHistory<
  TPreviousData = unknown,
  TNewData = unknown
>() {
  const [stack, setStack] = useState<
    UndoHistoryAction<TPreviousData, TNewData>[]
  >([]);

  const push = useCallback(
    (entry: UndoHistoryAction<TPreviousData, TNewData>) => {
      setStack((prev) => {
        const next = [...prev, entry];
        if (next.length <= MAX_UNDO_OPERATIONS) {
          return next;
        }

        // Keep stack behavior (LIFO) while capping total size.
        return next.slice(next.length - MAX_UNDO_OPERATIONS);
      });
    },
    []
  );

  const length = useCallback(() => stack.length, [stack.length]);

  const list = useCallback(() => [...stack], [stack]);

  const undo = useCallback(
    async (
      undoLastAction: (
        entry: UndoHistoryAction<TPreviousData, TNewData>
      ) => void | Promise<void>
    ) => {
      const last = stack[stack.length - 1];
      if (!last) {
        return undefined;
      }

      await undoLastAction(last);

      setStack((prev) => prev.slice(0, -1));

      return last;
    },
    [stack]
  );

  return {
    push,
    length,
    undo,
    list
  };
}
