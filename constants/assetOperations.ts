import type {
  AssetOperationAction,
  AssetOperationTypes
} from '@/database_services/types';
import type { LocalizationKey } from '@/services/localizations';

export const MAX_ASSETS_WITHOUT_CONFIRMATION = 30;

export type AssetHistoryCommand = 'undo' | 'redo';
export interface AssetOperationMessage {
  key: LocalizationKey;
  count: number;
}

function getOperationCount(
  operation: AssetOperationTypes,
  command: AssetHistoryCommand
): number {
  switch (operation.action) {
    case 'create':
      return operation.newData.length;
    case 'delete':
      return operation.previousData.length;
    case 'rename':
    case 'move':
      return command === 'undo'
        ? operation.previousData.length
        : operation.newData.length;
    case 'merge':
    case 'replace':
      return command === 'undo'
        ? operation.previousData.length
        : operation.newData.length;
    default:
      return command === 'undo'
        ? operation.previousData.length
        : operation.newData.length;
  }
}

export function getAssetOperationMessage(
  operation: AssetOperationTypes,
  command: AssetHistoryCommand
): AssetOperationMessage {
  const count = getOperationCount(operation, command);
  const action: AssetOperationAction = operation.action;
  let message: AssetOperationMessage;

  if (command === 'redo') {
    switch (action) {
      case 'create':
        message = { key: 'assetRedoCreateMessage', count };
        break;
      case 'rename':
        message = { key: 'assetRedoRenameMessage', count };
        break;
      case 'merge':
        message = { key: 'assetRedoMergeMessage', count };
        break;
      case 'delete':
        message = { key: 'assetRedoDeleteMessage', count };
        break;
      case 'replace':
        message = { key: 'assetRedoReplaceMessage', count };
        break;
      case 'move':
        message = { key: 'assetRedoMoveMessage', count };
        break;
      default:
        message = { key: 'assetRedoDeleteMessage', count };
        break;
    }
  } else {
    switch (action) {
      case 'create':
        message = { key: 'assetUndoCreateMessage', count };
        break;
      case 'rename':
        message = { key: 'assetUndoRenameMessage', count };
        break;
      case 'merge':
        message = { key: 'assetUndoMergeMessage', count };
        break;
      case 'delete':
        message = { key: 'assetUndoDeleteMessage', count };
        break;
      case 'replace':
        message = { key: 'assetUndoReplaceMessage', count };
        break;
      case 'move':
        message = { key: 'assetUndoMoveMessage', count };
        break;
      default:
        message = { key: 'assetUndoDeleteMessage', count };
        break;
    }
  }

  return message;
}
