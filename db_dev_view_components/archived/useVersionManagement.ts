import { useState, useEffect } from 'react';
import { VersionedEntity } from '@/database_components/VersionedRepository';
import { VersionedRepository } from '@/database_components/VersionedRepository';

export function useVersionManagement<T extends VersionedEntity>(
  repository: VersionedRepository<T>,
  initialEntity: Partial<T>,
  isNew: boolean
) {
  // Remove password from initial form data
  const initialFormData = { ...initialEntity };
  if ('password' in initialFormData) {
    delete initialFormData.password;
  }
  
  const [editing, setEditing] = useState(isNew);
  const [formData, setFormData] = useState(initialFormData);
  const [versions, setVersions] = useState<T[]>([]);
  const [currentVersionIndex, setCurrentVersionIndex] = useState(0);
  const [isAddingVersion, setIsAddingVersion] = useState(false);

  useEffect(() => {
    const loadVersions = async () => {
      if (!isNew && initialEntity.versionChainId) {
        const loadedVersions = await repository.getVersions(initialEntity.versionChainId);
        setVersions(loadedVersions);
        const currentIndex = loadedVersions.findIndex(v => v.id === initialEntity.id);
        setCurrentVersionIndex(currentIndex !== -1 ? currentIndex : 0);
        
        // Remove password when setting version data
        const versionData = loadedVersions[currentIndex !== -1 ? currentIndex : 0] || initialEntity;
        const cleanVersionData = { ...versionData };
        if ('password' in cleanVersionData) {
          delete cleanVersionData.password;
        }
        setFormData(cleanVersionData);
      }
    };
    loadVersions();
  }, []);

  useEffect(() => {
    if (versions.length > 0 && !isNew) {
      const versionData = versions[currentVersionIndex];
      const cleanVersionData = { ...versionData };
      if ('password' in cleanVersionData) {
        delete cleanVersionData.password;
      }
      setFormData(cleanVersionData);
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