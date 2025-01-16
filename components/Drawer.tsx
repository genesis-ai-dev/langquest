import { useProjectContext } from '@/contexts/ProjectContext';
import { AssetWithRelations } from '@/database_services/assetService';
import type { ProjectWithRelations } from '@/database_services/projectService';
import { QuestWithRelations } from '@/database_services/questService';
import { useTranslation } from '@/hooks/useTranslation';
import { borderRadius, colors, fontSizes, spacing } from '@/styles/theme';
import {
  DrawerContentScrollView,
  type DrawerContentComponentProps,
} from '@react-navigation/drawer';
import { LinearGradient } from 'expo-linear-gradient';
import { usePathname, useRouter } from 'expo-router';
import { Drawer as ExpoDrawer } from 'expo-router/drawer';
import {
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  LayoutChangeEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useCallback } from 'react';
import Animated, {
  useAnimatedStyle,
  withTiming,
  useSharedValue,
  withSpring,
  interpolate,
} from 'react-native-reanimated';

export function DrawerContent(props: DrawerContentComponentProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { recentProjects, recentQuests, recentAssets } = useProjectContext();

  type CategoryItem = { id: string; name: string };

  const handleProjectPress = (project: CategoryItem) => {
    router.navigate({
      pathname: '/quests',
      params: { projectId: project.id, projectName: project.name },
    });
  };

  const handleQuestPress = (quest: CategoryItem) => {
    router.navigate({
      pathname: '/assets',
      params: { questId: quest.id, questName: quest.name },
    });
  };

  const handleAssetPress = (asset: CategoryItem) => {
    router.navigate({
      pathname: '/assetView',
      params: { assetId: asset.id, assetName: asset.name },
    });
  };

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
          onPress={handleProjectPress}
        />
        <Category
          title={t('quests')}
          items={recentQuests}
          onPress={handleQuestPress}
        />
        <Category
          title={t('assets')}
          items={recentAssets}
          onPress={handleAssetPress}
        />
      </DrawerContentScrollView>
    </LinearGradient>
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
        // swipeEnabled: pathname !== '/' && pathname !== '/register', // no drawer on login page
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
  items: { id: string; name: string }[];
  onPress: (item: { id: string; name: string }) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const animation = useSharedValue(1);

  const toggleExpand = useCallback(() => {
    setIsExpanded(!isExpanded);
  }, [isExpanded]);

  return (
    <View style={styles.drawerCategory}>
      <Pressable style={styles.categoryHeader} onPress={toggleExpand}>
        <Text style={styles.drawerCategoryTitle}>{title}</Text>
        <Animated.View>
          <Ionicons
            name={isExpanded ? 'chevron-down' : 'chevron-forward'}
            size={20}
            color={colors.text}
          />
        </Animated.View>
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
});
