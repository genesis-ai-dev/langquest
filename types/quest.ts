export interface Quest {
    id: string;
    title: string;
    description: string;
    tags: string[];
    difficulty: 'Easy' | 'Medium' | 'Hard';
    status: 'Not Started' | 'In Progress' | 'Completed';
  }