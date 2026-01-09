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

function useDrizzleStudioDev() {
  const db = system.factory.openDB();
  const client = useDevToolsPluginClient('expo-drizzle-studio-plugin');

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

let useDrizzleStudio: typeof useDrizzleStudioDev;

if (__DEV__) {
  useDrizzleStudio = useDrizzleStudioDev;
} else {
  useDrizzleStudio = () => {
    // No-op in production
  };
}

export { useDrizzleStudio };
