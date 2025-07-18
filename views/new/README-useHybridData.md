# useHybridData Hook

A single layer of abstraction for the hybrid data fetching pattern used across all next-gen views in LangQuest.

## Overview

The `useHybridData` hook abstracts the common pattern of:
1. **Querying offline data** from the local SQLite database
2. **Querying cloud data** from Supabase when online
3. **Merging both datasets** with offline taking precedence for duplicates
4. **Adding source tracking** to each item

## Features

- **Automatic network detection** - Only queries cloud data when online
- **Source tracking** - Each item includes a `source` field (`'localSqlite'` or `'cloudSupabase'`)
- **Deduplication** - Offline data takes precedence for items with the same ID
- **Loading state management** - Separate and combined loading states
- **Error handling** - Separate error states for offline and cloud queries
- **TypeScript support** - Full type safety with generics
- **Query options** - Pass through React Query options for both queries
- **Infinite pagination support** - Built-in support for infinite scrolling

## Basic Usage

### Using useSimpleHybridData

For simple cases where offline and cloud data have the same shape:

```typescript
const {
  data: quests,        // Combined data with source tracking
  isLoading,           // Combined loading state
  isOnline,            // Network status
  offlineData,         // Raw offline data
  cloudData           // Raw cloud data
} = useSimpleHybridData<Quest>(
  'quests',                    // Data type (for query key)
  [projectId],                 // Query key params
  async () => {                // Offline query function
    return await system.db.query.quest.findMany({
      where: (fields, { eq }) => eq(fields.project_id, projectId)
    });
  },
  async () => {                // Cloud query function
    const { data, error } = await system.supabaseConnector.client
      .from('quest')
      .select('*')
      .eq('project_id', projectId);
    if (error) throw error;
    return data;
  }
);
```

### Using useHybridData (Advanced)

For more complex cases with different data shapes or custom requirements:

```typescript
const result = useHybridData({
  dataType: 'assets',
  queryKeyParams: [questId],
  
  // Custom offline query
  offlineQueryFn: async () => {
    return await system.db
      .select()
      .from(asset)
      .innerJoin(quest_asset_link, eq(asset.id, quest_asset_link.asset_id))
      .where(eq(quest_asset_link.quest_id, questId));
  },
  
  // Custom cloud query
  cloudQueryFn: async () => {
    const { data } = await system.supabaseConnector.client
      .from('quest_asset_link')
      .select('asset:asset_id (*)')
      .eq('quest_id', questId);
    return data.map(item => item.asset);
  },
  
  // Custom ID getter (defaults to item.id)
  getItemId: (item) => item.assetId,
  
  // Transform cloud data to match offline format
  transformCloudData: (cloudItem) => ({
    ...cloudItem,
    // Add any transformations needed
  }),
  
  // React Query options
  offlineQueryOptions: {
    staleTime: 5 * 60 * 1000, // 5 minutes
  },
  cloudQueryOptions: {
    retry: 2,
  },
  
  // Override network check
  enableCloudQuery: isOnline && hasPermission
});
```

## Infinite Pagination

### Using useSimpleHybridInfiniteData

For implementing infinite scrolling with automatic pagination:

```typescript
const {
  data,                // { pages: HybridPageData[], pageParams: number[] }
  fetchNextPage,       // Function to load more data
  hasNextPage,         // Whether more data is available
  isFetchingNextPage,  // Loading state for next page
  isLoading,           // Initial loading state
  isOnline            // Network status
} = useSimpleHybridInfiniteData<Quest>(
  'quests',
  [projectId],
  // Offline query with pagination
  async ({ pageParam, pageSize }) => {
    const offset = pageParam * pageSize;
    return await system.db.query.quest.findMany({
      where: (fields, { eq }) => eq(fields.project_id, projectId),
      limit: pageSize,
      offset
    });
  },
  // Cloud query with pagination
  async ({ pageParam, pageSize }) => {
    const from = pageParam * pageSize;
    const to = from + pageSize - 1;
    
    const { data, error } = await system.supabaseConnector.client
      .from('quest')
      .select('*')
      .eq('project_id', projectId)
      .range(from, to);
      
    if (error) throw error;
    return data;
  },
  20 // pageSize (optional, defaults to 10)
);

// Flatten pages for rendering
const items = React.useMemo(() => {
  return data.pages.flatMap(page => page.data);
}, [data.pages]);
```

### Using with FlashList

Example implementation with FlashList for optimal performance:

```typescript
<FlashList
  data={items}
  renderItem={renderItem}
  keyExtractor={keyExtractor}
  estimatedItemSize={80}
  onEndReached={() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }}
  onEndReachedThreshold={0.5}
  ListFooterComponent={() => {
    if (!isFetchingNextPage) return null;
    return <ActivityIndicator />;
  }}
/>
```

## API Reference

### useHybridData Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `dataType` | `string` | Yes | Unique key for this data type (e.g., 'assets', 'quests') |
| `queryKeyParams` | `QueryKeyParam[]` | Yes | Additional query key elements |
| `offlineQueryFn` | `() => Promise<T[]>` | Yes | Function to fetch offline data |
| `cloudQueryFn` | `() => Promise<T[]>` | Yes | Function to fetch cloud data |
| `getItemId` | `(item) => string` | No | Function to get unique ID (defaults to `item.id`) |
| `transformCloudData` | `(cloud) => offline` | No | Transform cloud data to offline format |
| `offlineQueryOptions` | `UseQueryOptions` | No | React Query options for offline query |
| `cloudQueryOptions` | `UseQueryOptions` | No | React Query options for cloud query |
| `enableCloudQuery` | `boolean` | No | Override network check (defaults to `isOnline`) |

