import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, spacing, sharedStyles } from '@/styles/theme';
import { ProjectDetails } from '@/components/ProjectDetails';
import { CustomDropdown } from '@/components/CustomDropdown';
import { projectService, ProjectWithRelations } from '@/database_components/projectService';
import { languageService } from '@/database_components/languageService';
import { project, language } from '@/db/drizzleSchema';


// type ProjectWithRelations = typeof project.$inferSelect & {
//   sourceLanguage: typeof language.$inferSelect;
//   targetLanguage: typeof language.$inferSelect;
// };


const ProjectCard: React.FC<{ project: ProjectWithRelations }> = ({ project }) => (
  <View style={sharedStyles.card}>
    <Text style={sharedStyles.cardTitle}>{project.name}</Text>
    <Text style={sharedStyles.cardLanguageText}>
      {project.sourceLanguage.nativeName || project.sourceLanguage.englishName} → 
      {project.targetLanguage.nativeName || project.targetLanguage.englishName}
    </Text>
    {project.description && (
      <Text style={sharedStyles.cardDescription}>{project.description}</Text>
    )}
  </View>
);

export default function Projects() {
  const router = useRouter();
  const [showLanguageFilters, setShowLanguageFilters] = useState(false);
  const [sourceFilter, setSourceFilter] = useState('All');
  const [targetFilter, setTargetFilter] = useState('All');
  const [openDropdown, setOpenDropdown] = useState<'source' | 'target' | null>(null);
  const [projects, setProjects] = useState<ProjectWithRelations[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<ProjectWithRelations[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectWithRelations | null>(null);
  const [languages, setLanguages] = useState<string[]>([]);

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
      Alert.alert('Error', 'Failed to load projects');
    }
  };

  const loadLanguages = async () => {
    try {
      const loadedLanguages = await languageService.getUiReadyLanguages();
      const languageNames = loadedLanguages
        .map(lang => lang.nativeName || lang.englishName)
        .filter((name): name is string => name !== null);
      setLanguages(languageNames);
    } catch (error) {
      console.error('Error loading languages:', error);
    }
  };

  const filterProjects = () => {
    let filtered = projects;
    
    if (showLanguageFilters) {
      filtered = filtered.filter(project => {
        const sourceMatch = sourceFilter === 'All' || 
          project.sourceLanguage.nativeName === sourceFilter || 
          project.sourceLanguage.englishName === sourceFilter;
        const targetMatch = targetFilter === 'All' || 
          project.targetLanguage.nativeName === targetFilter || 
          project.targetLanguage.englishName === targetFilter;
        return sourceMatch && targetMatch;
      });
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

  const handleProjectPress = (project: ProjectWithRelations) => {
    setSelectedProject(project);
  };

  const handleCloseDetails = () => {
    setSelectedProject(null);
  };

  const handleExplore = () => {
    if (selectedProject) {
      router.push({
        pathname: "/quests",
        params: { projectId: selectedProject.id, projectName: selectedProject.name }
      });
    }
  };

  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <View style={[sharedStyles.container, { backgroundColor: 'transparent' }]}>
          <Text style={sharedStyles.title}>Projects</Text>
          
          <View style={sharedStyles.iconBar}>
            <TouchableOpacity 
              style={[sharedStyles.iconButton, !showLanguageFilters && sharedStyles.selectedIconButton]}
              onPress={() => setShowLanguageFilters(false)}
            >
              <Ionicons name="star-outline" size={24} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[sharedStyles.iconButton, showLanguageFilters && sharedStyles.selectedIconButton]}
              onPress={toggleSearch}
            >
              <Ionicons name="search-outline" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          
          {showLanguageFilters && (
            <View style={sharedStyles.filtersContainer}>
              <CustomDropdown
                label="Source"
                value={sourceFilter}
                options={['All', ...languages]}
                onSelect={setSourceFilter}
                isOpen={openDropdown === 'source'}
                onToggle={() => toggleDropdown('source')}
                fullWidth={false}
                search={true}
              />
              <CustomDropdown
                label="Target"
                value={targetFilter}
                options={['All', ...languages]}
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
            keyExtractor={item => item.id}
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
  );
}