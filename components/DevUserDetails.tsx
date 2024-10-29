import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, sharedStyles } from '@/styles/theme';
import { CustomDropdown } from './CustomDropdown';
import { User, UserRepository } from '@/database_components/UserRepository';
import { Language, LanguageRepository } from '@/database_components/LanguageRepository';

interface UserDetailsProps {
  user: Partial<User>;
  onClose: () => void;
  onUpdate: () => void;
  isNew?: boolean;
}

// Add repository instances
const userRepository = new UserRepository();
const languageRepository = new LanguageRepository();

export const DevUserDetails: React.FC<UserDetailsProps> = ({ 
  user, 
  onClose, 
  onUpdate,
  isNew = false
}) => {
  const [editing, setEditing] = useState(isNew);
  const [formData, setFormData] = useState(user);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [password, setPassword] = useState('');
  const [versions, setVersions] = useState<User[]>([]);
  const [currentVersionIndex, setCurrentVersionIndex] = useState(0);
  const [newPassword, setNewPassword] = useState('');
  const [requireOldPassword, setRequireOldPassword] = useState(true);
  const [isAddingVersion, setIsAddingVersion] = useState(false);
  const [versionPassword, setVersionPassword] = useState('');

  useEffect(() => {
    const loadData = async () => {
      await loadLanguages();
      if (!isNew && user.versionChainId) {
        const loadedVersions = await userRepository.getVersions(user.versionChainId);
        setVersions(loadedVersions);
        const currentIndex = loadedVersions.findIndex(v => v.id === user.id);
        const currentVersion = loadedVersions[currentIndex !== -1 ? currentIndex : 0] || user;
        setCurrentVersionIndex(currentIndex !== -1 ? currentIndex : 0);
        setFormData(currentVersion);
      }
    };
    loadData();
  }, []);
  
  // Update the version navigation effect
  useEffect(() => {
    if (versions.length > 0 && !isNew) {
      const newVersion = versions[currentVersionIndex];
      setFormData(newVersion);
    }
  }, [currentVersionIndex, versions]);
  
  // Add this effect for version navigation
  useEffect(() => {
    if (versions.length > 0 && !isNew) {
      setFormData(versions[currentVersionIndex]);
    }
  }, [currentVersionIndex]);

  const loadLanguages = async () => {
    try {
      const loadedLanguages = await languageRepository.getLatestOfAll();
      setLanguages(loadedLanguages);
    } catch (error) {
      console.error('Error loading languages:', error);
    }
  };

  const handleSave = async () => {
    try {
      if (!formData.username || !formData.uiLanguage) {
        Alert.alert('Error', 'Username and UI Language are required');
        return;
      }

      if (isNew && !password) {
        Alert.alert('Error', 'Password is required for new users');
        return;
      }

      const saveData = {
        username: formData.username,
        uiLanguage: formData.uiLanguage,
        password: isNew ? password : formData.password
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

  const handleAddVersion = async () => {
    try {
      if (!formData.id) {
        throw new Error('User ID is required for versioning');
      }

      const versionData = {
        ...formData,
        password: versionPassword ? versionPassword : formData.password
      };
      
      await userRepository.addVersion(formData as User, versionData);
  
      Alert.alert('Success', 'New version created successfully');
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error creating version:', error);
      Alert.alert('Error', 'Failed to create new version');
    }
  };

  const handleAddVersionClick = () => {
    setIsAddingVersion(true);
    setEditing(true);
  };

  const handleDelete = async () => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this version of the user?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete version',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!user.id) {
                throw new Error('User ID is required for deletion');
              }
              await userRepository.delete(user.id);
              Alert.alert('Success', 'User version deleted successfully');
              onUpdate();
              onClose();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete user version');
            }
          }
        }
      ]
    );
  };

  const renderVersionControls = () => {
    if (isNew || !versions.length) return null;

    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
        <TouchableOpacity 
          onPress={() => setCurrentVersionIndex(prev => Math.min(prev + 1, versions.length - 1))}
          disabled={currentVersionIndex >= versions.length - 1}
        >
          <Ionicons 
            name="chevron-back" 
            size={24} 
            color={currentVersionIndex >= versions.length - 1 ? colors.textSecondary : colors.text} 
          />
        </TouchableOpacity>
        <Text style={{ color: colors.text, marginHorizontal: 8 }}>
          Version {versions[currentVersionIndex]?.versionNum || 1}
        </Text>
        <TouchableOpacity 
          onPress={() => setCurrentVersionIndex(prev => Math.max(prev - 1, 0))}
          disabled={currentVersionIndex <= 0}
        >
          <Ionicons 
            name="chevron-forward" 
            size={24} 
            color={currentVersionIndex <= 0 ? colors.textSecondary : colors.text} 
          />
        </TouchableOpacity>
      </View>
    );
  };


  const renderForm = () => (
    <View style={sharedStyles.modalContent}>
      <TextInput
        style={sharedStyles.input}
        value={formData.username}
        onChangeText={(text) => setFormData({ ...formData, username: text })}
        placeholder="Username"
        placeholderTextColor={colors.textSecondary}
      />
      
      {isAddingVersion && (
        <TextInput
          style={sharedStyles.input}
          value={versionPassword}
          onChangeText={setVersionPassword}
          placeholder="Leave password unchanged"
          placeholderTextColor={colors.textSecondary}
          secureTextEntry
        />
      )}
      
      <CustomDropdown
        label="UI Language"
        value={languages.find(l => l.id === formData.uiLanguage)?.englishName || ''}
        options={languages.map(l => l.englishName)}
        onSelect={(langName) => {
          const lang = languages.find(l => l.englishName === langName);
          if (lang) {
            setFormData({ ...formData, uiLanguage: lang.id });
          }
        }}
        containerStyle={{ marginBottom: 16 }}
      />
    </View>
  );
  

  return (
    <View style={sharedStyles.modalOverlay}>
      <View style={sharedStyles.modal}>
        <Text style={sharedStyles.modalTitle}>
          {isNew ? 'New User' : isAddingVersion ? 'Add Version' : editing ? 'Edit Version' : 'User Details'}
        </Text>
  
        {!isNew && renderVersionControls()}
        
        {(editing || isNew || isAddingVersion) ? renderForm() : (
          <View style={sharedStyles.modalContent}>
            <Text style={{ color: colors.text }}>Username: {formData.username}</Text>
            <Text style={{ color: colors.text }}>
              UI Language: {languages.find(l => l.id === formData.uiLanguage)?.englishName || 'N/A'}
            </Text>
            <Text style={{ color: colors.text }}>Version: {formData.versionNum || 1}</Text>
            <Text style={{ color: colors.text }}>Chain ID: {formData.versionChainId || 'N/A'}</Text>
          </View>
        )}
  
        <View style={{ gap: 10 }}>
          {!isNew && !isAddingVersion && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <TouchableOpacity 
                style={[sharedStyles.modalButton, { backgroundColor: colors.primary, flex: 1, marginRight: 5 }]}
                onPress={() => setEditing(!editing)}
              >
                <Text style={sharedStyles.modalButtonText}>
                  {editing ? 'Cancel' : 'Edit Version'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[sharedStyles.modalButton, { backgroundColor: colors.primary, flex: 1, marginLeft: 5 }]}
                onPress={handleAddVersionClick}
              >
                <Text style={sharedStyles.modalButtonText}>Add Version</Text>
              </TouchableOpacity>
            </View>
          )}
          
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {(editing || isNew || isAddingVersion) ? (
              <TouchableOpacity
                style={[sharedStyles.modalButton, { backgroundColor: colors.primary, flex: 1 }]}
                onPress={isAddingVersion ? handleAddVersion : handleSave}
              >
                <Text style={sharedStyles.modalButtonText}>Save</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[sharedStyles.modalButton, { backgroundColor: 'red', flex: 1 }]}
                onPress={handleDelete}
              >
                <Text style={sharedStyles.modalButtonText}>Delete Version</Text>
              </TouchableOpacity>
            )}
          </View>
          
          <TouchableOpacity
            style={[sharedStyles.modalButton, { backgroundColor: colors.primary }]}
            onPress={() => {
              setIsAddingVersion(false);
              setEditing(false);
              onClose();
            }}
          >
            <Text style={sharedStyles.modalButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};