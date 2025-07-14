/**
 * QuestsView - Migrated from app/_(root)/(drawer)/(stack)/projects/[projectId]/quests/index.tsx
 * Now works with state-driven navigation instead of routes
 */

import { ProjectDetails } from '@/components/ProjectDetails';
import { ProjectMembershipModal } from '@/components/ProjectMembershipModal';
import { ProjectSettingsModal } from '@/components/ProjectSettingsModal';
import { QuestFilterModal } from '@/components/QuestFilterModal';
import { useAuth } from '@/contexts/AuthContext';
import {
  useSessionMemberships,
  useSessionProjects
} from '@/contexts/SessionCacheContext';
import type { Quest } from '@/database_services/questService';
import { useProjectById } from '@/hooks/db/useProjects';
import {
  useAppNavigation,
  useCurrentNavigation
} from '@/hooks/useAppNavigation';
import { useLocalization } from '@/hooks/useLocalization';
import { colors, sharedStyles } from '@/styles/theme';
import { useRenderCounter } from '@/utils/performanceUtils';
import { Ionicons } from '@expo/vector-icons';
import React, { Suspense, useEffect, useState } from 'react';
import {
  BackHandler,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

// Import quest components
import { QuestList } from '../components/questsComponents/QuestList';
import { QuestListSkeleton } from '../components/questsComponents/QuestListSkeleton';
import { QuestsScreenStyles } from '../components/questsComponents/QuestsScreenStyles';

export interface SortingOption {
  field: string;
  order: 'asc' | 'desc';
}

export default function QuestsView() {
  const { t: _t } = useLocalization();
  const { currentUser: _currentUser } = useAuth();
  const { goToQuest } = useAppNavigation();

  // Get current navigation state
  const { currentProjectId } = useCurrentNavigation();

  // Add performance tracking
  useRenderCounter('QuestsView');

  const [searchQuery, setSearchQuery] = useState('');

  // Use session cache for user membership
  const { isUserOwner } = useSessionMemberships();
  const { getCachedProject, setCachedProject } = useSessionProjects();

  // Feature flags to toggle button visibility
  const SHOW_SETTINGS_BUTTON = true;
  const SHOW_MEMBERSHIP_BUTTON = true;

  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>(
    {}
  );
  const [activeSorting, setActiveSorting] = useState<SortingOption[]>([]);
  const [showProjectStats, setShowProjectStats] = useState(false);
  const [showMembershipModal, setShowMembershipModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Early return if no project is selected
  if (!currentProjectId) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>No project selected</Text>
      </View>
    );
  }

  // Try to get project from cache first, fallback to fresh query
  const cachedProject = getCachedProject(currentProjectId);
  const { project: freshProject } = useProjectById(currentProjectId);

  // ✅ OPTIMIZATION: QuestFilterModal now handles its own tag categories fetching
  // - Uses project_tag_categories view internally for efficient loading
  // - Self-contained data management within the modal component

  // Use cached project if available, otherwise use fresh data
  const selectedProject = cachedProject || freshProject;

  // Cache the project data when fresh data arrives
  useEffect(() => {
    if (freshProject && !cachedProject) {
      setCachedProject(freshProject);
    }
  }, [freshProject, cachedProject, setCachedProject]);

  // Check if current user is an owner using session cache
  const isOwner = isUserOwner(currentProjectId);

  // const getActiveOptionsCount = () => {
  //   const filterCount = Object.values(activeFilters).flat().length;
  //   const sortCount = activeSorting.length;
  //   return filterCount + sortCount;
  // };

  const handleQuestPress = (quest: Quest) => {
    goToQuest({
      id: quest.id,
      project_id: quest.project_id,
      name: quest.name
    });
  };

  const handleCloseDetails = () => {
    setShowProjectStats(false);
  };

  const handleApplyFilters = (filters: Record<string, string[]>) => {
    setActiveFilters(filters);
    setIsFilterModalVisible(false);
  };

  const handleApplySorting = (sorting: SortingOption[]) => {
    setActiveSorting(sorting);
  };

  const toggleProjectStats = () => {
    setShowProjectStats((prev) => !prev);
  };

  // Handle back button press
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (isFilterModalVisible) {
          setIsFilterModalVisible(false);
          return true;
        }
        return false;
      }
    );

    return () => backHandler.remove();
  }, [isFilterModalVisible]);

  return (
    <View style={styles.container}>
      <View
        style={[sharedStyles.container, { backgroundColor: 'transparent' }]}
      >
        {/* Search and filters */}
        <View style={QuestsScreenStyles.searchContainer}>
          <TextInput
            style={QuestsScreenStyles.searchInput}
            placeholder="Search quests..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={colors.textSecondary}
          />
          {/* <TouchableOpacity
            onPress={() => setIsFilterModalVisible(true)}
            style={QuestsScreenStyles.filterButton}
          >
            <Ionicons name="filter" size={20} color={colors.text} />
            {getActiveOptionsCount() > 0 && (
              <View style={QuestsScreenStyles.filterBadge}>
                <Text style={QuestsScreenStyles.filterBadgeText}>
                  {getActiveOptionsCount()}
                </Text>
              </View>
            )}
          </TouchableOpacity> */}
        </View>

        {/* Quest list with Suspense boundary - SQL-based search now handled in QuestList */}
        <Suspense fallback={<QuestListSkeleton />}>
          <QuestList
            projectId={currentProjectId}
            activeSorting={activeSorting}
            searchQuery={searchQuery}
            activeFilters={activeFilters}
            onQuestPress={handleQuestPress}
          />
        </Suspense>

        {/* Floating action buttons */}
        <View style={QuestsScreenStyles.floatingButtonsContainer}>
          {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */}
          {isOwner && SHOW_SETTINGS_BUTTON && (
            <TouchableOpacity
              onPress={() => setShowSettingsModal(true)}
              style={QuestsScreenStyles.settingsButton}
            >
              <Ionicons name="settings" size={24} color={colors.text} />
            </TouchableOpacity>
          )}
          {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */}
          {SHOW_MEMBERSHIP_BUTTON && (
            <TouchableOpacity
              onPress={() => setShowMembershipModal(true)}
              style={QuestsScreenStyles.membersButton}
            >
              <Ionicons name="people" size={24} color={colors.text} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={toggleProjectStats}
            style={QuestsScreenStyles.floatingButton}
          >
            <Ionicons name="stats-chart" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Modals remain the same */}
      <Modal
        visible={isFilterModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsFilterModalVisible(false)}
      >
        <View style={{ flex: 1 }}>
          <QuestFilterModal
            onClose={() => setIsFilterModalVisible(false)}
            projectId={currentProjectId} // Pass projectId to QuestFilterModal
            onApplyFilters={handleApplyFilters}
            onApplySorting={handleApplySorting}
            initialFilters={activeFilters}
            initialSorting={activeSorting}
          />
        </View>
      </Modal>
      {showProjectStats && selectedProject && (
        <ProjectDetails
          project={selectedProject}
          onClose={handleCloseDetails}
        />
      )}
      <ProjectMembershipModal
        isVisible={showMembershipModal}
        onClose={() => setShowMembershipModal(false)}
        projectId={currentProjectId}
      />
      <ProjectSettingsModal
        isVisible={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        projectId={currentProjectId}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent'
  },
  emptyText: {
    flex: 1,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 16,
    color: colors.textSecondary
  }
});
