import { useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';

/**
 * Dismisses the root `(auth)` form sheet back to guest home.
 * Uses the parent navigator so nested screens (register, forgot-password)
 * close the whole sheet instead of popping one auth route.
 */
export function useDismissAuthSheet() {
  const navigation = useNavigation();
  const router = useRouter();

  const dismissAuthSheet = useCallback(() => {
    const parentNav = navigation.getParent();
    if (parentNav?.canGoBack()) {
      parentNav.goBack();
      return;
    }
    router.replace('/');
  }, [navigation, router]);

  return { dismissAuthSheet };
}
