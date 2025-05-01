// Define all supported UI languages
export type SupportedLanguage = 'english' | 'spanish';

// Define the structure for translations
export type TranslationKey = keyof typeof translations;

// Define the translation set type
type TranslationSet = Record<SupportedLanguage, string>;

// All UI translations
export const translations: Record<string, TranslationSet> = {
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
    english: 'Database not ready. Please wait for initialization.',
    spanish: 'Base de datos no lista. Espere la inicialización.'
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
  termsAndPrivacyTitle: {
    english: 'Terms & Privacy',
    spanish: 'Términos y Privacidad'
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
    english: 'I have read and agree to the Terms & Privacy',
    spanish: 'He leído y acepto los Términos y Privacidad'
  },
  viewTerms: {
    english: 'View Terms and Privacy',
    spanish: 'Ver Términos y Privacidad'
  },
  termsRequired: {
    english: 'You must agree to the Terms and Privacy',
    spanish: 'Debe aceptar los Términos y Privacidad'
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
  analyticsInfo: {
    english:
      'We collect analytics and diagnostic data to improve the app and your experience. You can opt out of analytics at any time in your profile settings. Your data is processed and stored in the United States.',
    spanish:
      'Recopilamos datos de análisis y diagnóstico para mejorar la aplicación y su experiencia. Puede optar por no participar en el análisis en cualquier momento en sus ajustes. Sus datos se procesan y almacenan en los Estados Unidos.'
  },
  viewFullTerms: {
    english: 'View Full Terms',
    spanish: 'Ver Términos Completos'
  },
  viewFullPrivacy: {
    english: 'View Full Privacy',
    spanish: 'Ver Privacidad Completa'
  },
  submitFeedback: {
    english: 'Submit App Feedback',
    spanish: 'Enviar Feedback de la App'
  },
  reportTranslation: {
    english: 'Report Translation',
    spanish: 'Reportar Traducción'
  },
  selectReasonLabel: {
    english: 'Select a reason',
    spanish: 'Seleccione un motivo'
  },
  additionalDetails: {
    english: 'Additional Details',
    spanish: 'Detalles Adicionales'
  },
  additionalDetailsPlaceholder: {
    english: 'Provide any additional information...',
    spanish: 'Proporcionar cualquier información adicional...'
  },
  submitReport: {
    english: 'Submit Report',
    spanish: 'Enviar Reporte'
  },
  submitting: {
    english: 'Submitting...',
    spanish: 'Enviando...'
  },
  reportSubmitted: {
    english: 'Report submitted successfully',
    spanish: 'Reporte enviado con éxito'
  },
  failedToSubmitReport: {
    english: 'Failed to submit report',
    spanish: 'Error al enviar el reporte'
  },
  logInToReport: {
    english: 'You must be logged in to report translations',
    spanish: 'Debe iniciar sesión para reportar traducciones'
  },
  selectReason: {
    english: 'Please select a reason for the report',
    spanish: 'Por favor seleccione un motivo para el reporte'
  },
  analyticsOptOutLabel: {
    english: 'Opt out of analytics',
    spanish: 'Desactivar el análisis'
  },
  analyticsOptOutDescription: {
    english: 'When enabled, we will not collect usage data to improve the app.',
    spanish:
      'Cuando está habilitado, no recopilaremos datos de uso para mejorar la aplicación.'
  },
  'reportReason.inappropriate_content': {
    english: 'Inappropriate Content',
    spanish: 'Contenido Inapropiado'
  },
  'reportReason.spam': {
    english: 'Spam',
    spanish: 'Spam'
  },
  'reportReason.other': {
    english: 'Other',
    spanish: 'Otro'
  },
  // --- Backup Feature Translations (Audio Only) ---
  backup: {
    english: 'Backup Audio',
    spanish: 'Hacer copia de audio'
  },
  backingUp: {
    english: 'Backing up audio...',
    spanish: 'Haciendo copia de audio...'
  },
  restoreBackup: {
    english: 'Restore Audio',
    spanish: 'Restaurar audio'
  },
  restoring: {
    english: 'Restoring audio...',
    spanish: 'Restaurando audio...'
  },
  restoreAudioOnly: {
    english: 'Audio Files',
    spanish: 'Archivos de Audio'
  },
  confirmAudioRestore: {
    english: 'Confirm Audio Restore',
    spanish: 'Confirmar restauración de audio'
  },
  confirmAudioRestoreMessage: {
    english: 'Restore audio files from the selected backup?',
    spanish: '¿Restaurar archivos de audio desde la copia de seguridad seleccionada?'
  },
  startBackupTitle: {
    english: 'Start Audio Backup?',
    spanish: '¿Iniciar copia de seguridad de audio?'
  },
  startBackupMessageAudioOnly: {
    english: 'This will back up your locally recorded audio files to a location you choose. Make sure you have enough storage space.',
    spanish: 'Esto creará una copia de seguridad de sus archivos de audio grabados localmente en una ubicación que elija. Asegúrese de tener suficiente espacio de almacenamiento.'
  },
  backupAudioAction: {
    english: 'Backup Audio Files',
    spanish: 'Hacer Copia de Audio'
  },
  backupCompleteTitle: {
    english: 'Audio Backup Complete',
    spanish: 'Copia de seguridad de audio completa'
  },
  backupErrorTitle: {
    english: 'Audio Backup Finished with Errors',
    spanish: 'Copia de seguridad de audio finalizada con errores'
  },
  audioBackupStatus: {
    english: 'Audio files backed up: {{count}}',
    spanish: 'Archivos de audio respaldados: {{count}}'
  },
  criticalBackupError: {
    english: 'Critical backup error: {{error}}',
    spanish: 'Error crítico de copia de seguridad: {{error}}'
  },
  // Add other keys as needed...
  // --- Sync Feature Translations ---
  storagePermissionDenied: {
    english: 'Storage permission denied. Cannot proceed.',
    spanish: 'Permiso de almacenamiento denegado. No se puede continuar.'
  },
  restoreAndroidOnly: {
    english: 'Restore feature is only available on Android.',
    spanish: 'La función de restauración solo está disponible en Android.'
  },
  failedRestore: {
    english: 'Failed to restore data: {{error}}',
    spanish: 'Error al restaurar datos: {{error}}'
  },
  initializing: {
    english: 'Initializing',
    spanish: 'Inicializando'
  },
  // Re-added keys needed elsewhere
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
  },
  blockThisContent: {
    english: 'Block this content',
    spanish: 'Bloquear este contenido'
  },
  blockThisUser: {
    english: 'Block this user',
    spanish: 'Bloquear este usuario'
  },
  contentBlocked: {
    english: 'Content has been blocked',
    spanish: 'El contenido ha sido bloqueado'
  },
  userBlocked: {
    english: 'User has been blocked',
    spanish: 'El usuario ha sido bloqueado'
  },
  blockedUsers: {
    english: 'Blocked Users',
    spanish: 'Usuarios Bloqueados'
  },
  blockedContent: {
    english: 'Blocked Content',
    spanish: 'Contenido Bloqueado'
  },
  unblockUser: {
    english: 'Unblock User',
    spanish: 'Desbloquear Usuario'
  },
  unblockContent: {
    english: 'Unblock Content',
    spanish: 'Desbloquear Contenido'
  }
} as const;

// Validation code removed as it was unused and causing lint errors
