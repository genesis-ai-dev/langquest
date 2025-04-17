import { useNetworkStore } from '@/store/networkStore';

export const useNetworkConnectivity = () => {
  const isConnected = useNetworkStore((state) => state.isConnected);
  return isConnected;
};
