import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, Switch, Alert } from 'react-native';
import { colors, sharedStyles } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { Language, addLanguage, updateLanguage, deleteLanguage, getAllLatestUsers, addLanguageVersion, getLanguageVersions } from '@/utils/databaseService';
import { CustomDropdown } from './CustomDropdown';

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
  const [editing, setEditing] = useState(isNew);
  const [formData, setFormData] = useState(language);
  const [users, setUsers] = useState<Array<{ username: string }>>([]);
  const [versions, setVersions] = useState<Language[]>([]);
  const [currentVersionIndex, setCurrentVersionIndex] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      await loadUsers();
      if (!isNew && language.versionChainId) {
        const loadedVersions = await getLanguageVersions(language.versionChainId);
        setVersions(loadedVersions);
        const currentIndex = loadedVersions.findIndex(v => v.id === language.id);
        const currentVersion = loadedVersions[currentIndex !== -1 ? currentIndex : 0] || language;
        setCurrentVersionIndex(currentIndex !== -1 ? currentIndex : 0);
        setFormData({
          ...currentVersion,
          creator: currentVersion.creator || ''
        });
      }
    };
    
    loadData();
  }, []);
  
  // Handle version navigation
  useEffect(() => {
    if (versions.length > 0 && !isNew) {
      const newVersion = versions[currentVersionIndex];
      // Ensure we're creating a new object reference to trigger re-render
      setFormData({
        ...newVersion,
        creator: newVersion.creator || ''
      });
    }
  }, [currentVersionIndex, versions]); 
  
  const handleAddVersion = async () => {
    try {
      if (!language.id) {
        throw new Error('Language ID is required for versioning');
      }
      const newId = await addLanguageVersion(language as Language, formData);
      Alert.alert('Success', 'New version created successfully');
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error creating version:', error);
      Alert.alert('Error', 'Failed to create new version');
    }
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

  const loadUsers = async () => {
    try {
      const loadedUsers = await getAllLatestUsers();
      setUsers(loadedUsers);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const handleSave = async () => {
    try {
      if (!formData.nativeName || !formData.englishName) {
        Alert.alert('Error', 'Native name and English name are required');
        return;
      }
  
      const saveData = {
        ...formData,
        uiReady: formData.uiReady || false,
        iso639_3: formData.iso639_3 || null,
        creator: formData.creator || ''
      };
  
      if (isNew) {
        await addLanguage(saveData as Omit<Language, 'id' | 'rev'>);
        Alert.alert('Success', 'Language created successfully');
      } else {
        await updateLanguage(saveData as Language);
        Alert.alert('Success', 'Language updated successfully');
      }
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error saving language:', error);
      Alert.alert('Error', 'Failed to save language');
    }
  };

  const handleDelete = async () => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this versino of the language?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete version',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!language.id) {
                throw new Error('Language ID is required for deletion');
              }
              await deleteLanguage(language.id);
              Alert.alert('Success', 'Language version deleted successfully');
              onUpdate();
              onClose();
            } catch (error) {
              console.error('Error deleting language version:', error);
              Alert.alert('Error', 'Failed to delete language version');
            }
          }
        }
      ]
    );
  };

  const renderForm = () => (
    <View style={sharedStyles.modalContent}>
      <TextInput
        style={sharedStyles.input}
        value={formData.nativeName}
        onChangeText={(text) => setFormData({ ...formData, nativeName: text })}
        placeholder="Native Name"
        placeholderTextColor={colors.textSecondary}
      />
      <TextInput
        style={sharedStyles.input}
        value={formData.englishName}
        onChangeText={(text) => setFormData({ ...formData, englishName: text })}
        placeholder="English Name"
        placeholderTextColor={colors.textSecondary}
      />
      <TextInput
        style={sharedStyles.input}
        value={formData.iso639_3 || ''}
        onChangeText={(text) => setFormData({ ...formData, iso639_3: text || null })}
        placeholder="ISO 639-3"
        placeholderTextColor={colors.textSecondary}
      />
      <CustomDropdown
      label="Creator"
      value={formData.creator || ''} // Ensure we always have a value
      options={users.map(u => u.username)}
      onSelect={(username) => {
        setFormData(prev => ({
          ...prev,
          creator: username
        }));
      }}
      containerStyle={{ marginBottom: 16 }}
    />
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
        <Text style={{ color: colors.text }}>UI Ready</Text>
        <Switch
          value={formData.uiReady || false}
          onValueChange={(value) => setFormData({ ...formData, uiReady: value })}
          style={{ marginLeft: 8 }}
        />
      </View>
    </View>
  );

  return (
    <View style={sharedStyles.modalOverlay}>
      <View style={sharedStyles.modal}>
        <Text style={sharedStyles.modalTitle}>
          {isNew ? 'New Language' : editing ? 'Edit Version' : 'Language Details'}
        </Text>
  
        {!isNew && renderVersionControls()}
        
        {editing || isNew ? renderForm() : (
          <View style={sharedStyles.modalContent}>
            <Text style={{ color: colors.text }}>Native Name: {formData.nativeName}</Text>
            <Text style={{ color: colors.text }}>English Name: {formData.englishName}</Text>
            <Text style={{ color: colors.text }}>ISO 639-3: {formData.iso639_3 || 'N/A'}</Text>
            <Text style={{ color: colors.text }}>Creator: {formData.creator || 'N/A'}</Text>
            <Text style={{ color: colors.text }}>UI Ready: {formData.uiReady ? 'Yes' : 'No'}</Text>
            <Text style={{ color: colors.text }}>Version: {formData.versionNum || 1}</Text>
            <Text style={{ color: colors.text }}>Chain ID: {formData.versionChainId || 'N/A'}</Text>
          </View>
        )}
  
        <View style={{ gap: 10 }}>
          {!isNew && (
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
                onPress={handleAddVersion}
              >
                <Text style={sharedStyles.modalButtonText}>Add Version</Text>
              </TouchableOpacity>
            </View>
          )}
          
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {(editing || isNew) ? (
              <TouchableOpacity
                style={[sharedStyles.modalButton, { backgroundColor: colors.primary, flex: 1 }]}
                onPress={handleSave}
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
            onPress={onClose}
          >
            <Text style={sharedStyles.modalButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};