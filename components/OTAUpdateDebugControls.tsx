/**
 * Debug controls for testing OTA Update UI
 * Only visible in development mode
 * 
 * Provides controls to:
 * - Toggle error simulation
 * - Switch to next update version
 * - Reset dismissal state
 * - View current state
 */

import { useExpoUpdatesMock } from '@/hooks/useExpoUpdates.mock';
import { useLocalStore } from '@/store/localStore';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export function OTAUpdateDebugControls() {
  // Only show in development
  if (!__DEV__) {
    return null;
  }

  const mockHook = useExpoUpdatesMock();
  const dismissedTimestamp = useLocalStore((s) => s.dismissedUpdateTimestamp);
  const dismissedVersion = useLocalStore((s) => s.dismissedUpdateVersion);

  const timeSinceDismissal = dismissedTimestamp
    ? Math.floor((Date.now() - dismissedTimestamp) / 1000)
    : null;

  const currentVersion = mockHook._mockControls.getCurrentVersion();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🧪 OTA Update Test Controls (DEV ONLY)</Text>
      
      <ScrollView style={styles.scrollView}>
        {/* Current State */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current State</Text>
          <View style={styles.stateRow}>
            <Text style={styles.label}>Update Available:</Text>
            <Text style={styles.value}>
              {mockHook.updateInfo?.isUpdateAvailable ? '✅ YES' : '❌ NO'}
            </Text>
          </View>
          <View style={styles.stateRow}>
            <Text style={styles.label}>Current Version:</Text>
            <Text style={styles.valueSmall}>{currentVersion.id}</Text>
          </View>
          <View style={styles.stateRow}>
            <Text style={styles.label}>Dismissed Version:</Text>
            <Text style={styles.valueSmall}>
              {dismissedVersion || 'None'}
            </Text>
          </View>
          <View style={styles.stateRow}>
            <Text style={styles.label}>Time Since Dismiss:</Text>
            <Text style={styles.value}>
              {timeSinceDismissal !== null
                ? `${timeSinceDismissal}s (dismissal ends at 10s)`
                : 'Never dismissed'}
            </Text>
          </View>
          <View style={styles.stateRow}>
            <Text style={styles.label}>Error Simulation:</Text>
            <Text style={styles.value}>
              {mockHook._mockControls.simulateError ? '🔴 ON' : '🟢 OFF'}
            </Text>
          </View>
        </View>

        {/* Test Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Test Actions</Text>
          
          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary]}
            onPress={() => mockHook._mockControls.nextVersion()}
          >
            <Text style={styles.buttonText}>
              🔄 Switch to Next Version
            </Text>
            <Text style={styles.buttonSubtext}>
              (Should reset dismissal and show banner)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary]}
            onPress={() => mockHook.resetDismissal()}
          >
            <Text style={styles.buttonText}>
              ♻️ Reset Dismissal State
            </Text>
            <Text style={styles.buttonSubtext}>
              (Banner should appear immediately)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              mockHook._mockControls.simulateError
                ? styles.buttonDanger
                : styles.buttonWarning
            ]}
            onPress={() =>
              mockHook._mockControls.setSimulateError(
                !mockHook._mockControls.simulateError
              )
            }
          >
            <Text style={styles.buttonText}>
              {mockHook._mockControls.simulateError
                ? '✅ Disable Error Simulation'
                : '💥 Enable Error Simulation'}
            </Text>
            <Text style={styles.buttonSubtext}>
              {mockHook._mockControls.simulateError
                ? '(Downloads will succeed)'
                : '(Downloads will fail)'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Instructions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Test Scenarios</Text>
          <View style={styles.instruction}>
            <Text style={styles.instructionNumber}>1.</Text>
            <Text style={styles.instructionText}>
              <Text style={styles.bold}>Test Update Flow:</Text> Banner should be visible above. Click "Update Now" → wait 2s → should show success alert
            </Text>
          </View>
          <View style={styles.instruction}>
            <Text style={styles.instructionNumber}>2.</Text>
            <Text style={styles.instructionText}>
              <Text style={styles.bold}>Test Dismissal:</Text> Click X on banner → should hide. Wait 10 seconds → should reappear
            </Text>
          </View>
          <View style={styles.instruction}>
            <Text style={styles.instructionNumber}>3.</Text>
            <Text style={styles.instructionText}>
              <Text style={styles.bold}>Test New Version:</Text> Dismiss banner → click "Switch to Next Version" → banner should reappear immediately
            </Text>
          </View>
          <View style={styles.instruction}>
            <Text style={styles.instructionNumber}>4.</Text>
            <Text style={styles.instructionText}>
              <Text style={styles.bold}>Test Error:</Text> Enable error simulation → click "Update Now" → should show error state with retry button
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    margin: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ff6b00',
    maxHeight: 600
  },
  scrollView: {
    maxHeight: 520
  },
  title: {
    color: '#ff6b00',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center'
  },
  section: {
    marginBottom: 20,
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 6
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
    paddingBottom: 6
  },
  stateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 4
  },
  label: {
    color: '#aaa',
    fontSize: 12,
    flex: 1
  },
  value: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right'
  },
  valueSmall: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right'
  },
  button: {
    padding: 12,
    borderRadius: 6,
    marginBottom: 12,
    alignItems: 'center'
  },
  buttonPrimary: {
    backgroundColor: '#007AFF'
  },
  buttonSecondary: {
    backgroundColor: '#34C759'
  },
  buttonWarning: {
    backgroundColor: '#FF9500'
  },
  buttonDanger: {
    backgroundColor: '#FF3B30'
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center'
  },
  buttonSubtext: {
    color: '#ddd',
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center'
  },
  instruction: {
    flexDirection: 'row',
    marginBottom: 12,
    paddingLeft: 8
  },
  instructionNumber: {
    color: '#ff6b00',
    fontSize: 12,
    fontWeight: 'bold',
    marginRight: 8,
    width: 20
  },
  instructionText: {
    color: '#ccc',
    fontSize: 12,
    flex: 1,
    lineHeight: 18
  },
  bold: {
    fontWeight: 'bold',
    color: '#fff'
  }
});

