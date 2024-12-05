// Define all supported UI languages
export type SupportedLanguage = 'english' | 'spanish';

// Define the structure for translations
export type TranslationKey = keyof typeof translations;

// Type to ensure all translations have all supported languages
type TranslationSet = {
  [key in SupportedLanguage]: string;
};

// All UI translations
export const translations = {
  // Auth
  welcome: {
    english: 'Welcome back, hero!',
    spanish: '¡Bienvenido de nuevo, héroe!'
  },
  signIn: {
    english: 'Sign In',
    spanish: 'Iniciar Sesión'
  },
  register: {
    english: 'Register',
    spanish: 'Registrarse'
  },
  newUser: {
    english: 'New user?',
    spanish: '¿Usuario nuevo?'
  },
  
  // Translation-related
  newTranslation: {
    english: 'New Translation',
    spanish: 'Nueva Traducción'
  },
  searchAssets: {
    english: 'Search assets...',
    spanish: 'Buscar recursos...'
  },
  submitTranslation: {
    english: 'Submit Translation',
    spanish: 'Enviar Traducción'
  },

  // Add more translation keys as needed...
} as const;

// Type check to ensure all translation keys have all supported languages
type ValidateTranslations<T> = {
  [K in keyof T]: T[K] extends TranslationSet ? true : never;
};
type ValidationResult = ValidateTranslations<typeof translations>;