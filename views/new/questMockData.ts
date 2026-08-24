import {
  ScrollTextIcon,
  SproutIcon,
  WavesIcon,
  type LucideIcon
} from 'lucide-react-native';

// Dev-only mock data shared between the dashboard's task checklist and the
// quest-preview detail route. Real version will come from project/quest/
// key-term queries once the API exists.

// The current user's role on each project — shown as an icon badge on the
// project card so it's clear at a glance what kind of work happens there.
export type ProjectRole = 'translator' | 'reviewer' | 'commenter';

export const MOCK_PROJECTS: {
  id: string;
  name: string;
  targetLanguage: string;
  template: 'fia';
  role: ProjectRole;
  translationPct: number;
  reviewPct: number;
  questsRemaining: number;
}[] = [
  {
    id: 'mock-1',
    name: 'Kutubu Genesis',
    targetLanguage: 'Kutubu',
    template: 'fia',
    role: 'translator',
    translationPct: 78,
    reviewPct: 41,
    questsRemaining: 9
  },
  {
    id: 'mock-2',
    name: 'Foi Luke',
    targetLanguage: 'Foi',
    template: 'fia',
    role: 'reviewer',
    translationPct: 34,
    reviewPct: 12,
    questsRemaining: 26
  },
  {
    id: 'mock-3',
    name: 'Angal Heneng Psalms',
    targetLanguage: 'Angal Heneng',
    template: 'fia',
    role: 'commenter',
    translationPct: 96,
    reviewPct: 88,
    questsRemaining: 2
  }
];

export type BookId = 'genesis' | 'exodus' | 'leviticus';

// Shared translate/review color language: a subtle background tint used on
// the dashboard's task rows and the quest-preview screen's header/cards, so
// the same task always shades the same way wherever it's shown.
export const TASK_TYPE_SHADE_CLASSNAME = {
  translate: 'bg-chart-1/[0.06]',
  review: 'bg-chart-3/[0.06]'
} as const;

// Books group quests, each with a distinct icon so a book is recognizable at
// a glance without reading its name.
export const MOCK_BOOKS: Record<BookId, { name: string; icon: LucideIcon }> = {
  genesis: { name: 'Genesis', icon: SproutIcon },
  exodus: { name: 'Exodus', icon: WavesIcon },
  leviticus: { name: 'Leviticus', icon: ScrollTextIcon }
};

// 3 example key terms per book, shown as a step inside a pericope's translate quest.
export const MOCK_KEY_TERMS: Record<BookId, string[]> = {
  genesis: ['image of God', 'Sabbath', 'garden'],
  exodus: ['covenant', 'Passover', 'firstborn'],
  leviticus: ['atonement', 'sacrifice', 'holy']
};

interface MockTaskSeed {
  id: string;
  projectId: string;
  questId: string;
  book: BookId;
  passage: string;
  type: 'translate' | 'review';
  done: boolean;
  // Pre-populated audio for tasks seeded as already checked off, so opening
  // one shows real content instead of an empty first-run state.
  mockComments?: { id: string; duration: string }[];
}

// Quests are pericopes (verse ranges) within a book, each either awaiting a
// first translation or awaiting review of an existing one. `done` seeds a
// couple as already checked off, so the list reads mid-process on first load.
export const MOCK_TASKS: MockTaskSeed[] = [
  {
    id: 'task-1',
    projectId: 'mock-1',
    questId: 'quest-101',
    book: 'genesis' as BookId,
    passage: '1:1–2:3',
    type: 'translate' as const,
    done: true
  },
  {
    id: 'task-2',
    projectId: 'mock-1',
    questId: 'quest-102',
    book: 'genesis' as BookId,
    passage: '2:4–25',
    type: 'translate' as const,
    done: false
  },
  {
    id: 'task-3',
    projectId: 'mock-1',
    questId: 'quest-103',
    book: 'genesis' as BookId,
    passage: '3:1–24',
    type: 'review' as const,
    done: true,
    mockComments: [
      { id: 'task-3-seed-1', duration: '0:12' },
      { id: 'task-3-seed-2', duration: '0:08' }
    ]
  },
  {
    id: 'task-4',
    projectId: 'mock-1',
    questId: 'quest-104',
    book: 'exodus' as BookId,
    passage: '1:1–22',
    type: 'translate' as const,
    done: true
  },
  {
    id: 'task-5',
    projectId: 'mock-1',
    questId: 'quest-105',
    book: 'exodus' as BookId,
    passage: '3:1–4:17',
    type: 'review' as const,
    done: false
  },
  {
    id: 'task-6',
    projectId: 'mock-1',
    questId: 'quest-106',
    book: 'exodus' as BookId,
    passage: '14:1–31',
    type: 'review' as const,
    done: false
  },
  {
    id: 'task-7',
    projectId: 'mock-1',
    questId: 'quest-107',
    book: 'leviticus' as BookId,
    passage: '1:1–17',
    type: 'translate' as const,
    done: false
  },
  {
    id: 'task-8',
    projectId: 'mock-1',
    questId: 'quest-108',
    book: 'leviticus' as BookId,
    passage: '16:1–34',
    type: 'translate' as const,
    done: false
  },
  {
    id: 'task-9',
    projectId: 'mock-1',
    questId: 'quest-109',
    book: 'leviticus' as BookId,
    passage: '19:1–18',
    type: 'review' as const,
    done: false
  }
];

export type MockTask = (typeof MOCK_TASKS)[number];

export function findTask(taskId: string): MockTask | undefined {
  return MOCK_TASKS.find((t) => t.id === taskId);
}
