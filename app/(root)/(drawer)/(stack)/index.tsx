import { CustomDropdown } from '@/components/CustomDropdown';
import { DownloadIndicator } from '@/components/DownloadIndicator';
import { PageHeader } from '@/components/PageHeader';
import { PrivateAccessGate } from '@/components/PrivateAccessGate';
import { ProgressBars } from '@/components/ProgressBars';
import { useAuth } from '@/contexts/AuthContext';
import { useProjectContext } from '@/contexts/ProjectContext';
import { useSystem } from '@/contexts/SystemContext';
import type { Translation } from '@/database_services/translationService';
import type { Vote } from '@/database_services/voteService';
import type { project } from '@/db/drizzleSchema';
import { profile_project_link } from '@/db/drizzleSchema';
import { useAttachmentAssetDownloadStatus } from '@/hooks/useAssetDownloadStatus';
import { useDownload } from '@/hooks/useDownloads';
import { useLocalization } from '@/hooks/useLocalization';
import { colors, sharedStyles, spacing } from '@/styles/theme';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAssetsByQuestId, useAssetsByProjectId } from '@/hooks/db/useAssets';
import { useLanguageById, useLanguages } from '@/hooks/db/useLanguages';
import { useProjects } from '@/hooks/db/useProjects';
import { getQuestsByProjectId } from '@/hooks/db/useQuests';
import { getTranslationsByAssetId } from '@/hooks/db/useTranslations';
import { getVotesByTranslationId } from '@/hooks/db/useVotes';
import { useLocalStore } from '@/store/localStore';
import {
  calculateProjectProgress,
  calculateQuestProgress
} from '@/utils/progressUtils';
import { Ionicons } from '@expo/vector-icons';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useQuery } from '@powersync/react-native';
import { FlashList } from '@shopify/flash-list';
import { and, eq } from 'drizzle-orm';

type Project = typeof project.$inferSelect;

const ProjectCard: React.FC<{ project: typeof project.$inferSelect }> = ({
  project
}) => {
  const { currentUser } = useAuth();
  const { db } = useSystem();
  const [progress, setProgress] = useState({
    approvedPercentage: 0,
    userContributedPercentage: 0,
    pendingTranslationsCount: 0,
    totalAssets: 0
  });

  // Use the new download hook
  const {
    isDownloaded,
    isLoading: isDownloadLoading,
    toggleDownload
  } = useDownload('project', project.id);

  const { language: sourceLanguage } = useLanguageById(
    project.source_language_id
  );
  const { language: targetLanguage } = useLanguageById(
    project.target_language_id
  );

  const { assets } = useAssetsByProjectId(project.id);
  const assetIds = assets?.map((asset) => asset.id) ?? [];

  const { data: membershipData = [] } = useQuery(
    toCompilableQuery(
      db.query.profile_project_link.findMany({
        where: and(
          eq(profile_project_link.profile_id, currentUser?.id || ''),
          eq(profile_project_link.project_id, project.id),
          eq(profile_project_link.active, true)
        )
      })
    )
  );

  const membershipRole = membershipData[0]?.membership as
    | 'owner'
    | 'member'
    | undefined;

  const { isDownloaded: assetsDownloaded, isLoading } =
    useAttachmentAssetDownloadStatus(assetIds);

  const handleDownloadToggle = async () => {
    await toggleDownload();
  };

  useEffect(() => {
    const loadProgress = async () => {
      try {
        // Load all quests for this project
        const quests = (await getQuestsByProjectId(project.id)) ?? [];

        // For each quest, load its assets and calculate progress
        const questProgresses = await Promise.all(
          quests.map(async (quest) => {
            const assets = (await getAssetsByQuestId(quest.id)) ?? [];
            const translations: Record<string, Translation[]> = {};
            const votes: Record<string, Vote[]> = {};

            // Load translations and votes for each asset
            await Promise.all(
              assets.map(async (asset) => {
                const assetTranslations =
                  (await getTranslationsByAssetId(asset.id)) ?? [];
                translations[asset.id] = assetTranslations;

                // Load votes for each translation
                await Promise.all(
                  assetTranslations.map(async (translation) => {
                    votes[translation.id] =
                      (await getVotesByTranslationId(translation.id)) ?? [];
                  })
                );
              })
            );

            // Create assets with translations and votes attached for calculateQuestProgress
            const assetsWithTranslations = assets.map((asset) => ({
              ...asset,
              translations: (translations[asset.id] || []).map(
                (translation) => ({
                  ...translation,
                  votes: votes[translation.id] || []
                })
              )
            }));

            return calculateQuestProgress(
              assetsWithTranslations,
              currentUser?.id ?? null
            );
          })
        );

        // Calculate aggregated project progress
        const projectProgress = calculateProjectProgress(questProgresses);
        setProgress(projectProgress);
      } catch (error) {
        console.error('Error loading progress:', error);
      }
    };

    void loadProgress();
  }, [project.id, currentUser?.id]);

  return (
    <View style={sharedStyles.card}>
      <View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: spacing.small
          }}
        >
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xsmall
            }}
          >
            <Text style={sharedStyles.cardTitle}>{project.name}</Text>
            {project.private && (
              <Ionicons
                name="lock-closed"
                size={16}
                color={colors.textSecondary}
              />
            )}
            {membershipRole === 'owner' && (
              <Ionicons name="ribbon" size={16} color={colors.primary} />
            )}
            {membershipRole === 'member' && (
              <Ionicons name="person" size={16} color={colors.primary} />
            )}
          </View>
          <PrivateAccessGate
            projectId={project.id}
            projectName={project.name}
            isPrivate={project.private}
            action="download"
            allowBypass={true}
            onBypass={handleDownloadToggle}
            renderTrigger={({ onPress, hasAccess }) => (
              <DownloadIndicator
                isDownloaded={isDownloaded && assetsDownloaded}
                isLoading={isLoading && isDownloadLoading}
                onPress={
                  hasAccess || isDownloaded ? handleDownloadToggle : onPress
                }
              />
            )}
          />
        </View>
        <Text style={sharedStyles.cardLanguageText}>
          {sourceLanguage?.native_name ?? sourceLanguage?.english_name} →{' '}
          {targetLanguage?.native_name ?? targetLanguage?.english_name}
        </Text>
      </View>

      <ProgressBars
        approvedPercentage={progress.approvedPercentage}
        userContributedPercentage={progress.userContributedPercentage}
        pickaxeCount={progress.pendingTranslationsCount}
      />

      {project.description && (
        <Text style={sharedStyles.cardDescription}>{project.description}</Text>
      )}
    </View>
  );
};

