import type { WASQLiteOpenFactory } from '@powersync/web';
import type { DevToolsPluginClient, EventSubscription } from 'expo/devtools';
import { useDevToolsPluginClient } from 'expo/devtools';
import { useCallback, useEffect, useRef } from 'react';

export function openDB() {
  // don't open db on web we use web connection
}

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

interface WebDBConnection {
  init: () => Promise<void>;
  close: () => Promise<void>;
  execute: (
    sql: string,
    params?: unknown[]
  ) => Promise<{ rows: { _array: unknown[] } }>;
  executeRaw: (sql: string, params?: unknown[]) => Promise<unknown[][]>;
}

export function useDrizzleStudio() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { system } = require('@/db/powersync/system') as {
    system: { factory: WASQLiteOpenFactory };
  };
  const { factory } = system;

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
      // eslint-disable-next-line react-hooks/rules-of-hooks
      client = useDevToolsPluginClient('expo-drizzle-studio-plugin');
    } catch (error) {
      // If the hook throws (shouldn't happen, but handle it just in case)
      console.warn('Failed to initialize Drizzle Studio dev tools:', error);
      client = null;
    }
  }

  const connRef = useRef<WebDBConnection | null>(null);
  const initializedRef = useRef(false);

  const ensureInitialized = useCallback(async () => {
    if (initializedRef.current) return;

    const conn = (await factory.openConnection()) as unknown as WebDBConnection;
    await conn.init();
    connRef.current = conn;
    initializedRef.current = true;
  }, [factory]);

  const executeQuery = async (
    conn: WebDBConnection,
    e: { sql: string; params?: unknown[]; arrayMode: boolean; id: string },
    client: DevToolsPluginClient
  ) => {
    try {
      if (e.arrayMode) {
        const rows = await conn.executeRaw(e.sql, e.params);
        client.sendMessage(`query-${e.id}`, rows);
        return;
      }
      const result = await conn.execute(e.sql, e.params);
      client.sendMessage(`query-${e.id}`, result.rows._array);
    } catch (error: unknown) {
      client.sendMessage(`query-${e.id}`, { error: getErrorMessage(error) });
    }
  };

  const executeTransaction = async (
    conn: WebDBConnection,
    e: { queries: { sql: string; params?: unknown[] }[]; id: string },
    client: DevToolsPluginClient
  ) => {
    const results: unknown[] = [];
    try {
      await conn.execute('BEGIN');
      for (const q of e.queries) {
        const res = await conn.execute(q.sql, q.params);
        results.push(res.rows._array);
      }
      await conn.execute('COMMIT');
    } catch (error: unknown) {
      try {
        await conn.execute('ROLLBACK');
      } catch {
        // ignore
      }
      console.error('useDrizzleStudio transactionFn error', error);
      results.push({ error: getErrorMessage(error) });
    }
    client.sendMessage(`transaction-${e.id}`, results);
  };

  useEffect(() => {
    if (!client) return;

    let isActive = true;
    const subscriptions: EventSubscription[] = [];

    const setup = async () => {
      try {
        await ensureInitialized();
        if (!isActive || !connRef.current) return;
        const conn = connRef.current;

        subscriptions.push(
          client.addMessageListener(
            'query',
            (evt: {
              sql: string;
              params?: unknown[];
              arrayMode: boolean;
              id: string;
            }) => {
              void executeQuery(conn, evt, client);
            }
          )
        );
        subscriptions.push(
          client.addMessageListener(
            'transaction',
            (evt: {
              queries: { sql: string; params?: unknown[] }[];
              id: string;
            }) => {
              void executeTransaction(conn, evt, client);
            }
          )
        );
      } catch (error) {
        console.error('Failed to init wa-sqlite for Drizzle Studio', error);
      }
    };

    void setup();

    return () => {
      isActive = false;
      for (const s of subscriptions) s.remove();
      const c = connRef.current;
      if (c) void c.close().catch(() => undefined);
    };
  }, [client, ensureInitialized]);
}
