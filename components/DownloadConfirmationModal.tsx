import { colors } from '@/styles/theme';
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface DownloadConfirmationModalProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  downloadType: 'project' | 'quest';
  stats: {
    totalAssets: number;
    totalTranslations?: number;
    totalQuests?: number;
  };
}

export const DownloadConfirmationModal: React.FC<
  DownloadConfirmationModalProps
> = ({ visible, onConfirm, onCancel, downloadType, stats }) => {
  const getConfirmationText = () => {
    if (downloadType === 'project') {
      return `Download this project for offline use?\n\nThis will download:\n• ${stats.totalQuests || 0} quests\n• ${stats.totalAssets || 0} assets\n• ${stats.totalTranslations || 0} translations`;
    } else {
      return `Download this quest for offline use?\n\nThis will download:\n• ${stats.totalAssets || 0} assets\n• ${stats.totalTranslations || 0} translations`;
    }
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onCancel}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <Text style={styles.modalTitle}>
            Download {downloadType === 'project' ? 'Project' : 'Quest'}
          </Text>

          <Text style={styles.modalText}>{getConfirmationText()}</Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.confirmButton]}
              onPress={onConfirm}
            >
              <Text style={styles.confirmButtonText}>Download</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)'
  },
  modalView: {
    margin: 20,
    backgroundColor: colors.background,
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    minWidth: 300
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 15,
    textAlign: 'center'
  },
  modalText: {
    fontSize: 16,
    color: colors.text,
    textAlign: 'left',
    marginBottom: 20,
    lineHeight: 22
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 10
  },
  button: {
    borderRadius: 10,
    padding: 12,
    elevation: 2,
    flex: 1
  },
  cancelButton: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.disabled
  },
  confirmButton: {
    backgroundColor: colors.primary
  },
  cancelButtonText: {
    color: colors.text,
    fontWeight: 'bold',
    textAlign: 'center'
  },
  confirmButtonText: {
    color: colors.background,
    fontWeight: 'bold',
    textAlign: 'center'
  }
});
