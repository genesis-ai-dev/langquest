import { Drawer } from '@/components/Drawer';
import { useAuth } from '@/contexts/AuthContext';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { colors } from '@/styles/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, Slot } from 'expo-router';
import { PostHogSurveyProvider } from 'posthog-react-native';
import { ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function AuthLayout() {
  const { isLoading, currentUser } = useAuth();

  // Redirect to index if not authenticated
  if (!currentUser) {
    console.log('Redirecting to sign-in');
    return <Redirect href="/sign-in" />;
  }

  // if (!currentUser.terms_accepted) {
  //   return <Redirect href="/terms" />;
  // }

  if (isLoading) {
    console.log('local store not hydrated');
    return (
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
      >
        <ActivityIndicator size="large" color={colors.text} />
      </LinearGradient>
    );
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