export default function Projects() {
  const { t } = useLocalization();
  const { goToProject } = useProjectContext();
  const { currentUser } = useAuth();
  const { db } = useSystem();
  const { projects } = useProjects();
  const { languages: allLanguages } = useLanguages();
  const sourceFilter = useLocalStore((state) => state.projectSourceFilter);
  const targetFilter = useLocalStore((state) => state.projectTargetFilter);
  const setSourceFilter = useLocalStore(
    (state) => state.setProjectSourceFilter
  );
  const setTargetFilter = useLocalStore(
    (state) => state.setProjectTargetFilter
  );
  const [openDropdown, setOpenDropdown] = useState<'source' | 'target' | null>(
    null
  );
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [privateProjectModal, setPrivateProjectModal] = useState<{
    isVisible: boolean;
    project: Project | null;
  }>({ isVisible: false, project: null });

  // Filter projects when filters change
  useEffect(() => {
    void filterProjects();
  }, [sourceFilter, targetFilter, projects]);

  const filterProjects = () => {
    if (!projects) return;
    try {
      // Start with all projects
      const filtered = [...projects];

      // Get all languages to avoid repeated calls

      // Create a new array with filtered results
      const results = [];

      // Go through each project
      for (const project of filtered) {
        // Find the source and target language objects
        const sourceLanguage = allLanguages?.find(
          (l) => l.id === project.source_language_id
        );
        const targetLanguage = allLanguages?.find(
          (l) => l.id === project.target_language_id
        );

        // Get language names (prefer native name, fall back to English name)
        const sourceName =
          sourceLanguage?.native_name ?? sourceLanguage?.english_name ?? '';
        const targetName =
          targetLanguage?.native_name ?? targetLanguage?.english_name ?? '';

        // Check if this project matches the filters
        const sourceMatch =
          sourceFilter === 'All' || sourceFilter === sourceName;

        const targetMatch =
          targetFilter === 'All' || targetFilter === targetName;

        // If both filters match, include this project
        if (sourceMatch && targetMatch) {
          results.push(project);
        }
      }

      // Update the filtered projects state
      setFilteredProjects(results);
    } catch (error) {
      console.error('Error filtering projects:', error);
      // Fall back to showing all projects if filtering fails
      setFilteredProjects(projects);
    }
  };

  const toggleDropdown = (dropdown: 'source' | 'target') => {
    setOpenDropdown(openDropdown === dropdown ? null : dropdown);
  };

  const handleExplore = async (project: Project) => {
    // Check if project is private
    if (project.private) {
      if (currentUser) {
        // Check if user is a member or owner
        const membershipLinks = await db.query.profile_project_link.findMany({
          where: and(
            eq(profile_project_link.profile_id, currentUser.id),
            eq(profile_project_link.project_id, project.id),
            eq(profile_project_link.active, true)
          )
        });

        const isMember = membershipLinks.length > 0;

        if (!isMember) {
          // Show private project modal
          setPrivateProjectModal({ isVisible: true, project });
          return;
        }
      } else {
        // User not logged in, show private project modal
        setPrivateProjectModal({ isVisible: true, project });
        return;
      }
    }

    // Proceed with navigation
    goToProject(project);
  };

  // Custom setSourceFilter function that validates against available options
  const handleSourceFilterChange = (value: string) => {
    setSourceFilter(value);
  };

  // Custom setTargetFilter function that validates against available options
  const handleTargetFilterChange = (value: string) => {
    setTargetFilter(value);
  };

  if (!projects) return null;

  const uniqueSourceLanguageIds = [
    ...new Set(projects.map((project) => project.source_language_id))
  ];

  // Get unique target languages from projects
  const uniqueTargetLanguageIds = [
    ...new Set(projects.map((project) => project.target_language_id))
  ];

  // Filter and map source languages
  const sourceLanguages = uniqueSourceLanguageIds
    .map((id) => {
      const lang = allLanguages?.find((l) => l.id === id);
      return lang?.native_name ?? lang?.english_name ?? null;
    })
    .filter((name): name is string => name !== null);

  // Filter and map target languages
  const targetLanguages = uniqueTargetLanguageIds
    .map((id) => {
      const lang = allLanguages?.find((l) => l.id === id);
      return lang?.native_name ?? lang?.english_name ?? null;
    })
    .filter((name): name is string => name !== null);

  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <View
          style={[sharedStyles.container, { backgroundColor: 'transparent' }]}
        >
          <PageHeader title={t('projects')} showBackButton={false} />

          <View style={sharedStyles.filtersContainer}>
            <CustomDropdown
              label={t('source')}
              value={sourceFilter}
              options={[t('all'), ...sourceLanguages]}
              onSelect={handleSourceFilterChange}
              isOpen={openDropdown === 'source'}
              onToggle={() => toggleDropdown('source')}
              fullWidth={false}
              search={true}
            />
            <CustomDropdown
              label={t('target')}
              value={targetFilter}
              options={[t('all'), ...targetLanguages]}
              onSelect={handleTargetFilterChange}
              isOpen={openDropdown === 'target'}
              onToggle={() => toggleDropdown('target')}
              fullWidth={false}
              search={true}
            />
          </View>

          <FlashList
            data={filteredProjects}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => handleExplore(item)}>
                <ProjectCard project={item} />
              </TouchableOpacity>
            )}
            keyExtractor={(item) => item.id}
            // style={sharedStyles.list}
            estimatedItemSize={200}
          />
        </View>
      </SafeAreaView>

      {privateProjectModal.project && (
        <PrivateAccessGate
          modal={true}
          isVisible={privateProjectModal.isVisible}
          onClose={() =>
            setPrivateProjectModal({ isVisible: false, project: null })
          }
          projectId={privateProjectModal.project.id}
          projectName={privateProjectModal.project.name}
          isPrivate={privateProjectModal.project.private}
          action="view-members"
          onMembershipGranted={() => {
            // Navigate to the project when membership is granted
            goToProject(privateProjectModal.project!);
            setPrivateProjectModal({ isVisible: false, project: null });
          }}
          onBypass={() => {
            // Allow viewing the project even without membership
            goToProject(privateProjectModal.project!);
            setPrivateProjectModal({ isVisible: false, project: null });
          }}
          showViewProjectButton={true}
          viewProjectButtonText="View Project"
        />
      )}
    </LinearGradient>
  );
}
