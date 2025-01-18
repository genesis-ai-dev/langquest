import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, spacing, sharedStyles } from '@/styles/theme';
import { ProjectDetails } from '@/components/ProjectDetails';
import { CustomDropdown } from '@/components/CustomDropdown';
import { projectService } from '@/database_services/projectService';
import { languageService } from '@/database_services/languageService';
import { project, language } from '@/db/drizzleSchema';
import { useProjectContext } from '@/contexts/ProjectContext';
import { AuthGuard } from '@/guards/AuthGuard';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/hooks/useTranslation';
import { BackHandler } from 'react-native';
import { useFocusEffect } from 'expo-router';

type Project = typeof project.$inferSelect;

const ProjectCard: React.FC<{ project: typeof project.$inferSelect }> = ({
  project,
}) => {
  const [sourceLanguage, setSourceLanguage] = useState<
    typeof language.$inferSelect | null
  >(null);
  const [targetLanguage, setTargetLanguage] = useState<
    typeof language.$inferSelect | null
  >(null);

  useEffect(() => {
    const loadLanguages = async () => {
      const source = await languageService.getLanguageById(
        project.source_language_id,
      );
      const target = await languageService.getLanguageById(
        project.target_language_id,
      );
      setSourceLanguage(source);
      setTargetLanguage(target);
    };
    loadLanguages();
  }, [project.source_language_id, project.target_language_id]);

  return (
    <View style={sharedStyles.card}>
      <Text style={sharedStyles.cardTitle}>{project.name}</Text>
      <Text style={sharedStyles.cardLanguageText}>
        {sourceLanguage?.native_name || sourceLanguage?.english_name} →
        {targetLanguage?.native_name || targetLanguage?.english_name}
      </Text>
      {project.description && (
        <Text style={sharedStyles.cardDescription}>{project.description}</Text>
      )}
    </View>
  );
};

export default function Projects() {
  const { t } = useTranslation();
  const { goToProject } = useProjectContext();
  const [showLanguageFilters, setShowLanguageFilters] = useState(false);
  const [sourceFilter, setSourceFilter] = useState('All');
  const [targetFilter, setTargetFilter] = useState('All');
  const [openDropdown, setOpenDropdown] = useState<'source' | 'target' | null>(
    null,
  );
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [languages, setLanguages] = useState<string[]>([]);
  const { setActiveProject } = useProjectContext();
  const { signOut } = useAuth();

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
      const loadedLanguages = await languageService.getUiReadyLanguages();
      const languageNames = loadedLanguages
        .map((lang) => lang.native_name || lang.english_name)
        .filter((name): name is string => name !== null);
      setLanguages(languageNames);
    } catch (error) {
      console.error('Error loading languages:', error);
    }
  };

  const filterProjects = async () => {
    let filtered = projects;

    if (showLanguageFilters) {
      filtered = await Promise.all(
        filtered.filter(async (project) => {
          const sourceLanguage = await languageService.getLanguageById(
            project.source_language_id,
          );
          const targetLanguage = await languageService.getLanguageById(
            project.target_language_id,
          );

          const sourceMatch =
            sourceFilter === 'All' ||
            sourceLanguage?.native_name === sourceFilter ||
            sourceLanguage?.english_name === sourceFilter;

          const targetMatch =
            targetFilter === 'All' ||
            targetLanguage?.native_name === targetFilter ||
            targetLanguage?.english_name === targetFilter;

          return sourceMatch && targetMatch;
        }),
      );
    }

    setFilteredProjects(filtered);
  };

  const toggleSearch = () => {
    setShowLanguageFilters(!showLanguageFilters);
    if (!showLanguageFilters) {
      setSourceFilter('All');
      setTargetFilter('All');
    }
  };

  const toggleDropdown = (dropdown: 'source' | 'target') => {
    setOpenDropdown(openDropdown === dropdown ? null : dropdown);
  };

  const handleProjectPress = (project: Project) => {
    setActiveProject(project);
    setSelectedProject(project);
  };

  const handleCloseDetails = () => {
    setSelectedProject(null);
  };

  const handleExplore = () => {
    if (selectedProject) goToProject(selectedProject);
  };

  const handleBack = () => {
    // Start the sign out process but return true immediately
    signOut().catch((error) => {
      console.error('Error signing out:', error);
    });
    return true; // Prevents default back behavior
  };

  useFocusEffect(
    React.useCallback(() => {
      // Add back button handler when screen is focused
      const backHandler = BackHandler.addEventListener(
        'hardwareBackPress',
        handleBack,
      );

      // Remove handler when screen is unfocused
      return () => backHandler.remove();
    }, []),
  );

  return (
    <AuthGuard>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={{ flex: 1 }}
      >
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
          <View
            style={[sharedStyles.container, { backgroundColor: 'transparent' }]}
          >
            <Text style={sharedStyles.title}>{t('projects')}</Text>

            <View style={sharedStyles.iconBar}>
              <TouchableOpacity
                style={[
                  sharedStyles.iconButton,
                  !showLanguageFilters && sharedStyles.selectedIconButton,
                ]}
                onPress={() => setShowLanguageFilters(false)}
              >
                <Ionicons name="star-outline" size={24} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  sharedStyles.iconButton,
                  showLanguageFilters && sharedStyles.selectedIconButton,
                ]}
                onPress={toggleSearch}
              >
                <Ionicons name="search-outline" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {showLanguageFilters && (
              <View style={sharedStyles.filtersContainer}>
                <CustomDropdown
                  label={t('source')}
                  value={sourceFilter}
                  options={[t('all'), ...languages]}
                  onSelect={setSourceFilter}
                  isOpen={openDropdown === 'source'}
                  onToggle={() => toggleDropdown('source')}
                  fullWidth={false}
                  search={true}
                />
                <CustomDropdown
                  label={t('target')}
                  value={targetFilter}
                  options={[t('all'), ...languages]}
                  onSelect={setTargetFilter}
                  isOpen={openDropdown === 'target'}
                  onToggle={() => toggleDropdown('target')}
                  fullWidth={false}
                  search={true}
                />
              </View>
            )}

            <FlatList
              data={filteredProjects}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => handleProjectPress(item)}>
                  <ProjectCard project={item} />
                </TouchableOpacity>
              )}
              keyExtractor={(item) => item.id}
              style={sharedStyles.list}
            />
          </View>
        </SafeAreaView>
        {selectedProject && (
          <ProjectDetails
            project={selectedProject}
            onClose={handleCloseDetails}
            onExplore={handleExplore}
          />
        )}
      </LinearGradient>
    </AuthGuard>
  );
}
