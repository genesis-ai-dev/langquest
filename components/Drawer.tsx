import { useProjectContext } from '@/contexts/ProjectContext';
import { Asset } from '@/database_services/assetService';
import type { Project } from '@/database_services/projectService';
import { Quest } from '@/database_services/questService';
import { useTranslation } from '@/hooks/useTranslation';
import { borderRadius, colors, fontSizes, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import {
  DrawerContentScrollView,
  type DrawerContentComponentProps,
} from '@react-navigation/drawer';
import { LinearGradient } from 'expo-linear-gradient';
import { usePathname, useRouter } from 'expo-router';
import { Drawer as ExpoDrawer } from 'expo-router/drawer';
import { useCallback, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export function DrawerContent(props: DrawerContentComponentProps) {
  const { t } = useTranslation();
  const {
    recentProjects,
    recentQuests,
    recentAssets,
    goToProject,
    goToQuest,
    goToAsset,
  } = useProjectContext();

  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientEnd]}
      style={{ flex: 1 }}
    >
      <DrawerContentScrollView {...props} style={styles.drawer}>
        <Text style={styles.drawerHeader}>{t('recentlyVisited')}</Text>
        <Category
          title={t('projects')}
          items={recentProjects}
          onPress={(item) => goToProject(item as Project, true)}
        />
        <Category
          title={t('quests')}
          items={recentQuests}
          onPress={(item) => goToQuest(item as Quest, true)}
        />
        <Category
          title={t('assets')}
          items={recentAssets}
          onPress={(item) => goToAsset(item as Asset, true)}
        />
      </DrawerContentScrollView>
      <View style={styles.drawerFooter}>
        <DrawerFooter />
      </View>
    </LinearGradient>
  );
}

function DrawerFooter() {
  const router = useRouter();
  const pathname = usePathname();
  const {
    goToProject,
    goToQuest,
    activeProject,
    activeQuest,
    setActiveProject,
    setActiveQuest,
    setActiveAsset,
  } = useProjectContext();

  if (pathname === '/projects' && (!activeProject || !activeQuest)) return null;

  return (
    <View style={styles.drawerFooterNav}>
      {pathname !== '/projects' && (
        <TouchableOpacity
          onPress={() => {
            router.navigate('/projects');
            setActiveProject(null);
            setActiveQuest(null);
            setActiveAsset(null);
          }}
        >
          <Ionicons name="home" size={20} color={colors.text} />
        </TouchableOpacity>
      )}
      <View style={styles.footerTextContainer}>
        {activeProject && (
          <>
            <Ionicons name="chevron-forward" size={14} color={colors.text} />
            <TouchableOpacity
              onPress={() => goToProject(activeProject, true)}
              style={styles.footerTextItem}
            >
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={{ color: colors.text }}
              >
                {activeProject.name}
              </Text>
            </TouchableOpacity>
          </>
        )}
        {activeQuest && activeProject && (
          <>
            <Ionicons name="chevron-forward" size={14} color={colors.text} />
            <TouchableOpacity
              onPress={() => goToQuest(activeQuest, true)}
              style={styles.footerTextItem}
            >
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={{ color: colors.text }}
              >
                {activeQuest.name}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

export function Drawer() {
  const pathname = usePathname();
  return (
    <ExpoDrawer
      screenOptions={{
        headerShown: false,
        drawerType: 'slide',
        swipeEdgeWidth: 100,
        swipeEnabled: pathname !== '/' && pathname !== '/register', // no drawer on login page
      }}
      drawerContent={DrawerContent}
    />
  );
}

function Category({
  title,
  items,
  onPress,
}: {
  title: string;
  items: (Project | Quest | Asset)[];
  onPress: (item: Project | Quest | Asset) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  const toggleExpand = useCallback(() => {
    setIsExpanded(!isExpanded);
  }, [isExpanded]);

  return (
    <View style={styles.drawerCategory}>
      <Pressable
        style={styles.categoryHeader}
        onPress={toggleExpand}
        disabled={items.length === 0}
      >
        <Text style={styles.drawerCategoryTitle}>{title}</Text>
        {items.length > 0 && (
          <Ionicons
            name={isExpanded ? 'chevron-down' : 'chevron-forward'}
            size={20}
            color={colors.text}
          />
        )}
      </Pressable>
      {isExpanded && (
        <View style={styles.categoryContent}>
          {items.map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => onPress(item)}
              style={styles.categoryItem}
            >
              <Text style={styles.categoryItemText}>{item.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  drawer: {
    padding: 15,
    flex: 1,
    color: colors.text,
  },
  drawerHeader: {
    fontSize: fontSizes.large,
    fontWeight: '600',
    marginBottom: 15,
    color: colors.text,
  },
  drawerCategory: {
    padding: spacing.small,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.medium,
    color: colors.text,
    marginVertical: spacing.small,
    overflow: 'hidden',
  },
  drawerCategoryTitle: {
    fontSize: fontSizes.medium,
    fontWeight: '500',
    color: colors.text,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xsmall,
  },
  categoryContent: {
    overflow: 'hidden',
  },
  measureContainer: {
    position: 'absolute',
    width: '100%',
  },
  categoryItem: {
    paddingVertical: 5,
  },
  categoryItemText: {
    color: colors.text,
  },
  drawerFooter: {
    // padding: spacing.small,
    borderTopWidth: 1,
    borderTopColor: colors.inputBackground,
    position: 'static',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  drawerFooterNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    padding: spacing.small,
  },
  footerTextContainer: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.small,
    alignItems: 'center',
  },
  footerTextItem: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.small,
    paddingVertical: spacing.xsmall,
    paddingHorizontal: spacing.small,
  },
});
