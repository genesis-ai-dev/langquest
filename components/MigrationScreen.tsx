/**
 * Migration Screen
 *
 * Fullscreen blocking UI shown when schema migration is needed.
 * Automatically runs migrations and provides progress feedback.
 *
 * Flow:
 * 1. Displayed when AuthContext detects MigrationNeededError
 * 2. Automatically starts migration on mount
 * 3. Shows progress bar and current step
 * 4. On success: triggers app reload to continue with new schema
 * 5. On error: shows error message with retry option
 */

import { APP_SCHEMA_VERSION } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Button } from './ui/button';
import { Text } from './ui/text';

interface MigrationProgress {
  current: number;
  total: number;
  step: string;
}

export function MigrationScreen() {
  const [progress, setProgress] = useState<MigrationProgress>({
    current: 0,
    total: 1,
    step: 'Initializing migration...'
  });
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    runMigration();
  }, []);

  async function runMigration() {
    try {
      console.log('[MigrationScreen] Starting migration...');
      setError(null);
      setProgress({
        current: 0,
        total: 1,
        step: 'Preparing database migration...'
      });

      // Run migrations via system
      await system.runMigrations((current, total, step) => {
        console.log(
          `[MigrationScreen] Progress: ${current}/${total} - ${step}`
        );
        setProgress({ current, total, step });
      });

      console.log('[MigrationScreen] Migration complete!');
      setIsComplete(true);
      setProgress({
        current: 1,
        total: 1,
        step: 'Migration complete! Restarting app...'
      });

      // Give user a moment to see success message
      setTimeout(() => {
        // Trigger app reload to reinitialize with new schema
        console.log('[MigrationScreen] Reloading app...');

        // On web, reload the page
        if (typeof window !== 'undefined' && window.location) {
          window.location.reload();
        } else {
          // On native, we need to reset the system state and reinitialize
          // This will cause useAuth to re-run system.init()
          system.resetForMigration();
        }
      }, 1500);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('[MigrationScreen] Migration failed:', errorMessage);
      setError(errorMessage);
      setProgress({
        current: 0,
        total: 1,
        step: 'Migration failed'
      });
    }
  }

  function handleRetry() {
    setError(null);
    setIsComplete(false);
    runMigration();
  }

  const progressPercent =
    progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0;

  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <View className="w-full max-w-md">
        {/* Icon/Logo */}
        <View className="mb-8 items-center">
          <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            {error ? (
              <Text className="text-4xl">⚠️</Text>
            ) : isComplete ? (
              <Text className="text-4xl">✓</Text>
            ) : (
              <ActivityIndicator size="large" />
            )}
          </View>

          <Text className="mb-2 text-center text-2xl font-bold">
            {error
              ? 'Migration Failed'
              : isComplete
                ? 'Migration Complete'
                : 'Updating Database'}
          </Text>

          <Text className="text-center text-sm text-muted-foreground">
            {error
              ? 'An error occurred during migration'
              : isComplete
                ? 'Your data has been updated successfully'
                : `Migrating to version ${APP_SCHEMA_VERSION}`}
          </Text>
        </View>

        {/* Progress Bar */}
        {!error && !isComplete && (
          <View className="mb-6">
            <View className="h-2 overflow-hidden rounded-full bg-muted">
              <View
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </View>

            <View className="mt-2 flex-row justify-between">
              <Text className="text-xs text-muted-foreground">
                Step {progress.current} of {progress.total}
              </Text>
              <Text className="text-xs text-muted-foreground">
                {progressPercent}%
              </Text>
            </View>
          </View>
        )}

        {/* Current Step */}
        {!error && (
          <View className="mb-6 rounded-lg bg-muted/50 p-4">
            <Text className="mb-1 text-sm text-muted-foreground">
              {isComplete ? 'Status:' : 'Current step:'}
            </Text>
            <Text className="text-sm">{progress.step}</Text>
          </View>
        )}

        {/* Error Display */}
        {error && (
          <View className="mb-6 rounded-lg border border-destructive/20 bg-destructive/10 p-4">
            <Text className="mb-2 text-sm font-semibold text-destructive-foreground">
              Error Details:
            </Text>
            <Text className="font-mono text-xs text-destructive-foreground/80">
              {error}
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        {error && (
          <View className="space-y-3">
            <Button onPress={handleRetry} className="w-full">
              <Text>Retry Migration</Text>
            </Button>

            <Text className="mt-4 text-center text-xs text-muted-foreground">
              If this error persists, please contact support or reinstall the
              app.
            </Text>
          </View>
        )}

        {/* Info Text */}
        {!error && !isComplete && (
          <View className="mt-6">
            <Text className="text-center text-xs text-muted-foreground">
              Please don't close the app during migration.
              {'\n'}
              This process may take a few moments.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

/**
 * Alternative minimal version (if UI components aren't available):
 */
export function MigrationScreenMinimal() {
  const [status, setStatus] = useState('Migrating database...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function migrate() {
      try {
        await system.runMigrations((current, total, step) => {
          setStatus(`Step ${current}/${total}: ${step}`);
        });

        setStatus('Migration complete! Restarting...');

        setTimeout(() => {
          if (typeof window !== 'undefined' && window.location) {
            window.location.reload();
          } else {
            system.resetForMigration();
          }
        }, 1000);
      } catch (err) {
        setError(String(err));
      }
    }

    migrate();
  }, []);

  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
      }}
    >
      {error ? (
        <>
          <Text style={{ color: 'red', marginBottom: 10 }}>
            Migration Failed
          </Text>
          <Text style={{ fontSize: 12, textAlign: 'center' }}>{error}</Text>
        </>
      ) : (
        <>
          <ActivityIndicator size="large" />
          <Text style={{ marginTop: 20, textAlign: 'center' }}>{status}</Text>
        </>
      )}
    </View>
  );
}

