import { useCallback, useEffect, useRef } from 'react';

// Gorhom close() leaves the sheet on the modal stack until the animation
// finishes. Presenting a second sheet in the same tick stacks on top; when
// that second sheet closes, the first one comes back with open=false, so
// Cancel is a no-op. Wait for dismiss before presenting the next sheet.
const HANDOFF_MS = 350;

/** Close one Drawer, then open the next. Used by every discovery → confirmation flow. */
export function useSheetHandoff() {
  const handingOffRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handoff = useCallback(
    (closeFirst: () => void, openSecond: () => void) => {
      handingOffRef.current = true;
      closeFirst();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        openSecond();
        timerRef.current = null;
      }, HANDOFF_MS);
    },
    []
  );

  const isHandingOff = useCallback(() => handingOffRef.current, []);

  const endHandoff = useCallback(() => {
    handingOffRef.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return { handoff, isHandingOff, endHandoff };
}
