import ResetPasswordView from '@/views/ResetPasswordView';
import { useNavigation } from '@react-navigation/native';
import { useCallback } from 'react';

export default function ResetPasswordRoute() {
  const navigation = useNavigation();
  const parentNav = navigation.getParent();

  const handleDismiss = useCallback(() => {
    if (parentNav?.canGoBack()) {
      parentNav.goBack();
    }
  }, [parentNav]);

  return <ResetPasswordView onDismiss={handleDismiss} />;
}
