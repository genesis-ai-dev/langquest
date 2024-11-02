import React, { useState, useEffect } from 'react';
import { 
  View, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, sharedStyles, spacing } from '@/styles/theme';
import { CustomDropdown } from '@/components/CustomDropdown';
import { DevCardView } from './DevCardView';
import { DevDetailsView } from './DevDetailsView';
import { DevEditView } from './DevEditView';
import { tableConfig } from './devTableConfig';
import { VersionedEntity } from '@/database_components/VersionedRepository';

export function DevTableView() {
  const [selectedTable, setSelectedTable] = useState<string>(Object.keys(tableConfig)[0]);
  const [entities, setEntities] = useState<VersionedEntity[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<VersionedEntity | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    loadEntities();
  }, [selectedTable, refreshTrigger]);

  const loadEntities = async () => {
    setIsLoading(true);
    try {
      const config = tableConfig[selectedTable];
      const loadedEntities = await config.repository.getLatestOfAll();
      setEntities(loadedEntities);
    } catch (error) {
      console.error(`Error loading ${selectedTable} entities:`, error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleNewEntity = () => {
    setIsCreatingNew(true);
  };

  return (
    <View style={sharedStyles.container}>
      {/* Table Selector */}
      <CustomDropdown
        label="Table"
        value={selectedTable}
        options={Object.keys(tableConfig)}
        onSelect={setSelectedTable}
        containerStyle={{ marginBottom: spacing.medium }}
      />

      {/* Entity List */}
      {isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : (
        <FlatList
          data={entities}
          renderItem={({ item }) => (
            <DevCardView
              entity={item}
              config={tableConfig[selectedTable]}
              onSelect={setSelectedEntity}
            />
          )}
          keyExtractor={item => item.id}
          style={sharedStyles.list}
          contentContainerStyle={{ paddingBottom: spacing.xxxlarge }}
        />
      )}

      {/* New Entity Button */}
      <TouchableOpacity 
        style={[
          sharedStyles.button,
          { 
            position: 'absolute',
            bottom: spacing.large,
            right: spacing.large,
            width: 56,
            height: 56,
            borderRadius: 28,
            margin: 0,
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
            elevation: 5,
          }
        ]} 
        onPress={handleNewEntity}
      >
        <Ionicons name="add" size={24} color={colors.buttonText} />
      </TouchableOpacity>

      {/* Details Modal */}
      {selectedEntity && (
        <DevDetailsView
          entity={selectedEntity}
          config={tableConfig[selectedTable]}
          onClose={() => setSelectedEntity(null)}
          onUpdate={handleRefresh}
        />
      )}

      {/* New Entity Modal */}
      {isCreatingNew && (
        <DevEditView
          entity={{} as VersionedEntity}
          config={tableConfig[selectedTable]}
          isNew={true}
          onSave={() => {
            setIsCreatingNew(false);
            handleRefresh();
          }}
          onClose={() => setIsCreatingNew(false)}
        />
      )}
    </View>
  );
}