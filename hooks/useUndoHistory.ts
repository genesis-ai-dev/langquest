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
 * Generic undo/redo history with a fixed max size.
 * Maintains a cursor so undo does not remove entries, enabling redo.
 */
export function useUndoHistory<
  TPreviousData = unknown,
  TNewData = unknown
>() {
  const [history, setHistory] = useState<{
    entries: UndoHistoryAction<TPreviousData, TNewData>[];
    pointer: number;
  }>({
    entries: [],
    pointer: -1
  });

  const push = useCallback(
    (entry: UndoHistoryAction<TPreviousData, TNewData>) => {
      setHistory((prev) => {
        // If user undid to the middle, discard redo tail before appending.
        const baseEntries = prev.entries.slice(0, prev.pointer + 1);
        const appended = [...baseEntries, entry];
        if (appended.length <= MAX_UNDO_OPERATIONS) {
          return {
            entries: appended,
            pointer: appended.length - 1
          };
        }

        const trimmed = appended.slice(appended.length - MAX_UNDO_OPERATIONS);
        return {
          entries: trimmed,
          pointer: trimmed.length - 1
        };
      });
    },
    []
  );

  const length = useCallback(() => history.pointer + 1, [history.pointer]);

  const list = useCallback(
    () => [...history.entries.slice(0, history.pointer + 1)],
    [history.entries, history.pointer]
  );

  const canUndo = history.pointer >= 0;
  const canRedo = history.pointer + 1 < history.entries.length;

  const peekUndo = useCallback(() => {
    if (history.pointer < 0) return undefined;
    return history.entries[history.pointer];
  }, [history.entries, history.pointer]);

  const peekRedo = useCallback(() => {
    const redoIndex = history.pointer + 1;
    if (redoIndex >= history.entries.length) return undefined;
    return history.entries[redoIndex];
  }, [history.entries, history.pointer]);

  const undo = useCallback(
    async (
      undoLastAction: (
        entry: UndoHistoryAction<TPreviousData, TNewData>
      ) => void | Promise<void>
    ) => {
      const last = history.pointer >= 0 ? history.entries[history.pointer] : null;
      if (!last) {
        return undefined;
      }

      await undoLastAction(last);

      setHistory((prev) => {
        if (prev.pointer < 0) return prev;
        return {
          ...prev,
          pointer: prev.pointer - 1
        };
      });

      return last;
    },
    [history.entries, history.pointer]
  );

  const redo = useCallback(
    async (
      redoNextAction: (
        entry: UndoHistoryAction<TPreviousData, TNewData>
      ) => void | Promise<void>
    ) => {
      const redoIndex = history.pointer + 1;
      const next =
        redoIndex >= 0 && redoIndex < history.entries.length
          ? history.entries[redoIndex]
          : null;
      if (!next) {
        return undefined;
      }

      await redoNextAction(next);

      setHistory((prev) => {
        const nextPointer = prev.pointer + 1;
        if (nextPointer >= prev.entries.length) return prev;
        return {
          ...prev,
          pointer: nextPointer
        };
      });

      return next;
    },
    [history.entries, history.pointer]
  );

  return {
    push,
    length,
    undo,
    redo,
    list,
    peekUndo,
    peekRedo,
    canUndo,
    canRedo
  };
}
