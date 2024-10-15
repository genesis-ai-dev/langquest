import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, fontSizes, spacing, sharedStyles, borderRadius } from '@/styles/theme';
import { Project } from '@/types/project';
import { ProjectDetails } from '@/components/ProjectDetails';
import { CustomDropdown } from '@/components/CustomDropdown';

type FilterType = 'member' | 'waiting' | 'search' | 'leader';

const languages = ['English', 'Spanish', 'French', 'German', 'Italian', 'Japanese', 'Chinese'];

const mockProjects: Project[] = [
  { id: '1', name: 'Project 1', members: 3, isPublic: true, isLeader: false, sourceLanguage: 'English', targetLanguage: 'Spanish', isMember: true, isWaiting: false },
  { id: '2', name: 'Project 2', members: 5, isPublic: false, isLeader: true, sourceLanguage: 'French', targetLanguage: 'German', isMember: true, isWaiting: false },
  { id: '3', name: 'Project 3', members: 2, isPublic: true, isLeader: false, sourceLanguage: 'Spanish', targetLanguage: 'English', isMember: false, isWaiting: true },
  { id: '4', name: 'Project 4', members: 4, isPublic: true, isLeader: true, sourceLanguage: 'German', targetLanguage: 'French', isMember: true, isWaiting: false },
  { id: '5', name: 'Project 5', members: 6, isPublic: false, isLeader: false, sourceLanguage: 'Italian', targetLanguage: 'Japanese', isMember: false, isWaiting: false },
];

const ProjectCard: React.FC<{ project: Project }> = ({ project }) => (
  <View style={sharedStyles.card}>
    <Text style={sharedStyles.cardTitle}>{project.name}</Text>
    <View style={sharedStyles.cardInfo}>
      <Ionicons name="people-outline" size={16} color={colors.text} />
      <Text style={sharedStyles.cardInfoText}>{project.members}</Text>
      <Ionicons name={project.isPublic ? "globe-outline" : "lock-closed-outline"} size={16} color={colors.text} />
      {project.isLeader && <Ionicons name="ribbon-outline" size={16} color={colors.text} />}
    </View>
    <Text style={sharedStyles.cardLanguageText}>{project.sourceLanguage} → {project.targetLanguage}</Text>
  </View>
);


export default function Projects() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<FilterType>('member');
  const [showLanguageFilters, setShowLanguageFilters] = useState(false);
  const [sourceFilter, setSourceFilter] = useState('All');
  const [targetFilter, setTargetFilter] = useState('All');
  const [openDropdown, setOpenDropdown] = useState<'source' | 'target' | null>(null);
  const [filteredProjects, setFilteredProjects] = useState(mockProjects);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  useEffect(() => {
    filterProjects();
  }, [activeFilter, sourceFilter, targetFilter]);

  const filterProjects = () => {
    let filtered = mockProjects;

    switch (activeFilter) {
      case 'member':
        filtered = filtered.filter(project => project.isMember);
        break;
      case 'waiting':
        filtered = filtered.filter(project => project.isWaiting);
        break;
      case 'search':
        filtered = filtered.filter(project => 
          (sourceFilter === 'All' || project.sourceLanguage === sourceFilter) &&
          (targetFilter === 'All' || project.targetLanguage === targetFilter)
        );
        break;
      case 'leader':
        filtered = filtered.filter(project => project.isLeader);
        break;
    }

    setFilteredProjects(filtered);
  };

  const toggleFilter = (filter: FilterType) => {
    if (activeFilter === filter) {
      setActiveFilter('member');
    } else {
      setActiveFilter(filter);
    }
    setShowLanguageFilters(filter === 'search');
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
              style={[sharedStyles.iconButton, activeFilter === 'member' && sharedStyles.selectedIconButton]}
              onPress={() => toggleFilter('member')}
            >
              <Ionicons name="star-outline" size={24} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[sharedStyles.iconButton, activeFilter === 'waiting' && sharedStyles.selectedIconButton]}
              onPress={() => toggleFilter('waiting')}
            >
              <Ionicons name="time-outline" size={24} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[sharedStyles.iconButton, activeFilter === 'search' && sharedStyles.selectedIconButton]}
              onPress={() => toggleFilter('search')}
            >
              <Ionicons name="search-outline" size={24} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[sharedStyles.iconButton, activeFilter === 'leader' && sharedStyles.selectedIconButton]}
              onPress={() => toggleFilter('leader')}
            >
              <Ionicons name="ribbon-outline" size={24} color={colors.text} />
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