import { Drawer } from '@/components/Drawer';
import { useAuth } from '@/contexts/AuthContext';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { useSystem } from '@/db/powersync/system';
import { colors } from '@/styles/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, Slot } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function AuthLayout() {
  const { isLoading, currentUser } = useAuth();
  const system = useSystem();

  useEffect(() => {
    if (currentUser) {
      const initSystem = async () => {
        await system.init();
        console.log('System initialized');
        system.tempAttachmentQueue?.init();
        system.permAttachmentQueue?.init();
      };
      initSystem();
    }
  }, [currentUser, isLoading]);

  // Show loading state while checking authentication
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

  // Redirect to index if not authenticated
  if (!currentUser) {
    console.log('Redirecting to sign-in');
    return <Redirect href="/sign-in" />;
  }

  if (currentUser && !currentUser?.terms_accepted) {
    return <Redirect href="/terms" />;
  }

  // Render authenticated layout with drawer and terms guard
  return (
    <ProjectProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        {/* <TermsGuard> */}
        <Drawer>
          <Slot />
        </Drawer>
        {/* </TermsGuard> */}
      </GestureHandlerRootView>
    </ProjectProvider>
  );
}
