import React, { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { User } from '@/database_components/UserRepository';
import { Language } from '@/database_components/LanguageRepository';
import { userRepository, languageRepository } from '@/database_components/repositories';
import { DevEntityDetails } from './DevEntityDetails';
import { userFields } from './entityFields';

interface UserDetailsProps {
  user: Partial<User>;
  onClose: () => void;
  onUpdate: () => void;
  isNew?: boolean;
}

export const DevUserDetails: React.FC<UserDetailsProps> = ({ 
  user, 
  onClose, 
  onUpdate,
  isNew = false
}) => {
  const [languages, setLanguages] = useState<Language[]>([]);

  useEffect(() => {
    loadLanguages();
  }, []);

  const loadLanguages = async () => {
    try {
      const loadedLanguages = await languageRepository.getLatestOfAll();
      setLanguages(loadedLanguages);
    } catch (error) {
      console.error('Error loading languages in loadLanguages (DevUserDetails):', error);
    }
  };

  const handleSave = async (formData: Partial<User>) => {
    try {
      if (!formData.username || !formData.uiLanguage) {
        Alert.alert('Error', 'Username and UI Language are required');
        return;
      }

      if (isNew && !formData.password) {
        Alert.alert('Error', 'Password is required for new users');
        return;
      }

      const saveData = {
        username: formData.username,
        uiLanguage: formData.uiLanguage,
        password: formData.password
      };

      if (isNew) {
        await userRepository.createNew(saveData);
        Alert.alert('Success', 'User created successfully');
      } else {
        await userRepository.addVersion(formData as User, saveData);
        Alert.alert('Success', 'User updated successfully');
      }
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error saving user:', error);
      Alert.alert('Error', 'Failed to save user');
    }
  };

  const handleAddVersion = async (formData: Partial<User>) => {
    try {
      if (!user.id) {
        throw new Error('User ID is required for versioning');
      }

      const versionData = {
        ...formData,
        password: formData.password || user.password
      };
      
      await userRepository.addVersion(user as User, versionData);
      Alert.alert('Success', 'New version created successfully');
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error creating version:', error);
      Alert.alert('Error', 'Failed to create new version');
    }
  };

  return (
    <DevEntityDetails<User>
      entity={user}
      repository={userRepository}
      fields={userFields}
      title="User"
      onClose={onClose}
      onUpdate={onUpdate}
      isNew={isNew}
      onSave={handleSave}
      onAddVersion={handleAddVersion}
      dropdownOptions={{
        uiLanguage: languages
      }}
    />
  );
};