import { useAuth } from '@/contexts/AuthContext';
import { useProjectContext } from '@/contexts/ProjectContext';
import { Asset } from '@/database_services/assetService';
import type { Project } from '@/database_services/projectService';
import { Quest } from '@/database_services/questService';
import { useTranslation } from '@/hooks/useTranslation';
import { borderRadius, colors, fontSizes, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import {
  DrawerContentScrollView,
  DrawerContentComponentProps
} from '@react-navigation/drawer';
import { LinearGradient } from 'expo-linear-gradient';
import { Href, Link, usePathname, useRouter } from 'expo-router';
import { Drawer as ExpoDrawer } from 'expo-router/drawer';
import { Fragment, forwardRef, useCallback, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableOpacityProps,
  View,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useSystem } from '@/contexts/SystemContext';
import { 
  backupUnsyncedAudio, 
  requestBackupDirectory, 
  prepareBackupPaths 
} from '@/utils/backupUtils';
import { selectAndInitiateRestore } from '@/utils/restoreUtils';

interface DrawerItemType {
  name?: string;
  icon: keyof typeof Ionicons.glyphMap;
  path: Href<string>;
}

function DrawerItems() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const system = useSystem();
  const systemReady = system.isInitialized();
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const drawerItems: DrawerItemType[] = [
    { name: t('projects'), icon: 'home', path: '/' },
    { name: t('profile'), icon: 'person', path: '/profile' }
  ] as const;

  const handleBackup = async (/* audioOnly = false */) => {
    setIsBackingUp(true);
    let finalAlertTitle = t('backupErrorTitle'); // Default to error
    let finalAlertMessage = '';

    try {
      // 1. System & Queue Init Checks
      if (!systemReady) {
        throw new Error(t('databaseNotReady'));
      }
      // Attempt to initialize queues, warn if not available but don't throw
      try {
        await system.permAttachmentQueue?.init();
      } catch (qError) {
        console.warn('Error initializing permanent attachment queue:', qError);
      }
      try {
        await system.tempAttachmentQueue?.init();
      } catch (qError) {
        console.warn('Error initializing temporary attachment queue:', qError);
      }

      // 2. Permissions
      console.log('[handleBackup] Requesting directory permissions...');
      const baseDirectoryUri = await requestBackupDirectory(); // Should throw on denial/error
      if (!baseDirectoryUri) {
         throw new Error(t('storagePermissionDenied')); 
      }
      console.log('[handleBackup] Permissions granted, preparing paths...');

      // 3. Prepare Paths
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      prepareBackupPaths(timestamp); // Call it but don't store result if unneeded
      console.log('[handleBackup] Paths prepared, attempting audio backup...');

      // 4. Execute Backup (Audio Only)
      const audioResult = await backupUnsyncedAudio(system, baseDirectoryUri /*, audioBaseDirPath, timestamp */);

      // 5. Construct Success Message (Audio Only)
      finalAlertTitle = t('backupCompleteTitle');
      finalAlertMessage = t('audioBackupStatus', { count: audioResult.count });

    } catch (error: unknown) {
      // Handle errors from any awaited step above
      console.log('[handleBackup] Entered CATCH block.');
      console.error('Error during backup process:', error);
      const errorString = error instanceof Error ? error.message : String(error);
      finalAlertMessage = t('criticalBackupError', { error: errorString || 'Unknown error occurred' });
    } finally {
      // 6. Final Alert & State Reset
      console.log('[handleBackup] Entered FINALLY block.');
      setIsBackingUp(false);
      // Ensure message isn't empty if something went wrong before catch block assignment
      if (!finalAlertMessage) {
           finalAlertMessage = t('criticalBackupError', { error: 'Backup failed unexpectedly' });
      }
      Alert.alert(finalAlertTitle, finalAlertMessage);
    }
  };

  const confirmAndStartBackup = () => {
    Alert.alert(
      t('startBackupTitle'),
      t('startBackupMessageAudioOnly'),
      [
        {
          text: t('cancel'),
          style: 'cancel'
        },
        {
          text: t('backupAudioAction'),
          onPress: () => void handleBackup(/* false */)
        }
      ]
    );
  };

  const handleRestore = () => {
    const onStart = () => setIsRestoring(true);
    const onFinish = () => setIsRestoring(false);
    void selectAndInitiateRestore(system, t, onStart, onFinish);
  };

  return (
    <View style={styles.drawerItems}>
      {!systemReady && (
        <View style={styles.initializingIndicator}> 
          <ActivityIndicator size="small" color={colors.text} />
          <Text style={styles.initializingText}>{t('initializing')}...</Text>
        </View>
      )} 
      {drawerItems.map((item, index) => (
        <Link href={item.path} key={index} asChild>
          <DrawerItem item={item} active={pathname === item.path} />
        </Link>
      ))}
      <DrawerItem
        item={{
          name: isBackingUp ? t('backingUp') : t('backup'),
          icon: isBackingUp ? 'hourglass-outline' : 'save'
        }}
        onPress={confirmAndStartBackup}
        disabled={!systemReady || isBackingUp || isRestoring}
        style={(!systemReady || isBackingUp || isRestoring) ? { opacity: 0.5 } : {}}
      />
      <DrawerItem
        item={{
          name: isRestoring ? t('restoring') : t('restoreBackup'),
          icon: isRestoring ? 'hourglass-outline' : 'cloud-upload-outline'
        }}
        onPress={handleRestore}
        disabled={!systemReady || isBackingUp || isRestoring}
        style={(!systemReady || isBackingUp || isRestoring) ? { opacity: 0.5 } : {}}
      />
      {process.env.EXPO_PUBLIC_APP_VARIANT === 'development' && (
        <DrawerItem
          item={{ name: t('logOut'), icon: 'log-out' }}
          onPress={signOut}
          disabled={!systemReady || isBackingUp || isRestoring}
          style={(!systemReady || isBackingUp || isRestoring) ? { opacity: 0.5 } : {}}
        />
      )}
    </View>
  );
}