### useHybridInfiniteData Options

All options from `useHybridData` plus:

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `offlineQueryFn` | `(context) => Promise<T[]>` | Yes | Offline query with pagination context |
| `cloudQueryFn` | `(context) => Promise<T[]>` | Yes | Cloud query with pagination context |
| `pageSize` | `number` | No | Items per page (defaults to 10) |

### InfiniteQueryContext

| Property | Type | Description |
|----------|------|-------------|
| `pageParam` | `number` | Current page number (0-based) |
| `pageSize` | `number` | Number of items per page |

### Return Value

| Property | Type | Description |
|----------|------|-------------|
| `data` | `T[]` | Combined data with source tracking |
| `isOfflineLoading` | `boolean` | Offline query loading state |
| `isCloudLoading` | `boolean` | Cloud query loading state |
| `isLoading` | `boolean` | Combined loading state |
| `offlineError` | `Error \| null` | Offline query error |
| `cloudError` | `Error \| null` | Cloud query error |
| `offlineData` | `T[] \| undefined` | Raw offline data with source |
| `cloudData` | `T[] \| undefined` | Raw cloud data with source |
| `isOnline` | `boolean` | Current network status |

### HybridInfiniteDataResult

All properties from `HybridDataResult` plus:

| Property | Type | Description |
|----------|------|-------------|
| `data` | `{ pages, pageParams }` | Paginated data structure |
| `fetchNextPage` | `() => void` | Load next page |
| `fetchPreviousPage` | `() => void` | Load previous page |
| `hasNextPage` | `boolean` | More pages available |
| `hasPreviousPage` | `boolean` | Previous pages available |
| `isFetchingNextPage` | `boolean` | Loading next page |
| `isFetchingPreviousPage` | `boolean` | Loading previous page |
| `refetch` | `() => void` | Refetch all pages |
| `status` | `'error' \| 'pending' \| 'success'` | Query status |

## Migration Guide

### Before (Original Pattern)

```typescript
function useNextGenOfflineQuests(projectId: string) {
  return useQuery({
    queryKey: ['quests', 'offline', projectId],
    queryFn: async () => {
      const quests = await system.db.query.quest.findMany({
        where: (fields, { eq }) => eq(fields.project_id, projectId)
      });
      return quests.map((quest) => ({
        ...quest,
        source: 'localSqlite'
      }));
    },
    enabled: !!projectId
  });
}

function useNextGenCloudQuests(projectId: string, isOnline: boolean) {
  return useQuery({
    queryKey: ['quests', 'cloud', projectId],
    queryFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('quest')
        .select('*')
        .eq('project_id', projectId);
      if (error) throw error;
      return data.map((quest) => ({
        ...quest,
        source: 'cloudSupabase'
      }));
    },
    enabled: !!projectId && isOnline
  });
}

// In component
const isOnline = useNetworkStatus();
const { data: offlineQuests, isLoading: isOfflineLoading } = 
  useNextGenOfflineQuests(projectId || '');
const { data: cloudQuests, isLoading: isCloudLoading } = 
  useNextGenCloudQuests(projectId || '', isOnline);

const quests = React.useMemo(() => {
  const offlineQuestsArray = offlineQuests || [];
  const cloudQuestsArray = cloudQuests || [];
  const offlineQuestMap = new Map(
    offlineQuestsArray.map((quest) => [quest.id, quest])
  );
  const uniqueCloudQuests = cloudQuestsArray.filter(
    (quest) => !offlineQuestMap.has(quest.id)
  );
  return [...offlineQuestsArray, ...uniqueCloudQuests];
}, [offlineQuests, cloudQuests]);
```

### After (Using useHybridData)

```typescript
// In component - much simpler!
const { data: quests, isLoading } = useSimpleHybridData<Quest>(
  'quests',
  [projectId || ''],
  async () => system.db.query.quest.findMany({
    where: (fields, { eq }) => eq(fields.project_id, projectId!)
  }),
  async () => {
    const { data, error } = await system.supabaseConnector.client
      .from('quest')
      .select('*')
      .eq('project_id', projectId!);
    if (error) throw error;
    return data;
  }
);
```

### After (With Infinite Pagination)

```typescript
// With infinite scrolling support
const {
  data,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  isLoading
} = useSimpleHybridInfiniteData<Quest>(
  'quests',
  [projectId || ''],
  async ({ pageParam, pageSize }) => {
    const offset = pageParam * pageSize;
    return system.db.query.quest.findMany({
      where: (fields, { eq }) => eq(fields.project_id, projectId!),
      limit: pageSize,
      offset
    });
  },
  async ({ pageParam, pageSize }) => {
    const from = pageParam * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await system.supabaseConnector.client
      .from('quest')
      .select('*')
      .eq('project_id', projectId!)
      .range(from, to);
    if (error) throw error;
    return data;
  },
  20 // pageSize
);

// Flatten pages for rendering
const quests = React.useMemo(() => {
  return data.pages.flatMap(page => page.data);
}, [data.pages]);
```

## Benefits

1. **Reduced boilerplate** - No need to manually manage two queries, combine data, or add source tracking
2. **Consistent behavior** - All views follow the same data fetching pattern
3. **Type safety** - Full TypeScript support with generics
4. **Flexible** - Can handle simple cases with `useSimpleHybridData` or complex cases with full options
5. **Performance** - Built on React Query with all its caching and optimization benefits
6. **Maintainability** - Changes to the hybrid pattern only need to be made in one place
7. **Infinite scrolling** - Built-in support for pagination with minimal setup 