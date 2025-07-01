import { useNetworkStore } from '@/store/networkStore';

export function useNetworkStatus() {
  const isConnected = useNetworkStore((state) => state.isConnected);

  return isConnected;
}

export function getNetworkStatus() {
  return useNetworkStore.getState().isConnected;
}
