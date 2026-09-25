import { useCallback, useEffect, useRef } from 'react';

// Gorhom close() leaves the sheet on the modal stack until dismiss. Presenting
// the next sheet in the same tick stacks on top. Open the next sheet from
// onOpenChange(false) via completeHandoff(), with a short fallback if that
// event never fires.
const HANDOFF_FALLBACK_MS = 400;

/** Close one Drawer, then open the next. Used by every discovery → confirmation flow. */
export function useSheetHandoff() {
  const handingOffRef = useRef(false);
  const pendingOpenRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  const completeHandoff = useCallback(() => {
    const openSecond = pendingOpenRef.current;
    pendingOpenRef.current = null;
    handingOffRef.current = false;
    clearTimer();
    openSecond?.();
  }, [clearTimer]);

  const handoff = useCallback(
    (closeFirst: () => void, openSecond: () => void) => {
      handingOffRef.current = true;
      pendingOpenRef.current = openSecond;
      closeFirst();
      clearTimer();
      timerRef.current = setTimeout(() => {
        if (pendingOpenRef.current) {
          completeHandoff();
        }
      }, HANDOFF_FALLBACK_MS);
    },
    [clearTimer, completeHandoff]
  );

  const isHandingOff = useCallback(() => handingOffRef.current, []);

  const endHandoff = useCallback(() => {
    handingOffRef.current = false;
    pendingOpenRef.current = null;
    clearTimer();
  }, [clearTimer]);

  return { handoff, isHandingOff, endHandoff, completeHandoff };
}
