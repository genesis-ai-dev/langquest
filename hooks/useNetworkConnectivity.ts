import { useEffect, useState } from 'react';
import * as Network from 'expo-network';

export const useNetworkConnectivity = () => {
  const [isConnected, setIsConnected] = useState<boolean>(true);

  useEffect(() => {
    const checkNetwork = async () => {
      const networkState = await Network.getNetworkStateAsync();
      setIsConnected(networkState.isInternetReachable ?? false);
    };

    checkNetwork();
    const interval = setInterval(checkNetwork, 5000); // Check every 5 seconds

    return () => {
      clearInterval(interval);
    };
  }, []);

  return isConnected;
};
