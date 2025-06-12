import { Drawer } from '@/components/Drawer';
import { useAuth } from '@/contexts/AuthContext';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { colors } from '@/styles/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect } from 'expo-router';
import { PostHogSurveyProvider } from 'posthog-react-native';
import { ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function AuthLayout() {
  const { isLoading, currentUser } = useAuth();

  if (isLoading) {
    return (
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
      >
        <ActivityIndicator size="large" color={colors.text} />
      </LinearGradient>
    );
  }

  if (!currentUser) {
    console.log('Redirecting to sign-in');
    return <Redirect href="/sign-in" />;
  }

  return (
    <ProjectProvider>
      <PostHogSurveyProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <Drawer />
        </GestureHandlerRootView>
      </PostHogSurveyProvider>
    </ProjectProvider>
  );
}
