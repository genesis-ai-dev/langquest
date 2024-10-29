import { useState, useEffect } from 'react';
import { VersionedEntity } from '@/database_components/VersionedRepository';
import { VersionedRepository } from '@/database_components/VersionedRepository';

export function useVersionManagement<T extends VersionedEntity>(
  repository: VersionedRepository<T>,
  initialEntity: Partial<T>,
  isNew: boolean
) {
  const [editing, setEditing] = useState(isNew);
  const [formData, setFormData] = useState(initialEntity);
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
        setFormData(loadedVersions[currentIndex !== -1 ? currentIndex : 0] || initialEntity);
      }
    };
    loadVersions();
  }, []);

  useEffect(() => {
    if (versions.length > 0 && !isNew) {
      setFormData(versions[currentVersionIndex]);
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