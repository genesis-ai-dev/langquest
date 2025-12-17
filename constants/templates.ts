import { bibleToVersificationTemplate } from './bibleStructure';

/**
 * Segment of a quest or chapter.
 *
 * The `source` key is currently optional and may be used in the future to
 * embed rich content such as parallel text/audio, associated images, or
 * granular content links. Future extension may involve support for word-level
 * alignments, embedded external references, or editorial content.
 */
export interface Segment {
  id: string;
  name: string;
  source?: {
    content?: (
      | { text: string; audio?: never }
      | { audio: string; text?: never }
      | { text: string; audio: string }
    )[];
    images?: string[];
  };
}

export type Quest =
  | {
      id: string;
      name: string;
      quests: Quest[];
      segments?: never;
    }
  | {
      id: string;
      name: string;
      segments: Segment[];
      quests?: never;
    };

export interface TemplatedProject {
  id: string;
  name: string;
  quests: Quest[];
}

export const QUEST_TEMPLATES: TemplatedProject[] = [
  {
    id: 'protestant',
    name: 'Protestant',
    quests: bibleToVersificationTemplate()
  }
];
