import { Drawer } from '@/components/Drawer';
import { useAuth } from '@/contexts/AuthContext';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { useSystem } from '@/contexts/SystemContext';
import { profile } from '@/db/drizzleSchema';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { eq } from 'drizzle-orm';
import { Redirect, Slot, SplashScreen } from 'expo-router';
import { PostHogSurveyProvider } from 'posthog-react-native';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function AuthLayout() {
  const [syncingTerms, setSyncingTerms] = useState(false);
  const { isLoading, currentUser } = useAuth();
  const system = useSystem();

  useEffect(() => {
    console.log('useAuth isLoading', isLoading);
    // if (isLoading) return;
    if (currentUser) {
      const asyncFunction = async () => {
        setSyncingTerms(true);
        const localTermsAcceptedAt =
          await AsyncStorage.getItem('terms_accepted');

        if (!currentUser.terms_accepted && localTermsAcceptedAt) {
          await system.db
            .update(profile)
            .set({
              terms_accepted: true,
              terms_accepted_at: localTermsAcceptedAt
            })
            .where(eq(profile.id, currentUser.id));
        }
        setSyncingTerms(false);

        await system.init();
        await system.tempAttachmentQueue?.init();
        await system.permAttachmentQueue?.init();
        console.log('System initialized');

        await SplashScreen.hideAsync();
      };
      void asyncFunction();
    }
  }, [currentUser, isLoading]);

  // Show loading state while checking authentication
  if (isLoading || syncingTerms) {
    console.log('AuthLayout is loading', isLoading, syncingTerms);
    return null;
  }

  // Redirect to index if not authenticated
  if (!currentUser) {
    console.log('Redirecting to sign-in');
    return <Redirect href="/sign-in" />;
  }

  if (!currentUser.terms_accepted) {
    return <Redirect href="/terms" />;
  }

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
