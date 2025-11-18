import ForgotPasswordView from '@/views/ForgotPasswordView';
import RegisterView from '@/views/RegisterView';
import SignInView2 from '@/views/SignInView';
import React, { useCallback, useEffect, useState } from 'react';
import { BackHandler } from 'react-native';

export type AuthView = 'sign-in' | 'register' | 'forgot-password';

export interface SharedAuthInfo {
  email?: string;
}

export function AuthNavigator({
  initialView = 'sign-in'
}: {
  initialView?: AuthView;
}) {
  const [currentView, setCurrentView] = useState<AuthView>(initialView);
  const [sharedAuthInfo, setSharedAuthInfo] = useState<SharedAuthInfo>({});
  const [navigationStack, setNavigationStack] = useState<AuthView[]>([
    initialView
  ]);


  function handleNavigation(view: AuthView, sharedAuthInfo?: SharedAuthInfo) {
    setCurrentView(view);

    // Atualiza o stack de navegação
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

  // Handler para o botão voltar do sistema
  const handleBackPress = useCallback(() => {
    if (navigationStack.length > 1) {
      // Remove a view atual do stack
      const newStack = [...navigationStack];
      newStack.pop();
      setNavigationStack(newStack);

      // Volta para a view anterior
      const previousView = newStack[newStack.length - 1];
      if (previousView) {
        setCurrentView(previousView);
      }

      return true; // Impede o comportamento padrão do botão voltar
    }

    // Se não há mais views no stack, permite o comportamento padrão
    // (voltar para Terms ou fechar o app)
    return false;
  }, [navigationStack]);

  // Registra o listener do BackHandler
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
