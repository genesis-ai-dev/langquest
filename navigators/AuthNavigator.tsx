import ForgotPasswordView from '@/views/ForgotPasswordView';
import RegisterView from '@/views/RegisterView';
import SignInView2 from '@/views/SignInView';
import React, { useCallback, useEffect, useState } from 'react';
import { BackHandler } from 'react-native';

export type AuthView = 'sign-in' | 'register' | 'forgot-password';

export interface SharedAuthInfo {
  email?: string;
}

export function AuthNavigator() {
  const [currentView, setCurrentView] = useState<AuthView>('sign-in');
  const [sharedAuthInfo, setSharedAuthInfo] = useState<SharedAuthInfo>({});
  const [navigationStack, setNavigationStack] = useState<AuthView[]>([
    'sign-in'
  ]);

  function handleNavigation(view: AuthView, sharedAuthInfo?: SharedAuthInfo) {
    setCurrentView(view);

    // Updates the navigation stack
    setNavigationStack((prev) => {
      const newStack = [...prev];
      if (newStack[newStack.length - 1] !== view) {
        newStack.push(view);
      }
      return newStack;
    });

    if (sharedAuthInfo) {
      setSharedAuthInfo(sharedAuthInfo);
    } else {
      setSharedAuthInfo({});
    }
  }

  // Handler for the system back button
  const handleBackPress = useCallback(() => {
    if (navigationStack.length > 1) {
      // Remove the current view from the stack
      const newStack = [...navigationStack];
      newStack.pop();
      setNavigationStack(newStack);

      // Go back to the previous view
      const previousView = newStack[newStack.length - 1];
      if (previousView) {
        setCurrentView(previousView);
      }

      return true; // Prevents the default back button behavior
    }

    // If there are no more views in the stack, allows the default behavior
    // (go back to Terms or close the app)
    return false;
  }, [navigationStack]);

  // Register the BackHandler listener
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      handleBackPress
    );

    return () => backHandler.remove();
  }, [handleBackPress]);

  switch (currentView) {
    case 'sign-in':
      return (
        <SignInView2
          key="sign-in"
          onNavigate={handleNavigation}
          sharedAuthInfo={sharedAuthInfo}
        />
      );
    case 'register':
      return (
        <RegisterView
          key="register"
          onNavigate={handleNavigation}
          sharedAuthInfo={sharedAuthInfo}
        />
      );
    case 'forgot-password':
      return (
        <ForgotPasswordView
          key="forgot"
          onNavigate={handleNavigation}
          sharedAuthInfo={sharedAuthInfo}
        />
      );
    default:
      return (
        <SignInView2
          key="sign-in"
          onNavigate={handleNavigation}
          sharedAuthInfo={sharedAuthInfo}
        />
      );
  }
}
