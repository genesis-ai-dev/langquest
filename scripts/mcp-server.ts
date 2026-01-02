/**
 * Standalone MCP Server for Expo DB DevTools
 *
 * This runs as a Node.js server that:
 * 1. Hosts an MCP server using @modelcontextprotocol/sdk
 * 2. Connects to the Expo devtools plugin via WebSocket
 * 3. Forwards database queries to the Expo app
 *
 * Usage: npm run mcp:server
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { DevToolsPluginClient } from 'expo/devtools';
import { getDevToolsPluginClientAsync } from 'expo/devtools';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as z from 'zod';

type SqlParam = string | number | null | Uint8Array;

/**
 * Creates a DBAdapter that forwards database operations to the Expo app
 * via DevToolsPluginClient connection to the devtools plugin.
 */
function createDevToolsDbAdapter(client: DevToolsPluginClient): {
  execute: (sql: string, params?: SqlParam[]) => Promise<unknown>;
  executeRaw: (sql: string, params?: SqlParam[]) => Promise<unknown>;
  writeTransaction: <T>(
    callback: (tx: {
      execute: (sql: string, params?: SqlParam[]) => Promise<unknown>;
      executeRaw: (sql: string, params?: SqlParam[]) => Promise<unknown>;
    }) => Promise<T>
  ) => Promise<T>;
  isConnected: () => boolean;
} {
  const pendingRequests = new Map<
    string,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
    }
  >();

  const isConnected = () => {
    // DevToolsPluginClient doesn't expose connection state directly
    // Assume connected if client exists
    return true;
  };

  const generateId = () => `req_${Date.now()}_${Math.random()}`;

  const sendMessage = (
    method: string,
    payload: unknown,
    id: string
  ): Promise<unknown> => {
    return new Promise((resolve, reject) => {
      // Set up response listener
      const listener = (data: unknown) => {
        // Check if this is the response for our request
        // The client API handles message routing internally
        const pending = pendingRequests.get(id);
        if (pending) {
          pending.resolve(data);
          pendingRequests.delete(id);
        }
      };

      try {
        pendingRequests.set(id, { resolve, reject });

        // Set up listener for response first
        const subscription = client.addMessageListener(
          `${method}-${id}`,
          listener
        );

        // Send message using client API
        client.sendMessage(method, {
          ...(payload as Record<string, unknown>),
          id
        } as Record<string, unknown>);

        // Timeout after 30 seconds
        setTimeout(() => {
          if (pendingRequests.has(id)) {
            subscription.remove();
            const timeoutError = new Error(
              `Request timeout after 30s for ${method} (ID: ${id})`
            );
            reject(timeoutError);
            pendingRequests.delete(id);
          }
        }, 30000);
      } catch (error) {
        const errorObj =
          error instanceof Error ? error : new Error(String(error));
        reject(errorObj);
      }
    });
  };

  return {
    execute: async (sql: string, params?: SqlParam[]) => {
      const id = generateId();
      const result = await sendMessage(
        'execute_query',
        { sql, params: params || [] },
        id
      );
      // Handle response format from DevToolsPluginClient
      const rows = Array.isArray(result) ? result : [];
      return {
        rows: {
          _array: rows,
          length: rows.length,
          item: (idx: number) => rows[idx]
        },
        rowsAffected: 0
      };
    },

    executeRaw: async (sql: string, params?: SqlParam[]) => {
      const id = generateId();
      return sendMessage('execute_raw', { sql, params: params || [] }, id);
    },

    writeTransaction: async <T>(
      callback: (tx: {
        execute: (sql: string, params?: SqlParam[]) => Promise<unknown>;
        executeRaw: (sql: string, params?: SqlParam[]) => Promise<unknown>;
      }) => Promise<T>
    ): Promise<T> => {
      // Collect queries from transaction callback
      const queries: { sql: string; params?: SqlParam[] }[] = [];

      const txAdapter = {
        execute: (sql: string, params?: SqlParam[]) => {
          queries.push({ sql, params });
          return Promise.resolve({
            rows: { _array: [], length: 0, item: () => undefined },
            rowsAffected: 0
          });
        },
        executeRaw: (sql: string, params?: SqlParam[]) => {
          queries.push({ sql, params });
          return Promise.resolve([]);
        }
      };

      const transactionResult = await callback(txAdapter);

      // Execute transaction on Expo app
      const id = generateId();
      await sendMessage('execute_transaction', { queries }, id);

      return transactionResult;
    },

    isConnected
  };
}

