import { CustomDropdown } from '@/components/CustomDropdown';
import { ProjectDetails } from '@/components/ProjectDetails';
import { useAuth } from '@/contexts/AuthContext';
import { useProjectContext } from '@/contexts/ProjectContext';
import { languageService } from '@/database_services/languageService';
import { projectService } from '@/database_services/projectService';
import { language, project } from '@/db/drizzleSchema';
import { AuthGuard } from '@/guards/AuthGuard';
import { useTranslation } from '@/hooks/useTranslation';
import { colors, sharedStyles } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { downloadService } from '@/database_services/downloadService';
import { DownloadIndicator } from '@/components/DownloadIndicator';

type Project = typeof project.$inferSelect;

const ProjectCard: React.FC<{ project: typeof project.$inferSelect }> = ({
  project
}) => {
  const { currentUser } = useAuth();
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [sourceLanguage, setSourceLanguage] = useState<
    typeof language.$inferSelect | null
  >(null);
  const [targetLanguage, setTargetLanguage] = useState<
    typeof language.$inferSelect | null
  >(null);

  useEffect(() => {
    const loadData = async () => {
      const [source, target] = await Promise.all([
        languageService.getLanguageById(project.source_language_id),
        languageService.getLanguageById(project.target_language_id)
      ]);
      setSourceLanguage(source);
      setTargetLanguage(target);

      if (currentUser) {
        const status = await downloadService.getProjectDownloadStatus(
          currentUser.id,
          project.id
        );
        setIsDownloaded(status);
      }
    };
    loadData();
  }, [project.source_language_id, project.target_language_id, currentUser]);

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

  return (
    <View style={sharedStyles.card}>
      <DownloadIndicator
        isDownloaded={isDownloaded}
        onPress={handleDownloadToggle}
      />
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
    null
  );
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [languages, setLanguages] = useState<string[]>([]);
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
            project.source_language_id
          );
          const targetLanguage = await languageService.getLanguageById(
            project.target_language_id
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
        })
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
    setSelectedProject(project);
  };

  const handleCloseDetails = () => {
    setSelectedProject(null);
  };

  const handleExplore = () => {
    if (selectedProject) goToProject(selectedProject);
  };

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
                  !showLanguageFilters && sharedStyles.selectedIconButton
                ]}
                onPress={() => setShowLanguageFilters(false)}
              >
                <Ionicons name="star-outline" size={24} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  sharedStyles.iconButton,
                  showLanguageFilters && sharedStyles.selectedIconButton
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
