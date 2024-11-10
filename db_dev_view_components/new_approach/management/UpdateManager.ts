export type ChangeCallback = (changes: EntityChange[]) => void;
export type QueryDefinition = {
  entityType: string;
  filter?: Record<string, any>;
  relationships?: string[];
};

export interface EntityChange {
  entityType: string;
  entityId: string;
  changeType: 'create' | 'update' | 'delete';
  changes?: Record<string, any>;
}

export class UpdateManager {
  private static instance: UpdateManager;
  private subscriptions: Map<string, {
    scopeId: string;
    query: QueryDefinition;
    callback: ChangeCallback;
  }> = new Map();
  private batchMode = false;
  private batchedChanges: EntityChange[] = [];

  private constructor() {}

  static getInstance(): UpdateManager {
    if (!UpdateManager.instance) {
      UpdateManager.instance = new UpdateManager();
    }
    return UpdateManager.instance;
  }

  subscribe(
    scopeId: string, 
    query: QueryDefinition, 
    callback: ChangeCallback
  ): string {
    const subscriptionId = crypto.randomUUID();
    this.subscriptions.set(subscriptionId, { scopeId, query, callback });
    return subscriptionId;
  }

  unsubscribe(subscriptionId: string): void {
    this.subscriptions.delete(subscriptionId);
  }

  clearScopeSubscriptions(scopeId: string): void {
    for (const [id, sub] of this.subscriptions.entries()) {
      if (sub.scopeId === scopeId) {
        this.subscriptions.delete(id);
      }
    }
  }

  async notifyChange(change: EntityChange): Promise<void> {
    if (this.batchMode) {
      this.batchedChanges.push(change);
      return;
    }

    await this.processChange(change);
  }

  private async processChange(change: EntityChange): Promise<void> {
    const relevantSubscriptions = Array.from(this.subscriptions.values())
      .filter(sub => this.isChangeRelevant(change, sub.query));

    for (const sub of relevantSubscriptions) {
      try {
        await sub.callback([change]);
      } catch (error) {
        console.error('Error in change subscription callback:', error);
      }
    }
  }

  private isChangeRelevant(change: EntityChange, query: QueryDefinition): boolean {
    if (change.entityType !== query.entityType) return false;
    
    if (!query.filter) return true;

    // Check if the change matches the filter criteria
    return Object.entries(query.filter).every(([key, value]) => {
      return change.changes?.[key] === value;
    });
  }

  startBatch(): void {
    this.batchMode = true;
    this.batchedChanges = [];
  }

  async endBatch(): Promise<void> {
    this.batchMode = false;
    
    // Group changes by subscription
    const subscriptionChanges = new Map<string, EntityChange[]>();
    
    for (const change of this.batchedChanges) {
      for (const [id, sub] of this.subscriptions.entries()) {
        if (this.isChangeRelevant(change, sub.query)) {
          const changes = subscriptionChanges.get(id) || [];
          changes.push(change);
          subscriptionChanges.set(id, changes);
        }
      }
    }

    // Notify subscribers
    for (const [id, changes] of subscriptionChanges.entries()) {
      const sub = this.subscriptions.get(id);
      if (sub) {
        try {
          await sub.callback(changes);
        } catch (error) {
          console.error('Error in batch change subscription callback:', error);
        }
      }
    }

    this.batchedChanges = [];
  }
}