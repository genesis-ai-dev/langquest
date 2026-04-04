import ResetPasswordView from '@/views/ResetPasswordView';
import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect } from 'react';

export default function ResetPasswordRoute() {
  const navigation = useNavigation();
  const parentNav = navigation.getParent();

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: false });
    parentNav?.setOptions({ gestureEnabled: false });
    return () => {
      parentNav?.setOptions({ gestureEnabled: true });
    };
  }, [navigation, parentNav]);

  const handleDismiss = useCallback(() => {
    if (parentNav?.canGoBack()) {
      parentNav.goBack();
    }
  }, [parentNav]);

  return <ResetPasswordView onDismiss={handleDismiss} />;
}
