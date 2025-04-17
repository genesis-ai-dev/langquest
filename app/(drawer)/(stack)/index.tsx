import { CustomDropdown } from '@/components/CustomDropdown';
import { PageHeader } from '@/components/PageHeader';
import { useProjectContext } from '@/contexts/ProjectContext';
import { languageService } from '@/database_services/languageService';
import { projectService } from '@/database_services/projectService';
import { language, project } from '@/db/drizzleSchema';
import { useTranslation } from '@/hooks/useTranslation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  colors,
  sharedStyles,
  spacing,
  borderRadius,
  fontSizes
} from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Text,
  TouchableOpacity,
  View,
  StyleSheet
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { questService } from '@/database_services/questService';
import { assetService } from '@/database_services/assetService';
import {
  Translation,
  translationService
} from '@/database_services/translationService';
import { Vote, voteService } from '@/database_services/voteService';
import {
  calculateQuestProgress,
  calculateProjectProgress
} from '@/utils/progressUtils';
import { GemIcon } from '@/components/GemIcon';
import { useAuth } from '@/contexts/AuthContext';
// Constants for storage keys
const SOURCE_FILTER_KEY = 'project_source_filter';
const TARGET_FILTER_KEY = 'project_target_filter';

type Project = typeof project.$inferSelect;

const progressBarHeight = 25;

const ProjectCard: React.FC<{ project: typeof project.$inferSelect }> = ({
  project
}) => {
  const [sourceLanguage, setSourceLanguage] = useState<
    typeof language.$inferSelect | null
  >(null);
  const [targetLanguage, setTargetLanguage] = useState<
    typeof language.$inferSelect | null
  >(null);
  const [progress, setProgress] = useState({
    approvedPercentage: 0,
    userContributedPercentage: 0,
    pendingTranslationsCount: 0,
    totalAssets: 0
  });
  const { currentUser } = useAuth();

  useEffect(() => {
    const loadLanguages = async () => {
      const source = await languageService.getLanguageById(
        project.source_language_id
      );
      const target = await languageService.getLanguageById(
        project.target_language_id
      );
      setSourceLanguage(source);
      setTargetLanguage(target);
    };
    loadLanguages();
  }, [project.source_language_id, project.target_language_id]);

  useEffect(() => {
    const loadProgress = async () => {
      try {
        // Load all quests for this project
        const quests = await questService.getQuestsByProjectId(project.id);

        // For each quest, load its assets and calculate progress
        const questProgresses = await Promise.all(
          quests.map(async (quest) => {
            const assets = await assetService.getAssetsByQuestId(quest.id);
            const translations: Record<string, Translation[]> = {};
            const votes: Record<string, Vote[]> = {};

            // Load translations and votes for each asset
            await Promise.all(
              assets.map(async (asset) => {
                const assetTranslations =
                  await translationService.getTranslationsByAssetId(asset.id);
                translations[asset.id] = assetTranslations;

                // Load votes for each translation
                await Promise.all(
                  assetTranslations.map(async (translation) => {
                    votes[translation.id] =
                      await voteService.getVotesByTranslationId(translation.id);
                  })
                );
              })
            );

            return calculateQuestProgress(
              assets,
              translations,
              votes,
              currentUser?.id || null
            );
          })
        );

        // Calculate aggregated project progress
        const projectProgress = calculateProjectProgress(questProgresses);
        setProgress(projectProgress);
      } catch (error) {
        console.error('Error loading project progress:', error);
      }
    };

    loadProgress();
  }, [project.id, currentUser?.id]);

  return (
    <View style={sharedStyles.card}>
      <View>
        <Text style={sharedStyles.cardTitle}>{project.name}</Text>
        <Text style={sharedStyles.cardLanguageText}>
          {sourceLanguage?.native_name || sourceLanguage?.english_name} →{' '}
          {targetLanguage?.native_name || targetLanguage?.english_name}
        </Text>
      </View>

      {/* Progress bars */}
      <View style={styles.progressContainer}>
        {/* Approved translations progress bar */}
        <View style={styles.progressBarContainer}>
          <View
            style={[
              styles.progressBar,
              styles.approvedBar,
              {
                width: `${progress.approvedPercentage}%`,
                alignItems: 'flex-end',
                justifyContent: 'center',
                borderRadius: progressBarHeight / 2,
                zIndex: 2
              }
            ]}
          >
            <GemIcon
              color={colors.textSecondary}
              width={progressBarHeight / 1.5}
              height={progressBarHeight / 1.5}
              style={{ marginRight: 10 }}
            />
          </View>
          {/* User's pending translations progress bar */}
          <View
            style={[
              styles.progressBar,
              styles.userPendingBar,
              {
                width: `${progress.userContributedPercentage}%`,
                borderRadius: progressBarHeight / 2,
                marginLeft: -20,
                alignItems: 'flex-end',
                justifyContent: 'center',
                zIndex: 1
              }
            ]}
          >
            <GemIcon
              color={colors.background}
              width={progressBarHeight / 1.5}
              height={progressBarHeight / 1.5}
              style={{ marginRight: 10 }}
            />
          </View>
        </View>

        {/* Pending translations gem */}
        {progress.pendingTranslationsCount > 0 && (
          <View style={styles.gemContainer}>
            <GemIcon color={colors.alert} width={16} height={16} />
            <Text style={styles.gemCount}>
              {progress.pendingTranslationsCount}
            </Text>
          </View>
        )}
      </View>

      {project.description && (
        <Text style={sharedStyles.cardDescription}>{project.description}</Text>
      )}
    </View>
  );
};