function createMcpServer(
  getDbAdapter: () => ReturnType<typeof createDevToolsDbAdapter>
) {
  const server = new McpServer({
    name: 'local-db',
    version: '1.0.0'
  });

  const sqlInputSchema = {
    sql: z.string().describe('The SQL query to execute'),
    params: z
      .array(z.union([z.string(), z.number(), z.null()]))
      .optional()
      .describe('Optional parameters for the SQL query')
  };

  // Register execute_query tool
  server.registerTool(
    'execute_query',
    {
      title: 'Execute Query',
      description:
        'Execute a SQL query against the LangQuest database. Returns rows as an array. ' +
        'IMPORTANT: Use Drizzle view names (e.g., "invite", "quest", "asset") NOT PowerSync raw table names (e.g., "ps_data__invite"). ' +
        'PowerSync tables store data as JSON and columns cannot be queried directly.',
      inputSchema: sqlInputSchema,
      outputSchema: {
        rows: z.array(z.record(z.string(), z.unknown())).optional(),
        error: z.string().optional()
      }
    },
    async (args: unknown) => {
      const { sql, params = [] } = args as {
        sql: string;
        params?: (string | number | null)[];
      };

      try {
        const dbAdapter = getDbAdapter();
        if (!dbAdapter.isConnected()) {
          throw new Error(
            'Expo devtools is not connected. Please start your Expo app and ensure the devtools plugin is active.'
          );
        }
        const result = await dbAdapter.execute(sql, params as SqlParam[]);
        const rows =
          (result as { rows?: { _array?: unknown[] } }).rows?._array || [];

        // Return rows as an array to match the expected schema
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ rows }, null, 2)
            }
          ],
          structuredContent: { rows } as Record<string, unknown>
        };
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        // Provide helpful error message for common PowerSync table issues
        let enhancedErrorMessage = errorMessage;
        if (
          errorMessage.includes('no such column') &&
          sql.includes('ps_data__')
        ) {
          enhancedErrorMessage =
            `${errorMessage}\n\n` +
            `TIP: You're querying a PowerSync raw table (ps_data__*). ` +
            `These tables store data as JSON and columns cannot be queried directly. ` +
            `Use Drizzle view names instead:\n` +
            `- "ps_data__invite" → "invite"\n` +
            `- "ps_data__quest" → "quest"\n` +
            `- "ps_data__asset" → "asset"\n` +
            `- "ps_data__notification" → "notification"\n` +
            `- etc.`;
        }

        // Throw the error so MCP SDK can handle it properly
        throw new Error(`Database query failed: ${enhancedErrorMessage}`);
      }
    }
  );

  // Register execute_raw tool
  server.registerTool(
    'execute_raw',
    {
      title: 'Execute Raw Query',
      description:
        'Execute a raw SQL query and return the raw result. Useful for queries that return non-standard formats. ' +
        'IMPORTANT: Use Drizzle view names (e.g., "invite", "quest", "asset") NOT PowerSync raw table names (e.g., "ps_data__invite"). ' +
        'PowerSync tables store data as JSON and columns cannot be queried directly.',
      inputSchema: sqlInputSchema,
      outputSchema: {
        result: z.unknown().optional(),
        error: z.string().optional()
      }
    },
    async (args: unknown) => {
      const { sql, params = [] } = args as {
        sql: string;
        params?: (string | number | null)[];
      };

      try {
        const dbAdapter = getDbAdapter();
        if (!dbAdapter.isConnected()) {
          throw new Error(
            'Expo devtools is not connected. Please start your Expo app and ensure the devtools plugin is active.'
          );
        }
        const result = await dbAdapter.executeRaw(sql, params as SqlParam[]);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ result }, null, 2)
            }
          ],
          structuredContent: { result } as Record<string, unknown>
        };
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        // Throw the error so MCP SDK can handle it properly
        throw new Error(`Database raw query failed: ${errorMessage}`);
      }
    }
  );

  // Register execute_transaction tool
  server.registerTool(
    'execute_transaction',
    {
      title: 'Execute Transaction',
      description:
        'Execute multiple SQL queries in a transaction. All queries succeed or all fail.',
      inputSchema: {
        queries: z
          .array(z.object(sqlInputSchema))
          .describe('Array of SQL queries to execute in a transaction')
      },
      outputSchema: {
        results: z.array(z.unknown()).optional(),
        error: z.string().optional()
      }
    },
    async (args: unknown) => {
      const { queries } = args as {
        queries: { sql: string; params?: (string | number | null)[] }[];
      };
      try {
        const dbAdapter = getDbAdapter();
        if (!dbAdapter.isConnected()) {
          throw new Error(
            'Expo devtools is not connected. Please start your Expo app and ensure the devtools plugin is active.'
          );
        }
        const results = await dbAdapter.writeTransaction(async (tx) => {
          const txResults: unknown[] = [];
          for (const query of queries) {
            const result = await tx.execute(
              query.sql,
              query.params as SqlParam[]
            );
            txResults.push(result);
          }
          return txResults;
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ results }, null, 2)
            }
          ],
          structuredContent: { results } as Record<string, unknown>
        };
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ error: errorMessage }, null, 2)
            }
          ],
          structuredContent: { error: errorMessage }
        };
      }
    }
  );

  return server;
}

