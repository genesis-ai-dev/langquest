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
  Alert
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import { useSystem } from '@/db/powersync/system';
import { AttachmentRecord, AttachmentState } from '@powersync/attachments';
import { eq } from 'drizzle-orm';
import { StorageAccessFramework } from 'expo-file-system';
import { PowerSyncDatabase, SyncStatus } from '@powersync/react-native';
import { translation as translationSchema, asset_content_link as assetContentLinkSchema } from '@/db/drizzleSchema';
import { isNotNull } from 'drizzle-orm';

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

  const drawerItems: DrawerItem[] = [
    { name: t('projects'), icon: 'home', path: '/' },
    { name: t('profile'), icon: 'person', path: '/profile' }
  ] as const;

  const handleBackup = async () => {
    if (!system.isInitialized()) {
      Alert.alert('Error', 'System not initialized. Cannot perform backup.');
      return;
    }

    // Ensure the attachment queue is initialized before proceeding
    try {
      if (system.attachmentQueue) {
        await system.attachmentQueue.init();
      } else {
          // Handle case where queue doesn't exist (e.g., no Supabase bucket configured)
          console.warn('AttachmentQueue not available, cannot back up attachments.');
          // Decide if you want to proceed with only DB backup or alert the user
      }
    } catch (initError) {
        console.error('Failed to initialize AttachmentQueue:', initError);
        Alert.alert('Backup Error', 'Failed to prepare attachment system for backup.');
        return; // Stop backup if queue init fails
    }

    // --- Permission Request & Directory Creation ---
    let baseDirectoryUri: string | null = null;
    // Don't store intermediate directory URIs as they seem problematic
    // let mainBackupDirUri: string | null = null; 
    // let databaseDirUri: string | null = null; 
    // let audioFilesDirUri: string | null = null; 
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const mainBackupDirName = `backup_${timestamp}`;
    // Define the full path names we intend to use for file creation
    const dbFullPathName = `${mainBackupDirName}/database/sqlite.db`; 
    const audioBaseDirPath = `${mainBackupDirName}/audio_files`; // Base path for audio files

    console.log('Backup requested');

    // 1. Request Base Directory Permissions (No explicit directory creation here)
    try { 
        const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (permissions?.granted && permissions.directoryUri) {
          baseDirectoryUri = permissions.directoryUri;
          console.log(`User granted access to base directory: ${baseDirectoryUri}`);
          // We will rely on createFileAsync with full path to hopefully create dirs
        } else {
          console.log('User denied directory permissions or cancelled.');
          Alert.alert('Permission Denied', 'Storage permission is required for backup.');
          return;
        }
    } catch (dirError) {
        console.error('!!!!!!!!!! ERROR DURING DIRECTORY PERMISSION !!!!!!!!!!');
        console.error('Failed during directory permission step:', dirError);
        Alert.alert('Directory Error', `Failed to get permissions. Error: ${dirError instanceof Error ? dirError.message : String(dirError)}`);
        return; // Stop if permissions fail
    }

    // Base directory URI is essential
    if (!baseDirectoryUri) {
      console.error('Base directory URI is null after permission request.');
      Alert.alert('Backup Failed', 'Failed to obtain base directory URI.');
      return;
    }

    // --- Add Debugging Logs for DB Path --- 
    console.log(`Checking base directory: ${FileSystem.documentDirectory}`);
    const dirContents = await FileSystem.readDirectoryAsync(FileSystem.documentDirectory || '');
    console.log('Contents of documentDirectory:', dirContents);
    // --------------------------------------

    // 4. Backup DB file (Use full path name relative to base)
    const dbName = 'sqlite.db'; // Keep original name for source reading
    const dbDirectoryUri_filesystem = FileSystem.documentDirectory || ''; 
    const dbSourceUri = dbDirectoryUri_filesystem + dbName;
    let dbFileInfo: FileSystem.FileInfo | null = null;
    try { 
        dbFileInfo = await FileSystem.getInfoAsync(dbSourceUri);
        if (dbFileInfo.exists) {
            console.log(`Attempting to back up DB: ${dbSourceUri} to path ${dbFullPathName}`);
            const dbContent = await FileSystem.readAsStringAsync(dbSourceUri, { encoding: FileSystem.EncodingType.Base64 });
            // Create the DB file using the full path name relative to the base URI
            const createdDbFileUri = await StorageAccessFramework.createFileAsync(baseDirectoryUri, dbFullPathName, 'application/vnd.sqlite3');
            console.log(`Created DB backup file URI: ${createdDbFileUri}`);
            await FileSystem.writeAsStringAsync(createdDbFileUri, dbContent, { encoding: FileSystem.EncodingType.Base64 });
            console.log(`Database backup write complete to: ${createdDbFileUri}`);
        } else {
            console.warn(`Database file not found at ${dbSourceUri}. Skipping DB backup.`);
        }
    } catch (dbBackupError) { 
        console.error('!!!!!!!!!! ERROR DURING DATABASE BACKUP !!!!!!!!!!');
        console.error(`Failed to back up database file ${dbSourceUri}:`, dbBackupError);
        Alert.alert('Database Backup Failed', `Could not back up the database file. Error: ${dbBackupError instanceof Error ? dbBackupError.message : String(dbBackupError)}`);
        return; 
    }

    // 5. Backup audio files - Simplified Direct Check (Use full path name relative to base)
    let filesBackedUpCount = 0;
    try {
        console.log('Finding potential audio attachment IDs from schema (Simplified Backup)...');
        const translationsWithAudio = await system.db.select({ audioId: translationSchema.audio })
                                           .from(translationSchema)
                                           .where(isNotNull(translationSchema.audio))
                                           .all();
        const contentLinksWithAudio = await system.db.select({ audioId: assetContentLinkSchema.audio_id })
                                           .from(assetContentLinkSchema)
                                           .where(isNotNull(assetContentLinkSchema.audio_id))
                                           .all();

        const potentialAudioIds = new Set([
            ...translationsWithAudio.map(t => t.audioId),
            ...contentLinksWithAudio.map(l => l.audioId)
        ].filter(id => id));

        console.log(`Found ${potentialAudioIds.size} potential audio attachment IDs to check directly.`);

        for (const audioId of potentialAudioIds) {
            if (!audioId) continue; 

            const sourceUri = FileSystem.documentDirectory + 'attachments/' + audioId;
            const backupFilenameOnly = audioId.split('/').pop() || audioId; 
            // Construct the full path name for the audio file backup
            const audioFullPathName = `${audioBaseDirPath}/${backupFilenameOnly}`;

            try {
                const fileInfo = await FileSystem.getInfoAsync(sourceUri);
                if (fileInfo.exists) {
                    console.log(`Attempting direct backup of existing audio file: ${sourceUri} to path ${audioFullPathName}`);
                    const fileContent = await FileSystem.readAsStringAsync(sourceUri, { encoding: FileSystem.EncodingType.Base64 });
                    
                    let mimeType = 'audio/mpeg'; 
                    const extension = backupFilenameOnly.split('.').pop()?.toLowerCase();
                    if (extension === 'm4a') mimeType = 'audio/aac'; // Match adapter change
                    else if (extension === 'mp3') mimeType = 'audio/mpeg';
                    
                    // Create the audio file using the full path name relative to the base URI
                    const createdAudioFileUri = await StorageAccessFramework.createFileAsync(baseDirectoryUri, audioFullPathName, mimeType);
                    await FileSystem.writeAsStringAsync(createdAudioFileUri, fileContent, { encoding: FileSystem.EncodingType.Base64 });
                    console.log(`Audio backup complete to: ${createdAudioFileUri}`);
                    filesBackedUpCount++;
                } else {
                    // console.log(`Audio file not found at source (expected for non-local files): ${sourceUri}`);
                }
            } catch (fileCopyError) {
                console.error(`Failed to copy audio file ${sourceUri}:`, fileCopyError);
            }
        }
    } catch (audioQueryError) {
        console.error('!!!!!!!!!! ERROR DURING AUDIO FILE QUERY/PROCESSING !!!!!!!!!!');
        console.error('Failed to query or process audio files for backup:', audioQueryError);
        Alert.alert('Audio Backup Failed', `Could not process audio files. Error: ${audioQueryError instanceof Error ? audioQueryError.message : String(audioQueryError)}`);
    }

    // Add a simple success message at the end if we got this far without returning early from errors
    Alert.alert('Backup Process Finished', 'Check the selected directory. Any errors during file copy were logged to console.');

    console.log("Backup function finished execution."); 
  };

  return (
    <View style={styles.drawerItems}>
      {drawerItems.map((item, index) => (
        <Link href={item.path} key={index} asChild>
          <DrawerItem item={item} active={pathname === item.path} />
        </Link>
      ))}
      <DrawerItem
        item={{ name: 'Backup Data', icon: 'save' }}
        onPress={handleBackup}
      />
      {process.env.EXPO_PUBLIC_APP_VARIANT === 'development' && (
        <DrawerItem
          item={{ name: t('logOut'), icon: 'log-out' }}
          onPress={signOut}
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
