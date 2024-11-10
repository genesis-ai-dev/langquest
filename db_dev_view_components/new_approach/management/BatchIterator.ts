export interface QueryResult<T> {
    items: T[];
    totalCount: number;
  }
  
  export class BatchIterator<T> {
    private currentOffset = 0;
    private hasMoreItems = true;
    private cachedBatch: T[] = [];
    private cachedBatchOffset = 0;
  
    constructor(
      private queryFn: (offset: number, limit: number) => Promise<QueryResult<T>>,
      private batchSize: number = 20,
      private totalCount: number = 0
    ) {}
  
    async next(): Promise<IteratorResult<T[]>> {
      if (!this.hasMoreItems) {
        return { done: true, value: [] };
      }
  
      // If we have cached items that haven't been returned yet
      if (this.cachedBatch.length > 0 && 
          this.currentOffset >= this.cachedBatchOffset && 
          this.currentOffset < (this.cachedBatchOffset + this.cachedBatch.length)) {
        const startIndex = this.currentOffset - this.cachedBatchOffset;
        const items = this.cachedBatch.slice(startIndex, startIndex + this.batchSize);
        this.currentOffset += items.length;
        
        if (this.currentOffset >= this.totalCount) {
          this.hasMoreItems = false;
        }
  
        return { done: false, value: items };
      }
  
      // Fetch new batch
      try {
        const result = await this.queryFn(this.currentOffset, this.batchSize);
        this.cachedBatch = result.items;
        this.cachedBatchOffset = this.currentOffset;
        this.totalCount = result.totalCount;
  
        if (result.items.length === 0) {
          this.hasMoreItems = false;
          return { done: true, value: [] };
        }
  
        this.currentOffset += result.items.length;
        if (this.currentOffset >= this.totalCount) {
          this.hasMoreItems = false;
        }
  
        return { done: false, value: result.items };
      } catch (error) {
        console.error('Error fetching batch:', error);
        this.hasMoreItems = false;
        throw error;
      }
    }
  
    async hasNext(): Promise<boolean> {
      return this.hasMoreItems;
    }
  
    setBatchSize(size: number): void {
      this.batchSize = size;
    }
  
    reset(): void {
      this.currentOffset = 0;
      this.hasMoreItems = true;
      this.cachedBatch = [];
      this.cachedBatchOffset = 0;
    }
  
    getTotalCount(): number {
      return this.totalCount;
    }
  
    getCurrentOffset(): number {
      return this.currentOffset;
    }
  
    async *[Symbol.asyncIterator](): AsyncIterator<T[]> {
      while (await this.hasNext()) {
        const result = await this.next();
        if (result.done) break;
        yield result.value;
      }
    }
  
    // Helper method to get all remaining items
    async getAllRemaining(): Promise<T[]> {
      const results: T[] = [];
      for await (const batch of this) {
        results.push(...batch);
      }
      return results;
    }
  
    // Helper method to process items in batches with a callback
    async processBatches(callback: (items: T[]) => Promise<void>): Promise<void> {
      for await (const batch of this) {
        await callback(batch);
      }
    }
  }