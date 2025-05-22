import { CustomDropdown } from '@/components/CustomDropdown';
import { DownloadIndicator } from '@/components/DownloadIndicator';
import { PageHeader } from '@/components/PageHeader';
import { ProgressBars } from '@/components/ProgressBars';
import { useAuth } from '@/contexts/AuthContext';
import { useProjectContext } from '@/contexts/ProjectContext';
import { useSystem } from '@/contexts/SystemContext';
import { assetService } from '@/database_services/assetService';
import { downloadService } from '@/database_services/downloadService';
import { languageService } from '@/database_services/languageService';
import type { Translation } from '@/database_services/translationService';
import type { Vote } from '@/database_services/voteService';
import type { language, project } from '@/db/drizzleSchema';
import { project as projectTable } from '@/db/drizzleSchema';
import { useAssetDownloadStatus } from '@/hooks/useAssetDownloadStatus';
import { useTranslation } from '@/hooks/useTranslation';
import { colors, sharedStyles, spacing } from '@/styles/theme';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  calculateProjectProgress,
  calculateQuestProgress
} from '@/utils/progressUtils';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useQuery } from '@powersync/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { eq } from 'drizzle-orm';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';

// Constants for storage keys
const SOURCE_FILTER_KEY = 'project_source_filter';
const TARGET_FILTER_KEY = 'project_target_filter';

type Project = typeof project.$inferSelect;

