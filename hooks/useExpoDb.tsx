import { system } from '@/db/powersync/system';
import type { EventSubscription } from 'expo/devtools';
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

/**
 * Dev tools plugin hook for native platforms (iOS/Android).
 * Connects the Expo app to the dev tools plugin and handles database queries.
 */
function useExpoDbDev() {
  const db = system.factory.openDB();
  const client = useDevToolsPluginClient('local-db-mcp');

  useEffect(() => {
    if (!client) {
      return;
    }

    const subscriptions: EventSubscription[] = [];

    // Handle execute_query requests from MCP server
    subscriptions.push(
      client.addMessageListener(
        'execute_query',
        (data: { sql: string; params?: SqlParam[]; id: string }) => {
          void (async () => {
            try {
              const executed = await db.execute(data.sql, data.params);
              const rows = executed.rows?._array || [];
              client.sendMessage(`execute_query-${data.id}`, rows);
            } catch (error: unknown) {
              const errorMessage = getErrorMessage(error);
              client.sendMessage(`execute_query-${data.id}`, {
                error: errorMessage
              });
            }
          })();
        }
      )
    );

    // Handle execute_raw requests from MCP server
    subscriptions.push(
      client.addMessageListener(
        'execute_raw',
        (data: { sql: string; params?: SqlParam[]; id: string }) => {
          void (async () => {
            try {
              const raw = await db.executeRaw(data.sql, data.params);
              client.sendMessage(`execute_raw-${data.id}`, raw);
            } catch (error: unknown) {
              const errorMessage = getErrorMessage(error);
              client.sendMessage(`execute_raw-${data.id}`, {
                error: errorMessage
              });
            }
          })();
        }
      )
    );

    // Handle execute_transaction requests from MCP server
    subscriptions.push(
      client.addMessageListener(
        'execute_transaction',
        (data: {
          queries: { sql: string; params?: SqlParam[] }[];
          id: string;
        }) => {
          void (async () => {
            const results: unknown[] = [];
            try {
              await db.writeTransaction(async (tx) => {
                for (const query of data.queries) {
                  const executed = await tx.execute(
                    query.sql,
                    query.params || []
                  );
                  results.push(executed.rows?._array);
                }
              });
              client.sendMessage(`execute_transaction-${data.id}`, results);
            } catch (error: unknown) {
              const errorMessage = getErrorMessage(error);
              results.push({ error: errorMessage });
              client.sendMessage(`execute_transaction-${data.id}`, results);
            }
          })();
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

let useExpoDb: typeof useExpoDbDev;

if (__DEV__) {
  useExpoDb = useExpoDbDev;
} else {
  useExpoDb = () => {
    // No-op in production
  };
}

export { useExpoDb };
