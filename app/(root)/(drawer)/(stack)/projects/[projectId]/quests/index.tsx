import { PageHeader } from '@/components/PageHeader';
import { ProjectDetails } from '@/components/ProjectDetails';
import { ProjectMembershipModal } from '@/components/ProjectMembershipModal';
import { ProjectSettingsModal } from '@/components/ProjectSettingsModal';
import { QuestFilterModal } from '@/components/QuestFilterModal';
import { useAuth } from '@/contexts/AuthProvider';
import {
  useSessionMemberships,
  useSessionProjects
} from '@/contexts/SessionCacheContext';
import type { Quest } from '@/database_services/questService';
import type { Tag } from '@/database_services/tagService';
import { useLocalization } from '@/hooks/useLocalization';
import { useNavigation } from '@/hooks/useNavigation';
import { colors, sharedStyles } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import React, { Suspense, useCallback, useEffect, useState } from 'react';
import {
  BackHandler,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useProjectById } from '@/hooks/db/useProjects';
import { useRenderCounter } from '@/utils/performanceUtils';
import { QuestList } from './_questsComponents/QuestList';
import { QuestListSkeleton } from './_questsComponents/QuestListSkeleton';
import { QuestsScreenStyles } from './_questsComponents/QuestsScreenStyles';

export interface SortingOption {
  field: string;
  order: 'asc' | 'desc';
}

// Helper functions outside component to prevent recreation
export const filterQuests = <T extends Quest>(
  quests: T[],
  questTags: Record<string, Tag[]>,
  searchQuery: string,
  activeFilters: Record<string, string[]>
) => {
  if (!quests.length) return [];

  return quests.filter((quest) => {
    // Early return if no filters
    if (!searchQuery && Object.keys(activeFilters).length === 0) return true;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        quest.name.toLowerCase().includes(query) ||
        (quest.description?.toLowerCase().includes(query) ?? false);
      if (!matchesSearch) return false;
    }

    // Tag filters - only check if there are active filters
    if (Object.keys(activeFilters).length > 0) {
      const matchesFilters = Object.entries(activeFilters).every(
        ([category, selectedOptions]) => {
          if (selectedOptions.length === 0) return true;
          return questTags[quest.id]?.some((tag) => {
            const [tagCategory, tagValue] = tag.name.split(':');
            return (
              tagCategory?.toLowerCase() === category.toLowerCase() &&
              selectedOptions.includes(
                `${category.toLowerCase()}:${tagValue?.toLowerCase()}`
              )
            );
          });
        }
      );
      if (!matchesFilters) return false;
    }

    return true;
  });
};

// Main component with Suspense boundaries
const Quests = React.memo(() => {
  const { t } = useLocalization();
  const { projectId, projectName } = useLocalSearchParams<{
    projectId: string;
    projectName: string;
  }>();

  // Add performance tracking
  useRenderCounter('Quests');

  const [searchQuery, setSearchQuery] = useState('');
  const { currentUser } = useAuth();

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

  const { goToQuest } = useNavigation();

  // Try to get project from cache first, fallback to fresh query
  const cachedProject = getCachedProject(projectId);
  const { project: freshProject } = useProjectById(projectId);

  // Use cached project if available, otherwise use fresh data
  const selectedProject = cachedProject || freshProject;

  // Cache the project data when fresh data arrives
  useEffect(() => {
    if (freshProject && !cachedProject) {
      setCachedProject(freshProject);
    }
  }, [freshProject, cachedProject, setCachedProject]);

  // Check if current user is an owner using session cache
  const isOwner = isUserOwner(projectId);

  const getActiveOptionsCount = () => {
    const filterCount = Object.values(activeFilters).flat().length;
    const sortCount = activeSorting.length;
    return filterCount + sortCount;
  };

  const handleQuestPress = (quest: Quest) => {
    goToQuest(quest);
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

  const handleLoadMore = useCallback(() => {
    // Load more logic will be handled by QuestList component
  }, []);

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
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <View
          style={[sharedStyles.container, { backgroundColor: 'transparent' }]}
        >
          <PageHeader title={projectName || t('quests')} />

          {/* Search and filters */}
          <View style={QuestsScreenStyles.searchContainer}>
            <TextInput
              style={QuestsScreenStyles.searchInput}
              placeholder={t('search')}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={colors.textSecondary}
            />
            <TouchableOpacity
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
            </TouchableOpacity>
          </View>

          {/* Quest list with Suspense boundary */}
          <Suspense fallback={<QuestListSkeleton />}>
            <QuestList
              projectId={projectId}
              activeSorting={activeSorting}
              searchQuery={searchQuery}
              activeFilters={activeFilters}
              onQuestPress={handleQuestPress}
              onLoadMore={handleLoadMore}
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
              questTags={{}} // Empty for now - could be improved later
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
          projectId={projectId}
        />
        <ProjectSettingsModal
          isVisible={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          projectId={projectId}
        />
      </SafeAreaView>
    </LinearGradient>
  );
});

export default Quests;
