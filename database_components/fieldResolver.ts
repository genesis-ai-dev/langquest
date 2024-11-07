import { BaseEntity, BaseRepository } from '@/database_components/BaseRepository';
import { VersionedEntity, VersionedRepository } from '@/database_components/VersionedRepository';
import { EntityRepository, FieldPath, isVirtualField } from '@/db_dev_view_components/DevTypes';

interface JunctionRecord extends BaseEntity {
  [key: string]: any;  // For dynamic fields like fromField and toField
}

interface RelatedData<T extends BaseEntity> {
  entity: T | null;
  extra: Record<string, any>;
}

export class FieldResolver {
  static async resolveFieldValue<T extends BaseEntity>(
    entity: T,
    fieldPath: FieldPath,
    sourceRepository: EntityRepository<T>
  ): Promise<string> {
    try {
      // First, determine if this is a relationship field
      if (fieldPath.through) {
        // Handle virtual fields (toMany/manyToMany)
        if (isVirtualField(fieldPath)) {
          console.log('Resolving virtual field:', fieldPath.field);
          return await this.resolveVirtualField(
            entity.id,
            fieldPath.through,
            sourceRepository
          );
        }
  
        // Handle toOne relationships
        const value = entity[fieldPath.field as keyof T];
        if (value === null || value === undefined) {
          return 'N/A';
        }
        return await this.resolveToOneRelationship(value, fieldPath.through);
      }
  
      // Handle regular (non-relationship) fields
      const value = entity[fieldPath.field as keyof T];
      return this.formatValue(value);
  
    } catch (error) {
      console.error('Error resolving field value:', error);
      return 'Error';
    }
  }

  private static async resolveVirtualField<T extends BaseEntity>(
    entityId: string,
    through: NonNullable<FieldPath['through']>,
    sourceRepository: EntityRepository<T>
  ): Promise<string> {
    const { type } = through.relationship;
    
    switch (type) {
      case 'toMany':
        console.log('Resolving toMany relationship:', through.repository);
        return await this.resolveToManyRelationship(
          entityId,
          through,
          sourceRepository
        );

      case 'manyToMany':
        return await this.resolveManyToManyRelationship(
          entityId,
          through,
          sourceRepository
        );

      default:
        throw new Error(`Invalid relationship type for virtual field: ${type}`);
    }
  }

  private static async resolveToOneRelationship<T extends BaseEntity>(
    value: any,
    through: NonNullable<FieldPath['through']>
  ): Promise<string> {
    const linkedEntity = await through.repository.getById(value) as T | null;
    return linkedEntity ? this.formatValue(linkedEntity[through.displayField as keyof T]) : 'N/A';
  }

  private static async resolveToManyRelationship<T extends BaseEntity>(
    entityId: string,
    through: NonNullable<FieldPath['through']>,
    sourceRepository: EntityRepository<T>
  ): Promise<string> {
    const relatedEntities = await sourceRepository.getRelated<T>(
      entityId,
      through.relationship!.relationName
    );

    console.log('Related entities for toMany:', relatedEntities);

    return relatedEntities
      .map((entity) => this.formatValue(entity[through.displayField as keyof T]))
      .filter(Boolean)
      .join(', ');
  }

  private static async resolveManyToManyRelationship<T extends BaseEntity>(
    entityId: string,
    through: NonNullable<FieldPath['through']>,
    sourceRepository: EntityRepository<T>
  ): Promise<string> {
    const { via } = through.relationship!;
    if (!via) {
      throw new Error('Via configuration required for many-to-many relationships');
    }

    // Get junction records using getRelated instead of find
    const junctionRecords = await via.repository.getRelated<JunctionRecord>(
      entityId,
      via.fromField
    );

    // Get related entities and their extra data
    const relatedData = await Promise.all(
      junctionRecords.map(async (junction: JunctionRecord) => {
        const related = await through.repository.getById(junction[via.toField]) as T | null;
        
        const extra = via.extraFields
          ? pick(junction, via.extraFields)
          : {};

        return { entity: related, extra } as RelatedData<T>;
      })
    );

    // Format the output
    return relatedData
      .filter((data): data is RelatedData<BaseEntity> & { entity: T } => 
        data.entity !== null
      )
      .map((data) => {
        if (via.displayTemplate) {
          return via.displayTemplate(data.entity, data.extra);
        }
        return this.formatValue(data.entity[through.displayField as keyof T]);
      })
      .filter(Boolean)
      .join(', ');
  }

  private static formatValue(value: unknown): string {
    if (value === null || value === undefined) {
      return 'N/A';
    }
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    return String(value);
  }
}

function pick(obj: Record<string, any>, keys: string[]): Record<string, any> {
  return keys.reduce((acc, key) => {
    if (key in obj) {
      acc[key] = obj[key];
    }
    return acc;
  }, {} as Record<string, any>);
}