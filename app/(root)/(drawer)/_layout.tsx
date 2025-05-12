import { Drawer } from '@/components/Drawer';
import { useAuth } from '@/contexts/AuthContext';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { useLocalStore } from '@/store/localStore';
import { Redirect, Slot, SplashScreen } from 'expo-router';
import { PostHogSurveyProvider } from 'posthog-react-native';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function AuthLayout() {
  const dateTermsAccepted = useLocalStore((state) => state.dateTermsAccepted);
  const { isLoading, currentUser } = useAuth();

  useEffect(() => {
    if (!isLoading) void SplashScreen.hideAsync();
  }, [isLoading]);

  // Redirect to index if not authenticated
  if (!currentUser) {
    console.log('Redirecting to sign-in');
    return <Redirect href="/sign-in" />;
  }

  // if (!currentUser.terms_accepted) {
  //   return <Redirect href="/terms" />;
  // }

  // Render authenticated layout with drawer and terms guard
  return (
    <ProjectProvider>
      <PostHogSurveyProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <Drawer>
            <Slot />
          </Drawer>
        </GestureHandlerRootView>
      </PostHogSurveyProvider>
    </ProjectProvider>
  );
}
