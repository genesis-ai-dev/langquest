/**
 * Pre-Auth Migration Check Component
 *
 * Checks and runs migrations before authentication/login.
 * This improves UX by handling migrations before the user sees the login screen.
 *
 * Flow:
 * 1. Checks if migrations are needed on mount
 * 2. If needed, shows MigrationScreen (pre-auth mode) and runs migrations
 * 3. After completion, allows app to proceed to AuthProvider
 */

import { system } from '@/db/powersync/system';
import React, { useCallback, useEffect, useState } from 'react';
import { scheduleOnRN } from 'react-native-worklets';
import { MigrationScreen } from './MigrationScreen';

type MigrationState = 'checking' | 'needed' | 'not-needed' | 'complete';

export function PreAuthMigrationCheck({
  children
}: {
  children: React.ReactNode;
}) {
  const [migrationState, setMigrationState] =
    useState<MigrationState>('checking');

  const checkMigrations = useCallback(async () => {
    try {
      console.log('[PreAuthMigrationCheck] Checking migrations...');
      const needsMigration = await system.checkMigrationsNeededPreAuth();

      if (needsMigration) {
        console.log('[PreAuthMigrationCheck] Migrations needed');
        setMigrationState('needed');
      } else {
        console.log('[PreAuthMigrationCheck] No migrations needed');
        setMigrationState('not-needed');
      }
    } catch (error) {
      console.error(
        '[PreAuthMigrationCheck] Error checking migrations:',
        error
      );
      // If we can't check migrations, proceed anyway to avoid blocking the app
      setMigrationState('not-needed');
    }
  }, []);

  const handleMigrationComplete = useCallback(() => {
    console.log('[PreAuthMigrationCheck] Migration complete, proceeding...');
    setMigrationState('complete');
  }, []);

  useEffect(() => {
    // Use scheduleOnRN instead of queueMicrotask per workspace rules
    scheduleOnRN(checkMigrations);
  }, [checkMigrations]);

  // Show migration screen if migrations are needed
  if (migrationState === 'needed') {
    return <MigrationScreen onComplete={handleMigrationComplete} />;
  }

  // Show loading while checking
  if (migrationState === 'checking') {
    return null; // Render nothing while checking - app will show loading via AuthProvider
  }

  // Migrations not needed or complete - render children (AuthProvider)
  return <>{children}</>;
}
