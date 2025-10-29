import type { AssetStatus, LayerStatus } from '@/database_services/types';
import React, { createContext, useContext } from 'react';

export const defaultStatus: LayerStatus = {
  visible: true,
  active: true,
  source: 'synced'
};

interface LayerIds {
  0: Map<string, LayerStatus>;
  1: Map<string, LayerStatus>;
  2: Map<string, LayerStatus>;
  3: Map<string, LayerStatus>;
  combined: Map<string, LayerStatus>;
}

export enum LayerType {
  PROJECT = 0,
  QUEST = 1,
  ASSET = 2,
  /**
   * @deprecated Translations are now represented as assets with source_asset_id.
   * Use LayerType.ASSET instead and check for source_asset_id to identify translations.
   */
  TRANSLATION = 3
}

interface StatusContextType {
  layerStatus: (layerType: LayerType, id?: string) => LayerStatus;
  setLayerStatus: (
    layerType: LayerType,
    status: LayerStatus | AssetStatus,
    id: string,
    secondId?: string
  ) => void;
  getStatusParams: (
    layerType: LayerType,
    id?: string,
    currentLayer?: LayerStatus,
    secondId?: string
  ) => StatusParams;
}

interface StatusParams {
  allowEditing: boolean;
  allowSettings: boolean;
  invisible: boolean;
}

export const StatusContext = createContext<StatusContextType>({
  layerStatus: () => defaultStatus,
  setLayerStatus: () => null,
  getStatusParams: () => ({
    allowEditing: false,
    allowSettings: false,
    invisible: false
  })
});

export const useStatusContext = () => useContext(StatusContext);

export const StatusProvider: React.FC<{ children: React.ReactNode }> = ({
  children
}) => {
  // Keep a layer chain to apply to deeper layers
  const navLayersStatus = React.useRef<LayerStatus[]>([
    { visible: true, active: true, source: 'synced' }, // 0 Project
    { visible: true, active: true, source: 'synced' }, // 1 Quest
    { visible: true, active: true, source: 'synced' }, // 2 Asset
    { visible: true, active: true, source: 'synced' } //  3 Translation
  ]);
  const layerIds = React.useRef<LayerIds>({
    0: new Map(),
    1: new Map(),
    2: new Map(),
    3: new Map(),
    combined: new Map()
  });

  const layerStatus = (layerType: LayerType, id?: string) => {
    const status = defaultStatus;
    for (let i = 0; i <= Number(layerType); i++) {
      if (navLayersStatus.current[i] !== undefined) {
        status.visible = status.visible && navLayersStatus.current[i]!.visible;
        status.active = status.active && navLayersStatus.current[i]!.active;
      }
    }
    for (
      let i = Number(layerType) + 1;
      i < navLayersStatus.current.length;
      i++
    ) {
      navLayersStatus.current[i] = {
        visible: true,
        active: true,
        source: 'synced'
      };
    }

    return status;
  };

  const setLayerStatus = (
    layerType: LayerType,
    status: LayerStatus | AssetStatus,
    id: string,
    secondId?: string
  ) => {
    if ('quest_active' in status) {
      navLayersStatus.current[Number(layerType)] = {
        visible: status.visible && status.quest_visible,
        active: status.active && status.quest_active,
        source: status.source
      };
      if (secondId) {
        layerIds.current.combined.set(id + secondId, {
          visible: status.quest_visible,
          active: status.quest_active,
          source: status.source
        });
      }
    } else
      navLayersStatus.current[Number(layerType)] = {
        visible: status.visible,
        active: status.active,
        source: status.source
      };

    const { visible, active, source } = status;
    layerIds.current[layerType].set(id, {
      visible,
      active,
      source
    });

    // When in a shallow layer, ensure all deeper layers are visible and active
    // until new level is selected
    for (
      let i = Number(layerType) + 1;
      i < navLayersStatus.current.length;
      i++
    ) {
      navLayersStatus.current[i] = {
        visible: true,
        active: true,
        source: 'synced'
      };
    }

    // printStatus();
  };

  function getStatusParams(
    layerType: LayerType,
    id?: string,
    currentLayer: LayerStatus = {
      visible: true,
      active: true,
      source: 'synced'
    },
    secondId?: string
  ): StatusParams {
    let activeParent = true;
    let visibleParent = true;

    let activeCurrent = true;
    let visibleCurrent = true;

    for (let i = 0; i <= Number(layerType); i++) {
      if (navLayersStatus.current[i] !== undefined) {
        if (i < Number(layerType)) {
          activeParent = activeParent && navLayersStatus.current[i]!.active;
          visibleParent = visibleParent && navLayersStatus.current[i]!.visible;
        }
        activeCurrent = activeCurrent && navLayersStatus.current[i]!.active;
        visibleCurrent = visibleCurrent && navLayersStatus.current[i]!.visible;
      }
    }

    currentLayer = {
      active: currentLayer.active,
      visible: currentLayer.visible,
      source: currentLayer.source
    };

    if (id && layerIds.current[layerType].has(id)) {
      const auxLayer = layerIds.current[layerType].get(id) ?? {
        visible: true,
        active: true,
        source: 'synced' as const
      };
      currentLayer.active = currentLayer.active && auxLayer.active;
      currentLayer.visible = currentLayer.visible && auxLayer.visible;
    }

    if (secondId) {
      const combinedLayer = layerIds.current.combined.get(id + secondId) ?? {
        visible: true,
        active: true,
        source: 'synced' as const
      };
      currentLayer.active = currentLayer.active && combinedLayer.active;
      currentLayer.visible = currentLayer.visible && combinedLayer.visible;
    }

    activeCurrent = activeCurrent && currentLayer.active;
    visibleCurrent = visibleCurrent && currentLayer.visible;

    const allowEditing = activeParent && activeCurrent;
    const allowSettings = activeParent;
    const invisible = !visibleParent || !visibleCurrent;

    // printStatus();

    return {
      allowEditing,
      allowSettings,
      invisible
    };
  }

  // function printStatus() {
  //   console.log(
  //     '----------------------------> Current Layer Statuses: <----------------------------'
  //   );
  //   let print = '';
  //   for (let index = 0; index < navLayersStatus.current.length; index++) {
  //     const status = navLayersStatus.current[index];
  //     print += `${index}: V: ${status.visible} A: ${status.active} | `;
  //   }
  //   console.log(print);
  //   console.log(
  //     '--------------------------------------- x -----------------------------------------'
  //   );
  // }

  return (
    <StatusContext.Provider
      value={{
        layerStatus,
        setLayerStatus,
        getStatusParams
      }}
    >
      {children}
    </StatusContext.Provider>
  );
};
