// export type Tag = typeof tag.$inferSelect;
export interface Tag {
  id: string;
  key: string;
  value?: string;
}

export const tagCache = new Map<string, Tag>();
