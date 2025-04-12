import { useEffect, useState } from 'react';
import { system } from '@/db/powersync/system';

export const useNetworkConnectivity = () => {
  const [isConnected, setIsConnected] = useState<boolean>(true);
  console.log('[useNetworkConnectivity] Hook initialized');

  useEffect(() => {
    console.log('[useNetworkConnectivity] Setting up connectivity check');

    const checkConnection = async () => {
      try {
        // Create a timeout promise that rejects after 3 seconds
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Connection timeout')), 3000);
        });

        // Create the actual request promise
        const requestPromise = system.supabaseConnector.client
          .from('project_download') // Use a table we know exists
          .select('id')
          .limit(1)
          .single();

        // Race between the timeout and the request
        await Promise.race([requestPromise, timeoutPromise]);
        setIsConnected(true);
      } catch (error) {
        // If we get here, either the request failed or timed out
        setIsConnected(false);
      }
    };

    checkConnection();
    console.log('[useNetworkConnectivity] Initial connection check complete');
    const interval = setInterval(checkConnection, 5000); // Check every 5 seconds
    console.log(
      '[useNetworkConnectivity] Set up interval for connection checks'
    );

    return () => {
      console.log('[useNetworkConnectivity] Cleaning up interval');
      clearInterval(interval);
    };
  }, []);

  console.log(
    '[useNetworkConnectivity] Returning connection status:',
    isConnected
  );
  return isConnected;
};
