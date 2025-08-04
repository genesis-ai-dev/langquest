import ForgotPasswordView2 from '@/views/ForgotPasswordView2';
import RegisterView2 from '@/views/RegisterView2';
import SignInView2 from '@/views/SignInView2';
import React, { useState } from 'react';

export type AuthView = 'sign-in' | 'register' | 'forgot-password';

export interface SharedAuthInfo {
  email?: string;
}

export function AuthNavigator() {
  const [currentView, setCurrentView] = useState<AuthView>('sign-in');
  const [sharedAuthInfo, setSharedAuthInfo] = useState<SharedAuthInfo>({});

  function handleNavigation(view: AuthView, sharedAuthInfo?: SharedAuthInfo) {
    setCurrentView(view);
    if (sharedAuthInfo) {
      setSharedAuthInfo(sharedAuthInfo);
    } else {
      setSharedAuthInfo({});
    }
  }

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
        <RegisterView2
          key="register"
          onNavigate={handleNavigation}
          sharedAuthInfo={sharedAuthInfo}
        />
      );
    case 'forgot-password':
      return (
        <ForgotPasswordView2
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
