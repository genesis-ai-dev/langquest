import NetInfo from '@react-native-community/netinfo';
import { create } from 'zustand';

interface NetworkState {
  isConnected: boolean;
  initializeNetworkListener: () => () => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  isConnected: true,
  initializeNetworkListener: () => {
    // Initial check
    void NetInfo.fetch().then((state) => {
      set({ isConnected: state.isConnected ?? false });
    });

    // Subscribe to network state updates
    const unsubscribe = NetInfo.addEventListener((state) => {
      set({ isConnected: state.isConnected ?? false });
    });

    // Return the unsubscribe function
    return unsubscribe;
  }
}));

// Initialize the network listener in a separate component or at app startup
export const initializeNetwork = () => {
  const unsubscribe = useNetworkStore.getState().initializeNetworkListener();
  return unsubscribe;
};
