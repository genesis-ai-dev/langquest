import { colors, fontSizes, spacing } from '@/styles/theme';
import { profiler } from '@/utils/profiler';
import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

interface DiagnosticData {
  summary: {
    totalBlockingEvents: number;
    totalBlockingTime: number;
    averageBlockingTime: number;
    memoryUsage: number;
  };
  recentActivity: {
    effects: any[];
    stateUpdates: any[];
    activeQueries: string[];
  };
  worstBlockingEvents: any[];
}

export function PerformanceDiagnostics() {
  const [isVisible, setIsVisible] = useState(false);
  const [data, setData] = useState<DiagnosticData | null>(null);

  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      const diagnosticData = profiler.getDiagnosticReport();
      if (diagnosticData) {
        setData(diagnosticData);
      }
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, [isVisible]);

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(1)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getColorForTime = (ms: number) => {
    if (ms < 16) return colors.success;
    if (ms < 100) return colors.accent;
    return colors.alert;
  };

  if (!isVisible) {
    return (
      <TouchableOpacity
        style={styles.toggleButton}
        onPress={() => setIsVisible(true)}
      >
        <Text style={styles.toggleButtonText}>📊</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.overlay}>
      <View style={styles.header}>
        <Text style={styles.title}>Performance Diagnostics</Text>
        <TouchableOpacity onPress={() => setIsVisible(false)}>
          <Text style={styles.closeButton}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {data ? (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Summary</Text>
              <Text style={styles.stat}>
                Total Blocking:{' '}
                <Text style={{ color: colors.alert }}>
                  {formatTime(data.summary.totalBlockingTime)}
                </Text>
              </Text>
              <Text style={styles.stat}>
                Blocking Events:{' '}
                <Text style={{ color: colors.alert }}>
                  {data.summary.totalBlockingEvents}
                </Text>
              </Text>
              <Text style={styles.stat}>
                Average Block:{' '}
                <Text
                  style={{
                    color: getColorForTime(data.summary.averageBlockingTime)
                  }}
                >
                  {formatTime(data.summary.averageBlockingTime)}
                </Text>
              </Text>
              <Text style={styles.stat}>
                Memory:{' '}
                <Text
                  style={{
                    color:
                      data.summary.memoryUsage > 100
                        ? colors.accent
                        : colors.text
                  }}
                >
                  {data.summary.memoryUsage.toFixed(1)}MB
                </Text>
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recent Activity (5s)</Text>
              <Text style={styles.stat}>
                Effects:{' '}
                <Text style={{ color: colors.primary }}>
                  {data.recentActivity.effects.length}
                </Text>
              </Text>
              <Text style={styles.stat}>
                State Updates:{' '}
                <Text style={{ color: colors.primary }}>
                  {data.recentActivity.stateUpdates.length}
                </Text>
              </Text>
              <Text style={styles.stat}>
                Active Queries:{' '}
                <Text style={{ color: colors.primary }}>
                  {data.recentActivity.activeQueries.length}
                </Text>
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Worst Blocking Events</Text>
              {data.worstBlockingEvents.slice(0, 3).map((event, index) => (
                <View key={index} style={styles.blockingEvent}>
                  <Text
                    style={[
                      styles.blockingTime,
                      { color: getColorForTime(event.duration) }
                    ]}
                  >
                    {formatTime(event.duration)}
                  </Text>
                  {event.recentStateUpdates.length > 0 && (
                    <Text style={styles.blockingDetail}>
                      States: {event.recentStateUpdates.join(', ')}
                    </Text>
                  )}
                  {event.recentEffects.length > 0 && (
                    <Text style={styles.blockingDetail}>
                      Effects: {event.recentEffects.join(', ')}
                    </Text>
                  )}
                  {event.activeQueries.length > 0 && (
                    <Text style={styles.blockingDetail}>
                      Queries: {event.activeQueries.length} active
                    </Text>
                  )}
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={styles.resetButton}
              onPress={() => profiler.reset()}
            >
              <Text style={styles.resetButtonText}>Reset Profiler</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={styles.loading}>Loading diagnostics...</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  toggleButton: {
    position: 'absolute',
    top: 100,
    right: 20,
    width: 40,
    height: 40,
    backgroundColor: colors.primary,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999
  },
  toggleButtonText: {
    fontSize: 16
  },
  overlay: {
    position: 'absolute',
    top: 50,
    right: 10,
    width: 300,
    maxHeight: 500,
    backgroundColor: colors.inputBackground,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.textSecondary,
    zIndex: 9998
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.small,
    borderBottomWidth: 1,
    borderBottomColor: colors.textSecondary
  },
  title: {
    fontSize: fontSizes.medium,
    fontWeight: 'bold',
    color: colors.text
  },
  closeButton: {
    fontSize: fontSizes.large,
    color: colors.text,
    padding: spacing.tiny
  },
  content: {
    padding: spacing.small
  },
  section: {
    marginBottom: spacing.medium
  },
  sectionTitle: {
    fontSize: fontSizes.small,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.tiny,
    textTransform: 'uppercase'
  },
  stat: {
    fontSize: fontSizes.small,
    color: colors.textSecondary,
    marginBottom: 2
  },
  blockingEvent: {
    backgroundColor: colors.background,
    padding: spacing.tiny,
    borderRadius: 4,
    marginBottom: spacing.tiny
  },
  blockingTime: {
    fontSize: fontSizes.small,
    fontWeight: 'bold'
  },
  blockingDetail: {
    fontSize: fontSizes.tiny,
    color: colors.textSecondary,
    marginTop: 2
  },
  resetButton: {
    backgroundColor: colors.primary,
    padding: spacing.small,
    borderRadius: 4,
    alignItems: 'center',
    marginTop: spacing.small
  },
  resetButtonText: {
    color: colors.background,
    fontSize: fontSizes.small,
    fontWeight: 'bold'
  },
  loading: {
    fontSize: fontSizes.small,
    color: colors.textSecondary,
    textAlign: 'center',
    padding: spacing.medium
  }
});
