import { useCallback, useEffect, useRef } from 'react';
import { profiler, trackEffect, trackStateUpdate } from '../utils/profiler';

interface UseProfilerOptions {
  componentName: string;
  trackRenders?: boolean;
  trackEffects?: boolean;
  trackStateUpdates?: boolean;
}

/**
 * Hook to easily integrate performance profiling into React components
 */
export function useProfiler({
  componentName,
  trackRenders = true,
  trackEffects = true,
  trackStateUpdates = true
}: UseProfilerOptions) {
  const renderCountRef = useRef(0);

  // Track component renders
  useEffect(() => {
    if (trackRenders) {
      renderCountRef.current++;
      profiler.trackRender(componentName);
    }
  });

  // Helper to track useEffect execution
  const trackEffectExecution = useCallback(
    (effectId: string, dependencies?: unknown[]) => {
      if (!trackEffects) return () => {};
      return trackEffect(componentName, effectId, dependencies);
    },
    [componentName, trackEffects]
  );

  // Helper to track state updates
  const trackState = useCallback(
    (stateName: string, oldValue?: unknown, newValue?: unknown) => {
      if (trackStateUpdates) {
        trackStateUpdate(componentName, stateName, oldValue, newValue);
      }
    },
    [componentName, trackStateUpdates]
  );

  return {
    trackEffect: trackEffectExecution,
    trackState,
    renderCount: renderCountRef.current
  };
}
