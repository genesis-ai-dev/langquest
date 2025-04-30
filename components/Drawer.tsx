import { useAuth } from '@/contexts/AuthContext';
import { useProjectContext } from '@/contexts/ProjectContext';
import { Asset } from '@/database_services/assetService';
import { type Project } from '@/database_services/projectService';
import { Quest } from '@/database_services/questService';
import { useTranslation } from '@/hooks/useTranslation';
import { borderRadius, colors, fontSizes, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import {
  DrawerContentScrollView,
  type DrawerContentComponentProps
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
  Platform,
  Alert,
  ActivityIndicator
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import { useSystem } from '@/db/powersync/system';
import { AttachmentRecord, AttachmentState } from '@powersync/attachments';
import { eq } from 'drizzle-orm';
import { StorageAccessFramework } from 'expo-file-system';
import { PowerSyncDatabase, SyncStatus } from '@powersync/react-native';
import { translation as translationSchema, asset_content_link as assetContentLinkSchema, asset as assetSchema } from '@/db/drizzleSchema';
import { isNotNull } from 'drizzle-orm';
import { getFilesInUploadQueue } from '@/utils/attachmentUtils';
import { 
  backupDatabase, 
  backupUnsyncedAudio, 
  requestBackupDirectory, 
  prepareBackupPaths 
} from '@/utils/backupUtils';
import { selectAndInitiateRestore } from '@/utils/restoreUtils';

type DrawerItem = {
  name?: string;
  icon: keyof typeof Ionicons.glyphMap;
  path: Href<string>;
};

function DrawerItems() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const system = useSystem();
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const drawerItems: DrawerItem[] = [
    { name: t('projects'), icon: 'home', path: '/' },
    { name: t('profile'), icon: 'person', path: '/profile' }
  ] as const;

  const handleBackup = async (audioOnly = false) => {
    setIsBackingUp(true);
    let backupSuccess = false;
    let finalMessage = '';
    let baseDirectoryUri: string | null = null;

    try {
      // 1. System Init Check
      if (!system.isInitialized()) {
        Alert.alert(t('error'), t('databaseNotReady'));
        throw new Error('System not initialized'); // Throw to trigger finally block
      }
      if (system.attachmentQueue) {
          await system.attachmentQueue.init();
      } else {
          throw new Error('Attachment queue not available');
      }

      // 2. Permissions
      baseDirectoryUri = await requestBackupDirectory();
      if (!baseDirectoryUri) {
        finalMessage = t('storagePermissionDenied');
        Alert.alert(t('permissionDenied'), finalMessage);
        throw new Error('Permission denied'); // Throw to trigger finally block
      }

      // 3. Prepare Paths
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const { dbFullPathName, audioBaseDirPath, dbSourceUri } = prepareBackupPaths(timestamp);

      // 4. Execute Backups and Collect Results
      const dbResult = await backupDatabase(baseDirectoryUri, dbFullPathName, dbSourceUri, audioOnly);
      const audioResult = await backupUnsyncedAudio(system, baseDirectoryUri, audioBaseDirPath, timestamp);
      
      backupSuccess = dbResult.statusKey !== 'backupDbStatusFailed'; 

      // 5. Construct Final Message
      let dbStatusText = '';
      if (audioOnly) {
        dbStatusText = t('backupDbSkipped');
      } else {
        dbStatusText = dbResult.error 
            ? t(dbResult.statusKey, { error: dbResult.error }) 
            : t(dbResult.statusKey);
      }
      
      const statusDB = t('backupStatusDB', { status: dbStatusText });
      const statusFiles = t('backupStatusFiles', { count: audioResult.count });
      finalMessage = `${statusDB}. ${statusFiles}.`;
      // Optionally add info about copy errors: ${audioResult.errors.length > 0 ? ` (${audioResult.errors.length} file errors)`: ''}

    } catch (error: any) {
      // Handle errors from init, permissions, or backup helpers
      console.error('Error during backup process:', error);
      backupSuccess = false;
      // Use existing finalMessage if set (e.g., permission denied), otherwise create generic error message
      if (!finalMessage) { 
        const errorString = error instanceof Error ? error.message : String(error);
        finalMessage = t('criticalBackupError', { error: errorString });
      }
    } finally {
      // 6. Final Alert & State Reset
      setIsBackingUp(false);
      // Ensure finalMessage has a value before alerting
      if (!finalMessage) { 
          finalMessage = backupSuccess 
              ? t('backupCompleteTitle') 
              : t('criticalBackupError', { error: 'Unknown error occurred' });
      } 
      Alert.alert(
        backupSuccess ? t('backupCompleteTitle') : t('backupErrorTitle'),
        finalMessage
      );
    }
  };

  const confirmAndStartBackup = () => {
    Alert.alert(
      t('startBackupTitle'),
      t('startBackupMessage'),
      [
        {
          text: t('cancel'),
          style: 'cancel'
        },
        {
          text: t('backupAudioOnly'),
          onPress: () => handleBackup(true)
        },
        {
          text: t('backupEverything'),
          onPress: () => handleBackup(false)
        }
      ]
    );
  };

  const handleRestore = () => {
    // Define callbacks to manage the restoring state
    const onStart = () => setIsRestoring(true);
    const onFinish = () => setIsRestoring(false);
    // Pass system, t, and callbacks to the restore initiation function
    selectAndInitiateRestore(system, t, onStart, onFinish);
  };

  return (
    <View style={styles.drawerItems}>
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
        disabled={isBackingUp || isRestoring}
        style={(isBackingUp || isRestoring) ? { opacity: 0.5 } : {}}
      />
      <DrawerItem
        item={{
          name: isRestoring ? t('restoring') : t('restoreBackup'),
          icon: isRestoring ? 'hourglass-outline' : 'cloud-upload-outline'
        }}
        onPress={handleRestore}
        disabled={isBackingUp || isRestoring}
        style={(isBackingUp || isRestoring) ? { opacity: 0.5 } : {}}
      />
      {process.env.EXPO_PUBLIC_APP_VARIANT === 'development' && (
        <DrawerItem
          item={{ name: t('logOut'), icon: 'log-out' }}
          onPress={signOut}
          disabled={isBackingUp || isRestoring}
        />
      )}
    </View>
  );
}

export function Drawer({ children }: { children: React.ReactNode }) {
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

function Category({
  title,
  items,
  onPress
}: {
  title: string;
  items: ((Project | Quest | Asset) & { path: Href<string> })[];
  onPress: (item: (Project | Quest | Asset) & { path: Href<string> }) => void;
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
    item: Omit<DrawerItem, 'path'> & { path?: Href<string> };
  } & TouchableOpacityProps
>(({ active, item, style, ...props }, ref) => {
  return (
    <TouchableOpacity
      ref={ref}
      style={[
        styles.drawerItem,
        active && {
          backgroundColor: colors.primary
        }
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

  if (!pathname.startsWith('/') || !activeProject || !activeQuest) return null;

  return (
    <View style={styles.drawerFooterNav}>
      {pathname.startsWith('/') && (
        <TouchableOpacity onPress={() => router.navigate('/')}>
          <Ionicons name="home" size={20} color={colors.text} />
        </TouchableOpacity>
      )}
      <View style={styles.footerTextContainer}>
        {activeProject && (
          <Fragment>
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
          </Fragment>
        )}
        {activeQuest && activeProject && (
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
  }
});
