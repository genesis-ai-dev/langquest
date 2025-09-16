export const reasonOptions = [
  'inappropriate_content',
  'spam',
  'other'
] as const;

export const statusOptions = [
  'pending',
  'accepted',
  'declined',
  'withdrawn'
  // 'expired'
] as const;

export const templateOptions = ['unstructured', 'bible'] as const;
