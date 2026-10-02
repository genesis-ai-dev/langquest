import { useEffect, useRef, useState } from 'react';

/**
 * Local text state that saves after the user stops typing, and flushes any
 * pending value on blur or unmount so closing the field never drops edits.
 */
export function useAutosaveText(
  initialValue: string,
  onSave: (value: string) => void,
  delayMs = 500
) {
  const [text, setText] = useState(initialValue);
  const pendingRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const flush = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (pendingRef.current !== null) {
      onSaveRef.current(pendingRef.current);
      pendingRef.current = null;
    }
  };

  const change = (value: string) => {
    setText(value);
    pendingRef.current = value;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, delayMs);
  };

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (pendingRef.current !== null) onSaveRef.current(pendingRef.current);
    },
    []
  );

  return { text, change, flush };
}
