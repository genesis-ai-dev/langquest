import type * as OPSqlite from '@op-engineering/op-sqlite';
import { open } from '@op-engineering/op-sqlite';
import type { DevToolsPluginClient, EventSubscription } from 'expo/devtools';
import { useDevToolsPluginClient } from 'expo/devtools';
import { useEffect } from 'react';

export function openDB() {
  return open({
    name: 'sqlite.db'
  });
}

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

export function useDrizzleStudio(db: OPSqlite.DB | null) {
  const client = useDevToolsPluginClient('expo-drizzle-studio-plugin');

  const queryFn =
    (db: OPSqlite.DB, client: DevToolsPluginClient) =>
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
        const stmt = db.prepareStatement(e.sql);
        await stmt.bind(e.params || []);
        const executed = await stmt.execute();
        client.sendMessage(`query-${e.id}`, executed.rows);
      } catch (error: unknown) {
        client.sendMessage(`query-${e.id}`, { error: getErrorMessage(error) });
      }
    };

  const transactionFn =
    (db: OPSqlite.DB, client: DevToolsPluginClient) =>
    async (e: {
      queries: { sql: string; params?: SqlParam[] }[];
      id: string;
    }) => {
      const results: unknown[] = [];
      try {
        await db.execute('BEGIN');
        for (const query of e.queries) {
          const stmt = db.prepareStatement(query.sql);
          await stmt.bind(query.params || []);
          const executed = await stmt.execute();
          results.push(executed.rows);
        }
        await db.execute('COMMIT');
      } catch (error: unknown) {
        await db.execute('ROLLBACK').catch(() => undefined);
        console.error('useDrizzleStudio transactionFn error', error);
        results.push({ error: getErrorMessage(error) });
      }
      client.sendMessage(`transaction-${e.id}`, results);
    };

  useEffect(() => {
    if (!client || !db) {
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
