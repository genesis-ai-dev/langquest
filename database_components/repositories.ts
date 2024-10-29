import { UserRepository } from './UserRepository';
import { LanguageRepository } from './LanguageRepository';

// Create instances of the repositories
export const userRepository = new UserRepository();
export const languageRepository = new LanguageRepository();

// Export types
export type { Language } from './LanguageRepository';
export type { User } from './UserRepository';