import { BaseRepository } from './BaseRepository';
import { DomainEventManager, DomainEvent } from './management/DomainEventManager';
import { ScopeManager } from './management/ScopeManager';

export interface ViewConfig {
  field: string;
  label: string;
  type?: 'text' | 'password' | 'boolean' | 'relation' | 'media';
  through?: {
    entity: string;
    displayField: string;
  };
}

export abstract class Entity {
  protected _attributes: Record<string, any> = {};
  protected _isDirty = false;
  protected _isNew: boolean;
  protected _isDeleted = false;
  protected _scopeId?: string;
  protected _uncommittedChanges: DomainEvent[] = [];

  constructor(
    protected repository: BaseRepository<any>,
    attributes: Record<string, any> = {},
    isNew = true
  ) {
    this._isNew = isNew;
    this._attributes = attributes;

    return new Proxy(this, {
      get: (target: any, prop: string) => {
        if (prop in target) return target[prop];
        return target.getAttribute(prop);
      },
      set: (target: any, prop: string, value: any) => {
        if (prop in target) {
          target[prop] = value;
          return true;
        }
        target.setAttribute(prop, value);
        return true;
      }
    });
  }

  // Public interface
  get id(): string {
    if (!this._attributes.id) {
      throw new Error('Attempting to access id before it is set');
    }
    return this._attributes.id;
  }

  setScope(scopeId: string): void {
    this._scopeId = scopeId;
  }

  async save(): Promise<void> {
    if (!this._scopeId) {
      throw new Error('Entity must be registered to a scope before saving');
    }

    if (this._isDeleted) {
      await this.repository.delete(this);
      this.publishEvent('EntityDeleted', { id: this.id });
    } else {
      await this.repository.save(this);
      this.publishEvent(
        this._isNew ? 'EntityCreated' : 'EntityUpdated',
        { id: this.id, changes: this._uncommittedChanges }
      );
    }
  }

  delete(): void {
    if (!this._scopeId) {
      throw new Error('Entity must be registered to a scope before deleting');
    }
    this._isDeleted = true;
    this._isDirty = true;
    ScopeManager.getInstance().markDirty(this._scopeId, this);
  }

  // Protected methods for attribute access
  protected async getAttribute(key: string): Promise<any> {
    if (!(key in this._attributes)) {
      this._attributes[key] = await this.repository.loadAttribute(this, key);
    }
    return this._attributes[key];
  }

  protected setAttribute(key: string, value: any): void {
    const oldValue = this._attributes[key];
    if (oldValue !== value) {
      this._attributes[key] = value;
      this._isDirty = true;
  
      // Create a proper DomainEvent
      const event: DomainEvent = {
        id: crypto.randomUUID(),
        type: 'AttributeChanged',
        entityType: this.constructor.name,
        entityId: this._attributes.id || '',
        scopeId: this._scopeId || '',
        data: { 
          attribute: key, 
          oldValue, 
          newValue: value 
        },
        timestamp: new Date()
      };
  
      this._uncommittedChanges.push(event);
  
      if (this._scopeId) {
        ScopeManager.getInstance().markDirty(this._scopeId, this);
        this.publishEvent('AttributeChanged', {
          attribute: key,
          oldValue,
          newValue: value
        });
      }
    }
  }

  // Repository interface - explicit about what repository can access
  _forRepository = {
    getAttributes: (): Record<string, any> => ({ ...this._attributes }),
    
    updateAttributes: (attributes: Record<string, any>): void => {
      this._attributes = { ...this._attributes, ...attributes };
    },

    getPersistenceState: () => ({
      attributes: { ...this._attributes },
      isNew: this._isNew,
      isDirty: this._isDirty,
      isDeleted: this._isDeleted,
      uncommittedChanges: [...this._uncommittedChanges]
    }),

    updatePersistenceState: (updates: {
      isNew?: boolean;
      isDirty?: boolean;
      isDeleted?: boolean;
      uncommittedChanges?: DomainEvent[];
    }): void => {
      if (typeof updates.isNew === 'boolean') this._isNew = updates.isNew;
      if (typeof updates.isDirty === 'boolean') this._isDirty = updates.isDirty;
      if (typeof updates.isDeleted === 'boolean') this._isDeleted = updates.isDeleted;
      if (updates.uncommittedChanges) this._uncommittedChanges = [...updates.uncommittedChanges];
    }
  };

  private publishEvent(type: string, data: Record<string, any>): void {
    if (!this._scopeId) return;

    const event: DomainEvent = {
      id: crypto.randomUUID(),
      type,
      entityType: this.constructor.name,
      entityId: this.id,
      scopeId: this._scopeId,
      data,
      timestamp: new Date()
    };

    DomainEventManager.getInstance().publish(event);
  }

  // Abstract methods for view configuration
  abstract get cardViewFields(): ViewConfig[];
  abstract get detailsViewFields(): ViewConfig[];
  abstract get editViewFields(): ViewConfig[];
}