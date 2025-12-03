import { create } from 'zustand';
import { tagCache } from '../database_services/tagCache';

interface Tag {
  id: string;
  key: string;
  value?: string;
}

interface TagStore {
  getTag: (id: string) => Tag | undefined;
  getManyTags: (ids: string[]) => Tag[];
}

export const useTagStore = create<TagStore>(() => ({
  getTag: (id) => tagCache.get(id),

  getManyTags: (ids) => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!ids || ids.length === 0) return [];

    return ids.map((id) => tagCache.get(id)).filter(Boolean);
  }
}));
