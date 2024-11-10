export type EventHandler = (event: DomainEvent) => Promise<void> | void;

export interface DomainEvent {
  id: string;
  type: string;
  entityType: string;
  entityId: string;
  scopeId: string;
  data: Record<string, any>;
  timestamp: Date;
}

export class DomainEventManager {
  private static instance: DomainEventManager;
  private subscriptions: Map<string, {
    eventType: string;
    handler: EventHandler;
    scopeId?: string;
  }> = new Map();
  
  private pendingEvents: Map<string, DomainEvent[]> = new Map(); // scopeId -> events
  private processedEvents: Set<string> = new Set(); // eventIds

  private constructor() {}

  static getInstance(): DomainEventManager {
    if (!DomainEventManager.instance) {
      DomainEventManager.instance = new DomainEventManager();
    }
    return DomainEventManager.instance;
  }

  subscribe(
    eventType: string, 
    handler: EventHandler, 
    scopeId?: string
  ): string {
    const subscriptionId = crypto.randomUUID();
    this.subscriptions.set(subscriptionId, { eventType, handler, scopeId });
    return subscriptionId;
  }

  unsubscribe(subscriptionId: string): void {
    this.subscriptions.delete(subscriptionId);
  }

  clearScopeEvents(scopeId: string): void {
    this.pendingEvents.delete(scopeId);
    // Remove scope-specific subscriptions
    for (const [id, sub] of this.subscriptions.entries()) {
      if (sub.scopeId === scopeId) {
        this.subscriptions.delete(id);
      }
    }
  }

  async publish(event: DomainEvent): Promise<void> {
    // Store event in pending events for the scope
    const scopeEvents = this.pendingEvents.get(event.scopeId) || [];
    scopeEvents.push(event);
    this.pendingEvents.set(event.scopeId, scopeEvents);

    // Process event immediately for global subscribers
    await this.processEvent(event);
  }

  private async processEvent(event: DomainEvent): Promise<void> {
    if (this.processedEvents.has(event.id)) return;

    const relevantSubscriptions = Array.from(this.subscriptions.values())
      .filter(sub => 
        sub.eventType === event.type && 
        (!sub.scopeId || sub.scopeId === event.scopeId)
      );

    for (const sub of relevantSubscriptions) {
      try {
        await sub.handler(event);
      } catch (error) {
        console.error('Error processing domain event:', error);
      }
    }

    this.processedEvents.add(event.id);
  }

  async processScopeEvents(scopeId: string): Promise<void> {
    const events = this.pendingEvents.get(scopeId) || [];
    
    for (const event of events) {
      await this.processEvent(event);
    }

    this.pendingEvents.delete(scopeId);
  }

  collectEvents(scopeId: string): DomainEvent[] {
    return this.pendingEvents.get(scopeId) || [];
  }

  hasPendingEvents(scopeId: string): boolean {
    const events = this.pendingEvents.get(scopeId) || [];
    return events.length > 0;
  }

  // Clean up old processed events periodically
  cleanupProcessedEvents(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
    const cutoff = new Date(Date.now() - maxAgeMs);
    
    for (const [scopeId, events] of this.pendingEvents.entries()) {
      const filteredEvents = events.filter(e => e.timestamp > cutoff);
      if (filteredEvents.length !== events.length) {
        this.pendingEvents.set(scopeId, filteredEvents);
      }
    }
  }
}