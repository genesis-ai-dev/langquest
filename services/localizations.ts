// Define all supported UI languages
export type SupportedLanguage = 'english' | 'spanish' | 'brazilian_portuguese';

// Define the structure for translations
export type LocalizationKey = keyof typeof localizations;

// Type to ensure all translations have all supported languages
// type LocalizationSet = Record<SupportedLanguage, string>;

// All UI translations
export const localizations = {
  accept: {
    english: 'Accept',
    spanish: 'Aceptar',
    brazilian_portuguese: 'Aceitar'
  },
  accountNotVerified: {
    english:
      'Please verify your email address before signing in. Check your email for the verification link.',
    spanish:
      'Por favor verifique su dirección de correo electrónico antes de iniciar sesión. Revise su correo electrónico para el enlace de verificación.',
    brazilian_portuguese:
      'Por favor, verifique seu endereço de e-mail antes de fazer login. Verifique seu e-mail para o link de verificação.'
  },
  all: {
    english: 'All',
    spanish: 'Todo',
    brazilian_portuguese: 'Todos'
  },
  apply: {
    english: 'Apply',
    spanish: 'Aplicar',
    brazilian_portuguese: 'Aplicar'
  },
  avatar: {
    english: 'Avatar',
    spanish: 'Avatar',
    brazilian_portuguese: 'Avatar'
  },
  backToLogin: {
    english: 'Back to Login',
    spanish: 'Volver al inicio de sesión',
    brazilian_portuguese: 'Voltar para o Login'
  },
  checkEmail: {
    english: 'Please check your email',
    spanish: 'Por favor revise su correo electrónico',
    brazilian_portuguese: 'Por favor, verifique seu e-mail'
  },
  checkEmailForResetLink: {
    english: 'Please check your email for the password reset link',
    spanish:
      'Por favor revise su correo electrónico para el enlace de restablecimiento de contraseña',
    brazilian_portuguese:
      'Por favor, verifique seu e-mail para o link de redefinição de senha'
  },
  confirmNewPassword: {
    english: 'Confirm New Password',
    spanish: 'Confirmar nueva contraseña',
    brazilian_portuguese: 'Confirmar Nova Senha'
  },
  confirmPassword: {
    english: 'Confirm Password',
    spanish: 'Confirmar contraseña',
    brazilian_portuguese: 'Confirmar Senha'
  },
  date: {
    english: 'Date',
    spanish: 'Fecha',
    brazilian_portuguese: 'Data'
  },
  decline: {
    english: 'Decline',
    spanish: 'Rechazar',
    brazilian_portuguese: 'Rejeitar'
  },
  downloadAnyway: {
    english: 'Download Anyway',
    spanish: 'Descargar de todas formas',
    brazilian_portuguese: 'Descarregar de qualquer forma'
  },
  downloadProject: {
    english: 'Download Project',
    spanish: 'Descargar Proyecto',
    brazilian_portuguese: 'Descarregar Projeto'
  },
  downloadProjectOfflineWarning: {
    english:
      "If you don't download the project, you won't be able to contribute to it offline. You can download it later by pressing the project card's download button.",
    spanish:
      'Si no descargas el proyecto, no podrás contribuir sin conexión. Puedes descargarlo más tarde presionando el botón de descarga en la tarjeta del proyecto.',
    brazilian_portuguese:
      'Se você não baixar o projeto, não poderá contribuir offline. Você pode baixá-lo mais tarde pressionando o botão de download no cartão do projeto.'
  },
  downloadProjectWhenRequestSent: {
    english: 'Download project when request is sent',
    spanish: 'Descargar proyecto cuando se envíe la solicitud',
    brazilian_portuguese: 'Baixar projeto quando a solicitação for enviada'
  },
  email: {
    english: 'Email',
    spanish: 'Email',
    brazilian_portuguese: 'E-mail'
  },
  emailAlreadyMemberMessage: {
    english: 'This email address is already a {role} of this project.',
    spanish:
      'Esta dirección de correo electrónico ya es {role} de este proyecto.',
    brazilian_portuguese: 'Este endereço de e-mail já é {role} deste projeto.'
  },
  emailRequired: {
    english: 'Email is required',
    spanish: 'Se requiere email',
    brazilian_portuguese: 'E-mail é obrigatório'
  },
  enterTranslation: {
    english: 'Enter your translation here',
    spanish: 'Ingrese su traducción aquí',
    brazilian_portuguese: 'Digite sua tradução aqui'
  },
  enterValidEmail: {
    english: 'Please enter a valid email',
    spanish: 'Por favor ingrese un correo electrónico válido',
    brazilian_portuguese: 'Por favor, digite um e-mail válido'
  },
  enterYourEmail: {
    english: 'Enter your email',
    spanish: 'Ingrese su correo electrónico',
    brazilian_portuguese: 'Digite seu e-mail'
  },
  error: {
    english: 'Error',
    spanish: 'Error',
    brazilian_portuguese: 'Erro'
  },
  failedCreateTranslation: {
    english: 'Failed to create translation',
    spanish: 'Error al crear la traducción',
    brazilian_portuguese: 'Falha ao criar tradução'
  },
  failedLoadProjects: {
    english: 'Failed to load projects',
    spanish: 'Error al cargar proyectos',
    brazilian_portuguese: 'Falha ao carregar projetos'
  },
  failedLoadQuests: {
    english: 'Failed to load quests',
    spanish: 'Error al cargar misiones',
    brazilian_portuguese: 'Falha ao carregar missões'
  },
  failedResetPassword: {
    english: 'Failed to reset password',
    spanish: 'Error al restablecer la contraseña',
    brazilian_portuguese: 'Falha ao redefinir senha'
  },
  failedSendResetEmail: {
    english: 'Failed to send reset email',
    spanish: 'Error al enviar el correo de restablecimiento',
    brazilian_portuguese: 'Falha ao enviar e-mail de redefinição'
  },
  failedToAcceptInvitation: {
    english: 'Failed to accept invitation. Please try again.',
    spanish: 'Error al aceptar la invitación. Por favor, inténtelo de nuevo.',
    brazilian_portuguese:
      'Falha ao aceitar o convite. Por favor, tente novamente.'
  },
  failedToDeclineInvitation: {
    english: 'Failed to decline invitation. Please try again.',
    spanish: 'Error al rechazar la invitación. Por favor, inténtelo de nuevo.',
    brazilian_portuguese:
      'Falha ao recusar o convite. Por favor, tente novamente.'
  },
  failedToVote: {
    english: 'Failed to submit vote',
    spanish: 'Error al enviar el voto',
    brazilian_portuguese: 'Falha ao enviar voto'
  },
  fillFields: {
    english: 'Please fill in all required fields',
    spanish: 'Por favor complete todos los campos requeridos',
    brazilian_portuguese: 'Por favor, preencha todos os campos obrigatórios'
  },
  forgotPassword: {
    english: 'I forgot my password',
    spanish: 'Olvidé mi contraseña',
    brazilian_portuguese: 'Esqueci minha senha'
  },
  invalidResetLink: {
    english: 'Invalid or expired reset link',
    spanish: 'Enlace de restablecimiento inválido o expirado',
    brazilian_portuguese: 'Link de redefinição inválido ou expirado'
  },
  logInToTranslate: {
    english: 'You must be logged in to submit translations',
    spanish: 'Debe iniciar sesión para enviar traducciones',
    brazilian_portuguese: 'Você precisa estar logado para enviar traduções'
  },
  logInToVote: {
    english: 'You must be logged in to vote',
    spanish: 'Debe iniciar sesión para votar',
    brazilian_portuguese: 'Você precisa estar logado para votar'
  },
  menu: {
    english: 'Menu',
    spanish: 'Menú',
    brazilian_portuguese: 'Menu'
  },
  newTranslation: {
    english: 'New Translation',
    spanish: 'Nueva Traducción',
    brazilian_portuguese: 'Nova Tradução'
  },
  newUser: {
    english: 'New user?',
    spanish: '¿Usuario nuevo?',
    brazilian_portuguese: 'Novo usuário?'
  },
  newUserRegistration: {
    english: 'New User Registration',
    spanish: 'Registro de nuevo usuario',
    brazilian_portuguese: 'Registro de Novo Usuário'
  },
  noComment: {
    english: 'No Comment',
    spanish: 'Sin comentarios',
    brazilian_portuguese: 'Sem Comentários'
  },
  noProject: {
    english: 'No active project found',
    spanish: 'No se encontró ningún proyecto activo',
    brazilian_portuguese: 'Nenhum projeto ativo encontrado'
  },
  ok: {
    english: 'OK',
    spanish: 'OK',
    brazilian_portuguese: 'OK'
  },
  offline: {
    english: 'Offline',
    spanish: 'Sin conexión',
    brazilian_portuguese: 'Offline'
  },
  password: {
    english: 'Password',
    spanish: 'Contraseña',
    brazilian_portuguese: 'Senha'
  },
  passwordRequired: {
    english: 'Password is required',
    spanish: 'Se requiere contraseña',
    brazilian_portuguese: 'Senha é obrigatória'
  },
  passwordMinLength: {
    english: 'Password must be at least 6 characters',
    spanish: 'La contraseña debe tener al menos 6 caracteres',
    brazilian_portuguese: 'A senha deve ter pelo menos 6 caracteres'
  },
  passwordsNoMatch: {
    english: 'Passwords do not match',
    spanish: 'Las contraseñas no coinciden',
    brazilian_portuguese: 'As senhas não coincidem'
  },
  passwordResetSuccess: {
    english: 'Password has been reset successfully',
    spanish: 'La contraseña se ha restablecido correctamente',
    brazilian_portuguese: 'A senha foi redefinida com sucesso'
  },
  projectDownloadFailed: {
    english:
      'Invitation accepted, but project download failed. You can download it later from the projects page.',
    spanish:
      'Invitación aceptada, pero la descarga del proyecto falló. Puede descargarla más tarde desde la página de proyectos.',
    brazilian_portuguese:
      'Convite aceito, mas a descarga do projeto falhou. Você pode baixá-lo mais tarde na página de projetos.'
  },
  projects: {
    english: 'Projects',
    spanish: 'Proyectos',
    brazilian_portuguese: 'Projetos'
  },
  quests: {
    english: 'Quests',
    spanish: 'Misiones',
    brazilian_portuguese: 'Missões'
  },
  questOptions: {
    english: 'Quest Options',
    spanish: 'Opciones de misión',
    brazilian_portuguese: 'Opções de Missão'
  },
  recording: {
    english: 'Recording',
    spanish: 'Grabando',
    brazilian_portuguese: 'Gravando'
  },
  register: {
    english: 'Register',
    spanish: 'Registrarse',
    brazilian_portuguese: 'Registrar'
  },
  registrationFail: {
    english: 'Registration failed',
    spanish: 'Error en el registro',
    brazilian_portuguese: 'Falha no registro'
  },
  registrationSuccess: {
    english: 'Registration successful',
    spanish: 'Registro exitoso',
    brazilian_portuguese: 'Registro bem-sucedido'
  },
  resetPassword: {
    english: 'Reset Password',
    spanish: 'Restablecer contraseña',
    brazilian_portuguese: 'Redefinir Senha'
  },
  returningHero: {
    english: 'Returning hero? Sign In',
    spanish: '¿Héroe que regresa? Inicia sesión',
    brazilian_portuguese: 'Herói retornando? Faça Login'
  },
  search: {
    english: 'Search...',
    spanish: 'Buscar...',
    brazilian_portuguese: 'Buscar...'
  },
  searchAssets: {
    english: 'Search assets...',
    spanish: 'Buscar recursos...',
    brazilian_portuguese: 'Buscar recursos...'
  },
  noAssetsFound: {
    english: 'No assets found',
    spanish: 'No se encontraron recursos',
    brazilian_portuguese: 'Nenhum recurso encontrado'
  },
  searchQuests: {
    english: 'Search quests...',
    spanish: 'Buscar misiones...',
    brazilian_portuguese: 'Buscar missões...'
  },
  selectItem: {
    english: 'Select item',
    spanish: 'Seleccionar elemento',
    brazilian_portuguese: 'Selecionar item'
  },
  selectLanguage: {
    english: 'Please select a language',
    spanish: 'Por favor seleccione un idioma',
    brazilian_portuguese: 'Por favor, selecione um idioma'
  },
  sendResetEmail: {
    english: 'Send Reset Email',
    spanish: 'Enviar correo de restablecimiento',
    brazilian_portuguese: 'Enviar E-mail de Redefinição'
  },
  signIn: {
    english: 'Sign In',
    spanish: 'Iniciar Sesión',
    brazilian_portuguese: 'Entrar'
  },
  signInError: {
    english: 'Something went wrong… Please, check your email and password.',
    spanish: 'Algo salió mal… Por favor, revisa tu correo y contraseña.',
    brazilian_portuguese:
      'Algo deu errado… Por favor, verifique seu e-mail e senha.'
  },
  logOut: {
    english: 'Log Out',
    spanish: 'Cerrar Sesión',
    brazilian_portuguese: 'Sair'
  },
  sortBy: {
    english: 'Sort by',
    spanish: 'Ordenar por',
    brazilian_portuguese: 'Ordenar por'
  },
  source: {
    english: 'Source',
    spanish: 'Fuente',
    brazilian_portuguese: 'Fonte'
  },
  submit: {
    english: 'Submit',
    spanish: 'Enviar',
    brazilian_portuguese: 'Enviar'
  },
  success: {
    english: 'Success',
    spanish: 'Éxito',
    brazilian_portuguese: 'Sucesso'
  },
  target: {
    english: 'Target',
    spanish: 'Objetivo',
    brazilian_portuguese: 'Alvo'
  },
  username: {
    english: 'Username',
    spanish: 'Nombre de usuario',
    brazilian_portuguese: 'Nome de usuário'
  },
  usernameRequired: {
    english: 'Username is required',
    spanish: 'Se requiere nombre de usuario',
    brazilian_portuguese: 'Nome de usuário é obrigatório'
  },
  votes: {
    english: 'Votes',
    spanish: 'Votos',
    brazilian_portuguese: 'Votos'
  },
  warning: {
    english: 'Warning',
    spanish: 'Advertencia',
    brazilian_portuguese: 'Aviso'
  },
  welcome: {
    english: 'Welcome back, hero!',
    spanish: '¡Bienvenido de nuevo, héroe!',
    brazilian_portuguese: 'Bem-vindo de volta, herói!'
  },
  recentlyVisited: {
    english: 'Recently Visited',
    spanish: 'Recientemente visitado',
    brazilian_portuguese: 'Visitados Recentemente'
  },
  assets: {
    english: 'Assets',
    spanish: 'Recursos',
    brazilian_portuguese: 'Recursos'
  },
  remaining: {
    english: 'remaining',
    spanish: 'restante',
    brazilian_portuguese: 'restante'
  },
  noNotifications: {
    english: 'No notifications',
    spanish: 'No hay notificaciones',
    brazilian_portuguese: 'Nenhuma notificação'
  },
  noNotificationsSubtext: {
    english: "You'll see project invitations and join requests here",
    spanish: 'Aquí verás invitaciones a proyectos y solicitudes de unión',
    brazilian_portuguese:
      'Aqui você verá convites para projetos e solicitações de união'
  },
  notifications: {
    english: 'Notifications',
    spanish: 'Notificaciones',
    brazilian_portuguese: 'Notificações'
  },
  profile: {
    english: 'Profile',
    spanish: 'Perfil',
    brazilian_portuguese: 'Perfil'
  },
  settings: {
    english: 'Settings',
    spanish: 'Configuración',
    brazilian_portuguese: 'Configurações'
  },
  changePassword: {
    english: 'Change Password',
    spanish: 'Cambiar Contraseña',
    brazilian_portuguese: 'Alterar Senha'
  },
  currentPassword: {
    english: 'Current Password',
    spanish: 'Contraseña Actual',
    brazilian_portuguese: 'Senha Atual'
  },
  newPassword: {
    english: 'New Password',
    spanish: 'Nueva Contraseña',
    brazilian_portuguese: 'Nova Senha'
  },
  onlineOnlyFeatures: {
    english: 'Password changes are only available when online',
    spanish:
      'Los cambios de contraseña solo están disponibles cuando está en línea',
    brazilian_portuguese:
      'Alterações de senha só estão disponíveis quando você está online'
  },
  termsAndPrivacyTitle: {
    english: 'Terms & Privacy',
    spanish: 'Términos y Privacidad',
    brazilian_portuguese: 'Termos e Privacidade'
  },
  verificationRequired: {
    english: 'Verification Required',
    spanish: 'Verificación Requerida',
    brazilian_portuguese: 'Verificação Necessária'
  },
  agreeToTerms: {
    english: 'I have read and agree to the Terms & Privacy',
    spanish: 'He leído y acepto los Términos y Privacidad',
    brazilian_portuguese: 'Eu li e concordo com os Termos e Privacidade'
  },
  viewTerms: {
    english: 'View Terms and Privacy',
    spanish: 'Ver Términos y Privacidad',
    brazilian_portuguese: 'Ver Termos e Privacidade'
  },
  termsRequired: {
    english: 'You must agree to the Terms and Privacy',
    spanish: 'Debe aceptar los Términos y Privacidad',
    brazilian_portuguese: 'Você deve concordar com os Termos e Privacidade'
  },
  processing: {
    english: 'Processing...',
    spanish: 'Procesando...',
    brazilian_portuguese: 'Processando...'
  },
  termsContributionInfo: {
    english:
      'By accepting these terms, you agree that all content you contribute to LangQuest will be freely available worldwide under the CC0 1.0 Universal (CC0 1.0) Public Domain Dedication.',
    spanish:
      'Al aceptar estos términos, acepta que todo el contenido que aporte a LangQuest estará disponible gratuitamente en todo el mundo bajo la Dedicación de Dominio Público CC0 1.0 Universal (CC0 1.0).',
    brazilian_portuguese:
      'Ao aceitar estes termos, você concorda que todo o conteúdo que você contribuir para o LangQuest estará disponível gratuitamente em todo o mundo sob a Dedicação ao Domínio Público CC0 1.0 Universal (CC0 1.0).'
  },
  termsDataInfo: {
    english:
      'This means your contributions can be used by anyone for any purpose without attribution. We collect minimal user data: only your email (for account recovery) and newsletter subscription if opted in.',
    spanish:
      'Esto significa que sus contribuciones pueden ser utilizadas por cualquier persona para cualquier propósito sin atribución. Recopilamos datos mínimos de usuario: solo su correo electrónico (para recuperación de cuenta) y suscripción al boletín si se inscribe.',
    brazilian_portuguese:
      'Isso significa que suas contribuições podem ser usadas por qualquer pessoa para qualquer finalidade sem atribuição. Coletamos dados mínimos de usuário: apenas seu e-mail (para recuperação de conta) e assinatura de newsletter se você optar por isso.'
  },
  analyticsInfo: {
    english:
      'We collect analytics and diagnostic data to improve the app and your experience. You can opt out of analytics at any time in your profile settings. Your data is processed and stored in the United States.',
    spanish:
      'Recopilamos datos de análisis y diagnóstico para mejorar la aplicación y su experiencia. Puede optar por no participar en el análisis en cualquier momento en sus ajustes. Sus datos se procesan y almacenan en los Estados Unidos.',
    brazilian_portuguese:
      'Coletamos dados analíticos e de diagnóstico para melhorar o aplicativo e sua experiência. Você pode optar por não participar da análise a qualquer momento nas configurações do seu perfil. Seus dados são processados e armazenados nos Estados Unidos.'
  },
  viewFullTerms: {
    english: 'View Full Terms',
    spanish: 'Ver Términos Completos',
    brazilian_portuguese: 'Ver Termos Completos'
  },
  viewFullPrivacy: {
    english: 'View Full Privacy',
    spanish: 'Ver Privacidad Completa',
    brazilian_portuguese: 'Ver Privacidade Completa'
  },
  submitFeedback: {
    english: 'Submit App Feedback',
    spanish: 'Enviar Feedback de la App',
    brazilian_portuguese: 'Enviar Feedback do App'
  },
  reportTranslation: {
    english: 'Report Translation',
    spanish: 'Reportar Traducción',
    brazilian_portuguese: 'Reportar Tradução'
  },
  selectReasonLabel: {
    english: 'Select a reason',
    spanish: 'Seleccione un motivo',
    brazilian_portuguese: 'Selecione um motivo'
  },
  additionalDetails: {
    english: 'Additional Details',
    spanish: 'Detalles Adicionales',
    brazilian_portuguese: 'Detalhes Adicionais'
  },
  additionalDetailsPlaceholder: {
    english: 'Provide any additional information...',
    spanish: 'Proporcionar cualquier información adicional...',
    brazilian_portuguese: 'Forneça qualquer informação adicional...'
  },
  submitReport: {
    english: 'Submit Report',
    spanish: 'Enviar Reporte',
    brazilian_portuguese: 'Enviar Relatório'
  },
  submitting: {
    english: 'Submitting...',
    spanish: 'Enviando...',
    brazilian_portuguese: 'Enviando...'
  },
  reportSubmitted: {
    english: 'Report submitted successfully',
    spanish: 'Reporte enviado exitosamente',
    brazilian_portuguese: 'Relatório enviado com sucesso'
  },
  enterEmailForPasswordReset: {
    english: 'Enter your email to reset your password',
    spanish: 'Ingrese su correo electrónico para restablecer su contraseña',
    brazilian_portuguese: 'Digite seu e-mail para redefinir sua senha'
  },
  failedToSubmitReport: {
    english: 'Failed to submit report',
    spanish: 'Error al enviar el reporte',
    brazilian_portuguese: 'Falha ao enviar relatório'
  },
  logInToReport: {
    english: 'You must be logged in to report translations',
    spanish: 'Debe iniciar sesión para reportar traducciones',
    brazilian_portuguese: 'Você deve estar logado para reportar traduções'
  },
  selectReason: {
    english: 'Please select a reason for the report',
    spanish: 'Por favor seleccione un motivo para el reporte',
    brazilian_portuguese: 'Por favor, selecione um motivo para o relatório'
  },
  analyticsOptInLabel: {
    english: 'Enable Analytics',
    spanish: 'Habilitar Análisis',
    brazilian_portuguese: 'Habilitar Análise'
  },
  analyticsOptInDescription: {
    english:
      'When disabled, we will not collect usage data to improve the app.',
    spanish:
      'Cuando está deshabilitado, no recopilaremos datos de uso para mejorar la aplicación.',
    brazilian_portuguese:
      'Quando desativado, não coletaremos dados de uso para melhorar o aplicativo.'
  },
  sessionExpired: {
    english: 'Session expired',
    spanish: 'Sesión expirada',
    brazilian_portuguese: 'Sessão expirada'
  },
  'reportReason.inappropriate_content': {
    english: 'Inappropriate Content',
    spanish: 'Contenido Inapropiado',
    brazilian_portuguese: 'Conteúdo Inapropriado'
  },
  'reportReason.spam': {
    english: 'Spam',
    spanish: 'Spam',
    brazilian_portuguese: 'Spam'
  },
  'reportReason.other': {
    english: 'Other',
    spanish: 'Otro',
    brazilian_portuguese: 'Outro'
  },
  updatePassword: {
    english: 'Update Password',
    spanish: 'Actualizar Contraseña',
    brazilian_portuguese: 'Atualizar Senha'
  },
  createNewPassword: {
    english: 'Create New Password',
    spanish: 'Crear nueva contraseña',
    brazilian_portuguese: 'Criar nova senha'
  },
  downloadLimitExceeded: {
    english: 'Download Limit Exceeded',
    spanish: 'Límite de descarga excedido',
    brazilian_portuguese: 'Limite de download excedido'
  },
  downloadLimitMessage: {
    english:
      'You are trying to download {newDownloads} attachments for a total of {totalDownloads}, but the limit is {limit}. Please deselect some downloads and try again.',
    spanish:
      'Está intentando descargar {newDownloads} archivos adjuntos para un total de {totalDownloads}, pero el límite es {limit}. Por favor, deseleccione algunas descargas e intente nuevamente.',
    brazilian_portuguese:
      'Você está tentando baixar {newDownloads} anexos para um total de {totalDownloads}, mas o limite é {limit}. Por favor, desmarque alguns downloads e tente novamente.'
  },
  offlineUndownloadWarning: {
    english: 'Offline Undownload Warning',
    spanish: 'Advertencia de eliminación sin conexión',
    brazilian_portuguese: 'Aviso de remoção de download offline'
  },
  offlineUndownloadMessage: {
    english:
      "You are currently offline. If you remove this download, you won't be able to redownload it until you're back online. Your unsynced contributions will not be affected.",
    spanish:
      'Actualmente estás sin conexión. Si eliminas esta descarga, no podrás volver a descargarla hasta que vuelvas a estar en línea. Tus contribuciones no sincronizadas no se verán afectadas.',
    brazilian_portuguese:
      'Você está offline no momento. Se você remover este download, não poderá baixá-lo novamente até voltar a ficar online. Suas contribuições não sincronizadas não serão afetadas.'
  },
  dontShowAgain: {
    english: "Don't show this message again",
    spanish: 'No mostrar este mensaje nuevamente',
    brazilian_portuguese: 'Não mostrar esta mensagem novamente'
  },
  cancel: {
    english: 'Cancel',
    spanish: 'Cancelar',
    brazilian_portuguese: 'Cancelar'
  },
  confirm: {
    english: 'Confirm',
    spanish: 'Confirmar',
    brazilian_portuguese: 'Confirmar'
  },
  blockThisContent: {
    english: 'Block this content',
    spanish: 'Bloquear este contenido',
    brazilian_portuguese: 'Bloquear este conteúdo'
  },
  blockThisUser: {
    english: 'Block this user',
    spanish: 'Bloquear este usuario',
    brazilian_portuguese: 'Bloquear este usuário'
  },
  // New backup-related translations
  backup: {
    english: 'Backup',
    spanish: 'Respaldo',
    brazilian_portuguese: 'Backup'
  },
  backingUp: {
    english: 'Backing Up...',
    spanish: 'Respaldando...',
    brazilian_portuguese: 'Fazendo Backup...'
  },
  restoreBackup: {
    english: 'Restore Backup',
    spanish: 'Restaurar Respaldo',
    brazilian_portuguese: 'Restaurar Backup'
  },
  restoring: {
    english: 'Restoring...',
    spanish: 'Restaurando...',
    brazilian_portuguese: 'Restaurando...'
  },
  startBackupTitle: {
    english: 'Create Backup',
    spanish: 'Crear Respaldo',
    brazilian_portuguese: 'Criar Backup'
  },
  startBackupMessageAudioOnly: {
    english: 'Would you like to back up your unsynced audio recordings?',
    spanish:
      '¿Desea hacer una copia de seguridad de sus grabaciones de audio no sincronizadas?',
    brazilian_portuguese:
      'Gostaria de fazer backup das suas gravações de áudio não sincronizadas?'
  },
  backupAudioAction: {
    english: 'Backup Audio',
    spanish: 'Respaldar Audio',
    brazilian_portuguese: 'Backup de Áudio'
  },
  backupErrorTitle: {
    english: 'Backup Error',
    spanish: 'Error de Respaldo',
    brazilian_portuguese: 'Erro de Backup'
  },
  backupCompleteTitle: {
    english: 'Backup Complete',
    spanish: 'Respaldo Completado',
    brazilian_portuguese: 'Backup Concluído'
  },
  audioBackupStatus: {
    english: 'Successfully backed up {count} audio recordings',
    spanish: 'Se respaldaron con éxito {count} grabaciones de audio',
    brazilian_portuguese:
      'Backup de {count} gravações de áudio concluído com sucesso'
  },
  criticalBackupError: {
    english: 'A critical error occurred: {error}',
    spanish: 'Ocurrió un error crítico: {error}',
    brazilian_portuguese: 'Ocorreu um erro crítico: {error}'
  },
  databaseNotReady: {
    english: 'Database is not ready. Please try again later.',
    spanish: 'La base de datos no está lista. Por favor, inténtelo más tarde.',
    brazilian_portuguese:
      'O banco de dados não está pronto. Por favor, tente novamente mais tarde.'
  },
  storagePermissionDenied: {
    english: 'Storage permission denied. Backup cannot proceed.',
    spanish:
      'Permiso de almacenamiento denegado. El respaldo no puede continuar.',
    brazilian_portuguese:
      'Permissão de armazenamento negada. O backup não pode prosseguir.'
  },
  // Adding missing translation keys
  initializing: {
    english: 'Initializing',
    spanish: 'Inicializando',
    brazilian_portuguese: 'Inicializando'
  },
  syncComplete: {
    english: 'Sync complete',
    spanish: 'Sincronización completa',
    brazilian_portuguese: 'Sincronização completa'
  },
  syncProgress: {
    english: '{current} of {total} files',
    spanish: '{current} de {total} archivos',
    brazilian_portuguese: '{current} de {total} arquivos'
  },
  userNotLoggedIn: {
    english: 'You must be logged in to perform this action',
    spanish: 'Debe iniciar sesión para realizar esta acción',
    brazilian_portuguese: 'Você deve estar logado para realizar esta ação'
  },
  cannotReportOwnTranslation: {
    english: 'You cannot report your own translation',
    spanish: 'No puede reportar su propia traducción',
    brazilian_portuguese: 'Você não pode reportar sua própria tradução'
  },
  cannotReportInactiveTranslation: {
    english: 'You cannot report inactive translation',
    spanish: 'No puede reportar traducción inactiva',
    brazilian_portuguese: 'Você não pode reportar tradução inativa'
  },
  cannotIdentifyUser: {
    english: 'Unable to identify user',
    spanish: 'No se puede identificar al usuario',
    brazilian_portuguese: 'Não foi possível identificar o usuário'
  },
  cannotChangeTranslationSettings: {
    english: 'Unathorized to change settings for this translation',
    spanish:
      'No tiene autorización para cambiar la configuración de esta traducción',
    brazilian_portuguese:
      'Você não tem autorização para alterar as configurações desta tradução'
  },
  alreadyReportedTranslation: {
    english: 'You have already reported this translation',
    spanish: 'Ya ha reportado esta traducción',
    brazilian_portuguese: 'Você já reportou esta tradução'
  },
  failedSaveAnalyticsPreference: {
    english: 'Failed to save analytics preference',
    spanish: 'Error al guardar la preferencia de análisis',
    brazilian_portuguese: 'Falha ao salvar preferência de análise'
  },
  currentPasswordRequired: {
    english: 'Current password is required',
    spanish: 'Se requiere la contraseña actual',
    brazilian_portuguese: 'A senha atual é obrigatória'
  },
  profileUpdateSuccess: {
    english: 'Profile updated successfully',
    spanish: 'Perfil actualizado con éxito',
    brazilian_portuguese: 'Perfil atualizado com sucesso'
  },
  failedUpdateProfile: {
    english: 'Failed to update profile',
    spanish: 'Error al actualizar el perfil',
    brazilian_portuguese: 'Falha ao atualizar perfil'
  },
  assetNotFound: {
    english: 'Asset not found',
    spanish: 'Recurso no encontrado',
    brazilian_portuguese: 'Recurso não encontrado'
  },
  failedLoadAssetData: {
    english: 'Failed to load asset data',
    spanish: 'Error al cargar datos del recurso',
    brazilian_portuguese: 'Falha ao carregar dados do recurso'
  },
  failedLoadAssets: {
    english: 'Failed to load assets',
    spanish: 'Error al cargar recursos',
    brazilian_portuguese: 'Falha ao carregar recursos'
  },
  projectMembers: {
    english: 'Project Members',
    spanish: 'Miembros del Proyecto',
    brazilian_portuguese: 'Membros do Projeto'
  },
  members: {
    english: 'Members',
    spanish: 'Miembros',
    brazilian_portuguese: 'Membros'
  },
  invited: {
    english: 'Invited',
    spanish: 'Invitados',
    brazilian_portuguese: 'Convidados'
  },
  inviteMembers: {
    english: 'Invite Members',
    spanish: 'Invitar Miembros',
    brazilian_portuguese: 'Convidar Membros'
  },
  inviteAsOwner: {
    english: 'Invite as owner',
    spanish: 'Invitar como propietario',
    brazilian_portuguese: 'Convidar como proprietário'
  },
  sendInvitation: {
    english: 'Send Invitation',
    spanish: 'Enviar Invitación',
    brazilian_portuguese: 'Enviar Convite'
  },
  owner: {
    english: 'Owner',
    spanish: 'Propietario',
    brazilian_portuguese: 'Proprietário'
  },
  member: {
    english: 'Member',
    spanish: 'Miembro',
    brazilian_portuguese: 'Membro'
  },
  makeOwner: {
    english: 'Make Owner',
    spanish: 'Hacer Propietario',
    brazilian_portuguese: 'Tornar Proprietário'
  },
  remove: {
    english: 'Remove',
    spanish: 'Eliminar',
    brazilian_portuguese: 'Remover'
  },
  withdrawInvite: {
    english: 'Withdraw Invite',
    spanish: 'Retirar Invitación',
    brazilian_portuguese: 'Retirar Convite'
  },
  you: {
    english: 'You',
    spanish: 'Tú',
    brazilian_portuguese: 'Você'
  },
  pendingInvitation: {
    english: 'Pending',
    spanish: 'Pendiente',
    brazilian_portuguese: 'Pendente'
  },
  noMembers: {
    english: 'No members yet',
    spanish: 'No hay miembros todavía',
    brazilian_portuguese: 'Ainda não há membros'
  },
  noInvitations: {
    english: 'No pending invitations',
    spanish: 'No hay invitaciones pendientes',
    brazilian_portuguese: 'Nenhum convite pendente'
  },
  ownerTooltip: {
    english:
      'Owners can create content, invite and promote other members, and cannot be demoted back to membership or removed from a project by other members.',
    spanish:
      'Los propietarios pueden crear contenido, invitar y promover a otros miembros, y no pueden ser degradados a miembros o eliminados de un proyecto por otros miembros.',
    brazilian_portuguese:
      'Proprietários podem criar conteúdo, convidar e promover outros membros, e não podem ser rebaixados de volta à associação ou removidos de um projeto por outros membros.'
  },
  confirmRemoveMessage: {
    english: 'Are you sure you want to remove {name} from this project?',
    spanish: '¿Está seguro de que desea eliminar a {name} de este proyecto?',
    brazilian_portuguese:
      'Tem certeza de que deseja remover {name} deste projeto?'
  },
  confirmPromote: {
    english: 'Confirm Promote',
    spanish: 'Confirmar Promoción',
    brazilian_portuguese: 'Confirmar Promoção'
  },
  confirmPromoteMessage: {
    english:
      'Are you sure you want to make {name} an owner? This action cannot be undone.',
    spanish:
      '¿Está seguro de que desea hacer a {name} propietario? Esta acción no se puede deshacer.',
    brazilian_portuguese:
      'Tem certeza de que deseja tornar {name} um proprietário? Esta ação não pode ser desfeita.'
  },
  confirmLeave: {
    english: 'Leave Project',
    spanish: 'Abandonar Proyecto',
    brazilian_portuguese: 'Sair do Projeto'
  },
  confirmLeaveMessage: {
    english: 'Are you sure you want to leave this project?',
    spanish: '¿Está seguro de que desea abandonar este proyecto?',
    brazilian_portuguese: 'Tem certeza de que deseja sair deste projeto?'
  },
  cannotLeaveAsOnlyOwner: {
    english:
      'You cannot leave this project as you are the only owner. Please promote another member to owner first.',
    spanish:
      'No puede abandonar este proyecto porque es el único propietario. Por favor, promueva a otro miembro a propietario primero.',
    brazilian_portuguese:
      'Você não pode sair deste projeto porque é o único proprietário. Por favor, promova outro membro a proprietário primeiro.'
  },
  invitationAlreadySent: {
    english: 'An invitation has already been sent to this email address.',
    spanish:
      'Ya se ha enviado una invitación a esta dirección de correo electrónico.',
    brazilian_portuguese:
      'Um convite já foi enviado para este endereço de e-mail.'
  },
  invitationSent: {
    english: 'Invitation sent successfully',
    spanish: 'Invitación enviada con éxito',
    brazilian_portuguese: 'Convite enviado com sucesso'
  },
  expiredInvitation: {
    english: 'Expired',
    spanish: 'Expirado',
    brazilian_portuguese: 'Expirado'
  },
  declinedInvitation: {
    english: 'Declined',
    spanish: 'Rechazado',
    brazilian_portuguese: 'Recusado'
  },
  withdrawnInvitation: {
    english: 'Withdrawn',
    spanish: 'Retirado',
    brazilian_portuguese: 'Retirado'
  },
  sending: {
    english: 'Sending...',
    spanish: 'Enviando...',
    brazilian_portuguese: 'Enviando...'
  },
  failedToRemoveMember: {
    english: 'Failed to remove member',
    spanish: 'Error al eliminar miembro',
    brazilian_portuguese: 'Falha ao remover membro'
  },
  failedToPromoteMember: {
    english: 'Failed to promote member',
    spanish: 'Error al promover miembro',
    brazilian_portuguese: 'Falha ao promover membro'
  },
  failedToLeaveProject: {
    english: 'Failed to leave project',
    spanish: 'Error al abandonar el proyecto',
    brazilian_portuguese: 'Falha ao sair do projeto'
  },
  failedToWithdrawInvitation: {
    english: 'Failed to withdraw invitation',
    spanish: 'Error al retirar la invitación',
    brazilian_portuguese: 'Falha ao retirar o convite'
  },
  failedToSendInvitation: {
    english: 'Failed to send invitation',
    spanish: 'Error al enviar la invitación',
    brazilian_portuguese: 'Falha ao enviar o convite'
  },
  privateProject: {
    english: 'Private Project',
    spanish: 'Proyecto Privado',
    brazilian_portuguese: 'Projeto Privado'
  },
  privateProjectDescription: {
    english:
      'This is a private project. Only members and owners can contribute translations and votes.',
    spanish:
      'Este es un proyecto privado. Solo los miembros y propietarios pueden contribuir con traducciones y votos.',
    brazilian_portuguese:
      'Este é um projeto privado. Apenas membros e proprietários podem contribuir com traduções e votos.'
  },
  privateProjectInfo: {
    english:
      'To contribute to this project, you need to request membership. Project owners will review your request.',
    spanish:
      'Para contribuir a este proyecto, debe solicitar membresía. Los propietarios del proyecto revisarán su solicitud.',
    brazilian_portuguese:
      'Para contribuir com este projeto, você precisa solicitar associação. Os proprietários do projeto analisarão sua solicitação.'
  },
  privateProjectNotLoggedIn: {
    english:
      'This is a private project. You must be logged in to request access.',
    spanish:
      'Este es un proyecto privado. Debe iniciar sesión para solicitar acceso.',
    brazilian_portuguese:
      'Este é um projeto privado. Você deve estar logado para solicitar acesso.'
  },
  privateProjectLoginRequired: {
    english: 'Please sign in to request membership to this private project.',
    spanish:
      'Por favor, inicie sesión para solicitar membresía a este proyecto privado.',
    brazilian_portuguese:
      'Por favor, faça login para solicitar associação a este projeto privado.'
  },
  requestMembership: {
    english: 'Request Membership',
    spanish: 'Solicitar Membresía',
    brazilian_portuguese: 'Solicitar Associação'
  },
  requesting: {
    english: 'Requesting...',
    spanish: 'Solicitando...',
    brazilian_portuguese: 'Solicitando...'
  },
  requestPending: {
    english: 'Request Pending',
    spanish: 'Solicitud Pendiente',
    brazilian_portuguese: 'Solicitação Pendente'
  },
  requestPendingDescription: {
    english: 'Your membership request is pending review by the project owners.',
    spanish:
      'Su solicitud de membresía está pendiente de revisión por los propietarios del proyecto.',
    brazilian_portuguese:
      'Sua solicitação de associação está pendente de análise pelos proprietários do projeto.'
  },
  withdrawRequest: {
    english: 'Withdraw Request',
    spanish: 'Retirar Solicitud',
    brazilian_portuguese: 'Retirar Solicitação'
  },
  withdrawing: {
    english: 'Withdrawing...',
    spanish: 'Retirando...',
    brazilian_portuguese: 'Retirando...'
  },
  confirmWithdraw: {
    english: 'Withdraw Request',
    spanish: 'Retirar Solicitud',
    brazilian_portuguese: 'Retirar Solicitação'
  },
  confirmWithdrawRequestMessage: {
    english: 'Are you sure you want to withdraw your membership request?',
    spanish: '¿Está seguro de que desea retirar su solicitud de membresía?',
    brazilian_portuguese:
      'Tem certeza de que deseja retirar sua solicitação de associação?'
  },
  requestWithdrawn: {
    english: 'Request withdrawn successfully',
    spanish: 'Solicitud retirada con éxito',
    brazilian_portuguese: 'Solicitação retirada com sucesso'
  },
  requestExpired: {
    english: 'Request Expired',
    spanish: 'Solicitud Expirada',
    brazilian_portuguese: 'Solicitação Expirada'
  },
  requestExpiredDescription: {
    english:
      'Your membership request has expired. You can submit a new request.',
    spanish:
      'Su solicitud de membresía ha expirado. Puede enviar una nueva solicitud.',
    brazilian_portuguese:
      'Sua solicitação de associação expirou. Você pode enviar uma nova solicitação.'
  },
  requestAgain: {
    english: 'Request Again',
    spanish: 'Solicitar Nuevamente',
    brazilian_portuguese: 'Solicitar Novamente'
  },
  requestDeclined: {
    english: 'Request Declined',
    spanish: 'Solicitud Rechazada',
    brazilian_portuguese: 'Solicitação Recusada'
  },
  requestDeclinedCanRetry: {
    english:
      'Your membership request was declined. You have {attempts} more attempts to request membership.',
    spanish:
      'Su solicitud de membresía fue rechazada. Tiene {attempts} intentos más para solicitar membresía.',
    brazilian_portuguese:
      'Sua solicitação de associação foi recusada. Você tem {attempts} tentativas restantes para solicitar associação.'
  },
  requestDeclinedNoRetry: {
    english:
      'Your membership request was declined and you have reached the maximum number of attempts.',
    spanish:
      'Su solicitud de membresía fue rechazada y ha alcanzado el número máximo de intentos.',
    brazilian_portuguese:
      'Sua solicitação de associação foi recusada e você atingiu o número máximo de tentativas.'
  },
  requestWithdrawnTitle: {
    english: 'Request Withdrawn',
    spanish: 'Solicitud Retirada',
    brazilian_portuguese: 'Solicitação Retirada'
  },
  requestWithdrawnDescription: {
    english:
      'You have withdrawn your membership request. You can submit a new request at any time.',
    spanish:
      'Ha retirado su solicitud de membresía. Puede enviar una nueva solicitud en cualquier momento.',
    brazilian_portuguese:
      'Você retirou sua solicitação de associação. Você pode enviar uma nova solicitação a qualquer momento.'
  },
  membershipRequestSent: {
    english: 'Membership request sent successfully',
    spanish: 'Solicitud de membresía enviada con éxito',
    brazilian_portuguese: 'Solicitação de associação enviada com sucesso'
  },
  failedToRequestMembership: {
    english: 'Failed to request membership',
    spanish: 'Error al solicitar membresía',
    brazilian_portuguese: 'Falha ao solicitar associação'
  },
  failedToWithdrawRequest: {
    english: 'Failed to withdraw request',
    spanish: 'Error al retirar la solicitud',
    brazilian_portuguese: 'Falha ao retirar a solicitação'
  },
  goBack: {
    english: 'Go Back',
    spanish: 'Volver',
    brazilian_portuguese: 'Voltar'
  },
  confirmRemove: {
    english: 'Confirm Remove',
    spanish: 'Confirmar Eliminación',
    brazilian_portuguese: 'Confirmar Remoção'
  },
  invitationResent: {
    english: 'Invitation resent successfully',
    spanish: 'Invitación reenviada con éxito',
    brazilian_portuguese: 'Convite reenviado com sucesso'
  },
  maxInviteAttemptsReached: {
    english: 'Maximum invitation attempts reached for this email',
    spanish:
      'Se alcanzó el número máximo de intentos de invitación para este correo',
    brazilian_portuguese:
      'Número máximo de tentativas de convite atingido para este e-mail'
  },
  invitationAcceptedButDownloadFailed: {
    english:
      'Invitation accepted, but project download failed. You can download it later from the projects page.',
    spanish:
      'Invitación aceptada, pero la descarga del proyecto falló. Puedes descargarlo más tarde desde la página de proyectos.',
    brazilian_portuguese:
      'Convite aceito, mas o download do projeto falhou. Você pode baixá-lo mais tarde na página de projetos.'
  },
  invitationAcceptedSuccess: {
    english: 'Invitation accepted successfully!',
    spanish: '¡Invitación aceptada con éxito!',
    brazilian_portuguese: 'Convite aceito com sucesso!'
  },
  invitationDeclined: {
    english: 'Invitation declined.',
    spanish: 'Invitación rechazada.',
    brazilian_portuguese: 'Convite recusado.'
  },
  joinRequest: {
    english: 'Join Request',
    spanish: 'Solicitud de Unión',
    brazilian_portuguese: 'Solicitação de Adesão'
  },
  privateProjectAccess: {
    english: 'Private Project Access',
    spanish: 'Acceso a Proyecto Privado',
    brazilian_portuguese: 'Acesso ao Projeto Privado'
  },
  privateProjectDownload: {
    english: 'Private Project Download',
    spanish: 'Descarga de Proyecto Privado',
    brazilian_portuguese: 'Download de Projeto Privado'
  },
  privateProjectDownloadMessage: {
    english:
      'This project is private. You can download the content but will not be able to contribute translations or votes. Request access to join this project and start contributing.',
    spanish:
      'Este proyecto es privado. Puedes descargar el contenido pero no podrás contribuir con traducciones o votos. Solicita acceso para unirte a este proyecto y comenzar a contribuir.',
    brazilian_portuguese:
      'Este projeto é privado. Você pode baixar o conteúdo, mas não poderá contribuir com traduções ou votos. Solicite acesso para participar deste projeto e começar a contribuir.'
  },
  privateProjectEditing: {
    english: 'Private Project Editing',
    spanish: 'Edición de Proyecto Privado',
    brazilian_portuguese: 'Edição de Projeto Privado'
  },
  privateProjectEditingMessage: {
    english:
      'This project is private. You need to be a member to edit transcriptions. Request access to join this project.',
    spanish:
      'Este proyecto es privado. Necesitas ser miembro para editar transcripciones. Solicita acceso para unirte a este proyecto.',
    brazilian_portuguese:
      'Este projeto é privado. Você precisa ser membro para editar transcrições. Solicite acesso para participar deste projeto.'
  },
  privateProjectGenericMessage: {
    english:
      'This project is private. You need to be a member to access this feature. Request access to join this project.',
    spanish:
      'Este proyecto es privado. Necesitas ser miembro para acceder a esta función. Solicita acceso para unirte a este proyecto.',
    brazilian_portuguese:
      'Este projeto é privado. Você precisa ser membro para acessar este recurso. Solicite acesso para participar deste projeto.'
  },
  privateProjectMembers: {
    english: 'Private Project Members',
    spanish: 'Miembros del Proyecto Privado',
    brazilian_portuguese: 'Membros do Projeto Privado'
  },
  privateProjectMembersMessage: {
    english:
      'You need to be a member to view the member list and send invitations. Request access to join this project.',
    spanish:
      'Necesitas ser miembro para ver la lista de miembros y enviar invitaciones. Solicita acceso para unirte a este proyecto.',
    brazilian_portuguese:
      'Você precisa ser membro para ver a lista de membros e enviar convites. Solicite acesso para participar deste projeto.'
  },
  privateProjectNotLoggedInInline: {
    english: 'You need to be logged in to access this private project.',
    spanish: 'Necesitas iniciar sesión para acceder a este proyecto privado.',
    brazilian_portuguese:
      'Você precisa estar logado para acessar este projeto privado.'
  },
  privateProjectTranslation: {
    english: 'Private Project Translation',
    spanish: 'Traducción de Proyecto Privado',
    brazilian_portuguese: 'Tradução de Projeto Privado'
  },
  privateProjectTranslationMessage: {
    english:
      'This project is private. You need to be a member to submit translations. Request access to join this project.',
    spanish:
      'Este proyecto es privado. Necesitas ser miembro para enviar traducciones. Solicita acceso para unirte a este proyecto.',
    brazilian_portuguese:
      'Este projeto é privado. Você precisa ser membro para enviar traduções. Solicite acesso para participar deste projeto.'
  },
  privateProjectVoting: {
    english: 'Private Project Voting',
    spanish: 'Votación de Proyecto Privado',
    brazilian_portuguese: 'Votação de Projeto Privado'
  },
  privateProjectVotingMessage: {
    english:
      'This project is private. You need to be a member to vote on translations. Request access to join this project.',
    spanish:
      'Este proyecto es privado. Necesitas ser miembro para votar en las traducciones. Solicita acceso para unirte a este proyecto.',
    brazilian_portuguese:
      'Este projeto é privado. Você precisa ser membro para votar nas traduções. Solicite acesso para participar deste projeto.'
  },
  projectInvitation: {
    english: 'Project Invitation',
    spanish: 'Invitación al Proyecto',
    brazilian_portuguese: 'Convite para o Projeto'
  },
  projectInvitationFrom: {
    english: '{sender} has invited you to join project "{project}" as {role}',
    spanish:
      '{sender} te ha invitado a unirte al proyecto "{project}" como {role}',
    brazilian_portuguese:
      '{sender} convidou você para participar do projeto "{project}" como {role}'
  },
  projectJoinRequestFrom: {
    english: '{sender} has requested to join project "{project}" as {role}',
    spanish:
      '{sender} ha solicitado unirse al proyecto "{project}" como {role}',
    brazilian_portuguese:
      '{sender} solicitou participar do projeto "{project}" como {role}'
  },
  projectWillRemainDownloaded: {
    english: 'Project will remain downloaded',
    spanish: 'El proyecto permanecerá descargado',
    brazilian_portuguese: 'O projeto permanecerá baixado'
  },
  requestExpiredAttemptsRemaining: {
    english:
      'Your request expired after 7 days. You have {attempts} attempt{plural} remaining.',
    spanish:
      'Su solicitud expiró después de 7 días. Te quedan {attempts} intento{plural}.',
    brazilian_portuguese:
      'Sua solicitação expirou após 7 dias. Você tem {attempts} tentativa{plural} restante{plural}.'
  },
  requestExpiredInline: {
    english:
      'Your previous request expired after 7 days. You have {attempts} attempt{plural} remaining.',
    spanish:
      'Su solicitud anterior expiró después de 7 días. Te quedan {attempts} intento{plural}.',
    brazilian_portuguese:
      'Sua solicitação anterior expirou após 7 dias. Você tem {attempts} tentativa{plural} restante{plural}.'
  },
  requestExpiredNoAttempts: {
    english: 'Your request expired and you have no more attempts remaining.',
    spanish: 'Su solicitud expiró y no te quedan más intentos.',
    brazilian_portuguese:
      'Sua solicitação expirou e você não tem mais tentativas restantes.'
  },
  requestExpiredNoAttemptsInline: {
    english:
      'Your previous request expired after 7 days and you have no more attempts remaining.',
    spanish:
      'Su solicitud anterior expiró después de 7 días y no te quedan más intentos.',
    brazilian_portuguese:
      'Sua solicitação anterior expirou após 7 dias e você não tem mais tentativas restantes.'
  },
  requestPendingInline: {
    english:
      "Your membership request is pending approval. You'll be notified when it's reviewed.",
    spanish:
      'Su solicitud de membresía está pendiente de aprobación. Se le notificará cuando sea revisada.',
    brazilian_portuguese:
      'Sua solicitação de associação está pendente de aprovação. Você será notificado quando for analisada.'
  },
  requestDeclinedInline: {
    english:
      'Your request was declined. You have {attempts} attempt{plural} remaining.',
    spanish:
      'Su solicitud fue rechazada. Te quedan {attempts} intento{plural}.',
    brazilian_portuguese:
      'Sua solicitação foi recusada. Você tem {attempts} tentativa{plural} restante{plural}.'
  },
  requestDeclinedNoRetryInline: {
    english:
      'Your request was declined and you have no more attempts remaining.',
    spanish: 'Su solicitud fue rechazada y no te quedan más intentos.',
    brazilian_portuguese:
      'Sua solicitação foi recusada e você não tem mais tentativas restantes.'
  },
  requestWithdrawnInline: {
    english:
      'You withdrew your previous request. You can send a new request anytime.',
    spanish:
      'Retiraste tu solicitud anterior. Puedes enviar una nueva solicitud en cualquier momento.',
    brazilian_portuguese:
      'Você retirou sua solicitação anterior. Você pode enviar uma nova solicitação a qualquer momento.'
  },
  viewProject: {
    english: 'View Project',
    spanish: 'Ver Proyecto',
    brazilian_portuguese: 'Ver Projeto'
  },
  loadingProjectDetails: {
    english: 'Loading project details...',
    spanish: 'Cargando detalles del proyecto...',
    brazilian_portuguese: 'Carregando detalhes do projeto...'
  },
  onlyOwnersCanInvite: {
    english: 'Only project owners can invite new members',
    spanish:
      'Solo los propietarios del proyecto pueden invitar nuevos miembros',
    brazilian_portuguese:
      'Apenas proprietários do projeto podem convidar novos membros'
  },
  failedToResendInvitation: {
    english: 'Failed to resend invitation',
    spanish: 'Error al reenviar invitación',
    brazilian_portuguese: 'Falha ao reenviar convite'
  },
  // Restore-related translations
  restoreAndroidOnly: {
    english: 'Restore is only available on Android',
    spanish: 'La restauración solo está disponible en Android',
    brazilian_portuguese: 'A restauração só está disponível no Android'
  },
  permissionDenied: {
    english: 'Permission Denied',
    spanish: 'Permiso Denegado',
    brazilian_portuguese: 'Permissão Negada'
  },
  confirmAudioRestore: {
    english: 'Confirm Audio Restore',
    spanish: 'Confirmar Restauración de Audio',
    brazilian_portuguese: 'Confirmar Restauração de Áudio'
  },
  confirmAudioRestoreMessage: {
    english: 'This will restore your audio files from the backup. Continue?',
    spanish:
      'Esto restaurará sus archivos de audio desde la copia de seguridad. ¿Continuar?',
    brazilian_portuguese:
      'Isso restaurará seus arquivos de áudio do backup. Continuar?'
  },
  restoreAudioOnly: {
    english: 'Restore Audio',
    spanish: 'Restaurar Audio',
    brazilian_portuguese: 'Restaurar Áudio'
  },
  failedRestore: {
    english: 'Failed to restore: {error}',
    spanish: 'Error al restaurar: {error}',
    brazilian_portuguese: 'Falha ao restaurar: {error}'
  },
  restoreCompleteBase: {
    english:
      'Restore completed: {audioCopied} audio files copied, {audioSkippedDueToError} skipped due to errors',
    spanish:
      'Restauración completada: {audioCopied} archivos de audio copiados, {audioSkippedDueToError} omitidos por errores',
    brazilian_portuguese:
      'Restauração concluída: {audioCopied} arquivos de áudio copiados, {audioSkippedDueToError} ignorados por erros'
  },
  restoreSkippedLocallyPart: {
    english: ', {audioSkippedLocally} skipped (already exists)',
    spanish: ', {audioSkippedLocally} omitidos (ya existen)',
    brazilian_portuguese: ', {audioSkippedLocally} ignorados (já existem)'
  },
  restoreCompleteTitle: {
    english: 'Restore Complete',
    spanish: 'Restauración Completa',
    brazilian_portuguese: 'Restauração Concluída'
  },
  restoreFailedTitle: {
    english: 'Restore Failed: {error}',
    spanish: 'Restauración Fallida: {error}',
    brazilian_portuguese: 'Restauração Falhou: {error}'
  },
  projectInvitationTitle: {
    english: 'Project Invitation',
    spanish: 'Invitación al Proyecto',
    brazilian_portuguese: 'Convite para o Projeto'
  },
  joinRequestTitle: {
    english: 'Join Request',
    spanish: 'Solicitud de Unión',
    brazilian_portuguese: 'Solicitação de Adesão'
  },
  invitedYouToJoin: {
    english: '{sender} invited you to join "{project}" as {role}',
    spanish: '{sender} te invitó a unirte a "{project}" como {role}',
    brazilian_portuguese:
      '{sender} convidou você para participar de "{project}" como {role}'
  },
  requestedToJoin: {
    english: '{sender} requested to join "{project}" as {role}',
    spanish: '{sender} solicitó unirse a "{project}" como {role}',
    brazilian_portuguese:
      '{sender} solicitou participar de "{project}" como {role}'
  },
  downloadProjectLabel: {
    english: 'Download Project',
    spanish: 'Descargar Proyecto',
    brazilian_portuguese: 'Baixar Projeto'
  },
  projectNotAvailableOfflineWarning: {
    english: 'Project will not be available offline without download',
    spanish: 'El proyecto no estará disponible sin conexión sin descarga',
    brazilian_portuguese: 'O projeto não estará disponível offline sem download'
  },
  noNotificationsTitle: {
    english: 'No Notifications',
    spanish: 'Sin Notificaciones',
    brazilian_portuguese: 'Sem Notificações'
  },
  noNotificationsMessage: {
    english: "You'll see project invitations and join requests here",
    spanish: 'Aquí verás invitaciones a proyectos y solicitudes de unión',
    brazilian_portuguese:
      'Aqui você verá convites para projetos e solicitações de participação'
  },
  invitationAcceptedSuccessfully: {
    english: 'Invitation accepted successfully',
    spanish: 'Invitación aceptada exitosamente',
    brazilian_portuguese: 'Convite aceito com sucesso'
  },
  invitationDeclinedSuccessfully: {
    english: 'Invitation declined',
    spanish: 'Invitación rechazada',
    brazilian_portuguese: 'Convite recusado'
  },
  failedToAcceptInvite: {
    english: 'Failed to accept invitation',
    spanish: 'Error al aceptar invitación',
    brazilian_portuguese: 'Falha ao aceitar convite'
  },
  failedToDeclineInvite: {
    english: 'Failed to decline invitation',
    spanish: 'Error al rechazar invitación',
    brazilian_portuguese: 'Falha ao recusar convite'
  },
  invitationAcceptedDownloadFailed: {
    english: 'Invitation accepted but download failed',
    spanish: 'Invitación aceptada pero la descarga falló',
    brazilian_portuguese: 'Convite aceito mas o download falhou'
  },
  unknownProject: {
    english: 'Unknown Project',
    spanish: 'Proyecto Desconocido',
    brazilian_portuguese: 'Projeto Desconhecido'
  },
  ownerRole: {
    english: 'owner',
    spanish: 'propietario',
    brazilian_portuguese: 'proprietário'
  },
  memberRole: {
    english: 'member',
    spanish: 'miembro',
    brazilian_portuguese: 'membro'
  },
  offlineNotificationMessage: {
    english:
      'You are offline. Any changes you make will sync when you are back online.',
    spanish:
      'Estás sin conexión. Los cambios que hagas se sincronizarán cuando vuelvas a estar en línea.',
    brazilian_portuguese:
      'Você está offline. Quaisquer alterações que você fizer serão sincronizadas quando você voltar a ficar online.'
  },
  filesDownloaded: {
    english: 'files downloaded',
    spanish: 'archivos descargados',
    brazilian_portuguese: 'arquivos baixados'
  },
  downloading: {
    english: 'downloading',
    spanish: 'descargando',
    brazilian_portuguese: 'baixando'
  },
  files: {
    english: 'files',
    spanish: 'archivos',
    brazilian_portuguese: 'arquivos'
  },
  syncingDatabase: {
    english: 'syncing database',
    spanish: 'sincronizando base de datos',
    brazilian_portuguese: 'sincronizando banco de dados'
  },
  lastSync: {
    english: 'last sync',
    spanish: 'última sincronización',
    brazilian_portuguese: 'última sincronização'
  },
  unknown: {
    english: 'unknown',
    spanish: 'desconocido',
    brazilian_portuguese: 'desconhecido'
  },
  notSynced: {
    english: 'not synced',
    spanish: 'no sincronizado',
    brazilian_portuguese: 'não sincronizado'
  },
  connecting: {
    english: 'connecting',
    spanish: 'conectando',
    brazilian_portuguese: 'conectando'
  },
  disconnected: {
    english: 'disconnected',
    spanish: 'desconectado',
    brazilian_portuguese: 'desconectado'
  },
  downloadComplete: {
    english: 'download complete',
    spanish: 'descarga completa',
    brazilian_portuguese: 'download completo'
  },
  queued: {
    english: 'queued',
    spanish: 'en cola',
    brazilian_portuguese: 'em fila'
  },
  queuedForDownload: {
    english: 'queued for download',
    spanish: 'en cola para descargar',
    brazilian_portuguese: 'em fila para baixar'
  },
  complete: {
    english: 'complete',
    spanish: 'completo',
    brazilian_portuguese: 'completo'
  },
  loadMore: {
    english: 'load more',
    spanish: 'cargar más',
    brazilian_portuguese: 'carregar mais'
  },
  loading: {
    english: 'loading',
    spanish: 'cargando',
    brazilian_portuguese: 'carregando'
  },
  assetMadeInvisibleAllQuests: {
    english: 'The asset has been made invisible for all quests',
    spanish: 'El asset ha sido hecho invisible para todas las quests',
    brazilian_portuguese: 'O asset foi feito invisível para todas as quests'
  },
  assetMadeVisibleAllQuests: {
    english: 'The asset has been made visible for all quests',
    spanish: 'El asset ha sido hecho visible para todas las quests',
    brazilian_portuguese: 'O asset foi feito visível para todas as quests'
  },
  assetMadeInactiveAllQuests: {
    english: 'The asset has been made inactive for all quests',
    spanish: 'El asset ha sido hecho inactivo para todas las quests',
    brazilian_portuguese: 'O asset foi feito inativo para todas as quests'
  },
  assetMadeActiveAllQuests: {
    english: 'The asset has been made active for all quests',
    spanish: 'El asset ha sido hecho activo para todas las quests',
    brazilian_portuguese: 'O asset foi feito ativo para todas as quests'
  },
  failedToUpdateAssetSettings: {
    english: 'Failed to update asset settings',
    spanish: 'Error al actualizar los ajustes del asset',
    brazilian_portuguese: 'Falha ao atualizar os ajustes do asset'
  },
  assetMadeInvisibleQuest: {
    english: 'The asset has been made invisible for this quest',
    spanish: 'El asset ha sido hecho invisible para esta quest',
    brazilian_portuguese: 'O asset foi feito invisível para esta quest'
  },
  assetMadeVisibleQuest: {
    english: 'The asset has been made visible for this quest',
    spanish: 'El asset ha sido hecho visible para esta quest',
    brazilian_portuguese: 'O asset foi feito visível para esta quest'
  },
  assetMadeInactiveQuest: {
    english: 'The asset has been made inactive for this quest',
    spanish: 'El asset ha sido hecho inactivo para esta quest',
    brazilian_portuguese: 'O asset foi feito inativo para esta quest'
  },
  assetMadeActiveQuest: {
    english: 'The asset has been made active for this quest',
    spanish: 'El asset ha sido hecho activo para esta quest',
    brazilian_portuguese: 'O asset foi feito ativo para esta quest'
  },
  assetSettings: {
    english: 'Asset Settings',
    spanish: 'Ajustes del Asset',
    brazilian_portuguese: 'Ajustes do Asset'
  },
  general: {
    english: 'General',
    spanish: 'General',
    brazilian_portuguese: 'Geral'
  },
  currentQuest: {
    english: 'Current Quest',
    spanish: 'Quest Actual',
    brazilian_portuguese: 'Quest Atual'
  },
  visibility: {
    english: 'Visibility',
    spanish: 'Visibilidad',
    brazilian_portuguese: 'Visibilidade'
  },
  active: {
    english: 'Active',
    spanish: 'Activo',
    brazilian_portuguese: 'Ativo'
  },
  visibilityDescription: {
    english:
      'The asset is visible by default in all quests, unless hidden individually.',
    spanish:
      'El asset es visible por defecto en todas las quests, a menos que se oculte individualmente.',
    brazilian_portuguese:
      'O asset é visível por padrão em todas as quests, a menos que seja ocultado individualmente.'
  },
  activeDescription: {
    english:
      'The asset is active and can be used in all quests, unless deactivated individually.',
    spanish:
      'El asset está activo y puede ser usado en todas las quests, a menos que se desactive individualmente.',
    brazilian_portuguese:
      'O asset está ativo e pode ser usado em todas as quests, a menos que se desative individualmente.'
  },
  visibilityDescriptionQuest: {
    english:
      'The asset is visible by default in this quest, unless hidden individually.',
    spanish:
      'El asset es visible por defecto en esta quest, a menos que se oculte individualmente.',
    brazilian_portuguese:
      'O asset é visível por padrão nesta quest, a menos que seja ocultado individualmente.'
  },
  assetHiddenAllQuests: {
    english:
      'The asset is hidden in all quests and cannot be made visible in any of them.',
    spanish:
      'El asset está oculto en todas las quests y no puede hacerse visible en ninguna de ellas.',
    brazilian_portuguese:
      'O asset está oculto em todas as quests e não pode ser tornado visível em nenhuma delas.'
  },
  assetDisabledAllQuests: {
    english:
      'The asset is disabled across all quests and cannot be used anywhere.',
    spanish:
      'El asset está deshabilitado en todas las quests y no puede usarse en ningún lugar.',
    brazilian_portuguese:
      'O asset está desabilitado em todas as quests e não pode ser usado em lugar algum.'
  },
  questSpecificSettingsDescription: {
    english:
      'These settings affect how the asset behaves in this specific quest',
    spanish:
      'Estos ajustes afectan cómo se comporta el asset en esta quest específica',
    brazilian_portuguese:
      'Essas configurações afetam como o asset se comporta nesta quest específica'
  },
  assetDisabledWarning: {
    english:
      "⚠️ This asset is disabled across all quests. You can't change its settings for this quest.",
    spanish:
      '⚠️ Este asset está deshabilitado en todas las quests. No puedes cambiar sus ajustes para esta quest.',
    brazilian_portuguese:
      '⚠️ Este asset está desabilitado em todas as quests. Você não pode alterar suas configurações para esta quest.'
  },
  assetVisibleThisQuest: {
    english: 'The asset is shown in this quest. Unless hidden globally.',
    spanish:
      'El asset se muestra en esta quest. A menos que esté oculto globalmente.',
    brazilian_portuguese:
      'O asset é mostrado nesta quest. A menos que esteja oculto globalmente.'
  },
  assetHiddenThisQuest: {
    english: 'The asset is hidden in this quest.',
    spanish: 'El asset está oculto en esta quest.',
    brazilian_portuguese: 'O asset está oculto nesta quest.'
  },
  assetActiveThisQuest: {
    english:
      'The asset can be used in this quest. Unless deactivated globally.',
    spanish:
      'El asset puede usarse en esta quest. A menos que esté desactivado globalmente.',
    brazilian_portuguese:
      'O asset pode ser usado nesta quest. A menos que esteja desativado globalmente.'
  },
  assetInactiveThisQuest: {
    english: 'The asset is not available in this quest.',
    spanish: 'El asset no está disponible en esta quest.',
    brazilian_portuguese: 'O asset não está disponível nesta quest.'
  },
  downloadProjectConfirmation: {
    english: 'Download this project for offline use?',
    spanish: '¿Descargar este proyecto para uso sin conexión?',
    brazilian_portuguese: 'Baixar este projeto para uso offline?'
  },
  downloadQuestConfirmation: {
    english: 'Download this quest for offline use?',
    spanish: '¿Descargar esta quest para uso sin conexión?',
    brazilian_portuguese: 'Baixar esta quest para uso offline?'
  },
  thisWillDownload: {
    english: 'This will download:',
    spanish: 'Esto descargará:',
    brazilian_portuguese: 'Isso baixará:'
  },
  translations: {
    english: 'translations',
    spanish: 'translations',
    brazilian_portuguese: 'translations'
  },
  projectMadePublic: {
    english: 'The project has been made public',
    spanish: 'El proyecto se ha hecho público',
    brazilian_portuguese: 'O projeto foi tornado público'
  },
  projectMadePrivate: {
    english: 'The project has been made private',
    spanish: 'El proyecto se ha hecho privado',
    brazilian_portuguese: 'O projeto foi tornado privado'
  },
  projectMadeInvisible: {
    english: 'The project has been made invisible',
    spanish: 'El proyecto se ha hecho invisible',
    brazilian_portuguese: 'O projeto foi tornado invisível'
  },
  projectMadeVisible: {
    english: 'The project has been made visible',
    spanish: 'El proyecto se ha hecho visible',
    brazilian_portuguese: 'O projeto foi tornado visível'
  },
  projectMadeInactive: {
    english: 'The project has been made inactive',
    spanish: 'El proyecto se ha hecho inactivo',
    brazilian_portuguese: 'O projeto foi tornado inativo'
  },
  projectMadeActive: {
    english: 'The project has been made active',
    spanish: 'El proyecto se ha hecho activo',
    brazilian_portuguese: 'O projeto foi tornado ativo'
  },
  failedToUpdateProjectSettings: {
    english: 'Failed to update project settings',
    spanish: 'Error al actualizar la configuración del proyecto',
    brazilian_portuguese: 'Falha ao atualizar as configurações do projeto'
  },
  failedToUpdateProjectVisibility: {
    english: 'Failed to update project visibility',
    spanish: 'Error al actualizar la visibilidad del proyecto',
    brazilian_portuguese: 'Falha ao atualizar a visibilidade do projeto'
  },
  failedToUpdateProjectActiveStatus: {
    english: 'Failed to update project active status',
    spanish: 'Error al actualizar el estado activo del proyecto',
    brazilian_portuguese: 'Falha ao atualizar o status ativo do projeto'
  },
  projectSettings: {
    english: 'Project Settings',
    spanish: 'Configuración del Proyecto',
    brazilian_portuguese: 'Configurações do Projeto'
  },
  publicProjectDescription: {
    english: 'Anyone can access this project',
    spanish: 'Cualquiera puede acceder a este proyecto',
    brazilian_portuguese: 'Qualquer pessoa pode acessar este projeto'
  },
  visibleProjectDescription: {
    english: 'This project appears in public listings',
    spanish: 'Este proyecto aparece en listados públicos',
    brazilian_portuguese: 'Este projeto aparece em listagens públicas'
  },
  invisibleProjectDescription: {
    english: 'This project is hidden from public listings',
    spanish: 'Este proyecto está oculto de los listados públicos',
    brazilian_portuguese: 'Este projeto está oculto das listagens públicas'
  },
  activeProjectDescription: {
    english: 'This project is available for use',
    spanish: 'Este proyecto está disponible para usar',
    brazilian_portuguese: 'Este projeto está disponível para uso'
  },
  inactiveProjectDescription: {
    english: 'This project is temporarily disabled',
    spanish: 'Este proyecto está temporalmente deshabilitado',
    brazilian_portuguese: 'Este projeto está temporariamente desabilitado'
  },
  loadingOptions: {
    english: 'Loading options...',
    spanish: 'Cargando opciones...',
    brazilian_portuguese: 'Carregando opções...'
  },
  loadingTagCategories: {
    english: 'Loading tag categories...',
    spanish: 'Cargando categorías de etiquetas...',
    brazilian_portuguese: 'Carregando categorias de etiquetas...'
  },
  questSettings: {
    english: 'Quest Settings',
    spanish: 'Configuración de la Misión',
    brazilian_portuguese: 'Configurações da Missão'
  },
  visibleQuestDescription: {
    english: 'This quest is visible to users',
    spanish: 'Esta misión es visible para los usuarios',
    brazilian_portuguese: 'Esta missão é visível para os usuários'
  },
  invisibleQuestDescription: {
    english: 'This quest is hidden from users',
    spanish: 'Esta misión está oculta para los usuarios',
    brazilian_portuguese: 'Esta missão está oculta dos usuários'
  },
  activeQuestDescription: {
    english: 'This quest is available for completion',
    spanish: 'Esta misión está disponible para completar',
    brazilian_portuguese: 'Esta missão está disponível para conclusão'
  },
  inactiveQuestDescription: {
    english: 'This quest is temporarily disabled',
    spanish: 'Esta misión está temporalmente deshabilitada',
    brazilian_portuguese: 'Esta missão está temporariamente desabilitada'
  },
  questMadeInvisible: {
    english: 'The quest has been made invisible',
    spanish: 'La misión se ha hecho invisible',
    brazilian_portuguese: 'A missão foi tornada invisível'
  },
  questMadeVisible: {
    english: 'The quest has been made visible',
    spanish: 'La misión se ha hecho visible',
    brazilian_portuguese: 'A missão foi tornada visível'
  },
  questMadeInactive: {
    english: 'The quest has been made inactive',
    spanish: 'La misión se ha hecho inactiva',
    brazilian_portuguese: 'A missão foi tornada inativa'
  },
  questMadeActive: {
    english: 'The quest has been made active',
    spanish: 'La misión se ha hecho activa',
    brazilian_portuguese: 'A missão foi tornada ativa'
  },
  failedToUpdateQuestSettings: {
    english: 'Failed to update quest settings',
    spanish: 'Error al actualizar la configuración de la misión',
    brazilian_portuguese: 'Falha ao atualizar as configurações da missão'
  },
  loadingAudio: {
    english: 'Loading audio...',
    spanish: 'Cargando audio...',
    brazilian_portuguese: 'Carregando áudio...'
  },
  updateAvailable: {
    english: 'A new update is available!',
    spanish: '¡Una nueva actualización está disponible!',
    brazilian_portuguese: 'Uma nova atualização está disponível!'
  },
  updateNow: {
    english: 'Update Now',
    spanish: 'Actualizar Ahora',
    brazilian_portuguese: 'Atualizar Agora'
  },
  enterCommentOptional: {
    english: 'Enter your comment (optional)',
    spanish: 'Escribe tu comentario (opcional)',
    brazilian_portuguese: 'Escreva seu comentário (opcional)'
  },
  auth_init_error_title: {
    english: 'Initialization Error',
    spanish: 'Error de Inicialización',
    brazilian_portuguese: 'Erro de Inicialização'
  },
  auth_init_error_message: {
    english:
      'Failed to initialize the app. Please try logging out and back in.',
    spanish:
      'Error al inicializar la aplicación. Por favor, intenta cerrar sesión y volver a iniciar sesión.',
    brazilian_portuguese:
      'Erro ao inicializar o aplicativo. Por favor, tente sair e entrar novamente.'
  },
  auth_init_error_ok: {
    english: 'OK',
    spanish: 'OK',
    brazilian_portuguese: 'OK'
  },
  projectDownloaded: {
    english: 'Project downloaded',
    spanish: 'Proyecto descargado',
    brazilian_portuguese: 'Projeto baixado'
  },
  passwordMustBeAtLeast6Characters: {
    english: 'Password must be at least 6 characters',
    spanish: 'La contraseña debe tener al menos 6 caracteres',
    brazilian_portuguese: 'A senha deve ter pelo menos 6 caracteres'
  },
  passwordUpdateFailed: {
    english: 'Failed to update password',
    spanish: 'Error al actualizar la contraseña',
    brazilian_portuguese: 'Falha ao atualizar a senha'
  },
  clearCache: {
    english: 'Clear Cache',
    spanish: 'Limpiar caché',
    brazilian_portuguese: 'Limpar cache'
  },
  clearCacheConfirmation: {
    english: 'Are you sure you want to clear all cached data?',
    spanish: '¿Estás seguro de querer limpiar todos los datos en caché?',
    brazilian_portuguese:
      'Tem certeza que deseja limpar todos os dados em cache?'
  },
  cacheClearedSuccess: {
    english: 'Cache cleared successfully',
    spanish: 'Caché limpiada correctamente',
    brazilian_portuguese: 'Cache limpa com sucesso'
  },
  exportRequiresInternet: {
    english: 'This feature requires an internet connection',
    spanish: 'Esta característica requiere una conexión a internet',
    brazilian_portuguese:
      'Esta funcionalidade requer uma conexão com a internet'
  },
  exportDataComingSoon: {
    english: 'Data export feature coming soon',
    spanish: 'La exportación de datos está próxima',
    brazilian_portuguese: 'A exportação de dados está próxima'
  },
  info: {
    english: 'Info',
    spanish: 'Información',
    brazilian_portuguese: 'Informação'
  },
  enableNotifications: {
    english: 'Enable Notifications',
    spanish: 'Habilitar notificaciones',
    brazilian_portuguese: 'Habilitar notificações'
  },
  notificationsDescription: {
    english: 'Receive notifications for app updates and important information',
    spanish:
      'Recibir notificaciones para actualizaciones de la aplicación y información importante',
    brazilian_portuguese:
      'Receber notificações para atualizações do aplicativo e informações importantes'
  },
  contentPreferences: {
    english: 'Content Preferences',
    spanish: 'Preferencias de contenido',
    brazilian_portuguese: 'Preferências de conteúdo'
  },
  showHiddenContent: {
    english: 'Show Hidden Content',
    spanish: 'Mostrar contenido oculto',
    brazilian_portuguese: 'Mostrar conteúdo oculto'
  },
  showHiddenContentDescription: {
    english: 'Allow displaying content that has been marked as invisible',
    spanish: 'Permitir mostrar contenido que ha sido marcado como invisible',
    brazilian_portuguese:
      'Permitir mostrar conteúdo que foi marcado como invisível'
  },
  dataAndStorage: {
    english: 'Data & Storage',
    spanish: 'Datos y almacenamiento',
    brazilian_portuguese: 'Dados e armazenamento'
  },
  downloadOnWifiOnly: {
    english: 'Download on WiFi Only',
    spanish: 'Descargar solo en WiFi',
    brazilian_portuguese: 'Baixar apenas em WiFi'
  },
  downloadOnWifiOnlyDescription: {
    english: 'Only download content when connected to WiFi',
    spanish: 'Descargar contenido solo cuando esté conectado a WiFi',
    brazilian_portuguese:
      'Baixar conteúdo apenas quando estiver conectado à WiFi'
  },
  autoBackup: {
    english: 'Auto Backup',
    spanish: 'Copia de seguridad automática',
    brazilian_portuguese: 'Backup automático'
  },
  autoBackupDescription: {
    english: 'Automatically backup your data to the cloud',
    spanish: 'Hacer una copia de seguridad automática de tus datos en la nube',
    brazilian_portuguese: 'Fazer um backup automático dos seus dados na nuvem'
  },
  clearCacheDescription: {
    english: 'Clear all cached data to free up storage space',
    spanish:
      'Limpiar todos los datos en caché para liberar espacio de almacenamiento',
    brazilian_portuguese:
      'Limpar todos os dados em cache para liberar espaço de armazenamento'
  },
  exportData: {
    english: 'Export Data',
    spanish: 'Exportar datos',
    brazilian_portuguese: 'Exportar dados'
  },
  exportDataDescription: {
    english: 'Export your data for backup or transfer',
    spanish: 'Exportar tus datos para respaldo o transferencia',
    brazilian_portuguese: 'Exportar seus dados para backup ou transferência'
  },
  support: {
    english: 'Support',
    spanish: 'Soporte',
    brazilian_portuguese: 'Suporte'
  },
  helpCenter: {
    english: 'Help Center',
    spanish: 'Centro de ayuda',
    brazilian_portuguese: 'Centro de ajuda'
  },
  helpCenterComingSoon: {
    english: 'Help center feature coming soon',
    spanish: 'El centro de ayuda está próximo',
    brazilian_portuguese: 'O centro de ajuda está próximo'
  },
  contactSupport: {
    english: 'Contact Support',
    spanish: 'Contactar soporte',
    brazilian_portuguese: 'Contatar suporte'
  },
  contactSupportComingSoon: {
    english: 'Contact support feature coming soon',
    spanish: 'La función de contacto con el soporte está próxima',
    brazilian_portuguese:
      'A funcionalidade de contato com o suporte está próxima'
  },
  termsAndConditions: {
    english: 'Terms & Conditions',
    spanish: 'Términos y condiciones',
    brazilian_portuguese: 'Termos e condições'
  },
  termsAndConditionsComingSoon: {
    english: 'Terms & Conditions feature coming soon',
    spanish: 'La función de términos y condiciones está próxima',
    brazilian_portuguese: 'A funcionalidade de termos e condições está próxima'
  },
  advanced: {
    english: 'Advanced',
    spanish: 'Avanzado',
    brazilian_portuguese: 'Avançado'
  },
  debugMode: {
    english: 'Debug Mode',
    spanish: 'Modo de depuración',
    brazilian_portuguese: 'Modo de depuração'
  },
  debugModeDescription: {
    english: 'Enable debug mode for development features',
    spanish: 'Habilitar modo de depuración para características de desarrollo',
    brazilian_portuguese:
      'Habilitar modo de depuração para funcionalidades de desenvolvimento'
  },
  settingsRequireInternet: {
    english: 'Some settings require an internet connection',
    spanish: 'Algunas configuraciones requieren una conexión a internet',
    brazilian_portuguese:
      'Algumas configurações requerem uma conexão com a internet'
  },
  clear: {
    english: 'Clear',
    spanish: 'Limpiar',
    brazilian_portuguese: 'Limpar'
  },
  unnamedAsset: {
    english: 'Unnamed Asset',
    spanish: 'Actividad sin nombre',
    brazilian_portuguese: 'Atividade sem nome'
  },
  noAssetSelected: {
    english: 'No Asset Selected',
    spanish: 'No hay actividades seleccionadas',
    brazilian_portuguese: 'Nenhuma atividade selecionada'
  },
  assetNotAvailableOffline: {
    english: 'Asset not available offline',
    spanish: 'La actividad no está disponible sin conexión',
    brazilian_portuguese: 'A atividade não está disponível offline'
  },
  cloudError: {
    english: 'Cloud error: {error}',
    spanish: 'Error en la nube: {error}',
    brazilian_portuguese: 'Erro na nuvem: {error}'
  },
  assetNotFoundOnline: {
    english: 'Asset not found online',
    spanish: 'La actividad no se encontró en línea',
    brazilian_portuguese: 'A atividade não foi encontrada online'
  },
  trySwitchingToCloudDataSource: {
    english: 'Try switching to Cloud data source above',
    spanish: 'Intenta cambiar a la fuente de datos en la nube',
    brazilian_portuguese: 'Tente mudar para a fonte de dados na nuvem'
  },
  trySwitchingToOfflineDataSource: {
    english: 'Try switching to Offline data source above',
    spanish: 'Intenta cambiar a la fuente de datos sin conexión',
    brazilian_portuguese: 'Tente mudar para a fonte de dados offline'
  },
  assetMayNotBeSynchronized: {
    english: 'This asset may not be synchronized or may not exist',
    spanish: 'Esta actividad puede no estar sincronizada o puede no existir',
    brazilian_portuguese:
      'Esta atividade pode não estar sincronizada ou pode não existir'
  },
  noContentAvailable: {
    english: 'No content available',
    spanish: 'No hay contenido disponible',
    brazilian_portuguese: 'Nenhum conteúdo disponível'
  },
  audioReady: {
    english: 'Audio ready',
    spanish: 'Audio listo',
    brazilian_portuguese: 'Áudio pronto'
  },
  audioNotAvailable: {
    english: 'Audio not available',
    spanish: 'Audio no disponible',
    brazilian_portuguese: 'Áudio não disponível'
  },
  imagesAvailable: {
    english: 'Images available',
    spanish: 'Imágenes disponibles',
    brazilian_portuguese: 'Imagens disponíveis'
  },
  language: {
    english: 'Language',
    spanish: 'Idioma',
    brazilian_portuguese: 'Idioma'
  },
  audioTracks: {
    english: 'Audio tracks',
    spanish: 'Pistas de audio',
    brazilian_portuguese: 'Pistas de áudio'
  },
  membersOnly: {
    english: 'Members Only',
    spanish: 'Solo para miembros',
    brazilian_portuguese: 'Só para membros'
  },
  cloud: {
    english: 'Cloud',
    spanish: 'Nube',
    brazilian_portuguese: 'Nuvem'
  },
  syncing: {
    english: 'Syncing',
    spanish: 'Sincronizando',
    brazilian_portuguese: 'Sincronizando'
  },
  synced: {
    english: 'Synced',
    spanish: 'Sincronizado',
    brazilian_portuguese: 'Sincronizado'
  },
  failed: {
    english: 'Failed',
    spanish: 'Fallado',
    brazilian_portuguese: 'Falhado'
  },
  state: {
    english: 'State',
    spanish: 'Estado',
    brazilian_portuguese: 'Estado'
  },
  noQuestSelected: {
    english: 'No Quest Selected',
    spanish: 'No hay proyecto seleccionado',
    brazilian_portuguese: 'Nenhum projeto selecionado'
  },
  liveAttachmentStates: {
    english: 'Live Attachment States',
    spanish: 'Estados de adjuntos en vivo',
    brazilian_portuguese: 'Estados de anexos em tempo real'
  },
  searching: {
    english: 'Searching',
    spanish: 'Buscando',
    brazilian_portuguese: 'Buscando'
  },
  translationSubmittedSuccessfully: {
    english: 'Translation submitted successfully',
    spanish: 'Traducción enviada correctamente',
    brazilian_portuguese: 'Tradução enviada com sucesso'
  },
  text: {
    english: 'Text',
    spanish: 'Texto',
    brazilian_portuguese: 'Texto'
  },
  audio: {
    english: 'Audio',
    spanish: 'Audio',
    brazilian_portuguese: 'Áudio'
  },
  targetLanguage: {
    english: 'Target Language',
    spanish: 'Idioma de destino',
    brazilian_portuguese: 'Idioma de destino'
  },
  your: {
    english: 'Your',
    spanish: 'Tu',
    brazilian_portuguese: 'Seu'
  },
  translation: {
    english: 'Translation',
    spanish: 'Traducción',
    brazilian_portuguese: 'Tradução'
  },
  readyToSubmit: {
    english: 'Ready to submit',
    spanish: 'Listo para enviar',
    brazilian_portuguese: 'Pronto para enviar'
  },
  online: {
    english: 'Online',
    spanish: 'En línea',
    brazilian_portuguese: 'Online'
  },
  allProjects: {
    english: 'All Projects',
    spanish: 'Todos los proyectos',
    brazilian_portuguese: 'Todos os projetos'
  },
  searchProjects: {
    english: 'Search projects',
    spanish: 'Buscar proyectos',
    brazilian_portuguese: 'Buscar projetos'
  },
  noProjectSelected: {
    english: 'No Project Selected',
    spanish: 'No hay proyecto seleccionado',
    brazilian_portuguese: 'Nenhum projeto selecionado'
  },
  noQuestsFound: {
    english: 'No quests found',
    spanish: 'No se encontraron misiones',
    brazilian_portuguese: 'Nenhuma missão encontrada'
  },
  noQuestsAvailable: {
    english: 'No quests available',
    spanish: 'No hay misiones disponibles',
    brazilian_portuguese: 'Nenhuma missão disponível'
  },
  pleaseLogInToVote: {
    english: 'Please log in to vote',
    spanish: 'Por favor, inicia sesión para votar',
    brazilian_portuguese: 'Por favor, faça login para votar'
  },
  yourTranscriptionHasBeenSubmitted: {
    english: 'Your transcription has been submitted',
    spanish: 'Tu transcripción ha sido enviada',
    brazilian_portuguese: 'Sua transcrição foi enviada'
  },
  failedToCreateTranscription: {
    english: 'Failed to create transcription',
    spanish: 'Error al crear la transcripción',
    brazilian_portuguese: 'Falha ao criar a transcrição'
  },
  enterYourTranscription: {
    english: 'Enter your transcription',
    spanish: 'Escribe tu transcripción',
    brazilian_portuguese: 'Digite sua transcrição'
  },
  submitTranscription: {
    english: 'Submit Transcription',
    spanish: 'Enviar transcripción',
    brazilian_portuguese: 'Enviar transcrição'
  },
  good: {
    english: 'Good',
    spanish: 'Bueno',
    brazilian_portuguese: 'Bom'
  },
  needsWork: {
    english: 'Needs Work',
    spanish: 'Necesita trabajo',
    brazilian_portuguese: 'Precisa de trabalho'
  },
  pleaseLogInToVoteOnTranslations: {
    english: 'Please log in to vote on translations',
    spanish: 'Por favor, inicia sesión para votar en traducciones',
    brazilian_portuguese: 'Por favor, faça login para votar em traduções'
  },
  translationNotFound: {
    english: 'Translation not found',
    spanish: 'Traducción no encontrada',
    brazilian_portuguese: 'Tradução não encontrada'
  },
  noTranslationsYet: {
    english: 'No translations yet. Be the first to translate!',
    spanish: 'No hay traducciones aún. Sé el primero en traducir!',
    brazilian_portuguese: 'Nenhuma tradução ainda. Seja o primeiro a traduzir!'
  },
  viewProjectLimitedAccess: {
    english: 'View Project (Limited Access)',
    spanish: 'Ver proyecto (Acceso limitado)',
    brazilian_portuguese: 'Ver projeto (Acesso limitado)'
  },
  languages: {
    english: 'Languages',
    spanish: 'Idiomas',
    brazilian_portuguese: 'Idiomas'
  },
  downloadRequired: {
    english: 'Download required',
    spanish: 'Descarga requerida',
    brazilian_portuguese: 'Download requerido'
  },
  searchMyProjects: {
    english: 'Search my projects',
    spanish: 'Buscar mis proyectos',
    brazilian_portuguese: 'Buscar meus projetos'
  },
  searchAllProjects: {
    english: 'Search all projects',
    spanish: 'Buscar todos los proyectos',
    brazilian_portuguese: 'Buscar todos os projetos'
  },
  myProjects: {
    english: 'My Projects',
    spanish: 'Mis proyectos',
    brazilian_portuguese: 'Meus projetos'
  }
} as const;

// Type check to ensure all translation keys have all supported languages
// type ValidateTranslations<T> = {
//   [K in keyof T]: T[K] extends TranslationSet ? true : never;
// };
// type ValidationResult = ValidateTranslations<typeof translations>;
