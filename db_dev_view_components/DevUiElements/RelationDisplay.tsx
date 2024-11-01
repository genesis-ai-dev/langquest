import React, { useState, useEffect } from 'react';
import { Text } from 'react-native';
import { EditFieldConfig } from '../devTypes';
import { VersionedEntity } from '@/database_components/VersionedRepository';

interface RelationDisplayProps {
  entityId: string;
  fieldKey: string;
  fieldConfig: EditFieldConfig;
  repository: any;
}

export function RelationDisplay({ 
  entityId, 
  fieldKey, 
  fieldConfig, 
  repository 
}: RelationDisplayProps) {
  const [relatedItems, setRelatedItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadRelated = async () => {
      setIsLoading(true);
      try {
        const items = await repository.getRelated(entityId, fieldKey);
        setRelatedItems(items);
      } catch (error) {
        console.error(`Error loading related ${fieldKey}:`, error);
      } finally {
        setIsLoading(false);
      }
    };
    loadRelated();
  }, [entityId, fieldKey, repository]);

  if (isLoading) return <Text>Loading...</Text>;
  
  return (
    <Text>
      {relatedItems.length ? 
        relatedItems.map(item => 
          fieldConfig.relationConfig?.displayField ? 
            String(item[fieldConfig.relationConfig.displayField]) 
            : String(item)
        ).join(', ') 
        : 'None'}
    </Text>
  );
}