import type { WASQLiteOpenFactory } from '@powersync/web';
import type { EventSubscription } from 'expo/devtools';
import { useDevToolsPluginClient } from 'expo/devtools';
import { useEffect, useRef } from 'react';
import type { WebDBConnection } from './types';

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

/**
 * Dev tools plugin hook for web platform.
 * Connects the Expo app to the dev tools plugin and handles database queries.
 * Uses web-specific database connection pattern.
 */
function useExpoDbDev() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { system } = require('@/db/powersync/system') as {
    system: { factory: WASQLiteOpenFactory };
  };
  const { factory } = system;

  const client = useDevToolsPluginClient('local-db-mcp');
  const connRef = useRef<WebDBConnection | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!client) {
      return;
    }

    let isActive = true;
    const subscriptions: EventSubscription[] = [];

    const ensureInitialized = async () => {
      if (initializedRef.current) return;

      const conn = await factory.openConnection();
      await conn.init();
      connRef.current = conn;
      initializedRef.current = true;
    };

    const executeQuery = async (
      conn: WebDBConnection,
      data: { sql: string; params?: SqlParam[]; id: string }
    ) => {
      try {
        const result = await conn.execute(data.sql, data.params);
        client.sendMessage(`execute_query-${data.id}`, result.rows._array);
      } catch (error: unknown) {
        const errorMessage = getErrorMessage(error);
        client.sendMessage(`execute_query-${data.id}`, { error: errorMessage });
      }
    };

    const executeRaw = async (
      conn: WebDBConnection,
      data: { sql: string; params?: SqlParam[]; id: string }
    ) => {
      try {
        const raw = await conn.executeRaw(data.sql, data.params);
        client.sendMessage(`execute_raw-${data.id}`, raw);
      } catch (error: unknown) {
        const errorMessage = getErrorMessage(error);
        client.sendMessage(`execute_raw-${data.id}`, { error: errorMessage });
      }
    };

    const executeTransaction = async (
      conn: WebDBConnection,
      data: {
        queries: { sql: string; params?: SqlParam[] }[];
        id: string;
      }
    ) => {
      const results: unknown[] = [];
      try {
        await conn.execute('BEGIN');
        for (const query of data.queries) {
          const res = await conn.execute(query.sql, query.params);
          results.push(res.rows._array);
        }
        await conn.execute('COMMIT');
        client.sendMessage(`execute_transaction-${data.id}`, results);
      } catch (error: unknown) {
        try {
          await conn.execute('ROLLBACK');
        } catch {
          // ignore rollback errors
        }
        const errorMessage = getErrorMessage(error);
        results.push({ error: errorMessage });
        client.sendMessage(`execute_transaction-${data.id}`, results);
      }
    };

    const setup = async () => {
      try {
        await ensureInitialized();
        if (!isActive || !connRef.current) return;
        const conn = connRef.current;

        subscriptions.push(
          client.addMessageListener(
            'execute_query',
            (data: { sql: string; params?: SqlParam[]; id: string }) => {
              void executeQuery(conn, data);
            }
          )
        );

        subscriptions.push(
          client.addMessageListener(
            'execute_raw',
            (data: { sql: string; params?: SqlParam[]; id: string }) => {
              void executeRaw(conn, data);
            }
          )
        );

        subscriptions.push(
          client.addMessageListener(
            'execute_transaction',
            (data: {
              queries: { sql: string; params?: SqlParam[] }[];
              id: string;
            }) => {
              void executeTransaction(conn, data);
            }
          )
        );
      } catch (error) {
        console.error(
          'Failed to init database connection for dev tools',
          error
        );
      }
    };

    void setup();

    return () => {
      isActive = false;
      for (const subscription of subscriptions) {
        subscription.remove();
      }
      const conn = connRef.current;
      if (conn) {
        void conn.close().catch(() => undefined);
      }
    };
  }, [client, factory]);
}

let useExpoDb: typeof useExpoDbDev;

if (__DEV__) {
  useExpoDb = useExpoDbDev;
} else {
  useExpoDb = () => {
    // No-op in production
  };
}

export { useExpoDb };
