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
  all: {
    english: 'All',
    spanish: 'Todo'
  },
  appLanguage: {
    english: 'App Language',
    spanish: 'Idioma de la aplicación'
  },
  apply: {
    english: 'Apply',
    spanish: 'Aplicar'
  },
  audio: {
    english: 'Audio',
    spanish: 'Audio'
  },
  avatar: {
    english: 'Avatar',
    spanish: 'Avatar'
  },
  becomeHero: {
    english: 'Become a Hero',
    spanish: 'Conviértete en héroe'
  },
  confirmPassword: {
    english: 'Confirm Password',
    spanish: 'Confirmar contraseña'
  },
  databaseNotReady: {
    english: 'Database is not ready yet. Please wait.',
    spanish: 'La base de datos aún no está lista. Por favor espere.'
  },
  date: {
    english: 'Date',
    spanish: 'Fecha'
  },
  email: {
    english: 'Email',
    spanish: 'Email'
  },
  emailRequired: {
    english: 'Email is required',
    spanish: 'Se requiere email'
  },
  enterTranslation: {
    english: 'Enter your translation here',
    spanish: 'Ingrese su traducción aquí'
  },
  error: {
    english: 'Error',
    spanish: 'Error'
  },
  explore: {
    english: 'Explore',
    spanish: 'Explorar'
  },
  failedCreateTranslation: {
    english: 'Failed to create translation',
    spanish: 'Error al crear la traducción'
  },
  failedLoadAsset: {
    english: 'Failed to load asset data',
    spanish: 'Error al cargar datos del recurso'
  },
  failedLoadLanguages: {
    english: 'Failed to load available languages',
    spanish: 'Error al cargar idiomas disponibles'
  },
  failedLoadProjects: {
    english: 'Failed to load projects',
    spanish: 'Error al cargar proyectos'
  },
  failedLoadQuests: {
    english: 'Failed to load quests',
    spanish: 'Error al cargar misiones'
  },
  failedRemoveVote: {
    english: 'Failed to remove vote',
    spanish: 'Error al eliminar el voto'
  },
  failedToVote: {
    english: 'Failed to submit vote',
    spanish: 'Error al enviar el voto'
  },
  fillFields: {
    english: 'Please fill in all required fields',
    spanish: 'Por favor complete todos los campos requeridos'
  },
  forgotPassword: {
    english: 'I forgot my password',
    spanish: 'Olvidé mi contraseña'
  },
  invalidAuth: {
    english: 'Inavlid username or password',
    spanish: 'Usuario o contraseña inválidos'
  },
  logInToTranslate: {
    english: 'You must be logged in to submit translations',
    spanish: 'Debe iniciar sesión para enviar traducciones'
  },
  logInToVote: {
    english: 'You must be logged in to vote',
    spanish: 'Debe iniciar sesión para votar'
  },
  newTranslation: {
    english: 'New Translation',
    spanish: 'Nueva Traducción'
  },
  newUser: {
    english: 'New user?',
    spanish: '¿Usuario nuevo?'
  },
  newUserRegistration: {
    english: 'New User Registration',
    spanish: 'Registro de nuevo usuario'
  },
  noComment: {
    english: 'No Comment',
    spanish: 'Sin comentarios'
  },
  noProject: {
    english: 'No active project found',
    spanish: 'No se encontró ningún proyecto activo'
  },
  ok: {
    english: 'OK',
    spanish: 'OK'
  },
  password: {
    english: 'Password',
    spanish: 'Contraseña'
  },
  passwordsNoMatch: {
    english: 'Passwords do not match',
    spanish: 'Las contraseñas no coinciden'
  },
  projects: {
    english: 'Projects',
    spanish: 'Proyectos'
  },
  quests: {
    english: 'Quests',
    spanish: 'Misiones'
  },
  questOptions: {
    english: 'Quest Options',
    spanish: 'Opciones de misión'
  },
  recording: {
    english: 'Recording',
    spanish: 'Grabando'
  },
  register: {
    english: 'Register',
    spanish: 'Registrarse'
  },
  registrationFail: {
    english: 'Registration failed',
    spanish: 'Error en el registro'
  },
  registrationSuccess: {
    english: 'Registration successful',
    spanish: 'Registro exitoso'
  },
  returningHero: {
    english: 'Returning hero? Sign In',
    spanish: '¿Héroe que regresa? Inicia sesión'
  },
  search: {
    english: 'Search...',
    spanish: 'Buscar...'
  },
  searchAssets: {
    english: 'Search assets...',
    spanish: 'Buscar recursos...'
  },
  searchQuests: {
    english: 'Search quests...',
    spanish: 'Buscar misiones...'
  },
  select: {
    english: 'Select',
    spanish: 'Seleccionar'
  },
  selectItem: {
    english: 'Select item',
    spanish: 'Seleccionar elemento'
  },
  selectLanguage: {
    english: 'Please select a language',
    spanish: 'Por favor seleccione un idioma'
  },
  signIn: {
    english: 'Sign In',
    spanish: 'Iniciar Sesión'
  },
  signInError: {
    english: 'An error occurred during sign in',
    spanish: 'Ocurrió un error durante el inicio de sesión'
  },
  sortBy: {
    english: 'Sort by...',
    spanish: 'Ordenar por...'
  },
  source: {
    english: 'Source',
    spanish: 'Fuente'
  },
  startQuest: {
    english: 'Start Quest',
    spanish: 'Comenzar misión'
  },
  submit: {
    english: 'Submit',
    spanish: 'Enviar'
  },
  submitTranslation: {
    english: 'Submit Translation',
    spanish: 'Enviar Traducción'
  },
  success: {
    english: 'Success',
    spanish: 'Éxito'
  },
  target: {
    english: 'Target',
    spanish: 'Objetivo'
  },
  username: {
    english: 'Username',
    spanish: 'Nombre de usuario'
  },
  usernameRequired: {
    english: 'Username is required',
    spanish: 'Se requiere nombre de usuario'
  },
  votes: {
    english: 'Votes',
    spanish: 'Votos'
  },
  welcome: {
    english: 'Welcome back, hero!',
    spanish: '¡Bienvenido de nuevo, héroe!'
  },
  recentlyVisited: {
    english: 'Recently Visited',
    spanish: 'Recientemente visitado'
  },
  assets: {
    english: 'Assets',
    spanish: 'Recursos'
  }
  // Add more translation keys as needed...
} as const;

// Type check to ensure all translation keys have all supported languages
type ValidateTranslations<T> = {
  [K in keyof T]: T[K] extends TranslationSet ? true : never;
};
type ValidationResult = ValidateTranslations<typeof translations>;
