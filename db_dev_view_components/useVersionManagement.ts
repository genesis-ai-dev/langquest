import { useState, useEffect } from 'react';
import { VersionedEntity } from '@/database_components/VersionedRepository';
import { VersionedRepository } from '@/database_components/VersionedRepository';

export function useVersionManagement<T extends VersionedEntity>(
  repository: VersionedRepository<T>,
  initialEntity: Partial<T>,
  isNew: boolean
) {
  // Helper function to clean sensitive data
  const cleanEntityData = (data: Partial<T>): Partial<T> => {
    const cleanData = { ...data };
    if ('password' in cleanData) {
      delete cleanData.password;
    }
    return cleanData;
  };

  const [editing, setEditing] = useState(isNew);
  const [formData, setFormData] = useState(cleanEntityData(initialEntity));
  const [versions, setVersions] = useState<T[]>([]);
  const [currentVersionIndex, setCurrentVersionIndex] = useState(0);
  const [isAddingVersion, setIsAddingVersion] = useState(false);

  // Load versions when component mounts
  useEffect(() => {
    const loadVersions = async () => {
      if (!isNew && initialEntity.versionChainId) {
        try {
          const loadedVersions = await repository.getVersions(initialEntity.versionChainId);
          setVersions(loadedVersions);
          
          const currentIndex = loadedVersions.findIndex(v => v.id === initialEntity.id);
          setCurrentVersionIndex(currentIndex !== -1 ? currentIndex : 0);
          
          // Set initial version data
          const versionData = loadedVersions[currentIndex !== -1 ? currentIndex : 0] || initialEntity;
          setFormData(cleanEntityData(versionData));
        } catch (error) {
          console.error('Error loading versions:', error);
        }
      }
    };
    loadVersions();
  }, [initialEntity.versionChainId, isNew]);

  // Update form data when version changes
  useEffect(() => {
    if (versions.length > 0 && !isNew) {
      const versionData = versions[currentVersionIndex];
      setFormData(cleanEntityData(versionData));
    }
  }, [currentVersionIndex]);

  return {
    editing,
    setEditing,
    formData,
    setFormData,
    versions,
    currentVersionIndex,
    setCurrentVersionIndex,
    isAddingVersion,
    setIsAddingVersion
  };
}