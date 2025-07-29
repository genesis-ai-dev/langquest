import React, { createContext, useContext, useState } from 'react';

interface RefetchContextType {
  isItemInRefetchList: (
    key: 'projectId' | 'questId' | 'assetId',
    value: string
  ) => boolean;
  setRefetchItem: (
    key: 'projectId' | 'questId' | 'assetId' | 'projectList',
    value: string
  ) => void;
  clearRefetchItem: (
    key: 'projectId' | 'questId' | 'assetId' | 'projectList',
    value: string
  ) => void;
  refetchProjectList: () => boolean;

  // getSet: (key: 'projectId' | 'questId' | 'assetId') => Set<string>;
}

export const RefetchContext = createContext<RefetchContextType | undefined>(
  undefined
);

export const useRefetch = () => useContext(RefetchContext);

export const RefetchProvider: React.FC<{ children: React.ReactNode }> = ({
  children
}) => {
  const [refetch, setRefetch] = useState({
    projectList: false,
    projectId: new Set<string>(),
    questId: new Set<string>(),
    assetId: new Set<string>()
  });

  const setRefetchItem = (
    key: 'projectId' | 'questId' | 'assetId' | 'projectList',
    value: string
  ) => {
    console.log(refetch);

    if (key === 'projectId' || key === 'questId' || key === 'assetId') {
      refetch[key].add(value);
    } else {
      setRefetch({
        ...refetch,
        projectList: true
      });
    }

    console.log(refetch);
  };

  const clearRefetchItem = (
    key: 'projectId' | 'questId' | 'assetId' | 'projectList',
    value: string
  ) => {
    if (key === 'projectId' || key === 'questId' || key === 'assetId') {
      refetch[key].delete(value);
    } else {
      setRefetch({
        ...refetch,
        projectList: false
      });
    }
  };

  const isItemInRefetchList = (
    key: 'projectId' | 'questId' | 'assetId',
    value: string
  ) => {
    return refetch[key].has(value);
  };

  const refetchProjectList = () => refetch.projectList;

  //   const getSet = (key: 'projectId' | 'questId' | 'assetId') => {
  //     // Retorna uma cópia para evitar mutação externa
  //     return new Set(refetch[key]);
  //   };

  return (
    <RefetchContext.Provider
      value={{
        isItemInRefetchList,
        setRefetchItem,
        clearRefetchItem,
        refetchProjectList
        // getSet
      }}
    >
      {children}
    </RefetchContext.Provider>
  );
};
