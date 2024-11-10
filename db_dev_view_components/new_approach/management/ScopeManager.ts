import { Entity } from '../Entity';
import { DomainEventManager } from './DomainEventManager';
import { UpdateManager } from './UpdateManager';

export class ScopeManager {
    private static instance: ScopeManager;
    private scopes: Map<string, Set<Entity>> = new Map();
    private dirtyFlags: Map<string, Set<Entity>> = new Map();
  
    private constructor() {}
  
    static getInstance(): ScopeManager {
      if (!ScopeManager.instance) {
        ScopeManager.instance = new ScopeManager();
      }
      return ScopeManager.instance;
    }
  
    createScope(scopeId: string): void {
      if (this.scopes.has(scopeId)) {
        throw new Error(`Scope ${scopeId} already exists`);
      }
      this.scopes.set(scopeId, new Set());
      this.dirtyFlags.set(scopeId, new Set());
    }
  
    destroyScope(scopeId: string): void {
      if (!this.scopes.has(scopeId)) {
        throw new Error(`Scope ${scopeId} does not exist`);
      }
      // Clean up any subscriptions or pending changes
      DomainEventManager.getInstance().clearScopeEvents(scopeId);
      UpdateManager.getInstance().clearScopeSubscriptions(scopeId);
      
      this.scopes.delete(scopeId);
      this.dirtyFlags.delete(scopeId);
    }
  
    registerEntity(scopeId: string, entity: Entity): void {
      const scope = this.scopes.get(scopeId);
      if (!scope) {
        throw new Error(`Scope ${scopeId} does not exist`);
      }
      scope.add(entity);
      entity.setScope(scopeId);
    }
  
    markDirty(scopeId: string, entity: Entity): void {
      const dirtySet = this.dirtyFlags.get(scopeId);
      if (!dirtySet) {
        throw new Error(`Scope ${scopeId} does not exist`);
      }
      dirtySet.add(entity);
    }
  
    getEntitiesInScope(scopeId: string): Entity[] {
      const scope = this.scopes.get(scopeId);
      if (!scope) {
        throw new Error(`Scope ${scopeId} does not exist`);
      }
      return Array.from(scope);
    }
  
    getDirtyEntities(scopeId: string): Entity[] {
      const dirtySet = this.dirtyFlags.get(scopeId);
      if (!dirtySet) {
        throw new Error(`Scope ${scopeId} does not exist`);
      }
      return Array.from(dirtySet);
    }
  
    isEntityInScope(scopeId: string, entity: Entity): boolean {
      const scope = this.scopes.get(scopeId);
      return scope ? scope.has(entity) : false;
    }
  
    clearDirtyFlag(scopeId: string, entity: Entity): void {
      const dirtySet = this.dirtyFlags.get(scopeId);
      if (dirtySet) {
        dirtySet.delete(entity);
      }
    }
  }