import { BaseEntity, BaseRepository } from '@/database_components/BaseRepository';
import { VersionedEntity, VersionedRepository } from '@/database_components/VersionedRepository';
import { EntityRepository, FieldPath } from '@/db_dev_view_components/DevTypes';

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
      const value = entity[fieldPath.field as keyof T];

      if (!fieldPath.through) {
        return this.formatValue(value);
      }

      if (value === null || value === undefined) {
        return 'N/A';
      }

      const { through } = fieldPath;

      if (through.relationship) {
        switch (through.relationship.type) {
          case 'toOne':
            return await this.resolveToOneRelationship(value, through);

          case 'toMany':
            return await this.resolveToManyRelationship(
              entity.id,
              through,
              sourceRepository
            );

          case 'manyToMany':
            return await this.resolveManyToManyRelationship(
              entity.id,
              through,
              sourceRepository
            );

          default:
            throw new Error(`Unknown relationship type: ${through.relationship.type}`);
        }
      }

      return await this.resolveToOneRelationship(value, through);

    } catch (error) {
      console.error('Error resolving field value:', error);
      return 'Error';
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