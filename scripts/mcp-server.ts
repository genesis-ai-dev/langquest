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
  let devToolsClient: DevToolsPluginClient | null = null;
  let reconnectTimeout: NodeJS.Timeout | null = null;
  let isConnecting = false;
  let retryCount = 0;
  const MAX_RETRIES = 50; // Limit retries to prevent infinite loops
  const INITIAL_RETRY_DELAY = 5000; // Start with 5 seconds
  const MAX_RETRY_DELAY = 30000; // Cap at 30 seconds

  // Cleanup function to properly close connections
  const cleanup = () => {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    // Note: DevToolsPluginClient doesn't expose a close method, but we can clear the reference
    devToolsClient = null;
    dbAdapter = null;
    isConnecting = false;
  };

  // Handle unhandled promise rejections (from WebSocket errors)
  process.on('unhandledRejection', (reason) => {
    const errorMessage =
      reason instanceof Error ? reason.message : String(reason);
    // Suppress WebSocket retry errors that cause stack overflow
    if (
      errorMessage.includes('Maximum call stack size exceeded') ||
      errorMessage.includes('Exceeded max retries') ||
      errorMessage.includes('WebSocket')
    ) {
      // These are expected when Expo isn't running - just log and continue
      console.error(
        '⚠️  WebSocket connection error (Expo app may not be running)'
      );
      return;
    }
    // Log other unhandled rejections
    console.error('⚠️  Unhandled promise rejection:', errorMessage);
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    const errorMessage = error.message || String(error);
    // Suppress stack overflow errors from WebSocket retry logic
    if (
      errorMessage.includes('Maximum call stack size exceeded') ||
      errorMessage.includes('Exceeded max retries')
    ) {
      console.error(
        '⚠️  WebSocket retry error (Expo app may not be running). MCP server will continue.'
      );
      // Don't exit - let the server continue running
      return;
    }
    // For other errors, log and exit
    console.error('❌ Uncaught exception:', error);
    cleanup();
    process.exit(1);
  });

  // Handle process termination signals
  process.on('SIGTERM', () => {
    console.error('📴 Received SIGTERM, cleaning up...');
    cleanup();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.error('📴 Received SIGINT, cleaning up...');
    cleanup();
    process.exit(0);
  });

  // Getter function to access the current adapter (allows updates)
  const getDbAdapter = () => {
    if (!dbAdapter) {
      throw new Error(
        'Expo devtools is not connected. Please start your Expo app and ensure the devtools plugin is active.'
      );
    }
    return dbAdapter;
  };

  // Check if Expo dev server is accessible before attempting WebSocket connection
  const checkExpoServer = async (): Promise<boolean> => {
    try {
      const http = await import('http');
      return new Promise((resolve) => {
        const req = http.request(
          {
            hostname: EXPO_HOST,
            port: EXPO_PORT,
            path: '/',
            method: 'GET',
            timeout: 2000
          },
          (res) => {
            resolve(res.statusCode !== undefined);
          }
        );
        req.on('error', () => resolve(false));
        req.on('timeout', () => {
          req.destroy();
          resolve(false);
        });
        req.end();
      });
    } catch {
      return false;
    }
  };

  // Function to connect to Expo devtools (can be called multiple times for reconnection)
  const connectToExpoDevtools = async () => {
    // Prevent multiple simultaneous connection attempts
    if (isConnecting) {
      return;
    }

    // Stop retrying if we've exceeded max retries
    if (retryCount >= MAX_RETRIES) {
      console.error(
        `⚠️  Maximum retry limit (${MAX_RETRIES}) reached. Stopping reconnection attempts.`
      );
      console.error(
        '💡 Please restart the MCP server or ensure your Expo app is running.'
      );
      return;
    }

    isConnecting = true;
    console.error('🔌 Attempting to connect to Expo devtools...');

    // First check if Expo dev server is accessible
    const serverAvailable = await checkExpoServer();
    if (!serverAvailable) {
      isConnecting = false;
      retryCount++;
      console.error(
        `⚠️  Expo dev server not accessible at ${EXPO_HOST}:${EXPO_PORT} (attempt ${retryCount}/${MAX_RETRIES})`
      );

      if (retryCount < MAX_RETRIES) {
        const baseDelay = Math.min(
          INITIAL_RETRY_DELAY * Math.pow(1.5, retryCount - 1),
          MAX_RETRY_DELAY
        );
        const jitter = Math.random() * 1000;
        const delay = Math.floor(baseDelay + jitter);

        console.error(
          `💡 Retrying in ${Math.round(delay / 1000)}s... (Start your Expo app to enable database queries)`
        );

        reconnectTimeout = setTimeout(() => {
          reconnectTimeout = null;
          void connectToExpoDevtools();
        }, delay);
      } else {
        console.error(
          '💡 The MCP server will continue running. Start your Expo app to enable database queries.'
        );
      }
      return;
    }

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

      // Wrap in a try-catch to handle WebSocket errors gracefully
      // Use a shorter timeout to fail fast before WebSocket retry logic kicks in
      const client = await Promise.race([
        getDevToolsPluginClientAsync('local-db-mcp'),
        // Shorter timeout to prevent WebSocket from starting aggressive retries
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('Connection timeout after 3 seconds')),
            3000
          )
        )
      ]);

      console.error('✅ Connected to Expo devtools');
      devToolsClient = client;
      dbAdapter = createDevToolsDbAdapter(client);
      retryCount = 0; // Reset retry count on successful connection
      isConnecting = false;
    } catch (error) {
      isConnecting = false;
      retryCount++;

      // Extract error message safely
      let errorMessage = 'Unknown error';
      try {
        errorMessage = error instanceof Error ? error.message : String(error);
      } catch {
        // If we can't stringify the error, use a generic message
        errorMessage = 'Connection failed';
      }

      // Check if this is a connection-related error
      const isConnectionError =
        errorMessage.includes('timeout') ||
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('WebSocket') ||
        errorMessage.includes('Exceeded max retries') ||
        errorMessage.includes('ECONNRESET') ||
        errorMessage.includes('ENOTFOUND');

      // Suppress detailed error logging for connection errors to avoid noise
      if (!isConnectionError) {
        console.error(
          '⚠️  Failed to connect via getDevToolsPluginClientAsync:',
          errorMessage
        );
      } else {
        console.error(
          `⚠️  Connection failed (attempt ${retryCount}/${MAX_RETRIES})`
        );
      }

      // Clean up any partial connection state
      if (devToolsClient) {
        devToolsClient = null;
      }
      if (dbAdapter) {
        dbAdapter = null;
      }

      if (retryCount < MAX_RETRIES) {
        // Exponential backoff with jitter
        const baseDelay = Math.min(
          INITIAL_RETRY_DELAY * Math.pow(1.5, retryCount - 1),
          MAX_RETRY_DELAY
        );
        const jitter = Math.random() * 1000; // Add up to 1 second of jitter
        const delay = Math.floor(baseDelay + jitter);

        console.error(
          `💡 Retrying in ${Math.round(delay / 1000)}s... (Start your Expo app to enable database queries)`
        );

        reconnectTimeout = setTimeout(() => {
          reconnectTimeout = null;
          void connectToExpoDevtools();
        }, delay);
      } else {
        console.error(
          '💡 The MCP server will continue running. Start your Expo app to enable database queries.'
        );
      }
    }
  };

  // Set up MCP server with stdio transport
  void (async () => {
    console.error('🚀 Setting up MCP server...');

    try {
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
      // Errors are handled inside connectToExpoDevtools, so we just need to catch any unexpected errors
      connectToExpoDevtools().catch((error) => {
        // Only log if it's not a connection error (those are handled inside the function)
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (
          !errorMessage.includes('timeout') &&
          !errorMessage.includes('ECONNREFUSED') &&
          !errorMessage.includes('WebSocket') &&
          !errorMessage.includes('Exceeded max retries')
        ) {
          console.error('Unexpected error connecting to Expo devtools:', error);
        }
        // Don't retry here - connectToExpoDevtools handles its own retries
      });
    } catch (error) {
      console.error('❌ Failed to start MCP server:', error);
      cleanup();
      process.exit(1);
    }
  })();
}

main();
