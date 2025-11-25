import { Platform, Alert } from 'react-native';

// Import react-native-alerts for native platforms
// Using dynamic import to avoid type errors on web
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Alerts: any = null;
if (Platform.OS !== 'web') {
  try {
    // @ts-expect-error - react-native-alerts doesn't have TypeScript types
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    const AlertsModule = require('react-native-alerts');
    Alerts = AlertsModule.default || AlertsModule;
  } catch (e) {
    // Package not available, fallback to React Native Alert
  }
}

type AlertButton = {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

type AlertOptions = {
  cancelable?: boolean;
};

/**
 * Cross-platform alert function that works on iOS, Android, and Web
 * Uses react-native-alerts on native platforms and React Native Alert on web
 */
export function alert(
  title?: string,
  message?: string,
  buttons?: AlertButton[],
  options?: AlertOptions
): void {
  const alertTitle = title ?? '';
  const alertMessage = message ?? '';

  if (Platform.OS === 'web') {
    // On web, use React Native's Alert which works cross-platform
    Alert.alert(alertTitle, alertMessage, buttons, options);
    return;
  }

  // On native platforms, use react-native-alerts if available
  if (Alerts && typeof Alerts.alert === 'function') {
    if (buttons && buttons.length > 0) {
      // Multiple buttons - use confirm for 2 buttons, or show first button for single button
      if (buttons.length === 1) {
        const button = buttons[0];
        if (button) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          Alerts.alert(
            {
              title: alertTitle,
              message: alertMessage,
              button: button.text ?? 'OK'
            },
            () => {
              button.onPress?.();
            }
          );
        }
      } else if (buttons.length === 2 && typeof Alerts.confirm === 'function') {
        // Two buttons - use confirm
        const cancelButton =
          buttons.find((b) => b.style === 'cancel') ?? buttons[0];
        const otherButton =
          buttons.find((b) => b.style !== 'cancel') ?? buttons[1];

        if (cancelButton && otherButton) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          Alerts.confirm(
            {
              title: alertTitle,
              message: alertMessage,
              accept: otherButton.text ?? 'OK',
              cancel: cancelButton.text ?? 'Cancel'
            },
            (accepted: boolean) => {
              if (accepted && otherButton) {
                otherButton.onPress?.();
              } else if (cancelButton) {
                cancelButton.onPress?.();
              }
            }
          );
        } else {
          // Fallback if buttons are undefined
          Alert.alert(alertTitle, alertMessage, buttons, options);
        }
      } else {
        // More than 2 buttons - fallback to React Native Alert
        Alert.alert(alertTitle, alertMessage, buttons, options);
      }
    } else {
      // No buttons specified - use default OK button
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      Alerts.alert(
        {
          title: alertTitle,
          message: alertMessage,
          button: 'OK'
        },
        () => {
          // No callback needed
        }
      );
    }
  } else {
    // Fallback to React Native Alert if react-native-alerts is not available
    Alert.alert(alertTitle, alertMessage, buttons, options);
  }
}
