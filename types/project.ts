export interface Project {
    id: string;
    name: string;
    members: number;
    isPublic: boolean;
    isLeader: boolean;
    sourceLanguage: string;
    targetLanguage: string;
    isMember: boolean;
    isWaiting: boolean;
  }