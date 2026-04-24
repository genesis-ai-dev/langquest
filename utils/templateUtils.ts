import type {
  TemplateNode,
  TemplateStructure
} from '@/constants/templateTypes';
import {
  TEMPLATE_FORMAT_VERSION,
  validateTemplateStructure
} from '@/constants/templateTypes';

export interface TemplateIndex {
  byId: Map<string, TemplateNode>;
  parentOf: Map<string, string>;
  depthOf: Map<string, number>;
  pathOf: Map<string, string[]>;
}

export function parseTemplateStructure(
  raw: unknown
): TemplateStructure | null {
  if (!raw) return null;
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return validateTemplateStructure(data);
}

export function buildTemplateIndex(
  structure: TemplateStructure
): TemplateIndex {
  const byId = new Map<string, TemplateNode>();
  const parentOf = new Map<string, string>();
  const depthOf = new Map<string, number>();
  const pathOf = new Map<string, string[]>();

  function walk(
    node: TemplateNode,
    parentId: string | null,
    depth: number,
    path: string[]
  ) {
    const currentPath = [...path, node.id];
    byId.set(node.id, node);
    depthOf.set(node.id, depth);
    pathOf.set(node.id, currentPath);
    if (parentId) parentOf.set(node.id, parentId);

    if (node.children) {
      for (const child of node.children) {
        if (!child.deleted) {
          walk(child, node.id, depth + 1, currentPath);
        }
      }
    }
  }

  walk(structure.root, null, 0, []);
  return { byId, parentOf, depthOf, pathOf };
}

export function getNode(
  idx: TemplateIndex,
  nodeId: string
): TemplateNode | undefined {
  return idx.byId.get(nodeId);
}

export function listChildren(
  idx: TemplateIndex,
  nodeId: string
): TemplateNode[] {
  const node = idx.byId.get(nodeId);
  if (!node?.children) return [];
  return node.children.filter((c) => !c.deleted);
}

export function getNodePath(
  idx: TemplateIndex,
  nodeId: string
): string[] {
  return idx.pathOf.get(nodeId) ?? [];
}

export function getNodeDepth(
  idx: TemplateIndex,
  nodeId: string
): number {
  return idx.depthOf.get(nodeId) ?? -1;
}

export function getParentId(
  idx: TemplateIndex,
  nodeId: string
): string | undefined {
  return idx.parentOf.get(nodeId);
}

/**
 * Resolves a display label for a node. Uses `short_label` if available,
 * otherwise falls back to `label_template` with variable substitution,
 * otherwise just `name`.
 */
export function resolveLabel(
  node: TemplateNode,
  variables?: Record<string, string>
): string {
  if (node.short_label) return node.short_label;
  if (node.label_template && variables) {
    return node.label_template.replace(
      /\{(\w+)\}/g,
      (_match, key: string) => variables[key] ?? `{${key}}`
    );
  }
  return node.name;
}

/**
 * Find all linkable nodes (nodes that quests or assets can be attached to)
 * at a given depth or across the whole tree.
 */
export function findLinkableNodes(
  idx: TemplateIndex,
  filterType?: 'quest' | 'asset' | 'both'
): TemplateNode[] {
  const result: TemplateNode[] = [];
  for (const node of idx.byId.values()) {
    if (node.deleted) continue;
    if (!node.linkable_type) continue;
    if (filterType && node.linkable_type !== filterType && node.linkable_type !== 'both') {
      continue;
    }
    result.push(node);
  }
  return result;
}

/**
 * Find the download unit ancestor for a given node (the nearest ancestor
 * with `is_download_unit: true`, or the node itself if it is one).
 */
export function findDownloadUnit(
  idx: TemplateIndex,
  nodeId: string
): TemplateNode | undefined {
  let currentId: string | undefined = nodeId;
  while (currentId) {
    const node = idx.byId.get(currentId);
    if (node?.is_download_unit) return node;
    currentId = idx.parentOf.get(currentId);
  }
  return undefined;
}

/**
 * Create a minimal empty template structure.
 */
export function createEmptyStructure(rootName: string): TemplateStructure {
  return {
    format_version: TEMPLATE_FORMAT_VERSION,
    root: {
      id: 'root',
      name: rootName,
      node_type: 'root',
      children: []
    }
  };
}
