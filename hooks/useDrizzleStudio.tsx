import { system } from '@/db/powersync/system';
import type { DBAdapter } from '@powersync/react-native';
import type { DevToolsPluginClient, EventSubscription } from 'expo/devtools';
import { useDevToolsPluginClient } from 'expo/devtools';
import { useEffect } from 'react';

type SqlParam = string | number | null | Uint8Array;

function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const m = (error as { message: unknown }).message;
    return typeof m === 'string' ? m : JSON.stringify(m);
  }
  try {
    return String(error);
  } catch {
    return 'Unknown error';
  }
}

export function useDrizzleStudio() {
  const db = system.factory.openDB();

  // Check if we're in a development build before trying to use dev tools
  // Preview and production builds don't have dev tools available
  const isDevelopmentBuild =
    __DEV__ && process.env.EXPO_PUBLIC_APP_VARIANT === 'development';

  // Always call hooks unconditionally - React requires this
  // useDevToolsPluginClient should return null when not available in production builds
  // If it throws, that's a bug in expo/devtools, but we'll handle it gracefully
  let client: DevToolsPluginClient | null = null;

  // Only attempt to get the client if we're in a development build
  // This prevents the hook from throwing in preview/production builds
  if (isDevelopmentBuild) {
    try {
      // eslint-disable-next-line react-compiler/react-compiler
      // eslint-disable-next-line react-hooks/rules-of-hooks
      client = useDevToolsPluginClient('expo-drizzle-studio-plugin');
    } catch (error) {
      // If the hook throws (shouldn't happen, but handle it just in case)
      console.warn('Failed to initialize Drizzle Studio dev tools:', error);
      client = null;
    }
  }

  const queryFn =
    (db: DBAdapter, client: DevToolsPluginClient) =>
    async (e: {
      sql: string;
      params?: SqlParam[];
      arrayMode: boolean;
      id: string;
    }) => {
      try {
        if (e.arrayMode) {
          const raw = await db.executeRaw(e.sql, e.params || []);
          client.sendMessage(`query-${e.id}`, raw);
          return;
        }
        const executed = await db.execute(e.sql, e.params || []);
        client.sendMessage(`query-${e.id}`, executed.rows?._array);
      } catch (error: unknown) {
        client.sendMessage(`query-${e.id}`, { error: getErrorMessage(error) });
      }
    };

  const transactionFn =
    (db: DBAdapter, client: DevToolsPluginClient) =>
    async (e: {
      queries: { sql: string; params?: SqlParam[] }[];
      id: string;
    }) => {
      const results: unknown[] = [];
      try {
        await db.writeTransaction(async (tx) => {
          for (const query of e.queries) {
            const executed = await tx.execute(query.sql, query.params || []);
            results.push(executed.rows?._array);
          }
        });
      } catch (error: unknown) {
        console.error('useDrizzleStudio transactionFn error', error);
        results.push({ error: getErrorMessage(error) });
      }
      client.sendMessage(`transaction-${e.id}`, results);
    };

  useEffect(() => {
    if (!client) {
      return;
    }

    const subscriptions: EventSubscription[] = [];

    subscriptions.push(
      client.addMessageListener(
        'query',
        (evt: {
          sql: string;
          params?: SqlParam[];
          arrayMode: boolean;
          id: string;
        }) => {
          void queryFn(db, client)(evt);
        }
      )
    );
    subscriptions.push(
      client.addMessageListener(
        'transaction',
        (evt: {
          queries: { sql: string; params?: SqlParam[] }[];
          id: string;
        }) => {
          void transactionFn(db, client)(evt);
        }
      )
    );

    return () => {
      for (const subscription of subscriptions) {
        subscription.remove();
      }
    };
  }, [client, db]);
}
