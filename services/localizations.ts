// Define all supported UI languages
export type SupportedLanguage =
  | 'english'
  | 'spanish'
  | 'brazilian_portuguese'
  | 'tok_pisin'
  | 'indonesian';

// Define the structure for translations
export type LocalizationKey = keyof typeof localizations;

// Type to ensure all translations have all supported languages
// type LocalizationSet = Record<SupportedLanguage, string>;

// All UI translations
export const localizations = {
  accept: {
    english: 'Accept',
    spanish: 'Aceptar',
    brazilian_portuguese: 'Aceitar',
    tok_pisin: 'Orait',
    indonesian: 'Terima'
  },
  accountNotVerified: {
    english:
      'Please verify your email address before signing in. Check your email for the verification link.',
    spanish:
      'Por favor verifique su dirección de correo electrónico antes de iniciar sesión. Revise su correo electrónico para el enlace de verificación.',
    brazilian_portuguese:
      'Por favor, verifique seu endereço de e-mail antes de fazer login. Verifique seu e-mail para o link de verificação.',
    tok_pisin:
      'Plis checkum email adres bilong yu pastaim long sainum. Lukim email bilong yu long verification link.',
    indonesian:
      'Harap verifikasi alamat email Anda sebelum masuk. Periksa email Anda untuk tautan verifikasi.'
  },
  done: {
    english: 'Done',
    spanish: 'Listo',
    brazilian_portuguese: 'Feito',
    tok_pisin: 'Done',
    indonesian: 'Selesai'
  },
  all: {
    english: 'All',
    spanish: 'Todo',
    brazilian_portuguese: 'Todos',
    tok_pisin: 'Olgeta',
    indonesian: 'Semua'
  },
  options: {
    english: 'Options',
    spanish: 'Opciones',
    brazilian_portuguese: 'Opções'
  },
  membersOnlyCreate: {
    english: 'Only project members can create content',
    spanish: 'Solo los miembros del proyecto pueden crear contenido',
    brazilian_portuguese: 'Apenas membros do projeto podem criar conteúdo',
    tok_pisin: 'Tasol ol memba bilong projek inap mekim nupela samting',
    indonesian: 'Hanya anggota proyek yang dapat membuat konten'
  },
  membersOnlyPublish: {
    english: 'Only project members can publish',
    spanish: 'Solo los miembros del proyecto pueden publicar',
    brazilian_portuguese: 'Apenas membros do projeto podem publicar',
    tok_pisin: 'Tasol ol memba bilong projek inap putim i go long olgeta',
    indonesian: 'Hanya anggota proyek yang dapat mempublikasikan'
  },
  apply: {
    english: 'Apply',
    spanish: 'Aplicar',
    brazilian_portuguese: 'Aplicar',
    tok_pisin: 'Putim',
    indonesian: 'Terapkan'
  },
  avatar: {
    english: 'Avatar',
    spanish: 'Avatar',
    brazilian_portuguese: 'Avatar',
    tok_pisin: 'Avatar',
    indonesian: 'Avatar'
  },
  backToLogin: {
    english: 'Back to Login',
    spanish: 'Volver al inicio de sesión',
    brazilian_portuguese: 'Voltar para o Login',
    tok_pisin: 'Go bek long Login',
    indonesian: 'Kembali ke Login'
  },
  checkEmail: {
    english: 'Please check your email',
    spanish: 'Por favor revise su correo electrónico',
    brazilian_portuguese: 'Por favor, verifique seu e-mail',
    tok_pisin: 'Plis checkum email bilong yu',
    indonesian: 'Silakan periksa email Anda'
  },
  checkEmailForResetLink: {
    english: 'Please check your email for the password reset link',
    spanish:
      'Por favor revise su correo electrónico para el enlace de restablecimiento de contraseña',
    brazilian_portuguese:
      'Por favor, verifique seu e-mail para o link de redefinição de senha',
    tok_pisin: 'Plis checkum email bilong yu long password reset link',
    indonesian: 'Silakan periksa email Anda untuk tautan reset kata sandi'
  },
  confirmNewPassword: {
    english: 'Confirm New Password',
    spanish: 'Confirmar nueva contraseña',
    brazilian_portuguese: 'Confirmar Nova Senha',
    tok_pisin: 'Confirm nupela password',
    indonesian: 'Konfirmasi Kata Sandi Baru'
  },
  confirmPassword: {
    english: 'Confirm Password',
    spanish: 'Confirmar contraseña',
    brazilian_portuguese: 'Confirmar Senha',
    tok_pisin: 'Confirm password',
    indonesian: 'Konfirmasi Kata Sandi'
  },
  createObject: {
    english: 'Create',
    spanish: 'Crear',
    brazilian_portuguese: 'Criar',
    tok_pisin: 'Create',
    indonesian: 'Buat'
  },
  projectName: {
    english: 'Project Name',
    spanish: 'Nombre del Proyecto',
    brazilian_portuguese: 'Nome do Projeto',
    tok_pisin: 'Project Name',
    indonesian: 'Nama Proyek'
  },
  newProject: {
    english: 'New Project',
    spanish: 'Nuevo Proyecto',
    brazilian_portuguese: 'Novo Projeto',
    tok_pisin: 'Nupela Project',
    indonesian: 'Proyek Baru'
  },
  newQuest: {
    english: 'New Quest'
  },
  questName: {
    english: 'Quest Name'
  },
  description: {
    english: 'Description',
    spanish: 'Descripción',
    brazilian_portuguese: 'Descrição',
    tok_pisin: 'Description',
    indonesian: 'Deskripsi'
  },
  visible: {
    english: 'Visible',
    spanish: 'Visible',
    brazilian_portuguese: 'Visible',
    tok_pisin: 'Visible',
    indonesian: 'Visible'
  },
  private: {
    english: 'Private',
    spanish: 'Privado',
    brazilian_portuguese: 'Privado',
    tok_pisin: 'Private',
    indonesian: 'Private'
  },
  date: {
    english: 'Date',
    spanish: 'Fecha',
    brazilian_portuguese: 'Data',
    tok_pisin: 'De',
    indonesian: 'Tanggal'
  },
  decline: {
    english: 'Decline',
    spanish: 'Rechazar',
    brazilian_portuguese: 'Rejeitar',
    tok_pisin: 'No',
    indonesian: 'Tolak'
  },
  downloadAnyway: {
    english: 'Download Anyway',
    spanish: 'Descargar de todas formas',
    brazilian_portuguese: 'Descarregar de qualquer forma',
    tok_pisin: 'Download tasol',
    indonesian: 'Unduh Saja'
  },
  downloadProject: {
    english: 'Download Project',
    spanish: 'Descargar Proyecto',
    brazilian_portuguese: 'Descarregar Projeto',
    tok_pisin: 'Download project',
    indonesian: 'Unduh Proyek'
  },
  downloadProjectOfflineWarning: {
    english:
      "If you don't download the project, you won't be able to contribute to it offline. You can download it later by pressing the project card's download button.",
    spanish:
      'Si no descargas el proyecto, no podrás contribuir sin conexión. Puedes descargarlo más tarde presionando el botón de descarga en la tarjeta del proyecto.',
    brazilian_portuguese:
      'Se você não baixar o projeto, não poderá contribuir offline. Você pode baixá-lo mais tarde pressionando o botão de download no cartão do projeto.',
    tok_pisin:
      'Sapos yu no download project, yu no inap contributim long em taim yu no gat internet. Yu ken download em bihain long presim download button long project card.',
    indonesian:
      'Jika Anda tidak mengunduh proyek, Anda tidak akan dapat berkontribusi secara offline. Anda dapat mengunduhnya nanti dengan menekan tombol unduh di kartu proyek.'
  },
  downloadProjectWhenRequestSent: {
    english: 'Download project when request is sent',
    spanish: 'Descargar proyecto cuando se envíe la solicitud',
    brazilian_portuguese: 'Baixar projeto quando a solicitação for enviada',
    tok_pisin: 'Download project taim request i go',
    indonesian: 'Unduh proyek saat permintaan dikirim'
  },
  discoveringQuestData: {
    english: 'Discovering Quest Data',
    spanish: 'Descubriendo Datos de la Misión',
    brazilian_portuguese: 'Descobrindo Dados da Missão',
    tok_pisin: 'Painimaut long Quest Data',
    indonesian: 'Menemukan Data Quest'
  },
  offloadQuest: {
    english: 'Offload Quest',
    spanish: 'Descargar Quest',
    brazilian_portuguese: 'Descarregar Quest',
    tok_pisin: 'Rausim Quest',
    indonesian: 'Lepas Quest'
  },
  offloadQuestDescription: {
    english: 'Remove local data to free up storage',
    spanish: 'Eliminar datos locales para liberar almacenamiento',
    brazilian_portuguese: 'Remover dados locais para liberar armazenamento',
    tok_pisin: 'Rausim data long freeup storage',
    indonesian: 'Hapus data lokal untuk membebaskan penyimpanan'
  },
  verifyingCloudData: {
    english: 'Verifying data in cloud...',
    spanish: 'Verificando datos en la nube...',
    brazilian_portuguese: 'Verificando dados na nuvem...',
    tok_pisin: 'Checkim data long klaud...',
    indonesian: 'Memverifikasi data di cloud...'
  },
  pendingUploadsDetected: {
    english: 'Pending uploads detected',
    spanish: 'Se detectaron cargas pendientes',
    brazilian_portuguese: 'Uploads pendentes detectados',
    tok_pisin: 'Painimaut sampela hap i no go yet',
    indonesian: 'Mendeteksi upload tertunda'
  },
  pendingUploadsMessage: {
    english:
      'Please wait for all changes to upload to the cloud before offloading. Connect to the internet and wait for sync to complete.',
    spanish:
      'Espere a que todos los cambios se carguen en la nube antes de descargar. Conéctese a Internet y espere a que se complete la sincronización.',
    brazilian_portuguese:
      'Aguarde todos os uploads para a nuvem antes de descarregar. Conecte-se à internet e aguarde a sincronização completar.',
    tok_pisin:
      'Wetim olgeta senis i go long klaud pastaim long rausim. Joinim internet na wetim sync i pinis.',
    indonesian:
      'Harap tunggu semua perubahan terupload ke cloud sebelum melepas. Sambungkan ke internet dan tunggu sinkronisasi selesai.'
  },
  readyToOffload: {
    english: 'Ready to offload',
    spanish: 'Listo para descargar',
    brazilian_portuguese: 'Pronto para descarregar',
    tok_pisin: 'Redi long rausim',
    indonesian: 'Siap untuk melepas'
  },
  offloadWarning: {
    english:
      'This will delete local copies. Data will remain safely in the cloud and can be re-downloaded later.',
    spanish:
      'Esto eliminará las copias locales. Los datos permanecerán seguros en la nube y se pueden volver a descargar más tarde.',
    brazilian_portuguese:
      'Isto removerá cópias locais. Os dados permanecerão seguros na nuvem e podem ser baixados novamente depois.',
    tok_pisin:
      'Dispela bai rausim kopi long dispela mashin tasol. Data bai stap save long klaud na yu ken daunim gen bihain.',
    indonesian:
      'Ini akan menghapus salinan lokal. Data akan tetap aman di cloud dan dapat diunduh kembali nanti.'
  },
  storageToFree: {
    english: 'Storage to Free',
    spanish: 'Almacenamiento para Liberar',
    brazilian_portuguese: 'Armazenamento a Liberar',
    tok_pisin: 'Storage Long Freeup',
    indonesian: 'Penyimpanan yang Dibebaskan'
  },
  continue: {
    english: 'Continue',
    spanish: 'Continuar',
    brazilian_portuguese: 'Continuar',
    tok_pisin: 'Go Het',
    indonesian: 'Lanjutkan'
  },
  continueToOffload: {
    english: 'Offload from Device',
    spanish: 'Descargar del Dispositivo',
    brazilian_portuguese: 'Descarregar do Dispositivo',
    tok_pisin: 'Rausim long Mashin',
    indonesian: 'Lepas dari Perangkat'
  },
  offloadingQuest: {
    english: 'Offloading quest...',
    spanish: 'Descargando quest...',
    brazilian_portuguese: 'Descarregando quest...',
    tok_pisin: 'Rausim quest...',
    indonesian: 'Melepas quest...'
  },
  offloadComplete: {
    english: 'Quest offloaded successfully',
    spanish: 'Quest descargada con éxito',
    brazilian_portuguese: 'Quest descarregada com sucesso',
    tok_pisin: 'Quest i rausim orait',
    indonesian: 'Quest berhasil dilepas'
  },
  offloadError: {
    english: 'Failed to offload quest',
    spanish: 'Error al descargar quest',
    brazilian_portuguese: 'Falha ao descarregar quest',
    tok_pisin: 'Pasin long rausim quest i no inap',
    indonesian: 'Gagal melepas quest'
  },
  cannotOffloadErrors: {
    english: 'Cannot offload - errors detected',
    spanish: 'No se puede descargar - errores detectados',
    brazilian_portuguese: 'Não é possível descarregar - erros detectados',
    tok_pisin: 'No inap rausim - painimaut sampela rong',
    indonesian: 'Tidak dapat melepas - kesalahan terdeteksi'
  },
  allDataVerifiedInCloud: {
    english: 'All data verified in cloud',
    spanish: 'Todos los datos verificados en la nube',
    brazilian_portuguese: 'Todos os dados verificados na nuvem',
    tok_pisin: 'Olgeta data i stret long klaud',
    indonesian: 'Semua data terverifikasi di cloud'
  },
  checkingPendingChanges: {
    english: 'Checking for pending changes...',
    spanish: 'Verificando cambios pendientes...',
    brazilian_portuguese: 'Verificando alterações pendentes...',
    tok_pisin: 'Checkim sampela senis i no go yet...',
    indonesian: 'Memeriksa perubahan tertunda...'
  },
  verifyingDatabaseRecords: {
    english: 'Verifying database records',
    spanish: 'Verificando registros de base de datos',
    brazilian_portuguese: 'Verificando registros do banco de dados',
    tok_pisin: 'Checkim ol rekod long database',
    indonesian: 'Memverifikasi catatan database'
  },
  verifyingAttachments: {
    english: 'Verifying attachments',
    spanish: 'Verificando archivos adjuntos',
    brazilian_portuguese: 'Verificando anexos',
    tok_pisin: 'Checkim ol fail i pas long',
    indonesian: 'Memverifikasi lampiran'
  },
  waitingForUploads: {
    english: 'Waiting for Uploads',
    spanish: 'Esperando Cargas',
    brazilian_portuguese: 'Aguardando Uploads',
    tok_pisin: 'Wetim Upload',
    indonesian: 'Menunggu Upload'
  },
  cannotOffload: {
    english: 'Cannot Offload',
    spanish: 'No se puede Descargar',
    brazilian_portuguese: 'Não é possível Descarregar',
    tok_pisin: 'No Inap Rausim',
    indonesian: 'Tidak dapat Melepas'
  },
  analyzingRelatedRecords: {
    english: 'Analyzing related records...',
    spanish: 'Analizando registros relacionados...',
    brazilian_portuguese: 'Analisando registros relacionados...',
    tok_pisin: 'Lukautim ol related records...',
    indonesian: 'Menganalisis catatan terkait...'
  },
  discoveryComplete: {
    english: 'Discovery complete',
    spanish: 'Descubrimiento completo',
    brazilian_portuguese: 'Descoberta completa',
    tok_pisin: 'Discovery i pinis',
    indonesian: 'Penemuan selesai'
  },
  totalRecords: {
    english: 'Total Records',
    spanish: 'Registros Totales',
    brazilian_portuguese: 'Registros Totais',
    tok_pisin: 'Total Records',
    indonesian: 'Total Catatan'
  },
  discoveryErrorsOccurred: {
    english:
      'Some errors occurred during discovery. You can still download the discovered records.',
    spanish:
      'Ocurrieron algunos errores durante el descubrimiento. Aún puedes descargar los registros descubiertos.',
    brazilian_portuguese:
      'Alguns erros ocorreram durante a descoberta. Você ainda pode baixar os registros descobertos.',
    tok_pisin:
      'Sampela problem i kamap taim long painimaut. Yu ken download yet ol records we mipela painimaut.',
    indonesian:
      'Beberapa kesalahan terjadi selama penemuan. Anda masih dapat mengunduh catatan yang ditemukan.'
  },
  questNotFoundInCloud: {
    english:
      'Quest not found in cloud database. It may only exist locally or you may not have permission to access it. Try refreshing the page or contact support if this persists.',
    spanish:
      'La misión no se encontró en la base de datos de la nube. Puede que solo exista localmente o que no tenga permiso para acceder a ella. Intenta actualizar la página o contacta al soporte si este problema persiste.',
    brazilian_portuguese:
      'A missão não foi encontrada na base de dados da nuvem. Pode existir localmente ou você pode não ter permissão para acessá-la. Tente atualizar a página ou contate o suporte se este problema persistir.',
    tok_pisin:
      'Quest i no gat long cloud database. I may only exist long local o yu no have permission long access it. Plis refresh page o contact support long this persists.',
    indonesian:
      'Quest tidak ditemukan di basis data cloud. Mungkin hanya ada secara lokal atau Anda tidak memiliki izin untuk mengaksesnya. Silakan muat ulang halaman atau hubungi dukungan jika masalah ini tetap terjadi.'
  },
  discovering: {
    english: 'Discovering...',
    spanish: 'Descubriendo...',
    brazilian_portuguese: 'Descobrindo...',
    tok_pisin: 'Painimaut...',
    indonesian: 'Menemukan...'
  },
  continueToDownload: {
    english: 'Continue to Download',
    spanish: 'Continuar con la Descarga',
    brazilian_portuguese: 'Continuar para Download',
    tok_pisin: 'Go het long Download',
    indonesian: 'Lanjutkan ke Unduhan'
  },
  email: {
    english: 'Email',
    spanish: 'Email',
    brazilian_portuguese: 'E-mail',
    tok_pisin: 'Email',
    indonesian: 'Email'
  },
  emailAlreadyMemberMessage: {
    english: 'This email address is already a {role} of this project.',
    spanish:
      'Esta dirección de correo electrónico ya es {role} de este proyecto.',
    brazilian_portuguese: 'Este endereço de e-mail já é {role} deste projeto.',
    tok_pisin: 'Dispela email adres i {role} pinis long dispela project.',
    indonesian: 'Alamat email ini sudah menjadi {role} dari proyek ini.'
  },
  emailRequired: {
    english: 'Email is required',
    spanish: 'Se requiere email',
    brazilian_portuguese: 'E-mail é obrigatório',
    tok_pisin: 'Email i mas',
    indonesian: 'Email diperlukan'
  },
  nameRequired: {
    english: 'Name is required',
    spanish: 'Nombre es requerido',
    brazilian_portuguese: 'Nome é obrigatório',
    tok_pisin: 'Name i mas',
    indonesian: 'Nama diperlukan'
  },
  descriptionTooLong: {
    english: 'Description must be less than {max} characters',
    spanish: 'La descripción debe tener menos de {max} caracteres',
    brazilian_portuguese: 'A descrição deve ter menos de {max} caracteres',
    tok_pisin: 'Description i no sem long {max} character',
    indonesian: 'Deskripsi harus kurang dari {max} karakter'
  },
  enterTranslation: {
    english: 'Enter your translation here',
    spanish: 'Ingrese su traducción aquí',
    brazilian_portuguese: 'Digite sua tradução aqui',
    tok_pisin: 'Putim translation bilong yu long hia',
    indonesian: 'Masukkan terjemahan Anda di sini'
  },
  enterValidEmail: {
    english: 'Please enter a valid email',
    spanish: 'Por favor ingrese un correo electrónico válido',
    brazilian_portuguese: 'Por favor, digite um e-mail válido',
    tok_pisin: 'Plis putim wanpela gutpela email',
    indonesian: 'Silakan masukkan email yang valid'
  },
  enterYourEmail: {
    english: 'Enter your email',
    spanish: 'Ingrese su correo electrónico',
    brazilian_portuguese: 'Digite seu e-mail',
    tok_pisin: 'Putim email bilong yu',
    indonesian: 'Masukkan email Anda'
  },
  enterYourPassword: {
    english: 'Enter your password',
    spanish: 'Ingrese su contraseña',
    brazilian_portuguese: 'Digite sua senha',
    tok_pisin: 'Putim password bilong yu',
    indonesian: 'Masukkan kata sandi Anda'
  },
  error: {
    english: 'Error',
    spanish: 'Error',
    brazilian_portuguese: 'Erro',
    tok_pisin: 'Rong',
    indonesian: 'Kesalahan'
  },
  failedCreateTranslation: {
    english: 'Failed to create translation',
    spanish: 'Error al crear la traducción',
    brazilian_portuguese: 'Falha ao criar tradução',
    tok_pisin: 'I no inap mekim translation',
    indonesian: 'Gagal membuat terjemahan'
  },
  failedLoadProjects: {
    english: 'Failed to load projects',
    spanish: 'Error al cargar proyectos',
    brazilian_portuguese: 'Falha ao carregar projetos',
    tok_pisin: 'I no inap loadim ol project',
    indonesian: 'Gagal memuat proyek'
  },
  failedLoadQuests: {
    english: 'Failed to load quests',
    spanish: 'Error al cargar misiones',
    brazilian_portuguese: 'Falha ao carregar missões',
    tok_pisin: 'I no inap loadim ol quest',
    indonesian: 'Gagal memuat misi'
  },
  failedResetPassword: {
    english: 'Failed to reset password',
    spanish: 'Error al restablecer la contraseña',
    brazilian_portuguese: 'Falha ao redefinir senha',
    tok_pisin: 'I no inap resetim password',
    indonesian: 'Gagal mereset kata sandi'
  },
  failedSendResetEmail: {
    english: 'Failed to send reset email',
    spanish: 'Error al enviar el correo de restablecimiento',
    brazilian_portuguese: 'Falha ao enviar e-mail de redefinição',
    tok_pisin: 'I no inap salim reset email',
    indonesian: 'Gagal mengirim email reset'
  },
  failedToAcceptInvitation: {
    english: 'Failed to accept invitation. Please try again.',
    spanish: 'Error al aceptar la invitación. Por favor, inténtelo de nuevo.',
    brazilian_portuguese:
      'Falha ao aceitar o convite. Por favor, tente novamente.',
    tok_pisin: 'I no inap akseptim invitation. Plis traim gen.',
    indonesian: 'Gagal menerima undangan. Silakan coba lagi.'
  },
  failedToDeclineInvitation: {
    english: 'Failed to decline invitation. Please try again.',
    spanish: 'Error al rechazar la invitación. Por favor, inténtelo de nuevo.',
    brazilian_portuguese:
      'Falha ao recusar o convite. Por favor, tente novamente.',
    tok_pisin: 'I no inap refusim invitation. Plis traim gen.',
    indonesian: 'Gagal menolak undangan. Silakan coba lagi.'
  },
  failedToVote: {
    english: 'Failed to submit vote',
    spanish: 'Error al enviar el voto',
    brazilian_portuguese: 'Falha ao enviar voto',
    tok_pisin: 'I no inap salim vote',
    indonesian: 'Gagal mengirim suara'
  },
  fillFields: {
    english: 'Please fill in all required fields',
    spanish: 'Por favor complete todos los campos requeridos',
    brazilian_portuguese: 'Por favor, preencha todos os campos obrigatórios',
    tok_pisin: 'Plis fulupim olgeta field i mas',
    indonesian: 'Silakan isi semua bidang yang diperlukan'
  },
  forgotPassword: {
    english: 'I forgot my password',
    spanish: 'Olvidé mi contraseña',
    brazilian_portuguese: 'Esqueci minha senha',
    tok_pisin: 'Mi lusim password bilong mi',
    indonesian: 'Saya lupa kata sandi saya'
  },
  invalidResetLink: {
    english: 'Invalid or expired reset link',
    spanish: 'Enlace de restablecimiento inválido o expirado',
    brazilian_portuguese: 'Link de redefinição inválido ou expirado',
    tok_pisin: 'Reset link i no gutpela o i pinis',
    indonesian: 'Tautan reset tidak valid atau kedaluwarsa'
  },
  logInToTranslate: {
    english: 'You must be logged in to submit translations',
    spanish: 'Debe iniciar sesión para enviar traducciones',
    brazilian_portuguese: 'Você precisa estar logado para enviar traduções',
    tok_pisin: 'Yu mas login pastaim long salim ol translation',
    indonesian: 'Anda harus masuk untuk mengirim terjemahan'
  },
  logInToVote: {
    english: 'You must be logged in to vote',
    spanish: 'Debe iniciar sesión para votar',
    brazilian_portuguese: 'Você precisa estar logado para votar',
    tok_pisin: 'Yu mas login pastaim long vote',
    indonesian: 'Anda harus masuk untuk memberikan suara'
  },
  menu: {
    english: 'Menu',
    spanish: 'Menú',
    brazilian_portuguese: 'Menu',
    tok_pisin: 'Menu',
    indonesian: 'Menu'
  },
  newTranslation: {
    english: 'New Translation',
    spanish: 'Nueva Traducción',
    brazilian_portuguese: 'Nova Tradução',
    tok_pisin: 'Nupela Translation',
    indonesian: 'Terjemahan Baru'
  },
  newUser: {
    english: 'New user?',
    spanish: '¿Usuario nuevo?',
    brazilian_portuguese: 'Novo usuário?',
    tok_pisin: 'Nupela user?',
    indonesian: 'Pengguna baru?'
  },
  newUserRegistration: {
    english: 'New User Registration',
    spanish: 'Registro de nuevo usuario',
    brazilian_portuguese: 'Registro de Novo Usuário',
    tok_pisin: 'Nupela User Registration',
    indonesian: 'Pendaftaran Pengguna Baru'
  },
  noComment: {
    english: 'No Comment',
    spanish: 'Sin comentarios',
    brazilian_portuguese: 'Sem Comentários',
    tok_pisin: 'No gat comment',
    indonesian: 'Tidak Ada Komentar'
  },
  noProject: {
    english: 'No active project found',
    spanish: 'No se encontró ningún proyecto activo',
    brazilian_portuguese: 'Nenhum projeto ativo encontrado',
    tok_pisin: 'No gat active project',
    indonesian: 'Tidak ada proyek aktif yang ditemukan'
  },
  ok: {
    english: 'OK',
    spanish: 'OK',
    brazilian_portuguese: 'OK',
    tok_pisin: 'Orait',
    indonesian: 'OK'
  },
  offline: {
    english: 'Offline',
    spanish: 'Sin conexión',
    brazilian_portuguese: 'Offline',
    tok_pisin: 'No gat internet',
    indonesian: 'Offline'
  },
  password: {
    english: 'Password',
    spanish: 'Contraseña',
    brazilian_portuguese: 'Senha',
    tok_pisin: 'Password',
    indonesian: 'Kata Sandi'
  },
  passwordRequired: {
    english: 'Password is required',
    spanish: 'Se requiere contraseña',
    brazilian_portuguese: 'Senha é obrigatória',
    tok_pisin: 'Password i mas',
    indonesian: 'Kata sandi diperlukan'
  },
  passwordMinLength: {
    english: 'Password must be at least 6 characters',
    spanish: 'La contraseña debe tener al menos 6 caracteres',
    brazilian_portuguese: 'A senha deve ter pelo menos 6 caracteres',
    tok_pisin: 'Password i mas gat 6 character',
    indonesian: 'Kata sandi harus minimal 6 karakter'
  },
  passwordsNoMatch: {
    english: 'Passwords do not match',
    spanish: 'Las contraseñas no coinciden',
    brazilian_portuguese: 'As senhas não coincidem',
    tok_pisin: 'Ol password i no sem',
    indonesian: 'Kata sandi tidak cocok'
  },
  passwordResetSuccess: {
    english: 'Password has been reset successfully',
    spanish: 'La contraseña se ha restablecido correctamente',
    brazilian_portuguese: 'A senha foi redefinida com sucesso',
    tok_pisin: 'Password i reset gut pinis',
    indonesian: 'Kata sandi berhasil direset'
  },
  projectDownloadFailed: {
    english:
      'Invitation accepted, but project download failed. You can download it later from the projects page.',
    spanish:
      'Invitación aceptada, pero la descarga del proyecto falló. Puede descargarla más tarde desde la página de proyectos.',
    brazilian_portuguese:
      'Convite aceito, mas a descarga do projeto falhou. Você pode baixá-lo mais tarde na página de projetos.',
    tok_pisin:
      'Invitation i orait, tasol project download i no inap. Yu ken download em bihain long projects page.',
    indonesian:
      'Undangan diterima, tetapi unduhan proyek gagal. Anda dapat mengunduhnya nanti dari halaman proyek.'
  },
  projects: {
    english: 'Projects',
    spanish: 'Proyectos',
    brazilian_portuguese: 'Projetos',
    tok_pisin: 'Ol Project',
    indonesian: 'Proyek'
  },
  quests: {
    english: 'Quests',
    spanish: 'Misiones',
    brazilian_portuguese: 'Missões',
    tok_pisin: 'Ol Quest',
    indonesian: 'Misi'
  },
  project: {
    english: 'Project',
    spanish: 'Proyecto',
    brazilian_portuguese: 'Projeto'
  },
  noProjectsFound: {
    english: 'No projects found',
    spanish: 'No se encontraron proyectos',
    brazilian_portuguese: 'Nenhum projeto encontrado',
    tok_pisin: 'Nogat projek i painim',
    indonesian: 'Tidak ada proyek yang ditemukan'
  },
  noProjectsYet: {
    english: 'No projects yet',
    spanish: 'Aún no hay proyectos',
    brazilian_portuguese: 'Ainda não há projetos',
    tok_pisin: 'I no gat projek yet',
    indonesian: 'Belum ada proyek'
  },
  noProjectsAvailable: {
    english: 'No projects available',
    spanish: 'No hay proyectos disponibles',
    brazilian_portuguese: 'Nenhum projeto disponível',
    tok_pisin: 'Nogat projek i stap',
    indonesian: 'Tidak ada proyek yang tersedia'
  },
  createProject: {
    english: 'Create Project',
    spanish: 'Crear proyecto',
    brazilian_portuguese: 'Criar projeto',
    tok_pisin: 'Wokim Nupela Projek',
    indonesian: 'Buat Proyek'
  },
  published: {
    english: 'Published',
    spanish: 'Publicado',
    brazilian_portuguese: 'Publicado',
    tok_pisin: 'Publisim pinis',
    indonesian: 'Diterbitkan'
  },
  cannotPublishWhileOffline: {
    english: 'Cannot publish while offline',
    spanish: 'No se puede publicar mientras está desconectado',
    brazilian_portuguese: 'Não é possível publicar enquanto está desconectado',
    tok_pisin: 'I no inap publish long no gat internet',
    indonesian: 'Tidak dapat memublikasikan saat offline'
  },
  chapters: {
    english: 'Chapters',
    spanish: 'Capítulos',
    brazilian_portuguese: 'Capítulos',
    tok_pisin: 'Chapter',
    indonesian: 'Bab'
  },
  chapter: {
    english: 'Chapter',
    spanish: 'Capítulo',
    brazilian_portuguese: 'Capítulo',
    tok_pisin: 'Chapter',
    indonesian: 'Bab'
  },
  publishChapter: {
    english: 'Publish Chapter',
    spanish: 'Publicar Capítulo',
    brazilian_portuguese: 'Publicar Capítulo',
    tok_pisin: 'Publisim Chapter',
    indonesian: 'Publikasikan Bab'
  },
  publish: {
    english: 'Publish',
    spanish: 'Publicar',
    brazilian_portuguese: 'Publicar',
    tok_pisin: 'Publisim',
    indonesian: 'Publikasikan'
  },
  publishChapterMessage: {
    english:
      "This will publish {questName} and all its recordings to make them available to other users.\n\nIf the parent book or project haven't been published yet, they will be published automatically.\n\n⚠️ Publishing uploads your recordings to the cloud. This cannot be undone, but you can publish new versions in the future if you want to make changes.",
    spanish:
      'Esto publicará {questName} y todas sus grabaciones para que estén disponibles para otros usuarios.\n\nSi el libro o proyecto padre aún no se ha publicado, se publicarán automáticamente.\n\n⚠️ La publicación carga tus grabaciones en la nube. Esto no se puede deshacer, pero puedes publicar nuevas versiones en el futuro si deseas hacer cambios.',
    brazilian_portuguese:
      'Isso publicará {questName} e todas as suas gravações para torná-las disponíveis para outros usuários.\n\nSe o livro ou projeto pai ainda não foi publicado, eles serão publicados automaticamente.\n\n⚠️ A publicação carrega suas gravações na nuvem. Isso não pode ser desfeito, mas você pode publicar novas versões no futuro se quiser fazer alterações.',
    tok_pisin:
      'Dispela bai publisim {questName} na olgeta recording bilong en long mekim ol narapela user i ken usim.\n\nSapos papa buk o project i no publisim yet, bai ol i publisim otomatik.\n\n⚠️ Publisim i senimapim ol recording bilong yu i go long cloud. Yu no inap senisim bek dispela, tasol yu ken publisim nupela version bihain sapos yu laik mekim ol senis.',
    indonesian:
      'Ini akan memublikasikan {questName} dan semua rekamannya agar tersedia untuk pengguna lain.\n\nJika buku atau proyek induk belum dipublikasikan, mereka akan dipublikasikan secara otomatis.\n\n⚠️ Publikasi mengunggah rekaman Anda ke cloud. Ini tidak dapat dibatalkan, tetapi Anda dapat memublikasikan versi baru di masa depan jika ingin membuat perubahan.'
  },
  quest: {
    english: 'Quest',
    spanish: 'Misión',
    brazilian_portuguese: 'Missão'
  },
  questOptions: {
    english: 'Quest Options',
    spanish: 'Opciones de misión',
    brazilian_portuguese: 'Opções de Missão',
    tok_pisin: 'Quest Options',
    indonesian: 'Opsi Misi'
  },
  recording: {
    english: 'Recording',
    spanish: 'Grabando',
    brazilian_portuguese: 'Gravando',
    tok_pisin: 'Recording',
    indonesian: 'Merekam'
  },
  register: {
    english: 'Register',
    spanish: 'Registrarse',
    brazilian_portuguese: 'Registrar',
    tok_pisin: 'Register',
    indonesian: 'Daftar'
  },
  createAccount: {
    english: 'Create Account',
    spanish: 'Crear Cuenta',
    brazilian_portuguese: 'Criar Conta',
    tok_pisin: 'Mekim Account',
    indonesian: 'Buat Akun'
  },
  registrationFail: {
    english: 'Registration failed',
    spanish: 'Error en el registro',
    brazilian_portuguese: 'Falha no registro',
    tok_pisin: 'Registration i no inap',
    indonesian: 'Pendaftaran gagal'
  },
  registrationSuccess: {
    english: 'Registration successful',
    spanish: 'Registro exitoso',
    brazilian_portuguese: 'Registro bem-sucedido',
    tok_pisin: 'Registration i orait',
    indonesian: 'Pendaftaran berhasil'
  },
  resetPassword: {
    english: 'Reset Password',
    spanish: 'Restablecer contraseña',
    brazilian_portuguese: 'Redefinir Senha',
    tok_pisin: 'Reset Password',
    indonesian: 'Reset Kata Sandi'
  },
  returningHero: {
    english: 'Returning hero? Sign In',
    spanish: '¿Héroe que regresa? Inicia sesión',
    brazilian_portuguese: 'Herói retornando? Faça Login',
    tok_pisin: 'Hero i kam bek? Sign In',
    indonesian: 'Pahlawan kembali? Masuk'
  },
  search: {
    english: 'Search...',
    spanish: 'Buscar...',
    brazilian_portuguese: 'Buscar...',
    tok_pisin: 'Painim...',
    indonesian: 'Cari...'
  },
  searchAssets: {
    english: 'Search assets...',
    spanish: 'Buscar recursos...',
    brazilian_portuguese: 'Buscar recursos...',
    tok_pisin: 'Painim ol asset...',
    indonesian: 'Cari aset...'
  },
  noAssetsFound: {
    english: 'No assets found',
    spanish: 'No se encontraron recursos',
    brazilian_portuguese: 'Nenhum recurso encontrado',
    tok_pisin: 'No gat asset',
    indonesian: 'Tidak ada aset ditemukan'
  },
  nothingHereYet: {
    english: 'Nothing here yet!',
    spanish: '¡Nada aquí todavía!',
    brazilian_portuguese: '¡Nada aqui ainda!',
    tok_pisin: 'I no gat here yet!',
    indonesian: 'Belum ada di sini!'
  },
  searchQuests: {
    english: 'Search quests...',
    spanish: 'Buscar misiones...',
    brazilian_portuguese: 'Buscar missões...',
    tok_pisin: 'Painim ol quest...',
    indonesian: 'Cari misi...'
  },
  selectItem: {
    english: 'Select item',
    spanish: 'Seleccionar elemento',
    brazilian_portuguese: 'Selecionar item',
    tok_pisin: 'Makim item',
    indonesian: 'Pilih item'
  },
  selectLanguage: {
    english: 'Please select a language',
    spanish: 'Por favor seleccione un idioma',
    brazilian_portuguese: 'Por favor, selecione um idioma',
    tok_pisin: 'Plis makim wanpela tokples',
    indonesian: 'Silakan pilih bahasa'
  },
  searchLanguages: {
    english: 'Search languages...',
    spanish: 'Buscar idiomas...',
    brazilian_portuguese: 'Pesquisar idiomas...',
    tok_pisin: 'Painim ol tokples...',
    indonesian: 'Cari bahasa...'
  },
  noLanguagesFound: {
    english: 'No languages found',
    spanish: 'No se encontraron idiomas',
    brazilian_portuguese: 'Nenhum idioma encontrado',
    tok_pisin: 'I no gat tokples',
    indonesian: 'Tidak ada bahasa ditemukan'
  },
  typeToSearch: {
    english: 'Type at least {min} characters to search',
    spanish: 'Escriba al menos {min} caracteres para buscar',
    brazilian_portuguese: 'Digite pelo menos {min} caracteres para pesquisar',
    tok_pisin: 'Raitim {min} leta bipo painim',
    indonesian: 'Ketik setidaknya {min} karakter untuk mencari'
  },
  selectTemplate: {
    english: 'Please select a template',
    spanish: 'Por favor seleccione una plantilla',
    brazilian_portuguese: 'Por favor, selecione uma planta',
    tok_pisin: 'Plis makim wanpela template',
    indonesian: 'Silakan pilih template'
  },
  sendResetEmail: {
    english: 'Send Reset Email',
    spanish: 'Enviar correo de restablecimiento',
    brazilian_portuguese: 'Enviar E-mail de Redefinição',
    tok_pisin: 'Salim Reset Email',
    indonesian: 'Kirim Email Reset'
  },
  signIn: {
    english: 'Sign In',
    spanish: 'Iniciar Sesión',
    brazilian_portuguese: 'Entrar',
    tok_pisin: 'Sign In',
    indonesian: 'Masuk'
  },
  signInToSaveOrContribute: {
    english: 'Sign in to save or contribute to projects',
    spanish: 'Inicia sesión para guardar o contribuir a proyectos',
    brazilian_portuguese: 'Entre para salvar ou contribuir com projetos',
    tok_pisin: 'Sign in long seivim o helpim ol project',
    indonesian: 'Masuk untuk menyimpan atau berkontribusi pada proyek'
  },
  orBrowseAllProjects: {
    english: 'Or browse all public projects',
    spanish: 'O navega todos los proyectos públicos',
    brazilian_portuguese: 'Ou navegue por todos os projetos públicos',
    tok_pisin: 'O lukluk long olgeta public project',
    indonesian: 'Atau jelajahi semua proyek publik'
  },
  viewAllProjects: {
    english: 'View All Projects',
    spanish: 'Ver Todos los Proyectos',
    brazilian_portuguese: 'Ver Todos os Projetos',
    tok_pisin: 'Lukim Olgeta Project',
    indonesian: 'Lihat Semua Proyek'
  },
  signInError: {
    english: 'Something went wrong… Please, check your email and password.',
    spanish: 'Algo salió mal… Por favor, revisa tu correo y contraseña.',
    brazilian_portuguese:
      'Algo deu errado… Por favor, verifique seu e-mail e senha.',
    tok_pisin: 'Samting i rong... Plis checkum email na password bilong yu.',
    indonesian:
      'Terjadi kesalahan... Silakan periksa email dan kata sandi Anda.'
  },
  logOut: {
    english: 'Log Out',
    spanish: 'Cerrar Sesión',
    brazilian_portuguese: 'Sair',
    tok_pisin: 'Log Out',
    indonesian: 'Keluar'
  },
  sortBy: {
    english: 'Sort by',
    spanish: 'Ordenar por',
    brazilian_portuguese: 'Ordenar por',
    tok_pisin: 'Sortim long',
    indonesian: 'Urutkan berdasarkan'
  },
  source: {
    english: 'Source',
    spanish: 'Fuente',
    brazilian_portuguese: 'Fonte',
    tok_pisin: 'Source',
    indonesian: 'Sumber'
  },
  submit: {
    english: 'Submit',
    spanish: 'Enviar',
    brazilian_portuguese: 'Enviar',
    tok_pisin: 'Salim',
    indonesian: 'Kirim'
  },
  success: {
    english: 'Success',
    spanish: 'Éxito',
    brazilian_portuguese: 'Sucesso',
    tok_pisin: 'Orait',
    indonesian: 'Berhasil'
  },
  target: {
    english: 'Target',
    spanish: 'Objetivo',
    brazilian_portuguese: 'Alvo',
    tok_pisin: 'Target',
    indonesian: 'Target'
  },
  username: {
    english: 'Username',
    spanish: 'Nombre de usuario',
    brazilian_portuguese: 'Nome de usuário',
    tok_pisin: 'Username',
    indonesian: 'Nama pengguna'
  },
  usernameRequired: {
    english: 'Username is required',
    spanish: 'Se requiere nombre de usuario',
    brazilian_portuguese: 'Nome de usuário é obrigatório',
    tok_pisin: 'Username i mas',
    indonesian: 'Nama pengguna diperlukan'
  },
  votes: {
    english: 'Votes',
    spanish: 'Votos',
    brazilian_portuguese: 'Votos',
    tok_pisin: 'Ol Vote',
    indonesian: 'Suara'
  },
  voting: {
    english: 'Voting',
    spanish: 'Votación',
    brazilian_portuguese: 'Votação'
  },
  warning: {
    english: 'Warning',
    spanish: 'Advertencia',
    brazilian_portuguese: 'Aviso',
    tok_pisin: 'Warning',
    indonesian: 'Peringatan'
  },
  welcome: {
    english: 'Welcome back, hero!',
    spanish: '¡Bienvenido de nuevo, héroe!',
    brazilian_portuguese: 'Bem-vindo de volta, herói!',
    tok_pisin: 'Welkam bek, hero!',
    indonesian: 'Selamat datang kembali, pahlawan!'
  },
  recentlyVisited: {
    english: 'Recently Visited',
    spanish: 'Recientemente visitado',
    brazilian_portuguese: 'Visitados Recentemente',
    tok_pisin: 'Nupela taim visitim',
    indonesian: 'Baru Dikunjungi'
  },
  assets: {
    english: 'Assets',
    spanish: 'Recursos',
    brazilian_portuguese: 'Recursos',
    tok_pisin: 'Ol Asset',
    indonesian: 'Aset'
  },
  asset: {
    english: 'Asset',
    spanish: 'Recurso',
    brazilian_portuguese: 'Recurso'
  },
  remaining: {
    english: 'remaining',
    spanish: 'restante',
    brazilian_portuguese: 'restante',
    tok_pisin: 'stap yet',
    indonesian: 'tersisa'
  },
  noNotifications: {
    english: 'No notifications',
    spanish: 'No hay notificaciones',
    brazilian_portuguese: 'Nenhuma notificação',
    tok_pisin: 'No gat notification',
    indonesian: 'Tidak ada notifikasi'
  },
  noNotificationsSubtext: {
    english: "You'll see project invitations and join requests here",
    spanish: 'Aquí verás invitaciones a proyectos y solicitudes de unión',
    brazilian_portuguese:
      'Aqui você verá convites para projetos e solicitações de união',
    tok_pisin: 'Yu bai lukim ol project invitation na join request long hia',
    indonesian:
      'Anda akan melihat undangan proyek dan permintaan bergabung di sini'
  },
  notifications: {
    english: 'Notifications',
    spanish: 'Notificaciones',
    brazilian_portuguese: 'Notificações',
    tok_pisin: 'Ol Notification',
    indonesian: 'Notifikasi'
  },
  profile: {
    english: 'Profile',
    spanish: 'Perfil',
    brazilian_portuguese: 'Perfil',
    tok_pisin: 'Profile',
    indonesian: 'Profil'
  },
  settings: {
    english: 'Settings',
    spanish: 'Configuración',
    brazilian_portuguese: 'Configurações',
    tok_pisin: 'Settings',
    indonesian: 'Pengaturan'
  },
  changePassword: {
    english: 'Change Password',
    spanish: 'Cambiar Contraseña',
    brazilian_portuguese: 'Alterar Senha',
    tok_pisin: 'Senisim Password',
    indonesian: 'Ubah Kata Sandi'
  },
  currentPassword: {
    english: 'Current Password',
    spanish: 'Contraseña Actual',
    brazilian_portuguese: 'Senha Atual',
    tok_pisin: 'Password bilong nau',
    indonesian: 'Kata Sandi Saat Ini'
  },
  newPassword: {
    english: 'New Password',
    spanish: 'Nueva Contraseña',
    brazilian_portuguese: 'Nova Senha',
    tok_pisin: 'Nupela Password',
    indonesian: 'Kata Sandi Baru'
  },
  onlineOnlyFeatures: {
    english: 'Password changes are only available when online',
    spanish:
      'Los cambios de contraseña solo están disponibles cuando está en línea',
    brazilian_portuguese:
      'Alterações de senha só estão disponíveis quando você está online',
    tok_pisin: 'Password senisim i ken long taim yu gat internet tasol',
    indonesian: 'Perubahan kata sandi hanya tersedia saat online'
  },
  accountDeletionRequiresOnline: {
    english: 'You must be online to delete your account',
    spanish: 'Debes estar en línea para eliminar tu cuenta',
    brazilian_portuguese: 'Você deve estar online para excluir sua conta',
    tok_pisin: 'Yu mas gat internet long rausim account bilong yu',
    indonesian: 'Anda harus online untuk menghapus akun Anda'
  },
  termsAndPrivacyTitle: {
    english: 'Terms & Privacy',
    spanish: 'Términos y Privacidad',
    brazilian_portuguese: 'Termos e Privacidade',
    tok_pisin: 'Terms na Privacy',
    indonesian: 'Syarat & Privasi'
  },
  verificationRequired: {
    english: 'Verification Required',
    spanish: 'Verificación Requerida',
    brazilian_portuguese: 'Verificação Necessária',
    tok_pisin: 'Verification i mas',
    indonesian: 'Verifikasi Diperlukan'
  },
  agreeToTerms: {
    english: 'I have read and agree to the Terms & Privacy',
    spanish: 'He leído y acepto los Términos y Privacidad',
    brazilian_portuguese: 'Eu li e concordo com os Termos e Privacidade',
    tok_pisin: 'Mi ridim na agri long Terms na Privacy',
    indonesian: 'Saya telah membaca dan menyetujui Syarat & Privasi'
  },
  viewTerms: {
    english: 'View Terms and Privacy',
    spanish: 'Ver Términos y Privacidad',
    brazilian_portuguese: 'Ver Termos e Privacidade',
    tok_pisin: 'Lukim Terms na Privacy',
    indonesian: 'Lihat Syarat dan Privasi'
  },
  termsRequired: {
    english: 'You must agree to the Terms and Privacy',
    spanish: 'Debe aceptar los Términos y Privacidad',
    brazilian_portuguese: 'Você deve concordar com os Termos e Privacidade',
    tok_pisin: 'Yu mas agri long Terms na Privacy',
    indonesian: 'Anda harus menyetujui Syarat dan Privasi'
  },
  processing: {
    english: 'Processing...',
    spanish: 'Procesando...',
    brazilian_portuguese: 'Processando...',
    tok_pisin: 'Processing...',
    indonesian: 'Memproses...'
  },
  termsContributionInfo: {
    english:
      'By accepting these terms, you agree that all content you contribute to LangQuest will be freely available worldwide under the CC0 1.0 Universal (CC0 1.0) Public Domain Dedication.',
    spanish:
      'Al aceptar estos términos, acepta que todo el contenido que aporte a LangQuest estará disponible gratuitamente en todo el mundo bajo la Dedicación de Dominio Público CC0 1.0 Universal (CC0 1.0).',
    brazilian_portuguese:
      'Ao aceitar estes termos, você concorda que todo o conteúdo que você contribuir para o LangQuest estará disponível gratuitamente em todo o mundo sob a Dedicação ao Domínio Público CC0 1.0 Universal (CC0 1.0).',
    tok_pisin:
      'Long akseptim ol dispela terms, yu agri long olgeta content yu contributim long LangQuest bai stap fri long olgeta hap long CC0 1.0 Universal (CC0 1.0) Public Domain Dedication.',
    indonesian:
      'Dengan menerima syarat ini, Anda setuju bahwa semua konten yang Anda kontribusikan ke LangQuest akan tersedia secara gratis di seluruh dunia di bawah CC0 1.0 Universal (CC0 1.0) Public Domain Dedication.'
  },
  termsDataInfo: {
    english:
      'This means your contributions can be used by anyone for any purpose without attribution. We collect minimal user data: only your email (for account recovery) and newsletter subscription if opted in.',
    spanish:
      'Esto significa que sus contribuciones pueden ser utilizadas por cualquier persona para cualquier propósito sin atribución. Recopilamos datos mínimos de usuario: solo su correo electrónico (para recuperación de cuenta) y suscripción al boletín si se inscribe.',
    brazilian_portuguese:
      'Isso significa que suas contribuições podem ser usadas por qualquer pessoa para qualquer finalidade sem atribuição. Coletamos dados mínimos de usuário: apenas seu e-mail (para recuperação de conta) e assinatura de newsletter se você optar por isso.',
    tok_pisin:
      'Dispela i min ol contribution bilong yu ol man ken usim long wanem samting tasol na no nid long tokaut nem bilong yu. Mipela kisim liklik user data tasol: email bilong yu (long kamap bek account) na newsletter subscription sapos yu laik.',
    indonesian:
      'Ini berarti kontribusi Anda dapat digunakan oleh siapa saja untuk tujuan apa pun tanpa atribusi. Kami mengumpulkan data pengguna minimal: hanya email Anda (untuk pemulihan akun) dan langganan newsletter jika dipilih.'
  },
  analyticsInfo: {
    english:
      'We collect analytics and diagnostic data to improve the app and your experience. You can opt out of analytics at any time in your profile settings. Your data is processed and stored in the United States.',
    spanish:
      'Recopilamos datos de análisis y diagnóstico para mejorar la aplicación y su experiencia. Puede optar por no participar en el análisis en cualquier momento en sus ajustes. Sus datos se procesan y almacenan en los Estados Unidos.',
    brazilian_portuguese:
      'Coletamos dados analíticos e de diagnóstico para melhorar o aplicativo e sua experiência. Você pode optar por não participar da análise a qualquer momento nas configurações do seu perfil. Seus dados são processados e armazenados nos Estados Unidos.',
    tok_pisin:
      'Mipela kisim analytics na diagnostic data long mekim app na experience bilong yu i gutpela moa. Yu ken stopim analytics long wanem taim long profile settings bilong yu. Data bilong yu i go long United States.',
    indonesian:
      'Kami mengumpulkan data analitik dan diagnostik untuk meningkatkan aplikasi dan pengalaman Anda. Anda dapat memilih keluar dari analitik kapan saja di pengaturan profil Anda. Data Anda diproses dan disimpan di Amerika Serikat.'
  },
  viewFullTerms: {
    english: 'View Full Terms',
    spanish: 'Ver Términos Completos',
    brazilian_portuguese: 'Ver Termos Completos',
    tok_pisin: 'Lukim Olgeta Terms',
    indonesian: 'Lihat Syarat Lengkap'
  },
  viewFullPrivacy: {
    english: 'View Full Privacy',
    spanish: 'Ver Privacidad Completa',
    brazilian_portuguese: 'Ver Privacidade Completa',
    tok_pisin: 'Lukim Olgeta Privacy',
    indonesian: 'Lihat Privasi Lengkap'
  },
  submitFeedback: {
    english: 'Submit Feedback',
    spanish: 'Enviar Feedback',
    brazilian_portuguese: 'Enviar Feedback',
    tok_pisin: 'Salim Feedback',
    indonesian: 'Kirim Umpan Balik'
  },
  reportProject: {
    english: 'Report Project',
    spanish: 'Reportar Proyecto',
    brazilian_portuguese: 'Reportar Projeto'
  },
  reportQuest: {
    english: 'Report Quest',
    spanish: 'Reportar Quest',
    brazilian_portuguese: 'Reportar Quest'
  },
  reportAsset: {
    english: 'Report Asset',
    spanish: 'Reportar Recurso',
    brazilian_portuguese: 'Reportar Recurso'
  },
  reportTranslation: {
    english: 'Report Translation',
    spanish: 'Reportar Traducción',
    brazilian_portuguese: 'Reportar Tradução',
    tok_pisin: 'Reportim Translation',
    indonesian: 'Laporkan Terjemahan'
  },
  reportGeneric: {
    english: 'Report',
    spanish: 'Reportar',
    brazilian_portuguese: 'Reportar'
  },
  selectReasonLabel: {
    english: 'Select a reason',
    spanish: 'Seleccione un motivo',
    brazilian_portuguese: 'Selecione um motivo',
    tok_pisin: 'Makim wanpela reson',
    indonesian: 'Pilih alasan'
  },
  additionalDetails: {
    english: 'Additional Details',
    spanish: 'Detalles Adicionales',
    brazilian_portuguese: 'Detalhes Adicionais',
    tok_pisin: 'Moa Details',
    indonesian: 'Detail Tambahan'
  },
  additionalDetailsPlaceholder: {
    english: 'Provide any additional information...',
    spanish: 'Proporcionar cualquier información adicional...',
    brazilian_portuguese: 'Forneça qualquer informação adicional...',
    tok_pisin: 'Givim narapela information...',
    indonesian: 'Berikan informasi tambahan...'
  },
  submitReport: {
    english: 'Submit Report',
    spanish: 'Enviar Reporte',
    brazilian_portuguese: 'Enviar Relatório',
    tok_pisin: 'Salim Report',
    indonesian: 'Kirim Laporan'
  },
  submitting: {
    english: 'Submitting...',
    spanish: 'Enviando...',
    brazilian_portuguese: 'Enviando...',
    tok_pisin: 'Salim...',
    indonesian: 'Mengirim...'
  },
  reportSubmitted: {
    english: 'Report submitted successfully',
    spanish: 'Reporte enviado exitosamente',
    brazilian_portuguese: 'Relatório enviado com sucesso',
    tok_pisin: 'Report i go gut',
    indonesian: 'Laporan berhasil dikirim'
  },
  enterEmailForPasswordReset: {
    english: 'Enter your email to reset your password',
    spanish: 'Ingrese su email para restablecer su contraseña',
    brazilian_portuguese: 'Digite seu e-mail para redefinir sua senha',
    tok_pisin: 'Putim email bilong yu long resetim password',
    indonesian: 'Masukkan email Anda untuk mereset kata sandi'
  },
  failedToSubmitReport: {
    english: 'Failed to submit report',
    spanish: 'Error al enviar el reporte',
    brazilian_portuguese: 'Falha ao enviar relatório',
    tok_pisin: 'I no inap salim report',
    indonesian: 'Gagal mengirim laporan'
  },
  logInToReport: {
    english: 'You must be logged in to report translations',
    spanish: 'Debe iniciar sesión para reportar traducciones',
    brazilian_portuguese: 'Você deve estar logado para reportar traduções',
    tok_pisin: 'Yu mas login pastaim long reportim ol translation',
    indonesian: 'Anda harus masuk untuk melaporkan terjemahan'
  },
  selectReason: {
    english: 'Please select a reason for the report',
    spanish: 'Por favor seleccione un motivo para el reporte',
    brazilian_portuguese: 'Por favor, selecione um motivo para o relatório',
    tok_pisin: 'Plis makim wanpela reson long report',
    indonesian: 'Silakan pilih alasan untuk laporan'
  },
  enableAnalytics: {
    english: 'Enable Analytics',
    spanish: 'Habilitar Análisis',
    brazilian_portuguese: 'Habilitar Análise',
    tok_pisin: 'Onim Analytics',
    indonesian: 'Aktifkan Analitik'
  },
  analyticsDescription: {
    english:
      'When disabled, we will not collect usage data to improve the app.',
    spanish:
      'Cuando está deshabilitado, no recopilaremos datos de uso para mejorar la aplicación.',
    brazilian_portuguese:
      'Quando desativado, não coletaremos dados de uso para melhorar o aplicativo.',
    tok_pisin:
      'Sapos yu ofim, mipela no bai kisim usage data long mekim app i gutpela.',
    indonesian:
      'Ketika dinonaktifkan, kami tidak akan mengumpulkan data penggunaan untuk meningkatkan aplikasi.'
  },
  sessionExpired: {
    english: 'Session expired',
    spanish: 'Sesión expirada',
    brazilian_portuguese: 'Sessão expirada',
    tok_pisin: 'Session i pinis',
    indonesian: 'Sesi kedaluwarsa'
  },
  'reportReason.inappropriate_content': {
    english: 'Inappropriate Content',
    spanish: 'Contenido Inapropiado',
    brazilian_portuguese: 'Conteúdo Inapropriado',
    tok_pisin: 'Content i no gutpela',
    indonesian: 'Konten Tidak Pantas'
  },
  'reportReason.spam': {
    english: 'Spam',
    spanish: 'Spam',
    brazilian_portuguese: 'Spam',
    tok_pisin: 'Spam',
    indonesian: 'Spam'
  },
  'reportReason.other': {
    english: 'Other',
    spanish: 'Otro',
    brazilian_portuguese: 'Outro',
    tok_pisin: 'Narapela',
    indonesian: 'Lainnya'
  },
  updatePassword: {
    english: 'Update Password',
    spanish: 'Actualizar Contraseña',
    brazilian_portuguese: 'Atualizar Senha',
    tok_pisin: 'Updateim Password',
    indonesian: 'Perbarui Kata Sandi'
  },
  createNewPassword: {
    english: 'Create New Password',
    spanish: 'Crear nueva contraseña',
    brazilian_portuguese: 'Criar nova senha',
    tok_pisin: 'Mekim nupela password',
    indonesian: 'Buat Kata Sandi Baru'
  },
  downloadLimitExceeded: {
    english: 'Download Limit Exceeded',
    spanish: 'Límite de descarga excedido',
    brazilian_portuguese: 'Limite de download excedido',
    tok_pisin: 'Download limit i pinis',
    indonesian: 'Batas Unduhan Terlampaui'
  },
  downloadLimitMessage: {
    english:
      'You are trying to download {newDownloads} attachments for a total of {totalDownloads}, but the limit is {limit}. Please deselect some downloads and try again.',
    spanish:
      'Está intentando descargar {newDownloads} archivos adjuntos para un total de {totalDownloads}, pero el límite es {limit}. Por favor, deseleccione algunas descargas e intente nuevamente.',
    brazilian_portuguese:
      'Você está tentando baixar {newDownloads} anexos para um total de {totalDownloads}, mas o limite é {limit}. Por favor, desmarque alguns downloads e tente novamente.',
    tok_pisin:
      'Yu traim long download {newDownloads} attachments long total {totalDownloads}, tasol limit i {limit}. Plis unselectim sampela downloads na traim gen.',
    indonesian:
      'Anda mencoba mengunduh {newDownloads} lampiran untuk total {totalDownloads}, tetapi batasnya adalah {limit}. Silakan batalkan pilihan beberapa unduhan dan coba lagi.'
  },
  offlineUndownloadWarning: {
    english: 'Offline Undownload Warning',
    spanish: 'Advertencia de eliminación sin conexión',
    brazilian_portuguese: 'Aviso de remoção de download offline',
    tok_pisin: 'Offline Undownload Warning',
    indonesian: 'Peringatan Batalkan Unduhan Offline'
  },
  offlineUndownloadMessage: {
    english:
      "You are currently offline. If you remove this download, you won't be able to redownload it until you're back online. Your unsynced contributions will not be affected.",
    spanish:
      'Actualmente estás sin conexión. Si eliminas esta descarga, no podrás volver a descargarla hasta que vuelvas a estar en línea. Tus contribuciones no sincronizadas no se verán afectadas.',
    brazilian_portuguese:
      'Você está offline no momento. Se você remover este download, não poderá baixá-lo novamente até voltar a ficar online. Suas contribuições não sincronizadas não serão afetadas.',
    tok_pisin:
      'Yu no gat internet nau. Sapos yu rausim dispela download, yu no inap download gen inap yu gat internet gen. Ol contribution bilong yu i no sync yet bai no kena.',
    indonesian:
      'Anda sedang offline. Jika Anda menghapus unduhan ini, Anda tidak akan dapat mengunduhnya lagi sampai Anda kembali online. Kontribusi yang belum disinkronkan tidak akan terpengaruh.'
  },
  dontShowAgain: {
    english: "Don't show this message again",
    spanish: 'No mostrar este mensaje nuevamente',
    brazilian_portuguese: 'Não mostrar esta mensagem novamente',
    tok_pisin: 'No soim dispela message gen',
    indonesian: 'Jangan tampilkan pesan ini lagi'
  },
  cancel: {
    english: 'Cancel',
    spanish: 'Cancelar',
    brazilian_portuguese: 'Cancelar',
    tok_pisin: 'Cancel',
    indonesian: 'Batal'
  },
  confirm: {
    english: 'Confirm',
    spanish: 'Confirmar',
    brazilian_portuguese: 'Confirmar',
    tok_pisin: 'Confirm',
    indonesian: 'Konfirmasi'
  },
  blockThisContent: {
    english: 'Block this content',
    spanish: 'Bloquear este contenido',
    brazilian_portuguese: 'Bloquear este conteúdo',
    tok_pisin: 'Blokim dispela content',
    indonesian: 'Blokir konten ini'
  },
  blockThisUser: {
    english: 'Block this user',
    spanish: 'Bloquear este usuario',
    brazilian_portuguese: 'Bloquear este usuário',
    tok_pisin: 'Blokim dispela user',
    indonesian: 'Blokir pengguna ini'
  },
  // New backup-related translations
  backup: {
    english: 'Backup',
    spanish: 'Respaldo',
    brazilian_portuguese: 'Backup',
    tok_pisin: 'Backup',
    indonesian: 'Cadangan'
  },
  backingUp: {
    english: 'Backing Up...',
    spanish: 'Respaldando...',
    brazilian_portuguese: 'Fazendo Backup...',
    tok_pisin: 'Backup...',
    indonesian: 'Mencadangkan...'
  },
  restoreBackup: {
    english: 'Restore Backup',
    spanish: 'Restaurar Respaldo',
    brazilian_portuguese: 'Restaurar Backup',
    tok_pisin: 'Restore Backup',
    indonesian: 'Pulihkan Cadangan'
  },
  restoring: {
    english: 'Restoring...',
    spanish: 'Restaurando...',
    brazilian_portuguese: 'Restaurando...',
    tok_pisin: 'Restore...',
    indonesian: 'Memulihkan...'
  },
  startBackupTitle: {
    english: 'Create Backup',
    spanish: 'Crear Respaldo',
    brazilian_portuguese: 'Criar Backup',
    tok_pisin: 'Mekim Backup',
    indonesian: 'Buat Cadangan'
  },
  startBackupMessageAudioOnly: {
    english: 'Would you like to back up your unsynced audio recordings?',
    spanish:
      '¿Desea hacer una copia de seguridad de sus grabaciones de audio no sincronizadas?',
    brazilian_portuguese:
      'Gostaria de fazer backup das suas gravações de áudio não sincronizadas?',
    tok_pisin: 'Yu laik backup ol audio recording bilong yu i no sync yet?',
    indonesian:
      'Apakah Anda ingin mencadangkan rekaman audio yang belum disinkronkan?'
  },
  backupAudioAction: {
    english: 'Backup audio and text',
    spanish: 'Respaldar audio y texto',
    brazilian_portuguese: 'Backup de áudio e texto',
    tok_pisin: 'Backup audio na text',
    indonesian: 'Cadangkan audio dan teks'
  },
  backupErrorTitle: {
    english: 'Backup Error',
    spanish: 'Error de Respaldo',
    brazilian_portuguese: 'Erro de Backup',
    tok_pisin: 'Backup Rong',
    indonesian: 'Kesalahan Cadangan'
  },
  backupCompleteTitle: {
    english: 'Backup Complete',
    spanish: 'Respaldo Completado',
    brazilian_portuguese: 'Backup Concluído',
    tok_pisin: 'Backup Pinis',
    indonesian: 'Cadangan Selesai'
  },
  audioBackupStatus: {
    english: 'Successfully backed up {count} audio recordings',
    spanish: 'Se respaldaron con éxito {count} grabaciones de audio',
    brazilian_portuguese:
      'Backup de {count} gravações de áudio concluído com sucesso',
    tok_pisin: 'Backup {count} audio recordings gut',
    indonesian: 'Berhasil mencadangkan {count} rekaman audio'
  },
  criticalBackupError: {
    english: 'A critical error occurred: {error}',
    spanish: 'Ocurrió un error crítico: {error}',
    brazilian_portuguese: 'Ocorreu um erro crítico: {error}',
    tok_pisin: 'Bikpela rong i kamap: {error}',
    indonesian: 'Terjadi kesalahan kritis: {error}'
  },
  databaseNotReady: {
    english: 'Database is not ready. Please try again later.',
    spanish: 'La base de datos no está lista. Por favor, inténtelo más tarde.',
    brazilian_portuguese:
      'O banco de dados não está pronto. Por favor, tente novamente mais tarde.',
    tok_pisin: 'Database i no redi yet. Plis traim gen bihain.',
    indonesian: 'Database belum siap. Silakan coba lagi nanti.'
  },
  storagePermissionDenied: {
    english: 'Storage permission denied. Backup cannot proceed.',
    spanish:
      'Permiso de almacenamiento denegado. El respaldo no puede continuar.',
    brazilian_portuguese:
      'Permissão de armazenamento negada. O backup não pode prosseguir.',
    tok_pisin: 'Storage permission i no. Backup i no inap go.',
    indonesian: 'Izin penyimpanan ditolak. Cadangan tidak dapat dilanjutkan.'
  },
  // Adding missing translation keys
  initializing: {
    english: 'Initializing',
    spanish: 'Inicializando',
    brazilian_portuguese: 'Inicializando',
    tok_pisin: 'Initializing',
    indonesian: 'Menginisialisasi'
  },
  syncComplete: {
    english: 'Sync complete',
    spanish: 'Sincronización completa',
    brazilian_portuguese: 'Sincronização completa',
    tok_pisin: 'Sync pinis',
    indonesian: 'Sinkronisasi selesai'
  },
  syncProgress: {
    english: '{current} of {total} files',
    spanish: '{current} de {total} archivos',
    brazilian_portuguese: '{current} de {total} arquivos',
    tok_pisin: '{current} long {total} files',
    indonesian: '{current} dari {total} file'
  },
  userNotLoggedIn: {
    english: 'You must be logged in to perform this action',
    spanish: 'Debe iniciar sesión para realizar esta acción',
    brazilian_portuguese: 'Você deve estar logado para realizar esta ação',
    tok_pisin: 'Yu mas login pastaim long mekim dispela samting',
    indonesian: 'Anda harus masuk untuk melakukan tindakan ini'
  },
  cannotReportOwnTranslation: {
    english: 'You cannot report your own translation',
    spanish: 'No puede reportar su propia traducción',
    brazilian_portuguese: 'Você não pode reportar sua própria tradução',
    tok_pisin: 'Yu no inap reportim translation bilong yu yet',
    indonesian: 'Anda tidak dapat melaporkan terjemahan Anda sendiri'
  },
  cannotReportInactiveTranslation: {
    english: 'You cannot report inactive translation',
    spanish: 'No puede reportar traducción inactiva',
    brazilian_portuguese: 'Você não pode reportar tradução inativa',
    tok_pisin: 'Yu no inap reportim translation i no active',
    indonesian: 'Anda tidak dapat melaporkan terjemahan yang tidak aktif'
  },
  cannotIdentifyUser: {
    english: 'Unable to identify user',
    spanish: 'No se puede identificar al usuario',
    brazilian_portuguese: 'Não foi possível identificar o usuário',
    tok_pisin: 'No inap save user',
    indonesian: 'Tidak dapat mengidentifikasi pengguna'
  },
  cannotChangeTranslationSettings: {
    english: 'Unathorized to change settings for this translation',
    spanish:
      'No tiene autorización para cambiar la configuración de esta traducción',
    brazilian_portuguese:
      'Você não tem autorização para alterar as configurações desta tradução',
    tok_pisin:
      'Yu no gat rait long senisim settings bilong dispela translation',
    indonesian: 'Tidak berwenang untuk mengubah pengaturan terjemahan ini'
  },
  alreadyReportedTranslation: {
    english: 'You have already reported this translation',
    spanish: 'Ya ha reportado esta traducción',
    brazilian_portuguese: 'Você já reportou esta tradução',
    tok_pisin: 'Yu reportim dispela translation pinis',
    indonesian: 'Anda sudah melaporkan terjemahan ini'
  },
  failedSaveAnalyticsPreference: {
    english: 'Failed to save analytics preference',
    spanish: 'Error al guardar la preferencia de análisis',
    brazilian_portuguese: 'Falha ao salvar preferência de análise',
    tok_pisin: 'I no inap seivim analytics preference',
    indonesian: 'Gagal menyimpan preferensi analitik'
  },
  currentPasswordRequired: {
    english: 'Current password is required',
    spanish: 'Se requiere la contraseña actual',
    brazilian_portuguese: 'A senha atual é obrigatória',
    tok_pisin: 'Password bilong nau i mas',
    indonesian: 'Kata sandi saat ini diperlukan'
  },
  profileUpdateSuccess: {
    english: 'Profile updated successfully',
    spanish: 'Perfil actualizado con éxito',
    brazilian_portuguese: 'Perfil atualizado com sucesso',
    tok_pisin: 'Profile i update gut',
    indonesian: 'Profil berhasil diperbarui'
  },
  failedUpdateProfile: {
    english: 'Failed to update profile',
    spanish: 'Error al actualizar el perfil',
    brazilian_portuguese: 'Falha ao atualizar perfil',
    tok_pisin: 'I no inap updateim profile',
    indonesian: 'Gagal memperbarui profil'
  },
  assetNotFound: {
    english: 'Asset not found',
    spanish: 'Recurso no encontrado',
    brazilian_portuguese: 'Recurso não encontrado',
    tok_pisin: 'Asset i no stap',
    indonesian: 'Aset tidak ditemukan'
  },
  failedLoadAssetData: {
    english: 'Failed to load asset data',
    spanish: 'Error al cargar datos del recurso',
    brazilian_portuguese: 'Falha ao carregar dados do recurso',
    tok_pisin: 'I no inap loadim asset data',
    indonesian: 'Gagal memuat data aset'
  },
  failedLoadAssets: {
    english: 'Failed to load assets',
    spanish: 'Error al cargar recursos',
    brazilian_portuguese: 'Falha ao carregar recursos',
    tok_pisin: 'I no inap loadim ol asset',
    indonesian: 'Gagal memuat aset'
  },
  projectMembers: {
    english: 'Project Members',
    spanish: 'Miembros del Proyecto',
    brazilian_portuguese: 'Membros do Projeto',
    tok_pisin: 'Ol Member bilong Project',
    indonesian: 'Anggota Proyek'
  },
  members: {
    english: 'Members',
    spanish: 'Miembros',
    brazilian_portuguese: 'Membros',
    tok_pisin: 'Ol Member',
    indonesian: 'Anggota'
  },
  invited: {
    english: 'Invited',
    spanish: 'Invitados',
    brazilian_portuguese: 'Convidados',
    tok_pisin: 'Ol i invitim',
    indonesian: 'Diundang'
  },
  viewInvitation: {
    english: 'View Invitation',
    spanish: 'Ver Invitación',
    brazilian_portuguese: 'Ver Convite',
    tok_pisin: 'Lukim Invitation',
    indonesian: 'Lihat Undangan'
  },
  inviteMembers: {
    english: 'Invite Members',
    spanish: 'Invitar Miembros',
    brazilian_portuguese: 'Convidar Membros',
    tok_pisin: 'Invitim ol Member',
    indonesian: 'Undang Anggota'
  },
  inviteAsOwner: {
    english: 'Invite as owner',
    spanish: 'Invitar como propietario',
    brazilian_portuguese: 'Convidar como proprietário',
    tok_pisin: 'Invitim olsem owner',
    indonesian: 'Undang sebagai pemilik'
  },
  sendInvitation: {
    english: 'Send Invitation',
    spanish: 'Enviar Invitación',
    brazilian_portuguese: 'Enviar Convite',
    tok_pisin: 'Salim Invitation',
    indonesian: 'Kirim Undangan'
  },
  owner: {
    english: 'Owner',
    spanish: 'Propietario',
    brazilian_portuguese: 'Proprietário',
    tok_pisin: 'Owner',
    indonesian: 'Pemilik'
  },
  member: {
    english: 'Member',
    spanish: 'Miembro',
    brazilian_portuguese: 'Membro',
    tok_pisin: 'Member',
    indonesian: 'Anggota'
  },
  makeOwner: {
    english: 'Make Owner',
    spanish: 'Hacer Propietario',
    brazilian_portuguese: 'Tornar Proprietário',
    tok_pisin: 'Mekim Owner',
    indonesian: 'Jadikan Pemilik'
  },
  remove: {
    english: 'Remove',
    spanish: 'Eliminar',
    brazilian_portuguese: 'Remover',
    tok_pisin: 'Rausim',
    indonesian: 'Hapus'
  },
  withdrawInvite: {
    english: 'Withdraw Invite',
    spanish: 'Retirar Invitación',
    brazilian_portuguese: 'Retirar Convite',
    tok_pisin: 'Rausim Invite',
    indonesian: 'Tarik Undangan'
  },
  you: {
    english: 'You',
    spanish: 'Tú',
    brazilian_portuguese: 'Você',
    tok_pisin: 'Yu',
    indonesian: 'Anda'
  },
  pendingInvitation: {
    english: 'Pending',
    spanish: 'Pendiente',
    brazilian_portuguese: 'Pendente',
    tok_pisin: 'Wet',
    indonesian: 'Tertunda'
  },
  noMembers: {
    english: 'No members yet',
    spanish: 'No hay miembros todavía',
    brazilian_portuguese: 'Ainda não há membros',
    tok_pisin: 'No gat member yet',
    indonesian: 'Belum ada anggota'
  },
  noInvitations: {
    english: 'No pending invitations',
    spanish: 'No hay invitaciones pendientes',
    brazilian_portuguese: 'Nenhum convite pendente',
    tok_pisin: 'No gat invitation i wet',
    indonesian: 'Tidak ada undangan tertunda'
  },
  ownerTooltip: {
    english:
      'Owners can create content, invite and promote other members, and cannot be demoted back to membership or removed from a project by other members.',
    spanish:
      'Los propietarios pueden crear contenido, invitar y promover a otros miembros, y no pueden ser degradados a miembros o eliminados de un proyecto por otros miembros.',
    brazilian_portuguese:
      'Proprietários podem criar conteúdo, convidar e promover outros membros, e não podem ser rebaixados de volta à associação ou removidos de um projeto por outros membros.',
    tok_pisin:
      'Ol owner ken mekim content, invitim na promotim narapela member, na ol narapela member no inap daunim o rausim ol long project.',
    indonesian:
      'Pemilik dapat membuat konten, mengundang dan mempromosikan anggota lain, dan tidak dapat diturunkan kembali ke keanggotaan atau dihapus dari proyek oleh anggota lain.'
  },
  confirmRemoveMessage: {
    english: 'Are you sure you want to remove {name} from this project?',
    spanish: '¿Está seguro de que desea eliminar a {name} de este proyecto?',
    brazilian_portuguese:
      'Tem certeza de que deseja remover {name} deste projeto?',
    tok_pisin: 'Yu tru laik rausim {name} long dispela project?',
    indonesian: 'Apakah Anda yakin ingin menghapus {name} dari proyek ini?'
  },
  confirmPromote: {
    english: 'Confirm Promote',
    spanish: 'Confirmar Promoción',
    brazilian_portuguese: 'Confirmar Promoção',
    tok_pisin: 'Confirm Promote',
    indonesian: 'Konfirmasi Promosi'
  },
  confirmPromoteMessage: {
    english:
      'Are you sure you want to make {name} an owner? This action cannot be undone.',
    spanish:
      '¿Está seguro de que desea hacer a {name} propietario? Esta acción no se puede deshacer.',
    brazilian_portuguese:
      'Tem certeza de que deseja tornar {name} um proprietário? Esta ação não pode ser desfeita.',
    tok_pisin:
      'Yu tru laik mekim {name} i owner? Dispela samting yu no inap senisim bek.',
    indonesian:
      'Apakah Anda yakin ingin menjadikan {name} sebagai pemilik? Tindakan ini tidak dapat dibatalkan.'
  },
  confirmLeave: {
    english: 'Leave Project',
    spanish: 'Abandonar Proyecto',
    brazilian_portuguese: 'Sair do Projeto',
    tok_pisin: 'Lusim Project',
    indonesian: 'Tinggalkan Proyek'
  },
  confirmLeaveMessage: {
    english: 'Are you sure you want to leave this project?',
    spanish: '¿Está seguro de que desea abandonar este proyecto?',
    brazilian_portuguese: 'Tem certeza de que deseja sair deste projeto?',
    tok_pisin: 'Yu tru laik lusim dispela project?',
    indonesian: 'Apakah Anda yakin ingin meninggalkan proyek ini?'
  },
  cannotLeaveAsOnlyOwner: {
    english:
      'You cannot leave this project as you are the only owner. Please promote another member to owner first.',
    spanish:
      'No puede abandonar este proyecto porque es el único propietario. Por favor, promueva a otro miembro a propietario primero.',
    brazilian_portuguese:
      'Você não pode sair deste projeto porque é o único proprietário. Por favor, promova outro membro a proprietário primeiro.',
    tok_pisin:
      'Yu no inap lusim dispela project bilong yu stap owner tasol. Plis promotim narapela member i kamap owner pastaim.',
    indonesian:
      'Anda tidak dapat meninggalkan proyek ini karena Anda adalah satu-satunya pemilik. Silakan promosikan anggota lain menjadi pemilik terlebih dahulu.'
  },
  invitationAlreadySent: {
    english: 'An invitation has already been sent to this email address.',
    spanish:
      'Ya se ha enviado una invitación a esta dirección de correo electrónico.',
    brazilian_portuguese:
      'Um convite já foi enviado para este endereço de e-mail.',
    tok_pisin: 'Invitation i go pinis long dispela email adres.',
    indonesian: 'Undangan sudah dikirim ke alamat email ini.'
  },
  invitationSent: {
    english: 'Invitation sent successfully',
    spanish: 'Invitación enviada con éxito',
    brazilian_portuguese: 'Convite enviado com sucesso',
    tok_pisin: 'Invitation i go gut',
    indonesian: 'Undangan berhasil dikirim'
  },
  expiredInvitation: {
    english: 'Expired',
    spanish: 'Expirado',
    brazilian_portuguese: 'Expirado',
    tok_pisin: 'Pinis',
    indonesian: 'Kedaluwarsa'
  },
  declinedInvitation: {
    english: 'Declined',
    spanish: 'Rechazado',
    brazilian_portuguese: 'Recusado',
    tok_pisin: 'Refusim',
    indonesian: 'Ditolak'
  },
  withdrawnInvitation: {
    english: 'Withdrawn',
    spanish: 'Retirado',
    brazilian_portuguese: 'Retirado',
    tok_pisin: 'Rausim',
    indonesian: 'Ditarik'
  },
  sending: {
    english: 'Sending...',
    spanish: 'Enviando...',
    brazilian_portuguese: 'Enviando...',
    tok_pisin: 'Salim...',
    indonesian: 'Mengirim...'
  },
  failedToRemoveMember: {
    english: 'Failed to remove member',
    spanish: 'Error al eliminar miembro',
    brazilian_portuguese: 'Falha ao remover membro',
    tok_pisin: 'I no inap rausim member',
    indonesian: 'Gagal menghapus anggota'
  },
  failedToPromoteMember: {
    english: 'Failed to promote member',
    spanish: 'Error al promover miembro',
    brazilian_portuguese: 'Falha ao promover membro',
    tok_pisin: 'I no inap promotim member',
    indonesian: 'Gagal mempromosikan anggota'
  },
  failedToLeaveProject: {
    english: 'Failed to leave project',
    spanish: 'Error al abandonar el proyecto',
    brazilian_portuguese: 'Falha ao sair do projeto',
    tok_pisin: 'I no inap lusim project',
    indonesian: 'Gagal meninggalkan proyek'
  },
  failedToWithdrawInvitation: {
    english: 'Failed to withdraw invitation',
    spanish: 'Error al retirar la invitación',
    brazilian_portuguese: 'Falha ao retirar o convite',
    tok_pisin: 'I no inap rausim invitation',
    indonesian: 'Gagal menarik undangan'
  },
  failedToSendInvitation: {
    english: 'Failed to send invitation',
    spanish: 'Error al enviar la invitación',
    brazilian_portuguese: 'Falha ao enviar o convite',
    tok_pisin: 'I no inap salim invitation',
    indonesian: 'Gagal mengirim undangan'
  },
  privateProject: {
    english: 'Private Project',
    spanish: 'Proyecto Privado',
    brazilian_portuguese: 'Projeto Privado',
    tok_pisin: 'Private Project',
    indonesian: 'Proyek Pribadi'
  },
  privateProjectDescription: {
    english:
      'This is a private project. Only members and owners can contribute translations and votes.',
    spanish:
      'Este es un proyecto privado. Solo los miembros y propietarios pueden contribuir con traducciones y votos.',
    brazilian_portuguese:
      'Este é um projeto privado. Apenas membros e proprietários podem contribuir com traduções e votos.',
    tok_pisin:
      'Dispela i private project. Ol member na owner tasol ken contributim translation na vote.',
    indonesian:
      'Ini adalah proyek pribadi. Hanya anggota dan pemilik yang dapat berkontribusi terjemahan dan suara.'
  },
  privateProjectInfo: {
    english:
      'To contribute to this project, you need to request membership. Project owners will review your request.',
    spanish:
      'Para contribuir a este proyecto, debe solicitar membresía. Los propietarios del proyecto revisarán su solicitud.',
    brazilian_portuguese:
      'Para contribuir com este projeto, você precisa solicitar associação. Os proprietários do projeto analisarão sua solicitação.',
    tok_pisin:
      'Long contributim long dispela project, yu mas askim membership. Ol owner bilong project bai lukim request bilong yu.',
    indonesian:
      'Untuk berkontribusi pada proyek ini, Anda perlu meminta keanggotaan. Pemilik proyek akan meninjau permintaan Anda.'
  },
  privateProjectNotLoggedIn: {
    english:
      'This is a private project. You must be logged in to request access.',
    spanish:
      'Este es un proyecto privado. Debe iniciar sesión para solicitar acceso.',
    brazilian_portuguese:
      'Este é um projeto privado. Você deve estar logado para solicitar acesso.',
    tok_pisin:
      'Dispela i private project. Yu mas login pastaim long askim access.',
    indonesian:
      'Ini adalah proyek pribadi. Anda harus masuk untuk meminta akses.'
  },
  privateProjectLoginRequired: {
    english: 'Please sign in to request membership to this private project.',
    spanish:
      'Por favor, inicie sesión para solicitar membresía a este proyecto privado.',
    brazilian_portuguese:
      'Por favor, faça login para solicitar associação a este projeto privado.',
    tok_pisin:
      'Plis sign in long askim membership long dispela private project.',
    indonesian: 'Silakan masuk untuk meminta keanggotaan proyek pribadi ini.'
  },
  requestMembership: {
    english: 'Request Membership',
    spanish: 'Solicitar Membresía',
    brazilian_portuguese: 'Solicitar Associação',
    tok_pisin: 'Askim Membership',
    indonesian: 'Minta Keanggotaan'
  },
  requesting: {
    english: 'Requesting...',
    spanish: 'Solicitando...',
    brazilian_portuguese: 'Solicitando...',
    tok_pisin: 'Askim...',
    indonesian: 'Meminta...'
  },
  requestPending: {
    english: 'Request Pending',
    spanish: 'Solicitud Pendiente',
    brazilian_portuguese: 'Solicitação Pendente',
    tok_pisin: 'Request i wet',
    indonesian: 'Permintaan Tertunda'
  },
  requestPendingDescription: {
    english: 'Your membership request is pending review by the project owners.',
    spanish:
      'Su solicitud de membresía está pendiente de revisión por los propietarios del proyecto.',
    brazilian_portuguese:
      'Sua solicitação de associação está pendente de análise pelos proprietários do projeto.',
    tok_pisin:
      'Membership request bilong yu i wet long ol owner bilong project lukim.',
    indonesian:
      'Permintaan keanggotaan Anda sedang menunggu tinjauan oleh pemilik proyek.'
  },
  withdrawRequest: {
    english: 'Withdraw Request',
    spanish: 'Retirar Solicitud',
    brazilian_portuguese: 'Retirar Solicitação',
    tok_pisin: 'Rausim Request',
    indonesian: 'Tarik Permintaan'
  },
  withdrawing: {
    english: 'Withdrawing...',
    spanish: 'Retirando...',
    brazilian_portuguese: 'Retirando...',
    tok_pisin: 'Rausim...',
    indonesian: 'Menarik...'
  },
  confirmWithdraw: {
    english: 'Withdraw Request',
    spanish: 'Retirar Solicitud',
    brazilian_portuguese: 'Retirar Solicitação',
    tok_pisin: 'Rausim Request',
    indonesian: 'Tarik Permintaan'
  },
  confirmWithdrawRequestMessage: {
    english: 'Are you sure you want to withdraw your membership request?',
    spanish: '¿Está seguro de que desea retirar su solicitud de membresía?',
    brazilian_portuguese:
      'Tem certeza de que deseja retirar sua solicitação de associação?',
    tok_pisin: 'Yu tru laik rausim membership request bilong yu?',
    indonesian: 'Apakah Anda yakin ingin menarik permintaan keanggotaan Anda?'
  },
  requestWithdrawn: {
    english: 'Request withdrawn successfully',
    spanish: 'Solicitud retirada con éxito',
    brazilian_portuguese: 'Solicitação retirada com sucesso',
    tok_pisin: 'Request i rausim gut',
    indonesian: 'Permintaan berhasil ditarik'
  },
  requestExpired: {
    english: 'Request Expired',
    spanish: 'Solicitud Expirada',
    brazilian_portuguese: 'Solicitação Expirada',
    tok_pisin: 'Request i pinis',
    indonesian: 'Permintaan Kedaluwarsa'
  },
  requestExpiredDescription: {
    english:
      'Your membership request has expired. You can submit a new request.',
    spanish:
      'Su solicitud de membresía ha expirado. Puede enviar una nueva solicitud.',
    brazilian_portuguese:
      'Sua solicitação de associação expirou. Você pode enviar uma nova solicitação.',
    tok_pisin:
      'Membership request bilong yu i pinis. Yu ken salim nupela request.',
    indonesian:
      'Permintaan keanggotaan Anda telah kedaluwarsa. Anda dapat mengirim permintaan baru.'
  },
  requestAgain: {
    english: 'Request Again',
    spanish: 'Solicitar Nuevamente',
    brazilian_portuguese: 'Solicitar Novamente',
    tok_pisin: 'Askim Gen',
    indonesian: 'Minta Lagi'
  },
  requestDeclined: {
    english: 'Request Declined',
    spanish: 'Solicitud Rechazada',
    brazilian_portuguese: 'Solicitação Recusada',
    tok_pisin: 'Request i no',
    indonesian: 'Permintaan Ditolak'
  },
  requestDeclinedCanRetry: {
    english:
      'Your membership request was declined. You have {attempts} more attempts to request membership.',
    spanish:
      'Su solicitud de membresía fue rechazada. Tiene {attempts} intentos más para solicitar membresía.',
    brazilian_portuguese:
      'Sua solicitação de associação foi recusada. Você tem {attempts} tentativas restantes para solicitar associação.',
    tok_pisin:
      'Membership request bilong yu i no. Yu gat {attempts} moa chance long askim membership.',
    indonesian:
      'Permintaan keanggotaan Anda ditolak. Anda memiliki {attempts} percobaan lagi untuk meminta keanggotaan.'
  },
  requestDeclinedNoRetry: {
    english:
      'Your membership request was declined and you have reached the maximum number of attempts.',
    spanish:
      'Su solicitud de membresía fue rechazada y ha alcanzado el número máximo de intentos.',
    brazilian_portuguese:
      'Sua solicitação de associação foi recusada e você atingiu o número máximo de tentativas.',
    tok_pisin:
      'Membership request bilong yu i no na yu kamap long maximum number bilong chance.',
    indonesian:
      'Permintaan keanggotaan Anda ditolak dan Anda telah mencapai jumlah maksimum percobaan.'
  },
  requestWithdrawnTitle: {
    english: 'Request Withdrawn',
    spanish: 'Solicitud Retirada',
    brazilian_portuguese: 'Solicitação Retirada',
    tok_pisin: 'Request i Rausim',
    indonesian: 'Permintaan Ditarik'
  },
  requestWithdrawnDescription: {
    english:
      'You have withdrawn your membership request. You can submit a new request at any time.',
    spanish:
      'Ha retirado su solicitud de membresía. Puede enviar una nueva solicitud en cualquier momento.',
    brazilian_portuguese:
      'Você retirou sua solicitação de associação. Você pode enviar uma nova solicitação a qualquer momento.',
    tok_pisin:
      'Yu rausim membership request bilong yu. Yu ken salim nupela request long wanem taim.',
    indonesian:
      'Anda telah menarik permintaan keanggotaan Anda. Anda dapat mengirim permintaan baru kapan saja.'
  },
  membershipRequestSent: {
    english: 'Membership request sent successfully',
    spanish: 'Solicitud de membresía enviada con éxito',
    brazilian_portuguese: 'Solicitação de associação enviada com sucesso',
    tok_pisin: 'Membership request i go gut',
    indonesian: 'Permintaan keanggotaan berhasil dikirim'
  },
  failedToRequestMembership: {
    english: 'Failed to request membership',
    spanish: 'Error al solicitar membresía',
    brazilian_portuguese: 'Falha ao solicitar associação',
    tok_pisin: 'I no inap askim membership',
    indonesian: 'Gagal meminta keanggotaan'
  },
  failedToWithdrawRequest: {
    english: 'Failed to withdraw request',
    spanish: 'Error al retirar la solicitud',
    brazilian_portuguese: 'Falha ao retirar a solicitação',
    tok_pisin: 'I no inap rausim request',
    indonesian: 'Gagal menarik permintaan'
  },
  goBack: {
    english: 'Go Back',
    spanish: 'Volver',
    brazilian_portuguese: 'Voltar',
    tok_pisin: 'Go bek',
    indonesian: 'Kembali'
  },
  confirmRemove: {
    english: 'Confirm Remove',
    spanish: 'Confirmar Eliminación',
    brazilian_portuguese: 'Confirmar Remoção',
    tok_pisin: 'Confirm Rausim',
    indonesian: 'Konfirmasi Hapus'
  },
  invitationResent: {
    english: 'Invitation resent successfully',
    spanish: 'Invitación reenviada con éxito',
    brazilian_portuguese: 'Convite reenviado com sucesso',
    tok_pisin: 'Invitation i salim gen gut',
    indonesian: 'Undangan berhasil dikirim ulang'
  },
  maxInviteAttemptsReached: {
    english: 'Maximum invitation attempts reached for this email',
    spanish:
      'Se alcanzó el número máximo de intentos de invitación para este correo',
    brazilian_portuguese:
      'Número máximo de tentativas de convite atingido para este e-mail',
    tok_pisin: 'Maximum invitation chance i pinis long dispela email',
    indonesian: 'Percobaan undangan maksimum tercapai untuk email ini'
  },
  invitationAcceptedButDownloadFailed: {
    english:
      'Invitation accepted, but project download failed. You can download it later from the projects page.',
    spanish:
      'Invitación aceptada, pero la descarga del proyecto falló. Puedes descargarlo más tarde desde la página de proyectos.',
    brazilian_portuguese:
      'Convite aceito, mas o download do projeto falhou. Você pode baixá-lo mais tarde na página de projetos.',
    tok_pisin:
      'Invitation i orait, tasol project download i no inap. Yu ken download em bihain long projects page.',
    indonesian:
      'Undangan diterima, tetapi unduhan proyek gagal. Anda dapat mengunduhnya nanti dari halaman proyek.'
  },
  invitationAcceptedSuccess: {
    english: 'Invitation accepted successfully!',
    spanish: '¡Invitación aceptada con éxito!',
    brazilian_portuguese: 'Convite aceito com sucesso!',
    tok_pisin: 'Invitation i akseptim gut!',
    indonesian: 'Undangan berhasil diterima!'
  },
  invitationDeclined: {
    english: 'Invitation declined.',
    spanish: 'Invitación rechazada.',
    brazilian_portuguese: 'Convite recusado.',
    tok_pisin: 'Invitation i no.',
    indonesian: 'Undangan ditolak.'
  },
  joinRequest: {
    english: 'Join Request',
    spanish: 'Solicitud de Unión',
    brazilian_portuguese: 'Solicitação de Adesão',
    tok_pisin: 'Join Request',
    indonesian: 'Permintaan Bergabung'
  },
  privateProjectAccess: {
    english: 'Private Project Access',
    spanish: 'Acceso a Proyecto Privado',
    brazilian_portuguese: 'Acesso ao Projeto Privado',
    tok_pisin: 'Private Project Access',
    indonesian: 'Akses Proyek Pribadi'
  },
  privateProjectDownload: {
    english: 'Private Project Download',
    spanish: 'Descarga de Proyecto Privado',
    brazilian_portuguese: 'Download de Projeto Privado',
    tok_pisin: 'Private Project Download',
    indonesian: 'Unduh Proyek Pribadi'
  },
  privateProjectDownloadMessage: {
    english:
      'This project is private. You can download the content but will not be able to contribute translations or votes. Request access to join this project and start contributing.',
    spanish:
      'Este proyecto es privado. Puedes descargar el contenido pero no podrás contribuir con traducciones o votos. Solicita acceso para unirte a este proyecto y comenzar a contribuir.',
    brazilian_portuguese:
      'Este projeto é privado. Você pode baixar o conteúdo, mas não poderá contribuir com traduções ou votos. Solicite acesso para participar deste projeto e começar a contribuir.',
    tok_pisin:
      'Dispela project i private. Yu ken download content tasol yu no inap contributim translation o vote. Askim access long joinim dispela project na startim contributim.',
    indonesian:
      'Proyek ini pribadi. Anda dapat mengunduh konten tetapi tidak akan dapat berkontribusi terjemahan atau suara. Minta akses untuk bergabung dengan proyek ini dan mulai berkontribusi.'
  },
  privateProjectEditing: {
    english: 'Private Project Editing',
    spanish: 'Edición de Proyecto Privado',
    brazilian_portuguese: 'Edição de Projeto Privado',
    tok_pisin: 'Private Project Editing',
    indonesian: 'Pengeditan Proyek Pribadi'
  },
  privateProjectEditingMessage: {
    english:
      'This project is private. You need to be a member to edit transcriptions. Request access to join this project.',
    spanish:
      'Este proyecto es privado. Necesitas ser miembro para editar transcripciones. Solicita acceso para unirte a este proyecto.',
    brazilian_portuguese:
      'Este projeto é privado. Você precisa ser membro para editar transcrições. Solicite acesso para participar deste projeto.',
    tok_pisin:
      'Dispela project i private. Yu mas stap member long editim transcription. Askim access long joinim dispela project.',
    indonesian:
      'Proyek ini pribadi. Anda perlu menjadi anggota untuk mengedit transkripsi. Minta akses untuk bergabung dengan proyek ini.'
  },
  privateProjectGenericMessage: {
    english:
      'This project is private. You need to be a member to access this feature. Request access to join this project.',
    spanish:
      'Este proyecto es privado. Necesitas ser miembro para acceder a esta función. Solicita acceso para unirte a este proyecto.',
    brazilian_portuguese:
      'Este projeto é privado. Você precisa ser membro para acessar este recurso. Solicite acesso para participar deste projeto.',
    tok_pisin:
      'Dispela project i private. Yu mas stap member long usim dispela feature. Askim access long joinim dispela project.',
    indonesian:
      'Proyek ini pribadi. Anda perlu menjadi anggota untuk mengakses fitur ini. Minta akses untuk bergabung dengan proyek ini.'
  },
  privateProjectMembers: {
    english: 'Private Project Members',
    spanish: 'Miembros del Proyecto Privado',
    brazilian_portuguese: 'Membros do Projeto Privado',
    tok_pisin: 'Private Project Members',
    indonesian: 'Anggota Proyek Pribadi'
  },
  privateProjectMembersMessage: {
    english:
      'You need to be a member to view the member list and send invitations. Request access to join this project.',
    spanish:
      'Necesitas ser miembro para ver la lista de miembros y enviar invitaciones. Solicita acceso para unirte a este proyecto.',
    brazilian_portuguese:
      'Você precisa ser membro para ver a lista de membros e enviar convites. Solicite acesso para participar deste projeto.',
    tok_pisin:
      'Yu mas stap member long lukim member list na salim invitation. Askim access long joinim dispela project.',
    indonesian:
      'Anda perlu menjadi anggota untuk melihat daftar anggota dan mengirim undangan. Minta akses untuk bergabung dengan proyek ini.'
  },
  privateProjectNotLoggedInInline: {
    english: 'You need to be logged in to access this private project.',
    spanish: 'Necesitas iniciar sesión para acceder a este proyecto privado.',
    brazilian_portuguese:
      'Você precisa estar logado para acessar este projeto privado.',
    tok_pisin: 'Yu mas login pastaim long access dispela private project.',
    indonesian: 'Anda perlu masuk untuk mengakses proyek pribadi ini.'
  },
  privateProjectTranslation: {
    english: 'Private Project Translation',
    spanish: 'Traducción de Proyecto Privado',
    brazilian_portuguese: 'Tradução de Projeto Privado',
    tok_pisin: 'Private Project Translation',
    indonesian: 'Terjemahan Proyek Pribadi'
  },
  privateProjectTranslationMessage: {
    english:
      'This project is private. You need to be a member to submit translations. Request access to join this project.',
    spanish:
      'Este proyecto es privado. Necesitas ser miembro para enviar traducciones. Solicita acceso para unirte a este proyecto.',
    brazilian_portuguese:
      'Este projeto é privado. Você precisa ser membro para enviar traduções. Solicite acesso para participar deste projeto.',
    tok_pisin:
      'Dispela project i private. Yu mas stap member long salim translation. Askim access long joinim dispela project.',
    indonesian:
      'Proyek ini pribadi. Anda perlu menjadi anggota untuk mengirim terjemahan. Minta akses untuk bergabung dengan proyek ini.'
  },
  privateProjectVoting: {
    english: 'Private Project Voting',
    spanish: 'Votación de Proyecto Privado',
    brazilian_portuguese: 'Votação de Projeto Privado',
    tok_pisin: 'Private Project Voting',
    indonesian: 'Pemungutan Suara Proyek Pribadi'
  },
  privateProjectVotingMessage: {
    english:
      'This project is private. You need to be a member to vote on translations. Request access to join this project.',
    spanish:
      'Este proyecto es privado. Necesitas ser miembro para votar en las traducciones. Solicita acceso para unirte a este proyecto.',
    brazilian_portuguese:
      'Este projeto é privado. Você precisa ser membro para votar nas traduções. Solicite acesso para participar deste projeto.',
    tok_pisin:
      'Dispela project i private. Yu mas stap member long vote long translation. Askim access long joinim dispela project.',
    indonesian:
      'Proyek ini pribadi. Anda perlu menjadi anggota untuk memilih terjemahan. Minta akses untuk bergabung dengan proyek ini.'
  },
  projectInvitation: {
    english: 'Project Invitation',
    spanish: 'Invitación al Proyecto',
    brazilian_portuguese: 'Convite para o Projeto',
    tok_pisin: 'Project Invitation',
    indonesian: 'Undangan Proyek'
  },
  projectInvitationFrom: {
    english: '{sender} has invited you to join project "{project}" as {role}',
    spanish:
      '{sender} te ha invitado a unirte al proyecto "{project}" como {role}',
    brazilian_portuguese:
      '{sender} convidou você para participar do projeto "{project}" como {role}',
    tok_pisin:
      '{sender} i salim yu long joinim project "{project}" long {role}',
    indonesian:
      '{sender} mengundang Anda untuk bergabung dengan proyek "{project}" sebagai {role}'
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
    brazilian_portuguese: 'O projeto permanecerá baixado',
    tok_pisin: 'Project i pinis download',
    indonesian: 'Proyek akan tetap diunduh'
  },
  requestExpiredAttemptsRemaining: {
    english:
      'Your request expired after 7 days. You have {attempts} attempt{plural} remaining.',
    spanish:
      'Su solicitud expiró después de 7 días. Te quedan {attempts} intento{plural}.',
    brazilian_portuguese:
      'Sua solicitação expirou após 7 dias. Você tem {attempts} tentativa{plural} restante{plural}.',
    tok_pisin:
      'Membership request bilong yu i pinis long 7 days. Yu gat {attempts} chance long attempt{plural}.',
    indonesian:
      'Permintaan keanggotaan Anda telah kedaluwarsa setelah 7 hari. Anda memiliki {attempts} percobaan{plural} tersisa.'
  },
  requestExpiredInline: {
    english:
      'Your previous request expired after 7 days. You have {attempts} attempt{plural} remaining.',
    spanish:
      'Su solicitud anterior expiró después de 7 días. Te quedan {attempts} intento{plural}.',
    brazilian_portuguese:
      'Sua solicitação anterior expirou após 7 dias. Você tem {attempts} tentativa{plural} restante{plural}.',
    tok_pisin:
      'Membership request bilong yu i pinis long 7 days. Yu gat {attempts} chance long attempt{plural}.',
    indonesian:
      'Permintaan keanggotaan Anda sebelumnya telah kedaluwarsa setelah 7 hari. Anda memiliki {attempts} percobaan{plural} tersisa.'
  },
  requestExpiredNoAttempts: {
    english: 'Your request expired and you have no more attempts remaining.',
    spanish: 'Su solicitud expiró y no te quedan más intentos.',
    brazilian_portuguese:
      'Sua solicitação expirou e você não tem mais tentativas restantes.',
    tok_pisin:
      'Membership request bilong yu i pinis na yu no gat moa chance long attempt.',
    indonesian:
      'Permintaan keanggotaan Anda telah kedaluwarsa dan Anda tidak memiliki percobaan tersisa.'
  },
  requestExpiredNoAttemptsInline: {
    english:
      'Your previous request expired after 7 days and you have no more attempts remaining.',
    spanish:
      'Su solicitud anterior expiró después de 7 días y no te quedan más intentos.',
    brazilian_portuguese:
      'Sua solicitação anterior expirou após 7 dias e você não tem mais tentativas restantes.',
    tok_pisin:
      'Membership request bilong yu i pinis long 7 days na yu no gat moa chance long attempt.',
    indonesian:
      'Permintaan keanggotaan Anda sebelumnya telah kedaluwarsa setelah 7 hari dan Anda tidak memiliki percobaan tersisa.'
  },
  requestPendingInline: {
    english:
      "Your membership request is pending approval. You'll be notified when it's reviewed.",
    spanish:
      'Su solicitud de membresía está pendiente de aprobación. Se le notificará cuando sea revisada.',
    brazilian_portuguese:
      'Sua solicitação de associação está pendente de aprovação. Você será notificado quando for analisada.',
    tok_pisin:
      'Membership request bilong yu i pinis long approval. Yu ken salim notification long review.',
    indonesian:
      'Permintaan keanggotaan Anda sedang menunggu persetujuan. Anda akan diberitahu ketika sudah diperiksa.'
  },
  requestDeclinedInline: {
    english:
      'Your request was declined. You have {attempts} attempt{plural} remaining.',
    spanish:
      'Su solicitud fue rechazada. Te quedan {attempts} intento{plural}.',
    brazilian_portuguese:
      'Sua solicitação foi recusada. Você tem {attempts} tentativa{plural} restante{plural}.',
    tok_pisin:
      'Membership request bilong yu i no. Yu gat {attempts} chance long attempt{plural}.',
    indonesian:
      'Permintaan keanggotaan Anda ditolak. Anda memiliki {attempts} percobaan{plural} tersisa.'
  },
  requestDeclinedNoRetryInline: {
    english:
      'Your request was declined and you have no more attempts remaining.',
    spanish: 'Su solicitud fue rechazada y no te quedan más intentos.',
    brazilian_portuguese:
      'Sua solicitação foi recusada e você não tem mais tentativas restantes.',
    tok_pisin:
      'Membership request bilong yu i no na yu no gat moa chance long attempt.',
    indonesian:
      'Permintaan keanggotaan Anda ditolak dan Anda tidak memiliki percobaan tersisa.'
  },
  requestWithdrawnInline: {
    english:
      'You withdrew your previous request. You can send a new request anytime.',
    spanish:
      'Retiraste tu solicitud anterior. Puedes enviar una nueva solicitud en cualquier momento.',
    brazilian_portuguese:
      'Você retirou sua solicitação anterior. Você pode enviar uma nova solicitação a qualquer momento.',
    tok_pisin:
      'Yu rausim membership request bilong yu. Yu ken salim nupela request long wanem taim.',
    indonesian:
      'Anda telah menarik permintaan keanggotaan Anda sebelumnya. Anda dapat mengirim permintaan baru kapan saja.'
  },
  viewProject: {
    english: 'View Project',
    spanish: 'Ver Proyecto',
    brazilian_portuguese: 'Ver Projeto',
    tok_pisin: 'View Project',
    indonesian: 'Lihat Proyek'
  },
  loadingProjectDetails: {
    english: 'Loading project details...',
    spanish: 'Cargando detalles del proyecto...',
    brazilian_portuguese: 'Carregando detalhes do projeto...',
    tok_pisin: 'Loadim project details...',
    indonesian: 'Memuat detail proyek...'
  },
  onlyOwnersCanInvite: {
    english: 'Only project owners can invite new members',
    spanish:
      'Solo los propietarios del proyecto pueden invitar nuevos miembros',
    brazilian_portuguese:
      'Apenas proprietários do projeto podem convidar novos membros',
    tok_pisin: 'Only owner i project i salim member',
    indonesian: 'Hanya pemilik proyek yang dapat mengundang anggota baru'
  },
  failedToResendInvitation: {
    english: 'Failed to resend invitation',
    spanish: 'Error al reenviar invitación',
    brazilian_portuguese: 'Falha ao reenviar convite',
    tok_pisin: 'I no inap resendim invitation',
    indonesian: 'Gagal mengirim ulang undangan'
  },
  // Restore-related translations
  restoreAndroidOnly: {
    english: 'Restore is only available on Android',
    spanish: 'La restauración solo está disponible en Android',
    brazilian_portuguese: 'A restauração só está disponível no Android',
    tok_pisin: 'Restore i pinis long Android',
    indonesian: 'Pemulihan hanya tersedia di Android'
  },
  backupAndroidOnly: {
    english: 'Backup is only available on Android',
    spanish: 'El respaldo solo está disponible en Android',
    brazilian_portuguese: 'O backup só está disponível no Android',
    tok_pisin: 'Backup i pinis long Android',
    indonesian: 'Cadangan hanya tersedia di Android'
  },
  permissionDenied: {
    english: 'Permission Denied',
    spanish: 'Permiso Denegado',
    brazilian_portuguese: 'Permissão Negada',
    tok_pisin: 'Permission i no',
    indonesian: 'Izin Ditolak'
  },
  grantMicrophonePermission: {
    english: 'Grant Microphone Permission',
    spanish: 'Otorgar Permiso de Microfono',
    brazilian_portuguese: 'Conceder Permissão de Microfone',
    tok_pisin: 'Grant Microphone Permission',
    indonesian: 'Mengakses Mikrofon'
  },
  confirmAudioRestore: {
    english: 'Confirm Audio Restore',
    spanish: 'Confirmar Restauración de Audio',
    brazilian_portuguese: 'Confirmar Restauração de Áudio',
    tok_pisin: 'Confirm Audio Restore',
    indonesian: 'Konfirmasi Pemulihan Audio'
  },
  confirmAudioRestoreMessage: {
    english: 'This will restore your audio files from the backup. Continue?',
    spanish:
      'Esto restaurará sus archivos de audio desde la copia de seguridad. ¿Continuar?',
    brazilian_portuguese:
      'Isso restaurará seus arquivos de áudio do backup. Continuar?',
    tok_pisin: 'This i restore audio file bilong backup. Continue?',
    indonesian: 'Ini akan memulihkan file audio Anda dari cadangan. Lanjutkan?'
  },
  restoreAudioOnly: {
    english: 'Restore Audio',
    spanish: 'Restaurar Audio',
    brazilian_portuguese: 'Restaurar Áudio',
    tok_pisin: 'Restore Audio',
    indonesian: 'Pemulihan Audio'
  },
  failedRestore: {
    english: 'Failed to restore: {error}',
    spanish: 'Error al restaurar: {error}',
    brazilian_portuguese: 'Falha ao restaurar: {error}',
    tok_pisin: 'I no inap restore: {error}',
    indonesian: 'Gagal memulihkan: {error}'
  },
  restoreCompleteBase: {
    english:
      'Restore completed: {audioCopied} audio files copied, {audioSkippedDueToError} skipped due to errors',
    spanish:
      'Restauración completada: {audioCopied} archivos de audio copiados, {audioSkippedDueToError} omitidos por errores',
    brazilian_portuguese:
      'Restauração concluída: {audioCopied} arquivos de áudio copiados, {audioSkippedDueToError} ignorados por erros',
    tok_pisin:
      'Restore i pinis long {audioCopied} audio file i copy. {audioSkippedDueToError} i skip long error.',
    indonesian:
      'Pemulihan selesai: {audioCopied} file audio disalin, {audioSkippedDueToError} dilewatkan karena kesalahan'
  },
  restoreSkippedLocallyPart: {
    english: ', {audioSkippedLocally} skipped (already exists)',
    spanish: ', {audioSkippedLocally} omitidos (ya existen)',
    brazilian_portuguese: ', {audioSkippedLocally} ignorados (já existem)',
    tok_pisin: ', {audioSkippedLocally} i skip long local.',
    indonesian: ', {audioSkippedLocally} dilewatkan (sudah ada)'
  },
  restoreCompleteTitle: {
    english: 'Restore Complete',
    spanish: 'Restauración Completa',
    brazilian_portuguese: 'Restauração Concluída',
    tok_pisin: 'Restore Complete',
    indonesian: 'Pemulihan Selesai'
  },
  restoreFailedTitle: {
    english: 'Restore Failed: {error}',
    spanish: 'Restauración Fallida: {error}',
    brazilian_portuguese: 'Restauração Falhou: {error}',
    tok_pisin: 'Restore i no: {error}',
    indonesian: 'Pemulihan Gagal: {error}'
  },
  projectInvitationTitle: {
    english: 'Project Invitation',
    spanish: 'Invitación al Proyecto',
    brazilian_portuguese: 'Convite para o Projeto',
    tok_pisin: 'Project Invitation',
    indonesian: 'Undangan Proyek'
  },
  joinRequestTitle: {
    english: 'Join Request',
    spanish: 'Solicitud de Unión',
    brazilian_portuguese: 'Solicitação de Adesão',
    tok_pisin: 'Join Request',
    indonesian: 'Permintaan Bergabung'
  },
  invitedYouToJoin: {
    english: '{sender} invited you to join "{project}" as {role}',
    spanish: '{sender} te invitó a unirte a "{project}" como {role}',
    brazilian_portuguese:
      '{sender} convidou você para participar de "{project}" como {role}',
    tok_pisin:
      '{sender} i salim yu long joinim project "{project}" long {role}',
    indonesian:
      '{sender} mengundang Anda untuk bergabung dengan proyek "{project}" sebagai {role}'
  },
  requestedToJoin: {
    english: '{sender} requested to join "{project}" as {role}',
    spanish: '{sender} solicitó unirse a "{project}" como {role}',
    brazilian_portuguese:
      '{sender} solicitou participar de "{project}" como {role}',
    tok_pisin:
      '{sender} i requestim long joinim project "{project}" long {role}',
    indonesian:
      '{sender} meminta untuk bergabung dengan proyek "{project}" sebagai {role}'
  },
  downloadProjectLabel: {
    english: 'Download Project',
    spanish: 'Descargar Proyecto',
    brazilian_portuguese: 'Baixar Projeto',
    tok_pisin: 'Download Project',
    indonesian: 'Unduh Proyek'
  },
  projectNotAvailableOfflineWarning: {
    english: 'Project will not be available offline without download',
    spanish: 'El proyecto no estará disponible sin conexión sin descarga',
    brazilian_portuguese: 'O projeto não estará disponíel offline sem download',
    tok_pisin: 'Project i no pinis long download',
    indonesian: 'Proyek tidak akan tersedia secara offline tanpa unduhan'
  },
  noNotificationsTitle: {
    english: 'No Notifications',
    spanish: 'Sin Notificaciones',
    brazilian_portuguese: 'Sem Notificações',
    tok_pisin: 'No Notification',
    indonesian: 'Tidak Ada Notifikasi'
  },
  noNotificationsMessage: {
    english: "You'll see project invitations and join requests here",
    spanish: 'Aquí verás invitaciones a proyectos y solicitudes de unión',
    brazilian_portuguese:
      'Aqui você verá convites para projetos e solicitações de participação',
    tok_pisin:
      'Yu ken salim invitation long project na yu ken salim joinim request long project.',
    indonesian:
      'Anda akan melihat undangan ke proyek dan permintaan bergabung di sini'
  },
  invitationAcceptedSuccessfully: {
    english: 'Invitation accepted successfully',
    spanish: 'Invitación aceptada exitosamente',
    brazilian_portuguese: 'Convite aceito com sucesso',
    tok_pisin: 'Invitation i accept gut',
    indonesian: 'Undangan diterima dengan sukses'
  },
  invitationDeclinedSuccessfully: {
    english: 'Invitation declined',
    spanish: 'Invitación rechazada',
    brazilian_portuguese: 'Convite recusado',
    tok_pisin: 'Invitation i no',
    indonesian: 'Undangan ditolak'
  },
  failedToAcceptInvite: {
    english: 'Failed to accept invitation',
    spanish: 'Error al aceptar invitación',
    brazilian_portuguese: 'Falha ao aceitar convite',
    tok_pisin: 'I no inap accept invitation',
    indonesian: 'Gagal menerima undangan'
  },
  failedToDeclineInvite: {
    english: 'Failed to decline invitation',
    spanish: 'Error al rechazar invitación',
    brazilian_portuguese: 'Falha ao recusar convite',
    tok_pisin: 'I no inap decline invitation',
    indonesian: 'Gagal menolak undangan'
  },
  invitationAcceptedDownloadFailed: {
    english: 'Invitation accepted but download failed',
    spanish: 'Invitación aceptada pero la descarga falló',
    brazilian_portuguese: 'Convite aceito mas o download falhou',
    tok_pisin: 'Invitation i accept but i no inap download',
    indonesian: 'Undangan diterima tapi unduhan gagal'
  },
  unknownProject: {
    english: 'Unknown Project',
    spanish: 'Proyecto Desconocido',
    brazilian_portuguese: 'Projeto Desconhecido',
    tok_pisin: 'Unknown Project',
    indonesian: 'Proyek Tidak Dikenal'
  },
  ownerRole: {
    english: 'owner',
    spanish: 'propietario',
    brazilian_portuguese: 'proprietário',
    tok_pisin: 'owner',
    indonesian: 'pemilik'
  },
  memberRole: {
    english: 'member',
    spanish: 'miembro',
    brazilian_portuguese: 'membro',
    tok_pisin: 'member',
    indonesian: 'anggota'
  },
  offlineNotificationMessage: {
    english:
      'You are offline. Any changes you make will sync when you are back online.',
    spanish:
      'Estás sin conexión. Los cambios que hagas se sincronizarán cuando vuelvas a estar en línea.',
    brazilian_portuguese:
      'Você está offline. Quaisquer alterações que você fizer serão sincronizadas quando você voltar a ficar online.',
    tok_pisin:
      'Yu i no pinis long online. Yu ken salim any changes yu make long sync when yu back online.',
    indonesian:
      'Anda sedang offline. Perubahan apa pun yang Anda buat akan disinkronkan ketika Anda kembali online.'
  },
  filesDownloaded: {
    english: 'files downloaded',
    spanish: 'archivos descargados',
    brazilian_portuguese: 'arquivos baixados',
    tok_pisin: 'ol fail i download pinis',
    indonesian: 'file diunduh'
  },
  downloading: {
    english: 'downloading',
    spanish: 'descargando',
    brazilian_portuguese: 'baixando',
    tok_pisin: 'i download nau',
    indonesian: 'mengunduh'
  },
  files: {
    english: 'files',
    spanish: 'archivos',
    brazilian_portuguese: 'arquivos',
    tok_pisin: 'ol fail',
    indonesian: 'file'
  },
  syncingDatabase: {
    english: 'syncing database',
    spanish: 'sincronizando base de datos',
    brazilian_portuguese: 'sincronizando banco de dados',
    tok_pisin: 'i sync database nau',
    indonesian: 'mengosinkronkan basis data'
  },
  lastSync: {
    english: 'last sync',
    spanish: 'última sincronización',
    brazilian_portuguese: 'última sincronização',
    tok_pisin: 'las sync',
    indonesian: 'sinkron terakhir'
  },
  unknown: {
    english: 'unknown',
    spanish: 'desconocido',
    brazilian_portuguese: 'desconhecido',
    tok_pisin: 'mi no save',
    indonesian: 'tidak dikenal'
  },
  notSynced: {
    english: 'not synced',
    spanish: 'no sincronizado',
    brazilian_portuguese: 'não sincronizado',
    tok_pisin: 'i no sync yet',
    indonesian: 'tidak disinkronkan'
  },
  connecting: {
    english: 'connecting',
    spanish: 'conectando',
    brazilian_portuguese: 'conectando',
    tok_pisin: 'i try long connect',
    indonesian: 'menghubungkan'
  },
  disconnected: {
    english: 'disconnected',
    spanish: 'desconectado',
    brazilian_portuguese: 'desconectado',
    tok_pisin: 'i no connect',
    indonesian: 'terputus'
  },
  syncingAttachments: {
    english: 'syncing attachments',
    spanish: 'sincronizando archivos adjuntos',
    brazilian_portuguese: 'sincronizando anexos',
    tok_pisin: 'i sync ol attachment',
    indonesian: 'mengosinkronkan lampiran'
  },
  attachmentSync: {
    english: 'attachment sync',
    spanish: 'sincronización de archivos adjuntos',
    brazilian_portuguese: 'sincronização de anexos',
    tok_pisin: 'attachment sync',
    indonesian: 'sinkron lampiran'
  },
  databaseSyncError: {
    english: 'database sync error',
    spanish: 'error de sincronización de base de datos',
    brazilian_portuguese: 'erro de sincronização de banco de dados',
    tok_pisin: 'database sync i gat problem',
    indonesian: 'kesalahan sinkron basis data'
  },
  attachmentSyncError: {
    english: 'attachment sync error',
    spanish: 'error de sincronización de archivos adjuntos',
    brazilian_portuguese: 'erro de sincronização de anexos',
    tok_pisin: 'attachment sync i gat problem',
    indonesian: 'kesalahan sinkron lampiran'
  },
  uploadingData: {
    english: 'uploading data',
    spanish: 'subiendo datos',
    brazilian_portuguese: 'enviando dados',
    tok_pisin: 'i upload data',
    indonesian: 'mengunggah data'
  },
  downloadingData: {
    english: 'downloading data',
    spanish: 'descargando datos',
    brazilian_portuguese: 'baixando dados',
    tok_pisin: 'i download data',
    indonesian: 'mengunduh data'
  },
  syncError: {
    english: 'sync error',
    spanish: 'error de sincronización',
    brazilian_portuguese: 'erro de sincronização',
    tok_pisin: 'sync i gat problem',
    indonesian: 'kesalahan sinkron'
  },
  tapForDetails: {
    english: 'tap for details',
    spanish: 'toca para ver detalles',
    brazilian_portuguese: 'toque para detalhes',
    tok_pisin: 'presim long lukim moa',
    indonesian: 'ketuk untuk detail'
  },
  downloadComplete: {
    english: 'download complete',
    spanish: 'descarga completa',
    brazilian_portuguese: 'download completo',
    tok_pisin: 'download i pinis',
    indonesian: 'unduhan selesai'
  },
  queued: {
    english: 'queued',
    spanish: 'en cola',
    brazilian_portuguese: 'em fila',
    tok_pisin: 'i wet long lain',
    indonesian: 'dalam antrian'
  },
  queuedForDownload: {
    english: 'queued for download',
    spanish: 'en cola para descargar',
    brazilian_portuguese: 'em fila para baixar',
    tok_pisin: 'i wet long lain long download',
    indonesian: 'dalam antrian untuk unduhan'
  },
  complete: {
    english: 'complete',
    spanish: 'completo',
    brazilian_portuguese: 'completo',
    tok_pisin: 'pinis',
    indonesian: 'selesai'
  },
  loadMore: {
    english: 'load more',
    spanish: 'cargar más',
    brazilian_portuguese: 'carregar mais',
    tok_pisin: 'bringim moa',
    indonesian: 'muat lebih banyak'
  },
  loading: {
    english: 'loading',
    spanish: 'cargando',
    brazilian_portuguese: 'carregando',
    tok_pisin: 'loadim',
    indonesian: 'memuat'
  },
  assetMadeInvisibleAllQuests: {
    english: 'The asset has been made invisible for all quests',
    spanish: 'El asset ha sido hecho invisible para todas las quests',
    brazilian_portuguese: 'O asset foi feito invisível para todas as quests',
    tok_pisin: 'Asset i make invisible long all quest',
    indonesian: 'Asset dibuat tidak terlihat untuk semua quest'
  },
  assetMadeVisibleAllQuests: {
    english: 'The asset has been made visible for all quests',
    spanish: 'El asset ha sido hecho visible para todas las quests',
    brazilian_portuguese: 'O asset foi feito visível para todas as quests',
    tok_pisin: 'Asset i make visible long all quest',
    indonesian: 'Asset dibuat terlihat untuk semua quest'
  },
  assetMadeInactiveAllQuests: {
    english: 'The asset has been made inactive for all quests',
    spanish: 'El asset ha sido hecho inactivo para todas las quests',
    brazilian_portuguese: 'O asset foi feito inativo para todas as quests',
    tok_pisin: 'Asset i make inactive long all quest',
    indonesian: 'Asset dibuat tidak aktif untuk semua quest'
  },
  assetMadeActiveAllQuests: {
    english: 'The asset has been made active for all quests',
    spanish: 'El asset ha sido hecho activo para todas las quests',
    brazilian_portuguese: 'O asset foi feito ativo para todas as quests',
    tok_pisin: 'Asset i make active long all quest',
    indonesian: 'Asset dibuat aktif untuk semua quest'
  },
  failedToUpdateAssetSettings: {
    english: 'Failed to update asset settings',
    spanish: 'Error al actualizar los ajustes del asset',
    brazilian_portuguese: 'Falha ao atualizar os ajustes do asset',
    tok_pisin: 'I no inap update asset settings',
    indonesian: 'Gagal mengupdate pengaturan asset'
  },
  assetMadeInvisibleQuest: {
    english: 'The asset has been made invisible for this quest',
    spanish: 'El asset ha sido hecho invisible para esta quest',
    brazilian_portuguese: 'O asset foi feito invisível para esta quest',
    tok_pisin: 'Asset i make invisible long quest',
    indonesian: 'Asset dibuat tidak terlihat untuk quest ini'
  },
  assetMadeVisibleQuest: {
    english: 'The asset has been made visible for this quest',
    spanish: 'El asset ha sido hecho visible para esta quest',
    brazilian_portuguese: 'O asset foi feito visível para esta quest',
    tok_pisin: 'Asset i make visible long quest',
    indonesian: 'Asset dibuat terlihat untuk quest ini'
  },
  assetMadeInactiveQuest: {
    english: 'The asset has been made inactive for this quest',
    spanish: 'El asset ha sido hecho inactivo para esta quest',
    brazilian_portuguese: 'O asset foi feito inativo para esta quest',
    tok_pisin: 'Asset i make inactive long quest',
    indonesian: 'Asset dibuat tidak aktif untuk quest ini'
  },
  assetMadeActiveQuest: {
    english: 'The asset has been made active for this quest',
    spanish: 'El asset ha sido hecho activo para esta quest',
    brazilian_portuguese: 'O asset foi feito ativo para esta quest',
    tok_pisin: 'Asset i make active long quest',
    indonesian: 'Asset dibuat aktif untuk quest ini'
  },
  assetSettings: {
    english: 'Asset Settings',
    spanish: 'Ajustes del Asset',
    brazilian_portuguese: 'Ajustes do Asset',
    tok_pisin: 'Asset Settings',
    indonesian: 'Pengaturan Asset'
  },
  assetSettingsLoadError: {
    english: 'Error loading asset settings.',
    spanish: 'Error al cargar la configuración de asset.',
    brazilian_portuguese: 'Erro ao carregar as configurações do asset.',
    tok_pisin: 'I no inap load asset settings',
    indonesian: 'Gagal memuat pengaturan asset.'
  },
  general: {
    english: 'General',
    spanish: 'General',
    brazilian_portuguese: 'Geral',
    tok_pisin: 'General',
    indonesian: 'Umum'
  },
  currentQuest: {
    english: 'Current Quest',
    spanish: 'Quest Actual',
    brazilian_portuguese: 'Quest Atual',
    tok_pisin: 'Current Quest',
    indonesian: 'Quest Saat Ini'
  },
  visibility: {
    english: 'Visibility',
    spanish: 'Visibilidad',
    brazilian_portuguese: 'Visibilidade',
    tok_pisin: 'Visibility',
    indonesian: 'Visibilitas'
  },
  active: {
    english: 'Active',
    spanish: 'Activo',
    brazilian_portuguese: 'Ativo',
    tok_pisin: 'Active',
    indonesian: 'Aktif'
  },
  visibilityDescription: {
    english:
      'The asset is visible by default in all quests, unless hidden individually.',
    spanish:
      'El asset es visible por defecto en todas las quests, a menos que se oculte individualmente.',
    brazilian_portuguese:
      'O asset é visível por padrão em todas as quests, a menos que seja ocultado individualmente.',
    tok_pisin: 'Asset i save long olgeta quest, sapos yu no haitim wanwan.',
    indonesian:
      'Asset terlihat secara default di semua quest, kecuali disembunyikan secara individual.'
  },
  activeDescription: {
    english:
      'The asset is active and can be used in all quests, unless deactivated individually.',
    spanish:
      'El asset está activo y puede ser usado en todas las quests, a menos que se desactive individualmente.',
    brazilian_portuguese:
      'O asset está ativo e pode ser usado em todas as quests, a menos que se desative individualmente.',
    tok_pisin:
      'Asset i active na yu ken usim long olgeta quest, sapos yu no stopim wanwan.',
    indonesian:
      'Asset aktif dan dapat digunakan di semua quest, kecuali dinonaktifkan secara individual.'
  },
  visibilityDescriptionQuest: {
    english:
      'The asset is visible by default in this quest, unless hidden individually.',
    spanish:
      'El asset es visible por defecto en esta quest, a menos que se oculte individualmente.',
    brazilian_portuguese:
      'O asset é visível por padrão nesta quest, a menos que seja ocultado individualmente.',
    tok_pisin: 'Asset i save long dispela quest, sapos yu no haitim wanwan.',
    indonesian:
      'Asset terlihat secara default di quest ini, kecuali disembunyikan secara individual.'
  },
  assetHiddenAllQuests: {
    english:
      'The asset is hidden in all quests and cannot be made visible in any of them.',
    spanish:
      'El asset está oculto en todas las quests y no puede hacerse visible en ninguna de ellas.',
    brazilian_portuguese:
      'O asset está oculto em todas as quests e não pode ser tornado visível em nenhuma delas.',
    tok_pisin:
      'Asset i hait long olgeta quest na yu no ken mekim save long wanpela.',
    indonesian:
      'Asset disembunyikan di semua quest dan tidak dapat dibuat terlihat di salah satunya.'
  },
  assetDisabledAllQuests: {
    english:
      'The asset is disabled across all quests and cannot be used anywhere.',
    spanish:
      'El asset está deshabilitado en todas las quests y no puede usarse en ningún lugar.',
    brazilian_portuguese:
      'O asset está desabilitado em todas as quests e não pode ser usado em lugar algum.',
    tok_pisin:
      'Asset i stop long olgeta quest na yu no ken usim long wanpela hap.',
    indonesian:
      'Asset dinonaktifkan di semua quest dan tidak dapat digunakan di mana pun.'
  },
  questSpecificSettingsDescription: {
    english:
      'These settings affect how the asset behaves in this specific quest',
    spanish:
      'Estos ajustes afectan cómo se comporta el asset en esta quest específica',
    brazilian_portuguese:
      'Essas configurações afetam como o asset se comporta nesta quest específica',
    tok_pisin:
      'Ol dispela setting i senisim how asset i wok long dispela quest',
    indonesian:
      'Pengaturan ini mempengaruhi bagaimana asset berperilaku di quest spesifik ini'
  },
  assetDisabledWarning: {
    english:
      "⚠️ This asset is disabled across all quests. You can't change its settings for this quest.",
    spanish:
      '⚠️ Este asset está deshabilitado en todas las quests. No puedes cambiar sus ajustes para esta quest.',
    brazilian_portuguese:
      '⚠️ Este asset está desabilitado em todas as quests. Você não pode alterar suas configurações para esta quest.',
    tok_pisin:
      '⚠️ Dispela asset i stop long olgeta quest. Yu no ken senisim setting bilong em long dispela quest.',
    indonesian:
      '⚠️ Asset ini dinonaktifkan di semua quest. Anda tidak dapat mengubah pengaturannya untuk quest ini.'
  },
  assetVisibleThisQuest: {
    english: 'The asset is shown in this quest. Unless hidden globally.',
    spanish:
      'El asset se muestra en esta quest. A menos que esté oculto globalmente.',
    brazilian_portuguese:
      'O asset é mostrado nesta quest. A menos que esteja oculto globalmente.',
    tok_pisin:
      'Asset i save long dispela quest. Sapos i no hait long olgeta hap.',
    indonesian:
      'Asset ditampilkan di quest ini. Kecuali disembunyikan secara global.'
  },
  assetHiddenThisQuest: {
    english: 'The asset is hidden in this quest.',
    spanish: 'El asset está oculto en esta quest.',
    brazilian_portuguese: 'O asset está oculto nesta quest.',
    tok_pisin: 'Asset i hait long dispela quest.',
    indonesian: 'Asset disembunyikan di quest ini.'
  },
  assetActiveThisQuest: {
    english:
      'The asset can be used in this quest. Unless deactivated globally.',
    spanish:
      'El asset puede usarse en esta quest. A menos que esté desactivado globalmente.',
    brazilian_portuguese:
      'O asset pode ser usado nesta quest. A menos que esteja desativado globalmente.',
    tok_pisin:
      'Yu ken usim asset long dispela quest. Sapos i no stop long olgeta hap.',
    indonesian:
      'Asset dapat digunakan di quest ini. Kecuali dinonaktifkan secara global.'
  },
  assetInactiveThisQuest: {
    english: 'The asset is not available in this quest.',
    spanish: 'El asset no está disponible en esta quest.',
    brazilian_portuguese: 'O asset não está disponível nesta quest.',
    tok_pisin: 'Asset i no stap long dispela quest.',
    indonesian: 'Asset tidak tersedia di quest ini.'
  },
  downloadProjectConfirmation: {
    english: 'Download this project for offline use?',
    spanish: '¿Descargar este proyecto para uso sin conexión?',
    brazilian_portuguese: 'Baixar este projeto para uso offline?',
    tok_pisin: 'Daunim dispela project long usim taim i no gat internet?',
    indonesian: 'Unduh proyek ini untuk penggunaan offline?'
  },
  downloadQuestConfirmation: {
    english: 'Download this quest for offline use?',
    spanish: '¿Descargar esta quest para uso sin conexión?',
    brazilian_portuguese: 'Baixar esta quest para uso offline?',
    tok_pisin: 'Daunim dispela quest long usim taim i no gat internet?',
    indonesian: 'Unduh quest ini untuk penggunaan offline?'
  },
  thisWillDownload: {
    english: 'This will download:',
    spanish: 'Esto descargará:',
    brazilian_portuguese: 'Isso baixará:',
    tok_pisin: 'Dispela bai daunim:',
    indonesian: 'Ini akan mengunduh:'
  },
  translations: {
    english: 'Translations',
    spanish: 'Traducciones',
    brazilian_portuguese: 'Traduções',
    tok_pisin: 'Ol Translation',
    indonesian: 'Terjemahan'
  },
  doRecord: {
    english: 'Record',
    spanish: 'Grabar',
    brazilian_portuguese: 'Gravar',
    tok_pisin: 'Rekodem',
    indonesian: 'Rekam'
  },
  isRecording: {
    english: 'Recording...',
    spanish: 'Grabando...',
    brazilian_portuguese: 'Gravando...',
    tok_pisin: 'Recording...',
    indonesian: 'Merekam...'
  },
  audioSegments: {
    english: 'Audio Segments',
    spanish: 'Pistas de Audio',
    brazilian_portuguese: 'Pistas de Áudio',
    tok_pisin: 'Ol audio track',
    indonesian: 'Trek audio'
  },
  audioSegment: {
    english: 'Audio Segment',
    spanish: 'Pista de Audio',
    brazilian_portuguese: 'Pista de Áudio',
    tok_pisin: 'Ol audio track',
    indonesian: 'Trek audio'
  },
  asAssets: {
    english: 'as Assets',
    spanish: 'como Assets',
    brazilian_portuguese: 'como Assets',
    tok_pisin: 'as Assets',
    indonesian: 'sebagai Assets'
  },
  asAsset: {
    english: 'as Asset',
    spanish: 'como Asset',
    brazilian_portuguese: 'como Asset',
    tok_pisin: 'as Asset',
    indonesian: 'sebagai Asset'
  },
  save: {
    english: 'Save',
    spanish: 'Guardar',
    brazilian_portuguese: 'Salvar',
    tok_pisin: 'Save',
    indonesian: 'Simpan'
  },
  merge: {
    english: 'Merge',
    spanish: 'Fusionar',
    brazilian_portuguese: 'Mesclar',
    tok_pisin: 'Merge',
    indonesian: 'Menggabungkan'
  },
  projectDirectory: {
    english: 'Project Directory',
    spanish: 'Directorio de Proyecto',
    brazilian_portuguese: 'Diretório de Projeto',
    tok_pisin: 'Project Directory',
    indonesian: 'Direktori Proyek'
  },
  projectMadePublic: {
    english: 'The project has been made public',
    spanish: 'El proyecto se ha hecho público',
    brazilian_portuguese: 'O projeto foi tornado público',
    tok_pisin: 'Project i mekim public nau',
    indonesian: 'Proyek telah dibuat publik'
  },
  projectMadePrivate: {
    english: 'The project has been made private',
    spanish: 'El proyecto se ha hecho privado',
    brazilian_portuguese: 'O projeto foi tornado privado',
    tok_pisin: 'Project i mekim private nau',
    indonesian: 'Proyek telah dibuat pribadi'
  },
  projectMadeInvisible: {
    english: 'The project has been made invisible',
    spanish: 'El proyecto se ha hecho invisible',
    brazilian_portuguese: 'O projeto foi tornado invisível',
    tok_pisin: 'Project i mekim hait nau',
    indonesian: 'Proyek telah dibuat tidak terlihat'
  },
  projectMadeVisible: {
    english: 'The project has been made visible',
    spanish: 'El proyecto se ha hecho visible',
    brazilian_portuguese: 'O projeto foi tornado visível',
    tok_pisin: 'Project i mekim save nau',
    indonesian: 'Proyek telah dibuat terlihat'
  },
  projectMadeInactive: {
    english: 'The project has been made inactive',
    spanish: 'El proyecto se ha hecho inactivo',
    brazilian_portuguese: 'O projeto foi tornado inativo',
    tok_pisin: 'Project i mekim stop nau',
    indonesian: 'Proyek telah dibuat tidak aktif'
  },
  projectMadeActive: {
    english: 'The project has been made active',
    spanish: 'El proyecto se ha hecho activo',
    brazilian_portuguese: 'O projeto foi tornado ativo',
    tok_pisin: 'Project i mekim active nau',
    indonesian: 'Proyek telah dibuat aktif'
  },
  failedToUpdateProjectSettings: {
    english: 'Failed to update project settings',
    spanish: 'Error al actualizar la configuración del proyecto',
    brazilian_portuguese: 'Falha ao atualizar as configurações do projeto',
    tok_pisin: 'I no inap update project settings',
    indonesian: 'Gagal mengupdate pengaturan proyek'
  },
  failedToUpdateProjectVisibility: {
    english: 'Failed to update project visibility',
    spanish: 'Error al actualizar la visibilidad del proyecto',
    brazilian_portuguese: 'Falha ao atualizar a visibilidade do projeto',
    tok_pisin: 'I no inap update project visibility',
    indonesian: 'Gagal mengupdate visibilitas proyek'
  },
  failedToUpdateProjectActiveStatus: {
    english: 'Failed to update project active status',
    spanish: 'Error al actualizar el estado activo del proyecto',
    brazilian_portuguese: 'Falha ao atualizar o status ativo do projeto',
    tok_pisin: 'I no inap update project active status',
    indonesian: 'Gagal mengupdate status aktif proyek'
  },
  projectSettingsLoadError: {
    english: 'Error loading quest settings.',
    spanish: 'Error al cargar la configuración de quest.',
    brazilian_portuguese: 'Erro ao carregar as configurações da quest.',
    tok_pisin: 'I no inap load quest settings.',
    indonesian: 'Gagal memuat pengaturan quest.'
  },
  projectSettings: {
    english: 'Project Settings',
    spanish: 'Configuración del Proyecto',
    brazilian_portuguese: 'Configurações do Projeto',
    tok_pisin: 'Project Settings',
    indonesian: 'Pengaturan Proyek'
  },
  publicProjectDescription: {
    english: 'Anyone can access this project',
    spanish: 'Cualquiera puede acceder a este proyecto',
    brazilian_portuguese: 'Qualquer pessoa pode acessar este projeto',
    tok_pisin: 'Olgeta man i ken kam long dispela project',
    indonesian: 'Siapa saja dapat mengakses proyek ini'
  },
  visibleProjectDescription: {
    english: 'This project appears in public listings',
    spanish: 'Este proyecto aparece en listados públicos',
    brazilian_portuguese: 'Este projeto aparece em listagens públicas',
    tok_pisin: 'Dispela project i save long public list',
    indonesian: 'Proyek ini muncul di daftar publik'
  },
  invisibleProjectDescription: {
    english: 'This project is hidden from public listings',
    spanish: 'Este proyecto está oculto de los listados públicos',
    brazilian_portuguese: 'Este projeto está oculto das listagens públicas',
    tok_pisin: 'Dispela project i hait long public list',
    indonesian: 'Proyek ini disembunyikan dari daftar publik'
  },
  activeProjectDescription: {
    english: 'This project is available for use',
    spanish: 'Este proyecto está disponible para usar',
    brazilian_portuguese: 'Este projeto está disponível para uso',
    tok_pisin: 'Dispela project i redi long usim',
    indonesian: 'Proyek ini tersedia untuk digunakan'
  },
  inactiveProjectDescription: {
    english: 'This project is temporarily disabled',
    spanish: 'Este proyecto está temporalmente deshabilitado',
    brazilian_portuguese: 'Este projeto está temporariamente desabilitado',
    tok_pisin: 'Dispela project i stop liklik taim',
    indonesian: 'Proyek ini sementara dinonaktifkan'
  },
  loadingOptions: {
    english: 'Loading options...',
    spanish: 'Cargando opciones...',
    brazilian_portuguese: 'Carregando opções...',
    tok_pisin: 'I loadim ol option...',
    indonesian: 'Memuat opsi...'
  },
  loadingTagCategories: {
    english: 'Loading tag categories...',
    spanish: 'Cargando categorías de etiquetas...',
    brazilian_portuguese: 'Carregando categorias de etiquetas...',
    tok_pisin: 'I loadim ol tag category...',
    indonesian: 'Memuat kategori tag...'
  },
  questSettings: {
    english: 'Quest Settings',
    spanish: 'Configuración de la Misión',
    brazilian_portuguese: 'Configurações da Missão',
    tok_pisin: 'Quest Settings',
    indonesian: 'Pengaturan Quest'
  },
  questSettingsLoadError: {
    english: 'Error loading quest settings.',
    spanish: 'Error al cargar la configuración de quest.',
    brazilian_portuguese: 'Erro ao carregar as configurações da quest.',
    tok_pisin: 'I no inap load quest settings.',
    indonesian: 'Gagal memuat pengaturan quest.'
  },
  visibleQuestDescription: {
    english: 'This quest is visible to users',
    spanish: 'Esta misión es visible para los usuarios',
    brazilian_portuguese: 'Esta missão é visível para os usuários',
    tok_pisin: 'Dispela quest i save long ol user',
    indonesian: 'Quest ini terlihat oleh pengguna'
  },
  invisibleQuestDescription: {
    english: 'This quest is hidden from users',
    spanish: 'Esta misión está oculta para los usuarios',
    brazilian_portuguese: 'Esta missão está oculta dos usuários',
    tok_pisin: 'Dispela quest i hait long ol user',
    indonesian: 'Quest ini disembunyikan dari pengguna'
  },
  activeQuestDescription: {
    english: 'This quest is available for completion',
    spanish: 'Esta misión está disponible para completar',
    brazilian_portuguese: 'Esta missão está disponível para conclusão',
    tok_pisin: 'Dispela quest i redi long pinisim',
    indonesian: 'Quest ini tersedia untuk diselesaikan'
  },
  inactiveQuestDescription: {
    english: 'This quest is temporarily disabled',
    spanish: 'Esta misión está temporalmente deshabilitada',
    brazilian_portuguese: 'Esta missão está temporariamente desabilitada',
    tok_pisin: 'Dispela quest i stop liklik taim',
    indonesian: 'Quest ini sementara dinonaktifkan'
  },
  questMadeInvisible: {
    english: 'The quest has been made invisible',
    spanish: 'La misión se ha hecho invisible',
    brazilian_portuguese: 'A missão foi tornada invisível',
    tok_pisin: 'Quest i mekim hait nau',
    indonesian: 'Quest telah dibuat tidak terlihat'
  },
  questMadeVisible: {
    english: 'The quest has been made visible',
    spanish: 'La misión se ha hecho visible',
    brazilian_portuguese: 'A missão foi tornada visível',
    tok_pisin: 'Quest i mekim save nau',
    indonesian: 'Quest telah dibuat terlihat'
  },
  questMadeInactive: {
    english: 'The quest has been made inactive',
    spanish: 'La misión se ha hecho inactiva',
    brazilian_portuguese: 'A missão foi tornada inativa',
    tok_pisin: 'Quest i mekim stop nau',
    indonesian: 'Quest telah dibuat tidak aktif'
  },
  questMadeActive: {
    english: 'The quest has been made active',
    spanish: 'La misión se ha hecho activa',
    brazilian_portuguese: 'A missão foi tornada ativa',
    tok_pisin: 'Quest i mekim active nau',
    indonesian: 'Quest telah dibuat aktif'
  },
  failedToUpdateQuestSettings: {
    english: 'Failed to update quest settings',
    spanish: 'Error al actualizar la configuración de la misión',
    brazilian_portuguese: 'Falha ao atualizar as configurações da missão',
    tok_pisin: 'I no inap update quest settings',
    indonesian: 'Gagal mengupdate pengaturan quest'
  },
  loadingAudio: {
    english: 'Loading audio...',
    spanish: 'Cargando audio...',
    brazilian_portuguese: 'Carregando áudio...',
    tok_pisin: 'I loadim audio...',
    indonesian: 'Memuat audio...'
  },
  updateAvailable: {
    english: 'A new update is available!',
    spanish: '¡Una nueva actualización está disponible!',
    brazilian_portuguese: 'Uma nova atualização está disponível!',
    tok_pisin: 'Nupela update i stap!',
    indonesian: 'Pembaruan baru tersedia!'
  },
  updateNow: {
    english: 'Update Now',
    spanish: 'Actualizar Ahora',
    brazilian_portuguese: 'Atualizar Agora',
    tok_pisin: 'Update Nau',
    indonesian: 'Perbarui Sekarang'
  },
  updateFailed: {
    english: 'Update failed',
    spanish: 'Actualización fallida',
    brazilian_portuguese: 'Atualização falhou',
    tok_pisin: 'Update i pundaun',
    indonesian: 'Pembaruan gagal'
  },
  updateErrorTryAgain: {
    english: 'Please try again or dismiss',
    spanish: 'Por favor intente nuevamente o descarte',
    brazilian_portuguese: 'Por favor tente novamente ou descarte',
    tok_pisin: 'Traim gen o rausim',
    indonesian: 'Silakan coba lagi atau abaikan'
  },
  retry: {
    english: 'Retry',
    spanish: 'Reintentar',
    brazilian_portuguese: 'Tentar novamente',
    tok_pisin: 'Traim gen',
    indonesian: 'Coba lagi'
  },
  enterCommentOptional: {
    english: 'Enter your comment (optional)',
    spanish: 'Escribe tu comentario (opcional)',
    brazilian_portuguese: 'Escreva seu comentário (opcional)',
    tok_pisin: 'Raitim comment bilong yu (yu ken o nogat)',
    indonesian: 'Masukkan komentar Anda (opsional)'
  },
  auth_init_error_title: {
    english: 'Initialization Error',
    spanish: 'Error de Inicialización',
    brazilian_portuguese: 'Erro de Inicialização',
    tok_pisin: 'Initialization Error',
    indonesian: 'Kesalahan Inisialisasi'
  },
  auth_init_error_message: {
    english:
      'Failed to initialize the app. Please try logging out and back in.',
    spanish:
      'Error al inicializar la aplicación. Por favor, intenta cerrar sesión y volver a iniciar sesión.',
    brazilian_portuguese:
      'Erro ao inicializar o aplicativo. Por favor, tente sair e entrar novamente.',
    tok_pisin: 'I no inap start app. Plis traim logout na login gen.',
    indonesian:
      'Gagal menginisialisasi aplikasi. Silakan coba logout dan login kembali.'
  },
  auth_init_error_ok: {
    english: 'OK',
    spanish: 'OK',
    brazilian_portuguese: 'OK',
    tok_pisin: 'Orait',
    indonesian: 'OK'
  },
  projectDownloaded: {
    english: 'Project downloaded',
    spanish: 'Proyecto descargado',
    brazilian_portuguese: 'Projeto baixado',
    tok_pisin: 'Project i daun pinis',
    indonesian: 'Proyek diunduh'
  },
  passwordMustBeAtLeast6Characters: {
    english: 'Password must be at least 6 characters',
    spanish: 'La contraseña debe tener al menos 6 caracteres',
    brazilian_portuguese: 'A senha deve ter pelo menos 6 caracteres',
    tok_pisin: 'Password i mas gat 6 character o moa',
    indonesian: 'Kata sandi harus minimal 6 karakter'
  },
  passwordUpdateFailed: {
    english: 'Failed to update password',
    spanish: 'Error al actualizar la contraseña',
    brazilian_portuguese: 'Falha ao atualizar a senha',
    tok_pisin: 'I no inap update password',
    indonesian: 'Gagal mengupdate kata sandi'
  },
  clearCache: {
    english: 'Clear Cache',
    spanish: 'Limpiar caché',
    brazilian_portuguese: 'Limpar cache',
    tok_pisin: 'Klinim Cache',
    indonesian: 'Hapus Cache'
  },
  clearCacheConfirmation: {
    english: 'Are you sure you want to clear all cached data?',
    spanish: '¿Estás seguro de querer limpiar todos los datos en caché?',
    brazilian_portuguese:
      'Tem certeza que deseja limpar todos os dados em cache?',
    tok_pisin: 'Yu sure long klinim olgeta cache data?',
    indonesian: 'Apakah Anda yakin ingin menghapus semua data cache?'
  },
  cacheClearedSuccess: {
    english: 'Cache cleared successfully',
    spanish: 'Caché limpiada correctamente',
    brazilian_portuguese: 'Cache limpa com sucesso',
    tok_pisin: 'Cache i klin gut pinis',
    indonesian: 'Cache berhasil dihapus'
  },
  exportRequiresInternet: {
    english: 'This feature requires an internet connection',
    spanish: 'Esta característica requiere una conexión a internet',
    brazilian_portuguese:
      'Esta funcionalidade requer uma conexão com a internet',
    tok_pisin: 'Dispela feature i nidim internet connection',
    indonesian: 'Fitur ini memerlukan koneksi internet'
  },
  exportDataComingSoon: {
    english: 'Data export feature coming soon',
    spanish: 'La exportación de datos está próxima',
    brazilian_portuguese: 'A exportação de dados está próxima',
    tok_pisin: 'Data export feature i kam bihain',
    indonesian: 'Fitur ekspor data segera hadir'
  },
  info: {
    english: 'Info',
    spanish: 'Información',
    brazilian_portuguese: 'Informação',
    tok_pisin: 'Info',
    indonesian: 'Info'
  },
  enableNotifications: {
    english: 'Enable Notifications',
    spanish: 'Habilitar notificaciones',
    brazilian_portuguese: 'Habilitar notificações',
    tok_pisin: 'Onim Notification',
    indonesian: 'Aktifkan Notifikasi'
  },
  notificationsDescription: {
    english: 'Receive notifications for app updates and important information',
    spanish:
      'Recibir notificaciones para actualizaciones de la aplicación y información importante',
    brazilian_portuguese:
      'Receber notificações para atualizações do aplicativo e informações importantes',
    tok_pisin: 'Kisim notification long app update na important information',
    indonesian:
      'Terima notifikasi untuk pembaruan aplikasi dan informasi penting'
  },
  contentPreferences: {
    english: 'Content Preferences',
    spanish: 'Preferencias de contenido',
    brazilian_portuguese: 'Preferências de conteúdo',
    tok_pisin: 'Content Preferences',
    indonesian: 'Preferensi Konten'
  },
  showHiddenContent: {
    english: 'Show Hidden Content',
    spanish: 'Mostrar contenido oculto',
    brazilian_portuguese: 'Mostrar conteúdo oculto',
    tok_pisin: 'Soim Hait Content',
    indonesian: 'Tampilkan Konten Tersembunyi'
  },
  showHiddenContentDescription: {
    english: 'Allow displaying content that has been marked as invisible',
    spanish: 'Permitir mostrar contenido que ha sido marcado como invisible',
    brazilian_portuguese:
      'Permitir mostrar conteúdo que foi marcado como invisível',
    tok_pisin: 'Larim soim content we ol i makim hait',
    indonesian:
      'Izinkan menampilkan konten yang ditandai sebagai tidak terlihat'
  },
  dataAndStorage: {
    english: 'Data & Storage',
    spanish: 'Datos y almacenamiento',
    brazilian_portuguese: 'Dados e armazenamento',
    tok_pisin: 'Data na Storage',
    indonesian: 'Data & Penyimpanan'
  },
  downloadOnWifiOnly: {
    english: 'Download on WiFi Only',
    spanish: 'Descargar solo en WiFi',
    brazilian_portuguese: 'Baixar apenas em WiFi',
    tok_pisin: 'Daunim long WiFi tasol',
    indonesian: 'Unduh hanya di WiFi'
  },
  downloadOnWifiOnlyDescription: {
    english: 'Only download content when connected to WiFi',
    spanish: 'Descargar contenido solo cuando esté conectado a WiFi',
    brazilian_portuguese:
      'Baixar conteúdo apenas quando estiver conectado à WiFi',
    tok_pisin: 'Daunim content taim yu joinim WiFi tasol',
    indonesian: 'Hanya unduh konten saat terhubung ke WiFi'
  },
  autoBackup: {
    english: 'Auto Backup',
    spanish: 'Copia de seguridad automática',
    brazilian_portuguese: 'Backup automático',
    tok_pisin: 'Auto Backup',
    indonesian: 'Backup Otomatis'
  },
  autoBackupDescription: {
    english: 'Automatically backup your data to the cloud',
    spanish: 'Hacer una copia de seguridad automática de tus datos en la nube',
    brazilian_portuguese: 'Fazer um backup automático dos seus dados na nuvem',
    tok_pisin: 'Otomatik backup data bilong yu long cloud',
    indonesian: 'Secara otomatis backup data Anda ke cloud'
  },
  clearCacheDescription: {
    english: 'Clear all cached data to free up storage space',
    spanish:
      'Limpiar todos los datos en caché para liberar espacio de almacenamiento',
    brazilian_portuguese:
      'Limpar todos os dados em cache para liberar espaço de armazenamento',
    tok_pisin: 'Klinim olgeta cache data long mekim moa storage space',
    indonesian: 'Hapus semua data cache untuk mengosongkan ruang penyimpanan'
  },
  exportData: {
    english: 'Export Data',
    spanish: 'Exportar datos',
    brazilian_portuguese: 'Exportar dados',
    tok_pisin: 'Export Data',
    indonesian: 'Ekspor Data'
  },
  exportDataDescription: {
    english: 'Export your data for backup or transfer',
    spanish: 'Exportar tus datos para respaldo o transferencia',
    brazilian_portuguese: 'Exportar seus dados para backup ou transferência',
    tok_pisin: 'Export data bilong yu long backup o transfer',
    indonesian: 'Ekspor data Anda untuk backup atau transfer'
  },
  support: {
    english: 'Support',
    spanish: 'Soporte',
    brazilian_portuguese: 'Suporte',
    tok_pisin: 'Support',
    indonesian: 'Dukungan'
  },
  helpCenter: {
    english: 'Help Center',
    spanish: 'Centro de ayuda',
    brazilian_portuguese: 'Centro de ajuda',
    tok_pisin: 'Help Center',
    indonesian: 'Pusat Bantuan'
  },
  helpCenterComingSoon: {
    english: 'Help center feature coming soon',
    spanish: 'El centro de ayuda está próximo',
    brazilian_portuguese: 'O centro de ajuda está próximo',
    tok_pisin: 'Help center feature i kam bihain',
    indonesian: 'Fitur pusat bantuan segera hadir'
  },
  contactSupport: {
    english: 'Contact Support',
    spanish: 'Contactar soporte',
    brazilian_portuguese: 'Contatar suporte',
    tok_pisin: 'Contact Support',
    indonesian: 'Hubungi Dukungan'
  },
  contactSupportComingSoon: {
    english: 'Contact support feature coming soon',
    spanish: 'La función de contacto con el soporte está próxima',
    brazilian_portuguese:
      'A funcionalidade de contato com o suporte está próxima',
    tok_pisin: 'Contact support feature i kam bihain',
    indonesian: 'Fitur hubungi dukungan segera hadir'
  },
  termsAndConditions: {
    english: 'Terms & Conditions',
    spanish: 'Términos y condiciones',
    brazilian_portuguese: 'Termos e condições',
    tok_pisin: 'Terms na Conditions',
    indonesian: 'Syarat & Ketentuan'
  },
  termsAndConditionsComingSoon: {
    english: 'Terms & Conditions feature coming soon',
    spanish: 'La función de términos y condiciones está próxima',
    brazilian_portuguese: 'A funcionalidade de termos e condições está próxima',
    tok_pisin: 'Terms na Conditions feature i kam bihain',
    indonesian: 'Fitur Syarat & Ketentuan segera hadir'
  },
  advanced: {
    english: 'Advanced',
    spanish: 'Avanzado',
    brazilian_portuguese: 'Avançado',
    tok_pisin: 'Advanced',
    indonesian: 'Lanjutan'
  },
  debugMode: {
    english: 'Debug Mode',
    spanish: 'Modo de depuración',
    brazilian_portuguese: 'Modo de depuração',
    tok_pisin: 'Debug Mode',
    indonesian: 'Mode Debug'
  },
  debugModeDescription: {
    english: 'Enable debug mode for development features',
    spanish: 'Habilitar modo de depuración para características de desarrollo',
    brazilian_portuguese:
      'Habilitar modo de depuração para funcionalidades de desenvolvimento',
    tok_pisin: 'Onim debug mode long development features',
    indonesian: 'Aktifkan mode debug untuk fitur pengembangan'
  },
  settingsRequireInternet: {
    english: 'Some settings require an internet connection',
    spanish: 'Algunas configuraciones requieren una conexión a internet',
    brazilian_portuguese:
      'Algumas configurações requerem uma conexão com a internet',
    tok_pisin: 'Sampela settings i nidim internet connection',
    indonesian: 'Beberapa pengaturan memerlukan koneksi internet'
  },
  clear: {
    english: 'Clear',
    spanish: 'Limpiar',
    brazilian_portuguese: 'Limpar',
    tok_pisin: 'Klinim',
    indonesian: 'Hapus'
  },
  unnamedAsset: {
    english: 'Unnamed Asset',
    spanish: 'Actividad sin nombre',
    brazilian_portuguese: 'Atividade sem nome',
    tok_pisin: 'Asset i no gat nem',
    indonesian: 'Asset Tanpa Nama'
  },
  noAssetSelected: {
    english: 'No Asset Selected',
    spanish: 'No hay actividades seleccionadas',
    brazilian_portuguese: 'Nenhuma atividade selecionada',
    tok_pisin: 'Yu no makim wanpela asset',
    indonesian: 'Tidak Ada Asset yang Dipilih'
  },
  assetNotAvailableOffline: {
    english: 'Asset not available offline',
    spanish: 'La actividad no está disponible sin conexión',
    brazilian_portuguese: 'A atividade não está disponível offline',
    tok_pisin: 'Asset i no stap taim i no gat internet',
    indonesian: 'Asset tidak tersedia offline'
  },
  cloudError: {
    english: 'Cloud error: {error}',
    spanish: 'Error en la nube: {error}',
    brazilian_portuguese: 'Erro na nuvem: {error}',
    tok_pisin: 'Cloud error: {error}',
    indonesian: 'Kesalahan cloud: {error}'
  },
  assetNotFoundOnline: {
    english: 'Asset not found online',
    spanish: 'La actividad no se encontró en línea',
    brazilian_portuguese: 'A atividade não foi encontrada online',
    tok_pisin: 'Asset i no stap long internet',
    indonesian: 'Asset tidak ditemukan online'
  },
  trySwitchingToCloudDataSource: {
    english: 'Try switching to Cloud data source above',
    spanish: 'Intenta cambiar a la fuente de datos en la nube',
    brazilian_portuguese: 'Tente mudar para a fonte de dados na nuvem',
    tok_pisin: 'Traim senisim long Cloud data source antap',
    indonesian: 'Coba beralih ke sumber data Cloud di atas'
  },
  trySwitchingToOfflineDataSource: {
    english: 'Try switching to Offline data source above',
    spanish: 'Intenta cambiar a la fuente de datos sin conexión',
    brazilian_portuguese: 'Tente mudar para a fonte de dados offline',
    tok_pisin: 'Traim senisim long Offline data source antap',
    indonesian: 'Coba beralih ke sumber data Offline di atas'
  },
  assetMayNotBeSynchronized: {
    english: 'This asset may not be synchronized or may not exist',
    spanish: 'Esta actividad puede no estar sincronizada o puede no existir',
    brazilian_portuguese:
      'Esta atividade pode não estar sincronizada ou pode não existir',
    tok_pisin: 'Dispela asset i no sync o i no stap',
    indonesian: 'Asset ini mungkin tidak tersinkronisasi atau tidak ada'
  },
  noContentAvailable: {
    english: 'No content available',
    spanish: 'No hay contenido disponible',
    brazilian_portuguese: 'Nenhum conteúdo disponível',
    tok_pisin: 'I no gat content',
    indonesian: 'Tidak ada konten tersedia'
  },
  audioReady: {
    english: 'Audio ready',
    spanish: 'Audio listo',
    brazilian_portuguese: 'Áudio pronto',
    tok_pisin: 'Audio i redi',
    indonesian: 'Audio siap'
  },
  audioNotAvailable: {
    english: 'Audio not available',
    spanish: 'Audio no disponible',
    brazilian_portuguese: 'Áudio não disponível',
    tok_pisin: 'Audio i no stap',
    indonesian: 'Audio tidak tersedia'
  },
  imagesAvailable: {
    english: 'Images available',
    spanish: 'Imágenes disponibles',
    brazilian_portuguese: 'Imagens disponíveis',
    tok_pisin: 'Ol piksa i stap',
    indonesian: 'Gambar tersedia'
  },
  language: {
    english: 'Language',
    spanish: 'Idioma',
    brazilian_portuguese: 'Idioma',
    tok_pisin: 'Tokples',
    indonesian: 'Bahasa'
  },
  template: {
    english: 'Template',
    spanish: 'Plantilla',
    brazilian_portuguese: 'Plantilla',
    tok_pisin: 'Template',
    indonesian: 'Template'
  },
  // template options
  bible: {
    english: 'Bible',
    spanish: 'Biblia',
    brazilian_portuguese: 'Bíblia',
    tok_pisin: 'Bible',
    indonesian: 'Alkitab'
  },
  unstructured: {
    english: 'Unstructured',
    spanish: 'No estructurado',
    brazilian_portuguese: 'Não estruturado',
    tok_pisin: 'Unstructured',
    indonesian: 'Tidak terstruktur'
  },
  audioTracks: {
    english: 'Audio tracks',
    spanish: 'Pistas de audio',
    brazilian_portuguese: 'Pistas de áudio',
    tok_pisin: 'Ol audio track',
    indonesian: 'Trek audio'
  },
  membersOnly: {
    english: 'Members Only',
    spanish: 'Solo para miembros',
    brazilian_portuguese: 'Só para membros',
    tok_pisin: 'Member tasol',
    indonesian: 'Khusus Anggota'
  },
  cloud: {
    english: 'Cloud',
    spanish: 'Nube',
    brazilian_portuguese: 'Nuvem',
    tok_pisin: 'Cloud',
    indonesian: 'Cloud'
  },
  syncing: {
    english: 'Syncing',
    spanish: 'Sincronizando',
    brazilian_portuguese: 'Sincronizando',
    tok_pisin: 'I sync',
    indonesian: 'Sinkronisasi'
  },
  synced: {
    english: 'Synced',
    spanish: 'Sincronizado',
    brazilian_portuguese: 'Sincronizado',
    tok_pisin: 'Sync pinis',
    indonesian: 'Tersinkronisasi'
  },
  failed: {
    english: 'Failed',
    spanish: 'Fallado',
    brazilian_portuguese: 'Falhado',
    tok_pisin: 'I pail',
    indonesian: 'Gagal'
  },
  state: {
    english: 'State',
    spanish: 'Estado',
    brazilian_portuguese: 'Estado',
    tok_pisin: 'State',
    indonesian: 'Status'
  },
  noQuestSelected: {
    english: 'No Quest Selected',
    spanish: 'No hay proyecto seleccionado',
    brazilian_portuguese: 'Nenhum projeto selecionado',
    tok_pisin: 'Yu no makim wanpela quest',
    indonesian: 'Tidak Ada Quest yang Dipilih'
  },
  liveAttachmentStates: {
    english: 'Live Attachment States',
    spanish: 'Estados de adjuntos en vivo',
    brazilian_portuguese: 'Estados de anexos em tempo real',
    tok_pisin: 'Live Attachment States',
    indonesian: 'Status Lampiran Langsung'
  },
  searching: {
    english: 'Searching',
    spanish: 'Buscando',
    brazilian_portuguese: 'Buscando',
    tok_pisin: 'I painim',
    indonesian: 'Mencari'
  },
  translationSubmittedSuccessfully: {
    english: 'Translation submitted successfully',
    spanish: 'Traducción enviada correctamente',
    brazilian_portuguese: 'Tradução enviada com sucesso',
    tok_pisin: 'Translation i go gut pinis',
    indonesian: 'Terjemahan berhasil dikirim'
  },
  text: {
    english: 'Text',
    spanish: 'Texto',
    brazilian_portuguese: 'Texto',
    tok_pisin: 'Text',
    indonesian: 'Teks'
  },
  audio: {
    english: 'Audio',
    spanish: 'Audio',
    brazilian_portuguese: 'Áudio',
    tok_pisin: 'Audio',
    indonesian: 'Audio'
  },
  targetLanguage: {
    english: 'Target Language',
    spanish: 'Idioma de destino',
    brazilian_portuguese: 'Idioma de destino',
    tok_pisin: 'Target Tokples',
    indonesian: 'Bahasa Target'
  },
  your: {
    english: 'Your',
    spanish: 'Tu',
    brazilian_portuguese: 'Seu',
    tok_pisin: 'Bilong yu',
    indonesian: 'Anda'
  },
  translation: {
    english: 'Translation',
    spanish: 'Traducción',
    brazilian_portuguese: 'Tradução',
    tok_pisin: 'Translation',
    indonesian: 'Terjemahan'
  },
  readyToSubmit: {
    english: 'Ready to submit',
    spanish: 'Listo para enviar',
    brazilian_portuguese: 'Pronto para enviar',
    tok_pisin: 'Redi long salim',
    indonesian: 'Siap untuk dikirim'
  },
  online: {
    english: 'Online',
    spanish: 'En línea',
    brazilian_portuguese: 'Online',
    tok_pisin: 'Online',
    indonesian: 'Online'
  },
  allProjects: {
    english: 'All Projects',
    spanish: 'Todos los proyectos',
    brazilian_portuguese: 'Todos os projetos',
    tok_pisin: 'Olgeta Project',
    indonesian: 'Semua Proyek'
  },
  searchProjects: {
    english: 'Search projects...',
    spanish: 'Buscar proyectos...',
    brazilian_portuguese: 'Buscar projetos...',
    tok_pisin: 'Painim ol project...',
    indonesian: 'Cari proyek...'
  },
  noProjectSelected: {
    english: 'No Project Selected',
    spanish: 'No hay proyecto seleccionado',
    brazilian_portuguese: 'Nenhum projeto selecionado',
    tok_pisin: 'Yu no makim wanpela project',
    indonesian: 'Tidak Ada Proyek yang Dipilih'
  },
  noQuestsFound: {
    english: 'No quests found',
    spanish: 'No se encontraron misiones',
    brazilian_portuguese: 'Nenhuma missão encontrada',
    tok_pisin: 'I no gat quest',
    indonesian: 'Tidak ada quest ditemukan'
  },
  noQuestsAvailable: {
    english: 'No quests available',
    spanish: 'No hay misiones disponibles',
    brazilian_portuguese: 'Nenhuma missão disponível',
    tok_pisin: 'I no gat quest long usim',
    indonesian: 'Tidak ada quest tersedia'
  },
  pleaseLogInToVote: {
    english: 'Please log in to vote',
    spanish: 'Por favor, inicia sesión para votar',
    brazilian_portuguese: 'Por favor, faça login para votar',
    tok_pisin: 'Plis login pastaim long vote',
    indonesian: 'Silakan login untuk memilih'
  },
  yourTranscriptionHasBeenSubmitted: {
    english: 'Your transcription has been submitted',
    spanish: 'Tu transcripción ha sido enviada',
    brazilian_portuguese: 'Sua transcrição foi enviada',
    tok_pisin: 'Transcription bilong yu i go pinis',
    indonesian: 'Transkripsi Anda telah dikirim'
  },
  failedToCreateTranscription: {
    english: 'Failed to create transcription',
    spanish: 'Error al crear la transcripción',
    brazilian_portuguese: 'Falha ao criar a transcrição',
    tok_pisin: 'I no inap mekim transcription',
    indonesian: 'Gagal membuat transkripsi'
  },
  enterYourTranscription: {
    english: 'Enter your transcription',
    spanish: 'Escribe tu transcripción',
    brazilian_portuguese: 'Digite sua transcrição',
    tok_pisin: 'Raitim transcription bilong yu',
    indonesian: 'Masukkan transkripsi Anda'
  },
  submitTranscription: {
    english: 'Submit Transcription',
    spanish: 'Enviar transcripción',
    brazilian_portuguese: 'Enviar transcrição',
    tok_pisin: 'Salim Transcription',
    indonesian: 'Kirim Transkripsi'
  },
  good: {
    english: 'Good',
    spanish: 'Bueno',
    brazilian_portuguese: 'Bom',
    tok_pisin: 'Gut',
    indonesian: 'Bagus'
  },
  needsWork: {
    english: 'Needs Work',
    spanish: 'Necesita trabajo',
    brazilian_portuguese: 'Precisa de trabalho',
    tok_pisin: 'I nidim wok moa',
    indonesian: 'Perlu Perbaikan'
  },
  pleaseLogInToVoteOnTranslations: {
    english: 'Please log in to vote on translations',
    spanish: 'Por favor, inicia sesión para votar en traducciones',
    brazilian_portuguese: 'Por favor, faça login para votar em traduções',
    tok_pisin: 'Plis login pastaim long vote long ol translation',
    indonesian: 'Silakan login untuk memilih terjemahan'
  },
  translationNotFound: {
    english: 'Translation not found',
    spanish: 'Traducción no encontrada',
    brazilian_portuguese: 'Tradução não encontrada',
    tok_pisin: 'Translation i no stap',
    indonesian: 'Terjemahan tidak ditemukan'
  },
  noTranslationsYet: {
    english: 'No translations yet. Be the first to translate!',
    spanish: 'No hay traducciones aún. Sé el primero en traducir!',
    brazilian_portuguese: 'Nenhuma tradução ainda. Seja o primeiro a traduzir!',
    tok_pisin: 'I no gat translation yet. Yu ken namba wan long translate!',
    indonesian: 'Belum ada terjemahan. Jadilah yang pertama menerjemahkan!'
  },
  viewProjectLimitedAccess: {
    english: 'View Project (Limited Access)',
    spanish: 'Ver proyecto (Acceso limitado)',
    brazilian_portuguese: 'Ver projeto (Acesso limitado)',
    tok_pisin: 'Lukim Project (Limited Access)',
    indonesian: 'Lihat Proyek (Akses Terbatas)'
  },
  languages: {
    english: 'Languages',
    spanish: 'Idiomas',
    brazilian_portuguese: 'Idiomas',
    tok_pisin: 'Ol Tokples',
    indonesian: 'Bahasa'
  },
  downloadRequired: {
    english: 'Download required',
    spanish: 'Descarga requerida',
    brazilian_portuguese: 'Download requerido',
    tok_pisin: 'Yu mas daunim',
    indonesian: 'Unduhan diperlukan'
  },
  myProjects: {
    english: 'My Projects',
    spanish: 'Mis proyectos',
    brazilian_portuguese: 'Meus projetos',
    tok_pisin: 'Ol Project Bilong Mi',
    indonesian: 'Proyek Saya'
  },
  statusTranslationActive: {
    english:
      'This translation is currently active. An active translation is also visible.',
    spanish:
      'Esta traducción está actualmente activa. Una traducción activa también es visible.',
    brazilian_portuguese:
      'Esta tradução está atualmente ativa. Uma tradução ativa também é visível.',
    tok_pisin:
      'Dispela translation i active nau. Active translation i save tu.',
    indonesian: 'Terjemahan ini saat ini aktif. Terjemahan aktif juga terlihat.'
  },
  statusTranslationInactive: {
    english:
      'This translation is inactive. No actions can be performed unless it is reactivated.',
    spanish:
      'Esta traducción está inactiva. No se pueden realizar acciones a menos que se reactive.',
    brazilian_portuguese:
      'Esta tradução está inativa. Nenhuma ação pode ser realizada a menos que seja reativada.',
    tok_pisin:
      'Dispela translation i no active. Yu no ken mekim wanpela samting sapos yu no mekim active gen.',
    indonesian:
      'Terjemahan ini tidak aktif. Tidak ada tindakan yang dapat dilakukan kecuali diaktifkan kembali.'
  },
  statusTranslationVisible: {
    english: 'This translation is visible to other users.',
    spanish: 'Esta traducción es visible para otros usuarios.',
    brazilian_portuguese: 'Esta tradução está visível para outros usuários.',
    tok_pisin: 'Dispela translation i save long ol narapela user.',
    indonesian: 'Terjemahan ini terlihat oleh pengguna lain.'
  },
  statusTranslationInvisible: {
    english:
      'This translation is hidden and will not be shown to other users. An invisible translation is also inactive.',
    spanish:
      'Esta traducción está oculta y no se mostrará a otros usuarios. Una traducción invisible también está inactiva.',
    brazilian_portuguese:
      'Esta tradução está oculta e não será mostrada para outros usuários. Uma tradução invisível também está inativa.',
    tok_pisin:
      'Dispela translation i hait na bai i no soim long ol narapela user. Hait translation i no active tu.',
    indonesian:
      'Terjemahan ini disembunyikan dan tidak akan ditampilkan kepada pengguna lain. Terjemahan yang tidak terlihat juga tidak aktif.'
  },
  statusTranslationMadeVisible: {
    english: 'The translation has been made visible',
    spanish: 'La traducción se ha hecho visible',
    brazilian_portuguese: 'A tradução foi tornada visível',
    tok_pisin: 'Translation i mekim save nau',
    indonesian: 'Terjemahan telah dibuat terlihat'
  },
  statusTranslationMadeInvisible: {
    english: 'The translation has been made invisible',
    spanish: 'La traducción se ha hecho invisible',
    brazilian_portuguese: 'A tradução foi tornada invisível',
    tok_pisin: 'Translation i mekim hait nau',
    indonesian: 'Terjemahan telah dibuat tidak terlihat'
  },
  statusTranslationMadeActive: {
    english: 'The translation has been made active',
    spanish: 'La traducción se ha activado',
    brazilian_portuguese: 'A tradução foi ativada',
    tok_pisin: 'Translation i mekim active nau',
    indonesian: 'Terjemahan telah diaktifkan'
  },
  statusTranslationMadeInactive: {
    english: 'The translation has been made inactive',
    spanish: 'La traducción ha sido desactivada',
    brazilian_portuguese: 'A tradução foi desativada',
    tok_pisin: 'Translation i mekim stop nau',
    indonesian: 'Terjemahan telah dinonaktifkan'
  },
  statusTranslationUpdateFailed: {
    english: 'Failed to update translation settings',
    spanish: 'Error al actualizar la configuración de la traducción',
    brazilian_portuguese: 'Falha ao atualizar as configurações da tradução',
    tok_pisin: 'I no inap update translation settings',
    indonesian: 'Gagal mengupdate pengaturan terjemahan'
  },
  translationSettingsLoadError: {
    english: 'Error loading translation settings.',
    spanish: 'Error al cargar la configuración de traducción.',
    brazilian_portuguese: 'Erro ao carregar as configurações de tradução.',
    tok_pisin: 'I no inap load translation settings.',
    indonesian: 'Gagal memuat pengaturan terjemahan.'
  },
  contentText: {
    english: 'Content Text',
    spanish: 'Texto del Contenido',
    brazilian_portuguese: 'Texto do Conteúdo',
    tok_pisin: 'Content Text',
    indonesian: 'Teks Konten'
  },
  enterContentText: {
    english: 'Enter content text...',
    spanish: 'Ingrese el texto del contenido...',
    brazilian_portuguese: 'Digite o texto do conteúdo...',
    tok_pisin: 'Putim content text...',
    indonesian: 'Masukkan teks konten...'
  },
  saving: {
    english: 'Saving...',
    spanish: 'Guardando...',
    brazilian_portuguese: 'Salvando...',
    tok_pisin: 'Seivim...',
    indonesian: 'Menyimpan...'
  },
  localAssetEditHint: {
    english: 'This asset is local only. Text can be edited until published.',
    spanish:
      'Este recurso es solo local. El texto se puede editar hasta que se publique.',
    brazilian_portuguese:
      'Este recurso é apenas local. O texto pode ser editado até ser publicado.',
    tok_pisin:
      'Dispela asset i local tasol. Yu ken senisim text inap yu publishim.',
    indonesian: 'Aset ini hanya lokal. Teks dapat diedit hingga dipublikasikan.'
  },
  requests: {
    english: 'Requests',
    spanish: 'Solicitudes',
    brazilian_portuguese: 'Solicitações',
    tok_pisin: 'Ol askim',
    indonesian: 'Permintaan'
  },
  noPendingRequests: {
    english: 'No pending membership requests',
    spanish: 'No hay solicitudes de membresía pendientes',
    brazilian_portuguese: 'Sem solicitações de adesão pendentes',
    tok_pisin: 'I no gat askim i stap',
    indonesian: 'Tidak ada permintaan keanggotaan tertunda'
  },
  confirmApprove: {
    english: 'Approve Request',
    spanish: 'Aprobar Solicitud',
    brazilian_portuguese: 'Aprovar Solicitação',
    tok_pisin: 'Orait long askim',
    indonesian: 'Setujui Permintaan'
  },
  confirmApproveMessage: {
    english: 'Add {name} as a member of this project?',
    spanish: '¿Agregar a {name} como miembro de este proyecto?',
    brazilian_portuguese: 'Adicionar {name} como membro deste projeto?',
    tok_pisin: 'Putim {name} i kamap memba bilong projek?',
    indonesian: 'Tambahkan {name} sebagai anggota proyek ini?'
  },
  requestApproved: {
    english: 'Request approved',
    spanish: 'Solicitud aprobada',
    brazilian_portuguese: 'Solicitação aprovada',
    tok_pisin: 'Askim i orait',
    indonesian: 'Permintaan disetujui'
  },
  confirmDeny: {
    english: 'Deny Request',
    spanish: 'Rechazar Solicitud',
    brazilian_portuguese: 'Negar Solicitação',
    tok_pisin: 'Tambu askim',
    indonesian: 'Tolak Permintaan'
  },
  confirmDenyMessage: {
    english: 'Deny membership request from {name}?',
    spanish: '¿Rechazar solicitud de membresía de {name}?',
    brazilian_portuguese: 'Negar solicitação de adesão de {name}?',
    tok_pisin: 'Tambu askim bilong {name}?',
    indonesian: 'Tolak permintaan keanggotaan dari {name}?'
  },
  requestDenied: {
    english: 'Request denied',
    spanish: 'Solicitud rechazada',
    brazilian_portuguese: 'Solicitação negada',
    tok_pisin: 'Askim i tambu',
    indonesian: 'Permintaan ditolak'
  },
  failedToApproveRequest: {
    english: 'Failed to approve request',
    spanish: 'Error al aprobar solicitud',
    brazilian_portuguese: 'Falha ao aprovar solicitação',
    tok_pisin: 'Askim i no inap orait',
    indonesian: 'Gagal menyetujui permintaan'
  },
  failedToDenyRequest: {
    english: 'Failed to deny request',
    spanish: 'Error al rechazar solicitud',
    brazilian_portuguese: 'Falha ao negar solicitação',
    tok_pisin: 'Askim i no inap tambu',
    indonesian: 'Gagal menolak permintaan'
  },
  downloadQuestToView: {
    english: 'This quest must be downloaded before you can view it.',
    spanish: 'Este quest debe descargarse antes de poder verlo.',
    brazilian_portuguese: 'Esta quest deve ser baixada antes de visualizá-la.',
    tok_pisin: 'Yu mas daunim dispela quest pastaim long lukim.',
    indonesian: 'Quest ini harus diunduh sebelum Anda dapat melihatnya.'
  },
  downloadNow: {
    english: 'Download Now',
    spanish: 'Descargar Ahora',
    brazilian_portuguese: 'Baixar Agora',
    tok_pisin: 'Daunim nau',
    indonesian: 'Unduh Sekarang'
  },
  vadTitle: {
    english: 'Voice Activity',
    spanish: 'Actividad de Voz',
    brazilian_portuguese: 'Atividade de Voz',
    tok_pisin: 'Wok bilong vois',
    indonesian: 'Aktivitas Suara'
  },
  vadDescription: {
    english: 'Records automatically when you speak',
    spanish: 'Graba automáticamente cuando hablas',
    brazilian_portuguese: 'Grava automaticamente quando você fala',
    tok_pisin: 'Em i save record pastaim taim yu toktok',
    indonesian: 'Merekam otomatis saat Anda berbicara'
  },
  vadCurrentLevel: {
    english: 'Current Level',
    spanish: 'Nivel Actual',
    brazilian_portuguese: 'Nível Atual',
    tok_pisin: 'Level nau',
    indonesian: 'Level Saat Ini'
  },
  vadRecordingNow: {
    english: 'Recording',
    spanish: 'Grabando',
    brazilian_portuguese: 'Gravando',
    tok_pisin: 'I save nau',
    indonesian: 'Merekam'
  },
  vadWaiting: {
    english: 'Waiting',
    spanish: 'Esperando',
    brazilian_portuguese: 'Aguardando',
    tok_pisin: 'Wetim',
    indonesian: 'Menunggu'
  },
  vadThreshold: {
    english: 'Sensitivity',
    spanish: 'Sensibilidad',
    brazilian_portuguese: 'Sensibilidade',
    tok_pisin: 'Strong bilong harim',
    indonesian: 'Sensitivitas'
  },
  vadSilenceDuration: {
    english: 'Pause Length',
    spanish: 'Duración de Pausa',
    brazilian_portuguese: 'Duração da Pausa',
    tok_pisin: 'Taim bilong pas',
    indonesian: 'Durasi Jeda'
  },
  vadSilenceDescription: {
    english: 'How long to wait before stopping',
    spanish: 'Tiempo de espera antes de detener',
    brazilian_portuguese: 'Quanto tempo esperar antes de parar',
    tok_pisin: 'Hamas taim bipo em i stop',
    indonesian: 'Berapa lama menunggu sebelum berhenti'
  },
  vadSensitive: {
    english: 'Sensitive',
    spanish: 'Sensible',
    brazilian_portuguese: 'Sensível',
    tok_pisin: 'I harim gut',
    indonesian: 'Sensitif'
  },
  vadNormal: {
    english: 'Normal',
    spanish: 'Normal',
    brazilian_portuguese: 'Normal',
    tok_pisin: 'Nambawan',
    indonesian: 'Normal'
  },
  vadLoud: {
    english: 'Loud',
    spanish: 'Alto',
    brazilian_portuguese: 'Alto',
    tok_pisin: 'Bikpela nois',
    indonesian: 'Keras'
  },
  vadVerySensitive: {
    english: 'Very Sensitive',
    spanish: 'Muy Sensible',
    brazilian_portuguese: 'Muito Sensível',
    tok_pisin: 'I harim tumas',
    indonesian: 'Sangat Sensitif'
  },
  vadLoudOnly: {
    english: 'Loud Only',
    spanish: 'Solo Alto',
    brazilian_portuguese: 'Apenas Alto',
    tok_pisin: 'Bikpela nois tasol',
    indonesian: 'Keras Saja'
  },
  vadVeryLoud: {
    english: 'Very Loud',
    spanish: 'Muy Alto',
    brazilian_portuguese: 'Muito Alto',
    tok_pisin: 'Bikpela nois tumas',
    indonesian: 'Sangat Keras'
  },
  vadQuickSegments: {
    english: 'Quick',
    spanish: 'Rápido',
    brazilian_portuguese: 'Rápido',
    tok_pisin: 'Kwik',
    indonesian: 'Cepat'
  },
  vadBalanced: {
    english: 'Balanced',
    spanish: 'Equilibrado',
    brazilian_portuguese: 'Equilibrado',
    tok_pisin: 'Naispela',
    indonesian: 'Seimbang'
  },
  vadCompleteThoughts: {
    english: 'Complete',
    spanish: 'Completo',
    brazilian_portuguese: 'Completo',
    tok_pisin: 'Olgeta',
    indonesian: 'Lengkap'
  },
  vadDisplayMode: {
    english: 'Display Mode',
    spanish: 'Modo de Visualización',
    brazilian_portuguese: 'Modo de Exibição',
    tok_pisin: 'Kaim bilong lukim',
    indonesian: 'Mode Tampilan'
  },
  vadFullScreen: {
    english: 'Full Screen',
    spanish: 'Pantalla Completa',
    brazilian_portuguese: 'Tela Cheia',
    tok_pisin: 'Fulap skrin',
    indonesian: 'Layar Penuh'
  },
  vadFooter: {
    english: 'Footer',
    spanish: 'Pie de Página',
    brazilian_portuguese: 'Rodapé',
    tok_pisin: 'Asdaun',
    indonesian: 'Footer'
  },
  vadDisplayDescription: {
    english: 'Choose how the waveform appears when recording',
    spanish: 'Elige cómo aparece la forma de onda al grabar',
    brazilian_portuguese: 'Escolha como a forma de onda aparece ao gravar',
    tok_pisin: 'Makim olsem wanem wevpom i kamap taim yu save record',
    indonesian: 'Pilih bagaimana bentuk gelombang muncul saat merekam'
  },
  vadStop: {
    english: 'Stop Recording',
    spanish: 'Detener Grabación',
    brazilian_portuguese: 'Parar Gravação',
    tok_pisin: 'Stopim rekod',
    indonesian: 'Berhenti Merekam'
  },
  vadHelpTitle: {
    english: 'How It Works',
    spanish: 'Cómo Funciona',
    brazilian_portuguese: 'Como Funciona',
    tok_pisin: 'Olsem wanem em i wok',
    indonesian: 'Cara Kerja'
  },
  vadHelpAutomatic: {
    english: 'Starts when you speak. Stops when you pause.',
    spanish: 'Inicia cuando hablas. Se detiene cuando haces una pausa.',
    brazilian_portuguese:
      'Inicia quando você fala. Para quando você faz uma pausa.',
    tok_pisin: 'Em i stat taim yu toktok. Em i stop taim yu pas.',
    indonesian: 'Dimulai saat Anda berbicara. Berhenti saat Anda berhenti.'
  },
  vadHelpSensitivity: {
    english: 'Lower sensitivity picks up quiet speech.',
    spanish: 'Menor sensibilidad capta el habla tranquila.',
    brazilian_portuguese: 'Menor sensibilidade capta fala baixa.',
    tok_pisin: 'Liklik strong i harim smol toktok.',
    indonesian: 'Sensitivitas rendah menangkap suara pelan.'
  },
  vadHelpPause: {
    english: 'Shorter pause splits faster. Longer captures everything.',
    spanish: 'Pausa más corta divide más rápido. Más larga captura todo.',
    brazilian_portuguese:
      'Pausa mais curta divide mais rápido. Mais longa captura tudo.',
    tok_pisin: 'Liklik taim i katim kwik. Longpela i kisim olgeta.',
    indonesian:
      'Jeda pendek memisahkan lebih cepat. Lebih lama menangkap semua.'
  },
  appUpgradeRequired: {
    english: 'App Upgrade Required',
    spanish: 'Actualización de App Requerida',
    brazilian_portuguese: 'Atualização do App Necessária',
    tok_pisin: 'Yu mas upgreidim app',
    indonesian: 'Pembaruan Aplikasi Diperlukan'
  },
  appUpgradeServerAhead: {
    english:
      'A new version of the app is required to access the latest features. Please update to continue.',
    spanish:
      'Se requiere una nueva versión de la aplicación para acceder a las últimas funciones. Por favor actualice para continuar.',
    brazilian_portuguese:
      'Uma nova versão do aplicativo é necessária para acessar os recursos mais recentes. Por favor, atualize para continuar.',
    tok_pisin:
      'Yu mas kisim nupela version bilong app long usim ol nupela samting. Plis upgreidim long go het.',
    indonesian:
      'Versi baru aplikasi diperlukan untuk mengakses fitur terbaru. Silakan perbarui untuk melanjutkan.'
  },
  appUpgradeServerBehind: {
    english:
      'Your app version is newer than the server. Please contact support or wait for the server to be updated.',
    spanish:
      'Su versión de la aplicación es más nueva que el servidor. Por favor contacte al soporte o espere a que se actualice el servidor.',
    brazilian_portuguese:
      'Sua versão do aplicativo é mais recente que o servidor. Por favor, entre em contato com o suporte ou aguarde a atualização do servidor.',
    tok_pisin:
      'Version bilong app bilong yu i nupela moa long server. Plis contactim support o wetim server i upgreidim.',
    indonesian:
      'Versi aplikasi Anda lebih baru dari server. Silakan hubungi dukungan atau tunggu server diperbarui.'
  },
  upgradeToVersion: {
    english: 'Please upgrade to version {version}',
    spanish: 'Por favor actualice a la versión {version}',
    brazilian_portuguese: 'Por favor atualize para a versão {version}',
    tok_pisin: 'Plis upgreidim long version {version}',
    indonesian: 'Silakan perbarui ke versi {version}'
  },
  currentVersion: {
    english: 'Current Version',
    spanish: 'Versión Actual',
    brazilian_portuguese: 'Versão Atual',
    tok_pisin: 'Version nau',
    indonesian: 'Versi Saat Ini'
  },
  requiredVersion: {
    english: 'Required Version',
    spanish: 'Versión Requerida',
    brazilian_portuguese: 'Versão Necessária',
    tok_pisin: 'Version yu mas gat',
    indonesian: 'Versi yang Diperlukan'
  },
  upgradeApp: {
    english: 'Upgrade App',
    spanish: 'Actualizar App',
    brazilian_portuguese: 'Atualizar App',
    tok_pisin: 'Upgreidim App',
    indonesian: 'Perbarui Aplikasi'
  },
  checkingSchemaVersion: {
    english: 'Checking schema compatibility...',
    spanish: 'Verificando compatibilidad del esquema...',
    brazilian_portuguese: 'Verificando compatibilidade do esquema...',
    tok_pisin: 'Checkim schema compatibility...',
    indonesian: 'Memeriksa kompatibilitas skema...'
  },
  scanningCorruptedAttachments: {
    english: 'Scanning for corrupted attachments...',
    spanish: 'Buscando archivos adjuntos corruptos...',
    brazilian_portuguese: 'Procurando anexos corrompidos...',
    tok_pisin: 'Lukluk long ol bagarap fayl...',
    indonesian: 'Memindai lampiran yang rusak...'
  },
  noCorruptedAttachments: {
    english: 'No Corrupted Attachments',
    spanish: 'No hay archivos adjuntos corruptos',
    brazilian_portuguese: 'Sem Anexos Corrompidos',
    tok_pisin: 'I no gat bagarap fayl',
    indonesian: 'Tidak Ada Lampiran Rusak'
  },
  attachmentDatabaseHealthy: {
    english:
      'Your attachment database is healthy. All attachment records are valid.',
    spanish:
      'Su base de datos de archivos adjuntos está en buen estado. Todos los registros son válidos.',
    brazilian_portuguese:
      'Seu banco de dados de anexos está saudável. Todos os registros estão válidos.',
    tok_pisin:
      'Database bilong ol fayl bilong yu i gutpela. Olgeta rekod i orait.',
    indonesian: 'Database lampiran Anda sehat. Semua catatan lampiran valid.'
  },
  corruptedAttachments: {
    english: 'Corrupted Attachments',
    spanish: 'Archivos Adjuntos Corruptos',
    brazilian_portuguese: 'Anexos Corrompidos',
    tok_pisin: 'Ol Bagarap Fayl',
    indonesian: 'Lampiran Rusak'
  },
  foundCorruptedAttachments: {
    english:
      'Found {count} corrupted attachment with blob URLs in the database. These are causing sync errors and should be cleaned up.',
    spanish:
      'Se encontró {count} archivo adjunto corrupto con URLs blob en la base de datos. Estos están causando errores de sincronización y deben limpiarse.',
    brazilian_portuguese:
      'Encontrado {count} anexo corrompido com URLs blob no banco de dados. Estes estão causando erros de sincronização e devem ser limpos.',
    tok_pisin:
      'Mi lukim {count} bagarap fayl wantaim blob URL long database. Ol dispela i mekim sync nogut na yu mas klinim.',
    indonesian:
      'Ditemukan {count} lampiran rusak dengan URL blob di database. Ini menyebabkan kesalahan sinkronisasi dan harus dibersihkan.'
  },
  foundCorruptedAttachmentsPlural: {
    english:
      'Found {count} corrupted attachments with blob URLs in the database. These are causing sync errors and should be cleaned up.',
    spanish:
      'Se encontraron {count} archivos adjuntos corruptos con URLs blob en la base de datos. Estos están causando errores de sincronización y deben limpiarse.',
    brazilian_portuguese:
      'Encontrados {count} anexos corrompidos com URLs blob no banco de dados. Estes estão causando erros de sincronização e devem ser limpos.',
    tok_pisin:
      'Mi lukim {count} bagarap fayl wantaim blob URL long database. Ol dispela i mekim sync nogut na yu mas klinim.',
    indonesian:
      'Ditemukan {count} lampiran rusak dengan URL blob di database. Ini menyebabkan kesalahan sinkronisasi dan harus dibersihkan.'
  },
  cleanAll: {
    english: 'Clean All ({count})',
    spanish: 'Limpiar Todo ({count})',
    brazilian_portuguese: 'Limpar Tudo ({count})',
    tok_pisin: 'Klinim Olgeta ({count})',
    indonesian: 'Bersihkan Semua ({count})'
  },
  cleaning: {
    english: 'Cleaning...',
    spanish: 'Limpiando...',
    brazilian_portuguese: 'Limpando...',
    tok_pisin: 'Mi klinim nau...',
    indonesian: 'Membersihkan...'
  },
  size: {
    english: 'Size',
    spanish: 'Tamaño',
    brazilian_portuguese: 'Tamanho',
    tok_pisin: 'Saiz',
    indonesian: 'Ukuran'
  },
  attachmentId: {
    english: 'Attachment ID',
    spanish: 'ID del Archivo Adjunto',
    brazilian_portuguese: 'ID do Anexo',
    tok_pisin: 'ID bilong Fayl',
    indonesian: 'ID Lampiran'
  },
  localUri: {
    english: 'Local URI',
    spanish: 'URI Local',
    brazilian_portuguese: 'URI Local',
    tok_pisin: 'Local URI',
    indonesian: 'URI Lokal'
  },
  associatedAssets: {
    english: 'Associated Assets ({count})',
    spanish: 'Activos Asociados ({count})',
    brazilian_portuguese: 'Ativos Associados ({count})',
    tok_pisin: 'Ol Asset i go wantaim ({count})',
    indonesian: 'Aset Terkait ({count})'
  },
  contentLinks: {
    english: 'Content Links ({count})',
    spanish: 'Enlaces de Contenido ({count})',
    brazilian_portuguese: 'Links de Conteúdo ({count})',
    tok_pisin: 'Ol Link bilong Content ({count})',
    indonesian: 'Tautan Konten ({count})'
  },
  cleanThis: {
    english: 'Clean This',
    spanish: 'Limpiar Esto',
    brazilian_portuguese: 'Limpar Isto',
    tok_pisin: 'Klinim Dispela',
    indonesian: 'Bersihkan Ini'
  },
  cleanCorruptedAttachment: {
    english: 'Clean Corrupted Attachment',
    spanish: 'Limpiar Archivo Adjunto Corrupto',
    brazilian_portuguese: 'Limpar Anexo Corrompido',
    tok_pisin: 'Klinim Bagarap Fayl',
    indonesian: 'Bersihkan Lampiran Rusak'
  },
  cleanCorruptedAttachmentConfirm: {
    english:
      'This will remove the corrupted attachment record and its references from the database. This action cannot be undone.',
    spanish:
      'Esto eliminará el registro del archivo adjunto corrupto y sus referencias de la base de datos. Esta acción no se puede deshacer.',
    brazilian_portuguese:
      'Isso removerá o registro do anexo corrompido e suas referências do banco de dados. Esta ação não pode ser desfeita.',
    tok_pisin:
      'Dispela bai rausim ol rekod bilong bagarap fayl na ol referens bilong en long database. Yu no inap tanim bek dispela.',
    indonesian:
      'Ini akan menghapus catatan lampiran rusak dan referensinya dari database. Tindakan ini tidak dapat dibatalkan.'
  },
  clean: {
    english: 'Clean',
    spanish: 'Limpiar',
    brazilian_portuguese: 'Limpar',
    tok_pisin: 'Klinim',
    indonesian: 'Bersihkan'
  },
  corruptedAttachmentCleanedSuccess: {
    english: 'Corrupted attachment cleaned successfully.',
    spanish: 'Archivo adjunto corrupto limpiado exitosamente.',
    brazilian_portuguese: 'Anexo corrompido limpo com sucesso.',
    tok_pisin: 'Bagarap fayl i klinim gut pinis.',
    indonesian: 'Lampiran rusak berhasil dibersihkan.'
  },
  failedToCleanAttachment: {
    english: 'Failed to clean attachment: {error}',
    spanish: 'Error al limpiar el archivo adjunto: {error}',
    brazilian_portuguese: 'Falha ao limpar anexo: {error}',
    tok_pisin: 'I no inap klinim fayl: {error}',
    indonesian: 'Gagal membersihkan lampiran: {error}'
  },
  cleanAllCorruptedAttachments: {
    english: 'Clean All Corrupted Attachments',
    spanish: 'Limpiar Todos los Archivos Adjuntos Corruptos',
    brazilian_portuguese: 'Limpar Todos os Anexos Corrompidos',
    tok_pisin: 'Klinim Olgeta Bagarap Fayl',
    indonesian: 'Bersihkan Semua Lampiran Rusak'
  },
  cleanAllConfirm: {
    english:
      'This will clean up {count} corrupted attachment. This action cannot be undone.',
    spanish:
      'Esto limpiará {count} archivo adjunto corrupto. Esta acción no se puede deshacer.',
    brazilian_portuguese:
      'Isso limpará {count} anexo corrompido. Esta ação não pode ser desfeita.',
    tok_pisin:
      'Dispela bai klinim {count} bagarap fayl. Yu no inap tanim bek dispela.',
    indonesian:
      'Ini akan membersihkan {count} lampiran rusak. Tindakan ini tidak dapat dibatalkan.'
  },
  cleanAllConfirmPlural: {
    english:
      'This will clean up {count} corrupted attachments. This action cannot be undone.',
    spanish:
      'Esto limpiará {count} archivos adjuntos corruptos. Esta acción no se puede deshacer.',
    brazilian_portuguese:
      'Isso limpará {count} anexos corrompidos. Esta ação não pode ser desfeita.',
    tok_pisin:
      'Dispela bai klinim {count} bagarap fayl. Yu no inap tanim bek dispela.',
    indonesian:
      'Ini akan membersihkan {count} lampiran rusak. Tindakan ini tidak dapat dibatalkan.'
  },
  partialSuccess: {
    english: 'Partial Success',
    spanish: 'Éxito Parcial',
    brazilian_portuguese: 'Sucesso Parcial',
    tok_pisin: 'Sampela i Orait',
    indonesian: 'Berhasil Sebagian'
  },
  cleanedAttachmentsWithErrors: {
    english:
      'Cleaned {cleaned} attachment. {errorCount} error occurred:\n\n{errors}',
    spanish:
      'Se limpió {cleaned} archivo adjunto. Ocurrió {errorCount} error:\n\n{errors}',
    brazilian_portuguese:
      'Limpou {cleaned} anexo. Ocorreu {errorCount} erro:\n\n{errors}',
    tok_pisin: 'Klinim {cleaned} fayl. {errorCount} rong i kamap:\n\n{errors}',
    indonesian:
      'Membersihkan {cleaned} lampiran. {errorCount} kesalahan terjadi:\n\n{errors}'
  },
  cleanedAttachmentsWithErrorsPlural: {
    english:
      'Cleaned {cleaned} attachments. {errorCount} errors occurred:\n\n{errors}',
    spanish:
      'Se limpiaron {cleaned} archivos adjuntos. Ocurrieron {errorCount} errores:\n\n{errors}',
    brazilian_portuguese:
      'Limpou {cleaned} anexos. Ocorreram {errorCount} erros:\n\n{errors}',
    tok_pisin: 'Klinim {cleaned} fayl. {errorCount} rong i kamap:\n\n{errors}',
    indonesian:
      'Membersihkan {cleaned} lampiran. {errorCount} kesalahan terjadi:\n\n{errors}'
  },
  successfullyCleanedAttachments: {
    english: 'Successfully cleaned {cleaned} corrupted attachment.',
    spanish: 'Se limpió exitosamente {cleaned} archivo adjunto corrupto.',
    brazilian_portuguese: 'Limpou com sucesso {cleaned} anexo corrompido.',
    tok_pisin: 'Klinim gut {cleaned} bagarap fayl.',
    indonesian: 'Berhasil membersihkan {cleaned} lampiran rusak.'
  },
  successfullyCleanedAttachmentsPlural: {
    english: 'Successfully cleaned {cleaned} corrupted attachments.',
    spanish: 'Se limpiaron exitosamente {cleaned} archivos adjuntos corruptos.',
    brazilian_portuguese: 'Limpou com sucesso {cleaned} anexos corrompidos.',
    tok_pisin: 'Klinim gut {cleaned} bagarap fayl.',
    indonesian: 'Berhasil membersihkan {cleaned} lampiran rusak.'
  },
  failedToCleanAttachments: {
    english: 'Failed to clean attachments: {error}',
    spanish: 'Error al limpiar los archivos adjuntos: {error}',
    brazilian_portuguese: 'Falha ao limpar anexos: {error}',
    tok_pisin: 'I no inap klinim ol fayl: {error}',
    indonesian: 'Gagal membersihkan lampiran: {error}'
  },
  failedToLoadCorruptedAttachments: {
    english: 'Failed to load corrupted attachments. Please try again.',
    spanish:
      'Error al cargar los archivos adjuntos corruptos. Por favor, intente de nuevo.',
    brazilian_portuguese:
      'Falha ao carregar anexos corrompidos. Por favor, tente novamente.',
    tok_pisin: 'I no inap loadim ol bagarap fayl. Plis traim gen.',
    indonesian: 'Gagal memuat lampiran rusak. Silakan coba lagi.'
  },
  unnamed: {
    english: 'Unnamed',
    spanish: 'Sin nombre',
    brazilian_portuguese: 'Sem nome',
    tok_pisin: 'I no gat nem',
    indonesian: 'Tanpa nama'
  },
  backToProjects: {
    english: 'Back to Projects',
    spanish: 'Volver a Proyectos',
    brazilian_portuguese: 'Voltar aos Projetos',
    tok_pisin: 'Go bek long ol Projek',
    indonesian: 'Kembali ke Proyek'
  },
  downloaded: {
    english: 'Downloaded',
    spanish: 'Descargado',
    brazilian_portuguese: 'Baixado',
    tok_pisin: 'Downloaded',
    indonesian: 'Diunduh'
  },
  freeUpSpace: {
    english: 'Free Up Space',
    spanish: 'Liberar Espacio',
    brazilian_portuguese: 'Liberar Espaço',
    tok_pisin: 'Free Up Space',
    indonesian: 'Bebaskan Ruang'
  },
  storageUsed: {
    english: 'Storage Used',
    spanish: 'Espacio Usado',
    brazilian_portuguese: 'Espaço Usado',
    tok_pisin: 'Storage Used',
    indonesian: 'Penyimpanan yang Digunakan'
  },
  notDownloaded: {
    english: 'Not Downloaded',
    spanish: 'No Descargado',
    brazilian_portuguese: 'Não Baixado',
    tok_pisin: 'Not Downloaded',
    indonesian: 'Tidak Diunduh'
  },
  missingCloudData: {
    english: 'Missing Cloud Data',
    spanish: 'Falta Datos en la Nube',
    brazilian_portuguese: 'Dados na Nuvem Faltando',
    tok_pisin: 'No gat ol data long cloud',
    indonesian: 'Data Cloud Hilang'
  },
  deleteAccount: {
    english: 'Delete Account',
    spanish: 'Eliminar Cuenta',
    brazilian_portuguese: 'Excluir Conta',
    tok_pisin: 'Rausim Account',
    indonesian: 'Hapus Akun'
  },
  accountDeletionTitle: {
    english: 'Delete Your Account',
    spanish: 'Eliminar Tu Cuenta',
    brazilian_portuguese: 'Excluir Sua Conta',
    tok_pisin: 'Rausim Account Bilong Yu',
    indonesian: 'Hapus Akun Anda'
  },
  accountDeletionWarning: {
    english:
      'After deleting your account, you will not be able to register or log in while offline. You must be online to create a new account or log in.',
    spanish:
      'Después de eliminar tu cuenta, no podrás registrarte ni iniciar sesión sin conexión. Debes estar en línea para crear una nueva cuenta o iniciar sesión.',
    brazilian_portuguese:
      'Após excluir sua conta, você não poderá se registrar ou fazer login enquanto estiver offline. Você deve estar online para criar uma nova conta ou fazer login.',
    tok_pisin:
      'Bihain long rausim account bilong yu, yu no inap mekim registration o login taim yu no gat internet. Yu mas gat internet long mekim nupela account o login.',
    indonesian:
      'Setelah menghapus akun Anda, Anda tidak akan dapat mendaftar atau masuk saat offline. Anda harus online untuk membuat akun baru atau masuk.'
  },
  accountDeletionPIIWarning: {
    english:
      'Your account will be deactivated (soft delete). All your data will be preserved, but you will not be able to access the app until you restore your account. You can restore your account at any time, but you must be online to do so.',
    spanish:
      'Tu cuenta será desactivada (eliminación suave). Todos tus datos se conservarán, pero no podrás acceder a la aplicación hasta que restaures tu cuenta. Puedes restaurar tu cuenta en cualquier momento, pero debes estar en línea para hacerlo.',
    brazilian_portuguese:
      'Sua conta será desativada (exclusão suave). Todos os seus dados serão preservados, mas você não poderá acessar o aplicativo até restaurar sua conta. Você pode restaurar sua conta a qualquer momento, mas precisa estar online para fazer isso.',
    tok_pisin:
      'Account bilong yu bai stop wok (soft delete). Ol data bilong yu bai stap, tasol yu no inap go long app inap yu restore account. Yu inap restore account long eni taim, tasol yu mas gat internet long mekim.',
    indonesian:
      'Akun Anda akan dinonaktifkan (penghapusan lunak). Semua data Anda akan dilestarikan, tetapi Anda tidak akan dapat mengakses aplikasi hingga Anda memulihkan akun Anda. Anda dapat memulihkan akun Anda kapan saja, tetapi Anda harus online untuk melakukannya.'
  },
  accountDeletionContributionsInfo: {
    english:
      'All your contributions (projects, quests, assets, translations, votes) will be preserved and will remain public following the terms you already agreed to when you joined. Your account can be restored at any time, and all your data will be accessible again.',
    spanish:
      'Todas tus contribuciones (proyectos, búsquedas, activos, traducciones, votos) se conservarán y permanecerán públicas según los términos que ya aceptaste al unirte. Tu cuenta puede ser restaurada en cualquier momento, y todos tus datos volverán a estar accesibles.',
    brazilian_portuguese:
      'Todas as suas contribuições (projetos, missões, ativos, traduções, votos) serão preservadas e permanecerão públicas de acordo com os termos que você já concordou ao ingressar. Sua conta pode ser restaurada a qualquer momento, e todos os seus dados estarão acessíveis novamente.',
    tok_pisin:
      'Olgeta samting yu bin helpim (project, quest, asset, translation, vote) bai i stap na bai i stap olsem long term yu bin oreti long en taim yu joinim. Account bilong yu inap restore long eni taim, na ol data bilong yu bai kamap bek.',
    indonesian:
      'Semua kontribusi Anda (proyek, quest, aset, terjemahan, suara) akan dilestarikan dan akan tetap publik sesuai dengan syarat yang telah Anda setujui saat bergabung. Akun Anda dapat dipulihkan kapan saja, dan semua data Anda akan dapat diakses lagi.'
  },
  accountDeletionConfirm: {
    english:
      'Are you absolutely sure you want to delete your account? You can restore it later, but you will need to be online to do so.',
    spanish:
      '¿Estás absolutamente seguro de que deseas eliminar tu cuenta? Puedes restaurarla más tarde, pero necesitarás estar en línea para hacerlo.',
    brazilian_portuguese:
      'Tem certeza absoluta de que deseja excluir sua conta? Você pode restaurá-la mais tarde, mas precisará estar online para fazer isso.',
    tok_pisin:
      'Yu tru long rausim account bilong yu? Yu inap restore long bihain, tasol yu mas gat internet long mekim.',
    indonesian:
      'Apakah Anda benar-benar yakin ingin menghapus akun Anda? Anda dapat memulihkannya nanti, tetapi Anda harus online untuk melakukannya.'
  },
  accountDeletionConfirmMessage: {
    english:
      'Your account will be deleted (soft delete). You can restore it later from the login screen, but you must be online to restore it.',
    spanish:
      'Tu cuenta será eliminada (eliminación suave). Puedes restaurarla más tarde desde la pantalla de inicio de sesión, pero debes estar en línea para restaurarla.',
    brazilian_portuguese:
      'Sua conta será excluída (exclusão suave). Você pode restaurá-la mais tarde da tela de login, mas precisa estar online para restaurá-la.',
    tok_pisin:
      'Account bilong yu bai raus (soft delete). Yu inap restore long bihain long login screen, tasol yu mas gat internet long restore.',
    indonesian:
      'Akun Anda akan dihapus (penghapusan lunak). Anda dapat memulihkannya nanti dari layar login, tetapi Anda harus online untuk memulihkannya.'
  },
  accountDeletionStep1Title: {
    english: 'Step 1: Understand the Consequences',
    spanish: 'Paso 1: Entender las Consecuencias',
    brazilian_portuguese: 'Etapa 1: Entender as Consequências',
    tok_pisin: 'Step 1: Save ol Samting Bai Kamap',
    indonesian: 'Langkah 1: Pahami Konsekuensinya'
  },
  accountDeletionStep2Title: {
    english: 'Step 2: Final Confirmation',
    spanish: 'Paso 2: Confirmación Final',
    brazilian_portuguese: 'Etapa 2: Confirmação Final',
    tok_pisin: 'Step 2: Final Confirm',
    indonesian: 'Langkah 2: Konfirmasi Akhir'
  },
  accountDeletionSuccess: {
    english:
      'Your account has been successfully deleted (soft delete). You can restore it later, but you must be online to do so. You will be signed out now.',
    spanish:
      'Tu cuenta ha sido eliminada exitosamente (eliminación suave). Puedes restaurarla más tarde, pero debes estar en línea para hacerlo. Serás desconectado ahora.',
    brazilian_portuguese:
      'Sua conta foi excluída com sucesso (exclusão suave). Você pode restaurá-la mais tarde, mas precisa estar online para fazer isso. Você será desconectado agora.',
    tok_pisin:
      'Account bilong yu i raus pinis (soft delete). Yu inap restore long bihain, tasol yu mas gat internet long mekim. Yu bai sign out nau.',
    indonesian:
      'Akun Anda telah berhasil dihapus (penghapusan lunak). Anda dapat memulihkannya nanti, tetapi Anda harus online untuk melakukannya. Anda akan keluar sekarang.'
  },
  accountDeletionError: {
    english: 'Failed to delete account: {error}',
    spanish: 'Error al eliminar la cuenta: {error}',
    brazilian_portuguese: 'Falha ao excluir conta: {error}',
    tok_pisin: 'I no inap rausim account: {error}',
    indonesian: 'Gagal menghapus akun: {error}'
  },
  accountDeletedTitle: {
    english: 'Account Deleted',
    spanish: 'Cuenta Eliminada',
    brazilian_portuguese: 'Conta Excluída',
    tok_pisin: 'Account i Raus',
    indonesian: 'Akun Dihapus'
  },
  accountDeletedMessage: {
    english:
      'Your account has been deleted. You can restore it to regain access to all your data, or you can log out and return to the login screen.',
    spanish:
      'Tu cuenta ha sido eliminada. Puedes restaurarla para recuperar el acceso a todos tus datos, o puedes cerrar sesión y volver a la pantalla de inicio de sesión.',
    brazilian_portuguese:
      'Sua conta foi excluída. Você pode restaurá-la para recuperar o acesso a todos os seus dados ou pode sair e retornar à tela de login.',
    tok_pisin:
      'Account bilong yu i raus pinis. Yu inap restore long kamap bek ol data bilong yu, o yu inap logout na go bek long login.',
    indonesian:
      'Akun Anda telah dihapus. Anda dapat memulihkannya untuk mendapatkan kembali akses ke semua data Anda, atau Anda dapat keluar dan kembali ke layar login.'
  },
  restoreAccount: {
    english: 'Restore Account',
    spanish: 'Restaurar Cuenta',
    brazilian_portuguese: 'Restaurar Conta',
    tok_pisin: 'Restore Account',
    indonesian: 'Pulihkan Akun'
  },
  restoreAccountConfirmTitle: {
    english: 'Restore Account?',
    spanish: '¿Restaurar Cuenta?',
    brazilian_portuguese: 'Restaurar Conta?',
    tok_pisin: 'Restore Account?',
    indonesian: 'Pulihkan Akun?'
  },
  restoreAccountConfirmMessage: {
    english:
      'Your account will be fully restored. All your data will be accessible again, and you can continue using the app normally.',
    spanish:
      'Tu cuenta será restaurada por completo. Todos tus datos volverán a estar accesibles y podrás seguir usando la aplicación con normalidad.',
    brazilian_portuguese:
      'Sua conta será totalmente restaurada. Todos os seus dados estarão acessíveis novamente e você poderá continuar usando o aplicativo normalmente.',
    tok_pisin:
      'Account bilong yu bai restore olgeta. Ol data bilong yu bai kamap bek, na yu inap wokim ol samting olsem bipo.',
    indonesian:
      'Akun Anda akan dipulihkan sepenuhnya. Semua data Anda akan dapat diakses lagi, dan Anda dapat melanjutkan menggunakan aplikasi secara normal.'
  },
  accountRestoreSuccess: {
    english: 'Your account has been successfully restored. Welcome back!',
    spanish: 'Tu cuenta ha sido restaurada exitosamente. ¡Bienvenido de nuevo!',
    brazilian_portuguese:
      'Sua conta foi restaurada com sucesso. Bem-vindo de volta!',
    tok_pisin: 'Account bilong yu i restore pinis. Welkam bek!',
    indonesian: 'Akun Anda telah berhasil dipulihkan. Selamat datang kembali!'
  },
  accountRestoreError: {
    english: 'Failed to restore account: {error}',
    spanish: 'Error al restaurar la cuenta: {error}',
    brazilian_portuguese: 'Falha ao restaurar conta: {error}',
    tok_pisin: 'I no inap restore account: {error}',
    indonesian: 'Gagal memulihkan akun: {error}'
  },
  signInRequired: {
    english: 'Sign In Required',
    spanish: 'Inicio de Sesión Requerido',
    brazilian_portuguese: 'Login Necessário',
    tok_pisin: 'Mas I Mas Sign In',
    indonesian: 'Masuk Diperlukan'
  },
  blockContentLoginMessage: {
    english:
      'We store information about what to block on your account. Please register to ensure blocked content can be properly hidden.',
    spanish:
      'Almacenamos información sobre qué bloquear en tu cuenta. Por favor regístrate para asegurar que el contenido bloqueado pueda ocultarse correctamente.',
    brazilian_portuguese:
      'Armazenamos informações sobre o que bloquear em sua conta. Por favor, registre-se para garantir que o conteúdo bloqueado possa ser ocultado adequadamente.',
    tok_pisin:
      'Mipela save long ol samting yu laik block long account bilong yu. Plis register long ol samting i ken hide stret.',
    indonesian:
      'Kami menyimpan informasi tentang apa yang akan diblokir di akun Anda. Silakan daftar untuk memastikan konten yang diblokir dapat disembunyikan dengan benar.'
  }
} as const;

// Type check to ensure all translation keys have all supported languages
// type ValidateTranslations<T> = {
//   [K in keyof T]: T[K] extends TranslationSet ? true : never;
// };
// type ValidationResult = ValidateTranslations<typeof translations>;
