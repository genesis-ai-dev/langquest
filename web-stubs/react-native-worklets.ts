// Web stub for react-native-worklets
// This module provides web-compatible implementations of worklets functions

// createSerializable is used by react-native-reanimated internally
// It should return an object with a .set() method
function createSerializable<T>(initialValue: T): { get(): T; set(newValue: T | ((current: T) => T)): void } {
  let value = initialValue;

  const serializable = {
    get() {
      return value;
    },
    set(newValue: T | ((current: T) => T)) {
      if (typeof newValue === 'function') {
        value = (newValue as (current: T) => T)(value);
      } else {
        value = newValue;
      }
    }
  };

  // Ensure we always return a valid object even if called incorrectly
  return serializable;
}

// scheduleOnRN schedules a callback to run on the React Native thread
// On web, we can just use setTimeout or requestAnimationFrame
function scheduleOnRN(callback: () => void): void {
  if (typeof callback === 'function') {
    // Use requestAnimationFrame for better performance on web
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => {
        try {
          callback();
        } catch (error) {
          console.warn('Error in scheduleOnRN callback:', error);
        }
      });
    } else {
      // Fallback to setTimeout
      setTimeout(() => {
        try {
          callback();
        } catch (error) {
          console.warn('Error in scheduleOnRN callback:', error);
        }
      }, 0);
    }
  }
}

// executeOnUIRuntimeSync - executes a function synchronously on UI thread
// On web, UI thread is the same as JS thread, so just execute directly
function executeOnUIRuntimeSync<Args extends unknown[], ReturnValue>(
  fn: (...args: Args) => ReturnValue
): (...args: Args) => ReturnValue {
  if (typeof fn === 'function') {
    return (...args: Args) => {
      try {
        return fn(...args);
      } catch (error) {
        console.warn('Error in executeOnUIRuntimeSync callback:', error);
        throw error;
      }
    };
  }
  return fn as (...args: Args) => ReturnValue;
}

export { createSerializable, scheduleOnRN, executeOnUIRuntimeSync };