export default function Projects() {
  const { t } = useTranslation();
  const { goToProject } = useProjectContext();
  const [sourceFilter, setSourceFilter] = useState('All');
  const [targetFilter, setTargetFilter] = useState('All');
  const [openDropdown, setOpenDropdown] = useState<'source' | 'target' | null>(
    null
  );
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [sourceLanguages, setSourceLanguages] = useState<string[]>([]);
  const [targetLanguages, setTargetLanguages] = useState<string[]>([]);
  const router = useRouter();

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

    loadSavedFilters();
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

    saveFilters();
  }, [sourceFilter, targetFilter]);

  // Load projects and languages on mount
  useEffect(() => {
    loadProjects();
    loadLanguages();
  }, []);

  // Filter projects when filters change
  useEffect(() => {
    filterProjects();
  }, [sourceFilter, targetFilter, projects]);

  const loadProjects = async () => {
    try {
      const loadedProjects = await projectService.getAllProjects();
      setProjects(loadedProjects);
      setFilteredProjects(loadedProjects);
    } catch (error) {
      console.error('Error loading projects:', error);
      Alert.alert('Error', t('failedLoadProjects'));
    }
  };

  const loadLanguages = async () => {
    try {
      // Get all languages
      const allLanguages = await languageService.getAllLanguages();

      // Get unique source languages from projects
      const uniqueSourceLanguageIds = [
        ...new Set(projects.map((project) => project.source_language_id))
      ];

      // Get unique target languages from projects
      const uniqueTargetLanguageIds = [
        ...new Set(projects.map((project) => project.target_language_id))
      ];

      // Filter and map source languages
      const sourceLanguageNames = uniqueSourceLanguageIds
        .map((id) => {
          const lang = allLanguages.find((l) => l.id === id);
          return lang?.native_name || lang?.english_name;
        })
        .filter((name): name is string => name !== null);

      // Filter and map target languages
      const targetLanguageNames = uniqueTargetLanguageIds
        .map((id) => {
          const lang = allLanguages.find((l) => l.id === id);
          return lang?.native_name || lang?.english_name;
        })
        .filter((name): name is string => name !== null);

      setSourceLanguages(sourceLanguageNames);
      setTargetLanguages(targetLanguageNames);
    } catch (error) {
      console.error('Error loading languages:', error);
    }
  };

  // Update language lists when projects change
  useEffect(() => {
    if (projects.length > 0) {
      loadLanguages();
    }
  }, [projects]);

  const filterProjects = async () => {
    try {
      // Start with all projects
      let filtered = [...projects];

      // Get all languages to avoid repeated calls
      const allLanguages = await languageService.getAllLanguages();

      // Create a new array with filtered results
      const results = [];

      // Go through each project
      for (const project of filtered) {
        // Find the source and target language objects
        const sourceLanguage = allLanguages.find(
          (l) => l.id === project.source_language_id
        );
        const targetLanguage = allLanguages.find(
          (l) => l.id === project.target_language_id
        );

        // Get language names (prefer native name, fall back to English name)
        const sourceName =
          sourceLanguage?.native_name || sourceLanguage?.english_name || '';
        const targetName =
          targetLanguage?.native_name || targetLanguage?.english_name || '';

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

  const handleExplore = (project: Project) => {
    if (project) goToProject(project);
  };

  // Custom setSourceFilter function that validates against available options
  const handleSourceFilterChange = (value: string) => {
    // Only set the filter if the value is 'All' or exists in sourceLanguages
    if (value === 'All' || sourceLanguages.includes(value)) {
      setSourceFilter(value);
    } else {
      // Fallback to 'All' if value doesn't exist in available options
      setSourceFilter('All');
    }
  };

  // Custom setTargetFilter function that validates against available options
  const handleTargetFilterChange = (value: string) => {
    // Only set the filter if the value is 'All' or exists in targetLanguages
    if (value === 'All' || targetLanguages.includes(value)) {
      setTargetFilter(value);
    } else {
      // Fallback to 'All' if value doesn't exist in available options
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
          <PageHeader title={t('projects')} />

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

const styles = StyleSheet.create({
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.small,
    gap: spacing.small
  },
  progressBarContainer: {
    flex: 1,
    height: progressBarHeight,
    backgroundColor: colors.inputBackground,
    overflow: 'hidden',
    flexDirection: 'row',
    borderRadius: progressBarHeight / 2
  },
  progressBar: {
    height: '100%'
  },
  approvedBar: {
    backgroundColor: colors.success
  },
  userPendingBar: {
    backgroundColor: colors.textSecondary
  },
  gemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xsmall
  },
  gemCount: {
    color: colors.text,
    fontSize: fontSizes.small
  }
});
