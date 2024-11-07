import React, { useState, useEffect } from 'react';
import { Text } from 'react-native';
import { EditFieldConfig, FieldPath } from '../DevTypes';
import { VersionedEntity } from '@/database_components/VersionedRepository';
import { FieldResolver } from '@/database_components/fieldResolver';
import { EntityRepository } from '../DevTypes';

interface RelationDisplayProps {
  entity: Partial<VersionedEntity>;
  fieldPath: FieldPath;
  repository: EntityRepository<any>;
}

export function RelationDisplay({ 
  entity,
  fieldPath,
  repository 
}: RelationDisplayProps) {
  const [displayValue, setDisplayValue] = useState<string>('Loading...');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const resolveRelation = async () => {
      if (!entity || !entity.id) {
        setDisplayValue('No entity selected');
        setIsLoading(false);
        return;
      }

      try {
        const value = await FieldResolver.resolveFieldValue(
          entity,
          fieldPath,
          repository
        );
        setDisplayValue(value);
      } catch (error) {
        console.error('Error resolving relation:', error);
        setDisplayValue('Error loading relation');
      } finally {
        setIsLoading(false);
      }
    };

    resolveRelation();
  }, [entity, fieldPath, repository]);

  if (isLoading) return <Text>Loading...</Text>;
  
  return <Text>{displayValue}</Text>;
}