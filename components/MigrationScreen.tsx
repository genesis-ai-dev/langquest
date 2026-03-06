/**
 * Migration Screen
 *
 * Fullscreen blocking UI shown when schema migration is needed.
 * Automatically runs migrations and provides progress feedback.
 *
 * Flow:
 * 1. Displayed when AuthContext detects MigrationNeededError (post-auth)
 *    OR when PreAuthMigrationCheck detects migrations needed (pre-auth)
 * 2. Automatically starts migration on mount
 * 3. Shows progress bar and current step
 * 4. On success: triggers app reload (post-auth) or calls onComplete (pre-auth)
 * 5. On error: shows error message with retry option
 */

import { useAuth } from '@/contexts/AuthContext';
import { APP_SCHEMA_VERSION } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import {
  clearDegradedMode,
  incrementRetryCount,
  isDegradedMode,
  resetRetryCount,
  shouldRetryMigration
} from '@/services/degradedModeService';
import { useThemeColor } from '@/utils/styleUtils';
import { CheckIcon } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { scheduleOnRN } from 'react-native-worklets';
import { Button } from './ui/button';
import { Icon } from './ui/icon';
import { Text } from './ui/text';

interface MigrationProgress {
  current: number;
  total: number;
  step: string;
}

interface MigrationScreenProps {
  /**
   * Callback when migration completes.
   * If provided, migration proceeds without restart (pre-auth mode).
   * If not provided, app restarts/reinitializes after migration (post-auth fallback).
   */
  onComplete?: () => void;
}

