import { ProjectListSkeleton } from '@/components/ProjectListSkeleton';
import { useAuth } from '@/contexts/AuthContext';
import type { translation } from '@/db/drizzleSchema';
import { asset, quest_asset_link } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { useCurrentNavigation } from '@/hooks/useAppNavigation';
import { useAttachmentStates } from '@/hooks/useAttachmentStates';
import { useLocalization } from '@/hooks/useLocalization';
import { useRabbitModeVAD } from '@/hooks/useRabbitModeVAD';
import { useLocalStore } from '@/store/localStore';
import { colors, fontSizes, sharedStyles, spacing } from '@/styles/theme';
import { SHOW_DEV_ELEMENTS } from '@/utils/devConfig';
import { RabbitModeFileManager } from '@/utils/rabbitModeFileManager';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { eq } from 'drizzle-orm';
import type { Audio } from 'expo-av';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { AssetListItem } from './AssetListItem';
import { useSimpleHybridInfiniteData } from './useHybridData';

type Asset = typeof asset.$inferSelect;
type Translation = typeof translation.$inferSelect;

// Rabbit Mode Types
interface RecordingSegment {
  id: string;
  assetId: string;
  startTime: number;
  endTime: number;
  duration: number;
  audioUri?: string;
  waveformData?: number[];
}

interface AssetWithTranslations extends Asset {
  translations: Translation[];
  hasRecording: boolean;
  recordingSegments: RecordingSegment[];
}

interface RabbitModeState {
  isRecording: boolean;
  currentAssetIndex: number;
  pulledAssets: AssetWithTranslations[];
  isHoldingCard: boolean;
  recordingStartTime: number | null;
  recordingSegments: RecordingSegment[]; // All segments across all assets
  audioRecording: Audio.Recording | null; // Add audio recording state
}

