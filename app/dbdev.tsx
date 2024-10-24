import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, sharedStyles } from '@/styles/theme';
import { CustomDropdown } from '@/components/CustomDropdown';
import { DevLanguageDetails } from '@/components/DevLanguageDetails';
import { DevUserDetails } from '@/components/DevUserDetails';
import { 
  getAllLatestLanguages, 
  getAllLatestUsers, 
  Language, 
  User
} from '@/utils/databaseService';
import { Ionicons } from '@expo/vector-icons';

type ListItem = Language | User;

const tables = ['Language', 'User'];

const LanguageCard: React.FC<{ language: Language }> = ({ language }) => (
  <View style={sharedStyles.card}>
    <Text style={sharedStyles.cardTitle}>{language.nativeName}</Text>
    <Text style={sharedStyles.cardDescription}>{language.englishName}</Text>
    <Text style={sharedStyles.cardLanguageText}>
      ISO: {language.iso639_3 || 'N/A'} | UI Ready: {language.uiReady ? 'Yes' : 'No'}
      {language.creator ? ` | Creator: ${language.creator}` : ''}
    </Text>
  </View>
);

const UserCard: React.FC<{ user: User; languages: Language[] }> = ({ user, languages }) => {
  const uiLanguage = languages.find(l => l.id === user.uiLanguage);
  return (
    <View style={sharedStyles.card}>
      <Text style={sharedStyles.cardTitle}>{user.username}</Text>
      <Text style={sharedStyles.cardDescription}>
        UI Language: {uiLanguage?.englishName || 'Unknown'}
      </Text>
      <Text style={sharedStyles.cardLanguageText}>Version: {user.versionNum || 1}</Text>
    </View>
  );
};

export default function DbDev() {
  const [selectedTable, setSelectedTable] = useState('Language');
  const [languages, setLanguages] = useState<Language[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<Language | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    loadData();
  }, [refreshTrigger, selectedTable]);

  const loadData = async () => {
    try {
      if (selectedTable === 'Language') {
        const loadedLanguages = await getAllLatestLanguages();
        console.log('Loaded languages:', loadedLanguages);
        setLanguages(loadedLanguages);
      } else {
        const loadedUsers = await getAllLatestUsers();
        console.log('Loaded users with details:', loadedUsers);
        setUsers(loadedUsers);
      }
    } catch (error) {
      console.error(`Error loading ${selectedTable}s:`, error);
      Alert.alert('Error', `Failed to load ${selectedTable}s`);
    }
  };

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleNew = () => {
    if (selectedTable === 'Language') {
      const newLanguage: Partial<Language> = {
        nativeName: '',
        englishName: '',
        iso639_3: null,
        uiReady: false,
        creator: ''
      };
      setSelectedLanguage(newLanguage as Language);
    } else {
      const newUser: Partial<User> = {
        username: '',
        password: '',
        uiLanguage: ''
      };
      setSelectedUser(newUser as User);
    }
  };

  return (
    <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['left', 'right']}>
        <View style={[sharedStyles.container, { backgroundColor: 'transparent' }]}>
          <CustomDropdown
            label="Table"
            value={selectedTable}
            options={tables}
            onSelect={setSelectedTable}
            containerStyle={{ marginBottom: 16 }}
          />

          <FlatList<ListItem>
            data={selectedTable === 'Language' ? languages : users}
            renderItem={({ item }) => (
              <TouchableOpacity 
                onPress={() => {
                  if ('nativeName' in item) {
                    setSelectedLanguage(item as Language);
                  } else {
                    setSelectedUser(item as User);
                  }
                }}
              >
                {'nativeName' in item 
                  ? <LanguageCard language={item as Language} />
                  : <UserCard user={item as User} languages={languages} />
                }
              </TouchableOpacity>
            )}
            keyExtractor={item => item.id}
            style={sharedStyles.list}
          />

          <TouchableOpacity 
            style={[sharedStyles.button]} 
            onPress={handleNew}
          >
            <Ionicons name="add" size={24} color={colors.buttonText} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {selectedLanguage && (
        <DevLanguageDetails
          language={selectedLanguage}
          onClose={() => setSelectedLanguage(null)}
          onUpdate={handleRefresh}
          isNew={!selectedLanguage.id}
        />
      )}

      {selectedUser && (
        <DevUserDetails
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onUpdate={handleRefresh}
          isNew={!selectedUser.id}
        />
      )}
    </LinearGradient>
  );
}