/**
 * Find the project root directory by looking for package.json
 * Works from any directory by walking up the directory tree
 */
function findProjectRoot(): string {
  // Get the directory of the current file (using ES module approach)
  const __filename = fileURLToPath(import.meta.url);
  let currentDir = path.dirname(__filename);

  // If running from scripts/ directory, go up one level
  if (path.basename(currentDir) === 'scripts') {
    currentDir = path.dirname(currentDir);
  }

  // Walk up the directory tree looking for package.json
  while (currentDir !== path.dirname(currentDir)) {
    const packageJsonPath = path.join(currentDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }

  // Fallback to current working directory
  return process.cwd();
}

function main() {
  // Change to project root so relative paths work correctly
  const projectRoot = findProjectRoot();
  process.chdir(projectRoot);

  const EXPO_HOST = process.env.EXPO_HOST || 'localhost';
  const EXPO_PORT = process.env.EXPO_PORT
    ? parseInt(process.env.EXPO_PORT, 10)
    : 8081;

  // Create a placeholder - will be initialized when connection is established
  let dbAdapter: ReturnType<typeof createDevToolsDbAdapter> | null = null;

  // Getter function to access the current adapter (allows updates)
  const getDbAdapter = () => {
    if (!dbAdapter) {
      throw new Error(
        'Expo devtools is not connected. Please start your Expo app and ensure the devtools plugin is active.'
      );
    }
    return dbAdapter;
  };

  // Function to connect to Expo devtools (can be called multiple times for reconnection)
  const connectToExpoDevtools = async () => {
    console.error('🔌 Attempting to connect to Expo devtools...');

    // Try using getDevToolsPluginClientAsync
    // Note: getDevToolsPluginClientAsync calls getConnectionInfo() which expects window.location
    // We need to mock window for Node.js environment
    try {
      console.error('   Trying getDevToolsPluginClientAsync...');

      // Mock window object for Node.js environment
      // getConnectionInfo() expects window.location to determine devServer address
      if (typeof globalThis.window === 'undefined') {
        const mockWindow = {
          location: {
            search: `?devServer=${EXPO_HOST}:${EXPO_PORT}`,
            origin: `http://${EXPO_HOST}:${EXPO_PORT}`,
            protocol: 'http:'
          }
        };
        // @ts-expect-error - Mocking window for Node.js environment
        globalThis.window = mockWindow;
      }

      const client = await getDevToolsPluginClientAsync('local-db-mcp');
      console.error('✅ Connected to Expo devtools');
      dbAdapter = createDevToolsDbAdapter(client);
    } catch (error) {
      console.error(
        '⚠️  Failed to connect via getDevToolsPluginClientAsync:',
        error
      );
      console.error(
        '💡 The MCP server will continue running. Start your Expo app to enable database queries.'
      );
      // Attempt to reconnect after 5 seconds
      setTimeout(() => {
        void connectToExpoDevtools();
      }, 5000);
    }
  };

  // Set up MCP server with stdio transport
  void (async () => {
    console.error('🚀 Setting up MCP server...');

    // Create MCP server and connect to stdio transport
    const server = createMcpServer(getDbAdapter);
    const transport = new StdioServerTransport();

    await server.connect(transport);

    console.error('✨ MCP Server is running!');
    console.error(
      '📝 Using stdio transport - Cursor will launch this as a subprocess'
    );

    // Attempt to connect to Expo devtools (non-blocking)
    // This will retry automatically if the connection fails
    connectToExpoDevtools().catch((error) => {
      console.error('Failed to connect to Expo devtools:', error);
    });
  })();
}

main();
