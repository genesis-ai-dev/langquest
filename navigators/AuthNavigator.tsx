import ForgotPasswordView2 from '@/views/ForgotPasswordView2';
import RegisterView2 from '@/views/RegisterView2';
import SignInView2 from '@/views/SignInView2';
import React, { useState } from 'react';

export type AuthView = 'sign-in' | 'register' | 'forgot-password';

export function AuthNavigator() {
  const [currentView, setCurrentView] = useState<AuthView>('sign-in');

  switch (currentView) {
    case 'sign-in':
      return <SignInView2 onNavigate={setCurrentView} />;
    case 'register':
      return <RegisterView2 onNavigate={setCurrentView} />;
    case 'forgot-password':
      return <ForgotPasswordView2 onNavigate={setCurrentView} />;
    default:
      return <SignInView2 onNavigate={setCurrentView} />;
  }
}
