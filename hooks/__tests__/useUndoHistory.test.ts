/// <reference types="jest" />

import { act, renderHook } from '@testing-library/react-native';
import { MAX_UNDO_OPERATIONS, useUndoHistory } from '../useUndoHistory';
import type { UndoHistoryAction } from '../useUndoHistory';

function entry(action: string): UndoHistoryAction<string, string> {
  return {
    domain: 'asset',
    action,
    previousData: action,
    newData: action,
    canUndo: true
  };
}

describe('useUndoHistory', () => {
  it('starts empty', async () => {
    const { result } = await renderHook(() => useUndoHistory());

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.length()).toBe(0);
    expect(result.current.peekUndo()).toBeUndefined();
    expect(result.current.peekRedo()).toBeUndefined();
  });

  it('push enables undo and peekUndo', async () => {
    const { result } = await renderHook(() => useUndoHistory());
    const create = entry('create');

    await act(() => {
      result.current.push(create);
    });

    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.length()).toBe(1);
    expect(result.current.peekUndo()).toEqual(create);
    expect(result.current.list()).toEqual([create]);
  });

  it('undo moves the pointer and redo restores it', async () => {
    const { result } = await renderHook(() => useUndoHistory());
    const create = entry('create');
    const undoFn = jest.fn();
    const redoFn = jest.fn();

    await act(() => {
      result.current.push(create);
    });

    await act(async () => {
      await result.current.undo(undoFn);
    });

    expect(undoFn).toHaveBeenCalledWith(create);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
    expect(result.current.peekRedo()).toEqual(create);
    expect(result.current.length()).toBe(0);

    await act(async () => {
      await result.current.redo(redoFn);
    });

    expect(redoFn).toHaveBeenCalledWith(create);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.peekUndo()).toEqual(create);
  });

  it('push after undo discards the redo tail', async () => {
    const { result } = await renderHook(() => useUndoHistory());
    const create = entry('create');
    const rename = entry('rename');
    const hide = entry('hide');

    await act(() => {
      result.current.push(create);
    });
    await act(() => {
      result.current.push(rename);
    });
    await act(async () => {
      await result.current.undo(jest.fn());
    });
    await act(() => {
      result.current.push(hide);
    });

    expect(result.current.canRedo).toBe(false);
    expect(result.current.list().map((item) => item.action)).toEqual([
      'create',
      'hide'
    ]);
  });

  it('caps history at MAX_UNDO_OPERATIONS', async () => {
    const { result } = await renderHook(() => useUndoHistory());

    for (let i = 0; i < MAX_UNDO_OPERATIONS + 1; i += 1) {
      await act(() => {
        result.current.push(entry(`op-${i}`));
      });
    }

    expect(result.current.list()).toHaveLength(MAX_UNDO_OPERATIONS);
    expect(result.current.list()[0]?.action).toBe('op-1');
    expect(result.current.peekUndo()?.action).toBe(`op-${MAX_UNDO_OPERATIONS}`);
  });

  it('undo and redo are no-ops on an empty stack', async () => {
    const { result } = await renderHook(() => useUndoHistory());
    const undoFn = jest.fn();
    const redoFn = jest.fn();

    await act(async () => {
      await result.current.undo(undoFn);
    });
    await act(async () => {
      await result.current.redo(redoFn);
    });

    expect(undoFn).not.toHaveBeenCalled();
    expect(redoFn).not.toHaveBeenCalled();
  });

  it('clear empties the stack', async () => {
    const { result } = await renderHook(() => useUndoHistory());

    await act(() => {
      result.current.push(entry('create'));
    });
    await act(() => {
      result.current.clear();
    });

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.length()).toBe(0);
  });
});