const ProjectCard: React.FC<{ project: typeof project.$inferSelect }> = ({
  project
}) => {
  const { currentUser } = useAuth();
  const { db } = useSystem();
  const [sourceLanguage, setSourceLanguage] = useState<
    typeof language.$inferSelect | null
  >(null);
  const [targetLanguage, setTargetLanguage] = useState<
    typeof language.$inferSelect | null
  >(null);
  const [assetIds, setAssetIds] = useState<string[]>([]);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [progress, setProgress] = useState({
    approvedPercentage: 0,
    userContributedPercentage: 0,
    pendingTranslationsCount: 0,
    totalAssets: 0
  });

  // Use useQuery for fetching project data
  const { data: matchingProjectData } = useQuery(
    toCompilableQuery(
      db.query.project.findFirst({
        where: eq(projectTable.id, project.id),
        with: {
          quests: {
            with: {
              assets: {
                with: {
                  asset: {
                    with: {
                      translations: {
                        with: {
                          votes: true
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      })
    )
  );

  const projectData = matchingProjectData[0];

  useEffect(() => {
    const loadData = async () => {
      const [source, target] = await Promise.all([
        languageService.getLanguageById(project.source_language_id),
        languageService.getLanguageById(project.target_language_id)
      ]);
      setSourceLanguage(source);
      setTargetLanguage(target);

      // Get all assets for this project
      const assets = await assetService.getAssetsByProjectId(project.id);
      setAssetIds(assets.map((asset) => asset.id));

      // Get project download status
      if (currentUser) {
        const downloadStatus = await downloadService.getProjectDownloadStatus(
          currentUser.id,
          project.id
        );
        setIsDownloaded(downloadStatus);
      }
    };
    void loadData();
  }, [
    project.source_language_id,
    project.target_language_id,
    project.id,
    currentUser
  ]);

  const { isDownloaded: assetsDownloaded, isLoading } =
    useAssetDownloadStatus(assetIds);

  const handleDownloadToggle = async () => {
    if (!currentUser) return;
    try {
      await downloadService.setProjectDownload(
        currentUser.id,
        project.id,
        !isDownloaded
      );
      setIsDownloaded(!isDownloaded);
    } catch (error) {
      console.error('Error toggling project download:', error);
    }
  };

  useEffect(() => {
    if (!projectData?.quests) return;

    // Calculate progress for each quest
    const questProgresses = projectData.quests.map((quest) => {
      const assets = quest.assets.map((link) => link.asset);
      const translations: Record<string, Translation[]> = {};
      const votes: Record<string, Vote[]> = {};

      // Process translations and votes
      assets.forEach((asset) => {
        translations[asset.id] = asset.translations;
        asset.translations.forEach((translation) => {
          votes[translation.id] = translation.votes;
        });
      });

      return calculateQuestProgress(assets, currentUser?.id ?? null);
    });

    // Calculate aggregated project progress
    const projectProgress = calculateProjectProgress(questProgresses);
    setProgress(projectProgress);
  }, [projectData, currentUser?.id]);

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
          <Text style={[sharedStyles.cardTitle, { flex: 1 }]}>
            {project.name}
          </Text>
          <DownloadIndicator
            isDownloaded={isDownloaded && assetsDownloaded}
            isLoading={isLoading && isDownloaded}
            onPress={handleDownloadToggle}
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
  const { t } = useTranslation();
  const { goToProject } = useProjectContext();
  const { db } = useSystem();
  const [sourceFilter, setSourceFilter] = useState('All');
  const [targetFilter, setTargetFilter] = useState('All');
  const [openDropdown, setOpenDropdown] = useState<'source' | 'target' | null>(
    null
  );
  const [sourceLanguages, setSourceLanguages] = useState<string[]>([]);
  const [targetLanguages, setTargetLanguages] = useState<string[]>([]);

  // Use useQuery for fetching projects
  const { data: projects = [] } = useQuery(
    toCompilableQuery(
      db.query.project.findMany({
        with: {
          source_language: true,
          target_language: true
        }
      })
    )
  );

  // Load stored filter settings on component mount
  useEffect(() => {
    const loadSavedFilters = async () => {
      try {
        const savedSourceFilter = await AsyncStorage.getItem(SOURCE_FILTER_KEY);
        const savedTargetFilter = await AsyncStorage.getItem(TARGET_FILTER_KEY);

        if (savedSourceFilter !== null) {
          setSourceFilter(savedSourceFilter);
        }

        if (savedTargetFilter !== null) {
          setTargetFilter(savedTargetFilter);
        }
      } catch (error) {
        console.error('Error loading saved filters:', error);
      }
    };

    void loadSavedFilters();
  }, []);

  // Save filter settings when they change
  useEffect(() => {
    const saveFilters = async () => {
      try {
        await AsyncStorage.setItem(SOURCE_FILTER_KEY, sourceFilter);
        await AsyncStorage.setItem(TARGET_FILTER_KEY, targetFilter);
      } catch (error) {
        console.error('Error saving filters:', error);
      }
    };

    void saveFilters();
  }, [sourceFilter, targetFilter]);

  // Update language lists when projects change
  useEffect(() => {
    if (projects.length > 0) {
      const uniqueSourceLanguages = [
        ...new Set(
          projects.map(
            (p) =>
              p.source_language.native_name ??
              p.source_language.english_name ??
              ''
          )
        )
      ].filter(Boolean);

      const uniqueTargetLanguages = [
        ...new Set(
          projects.map(
            (p) =>
              p.target_language.native_name ??
              p.target_language.english_name ??
              ''
          )
        )
      ].filter(Boolean);

      setSourceLanguages(uniqueSourceLanguages);
      setTargetLanguages(uniqueTargetLanguages);
    }
  }, [projects]);

  // Filter projects based on selected languages
  const filteredProjects = projects.filter((project) => {
    const sourceName =
      project.source_language.native_name ??
      project.source_language.english_name ??
      '';
    const targetName =
      project.target_language.native_name ??
      project.target_language.english_name ??
      '';

    const sourceMatch = sourceFilter === 'All' || sourceFilter === sourceName;
    const targetMatch = targetFilter === 'All' || targetFilter === targetName;

    return sourceMatch && targetMatch;
  });

  const toggleDropdown = (dropdown: 'source' | 'target') => {
    setOpenDropdown(openDropdown === dropdown ? null : dropdown);
  };

  const handleExplore = (project: Project) => {
    goToProject(project);
  };

  // Custom setSourceFilter function that validates against available options
  const handleSourceFilterChange = (value: string) => {
    if (value === 'All' || sourceLanguages.includes(value)) {
      setSourceFilter(value);
    } else {
      setSourceFilter('All');
    }
  };

  // Custom setTargetFilter function that validates against available options
  const handleTargetFilterChange = (value: string) => {
    if (value === 'All' || targetLanguages.includes(value)) {
      setTargetFilter(value);
    } else {
      setTargetFilter('All');
    }
  };

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

          <FlatList
            data={filteredProjects}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => handleExplore(item)}>
                <ProjectCard project={item} />
              </TouchableOpacity>
            )}
            keyExtractor={(item) => item.id}
            style={sharedStyles.list}
          />
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}
