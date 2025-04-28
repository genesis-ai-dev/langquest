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
  accountNotVerified: {
    english:
      'Please verify your email address before signing in. Check your email for the verification link.',
    spanish:
      'Por favor verifique su dirección de correo electrónico antes de iniciar sesión. Revise su correo electrónico para el enlace de verificación.'
  },
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
  backToLogin: {
    english: 'Back to Login',
    spanish: 'Volver al inicio de sesión'
  },
  becomeHero: {
    english: 'Become a Hero',
    spanish: 'Conviértete en héroe'
  },
  checkEmail: {
    english: 'Please check your email',
    spanish: 'Por favor revise su correo electrónico'
  },
  checkEmailForResetLink: {
    english: 'Please check your email for the password reset link',
    spanish:
      'Por favor revise su correo electrónico para el enlace de restablecimiento de contraseña'
  },
  confirmNewPassword: {
    english: 'Confirm New Password',
    spanish: 'Confirmar nueva contraseña'
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
  enterValidEmail: {
    english: 'Please enter a valid email',
    spanish: 'Por favor ingrese un correo electrónico válido'
  },
  enterYourEmail: {
    english: 'Enter your email',
    spanish: 'Ingrese su correo electrónico'
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
  failedResetPassword: {
    english: 'Failed to reset password',
    spanish: 'Error al restablecer la contraseña'
  },
  failedSendResetEmail: {
    english: 'Failed to send reset email',
    spanish: 'Error al enviar el correo de restablecimiento'
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
  invalidResetLink: {
    english: 'Invalid or expired reset link',
    spanish: 'Enlace de restablecimiento inválido o expirado'
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
  passwordRequired: {
    english: 'Password is required',
    spanish: 'Se requiere contraseña'
  },
  passwordMinLength: {
    english: 'Password must be at least 6 characters',
    spanish: 'La contraseña debe tener al menos 6 caracteres'
  },
  passwordsNoMatch: {
    english: 'Passwords do not match',
    spanish: 'Las contraseñas no coinciden'
  },
  passwordResetSuccess: {
    english: 'Password has been reset successfully',
    spanish: 'La contraseña se ha restablecido correctamente'
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
  resetPassword: {
    english: 'Reset Password',
    spanish: 'Restablecer contraseña'
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
  sendResetEmail: {
    english: 'Send Reset Email',
    spanish: 'Enviar correo de restablecimiento'
  },
  signIn: {
    english: 'Sign In',
    spanish: 'Iniciar Sesión'
  },
  signInError: {
    english: 'Unable to sign in. Please check your credentials and try again.',
    spanish:
      'No se puede iniciar sesión. Por favor verifique sus credenciales e intente nuevamente.'
  },
  logOut: {
    english: 'Log Out',
    spanish: 'Cerrar Sesión'
  },
  sortBy: {
    english: 'Sort by',
    spanish: 'Ordenar por'
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
  },
  remaining: {
    english: 'remaining',
    spanish: 'restante'
  },
  notifications: {
    english: 'Notifications',
    spanish: 'Notificaciones'
  },
  profile: {
    english: 'Profile',
    spanish: 'Perfil'
  },
  settings: {
    english: 'Settings',
    spanish: 'Configuración'
  },
  changePassword: {
    english: 'Change Password',
    spanish: 'Cambiar Contraseña'
  },
  currentPassword: {
    english: 'Current Password',
    spanish: 'Contraseña Actual'
  },
  newPassword: {
    english: 'New Password',
    spanish: 'Nueva Contraseña'
  },
  offlinePasswordChange: {
    english: 'Password can only be changed when online',
    spanish: 'La contraseña solo se puede cambiar cuando está en línea'
  },
  onlineOnlyFeatures: {
    english: 'Password changes are only available when online',
    spanish:
      'Los cambios de contraseña solo están disponibles cuando está en línea'
  },
  verificationRequired: {
    english: 'Verification Required',
    spanish: 'Verificación Requerida'
  },
  termsAndConditionsTitle: {
    english: 'Terms and Conditions',
    spanish: 'Términos y Condiciones'
  },
  agreeToTerms: {
    english: 'I have read and agree to the Terms and Conditions',
    spanish: 'He leído y acepto los Términos y Condiciones'
  },
  viewTerms: {
    english: 'View Terms and Conditions',
    spanish: 'Ver Términos y Condiciones'
  },
  termsRequired: {
    english: 'You must agree to the Terms and Conditions',
    spanish: 'Debe aceptar los Términos y Condiciones'
  },
  status: {
    english: 'Status',
    spanish: 'Estado'
  },
  accepted: {
    english: 'Accepted',
    spanish: 'Aceptado'
  },
  notAccepted: {
    english: 'Not Accepted',
    spanish: 'No Aceptado'
  },
  processing: {
    english: 'Processing...',
    spanish: 'Procesando...'
  },
  accept: {
    english: 'Accept',
    spanish: 'Aceptar'
  },
  termsContributionInfo: {
    english:
      'By accepting these terms, you agree that all content you contribute to LangQuest will be freely available worldwide under the CC0 1.0 Universal (CC0 1.0) Public Domain Dedication.',
    spanish:
      'Al aceptar estos términos, acepta que todo el contenido que aporte a LangQuest estará disponible gratuitamente en todo el mundo bajo la Dedicación de Dominio Público CC0 1.0 Universal (CC0 1.0).'
  },
  termsDataInfo: {
    english:
      'This means your contributions can be used by anyone for any purpose without attribution. We collect minimal user data: only your email (for account recovery) and newsletter subscription if opted in.',
    spanish:
      'Esto significa que sus contribuciones pueden ser utilizadas por cualquier persona para cualquier propósito sin atribución. Recopilamos datos mínimos de usuario: solo su correo electrónico (para recuperación de cuenta) y suscripción al boletín si se inscribe.'
  },
  viewFullDataPolicy: {
    english: 'View Full Data Policy',
    spanish: 'Ver Política de Datos Completa'
  },
  dataPolicyUrl: {
    english: `${process.env.EXPO_PUBLIC_SITE_URL}/data-policy`,
    spanish: `${process.env.EXPO_PUBLIC_SITE_URL}/data-policy`
  },
  downloadLimitExceeded: {
    english: 'Download Limit Exceeded',
    spanish: 'Límite de descarga excedido'
  },
  downloadLimitMessage: {
    english:
      'You are trying to download {newDownloads} attachments for a total of {totalDownloads}, but the limit is {limit}. Please deselect some downloads and try again.',
    spanish:
      'Está intentando descargar {newDownloads} archivos adjuntos para un total de {totalDownloads}, pero el límite es {limit}. Por favor, deseleccione algunas descargas e intente nuevamente.'
  },
  offlineUndownloadWarning: {
    english: 'Offline Undownload Warning',
    spanish: 'Advertencia de eliminación sin conexión'
  },
  offlineUndownloadMessage: {
    english:
      "You are currently offline. If you remove this download, you won't be able to redownload it until you're back online. Your unsynced contributions will not be affected.",
    spanish:
      'Actualmente estás sin conexión. Si eliminas esta descarga, no podrás volver a descargarla hasta que vuelvas a estar en línea. Tus contribuciones no sincronizadas no se verán afectadas.'
  },
  dontShowAgain: {
    english: "Don't show this message again",
    spanish: 'No mostrar este mensaje nuevamente'
  },
  cancel: {
    english: 'Cancel',
    spanish: 'Cancelar'
  },
  confirm: {
    english: 'Confirm',
    spanish: 'Confirmar'
  }
  // Add more translation keys as needed...
} as const;

// Type check to ensure all translation keys have all supported languages
type ValidateTranslations<T> = {
  [K in keyof T]: T[K] extends TranslationSet ? true : never;
};
type ValidationResult = ValidateTranslations<typeof translations>;
