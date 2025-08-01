import type { RabbitModeSegment } from '@/store/localStore';
import { useLocalStore } from '@/store/localStore';
import { colors, fontSizes, spacing } from '@/styles/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { PlayableWaveform } from './PlayableWaveform';

interface RabbitModeUIProps {
  sessionId: string;
  isListening: boolean;
  isSpeaking: boolean;
  currentLevel: number; // Keep for now in case we want to add it back later
  onStartListening: () => void;
  onStopListening: () => void;
  onDeleteSegment: (segmentId: string) => void;
  onReorderSegment: (segmentId: string, direction: 'up' | 'down') => void;
  onExitRabbitMode: () => void;
  onShowFlagModal: () => void;
}

export const RabbitModeUI: React.FC<RabbitModeUIProps> = ({
  sessionId,
  isListening,
  isSpeaking,
  currentLevel: _currentLevel,
  onStartListening,
  onStopListening,
  onDeleteSegment,
  onReorderSegment,
  onExitRabbitMode,
  onShowFlagModal
}) => {
  const [playingSegmentId, setPlayingSegmentId] = React.useState<string | null>(
    null
  );

  // Get session data from local store
  const session = useLocalStore.getState().getRabbitModeSession(sessionId);
  if (!session) return null;

  const currentAsset = session.assets.find(
    (a) => a.id === session.currentAssetId
  );
  const currentAssetIndex = session.assets.findIndex(
    (a) => a.id === session.currentAssetId
  );
  const previousAsset =
    currentAssetIndex > 0 ? session.assets[currentAssetIndex - 1] : null;
  const nextAsset =
    currentAssetIndex < session.assets.length - 1
      ? session.assets[currentAssetIndex + 1]
      : null;

  const handleNavigateAsset = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && previousAsset) {
      useLocalStore.getState().setCurrentAsset(sessionId, previousAsset.id);
    } else if (direction === 'next' && nextAsset) {
      useLocalStore.getState().setCurrentAsset(sessionId, nextAsset.id);
    }
  };

  const handleLockAsset = () => {
    if (currentAsset) {
      if (currentAsset.isLocked) {
        useLocalStore.getState().unlockAsset(sessionId, currentAsset.id);
      } else {
        useLocalStore.getState().lockAsset(sessionId, currentAsset.id);
      }
    }
  };

  const renderSegmentItem = (
    segment: RabbitModeSegment,
    index: number,
    total: number
  ) => {
    const canMoveUp = index > 0;
    const canMoveDown = index < total - 1;
    const isPlaying = playingSegmentId === segment.id;

    return (
      <View key={segment.id} style={styles.segmentItem}>
        <View style={styles.segmentNumber}>
          <Text style={styles.segmentNumberText}>#{index + 1}</Text>
        </View>

        <View style={styles.segmentContent}>
          <PlayableWaveform
            audioUri={segment.audioUri}
            waveformData={segment.waveformData}
            duration={segment.duration}
            isPlaying={isPlaying}
            onPlay={() => setPlayingSegmentId(segment.id)}
            onPause={() => setPlayingSegmentId(null)}
            onStop={() => setPlayingSegmentId(null)}
            style={styles.segmentWaveform}
          />
        </View>

        <View style={styles.segmentActions}>
          <TouchableOpacity
            style={[styles.segmentButton, !canMoveUp && styles.buttonDisabled]}
            onPress={() => canMoveUp && onReorderSegment(segment.id, 'up')}
            disabled={!canMoveUp}
          >
            <Ionicons
              name="chevron-up"
              size={16}
              color={canMoveUp ? colors.text : colors.disabled}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.segmentButton,
              !canMoveDown && styles.buttonDisabled
            ]}
            onPress={() => canMoveDown && onReorderSegment(segment.id, 'down')}
            disabled={!canMoveDown}
          >
            <Ionicons
              name="chevron-down"
              size={16}
              color={canMoveDown ? colors.text : colors.disabled}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.segmentButton}
            onPress={() => onDeleteSegment(segment.id)}
          >
            <Ionicons name="trash" size={16} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onExitRabbitMode}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerContent}>
          <Text style={styles.title}>🐰 Rabbit Mode</Text>
          <Text style={styles.subtitle}>
            Asset {currentAssetIndex + 1} of {session.assets.length}
          </Text>
        </View>

        <TouchableOpacity style={styles.flagButton} onPress={onShowFlagModal}>
          <Ionicons name="flag" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Current Asset Card */}
      {currentAsset && (
        <View style={styles.currentAssetCard}>
          <View style={styles.assetHeader}>
            <View style={styles.assetInfo}>
              <Text style={styles.assetName}>{currentAsset.name}</Text>
              <View style={styles.assetStatus}>
                <Ionicons
                  name={
                    currentAsset.segments.length > 0
                      ? 'checkmark-circle'
                      : 'radio-button-off'
                  }
                  size={16}
                  color={
                    currentAsset.segments.length > 0
                      ? colors.success
                      : colors.textSecondary
                  }
                />
                <Text style={styles.assetStatusText}>
                  {currentAsset.segments.length} segment
                  {currentAsset.segments.length !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.lockButton,
                currentAsset.isLocked && styles.lockedButton
              ]}
              onPress={handleLockAsset}
            >
              <Ionicons
                name={currentAsset.isLocked ? 'lock-closed' : 'lock-open'}
                size={20}
                color={
                  currentAsset.isLocked ? colors.success : colors.textSecondary
                }
              />
            </TouchableOpacity>
          </View>

          {/* Asset Navigation */}
          <View style={styles.assetNavigation}>
            <TouchableOpacity
              style={[
                styles.navButton,
                !previousAsset && styles.buttonDisabled
              ]}
              onPress={() => handleNavigateAsset('prev')}
              disabled={!previousAsset}
            >
              <Ionicons
                name="chevron-back"
                size={20}
                color={previousAsset ? colors.primary : colors.disabled}
              />
              <Text
                style={[
                  styles.navButtonText,
                  !previousAsset && styles.disabledText
                ]}
              >
                {previousAsset ? previousAsset.name : 'Start'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.navButton, !nextAsset && styles.buttonDisabled]}
              onPress={() => handleNavigateAsset('next')}
              disabled={!nextAsset}
            >
              <Text
                style={[
                  styles.navButtonText,
                  !nextAsset && styles.disabledText
                ]}
              >
                {nextAsset ? nextAsset.name : 'End'}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={nextAsset ? colors.primary : colors.disabled}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Scrollable Segments List */}
      <ScrollView
        style={styles.segmentsList}
        contentContainerStyle={styles.segmentsContent}
        showsVerticalScrollIndicator={false}
      >
        {currentAsset?.segments.length === 0 ? (
          <View style={styles.emptySegments}>
            <Ionicons
              name="mic-outline"
              size={48}
              color={colors.textSecondary}
            />
            <Text style={styles.emptyText}>No recordings yet</Text>
            <Text style={styles.emptySubtext}>
              Tap the record button below to start
            </Text>
          </View>
        ) : (
          currentAsset?.segments.map((segment, index) =>
            renderSegmentItem(segment, index, currentAsset.segments.length)
          )
        )}
      </ScrollView>

      {/* Record Button */}
      <View style={styles.recordSection}>
        <TouchableOpacity
          style={[
            styles.recordButton,
            isListening && styles.recordButtonListening,
            isSpeaking && styles.recordButtonRecording
          ]}
          onPress={() => {
            console.log('🔘 Button pressed:', { isListening, isSpeaking });
            if (isListening) {
              console.log('🛑 Stopping listening...');
              onStopListening();
            } else {
              console.log('▶️ Starting listening...');
              onStartListening();
            }
          }}
        >
          <View style={styles.recordButtonInner}>
            <Ionicons
              name={
                isSpeaking ? 'stop-circle' : isListening ? 'mic' : 'mic-outline'
              }
              size={48}
              color={
                isSpeaking
                  ? colors.error
                  : isListening
                    ? colors.success
                    : colors.primary
              }
            />
          </View>
          <Text style={styles.recordButtonText}>
            {isSpeaking
              ? 'Recording...'
              : isListening
                ? 'Tap to Stop'
                : 'Tap to Record'}
          </Text>
        </TouchableOpacity>

        {/* Debug info */}
        <Text style={styles.debugText}>
          State: {isSpeaking ? 'Recording' : isListening ? 'Listening' : 'Idle'}
        </Text>
      </View>

      {/* Next Asset Preview */}
      {nextAsset && (
        <TouchableOpacity
          style={styles.nextAssetCard}
          onPress={() => handleNavigateAsset('next')}
        >
          <View style={styles.nextAssetContent}>
            <Text style={styles.nextAssetLabel}>Next Asset</Text>
            <Text style={styles.nextAssetName}>{nextAsset.name}</Text>
          </View>
          <Ionicons name="arrow-forward" size={20} color={colors.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
    backgroundColor: colors.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.inputBorder
  },
  backButton: {
    padding: spacing.small
  },
  headerContent: {
    flex: 1,
    alignItems: 'center'
  },
  title: {
    fontSize: fontSizes.large,
    fontWeight: 'bold',
    color: colors.text
  },
  subtitle: {
    fontSize: fontSizes.small,
    color: colors.textSecondary
  },
  flagButton: {
    padding: spacing.small
  },
  currentAssetCard: {
    backgroundColor: colors.primaryLight,
    marginHorizontal: spacing.medium,
    marginTop: spacing.medium,
    borderRadius: 10,
    padding: spacing.medium,
    borderWidth: 2,
    borderColor: colors.primary
  },
  assetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.small
  },
  assetInfo: {
    flex: 1
  },
  assetName: {
    fontSize: fontSizes.large,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xsmall
  },
  assetStatus: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  assetStatusText: {
    fontSize: fontSizes.small,
    color: colors.textSecondary,
    marginLeft: spacing.xsmall
  },
  lockButton: {
    padding: spacing.small,
    borderRadius: 8,
    backgroundColor: colors.inputBackground
  },
  lockedButton: {
    backgroundColor: colors.success + '20' // Add transparency
  },
  assetNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.small
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xsmall,
    paddingHorizontal: spacing.small,
    borderRadius: 6,
    backgroundColor: colors.inputBackground
  },
  navButtonText: {
    fontSize: fontSizes.small,
    color: colors.primary,
    marginHorizontal: spacing.xsmall
  },
  buttonDisabled: {
    opacity: 0.5
  },
  disabledText: {
    color: colors.disabled
  },
  segmentsList: {
    flex: 1,
    marginHorizontal: spacing.medium,
    marginTop: spacing.medium
  },
  segmentsContent: {
    paddingBottom: spacing.medium
  },
  emptySegments: {
    alignItems: 'center',
    paddingVertical: spacing.xlarge
  },
  emptyText: {
    fontSize: fontSizes.medium,
    color: colors.textSecondary,
    marginTop: spacing.medium
  },
  emptySubtext: {
    fontSize: fontSizes.small,
    color: colors.textSecondary,
    marginTop: spacing.xsmall
  },
  segmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    marginBottom: spacing.small,
    padding: spacing.small,
    borderWidth: 1,
    borderColor: colors.inputBorder
  },
  segmentNumber: {
    backgroundColor: colors.primaryLight,
    borderRadius: 6,
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.xsmall,
    marginRight: spacing.small
  },
  segmentNumberText: {
    fontSize: fontSizes.small,
    fontWeight: '600',
    color: colors.primary
  },
  segmentContent: {
    flex: 1
  },
  segmentWaveform: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: 0
  },
  segmentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.small
  },
  segmentButton: {
    padding: spacing.xsmall,
    marginLeft: spacing.xsmall
  },
  recordSection: {
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.medium,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.inputBorder
  },
  nextAssetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.medium,
    marginBottom: spacing.medium,
    padding: spacing.medium,
    backgroundColor: colors.inputBackground,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.inputBorder
  },
  nextAssetContent: {
    flex: 1
  },
  nextAssetLabel: {
    fontSize: fontSizes.small,
    color: colors.textSecondary,
    marginBottom: spacing.xsmall
  },
  nextAssetName: {
    fontSize: fontSizes.medium,
    fontWeight: '600',
    color: colors.text
  },
  recordButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: 20,
    paddingVertical: spacing.large,
    paddingHorizontal: spacing.xlarge,
    borderWidth: 2,
    borderColor: colors.primary
  },
  recordButtonListening: {
    backgroundColor: colors.success + '20',
    borderColor: colors.success
  },
  recordButtonRecording: {
    backgroundColor: colors.error + '20',
    borderColor: colors.error
  },
  recordButtonInner: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.small
  },
  recordButtonText: {
    fontSize: fontSizes.medium,
    fontWeight: '600',
    color: colors.text
  },
  debugText: {
    fontSize: fontSizes.small,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.small
  }
});
