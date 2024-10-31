import React, { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { Language } from '@/database_components/LanguageRepository';
import { User } from '@/database_components/UserRepository';
import { languageRepository, userRepository } from '@/database_components/repositories';
import { DevEntityDetails } from './DevEntityDetails';
import { languageFields } from './entityFields';

interface LanguageDetailsProps {
  language: Partial<Language>;
  onClose: () => void;
  onUpdate: () => void;
  isNew?: boolean;
}

export const DevLanguageDetails: React.FC<LanguageDetailsProps> = ({ 
  language, 
  onClose, 
  onUpdate,
  isNew = false
}) => {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      console.log('Loading users...');
      const loadedUsers = await userRepository.getLatestOfAll();
      console.log('Loaded users:', loadedUsers);
      console.log('Setting users...');
      setUsers(loadedUsers);
      console.log('Users set');
    } catch (error) {
      console.error('Error loading users in loadUsers (DevLanguageDetails):', error);
    }
  };

  const handleSave = async (formData: Partial<Language>) => {
    try {
      if (!formData.nativeName || !formData.englishName) {
        Alert.alert('Error', 'Native name and English name are required');
        return;
      }

      const saveData = {
        nativeName: formData.nativeName,
        englishName: formData.englishName,
        iso639_3: formData.iso639_3 || null,
        uiReady: formData.uiReady || false,
        creator: formData.creator || ''
      };

      if (isNew) {
        await languageRepository.createNew(saveData);
        Alert.alert('Success', 'Language created successfully');
      } else {
        await languageRepository.addVersion(language as Language, saveData);
        Alert.alert('Success', 'Language updated successfully');
      }
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error saving language:', error);
      Alert.alert('Error', 'Failed to save language');
    }
  };

  const handleAddVersion = async (formData: Partial<Language>) => {
    try {
      if (!language.id) {
        throw new Error('Language ID is required for versioning');
      }
      await languageRepository.addVersion(language as Language, formData);
      Alert.alert('Success', 'New version created successfully');
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error creating version:', error);
      Alert.alert('Error', 'Failed to create new version');
    }
  };

  return (
    <DevEntityDetails<Language>
      entity={language}
      repository={languageRepository}
      fields={languageFields}
      title="Language"
      onClose={onClose}
      onUpdate={onUpdate}
      isNew={isNew}
      onSave={handleSave}
      onAddVersion={handleAddVersion}
      dropdownOptions={{
        creator: users
      }}
    />
  );
};