// Recording Segment Component
const RecordingSegmentItem: React.FC<{
  segment: RecordingSegment;
  onDelete: (segmentId: string) => void;
  onReorder: (segmentId: string, direction: 'up' | 'down') => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}> = ({ segment, onDelete, onReorder, canMoveUp, canMoveDown }) => {
  return (
    <View style={styles.recordingSegment}>
      <View style={styles.segmentWaveform}>
        {/* Mock waveform visualization */}
        {Array.from({ length: 20 }, (_, i) => (
          <View
            key={i}
            style={[styles.waveformBar, { height: Math.random() * 15 + 5 }]}
          />
        ))}
      </View>

      <View style={styles.segmentControls}>
        <TouchableOpacity
          style={[
            styles.segmentButton,
            !canMoveUp && styles.segmentButtonDisabled
          ]}
          onPress={() => canMoveUp && onReorder(segment.id, 'up')}
          disabled={!canMoveUp}
        >
          <Ionicons
            name="chevron-up"
            size={16}
            color={canMoveUp ? colors.text : colors.textSecondary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.segmentButton,
            !canMoveDown && styles.segmentButtonDisabled
          ]}
          onPress={() => canMoveDown && onReorder(segment.id, 'down')}
          disabled={!canMoveDown}
        >
          <Ionicons
            name="chevron-down"
            size={16}
            color={canMoveDown ? colors.text : colors.textSecondary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.segmentDeleteButton}
          onPress={() => onDelete(segment.id)}
        >
          <Ionicons name="trash" size={16} color={colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Asset Card Component for Rabbit Mode
const AssetCard: React.FC<{
  asset: AssetWithTranslations;
  index: number;
  totalCards: number;
  onPull: () => void;
  isPulled: boolean;
  isActive: boolean;
}> = ({ asset, index, totalCards, onPull, isPulled, isActive }) => {
  const translateY = new Animated.Value(0);

  const cardStyle = {
    transform: [{ translateY }],
    zIndex: totalCards - index,
    marginBottom: isPulled ? 0 : -60, // Stack cards
    opacity: isPulled ? 0.8 : 1
  };

  return (
    <TouchableOpacity
      onPress={onPull}
      disabled={isPulled}
      style={[styles.assetCard, cardStyle, isActive && styles.activeAssetCard]}
    >
      <View style={styles.assetCardContent}>
        <Text style={styles.assetName} numberOfLines={1}>
          {asset.name}
        </Text>
        <View style={styles.assetStatus}>
          <Ionicons
            name={asset.hasRecording ? 'checkmark-circle' : 'radio-button-off'}
            size={16}
            color={asset.hasRecording ? colors.success : colors.textSecondary}
          />
          <Text style={styles.assetStatusText}>
            {asset.hasRecording ? 'Recorded' : 'Pending'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// Mini Waveform Component for VAD visualization
const MiniWaveform: React.FC<{
  isListening: boolean;
  isRecording: boolean;
  level: number;
}> = ({ isListening, isRecording, level }) => {
  const [levels, setLevels] = React.useState<number[]>(Array(20).fill(0));

  React.useEffect(() => {
    if (isListening) {
      setLevels((prev) => {
        const newLevels = [...prev.slice(1), level];
        return newLevels;
      });
    }
  }, [level, isListening]);

  return (
    <View style={styles.miniWaveform}>
      {levels.map((segmentLevel, i) => {
        const height = Math.max(4, segmentLevel * 30);
        return (
          <View
            key={i}
            style={[
              styles.miniWaveformBar,
              {
                height,
                backgroundColor: !isListening
                  ? colors.textSecondary
                  : isRecording
                    ? colors.primary
                    : colors.accent
              }
            ]}
          />
        );
      })}
    </View>
  );
};

// User Flagging Modal Component
const UserFlaggingModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onSubmit: (flagData: { type: string; description: string }) => void;
}> = ({ visible, onClose, onSubmit }) => {
  const { t: _t } = useLocalization();
  const [flagType, setFlagType] = React.useState('content-issue');
  const [description, setDescription] = React.useState('');

  const flagTypes = [
    { id: 'content-issue', label: 'Content Issue', icon: 'warning' as const },
    {
      id: 'inappropriate',
      label: 'Inappropriate Content',
      icon: 'ban' as const
    },
    {
      id: 'technical-problem',
      label: 'Technical Problem',
      icon: 'construct' as const
    },
    {
      id: 'quality-concern',
      label: 'Quality Concern',
      icon: 'star-half' as const
    },
    { id: 'other', label: 'Other', icon: 'ellipsis-horizontal' as const }
  ];

  const handleSubmit = () => {
    if (!description.trim()) {
      Alert.alert(
        'Missing Information',
        'Please provide a description of the issue.'
      );
      return;
    }

    onSubmit({ type: flagType, description: description.trim() });
    setDescription('');
    setFlagType('content-issue');
    onClose();
  };

  if (!visible) return null;

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Flag Content</Text>
          <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <Text style={styles.modalSectionTitle}>Issue Type</Text>
        <View style={styles.flagTypeContainer}>
          {flagTypes.map((type) => (
            <TouchableOpacity
              key={type.id}
              style={[
                styles.flagTypeOption,
                flagType === type.id && styles.selectedFlagType
              ]}
              onPress={() => setFlagType(type.id)}
            >
              <Ionicons
                name={type.icon}
                size={16}
                color={
                  flagType === type.id ? colors.primary : colors.textSecondary
                }
              />
              <Text
                style={[
                  styles.flagTypeText,
                  flagType === type.id && styles.selectedFlagTypeText
                ]}
              >
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.modalSectionTitle}>Description</Text>
        <TextInput
          style={styles.flagDescriptionInput}
          placeholder="Describe the issue in detail..."
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          placeholderTextColor={colors.textSecondary}
        />

        <View style={styles.modalButtonContainer}>
          <TouchableOpacity
            style={[styles.modalButton, styles.modalCancelButton]}
            onPress={onClose}
          >
            <Text style={styles.modalCancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modalButton, styles.modalSubmitButton]}
            onPress={handleSubmit}
          >
            <Text style={styles.modalSubmitButtonText}>Submit Flag</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

// Custom Rabbit Mode Switch Component
const RabbitModeSwitch: React.FC<{
  value: boolean;
  onToggle: () => void;
  disabled?: boolean;
}> = ({ value, onToggle, disabled = false }) => {
  const { t: _t } = useLocalization(); // Unused variable prefixed with _

  return (
    <View style={styles.rabbitModeSwitchContainer}>
      <View style={styles.rabbitModeSwitchContent}>
        <View style={styles.rabbitModeSwitchInfo}>
          <View style={styles.rabbitModeSwitchIcons}>
            <MaterialCommunityIcons
              name="tortoise"
              size={20}
              color={!value ? colors.primary : colors.textSecondary}
            />
          </View>
        </View>
        <Switch
          value={value}
          onValueChange={onToggle}
          disabled={disabled}
          trackColor={{
            false: colors.disabled,
            true: disabled ? colors.disabled : colors.primary
          }}
          thumbColor={!value || disabled ? colors.disabled : colors.background}
        />
        <MaterialCommunityIcons
          name="rabbit"
          size={20}
          color={value ? colors.primary : colors.textSecondary}
        />
      </View>
    </View>
  );
};

export default function NextGenAssetsView() {
  const { currentQuestId } = useCurrentNavigation();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = React.useState('');
  const { t } = useLocalization();
  const { currentUser } = useAuth();

  // Audio recording permissions (using the same approach as AudioRecorder)
  // Note: Permissions are handled by the VAD hook now

  // Rabbit Mode State
  const [isRabbitMode, setIsRabbitMode] = React.useState(false);
  const [showFlaggingModal, setShowFlaggingModal] = React.useState(false);
  const [currentSessionId, setCurrentSessionId] = React.useState<string | null>(
    null
  );
  const [rabbitState, setRabbitState] = React.useState<RabbitModeState>({
    isRecording: false,
    currentAssetIndex: 0,
    pulledAssets: [],
    isHoldingCard: false,
    recordingStartTime: null,
    recordingSegments: [], // Mock segments for now
    audioRecording: null // Handled by VAD hook
  });

  // Use ref to store current rabbit state for callbacks to access
  const rabbitStateRef = React.useRef<RabbitModeState>(rabbitState);
  const recordingStartTimeRef = React.useRef<number | null>(null);

  // Update ref whenever state changes
  React.useEffect(() => {
    rabbitStateRef.current = rabbitState;
  }, [rabbitState]);

  // Debounce the search query
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300); // 300ms delay

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isOnline,
    isFetching
  } = useSimpleHybridInfiniteData<Asset>(
    'assets',
    [currentQuestId || '', debouncedSearchQuery],
    // Offline query function - Assets must be downloaded to use
    async ({ pageParam, pageSize }) => {
      if (!currentQuestId) return [];

      try {
        const offset = pageParam * pageSize;

        // Build base query
        const baseQuery = system.db
          .select({
            id: asset.id,
            name: asset.name,
            source_language_id: asset.source_language_id,
            images: asset.images,
            creator_id: asset.creator_id,
            visible: asset.visible,
            active: asset.active,
            created_at: asset.created_at,
            last_updated: asset.last_updated,
            download_profiles: asset.download_profiles
          })
          .from(asset)
          .innerJoin(quest_asset_link, eq(asset.id, quest_asset_link.asset_id))
          .where(eq(quest_asset_link.quest_id, currentQuestId));

        // Add search filtering if search query exists
        if (debouncedSearchQuery.trim()) {
          // For offline search with joins, we need to fetch all and filter
          const allAssets = await baseQuery;

          // Safe filtering with proper null checks
          const searchTerm = debouncedSearchQuery.trim().toLowerCase();
          const filteredAssets = allAssets.filter((a) => {
            // Ensure name exists and is a string
            const assetName = a.name;
            return (
              assetName &&
              typeof assetName === 'string' &&
              assetName.toLowerCase().includes(searchTerm)
            );
          });

          // Apply pagination to filtered results
          return filteredAssets.slice(offset, offset + pageSize) as Asset[];
        }

        // Normal pagination without search
        const assets = await baseQuery.limit(pageSize).offset(offset);
        return assets as Asset[];
      } catch (error) {
        console.error('[ASSETS] Offline query error:', error);
        return [];
      }
    },
    // Cloud query function - Since assets must be downloaded, we return empty
    async () => {
      return Promise.resolve([] as Asset[]);
    },
    20 // pageSize
  );

  // Flatten all pages into a single array
  const assets = React.useMemo(() => {
    const allAssets = data.pages.flatMap((page) => page.data);

    // Filter out invalid assets (e.g., cloud assets without proper data)
    const validAssets = allAssets.filter((asset) => {
      // Must have at least id and name to be valid
      return asset.id && asset.name;
    });

    // Sort assets by name in natural alphanumerical order
    return validAssets.sort((a, b) => {
      // Use localeCompare with numeric option for natural sorting
      return a.name.localeCompare(b.name, undefined, {
        numeric: true,
        sensitivity: 'base'
      });
    });
  }, [data.pages]);

  // Process assets with translation status for rabbit mode
  const assetsWithTranslations = React.useMemo((): AssetWithTranslations[] => {
    // Always calculate when we have assets - don't depend on isRabbitMode to avoid timing issues
    if (assets.length === 0) return [];

    // For now, mock the translation status - in real implementation,
    // you'd fetch actual translations for each asset
    return assets.map((asset, index) => ({
      ...asset,
      translations: [], // TODO: Fetch actual translations
      hasRecording: index > 0 && Math.random() > 0.7, // Ensure first asset is always available for recording
      recordingSegments: [] // Mock recording segments
    }));
  }, [assets]);

  // Voice Activity Detection for Rabbit Mode
  const vadFunctionsRef = React.useRef<{
    startListening: () => Promise<void>;
    stopListening: () => Promise<void>;
    resetVAD: () => void;
  } | null>(null);

  const {
    startListening: vadStartListening,
    stopListening: vadStopListening,
    resetVAD: vadReset,
    state: vadState
  } = useRabbitModeVAD(
    {
      onSpeechStart: () => {
        void handleSpeechStart();
      },
      onSpeechEnd: (recordingUri?: string) => {
        void handleSpeechEnd(recordingUri);
      },
      onLevelChange: (level: number) => {
        // Always log audio levels for debugging thresholds
        console.log(`🎵 Audio: ${level.toFixed(3)}`);
      },
      onStateChange: (state) => {
        // Only log when state actually changes to reduce spam
        const newState = state.isSpeaking ? 'SPEAKING' : 'LISTENING';
        console.log(
          `🎯 VAD: ${newState} (level: ${state.currentLevel.toFixed(3)})`
        );
      }
    },
    { saveRecordings: true }
  );

  const {
    isListening,
    isSpeaking: _isSpeaking, // Unused for now
    currentLevel
  } = vadState;

  // Handle speech start
  const handleSpeechStart = React.useCallback(() => {
    console.log('=== SPEECH STARTED IN RABBIT MODE ===');
    console.log('Current session ID:', currentSessionId);
    console.log('Current quest ID:', currentQuestId);

    if (!currentSessionId || !currentQuestId || !currentUser) {
      console.log(
        '❌ Cannot start recording - missing session, quest, or user'
      );
      return;
    }

    // Get current session and asset from the new system
    const session = useLocalStore
      .getState()
      .getRabbitModeSession(currentSessionId);
    if (!session) {
      console.log('❌ Cannot start recording - no active session found');
      return;
    }

    const currentAsset = session.assets.find(
      (asset) => asset.id === session.currentAssetId
    );
    console.log('Current asset:', currentAsset ? currentAsset.name : 'NONE');

    if (!currentAsset) {
      console.log('❌ Cannot start recording - no current asset available');
      return;
    }

    console.log('✅ Recording started for asset:', currentAsset.name);
    console.log('📝 VAD hook is handling the actual recording');

    // Store start time immediately in ref for immediate access
    const startTime = Date.now();
    recordingStartTimeRef.current = startTime;

    // Just update UI state - VAD hook handles the actual recording
    setRabbitState((prev) => ({
      ...prev,
      isRecording: true,
      recordingStartTime: startTime
    }));
  }, [currentSessionId, currentQuestId, currentUser]);

  const handleSpeechEnd = React.useCallback(
    async (recordingUri?: string) => {
      console.log('=== SPEECH ENDED IN RABBIT MODE ===');
      console.log('Current user:', currentUser ? currentUser.id : 'NONE');
      console.log('Current quest ID:', currentQuestId);
      console.log('Current session ID:', currentSessionId);
      console.log('Recording URI from VAD:', recordingUri);

      if (!currentUser || !currentQuestId || !currentSessionId) {
        console.warn('❌ Missing required data for saving recording');
        return;
      }

      // Get current session and asset
      const session = useLocalStore
        .getState()
        .getRabbitModeSession(currentSessionId);
      if (!session) {
        console.warn('❌ No active session found');
        return;
      }

      const currentAsset = session.assets.find(
        (a) => a.id === session.currentAssetId
      );
      if (!currentAsset) {
        console.warn('❌ No current asset found in session');
        return;
      }

      if (!recordingUri) {
        console.warn('❌ No recording URI provided by VAD hook');
        return;
      }

      if (!recordingStartTimeRef.current) {
        console.warn('❌ Missing recording start time');
        return;
      }

      console.log('✅ All required data available for saving segment');

      try {
        // Create segment record
        const endTime = Date.now();
        const duration = endTime - recordingStartTimeRef.current;

        // Save segment to draft session via RabbitModeFileManager
        const savedUri = await RabbitModeFileManager.saveAudioSegment(
          currentSessionId,
          recordingUri
        );

        console.log('📁 Segment saved to permanent storage:', savedUri);

        // Add segment to local store
        useLocalStore
          .getState()
          .addRabbitModeSegment(currentSessionId, currentAsset.id, {
            assetId: currentAsset.id,
            startTime: recordingStartTimeRef.current,
            endTime,
            duration,
            audioUri: savedUri
          });

        console.log('✅ Segment successfully added to draft session');

        // Reset recording state
        setRabbitState((prev) => ({
          ...prev,
          isRecording: false,
          recordingStartTime: null
        }));
      } catch (error) {
        console.error('❌ Error saving recording segment:', error);
      }
    },
    [
      currentUser,
      currentQuestId,
      currentSessionId,
      recordingStartTimeRef.current
    ]
  );

  // Handle deleting a recording segment
  const handleDeleteSegment = React.useCallback((segmentId: string) => {
    setRabbitState((prev) => {
      const updatedPulledAssets = prev.pulledAssets.map((asset) => ({
        ...asset,
        translations: asset.translations || [],
        recordingSegments: asset.recordingSegments.filter(
          (seg) => seg.id !== segmentId
        ),
        hasRecording:
          asset.recordingSegments.filter((seg) => seg.id !== segmentId).length >
          0
      }));

      return {
        ...prev,
        pulledAssets: updatedPulledAssets,
        recordingSegments: prev.recordingSegments.filter(
          (seg) => seg.id !== segmentId
        )
      };
    });
  }, []);

  // Handle reordering recording segments
  const handleReorderSegment = React.useCallback(
    (segmentId: string, direction: 'up' | 'down') => {
      setRabbitState((prev) => {
        const updatedPulledAssets = prev.pulledAssets.map((asset) => {
          const segments = [...asset.recordingSegments];
          const segmentIndex = segments.findIndex(
            (seg) => seg.id === segmentId
          );

          if (segmentIndex === -1) return asset;

          const newIndex =
            direction === 'up' ? segmentIndex - 1 : segmentIndex + 1;
          if (newIndex < 0 || newIndex >= segments.length) return asset;

          // Swap segments
          const currentSegment = segments[segmentIndex];
          const swapSegment = segments[newIndex];

          segments[segmentIndex] = swapSegment;
          segments[newIndex] = currentSegment;

          return {
            ...asset,
            translations: asset.translations || [],
            recordingSegments: segments
          };
        });

        return {
          ...prev,
          pulledAssets: updatedPulledAssets
        };
      });
    },
    []
  );

  // Handle pulling next asset to start recording
  const handlePullNextAsset = React.useCallback(() => {
    const unpulledAssets = assetsWithTranslations.filter(
      (asset) =>
        !rabbitState.pulledAssets.find((pulled) => pulled.id === asset.id)
    );

    if (unpulledAssets.length > 0) {
      const nextAsset = unpulledAssets[0];
      setRabbitState((prev) => ({
        ...prev,
        pulledAssets: [
          ...prev.pulledAssets,
          {
            ...nextAsset,
            translations: nextAsset.translations || [],
            recordingSegments: nextAsset.recordingSegments || []
          }
        ],
        currentAssetIndex: prev.pulledAssets.length // Move to the newly added asset
      }));
    }
  }, [assetsWithTranslations, rabbitState.pulledAssets]);

  // Handle pulling an asset up
  const handlePullAsset = React.useCallback(
    (asset: AssetWithTranslations) => {
      if (rabbitState.isHoldingCard) return;

      // Pause recording while manipulating cards
      setRabbitState((prev) => ({
        ...prev,
        isHoldingCard: true,
        pulledAssets: [...prev.pulledAssets, asset]
      }));

      // Resume recording after placing card
      setTimeout(() => {
        setRabbitState((prev) => ({
          ...prev,
          isHoldingCard: false
        }));
      }, 1000);
    },
    [rabbitState.isHoldingCard]
  );

  // Handle flagging submission
  const handleFlagSubmit = React.useCallback(
    (flagData: { type: string; description: string }) => {
      try {
        // TODO: Implement actual flagging submission to backend
        console.log('Flag submitted:', flagData);

        // For now, just show a success message
        Alert.alert(
          'Flag Submitted',
          'Thank you for your feedback. Our team will review this content.',
          [{ text: 'OK' }]
        );
      } catch (error) {
        console.error('Error submitting flag:', error);
        Alert.alert('Error', 'Failed to submit flag. Please try again.');
      }
    },
    []
  );

  // Watch attachment states for all assets
  const assetIds = React.useMemo(() => {
    return assets.map((asset) => asset.id);
  }, [assets]);

  const { attachmentStates, isLoading: isAttachmentStatesLoading } =
    useAttachmentStates(assetIds);

  // Get attachment state summary
  const attachmentStateSummary = React.useMemo(() => {
    if (attachmentStates.size === 0) {
      return {};
    }

    const states = Array.from(attachmentStates.values());
    const summary = states.reduce(
      (acc, attachment) => {
        acc[attachment.state] = (acc[attachment.state] || 0) + 1;
        return acc;
      },
      {} as Record<number, number>
    );
    return summary;
  }, [attachmentStates]);

  const renderItem = React.useCallback(
    ({ item }: { item: Asset & { source?: string } }) => (
      <AssetListItem
        asset={item}
        attachmentState={attachmentStates.get(item.id)}
      />
    ),
    [attachmentStates]
  );

  const keyExtractor = React.useCallback(
    (item: Asset & { source?: string }) => item.id,
    []
  );

  const onEndReached = React.useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderFooter = React.useCallback(() => {
    if (!isFetchingNextPage) return null;

    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }, [isFetchingNextPage]);

  const statusText = React.useMemo(() => {
    const offlineCount = assets.filter(
      (a) => a.source === 'localSqlite'
    ).length;
    const cloudCount = assets.filter(
      (a) => a.source === 'cloudSupabase'
    ).length;
    return `${isOnline ? '🟢' : '🔴'} Offline: ${offlineCount} | Cloud: ${isOnline ? cloudCount : 'N/A'} | Total: ${assets.length}`;
  }, [isOnline, assets]);

  const attachmentSummaryText = React.useMemo(() => {
    return Object.entries(attachmentStateSummary)
      .map(([state, count]) => {
        const stateNames = {
          '0': `⏳ ${t('queued')}`,
          '1': `🔄 ${t('syncing')}`,
          '2': `✅ ${t('synced')}`,
          '3': `❌ ${t('failed')}`,
          '4': `📥 ${t('downloading')}`
        };
        return `${stateNames[state as keyof typeof stateNames] || `${t('state')} ${state}`}: ${count}`;
      })
      .join(' | ');
  }, [attachmentStateSummary, t]);

  if (isLoading && !searchQuery) {
    return <ProjectListSkeleton />;
  }

  if (!currentQuestId) {
    return (
      <View style={sharedStyles.container}>
        <Text style={sharedStyles.title}>{t('noQuestSelected')}</Text>
      </View>
    );
  }

  // Update ref whenever VAD functions change
  React.useEffect(() => {
    vadFunctionsRef.current = {
      startListening: vadStartListening,
      stopListening: vadStopListening,
      resetVAD: vadReset
    };
  }, [vadStartListening, vadStopListening, vadReset]);

  // Handle entering rabbit mode
  const handleEnterRabbitMode = React.useCallback(() => {
    console.log('=== ENTERING RABBIT MODE ===');
    console.log('Total assets available:', assets.length);
    console.log('Current quest ID:', currentQuestId);

    if (!currentQuestId || assets.length === 0) {
      console.warn('⚠️ Cannot enter rabbit mode without quest or assets');
      return;
    }

    // Check for existing session first
    let sessionId = useLocalStore
      .getState()
      .getActiveRabbitModeSession(currentQuestId)?.id;

    if (!sessionId) {
      // Create new session with all available assets
      const assetIds = assets.map((a) => a.id);
      const assetNames = new Map(assets.map((a) => [a.id, a.name]));

      sessionId = useLocalStore.getState().createRabbitModeSession(
        currentQuestId,
        'Quest Recording Session', // TODO: Get actual quest name
        'project-id', // TODO: Get actual project ID
        assetIds
      );

      // Update session with actual asset names
      const session = useLocalStore.getState().getRabbitModeSession(sessionId);
      if (session) {
        // Update the session assets with real names
        session.assets.forEach((asset) => {
          asset.name = assetNames.get(asset.id) || asset.name;
        });
      }

      console.log(`✅ Created new rabbit mode session: ${sessionId}`);
    } else {
      console.log(`✅ Resuming existing rabbit mode session: ${sessionId}`);
    }

    setCurrentSessionId(sessionId);
    setIsRabbitMode(true);

    // Load session state for UI
    const session = useLocalStore.getState().getRabbitModeSession(sessionId);
    if (session) {
      console.log(`📋 Session has ${session.assets.length} assets`);
      console.log(
        `🔓 Unlocked assets: ${session.assets.filter((a) => !a.isLocked).length}`
      );
      console.log(
        `🔒 Locked assets: ${session.assets.filter((a) => a.isLocked).length}`
      );

      // Set current asset to first unlocked asset or first asset
      const currentAsset =
        session.assets.find((a) => !a.isLocked) || session.assets[0];
      if (currentAsset) {
        useLocalStore.getState().setCurrentAsset(sessionId, currentAsset.id);
        console.log(`👉 Set current asset to: ${currentAsset.name}`);
      }
    }

    // Start VAD after a short delay
    setTimeout(() => {
      console.log('▶️ Starting VAD listening...');
      if (vadFunctionsRef.current?.startListening) {
        void vadFunctionsRef.current.startListening();
      }
    }, 500);
  }, [currentQuestId, assets, vadFunctionsRef]);

  // Handle exiting rabbit mode
  const handleExitRabbitMode = React.useCallback(() => {
    if (vadFunctionsRef.current?.stopListening) {
      void vadFunctionsRef.current.stopListening();
    }
    setIsRabbitMode(false);
    setCurrentSessionId(null);
    setRabbitState({
      isRecording: false,
      currentAssetIndex: 0,
      pulledAssets: [],
      isHoldingCard: false,
      recordingStartTime: null,
      recordingSegments: [], // Clear recording segments on exit
      audioRecording: null // Clear audio recording on exit
    });
  }, [vadFunctionsRef]);

  // Render Rabbit Mode Interface
  if (isRabbitMode) {
    const unpulledAssets = assetsWithTranslations.filter(
      (asset) =>
        !rabbitState.pulledAssets.find((pulled) => pulled.id === asset.id)
    );
    const currentAsset =
      rabbitState.pulledAssets[rabbitState.currentAssetIndex];
    const nextAsset = unpulledAssets[0];

    // Get current session and its segments for display
    const currentSession = currentSessionId
      ? useLocalStore.getState().getRabbitModeSession(currentSessionId)
      : null;
    const currentSessionAsset = currentSession?.assets.find(
      (a) => a.id === currentSession.currentAssetId
    );
    const currentSegments = currentSessionAsset?.segments || [];

    return (
      <View style={styles.rabbitModeContainer}>
        {/* Rabbit Mode Header */}
        <View style={styles.rabbitHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleExitRabbitMode}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.rabbitHeaderContent}>
            <Text style={styles.rabbitTitle}>🐰 Rabbit Mode</Text>
            <Text style={styles.rabbitSubtitle}>{t('assets')}</Text>
          </View>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowFlaggingModal(true)}
          >
            <Ionicons name="flag" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* VAD Status Bar - Visual Feedback */}
        <View style={styles.vadStatusBar}>
          <View style={styles.vadStatusContent}>
            <View style={styles.vadStatusLeft}>
              <View
                style={[
                  styles.statusIndicator,
                  {
                    backgroundColor: !isListening
                      ? colors.textSecondary
                      : rabbitState.isRecording
                        ? colors.success
                        : colors.primary
                  }
                ]}
              />
              <Text style={styles.vadStatusText}>
                {!isListening
                  ? '🔄 Getting ready...'
                  : rabbitState.isRecording
                    ? '🎙️ Recording...'
                    : '👂 Listening...'}
              </Text>
            </View>
            <MiniWaveform
              isListening={isListening}
              isRecording={rabbitState.isRecording}
              level={currentLevel}
            />
          </View>
        </View>

        {/* Scrollable Content Area */}
        <ScrollView
          style={styles.rabbitScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Current Asset Section */}
          {currentSessionAsset && (
            <View style={styles.currentAssetSection}>
              <Text style={styles.sectionTitle}>Current Asset</Text>
              <View style={styles.currentAssetCard}>
                <Text style={styles.assetName}>{currentSessionAsset.name}</Text>
                <View style={styles.assetStatus}>
                  <Ionicons
                    name={
                      currentSegments.length > 0
                        ? 'checkmark-circle'
                        : 'radio-button-off'
                    }
                    size={16}
                    color={
                      currentSegments.length > 0
                        ? colors.success
                        : colors.textSecondary
                    }
                  />
                  <Text style={styles.assetStatusText}>
                    {currentSegments.length} segment
                    {currentSegments.length !== 1 ? 's' : ''}
                  </Text>
                </View>
              </View>

              {/* Recording Segments List */}
              <View style={styles.recordingSegmentsList}>
                {currentSegments.length > 0 ? (
                  currentSegments.map((segment, index) => (
                    <RecordingSegmentItem
                      key={segment.id}
                      segment={{
                        id: segment.id,
                        assetId: segment.assetId,
                        startTime: segment.startTime,
                        endTime: segment.endTime,
                        duration: segment.duration,
                        audioUri: segment.audioUri,
                        waveformData: segment.waveformData
                      }}
                      onDelete={handleDeleteSegment}
                      onReorder={handleReorderSegment}
                      canMoveUp={index > 0}
                      canMoveDown={index < currentSegments.length - 1}
                    />
                  ))
                ) : (
                  <Text style={styles.noSegmentsText}>
                    No recordings yet - start speaking!
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Spacer to push bottom content down */}
          <View style={styles.spacer} />
        </ScrollView>

        {/* Bottom Fixed Content */}
        <View style={styles.bottomFixedContent}>
          {/* Next Asset Section */}
          {nextAsset && (
            <TouchableOpacity
              style={styles.nextAssetSection}
              onPress={handlePullNextAsset}
            >
              <Text style={styles.sectionTitle}>Next Asset</Text>
              <View style={styles.nextAssetCard}>
                <Text style={styles.assetName}>{nextAsset.name}</Text>
                <Ionicons name="arrow-up" size={20} color={colors.primary} />
              </View>
            </TouchableOpacity>
          )}

          {/* Asset Stack (Bottom) - Only show if no current asset or if there are more after next */}
          {(!currentAsset || unpulledAssets.length > 1) && (
            <View style={styles.assetStackContainer}>
              <Text style={styles.stackTitle}>
                Remaining Assets ({unpulledAssets.length - (nextAsset ? 1 : 0)}{' '}
                remaining)
              </Text>
              <ScrollView
                horizontal
                style={styles.assetStack}
                showsHorizontalScrollIndicator={false}
              >
                {unpulledAssets
                  .slice(nextAsset ? 1 : 0, 10)
                  .map((asset, index) => (
                    <AssetCard
                      key={asset.id}
                      asset={asset}
                      index={index}
                      totalCards={Math.min(unpulledAssets.length, 10)}
                      onPull={() => handlePullAsset(asset)}
                      isPulled={false}
                      isActive={false}
                    />
                  ))}
                {unpulledAssets.length <= 1 && (
                  <View style={styles.emptyStackContainer}>
                    <Text style={styles.emptyStackText}>All assets ready!</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          )}

          {/* Pull Next Asset Button - Show if no current asset */}
          {!currentAsset && nextAsset && (
            <TouchableOpacity
              style={styles.pullNextButton}
              onPress={handlePullNextAsset}
            >
              <Text style={styles.pullNextButtonText}>
                Start with {nextAsset.name}
              </Text>
              <Ionicons name="arrow-up" size={20} color={colors.background} />
            </TouchableOpacity>
          )}
        </View>

        {/* User Flagging Modal */}
        <UserFlaggingModal
          visible={showFlaggingModal}
          onClose={() => setShowFlaggingModal(false)}
          onSubmit={handleFlagSubmit}
        />
      </View>
    );
  }

  // Render Normal Mode Interface
  return (
    <View style={sharedStyles.container}>
      <View style={styles.headerContainer}>
        <Text style={sharedStyles.title}>{t('assets')}</Text>

        {/* Rabbit Mode Toggle */}
        <RabbitModeSwitch
          value={isRabbitMode}
          onToggle={() => {
            if (isRabbitMode) {
              handleExitRabbitMode();
            } else {
              handleEnterRabbitMode();
            }
          }}
          disabled={assets.length === 0}
        />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder={t('searchAssets')}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={colors.textSecondary}
        />
        <View style={styles.searchIconContainer}>
          <Ionicons name="search" size={20} color={colors.textSecondary} />
        </View>
        {/* Show loading indicator in search bar when searching */}
        {isFetching && searchQuery && (
          <View style={styles.searchLoadingContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        )}
      </View>

      {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */}
      {SHOW_DEV_ELEMENTS && (
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: fontSizes.small,
            marginBottom: spacing.small
          }}
        >
          {statusText}
        </Text>
      )}

      {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */}
      {SHOW_DEV_ELEMENTS &&
        !isAttachmentStatesLoading &&
        attachmentStates.size > 0 && (
          <View style={styles.attachmentSummary}>
            <Text style={styles.attachmentSummaryTitle}>
              📎 {t('liveAttachmentStates')}:
            </Text>
            <Text style={styles.attachmentSummaryText}>
              {attachmentSummaryText}
            </Text>
          </View>
        )}

      {/* Show skeleton only on initial load, not during search */}
      {isLoading && searchQuery ? (
        <View style={styles.searchingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.searchingText}>{t('searching')}</Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <FlashList
            data={assets}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            estimatedItemSize={80}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContainer}
            onEndReached={onEndReached}
            onEndReachedThreshold={0.5}
            ListFooterComponent={renderFooter}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {searchQuery ? 'No assets found' : 'No assets available'}
                </Text>
              </View>
            }
          />
        </View>
      )}
    </View>
  );
}

export const styles = StyleSheet.create({
  listContainer: {
    paddingVertical: spacing.small
  },
  listItem: {
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    padding: spacing.medium,
    marginBottom: spacing.small,
    gap: spacing.xsmall
  },
  assetName: {
    color: colors.text,
    fontSize: fontSizes.large,
    fontWeight: 'bold'
  },
  assetInfo: {
    color: colors.textSecondary,
    fontSize: fontSizes.small
  },
  attachmentSummary: {
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    padding: spacing.small,
    marginTop: spacing.small,
    marginBottom: spacing.small
  },
  attachmentSummaryTitle: {
    fontSize: fontSizes.medium,
    fontWeight: 'bold',
    marginBottom: spacing.xsmall
  },
  attachmentSummaryText: {
    fontSize: fontSizes.small,
    color: colors.textSecondary
  },
  loadingFooter: {
    paddingVertical: spacing.medium,
    alignItems: 'center'
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.medium,
    position: 'relative'
  },
  searchInput: {
    flex: 1,
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
    paddingLeft: 40, // Make room for search icon
    color: colors.text,
    fontSize: fontSizes.medium
  },
  searchIconContainer: {
    position: 'absolute',
    left: spacing.small,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 30
  },
  searchLoadingContainer: {
    position: 'absolute',
    right: spacing.small,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 30
  },
  searchingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: spacing.xlarge
  },
  searchingText: {
    marginTop: spacing.medium,
    color: colors.textSecondary,
    fontSize: fontSizes.medium
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xlarge
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: fontSizes.medium
  },
  // New styles for Rabbit Mode
  rabbitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
    backgroundColor: colors.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.inputBorder
  },
  backButton: {
    padding: spacing.small
  },
  rabbitHeaderContent: {
    flex: 1,
    alignItems: 'center'
  },
  rabbitTitle: {
    fontSize: fontSizes.large,
    fontWeight: 'bold',
    color: colors.text
  },
  rabbitSubtitle: {
    fontSize: fontSizes.small,
    color: colors.textSecondary
  },
  headerButton: {
    padding: spacing.small
  },
  vadStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    marginBottom: spacing.small
  },
  vadText: {
    fontSize: fontSizes.small,
    color: colors.textSecondary
  },
  miniWaveform: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 20,
    width: 100,
    backgroundColor: colors.inputBackground,
    borderRadius: 10,
    padding: 2
  },
  miniWaveformBar: {
    width: 4,
    borderRadius: 2
  },
  pulledAssetsContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.medium,
    marginBottom: spacing.small
  },
  timelineAsset: {
    backgroundColor: colors.inputBackground,
    borderRadius: 10,
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.xsmall,
    marginRight: spacing.small,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100
  },
  activeTimelineAsset: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
    borderWidth: 1
  },
  timelineAssetName: {
    fontSize: fontSizes.small,
    color: colors.textSecondary,
    textAlign: 'center'
  },
  emptyTimelineText: {
    fontSize: fontSizes.small,
    color: colors.textSecondary,
    paddingHorizontal: spacing.medium
  },
  centralArea: {
    paddingHorizontal: spacing.medium,
    marginBottom: spacing.small
  },
  instructionText: {
    fontSize: fontSizes.medium,
    color: colors.textSecondary,
    marginBottom: spacing.small
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    padding: spacing.small
  },
  progressText: {
    fontSize: fontSizes.small,
    color: colors.textSecondary,
    marginRight: spacing.small
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: colors.inputBorder,
    borderRadius: 4
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: colors.primary
  },
  assetStackContainer: {
    paddingHorizontal: spacing.medium,
    marginBottom: spacing.small
  },
  stackTitle: {
    fontSize: fontSizes.medium,
    fontWeight: 'bold',
    marginBottom: spacing.xsmall,
    color: colors.text
  },
  assetStack: {
    flexDirection: 'row'
  },
  assetCard: {
    backgroundColor: colors.inputBackground,
    borderRadius: 10,
    padding: spacing.medium,
    marginRight: spacing.small,
    width: 200,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.inputBorder
  },
  activeAssetCard: {
    borderColor: colors.primary,
    borderWidth: 2
  },
  assetCardContent: {
    alignItems: 'center'
  },
  assetStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xsmall
  },
  assetStatusText: {
    fontSize: fontSizes.small,
    color: colors.textSecondary,
    marginLeft: spacing.xsmall
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  },
  modalContainer: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: spacing.large,
    width: '80%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: spacing.medium
  },
  modalTitle: {
    fontSize: fontSizes.large,
    fontWeight: 'bold',
    color: colors.text
  },
  modalCloseButton: {
    padding: spacing.small
  },
  modalSectionTitle: {
    fontSize: fontSizes.medium,
    fontWeight: 'bold',
    marginBottom: spacing.small,
    color: colors.text
  },
  flagTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginBottom: spacing.medium
  },
  flagTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.medium,
    borderRadius: 8,
    marginVertical: spacing.xsmall,
    marginHorizontal: spacing.xsmall,
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.inputBorder
  },
  selectedFlagType: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
    borderWidth: 1
  },
  flagTypeText: {
    fontSize: fontSizes.small,
    marginLeft: spacing.xsmall,
    color: colors.textSecondary
  },
  selectedFlagTypeText: {
    color: colors.primary
  },
  flagDescriptionInput: {
    width: '100%',
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    padding: spacing.medium,
    color: colors.text,
    fontSize: fontSizes.medium,
    textAlignVertical: 'top',
    minHeight: 100,
    marginBottom: spacing.medium
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%'
  },
  modalButton: {
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.medium,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary
  },
  modalCancelButton: {
    backgroundColor: colors.inputBackground,
    borderColor: colors.inputBorder
  },
  modalCancelButtonText: {
    color: colors.textSecondary,
    fontSize: fontSizes.medium
  },
  modalSubmitButton: {
    backgroundColor: colors.primary
  },
  modalSubmitButtonText: {
    color: colors.background,
    fontSize: fontSizes.medium,
    fontWeight: 'bold'
  },
  emptyStackContainer: {
    width: 200,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.medium,
    backgroundColor: colors.inputBackground,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.inputBorder
  },
  emptyStackText: {
    fontSize: fontSizes.small,
    color: colors.textSecondary
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.medium,
    paddingHorizontal: spacing.medium
  },
  rabbitModeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: 20,
    paddingVertical: spacing.xsmall,
    paddingHorizontal: spacing.small
  },
  rabbitModeToggleText: {
    marginLeft: spacing.xsmall,
    fontSize: fontSizes.small,
    fontWeight: 'bold',
    color: colors.primary
  },
  // New styles for Recording Segment
  recordingSegment: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    marginBottom: spacing.xsmall,
    padding: spacing.small,
    borderWidth: 1,
    borderColor: colors.inputBorder
  },
  segmentWaveform: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 20,
    width: 100,
    backgroundColor: colors.inputBackground,
    borderRadius: 10,
    padding: 2,
    marginRight: spacing.small
  },
  waveformBar: {
    width: 4,
    borderRadius: 2
  },
  segmentControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: 100
  },
  segmentButton: {
    padding: spacing.xsmall
  },
  segmentButtonDisabled: {
    opacity: 0.5
  },
  segmentDeleteButton: {
    padding: spacing.xsmall
  },
  // New styles for Rabbit Mode specific sections
  currentAssetSection: {
    paddingHorizontal: spacing.medium,
    marginBottom: spacing.small
  },
  sectionTitle: {
    fontSize: fontSizes.medium,
    fontWeight: 'bold',
    marginBottom: spacing.xsmall,
    color: colors.text
  },
  currentAssetCard: {
    backgroundColor: colors.inputBackground,
    borderRadius: 10,
    padding: spacing.medium,
    marginBottom: spacing.small,
    borderWidth: 1,
    borderColor: colors.inputBorder
  },
  nextAssetSection: {
    paddingHorizontal: spacing.medium,
    marginBottom: spacing.small
  },
  nextAssetCard: {
    backgroundColor: colors.inputBackground,
    borderRadius: 10,
    padding: spacing.medium,
    marginBottom: spacing.small,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  pullNextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: spacing.small,
    paddingHorizontal: spacing.medium,
    marginTop: spacing.small,
    marginBottom: spacing.small
  },
  pullNextButtonText: {
    color: colors.background,
    fontSize: fontSizes.medium,
    fontWeight: 'bold',
    marginRight: spacing.xsmall
  },
  recordingSegmentsList: {
    marginTop: spacing.small
  },
  noSegmentsText: {
    color: colors.textSecondary,
    fontSize: fontSizes.small,
    textAlign: 'center',
    paddingVertical: spacing.medium,
    fontStyle: 'italic'
  },
  rabbitModeContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column'
  },
  rabbitScrollContent: {
    flex: 1
  },
  bottomFixedContent: {
    paddingHorizontal: spacing.medium,
    paddingBottom: spacing.medium,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.inputBorder
  },
  spacer: {
    height: 100 // Adjust as needed to push content to the top
  },
  // Rabbit Mode Switch styles
  rabbitModeSwitchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: 20,
    paddingVertical: spacing.xsmall,
    paddingHorizontal: spacing.small,
    width: 120
  },
  rabbitModeSwitchContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1
  },
  rabbitModeSwitchInfo: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  rabbitModeSwitchIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.small,
    gap: spacing.xsmall
  },
  rabbitModeSwitchTitle: {
    fontSize: fontSizes.medium,
    fontWeight: '600',
    color: colors.text
  },
  // New styles for VAD Status Bar
  vadStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    marginBottom: spacing.small,
    marginTop: spacing.small // Add some space above the current asset section
  },
  vadStatusContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1
  },
  vadStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xsmall
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5
  },
  vadStatusText: {
    fontSize: fontSizes.small,
    color: colors.textSecondary
  }
});
