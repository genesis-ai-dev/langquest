/// <reference types="jest" />

import { act, renderHook } from '@testing-library/react-native';
import { useSelectionMode } from '../useSelectionMode';

describe('useSelectionMode', () => {
  it('enters selection with the first id', async () => {
    const { result } = await renderHook(() => useSelectionMode());

    await act(() => {
      result.current.enterSelection('a');
    });

    expect(result.current.isSelectionMode).toBe(true);
    expect([...result.current.selectedAssetIds]).toEqual(['a']);
  });

  it('toggles ids and cancel clears the set', async () => {
    const { result } = await renderHook(() => useSelectionMode());

    await act(() => {
      result.current.enterSelection('a');
    });
    await act(() => {
      result.current.toggleSelect('b');
    });
    expect(result.current.selectedAssetIds.has('a')).toBe(true);
    expect(result.current.selectedAssetIds.has('b')).toBe(true);

    await act(() => {
      result.current.toggleSelect('a');
    });
    expect(result.current.selectedAssetIds.has('a')).toBe(false);

    await act(() => {
      result.current.cancelSelection();
    });
    expect(result.current.isSelectionMode).toBe(false);
    expect(result.current.selectedAssetIds.size).toBe(0);
  });

  it('selectMultiple replaces the current set', async () => {
    const { result } = await renderHook(() => useSelectionMode());

    await act(() => {
      result.current.enterSelection('a');
    });
    await act(() => {
      result.current.selectMultiple(['b', 'c']);
    });

    expect(result.current.isSelectionMode).toBe(true);
    expect([...result.current.selectedAssetIds].sort()).toEqual(['b', 'c']);
  });
});
