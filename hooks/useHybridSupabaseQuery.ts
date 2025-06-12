// import { toCompilableQuery } from '@powersync/drizzle-driver';
// import { useQuery } from '@powersync/tanstack-react-query';
// import { processSql, renderHttp } from '@supabase/sql-to-rest';
// import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
// import { useQueryClient } from '@tanstack/react-query';
// import { useEffect, useRef } from 'react';
// import { useNetworkStatus } from './useNetworkStatus';

// type GetQueryParam<T> = Parameters<typeof useQuery<T>>[0];

// type HybridQueryOptions<T extends Record<string, unknown>> = Omit<
//   GetQueryParam<T>,
//   'queryFn' | 'query'
// > & {
//   query: Parameters<typeof toCompilableQuery<T>>[0];
// };

// type HybridSupabaseRealtimeQueryOptions<T extends Record<string, unknown>> =
//   HybridQueryOptions<T> & {
//     subscribeRealtime: (
//       callback: (payload: RealtimePostgresChangesPayload<T>) => void
//     ) => () => void;
//     getId?: (record: T | Partial<T>) => string | number;
//   };

// export function useHybridSupabaseQuery<T extends Record<string, unknown>>({
//   query,
//   ...options
// }: HybridQueryOptions<T>) {
//   const isOnline = useNetworkStatus();

//   const onlineFn: GetQueryParam<T>['queryFn'] = async () => {
//     const data = query.toSQL();

//     const statement = await processSql(data.sql);
//     const httpRequest = await renderHttp(statement);

//     const response = await fetch(
//       `${process.env.EXPO_PUBLIC_SUPABASE_URL}/rest/v1${httpRequest.fullPath}`,
//       {
//         method: httpRequest.method
//       }
//     );

//     const responseData = (await response.json()) as T[];

//     return responseData;
//   };

//   if (isOnline) {
//     return useQuery({
//       ...options,
//       queryFn: onlineFn
//     });
//   } else {
//     return useQuery({
//       ...options,
//       query: toCompilableQuery<T>(query)
//     });
//   }
// }

// export function useHybridSupabaseRealtimeQuery<
//   T extends Record<string, unknown>
// >({
//   subscribeRealtime,
//   getId = (record: T | Partial<T>) =>
//     (record as unknown as { id: string | number }).id,
//   ...options
// }: HybridSupabaseRealtimeQueryOptions<T>) {
//   const queryClient = useQueryClient();
//   const isOnline = useNetworkStatus();
//   const realtimeChannelRef = useRef<ReturnType<
//     typeof subscribeRealtime
//   > | null>(null);

//   // Use the base hybrid query
//   const result = useHybridSupabaseQuery(options);

//   useEffect(() => {
//     if (!isOnline) return;

//     // Unsubscribe previous
//     if (realtimeChannelRef.current) {
//       void realtimeChannelRef.current();
//       realtimeChannelRef.current = null;
//     }

//     // Subscribe with automatic cache management
//     const subscription = subscribeRealtime((payload) => {
//       const { eventType, new: newRow, old: oldRow } = payload;
//       const cacheKey = options.queryKey;

//       queryClient.setQueryData<T[]>(cacheKey, (prev = []) => {
//         switch (eventType) {
//           case 'INSERT': {
//             const recordId = getId(newRow);
//             // Avoid duplicates
//             if (prev.some((record) => getId(record) === recordId)) {
//               return prev;
//             }
//             return [...prev, newRow];
//           }
//           case 'UPDATE': {
//             const recordId = getId(newRow);
//             return prev.map((record) =>
//               getId(record) === recordId ? newRow : record
//             );
//           }
//           case 'DELETE': {
//             const recordId = getId(oldRow);
//             return prev.filter((record) => getId(record) !== recordId);
//           }
//           default: {
//             console.warn(
//               'useHybridSupabaseRealtimeQuery: Unhandled event type',
//               eventType
//             );
//             return prev;
//           }
//         }
//       });
//     });

//     realtimeChannelRef.current = subscription;

//     return () => {
//       if (realtimeChannelRef.current) {
//         void realtimeChannelRef.current();
//         realtimeChannelRef.current = null;
//       }
//     };
//   }, [
//     isOnline,
//     subscribeRealtime,
//     queryClient,
//     getId,
//     JSON.stringify(options.queryKey)
//   ]);

//   return result;
// }