export function MigrationScreen({ onComplete }: MigrationScreenProps = {}) {
  const { setMigrationNeeded } = useAuth();
  const [progress, setProgress] = useState<MigrationProgress>({
    current: 0,
    total: 1,
    step: 'Initializing migration...'
  });
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [isDegraded, setIsDegraded] = useState(false);
  const [shouldSkipAutoStart, setShouldSkipAutoStart] = useState(false);
  const [degradedCheckComplete, setDegradedCheckComplete] = useState(false);

  // Check degraded mode on mount and auto-proceed if already in degraded mode
  useEffect(() => {
    void (async () => {
      const degraded = await isDegradedMode();
      setIsDegraded(degraded);
      if (degraded) {
        const shouldRetry = await shouldRetryMigration();
        if (!shouldRetry) {
          // Already in degraded mode and no OTA update applied - auto-proceed
          console.log(
            '[MigrationScreen] Already in degraded mode - allowing app to continue'
          );
          setProgress({
            current: 0,
            total: 1,
            step: 'Continuing in degraded mode...'
          });
          setShouldSkipAutoStart(true); // Prevent normal migration start

          // Auto-proceed after a brief delay to show the message
          setTimeout(() => {
            if (onComplete) {
              // Pre-auth: proceed normally
              onComplete();
            } else {
              // Post-auth: clear migration needed flag and allow app to continue
              setMigrationNeeded(false);
              system.clearMigrationNeeded();
            }
          }, 1500);
        } else {
          // OTA update applied - allow normal migration flow to proceed
          console.log(
            '[MigrationScreen] OTA update applied - migration will retry automatically'
          );
          setProgress({
            current: 0,
            total: 1,
            step: 'OTA update detected - retrying migration...'
          });
          // Don't skip auto-start - let the normal flow handle it
        }
      }
      setDegradedCheckComplete(true);
    })();
  }, [onComplete, setMigrationNeeded]);

  // Memoize runMigration with proper dependencies
  const runMigration = useCallback(async () => {
    try {
      console.log('[MigrationScreen] Starting migration...');
      setError(null);
      setIsDegraded(false);
      setProgress({
        current: 0,
        total: 1,
        step: 'Preparing database migration...'
      });

      // Run migrations via system (works for both pre-auth and post-auth)
      await system.runMigrations((current, total, step) => {
        console.log(
          `[MigrationScreen] Progress: ${current}/${total} - ${step}`
        );
        setProgress({ current, total, step });
      });

      console.log('[MigrationScreen] Migration complete!');

      // Clear degraded mode and reset retry count on success
      await clearDegradedMode();
      resetRetryCount();

      setIsComplete(true);
      setProgress({
        current: 1,
        total: 1,
        step: 'Migration complete!'
      });

      // Give user a moment to see success message
      setTimeout(() => {
        if (onComplete) {
          // Pre-auth mode: no restart needed since PowerSync hasn't been initialized yet
          // Just proceed to AuthProvider which will initialize normally
          console.log(
            '[MigrationScreen] Migration complete, proceeding to auth...'
          );
          onComplete();
        } else {
          // Post-auth fallback: PowerSync was already initialized with old schema
          // Need to reset and reinitialize with new schema
          console.log(
            '[MigrationScreen] Reinitializing system with new schema...'
          );

          // On web, reload the page to ensure clean state
          if (typeof window !== 'undefined') {
            window.location.reload();
          } else {
            // On native, reset system state so useAuth will re-run system.init()
            system.resetForMigration();
          }
        }
      }, 1500);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('[MigrationScreen] Migration failed:', errorMessage);

      // Increment retry count and check if we should enter degraded mode
      const enteredDegradedMode = await incrementRetryCount();

      if (enteredDegradedMode) {
        setIsDegraded(true);
        setError(
          'Migration failed multiple times. The app will continue in degraded mode. Please update the app to retry migration.'
        );
        setProgress({
          current: 0,
          total: 1,
          step: 'Entering degraded mode...'
        });

        // Auto-proceed after showing the message - no restart needed
        setTimeout(() => {
          console.log(
            '[MigrationScreen] Entered degraded mode - allowing app to continue'
          );
          if (onComplete) {
            // Pre-auth: proceed normally
            onComplete();
          } else {
            // Post-auth: clear migration needed flag and allow app to continue
            setMigrationNeeded(false);
            system.clearMigrationNeeded();
          }
        }, 2000);
      } else {
        setError(errorMessage);
        setProgress({
          current: 0,
          total: 1,
          step: 'Migration failed'
        });
      }
    }
  }, [onComplete, setMigrationNeeded]);

  // Memoize wrapper function to pass as reference to scheduleOnRN
  // Per workspace rules: must pass function references, never inline arrow functions
  const startMigration = useCallback(() => {
    void runMigration();
  }, [runMigration]);

  useEffect(() => {
    // Wait for degraded mode check to complete before starting migration
    if (!degradedCheckComplete) {
      return;
    }
    // Skip auto-start if we're in degraded mode and shouldn't retry
    if (shouldSkipAutoStart) {
      console.log(
        '[MigrationScreen] Skipping auto-start - in degraded mode without OTA update'
      );
      return;
    }
    // Use scheduleOnRN instead of queueMicrotask per workspace rules
    scheduleOnRN(startMigration);
  }, [startMigration, shouldSkipAutoStart, degradedCheckComplete]);

  function handleRetry() {
    setError(null);
    setIsComplete(false);
    void runMigration();
  }

  const progressPercent =
    progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0;

  const primaryColor = useThemeColor('primary');
  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <View className="w-full max-w-md">
        {/* Icon/Logo */}
        <View className="mb-8 items-center">
          <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            {error ? (
              <Text className="text-4xl">⚠️</Text>
            ) : isComplete ? (
              <Icon as={CheckIcon} size={40} />
            ) : (
              <ActivityIndicator size="large" color={primaryColor} />
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
          <View className="mb-6 rounded-lg border border-destructive bg-destructive/90 p-4">
            <Text className="mb-2 text-sm font-semibold text-foreground">
              Error Details:
            </Text>
            <Text
              className="font-mono text-xs text-destructive-foreground"
              style={{ color: '#76111b' }}
            >
              {error}
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        {error && (
          <View className="space-y-3">
            {!isDegraded && (
              <Button onPress={handleRetry} className="w-full">
                <Text>Retry Migration</Text>
              </Button>
            )}

            <Text className="mt-4 text-center text-xs text-muted-foreground">
              {isDegraded
                ? 'Please update the app to retry migration. The app will continue in degraded mode until updated.'
                : 'If this error persists, please contact support or reinstall the app.'}
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
          if (typeof window !== 'undefined') {
            window.location.reload();
          } else {
            system.resetForMigration();
          }
        }, 1000);
      } catch (err) {
        setError(String(err));
      }
    }

    void migrate();
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
