import { InteractionManager, Keyboard } from 'react-native';
/**
 * Safely navigates to another screen by:
 * 1. Dismissing the keyboard,
 * 2. Waiting for all ongoing interactions and animations to finish,
 * 3. Waiting for the next UI frame,
 *
 * This helps prevent flickering or visual glitches during navigation.
 *
 * @param navigate A callback that performs the navigation (e.g., () => navigation.navigate('NextScreen'))
 */
export const safeNavigate = (navigate: () => void) => {
  Keyboard.dismiss();
  // Wait until all ongoing interactions/animations are complete
  InteractionManager.runAfterInteractions(() => {
    // Wait until the next UI frame before navigating
    requestAnimationFrame(() => {
      navigate();
    });
  });
};
