import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Set up a listener for network status changes
    // Returns an unsubscribe function that we'll use for cleanup
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      // Update online status when network state changes
      setIsOnline(!!state.isConnected);
    });

    // Check initial network status when component mounts
    const checkInitialStatus = async () => {
      const state = await NetInfo.fetch();
      // Set initial online status
      setIsOnline(!!state.isConnected);
    };
    checkInitialStatus();

    // Cleanup function that runs when component unmounts
    // Removes the network status listener
    return () => unsubscribe();
  }, []);

  return isOnline;
}
