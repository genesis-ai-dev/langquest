import React, { createContext, useContext, useState } from 'react';

interface CloudLoadingContextType {
  isCloudLoading: boolean;
  setCloudLoading: (loading: boolean) => void;
}

const CloudLoadingContext = createContext<CloudLoadingContextType>({
  isCloudLoading: false,
  setCloudLoading: () => null
});

export const useCloudLoading = () => useContext(CloudLoadingContext);

export const CloudLoadingProvider: React.FC<{ children: React.ReactNode }> = ({
  children
}) => {
  const [isCloudLoading, setCloudLoading] = useState(false);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = React.useMemo(
    () => ({ isCloudLoading, setCloudLoading }),
    [isCloudLoading, setCloudLoading]
  );

  return (
    <CloudLoadingContext.Provider value={contextValue}>
      {children}
    </CloudLoadingContext.Provider>
  );
};