export function Drawer(/*{ children }: { children: React.ReactNode }*/) {
  return (
    <ExpoDrawer
      screenOptions={{
        headerShown: false,
        drawerType: 'slide',
        swipeEdgeWidth: 100
      }}
      drawerContent={DrawerContent}
    />
  );
}

export function DrawerContent(props: DrawerContentComponentProps) {
  const { t } = useTranslation();
  const {
    recentProjects,
    recentQuests,
    recentAssets,
    goToProject,
    goToQuest,
    goToAsset
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
          onPress={(item) => goToAsset({ path: item.path }, true)}
        />
      </DrawerContentScrollView>
      <DrawerItems />
      <View style={styles.drawerFooter}>
        <DrawerFooter />
      </View>
    </LinearGradient>
  );
}

interface CategoryProps {
  title: string;
  items: ((Project | Quest | Asset) & { path: Href<string> })[];
  onPress: (item: (Project | Quest | Asset) & { path: Href<string> }) => void;
}

function Category({ title, items, onPress }: CategoryProps) {
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
            <Link href={item.path} key={item.id} asChild>
              <TouchableOpacity
                key={item.id}
                onPress={() => onPress(item)}
                style={styles.categoryItem}
              >
                <Text style={styles.categoryItemText}>{item.name}</Text>
              </TouchableOpacity>
            </Link>
          ))}
        </View>
      )}
    </View>
  );
}

const DrawerItem = forwardRef<
  TouchableOpacity,
  {
    active?: boolean;
    item: Omit<DrawerItemType, 'path'> & { path?: Href<string> };
  } & TouchableOpacityProps
>(({ active, item, style, ...props }, ref) => {
  return (
    <TouchableOpacity
      ref={ref}
      style={[
        styles.drawerItem,
        active && {
          backgroundColor: colors.primary
        },
        style
      ]}
      {...props}
    >
      <Ionicons name={item.icon} size={20} color={colors.text} />
      <Text style={{ color: colors.text }}>{item.name}</Text>
    </TouchableOpacity>
  );
});

function DrawerFooter() {
  const router = useRouter();
  const pathname = usePathname();
  const { goToProject, goToQuest, activeProject, activeQuest } =
    useProjectContext();

  if (!pathname.startsWith('/')) return null;

  return (
    <View style={styles.drawerFooterNav}>
      {pathname.startsWith('/') && (
        <TouchableOpacity onPress={() => router.navigate('/')}>
          <Ionicons name="home" size={20} color={colors.text} />
        </TouchableOpacity>
      )}
      <View style={styles.footerTextContainer}>
        <Fragment>
          <Ionicons name="chevron-forward" size={14} color={colors.text} />
          <TouchableOpacity
            onPress={() => goToProject(activeProject!, true)}
            style={styles.footerTextItem}
          >
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{ color: colors.text }}
            >
              {activeProject?.name}
            </Text>
          </TouchableOpacity>
        </Fragment>
        
        {activeQuest && (
          <Fragment>
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
          </Fragment>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  drawer: {
    padding: 15,
    flex: 1,
    color: colors.text
  },
  drawerHeader: {
    fontSize: fontSizes.large,
    fontWeight: '600',
    marginBottom: 15,
    color: colors.text
  },
  drawerCategory: {
    padding: spacing.small,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.medium,
    color: colors.text,
    marginVertical: spacing.small,
    overflow: 'hidden'
  },
  drawerCategoryTitle: {
    fontSize: fontSizes.medium,
    fontWeight: '500',
    color: colors.text
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xsmall
  },
  categoryContent: {
    overflow: 'hidden'
  },
  measureContainer: {
    position: 'absolute',
    width: '100%'
  },
  categoryItem: {
    paddingVertical: 5
  },
  categoryItemText: {
    color: colors.text
  },
  drawerItems: {
    gap: spacing.small,
    padding: spacing.small
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    padding: spacing.medium,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.small
  },
  drawerFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.inputBackground,
    position: 'static',
    justifyContent: 'flex-end',
    overflow: 'hidden'
  },
  drawerFooterNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    padding: spacing.small
  },
  footerTextContainer: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.small,
    alignItems: 'center'
  },
  footerTextItem: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.small,
    paddingVertical: spacing.xsmall,
    paddingHorizontal: spacing.small
  },
  initializingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.medium, 
    gap: spacing.small,
    opacity: 0.7
  },
  initializingText: {
    color: colors.text,
    fontSize: fontSizes.small
  }
});
