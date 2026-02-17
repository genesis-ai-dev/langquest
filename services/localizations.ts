// Define all supported UI languages
export type SupportedLanguage =
  | 'english'
  | 'spanish'
  | 'brazilian_portuguese'
  | 'tok_pisin'
  | 'indonesian'
  | 'nepali'
  | 'hindi'
  | 'burmese'
  | 'thai'
  | 'mandarin';

/**
 * Languoid names that have local UI support.
 * Used to filter ui_ready languoids from the DB to prevent showing
 * languages that newer DB versions support but older app versions don't.
 * Must match the mapping in useLocalization.ts mapLanguoidNameToSupportedLanguage()
 */
export const SUPPORTED_LANGUAGE_NAMES = new Set([
  // English
  'english',
  // Spanish
  'spanish',
  'español',
  'espanol',
  // Brazilian Portuguese
  'brazilian portuguese',
  'português brasileiro',
  'portugues brasileiro',
  // Tok Pisin
  'tok pisin',
  // Indonesian
  'standard indonesian',
  'indonesian',
  'bahasa indonesia',
  // Nepali
  'nepali',
  'नेपाली',
  // Hindi
  'hindi',
  'हिन्दी',
  // Burmese
  'burmese',
  'မြန်မာ',
  // Thai
  'thai',
  'ไทย',
  // Mandarin
  'mandarin',
  'mandarin chinese',
  '普通话',
  '中文'
]);

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
    indonesian: 'Terima',
    nepali: 'स्वीकार गर्नुहोस्',
    hindi: 'स्वीकार करें',
    burmese: 'လက်ခံပါ',
    thai: 'ยอมรับ',
    mandarin: '接受'
  },
  iAgree: {
    english: 'I agree',
    spanish: 'Estoy de acuerdo',
    brazilian_portuguese: 'Eu concordo',
    tok_pisin: 'Mi agri',
    indonesian: 'Saya setuju',
    nepali: 'म सहमत छु',
    hindi: 'मैं सहमत हूं',
    burmese: 'ကျွန်ုပ် သဘောတူပါသည်',
    thai: 'ฉันเห็นด้วย',
    mandarin: '我同意'
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
      'Harap verifikasi alamat email Anda sebelum masuk. Periksa email Anda untuk tautan verifikasi.',
    nepali:
      'साइन इन गर्नु अघि कृपया आफ्नो इमेल ठेगाना प्रमाणित गर्नुहोस्। प्रमाणीकरण लिंकको लागि आफ्नो इमेल जाँच गर्नुहोस्।',
    hindi:
      'कृपया साइन इन करने से पहले अपना ईमेल पता सत्यापित करें। सत्यापन लिंक के लिए अपना ईमेल जांचें।',
    burmese:
      'အကောင့်ဝင်မီ သင်၏အီးမေးလ်လိပ်စာကို အတည်ပြုပါ။ အတည်ပြုချက်လင့်ခ်အတွက် သင်၏အီးမေးလ်ကို စစ်ဆေးပါ။',
    thai: 'กรุณาตรวจสอบที่อยู่อีเมลของคุณก่อนเข้าสู่ระบบ ตรวจสอบอีเมลของคุณเพื่อลิงก์ยืนยัน',
    mandarin:
      '请在登录前验证您的电子邮件地址。请检查您的电子邮件以获取验证链接。'
  },
  done: {
    english: 'Done',
    spanish: 'Listo',
    brazilian_portuguese: 'Feito',
    tok_pisin: 'Done',
    indonesian: 'Selesai',
    nepali: 'सम्पन्न',
    hindi: 'पूर्ण',
    burmese: 'ပြီးပါပြီ',
    thai: 'เสร็จสิ้น',
    mandarin: '完成'
  },
  all: {
    english: 'All',
    spanish: 'Todo',
    brazilian_portuguese: 'Todos',
    tok_pisin: 'Olgeta',
    indonesian: 'Semua',
    nepali: 'सबै',
    hindi: 'सभी',
    burmese: 'အားလုံး',
    thai: 'ทั้งหมด',
    mandarin: '全部'
  },
  options: {
    english: 'Options',
    spanish: 'Opciones',
    brazilian_portuguese: 'Opções',
    nepali: 'विकल्पहरू',
    hindi: 'विकल्प',
    burmese: 'ရွေးချယ်စရာများ',
    thai: 'ตัวเลือก',
    mandarin: '选项'
  },
  membersOnlyCreate: {
    english: 'Only project members can create content',
    spanish: 'Solo los miembros del proyecto pueden crear contenido',
    brazilian_portuguese: 'Apenas membros do projeto podem criar conteúdo',
    tok_pisin: 'Tasol ol memba bilong projek inap mekim nupela samting',
    indonesian: 'Hanya anggota proyek yang dapat membuat konten',
    nepali: 'प्रोजेक्ट सदस्यहरूले मात्र सामग्री सिर्जना गर्न सक्छन्',
    hindi: 'केवल परियोजना सदस्य ही सामग्री बना सकते हैं',
    burmese: 'စီမံကိန်းအဖွဲ့ဝင်များသာ အကြောင်းအရာကို ဖန်တီးနိုင်သည်',
    thai: 'เฉพาะสมาชิกโครงการเท่านั้นที่สามารถสร้างเนื้อหาได้',
    mandarin: '只有项目成员可以创建内容'
  },
  membersOnlyPublish: {
    english: 'Only project members can save to the cloud',
    spanish: 'Solo los miembros del proyecto pueden guardar en la nube',
    brazilian_portuguese: 'Apenas membros do projeto podem salvar na nuvem',
    tok_pisin: 'Tasol ol memba bilong projek inap save long cloud',
    indonesian: 'Hanya anggota proyek yang dapat menyimpan ke cloud',
    nepali: 'प्रोजेक्ट सदस्यहरूले मात्र क्लाउडमा सेभ गर्न सक्छन्',
    hindi: 'केवल परियोजना सदस्य ही क्लाउड में सहेज सकते हैं',
    burmese: 'စီမံကိန်းအဖွဲ့ဝင်များသာ cloud သို့ သိမ်းဆည်းနိုင်သည်',
    thai: 'เฉพาะสมาชิกโครงการเท่านั้นที่สามารถบันทึกลงคลาวด์ได้',
    mandarin: '只有项目成员可以保存到云端'
  },
  apply: {
    english: 'Apply',
    spanish: 'Aplicar',
    brazilian_portuguese: 'Aplicar',
    tok_pisin: 'Putim',
    indonesian: 'Terapkan',
    nepali: 'लागू गर्नुहोस्',
    hindi: 'लागू करें',
    burmese: 'အသုံးပြုပါ',
    thai: 'ใช้',
    mandarin: '应用'
  },
  avatar: {
    english: 'Avatar',
    spanish: 'Avatar',
    brazilian_portuguese: 'Avatar',
    tok_pisin: 'Avatar',
    indonesian: 'Avatar',
    nepali: 'अवतार',
    hindi: 'अवतार',
    burmese: 'ပုံရိပ်',
    thai: 'อวตาร',
    mandarin: '头像'
  },
  backToLogin: {
    english: 'Back to Login',
    spanish: 'Volver al inicio de sesión',
    brazilian_portuguese: 'Voltar para o Login',
    tok_pisin: 'Go bek long Login',
    indonesian: 'Kembali ke Login',
    nepali: 'लगइनमा फर्कनुहोस्',
    hindi: 'लॉगिन पर वापस जाएं',
    burmese: 'အကောင့်ဝင်သို့ ပြန်သွားပါ',
    thai: 'กลับไปที่การเข้าสู่ระบบ',
    mandarin: '返回登录'
  },
  checkEmail: {
    english: 'Please check your email',
    spanish: 'Por favor revise su correo electrónico',
    brazilian_portuguese: 'Por favor, verifique seu e-mail',
    tok_pisin: 'Plis checkum email bilong yu',
    indonesian: 'Silakan periksa email Anda',
    nepali: 'कृपया आफ्नो इमेल जाँच गर्नुहोस्',
    hindi: 'कृपया अपना ईमेल जांचें',
    burmese: 'သင်၏အီးမေးလ်ကို စစ်ဆေးပါ',
    thai: 'กรุณาตรวจสอบอีเมลของคุณ',
    mandarin: '请检查您的电子邮件'
  },
  checkEmailForResetLink: {
    english: 'Please check your email for the password reset link',
    spanish:
      'Por favor revise su correo electrónico para el enlace de restablecimiento de contraseña',
    brazilian_portuguese:
      'Por favor, verifique seu e-mail para o link de redefinição de senha',
    tok_pisin: 'Plis checkum email bilong yu long password reset link',
    indonesian: 'Silakan periksa email Anda untuk tautan reset kata sandi',
    nepali: 'कृपया पासवर्ड रिसेट लिंकको लागि आफ्नो इमेल जाँच गर्नुहोस्',
    hindi: 'कृपया पासवर्ड रीसेट लिंक के लिए अपना ईमेल जांचें',
    burmese: 'စကားဝှက်ပြန်လည်သတ်မှတ်ရန်လင့်ခ်အတွက် သင်၏အီးမေးလ်ကို စစ်ဆေးပါ',
    thai: 'กรุณาตรวจสอบอีเมลของคุณเพื่อลิงก์รีเซ็ตรหัสผ่าน',
    mandarin: '请检查您的电子邮件以获取密码重置链接'
  },
  confirmNewPassword: {
    english: 'Confirm New Password',
    spanish: 'Confirmar nueva contraseña',
    brazilian_portuguese: 'Confirmar Nova Senha',
    tok_pisin: 'Confirm nupela password',
    indonesian: 'Konfirmasi Kata Sandi Baru',
    nepali: 'नयाँ पासवर्ड पुष्टि गर्नुहोस्',
    hindi: 'नया पासवर्ड पुष्टि करें',
    burmese: 'စကားဝှက်အသစ်ကို အတည်ပြုပါ',
    thai: 'ยืนยันรหัสผ่านใหม่',
    mandarin: '确认新密码'
  },
  confirmPassword: {
    english: 'Confirm Password',
    spanish: 'Confirmar contraseña',
    brazilian_portuguese: 'Confirmar Senha',
    tok_pisin: 'Confirm password',
    indonesian: 'Konfirmasi Kata Sandi',
    nepali: 'पासवर्ड पुष्टि गर्नुहोस्',
    hindi: 'पासवर्ड पुष्टि करें',
    burmese: 'စကားဝှက်ကို အတည်ပြုပါ',
    thai: 'ยืนยันรหัสผ่าน',
    mandarin: '确认密码'
  },
  createObject: {
    english: 'Create',
    spanish: 'Crear',
    brazilian_portuguese: 'Criar',
    tok_pisin: 'Create',
    indonesian: 'Buat',
    nepali: 'सिर्जना गर्नुहोस्',
    hindi: 'बनाएं',
    burmese: 'ဖန်တီးပါ',
    thai: 'สร้าง',
    mandarin: '创建'
  },
  projectName: {
    english: 'Project Name',
    spanish: 'Nombre del Proyecto',
    brazilian_portuguese: 'Nome do Projeto',
    tok_pisin: 'Project Name',
    indonesian: 'Nama Proyek',
    nepali: 'प्रोजेक्टको नाम',
    hindi: 'परियोजना का नाम',
    burmese: 'စီမံကိန်းအမည်',
    thai: 'ชื่อโครงการ',
    mandarin: '项目名称'
  },
  newProject: {
    english: 'New Project',
    spanish: 'Nuevo Proyecto',
    brazilian_portuguese: 'Novo Projeto',
    tok_pisin: 'Nupela Project',
    indonesian: 'Proyek Baru',
    nepali: 'नयाँ प्रोजेक्ट',
    hindi: 'नई परियोजना',
    burmese: 'စီမံကိန်းအသစ်',
    thai: 'โครงการใหม่',
    mandarin: '新项目'
  },
  newQuest: {
    english: 'New Quest',
    nepali: 'नयाँ क्वेस्ट',
    hindi: 'नया क्वेस्ट',
    burmese: 'Quest အသစ်',
    thai: 'เควสต์ใหม่',
    mandarin: '新任务'
  },
  questName: {
    english: 'Quest Name',
    nepali: 'क्वेस्टको नाम',
    hindi: 'क्वेस्ट का नाम',
    burmese: 'Quest အမည်',
    thai: 'ชื่อเควสต์',
    mandarin: '任务名称'
  },
  description: {
    english: 'Description',
    spanish: 'Descripción',
    brazilian_portuguese: 'Descrição',
    tok_pisin: 'Description',
    indonesian: 'Deskripsi',
    nepali: 'विवरण',
    hindi: 'विवरण',
    burmese: 'ဖော်ပြချက်',
    thai: 'คำอธิบาย',
    mandarin: '描述'
  },
  visible: {
    english: 'Visible',
    spanish: 'Visible',
    brazilian_portuguese: 'Visible',
    tok_pisin: 'Visible',
    indonesian: 'Visible',
    nepali: 'देखिने',
    hindi: 'दृश्यमान',
    burmese: 'မြင်နိုင်သည်',
    thai: 'มองเห็นได้',
    mandarin: '可见'
  },
  private: {
    english: 'Private',
    spanish: 'Privado',
    brazilian_portuguese: 'Privado',
    tok_pisin: 'Private',
    indonesian: 'Private',
    nepali: 'निजी',
    hindi: 'निजी',
    burmese: 'ကိုယ်ပိုင်',
    thai: 'ส่วนตัว',
    mandarin: '私有'
  },
  date: {
    english: 'Date',
    spanish: 'Fecha',
    brazilian_portuguese: 'Data',
    tok_pisin: 'De',
    indonesian: 'Tanggal',
    nepali: 'मिति',
    hindi: 'तारीख',
    burmese: 'ရက်စွဲ',
    thai: 'วันที่',
    mandarin: '日期'
  },
  decline: {
    english: 'Decline',
    spanish: 'Rechazar',
    brazilian_portuguese: 'Rejeitar',
    tok_pisin: 'No',
    indonesian: 'Tolak',
    nepali: 'अस्वीकार गर्नुहोस्',
    hindi: 'अस्वीकार करें',
    burmese: 'ငြင်းဆိုပါ',
    thai: 'ปฏิเสธ',
    mandarin: '拒绝'
  },
  downloadAnyway: {
    english: 'Download Anyway',
    spanish: 'Descargar de todas formas',
    brazilian_portuguese: 'Descarregar de qualquer forma',
    tok_pisin: 'Download tasol',
    indonesian: 'Unduh Saja',
    nepali: 'जे भए पनि डाउनलोड गर्नुहोस्',
    hindi: 'वैसे भी डाउनलोड करें',
    burmese: 'ဘာပဲဖြစ်ဖြစ် ဒေါင်းလုဒ်လုပ်ပါ',
    thai: 'ดาวน์โหลดต่อไป',
    mandarin: '仍然下载'
  },
  downloadProject: {
    english: 'Download Project',
    spanish: 'Descargar Proyecto',
    brazilian_portuguese: 'Descarregar Projeto',
    tok_pisin: 'Download project',
    indonesian: 'Unduh Proyek',
    nepali: 'प्रोजेक्ट डाउनलोड गर्नुहोस्',
    hindi: 'परियोजना डाउनलोड करें',
    burmese: 'စီမံကိန်းကို ဒေါင်းလုဒ်လုပ်ပါ',
    thai: 'ดาวน์โหลดโครงการ',
    mandarin: '下载项目'
  },
  downloadQuest: {
    english: 'Download Quest',
    spanish: 'Descargar Quest',
    brazilian_portuguese: 'Descarregar Quest',
    nepali: 'क्वेस्ट डाउनलोड गर्नुहोस्',
    tok_pisin: 'Download quest',
    indonesian: 'Unduh Quest',
    hindi: 'क्वेस्ट डाउनलोड करें',
    burmese: 'Quest ကို ဒေါင်းလုဒ်လုပ်ပါ',
    thai: 'ดาวน์โหลดเควสต์',
    mandarin: '下载任务'
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
      'Jika Anda tidak mengunduh proyek, Anda tidak akan dapat berkontribusi secara offline. Anda dapat mengunduhnya nanti dengan menekan tombol unduh di kartu proyek.',
    nepali:
      'यदि तपाईंले प्रोजेक्ट डाउनलोड गर्नुभएन भने, तपाईं अफलाइन योगदान गर्न सक्षम हुनुहुने छैन। तपाईं पछि प्रोजेक्ट कार्डको डाउनलोड बटन थिचेर डाउनलोड गर्न सक्नुहुन्छ।',
    hindi:
      'यदि आप परियोजना डाउनलोड नहीं करते हैं, तो आप ऑफलाइन योगदान नहीं दे सकेंगे। आप बाद में परियोजना कार्ड के डाउनलोड बटन दबाकर इसे डाउनलोड कर सकते हैं।',
    burmese:
      'သင်သည် စီမံကိန်းကို ဒေါင်းလုဒ်မလုပ်ပါက၊ အင်တာနက်မရှိသောအချိန်တွင် ပံ့ပိုးမပေးနိုင်ပါ။ သင်သည် နောက်ပိုင်းတွင် စီမံကိန်းကတ်တွင် ဒေါင်းလုဒ်ခလုတ်ကို နှိပ်ခြင်းဖြင့် ဒေါင်းလုဒ်လုပ်နိုင်သည်။',
    thai: 'หากคุณไม่ดาวน์โหลดโครงการ คุณจะไม่สามารถมีส่วนร่วมแบบออฟไลน์ได้ คุณสามารถดาวน์โหลดได้ในภายหลังโดยกดปุ่มดาวน์โหลดบนการ์ดโครงการ',
    mandarin:
      '如果您不下载项目，您将无法离线贡献。您可以稍后通过按项目卡上的下载按钮来下载它。'
  },
  downloadProjectWhenRequestSent: {
    english: 'Download project when request is sent',
    spanish: 'Descargar proyecto cuando se envíe la solicitud',
    brazilian_portuguese: 'Baixar projeto quando a solicitação for enviada',
    tok_pisin: 'Download project taim request i go',
    indonesian: 'Unduh proyek saat permintaan dikirim',
    nepali: 'अनुरोध पठाइँदा प्रोजेक्ट डाउनलोड गर्नुहोस्',
    hindi: 'अनुरोध भेजे जाने पर परियोजना डाउनलोड करें',
    burmese: 'တောင်းဆိုမှုပို့သောအခါ စီမံကိန်းကို ဒေါင်းလုဒ်လုပ်ပါ',
    thai: 'ดาวน์โหลดโครงการเมื่อส่งคำขอ',
    mandarin: '发送请求时下载项目'
  },
  discoveringQuestData: {
    english: 'Discovering Quest Data',
    spanish: 'Descubriendo Datos de la Misión',
    brazilian_portuguese: 'Descobrindo Dados da Missão',
    tok_pisin: 'Painimaut long Quest Data',
    indonesian: 'Menemukan Data Quest',
    nepali: 'क्वेस्ट डाटा खोज्दै',
    hindi: 'क्वेस्ट डेटा खोज रहे हैं',
    burmese: 'Quest ဒေတာကို ရှာဖွေနေသည်',
    thai: 'กำลังค้นหาข้อมูลเควสต์',
    mandarin: '正在发现任务数据'
  },
  offloadQuest: {
    english: 'Offload Quest',
    spanish: 'Descargar Quest',
    brazilian_portuguese: 'Descarregar Quest',
    tok_pisin: 'Rausim Quest',
    indonesian: 'Lepas Quest',
    nepali: 'क्वेस्ट हटाउनुहोस्',
    hindi: 'क्वेस्ट अनलोड करें',
    burmese: 'Quest ကို ဖယ်ရှားပါ',
    thai: 'ถอดเควสต์',
    mandarin: '卸载任务'
  },
  offloadQuestDescription: {
    english: 'Remove local data to free up storage',
    spanish: 'Eliminar datos locales para liberar almacenamiento',
    brazilian_portuguese: 'Remover dados locais para liberar armazenamento',
    tok_pisin: 'Rausim data long freeup storage',
    indonesian: 'Hapus data lokal untuk membebaskan penyimpanan',
    nepali: 'भण्डारण खाली गर्न स्थानीय डाटा हटाउनुहोस्',
    hindi: 'भंडारण खाली करने के लिए स्थानीय डेटा हटाएं',
    burmese: 'သိုလှောင်မှုကို လွတ်လပ်စေရန် ဒေသတွင်းဒေတာကို ဖယ်ရှားပါ',
    thai: 'ลบข้อมูลท้องถิ่นเพื่อเพิ่มพื้นที่เก็บข้อมูล',
    mandarin: '删除本地数据以释放存储空间'
  },
  verifyingCloudData: {
    english: 'Verifying data in cloud...',
    spanish: 'Verificando datos en la nube...',
    brazilian_portuguese: 'Verificando dados na nuvem...',
    tok_pisin: 'Checkim data long klaud...',
    indonesian: 'Memverifikasi data di cloud...',
    nepali: 'क्लाउडमा डाटा प्रमाणित गर्दै...',
    hindi: 'क्लाउड में डेटा सत्यापित कर रहे हैं...',
    burmese: 'cloud တွင် ဒေတာကို အတည်ပြုနေသည်...',
    thai: 'กำลังตรวจสอบข้อมูลในคลาวด์...',
    mandarin: '正在验证云端数据...'
  },
  pendingUploadsDetected: {
    english: 'Pending uploads detected',
    spanish: 'Se detectaron cargas pendientes',
    brazilian_portuguese: 'Uploads pendentes detectados',
    tok_pisin: 'Painimaut sampela hap i no go yet',
    indonesian: 'Mendeteksi upload tertunda',
    nepali: 'बाँकी अपलोडहरू पत्ता लाग्यो',
    hindi: 'लंबित अपलोड का पता चला',
    burmese: 'ဆိုင်းငံ့ထားသော အပ်လုဒ်များကို ရှာဖွေတွေ့ရှိသည်',
    thai: 'ตรวจพบการอัปโหลดที่รอดำเนินการ',
    mandarin: '检测到待上传'
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
      'Harap tunggu semua perubahan terupload ke cloud sebelum melepas. Sambungkan ke internet dan tunggu sinkronisasi selesai.',
    nepali:
      'कृपया हटाउनु अघि सबै परिवर्तनहरू क्लाउडमा अपलोड हुनको लागि पर्खनुहोस्। इन्टरनेटमा जडान गर्नुहोस् र सिङ्क पूरा हुनको लागि पर्खनुहोस्।',
    hindi:
      'कृपया अनलोड करने से पहले सभी परिवर्तनों के क्लाउड में अपलोड होने की प्रतीक्षा करें। इंटरनेट से कनेक्ट करें और सिंक पूरा होने की प्रतीक्षा करें।',
    burmese:
      'ဖယ်ရှားမီ cloud သို့ အပြောင်းအလဲအားလုံး အပ်လုဒ်လုပ်ရန် စောင့်ပါ။ အင်တာနက်သို့ ချိတ်ဆက်ပြီး sync ပြီးမြောက်သည်အထိ စောင့်ပါ။',
    thai: 'กรุณารอให้การเปลี่ยนแปลงทั้งหมดอัปโหลดไปยังคลาวด์ก่อนถอดออก เชื่อมต่ออินเทอร์เน็ตและรอให้การซิงค์เสร็จสมบูรณ์',
    mandarin: '请在卸载前等待所有更改上传到云端。连接到互联网并等待同步完成。'
  },
  readyToOffload: {
    english: 'Ready to offload',
    spanish: 'Listo para descargar',
    brazilian_portuguese: 'Pronto para descarregar',
    tok_pisin: 'Redi long rausim',
    indonesian: 'Siap untuk melepas',
    nepali: 'हटाउन तयार',
    hindi: 'अनलोड करने के लिए तैयार',
    burmese: 'ဖယ်ရှားရန် အဆင်သင့်',
    thai: 'พร้อมถอดออก',
    mandarin: '准备卸载'
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
      'Ini akan menghapus salinan lokal. Data akan tetap aman di cloud dan dapat diunduh kembali nanti.',
    nepali:
      'यसले स्थानीय प्रतिलिपिहरू मेट्नेछ। डाटा क्लाउडमा सुरक्षित रहनेछ र पछि पुन: डाउनलोड गर्न सकिन्छ।',
    hindi:
      'यह स्थानीय प्रतियां हटा देगा। डेटा क्लाउड में सुरक्षित रहेगा और बाद में फिर से डाउनलोड किया जा सकता है।',
    burmese:
      '၎င်းသည် ဒေသတွင်းမိတ္တူများကို ဖျက်ပါမည်။ ဒေတာသည် cloud တွင် ဘေးကင်းစွာ ရှိနေပြီး နောက်ပိုင်းတွင် ပြန်လည်ဒေါင်းလုဒ်လုပ်နိုင်သည်။',
    thai: 'การดำเนินการนี้จะลบสำเนาท้องถิ่น ข้อมูลจะยังคงปลอดภัยในคลาวด์และสามารถดาวน์โหลดใหม่ได้ในภายหลัง',
    mandarin: '这将删除本地副本。数据将安全地保留在云端，稍后可以重新下载。'
  },
  storageToFree: {
    english: 'Storage to Free',
    spanish: 'Almacenamiento para Liberar',
    brazilian_portuguese: 'Armazenamento a Liberar',
    tok_pisin: 'Storage Long Freeup',
    indonesian: 'Penyimpanan yang Dibebaskan',
    nepali: 'खाली गर्ने भण्डारण',
    hindi: 'मुक्त करने के लिए भंडारण',
    burmese: 'လွတ်လပ်စေရန် သိုလှောင်မှု',
    thai: 'พื้นที่เก็บข้อมูลที่จะปล่อย',
    mandarin: '要释放的存储空间'
  },
  continue: {
    english: 'Continue',
    spanish: 'Continuar',
    brazilian_portuguese: 'Continuar',
    tok_pisin: 'Go Het',
    indonesian: 'Lanjutkan',
    nepali: 'जारी राख्नुहोस्',
    hindi: 'जारी रखें',
    burmese: 'ဆက်လုပ်ပါ',
    thai: 'ดำเนินการต่อ',
    mandarin: '继续'
  },
  continueToOffload: {
    english: 'Offload from Device',
    spanish: 'Descargar del Dispositivo',
    brazilian_portuguese: 'Descarregar do Dispositivo',
    tok_pisin: 'Rausim long Mashin',
    indonesian: 'Lepas dari Perangkat',
    nepali: 'उपकरणबाट हटाउनुहोस्',
    hindi: 'डिवाइस से अनलोड करें',
    burmese: 'စက်ပစ္စည်းမှ ဖယ်ရှားပါ',
    thai: 'ถอดออกจากอุปกรณ์',
    mandarin: '从设备卸载'
  },
  offloadingQuest: {
    english: 'Offloading quest...',
    spanish: 'Descargando quest...',
    brazilian_portuguese: 'Descarregando quest...',
    tok_pisin: 'Rausim quest...',
    indonesian: 'Melepas quest...',
    nepali: 'क्वेस्ट हटाउँदै...',
    hindi: 'क्वेस्ट अनलोड कर रहे हैं...',
    burmese: 'Quest ကို ဖယ်ရှားနေသည်...',
    thai: 'กำลังถอดเควสต์...',
    mandarin: '正在卸载任务...'
  },
  offloadComplete: {
    english: 'Quest offloaded successfully',
    spanish: 'Quest descargada con éxito',
    brazilian_portuguese: 'Quest descarregada com sucesso',
    tok_pisin: 'Quest i rausim orait',
    indonesian: 'Quest berhasil dilepas',
    nepali: 'क्वेस्ट सफलतापूर्वक हटाइयो',
    hindi: 'क्वेस्ट सफलतापूर्वक अनलोड हो गया',
    burmese: 'Quest ကို အောင်မြင်စွာ ဖယ်ရှားပြီးပါပြီ',
    thai: 'ถอดเควสต์สำเร็จ',
    mandarin: '任务卸载成功'
  },
  offloadError: {
    english: 'Failed to offload quest',
    spanish: 'Error al descargar quest',
    brazilian_portuguese: 'Falha ao descarregar quest',
    tok_pisin: 'Pasin long rausim quest i no inap',
    indonesian: 'Gagal melepas quest',
    nepali: 'क्वेस्ट हटाउन असफल',
    hindi: 'क्वेस्ट अनलोड करने में विफल',
    burmese: 'Quest ကို ဖယ်ရှားရန် မအောင်မြင်ပါ',
    thai: 'ถอดเควสต์ไม่สำเร็จ',
    mandarin: '卸载任务失败'
  },
  cannotOffloadErrors: {
    english: 'Cannot offload - errors detected',
    spanish: 'No se puede descargar - errores detectados',
    brazilian_portuguese: 'Não é possível descarregar - erros detectados',
    tok_pisin: 'No inap rausim - painimaut sampela rong',
    indonesian: 'Tidak dapat melepas - kesalahan terdeteksi',
    nepali: 'हटाउन सकिँदैन - त्रुटिहरू पत्ता लाग्यो',
    hindi: 'अनलोड नहीं कर सकते - त्रुटियां पाई गईं',
    burmese: 'ဖယ်ရှား၍မရပါ - အမှားများကို ရှာဖွေတွေ့ရှိသည်',
    thai: 'ไม่สามารถถอดออกได้ - ตรวจพบข้อผิดพลาด',
    mandarin: '无法卸载 - 检测到错误'
  },
  allDataVerifiedInCloud: {
    english: 'All data verified in cloud',
    spanish: 'Todos los datos verificados en la nube',
    brazilian_portuguese: 'Todos os dados verificados na nuvem',
    tok_pisin: 'Olgeta data i stret long klaud',
    indonesian: 'Semua data terverifikasi di cloud',
    nepali: 'सबै डाटा क्लाउडमा प्रमाणित',
    hindi: 'सभी डेटा क्लाउड में सत्यापित',
    burmese: 'cloud တွင် ဒေတာအားလုံး အတည်ပြုပြီးပါပြီ',
    thai: 'ข้อมูลทั้งหมดได้รับการยืนยันในคลาวด์',
    mandarin: '所有数据已在云端验证'
  },
  checkingPendingChanges: {
    english: 'Checking for pending changes...',
    spanish: 'Verificando cambios pendientes...',
    brazilian_portuguese: 'Verificando alterações pendentes...',
    tok_pisin: 'Checkim sampela senis i no go yet...',
    indonesian: 'Memeriksa perubahan tertunda...',
    nepali: 'बाँकी परिवर्तनहरू जाँच गर्दै...',
    hindi: 'लंबित परिवर्तनों की जांच कर रहे हैं...',
    burmese: 'ဆိုင်းငံ့ထားသော အပြောင်းအလဲများကို စစ်ဆေးနေသည်...',
    thai: 'กำลังตรวจสอบการเปลี่ยนแปลงที่รอดำเนินการ...',
    mandarin: '正在检查待处理的更改...'
  },
  verifyingDatabaseRecords: {
    english: 'Verifying database records',
    spanish: 'Verificando registros de base de datos',
    brazilian_portuguese: 'Verificando registros do banco de dados',
    tok_pisin: 'Checkim ol rekod long database',
    indonesian: 'Memverifikasi catatan database',
    nepali: 'डाटाबेस रेकर्डहरू प्रमाणित गर्दै',
    hindi: 'डेटाबेस रिकॉर्ड सत्यापित कर रहे हैं',
    burmese: 'ဒေတာဘေ့စ်မှတ်တမ်းများကို အတည်ပြုနေသည်',
    thai: 'กำลังตรวจสอบบันทึกฐานข้อมูล',
    mandarin: '正在验证数据库记录'
  },
  verifyingAttachments: {
    english: 'Verifying attachments',
    spanish: 'Verificando archivos adjuntos',
    brazilian_portuguese: 'Verificando anexos',
    tok_pisin: 'Checkim ol fail i pas long',
    indonesian: 'Memverifikasi lampiran',
    nepali: 'संलग्नकहरू प्रमाणित गर्दै',
    hindi: 'संलग्नक सत्यापित कर रहे हैं',
    burmese: 'ပူးတွဲဖိုင်များကို အတည်ပြုနေသည်',
    thai: 'กำลังตรวจสอบไฟล์แนบ',
    mandarin: '正在验证附件'
  },
  waitingForUploads: {
    english: 'Waiting for Uploads',
    spanish: 'Esperando Cargas',
    brazilian_portuguese: 'Aguardando Uploads',
    tok_pisin: 'Wetim Upload',
    indonesian: 'Menunggu Upload',
    nepali: 'अपलोडहरूको लागि पर्खँदै',
    hindi: 'अपलोड की प्रतीक्षा कर रहे हैं',
    burmese: 'အပ်လုဒ်များအတွက် စောင့်ဆိုင်းနေသည်',
    thai: 'กำลังรอการอัปโหลด',
    mandarin: '等待上传'
  },
  cannotOffload: {
    english: 'Cannot Offload',
    spanish: 'No se puede Descargar',
    brazilian_portuguese: 'Não é possível Descarregar',
    tok_pisin: 'No Inap Rausim',
    indonesian: 'Tidak dapat Melepas',
    nepali: 'हटाउन सकिँदैन',
    hindi: 'अनलोड नहीं कर सकते',
    burmese: 'ဖယ်ရှား၍မရပါ',
    thai: 'ไม่สามารถถอดออกได้',
    mandarin: '无法卸载'
  },
  analyzingRelatedRecords: {
    english: 'Analyzing related records...',
    spanish: 'Analizando registros relacionados...',
    brazilian_portuguese: 'Analisando registros relacionados...',
    tok_pisin: 'Lukautim ol related records...',
    indonesian: 'Menganalisis catatan terkait...',
    nepali: 'सम्बन्धित रेकर्डहरू विश्लेषण गर्दै...',
    hindi: 'संबंधित रिकॉर्ड का विश्लेषण कर रहे हैं...',
    burmese: 'ဆက်စပ်သော မှတ်တမ်းများကို ခွဲခြမ်းစိတ်ဖြာနေသည်...',
    thai: 'กำลังวิเคราะห์บันทึกที่เกี่ยวข้อง...',
    mandarin: '正在分析相关记录...'
  },
  discoveryComplete: {
    english: 'Discovery complete',
    spanish: 'Descubrimiento completo',
    brazilian_portuguese: 'Descoberta completa',
    tok_pisin: 'Discovery i pinis',
    indonesian: 'Penemuan selesai',
    nepali: 'खोज पूरा भयो',
    hindi: 'खोज पूर्ण',
    burmese: 'ရှာဖွေမှု ပြီးမြောက်ပါပြီ',
    thai: 'การค้นพบเสร็จสมบูรณ์',
    mandarin: '发现完成'
  },
  totalRecords: {
    english: 'Total Records',
    spanish: 'Registros Totales',
    brazilian_portuguese: 'Registros Totais',
    tok_pisin: 'Total Records',
    indonesian: 'Total Catatan',
    nepali: 'कुल रेकर्डहरू',
    hindi: 'कुल रिकॉर्ड',
    burmese: 'စုစုပေါင်း မှတ်တမ်းများ',
    thai: 'บันทึกทั้งหมด',
    mandarin: '总记录数'
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
      'Beberapa kesalahan terjadi selama penemuan. Anda masih dapat mengunduh catatan yang ditemukan.',
    nepali:
      'खोजको क्रममा केही त्रुटिहरू भए। तपाईं अझै पनि खोजिएका रेकर्डहरू डाउनलोड गर्न सक्नुहुन्छ।',
    hindi:
      'खोज के दौरान कुछ त्रुटियां हुईं। आप अभी भी खोजे गए रिकॉर्ड डाउनलोड कर सकते हैं।',
    burmese:
      'ရှာဖွေမှုအတွင်း အမှားအချို့ ဖြစ်ပွားခဲ့သည်။ သင်သည် ရှာဖွေတွေ့ရှိထားသော မှတ်တမ်းများကို ဆက်လက် ဒေါင်းလုဒ်လုပ်နိုင်ပါသည်။',
    thai: 'เกิดข้อผิดพลาดบางอย่างระหว่างการค้นพบ คุณยังสามารถดาวน์โหลดบันทึกที่ค้นพบได้',
    mandarin: '发现过程中发生了一些错误。您仍然可以下载已发现的记录。'
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
      'Quest tidak ditemukan di basis data cloud. Mungkin hanya ada secara lokal atau Anda tidak memiliki izin untuk mengaksesnya. Silakan muat ulang halaman atau hubungi dukungan jika masalah ini tetap terjadi.',
    nepali:
      'क्लाउड डाटाबेसमा क्वेस्ट फेला परेन। यो स्थानीय रूपमा मात्र अवस्थित हुन सक्छ वा तपाईंसँग यसमा पहुँच गर्ने अनुमति नहुन सक्छ। पृष्ठ रिफ्रेश गर्नुहोस् वा यो समस्या जारी रहेमा समर्थनलाई सम्पर्क गर्नुहोस्।',
    hindi:
      'क्लाउड डेटाबेस में क्वेस्ट नहीं मिला। यह केवल स्थानीय रूप से मौजूद हो सकता है या आपके पास इसे एक्सेस करने की अनुमति नहीं हो सकती है। पृष्ठ को रीफ्रेश करने का प्रयास करें या यदि यह समस्या बनी रहती है तो सपोर्ट से संपर्क करें।',
    burmese:
      'cloud ဒေတာဘေ့စ်တွင် Quest ကို မတွေ့ရှိပါ။ ၎င်းသည် ဒေသတွင်းတွင်သာ တည်ရှိနိုင်ပြီး သို့မဟုတ် သင်တွင် ၎င်းကို ဝင်ရောက်ခွင့် မရှိနိုင်ပါ။ စာမျက်နှာကို ပြန်လည်စတင်ရန် ကြိုးစားပါ သို့မဟုတ် ဤပြဿနာ ဆက်ရှိနေပါက အကူအညီကို ဆက်သွယ်ပါ။',
    thai: 'ไม่พบเควสต์ในฐานข้อมูลคลาวด์ อาจมีอยู่เฉพาะในเครื่องหรือคุณอาจไม่มีสิทธิ์เข้าถึง ลองรีเฟรชหน้าเว็บหรือติดต่อฝ่ายสนับสนุนหากปัญหานี้ยังคงอยู่',
    mandarin:
      '在云端数据库中未找到任务。它可能仅存在于本地，或者您可能没有访问权限。请尝试刷新页面，如果问题持续存在，请联系支持。'
  },
  discovering: {
    english: 'Discovering...',
    spanish: 'Descubriendo...',
    brazilian_portuguese: 'Descobrindo...',
    tok_pisin: 'Painimaut...',
    indonesian: 'Menemukan...',
    nepali: 'खोज्दै...',
    hindi: 'खोज रहे हैं...',
    burmese: 'ရှာဖွေနေသည်...',
    thai: 'กำลังค้นหา...',
    mandarin: '正在发现...'
  },
  continueToDownload: {
    english: 'Continue to Download',
    spanish: 'Continuar con la Descarga',
    brazilian_portuguese: 'Continuar para Download',
    tok_pisin: 'Go het long Download',
    indonesian: 'Lanjutkan ke Unduhan',
    nepali: 'डाउनलोडमा जारी राख्नुहोस्',
    hindi: 'डाउनलोड जारी रखें',
    burmese: 'ဒေါင်းလုဒ်လုပ်ရန် ဆက်လုပ်ပါ',
    thai: 'ดำเนินการดาวน์โหลดต่อ',
    mandarin: '继续下载'
  },
  email: {
    english: 'Email',
    spanish: 'Email',
    brazilian_portuguese: 'E-mail',
    tok_pisin: 'Email',
    indonesian: 'Email',
    nepali: 'इमेल',
    hindi: 'ईमेल',
    burmese: 'အီးမေးလ်',
    thai: 'อีเมล',
    mandarin: '电子邮件'
  },
  emailAlreadyMemberMessage: {
    english: 'This email address is already a {role} of this project.',
    spanish:
      'Esta dirección de correo electrónico ya es {role} de este proyecto.',
    brazilian_portuguese: 'Este endereço de e-mail já é {role} deste projeto.',
    tok_pisin: 'Dispela email adres i {role} pinis long dispela project.',
    indonesian: 'Alamat email ini sudah menjadi {role} dari proyek ini.',
    nepali: 'यो इमेल ठेगाना पहिले नै यस प्रोजेक्टको {role} हो।',
    hindi: 'यह ईमेल पता पहले से ही इस परियोजना का {role} है।',
    burmese: 'ဤအီးမေးလ်လိပ်စာသည် ဤစီမံကိန်း၏ {role} ဖြစ်ပြီးသားဖြစ်သည်။',
    thai: 'ที่อยู่อีเมลนี้เป็น {role} ของโครงการนี้อยู่แล้ว',
    mandarin: '此电子邮件地址已经是此项目的 {role}。'
  },
  emailRequired: {
    english: 'Email is required',
    spanish: 'Se requiere email',
    brazilian_portuguese: 'E-mail é obrigatório',
    tok_pisin: 'Email i mas',
    indonesian: 'Email diperlukan',
    nepali: 'इमेल आवश्यक छ',
    hindi: 'ईमेल आवश्यक है',
    burmese: 'အီးမေးလ် လိုအပ်ပါသည်',
    thai: 'ต้องใช้อีเมล',
    mandarin: '需要电子邮件'
  },
  nameRequired: {
    english: 'Name is required',
    spanish: 'Nombre es requerido',
    brazilian_portuguese: 'Nome é obrigatório',
    tok_pisin: 'Name i mas',
    indonesian: 'Nama diperlukan',
    nepali: 'नाम आवश्यक छ',
    hindi: 'नाम आवश्यक है',
    burmese: 'အမည် လိုအပ်ပါသည်',
    thai: 'ต้องใช้ชื่อ',
    mandarin: '需要姓名'
  },
  descriptionTooLong: {
    english: 'Description must be less than {max} characters',
    spanish: 'La descripción debe tener menos de {max} caracteres',
    brazilian_portuguese: 'A descrição deve ter menos de {max} caracteres',
    tok_pisin: 'Description i no sem long {max} character',
    indonesian: 'Deskripsi harus kurang dari {max} karakter',
    nepali: 'विवरण {max} अक्षरभन्दा कम हुनुपर्छ',
    hindi: 'विवरण {max} अक्षरों से कम होना चाहिए',
    burmese: 'ဖော်ပြချက်သည် {max} စာလုံးထက် နည်းရမည်',
    thai: 'คำอธิบายต้องน้อยกว่า {max} ตัวอักษร',
    mandarin: '描述必须少于 {max} 个字符'
  },
  enterTranslation: {
    english: 'Enter your translation here',
    spanish: 'Ingrese su traducción aquí',
    brazilian_portuguese: 'Digite sua tradução aqui',
    tok_pisin: 'Putim translation bilong yu long hia',
    indonesian: 'Masukkan terjemahan Anda di sini',
    nepali: 'यहाँ आफ्नो अनुवाद प्रविष्ट गर्नुहोस्',
    hindi: 'यहाँ अपना अनुवाद दर्ज करें',
    burmese: 'သင်၏ ဘာသာပြန်ဆိုချက်ကို ဤနေရာတွင် ထည့်သွင်းပါ',
    thai: 'ป้อนคำแปลของคุณที่นี่',
    mandarin: '在此输入您的翻译'
  },
  enterTranscription: {
    english: 'Enter your transcription here',
    spanish: 'Ingrese su transcripción aquí',
    brazilian_portuguese: 'Digite sua transcrição aqui',
    tok_pisin: 'Putim transcription bilong yu long hia',
    indonesian: 'Masukkan transkripsi Anda di sini',
    nepali: 'यहाँ आफ्नो ट्रान्सक्रिप्सन प्रविष्ट गर्नुहोस्',
    hindi: 'यहाँ अपना ट्रांसक्रिप्शन दर्ज करें',
    burmese: 'သင်၏ စာလုံးပေါင်းကို ဤနေရာတွင် ထည့်သွင်းပါ',
    thai: 'ป้อนการถอดความของคุณที่นี่',
    mandarin: '在此输入您的转录'
  },
  enterYourTranscriptionIn: {
    english: 'Enter your transcription in {language}',
    spanish: 'Ingrese su transcripción en {language}',
    brazilian_portuguese: 'Digite sua transcrição em {language}',
    tok_pisin: 'Putim transcription bilong yu long {language}',
    indonesian: 'Masukkan transkripsi Anda dalam {language}',
    nepali: '{language} मा आफ्नो ट्रान्सक्रिप्सन प्रविष्ट गर्नुहोस्',
    hindi: '{language} में अपना ट्रांसक्रिप्शन दर्ज करें',
    burmese: '{language} တွင် သင်၏ စာလုံးပေါင်းကို ထည့်သွင်းပါ',
    thai: 'ป้อนการถอดความของคุณใน {language}',
    mandarin: '用 {language} 输入您的转录'
  },
  enterValidEmail: {
    english: 'Please enter a valid email',
    spanish: 'Por favor ingrese un correo electrónico válido',
    brazilian_portuguese: 'Por favor, digite um e-mail válido',
    tok_pisin: 'Plis putim wanpela gutpela email',
    indonesian: 'Silakan masukkan email yang valid',
    nepali: 'कृपया मान्य इमेल प्रविष्ट गर्नुहोस्',
    hindi: 'कृपया एक वैध ईमेल दर्ज करें',
    burmese: 'ကျေးဇူးပြု၍ တရားဝင် အီးမေးလ်တစ်ခုကို ထည့်သွင်းပါ',
    thai: 'กรุณาป้อนอีเมลที่ถูกต้อง',
    mandarin: '请输入有效的电子邮件'
  },
  enterYourEmail: {
    english: 'Enter your email',
    spanish: 'Ingrese su correo electrónico',
    brazilian_portuguese: 'Digite seu e-mail',
    tok_pisin: 'Putim email bilong yu',
    indonesian: 'Masukkan email Anda',
    nepali: 'आफ्नो इमेल प्रविष्ट गर्नुहोस्',
    hindi: 'अपना ईमेल दर्ज करें',
    burmese: 'သင်၏ အီးမေးလ်ကို ထည့်သွင်းပါ',
    thai: 'ป้อนอีเมลของคุณ',
    mandarin: '输入您的电子邮件'
  },
  enterYourPassword: {
    english: 'Enter your password',
    spanish: 'Ingrese su contraseña',
    brazilian_portuguese: 'Digite sua senha',
    tok_pisin: 'Putim password bilong yu',
    indonesian: 'Masukkan kata sandi Anda',
    nepali: 'आफ्नो पासवर्ड प्रविष्ट गर्नुहोस्',
    hindi: 'अपना पासवर्ड दर्ज करें',
    burmese: 'သင်၏ စကားဝှက်ကို ထည့်သွင်းပါ',
    thai: 'ป้อนรหัสผ่านของคุณ',
    mandarin: '输入您的密码'
  },
  error: {
    english: 'Error',
    spanish: 'Error',
    brazilian_portuguese: 'Erro',
    tok_pisin: 'Rong',
    indonesian: 'Kesalahan',
    nepali: 'त्रुटि',
    hindi: 'त्रुटि',
    burmese: 'အမှား',
    thai: 'ข้อผิดพลาด',
    mandarin: '错误'
  },
  failedCreateTranslation: {
    english: 'Failed to create translation',
    spanish: 'Error al crear la traducción',
    brazilian_portuguese: 'Falha ao criar tradução',
    tok_pisin: 'I no inap mekim translation',
    indonesian: 'Gagal membuat terjemahan',
    nepali: 'अनुवाद सिर्जना गर्न असफल',
    hindi: 'अनुवाद बनाने में विफल',
    burmese: 'ဘာသာပြန်ဆိုချက်ကို ဖန်တီး၍မရပါ',
    thai: 'สร้างคำแปลไม่สำเร็จ',
    mandarin: '创建翻译失败'
  },
  failedCreateTranscription: {
    english: 'Failed to create transcription',
    spanish: 'Error al crear la transcripción',
    brazilian_portuguese: 'Falha ao criar transcrição',
    tok_pisin: 'I no inap mekim transcription',
    indonesian: 'Gagal membuat transkripsi',
    nepali: 'ट्रान्सक्रिप्सन सिर्जना गर्न असफल',
    hindi: 'ट्रांसक्रिप्शन बनाने में विफल',
    burmese: 'စာလုံးပေါင်းကို ဖန်တီး၍မရပါ',
    thai: 'สร้างการถอดความไม่สำเร็จ',
    mandarin: '创建转录失败'
  },
  failedLoadProjects: {
    english: 'Failed to load projects',
    spanish: 'Error al cargar proyectos',
    brazilian_portuguese: 'Falha ao carregar projetos',
    tok_pisin: 'I no inap loadim ol project',
    indonesian: 'Gagal memuat proyek',
    nepali: 'प्रोजेक्टहरू लोड गर्न असफल',
    hindi: 'परियोजनाएं लोड करने में विफल',
    burmese: 'စီမံကိန်းများကို လုပ်ဆောင်၍မရပါ',
    thai: 'โหลดโครงการไม่สำเร็จ',
    mandarin: '加载项目失败'
  },
  failedLoadQuests: {
    english: 'Failed to load quests',
    spanish: 'Error al cargar misiones',
    brazilian_portuguese: 'Falha ao carregar missões',
    tok_pisin: 'I no inap loadim ol quest',
    indonesian: 'Gagal memuat misi',
    nepali: 'क्वेस्टहरू लोड गर्न असफल',
    hindi: 'क्वेस्ट लोड करने में विफल',
    burmese: 'Quest များကို လုပ်ဆောင်၍မရပါ',
    thai: 'โหลดเควสต์ไม่สำเร็จ',
    mandarin: '加载任务失败'
  },
  failedResetPassword: {
    english: 'Failed to reset password',
    spanish: 'Error al restablecer la contraseña',
    brazilian_portuguese: 'Falha ao redefinir senha',
    tok_pisin: 'I no inap resetim password',
    indonesian: 'Gagal mereset kata sandi',
    nepali: 'पासवर्ड रिसेट गर्न असफल',
    hindi: 'पासवर्ड रीसेट करने में विफल',
    burmese: 'စကားဝှက်ကို ပြန်လည်သတ်မှတ်၍မရပါ',
    thai: 'รีเซ็ตรหัสผ่านไม่สำเร็จ',
    mandarin: '重置密码失败'
  },
  failedSendResetEmail: {
    english: 'Failed to send reset email',
    spanish: 'Error al enviar el correo de restablecimiento',
    brazilian_portuguese: 'Falha ao enviar e-mail de redefinição',
    tok_pisin: 'I no inap salim reset email',
    indonesian: 'Gagal mengirim email reset',
    nepali: 'रिसेट इमेल पठाउन असफल',
    hindi: 'रीसेट ईमेल भेजने में विफल',
    burmese: 'ပြန်လည်သတ်မှတ်ရန် အီးမေးလ်ပို့၍မရပါ',
    thai: 'ส่งอีเมลรีเซ็ตไม่สำเร็จ',
    mandarin: '发送重置电子邮件失败'
  },
  failedToAcceptInvitation: {
    english: 'Failed to accept invitation. Please try again.',
    spanish: 'Error al aceptar la invitación. Por favor, inténtelo de nuevo.',
    brazilian_portuguese:
      'Falha ao aceitar o convite. Por favor, tente novamente.',
    tok_pisin: 'I no inap akseptim invitation. Plis traim gen.',
    indonesian: 'Gagal menerima undangan. Silakan coba lagi.',
    nepali: 'आमन्त्रण स्वीकार गर्न असफल। कृपया फेरि प्रयास गर्नुहोस्।',
    hindi: 'आमंत्रण स्वीकार करने में विफल। कृपया पुनः प्रयास करें।',
    burmese: 'ဖိတ်ခေါ်မှုကို လက်ခံ၍မရပါ။ ကျေးဇူးပြု၍ ထပ်မံကြိုးစားပါ။',
    thai: 'ยอมรับคำเชิญไม่สำเร็จ กรุณาลองอีกครั้ง',
    mandarin: '接受邀请失败。请重试。'
  },
  failedToDeclineInvitation: {
    english: 'Failed to decline invitation. Please try again.',
    spanish: 'Error al rechazar la invitación. Por favor, inténtelo de nuevo.',
    brazilian_portuguese:
      'Falha ao recusar o convite. Por favor, tente novamente.',
    tok_pisin: 'I no inap refusim invitation. Plis traim gen.',
    indonesian: 'Gagal menolak undangan. Silakan coba lagi.',
    nepali: 'आमन्त्रण अस्वीकार गर्न असफल। कृपया फेरि प्रयास गर्नुहोस्।',
    hindi: 'आमंत्रण अस्वीकार करने में विफल। कृपया पुनः प्रयास करें।',
    burmese: 'ဖိတ်ခေါ်မှုကို ငြင်းဆို၍မရပါ။ ကျေးဇူးပြု၍ ထပ်မံကြိုးစားပါ။',
    thai: 'ปฏิเสธคำเชิญไม่สำเร็จ กรุณาลองอีกครั้ง',
    mandarin: '拒绝邀请失败。请重试。'
  },
  failedToVote: {
    english: 'Failed to submit vote',
    spanish: 'Error al enviar el voto',
    brazilian_portuguese: 'Falha ao enviar voto',
    tok_pisin: 'I no inap salim vote',
    indonesian: 'Gagal mengirim suara',
    nepali: 'मत पेश गर्न असफल',
    hindi: 'मत जमा करने में विफल',
    burmese: 'မဲပေးရန် မအောင်မြင်ပါ',
    thai: 'ส่งคะแนนไม่สำเร็จ',
    mandarin: '提交投票失败'
  },
  fillFields: {
    english: 'Please fill in all required fields',
    spanish: 'Por favor complete todos los campos requeridos',
    brazilian_portuguese: 'Por favor, preencha todos os campos obrigatórios',
    tok_pisin: 'Plis fulupim olgeta field i mas',
    indonesian: 'Silakan isi semua bidang yang diperlukan',
    nepali: 'कृपया सबै आवश्यक फिल्डहरू भर्नुहोस्',
    hindi: 'कृपया सभी आवश्यक फ़ील्ड भरें',
    burmese: 'ကျေးဇူးပြု၍ လိုအပ်သော အကွက်အားလုံးကို ဖြည့်ပါ',
    thai: 'กรุณากรอกข้อมูลในช่องที่จำเป็นทั้งหมด',
    mandarin: '请填写所有必填字段'
  },
  forgotPassword: {
    english: 'I forgot my password',
    spanish: 'Olvidé mi contraseña',
    brazilian_portuguese: 'Esqueci minha senha',
    tok_pisin: 'Mi lusim password bilong mi',
    indonesian: 'Saya lupa kata sandi saya',
    nepali: 'मैले पासवर्ड बिर्सेँ',
    hindi: 'मैंने अपना पासवर्ड भूल गया',
    burmese: 'ကျွန်ုပ်၏ စကားဝှက်ကို မေ့သွားပါသည်',
    thai: 'ฉันลืมรหัสผ่าน',
    mandarin: '我忘记了密码'
  },
  invalidResetLink: {
    english: 'Invalid or expired reset link',
    spanish: 'Enlace de restablecimiento inválido o expirado',
    brazilian_portuguese: 'Link de redefinição inválido ou expirado',
    tok_pisin: 'Reset link i no gutpela o i pinis',
    indonesian: 'Tautan reset tidak valid atau kedaluwarsa',
    nepali: 'अमान्य वा समाप्त रिसेट लिंक',
    hindi: 'अमान्य या समाप्त रीसेट लिंक',
    burmese:
      'မမှန်ကန်သော သို့မဟုတ် သက်တမ်းကုန်ဆုံးသော ပြန်လည်သတ်မှတ်ရန် လင့်ခ်',
    thai: 'ลิงก์รีเซ็ตไม่ถูกต้องหรือหมดอายุ',
    mandarin: '无效或已过期的重置链接'
  },
  logInToTranslate: {
    english: 'You must be logged in to submit translations',
    spanish: 'Debe iniciar sesión para enviar traducciones',
    brazilian_portuguese: 'Você precisa estar logado para enviar traduções',
    tok_pisin: 'Yu mas login pastaim long salim ol translation',
    indonesian: 'Anda harus masuk untuk mengirim terjemahan',
    nepali: 'अनुवादहरू पेश गर्न तपाईं लग इन हुनुपर्छ',
    hindi: 'अनुवाद जमा करने के लिए आपको लॉग इन होना होगा',
    burmese: 'ဘာသာပြန်ဆိုချက်များ တင်ရန် သင်သည် အကောင့်ဝင်ရမည်',
    thai: 'คุณต้องเข้าสู่ระบบเพื่อส่งคำแปล',
    mandarin: '您必须登录才能提交翻译'
  },
  logInToVote: {
    english: 'You must be logged in to vote',
    spanish: 'Debe iniciar sesión para votar',
    brazilian_portuguese: 'Você precisa estar logado para votar',
    tok_pisin: 'Yu mas login pastaim long vote',
    indonesian: 'Anda harus masuk untuk memberikan suara',
    nepali: 'मत दिन तपाईं लग इन हुनुपर्छ',
    hindi: 'मत देने के लिए आपको लॉग इन होना होगा',
    burmese: 'မဲပေးရန် သင်သည် အကောင့်ဝင်ရမည်',
    thai: 'คุณต้องเข้าสู่ระบบเพื่อลงคะแนน',
    mandarin: '您必须登录才能投票'
  },
  menu: {
    english: 'Menu',
    spanish: 'Menú',
    brazilian_portuguese: 'Menu',
    tok_pisin: 'Menu',
    indonesian: 'Menu',
    nepali: 'मेनु',
    hindi: 'मेनू',
    burmese: 'မီနူး',
    thai: 'เมนู',
    mandarin: '菜单'
  },
  newTranslation: {
    english: 'New Translation',
    spanish: 'Nueva Traducción',
    brazilian_portuguese: 'Nova Tradução',
    tok_pisin: 'Nupela Translation',
    indonesian: 'Terjemahan Baru',
    nepali: 'नयाँ अनुवाद',
    hindi: 'नया अनुवाद',
    burmese: 'ဘာသာပြန်ဆိုချက် အသစ်',
    thai: 'คำแปลใหม่',
    mandarin: '新翻译'
  },
  newTranscription: {
    english: 'New Transcription',
    spanish: 'Nueva Transcripción',
    brazilian_portuguese: 'Nova Transcrição',
    tok_pisin: 'Nupela Transcription',
    indonesian: 'Transkripsi Baru',
    nepali: 'नयाँ ट्रान्सक्रिप्सन',
    hindi: 'नया ट्रांसक्रिप्शन',
    burmese: 'စာလုံးပေါင်း အသစ်',
    thai: 'การถอดความใหม่',
    mandarin: '新转录'
  },
  newUser: {
    english: 'New user?',
    spanish: '¿Usuario nuevo?',
    brazilian_portuguese: 'Novo usuário?',
    tok_pisin: 'Nupela user?',
    indonesian: 'Pengguna baru?',
    nepali: 'नयाँ प्रयोगकर्ता?',
    hindi: 'नया उपयोगकर्ता?',
    burmese: 'အသုံးပြုသူ အသစ်လား?',
    thai: 'ผู้ใช้ใหม่?',
    mandarin: '新用户？'
  },
  newUserRegistration: {
    english: 'New User Registration',
    spanish: 'Registro de nuevo usuario',
    brazilian_portuguese: 'Registro de Novo Usuário',
    tok_pisin: 'Nupela User Registration',
    indonesian: 'Pendaftaran Pengguna Baru',
    nepali: 'नयाँ प्रयोगकर्ता दर्ता',
    hindi: 'नया उपयोगकर्ता पंजीकरण',
    burmese: 'အသုံးပြုသူ အသစ် မှတ်ပုံတင်ခြင်း',
    thai: 'การลงทะเบียนผู้ใช้ใหม่',
    mandarin: '新用户注册'
  },
  noComment: {
    english: 'No Comment',
    spanish: 'Sin comentarios',
    brazilian_portuguese: 'Sem Comentários',
    tok_pisin: 'No gat comment',
    indonesian: 'Tidak Ada Komentar',
    nepali: 'कुनै टिप्पणी छैन',
    hindi: 'कोई टिप्पणी नहीं',
    burmese: 'မှတ်ချက်မရှိပါ',
    thai: 'ไม่มีความคิดเห็น',
    mandarin: '无评论'
  },
  noProject: {
    english: 'No active project found',
    spanish: 'No se encontró ningún proyecto activo',
    brazilian_portuguese: 'Nenhum projeto ativo encontrado',
    tok_pisin: 'No gat active project',
    indonesian: 'Tidak ada proyek aktif yang ditemukan',
    nepali: 'कुनै सक्रिय प्रोजेक्ट फेला परेन',
    hindi: 'कोई सक्रिय परियोजना नहीं मिली',
    burmese: 'အသက်ဝင်သော စီမံကိန်း မတွေ့ရှိပါ',
    thai: 'ไม่พบโครงการที่ใช้งานอยู่',
    mandarin: '未找到活动项目'
  },
  ok: {
    english: 'OK',
    spanish: 'OK',
    brazilian_portuguese: 'OK',
    tok_pisin: 'Orait',
    indonesian: 'OK',
    nepali: 'ठीक छ',
    hindi: 'ठीक है',
    burmese: 'အိုကေ',
    thai: 'ตกลง',
    mandarin: '确定'
  },
  offline: {
    english: 'Offline',
    spanish: 'Sin conexión',
    brazilian_portuguese: 'Offline',
    tok_pisin: 'No gat internet',
    indonesian: 'Offline',
    nepali: 'अफलाइन',
    hindi: 'ऑफलाइन',
    burmese: 'အင်တာနက်မရှိ',
    thai: 'ออฟไลน์',
    mandarin: '离线'
  },
  password: {
    english: 'Password',
    spanish: 'Contraseña',
    brazilian_portuguese: 'Senha',
    tok_pisin: 'Password',
    indonesian: 'Kata Sandi',
    nepali: 'पासवर्ड',
    hindi: 'पासवर्ड',
    burmese: 'စကားဝှက်',
    thai: 'รหัสผ่าน',
    mandarin: '密码'
  },
  passwordRequired: {
    english: 'Password is required',
    spanish: 'Se requiere contraseña',
    brazilian_portuguese: 'Senha é obrigatória',
    tok_pisin: 'Password i mas',
    indonesian: 'Kata sandi diperlukan',
    nepali: 'पासवर्ड आवश्यक छ',
    hindi: 'पासवर्ड आवश्यक है',
    burmese: 'စကားဝှက် လိုအပ်ပါသည်',
    thai: 'ต้องใช้รหัสผ่าน',
    mandarin: '需要密码'
  },
  passwordMinLength: {
    english: 'Password must be at least 6 characters',
    spanish: 'La contraseña debe tener al menos 6 caracteres',
    brazilian_portuguese: 'A senha deve ter pelo menos 6 caracteres',
    tok_pisin: 'Password i mas gat 6 character',
    indonesian: 'Kata sandi harus minimal 6 karakter',
    nepali: 'पासवर्ड कम्तिमा ६ अक्षर हुनुपर्छ',
    hindi: 'पासवर्ड कम से कम 6 अक्षर का होना चाहिए',
    burmese: 'စကားဝှက်သည် အနည်းဆုံး ၆ စာလုံး ရှိရမည်',
    thai: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร',
    mandarin: '密码必须至少 6 个字符'
  },
  passwordsNoMatch: {
    english: 'Passwords do not match',
    spanish: 'Las contraseñas no coinciden',
    brazilian_portuguese: 'As senhas não coincidem',
    tok_pisin: 'Ol password i no sem',
    indonesian: 'Kata sandi tidak cocok',
    nepali: 'पासवर्डहरू मेल खाँदैनन्',
    hindi: 'पासवर्ड मेल नहीं खाते',
    burmese: 'စကားဝှက်များ ကိုက်ညီမှုမရှိပါ',
    thai: 'รหัสผ่านไม่ตรงกัน',
    mandarin: '密码不匹配'
  },
  passwordResetSuccess: {
    english: 'Password has been reset successfully',
    spanish: 'La contraseña se ha restablecido correctamente',
    brazilian_portuguese: 'A senha foi redefinida com sucesso',
    tok_pisin: 'Password i reset gut pinis',
    indonesian: 'Kata sandi berhasil direset',
    nepali: 'पासवर्ड सफलतापूर्वक रिसेट गरियो',
    hindi: 'पासवर्ड सफलतापूर्वक रीसेट हो गया',
    burmese: 'စကားဝှက်ကို အောင်မြင်စွာ ပြန်လည်သတ်မှတ်ပြီးပါပြီ',
    thai: 'รีเซ็ตรหัสผ่านสำเร็จ',
    mandarin: '密码已成功重置'
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
      'Undangan diterima, tetapi unduhan proyek gagal. Anda dapat mengunduhnya nanti dari halaman proyek.',
    nepali:
      'आमन्त्रण स्वीकार गरियो, तर प्रोजेक्ट डाउनलोड असफल भयो। तपाईं पछि प्रोजेक्ट पृष्ठबाट डाउनलोड गर्न सक्नुहुन्छ।',
    hindi:
      'आमंत्रण स्वीकार कर लिया गया, लेकिन परियोजना डाउनलोड विफल रहा। आप बाद में परियोजनाएं पृष्ठ से इसे डाउनलोड कर सकते हैं।',
    burmese:
      'ဖိတ်ခေါ်မှုကို လက်ခံပြီးပါပြီ၊ သို့သော် စီမံကိန်း ဒေါင်းလုဒ်လုပ်ရန် မအောင်မြင်ပါ။ သင်သည် နောက်ပိုင်းတွင် စီမံကိန်းများ စာမျက်နှာမှ ဒေါင်းလုဒ်လုပ်နိုင်သည်။',
    thai: 'ยอมรับคำเชิญแล้ว แต่ดาวน์โหลดโครงการไม่สำเร็จ คุณสามารถดาวน์โหลดได้ในภายหลังจากหน้าความโครงการ',
    mandarin: '邀请已接受，但项目下载失败。您可以稍后从项目页面下载它。'
  },
  projects: {
    english: 'Projects',
    spanish: 'Proyectos',
    brazilian_portuguese: 'Projetos',
    tok_pisin: 'Ol Project',
    indonesian: 'Proyek',
    nepali: 'प्रोजेक्टहरू',
    hindi: 'परियोजनाएं',
    burmese: 'စီမံကိန်းများ',
    thai: 'โครงการ',
    mandarin: '项目'
  },
  quests: {
    english: 'Quests',
    spanish: 'Misiones',
    brazilian_portuguese: 'Missões',
    tok_pisin: 'Ol Quest',
    indonesian: 'Misi',
    nepali: 'क्वेस्टहरू',
    hindi: 'क्वेस्ट',
    burmese: 'Quest များ',
    thai: 'เควสต์',
    mandarin: '任务'
  },
  project: {
    english: 'Project',
    spanish: 'Proyecto',
    brazilian_portuguese: 'Projeto',
    nepali: 'प्रोजेक्ट',
    hindi: 'परियोजना',
    burmese: 'စီမံကိန်း',
    thai: 'โครงการ',
    mandarin: '项目'
  },
  noProjectsFound: {
    english: 'No projects found',
    spanish: 'No se encontraron proyectos',
    brazilian_portuguese: 'Nenhum projeto encontrado',
    tok_pisin: 'Nogat projek i painim',
    indonesian: 'Tidak ada proyek yang ditemukan',
    nepali: 'कुनै प्रोजेक्ट फेला परेन',
    hindi: 'कोई परियोजना नहीं मिली',
    burmese: 'စီမံကိန်း မတွေ့ရှိပါ',
    thai: 'ไม่พบโครงการ',
    mandarin: '未找到项目'
  },
  noProjectsYet: {
    english: 'No projects yet',
    spanish: 'Aún no hay proyectos',
    brazilian_portuguese: 'Ainda não há projetos',
    tok_pisin: 'I no gat projek yet',
    indonesian: 'Belum ada proyek',
    nepali: 'अहिलेसम्म कुनै प्रोजेक्ट छैन',
    hindi: 'अभी तक कोई परियोजना नहीं',
    burmese: 'အခုထိ စီမံကိန်း မရှိသေးပါ',
    thai: 'ยังไม่มีโครงการ',
    mandarin: '还没有项目'
  },
  noProjectsAvailable: {
    english: 'No projects available',
    spanish: 'No hay proyectos disponibles',
    brazilian_portuguese: 'Nenhum projeto disponível',
    tok_pisin: 'Nogat projek i stap',
    indonesian: 'Tidak ada proyek yang tersedia',
    nepali: 'कुनै प्रोजेक्ट उपलब्ध छैन',
    hindi: 'कोई परियोजना उपलब्ध नहीं',
    burmese: 'ရရှိနိုင်သော စီမံကိန်း မရှိပါ',
    thai: 'ไม่มีโครงการที่พร้อมใช้งาน',
    mandarin: '没有可用的项目'
  },
  createProject: {
    english: 'Create Project',
    spanish: 'Crear proyecto',
    brazilian_portuguese: 'Criar projeto',
    tok_pisin: 'Wokim Nupela Projek',
    indonesian: 'Buat Proyek',
    nepali: 'प्रोजेक्ट सिर्जना गर्नुहोस्',
    hindi: 'परियोजना बनाएं',
    burmese: 'စီမံကိန်း ဖန်တီးပါ',
    thai: 'สร้างโครงการ',
    mandarin: '创建项目'
  },
  published: {
    english: 'Published',
    spanish: 'Publicado',
    brazilian_portuguese: 'Publicado',
    tok_pisin: 'Publisim pinis',
    indonesian: 'Diterbitkan',
    nepali: 'प्रकाशित',
    hindi: 'प्रकाशित',
    burmese: 'ထုတ်ဝေပြီး',
    thai: 'เผยแพร่แล้ว',
    mandarin: '已发布'
  },
  cannotPublishWhileOffline: {
    english: 'Cannot save to cloud while offline',
    spanish: 'No se puede guardar en la nube mientras está desconectado',
    brazilian_portuguese:
      'Não é possível salvar na nuvem enquanto está desconectado',
    tok_pisin: 'I no inap save long cloud long no gat internet',
    indonesian: 'Tidak dapat menyimpan ke cloud saat offline',
    nepali: 'अफलाइन हुँदा क्लाउडमा सेभ गर्न सकिँदैन',
    hindi: 'ऑफलाइन होने पर क्लाउड में सहेज नहीं सकते',
    burmese: 'အင်တာနက်မရှိသောအချိန်တွင် cloud သို့ သိမ်းဆည်း၍မရပါ',
    thai: 'ไม่สามารถบันทึกลงคลาวด์ได้ขณะออฟไลน์',
    mandarin: '离线时无法保存到云端'
  },
  chapters: {
    english: 'Chapters',
    spanish: 'Capítulos',
    brazilian_portuguese: 'Capítulos',
    tok_pisin: 'Chapter',
    indonesian: 'Bab',
    nepali: 'अध्यायहरू',
    hindi: 'अध्याय',
    burmese: 'အခန်းများ',
    thai: 'บท',
    mandarin: '章节'
  },
  chapter: {
    english: 'Chapter',
    spanish: 'Capítulo',
    brazilian_portuguese: 'Capítulo',
    tok_pisin: 'Chapter',
    indonesian: 'Bab',
    nepali: 'अध्याय',
    hindi: 'अध्याय',
    burmese: 'အခန်း',
    thai: 'บท',
    mandarin: '章节'
  },
  publishChapter: {
    english: 'Save to Cloud',
    spanish: 'Guardar en la Nube',
    brazilian_portuguese: 'Salvar na Nuvem',
    tok_pisin: 'Save long Cloud',
    indonesian: 'Simpan ke Cloud',
    nepali: 'क्लाउडमा सेभ गर्नुहोस्',
    hindi: 'क्लाउड में सहेजें',
    burmese: 'Cloud သို့ သိမ်းဆည်းပါ',
    thai: 'บันทึกลงคลาวด์',
    mandarin: '保存到云端'
  },
  publish: {
    english: 'Save',
    spanish: 'Guardar',
    nepali: 'सेभ गर्नुहोस्',
    brazilian_portuguese: 'Salvar',
    tok_pisin: 'Save',
    indonesian: 'Simpan',
    hindi: 'सहेजें',
    burmese: 'သိမ်းဆည်းပါ',
    thai: 'บันทึก',
    mandarin: '保存'
  },
  publishChapterMessage: {
    english:
      "This will create a permanent copy of {questName} in the cloud.\n\nAll recordings will be saved as an immutable snapshot. Once saved, this version cannot be changed, but you can create new versions later if needed.\n\nIf the parent book or project haven't been saved to the cloud yet, they will be saved automatically.",
    spanish:
      'Esto creará una copia permanente de {questName} en la nube.\n\nTodas las grabaciones se guardarán como una instantánea inmutable. Una vez guardada, esta versión no se puede cambiar, pero puedes crear nuevas versiones más tarde si es necesario.\n\nSi el libro o proyecto padre aún no se han guardado en la nube, se guardarán automáticamente.',
    brazilian_portuguese:
      'Isso criará uma cópia permanente de {questName} na nuvem.\n\nTodas as gravações serão salvas como um instantâneo imutável. Uma vez salva, esta versão não pode ser alterada, mas você pode criar novas versões mais tarde, se necessário.\n\nSe o livro ou projeto pai ainda não foram salvos na nuvem, eles serão salvos automaticamente.',
    tok_pisin:
      'Dispela bai wokim wanpela permanent kopi bilong {questName} long cloud.\n\nOlgeta recording bai save olsem wanpela snapshot we yu no inap senisim. Taim yu save pinis, dispela version i no inap senis, tasol yu ken wokim nupela version bihain sapos yu laik.\n\nSapos papa buk o project i no save long cloud yet, bai ol i save otomatik.',
    indonesian:
      'Ini akan membuat salinan permanen dari {questName} di cloud.\n\nSemua rekaman akan disimpan sebagai snapshot yang tidak dapat diubah. Setelah disimpan, versi ini tidak dapat diubah, tetapi Anda dapat membuat versi baru nanti jika diperlukan.\n\nJika buku atau proyek induk belum disimpan ke cloud, mereka akan disimpan secara otomatis.',
    nepali:
      'यसले {questName} को स्थायी प्रतिलिपि क्लाउडमा सिर्जना गर्नेछ।\n\nसबै रेकर्डिङहरू अपरिवर्तनीय स्न्यापशटको रूपमा सेभ हुनेछन्। एक पटक सेभ गरेपछि, यो संस्करण परिवर्तन गर्न सकिँदैन, तर आवश्यक भएमा तपाईं पछि नयाँ संस्करणहरू सिर्जना गर्न सक्नुहुन्छ।\n\nयदि अभिभावक पुस्तक वा प्रोजेक्ट अझै क्लाउडमा सेभ गरिएको छैन भने, तिनीहरू स्वचालित रूपमा सेभ हुनेछन्।',
    hindi:
      'यह क्लाउड में {questName} की एक स्थायी प्रतिलिपि बनाएगा।\n\nसभी रिकॉर्डिंग एक अपरिवर्तनीय स्नैपशॉट के रूप में सहेजी जाएंगी। एक बार सहेजने के बाद, इस संस्करण को बदला नहीं जा सकता, लेकिन आवश्यकता होने पर आप बाद में नए संस्करण बना सकते हैं।\n\nयदि मूल पुस्तक या परियोजना अभी तक क्लाउड में सहेजी नहीं गई है, तो वे स्वचालित रूप से सहेजी जाएंगी।',
    burmese:
      '၎င်းသည် cloud တွင် {questName} ၏ အမြဲတမ်း မိတ္တူတစ်ခုကို ဖန်တီးပါမည်။\n\nမှတ်တမ်းအားလုံးကို ပြောင်းလဲ၍မရသော snapshot အဖြစ် သိမ်းဆည်းပါမည်။ တစ်ကြိမ် သိမ်းဆည်းပြီးပါက၊ ဤဗားရှင်းကို ပြောင်းလဲ၍မရပါ၊ သို့သော် လိုအပ်ပါက နောက်ပိုင်းတွင် ဗားရှင်းအသစ်များ ဖန်တီးနိုင်ပါသည်။\n\nမိဘစာအုပ် သို့မဟုတ် စီမံကိန်းကို cloud တွင် မသိမ်းဆည်းရသေးပါက၊ ၎င်းတို့ကို အလိုအလျောက် သိမ်းဆည်းပါမည်။',
    thai: 'การดำเนินการนี้จะสร้างสำเนาถาวรของ {questName} ในคลาวด์\n\nการบันทึกทั้งหมดจะถูกบันทึกเป็นภาพถ่ายที่ไม่สามารถเปลี่ยนแปลงได้ เมื่อบันทึกแล้ว เวอร์ชันนี้ไม่สามารถเปลี่ยนแปลงได้ แต่คุณสามารถสร้างเวอร์ชันใหม่ในภายหลังหากจำเป็น\n\nหากหนังสือหรือโครงการหลักยังไม่ได้บันทึกลงคลาวด์ จะถูกบันทึกโดยอัตโนมัติ',
    mandarin:
      '这将在云端创建 {questName} 的永久副本。\n\n所有录音将保存为不可变的快照。保存后，此版本无法更改，但如果需要，您可以稍后创建新版本。\n\n如果父书籍或项目尚未保存到云端，它们将自动保存。'
  },
  quest: {
    english: 'Quest',
    spanish: 'Misión',
    brazilian_portuguese: 'Missão',
    nepali: 'क्वेस्ट',
    hindi: 'क्वेस्ट',
    burmese: 'Quest',
    thai: 'เควสต์',
    mandarin: '任务'
  },
  questOptions: {
    english: 'Quest Options',
    spanish: 'Opciones de misión',
    brazilian_portuguese: 'Opções de Missão',
    tok_pisin: 'Quest Options',
    indonesian: 'Opsi Misi',
    nepali: 'क्वेस्ट विकल्पहरू',
    hindi: 'क्वेस्ट विकल्प',
    burmese: 'Quest ရွေးချယ်စရာများ',
    thai: 'ตัวเลือกเควสต์',
    mandarin: '任务选项'
  },
  recording: {
    english: 'Recording',
    spanish: 'Grabando',
    brazilian_portuguese: 'Gravando',
    tok_pisin: 'Recording',
    indonesian: 'Merekam',
    nepali: 'रेकर्डिङ',
    hindi: 'रिकॉर्डिंग',
    burmese: 'မှတ်တမ်းတင်နေသည်',
    thai: 'กำลังบันทึก',
    mandarin: '正在录制'
  },
  register: {
    english: 'Register',
    spanish: 'Registrarse',
    brazilian_portuguese: 'Registrar',
    tok_pisin: 'Register',
    indonesian: 'Daftar',
    nepali: 'दर्ता गर्नुहोस्',
    hindi: 'पंजीकरण करें',
    burmese: 'မှတ်ပုံတင်ပါ',
    thai: 'ลงทะเบียน',
    mandarin: '注册'
  },
  createAccount: {
    english: 'Create Account',
    spanish: 'Crear Cuenta',
    brazilian_portuguese: 'Criar Conta',
    tok_pisin: 'Mekim Account',
    indonesian: 'Buat Akun',
    nepali: 'खाता सिर्जना गर्नुहोस्',
    hindi: 'खाता बनाएं',
    burmese: 'အကောင့် ဖန်တီးပါ',
    thai: 'สร้างบัญชี',
    mandarin: '创建账户'
  },
  registrationFail: {
    english: 'Registration failed',
    spanish: 'Error en el registro',
    brazilian_portuguese: 'Falha no registro',
    tok_pisin: 'Registration i no inap',
    indonesian: 'Pendaftaran gagal',
    nepali: 'दर्ता असफल',
    hindi: 'पंजीकरण विफल',
    burmese: 'မှတ်ပုံတင်ခြင်း မအောင်မြင်ပါ',
    thai: 'การลงทะเบียนล้มเหลว',
    mandarin: '注册失败'
  },
  registrationSuccess: {
    english: 'Registration successful',
    spanish: 'Registro exitoso',
    brazilian_portuguese: 'Registro bem-sucedido',
    tok_pisin: 'Registration i orait',
    indonesian: 'Pendaftaran berhasil',
    nepali: 'दर्ता सफल',
    hindi: 'पंजीकरण सफल',
    burmese: 'မှတ်ပုံတင်ခြင်း အောင်မြင်ပါသည်',
    thai: 'การลงทะเบียนสำเร็จ',
    mandarin: '注册成功'
  },
  resetPassword: {
    english: 'Reset Password',
    spanish: 'Restablecer contraseña',
    brazilian_portuguese: 'Redefinir Senha',
    tok_pisin: 'Reset Password',
    indonesian: 'Reset Kata Sandi',
    nepali: 'पासवर्ड रिसेट गर्नुहोस्',
    hindi: 'पासवर्ड रीसेट करें',
    burmese: 'စကားဝှက်ကို ပြန်လည်သတ်မှတ်ပါ',
    thai: 'รีเซ็ตรหัสผ่าน',
    mandarin: '重置密码'
  },
  returningHero: {
    english: 'Returning hero? Sign In',
    spanish: '¿Héroe que regresa? Inicia sesión',
    brazilian_portuguese: 'Herói retornando? Faça Login',
    tok_pisin: 'Hero i kam bek? Sign In',
    indonesian: 'Pahlawan kembali? Masuk',
    nepali: 'फर्किने नायक? साइन इन गर्नुहोस्',
    hindi: 'वापस आ रहे हैं? साइन इन करें',
    burmese: 'ပြန်လာနေသော သူရဲကောင်းလား? အကောင့်ဝင်ပါ',
    thai: 'กลับมาแล้ว? เข้าสู่ระบบ',
    mandarin: '返回的英雄？登录'
  },
  search: {
    english: 'Search...',
    spanish: 'Buscar...',
    brazilian_portuguese: 'Buscar...',
    tok_pisin: 'Painim...',
    indonesian: 'Cari...',
    nepali: 'खोज्नुहोस्...',
    hindi: 'खोजें...',
    burmese: 'ရှာဖွေပါ...',
    thai: 'ค้นหา...',
    mandarin: '搜索...'
  },
  searchAssets: {
    english: 'Search assets...',
    spanish: 'Buscar recursos...',
    brazilian_portuguese: 'Buscar recursos...',
    tok_pisin: 'Painim ol asset...',
    indonesian: 'Cari aset...',
    nepali: 'एसेटहरू खोज्नुहोस्...',
    hindi: 'एसेट खोजें...',
    burmese: 'ပိုင်ဆိုင်မှုများကို ရှာဖွေပါ...',
    thai: 'ค้นหาสินทรัพย์...',
    mandarin: '搜索资产...'
  },
  noAssetsFound: {
    english: 'No assets found',
    spanish: 'No se encontraron recursos',
    brazilian_portuguese: 'Nenhum recurso encontrado',
    tok_pisin: 'No gat asset',
    indonesian: 'Tidak ada aset ditemukan',
    nepali: 'कुनै एसेट फेला परेन',
    hindi: 'कोई एसेट नहीं मिला',
    burmese: 'ပိုင်ဆိုင်မှု မတွေ့ရှိပါ',
    thai: 'ไม่พบสินทรัพย์',
    mandarin: '未找到资产'
  },
  nothingHereYet: {
    english: 'Nothing here yet!',
    spanish: '¡Nada aquí todavía!',
    brazilian_portuguese: '¡Nada aqui ainda!',
    tok_pisin: 'I no gat here yet!',
    indonesian: 'Belum ada di sini!',
    nepali: 'यहाँ अझै केही छैन!',
    hindi: 'यहाँ अभी तक कुछ नहीं!',
    burmese: 'ဤနေရာတွင် မည်သည့်အရာမျှ မရှိသေးပါ!',
    thai: 'ยังไม่มีอะไรที่นี่!',
    mandarin: '这里还没有任何内容！'
  },
  searchQuests: {
    english: 'Search quests...',
    spanish: 'Buscar misiones...',
    brazilian_portuguese: 'Buscar missões...',
    tok_pisin: 'Painim ol quest...',
    indonesian: 'Cari misi...',
    nepali: 'क्वेस्टहरू खोज्नुहोस्...',
    hindi: 'क्वेस्ट खोजें...',
    burmese: 'Quest များကို ရှာဖွေပါ...',
    thai: 'ค้นหาเควสต์...',
    mandarin: '搜索任务...'
  },
  selectItem: {
    english: 'Select item',
    spanish: 'Seleccionar elemento',
    brazilian_portuguese: 'Selecionar item',
    tok_pisin: 'Makim item',
    indonesian: 'Pilih item',
    nepali: 'वस्तु चयन गर्नुहोस्',
    hindi: 'आइटम चुनें',
    burmese: 'အရာဝတ္ထုကို ရွေးချယ်ပါ',
    thai: 'เลือกรายการ',
    mandarin: '选择项目'
  },
  selectLanguage: {
    english: 'Please select a language',
    spanish: 'Por favor seleccione un idioma',
    brazilian_portuguese: 'Por favor, selecione um idioma',
    tok_pisin: 'Plis makim wanpela tokples',
    indonesian: 'Silakan pilih bahasa',
    nepali: 'कृपया एउटा भाषा चयन गर्नुहोस्',
    hindi: 'कृपया एक भाषा चुनें',
    burmese: 'ကျေးဇူးပြု၍ ဘာသာစကားတစ်ခုကို ရွေးချယ်ပါ',
    thai: 'กรุณาเลือกภาษา',
    mandarin: '请选择一种语言'
  },
  selectRegion: {
    english: 'Select Region',
    spanish: 'Seleccionar Región',
    brazilian_portuguese: 'Selecionar Região',
    tok_pisin: 'Makim Region',
    indonesian: 'Pilih Wilayah',
    nepali: 'क्षेत्र चयन गर्नुहोस्',
    hindi: 'क्षेत्र चुनें',
    burmese: 'ဒေသကို ရွေးချယ်ပါ',
    thai: 'เลือกภูมิภาค',
    mandarin: '选择地区'
  },
  selectRegionToFilterLanguages: {
    english: 'Select a region to see languages from that area',
    spanish: 'Seleccione una región para ver idiomas de esa área',
    brazilian_portuguese: 'Selecionar uma região para ver idiomas dessa área',
    tok_pisin: 'Makim wanpela region long lukim ol tokples bilong ples ya',
    indonesian: 'Pilih wilayah untuk melihat bahasa dari area tersebut',
    nepali: 'त्यस क्षेत्रका भाषाहरू हेर्न एउटा क्षेत्र चयन गर्नुहोस्',
    hindi: 'उस क्षेत्र की भाषाएं देखने के लिए एक क्षेत्र चुनें',
    burmese: 'ထိုဒေသမှ ဘာသာစကားများကို ကြည့်ရှုရန် ဒေသတစ်ခုကို ရွေးချယ်ပါ',
    thai: 'เลือกภูมิภาคเพื่อดูภาษาจากพื้นที่นั้น',
    mandarin: '选择一个地区以查看该地区的语言'
  },
  selectYourLanguage: {
    english: 'Select Your Language',
    spanish: 'Seleccione Su Idioma',
    brazilian_portuguese: 'Selecionar Seu Idioma',
    tok_pisin: 'Makim Tokples Bilong Yu',
    indonesian: 'Pilih Bahasa Anda',
    nepali: 'आफ्नो भाषा चयन गर्नुहोस्',
    hindi: 'अपनी भाषा चुनें',
    burmese: 'သင်၏ ဘာသာစကားကို ရွေးချယ်ပါ',
    thai: 'เลือกภาษาของคุณ',
    mandarin: '选择您的语言'
  },
  createLanguage: {
    english: 'Create Language',
    spanish: 'Crear Idioma',
    brazilian_portuguese: 'Criar Idioma',
    tok_pisin: 'Mekim Tokples',
    indonesian: 'Buat Bahasa',
    nepali: 'भाषा सिर्जना गर्नुहोस्',
    hindi: 'भाषा बनाएं',
    burmese: 'ဘာသာစကား ဖန်တီးပါ',
    thai: 'สร้างภาษา',
    mandarin: '创建语言'
  },
  createNewLanguage: {
    english: 'Create New Language',
    spanish: 'Crear Nuevo Idioma',
    brazilian_portuguese: 'Criar Novo Idioma',
    tok_pisin: 'Mekim Nupela Tokples',
    indonesian: 'Buat Bahasa Baru',
    nepali: 'नयाँ भाषा सिर्जना गर्नुहोस्',
    hindi: 'नई भाषा बनाएं',
    burmese: 'ဘာသာစကား အသစ် ဖန်တီးပါ',
    thai: 'สร้างภาษาใหม่',
    mandarin: '创建新语言'
  },
  languageNotInList: {
    english: 'My language is not in the list',
    spanish: 'Mi idioma no está en la lista',
    brazilian_portuguese: 'Meu idioma não está na lista',
    tok_pisin: 'Tokples bilong mi i no stap long list',
    indonesian: 'Bahasa saya tidak ada dalam daftar',
    nepali: 'मेरो भाषा सूचीमा छैन',
    hindi: 'मेरी भाषा सूची में नहीं है',
    burmese: 'ကျွန်ုပ်၏ ဘာသာစကားသည် စာရင်းတွင် မပါဝင်ပါ',
    thai: 'ภาษาของฉันไม่อยู่ในรายการ',
    mandarin: '我的语言不在列表中'
  },
  willCreateLanguage: {
    english: 'Will create language',
    spanish: 'Creará idioma',
    brazilian_portuguese: 'Criará idioma',
    tok_pisin: 'Bai mekim tokples',
    indonesian: 'Akan membuat bahasa',
    nepali: 'भाषा सिर्जना गरिनेछ',
    hindi: 'भाषा बनाई जाएगी',
    burmese: 'ဘာသာစကားကို ဖန်တီးပါမည်',
    thai: 'จะสร้างภาษา',
    mandarin: '将创建语言'
  },
  nativeName: {
    english: 'Native Name',
    spanish: 'Nombre Nativo',
    brazilian_portuguese: 'Nome Nativo',
    tok_pisin: 'Nem Bilong Tokples',
    indonesian: 'Nama Asli',
    nepali: 'स्थानीय नाम',
    hindi: 'मूल नाम',
    burmese: 'မူရင်းအမည်',
    thai: 'ชื่อพื้นเมือง',
    mandarin: '本族语名称'
  },
  englishName: {
    english: 'English Name',
    spanish: 'Nombre en Inglés',
    brazilian_portuguese: 'Nome em Inglês',
    tok_pisin: 'Nem Long English',
    indonesian: 'Nama dalam Bahasa Inggris',
    nepali: 'अंग्रेजी नाम',
    hindi: 'अंग्रेजी नाम',
    burmese: 'အင်္ဂလိပ်အမည်',
    thai: 'ชื่อภาษาอังกฤษ',
    mandarin: '英文名称'
  },
  iso6393Code: {
    english: 'ISO 639-3 Code',
    spanish: 'Código ISO 639-3',
    brazilian_portuguese: 'Código ISO 639-3',
    tok_pisin: 'ISO 639-3 Code',
    indonesian: 'Kode ISO 639-3',
    nepali: 'ISO 639-3 कोड',
    hindi: 'ISO 639-3 कोड',
    burmese: 'ISO 639-3 ကုဒ်',
    thai: 'รหัส ISO 639-3',
    mandarin: 'ISO 639-3 代码'
  },
  locale: {
    english: 'Locale',
    spanish: 'Idioma',
    brazilian_portuguese: 'Idioma',
    tok_pisin: 'Locale',
    indonesian: 'Lokalisasi',
    nepali: 'लोकेल',
    hindi: 'लोकेल',
    burmese: 'ဒေသ',
    thai: 'โลแคล',
    mandarin: '区域设置'
  },
  createAndContinue: {
    english: 'Create and Continue',
    spanish: 'Crear y Continuar',
    brazilian_portuguese: 'Criar e Continuar',
    tok_pisin: 'Mekim na Go Long',
    indonesian: 'Buat dan Lanjutkan',
    nepali: 'सिर्जना गर्नुहोस् र जारी राख्नुहोस्',
    hindi: 'बनाएं और जारी रखें',
    burmese: 'ဖန်တီးပြီး ဆက်လုပ်ပါ',
    thai: 'สร้างและดำเนินการต่อ',
    mandarin: '创建并继续'
  },
  whatWouldYouLikeToCreate: {
    english: 'What would you like to create?',
    spanish: '¿Qué te gustaría crear?',
    brazilian_portuguese: 'O que você gostaria de criar?',
    tok_pisin: 'Wanem samting yu laik mekim?',
    indonesian: 'Apa yang ingin Anda buat?',
    nepali: 'तपाईं के सिर्जना गर्न चाहनुहुन्छ?',
    hindi: 'आप क्या बनाना चाहेंगे?',
    burmese: 'သင်ဘာကို ဖန်တီးလိုပါသလဲ?',
    thai: 'คุณต้องการสร้างอะไร?',
    mandarin: '您想创建什么？'
  },
  createBibleProject: {
    english: 'Bible',
    spanish: 'Biblia',
    brazilian_portuguese: 'Bíblia',
    tok_pisin: 'Baibel',
    indonesian: 'Alkitab',
    nepali: 'बाइबल',
    hindi: 'बाइबल',
    burmese: 'သမ္မာကျမ်းစာ',
    thai: 'พระคัมภีร์',
    mandarin: '圣经'
  },
  translateBibleIntoYourLanguage: {
    english: 'Translate the Bible into your language',
    spanish: 'Traduce la Biblia a tu idioma',
    brazilian_portuguese: 'Traduza a Bíblia para o seu idioma',
    tok_pisin: 'Translate Baibel long tokples bilong yu',
    indonesian: 'Terjemahkan Alkitab ke bahasa Anda',
    nepali: 'बाइबललाई आफ्नो भाषामा अनुवाद गर्नुहोस्',
    hindi: 'बाइबल को अपनी भाषा में अनुवाद करें',
    burmese: 'သမ္မာကျမ်းစာကို သင်၏ ဘာသာစကားသို့ ဘာသာပြန်ဆိုပါ',
    thai: 'แปลพระคัมภีร์เป็นภาษาของคุณ',
    mandarin: '将圣经翻译成您的语言'
  },
  createOtherProject: {
    english: 'Other Translation',
    spanish: 'Otra Traducción',
    brazilian_portuguese: 'Outra Tradução',
    tok_pisin: 'Narapela Translation',
    indonesian: 'Terjemahan Lain',
    nepali: 'अन्य अनुवाद',
    hindi: 'अन्य अनुवाद',
    burmese: 'အခြား ဘာသာပြန်ဆိုချက်',
    thai: 'การแปลอื่นๆ',
    mandarin: '其他翻译'
  },
  createGeneralTranslationProject: {
    english: 'Create a general translation project',
    spanish: 'Crear un proyecto de traducción general',
    brazilian_portuguese: 'Criar um projeto de tradução geral',
    tok_pisin: 'Mekim wanpela project long translate ol samting',
    indonesian: 'Buat proyek terjemahan umum',
    nepali: 'सामान्य अनुवाद प्रोजेक्ट सिर्जना गर्नुहोस्',
    hindi: 'एक सामान्य अनुवाद परियोजना बनाएं',
    burmese: 'အထွေထွေ ဘာသာပြန်ဆိုချက် စီမံကိန်း ဖန်တီးပါ',
    thai: 'สร้างโครงการแปลทั่วไป',
    mandarin: '创建通用翻译项目'
  },
  selectProject: {
    english: 'Select Project',
    spanish: 'Seleccionar Proyecto',
    brazilian_portuguese: 'Selecionar Projeto',
    tok_pisin: 'Makim Project',
    indonesian: 'Pilih Proyek',
    nepali: 'प्रोजेक्ट चयन गर्नुहोस्',
    hindi: 'परियोजना चुनें',
    burmese: 'စီမံကိန်းကို ရွေးချယ်ပါ',
    thai: 'เลือกโครงการ',
    mandarin: '选择项目'
  },
  createFirstProject: {
    english: 'Create First Project',
    spanish: 'Crear Primer Proyecto',
    brazilian_portuguese: 'Criar Primeiro Projeto',
    tok_pisin: 'Mekim Nambawan Project',
    indonesian: 'Buat Proyek Pertama',
    nepali: 'पहिलो प्रोजेक्ट सिर्जना गर्नुहोस्',
    hindi: 'पहली परियोजना बनाएं',
    burmese: 'ပထမဆုံး စီမံကိန်း ဖန်တီးပါ',
    thai: 'สร้างโครงการแรก',
    mandarin: '创建第一个项目'
  },
  createNewProject: {
    english: 'Create New Project',
    spanish: 'Crear Nuevo Proyecto',
    nepali: 'नयाँ प्रोजेक्ट सिर्जना गर्नुहोस्',
    brazilian_portuguese: 'Criar Novo Projeto',
    tok_pisin: 'Mekim Nupela Project',
    indonesian: 'Buat Proyek Baru',
    hindi: 'नई परियोजना बनाएं',
    burmese: 'စီမံကိန်း အသစ် ဖန်တီးပါ',
    thai: 'สร้างโครงการใหม่',
    mandarin: '创建新项目'
  },
  existingProjectsInLanguage: {
    english: 'Existing projects in {language}',
    spanish: 'Proyectos existentes en {language}',
    brazilian_portuguese: 'Projetos existentes em {language}',
    tok_pisin: 'Ol project i stap pinis long {language}',
    indonesian: 'Proyek yang ada dalam {language}',
    nepali: '{language} मा अवस्थित प्रोजेक्टहरू',
    hindi: '{language} में मौजूदा परियोजनाएं',
    burmese: '{language} တွင် ရှိနေသော စီမံကိန်းများ',
    thai: 'โครงการที่มีอยู่ใน {language}',
    mandarin: '{language} 中的现有项目'
  },
  noProjectsInLanguage: {
    english: 'No projects yet in {language}',
    spanish: 'Aún no hay proyectos en {language}',
    brazilian_portuguese: 'Ainda não há projetos em {language}',
    tok_pisin: 'I no gat project yet long {language}',
    indonesian: 'Belum ada proyek dalam {language}',
    nepali: '{language} मा अहिलेसम्म कुनै प्रोजेक्ट छैन',
    hindi: '{language} में अभी तक कोई परियोजना नहीं',
    burmese: '{language} တွင် အခုထိ စီမံကိန်း မရှိသေးပါ',
    thai: 'ยังไม่มีโครงการใน {language}',
    mandarin: '{language} 中还没有项目'
  },
  searchLanguages: {
    english: 'Search languages...',
    spanish: 'Buscar idiomas...',
    brazilian_portuguese: 'Pesquisar idiomas...',
    tok_pisin: 'Painim ol tokples...',
    indonesian: 'Cari bahasa...',
    nepali: 'भाषाहरू खोज्नुहोस्...',
    hindi: 'भाषाएं खोजें...',
    burmese: 'ဘာသာစကားများကို ရှာဖွေပါ...',
    thai: 'ค้นหาภาษา...',
    mandarin: '搜索语言...'
  },
  noLanguagesFound: {
    english: 'No languages found',
    spanish: 'No se encontraron idiomas',
    brazilian_portuguese: 'Nenhum idioma encontrado',
    tok_pisin: 'I no gat tokples',
    indonesian: 'Tidak ada bahasa ditemukan',
    nepali: 'कुनै भाषा फेला परेन',
    hindi: 'कोई भाषा नहीं मिली',
    burmese: 'ဘာသာစကား မတွေ့ရှိပါ',
    thai: 'ไม่พบภาษา',
    mandarin: '未找到语言'
  },
  noLanguagesInRegion: {
    english:
      'No languages found in this region. You can create a new language below.',
    spanish:
      'No se encontraron idiomas en esta región. Puedes crear un nuevo idioma a continuación.',
    brazilian_portuguese:
      'Nenhum idioma encontrado nesta região. Você pode criar um novo idioma abaixo.',
    tok_pisin:
      'I no gat tokples long dispela region. Yu ken mekim nupela tokples long bihain.',
    indonesian:
      'Tidak ada bahasa ditemukan di wilayah ini. Anda dapat membuat bahasa baru di bawah ini.',
    nepali:
      'यस क्षेत्रमा कुनै भाषा फेला परेन। तपाईं तल नयाँ भाषा सिर्जना गर्न सक्नुहुन्छ।',
    hindi:
      'इस क्षेत्र में कोई भाषा नहीं मिली। आप नीचे एक नई भाषा बना सकते हैं।',
    burmese:
      'ဤဒေသတွင် ဘာသာစကား မတွေ့ရှိပါ။ သင်သည် အောက်တွင် ဘာသာစကား အသစ် ဖန်တီးနိုင်သည်။',
    thai: 'ไม่พบภาษาในภูมิภาคนี้ คุณสามารถสร้างภาษาใหม่ด้านล่างได้',
    mandarin: '此地区未找到语言。您可以在下面创建新语言。'
  },
  typeToSearch: {
    english: 'Type at least {min} characters to search',
    spanish: 'Escriba al menos {min} caracteres para buscar',
    brazilian_portuguese: 'Digite pelo menos {min} caracteres para pesquisar',
    tok_pisin: 'Raitim {min} leta bipo painim',
    indonesian: 'Ketik setidaknya {min} karakter untuk mencari',
    nepali: 'खोज्न कम्तिमा {min} अक्षर टाइप गर्नुहोस्',
    hindi: 'खोजने के लिए कम से कम {min} अक्षर टाइप करें',
    burmese: 'ရှာဖွေရန် အနည်းဆုံး {min} စာလုံး ရိုက်ထည့်ပါ',
    thai: 'พิมพ์อย่างน้อย {min} ตัวอักษรเพื่อค้นหา',
    mandarin: '输入至少 {min} 个字符进行搜索'
  },
  selectTemplate: {
    english: 'Please select a template',
    spanish: 'Por favor seleccione una plantilla',
    brazilian_portuguese: 'Por favor, selecione uma planta',
    tok_pisin: 'Plis makim wanpela template',
    indonesian: 'Silakan pilih template',
    nepali: 'कृपया एउटा टेम्प्लेट छान्नुहोस्',
    hindi: 'कृपया एक टेम्प्लेट चुनें',
    burmese: 'ကျေးဇူးပြု၍ ပုံစံတစ်ခုကို ရွေးချယ်ပါ',
    thai: 'กรุณาเลือกเทมเพลต',
    mandarin: '请选择一个模板'
  },
  sendResetEmail: {
    english: 'Send Reset Email',
    spanish: 'Enviar correo de restablecimiento',
    brazilian_portuguese: 'Enviar E-mail de Redefinição',
    tok_pisin: 'Salim Reset Email',
    indonesian: 'Kirim Email Reset',
    nepali: 'रिसेट इमेल पठाउनुहोस्',
    hindi: 'रीसेट ईमेल भेजें',
    burmese: 'ပြန်လည်သတ်မှတ်ရန် အီးမေးလ်ပို့ပါ',
    thai: 'ส่งอีเมลรีเซ็ต',
    mandarin: '发送重置电子邮件'
  },
  signIn: {
    english: 'Sign In',
    spanish: 'Iniciar Sesión',
    brazilian_portuguese: 'Entrar',
    tok_pisin: 'Sign In',
    indonesian: 'Masuk',
    nepali: 'साइन इन गर्नुहोस्',
    hindi: 'साइन इन करें',
    burmese: 'အကောင့်ဝင်ပါ',
    thai: 'เข้าสู่ระบบ',
    mandarin: '登录'
  },
  signInToSaveOrContribute: {
    english: 'Sign in to save or contribute to projects',
    spanish: 'Inicia sesión para guardar o contribuir a proyectos',
    brazilian_portuguese: 'Entre para salvar ou contribuir com projetos',
    tok_pisin: 'Sign in long seivim o helpim ol project',
    indonesian: 'Masuk untuk menyimpan atau berkontribusi pada proyek',
    nepali: 'प्रोजेक्टहरू सेभ गर्न वा योगदान गर्न साइन इन गर्नुहोस्',
    hindi: 'परियोजनाओं को सहेजने या योगदान देने के लिए साइन इन करें',
    burmese: 'စီမံကိန်းများကို သိမ်းဆည်းရန် သို့မဟုတ် ပံ့ပိုးရန် အကောင့်ဝင်ပါ',
    thai: 'เข้าสู่ระบบเพื่อบันทึกหรือมีส่วนร่วมในโครงการ',
    mandarin: '登录以保存或为项目做出贡献'
  },
  orBrowseAllProjects: {
    english: 'Or browse all public projects',
    spanish: 'O navega todos los proyectos públicos',
    brazilian_portuguese: 'Ou navegue por todos os projetos públicos',
    tok_pisin: 'O lukluk long olgeta public project',
    indonesian: 'Atau jelajahi semua proyek publik',
    nepali: 'वा सबै सार्वजनिक प्रोजेक्टहरू ब्राउज गर्नुहोस्',
    hindi: 'या सभी सार्वजनिक परियोजनाएं ब्राउज़ करें',
    burmese: 'သို့မဟုတ် လူထုစီမံကိန်းအားလုံးကို ရှာဖွေကြည့်ရှုပါ',
    thai: 'หรือเรียกดูโครงการสาธารณะทั้งหมด',
    mandarin: '或浏览所有公共项目'
  },
  viewAllProjects: {
    english: 'View All Projects',
    spanish: 'Ver Todos los Proyectos',
    brazilian_portuguese: 'Ver Todos os Projetos',
    tok_pisin: 'Lukim Olgeta Project',
    indonesian: 'Lihat Semua Proyek',
    nepali: 'सबै प्रोजेक्टहरू हेर्नुहोस्',
    hindi: 'सभी परियोजनाएं देखें',
    burmese: 'စီမံကိန်းအားလုံးကို ကြည့်ရှုပါ',
    thai: 'ดูโครงการทั้งหมด',
    mandarin: '查看所有项目'
  },
  signInError: {
    english: 'Something went wrong… Please, check your email and password.',
    spanish: 'Algo salió mal… Por favor, revisa tu correo y contraseña.',
    brazilian_portuguese:
      'Algo deu errado… Por favor, verifique seu e-mail e senha.',
    tok_pisin: 'Samting i rong... Plis checkum email na password bilong yu.',
    indonesian:
      'Terjadi kesalahan... Silakan periksa email dan kata sandi Anda.',
    nepali: 'केही गलत भयो… कृपया आफ्नो इमेल र पासवर्ड जाँच गर्नुहोस्।',
    hindi: 'कुछ गलत हो गया… कृपया अपना ईमेल और पासवर्ड जांचें।',
    burmese:
      'တစ်ခုခု မှားယွင်းနေပါသည်… ကျေးဇူးပြု၍ သင်၏ အီးမေးလ်နှင့် စကားဝှက်ကို စစ်ဆေးပါ။',
    thai: 'เกิดข้อผิดพลาด... กรุณาตรวจสอบอีเมลและรหัสผ่านของคุณ',
    mandarin: '出了点问题…请检查您的电子邮件和密码。'
  },
  logOut: {
    english: 'Log Out',
    spanish: 'Cerrar Sesión',
    brazilian_portuguese: 'Sair',
    tok_pisin: 'Log Out',
    indonesian: 'Keluar',
    nepali: 'लग आउट गर्नुहोस्',
    hindi: 'लॉग आउट करें',
    burmese: 'အကောင့်ထွက်ပါ',
    thai: 'ออกจากระบบ',
    mandarin: '登出'
  },
  sortBy: {
    english: 'Sort by',
    spanish: 'Ordenar por',
    brazilian_portuguese: 'Ordenar por',
    tok_pisin: 'Sortim long',
    indonesian: 'Urutkan berdasarkan',
    nepali: 'क्रमबद्ध गर्नुहोस्',
    hindi: 'क्रमबद्ध करें',
    burmese: 'အလိုက်စဉ်ပါ',
    thai: 'เรียงตาม',
    mandarin: '排序方式'
  },
  source: {
    english: 'Source',
    spanish: 'Fuente',
    brazilian_portuguese: 'Fonte',
    tok_pisin: 'Source',
    indonesian: 'Sumber',
    nepali: 'स्रोत',
    hindi: 'स्रोत',
    burmese: 'ရင်းမြစ်',
    thai: 'แหล่งที่มา',
    mandarin: '来源'
  },
  submit: {
    english: 'Submit',
    spanish: 'Enviar',
    brazilian_portuguese: 'Enviar',
    tok_pisin: 'Salim',
    indonesian: 'Kirim',
    nepali: 'पेश गर्नुहोस्',
    hindi: 'जमा करें',
    burmese: 'တင်သွင်းပါ',
    thai: 'ส่ง',
    mandarin: '提交'
  },
  success: {
    english: 'Success',
    spanish: 'Éxito',
    brazilian_portuguese: 'Sucesso',
    tok_pisin: 'Orait',
    indonesian: 'Berhasil',
    nepali: 'सफल',
    hindi: 'सफलता',
    burmese: 'အောင်မြင်မှု',
    thai: 'สำเร็จ',
    mandarin: '成功'
  },
  target: {
    english: 'Target',
    spanish: 'Objetivo',
    brazilian_portuguese: 'Alvo',
    tok_pisin: 'Target',
    indonesian: 'Target',
    nepali: 'लक्ष्य',
    hindi: 'लक्ष्य',
    burmese: 'ပစ်မှတ်',
    thai: 'เป้าหมาย',
    mandarin: '目标'
  },
  username: {
    english: 'Username',
    spanish: 'Nombre de usuario',
    brazilian_portuguese: 'Nome de usuário',
    tok_pisin: 'Username',
    indonesian: 'Nama pengguna',
    nepali: 'प्रयोगकर्ता नाम',
    hindi: 'उपयोगकर्ता नाम',
    burmese: 'အသုံးပြုသူအမည်',
    thai: 'ชื่อผู้ใช้',
    mandarin: '用户名'
  },
  usernameRequired: {
    english: 'Username is required',
    spanish: 'Se requiere nombre de usuario',
    brazilian_portuguese: 'Nome de usuário é obrigatório',
    tok_pisin: 'Username i mas',
    indonesian: 'Nama pengguna diperlukan',
    nepali: 'प्रयोगकर्ता नाम आवश्यक छ',
    hindi: 'उपयोगकर्ता नाम आवश्यक है',
    burmese: 'အသုံးပြုသူအမည် လိုအပ်ပါသည်',
    thai: 'ต้องใช้ชื่อผู้ใช้',
    mandarin: '需要用户名'
  },
  votes: {
    english: 'Votes',
    spanish: 'Votos',
    brazilian_portuguese: 'Votos',
    tok_pisin: 'Ol Vote',
    indonesian: 'Suara',
    nepali: 'मतहरू',
    hindi: 'वोट',
    burmese: 'မဲများ',
    thai: 'คะแนน',
    mandarin: '投票'
  },
  voting: {
    english: 'Voting',
    spanish: 'Votación',
    brazilian_portuguese: 'Votação',
    nepali: 'मतदान',
    hindi: 'मतदान',
    burmese: 'မဲပေးခြင်း',
    thai: 'การลงคะแนน',
    mandarin: '投票'
  },
  warning: {
    english: 'Warning',
    spanish: 'Advertencia',
    brazilian_portuguese: 'Aviso',
    tok_pisin: 'Warning',
    indonesian: 'Peringatan',
    nepali: 'चेतावनी',
    hindi: 'चेतावनी',
    burmese: 'သတိပေးချက်',
    thai: 'คำเตือน',
    mandarin: '警告'
  },
  welcome: {
    english: 'Welcome back, hero!',
    spanish: '¡Bienvenido de nuevo, héroe!',
    brazilian_portuguese: 'Bem-vindo de volta, herói!',
    tok_pisin: 'Welkam bek, hero!',
    indonesian: 'Selamat datang kembali, pahlawan!',
    nepali: 'फेरि स्वागत छ, नायक!',
    hindi: 'वापसी पर स्वागत है, नायक!',
    burmese: 'ပြန်လာရန် ကြိုဆိုပါသည်၊ သူရဲကောင်း!',
    thai: 'ยินดีต้อนรับกลับมา ฮีโร่!',
    mandarin: '欢迎回来，英雄！'
  },
  welcomeToApp: {
    english: 'Welcome',
    spanish: 'Bienvenido',
    brazilian_portuguese: 'Bem-vindo',
    tok_pisin: 'Welkam',
    indonesian: 'Selamat datang',
    nepali: 'स्वागत छ',
    hindi: 'स्वागत है',
    burmese: 'ကြိုဆိုပါသည်',
    thai: 'ยินดีต้อนรับ',
    mandarin: '欢迎'
  },
  recentlyVisited: {
    english: 'Recently Visited',
    spanish: 'Recientemente visitado',
    brazilian_portuguese: 'Visitados Recentemente',
    tok_pisin: 'Nupela taim visitim',
    indonesian: 'Baru Dikunjungi',
    nepali: 'हालसालै भ्रमण गरिएको',
    hindi: 'हाल ही में देखा गया',
    burmese: 'မကြာသေးမီ လည်ပတ်ခဲ့သည်',
    thai: 'เยี่ยมชมล่าสุด',
    mandarin: '最近访问'
  },
  assets: {
    english: 'Assets',
    spanish: 'Recursos',
    brazilian_portuguese: 'Recursos',
    tok_pisin: 'Ol Asset',
    indonesian: 'Aset',
    nepali: 'एसेटहरू',
    hindi: 'एसेट',
    burmese: 'ပိုင်ဆိုင်မှုများ',
    thai: 'สินทรัพย์',
    mandarin: '资产'
  },
  asset: {
    english: 'Asset',
    spanish: 'Recurso',
    brazilian_portuguese: 'Recurso',
    nepali: 'एसेट',
    hindi: 'एसेट',
    burmese: 'ပိုင်ဆိုင်မှု',
    thai: 'สินทรัพย์',
    mandarin: '资产'
  },
  deleteAssets: {
    english: 'Delete Assets',
    spanish: 'Eliminar recursos',
    brazilian_portuguese: 'Excluir recursos',
    tok_pisin: 'Rausim ol asset',
    indonesian: 'Hapus aset',
    nepali: 'एसेटहरू मेटाउनुहोस्',
    hindi: 'एसेट हटाएं',
    burmese: 'ပိုင်ဆိုင်မှုများကို ဖျက်ပါ',
    thai: 'ลบสินทรัพย์',
    mandarin: '删除资产'
  },
  deleteAssetsConfirmation: {
    english:
      'Are you sure you want to delete {count} asset(s)? This action cannot be undone.',
    spanish:
      '¿Estás seguro de que deseas eliminar {count} recurso(s)? Esta acción no se puede deshacer.',
    brazilian_portuguese:
      'Tem certeza de que deseja excluir {count} recurso(s)? Esta ação não pode ser desfeita.',
    tok_pisin:
      'Yu sua long rausim {count} asset? Dispela action i no inap senisim bek.',
    indonesian:
      'Apakah Anda yakin ingin menghapus {count} aset? Tindakan ini tidak dapat dibatalkan.',
    nepali:
      'के तपाईं निश्चित हुनुहुन्छ कि तपाईं {count} एसेट(हरू) मेटाउन चाहनुहुन्छ? यो कार्य पूर्ववत गर्न सकिँदैन।',
    hindi:
      'क्या आप वाकई {count} एसेट हटाना चाहते हैं? यह कार्रवाई पूर्ववत नहीं की जा सकती।',
    burmese:
      'သင်သည် {count} ပိုင်ဆိုင်မှုကို ဖျက်ရန် သေချာပါသလား? ဤလုပ်ဆောင်ချက်ကို ပြန်လည်ပြုပြင်မရပါ။',
    thai: 'คุณแน่ใจหรือไม่ว่าต้องการลบสินทรัพย์ {count} รายการ? การดำเนินการนี้ไม่สามารถยกเลิกได้',
    mandarin: '您确定要删除 {count} 个资产吗？此操作无法撤消。'
  },
  selected: {
    english: 'selected',
    spanish: 'seleccionado(s)',
    brazilian_portuguese: 'selecionado(s)',
    tok_pisin: 'selected',
    indonesian: 'terpilih',
    nepali: 'चयन गरिएको'
  },
  delete: {
    english: 'Delete',
    spanish: 'Eliminar',
    brazilian_portuguese: 'Excluir',
    tok_pisin: 'Rausim',
    indonesian: 'Hapus',
    nepali: 'मेटाउनुहोस्',
    hindi: 'हटाएं',
    burmese: 'ဖျက်ပါ',
    thai: 'ลบ',
    mandarin: '删除'
  },
  mergeAssets: {
    english: 'Merge Assets',
    spanish: 'Combinar recursos',
    brazilian_portuguese: 'Mesclar recursos',
    tok_pisin: 'Joinim ol asset',
    indonesian: 'Gabungkan aset',
    nepali: 'एसेटहरू मर्ज गर्नुहोस्',
    hindi: 'एसेट मर्ज करें',
    burmese: 'ပိုင်ဆိုင်မှုများကို ပေါင်းစပ်ပါ',
    thai: 'รวมสินทรัพย์',
    mandarin: '合并资产'
  },
  mergeAssetsConfirmation: {
    english:
      'Are you sure you want to merge {count} assets? The audio segments will be combined into the first selected asset, and the others will be deleted.',
    spanish:
      '¿Estás seguro de que deseas combinar {count} recursos? Los segmentos de audio se combinarán en el primer recurso seleccionado y los demás se eliminarán.',
    brazilian_portuguese:
      'Tem certeza de que deseja mesclar {count} recursos? Os segmentos de áudio serão combinados no primeiro recurso selecionado e os outros serão excluídos.',
    tok_pisin:
      'Yu sua long joinim {count} asset? Ol audio segment bai joinim wantaim first asset yu makim, na ol narapela bai raus.',
    indonesian:
      'Apakah Anda yakin ingin menggabungkan {count} aset? Segmen audio akan digabungkan ke aset pertama yang dipilih, dan yang lainnya akan dihapus.',
    nepali:
      'के तपाईं निश्चित हुनुहुन्छ कि तपाईं {count} एसेटहरू मर्ज गर्न चाहनुहुन्छ? अडियो खण्डहरू पहिलो चयन गरिएको एसेटमा संयोजन हुनेछन्, र अरूहरू मेटिनेछन्।',
    hindi:
      'क्या आप वाकई {count} एसेट मर्ज करना चाहते हैं? ऑडियो सेगमेंट पहले चयनित एसेट में संयोजित हो जाएंगे, और अन्य हटा दिए जाएंगे।',
    burmese:
      'သင်သည် {count} ပိုင်ဆိုင်မှုများကို ပေါင်းစပ်ရန် သေချာပါသလား? အသံအပိုင်းများကို ပထမဆုံး ရွေးချယ်ထားသော ပိုင်ဆိုင်မှုသို့ ပေါင်းစပ်ပါမည်၊ အခြားများကို ဖျက်ပါမည်။',
    thai: 'คุณแน่ใจหรือไม่ว่าต้องการรวมสินทรัพย์ {count} รายการ? ส่วนเสียงจะถูกรวมเข้ากับสินทรัพย์แรกที่เลือก และรายการอื่นๆ จะถูกลบ',
    mandarin:
      '您确定要合并 {count} 个资产吗？音频片段将合并到第一个选定的资产中，其他资产将被删除。'
  },
  merge: {
    english: 'Merge',
    spanish: 'Combinar',
    brazilian_portuguese: 'Mesclar',
    tok_pisin: 'Joinim',
    indonesian: 'Gabungkan',
    nepali: 'मर्ज गर्नुहोस्',
    hindi: 'मर्ज करें',
    burmese: 'ပေါင်းစပ်ပါ',
    thai: 'รวม',
    mandarin: '合并'
  },
  failedToMergeAssets: {
    english: 'Failed to merge assets. Please try again.',
    spanish: 'Error al combinar los recursos. Por favor, inténtalo de nuevo.',
    brazilian_portuguese:
      'Falha ao mesclar recursos. Por favor, tente novamente.',
    tok_pisin: 'I no inap joinim ol asset. Plis traim gen.',
    indonesian: 'Gagal menggabungkan aset. Silakan coba lagi.',
    nepali: 'एसेटहरू मर्ज गर्न असफल। कृपया पुन: प्रयास गर्नुहोस्।',
    hindi: 'एसेट मर्ज करने में विफल। कृपया पुनः प्रयास करें।',
    burmese:
      'ပိုင်ဆိုင်မှုများကို ပေါင်းစပ်၍မရပါ။ ကျေးဇူးပြု၍ ထပ်မံကြိုးစားပါ။',
    thai: 'รวมสินทรัพย์ไม่สำเร็จ กรุณาลองอีกครั้ง',
    mandarin: '合并资产失败。请重试。'
  },
  failedToDeleteAssets: {
    english: 'Failed to delete assets. Please try again.',
    spanish: 'Error al eliminar los recursos. Por favor, inténtalo de nuevo.',
    brazilian_portuguese:
      'Falha ao excluir recursos. Por favor, tente novamente.',
    tok_pisin: 'I no inap rausim ol asset. Plis traim gen.',
    indonesian: 'Gagal menghapus aset. Silakan coba lagi.',
    nepali: 'एसेटहरू मेटाउन असफल। कृपया पुन: प्रयास गर्नुहोस्।',
    hindi: 'एसेट हटाने में विफल। कृपया पुनः प्रयास करें।',
    burmese: 'ပိုင်ဆိုင်မှုများကို ဖျက်၍မရပါ။ ကျေးဇူးပြု၍ ထပ်မံကြိုးစားပါ။',
    thai: 'ลบสินทรัพย์ไม่สำเร็จ กรุณาลองอีกครั้ง',
    mandarin: '删除资产失败。请重试。'
  },
  errorLoadingAssets: {
    english: 'Error loading assets',
    spanish: 'Error al cargar los recursos',
    brazilian_portuguese: 'Erro ao carregar recursos',
    tok_pisin: 'Rong long loadim ol asset',
    indonesian: 'Kesalahan memuat aset',
    nepali: 'एसेटहरू लोड गर्न त्रुटि',
    hindi: 'एसेट लोड करने में त्रुटि',
    burmese: 'ပိုင်ဆိုင်မှုများကို လုပ်ဆောင်၍မရပါ',
    thai: 'เกิดข้อผิดพลาดในการโหลดสินทรัพย์',
    mandarin: '加载资产时出错'
  },
  noAssetsYetStartRecording: {
    english: 'No assets yet. Start recording to create your first asset.',
    spanish:
      'Aún no hay recursos. Comienza a grabar para crear tu primer recurso.',
    brazilian_portuguese:
      'Ainda não há recursos. Comece a gravar para criar seu primeiro recurso.',
    tok_pisin:
      'I no gat asset yet. Statim recording long kamapim first asset bilong yu.',
    indonesian:
      'Belum ada aset. Mulai merekam untuk membuat aset pertama Anda.',
    nepali:
      'अहिलेसम्म कुनै एसेट छैन। तपाईंको पहिलो एसेट सिर्जना गर्न रेकर्डिङ सुरु गर्नुहोस्।',
    hindi:
      'अभी तक कोई एसेट नहीं। अपना पहला एसेट बनाने के लिए रिकॉर्डिंग शुरू करें।',
    burmese:
      'အခုထိ ပိုင်ဆိုင်မှု မရှိသေးပါ။ သင်၏ ပထမဆုံး ပိုင်ဆိုင်မှုကို ဖန်တီးရန် မှတ်တမ်းတင်ခြင်းကို စတင်ပါ။',
    thai: 'ยังไม่มีสินทรัพย์ เริ่มบันทึกเพื่อสร้างสินทรัพย์แรกของคุณ',
    mandarin: '还没有资产。开始录制以创建您的第一个资产。'
  },
  remaining: {
    english: 'remaining',
    spanish: 'restante',
    brazilian_portuguese: 'restante',
    tok_pisin: 'stap yet',
    indonesian: 'tersisa',
    nepali: 'बाँकी',
    hindi: 'शेष',
    burmese: 'ကျန်ရှိ',
    thai: 'เหลืออยู่',
    mandarin: '剩余'
  },
  noNotifications: {
    english: 'No notifications',
    spanish: 'No hay notificaciones',
    brazilian_portuguese: 'Nenhuma notificação',
    tok_pisin: 'No gat notification',
    indonesian: 'Tidak ada notifikasi',
    nepali: 'कुनै सूचना छैन',
    hindi: 'कोई सूचना नहीं',
    burmese: 'အကြောင်းကြားချက် မရှိပါ',
    thai: 'ไม่มีการแจ้งเตือน',
    mandarin: '无通知'
  },
  noNotificationsSubtext: {
    english: "You'll see project invitations and join requests here",
    spanish: 'Aquí verás invitaciones a proyectos y solicitudes de unión',
    brazilian_portuguese:
      'Aqui você verá convites para projetos e solicitações de união',
    tok_pisin: 'Yu bai lukim ol project invitation na join request long hia',
    indonesian:
      'Anda akan melihat undangan proyek dan permintaan bergabung di sini',
    nepali:
      'तपाईंले यहाँ प्रोजेक्ट निमन्त्रणा र सामेल हुने अनुरोधहरू देख्नुहुनेछ',
    hindi: 'आप यहाँ परियोजना निमंत्रण और शामिल होने के अनुरोध देखेंगे',
    burmese:
      'သင်သည် ဤနေရာတွင် စီမံကိန်း ဖိတ်ခေါ်မှုများနှင့် ပါဝင်ရန် တောင်းဆိုမှုများကို မြင်ရပါမည်',
    thai: 'คุณจะเห็นคำเชิญโครงการและคำขอเข้าร่วมที่นี่',
    mandarin: '您将在此处看到项目邀请和加入请求'
  },
  notifications: {
    english: 'Notifications',
    spanish: 'Notificaciones',
    brazilian_portuguese: 'Notificações',
    tok_pisin: 'Ol Notification',
    indonesian: 'Notifikasi',
    nepali: 'सूचनाहरू',
    hindi: 'सूचनाएं',
    burmese: 'အကြောင်းကြားချက်များ',
    thai: 'การแจ้งเตือน',
    mandarin: '通知'
  },
  profile: {
    english: 'Profile',
    spanish: 'Perfil',
    brazilian_portuguese: 'Perfil',
    tok_pisin: 'Profile',
    indonesian: 'Profil',
    nepali: 'प्रोफाइल',
    hindi: 'प्रोफ़ाइल',
    burmese: 'ကိုယ်ရေးအကျဉ်း',
    thai: 'โปรไฟล์',
    mandarin: '个人资料'
  },
  settings: {
    english: 'Settings',
    spanish: 'Configuración',
    brazilian_portuguese: 'Configurações',
    tok_pisin: 'Settings',
    indonesian: 'Pengaturan',
    nepali: 'सेटिङहरू',
    hindi: 'सेटिंग्स',
    burmese: 'ဆက်တင်များ',
    thai: 'การตั้งค่า',
    mandarin: '设置'
  },
  changePassword: {
    english: 'Change Password',
    spanish: 'Cambiar Contraseña',
    brazilian_portuguese: 'Alterar Senha',
    tok_pisin: 'Senisim Password',
    indonesian: 'Ubah Kata Sandi',
    nepali: 'पासवर्ड परिवर्तन गर्नुहोस्',
    hindi: 'पासवर्ड बदलें',
    burmese: 'စကားဝှက်ကို ပြောင်းလဲပါ',
    thai: 'เปลี่ยนรหัสผ่าน',
    mandarin: '更改密码'
  },
  currentPassword: {
    english: 'Current Password',
    spanish: 'Contraseña Actual',
    brazilian_portuguese: 'Senha Atual',
    tok_pisin: 'Password bilong nau',
    indonesian: 'Kata Sandi Saat Ini',
    nepali: 'हालको पासवर्ड',
    hindi: 'वर्तमान पासवर्ड',
    burmese: 'လက်ရှိ စကားဝှက်',
    thai: 'รหัสผ่านปัจจุบัน',
    mandarin: '当前密码'
  },
  newPassword: {
    english: 'New Password',
    spanish: 'Nueva Contraseña',
    brazilian_portuguese: 'Nova Senha',
    tok_pisin: 'Nupela Password',
    indonesian: 'Kata Sandi Baru',
    nepali: 'नयाँ पासवर्ड',
    hindi: 'नया पासवर्ड',
    burmese: 'စကားဝှက် အသစ်',
    thai: 'รหัสผ่านใหม่',
    mandarin: '新密码'
  },
  onlineOnlyFeatures: {
    english: 'Password changes are only available when online',
    spanish:
      'Los cambios de contraseña solo están disponibles cuando está en línea',
    brazilian_portuguese:
      'Alterações de senha só estão disponíveis quando você está online',
    tok_pisin: 'Password senisim i ken long taim yu gat internet tasol',
    indonesian: 'Perubahan kata sandi hanya tersedia saat online',
    nepali: 'पासवर्ड परिवर्तन अनलाइन हुँदा मात्र उपलब्ध छ',
    hindi: 'पासवर्ड परिवर्तन केवल ऑनलाइन होने पर उपलब्ध हैं',
    burmese:
      'စကားဝှက် ပြောင်းလဲမှုများသည် အင်တာနက်ရှိသောအချိန်တွင်သာ ရရှိနိုင်သည်',
    thai: 'การเปลี่ยนรหัสผ่านมีให้เฉพาะเมื่อออนไลน์',
    mandarin: '密码更改仅在在线时可用'
  },
  accountDeletionRequiresOnline: {
    english: 'You must be online to delete your account',
    spanish: 'Debes estar en línea para eliminar tu cuenta',
    brazilian_portuguese: 'Você deve estar online para excluir sua conta',
    tok_pisin: 'Yu mas gat internet long rausim account bilong yu',
    indonesian: 'Anda harus online untuk menghapus akun Anda',
    nepali: 'आफ्नो खाता मेटाउन तपाईं अनलाइन हुनुपर्छ',
    hindi: 'अपना खाता हटाने के लिए आपको ऑनलाइन होना होगा',
    burmese: 'သင်၏ အကောင့်ကို ဖျက်ရန် သင်သည် အင်တာနက်ရှိရမည်',
    thai: 'คุณต้องออนไลน์เพื่อลบบัญชีของคุณ',
    mandarin: '您必须在线才能删除您的账户'
  },
  termsAndPrivacyTitle: {
    english: 'Terms & Privacy',
    spanish: 'Términos y Privacidad',
    brazilian_portuguese: 'Termos e Privacidade',
    tok_pisin: 'Terms na Privacy',
    indonesian: 'Syarat & Privasi',
    nepali: 'सर्तहरू र गोपनीयता',
    hindi: 'नियम और गोपनीयता',
    burmese: 'စည်းမျဉ်းများနှင့် ကိုယ်ရေးလုံခြုံမှု',
    thai: 'ข้อกำหนดและความเป็นส่วนตัว',
    mandarin: '条款和隐私'
  },
  verificationRequired: {
    english: 'Verification Required',
    spanish: 'Verificación Requerida',
    brazilian_portuguese: 'Verificação Necessária',
    tok_pisin: 'Verification i mas',
    indonesian: 'Verifikasi Diperlukan',
    nepali: 'प्रमाणीकरण आवश्यक छ',
    hindi: 'सत्यापन आवश्यक',
    burmese: 'အတည်ပြုခြင်း လိုအပ်ပါသည်',
    thai: 'ต้องยืนยัน',
    mandarin: '需要验证'
  },
  agreeToTerms: {
    english: 'I have read and agree to the {link}',
    spanish: 'He leído y acepto los {link}',
    brazilian_portuguese: 'Eu li e concordo com os {link}',
    tok_pisin: 'Mi ridim na agri long {link}',
    indonesian: 'Saya telah membaca dan menyetujui {link}',
    nepali: 'मैले {link} पढेको छु र स्वीकार गर्छु',
    hindi: 'मैंने {link} पढ़ ली है और सहमत हूं',
    burmese: 'ကျွန်ုပ်သည် {link} ကို ဖတ်ရှုပြီး သဘောတူပါသည်',
    thai: 'ฉันได้อ่านและยอมรับ{link}แล้ว',
    mandarin: '我已阅读并同意{link}'
  },
  termsAndPrivacyLink: {
    english: 'Terms & Privacy',
    spanish: 'Términos y Privacidad',
    brazilian_portuguese: 'Termos e Privacidade',
    tok_pisin: 'Terms na Privacy',
    indonesian: 'Syarat & Privasi',
    nepali: 'सर्तहरू र गोपनीयता',
    hindi: 'नियम और गोपनीयता',
    burmese: 'စည်းမျဉ်းများနှင့် ကိုယ်ရေးလုံခြုံမှု',
    thai: 'ข้อกำหนดและความเป็นส่วนตัว',
    mandarin: '条款和隐私'
  },
  viewTerms: {
    english: 'View Terms and Privacy',
    spanish: 'Ver Términos y Privacidad',
    brazilian_portuguese: 'Ver Termos e Privacidade',
    tok_pisin: 'Lukim Terms na Privacy',
    indonesian: 'Lihat Syarat dan Privasi',
    nepali: 'सर्तहरू र गोपनीयता हेर्नुहोस्',
    hindi: 'नियम और गोपनीयता देखें',
    burmese: 'စည်းမျဉ်းများနှင့် ကိုယ်ရေးလုံခြုံမှုကို ကြည့်ရှုပါ',
    thai: 'ดูข้อกำหนดและความเป็นส่วนตัว',
    mandarin: '查看条款和隐私'
  },
  termsRequired: {
    english: 'You must agree to the Terms and Privacy',
    spanish: 'Debe aceptar los Términos y Privacidad',
    brazilian_portuguese: 'Você deve concordar com os Termos e Privacidade',
    tok_pisin: 'Yu mas agri long Terms na Privacy',
    indonesian: 'Anda harus menyetujui Syarat dan Privasi',
    nepali: 'तपाईंले सर्तहरू र गोपनीयता स्वीकार गर्नुपर्छ',
    hindi: 'आपको नियम और गोपनीयता से सहमत होना होगा',
    burmese: 'သင်သည် စည်းမျဉ်းများနှင့် ကိုယ်ရေးလုံခြုံမှုကို သဘောတူရမည်',
    thai: 'คุณต้องยอมรับข้อกำหนดและความเป็นส่วนตัว',
    mandarin: '您必须同意条款和隐私'
  },
  processing: {
    english: 'Processing...',
    spanish: 'Procesando...',
    brazilian_portuguese: 'Processando...',
    tok_pisin: 'Processing...',
    indonesian: 'Memproses...',
    nepali: 'प्रशोधन हुँदैछ...',
    hindi: 'प्रसंस्करण हो रहा है...',
    burmese: 'လုပ်ဆောင်နေသည်...',
    thai: 'กำลังประมวลผล...',
    mandarin: '正在处理...'
  },
  termsContributionInfo: {
    english:
      'By tapping {iAgree}, you agree that all content you contribute to LangQuest will be freely available worldwide under the CC0 1.0 Universal (CC0 1.0) Public Domain Dedication.',
    spanish:
      'Al tocar {iAgree}, acepta que todo el contenido que aporte a LangQuest estará disponible gratuitamente en todo el mundo bajo la Dedicación de Dominio Público CC0 1.0 Universal (CC0 1.0).',
    brazilian_portuguese:
      'Ao tocar {iAgree}, você concorda que todo o conteúdo que você contribuir para o LangQuest estará disponível gratuitamente em todo o mundo sob a Dedicação ao Domínio Público CC0 1.0 Universal (CC0 1.0).',
    tok_pisin:
      'Long paitim {iAgree}, yu agri long olgeta content yu contributim long LangQuest bai stap fri long olgeta hap long CC0 1.0 Universal (CC0 1.0) Public Domain Dedication.',
    indonesian:
      'Dengan mengetuk {iAgree}, Anda setuju bahwa semua konten yang Anda kontribusikan ke LangQuest akan tersedia secara gratis di seluruh dunia di bawah CC0 1.0 Universal (CC0 1.0) Public Domain Dedication.',
    nepali:
      '{iAgree} थिचेर, तपाईं सहमत हुनुहुन्छ कि तपाईंले LangQuest मा योगदान गर्ने सबै सामग्री CC0 1.0 Universal (CC0 1.0) Public Domain Dedication अन्तर्गत विश्वव्यापी रूपमा नि:शुल्क उपलब्ध हुनेछ।',
    hindi:
      '{iAgree} टैप करके, आप सहमत हैं कि LangQuest में आपके द्वारा योगदान की गई सभी सामग्री CC0 1.0 Universal (CC0 1.0) Public Domain Dedication के तहत दुनिया भर में स्वतंत्र रूप से उपलब्ध होगी।',
    burmese:
      '{iAgree} ကို နှိပ်ခြင်းဖြင့်၊ သင်သည် LangQuest သို့ ပံ့ပိုးသော အကြောင်းအရာအားလုံးသည် CC0 1.0 Universal (CC0 1.0) Public Domain Dedication အောက်တွင် ကမ္ဘာတစ်ဝှမ်းလုံး လွတ်လပ်စွာ ရရှိနိုင်မည်ဟု သဘောတူပါသည်။',
    thai: 'โดยการแตะ{iAgree} คุณยอมรับว่าสื่อสารทั้งหมดที่คุณมีส่วนร่วมใน LangQuest จะสามารถใช้ได้ฟรีทั่วโลกภายใต้ CC0 1.0 Universal (CC0 1.0) Public Domain Dedication',
    mandarin:
      '通过点击{iAgree}，您同意您为 LangQuest 贡献的所有内容将在 CC0 1.0 Universal (CC0 1.0) Public Domain Dedication 下在全球范围内免费提供。'
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
      'Ini berarti kontribusi Anda dapat digunakan oleh siapa saja untuk tujuan apa pun tanpa atribusi. Kami mengumpulkan data pengguna minimal: hanya email Anda (untuk pemulihan akun) dan langganan newsletter jika dipilih.',
    nepali:
      'यसको मतलब तपाईंको योगदान कुनै पनि व्यक्तिले कुनै पनि उद्देश्यको लागि श्रेय बिना प्रयोग गर्न सक्छ। हामी न्यूनतम प्रयोगकर्ता डाटा सङ्कलन गर्छौं: तपाईंको इमेल मात्र (खाता पुनर्प्राप्तिको लागि) र न्यूजलेटर सदस्यता यदि रोजिएको छ भने।',
    hindi:
      'इसका मतलब है कि आपके योगदान का उपयोग कोई भी किसी भी उद्देश्य के लिए श्रेय के बिना कर सकता है। हम न्यूनतम उपयोगकर्ता डेटा एकत्र करते हैं: केवल आपका ईमेल (खाता पुनर्प्राप्ति के लिए) और न्यूज़लेटर सदस्यता यदि चुनी गई है।',
    burmese:
      '၎င်းသည် သင်၏ ပံ့ပိုးမှုများကို မည်သူမဆို မည်သည့်ရည်ရွယ်ချက်အတွက်မဆို အာတ်ထရီဘျူးရှင်းမပါဘဲ အသုံးပြုနိုင်သည်ဟု ဆိုလိုသည်။ ကျွန်ုပ်တို့သည် အနည်းဆုံး အသုံးပြုသူဒေတာကို စုဆောင်းပါသည်: သင်၏ အီးမေးလ် (အကောင့် ပြန်လည်ရယူရန်) နှင့် သတင်းလွှာစာရင်းသွင်းခြင်း (ရွေးချယ်ထားပါက)။',
    thai: 'นี่หมายความว่าการมีส่วนร่วมของคุณสามารถใช้โดยใครก็ได้เพื่อวัตถุประสงค์ใดๆ โดยไม่ต้องระบุแหล่งที่มา เรารวบรวมข้อมูลผู้ใช้ขั้นต่ำ: เฉพาะอีเมลของคุณ (สำหรับการกู้คืนบัญชี) และการสมัครรับจดหมายข่าวหากเลือก',
    mandarin:
      '这意味着您的贡献可以被任何人用于任何目的，无需署名。我们收集最少的用户数据：仅您的电子邮件（用于账户恢复）和新闻订阅（如果选择）。'
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
      'Kami mengumpulkan data analitik dan diagnostik untuk meningkatkan aplikasi dan pengalaman Anda. Anda dapat memilih keluar dari analitik kapan saja di pengaturan profil Anda. Data Anda diproses dan disimpan di Amerika Serikat.',
    nepali:
      'हामी एप र तपाईंको अनुभव सुधार गर्न विश्लेषण र निदान डाटा सङ्कलन गर्छौं। तपाईं आफ्नो प्रोफाइल सेटिङहरूमा जुनसुकै समय विश्लेषणबाट अप्ट आउट गर्न सक्नुहुन्छ। तपाईंको डाटा संयुक्त राज्य अमेरिकामा प्रशोधन र भण्डारण गरिन्छ।',
    hindi:
      'हम एप और आपके अनुभव को बेहतर बनाने के लिए विश्लेषण और नैदानिक डेटा एकत्र करते हैं। आप अपनी प्रोफ़ाइल सेटिंग्स में किसी भी समय विश्लेषण से बाहर निकल सकते हैं। आपका डेटा संयुक्त राज्य अमेरिका में संसाधित और संग्रहीत किया जाता है।',
    burmese:
      'ကျွန်ုပ်တို့သည် အပ်ကို နှင့် သင်၏ အတွေ့အကြုံကို မြှင့်တင်ရန် ခွဲခြမ်းစိတ်ဖြာမှုနှင့် ရောဂါရှာဖွေရေး ဒေတာများကို စုဆောင်းပါသည်။ သင်သည် သင်၏ ကိုယ်ရေးအကျဉ်း ဆက်တင်များတွင် မည်သည့်အချိန်တွင်မဆို ခွဲခြမ်းစိတ်ဖြာမှုမှ ထွက်နိုင်သည်။ သင်၏ ဒေတာကို အမေရိကန်ပြည်ထောင်စုတွင် လုပ်ဆောင်ပြီး သိမ်းဆည်းပါသည်။',
    thai: 'เรารวบรวมข้อมูลการวิเคราะห์และการวินิจฉัยเพื่อปรับปรุงแอปและประสบการณ์ของคุณ คุณสามารถเลือกไม่ใช้การวิเคราะห์ได้ตลอดเวลาในการตั้งค่าโปรไฟล์ของคุณ ข้อมูลของคุณถูกประมวลผลและจัดเก็บในสหรัฐอเมริกา',
    mandarin:
      '我们收集分析和诊断数据以改进应用程序和您的体验。您可以随时在个人资料设置中选择退出分析。您的数据在美国处理和存储。'
  },
  viewFullTerms: {
    english: 'View Full Terms',
    spanish: 'Ver Términos Completos',
    brazilian_portuguese: 'Ver Termos Completos',
    tok_pisin: 'Lukim Olgeta Terms',
    indonesian: 'Lihat Syarat Lengkap',
    nepali: 'पूर्ण सर्तहरू हेर्नुहोस्',
    hindi: 'पूर्ण नियम देखें',
    burmese: 'စည်းမျဉ်းအားလုံးကို ကြည့်ရှုပါ',
    thai: 'ดูข้อกำหนดฉบับเต็ม',
    mandarin: '查看完整条款'
  },
  viewFullPrivacy: {
    english: 'View Full Privacy',
    spanish: 'Ver Privacidad Completa',
    brazilian_portuguese: 'Ver Privacidade Completa',
    tok_pisin: 'Lukim Olgeta Privacy',
    indonesian: 'Lihat Privasi Lengkap',
    nepali: 'पूर्ण गोपनीयता हेर्नुहोस्',
    hindi: 'पूर्ण गोपनीयता देखें',
    burmese: 'ကိုယ်ရေးလုံခြုံမှု အားလုံးကို ကြည့်ရှုပါ',
    thai: 'ดูความเป็นส่วนตัวฉบับเต็ม',
    mandarin: '查看完整隐私'
  },
  submitFeedback: {
    english: 'Submit Feedback',
    spanish: 'Enviar Feedback',
    brazilian_portuguese: 'Enviar Feedback',
    tok_pisin: 'Salim Feedback',
    indonesian: 'Kirim Umpan Balik',
    nepali: 'प्रतिक्रिया पेश गर्नुहोस्',
    hindi: 'प्रतिक्रिया जमा करें',
    burmese: 'အကြံပြုချက်ကို တင်သွင်းပါ',
    thai: 'ส่งข้อเสนอแนะ',
    mandarin: '提交反馈'
  },
  reportProject: {
    english: 'Report Project',
    spanish: 'Reportar Proyecto',
    brazilian_portuguese: 'Reportar Projeto',
    nepali: 'प्रोजेक्ट रिपोर्ट गर्नुहोस्',
    hindi: 'परियोजना रिपोर्ट करें',
    burmese: 'စီမံကိန်းကို သတင်းပို့ပါ',
    thai: 'รายงานโครงการ',
    mandarin: '报告项目'
  },
  reportQuest: {
    english: 'Report Quest',
    spanish: 'Reportar Quest',
    brazilian_portuguese: 'Reportar Quest',
    nepali: 'क्वेस्ट रिपोर्ट गर्नुहोस्',
    hindi: 'क्वेस्ट रिपोर्ट करें',
    burmese: 'Quest ကို သတင်းပို့ပါ',
    thai: 'รายงานเควสต์',
    mandarin: '报告任务'
  },
  reportAsset: {
    english: 'Report Asset',
    spanish: 'Reportar Recurso',
    brazilian_portuguese: 'Reportar Recurso',
    nepali: 'एसेट रिपोर्ट गर्नुहोस्',
    hindi: 'एसेट रिपोर्ट करें',
    burmese: 'ပိုင်ဆိုင်မှုကို သတင်းပို့ပါ',
    thai: 'รายงานสินทรัพย์',
    mandarin: '报告资产'
  },
  reportTranslation: {
    english: 'Report Translation',
    spanish: 'Reportar Traducción',
    brazilian_portuguese: 'Reportar Tradução',
    tok_pisin: 'Reportim Translation',
    indonesian: 'Laporkan Terjemahan',
    nepali: 'अनुवाद रिपोर्ट गर्नुहोस्',
    hindi: 'अनुवाद रिपोर्ट करें',
    burmese: 'ဘာသာပြန်ဆိုချက်ကို သတင်းပို့ပါ',
    thai: 'รายงานคำแปล',
    mandarin: '报告翻译'
  },
  reportGeneric: {
    english: 'Report',
    spanish: 'Reportar',
    brazilian_portuguese: 'Reportar',
    nepali: 'रिपोर्ट गर्नुहोस्',
    hindi: 'रिपोर्ट करें',
    burmese: 'သတင်းပို့ပါ',
    thai: 'รายงาน',
    mandarin: '报告'
  },
  selectReasonLabel: {
    english: 'Select a reason',
    spanish: 'Seleccione un motivo',
    brazilian_portuguese: 'Selecione um motivo',
    tok_pisin: 'Makim wanpela reson',
    indonesian: 'Pilih alasan',
    nepali: 'एउटा कारण चयन गर्नुहोस्',
    hindi: 'एक कारण चुनें',
    burmese: 'အကြောင်းပြချက်တစ်ခုကို ရွေးချယ်ပါ',
    thai: 'เลือกเหตุผล',
    mandarin: '选择原因'
  },
  additionalDetails: {
    english: 'Additional Details',
    spanish: 'Detalles Adicionales',
    brazilian_portuguese: 'Detalhes Adicionais',
    tok_pisin: 'Moa Details',
    indonesian: 'Detail Tambahan',
    nepali: 'थप विवरणहरू',
    hindi: 'अतिरिक्त विवरण',
    burmese: 'အပိုအသေးစိတ်များ',
    thai: 'รายละเอียดเพิ่มเติม',
    mandarin: '其他详细信息'
  },
  additionalDetailsPlaceholder: {
    english: 'Provide any additional information...',
    spanish: 'Proporcionar cualquier información adicional...',
    brazilian_portuguese: 'Forneça qualquer informação adicional...',
    tok_pisin: 'Givim narapela information...',
    indonesian: 'Berikan informasi tambahan...',
    nepali: 'कुनै थप जानकारी प्रदान गर्नुहोस्...',
    hindi: 'कोई अतिरिक्त जानकारी प्रदान करें...',
    burmese: 'မည်သည့် အပို အချက်အလက်ကိုမဆို ပေးပါ...',
    thai: 'ให้ข้อมูลเพิ่มเติมใดๆ...',
    mandarin: '提供任何其他信息...'
  },
  submitReport: {
    english: 'Submit Report',
    spanish: 'Enviar Reporte',
    brazilian_portuguese: 'Enviar Relatório',
    tok_pisin: 'Salim Report',
    indonesian: 'Kirim Laporan',
    nepali: 'रिपोर्ट पेश गर्नुहोस्',
    hindi: 'रिपोर्ट जमा करें',
    burmese: 'သတင်းပို့ချက်ကို တင်သွင်းပါ',
    thai: 'ส่งรายงาน',
    mandarin: '提交报告'
  },
  submitting: {
    english: 'Submitting...',
    spanish: 'Enviando...',
    brazilian_portuguese: 'Enviando...',
    tok_pisin: 'Salim...',
    indonesian: 'Mengirim...',
    nepali: 'पेश गर्दै...',
    hindi: 'जमा कर रहे हैं...',
    burmese: 'တင်သွင်းနေသည်...',
    thai: 'กำลังส่ง...',
    mandarin: '正在提交...'
  },
  reportSubmitted: {
    english: 'Report submitted successfully',
    spanish: 'Reporte enviado exitosamente',
    brazilian_portuguese: 'Relatório enviado com sucesso',
    tok_pisin: 'Report i go gut',
    indonesian: 'Laporan berhasil dikirim',
    nepali: 'रिपोर्ट सफलतापूर्वक पेश गरियो',
    hindi: 'रिपोर्ट सफलतापूर्वक जमा हो गई',
    burmese: 'သတင်းပို့ချက်ကို အောင်မြင်စွာ တင်သွင်းပြီးပါပြီ',
    thai: 'ส่งรายงานสำเร็จ',
    mandarin: '报告提交成功'
  },
  enterEmailForPasswordReset: {
    english: 'Enter your email to reset your password',
    spanish: 'Ingrese su email para restablecer su contraseña',
    brazilian_portuguese: 'Digite seu e-mail para redefinir sua senha',
    tok_pisin: 'Putim email bilong yu long resetim password',
    indonesian: 'Masukkan email Anda untuk mereset kata sandi',
    nepali: 'पासवर्ड रिसेट गर्न आफ्नो इमेल प्रविष्ट गर्नुहोस्',
    hindi: 'अपना पासवर्ड रीसेट करने के लिए अपना ईमेल दर्ज करें',
    burmese: 'သင်၏ စကားဝှက်ကို ပြန်လည်သတ်မှတ်ရန် သင်၏ အီးမေးလ်ကို ထည့်သွင်းပါ',
    thai: 'ป้อนอีเมลของคุณเพื่อรีเซ็ตรหัสผ่าน',
    mandarin: '输入您的电子邮件以重置密码'
  },
  failedToSubmitReport: {
    english: 'Failed to submit report',
    spanish: 'Error al enviar el reporte',
    brazilian_portuguese: 'Falha ao enviar relatório',
    tok_pisin: 'I no inap salim report',
    indonesian: 'Gagal mengirim laporan',
    nepali: 'रिपोर्ट पेश गर्न असफल',
    hindi: 'रिपोर्ट जमा करने में विफल',
    burmese: 'သတင်းပို့ချက်ကို တင်သွင်း၍မရပါ',
    thai: 'ส่งรายงานไม่สำเร็จ',
    mandarin: '提交报告失败'
  },
  logInToReport: {
    english: 'You must be logged in to report translations',
    spanish: 'Debe iniciar sesión para reportar traducciones',
    brazilian_portuguese: 'Você deve estar logado para reportar traduções',
    tok_pisin: 'Yu mas login pastaim long reportim ol translation',
    indonesian: 'Anda harus masuk untuk melaporkan terjemahan',
    nepali: 'अनुवादहरू रिपोर्ट गर्न तपाईं लग इन हुनुपर्छ',
    hindi: 'अनुवाद रिपोर्ट करने के लिए आपको लॉग इन होना होगा',
    burmese: 'ဘာသာပြန်ဆိုချက်များကို သတင်းပို့ရန် သင်သည် အကောင့်ဝင်ရမည်',
    thai: 'คุณต้องเข้าสู่ระบบเพื่อรายงานคำแปล',
    mandarin: '您必须登录才能报告翻译'
  },
  selectReason: {
    english: 'Please select a reason for the report',
    spanish: 'Por favor seleccione un motivo para el reporte',
    brazilian_portuguese: 'Por favor, selecione um motivo para o relatório',
    tok_pisin: 'Plis makim wanpela reson long report',
    indonesian: 'Silakan pilih alasan untuk laporan',
    nepali: 'कृपया रिपोर्टको लागि एउटा कारण चयन गर्नुहोस्',
    hindi: 'कृपया रिपोर्ट के लिए एक कारण चुनें',
    burmese: 'ကျေးဇူးပြု၍ သတင်းပို့ချက်အတွက် အကြောင်းပြချက်တစ်ခုကို ရွေးချယ်ပါ',
    thai: 'กรุณาเลือกเหตุผลสำหรับรายงาน',
    mandarin: '请选择报告原因'
  },
  enableAnalytics: {
    english: 'Enable Analytics',
    spanish: 'Habilitar Análisis',
    brazilian_portuguese: 'Habilitar Análise',
    tok_pisin: 'Onim Analytics',
    indonesian: 'Aktifkan Analitik',
    nepali: 'विश्लेषण सक्षम गर्नुहोस्',
    hindi: 'विश्लेषण सक्षम करें',
    burmese: 'ခွဲခြမ်းစိတ်ဖြာမှုကို ဖွင့်ပါ',
    thai: 'เปิดใช้งานการวิเคราะห์',
    mandarin: '启用分析'
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
      'Ketika dinonaktifkan, kami tidak akan mengumpulkan data penggunaan untuk meningkatkan aplikasi.',
    nepali:
      'असक्षम गरिएको बेला, हामी एप सुधार गर्न प्रयोग डाटा सङ्कलन गर्ने छैनौं।',
    hindi:
      'अक्षम होने पर, हम एप को बेहतर बनाने के लिए उपयोग डेटा एकत्र नहीं करेंगे।',
    burmese:
      'ပိတ်ထားသောအခါ၊ ကျွန်ုပ်တို့သည် အပ်ကို မြှင့်တင်ရန် အသုံးပြုမှု ဒေတာကို စုဆောင်းမည်မဟုတ်ပါ။',
    thai: 'เมื่อปิดใช้งาน เราจะไม่รวบรวมข้อมูลการใช้งานเพื่อปรับปรุงแอป',
    mandarin: '禁用后，我们将不会收集使用数据来改进应用程序。'
  },
  sessionExpired: {
    english: 'Session expired',
    spanish: 'Sesión expirada',
    brazilian_portuguese: 'Sessão expirada',
    tok_pisin: 'Session i pinis',
    indonesian: 'Sesi kedaluwarsa',
    nepali: 'सत्र समाप्त भयो',
    hindi: 'सत्र समाप्त हो गया',
    burmese: 'ဆက်ရှင်သက်တမ်းကုန်ဆုံးပါပြီ',
    thai: 'เซสชันหมดอายุ',
    mandarin: '会话已过期'
  },
  'reportReason.inappropriate_content': {
    english: 'Inappropriate Content',
    spanish: 'Contenido Inapropiado',
    brazilian_portuguese: 'Conteúdo Inapropriado',
    tok_pisin: 'Content i no gutpela',
    indonesian: 'Konten Tidak Pantas',
    nepali: 'अनुचित सामग्री',
    hindi: 'अनुचित सामग्री',
    burmese: 'မသင့်လျော်သော အကြောင်းအရာ',
    thai: 'เนื้อหาไม่เหมาะสม',
    mandarin: '不当内容'
  },
  'reportReason.spam': {
    english: 'Spam',
    spanish: 'Spam',
    brazilian_portuguese: 'Spam',
    tok_pisin: 'Spam',
    indonesian: 'Spam',
    nepali: 'स्प्याम',
    hindi: 'स्पैम',
    burmese: 'အမှိုက်စာ',
    thai: 'สแปม',
    mandarin: '垃圾信息'
  },
  'reportReason.other': {
    english: 'Other',
    spanish: 'Otro',
    brazilian_portuguese: 'Outro',
    tok_pisin: 'Narapela',
    indonesian: 'Lainnya',
    nepali: 'अन्य',
    hindi: 'अन्य',
    burmese: 'အခြား',
    thai: 'อื่นๆ',
    mandarin: '其他'
  },
  updatePassword: {
    english: 'Update Password',
    spanish: 'Actualizar Contraseña',
    brazilian_portuguese: 'Atualizar Senha',
    tok_pisin: 'Updateim Password',
    indonesian: 'Perbarui Kata Sandi',
    nepali: 'पासवर्ड अपडेट गर्नुहोस्',
    hindi: 'पासवर्ड अपडेट करें',
    burmese: 'စကားဝှက်ကို အပ်ဒိတ်လုပ်ပါ',
    thai: 'อัปเดตรหัสผ่าน',
    mandarin: '更新密码'
  },
  createNewPassword: {
    english: 'Create New Password',
    spanish: 'Crear nueva contraseña',
    brazilian_portuguese: 'Criar nova senha',
    tok_pisin: 'Mekim nupela password',
    indonesian: 'Buat Kata Sandi Baru',
    nepali: 'नयाँ पासवर्ड सिर्जना गर्नुहोस्',
    hindi: 'नया पासवर्ड बनाएं',
    burmese: 'စကားဝှက် အသစ် ဖန်တီးပါ',
    thai: 'สร้างรหัสผ่านใหม่',
    mandarin: '创建新密码'
  },
  downloadLimitExceeded: {
    english: 'Download Limit Exceeded',
    spanish: 'Límite de descarga excedido',
    brazilian_portuguese: 'Limite de download excedido',
    tok_pisin: 'Download limit i pinis',
    indonesian: 'Batas Unduhan Terlampaui',
    nepali: 'डाउनलोड सीमा नाघ्यो',
    hindi: 'डाउनलोड सीमा पार हो गई',
    burmese: 'ဒေါင်းလုဒ် ကန့်သတ်ချက် ကျော်လွန်သွားပါပြီ',
    thai: 'เกินขีดจำกัดการดาวน์โหลด',
    mandarin: '超过下载限制'
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
      'Anda mencoba mengunduh {newDownloads} lampiran untuk total {totalDownloads}, tetapi batasnya adalah {limit}. Silakan batalkan pilihan beberapa unduhan dan coba lagi.',
    nepali:
      'तपाईं {totalDownloads} को कुल लागि {newDownloads} संलग्नकहरू डाउनलोड गर्न प्रयास गर्दै हुनुहुन्छ, तर सीमा {limit} हो। कृपया केही डाउनलोडहरू अचयन गर्नुहोस् र पुन: प्रयास गर्नुहोस्।',
    hindi:
      'आप कुल {totalDownloads} के लिए {newDownloads} संलग्नक डाउनलोड करने का प्रयास कर रहे हैं, लेकिन सीमा {limit} है। कृपया कुछ डाउनलोड अचयन करें और पुनः प्रयास करें।',
    burmese:
      'သင်သည် စုစုပေါင်း {totalDownloads} အတွက် {newDownloads} ပူးတွဲဖိုင်များကို ဒေါင်းလုဒ်လုပ်ရန် ကြိုးစားနေပါသည်၊ သို့သော် ကန့်သတ်ချက်သည် {limit} ဖြစ်သည်။ ကျေးဇူးပြု၍ ဒေါင်းလုဒ်အချို့ကို ရွေးချယ်မှု ဖျက်ပြီး ထပ်မံကြိုးစားပါ။',
    thai: 'คุณกำลังพยายามดาวน์โหลดไฟล์แนบ {newDownloads} รายการ รวมทั้งหมด {totalDownloads} แต่ขีดจำกัดคือ {limit} กรุณายกเลิกการเลือกดาวน์โหลดบางรายการและลองอีกครั้ง',
    mandarin:
      '您正在尝试下载 {newDownloads} 个附件，总计 {totalDownloads}，但限制是 {limit}。请取消选择一些下载并重试。'
  },
  offlineUndownloadWarning: {
    english: 'Offline Undownload Warning',
    spanish: 'Advertencia de eliminación sin conexión',
    brazilian_portuguese: 'Aviso de remoção de download offline',
    tok_pisin: 'Offline Undownload Warning',
    indonesian: 'Peringatan Batalkan Unduhan Offline',
    nepali: 'अफलाइन अनडाउनलोड चेतावनी',
    hindi: 'ऑफलाइन अनडाउनलोड चेतावनी',
    burmese: 'အင်တာနက်မရှိသော ဒေါင်းလုဒ်ဖျက်ခြင်း သတိပေးချက်',
    thai: 'คำเตือนการยกเลิกดาวน์โหลดแบบออฟไลน์',
    mandarin: '离线取消下载警告'
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
      'Anda sedang offline. Jika Anda menghapus unduhan ini, Anda tidak akan dapat mengunduhnya lagi sampai Anda kembali online. Kontribusi yang belum disinkronkan tidak akan terpengaruh.',
    nepali:
      'तपाईं अहिले अफलाइन हुनुहुन्छ। यदि तपाईंले यो डाउनलोड हटाउनुभयो भने, तपाईं अनलाइन नभएसम्म पुन: डाउनलोड गर्न सक्षम हुनुहुने छैन। तपाईंको सिङ्क नभएका योगदानहरू प्रभावित हुने छैनन्।',
    hindi:
      'आप वर्तमान में ऑफलाइन हैं। यदि आप इस डाउनलोड को हटाते हैं, तो आप ऑनलाइन वापस आने तक इसे पुनः डाउनलोड नहीं कर सकेंगे। आपके असंगत योगदान प्रभावित नहीं होंगे।',
    burmese:
      'သင်သည် လက်ရှိတွင် အင်တာနက်မရှိပါ။ သင်သည် ဤဒေါင်းလုဒ်ကို ဖျက်ပါက၊ သင်သည် အင်တာနက်ပြန်ရသည့်အထိ ထပ်မံဒေါင်းလုဒ်လုပ်၍မရပါ။ သင်၏ စင့်ချန်မထားသော ပံ့ပိုးမှုများကို ထိခိုက်မည်မဟုတ်ပါ။',
    thai: 'คุณกำลังออฟไลน์อยู่ หากคุณลบการดาวน์โหลดนี้ คุณจะไม่สามารถดาวน์โหลดอีกครั้งได้จนกว่าคุณจะกลับมาออนไลน์ การมีส่วนร่วมที่ยังไม่ได้ซิงค์ของคุณจะไม่ได้รับผลกระทบ',
    mandarin:
      '您目前处于离线状态。如果您删除此下载，在您重新上线之前将无法重新下载。您未同步的贡献不会受到影响。'
  },
  dontShowAgain: {
    english: "Don't show this message again",
    spanish: 'No mostrar este mensaje nuevamente',
    brazilian_portuguese: 'Não mostrar esta mensagem novamente',
    tok_pisin: 'No soim dispela message gen',
    indonesian: 'Jangan tampilkan pesan ini lagi',
    nepali: 'यो सन्देश फेरि नदेखाउनुहोस्',
    hindi: 'इस संदेश को फिर से न दिखाएं',
    burmese: 'ဤစာတိုကို ထပ်မံမပြပါနှင့်',
    thai: 'ไม่แสดงข้อความนี้อีก',
    mandarin: '不再显示此消息'
  },
  cancel: {
    english: 'Cancel',
    spanish: 'Cancelar',
    brazilian_portuguese: 'Cancelar',
    tok_pisin: 'Cancel',
    indonesian: 'Batal',
    nepali: 'रद्द गर्नुहोस्',
    hindi: 'रद्द करें',
    burmese: 'ပယ်ဖျက်ပါ',
    thai: 'ยกเลิก',
    mandarin: '取消'
  },
  yes: {
    english: 'Yes',
    spanish: 'Sí',
    brazilian_portuguese: 'Sim',
    tok_pisin: 'Yes',
    indonesian: 'Ya',
    nepali: 'हो',
    hindi: 'हाँ',
    burmese: 'ဟုတ်ကဲ့',
    thai: 'ใช่',
    mandarin: '是'
  },
  no: {
    english: 'No',
    spanish: 'No',
    brazilian_portuguese: 'Não',
    tok_pisin: 'Nogat',
    indonesian: 'Tidak',
    nepali: 'होइन',
    hindi: 'नहीं',
    burmese: 'မဟုတ်ပါ',
    thai: 'ไม่',
    mandarin: '否'
  },
  confirm: {
    english: 'Confirm',
    spanish: 'Confirmar',
    brazilian_portuguese: 'Confirmar',
    tok_pisin: 'Confirm',
    indonesian: 'Konfirmasi',
    nepali: 'पुष्टि गर्नुहोस्',
    hindi: 'पुष्टि करें',
    burmese: 'အတည်ပြုပါ',
    thai: 'ยืนยัน',
    mandarin: '确认'
  },
  blockThisContent: {
    english: 'Block this content',
    spanish: 'Bloquear este contenido',
    brazilian_portuguese: 'Bloquear este conteúdo',
    tok_pisin: 'Blokim dispela content',
    indonesian: 'Blokir konten ini',
    nepali: 'यो सामग्री ब्लक गर्नुहोस्',
    hindi: 'इस सामग्री को ब्लॉक करें',
    burmese: 'ဤအကြောင်းအရာကို ပိတ်ဆို့ပါ',
    thai: 'บล็อกเนื้อหานี้',
    mandarin: '阻止此内容'
  },
  blockThisUser: {
    english: 'Block this user',
    spanish: 'Bloquear este usuario',
    brazilian_portuguese: 'Bloquear este usuário',
    tok_pisin: 'Blokim dispela user',
    indonesian: 'Blokir pengguna ini',
    nepali: 'यो प्रयोगकर्ता ब्लक गर्नुहोस्',
    hindi: 'इस उपयोगकर्ता को ब्लॉक करें',
    burmese: 'ဤအသုံးပြုသူကို ပိတ်ဆို့ပါ',
    thai: 'บล็อกผู้ใช้นี้',
    mandarin: '阻止此用户'
  },
  // New backup-related translations
  backup: {
    english: 'Backup',
    spanish: 'Respaldo',
    brazilian_portuguese: 'Backup',
    tok_pisin: 'Backup',
    indonesian: 'Cadangan',
    nepali: 'ब्याकअप',
    hindi: 'बैकअप',
    burmese: 'အရန်သိမ်းဆည်းမှု',
    thai: 'สำรอง',
    mandarin: '备份'
  },
  backingUp: {
    english: 'Backing Up...',
    spanish: 'Respaldando...',
    brazilian_portuguese: 'Fazendo Backup...',
    tok_pisin: 'Backup...',
    indonesian: 'Mencadangkan...',
    nepali: 'ब्याकअप गर्दै...',
    hindi: 'बैकअप हो रहा है...',
    burmese: 'အရန်သိမ်းဆည်းနေသည်...',
    thai: 'กำลังสำรอง...',
    mandarin: '正在备份...'
  },
  restoreBackup: {
    english: 'Restore Backup',
    spanish: 'Restaurar Respaldo',
    brazilian_portuguese: 'Restaurar Backup',
    tok_pisin: 'Restore Backup',
    indonesian: 'Pulihkan Cadangan',
    nepali: 'ब्याकअप पुनर्स्थापना गर्नुहोस्',
    hindi: 'बैकअप पुनर्स्थापित करें',
    burmese: 'အရန်သိမ်းဆည်းမှုကို ပြန်လည်ထားရှိပါ',
    thai: 'กู้คืนการสำรอง',
    mandarin: '恢复备份'
  },
  restoring: {
    english: 'Restoring...',
    spanish: 'Restaurando...',
    brazilian_portuguese: 'Restaurando...',
    tok_pisin: 'Restore...',
    indonesian: 'Memulihkan...',
    nepali: 'पुनर्स्थापना गर्दै...',
    hindi: 'पुनर्स्थापित हो रहा है...',
    burmese: 'ပြန်လည်ထားရှိနေသည်...',
    thai: 'กำลังกู้คืน...',
    mandarin: '正在恢复...'
  },
  startBackupTitle: {
    english: 'Create Backup',
    spanish: 'Crear Respaldo',
    brazilian_portuguese: 'Criar Backup',
    tok_pisin: 'Mekim Backup',
    indonesian: 'Buat Cadangan',
    nepali: 'ब्याकअप सिर्जना गर्नुहोस्',
    hindi: 'बैकअप बनाएं',
    burmese: 'အရန်သိမ်းဆည်းမှု ဖန်တီးပါ',
    thai: 'สร้างการสำรอง',
    mandarin: '创建备份'
  },
  startBackupMessageAudioOnly: {
    english: 'Would you like to back up your unsynced audio recordings?',
    spanish:
      '¿Desea hacer una copia de seguridad de sus grabaciones de audio no sincronizadas?',
    brazilian_portuguese:
      'Gostaria de fazer backup das suas gravações de áudio não sincronizadas?',
    tok_pisin: 'Yu laik backup ol audio recording bilong yu i no sync yet?',
    indonesian:
      'Apakah Anda ingin mencadangkan rekaman audio yang belum disinkronkan?',
    nepali:
      'के तपाईं आफ्नो सिङ्क नभएका अडियो रेकर्डिङहरू ब्याकअप गर्न चाहनुहुन्छ?',
    hindi: 'क्या आप अपने असंगत ऑडियो रिकॉर्डिंग का बैकअप लेना चाहेंगे?',
    burmese:
      'သင်သည် သင်၏ စင့်ချန်မထားသော အသံမှတ်တမ်းများကို အရန်သိမ်းဆည်းလိုပါသလား?',
    thai: 'คุณต้องการสำรองการบันทึกเสียงที่ยังไม่ได้ซิงค์ของคุณหรือไม่?',
    mandarin: '您想备份未同步的音频录音吗？'
  },
  backupAudioAction: {
    english: 'Backup audio and text',
    spanish: 'Respaldar audio y texto',
    brazilian_portuguese: 'Backup de áudio e texto',
    tok_pisin: 'Backup audio na text',
    indonesian: 'Cadangkan audio dan teks',
    nepali: 'अडियो र टेक्स्ट ब्याकअप गर्नुहोस्',
    hindi: 'ऑडियो और टेक्स्ट का बैकअप लें',
    burmese: 'အသံနှင့် စာသားကို အရန်သိမ်းဆည်းပါ',
    thai: 'สำรองเสียงและข้อความ',
    mandarin: '备份音频和文本'
  },
  backupErrorTitle: {
    english: 'Backup Error',
    spanish: 'Error de Respaldo',
    brazilian_portuguese: 'Erro de Backup',
    tok_pisin: 'Backup Rong',
    indonesian: 'Kesalahan Cadangan',
    nepali: 'ब्याकअप त्रुटि',
    hindi: 'बैकअप त्रुटि',
    burmese: 'အရန်သိမ်းဆည်းမှု အမှား',
    thai: 'ข้อผิดพลาดในการสำรอง',
    mandarin: '备份错误'
  },
  backupCompleteTitle: {
    english: 'Backup Complete',
    spanish: 'Respaldo Completado',
    brazilian_portuguese: 'Backup Concluído',
    tok_pisin: 'Backup Pinis',
    indonesian: 'Cadangan Selesai',
    nepali: 'ब्याकअप पूरा भयो',
    hindi: 'बैकअप पूर्ण',
    burmese: 'အရန်သိမ်းဆည်းမှု ပြီးစီးပါပြီ',
    thai: 'สำรองเสร็จสมบูรณ์',
    mandarin: '备份完成'
  },
  audioBackupStatus: {
    english: 'Successfully backed up {count} audio recordings',
    spanish: 'Se respaldaron con éxito {count} grabaciones de audio',
    brazilian_portuguese:
      'Backup de {count} gravações de áudio concluído com sucesso',
    tok_pisin: 'Backup {count} audio recordings gut',
    indonesian: 'Berhasil mencadangkan {count} rekaman audio',
    nepali: '{count} अडियो रेकर्डिङहरू सफलतापूर्वक ब्याकअप गरियो',
    hindi: '{count} ऑडियो रिकॉर्डिंग सफलतापूर्वक बैकअप हो गई',
    burmese: '{count} အသံမှတ်တမ်းများကို အောင်မြင်စွာ အရန်သိမ်းဆည်းပြီးပါပြီ',
    thai: 'สำรองการบันทึกเสียง {count} รายการสำเร็จ',
    mandarin: '已成功备份 {count} 个音频录音'
  },
  criticalBackupError: {
    english: 'A critical error occurred: {error}',
    spanish: 'Ocurrió un error crítico: {error}',
    brazilian_portuguese: 'Ocorreu um erro crítico: {error}',
    tok_pisin: 'Bikpela rong i kamap: {error}',
    indonesian: 'Terjadi kesalahan kritis: {error}',
    nepali: 'एउटा गम्भीर त्रुटि भयो: {error}',
    hindi: 'एक गंभीर त्रुटि हुई: {error}',
    burmese: 'အရေးကြီးသော အမှားတစ်ခု ဖြစ်ပွားခဲ့သည်: {error}',
    thai: 'เกิดข้อผิดพลาดร้ายแรง: {error}',
    mandarin: '发生严重错误: {error}'
  },
  databaseNotReady: {
    english: 'Database is not ready. Please try again later.',
    spanish: 'La base de datos no está lista. Por favor, inténtelo más tarde.',
    brazilian_portuguese:
      'O banco de dados não está pronto. Por favor, tente novamente mais tarde.',
    tok_pisin: 'Database i no redi yet. Plis traim gen bihain.',
    indonesian: 'Database belum siap. Silakan coba lagi nanti.',
    nepali: 'डाटाबेस तयार छैन। कृपया पछि पुन: प्रयास गर्नुहोस्।',
    hindi: 'डेटाबेस तैयार नहीं है। कृपया बाद में पुनः प्रयास करें।',
    burmese:
      'ဒေတာဘေ့စ်သည် အဆင်သင့်မဖြစ်သေးပါ။ ကျေးဇူးပြု၍ နောက်ပိုင်းတွင် ထပ်မံကြိုးစားပါ။',
    thai: 'ฐานข้อมูลยังไม่พร้อม กรุณาลองอีกครั้งในภายหลัง',
    mandarin: '数据库尚未准备好。请稍后再试。'
  },
  storagePermissionDenied: {
    english: 'Storage permission denied. Backup cannot proceed.',
    spanish:
      'Permiso de almacenamiento denegado. El respaldo no puede continuar.',
    brazilian_portuguese:
      'Permissão de armazenamento negada. O backup não pode prosseguir.',
    tok_pisin: 'Storage permission i no. Backup i no inap go.',
    indonesian: 'Izin penyimpanan ditolak. Cadangan tidak dapat dilanjutkan.',
    nepali: 'भण्डारण अनुमति अस्वीकृत। ब्याकअप अगाडि बढ्न सक्दैन।',
    hindi: 'भंडारण अनुमति अस्वीकृत। बैकअप आगे नहीं बढ़ सकता।',
    burmese:
      'သိုလှောင်မှု ခွင့်ပြုချက်ကို ငြင်းဆိုပါသည်။ အရန်သိမ်းဆည်းမှု ဆက်လုပ်မရပါ။',
    thai: 'ปฏิเสธการอนุญาตการจัดเก็บ ไม่สามารถดำเนินการสำรองได้',
    mandarin: '存储权限被拒绝。备份无法继续。'
  },
  // Adding missing translation keys
  initializing: {
    english: 'Initializing',
    spanish: 'Inicializando',
    brazilian_portuguese: 'Inicializando',
    tok_pisin: 'Initializing',
    indonesian: 'Menginisialisasi',
    nepali: 'सुरुवात गर्दै',
    hindi: 'आरंभ कर रहा है',
    burmese: 'စတင်နေသည်',
    thai: 'กำลังเริ่มต้น',
    mandarin: '正在初始化'
  },
  syncComplete: {
    english: 'Sync complete',
    spanish: 'Sincronización completa',
    brazilian_portuguese: 'Sincronização completa',
    nepali: 'सिङ्क पूरा भयो',
    tok_pisin: 'Sync pinis',
    indonesian: 'Sinkronisasi selesai',
    hindi: 'सिंक पूर्ण',
    burmese: 'စင့်ချန်မှု ပြီးစီးပါပြီ',
    thai: 'ซิงค์เสร็จสมบูรณ์',
    mandarin: '同步完成'
  },
  syncProgress: {
    english: '{current} of {total} files',
    spanish: '{current} de {total} archivos',
    brazilian_portuguese: '{current} de {total} arquivos',
    tok_pisin: '{current} long {total} files',
    indonesian: '{current} dari {total} file',
    nepali: '{total} मध्ये {current} फाइलहरू',
    hindi: '{total} में से {current} फाइलें',
    burmese: '{total} ဖိုင်များထဲမှ {current}',
    thai: '{current} จาก {total} ไฟล์',
    mandarin: '{total} 个文件中的 {current} 个'
  },
  userNotLoggedIn: {
    english: 'You must be logged in to perform this action',
    spanish: 'Debe iniciar sesión para realizar esta acción',
    brazilian_portuguese: 'Você deve estar logado para realizar esta ação',
    tok_pisin: 'Yu mas login pastaim long mekim dispela samting',
    indonesian: 'Anda harus masuk untuk melakukan tindakan ini',
    nepali: 'यो कार्य गर्न तपाईं लग इन हुनुपर्छ',
    hindi: 'इस कार्रवाई को करने के लिए आपको लॉग इन होना होगा',
    burmese: 'ဤလုပ်ဆောင်ချက်ကို လုပ်ဆောင်ရန် သင်သည် အကောင့်ဝင်ရမည်',
    thai: 'คุณต้องเข้าสู่ระบบเพื่อดำเนินการนี้',
    mandarin: '您必须登录才能执行此操作'
  },
  cannotReportOwnTranslation: {
    english: 'You cannot report your own translation',
    spanish: 'No puede reportar su propia traducción',
    brazilian_portuguese: 'Você não pode reportar sua própria tradução',
    tok_pisin: 'Yu no inap reportim translation bilong yu yet',
    indonesian: 'Anda tidak dapat melaporkan terjemahan Anda sendiri',
    nepali: 'तपाईं आफ्नो अनुवाद रिपोर्ट गर्न सक्नुहुन्न',
    hindi: 'आप अपना अनुवाद रिपोर्ट नहीं कर सकते',
    burmese: 'သင်သည် သင်၏ ကိုယ်ပိုင် ဘာသာပြန်ဆိုချက်ကို သတင်းပို့၍မရပါ',
    thai: 'คุณไม่สามารถรายงานคำแปลของคุณเองได้',
    mandarin: '您不能报告自己的翻译'
  },
  cannotReportInactiveTranslation: {
    english: 'You cannot report inactive translation',
    spanish: 'No puede reportar traducción inactiva',
    brazilian_portuguese: 'Você não pode reportar tradução inativa',
    tok_pisin: 'Yu no inap reportim translation i no active',
    indonesian: 'Anda tidak dapat melaporkan terjemahan yang tidak aktif',
    nepali: 'तपाईं निष्क्रिय अनुवाद रिपोर्ट गर्न सक्नुहुन्न',
    hindi: 'आप निष्क्रिय अनुवाद रिपोर्ट नहीं कर सकते',
    burmese: 'သင်သည် မလှုပ်ရှားသော ဘာသာပြန်ဆိုချက်ကို သတင်းပို့၍မရပါ',
    thai: 'คุณไม่สามารถรายงานคำแปลที่ไม่ใช้งานได้',
    mandarin: '您不能报告非活动翻译'
  },
  cannotIdentifyUser: {
    english: 'Unable to identify user',
    spanish: 'No se puede identificar al usuario',
    brazilian_portuguese: 'Não foi possível identificar o usuário',
    tok_pisin: 'No inap save user',
    indonesian: 'Tidak dapat mengidentifikasi pengguna',
    nepali: 'प्रयोगकर्ता पहिचान गर्न असमर्थ',
    hindi: 'उपयोगकर्ता की पहचान करने में असमर्थ',
    burmese: 'အသုံးပြုသူကို ခွဲခြားမရပါ',
    thai: 'ไม่สามารถระบุผู้ใช้ได้',
    mandarin: '无法识别用户'
  },
  cannotChangeTranslationSettings: {
    english: 'Unathorized to change settings for this translation',
    spanish:
      'No tiene autorización para cambiar la configuración de esta traducción',
    brazilian_portuguese:
      'Você não tem autorização para alterar as configurações desta tradução',
    tok_pisin:
      'Yu no gat rait long senisim settings bilong dispela translation',
    indonesian: 'Tidak berwenang untuk mengubah pengaturan terjemahan ini',
    nepali: 'यो अनुवादको सेटिङहरू परिवर्तन गर्न अनधिकृत',
    hindi: 'इस अनुवाद के लिए सेटिंग्स बदलने के लिए अनधिकृत',
    burmese:
      'ဤဘာသာပြန်ဆိုချက်အတွက် ဆက်တင်များကို ပြောင်းလဲရန် ခွင့်ပြုချက်မရှိပါ',
    thai: 'ไม่มีสิทธิ์ในการเปลี่ยนการตั้งค่าสำหรับคำแปลนี้',
    mandarin: '无权更改此翻译的设置'
  },
  alreadyReportedTranslation: {
    english: 'You have already reported this translation',
    spanish: 'Ya ha reportado esta traducción',
    brazilian_portuguese: 'Você já reportou esta tradução',
    tok_pisin: 'Yu reportim dispela translation pinis',
    indonesian: 'Anda sudah melaporkan terjemahan ini',
    nepali: 'तपाईंले पहिले नै यो अनुवाद रिपोर्ट गरिसक्नुभयो',
    hindi: 'आपने पहले ही इस अनुवाद को रिपोर्ट कर दिया है',
    burmese: 'သင်သည် ဤဘာသာပြန်ဆိုချက်ကို သတင်းပို့ပြီးပါပြီ',
    thai: 'คุณได้รายงานคำแปลนี้แล้ว',
    mandarin: '您已经报告了此翻译'
  },
  failedSaveAnalyticsPreference: {
    english: 'Failed to save analytics preference',
    spanish: 'Error al guardar la preferencia de análisis',
    brazilian_portuguese: 'Falha ao salvar preferência de análise',
    tok_pisin: 'I no inap seivim analytics preference',
    indonesian: 'Gagal menyimpan preferensi analitik',
    nepali: 'विश्लेषण प्राथमिकता सेभ गर्न असफल',
    hindi: 'विश्लेषण प्राथमिकता सहेजने में विफल',
    burmese: 'ခွဲခြမ်းစိတ်ဖြာမှု ဦးစားပေးမှုကို သိမ်းဆည်း၍မရပါ',
    thai: 'บันทึกการตั้งค่าการวิเคราะห์ไม่สำเร็จ',
    mandarin: '保存分析首选项失败'
  },
  currentPasswordRequired: {
    english: 'Current password is required',
    spanish: 'Se requiere la contraseña actual',
    brazilian_portuguese: 'A senha atual é obrigatória',
    tok_pisin: 'Password bilong nau i mas',
    indonesian: 'Kata sandi saat ini diperlukan',
    nepali: 'हालको पासवर्ड आवश्यक छ',
    hindi: 'वर्तमान पासवर्ड आवश्यक है',
    burmese: 'လက်ရှိ စကားဝှက် လိုအပ်ပါသည်',
    thai: 'ต้องใช้รหัสผ่านปัจจุบัน',
    mandarin: '需要当前密码'
  },
  profileUpdateSuccess: {
    english: 'Profile updated successfully',
    spanish: 'Perfil actualizado con éxito',
    brazilian_portuguese: 'Perfil atualizado com sucesso',
    tok_pisin: 'Profile i update gut',
    indonesian: 'Profil berhasil diperbarui',
    nepali: 'प्रोफाइल सफलतापूर्वक अपडेट गरियो',
    hindi: 'प्रोफ़ाइल सफलतापूर्वक अपडेट हो गई',
    burmese: 'ကိုယ်ရေးအကျဉ်းကို အောင်မြင်စွာ အပ်ဒိတ်လုပ်ပြီးပါပြီ',
    thai: 'อัปเดตโปรไฟล์สำเร็จ',
    mandarin: '个人资料更新成功'
  },
  failedUpdateProfile: {
    english: 'Failed to update profile',
    spanish: 'Error al actualizar el perfil',
    brazilian_portuguese: 'Falha ao atualizar perfil',
    tok_pisin: 'I no inap updateim profile',
    indonesian: 'Gagal memperbarui profil',
    nepali: 'प्रोफाइल अपडेट गर्न असफल',
    hindi: 'प्रोफ़ाइल अपडेट करने में विफल',
    burmese: 'ကိုယ်ရေးအကျဉ်းကို အပ်ဒိတ်လုပ်၍မရပါ',
    thai: 'อัปเดตโปรไฟล์ไม่สำเร็จ',
    mandarin: '更新个人资料失败'
  },
  assetNotFound: {
    english: 'Asset not found',
    spanish: 'Recurso no encontrado',
    brazilian_portuguese: 'Recurso não encontrado',
    tok_pisin: 'Asset i no stap',
    indonesian: 'Aset tidak ditemukan',
    nepali: 'एसेट फेला परेन',
    hindi: 'एसेट नहीं मिला',
    burmese: 'ပိုင်ဆိုင်မှု မတွေ့ရှိပါ',
    thai: 'ไม่พบสินทรัพย์',
    mandarin: '未找到资产'
  },
  failedLoadAssetData: {
    english: 'Failed to load asset data',
    spanish: 'Error al cargar datos del recurso',
    brazilian_portuguese: 'Falha ao carregar dados do recurso',
    tok_pisin: 'I no inap loadim asset data',
    indonesian: 'Gagal memuat data aset',
    nepali: 'एसेट डाटा लोड गर्न असफल',
    hindi: 'एसेट डेटा लोड करने में विफल',
    burmese: 'ပိုင်ဆိုင်မှု ဒေတာကို လုပ်ဆောင်၍မရပါ',
    thai: 'โหลดข้อมูลสินทรัพย์ไม่สำเร็จ',
    mandarin: '加载资产数据失败'
  },
  failedLoadAssets: {
    english: 'Failed to load assets',
    spanish: 'Error al cargar recursos',
    brazilian_portuguese: 'Falha ao carregar recursos',
    tok_pisin: 'I no inap loadim ol asset',
    indonesian: 'Gagal memuat aset',
    nepali: 'एसेटहरू लोड गर्न असफल',
    hindi: 'एसेट लोड करने में विफल',
    burmese: 'ပိုင်ဆိုင်မှုများကို လုပ်ဆောင်၍မရပါ',
    thai: 'โหลดสินทรัพย์ไม่สำเร็จ',
    mandarin: '加载资产失败'
  },
  projectMembers: {
    english: 'Project Members',
    spanish: 'Miembros del Proyecto',
    brazilian_portuguese: 'Membros do Projeto',
    tok_pisin: 'Ol Member bilong Project',
    indonesian: 'Anggota Proyek',
    nepali: 'प्रोजेक्ट सदस्यहरू',
    hindi: 'परियोजना सदस्य',
    burmese: 'စီမံကိန်း အဖွဲ့ဝင်များ',
    thai: 'สมาชิกโครงการ',
    mandarin: '项目成员'
  },
  members: {
    english: 'Members',
    spanish: 'Miembros',
    brazilian_portuguese: 'Membros',
    tok_pisin: 'Ol Member',
    indonesian: 'Anggota',
    nepali: 'सदस्यहरू',
    hindi: 'सदस्य',
    burmese: 'အဖွဲ့ဝင်များ',
    thai: 'สมาชิก',
    mandarin: '成员'
  },
  invited: {
    english: 'Invited',
    spanish: 'Invitados',
    brazilian_portuguese: 'Convidados',
    tok_pisin: 'Ol i invitim',
    indonesian: 'Diundang',
    nepali: 'आमन्त्रित',
    hindi: 'आमंत्रित',
    burmese: 'ဖိတ်ခေါ်ထားသည်',
    thai: 'ได้รับเชิญ',
    mandarin: '已邀请'
  },
  viewInvitation: {
    english: 'View Invitation',
    spanish: 'Ver Invitación',
    brazilian_portuguese: 'Ver Convite',
    tok_pisin: 'Lukim Invitation',
    indonesian: 'Lihat Undangan',
    nepali: 'आमन्त्रण हेर्नुहोस्',
    hindi: 'आमंत्रण देखें',
    burmese: 'ဖိတ်ခေါ်မှုကို ကြည့်ရှုပါ',
    thai: 'ดูคำเชิญ',
    mandarin: '查看邀请'
  },
  inviteMembers: {
    english: 'Invite Members',
    spanish: 'Invitar Miembros',
    brazilian_portuguese: 'Convidar Membros',
    tok_pisin: 'Invitim ol Member',
    indonesian: 'Undang Anggota',
    nepali: 'सदस्यहरूलाई आमन्त्रित गर्नुहोस्',
    hindi: 'सदस्यों को आमंत्रित करें',
    burmese: 'အဖွဲ့ဝင်များကို ဖိတ်ခေါ်ပါ',
    thai: 'เชิญสมาชิก',
    mandarin: '邀请成员'
  },
  inviteAsOwner: {
    english: 'Invite as owner',
    spanish: 'Invitar como propietario',
    brazilian_portuguese: 'Convidar como proprietário',
    tok_pisin: 'Invitim olsem owner',
    indonesian: 'Undang sebagai pemilik',
    nepali: 'मालिकको रूपमा आमन्त्रित गर्नुहोस्',
    hindi: 'मालिक के रूप में आमंत्रित करें',
    burmese: 'ပိုင်ရှင်အဖြစ် ဖိတ်ခေါ်ပါ',
    thai: 'เชิญเป็นเจ้าของ',
    mandarin: '邀请为所有者'
  },
  sendInvitation: {
    english: 'Send Invitation',
    spanish: 'Enviar Invitación',
    brazilian_portuguese: 'Enviar Convite',
    tok_pisin: 'Salim Invitation',
    indonesian: 'Kirim Undangan',
    nepali: 'आमन्त्रण पठाउनुहोस्',
    hindi: 'आमंत्रण भेजें',
    burmese: 'ဖိတ်ခေါ်မှုကို ပို့ပါ',
    thai: 'ส่งคำเชิญ',
    mandarin: '发送邀请'
  },
  owner: {
    english: 'Owner',
    spanish: 'Propietario',
    brazilian_portuguese: 'Proprietário',
    tok_pisin: 'Owner',
    indonesian: 'Pemilik',
    nepali: 'मालिक',
    hindi: 'मालिक',
    burmese: 'ပိုင်ရှင်',
    thai: 'เจ้าของ',
    mandarin: '所有者'
  },
  member: {
    english: 'Member',
    spanish: 'Miembro',
    brazilian_portuguese: 'Membro',
    tok_pisin: 'Member',
    indonesian: 'Anggota',
    nepali: 'सदस्य',
    hindi: 'सदस्य',
    burmese: 'အဖွဲ့ဝင်',
    thai: 'สมาชิก',
    mandarin: '成员'
  },
  makeOwner: {
    english: 'Make Owner',
    spanish: 'Hacer Propietario',
    brazilian_portuguese: 'Tornar Proprietário',
    tok_pisin: 'Mekim Owner',
    indonesian: 'Jadikan Pemilik',
    nepali: 'मालिक बनाउनुहोस्',
    hindi: 'मालिक बनाएं',
    burmese: 'ပိုင်ရှင်အဖြစ် ပြောင်းလဲပါ',
    thai: 'ทำให้เป็นเจ้าของ',
    mandarin: '设为所有者'
  },
  remove: {
    english: 'Remove',
    spanish: 'Eliminar',
    brazilian_portuguese: 'Remover',
    tok_pisin: 'Rausim',
    indonesian: 'Hapus',
    nepali: 'हटाउनुहोस्',
    hindi: 'हटाएं',
    burmese: 'ဖယ်ရှားပါ',
    thai: 'ลบ',
    mandarin: '移除'
  },
  withdrawInvite: {
    english: 'Withdraw Invite',
    spanish: 'Retirar Invitación',
    brazilian_portuguese: 'Retirar Convite',
    tok_pisin: 'Rausim Invite',
    indonesian: 'Tarik Undangan',
    nepali: 'आमन्त्रण फिर्ता लिनुहोस्',
    hindi: 'आमंत्रण वापस लें',
    burmese: 'ဖိတ်ခေါ်မှုကို ရုပ်သိမ်းပါ',
    thai: 'ถอนคำเชิญ',
    mandarin: '撤回邀请'
  },
  you: {
    english: 'You',
    spanish: 'Tú',
    brazilian_portuguese: 'Você',
    tok_pisin: 'Yu',
    indonesian: 'Anda',
    nepali: 'तपाईं',
    hindi: 'आप',
    burmese: 'သင်သည်',
    thai: 'คุณ',
    mandarin: '您'
  },
  pendingInvitation: {
    english: 'Pending',
    spanish: 'Pendiente',
    brazilian_portuguese: 'Pendente',
    tok_pisin: 'Wet',
    indonesian: 'Tertunda',
    nepali: 'बाँकी',
    hindi: 'लंबित',
    burmese: 'စောင့်ဆိုင်းနေသည်',
    thai: 'รอดำเนินการ',
    mandarin: '待处理'
  },
  noMembers: {
    english: 'No members yet',
    spanish: 'No hay miembros todavía',
    brazilian_portuguese: 'Ainda não há membros',
    tok_pisin: 'No gat member yet',
    indonesian: 'Belum ada anggota',
    nepali: 'अहिलेसम्म कुनै सदस्य छैन',
    hindi: 'अभी तक कोई सदस्य नहीं',
    burmese: 'အခုထိ အဖွဲ့ဝင် မရှိသေးပါ',
    thai: 'ยังไม่มีสมาชิก',
    mandarin: '还没有成员'
  },
  noInvitations: {
    english: 'No pending invitations',
    spanish: 'No hay invitaciones pendientes',
    brazilian_portuguese: 'Nenhum convite pendente',
    tok_pisin: 'No gat invitation i wet',
    indonesian: 'Tidak ada undangan tertunda',
    nepali: 'कुनै बाँकी आमन्त्रण छैन',
    hindi: 'कोई लंबित आमंत्रण नहीं',
    burmese: 'စောင့်ဆိုင်းနေသော ဖိတ်ခေါ်မှု မရှိပါ',
    thai: 'ไม่มีคำเชิญที่รอดำเนินการ',
    mandarin: '没有待处理的邀请'
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
      'Pemilik dapat membuat konten, mengundang dan mempromosikan anggota lain, dan tidak dapat diturunkan kembali ke keanggotaan atau dihapus dari proyek oleh anggota lain.',
    nepali:
      'मालिकहरूले सामग्री सिर्जना गर्न, अन्य सदस्यहरूलाई आमन्त्रित गर्न र प्रवर्द्धन गर्न सक्छन्, र अन्य सदस्यहरूद्वारा सदस्यतामा फिर्ता गिराउन वा प्रोजेक्टबाट हटाउन सकिँदैन।',
    hindi:
      'मालिक सामग्री बना सकते हैं, अन्य सदस्यों को आमंत्रित और प्रोन्नत कर सकते हैं, और अन्य सदस्यों द्वारा सदस्यता में वापस पदावनत या परियोजना से हटाए नहीं जा सकते।',
    burmese:
      'ပိုင်ရှင်များသည် အကြောင်းအရာ ဖန်တီးနိုင်ပြီး၊ အခြားအဖွဲ့ဝင်များကို ဖိတ်ခေါ်နိုင်ပြီး မြှင့်တင်နိုင်သော်လည်း၊ အခြားအဖွဲ့ဝင်များက အဖွဲ့ဝင်အဖြစ်သို့ ပြန်လည်နှိမ့်ချခြင်း သို့မဟုတ် စီမံကိန်းမှ ဖယ်ရှားခြင်း မပြုလုပ်နိုင်ပါ။',
    thai: 'เจ้าของสามารถสร้างเนื้อหา เชิญและเลื่อนตำแหน่งสมาชิกคนอื่นๆ และไม่สามารถถูกลดตำแหน่งกลับเป็นสมาชิกหรือถูกลบออกจากโครงการโดยสมาชิกคนอื่นๆ ได้',
    mandarin:
      '所有者可以创建内容、邀请和提升其他成员，并且不能被其他成员降级回成员身份或从项目中移除。'
  },
  confirmRemoveMessage: {
    english: 'Are you sure you want to remove {name} from this project?',
    spanish: '¿Está seguro de que desea eliminar a {name} de este proyecto?',
    brazilian_portuguese:
      'Tem certeza de que deseja remover {name} deste projeto?',
    tok_pisin: 'Yu tru laik rausim {name} long dispela project?',
    indonesian: 'Apakah Anda yakin ingin menghapus {name} dari proyek ini?',
    nepali:
      'के तपाईं निश्चित हुनुहुन्छ कि तपाईं {name} लाई यो प्रोजेक्टबाट हटाउन चाहनुहुन्छ?',
    hindi: 'क्या आप वाकई {name} को इस परियोजना से हटाना चाहते हैं?',
    burmese: 'သင်သည် {name} ကို ဤစီမံကိန်းမှ ဖယ်ရှားလိုပါသလား?',
    thai: 'คุณแน่ใจหรือไม่ว่าต้องการลบ {name} ออกจากโครงการนี้?',
    mandarin: '您确定要从该项目中移除 {name} 吗？'
  },
  confirmPromote: {
    english: 'Confirm Promote',
    spanish: 'Confirmar Promoción',
    brazilian_portuguese: 'Confirmar Promoção',
    tok_pisin: 'Confirm Promote',
    indonesian: 'Konfirmasi Promosi',
    nepali: 'प्रमोशन पुष्टि गर्नुहोस्',
    hindi: 'प्रोन्नति की पुष्टि करें',
    burmese: 'မြှင့်တင်မှုကို အတည်ပြုပါ',
    thai: 'ยืนยันการเลื่อนตำแหน่ง',
    mandarin: '确认提升'
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
      'Apakah Anda yakin ingin menjadikan {name} sebagai pemilik? Tindakan ini tidak dapat dibatalkan.',
    nepali:
      'के तपाईं निश्चित हुनुहुन्छ कि तपाईं {name} लाई मालिक बनाउन चाहनुहुन्छ? यो कार्य पूर्ववत गर्न सकिँदैन।',
    hindi:
      'क्या आप वाकई {name} को मालिक बनाना चाहते हैं? यह कार्रवाई पूर्ववत नहीं की जा सकती।',
    burmese:
      'သင်သည် {name} ကို ပိုင်ရှင်အဖြစ် ပြောင်းလဲလိုပါသလား? ဤလုပ်ဆောင်ချက်ကို ပြန်လည်ပြုပြင်မရပါ။',
    thai: 'คุณแน่ใจหรือไม่ว่าต้องการทำให้ {name} เป็นเจ้าของ? การดำเนินการนี้ไม่สามารถยกเลิกได้',
    mandarin: '您确定要让 {name} 成为所有者吗？此操作无法撤消。'
  },
  confirmLeave: {
    english: 'Leave Project',
    spanish: 'Abandonar Proyecto',
    brazilian_portuguese: 'Sair do Projeto',
    tok_pisin: 'Lusim Project',
    indonesian: 'Tinggalkan Proyek',
    nepali: 'प्रोजेक्ट छोड्नुहोस्',
    hindi: 'परियोजना छोड़ें',
    burmese: 'စီမံကိန်းမှ ထွက်ပါ',
    thai: 'ออกจากโครงการ',
    mandarin: '离开项目'
  },
  confirmLeaveMessage: {
    english: 'Are you sure you want to leave this project?',
    spanish: '¿Está seguro de que desea abandonar este proyecto?',
    brazilian_portuguese: 'Tem certeza de que deseja sair deste projeto?',
    tok_pisin: 'Yu tru laik lusim dispela project?',
    indonesian: 'Apakah Anda yakin ingin meninggalkan proyek ini?',
    nepali: 'के तपाईं यो प्रोजेक्ट छोड्न निश्चित हुनुहुन्छ?',
    hindi: 'क्या आप वाकई इस परियोजना को छोड़ना चाहते हैं?',
    burmese: 'သင်သည် ဤစီမံကိန်းမှ ထွက်လိုပါသလား?',
    thai: 'คุณแน่ใจหรือไม่ว่าต้องการออกจากโครงการนี้?',
    mandarin: '您确定要离开此项目吗？'
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
      'Anda tidak dapat meninggalkan proyek ini karena Anda adalah satu-satunya pemilik. Silakan promosikan anggota lain menjadi pemilik terlebih dahulu.',
    nepali:
      'तपाईं एक्लो मालिक भएको हुनाले यो प्रोजेक्ट छोड्न सक्नुहुन्न। कृपया पहिले अर्को सदस्यलाई मालिक बनाउनुहोस्।',
    hindi:
      'आप इस परियोजना को नहीं छोड़ सकते क्योंकि आप एकमात्र मालिक हैं। कृपया पहले किसी अन्य सदस्य को मालिक बनाएं।',
    burmese:
      'သင်သည် တစ်ဦးတည်းသော ပိုင်ရှင်ဖြစ်သောကြောင့် ဤစီမံကိန်းမှ ထွက်၍မရပါ။ ကျေးဇူးပြု၍ အခြားအဖွဲ့ဝင်တစ်ဦးကို ပိုင်ရှင်အဖြစ် မြှင့်တင်ပါ။',
    thai: 'คุณไม่สามารถออกจากโครงการนี้ได้เนื่องจากคุณเป็นเจ้าของคนเดียว กรุณาเลื่อนตำแหน่งสมาชิกคนอื่นเป็นเจ้าของก่อน',
    mandarin:
      '您不能离开此项目，因为您是唯一的所有者。请先将另一个成员提升为所有者。'
  },
  invitationAlreadySent: {
    english: 'An invitation has already been sent to this email address.',
    spanish:
      'Ya se ha enviado una invitación a esta dirección de correo electrónico.',
    brazilian_portuguese:
      'Um convite já foi enviado para este endereço de e-mail.',
    tok_pisin: 'Invitation i go pinis long dispela email adres.',
    indonesian: 'Undangan sudah dikirim ke alamat email ini.',
    nepali: 'यो इमेल ठेगानामा पहिले नै आमन्त्रण पठाइसकिएको छ।',
    hindi: 'इस ईमेल पते पर पहले से ही एक आमंत्रण भेजा जा चुका है।',
    burmese: 'ဤအီးမေးလ်လိပ်စာသို့ ဖိတ်ခေါ်မှုကို ပို့ပြီးပါပြီ။',
    thai: 'ได้ส่งคำเชิญไปยังที่อยู่อีเมลนี้แล้ว',
    mandarin: '已向此电子邮件地址发送了邀请。'
  },
  invitationSent: {
    english: 'Invitation sent successfully',
    spanish: 'Invitación enviada con éxito',
    brazilian_portuguese: 'Convite enviado com sucesso',
    tok_pisin: 'Invitation i go gut',
    indonesian: 'Undangan berhasil dikirim',
    nepali: 'आमन्त्रण सफलतापूर्वक पठाइयो',
    hindi: 'आमंत्रण सफलतापूर्वक भेजा गया',
    burmese: 'ဖိတ်ခေါ်မှုကို အောင်မြင်စွာ ပို့ပြီးပါပြီ',
    thai: 'ส่งคำเชิญสำเร็จ',
    mandarin: '邀请发送成功'
  },
  expiredInvitation: {
    english: 'Expired',
    spanish: 'Expirado',
    brazilian_portuguese: 'Expirado',
    tok_pisin: 'Pinis',
    indonesian: 'Kedaluwarsa',
    nepali: 'समाप्त भयो',
    hindi: 'समाप्त',
    burmese: 'သက်တမ်းကုန်ဆုံးပါပြီ',
    thai: 'หมดอายุ',
    mandarin: '已过期'
  },
  declinedInvitation: {
    english: 'Declined',
    spanish: 'Rechazado',
    brazilian_portuguese: 'Recusado',
    tok_pisin: 'Refusim',
    indonesian: 'Ditolak',
    nepali: 'अस्वीकृत',
    hindi: 'अस्वीकृत',
    burmese: 'ငြင်းဆိုပါသည်',
    thai: 'ปฏิเสธ',
    mandarin: '已拒绝'
  },
  withdrawnInvitation: {
    english: 'Withdrawn',
    spanish: 'Retirado',
    brazilian_portuguese: 'Retirado',
    tok_pisin: 'Rausim',
    indonesian: 'Ditarik',
    nepali: 'फिर्ता लिइएको',
    hindi: 'वापस लिया गया',
    burmese: 'ရုပ်သိမ်းပြီး',
    thai: 'ถอนแล้ว',
    mandarin: '已撤回'
  },
  sending: {
    english: 'Sending...',
    spanish: 'Enviando...',
    brazilian_portuguese: 'Enviando...',
    tok_pisin: 'Salim...',
    indonesian: 'Mengirim...',
    nepali: 'पठाउँदै...',
    hindi: 'भेज रहे हैं...',
    burmese: 'ပို့နေသည်...',
    thai: 'กำลังส่ง...',
    mandarin: '正在发送...'
  },
  failedToRemoveMember: {
    english: 'Failed to remove member',
    spanish: 'Error al eliminar miembro',
    brazilian_portuguese: 'Falha ao remover membro',
    tok_pisin: 'I no inap rausim member',
    indonesian: 'Gagal menghapus anggota',
    nepali: 'सदस्य हटाउन असफल',
    hindi: 'सदस्य हटाने में विफल',
    burmese: 'အဖွဲ့ဝင်ကို ဖယ်ရှား၍မရပါ',
    thai: 'ลบสมาชิกไม่สำเร็จ',
    mandarin: '移除成员失败'
  },
  failedToPromoteMember: {
    english: 'Failed to promote member',
    spanish: 'Error al promover miembro',
    brazilian_portuguese: 'Falha ao promover membro',
    tok_pisin: 'I no inap promotim member',
    indonesian: 'Gagal mempromosikan anggota',
    nepali: 'सदस्यलाई प्रमोट गर्न असफल',
    hindi: 'सदस्य को प्रोन्नत करने में विफल',
    burmese: 'အဖွဲ့ဝင်ကို မြှင့်တင်၍မရပါ',
    thai: 'เลื่อนตำแหน่งสมาชิกไม่สำเร็จ',
    mandarin: '提升成员失败'
  },
  failedToLeaveProject: {
    english: 'Failed to leave project',
    spanish: 'Error al abandonar el proyecto',
    brazilian_portuguese: 'Falha ao sair do projeto',
    tok_pisin: 'I no inap lusim project',
    indonesian: 'Gagal meninggalkan proyek',
    nepali: 'प्रोजेक्ट छोड्न असफल',
    hindi: 'परियोजना छोड़ने में विफल',
    burmese: 'စီမံကိန်းမှ ထွက်၍မရပါ',
    thai: 'ออกจากโครงการไม่สำเร็จ',
    mandarin: '离开项目失败'
  },
  failedToWithdrawInvitation: {
    english: 'Failed to withdraw invitation',
    spanish: 'Error al retirar la invitación',
    brazilian_portuguese: 'Falha ao retirar o convite',
    tok_pisin: 'I no inap rausim invitation',
    indonesian: 'Gagal menarik undangan',
    nepali: 'आमन्त्रण फिर्ता लिन असफल',
    hindi: 'आमंत्रण वापस लेने में विफल',
    burmese: 'ဖိတ်ခေါ်မှုကို ရုပ်သိမ်း၍မရပါ',
    thai: 'ถอนคำเชิญไม่สำเร็จ',
    mandarin: '撤回邀请失败'
  },
  failedToSendInvitation: {
    english: 'Failed to send invitation',
    spanish: 'Error al enviar la invitación',
    brazilian_portuguese: 'Falha ao enviar o convite',
    tok_pisin: 'I no inap salim invitation',
    indonesian: 'Gagal mengirim undangan',
    nepali: 'आमन्त्रण पठाउन असफल',
    hindi: 'आमंत्रण भेजने में विफल',
    burmese: 'ဖိတ်ခေါ်မှုကို ပို့၍မရပါ',
    thai: 'ส่งคำเชิญไม่สำเร็จ',
    mandarin: '发送邀请失败'
  },
  privateProject: {
    english: 'Private Project',
    spanish: 'Proyecto Privado',
    brazilian_portuguese: 'Projeto Privado',
    tok_pisin: 'Private Project',
    indonesian: 'Proyek Pribadi',
    nepali: 'निजी प्रोजेक्ट',
    hindi: 'निजी परियोजना',
    burmese: 'ကိုယ်ပိုင် စီမံကိန်း',
    thai: 'โครงการส่วนตัว',
    mandarin: '私有项目'
  },
  privateProjectDescription: {
    english:
      'The project is open for viewing by anyone, but only members can contribute.',
    spanish:
      'El proyecto está abierto para visualización por cualquiera, pero solo los miembros pueden contribuir.',
    brazilian_portuguese:
      'O projeto está aberto para visualização por qualquer pessoa, mas apenas os membros podem contribuir.',
    tok_pisin:
      'Dispela project i open long olgeta man long lukim, tasol ol member tasol ken contributim.',
    indonesian:
      'Proyek terbuka untuk dilihat oleh siapa saja, tetapi hanya anggota yang dapat berkontribusi.',
    nepali:
      'प्रोजेक्ट जोसुकैले हेर्नको लागि खुला छ, तर सदस्यहरूले मात्र योगदान गर्न सक्छन्।',
    hindi:
      'परियोजना किसी के भी देखने के लिए खुली है, लेकिन केवल सदस्य ही योगदान दे सकते हैं।',
    burmese:
      'စီမံကိန်းကို မည်သူမဆို ကြည့်ရှုနိုင်သော်လည်း၊ အဖွဲ့ဝင်များသာ ပံ့ပိုးနိုင်သည်။',
    thai: 'โครงการเปิดให้ทุกคนดูได้ แต่เฉพาะสมาชิกเท่านั้นที่สามารถมีส่วนร่วมได้',
    mandarin: '该项目对任何人开放查看，但只有成员可以贡献。'
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
      'Untuk berkontribusi pada proyek ini, Anda perlu meminta keanggotaan. Pemilik proyek akan meninjau permintaan Anda.',
    nepali:
      'यो प्रोजेक्टमा योगदान गर्न, तपाईंले सदस्यता अनुरोध गर्नुपर्छ। प्रोजेक्ट मालिकहरूले तपाईंको अनुरोध समीक्षा गर्नेछन्।',
    hindi:
      'इस परियोजना में योगदान देने के लिए, आपको सदस्यता का अनुरोध करना होगा। परियोजना मालिक आपके अनुरोध की समीक्षा करेंगे।',
    burmese:
      'ဤစီမံကိန်းသို့ ပံ့ပိုးရန်၊ သင်သည် အဖွဲ့ဝင်အဖြစ် တောင်းဆိုရမည်။ စီမံကိန်း ပိုင်ရှင်များက သင်၏ တောင်းဆိုမှုကို စိစစ်ပါမည်။',
    thai: 'เพื่อมีส่วนร่วมในโครงการนี้ คุณต้องขอเป็นสมาชิก เจ้าของโครงการจะตรวจสอบคำขอของคุณ',
    mandarin:
      '要为此项目做出贡献，您需要请求成员资格。项目所有者将审查您的请求。'
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
      'Ini adalah proyek pribadi. Anda harus masuk untuk meminta akses.',
    nepali:
      'यो एउटा निजी प्रोजेक्ट हो। पहुँच अनुरोध गर्न तपाईं लग इन हुनुपर्छ।',
    hindi:
      'यह एक निजी परियोजना है। पहुंच का अनुरोध करने के लिए आपको लॉग इन होना होगा।',
    burmese:
      '၎င်းသည် ကိုယ်ပိုင် စီမံကိန်းတစ်ခု ဖြစ်သည်။ ဝင်ရောက်ခွင့် တောင်းဆိုရန် သင်သည် အကောင့်ဝင်ရမည်။',
    thai: 'นี่คือโครงการส่วนตัว คุณต้องเข้าสู่ระบบเพื่อขอสิทธิ์เข้าถึง',
    mandarin: '这是一个私有项目。您必须登录才能请求访问。'
  },
  privateProjectLoginRequired: {
    english: 'Please sign in to request membership to this private project.',
    spanish:
      'Por favor, inicie sesión para solicitar membresía a este proyecto privado.',
    brazilian_portuguese:
      'Por favor, faça login para solicitar associação a este projeto privado.',
    tok_pisin:
      'Plis sign in long askim membership long dispela private project.',
    indonesian: 'Silakan masuk untuk meminta keanggotaan proyek pribadi ini.',
    nepali: 'कृपया यो निजी प्रोजेक्टमा सदस्यता अनुरोध गर्न साइन इन गर्नुहोस्।',
    hindi:
      'कृपया इस निजी परियोजना में सदस्यता का अनुरोध करने के लिए साइन इन करें।',
    burmese:
      'ကျေးဇူးပြု၍ ဤကိုယ်ပိုင် စီမံကိန်းသို့ အဖွဲ့ဝင်အဖြစ် တောင်းဆိုရန် အကောင့်ဝင်ပါ။',
    thai: 'กรุณาเข้าสู่ระบบเพื่อขอเป็นสมาชิกในโครงการส่วนตัวนี้',
    mandarin: '请登录以请求此私有项目的成员资格。'
  },
  requestMembership: {
    english: 'Request Membership',
    spanish: 'Solicitar Membresía',
    brazilian_portuguese: 'Solicitar Associação',
    tok_pisin: 'Askim Membership',
    indonesian: 'Minta Keanggotaan',
    nepali: 'सदस्यता अनुरोध गर्नुहोस्',
    hindi: 'सदस्यता का अनुरोध करें',
    burmese: 'အဖွဲ့ဝင်အဖြစ် တောင်းဆိုပါ',
    thai: 'ขอเป็นสมาชิก',
    mandarin: '请求成员资格'
  },
  requesting: {
    english: 'Requesting...',
    spanish: 'Solicitando...',
    brazilian_portuguese: 'Solicitando...',
    tok_pisin: 'Askim...',
    indonesian: 'Meminta...',
    nepali: 'अनुरोध गर्दै...',
    hindi: 'अनुरोध कर रहे हैं...',
    burmese: 'တောင်းဆိုနေသည်...',
    thai: 'กำลังขอ...',
    mandarin: '正在请求...'
  },
  requestPending: {
    english: 'Request Pending',
    spanish: 'Solicitud Pendiente',
    brazilian_portuguese: 'Solicitação Pendente',
    tok_pisin: 'Request i wet',
    indonesian: 'Permintaan Tertunda',
    nepali: 'अनुरोध बाँकी छ',
    hindi: 'अनुरोध लंबित',
    burmese: 'တောင်းဆိုမှု စောင့်ဆိုင်းနေသည်',
    thai: 'คำขอรอดำเนินการ',
    mandarin: '请求待处理'
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
      'Permintaan keanggotaan Anda sedang menunggu tinjauan oleh pemilik proyek.',
    nepali:
      'तपाईंको सदस्यता अनुरोध प्रोजेक्ट मालिकहरूद्वारा समीक्षाको लागि पर्खिरहेको छ।',
    hindi:
      'आपका सदस्यता अनुरोध परियोजना मालिकों द्वारा समीक्षा के लिए लंबित है।',
    burmese:
      'သင်၏ အဖွဲ့ဝင်အဖြစ် တောင်းဆိုမှုကို စီမံကိန်း ပိုင်ရှင်များက စိစစ်နေသည်။',
    thai: 'คำขอเป็นสมาชิกของคุณกำลังรอการตรวจสอบโดยเจ้าของโครงการ',
    mandarin: '您的成员资格请求正在等待项目所有者审核。'
  },
  withdrawRequest: {
    english: 'Withdraw Request',
    spanish: 'Retirar Solicitud',
    brazilian_portuguese: 'Retirar Solicitação',
    tok_pisin: 'Rausim Request',
    indonesian: 'Tarik Permintaan',
    nepali: 'अनुरोध फिर्ता लिनुहोस्',
    hindi: 'अनुरोध वापस लें',
    burmese: 'တောင်းဆိုမှုကို ရုပ်သိမ်းပါ',
    thai: 'ถอนคำขอ',
    mandarin: '撤回请求'
  },
  withdrawing: {
    english: 'Withdrawing...',
    spanish: 'Retirando...',
    brazilian_portuguese: 'Retirando...',
    tok_pisin: 'Rausim...',
    indonesian: 'Menarik...',
    nepali: 'फिर्ता लिँदै...',
    hindi: 'वापस ले रहे हैं...',
    burmese: 'ရုပ်သိမ်းနေသည်...',
    thai: 'กำลังถอน...',
    mandarin: '正在撤回...'
  },
  confirmWithdraw: {
    english: 'Withdraw Request',
    spanish: 'Retirar Solicitud',
    brazilian_portuguese: 'Retirar Solicitação',
    tok_pisin: 'Rausim Request',
    indonesian: 'Tarik Permintaan',
    nepali: 'अनुरोध फिर्ता लिनुहोस्',
    hindi: 'अनुरोध वापस लें',
    burmese: 'တောင်းဆိုမှုကို ရုပ်သိမ်းပါ',
    thai: 'ถอนคำขอ',
    mandarin: '撤回请求'
  },
  confirmWithdrawRequestMessage: {
    english: 'Are you sure you want to withdraw your membership request?',
    spanish: '¿Está seguro de que desea retirar su solicitud de membresía?',
    brazilian_portuguese:
      'Tem certeza de que deseja retirar sua solicitação de associação?',
    tok_pisin: 'Yu tru laik rausim membership request bilong yu?',
    indonesian: 'Apakah Anda yakin ingin menarik permintaan keanggotaan Anda?',
    nepali: 'के तपाईं आफ्नो सदस्यता अनुरोध फिर्ता लिन निश्चित हुनुहुन्छ?',
    hindi: 'क्या आप वाकई अपना सदस्यता अनुरोध वापस लेना चाहते हैं?',
    burmese: 'သင်သည် သင်၏ အဖွဲ့ဝင်အဖြစ် တောင်းဆိုမှုကို ရုပ်သိမ်းလိုပါသလား?',
    thai: 'คุณแน่ใจหรือไม่ว่าต้องการถอนคำขอเป็นสมาชิกของคุณ?',
    mandarin: '您确定要撤回您的成员资格请求吗？'
  },
  requestWithdrawn: {
    english: 'Request withdrawn successfully',
    spanish: 'Solicitud retirada con éxito',
    brazilian_portuguese: 'Solicitação retirada com sucesso',
    tok_pisin: 'Request i rausim gut',
    indonesian: 'Permintaan berhasil ditarik',
    nepali: 'अनुरोध सफलतापूर्वक फिर्ता लिइयो',
    hindi: 'अनुरोध सफलतापूर्वक वापस लिया गया',
    burmese: 'တောင်းဆိုမှုကို အောင်မြင်စွာ ရုပ်သိမ်းပြီးပါပြီ',
    thai: 'ถอนคำขอสำเร็จ',
    mandarin: '请求已成功撤回'
  },
  requestExpired: {
    english: 'Request Expired',
    spanish: 'Solicitud Expirada',
    brazilian_portuguese: 'Solicitação Expirada',
    tok_pisin: 'Request i pinis',
    indonesian: 'Permintaan Kedaluwarsa',
    nepali: 'अनुरोध समाप्त भयो',
    hindi: 'अनुरोध समाप्त हो गया',
    burmese: 'တောင်းဆိုမှု သက်တမ်းကုန်ဆုံးပါပြီ',
    thai: 'คำขอหมดอายุ',
    mandarin: '请求已过期'
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
      'Permintaan keanggotaan Anda telah kedaluwarsa. Anda dapat mengirim permintaan baru.',
    nepali:
      'तपाईंको सदस्यता अनुरोध समाप्त भयो। तपाईं नयाँ अनुरोध पेश गर्न सक्नुहुन्छ।',
    hindi:
      'आपका सदस्यता अनुरोध समाप्त हो गया है। आप एक नया अनुरोध जमा कर सकते हैं।',
    burmese:
      'သင်၏ အဖွဲ့ဝင်အဖြစ် တောင်းဆိုမှု သက်တမ်းကုန်ဆုံးပါပြီ။ သင်သည် တောင်းဆိုမှု အသစ်တစ်ခု ပေးပို့နိုင်သည်။',
    thai: 'คำขอเป็นสมาชิกของคุณหมดอายุแล้ว คุณสามารถส่งคำขอใหม่ได้',
    mandarin: '您的成员资格请求已过期。您可以提交新请求。'
  },
  requestAgain: {
    english: 'Request Again',
    spanish: 'Solicitar Nuevamente',
    brazilian_portuguese: 'Solicitar Novamente',
    tok_pisin: 'Askim Gen',
    indonesian: 'Minta Lagi',
    nepali: 'फेरि अनुरोध गर्नुहोस्',
    hindi: 'फिर से अनुरोध करें',
    burmese: 'ထပ်မံ တောင်းဆိုပါ',
    thai: 'ขออีกครั้ง',
    mandarin: '再次请求'
  },
  requestDeclined: {
    english: 'Request Declined',
    spanish: 'Solicitud Rechazada',
    brazilian_portuguese: 'Solicitação Recusada',
    tok_pisin: 'Request i no',
    indonesian: 'Permintaan Ditolak',
    nepali: 'अनुरोध अस्वीकृत',
    hindi: 'अनुरोध अस्वीकृत',
    burmese: 'တောင်းဆိုမှု ငြင်းဆိုပါသည်',
    thai: 'คำขอถูกปฏิเสธ',
    mandarin: '请求已拒绝'
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
      'Permintaan keanggotaan Anda ditolak. Anda memiliki {attempts} percobaan lagi untuk meminta keanggotaan.',
    nepali:
      'तपाईंको सदस्यता अनुरोध अस्वीकार गरियो। तपाईंसँग सदस्यता अनुरोध गर्न {attempts} थप प्रयासहरू बाँकी छन्।',
    hindi:
      'आपका सदस्यता अनुरोध अस्वीकार कर दिया गया था। आपके पास सदस्यता का अनुरोध करने के लिए {attempts} और प्रयास बचे हैं।',
    burmese:
      'သင်၏ အဖွဲ့ဝင်အဖြစ် တောင်းဆိုမှုကို ငြင်းဆိုပါသည်။ အဖွဲ့ဝင်အဖြစ် တောင်းဆိုရန် {attempts} ထပ်မံကြိုးစားခွင့် ရှိပါသေးသည်။',
    thai: 'คำขอเป็นสมาชิกของคุณถูกปฏิเสธ คุณมีโอกาสขอเป็นสมาชิกอีก {attempts} ครั้ง',
    mandarin: '您的成员资格请求已被拒绝。您还有 {attempts} 次机会请求成员资格。'
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
      'Permintaan keanggotaan Anda ditolak dan Anda telah mencapai jumlah maksimum percobaan.',
    nepali:
      'तपाईंको सदस्यता अनुरोध अस्वीकार गरियो र तपाईंले अधिकतम प्रयासहरूको सीमा पुगिसक्नुभयो।',
    hindi:
      'आपका सदस्यता अनुरोध अस्वीकार कर दिया गया था और आपने अधिकतम प्रयासों की सीमा पहुंच गई है।',
    burmese:
      'သင်၏ အဖွဲ့ဝင်အဖြစ် တောင်းဆိုမှုကို ငြင်းဆိုပါသည် နှင့် သင်သည် အများဆုံး ကြိုးစားခွင့် အရေအတွက်သို့ ရောက်ရှိပါပြီ။',
    thai: 'คำขอเป็นสมาชิกของคุณถูกปฏิเสธ และคุณถึงจำนวนครั้งสูงสุดแล้ว',
    mandarin: '您的成员资格请求已被拒绝，您已达到最大尝试次数。'
  },
  requestWithdrawnTitle: {
    english: 'Request Withdrawn',
    spanish: 'Solicitud Retirada',
    brazilian_portuguese: 'Solicitação Retirada',
    nepali: 'अनुरोध फिर्ता लिइयो',
    tok_pisin: 'Request i Rausim',
    indonesian: 'Permintaan Ditarik',
    hindi: 'अनुरोध वापस लिया गया',
    burmese: 'တောင်းဆိုမှု ရုပ်သိမ်းပြီးပါပြီ',
    thai: 'ถอนคำขอแล้ว',
    mandarin: '请求已撤回'
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
      'Anda telah menarik permintaan keanggotaan Anda. Anda dapat mengirim permintaan baru kapan saja.',
    nepali:
      'तपाईंले आफ्नो सदस्यता अनुरोध फिर्ता लिनुभयो। तपाईं जुनसुकै समय नयाँ अनुरोध पेश गर्न सक्नुहुन्छ।',
    hindi:
      'आपने अपना सदस्यता अनुरोध वापस ले लिया है। आप किसी भी समय एक नया अनुरोध जमा कर सकते हैं।',
    burmese:
      'သင်သည် သင်၏ အဖွဲ့ဝင်အဖြစ် တောင်းဆိုမှုကို ရုပ်သိမ်းပါပြီ။ သင်သည် မည်သည့်အချိန်တွင်မဆို တောင်းဆိုမှု အသစ်တစ်ခု ပေးပို့နိုင်သည်။',
    thai: 'คุณได้ถอนคำขอเป็นสมาชิกแล้ว คุณสามารถส่งคำขอใหม่ได้ตลอดเวลา',
    mandarin: '您已撤回您的成员资格请求。您可以随时提交新请求。'
  },
  membershipRequestSent: {
    english: 'Membership request sent successfully',
    spanish: 'Solicitud de membresía enviada con éxito',
    brazilian_portuguese: 'Solicitação de associação enviada com sucesso',
    tok_pisin: 'Membership request i go gut',
    indonesian: 'Permintaan keanggotaan berhasil dikirim',
    nepali: 'सदस्यता अनुरोध सफलतापूर्वक पठाइयो',
    hindi: 'सदस्यता अनुरोध सफलतापूर्वक भेजा गया',
    burmese: 'အဖွဲ့ဝင်အဖြစ် တောင်းဆိုမှု အောင်မြင်စွာ ပေးပို့ပါပြီ',
    thai: 'ส่งคำขอเป็นสมาชิกสำเร็จ',
    mandarin: '成员资格请求已成功发送'
  },
  failedToRequestMembership: {
    english: 'Failed to request membership',
    spanish: 'Error al solicitar membresía',
    brazilian_portuguese: 'Falha ao solicitar associação',
    tok_pisin: 'I no inap askim membership',
    indonesian: 'Gagal meminta keanggotaan',
    nepali: 'सदस्यता अनुरोध गर्न असफल',
    hindi: 'सदस्यता का अनुरोध करने में विफल',
    burmese: 'အဖွဲ့ဝင်အဖြစ် တောင်းဆိုရန် မအောင်မြင်ပါ',
    thai: 'ขอเป็นสมาชิกไม่สำเร็จ',
    mandarin: '请求成员资格失败'
  },
  failedToWithdrawRequest: {
    english: 'Failed to withdraw request',
    spanish: 'Error al retirar la solicitud',
    brazilian_portuguese: 'Falha ao retirar a solicitação',
    tok_pisin: 'I no inap rausim request',
    indonesian: 'Gagal menarik permintaan',
    nepali: 'अनुरोध फिर्ता लिन असफल',
    hindi: 'अनुरोध वापस लेने में विफल',
    burmese: 'တောင်းဆိုမှုကို ရုပ်သိမ်းရန် မအောင်မြင်ပါ',
    thai: 'ถอนคำขอไม่สำเร็จ',
    mandarin: '撤回请求失败'
  },
  goBack: {
    english: 'Go Back',
    spanish: 'Volver',
    brazilian_portuguese: 'Voltar',
    tok_pisin: 'Go Bek',
    indonesian: 'Kembali',
    nepali: 'पछाडि जानुहोस्',
    hindi: 'वापस जाएं',
    burmese: 'ပြန်သွားပါ',
    thai: 'กลับ',
    mandarin: '返回'
  },
  back: {
    english: 'Back',
    spanish: 'Atrás',
    brazilian_portuguese: 'Voltar',
    tok_pisin: 'Go Bek',
    indonesian: 'Kembali',
    nepali: 'पछाडि',
    hindi: 'वापस',
    burmese: 'ပြန်',
    thai: 'กลับ',
    mandarin: '返回'
  },
  confirmRemove: {
    english: 'Confirm Remove',
    spanish: 'Confirmar Eliminación',
    brazilian_portuguese: 'Confirmar Remoção',
    tok_pisin: 'Confirm Rausim',
    indonesian: 'Konfirmasi Hapus',
    nepali: 'हटाउने पुष्टि गर्नुहोस्',
    hindi: 'हटाने की पुष्टि करें',
    burmese: 'ဖယ်ရှားရန် အတည်ပြုပါ',
    thai: 'ยืนยันการลบ',
    mandarin: '确认删除'
  },
  invitationResent: {
    english: 'Invitation resent successfully',
    spanish: 'Invitación reenviada con éxito',
    brazilian_portuguese: 'Convite reenviado com sucesso',
    tok_pisin: 'Invitation i salim gen gut',
    indonesian: 'Undangan berhasil dikirim ulang',
    nepali: 'आमन्त्रण सफलतापूर्वक पुन: पठाइयो',
    hindi: 'आमंत्रण सफलतापूर्वक पुनः भेजा गया',
    burmese: 'ဖိတ်ခေါ်စာ အောင်မြင်စွာ ပြန်လည် ပေးပို့ပါပြီ',
    thai: 'ส่งคำเชิญอีกครั้งสำเร็จ',
    mandarin: '邀请已成功重新发送'
  },
  maxInviteAttemptsReached: {
    english: 'Maximum invitation attempts reached for this email',
    spanish:
      'Se alcanzó el número máximo de intentos de invitación para este correo',
    brazilian_portuguese:
      'Número máximo de tentativas de convite atingido para este e-mail',
    tok_pisin: 'Maximum invitation chance i pinis long dispela email',
    indonesian: 'Percobaan undangan maksimum tercapai untuk email ini',
    nepali: 'यो इमेलको लागि अधिकतम आमन्त्रण प्रयासहरूको सीमा पुग्यो',
    hindi: 'इस ईमेल के लिए अधिकतम आमंत्रण प्रयासों की सीमा पहुंच गई',
    burmese: 'ဤအီးမေးလ်အတွက် အများဆုံး ဖိတ်ခေါ်စာ ကြိုးစားခွင့် ရောက်ရှိပါပြီ',
    thai: 'ถึงจำนวนครั้งสูงสุดของการส่งคำเชิญสำหรับอีเมลนี้แล้ว',
    mandarin: '此电子邮件的最大邀请尝试次数已达上限'
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
      'Undangan diterima, tetapi unduhan proyek gagal. Anda dapat mengunduhnya nanti dari halaman proyek.',
    nepali:
      'आमन्त्रण स्वीकार गरियो, तर प्रोजेक्ट डाउनलोड असफल भयो। तपाईं यसलाई पछि प्रोजेक्टहरू पृष्ठबाट डाउनलोड गर्न सक्नुहुन्छ।',
    hindi:
      'आमंत्रण स्वीकार कर लिया गया, लेकिन परियोजना डाउनलोड विफल रहा। आप इसे बाद में परियोजनाएं पृष्ठ से डाउनलोड कर सकते हैं।',
    burmese:
      'ဖိတ်ခေါ်စာ လက်ခံပါပြီ၊ သို့သော် စီမံကိန်း ဒေါင်းလုဒ်လုပ်ရန် မအောင်မြင်ပါ။ သင်သည် ၎င်းကို နောက်ပိုင်းတွင် စီမံကိန်းများ စာမျက်နှာမှ ဒေါင်းလုဒ်လုပ်နိုင်သည်။',
    thai: 'ยอมรับคำเชิญแล้ว แต่การดาวน์โหลดโครงการล้มเหลว คุณสามารถดาวน์โหลดได้ภายหลังจากหน้าคำเชิญ',
    mandarin: '邀请已接受，但项目下载失败。您可以稍后从项目页面下载。'
  },
  invitationAcceptedSuccess: {
    english: 'Invitation accepted successfully!',
    spanish: '¡Invitación aceptada con éxito!',
    brazilian_portuguese: 'Convite aceito com sucesso!',
    tok_pisin: 'Invitation i akseptim gut!',
    indonesian: 'Undangan berhasil diterima!',
    nepali: 'आमन्त्रण सफलतापूर्वक स्वीकार गरियो!',
    hindi: 'आमंत्रण सफलतापूर्वक स्वीकार कर लिया गया!',
    burmese: 'ဖိတ်ခေါ်စာ အောင်မြင်စွာ လက်ခံပါပြီ!',
    thai: 'ยอมรับคำเชิญสำเร็จ!',
    mandarin: '邀请已成功接受！'
  },
  invitationDeclined: {
    english: 'Invitation declined.',
    spanish: 'Invitación rechazada.',
    brazilian_portuguese: 'Convite recusado.',
    tok_pisin: 'Invitation i no.',
    indonesian: 'Undangan ditolak.',
    nepali: 'आमन्त्रण अस्वीकृत।',
    hindi: 'आमंत्रण अस्वीकार कर दिया गया।',
    burmese: 'ဖိတ်ခေါ်စာ ငြင်းဆိုပါသည်။',
    thai: 'ปฏิเสธคำเชิญ',
    mandarin: '邀请已拒绝。'
  },
  joinRequest: {
    english: 'Join Request',
    spanish: 'Solicitud de Unión',
    brazilian_portuguese: 'Solicitação de Adesão',
    tok_pisin: 'Join Request',
    indonesian: 'Permintaan Bergabung',
    nepali: 'सामेल हुने अनुरोध',
    hindi: 'शामिल होने का अनुरोध',
    burmese: 'ပါဝင်ရန် တောင်းဆိုမှု',
    thai: 'คำขอเข้าร่วม',
    mandarin: '加入请求'
  },
  privateProjectAccess: {
    english: 'Private Project Access',
    spanish: 'Acceso a Proyecto Privado',
    brazilian_portuguese: 'Acesso ao Projeto Privado',
    tok_pisin: 'Private Project Access',
    indonesian: 'Akses Proyek Pribadi',
    nepali: 'निजी प्रोजेक्ट पहुँच',
    hindi: 'निजी परियोजना पहुंच',
    burmese: 'ကိုယ်ပိုင် စီမံကိန်း ဝင်ရောက်ခွင့်',
    thai: 'การเข้าถึงโครงการส่วนตัว',
    mandarin: '私有项目访问'
  },
  privateProjectDownload: {
    english: 'Private Project Download',
    spanish: 'Descarga de Proyecto Privado',
    brazilian_portuguese: 'Download de Projeto Privado',
    tok_pisin: 'Private Project Download',
    indonesian: 'Unduh Proyek Pribadi',
    nepali: 'निजी प्रोजेक्ट डाउनलोड',
    hindi: 'निजी परियोजना डाउनलोड',
    burmese: 'ကိုယ်ပိုင် စီမံကိန်း ဒေါင်းလုဒ်',
    thai: 'การดาวน์โหลดโครงการส่วนตัว',
    mandarin: '私有项目下载'
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
      'Proyek ini pribadi. Anda dapat mengunduh konten tetapi tidak akan dapat berkontribusi terjemahan atau suara. Minta akses untuk bergabung dengan proyek ini dan mulai berkontribusi.',
    nepali:
      'यो प्रोजेक्ट निजी छ। तपाईं सामग्री डाउनलोड गर्न सक्नुहुन्छ तर अनुवाद वा मतहरू योगदान गर्न सक्षम हुनुहुने छैन। यो प्रोजेक्टमा सामेल हुन र योगदान गर्न सुरु गर्न पहुँच अनुरोध गर्नुहोस्।',
    hindi:
      'यह परियोजना निजी है। आप सामग्री डाउनलोड कर सकते हैं लेकिन अनुवाद या वोट योगदान करने में सक्षम नहीं होंगे। इस परियोजना में शामिल होने और योगदान शुरू करने के लिए पहुंच का अनुरोध करें।',
    burmese:
      'ဤစီမံကိန်းသည် ကိုယ်ပိုင်ဖြစ်သည်။ သင်သည် အကြောင်းအရာကို ဒေါင်းလုဒ်လုပ်နိုင်သော်လည်း ဘာသာပြန်ဆိုမှုများ သို့မဟုတ် မဲများကို ပံ့ပိုးပေးနိုင်မည် မဟုတ်ပါ။ ဤစီမံကိန်းတွင် ပါဝင်ရန် နှင့် ပံ့ပိုးပေးရန် စတင်ရန် ဝင်ရောက်ခွင့် တောင်းဆိုပါ။',
    thai: 'โครงการนี้เป็นโครงการส่วนตัว คุณสามารถดาวน์โหลดเนื้อหาได้ แต่จะไม่สามารถมีส่วนร่วมในการแปลหรือโหวตได้ ขอการเข้าถึงเพื่อเข้าร่วมโครงการนี้และเริ่มมีส่วนร่วม',
    mandarin:
      '此项目是私有的。您可以下载内容，但无法贡献翻译或投票。请求访问以加入此项目并开始贡献。'
  },
  privateProjectEditing: {
    english: 'Private Project Editing',
    spanish: 'Edición de Proyecto Privado',
    brazilian_portuguese: 'Edição de Projeto Privado',
    tok_pisin: 'Private Project Editing',
    indonesian: 'Pengeditan Proyek Pribadi',
    nepali: 'निजी प्रोजेक्ट सम्पादन',
    hindi: 'निजी परियोजना संपादन',
    burmese: 'ကိုယ်ပိုင်စီမံကိန်း တည်းဖြတ်ခြင်း',
    thai: 'การแก้ไขโครงการส่วนตัว',
    mandarin: '私有项目编辑'
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
      'Proyek ini pribadi. Anda perlu menjadi anggota untuk mengedit transkripsi. Minta akses untuk bergabung dengan proyek ini.',
    nepali:
      'यो प्रोजेक्ट निजी छ। ट्रान्सक्रिप्सन सम्पादन गर्न तपाईं सदस्य हुनुपर्छ। यो प्रोजेक्टमा सामेल हुन पहुँच अनुरोध गर्नुहोस्।',
    hindi:
      'यह परियोजना निजी है। ट्रांसक्रिप्शन संपादित करने के लिए आपको सदस्य होना होगा। इस परियोजना में शामिल होने के लिए पहुंच का अनुरोध करें।',
    burmese:
      'ဤစီမံကိန်းသည် ကိုယ်ပိုင်ဖြစ်သည်။ စာသားများကို တည်းဖြတ်ရန် သင်သည် အဖွဲ့ဝင် ဖြစ်ရမည်။ ဤစီမံကိန်းတွင် ပါဝင်ရန် ဝင်ရောက်ခွင့် တောင်းဆိုပါ။',
    thai: 'โครงการนี้เป็นโครงการส่วนตัว คุณต้องเป็นสมาชิกเพื่อแก้ไขการถอดความ ขอการเข้าถึงเพื่อเข้าร่วมโครงการนี้',
    mandarin:
      '此项目是私有的。您需要成为成员才能编辑转录。请求访问以加入此项目。'
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
      'Proyek ini pribadi. Anda perlu menjadi anggota untuk mengakses fitur ini. Minta akses untuk bergabung dengan proyek ini.',
    nepali:
      'यो प्रोजेक्ट निजी छ। यो सुविधा पहुँच गर्न तपाईं सदस्य हुनुपर्छ। यो प्रोजेक्टमा सामेल हुन पहुँच अनुरोध गर्नुहोस्।',
    hindi:
      'यह परियोजना निजी है। इस सुविधा तक पहुंचने के लिए आपको सदस्य होना होगा। इस परियोजना में शामिल होने के लिए पहुंच का अनुरोध करें।',
    burmese:
      'ဤစီမံကိန်းသည် ကိုယ်ပိုင်ဖြစ်သည်။ ဤအင်္ဂါရပ်ကို ဝင်ရောက်ရန် သင်သည် အဖွဲ့ဝင် ဖြစ်ရမည်။ ဤစီမံကိန်းတွင် ပါဝင်ရန် ဝင်ရောက်ခွင့် တောင်းဆိုပါ။',
    thai: 'โครงการนี้เป็นโครงการส่วนตัว คุณต้องเป็นสมาชิกเพื่อเข้าถึงฟีเจอร์นี้ ขอการเข้าถึงเพื่อเข้าร่วมโครงการนี้',
    mandarin:
      '此项目是私有的。您需要成为成员才能访问此功能。请求访问以加入此项目。'
  },
  privateProjectMembers: {
    english: 'Private Project Members',
    spanish: 'Miembros del Proyecto Privado',
    brazilian_portuguese: 'Membros do Projeto Privado',
    tok_pisin: 'Private Project Members',
    indonesian: 'Anggota Proyek Pribadi',
    nepali: 'निजी प्रोजेक्ट सदस्यहरू',
    hindi: 'निजी परियोजना सदस्य',
    burmese: 'ကိုယ်ပိုင် စီမံကိန်း အဖွဲ့ဝင်များ',
    thai: 'สมาชิกโครงการส่วนตัว',
    mandarin: '私有项目成员'
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
      'Anda perlu menjadi anggota untuk melihat daftar anggota dan mengirim undangan. Minta akses untuk bergabung dengan proyek ini.',
    nepali:
      'सदस्य सूची हेर्न र आमन्त्रणहरू पठाउन तपाईं सदस्य हुनुपर्छ। यो प्रोजेक्टमा सामेल हुन पहुँच अनुरोध गर्नुहोस्।',
    hindi:
      'सदस्य सूची देखने और आमंत्रण भेजने के लिए आपको सदस्य होना होगा। इस परियोजना में शामिल होने के लिए पहुंच का अनुरोध करें।',
    burmese:
      'အဖွဲ့ဝင်စာရင်းကို ကြည့်ရှုရန် နှင့် ဖိတ်ခေါ်စာများ ပေးပို့ရန် သင်သည် အဖွဲ့ဝင် ဖြစ်ရမည်။ ဤစီမံကိန်းတွင် ပါဝင်ရန် ဝင်ရောက်ခွင့် တောင်းဆိုပါ။',
    thai: 'คุณต้องเป็นสมาชิกเพื่อดูรายชื่อสมาชิกและส่งคำเชิญ ขอการเข้าถึงเพื่อเข้าร่วมโครงการนี้',
    mandarin: '您需要成为成员才能查看成员列表并发送邀请。请求访问以加入此项目。'
  },
  privateProjectNotLoggedInInline: {
    english: 'You need to be logged in to access this private project.',
    spanish: 'Necesitas iniciar sesión para acceder a este proyecto privado.',
    brazilian_portuguese:
      'Você precisa estar logado para acessar este projeto privado.',
    tok_pisin: 'Yu mas login pastaim long access dispela private project.',
    indonesian: 'Anda perlu masuk untuk mengakses proyek pribadi ini.',
    nepali: 'यो निजी प्रोजेक्ट पहुँच गर्न तपाईं लग इन हुनुपर्छ।',
    hindi: 'इस निजी परियोजना तक पहुंचने के लिए आपको लॉग इन होना होगा।',
    burmese: 'ဤကိုယ်ပိုင် စီမံကိန်းကို ဝင်ရောက်ရန် သင်သည် အကောင့်ဝင်ရမည်။',
    thai: 'คุณต้องเข้าสู่ระบบเพื่อเข้าถึงโครงการส่วนตัวนี้',
    mandarin: '您需要登录才能访问此私有项目。'
  },
  privateProjectTranslation: {
    english: 'Private Project Translation',
    spanish: 'Traducción de Proyecto Privado',
    brazilian_portuguese: 'Tradução de Projeto Privado',
    tok_pisin: 'Private Project Translation',
    indonesian: 'Terjemahan Proyek Pribadi',
    nepali: 'निजी प्रोजेक्ट अनुवाद',
    hindi: 'निजी परियोजना अनुवाद',
    burmese: 'ကိုယ်ပိုင် စီမံကိန်း ဘာသာပြန်ဆိုခြင်း',
    thai: 'การแปลโครงการส่วนตัว',
    mandarin: '私有项目翻译'
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
      'Proyek ini pribadi. Anda perlu menjadi anggota untuk mengirim terjemahan. Minta akses untuk bergabung dengan proyek ini.',
    nepali:
      'यो प्रोजेक्ट निजी छ। अनुवादहरू पेश गर्न तपाईं सदस्य हुनुपर्छ। यो प्रोजेक्टमा सामेल हुन पहुँच अनुरोध गर्नुहोस्।',
    hindi:
      'यह परियोजना निजी है। अनुवाद जमा करने के लिए आपको सदस्य होना होगा। इस परियोजना में शामिल होने के लिए पहुंच का अनुरोध करें।',
    burmese:
      'ဤစီမံကိန်းသည် ကိုယ်ပိုင်ဖြစ်သည်။ ဘာသာပြန်ဆိုမှုများကို ပေးပို့ရန် သင်သည် အဖွဲ့ဝင် ဖြစ်ရမည်။ ဤစီမံကိန်းတွင် ပါဝင်ရန် ဝင်ရောက်ခွင့် တောင်းဆိုပါ။',
    thai: 'โครงการนี้เป็นโครงการส่วนตัว คุณต้องเป็นสมาชิกเพื่อส่งการแปล ขอการเข้าถึงเพื่อเข้าร่วมโครงการนี้',
    mandarin:
      '此项目是私有的。您需要成为成员才能提交翻译。请求访问以加入此项目。'
  },
  privateProjectVoting: {
    english: 'Private Project Voting',
    spanish: 'Votación de Proyecto Privado',
    brazilian_portuguese: 'Votação de Projeto Privado',
    tok_pisin: 'Private Project Voting',
    indonesian: 'Pemungutan Suara Proyek Pribadi',
    nepali: 'निजी प्रोजेक्ट मतदान',
    hindi: 'निजी परियोजना मतदान',
    burmese: 'ကိုယ်ပိုင် စီမံကိန်း မဲပေးခြင်း',
    thai: 'การโหวตโครงการส่วนตัว',
    mandarin: '私有项目投票'
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
      'Proyek ini pribadi. Anda perlu menjadi anggota untuk memilih terjemahan. Minta akses untuk bergabung dengan proyek ini.',
    nepali:
      'यो प्रोजेक्ट निजी छ। अनुवादहरूमा मतदान गर्न तपाईं सदस्य हुनुपर्छ। यो प्रोजेक्टमा सामेल हुन पहुँच अनुरोध गर्नुहोस्।',
    hindi:
      'यह परियोजना निजी है। अनुवादों पर मतदान करने के लिए आपको सदस्य होना होगा। इस परियोजना में शामिल होने के लिए पहुंच का अनुरोध करें।',
    burmese:
      'ဤစီမံကိန်းသည် ကိုယ်ပိုင်ဖြစ်သည်။ ဘာသာပြန်ဆိုမှုများတွင် မဲပေးရန် သင်သည် အဖွဲ့ဝင် ဖြစ်ရမည်။ ဤစီမံကိန်းတွင် ပါဝင်ရန် ဝင်ရောက်ခွင့် တောင်းဆိုပါ။',
    thai: 'โครงการนี้เป็นโครงการส่วนตัว คุณต้องเป็นสมาชิกเพื่อโหวตการแปล ขอการเข้าถึงเพื่อเข้าร่วมโครงการนี้',
    mandarin:
      '此项目是私有的。您需要成为成员才能对翻译进行投票。请求访问以加入此项目。'
  },
  projectInvitation: {
    english: 'Project Invitation',
    spanish: 'Invitación al Proyecto',
    brazilian_portuguese: 'Convite para o Projeto',
    tok_pisin: 'Project Invitation',
    indonesian: 'Undangan Proyek',
    nepali: 'प्रोजेक्ट आमन्त्रण',
    hindi: 'परियोजना आमंत्रण',
    burmese: 'စီမံကိန်း ဖိတ်ခေါ်စာ',
    thai: 'คำเชิญโครงการ',
    mandarin: '项目邀请'
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
      '{sender} mengundang Anda untuk bergabung dengan proyek "{project}" sebagai {role}',
    nepali:
      '{sender} ले तपाईंलाई "{project}" प्रोजेक्टमा {role} को रूपमा सामेल हुन आमन्त्रण गर्नुभयो',
    hindi:
      '{sender} ने आपको "{project}" परियोजना में {role} के रूप में शामिल होने के लिए आमंत्रित किया है',
    burmese:
      '{sender} သည် သင့်အား "{project}" စီမံကိန်းတွင် {role} အဖြစ် ပါဝင်ရန် ဖိတ်ခေါ်ပါသည်',
    thai: '{sender} ได้เชิญคุณเข้าร่วมโครงการ "{project}" ในฐานะ {role}',
    mandarin: '{sender} 已邀请您以 {role} 身份加入项目 "{project}"'
  },
  projectJoinRequestFrom: {
    english: '{sender} has requested to join project "{project}" as {role}',
    spanish:
      '{sender} ha solicitado unirse al proyecto "{project}" como {role}',
    brazilian_portuguese:
      '{sender} solicitou participar do projeto "{project}" como {role}',
    nepali:
      '{sender} ले "{project}" प्रोजेक्टमा {role} को रूपमा सामेल हुन अनुरोध गर्नुभयो',
    hindi:
      '{sender} ने "{project}" परियोजना में {role} के रूप में शामिल होने का अनुरोध किया है',
    burmese:
      '{sender} သည် "{project}" စီမံကိန်းတွင် {role} အဖြစ် ပါဝင်ရန် တောင်းဆိုပါသည်',
    thai: '{sender} ได้ขอเข้าร่วมโครงการ "{project}" ในฐานะ {role}',
    mandarin: '{sender} 已请求以 {role} 身份加入项目 "{project}"'
  },
  projectWillRemainDownloaded: {
    english: 'Project will remain downloaded',
    spanish: 'El proyecto permanecerá descargado',
    brazilian_portuguese: 'O projeto permanecerá baixado',
    tok_pisin: 'Project i pinis download',
    indonesian: 'Proyek akan tetap diunduh',
    nepali: 'प्रोजेक्ट डाउनलोड भएको रहनेछ',
    hindi: 'परियोजना डाउनलोड की हुई रहेगी',
    burmese: 'စီမံကိန်း ဒေါင်းလုဒ်လုပ်ထားသည့် အတိုင်း ရှိနေမည်',
    thai: 'โครงการจะยังคงดาวน์โหลดอยู่',
    mandarin: '项目将保持已下载状态'
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
      'Permintaan keanggotaan Anda telah kedaluwarsa setelah 7 hari. Anda memiliki {attempts} percobaan{plural} tersisa.',
    nepali:
      'तपाईंको अनुरोध ७ दिन पछि समाप्त भयो। तपाईंसँग {attempts} प्रयास{plural} बाँकी छ।',
    hindi:
      'आपका अनुरोध 7 दिनों के बाद समाप्त हो गया। आपके पास {attempts} प्रयास{plural} बचे हैं।',
    burmese:
      'သင်၏ တောင်းဆိုမှု 7 ရက်အကြာတွင် သက်တမ်းကုန်ဆုံးပါပြီ။ သင့်တွင် {attempts} ကြိုးစားခွင့်{plural} ရှိပါသေးသည်။',
    thai: 'คำขอของคุณหมดอายุหลังจาก 7 วัน คุณมีโอกาสอีก {attempts} ครั้ง{plural}',
    mandarin: '您的请求在 7 天后已过期。您还有 {attempts} 次{plural}尝试机会。'
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
      'Permintaan keanggotaan Anda sebelumnya telah kedaluwarsa setelah 7 hari. Anda memiliki {attempts} percobaan{plural} tersisa.',
    nepali:
      'तपाईंको अघिल्लो अनुरोध ७ दिन पछि समाप्त भयो। तपाईंसँग {attempts} प्रयास{plural} बाँकी छ।',
    hindi:
      'आपका पिछला अनुरोध 7 दिनों के बाद समाप्त हो गया। आपके पास {attempts} प्रयास{plural} बचे हैं।',
    burmese:
      'သင်၏ ယခင်တောင်းဆိုမှု 7 ရက်အကြာတွင် သက်တမ်းကုန်ဆုံးပါပြီ။ သင့်တွင် {attempts} ကြိုးစားခွင့်{plural} ရှိပါသေးသည်။',
    thai: 'คำขอก่อนหน้าของคุณหมดอายุหลังจาก 7 วัน คุณมีโอกาสอีก {attempts} ครั้ง{plural}',
    mandarin:
      '您之前的请求在 7 天后已过期。您还有 {attempts} 次{plural}尝试机会。'
  },
  requestExpiredNoAttempts: {
    english: 'Your request expired and you have no more attempts remaining.',
    spanish: 'Su solicitud expiró y no te quedan más intentos.',
    brazilian_portuguese:
      'Sua solicitação expirou e você não tem mais tentativas restantes.',
    tok_pisin:
      'Membership request bilong yu i pinis na yu no gat moa chance long attempt.',
    indonesian:
      'Permintaan keanggotaan Anda telah kedaluwarsa dan Anda tidak memiliki percobaan tersisa.',
    nepali: 'तपाईंको अनुरोध समाप्त भयो र तपाईंसँग थप प्रयासहरू बाँकी छैन।',
    hindi: 'आपका अनुरोध समाप्त हो गया और आपके पास कोई और प्रयास नहीं बचे हैं।',
    burmese:
      'သင်၏ တောင်းဆိုမှု သက်တမ်းကုန်ဆုံးပါပြီ နှင့် သင့်တွင် ထပ်မံကြိုးစားခွင့် မရှိတော့ပါ။',
    thai: 'คำขอของคุณหมดอายุแล้ว และคุณไม่มีโอกาสเหลืออีก',
    mandarin: '您的请求已过期，您没有更多尝试机会了。'
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
      'Permintaan keanggotaan Anda sebelumnya telah kedaluwarsa setelah 7 hari dan Anda tidak memiliki percobaan tersisa.',
    nepali:
      'तपाईंको अघिल्लो अनुरोध ७ दिन पछि समाप्त भयो र तपाईंसँग थप प्रयासहरू बाँकी छैन।',
    hindi:
      'आपका पिछला अनुरोध 7 दिनों के बाद समाप्त हो गया और आपके पास कोई और प्रयास नहीं बचे हैं।',
    burmese:
      'သင်၏ ယခင်တောင်းဆိုမှု 7 ရက်အကြာတွင် သက်တမ်းကုန်ဆုံးပါပြီ နှင့် သင့်တွင် ထပ်မံကြိုးစားခွင့် မရှိတော့ပါ။',
    thai: 'คำขอก่อนหน้าของคุณหมดอายุหลังจาก 7 วัน และคุณไม่มีโอกาสเหลืออีก',
    mandarin: '您之前的请求在 7 天后已过期，您没有更多尝试机会了。'
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
      'Permintaan keanggotaan Anda sedang menunggu persetujuan. Anda akan diberitahu ketika sudah diperiksa.',
    nepali:
      'तपाईंको सदस्यता अनुरोध स्वीकृतिको लागि पर्खिरहेको छ। यसको समीक्षा हुँदा तपाईंलाई सूचित गरिनेछ।',
    hindi:
      'आपका सदस्यता अनुरोध स्वीकृति के लिए लंबित है। इसकी समीक्षा होने पर आपको सूचित किया जाएगा।',
    burmese:
      'သင်၏ အဖွဲ့ဝင်အဖြစ် တောင်းဆိုမှုသည် အတည်ပြုခြင်းအတွက် စောင့်ဆိုင်းနေသည်။ ၎င်းကို စိစစ်သောအခါ သင်အား အကြောင်းကြားပါမည်။',
    thai: 'คำขอเป็นสมาชิกของคุณกำลังรอการอนุมัติ คุณจะได้รับการแจ้งเตือนเมื่อมีการตรวจสอบ',
    mandarin: '您的成员资格请求正在等待批准。审核时您将收到通知。'
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
      'Permintaan keanggotaan Anda ditolak. Anda memiliki {attempts} percobaan{plural} tersisa.',
    nepali:
      'तपाईंको अनुरोध अस्वीकार गरियो। तपाईंसँग {attempts} प्रयास{plural} बाँकी छ।',
    hindi:
      'आपका अनुरोध अस्वीकार कर दिया गया था। आपके पास {attempts} प्रयास{plural} बचे हैं।',
    burmese:
      'သင်၏ တောင်းဆိုမှုကို ငြင်းဆိုပါသည်။ သင့်တွင် {attempts} ကြိုးစားခွင့်{plural} ရှိပါသေးသည်။',
    thai: 'คำขอของคุณถูกปฏิเสธ คุณมีโอกาสอีก {attempts} ครั้ง{plural}',
    mandarin: '您的请求已被拒绝。您还有 {attempts} 次{plural}尝试机会。'
  },
  requestDeclinedNoRetryInline: {
    english:
      'Your request was declined and you have no more attempts remaining.',
    spanish: 'Su solicitud fue rechazada y no te quedan más intentos.',
    brazilian_portuguese:
      'Sua solicitación fue recusada e você não tem mais tentativas restantes.',
    tok_pisin:
      'Membership request bilong yu i no na yu no gat moa chance long attempt.',
    indonesian:
      'Permintaan keanggotaan Anda ditolak dan Anda tidak memiliki percobaan tersisa.',
    nepali: 'तपाईंको अनुरोध अस्वीकार गरियो र तपाईंसँग थप प्रयासहरू बाँकी छैन।',
    hindi:
      'आपका अनुरोध अस्वीकार कर दिया गया था और आपके पास कोई और प्रयास नहीं बचे हैं।',
    burmese:
      'သင်၏ တောင်းဆိုမှုကို ငြင်းဆိုပါသည် နှင့် သင့်တွင် ထပ်မံကြိုးစားခွင့် မရှိတော့ပါ။',
    thai: 'คำขอของคุณถูกปฏิเสธ และคุณไม่มีโอกาสเหลืออีก',
    mandarin: '您的请求已被拒绝，您没有更多尝试机会了。'
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
      'Anda telah menarik permintaan keanggotaan Anda sebelumnya. Anda dapat mengirim permintaan baru kapan saja.',
    nepali:
      'तपाईंले आफ्नो अघिल्लो अनुरोध फिर्ता लिनुभयो। तपाईं जुनसुकै बेला नयाँ अनुरोध पठाउन सक्नुहुन्छ।',
    hindi:
      'आपने अपना पिछला अनुरोध वापस ले लिया है। आप किसी भी समय एक नया अनुरोध भेज सकते हैं।',
    burmese:
      'သင်သည် သင်၏ ယခင်တောင်းဆိုမှုကို ရုပ်သိမ်းပါပြီ။ သင်သည် မည်သည့်အချိန်တွင်မဆို တောင်းဆိုမှု အသစ်တစ်ခု ပေးပို့နိုင်သည်။',
    thai: 'คุณได้ถอนคำขอก่อนหน้าแล้ว คุณสามารถส่งคำขอใหม่ได้ตลอดเวลา',
    mandarin: '您已撤回之前的请求。您可以随时发送新请求。'
  },
  viewProject: {
    english: 'View Project',
    spanish: 'Ver Proyecto',
    brazilian_portuguese: 'Ver Projeto',
    tok_pisin: 'View Project',
    indonesian: 'Lihat Proyek',
    nepali: 'प्रोजेक्ट हेर्नुहोस्',
    hindi: 'परियोजना देखें',
    burmese: 'စီမံကိန်းကို ကြည့်ရှုပါ',
    thai: 'ดูโครงการ',
    mandarin: '查看项目'
  },
  loadingProjectDetails: {
    english: 'Loading project details...',
    spanish: 'Cargando detalles del proyecto...',
    brazilian_portuguese: 'Carregando detalhes do projeto...',
    tok_pisin: 'Loadim project details...',
    indonesian: 'Memuat detail proyek...',
    nepali: 'प्रोजेक्ट विवरण लोड गर्दै...',
    hindi: 'परियोजना विवरण लोड हो रहे हैं...',
    burmese: 'စီမံကိန်း အသေးစိတ်များကို လုပ်ဆောင်နေသည်...',
    thai: 'กำลังโหลดรายละเอียดโครงการ...',
    mandarin: '正在加载项目详情...'
  },
  onlyOwnersCanInvite: {
    english: 'Only project owners can invite new members',
    spanish:
      'Solo los propietarios del proyecto pueden invitar nuevos miembros',
    brazilian_portuguese:
      'Apenas proprietários do projeto podem convidar novos membros',
    tok_pisin: 'Only owner i project i salim member',
    indonesian: 'Hanya pemilik proyek yang dapat mengundang anggota baru',
    nepali: 'प्रोजेक्ट मालिकहरूले मात्र नयाँ सदस्यहरूलाई आमन्त्रित गर्न सक्छन्',
    hindi: 'केवल परियोजना मालिक ही नए सदस्यों को आमंत्रित कर सकते हैं',
    burmese: 'စီမံကိန်း ပိုင်ရှင်များသာ အဖွဲ့ဝင်အသစ်များကို ဖိတ်ခေါ်နိုင်သည်',
    thai: 'เฉพาะเจ้าของโครงการเท่านั้นที่สามารถเชิญสมาชิกใหม่ได้',
    mandarin: '只有项目所有者可以邀请新成员'
  },
  failedToResendInvitation: {
    english: 'Failed to resend invitation',
    spanish: 'Error al reenviar invitación',
    brazilian_portuguese: 'Falha ao reenviar convite',
    tok_pisin: 'I no inap resendim invitation',
    indonesian: 'Gagal mengirim ulang undangan',
    nepali: 'आमन्त्रण पुन: पठाउन असफल',
    hindi: 'आमंत्रण पुनः भेजने में विफल',
    burmese: 'ဖိတ်ခေါ်စာကို ပြန်လည် ပေးပို့ရန် မအောင်မြင်ပါ',
    thai: 'ส่งคำเชิญอีกครั้งไม่สำเร็จ',
    mandarin: '重新发送邀请失败'
  },
  // Restore-related translations
  restoreAndroidOnly: {
    english: 'Restore is only available on Android',
    spanish: 'La restauración solo está disponible en Android',
    brazilian_portuguese: 'A restauração só está disponível no Android',
    tok_pisin: 'Restore i pinis long Android',
    indonesian: 'Pemulihan hanya tersedia di Android',
    nepali: 'पुनर्स्थापना एन्ड्रोइडमा मात्र उपलब्ध छ',
    hindi: 'पुनर्स्थापना केवल Android पर उपलब्ध है',
    burmese: 'ပြန်လည်ရယူခြင်းသည် Android တွင်သာ ရရှိနိုင်သည်',
    thai: 'การกู้คืนมีให้เฉพาะบน Android',
    mandarin: '恢复功能仅在 Android 上可用'
  },
  backupAndroidOnly: {
    english: 'Backup is only available on Android',
    spanish: 'El respaldo solo está disponible en Android',
    brazilian_portuguese: 'O backup só está disponível no Android',
    tok_pisin: 'Backup i pinis long Android',
    indonesian: 'Cadangan hanya tersedia di Android',
    nepali: 'ब्याकअप एन्ड्रोइडमा मात्र उपलब्ध छ',
    hindi: 'बैकअप केवल Android पर उपलब्ध है',
    burmese: 'အရန်သိမ်းဆည်းခြင်းသည် Android တွင်သာ ရရှိနိုင်သည်',
    thai: 'การสำรองข้อมูลมีให้เฉพาะบน Android',
    mandarin: '备份功能仅在 Android 上可用'
  },
  permissionDenied: {
    english: 'Permission Denied',
    spanish: 'Permiso Denegado',
    brazilian_portuguese: 'Permissão Negada',
    tok_pisin: 'Permission i no',
    indonesian: 'Izin Ditolak',
    nepali: 'अनुमति अस्वीकृत',
    hindi: 'अनुमति अस्वीकृत',
    burmese: 'ခွင့်ပြုချက် ငြင်းဆိုပါသည်',
    thai: 'ปฏิเสธการอนุญาต',
    mandarin: '权限被拒绝'
  },
  grantMicrophonePermission: {
    english: 'Grant Microphone Permission',
    spanish: 'Otorgar Permiso de Microfono',
    brazilian_portuguese: 'Conceder Permissão de Microfone',
    tok_pisin: 'Grant Microphone Permission',
    indonesian: 'Mengakses Mikrofon',
    nepali: 'माइक्रोफोन अनुमति दिनुहोस्',
    hindi: 'माइक्रोफोन अनुमति दें',
    burmese: 'မိုက်ခရိုဖုန်း ခွင့်ပြုချက် ပေးပါ',
    thai: 'ให้สิทธิ์ไมโครโฟน',
    mandarin: '授予麦克风权限'
  },
  autoCalibrate: {
    english: 'Auto-Calibrate',
    spanish: 'Auto-Calibrar',
    brazilian_portuguese: 'Auto-Calibrar',
    tok_pisin: 'Olsem wanem yet',
    indonesian: 'Auto-Kalibrasi',
    nepali: 'स्वत: क्यालिब्रेट',
    hindi: 'स्वचालित कैलिब्रेट',
    burmese: 'အလိုအလျောက် စစ်ဆေးခြင်း',
    thai: 'ปรับแต่งอัตโนมัติ',
    mandarin: '自动校准'
  },
  calibrateMicrophone: {
    english: 'Calibrate your microphone',
    spanish: 'Calibra tu micrófono',
    brazilian_portuguese: 'Calibre seu microfone',
    tok_pisin: 'Stretim mikrofon bilong yu',
    indonesian: 'Kalibrasi mikrofon Anda',
    nepali: 'आफ्नो माइक्रोफोन क्यालिब्रेट गर्नुहोस्',
    hindi: 'अपना माइक्रोफोन कैलिब्रेट करें',
    burmese: 'သင်၏ မိုက်ခရိုဖုန်းကို စစ်ဆေးပါ',
    thai: 'ปรับแต่งไมโครโฟนของคุณ',
    mandarin: '校准您的麦克风'
  },
  calibrateMicrophoneDescription: {
    english: 'Let us automatically adjust the sensitivity for your environment',
    spanish:
      'Permítenos ajustar automáticamente la sensibilidad para tu entorno',
    brazilian_portuguese:
      'Deixe-nos ajustar automaticamente a sensibilidade para o seu ambiente',
    tok_pisin:
      'Larim mipela stretim sensetiviti bilong mikrofon long ples bilong yu',
    indonesian:
      'Biarkan kami secara otomatis menyesuaikan sensitivitas untuk lingkungan Anda',
    nepali:
      'तपाईंको वातावरणको लागि स्वचालित रूपमा संवेदनशीलता समायोजन गर्न दिनुहोस्',
    hindi:
      'हमें आपके वातावरण के लिए स्वचालित रूप से संवेदनशीलता समायोजित करने दें',
    burmese:
      'သင်၏ ပတ်ဝန်းကျင်အတွက် အာရုံခံနိုင်စွမ်းကို အလိုအလျောက် ညှိပေးရန် ခွင့်ပြုပါ',
    thai: 'ให้เราปรับความไวให้เหมาะกับสภาพแวดล้อมของคุณโดยอัตโนมัติ',
    mandarin: '让我们自动调整您环境的灵敏度'
  },
  skip: {
    english: 'Skip',
    spanish: 'Omitir',
    brazilian_portuguese: 'Pular',
    tok_pisin: 'Lusim',
    indonesian: 'Lewati',
    nepali: 'छोड्नुहोस्',
    hindi: 'छोड़ें',
    burmese: 'ကျော်သွားပါ',
    thai: 'ข้าม',
    mandarin: '跳过'
  },
  confirmAudioRestore: {
    english: 'Confirm Audio Restore',
    spanish: 'Confirmar Restauración de Audio',
    brazilian_portuguese: 'Confirmar Restauração de Áudio',
    tok_pisin: 'Confirm Audio Restore',
    indonesian: 'Konfirmasi Pemulihan Audio',
    nepali: 'अडियो पुनर्स्थापना पुष्टि गर्नुहोस्',
    hindi: 'ऑडियो पुनर्स्थापना की पुष्टि करें',
    burmese: 'အသံ ပြန်လည်ရယူခြင်းကို အတည်ပြုပါ',
    thai: 'ยืนยันการกู้คืนเสียง',
    mandarin: '确认音频恢复'
  },
  confirmAudioRestoreMessage: {
    english: 'This will restore your audio files from the backup. Continue?',
    spanish:
      'Esto restaurará sus archivos de audio desde la copia de seguridad. ¿Continuar?',
    brazilian_portuguese:
      'Isso restaurará seus arquivos de áudio do backup. Continuar?',
    tok_pisin: 'This i restore audio file bilong backup. Continue?',
    indonesian: 'Ini akan memulihkan file audio Anda dari cadangan. Lanjutkan?',
    nepali:
      'यसले तपाईंको अडियो फाइलहरू ब्याकअपबाट पुनर्स्थापित गर्नेछ। जारी राख्ने?',
    hindi: 'यह आपकी ऑडियो फ़ाइलों को बैकअप से पुनर्स्थापित करेगा। जारी रखें?',
    burmese:
      '၎င်းသည် သင်၏ အသံဖိုင်များကို အရန်သိမ်းဆည်းမှုမှ ပြန်လည်ရယူမည်။ ဆက်လုပ်မည်လား?',
    thai: 'นี่จะกู้คืนไฟล์เสียงของคุณจากสำรองข้อมูล ดำเนินการต่อหรือไม่?',
    mandarin: '这将从备份中恢复您的音频文件。继续吗？'
  },
  restoreAudioOnly: {
    english: 'Restore Audio',
    spanish: 'Restaurar Audio',
    brazilian_portuguese: 'Restaurar Áudio',
    tok_pisin: 'Restore Audio',
    indonesian: 'Pemulihan Audio',
    nepali: 'अडियो पुनर्स्थापना गर्नुहोस्',
    hindi: 'ऑडियो पुनर्स्थापित करें',
    burmese: 'အသံ ပြန်လည်ရယူပါ',
    thai: 'กู้คืนเสียง',
    mandarin: '恢复音频'
  },
  failedRestore: {
    english: 'Failed to restore: {error}',
    spanish: 'Error al restaurar: {error}',
    brazilian_portuguese: 'Falha ao restaurar: {error}',
    tok_pisin: 'I no inap restore: {error}',
    indonesian: 'Gagal memulihkan: {error}',
    nepali: 'पुनर्स्थापना गर्न असफल: {error}',
    hindi: 'पुनर्स्थापना करने में विफल: {error}',
    burmese: 'ပြန်လည်ရယူရန် မအောင်မြင်ပါ: {error}',
    thai: 'กู้คืนไม่สำเร็จ: {error}',
    mandarin: '恢复失败: {error}'
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
      'Pemulihan selesai: {audioCopied} file audio disalin, {audioSkippedDueToError} dilewatkan karena kesalahan',
    nepali:
      'पुनर्स्थापना पूरा भयो: {audioCopied} अडियो फाइलहरू कपी गरियो, {audioSkippedDueToError} त्रुटिहरूका कारण छोडियो',
    hindi:
      'पुनर्स्थापना पूर्ण: {audioCopied} ऑडियो फ़ाइलें कॉपी की गईं, {audioSkippedDueToError} त्रुटियों के कारण छोड़ दी गईं',
    burmese:
      'ပြန်လည်ရယူခြင်း ပြီးစီးပါပြီ: {audioCopied} အသံဖိုင်များ ကူးယူပြီးပါပြီ၊ {audioSkippedDueToError} ကို အမှားများကြောင့် ကျော်သွားပါသည်',
    thai: 'กู้คืนเสร็จสิ้น: คัดลอกไฟล์เสียง {audioCopied} ไฟล์ ข้าม {audioSkippedDueToError} ไฟล์เนื่องจากข้อผิดพลาด',
    mandarin:
      '恢复完成: 已复制 {audioCopied} 个音频文件，由于错误跳过了 {audioSkippedDueToError} 个'
  },
  restoreSkippedLocallyPart: {
    english: ', {audioSkippedLocally} skipped (already exists)',
    spanish: ', {audioSkippedLocally} omitidos (ya existen)',
    brazilian_portuguese: ', {audioSkippedLocally} ignorados (já existem)',
    tok_pisin: ', {audioSkippedLocally} i skip long local.',
    indonesian: ', {audioSkippedLocally} dilewatkan (sudah ada)',
    nepali: ', {audioSkippedLocally} छोडियो (पहिले नै अवस्थित छ)',
    hindi: ', {audioSkippedLocally} छोड़ दिया गया (पहले से मौजूद है)',
    burmese:
      ', {audioSkippedLocally} ကို ကျော်သွားပါသည် (အရင်ကတည်းက ရှိနေပါသည်)',
    thai: ', ข้าม {audioSkippedLocally} ไฟล์ (มีอยู่แล้ว)',
    mandarin: '，跳过了 {audioSkippedLocally} 个（已存在）'
  },
  restoreCompleteTitle: {
    english: 'Restore Complete',
    spanish: 'Restauración Completa',
    brazilian_portuguese: 'Restauração Concluída',
    tok_pisin: 'Restore Complete',
    indonesian: 'Pemulihan Selesai',
    nepali: 'पुनर्स्थापना पूरा भयो',
    hindi: 'पुनर्स्थापना पूर्ण',
    burmese: 'ပြန်လည်ရယူခြင်း ပြီးစီးပါပြီ',
    thai: 'กู้คืนเสร็จสิ้น',
    mandarin: '恢复完成'
  },
  restoreFailedTitle: {
    english: 'Restore Failed: {error}',
    spanish: 'Restauración Fallida: {error}',
    brazilian_portuguese: 'Restauração Falhou: {error}',
    tok_pisin: 'Restore i no: {error}',
    indonesian: 'Pemulihan Gagal: {error}',
    nepali: 'पुनर्स्थापना असफल: {error}',
    hindi: 'पुनर्स्थापना विफल: {error}',
    burmese: 'ပြန်လည်ရယူရန် မအောင်မြင်ပါ: {error}',
    thai: 'กู้คืนไม่สำเร็จ: {error}',
    mandarin: '恢复失败: {error}'
  },
  projectInvitationTitle: {
    english: 'Project Invitation',
    spanish: 'Invitación al Proyecto',
    brazilian_portuguese: 'Convite para o Projeto',
    tok_pisin: 'Project Invitation',
    indonesian: 'Undangan Proyek',
    nepali: 'प्रोजेक्ट आमन्त्रण',
    hindi: 'परियोजना आमंत्रण',
    burmese: 'စီမံကိန်း ဖိတ်ခေါ်စာ',
    thai: 'คำเชิญโครงการ',
    mandarin: '项目邀请'
  },
  joinRequestTitle: {
    english: 'Join Request',
    spanish: 'Solicitud de Unión',
    brazilian_portuguese: 'Solicitação de Adesão',
    tok_pisin: 'Join Request',
    indonesian: 'Permintaan Bergabung',
    nepali: 'सामेल हुने अनुरोध',
    hindi: 'शामिल होने का अनुरोध',
    burmese: 'ပါဝင်ရန် တောင်းဆိုမှု',
    thai: 'คำขอเข้าร่วม',
    mandarin: '加入请求'
  },
  invitedYouToJoin: {
    english: '{sender} invited you to join "{project}" as {role}',
    spanish: '{sender} te invitó a unirte a "{project}" como {role}',
    brazilian_portuguese:
      '{sender} convidou você para participar de "{project}" como {role}',
    tok_pisin:
      '{sender} i salim yu long joinim project "{project}" long {role}',
    indonesian:
      '{sender} mengundang Anda untuk bergabung dengan proyek "{project}" sebagai {role}',
    nepali:
      '{sender} ले तपाईंलाई "{project}" मा {role} को रूपमा सामेल हुन आमन्त्रित गर्नुभयो',
    hindi:
      '{sender} ने आपको "{project}" में {role} के रूप में शामिल होने के लिए आमंत्रित किया है',
    burmese:
      '{sender} သည် သင့်အား "{project}" စီမံကိန်းတွင် {role} အဖြစ် ပါဝင်ရန် ဖိတ်ခေါ်ပါသည်',
    thai: '{sender} ได้เชิญคุณเข้าร่วม "{project}" ในฐานะ {role}',
    mandarin: '{sender} 已邀请您以 {role} 身份加入 "{project}"'
  },
  requestedToJoin: {
    english: '{sender} requested to join "{project}" as {role}',
    spanish: '{sender} solicitó unirse a "{project}" como {role}',
    brazilian_portuguese:
      '{sender} solicitou participar de "{project}" como {role}',
    tok_pisin:
      '{sender} i requestim long joinim project "{project}" long {role}',
    indonesian:
      '{sender} meminta untuk bergabung dengan proyek "{project}" sebagai {role}',
    nepali:
      '{sender} ले "{project}" मा {role} को रूपमा सामेल हुन अनुरोध गर्नुभयो',
    hindi:
      '{sender} ने "{project}" में {role} के रूप में शामिल होने का अनुरोध किया है',
    burmese:
      '{sender} သည် "{project}" စီမံကိန်းတွင် {role} အဖြစ် ပါဝင်ရန် တောင်းဆိုပါသည်',
    thai: '{sender} ได้ขอเข้าร่วม "{project}" ในฐานะ {role}',
    mandarin: '{sender} 已请求以 {role} 身份加入 "{project}"'
  },
  downloadProjectLabel: {
    english: 'Download Project',
    spanish: 'Descargar Proyecto',
    brazilian_portuguese: 'Baixar Projeto',
    tok_pisin: 'Download Project',
    indonesian: 'Unduh Proyek',
    nepali: 'प्रोजेक्ट डाउनलोड गर्नुहोस्',
    hindi: 'परियोजना डाउनलोड करें',
    burmese: 'စီမံကိန်း ဒေါင်းလုဒ်လုပ်ပါ',
    thai: 'ดาวน์โหลดโครงการ',
    mandarin: '下载项目'
  },
  projectNotAvailableOfflineWarning: {
    english: 'Project will not be available offline without download',
    spanish: 'El proyecto no estará disponible sin conexión sin descarga',
    brazilian_portuguese: 'O projeto não estará disponíel offline sem download',
    tok_pisin: 'Project i no pinis long download',
    indonesian: 'Proyek tidak akan tersedia secara offline tanpa unduhan',
    nepali: 'डाउनलोड बिना प्रोजेक्ट अफलाइन उपलब्ध हुने छैन',
    hindi: 'डाउनलोड के बिना परियोजना ऑफलाइन उपलब्ध नहीं होगी',
    burmese:
      'ဒေါင်းလုဒ်လုပ်ခြင်းမရှိဘဲ စီမံကိန်းသည် အော့ဖ်လိုင်းတွင် ရရှိနိုင်မည် မဟုတ်ပါ',
    thai: 'โครงการจะไม่พร้อมใช้งานแบบออฟไลน์หากไม่ดาวน์โหลด',
    mandarin: '不下载项目将无法离线使用'
  },
  noNotificationsTitle: {
    english: 'No Notifications',
    spanish: 'Sin Notificaciones',
    brazilian_portuguese: 'Sem Notificações',
    tok_pisin: 'No Notification',
    indonesian: 'Tidak Ada Notifikasi',
    nepali: 'कुनै सूचना छैन',
    hindi: 'कोई सूचनाएं नहीं',
    burmese: 'အကြောင်းကြားချက် မရှိပါ',
    thai: 'ไม่มีการแจ้งเตือน',
    mandarin: '无通知'
  },
  noNotificationsMessage: {
    english: "You'll see project invitations and join requests here",
    spanish: 'Aquí verás invitaciones a proyectos y solicitudes de unión',
    brazilian_portuguese:
      'Aqui você verá convites para projetos e solicitações de participação',
    tok_pisin:
      'Yu ken salim invitation long project na yu ken salim joinim request long project.',
    indonesian:
      'Anda akan melihat undangan ke proyek dan permintaan bergabung di sini',
    nepali:
      'तपाईंले यहाँ प्रोजेक्ट आमन्त्रणहरू र सामेल हुने अनुरोधहरू देख्नुहुनेछ',
    hindi: 'आप यहां परियोजना आमंत्रण और शामिल होने के अनुरोध देखेंगे',
    burmese:
      'သင်သည် ဤနေရာတွင် စီမံကိန်း ဖိတ်ခေါ်စာများ နှင့် ပါဝင်ရန် တောင်းဆိုမှုများကို မြင်ရမည်',
    thai: 'คุณจะเห็นคำเชิญโครงการและคำขอเข้าร่วมที่นี่',
    mandarin: '您将在此处看到项目邀请和加入请求'
  },
  invitationAcceptedSuccessfully: {
    english: 'Invitation accepted successfully',
    spanish: 'Invitación aceptada exitosamente',
    brazilian_portuguese: 'Convite aceito com sucesso',
    tok_pisin: 'Invitation i accept gut',
    indonesian: 'Undangan diterima dengan sukses',
    nepali: 'आमन्त्रण सफलतापूर्वक स्वीकार गरियो',
    hindi: 'आमंत्रण सफलतापूर्वक स्वीकार कर लिया गया',
    burmese: 'ဖိတ်ခေါ်စာ အောင်မြင်စွာ လက်ခံပါပြီ',
    thai: 'ยอมรับคำเชิญสำเร็จ',
    mandarin: '邀请已成功接受'
  },
  invitationDeclinedSuccessfully: {
    english: 'Invitation declined',
    spanish: 'Invitación rechazada',
    brazilian_portuguese: 'Convite recusado',
    tok_pisin: 'Invitation i no',
    indonesian: 'Undangan ditolak',
    nepali: 'आमन्त्रण अस्वीकृत',
    hindi: 'आमंत्रण अस्वीकार कर दिया गया',
    burmese: 'ဖိတ်ခေါ်စာ ငြင်းဆိုပါသည်',
    thai: 'ปฏิเสธคำเชิญ',
    mandarin: '邀请已拒绝'
  },
  mustBeOnlineToAcceptInvite: {
    english: 'You must be online to accept an invitation',
    spanish: 'Debes estar en línea para aceptar una invitación',
    brazilian_portuguese: 'Você precisa estar online para aceitar um convite',
    tok_pisin: 'Yu mas stap long internet bilong accept invitation',
    indonesian: 'Anda harus online untuk menerima undangan',
    nepali: 'आमन्त्रण स्वीकार गर्न तपाईं अनलाइनमा हुनुपर्छ'
  },
  failedToAcceptInvite: {
    english: 'Failed to accept invitation',
    spanish: 'Error al aceptar invitación',
    brazilian_portuguese: 'Falha ao aceitar convite',
    tok_pisin: 'I no inap accept invitation',
    indonesian: 'Gagal menerima undangan',
    nepali: 'आमन्त्रण स्वीकार गर्न असफल',
    hindi: 'आमंत्रण स्वीकार करने में विफल',
    burmese: 'ဖိတ်ခေါ်စာကို လက်ခံရန် မအောင်မြင်ပါ',
    thai: 'ยอมรับคำเชิญไม่สำเร็จ',
    mandarin: '接受邀请失败'
  },
  failedToDeclineInvite: {
    english: 'Failed to decline invitation',
    spanish: 'Error al rechazar invitación',
    brazilian_portuguese: 'Falha ao recusar convite',
    tok_pisin: 'I no inap decline invitation',
    indonesian: 'Gagal menolak undangan',
    nepali: 'आमन्त्रण अस्वीकार गर्न असफल',
    hindi: 'आमंत्रण अस्वीकार करने में विफल',
    burmese: 'ဖိတ်ခေါ်စာကို ငြင်းဆိုရန် မအောင်မြင်ပါ',
    thai: 'ปฏิเสธคำเชิญไม่สำเร็จ',
    mandarin: '拒绝邀请失败'
  },
  invitationAcceptedDownloadFailed: {
    english: 'Invitation accepted but download failed',
    spanish: 'Invitación aceptada pero la descarga falló',
    brazilian_portuguese: 'Convite aceito mas o download falhou',
    tok_pisin: 'Invitation i accept but i no inap download',
    indonesian: 'Undangan diterima tapi unduhan gagal',
    nepali: 'आमन्त्रण स्वीकार गरियो तर डाउनलोड असफल भयो',
    hindi: 'आमंत्रण स्वीकार कर लिया गया लेकिन डाउनलोड विफल रहा',
    burmese: 'ဖိတ်ခေါ်စာ လက်ခံပါပြီ သို့သော် ဒေါင်းလုဒ်လုပ်ရန် မအောင်မြင်ပါ',
    thai: 'ยอมรับคำเชิญแล้ว แต่การดาวน์โหลดล้มเหลว',
    mandarin: '邀请已接受，但下载失败'
  },
  unknownProject: {
    english: 'Unknown Project',
    spanish: 'Proyecto Desconocido',
    brazilian_portuguese: 'Projeto Desconhecido',
    tok_pisin: 'Unknown Project',
    indonesian: 'Proyek Tidak Dikenal',
    nepali: 'अज्ञात प्रोजेक्ट',
    hindi: 'अज्ञात परियोजना',
    burmese: 'မသိသော စီမံကိန်း',
    thai: 'โครงการที่ไม่รู้จัก',
    mandarin: '未知项目'
  },
  ownerRole: {
    english: 'owner',
    spanish: 'propietario',
    brazilian_portuguese: 'proprietário',
    tok_pisin: 'owner',
    indonesian: 'pemilik',
    nepali: 'मालिक',
    hindi: 'मालिक',
    burmese: 'ပိုင်ရှင်',
    thai: 'เจ้าของ',
    mandarin: '所有者'
  },
  memberRole: {
    english: 'member',
    spanish: 'miembro',
    brazilian_portuguese: 'membro',
    tok_pisin: 'member',
    indonesian: 'anggota',
    nepali: 'सदस्य',
    hindi: 'सदस्य',
    burmese: 'အဖွဲ့ဝင်',
    thai: 'สมาชิก',
    mandarin: '成员'
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
      'Anda sedang offline. Perubahan apa pun yang Anda buat akan disinkronkan ketika Anda kembali online.',
    nepali:
      'तपाईं अफलाइन हुनुहुन्छ। तपाईंले गर्नुभएका कुनै पनि परिवर्तनहरू तपाईं अनलाइन फर्किँदा सिङ्क हुनेछन्।',
    hindi:
      'आप ऑफलाइन हैं। आपके द्वारा किए गए कोई भी परिवर्तन तब सिंक होंगे जब आप वापस ऑनलाइन होंगे।',
    burmese:
      'သင်သည် အော့ဖ်လိုင်း ဖြစ်နေသည်။ သင်ပြုလုပ်သော မည်သည့် ပြောင်းလဲမှုများကိုမဆို သင်ပြန်လည် အွန်လိုင်းဖြစ်သောအခါ အင်ချုန်းလုပ်ပါမည်။',
    thai: 'คุณออฟไลน์อยู่ การเปลี่ยนแปลงใดๆ ที่คุณทำจะซิงค์เมื่อคุณกลับมาออนไลน์',
    mandarin: '您处于离线状态。您所做的任何更改将在您重新上线时同步。'
  },
  filesDownloaded: {
    english: 'files downloaded',
    spanish: 'archivos descargados',
    brazilian_portuguese: 'arquivos baixados',
    tok_pisin: 'ol fail i download pinis',
    indonesian: 'file diunduh',
    nepali: 'फाइलहरू डाउनलोड भयो',
    hindi: 'फ़ाइलें डाउनलोड की गईं',
    burmese: 'ဖိုင်များ ဒေါင်းလုဒ်လုပ်ပြီးပါပြီ',
    thai: 'ดาวน์โหลดไฟล์แล้ว',
    mandarin: '文件已下载'
  },
  downloading: {
    english: 'downloading',
    spanish: 'descargando',
    brazilian_portuguese: 'baixando',
    tok_pisin: 'i download nau',
    indonesian: 'mengunduh',
    nepali: 'डाउनलोड गर्दै',
    hindi: 'डाउनलोड हो रहा है',
    burmese: 'ဒေါင်းလုဒ်လုပ်နေသည်',
    thai: 'กำลังดาวน์โหลด',
    mandarin: '正在下载'
  },
  uploading: {
    english: 'uploading',
    spanish: 'subiendo',
    brazilian_portuguese: 'enviando',
    tok_pisin: 'i upload nau',
    indonesian: 'mengunggah',
    nepali: 'अपलोड गर्दै',
    hindi: 'अपलोड हो रहा है',
    burmese: 'အပ်လုဒ်လုပ်နေသည်',
    thai: 'กำลังอัปโหลด',
    mandarin: '正在上传'
  },
  files: {
    english: 'files',
    spanish: 'archivos',
    brazilian_portuguese: 'arquivos',
    tok_pisin: 'ol fail',
    indonesian: 'file',
    nepali: 'फाइलहरू',
    hindi: 'फ़ाइलें',
    burmese: 'ဖိုင်များ',
    thai: 'ไฟล์',
    mandarin: '文件'
  },
  syncingDatabase: {
    english: 'syncing database',
    spanish: 'sincronizando base de datos',
    brazilian_portuguese: 'sincronizando banco de dados',
    tok_pisin: 'i sync database nau',
    indonesian: 'mengosinkronkan basis data',
    nepali: 'डाटाबेस सिङ्क गर्दै',
    hindi: 'डेटाबेस सिंक हो रहा है',
    burmese: 'ဒေတာဘေ့စ် အင်ချုန်းလုပ်နေသည်',
    thai: 'กำลังซิงค์ฐานข้อมูล',
    mandarin: '正在同步数据库'
  },
  lastSync: {
    english: 'last sync',
    spanish: 'última sincronización',
    brazilian_portuguese: 'última sincronização',
    tok_pisin: 'las sync',
    indonesian: 'sinkron terakhir',
    nepali: 'अन्तिम सिङ्क',
    hindi: 'अंतिम सिंक',
    burmese: 'နောက်ဆုံး အင်ချုန်းလုပ်ခြင်း',
    thai: 'ซิงค์ล่าสุด',
    mandarin: '上次同步'
  },
  never: {
    english: 'Never',
    spanish: 'Nunca',
    brazilian_portuguese: 'Nunca',
    tok_pisin: 'Nogat',
    indonesian: 'Tidak pernah',
    nepali: 'कहिल्यै होइन',
    hindi: 'कभी नहीं',
    burmese: 'မည်သည့်အခါမျှ',
    thai: 'ไม่เคย',
    mandarin: '从不'
  },
  unknown: {
    english: 'unknown',
    spanish: 'desconocido',
    brazilian_portuguese: 'desconhecido',
    tok_pisin: 'mi no save',
    indonesian: 'tidak dikenal',
    nepali: 'अज्ञात',
    hindi: 'अज्ञात',
    burmese: 'မသိသော',
    thai: 'ไม่ทราบ',
    mandarin: '未知'
  },
  notSynced: {
    english: 'not synced',
    spanish: 'no sincronizado',
    brazilian_portuguese: 'não sincronizado',
    tok_pisin: 'i no sync yet',
    indonesian: 'tidak disinkronkan',
    nepali: 'सिङ्क भएको छैन',
    hindi: 'सिंक नहीं हुआ',
    burmese: 'အင်ချုန်းလုပ်မထားသေးပါ',
    thai: 'ยังไม่ได้ซิงค์',
    mandarin: '未同步'
  },
  connecting: {
    english: 'connecting',
    spanish: 'conectando',
    brazilian_portuguese: 'conectando',
    tok_pisin: 'i try long connect',
    indonesian: 'menghubungkan',
    nepali: 'जडान गर्दै',
    hindi: 'कनेक्ट हो रहा है',
    burmese: 'ချိတ်ဆက်နေသည်',
    thai: 'กำลังเชื่อมต่อ',
    mandarin: '正在连接'
  },
  disconnected: {
    english: 'disconnected',
    spanish: 'desconectado',
    brazilian_portuguese: 'desconectado',
    tok_pisin: 'i no connect',
    indonesian: 'terputus',
    nepali: 'विच्छेद भयो',
    hindi: 'डिस्कनेक्ट हो गया',
    burmese: 'ချိတ်ဆက်မှု ပြတ်တောက်ပါပြီ',
    thai: 'ตัดการเชื่อมต่อ',
    mandarin: '已断开连接'
  },
  syncingAttachments: {
    english: 'syncing attachments',
    spanish: 'sincronizando archivos adjuntos',
    brazilian_portuguese: 'sincronizando anexos',
    tok_pisin: 'i sync ol attachment',
    indonesian: 'mengosinkronkan lampiran',
    nepali: 'संलग्नकहरू सिङ्क गर्दै',
    hindi: 'संलग्नक सिंक हो रहे हैं',
    burmese: 'ပူးတွဲဖိုင်များ အင်ချုန်းလုပ်နေသည်',
    thai: 'กำลังซิงค์ไฟล์แนบ',
    mandarin: '正在同步附件'
  },
  attachmentSync: {
    english: 'attachment sync',
    spanish: 'sincronización de archivos adjuntos',
    brazilian_portuguese: 'sincronização de anexos',
    tok_pisin: 'attachment sync',
    indonesian: 'sinkron lampiran',
    nepali: 'संलग्नक सिङ्क',
    hindi: 'संलग्नक सिंक',
    burmese: 'ပူးတွဲဖိုင်များ အင်ချုန်းလုပ်ခြင်း',
    thai: 'การซิงค์ไฟล์แนบ',
    mandarin: '附件同步'
  },
  databaseSyncError: {
    english: 'database sync error',
    spanish: 'error de sincronización de base de datos',
    brazilian_portuguese: 'erro de sincronização de banco de dados',
    tok_pisin: 'database sync i gat problem',
    indonesian: 'kesalahan sinkron basis data',
    nepali: 'डाटाबेस सिङ्क त्रुटि',
    hindi: 'डेटाबेस सिंक त्रुटि',
    burmese: 'ဒေတာဘေ့စ် အင်ချုန်းလုပ်ခြင်း အမှား',
    thai: 'ข้อผิดพลาดในการซิงค์ฐานข้อมูล',
    mandarin: '数据库同步错误'
  },
  attachmentSyncError: {
    english: 'attachment sync error',
    spanish: 'error de sincronización de archivos adjuntos',
    brazilian_portuguese: 'erro de sincronização de anexos',
    tok_pisin: 'attachment sync i gat problem',
    indonesian: 'kesalahan sinkron lampiran',
    nepali: 'संलग्नक सिङ्क त्रुटि',
    hindi: 'संलग्नक सिंक त्रुटि',
    burmese: 'ပူးတွဲဖိုင်များ အင်ချုန်းလုပ်ခြင်း အမှား',
    thai: 'ข้อผิดพลาดในการซิงค์ไฟล์แนบ',
    mandarin: '附件同步错误'
  },
  uploadingData: {
    english: 'uploading data',
    spanish: 'subiendo datos',
    brazilian_portuguese: 'enviando dados',
    tok_pisin: 'i upload data',
    indonesian: 'mengunggah data',
    nepali: 'डाटा अपलोड गर्दै',
    hindi: 'डेटा अपलोड हो रहा है',
    burmese: 'ဒေတာ အပ်လုဒ်လုပ်နေသည်',
    thai: 'กำลังอัปโหลดข้อมูล',
    mandarin: '正在上传数据'
  },
  downloadingData: {
    english: 'downloading data',
    spanish: 'descargando datos',
    brazilian_portuguese: 'baixando dados',
    tok_pisin: 'i download data',
    indonesian: 'mengunduh data',
    nepali: 'डाटा डाउनलोड गर्दै',
    hindi: 'डेटा डाउनलोड हो रहा है',
    burmese: 'ဒေတာ ဒေါင်းလုဒ်လုပ်နေသည်',
    thai: 'กำลังดาวน์โหลดข้อมูล',
    mandarin: '正在下载数据'
  },
  syncError: {
    english: 'sync error',
    spanish: 'error de sincronización',
    brazilian_portuguese: 'erro de sincronização',
    tok_pisin: 'sync i gat problem',
    indonesian: 'kesalahan sinkron',
    nepali: 'सिङ्क त्रुटि',
    hindi: 'सिंक त्रुटि',
    burmese: 'အင်ချုန်းလုပ်ခြင်း အမှား',
    thai: 'ข้อผิดพลาดในการซิงค์',
    mandarin: '同步错误'
  },
  tapForDetails: {
    english: 'tap for details',
    spanish: 'toca para ver detalles',
    brazilian_portuguese: 'toque para detalhes',
    tok_pisin: 'presim long lukim moa',
    indonesian: 'ketuk untuk detail',
    nepali: 'विवरणको लागि ट्याप गर्नुहोस्',
    hindi: 'विवरण के लिए टैप करें',
    burmese: 'အသေးစိတ်များအတွက် ထိပါ',
    thai: 'แตะเพื่อดูรายละเอียด',
    mandarin: '点击查看详情'
  },
  downloadComplete: {
    english: 'download complete',
    spanish: 'descarga completa',
    brazilian_portuguese: 'download completo',
    tok_pisin: 'download i pinis',
    indonesian: 'unduhan selesai',
    nepali: 'डाउनलोड पूरा भयो',
    hindi: 'डाउनलोड पूर्ण',
    burmese: 'ဒေါင်းလုဒ်လုပ်ခြင်း ပြီးစီးပါပြီ',
    thai: 'ดาวน์โหลดเสร็จสิ้น',
    mandarin: '下载完成'
  },
  queued: {
    english: 'queued',
    spanish: 'en cola',
    brazilian_portuguese: 'em fila',
    tok_pisin: 'i wet long lain',
    indonesian: 'dalam antrian',
    nepali: 'पङ्क्तिमा छ',
    hindi: 'कतार में',
    burmese: 'တန်းစီထားသည်',
    thai: 'อยู่ในคิว',
    mandarin: '已排队'
  },
  queuedForDownload: {
    english: 'queued for download',
    spanish: 'en cola para descargar',
    brazilian_portuguese: 'em fila para baixar',
    tok_pisin: 'i wet long lain long download',
    indonesian: 'dalam antrian untuk unduhan',
    nepali: 'डाउनलोडको लागि पङ्क्तिमा',
    hindi: 'डाउनलोड के लिए कतार में',
    burmese: 'ဒေါင်းလုဒ်လုပ်ရန် တန်းစီထားသည်',
    thai: 'อยู่ในคิวสำหรับการดาวน์โหลด',
    mandarin: '已排队等待下载'
  },
  complete: {
    english: 'complete',
    spanish: 'completo',
    brazilian_portuguese: 'completo',
    tok_pisin: 'pinis',
    indonesian: 'selesai',
    nepali: 'पूरा भयो',
    hindi: 'पूर्ण',
    burmese: 'ပြီးစီးပါပြီ',
    thai: 'เสร็จสมบูรณ์',
    mandarin: '完成'
  },
  loadMore: {
    english: 'load more',
    spanish: 'cargar más',
    brazilian_portuguese: 'carregar mais',
    tok_pisin: 'bringim moa',
    indonesian: 'muat lebih banyak',
    nepali: 'थप लोड गर्नुहोस्',
    hindi: 'और लोड करें',
    burmese: 'ပိုမိုဖွင့်ပါ',
    thai: 'โหลดเพิ่มเติม',
    mandarin: '加载更多'
  },
  loading: {
    english: 'loading',
    spanish: 'cargando',
    brazilian_portuguese: 'carregando',
    tok_pisin: 'loadim',
    indonesian: 'memuat',
    nepali: 'लोड गर्दै',
    hindi: 'लोड हो रहा है',
    burmese: 'ဖွင့်နေသည်',
    thai: 'กำลังโหลด',
    mandarin: '加载中'
  },
  assetMadeInvisibleAllQuests: {
    english: 'The asset has been made invisible for all quests',
    spanish: 'El asset ha sido hecho invisible para todas las quests',
    brazilian_portuguese: 'O asset foi feito invisível para todas as quests',
    tok_pisin: 'Asset i make invisible long all quest',
    indonesian: 'Asset dibuat tidak terlihat untuk semua quest',
    nepali: 'एसेट सबै क्वेस्टहरूको लागि अदृश्य बनाइएको छ',
    hindi: 'एसेट सभी क्वेस्ट के लिए अदृश्य बना दिया गया है',
    burmese: 'အရာဝတ္ထုကို စွမ်းဆောင်ရည်အားလုံးအတွက် မမြင်ရအောင် ပြုလုပ်ထားသည်',
    thai: 'ทรัพย์สินถูกทำให้มองไม่เห็นสำหรับเควสต์ทั้งหมด',
    mandarin: '该资产已对所有任务设为不可见'
  },
  assetMadeVisibleAllQuests: {
    english: 'The asset has been made visible for all quests',
    spanish: 'El asset ha sido hecho visible para todas las quests',
    brazilian_portuguese: 'O asset foi feito visível para todas as quests',
    tok_pisin: 'Asset i make visible long all quest',
    indonesian: 'Asset dibuat terlihat untuk semua quest',
    nepali: 'एसेट सबै क्वेस्टहरूको लागि दृश्य बनाइएको छ',
    hindi: 'एसेट सभी क्वेस्ट के लिए दृश्यमान बना दिया गया है',
    burmese:
      'အရာဝတ္ထုကို စွမ်းဆောင်ရည်အားလုံးအတွက် မြင်နိုင်အောင် ပြုလုပ်ထားသည်',
    thai: 'ทรัพย์สินถูกทำให้มองเห็นได้สำหรับเควสต์ทั้งหมด',
    mandarin: '该资产已对所有任务设为可见'
  },
  assetMadeInactiveAllQuests: {
    english: 'The asset has been made inactive for all quests',
    spanish: 'El asset ha sido hecho inactivo para todas las quests',
    brazilian_portuguese: 'O asset foi feito inativo para todas as quests',
    tok_pisin: 'Asset i make inactive long all quest',
    indonesian: 'Asset dibuat tidak aktif untuk semua quest',
    nepali: 'एसेट सबै क्वेस्टहरूको लागि निष्क्रिय बनाइएको छ',
    hindi: 'एसेट सभी क्वेस्ट के लिए निष्क्रिय बना दिया गया है',
    burmese:
      'အရာဝတ္ထုကို စွမ်းဆောင်ရည်အားလုံးအတွက် မလှုပ်ရှားအောင် ပြုလုပ်ထားသည်',
    thai: 'ทรัพย์สินถูกทำให้ไม่ใช้งานสำหรับเควสต์ทั้งหมด',
    mandarin: '该资产已对所有任务设为非活动'
  },
  assetMadeActiveAllQuests: {
    english: 'The asset has been made active for all quests',
    spanish: 'El asset ha sido hecho activo para todas las quests',
    brazilian_portuguese: 'O asset foi feito ativo para todas as quests',
    tok_pisin: 'Asset i make active long all quest',
    indonesian: 'Asset dibuat aktif untuk semua quest',
    nepali: 'एसेट सबै क्वेस्टहरूको लागि सक्रिय बनाइएको छ',
    hindi: 'एसेट सभी क्वेस्ट के लिए सक्रिय बना दिया गया है',
    burmese:
      'အရာဝတ္ထုကို စွမ်းဆောင်ရည်အားလုံးအတွက် လှုပ်ရှားအောင် ပြုလုပ်ထားသည်',
    thai: 'ทรัพย์สินถูกทำให้ใช้งานได้สำหรับเควสต์ทั้งหมด',
    mandarin: '该资产已对所有任务设为活动'
  },
  failedToUpdateAssetSettings: {
    english: 'Failed to update asset settings',
    spanish: 'Error al actualizar los ajustes del asset',
    brazilian_portuguese: 'Falha ao atualizar os ajustes do asset',
    tok_pisin: 'I no inap update asset settings',
    indonesian: 'Gagal mengupdate pengaturan asset',
    nepali: 'एसेट सेटिङहरू अपडेट गर्न असफल',
    hindi: 'एसेट सेटिंग अपडेट करने में विफल',
    burmese: 'အရာဝတ္ထု ဆက်တင်များကို အပ်ဒိတ်လုပ်ရန် မအောင်မြင်ပါ',
    thai: 'ไม่สามารถอัปเดตการตั้งค่าทรัพย์สินได้',
    mandarin: '更新资产设置失败'
  },
  assetMadeInvisibleQuest: {
    english: 'The asset has been made invisible for this quest',
    spanish: 'El asset ha sido hecho invisible para esta quest',
    brazilian_portuguese: 'O asset foi feito invisível para esta quest',
    tok_pisin: 'Asset i make invisible long quest',
    indonesian: 'Asset dibuat tidak terlihat untuk quest ini',
    nepali: 'यो क्वेस्टको लागि एसेट अदृश्य बनाइएको छ',
    hindi: 'इस क्वेस्ट के लिए एसेट अदृश्य बना दिया गया है',
    burmese: 'ဤစွမ်းဆောင်ရည်အတွက် အရာဝတ္ထုကို မမြင်ရအောင် ပြုလုပ်ထားသည်',
    thai: 'ทรัพย์สินถูกทำให้มองไม่เห็นสำหรับเควสต์นี้',
    mandarin: '该资产已对此任务设为不可见'
  },
  assetMadeVisibleQuest: {
    english: 'The asset has been made visible for this quest',
    spanish: 'El asset ha sido hecho visible para esta quest',
    brazilian_portuguese: 'O asset foi feito visível para esta quest',
    tok_pisin: 'Asset i make visible long quest',
    indonesian: 'Asset dibuat terlihat untuk quest ini',
    nepali: 'यो क्वेस्टको लागि एसेट दृश्य बनाइएको छ',
    hindi: 'इस क्वेस्ट के लिए एसेट दृश्यमान बना दिया गया है',
    burmese: 'ဤစွမ်းဆောင်ရည်အတွက် အရာဝတ္ထုကို မြင်နိုင်အောင် ပြုလုပ်ထားသည်',
    thai: 'ทรัพย์สินถูกทำให้มองเห็นได้สำหรับเควสต์นี้',
    mandarin: '该资产已对此任务设为可见'
  },
  assetMadeInactiveQuest: {
    english: 'The asset has been made inactive for this quest',
    spanish: 'El asset ha sido hecho inactivo para esta quest',
    brazilian_portuguese: 'O asset foi feito inativo para esta quest',
    tok_pisin: 'Asset i make inactive long quest',
    indonesian: 'Asset dibuat tidak aktif untuk quest ini',
    nepali: 'यो क्वेस्टको लागि एसेट निष्क्रिय बनाइएको छ',
    hindi: 'इस क्वेस्ट के लिए एसेट निष्क्रिय बना दिया गया है',
    burmese: 'ဤစွမ်းဆောင်ရည်အတွက် အရာဝတ္ထုကို မလှုပ်ရှားအောင် ပြုလုပ်ထားသည်',
    thai: 'ทรัพย์สินถูกทำให้ไม่ใช้งานสำหรับเควสต์นี้',
    mandarin: '该资产已对此任务设为非活动'
  },
  assetMadeActiveQuest: {
    english: 'The asset has been made active for this quest',
    spanish: 'El asset ha sido hecho activo para esta quest',
    brazilian_portuguese: 'O asset foi feito ativo para esta quest',
    tok_pisin: 'Asset i make active long quest',
    indonesian: 'Asset dibuat aktif untuk quest ini',
    nepali: 'यो क्वेस्टको लागि एसेट सक्रिय बनाइएको छ',
    hindi: 'इस क्वेस्ट के लिए एसेट सक्रिय बना दिया गया है',
    burmese: 'ဤစွမ်းဆောင်ရည်အတွက် အရာဝတ္ထုကို လှုပ်ရှားအောင် ပြုလုပ်ထားသည်',
    thai: 'ทรัพย์สินถูกทำให้ใช้งานได้สำหรับเควสต์นี้',
    mandarin: '该资产已对此任务设为活动'
  },
  assetSettings: {
    english: 'Asset Settings',
    spanish: 'Ajustes del Asset',
    brazilian_portuguese: 'Ajustes do Asset',
    tok_pisin: 'Asset Settings',
    indonesian: 'Pengaturan Asset',
    nepali: 'एसेट सेटिङहरू',
    hindi: 'एसेट सेटिंग',
    burmese: 'အရာဝတ္ထု ဆက်တင်များ',
    thai: 'การตั้งค่าทรัพย์สิน',
    mandarin: '资产设置'
  },
  assetSettingsLoadError: {
    english: 'Error loading asset settings.',
    spanish: 'Error al cargar la configuración de asset.',
    brazilian_portuguese: 'Erro ao carregar as configurações do asset.',
    tok_pisin: 'I no inap load asset settings',
    indonesian: 'Gagal memuat pengaturan asset.',
    nepali: 'एसेट सेटिङहरू लोड गर्दा त्रुटि।',
    hindi: 'एसेट सेटिंग लोड करने में त्रुटि।',
    burmese: 'အရာဝတ္ထု ဆက်တင်များကို ဖွင့်ရာတွင် အမှားအယွင်း။',
    thai: 'เกิดข้อผิดพลาดในการโหลดการตั้งค่าทรัพย์สิน',
    mandarin: '加载资产设置时出错。'
  },
  general: {
    english: 'General',
    spanish: 'General',
    brazilian_portuguese: 'Geral',
    tok_pisin: 'General',
    indonesian: 'Umum',
    nepali: 'सामान्य',
    hindi: 'सामान्य',
    burmese: 'အထွေထွေ',
    thai: 'ทั่วไป',
    mandarin: '常规'
  },
  currentQuest: {
    english: 'Current Quest',
    spanish: 'Quest Actual',
    brazilian_portuguese: 'Quest Atual',
    tok_pisin: 'Current Quest',
    indonesian: 'Quest Saat Ini',
    nepali: 'हालको क्वेस्ट',
    hindi: 'वर्तमान क्वेस्ट',
    burmese: 'လက်ရှိ စွမ်းဆောင်ရည်',
    thai: 'เควสต์ปัจจุบัน',
    mandarin: '当前任务'
  },
  visibility: {
    english: 'Visibility',
    spanish: 'Visibilidad',
    brazilian_portuguese: 'Visibilidade',
    tok_pisin: 'Visibility',
    indonesian: 'Visibilitas',
    nepali: 'दृश्यता',
    hindi: 'दृश्यता',
    burmese: 'မြင်နိုင်မှု',
    thai: 'การมองเห็น',
    mandarin: '可见性'
  },
  active: {
    english: 'Active',
    spanish: 'Activo',
    brazilian_portuguese: 'Ativo',
    tok_pisin: 'Active',
    indonesian: 'Aktif',
    nepali: 'सक्रिय',
    hindi: 'सक्रिय',
    burmese: 'လှုပ်ရှားနေသည်',
    thai: 'ใช้งาน',
    mandarin: '活动'
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
      'Asset terlihat secara default di semua quest, kecuali disembunyikan secara individual.',
    nepali:
      'एसेट पूर्वनिर्धारित रूपमा सबै क्वेस्टहरूमा देखिन्छ, व्यक्तिगत रूपमा लुकाइएको बाहेक।',
    hindi:
      'एसेट डिफ़ॉल्ट रूप से सभी क्वेस्ट में दृश्यमान है, जब तक कि व्यक्तिगत रूप से छुपाया न जाए।',
    burmese:
      'အရာဝတ္ထုသည် ပုံမှန်အားဖြင့် စွမ်းဆောင်ရည်အားလုံးတွင် မြင်နိုင်သည်၊ တစ်ခုချင်းစီ ဖျောက်ထားမှသာ မဟုတ်ပါက။',
    thai: 'ทรัพย์สินจะมองเห็นได้โดยค่าเริ่มต้นในเควสต์ทั้งหมด เว้นแต่จะซ่อนเป็นรายการ',
    mandarin: '资产默认在所有任务中可见，除非单独隐藏。'
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
      'Asset aktif dan dapat digunakan di semua quest, kecuali dinonaktifkan secara individual.',
    nepali:
      'एसेट सक्रिय छ र सबै क्वेस्टहरूमा प्रयोग गर्न सकिन्छ, व्यक्तिगत रूपमा निष्क्रिय पारिएको बाहेक।',
    hindi:
      'एसेट सक्रिय है और सभी क्वेस्ट में उपयोग किया जा सकता है, जब तक कि व्यक्तिगत रूप से निष्क्रिय न किया जाए।',
    burmese:
      'အရာဝတ္ထုသည် လှုပ်ရှားနေပြီး စွမ်းဆောင်ရည်အားလုံးတွင် အသုံးပြုနိုင်သည်၊ တစ်ခုချင်းစီ ပိတ်ထားမှသာ မဟုတ်ပါက။',
    thai: 'ทรัพย์สินใช้งานได้และสามารถใช้ในเควสต์ทั้งหมดได้ เว้นแต่จะปิดการใช้งานเป็นรายการ',
    mandarin: '资产处于活动状态，可在所有任务中使用，除非单独停用。'
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
      'Asset terlihat secara default di quest ini, kecuali disembunyikan secara individual.',
    nepali:
      'यो क्वेस्टमा एसेट पूर्वनिर्धारित रूपमा देखिन्छ, व्यक्तिगत रूपमा लुकाइएको बाहेक।',
    hindi:
      'इस क्वेस्ट में एसेट डिफ़ॉल्ट रूप से दृश्यमान है, जब तक कि व्यक्तिगत रूप से छुपाया न जाए।',
    burmese:
      'ဤစွမ်းဆောင်ရည်တွင် အရာဝတ္ထုသည် ပုံမှန်အားဖြင့် မြင်နိုင်သည်၊ တစ်ခုချင်းစီ ဖျောက်ထားမှသာ မဟုတ်ပါက။',
    thai: 'ทรัพย์สินจะมองเห็นได้โดยค่าเริ่มต้นในเควสต์นี้ เว้นแต่จะซ่อนเป็นรายการ',
    mandarin: '资产默认在此任务中可见，除非单独隐藏。'
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
      'Asset disembunyikan di semua quest dan tidak dapat dibuat terlihat di salah satunya.',
    nepali: 'एसेट सबै क्वेस्टहरूमा लुकाइएको छ र कुनैमा पनि देखाउन सकिँदैन।',
    hindi:
      'एसेट सभी क्वेस्ट में छुपाया गया है और किसी में भी दृश्यमान नहीं बनाया जा सकता।',
    burmese:
      'အရာဝတ္ထုသည် စွမ်းဆောင်ရည်အားလုံးတွင် ဖျောက်ထားပြီး မည်သည့်တစ်ခုတွင်မှ မြင်နိုင်အောင် မပြုလုပ်နိုင်ပါ။',
    thai: 'ทรัพย์สินถูกซ่อนในเควสต์ทั้งหมดและไม่สามารถทำให้มองเห็นได้ในเควสต์ใดๆ',
    mandarin: '资产在所有任务中隐藏，无法在任何任务中设为可见。'
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
      'Asset dinonaktifkan di semua quest dan tidak dapat digunakan di mana pun.',
    nepali: 'एसेट सबै क्वेस्टहरूमा असक्षम छ र कहीँ पनि प्रयोग गर्न सकिँदैन।',
    hindi: 'एसेट सभी क्वेस्ट में अक्षम है और कहीं भी उपयोग नहीं किया जा सकता।',
    burmese:
      'အရာဝတ္ထုသည် စွမ်းဆောင်ရည်အားလုံးတွင် ပိတ်ထားပြီး မည်သည့်နေရာတွင်မှ အသုံးပြုနိုင်မည်မဟုတ်ပါ။',
    thai: 'ทรัพย์สินถูกปิดการใช้งานในเควสต์ทั้งหมดและไม่สามารถใช้งานได้ทุกที่',
    mandarin: '资产在所有任务中已禁用，无法在任何地方使用。'
  },
  assetGeneralSettingsDescription: {
    english: 'These settings affect how the asset behaves across all quests.',
    spanish:
      'Estos ajustes afectan cómo se comporta el asset en todas las quests.',
    brazilian_portuguese:
      'Essas configurações afetam como o asset se comporta em todas as quests.',
    tok_pisin:
      'Ol dispela setting i senisim how asset i wok long olgeta quest.',
    indonesian:
      'Pengaturan ini mempengaruhi bagaimana asset berperilaku di semua quest.',
    nepali: 'यी सेटिङहरूले सबै क्वेस्टहरूमा एसेटको व्यवहारलाई प्रभाव पार्छन्।',
    hindi: 'ये सेटिंग सभी क्वेस्ट में एसेट के व्यवहार को प्रभावित करती हैं।',
    burmese:
      'ဤဆက်တင်များသည် စွမ်းဆောင်ရည်အားလုံးတွင် အရာဝတ္ထု၏ လုပ်ဆောင်ပုံကို သက်ရောက်မှုရှိသည်။',
    thai: 'การตั้งค่าเหล่านี้ส่งผลต่อพฤติกรรมของทรัพย์สินในเควสต์ทั้งหมด',
    mandarin: '这些设置会影响资产在所有任务中的行为。'
  },
  questSpecificSettingsDescription: {
    english:
      'These settings affect how the asset behaves in this specific quest.',
    spanish:
      'Estos ajustes afectan cómo se comporta el asset en esta quest específica.',
    brazilian_portuguese:
      'Essas configurações afetam como o asset se comporta nesta quest específica.',
    tok_pisin:
      'Ol dispela setting i senisim how asset i wok long dispela quest.',
    indonesian:
      'Pengaturan ini mempengaruhi bagaimana asset berperilaku di quest spesifik ini.',
    nepali:
      'यी सेटिङहरूले यो विशेष क्वेस्टमा एसेटको व्यवहारलाई प्रभाव पार्छन्।',
    hindi:
      'ये सेटिंग इस विशिष्ट क्वेस्ट में एसेट के व्यवहार को प्रभावित करती हैं।',
    burmese:
      'ဤဆက်တင်များသည် ဤအထူးစွမ်းဆောင်ရည်တွင် အရာဝတ္ထု၏ လုပ်ဆောင်ပုံကို သက်ရောက်မှုရှိသည်။',
    thai: 'การตั้งค่าเหล่านี้ส่งผลต่อพฤติกรรมของทรัพย์สินในเควสต์เฉพาะนี้',
    mandarin: '这些设置会影响资产在此特定任务中的行为。'
  },
  assetDisabledWarning: {
    english:
      'This asset is disabled globally. You cannot change its settings for this quest.',
    spanish:
      'Este asset está deshabilitado globalmente. No puedes cambiar sus ajustes para esta quest.',
    brazilian_portuguese:
      'Este asset está desabilitado globalmente. Você não pode alterar suas configurações para esta quest.',
    tok_pisin:
      'Dispela asset i stop olgeta ples. Yu no inap senisim setting bilong em long dispela quest.',
    indonesian:
      'Asset ini dinonaktifkan secara global. Anda tidak dapat mengubah pengaturannya untuk quest ini.',
    nepali:
      'यो एसेट विश्वव्यापी रूपमा असक्षम छ। तपाईं यो क्वेस्टको लागि यसको सेटिङहरू परिवर्तन गर्न सक्नुहुन्न।',
    hindi:
      'यह एसेट वैश्विक रूप से अक्षम है। आप इस क्वेस्ट के लिए इसकी सेटिंग बदल नहीं सकते।',
    burmese:
      'ဤအရာဝတ္ထုသည် ကမ္ဘာတစ်ဝှမ်းတွင် ပိတ်ထားသည်။ ဤစွမ်းဆောင်ရည်အတွက် ၎င်း၏ဆက်တင်များကို သင်ပြောင်းလဲ၍မရပါ။',
    thai: 'ทรัพย์สินนี้ถูกปิดการใช้งานทั่วโลก คุณไม่สามารถเปลี่ยนการตั้งค่าสำหรับเควสต์นี้ได้',
    mandarin: '此资产已在全局禁用。您无法更改此任务的设置。'
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
      'Asset ditampilkan di quest ini. Kecuali disembunyikan secara global.',
    nepali: 'यो क्वेस्टमा एसेट देखाइएको छ। विश्वव्यापी रूपमा लुकाइएको बाहेक।',
    hindi:
      'इस क्वेस्ट में एसेट दिखाया गया है। जब तक कि वैश्विक रूप से छुपाया न गया हो।',
    burmese:
      'ဤစွမ်းဆောင်ရည်တွင် အရာဝတ္ထုကို ပြသထားသည်။ ကမ္ဘာတစ်ဝှမ်းတွင် ဖျောက်ထားမှသာ မဟုတ်ပါက။',
    thai: 'ทรัพย์สินจะแสดงในเควสต์นี้ เว้นแต่จะซ่อนไว้ทั่วโลก',
    mandarin: '资产在此任务中显示。除非在全局隐藏。'
  },
  assetHiddenThisQuest: {
    english: 'The asset is hidden in this quest.',
    spanish: 'El asset está oculto en esta quest.',
    brazilian_portuguese: 'O asset está oculto nesta quest.',
    tok_pisin: 'Asset i hait long dispela quest.',
    indonesian: 'Asset disembunyikan di quest ini.',
    nepali: 'यो क्वेस्टमा एसेट लुकाइएको छ।',
    hindi: 'इस क्वेस्ट में एसेट छुपाया गया है।',
    burmese: 'ဤစွမ်းဆောင်ရည်တွင် အရာဝတ္ထုကို ဖျောက်ထားသည်။',
    thai: 'ทรัพย์สินถูกซ่อนในเควสต์นี้',
    mandarin: '资产在此任务中隐藏。'
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
      'Asset dapat digunakan di quest ini. Kecuali dinonaktifkan secara global.',
    nepali:
      'यो क्वेस्टमा एसेट प्रयोग गर्न सकिन्छ। विश्वव्यापी रूपमा निष्क्रिय पारिएको बाहेक।',
    hindi:
      'इस क्वेस्ट में एसेट का उपयोग किया जा सकता है। जब तक कि वैश्विक रूप से निष्क्रिय न किया गया हो।',
    burmese:
      'ဤစွမ်းဆောင်ရည်တွင် အရာဝတ္ထုကို အသုံးပြုနိုင်သည်။ ကမ္ဘာတစ်ဝှမ်းတွင် ပိတ်ထားမှသာ မဟုတ်ပါက။',
    thai: 'ทรัพย์สินสามารถใช้ในเควสต์นี้ได้ เว้นแต่จะปิดการใช้งานทั่วโลก',
    mandarin: '资产可在此任务中使用。除非在全局停用。'
  },
  assetInactiveThisQuest: {
    english: 'The asset is not available in this quest.',
    spanish: 'El asset no está disponible en esta quest.',
    brazilian_portuguese: 'O asset não está disponível nesta quest.',
    tok_pisin: 'Asset i no stap long dispela quest.',
    indonesian: 'Asset tidak tersedia di quest ini.',
    nepali: 'यो क्वेस्टमा एसेट उपलब्ध छैन।',
    hindi: 'इस क्वेस्ट में एसेट उपलब्ध नहीं है।',
    burmese: 'ဤစွမ်းဆောင်ရည်တွင် အရာဝတ္ထု မရရှိနိုင်ပါ။',
    thai: 'ทรัพย์สินไม่พร้อมใช้งานในเควสต์นี้',
    mandarin: '资产在此任务中不可用。'
  },
  downloadProjectConfirmation: {
    english: 'Download this project for offline use?',
    spanish: '¿Descargar este proyecto para uso sin conexión?',
    brazilian_portuguese: 'Baixar este projeto para uso offline?',
    tok_pisin: 'Daunim dispela project long usim taim i no gat internet?',
    indonesian: 'Unduh proyek ini untuk penggunaan offline?',
    nepali: 'अफलाइन प्रयोगको लागि यो प्रोजेक्ट डाउनलोड गर्ने?',
    hindi: 'ऑफलाइन उपयोग के लिए इस परियोजना को डाउनलोड करें?',
    burmese:
      'အင်တာနက်မရှိသော အချိန်တွင် အသုံးပြုရန် ဤစီမံကိန်းကို ဒေါင်းလုဒ်လုပ်မည်လား?',
    thai: 'ดาวน์โหลดโครงการนี้เพื่อใช้งานแบบออฟไลน์?',
    mandarin: '下载此项目以供离线使用？'
  },
  downloadQuestConfirmation: {
    english: 'Download this quest for offline use?',
    spanish: '¿Descargar esta quest para uso sin conexión?',
    brazilian_portuguese: 'Baixar esta quest para uso offline?',
    tok_pisin: 'Daunim dispela quest long usim taim i no gat internet?',
    indonesian: 'Unduh quest ini untuk penggunaan offline?',
    nepali: 'अफलाइन प्रयोगको लागि यो क्वेस्ट डाउनलोड गर्ने?',
    hindi: 'ऑफलाइन उपयोग के लिए इस क्वेस्ट को डाउनलोड करें?',
    burmese:
      'အင်တာနက်မရှိသော အချိန်တွင် အသုံးပြုရန် ဤစွမ်းဆောင်ရည်ကို ဒေါင်းလုဒ်လုပ်မည်လား?',
    thai: 'ดาวน์โหลดเควสต์นี้เพื่อใช้งานแบบออฟไลน์?',
    mandarin: '下载此任务以供离线使用？'
  },
  thisWillDownload: {
    english: 'This will download:',
    spanish: 'Esto descargará:',
    brazilian_portuguese: 'Isso baixará:',
    tok_pisin: 'Dispela bai daunim:',
    indonesian: 'Ini akan mengunduh:',
    nepali: 'यसले डाउनलोड गर्नेछ:',
    hindi: 'यह डाउनलोड करेगा:',
    burmese: 'ဤအရာသည် ဒေါင်းလုဒ်လုပ်မည်:',
    thai: 'สิ่งนี้จะดาวน์โหลด:',
    mandarin: '这将下载：'
  },
  translations: {
    english: 'Translations',
    spanish: 'Traducciones',
    brazilian_portuguese: 'Traduções',
    tok_pisin: 'Ol Translation',
    indonesian: 'Terjemahan',
    nepali: 'अनुवादहरू',
    hindi: 'अनुवाद',
    burmese: 'ဘာသာပြန်များ',
    thai: 'การแปล',
    mandarin: '翻译'
  },
  doRecord: {
    english: 'Record',
    spanish: 'Grabar',
    brazilian_portuguese: 'Gravar',
    tok_pisin: 'Rekodem',
    indonesian: 'Rekam',
    nepali: 'रेकर्ड गर्नुहोस्',
    hindi: 'रिकॉर्ड करें',
    burmese: 'မှတ်တမ်းတင်ပါ',
    thai: 'บันทึก',
    mandarin: '录制'
  },
  isRecording: {
    english: 'Recording...',
    spanish: 'Grabando...',
    brazilian_portuguese: 'Gravando...',
    tok_pisin: 'Recording...',
    indonesian: 'Merekam...',
    nepali: 'रेकर्ड गर्दै...',
    hindi: 'रिकॉर्डिंग...',
    burmese: 'မှတ်တမ်းတင်နေသည်...',
    thai: 'กำลังบันทึก...',
    mandarin: '录制中...'
  },
  recordTo: {
    english: 'Record to',
    spanish: 'Grabar en',
    brazilian_portuguese: 'Gravar em',
    tok_pisin: 'Rekodem long',
    indonesian: 'Rekam ke',
    nepali: 'रेकर्ड गर्नुहोस्',
    hindi: 'रिकॉर्ड करें',
    burmese: 'မှတ်တမ်းတင်ရန်',
    thai: 'บันทึกไปยัง',
    mandarin: '录制到'
  },
  after: {
    english: 'After',
    spanish: 'Después de',
    brazilian_portuguese: 'Depois de',
    tok_pisin: 'Despela',
    indonesian: 'Setelah',
    nepali: 'बादमा'
  },
  noLabelSelected: {
    english: 'No label selected',
    spanish: 'Sin etiqueta seleccionada',
    brazilian_portuguese: 'Nenhum rótulo selecionado',
    tok_pisin: 'No label i stap',
    indonesian: 'Tidak ada label dipilih',
    nepali: 'कुनै लेबल चयन गरिएको छैन',
    hindi: 'कोई लेबल चयनित नहीं',
    burmese: 'အညွှန်းတံဆိပ် ရွေးချယ်ထားခြင်း မရှိပါ',
    thai: 'ไม่ได้เลือกป้ายกำกับ',
    mandarin: '未选择标签'
  },
  startRecordingSession: {
    english: 'Start Recording Session',
    spanish: 'Iniciar Sesión de Grabación',
    brazilian_portuguese: 'Iniciar Sessão de Gravação',
    tok_pisin: 'Stat Rekodem Taim',
    indonesian: 'Mulai Sesi Rekaman',
    nepali: 'रेकर्डिङ सत्र सुरु गर्नुहोस्',
    hindi: 'रिकॉर्डिंग सत्र शुरू करें',
    burmese: 'မှတ်တမ်းတင်ခြင်း အစည်းအဝေးကို စတင်ပါ',
    thai: 'เริ่มเซสชันการบันทึก',
    mandarin: '开始录制会话'
  },
  typeToConfirm: {
    english: 'Type {text} to confirm',
    spanish: 'Escriba {text} para confirmar',
    brazilian_portuguese: 'Digite {text} para confirmar',
    tok_pisin: 'Raitim {text} bilong siaim',
    indonesian: 'Ketik {text} untuk mengkonfirmasi',
    nepali: 'पुष्टि गर्न {text} टाइप गर्नुहोस्',
    hindi: 'पुष्टि करने के लिए {text} टाइप करें',
    burmese: 'အတည်ပြုရန် {text} ကို ရိုက်ထည့်ပါ',
    thai: 'พิมพ์ {text} เพื่อยืนยัน',
    mandarin: '输入 {text} 以确认'
  },
  confirmDeletion: {
    english: 'Confirm Deletion',
    spanish: 'Confirmar Eliminación',
    brazilian_portuguese: 'Confirmar Exclusão',
    tok_pisin: 'Siaim Rausim',
    indonesian: 'Konfirmasi Penghapusan',
    nepali: 'मेटाउने पुष्टि गर्नुहोस्',
    hindi: 'हटाने की पुष्टि करें',
    burmese: 'ဖျက်ခြင်းကို အတည်ပြုပါ',
    thai: 'ยืนยันการลบ',
    mandarin: '确认删除'
  },
  deleting: {
    english: 'Deleting...',
    spanish: 'Eliminando...',
    brazilian_portuguese: 'Excluindo...',
    tok_pisin: 'Rausim nau...',
    indonesian: 'Menghapus...',
    nepali: 'मेटाउँदै...',
    hindi: 'हटा रहे हैं...',
    burmese: 'ဖျက်နေသည်...',
    thai: 'กำลังลบ...',
    mandarin: '正在删除...'
  },
  audioSegments: {
    english: 'Audio Segments',
    spanish: 'Pistas de Audio',
    brazilian_portuguese: 'Pistas de Áudio',
    tok_pisin: 'Ol audio track',
    indonesian: 'Trek audio',
    nepali: 'अडियो खण्डहरू',
    hindi: 'ऑडियो सेगमेंट',
    burmese: 'အသံအပိုင်းများ',
    thai: 'ส่วนเสียง',
    mandarin: '音频片段'
  },
  audioSegment: {
    english: 'Audio Segment',
    spanish: 'Pista de Audio',
    brazilian_portuguese: 'Pista de Áudio',
    tok_pisin: 'Ol audio track',
    indonesian: 'Trek audio',
    nepali: 'अडियो खण्ड',
    hindi: 'ऑडियो सेगमेंट',
    burmese: 'အသံအပိုင်း',
    thai: 'ส่วนเสียง',
    mandarin: '音频片段'
  },
  asAssets: {
    english: 'as Assets',
    spanish: 'como Assets',
    brazilian_portuguese: 'como Assets',
    tok_pisin: 'as Assets',
    indonesian: 'sebagai Assets',
    nepali: 'एसेटहरूको रूपमा',
    hindi: 'एसेट के रूप में',
    burmese: 'အရာဝတ္ထုများအဖြစ်',
    thai: 'เป็นทรัพย์สิน',
    mandarin: '作为资产'
  },
  asAsset: {
    english: 'as Asset',
    spanish: 'como Asset',
    brazilian_portuguese: 'como Asset',
    tok_pisin: 'as Asset',
    indonesian: 'sebagai Asset',
    nepali: 'एसेटको रूपमा',
    hindi: 'एसेट के रूप में',
    burmese: 'အရာဝတ္ထုအဖြစ်',
    thai: 'เป็นทรัพย์สิน',
    mandarin: '作为资产'
  },
  save: {
    english: 'Save',
    spanish: 'Guardar',
    brazilian_portuguese: 'Salvar',
    tok_pisin: 'Save',
    indonesian: 'Simpan',
    nepali: 'सुरक्षित गर्नुहोस्',
    hindi: 'सहेजें',
    burmese: 'သိမ်းဆည်းပါ',
    thai: 'บันทึก',
    mandarin: '保存'
  },
  projectDirectory: {
    english: 'Project Directory',
    spanish: 'Directorio de Proyecto',
    brazilian_portuguese: 'Diretório de Projeto',
    tok_pisin: 'Project Directory',
    indonesian: 'Direktori Proyek',
    nepali: 'प्रोजेक्ट डाइरेक्टरी',
    hindi: 'परियोजना निर्देशिका',
    burmese: 'စီမံကိန်း ဖိုင်တွဲ',
    thai: 'ไดเรกทอรีโครงการ',
    mandarin: '项目目录'
  },
  projectMadePublic: {
    english: 'The project has been made public',
    spanish: 'El proyecto se ha hecho público',
    brazilian_portuguese: 'O projeto foi tornado público',
    tok_pisin: 'Project i mekim public nau',
    indonesian: 'Proyek telah dibuat publik',
    nepali: 'प्रोजेक्ट सार्वजनिक बनाइयो',
    hindi: 'परियोजना सार्वजनिक बना दी गई है',
    burmese: 'စီမံကိန်းကို အများပြည်သူသို့ ပြုလုပ်ထားသည်',
    thai: 'โครงการถูกทำให้เป็นสาธารณะแล้ว',
    mandarin: '项目已设为公开'
  },
  projectMadePrivate: {
    english: 'The project has been made private',
    spanish: 'El proyecto se ha hecho privado',
    brazilian_portuguese: 'O projeto foi tornado privado',
    tok_pisin: 'Project i mekim private nau',
    indonesian: 'Proyek telah dibuat pribadi',
    nepali: 'प्रोजेक्ट निजी बनाइयो',
    hindi: 'परियोजना निजी बना दी गई है',
    burmese: 'စီမံကိန်းကို ကိုယ်ပိုင် ပြုလုပ်ထားသည်',
    thai: 'โครงการถูกทำให้เป็นส่วนตัวแล้ว',
    mandarin: '项目已设为私有'
  },
  projectMadeInvisible: {
    english: 'The project has been made invisible',
    spanish: 'El proyecto se ha hecho invisible',
    brazilian_portuguese: 'O projeto foi tornado invisível',
    tok_pisin: 'Project i mekim hait nau',
    indonesian: 'Proyek telah dibuat tidak terlihat',
    nepali: 'प्रोजेक्ट अदृश्य बनाइएको छ',
    hindi: 'परियोजना अदृश्य बना दी गई है',
    burmese: 'စီမံကိန်းကို မမြင်ရအောင် ပြုလုပ်ထားသည်',
    thai: 'โครงการถูกทำให้มองไม่เห็นแล้ว',
    mandarin: '项目已设为不可见'
  },
  projectMadeVisible: {
    english: 'The project has been made visible',
    spanish: 'El proyecto se ha hecho visible',
    brazilian_portuguese: 'O projeto foi tornado visível',
    tok_pisin: 'Project i mekim save nau',
    indonesian: 'Proyek telah dibuat terlihat',
    nepali: 'प्रोजेक्ट दृश्य बनाइएको छ',
    hindi: 'परियोजना दृश्यमान बना दी गई है',
    burmese: 'စီမံကိန်းကို မြင်နိုင်အောင် ပြုလုပ်ထားသည်',
    thai: 'โครงการถูกทำให้มองเห็นได้แล้ว',
    mandarin: '项目已设为可见'
  },
  projectMadeInactive: {
    english: 'The project has been made inactive',
    spanish: 'El proyecto se ha hecho inactivo',
    brazilian_portuguese: 'O projeto foi tornado inativo',
    tok_pisin: 'Project i mekim stop nau',
    indonesian: 'Proyek telah dibuat tidak aktif',
    nepali: 'प्रोजेक्ट निष्क्रिय बनाइएको छ',
    hindi: 'परियोजना निष्क्रिय बना दी गई है',
    burmese: 'စီမံကိန်းကို မလှုပ်ရှားအောင် ပြုလုပ်ထားသည်',
    thai: 'โครงการถูกทำให้ไม่ใช้งานแล้ว',
    mandarin: '项目已设为非活动'
  },
  projectMadeActive: {
    english: 'The project has been made active',
    spanish: 'El proyecto se ha hecho activo',
    brazilian_portuguese: 'O projeto foi tornado ativo',
    tok_pisin: 'Project i mekim active nau',
    indonesian: 'Proyek telah dibuat aktif',
    nepali: 'प्रोजेक्ट सक्रिय बनाइएको छ',
    hindi: 'परियोजना सक्रिय बना दी गई है',
    burmese: 'စီမံကိန်းကို လှုပ်ရှားအောင် ပြုလုပ်ထားသည်',
    thai: 'โครงการถูกทำให้ใช้งานได้แล้ว',
    mandarin: '项目已设为活动'
  },
  failedToUpdateProjectSettings: {
    english: 'Failed to update project settings',
    spanish: 'Error al actualizar la configuración del proyecto',
    brazilian_portuguese: 'Falha ao atualizar as configurações do projeto',
    tok_pisin: 'I no inap update project settings',
    indonesian: 'Gagal mengupdate pengaturan proyek',
    nepali: 'प्रोजेक्ट सेटिङहरू अपडेट गर्न असफल',
    hindi: 'परियोजना सेटिंग अपडेट करने में विफल',
    burmese: 'စီမံကိန်း ဆက်တင်များကို အပ်ဒိတ်လုပ်ရန် မအောင်မြင်ပါ',
    thai: 'ไม่สามารถอัปเดตการตั้งค่าโครงการได้',
    mandarin: '更新项目设置失败'
  },
  failedToUpdateProjectVisibility: {
    english: 'Failed to update project visibility',
    spanish: 'Error al actualizar la visibilidad del proyecto',
    brazilian_portuguese: 'Falha ao atualizar a visibilidade do projeto',
    tok_pisin: 'I no inap update project visibility',
    indonesian: 'Gagal mengupdate visibilitas proyek',
    nepali: 'प्रोजेक्ट दृश्यता अपडेट गर्न असफल',
    hindi: 'परियोजना दृश्यता अपडेट करने में विफल',
    burmese: 'စီမံကိန်း မြင်နိုင်မှုကို အပ်ဒိတ်လုပ်ရန် မအောင်မြင်ပါ',
    thai: 'ไม่สามารถอัปเดตการมองเห็นของโครงการได้',
    mandarin: '更新项目可见性失败'
  },
  failedToUpdateProjectActiveStatus: {
    english: 'Failed to update project active status',
    spanish: 'Error al actualizar el estado activo del proyecto',
    brazilian_portuguese: 'Falha ao atualizar o status ativo do projeto',
    tok_pisin: 'I no inap update project active status',
    indonesian: 'Gagal mengupdate status aktif proyek',
    nepali: 'प्रोजेक्ट सक्रिय स्थिति अपडेट गर्न असफल',
    hindi: 'परियोजना सक्रिय स्थिति अपडेट करने में विफल',
    burmese: 'စီမံကိန်း လှုပ်ရှားနေသော အခြေအနေကို အပ်ဒိတ်လုပ်ရန် မအောင်မြင်ပါ',
    thai: 'ไม่สามารถอัปเดตสถานะการใช้งานของโครงการได้',
    mandarin: '更新项目活动状态失败'
  },
  projectSettingsLoadError: {
    english: 'Error loading quest settings.',
    spanish: 'Error al cargar la configuración de quest.',
    brazilian_portuguese: 'Erro ao carregar as configurações da quest.',
    tok_pisin: 'I no inap load quest settings.',
    indonesian: 'Gagal memuat pengaturan quest.',
    nepali: 'क्वेस्ट सेटिङहरू लोड गर्दा त्रुटि।',
    hindi: 'क्वेस्ट सेटिंग लोड करने में त्रुटि।',
    burmese: 'စွမ်းဆောင်ရည် ဆက်တင်များကို ဖွင့်ရာတွင် အမှားအယွင်း။',
    thai: 'เกิดข้อผิดพลาดในการโหลดการตั้งค่าเควสต์',
    mandarin: '加载任务设置时出错。'
  },
  projectSettings: {
    english: 'Project Settings',
    spanish: 'Configuración del Proyecto',
    brazilian_portuguese: 'Configurações do Projeto',
    tok_pisin: 'Project Settings',
    indonesian: 'Pengaturan Proyek',
    nepali: 'प्रोजेक्ट सेटिङहरू',
    hindi: 'परियोजना सेटिंग',
    burmese: 'စီမံကိန်း ဆက်တင်များ',
    thai: 'การตั้งค่าโครงการ',
    mandarin: '项目设置'
  },
  publicProjectDescription: {
    english: 'Anyone can view and contribute to this project',
    spanish: 'Cualquiera puede ver y contribuir a este proyecto',
    brazilian_portuguese:
      'Qualquer pessoa pode ver e contribuir para este projeto',
    tok_pisin: 'Olgeta man i ken lukim na contributim long dispela project',
    indonesian: 'Siapa saja dapat melihat dan berkontribusi pada proyek ini',
    nepali: 'जोसुकैले यो प्रोजेक्ट हेर्न र योगदान गर्न सक्छन्',
    hindi: 'कोई भी इस परियोजना को देख और योगदान कर सकता है',
    burmese: 'မည်သူမဆို ဤစီမံကိန်းကို ကြည့်ရှုနိုင်ပြီး ပါဝင်ဆောင်ရွက်နိုင်သည်',
    thai: 'ทุกคนสามารถดูและมีส่วนร่วมในโครงการนี้ได้',
    mandarin: '任何人都可以查看和贡献此项目'
  },
  visibleProjectDescription: {
    english:
      'This project appears in public listings and can be discovered by all users.',
    spanish:
      'Este proyecto aparece en listados públicos y puede ser descubierto por todos los usuarios.',
    brazilian_portuguese:
      'Este projeto aparece em listagens públicas e pode ser descoberto por todos os usuários.',
    tok_pisin:
      'Dispela project i save long public list na olgeta user i ken painim.',
    indonesian:
      'Proyek ini muncul di daftar publik dan dapat ditemukan oleh semua pengguna.',
    nepali:
      'यो प्रोजेक्ट सार्वजनिक सूचीहरूमा देखिन्छ र सबै प्रयोगकर्ताहरूले फेला पार्न सक्छन्।',
    hindi:
      'यह परियोजना सार्वजनिक सूचियों में दिखाई देती है और सभी उपयोगकर्ताओं द्वारा खोजी जा सकती है।',
    burmese:
      'ဤစီမံကိန်းသည် အများပြည်သူ စာရင်းများတွင် ပေါ်လာပြီး အားလုံးသော အသုံးပြုသူများက ရှာဖွေနိုင်သည်။',
    thai: 'โครงการนี้จะปรากฏในรายการสาธารณะและสามารถค้นพบได้โดยผู้ใช้ทุกคน',
    mandarin: '此项目会出现在公共列表中，所有用户都可以发现它。'
  },
  invisibleProjectDescription: {
    english:
      'This project is not displayed in project directories or search results.',
    spanish:
      'Este proyecto no se muestra en los directorios de proyectos ni en los resultados de búsqueda.',
    brazilian_portuguese:
      'Este projeto não é exibido em diretórios de projetos ou resultados de pesquisa.',
    tok_pisin:
      'Dispela project i no save long project directory olsem search result.',
    indonesian:
      'Proyek ini tidak ditampilkan di direktori proyek atau hasil pencarian.',
    nepali: 'यो प्रोजेक्ट प्रोजेक्ट डाइरेक्टरीहरू वा खोज परिणामहरूमा देखिँदैन।',
    hindi:
      'यह परियोजना परियोजना निर्देशिकाओं या खोज परिणामों में प्रदर्शित नहीं होती है।',
    burmese:
      'ဤစီမံကိန်းသည် စီမံကိန်း ဖိုင်တွဲများ သို့မဟုတ် ရှာဖွေမှု ရလဒ်များတွင် မပြသပါ။',
    thai: 'โครงการนี้จะไม่แสดงในไดเรกทอรีโครงการหรือผลการค้นหา',
    mandarin: '此项目不会显示在项目目录或搜索结果中。'
  },
  activeProjectDescription: {
    english: 'The project is currently open for viewing and contributions.',
    spanish:
      'El proyecto está actualmente abierto para visualización y contribuciones.',
    brazilian_portuguese:
      'O projeto está atualmente aberto para visualização e contribuições.',
    tok_pisin: 'Dispela project i open nau long lukim na contributim.',
    indonesian: 'Proyek saat ini terbuka untuk dilihat dan kontribusi.',
    nepali: 'प्रोजेक्ट हाल हेर्न र योगदानका लागि खुला छ।',
    hindi: 'परियोजना वर्तमान में देखने और योगदान के लिए खुली है।',
    burmese:
      'စီမံကိန်းသည် လက်ရှိတွင် ကြည့်ရှုခြင်းနှင့် ပါဝင်ဆောင်ရွက်ခြင်းအတွက် ဖွင့်ထားသည်။',
    thai: 'โครงการเปิดให้ดูและมีส่วนร่วมในขณะนี้',
    mandarin: '项目目前开放查看和贡献。'
  },
  inactiveProjectDescription: {
    english:
      'This project is currently inactive and not accepting contributions.',
    spanish:
      'Este proyecto está actualmente inactivo y no acepta contribuciones.',
    brazilian_portuguese:
      'Este projeto está atualmente inativo e não está aceitando contribuições.',
    tok_pisin: 'Dispela project i no wok nau na i no acceptim contributim.',
    indonesian:
      'Proyek ini saat ini tidak aktif dan tidak menerima kontribusi.',
    nepali: 'यो प्रोजेक्ट हाल निष्क्रिय छ र योगदानहरू स्वीकार गर्दैन।',
    hindi:
      'यह परियोजना वर्तमान में निष्क्रिय है और योगदान स्वीकार नहीं कर रही है।',
    burmese:
      'ဤစီမံကိန်းသည် လက်ရှိတွင် မလှုပ်ရှားနေပြီး ပါဝင်ဆောင်ရွက်မှုများကို လက်မခံပါ။',
    thai: 'โครงการนี้ไม่ใช้งานในขณะนี้และไม่รับการมีส่วนร่วม',
    mandarin: '此项目目前处于非活动状态，不接受贡献。'
  },
  loadingOptions: {
    english: 'Loading options...',
    spanish: 'Cargando opciones...',
    brazilian_portuguese: 'Carregando opções...',
    tok_pisin: 'I loadim ol option...',
    indonesian: 'Memuat opsi...',
    nepali: 'विकल्पहरू लोड गर्दै...',
    hindi: 'विकल्प लोड हो रहे हैं...',
    burmese: 'ရွေးချယ်စရာများကို ဖွင့်နေသည်...',
    thai: 'กำลังโหลดตัวเลือก...',
    mandarin: '正在加载选项...'
  },
  loadingTagCategories: {
    english: 'Loading tag categories...',
    spanish: 'Cargando categorías de etiquetas...',
    brazilian_portuguese: 'Carregando categorias de etiquetas...',
    tok_pisin: 'I loadim ol tag category...',
    indonesian: 'Memuat kategori tag...',
    nepali: 'ट्याग श्रेणीहरू लोड गर्दै...',
    hindi: 'टैग श्रेणियां लोड हो रही हैं...',
    burmese: 'အညွှန်းတံဆိပ် အမျိုးအစားများကို ဖွင့်နေသည်...',
    thai: 'กำลังโหลดหมวดหมู่แท็ก...',
    mandarin: '正在加载标签类别...'
  },
  questSettings: {
    english: 'Quest Settings',
    spanish: 'Configuración de la Misión',
    brazilian_portuguese: 'Configurações da Missão',
    tok_pisin: 'Quest Settings',
    indonesian: 'Pengaturan Quest',
    nepali: 'क्वेस्ट सेटिङहरू',
    hindi: 'क्वेस्ट सेटिंग्स',
    burmese: 'အလုပ်တာဝန် ဆက်တင်များ',
    thai: 'การตั้งค่าควสต์',
    mandarin: '任务设置'
  },
  questSettingsLoadError: {
    english: 'Error loading quest settings.',
    spanish: 'Error al cargar la configuración de quest.',
    brazilian_portuguese: 'Erro ao carregar as configurações da quest.',
    tok_pisin: 'I no inap load quest settings.',
    indonesian: 'Gagal memuat pengaturan quest.',
    nepali: 'क्वेस्ट सेटिङहरू लोड गर्दा त्रुटि।',
    hindi: 'क्वेस्ट सेटिंग्स लोड करने में त्रुटि।',
    burmese: 'အလုပ်တာဝန် ဆက်တင်များကို ဖွင့်ရာတွင် အမှားအယွင်း။',
    thai: 'เกิดข้อผิดพลาดในการโหลดการตั้งค่าควสต์',
    mandarin: '加载任务设置时出错。'
  },
  visibleQuestDescription: {
    english: 'This quest is visible to users',
    spanish: 'Esta misión es visible para los usuarios',
    brazilian_portuguese: 'Esta missão é visível para os usuários',
    tok_pisin: 'Dispela quest i save long ol user',
    indonesian: 'Quest ini terlihat oleh pengguna',
    nepali: 'यो क्वेस्ट प्रयोगकर्ताहरूलाई देखिन्छ',
    hindi: 'यह क्वेस्ट उपयोगकर्ताओं को दिखाई देती है',
    burmese: 'ဤအလုပ်တာဝန်သည် အသုံးပြုသူများအတွက် မြင်နိုင်သည်',
    thai: 'ควสต์นี้สามารถมองเห็นได้โดยผู้ใช้',
    mandarin: '此任务对用户可见'
  },
  invisibleQuestDescription: {
    english: 'This quest is hidden from users',
    spanish: 'Esta misión está oculta para los usuarios',
    brazilian_portuguese: 'Esta missão está oculta dos usuários',
    tok_pisin: 'Dispela quest i hait long ol user',
    indonesian: 'Quest ini disembunyikan dari pengguna',
    nepali: 'यो क्वेस्ट प्रयोगकर्ताहरूबाट लुकाइएको छ',
    hindi: 'यह क्वेस्ट उपयोगकर्ताओं से छुपाई गई है',
    burmese: 'ဤအလုပ်တာဝန်သည် အသုံးပြုသူများထံမှ ဝှက်ထားသည်',
    thai: 'ควสต์นี้ถูกซ่อนจากผู้ใช้',
    mandarin: '此任务对用户隐藏'
  },
  activeQuestDescription: {
    english: 'This quest is available for completion',
    spanish: 'Esta misión está disponible para completar',
    brazilian_portuguese: 'Esta missão está disponível para conclusão',
    tok_pisin: 'Dispela quest i redi long pinisim',
    indonesian: 'Quest ini tersedia untuk diselesaikan',
    nepali: 'यो क्वेस्ट पूरा गर्नको लागि उपलब्ध छ',
    hindi: 'यह क्वेस्ट पूरा करने के लिए उपलब्ध है',
    burmese: 'ဤအလုပ်တာဝန်သည် ပြီးမြောက်ရန် ရရှိနိုင်သည်',
    thai: 'ควสต์นี้พร้อมให้ทำเสร็จ',
    mandarin: '此任务可供完成'
  },
  inactiveQuestDescription: {
    english: 'This quest is temporarily disabled',
    spanish: 'Esta misión está temporalmente deshabilitada',
    brazilian_portuguese: 'Esta missão está temporariamente desabilitada',
    tok_pisin: 'Dispela quest i stop liklik taim',
    indonesian: 'Quest ini sementara dinonaktifkan',
    nepali: 'यो क्वेस्ट अस्थायी रूपमा असक्षम छ',
    hindi: 'यह क्वेस्ट अस्थायी रूप से अक्षम है',
    burmese: 'ဤအလုပ်တာဝန်သည် ယာယီပိတ်ထားသည်',
    thai: 'ควสต์นี้ถูกปิดใช้งานชั่วคราว',
    mandarin: '此任务已暂时禁用'
  },
  questMadeInvisible: {
    english: 'The quest has been made invisible',
    spanish: 'La misión se ha hecho invisible',
    brazilian_portuguese: 'A missão foi tornada invisível',
    tok_pisin: 'Quest i mekim hait nau',
    indonesian: 'Quest telah dibuat tidak terlihat',
    nepali: 'क्वेस्ट अदृश्य बनाइएको छ',
    hindi: 'क्वेस्ट को अदृश्य बना दिया गया है',
    burmese: 'အလုပ်တာဝန်ကို မမြင်ရအောင် ပြုလုပ်ထားသည်',
    thai: 'ควสต์ถูกทำให้มองไม่เห็น',
    mandarin: '任务已设为不可见'
  },
  questMadeVisible: {
    english: 'The quest has been made visible',
    spanish: 'La misión se ha hecho visible',
    brazilian_portuguese: 'A missão foi tornada visível',
    tok_pisin: 'Quest i mekim save nau',
    indonesian: 'Quest telah dibuat terlihat',
    nepali: 'क्वेस्ट दृश्य बनाइएको छ',
    hindi: 'क्वेस्ट को दृश्यमान बना दिया गया है',
    burmese: 'အလုပ်တာဝန်ကို မြင်နိုင်အောင် ပြုလုပ်ထားသည်',
    thai: 'ควสต์ถูกทำให้มองเห็นได้',
    mandarin: '任务已设为可见'
  },
  questMadeInactive: {
    english: 'The quest has been made inactive',
    spanish: 'La misión se ha hecho inactiva',
    brazilian_portuguese: 'A missão foi tornada inativa',
    tok_pisin: 'Quest i mekim stop nau',
    indonesian: 'Quest telah dibuat tidak aktif',
    nepali: 'क्वेस्ट निष्क्रिय बनाइएको छ',
    hindi: 'क्वेस्ट को निष्क्रिय बना दिया गया है',
    burmese: 'အလုပ်တာဝန်ကို ပိတ်ထားသည်',
    thai: 'ควสต์ถูกทำให้ไม่ใช้งาน',
    mandarin: '任务已设为非活动'
  },
  questMadeActive: {
    english: 'The quest has been made active',
    spanish: 'La misión se ha hecho activa',
    brazilian_portuguese: 'A missão foi tornada ativa',
    tok_pisin: 'Quest i mekim active nau',
    indonesian: 'Quest telah dibuat aktif',
    nepali: 'क्वेस्ट सक्रिय बनाइएको छ',
    hindi: 'क्वेस्ट को सक्रिय बना दिया गया है',
    burmese: 'အလုပ်တာဝန်ကို ဖွင့်ထားသည်',
    thai: 'ควสต์ถูกทำให้ใช้งาน',
    mandarin: '任务已设为活动'
  },
  failedToUpdateQuestSettings: {
    english: 'Failed to update quest settings',
    spanish: 'Error al actualizar la configuración de la misión',
    brazilian_portuguese: 'Falha ao atualizar as configurações da missão',
    tok_pisin: 'I no inap update quest settings',
    indonesian: 'Gagal mengupdate pengaturan quest',
    nepali: 'क्वेस्ट सेटिङहरू अपडेट गर्न असफल',
    hindi: 'क्वेस्ट सेटिंग्स अपडेट करने में विफल',
    burmese: 'အလုပ်တာဝန် ဆက်တင်များကို အပ်ဒိတ်လုပ်ရန် မအောင်မြင်ပါ',
    thai: 'ไม่สามารถอัปเดตการตั้งค่าควสต์ได้',
    mandarin: '更新任务设置失败'
  },
  loadingAudio: {
    english: 'Loading audio...',
    spanish: 'Cargando audio...',
    brazilian_portuguese: 'Carregando áudio...',
    tok_pisin: 'I loadim audio...',
    indonesian: 'Memuat audio...',
    nepali: 'अडियो लोड गर्दै...',
    hindi: 'ऑडियो लोड हो रहा है...',
    burmese: 'အသံကို ဖွင့်နေသည်...',
    thai: 'กำลังโหลดเสียง...',
    mandarin: '正在加载音频...'
  },
  updateAvailable: {
    english: 'A new update is available!',
    spanish: '¡Una nueva actualización está disponible!',
    brazilian_portuguese: 'Uma nova atualização está disponível!',
    tok_pisin: 'Nupela update i stap!',
    indonesian: 'Pembaruan baru tersedia!',
    nepali: 'नयाँ अपडेट उपलब्ध छ!',
    hindi: 'एक नया अपडेट उपलब्ध है!',
    burmese: 'အပ်ဒိတ်အသစ်တစ်ခု ရရှိနိုင်ပါသည်!',
    thai: 'มีการอัปเดตใหม่พร้อมใช้งาน!',
    mandarin: '有新更新可用！'
  },
  updateNow: {
    english: 'Update Now',
    spanish: 'Actualizar Ahora',
    brazilian_portuguese: 'Atualizar Agora',
    tok_pisin: 'Update Nau',
    indonesian: 'Perbarui Sekarang',
    nepali: 'अहिले अपडेट गर्नुहोस्',
    hindi: 'अभी अपडेट करें',
    burmese: 'ယခု အပ်ဒိတ်လုပ်ပါ',
    thai: 'อัปเดตตอนนี้',
    mandarin: '立即更新'
  },
  updateFailed: {
    english: 'Update failed',
    spanish: 'Actualización fallida',
    brazilian_portuguese: 'Atualização falhou',
    tok_pisin: 'Update i pundaun',
    indonesian: 'Pembaruan gagal',
    nepali: 'अपडेट असफल भयो',
    hindi: 'अपडेट विफल',
    burmese: 'အပ်ဒိတ်လုပ်ရန် မအောင်မြင်ပါ',
    thai: 'การอัปเดตล้มเหลว',
    mandarin: '更新失败'
  },
  updateErrorTryAgain: {
    english: 'Please try again or dismiss',
    spanish: 'Por favor intente nuevamente o descarte',
    brazilian_portuguese: 'Por favor tente novamente ou descarte',
    tok_pisin: 'Traim gen o rausim',
    indonesian: 'Silakan coba lagi atau abaikan',
    nepali: 'कृपया पुन: प्रयास गर्नुहोस् वा खारेज गर्नुहोस्',
    hindi: 'कृपया पुनः प्रयास करें या खारिज करें',
    burmese: 'ကျေးဇူးပြု၍ ထပ်မံကြိုးစားပါ သို့မဟုတ် ပယ်ဖျက်ပါ',
    thai: 'กรุณาลองอีกครั้งหรือปิด',
    mandarin: '请重试或关闭'
  },
  retry: {
    english: 'Retry',
    spanish: 'Reintentar',
    brazilian_portuguese: 'Tentar novamente',
    tok_pisin: 'Traim gen',
    indonesian: 'Coba lagi',
    nepali: 'पुन: प्रयास गर्नुहोस्',
    hindi: 'पुनः प्रयास करें',
    burmese: 'ထပ်မံကြိုးစားပါ',
    thai: 'ลองอีกครั้ง',
    mandarin: '重试'
  },
  enterCommentOptional: {
    english: 'Enter your comment (optional)',
    spanish: 'Escribe tu comentario (opcional)',
    brazilian_portuguese: 'Escreva seu comentário (opcional)',
    tok_pisin: 'Raitim comment bilong yu (yu ken o nogat)',
    indonesian: 'Masukkan komentar Anda (opsional)',
    nepali: 'आफ्नो टिप्पणी प्रविष्ट गर्नुहोस् (वैकल्पिक)',
    hindi: 'अपनी टिप्पणी दर्ज करें (वैकल्पिक)',
    burmese: 'သင်၏မှတ်ချက်ကို ထည့်သွင်းပါ (ရွေးချယ်နိုင်သည်)',
    thai: 'ใส่ความคิดเห็นของคุณ (ไม่บังคับ)',
    mandarin: '输入您的评论（可选）'
  },
  auth_init_error_title: {
    english: 'Initialization Error',
    spanish: 'Error de Inicialización',
    brazilian_portuguese: 'Erro de Inicialização',
    tok_pisin: 'Initialization Error',
    indonesian: 'Kesalahan Inisialisasi',
    nepali: 'सुरुवात त्रुटि',
    hindi: 'आरंभीकरण त्रुटि',
    burmese: 'စတင်ခြင်း အမှား',
    thai: 'ข้อผิดพลาดในการเริ่มต้น',
    mandarin: '初始化错误'
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
      'Gagal menginisialisasi aplikasi. Silakan coba logout dan login kembali.',
    nepali:
      'एप सुरु गर्न असफल भयो। कृपया लगआउट गरेर पुन: लग इन गर्ने प्रयास गर्नुहोस्।',
    hindi:
      'ऐप को आरंभ करने में विफल। कृपया लॉग आउट करके फिर से लॉग इन करने का प्रयास करें।',
    burmese: 'အက်ပ်ကို စတင်ရန် မအောင်မြင်ပါ။ ကျေးဇူးပြု၍ ထွက်ပြီး ပြန်ဝင်ပါ။',
    thai: 'ไม่สามารถเริ่มต้นแอปได้ กรุณาลองออกจากระบบแล้วเข้าสู่ระบบอีกครั้ง',
    mandarin: '应用初始化失败。请尝试退出并重新登录。'
  },
  auth_init_error_ok: {
    english: 'OK',
    spanish: 'OK',
    brazilian_portuguese: 'OK',
    tok_pisin: 'Orait',
    indonesian: 'OK',
    nepali: 'ठीक छ',
    hindi: 'ठीक है',
    burmese: 'အိုကေ',
    thai: 'ตกลง',
    mandarin: '确定'
  },
  projectDownloaded: {
    english: 'Project downloaded',
    spanish: 'Proyecto descargado',
    brazilian_portuguese: 'Projeto baixado',
    tok_pisin: 'Project i daun pinis',
    indonesian: 'Proyek diunduh',
    nepali: 'प्रोजेक्ट डाउनलोड भयो',
    hindi: 'प्रोजेक्ट डाउनलोड हो गया',
    burmese: 'ပရောဂျက်ကို ဒေါင်းလုဒ်လုပ်ပြီးပါပြီ',
    thai: 'ดาวน์โหลดโปรเจกต์แล้ว',
    mandarin: '项目已下载'
  },
  passwordMustBeAtLeast6Characters: {
    english: 'Password must be at least 6 characters',
    spanish: 'La contraseña debe tener al menos 6 caracteres',
    brazilian_portuguese: 'A senha deve ter pelo menos 6 caracteres',
    tok_pisin: 'Password i mas gat 6 character o moa',
    indonesian: 'Kata sandi harus minimal 6 karakter',
    nepali: 'पासवर्ड कम्तिमा ६ वर्णको हुनुपर्छ',
    hindi: 'पासवर्ड कम से कम 6 वर्ण का होना चाहिए',
    burmese: 'စကားဝှက်သည် အနည်းဆုံး ၆ လုံး ရှိရမည်',
    thai: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร',
    mandarin: '密码必须至少6个字符'
  },
  passwordUpdateFailed: {
    english: 'Failed to update password',
    spanish: 'Error al actualizar la contraseña',
    brazilian_portuguese: 'Falha ao atualizar a senha',
    tok_pisin: 'I no inap update password',
    indonesian: 'Gagal mengupdate kata sandi',
    nepali: 'पासवर्ड अपडेट गर्न असफल',
    hindi: 'पासवर्ड अपडेट करने में विफल',
    burmese: 'စကားဝှက်ကို အပ်ဒိတ်လုပ်ရန် မအောင်မြင်ပါ',
    thai: 'ไม่สามารถอัปเดตรหัสผ่านได้',
    mandarin: '更新密码失败'
  },
  clearCache: {
    english: 'Clear Cache',
    spanish: 'Limpiar caché',
    brazilian_portuguese: 'Limpar cache',
    tok_pisin: 'Klinim Cache',
    indonesian: 'Hapus Cache',
    nepali: 'क्यास खाली गर्नुहोस्',
    hindi: 'कैश साफ करें',
    burmese: 'ကက်ရှ်ကို ရှင်းလင်းပါ',
    thai: 'ล้างแคช',
    mandarin: '清除缓存'
  },
  clearCacheConfirmation: {
    english: 'Are you sure you want to clear all cached data?',
    spanish: '¿Estás seguro de querer limpiar todos los datos en caché?',
    brazilian_portuguese:
      'Tem certeza que deseja limpar todos os dados em cache?',
    tok_pisin: 'Yu sure long klinim olgeta cache data?',
    indonesian: 'Apakah Anda yakin ingin menghapus semua data cache?',
    nepali: 'के तपाईं सबै क्यास डाटा खाली गर्न निश्चित हुनुहुन्छ?',
    hindi: 'क्या आप वाकई सभी कैश डेटा साफ करना चाहते हैं?',
    burmese: 'ကက်ရှ်ထဲရှိ ဒေတာအားလုံးကို ရှင်းလင်းလိုသည်မှာ သေချာပါသလား?',
    thai: 'คุณแน่ใจหรือไม่ว่าต้องการล้างข้อมูลแคชทั้งหมด?',
    mandarin: '您确定要清除所有缓存数据吗？'
  },
  cacheClearedSuccess: {
    english: 'Cache cleared successfully',
    spanish: 'Caché limpiada correctamente',
    brazilian_portuguese: 'Cache limpa com sucesso',
    tok_pisin: 'Cache i klin gut pinis',
    indonesian: 'Cache berhasil dihapus',
    nepali: 'क्यास सफलतापूर्वक खाली गरियो',
    hindi: 'कैश सफलतापूर्वक साफ हो गया',
    burmese: 'ကက်ရှ်ကို အောင်မြင်စွာ ရှင်းလင်းပြီးပါပြီ',
    thai: 'ล้างแคชสำเร็จแล้ว',
    mandarin: '缓存清除成功'
  },
  exportRequiresInternet: {
    english: 'This feature requires an internet connection',
    spanish: 'Esta característica requiere una conexión a internet',
    brazilian_portuguese:
      'Esta funcionalidade requer uma conexão com a internet',
    tok_pisin: 'Dispela feature i nidim internet connection',
    indonesian: 'Fitur ini memerlukan koneksi internet',
    nepali: 'यो सुविधाको लागि इन्टरनेट जडान आवश्यक छ',
    hindi: 'इस सुविधा के लिए इंटरनेट कनेक्शन आवश्यक है',
    burmese: 'ဤအင်္ဂါရပ်သည် အင်တာနက်ချိတ်ဆက်မှု လိုအပ်သည်',
    thai: 'ฟีเจอร์นี้ต้องใช้การเชื่อมต่ออินเทอร์เน็ต',
    mandarin: '此功能需要互联网连接'
  },
  exportDataComingSoon: {
    english: 'Data export feature coming soon',
    spanish: 'La exportación de datos está próxima',
    brazilian_portuguese: 'A exportação de dados está próxima',
    tok_pisin: 'Data export feature i kam bihain',
    indonesian: 'Fitur ekspor data segera hadir',
    nepali: 'डाटा निर्यात सुविधा छिट्टै आउँदैछ',
    hindi: 'डेटा निर्यात सुविधा जल्द ही आ रही है',
    burmese: 'ဒေတာ တင်ပို့ခြင်း အင်္ဂါရပ် မကြာမီ ရောက်ရှိလာမည်',
    thai: 'ฟีเจอร์ส่งออกข้อมูลจะมาเร็วๆ นี้',
    mandarin: '数据导出功能即将推出'
  },
  info: {
    english: 'Info',
    spanish: 'Información',
    brazilian_portuguese: 'Informação',
    tok_pisin: 'Info',
    indonesian: 'Info',
    nepali: 'जानकारी',
    hindi: 'जानकारी',
    burmese: 'အချက်အလက်',
    thai: 'ข้อมูล',
    mandarin: '信息'
  },
  enableNotifications: {
    english: 'Enable Notifications',
    spanish: 'Habilitar notificaciones',
    brazilian_portuguese: 'Habilitar notificações',
    tok_pisin: 'Onim Notification',
    indonesian: 'Aktifkan Notifikasi',
    nepali: 'सूचनाहरू सक्षम गर्नुहोस्',
    hindi: 'सूचनाएं सक्षम करें',
    burmese: 'အကြောင်းကြားချက်များကို ဖွင့်ပါ',
    thai: 'เปิดใช้งานการแจ้งเตือน',
    mandarin: '启用通知'
  },
  notificationsDescription: {
    english: 'Receive notifications for app updates and important information',
    spanish:
      'Recibir notificaciones para actualizaciones de la aplicación y información importante',
    brazilian_portuguese:
      'Receber notificações para atualizações do aplicativo e informações importantes',
    tok_pisin: 'Kisim notification long app update na important information',
    indonesian:
      'Terima notifikasi untuk pembaruan aplikasi dan informasi penting',
    nepali: 'एप अपडेट र महत्त्वपूर्ण जानकारीको लागि सूचनाहरू प्राप्त गर्नुहोस्',
    hindi: 'ऐप अपडेट और महत्वपूर्ण जानकारी के लिए सूचनाएं प्राप्त करें',
    burmese:
      'အက်ပ်အပ်ဒိတ်များနှင့် အရေးကြီးသော အချက်အလက်များအတွက် အကြောင်းကြားချက်များ ရယူပါ',
    thai: 'รับการแจ้งเตือนสำหรับการอัปเดตแอปและข้อมูลสำคัญ',
    mandarin: '接收应用更新和重要信息的通知'
  },
  contentPreferences: {
    english: 'Content Preferences',
    spanish: 'Preferencias de contenido',
    brazilian_portuguese: 'Preferências de conteúdo',
    tok_pisin: 'Content Preferences',
    indonesian: 'Preferensi Konten',
    nepali: 'सामग्री प्राथमिकताहरू',
    hindi: 'सामग्री प्राथमिकताएं',
    burmese: 'အကြောင်းအရာ ဦးစားပေးများ',
    thai: 'การตั้งค่าสำหรับเนื้อหา',
    mandarin: '内容偏好设置'
  },
  showHiddenContent: {
    english: 'Show Hidden Content',
    spanish: 'Mostrar contenido oculto',
    brazilian_portuguese: 'Mostrar conteúdo oculto',
    tok_pisin: 'Soim Hait Content',
    indonesian: 'Tampilkan Konten Tersembunyi',
    nepali: 'लुकेको सामग्री देखाउनुहोस्',
    hindi: 'छुपी हुई सामग्री दिखाएं',
    burmese: 'ဝှက်ထားသော အကြောင်းအရာကို ပြပါ',
    thai: 'แสดงเนื้อหาที่ซ่อนอยู่',
    mandarin: '显示隐藏内容'
  },
  showHiddenContentDescription: {
    english: 'Allow displaying content that has been marked as invisible',
    spanish: 'Permitir mostrar contenido que ha sido marcado como invisible',
    brazilian_portuguese:
      'Permitir mostrar conteúdo que foi marcado como invisível',
    tok_pisin: 'Larim soim content we ol i makim hait',
    indonesian:
      'Izinkan menampilkan konten yang ditandai sebagai tidak terlihat',
    nepali: 'अदृश्य भनी चिन्ह लगाइएको सामग्री प्रदर्शन गर्न अनुमति दिनुहोस्',
    hindi: 'अदृश्य के रूप में चिह्नित सामग्री प्रदर्शित करने की अनुमति दें',
    burmese: 'မမြင်ရအောင် မှတ်သားထားသော အကြောင်းအရာကို ပြခွင့်ပြုပါ',
    thai: 'อนุญาตให้แสดงเนื้อหาที่ถูกทำเครื่องหมายว่าไม่สามารถมองเห็นได้',
    mandarin: '允许显示标记为不可见的内容'
  },
  dataAndStorage: {
    english: 'Data & Storage',
    spanish: 'Datos y almacenamiento',
    brazilian_portuguese: 'Dados e armazenamento',
    tok_pisin: 'Data na Storage',
    indonesian: 'Data & Penyimpanan',
    nepali: 'डाटा र भण्डारण',
    hindi: 'डेटा और भंडारण',
    burmese: 'ဒေတာနှင့် သိုလှောင်မှု',
    thai: 'ข้อมูลและการจัดเก็บ',
    mandarin: '数据和存储'
  },
  downloadOnWifiOnly: {
    english: 'Download on WiFi Only',
    spanish: 'Descargar solo en WiFi',
    brazilian_portuguese: 'Baixar apenas em WiFi',
    tok_pisin: 'Daunim long WiFi tasol',
    indonesian: 'Unduh hanya di WiFi',
    nepali: 'WiFi मा मात्र डाउनलोड गर्नुहोस्',
    hindi: 'केवल WiFi पर डाउनलोड करें',
    burmese: 'WiFi တွင်သာ ဒေါင်းလုဒ်လုပ်ပါ',
    thai: 'ดาวน์โหลดเฉพาะ WiFi เท่านั้น',
    mandarin: '仅在WiFi上下载'
  },
  downloadOnWifiOnlyDescription: {
    english: 'Only download content when connected to WiFi',
    spanish: 'Descargar contenido solo cuando esté conectado a WiFi',
    brazilian_portuguese:
      'Baixar conteúdo apenas quando estiver conectado à WiFi',
    tok_pisin: 'Daunim content taim yu joinim WiFi tasol',
    indonesian: 'Hanya unduh konten saat terhubung ke WiFi',
    nepali: 'WiFi मा जडान हुँदा मात्र सामग्री डाउनलोड गर्नुहोस्',
    hindi: 'WiFi से जुड़े होने पर ही सामग्री डाउनलोड करें',
    burmese: 'WiFi နှင့် ချိတ်ဆက်ထားသောအခါမှသာ အကြောင်းအရာကို ဒေါင်းလုဒ်လုပ်ပါ',
    thai: 'ดาวน์โหลดเนื้อหาเฉพาะเมื่อเชื่อมต่อกับ WiFi',
    mandarin: '仅在连接WiFi时下载内容'
  },
  autoBackup: {
    english: 'Auto Backup',
    spanish: 'Copia de seguridad automática',
    brazilian_portuguese: 'Backup automático',
    tok_pisin: 'Auto Backup',
    indonesian: 'Backup Otomatis',
    nepali: 'स्वत: ब्याकअप',
    hindi: 'स्वचालित बैकअप',
    burmese: 'အလိုအလျောက် ဘက်အပ်',
    thai: 'สำรองข้อมูลอัตโนมัติ',
    mandarin: '自动备份'
  },
  autoBackupDescription: {
    english: 'Automatically backup your data to the cloud',
    spanish: 'Hacer una copia de seguridad automática de tus datos en la nube',
    brazilian_portuguese: 'Fazer um backup automático dos seus dados na nuvem',
    tok_pisin: 'Otomatik backup data bilong yu long cloud',
    indonesian: 'Secara otomatis backup data Anda ke cloud',
    nepali: 'आफ्नो डाटा स्वचालित रूपमा क्लाउडमा ब्याकअप गर्नुहोस्',
    hindi: 'अपने डेटा को क्लाउड में स्वचालित रूप से बैकअप करें',
    burmese: 'သင်၏ဒေတာကို ကလောက်ဒ်သို့ အလိုအလျောက် ဘက်အပ်လုပ်ပါ',
    thai: 'สำรองข้อมูลของคุณไปยังคลาวด์โดยอัตโนมัติ',
    mandarin: '自动将您的数据备份到云端'
  },
  clearCacheDescription: {
    english: 'Clear all cached data to free up storage space',
    spanish:
      'Limpiar todos los datos en caché para liberar espacio de almacenamiento',
    brazilian_portuguese:
      'Limpar todos os dados em cache para liberar espaço de armazenamento',
    tok_pisin: 'Klinim olgeta cache data long mekim moa storage space',
    indonesian: 'Hapus semua data cache untuk mengosongkan ruang penyimpanan',
    nepali: 'भण्डारण ठाउँ खाली गर्न सबै क्यास डाटा खाली गर्नुहोस्',
    hindi: 'भंडारण स्थान खाली करने के लिए सभी कैश डेटा साफ करें',
    burmese: 'သိုလှောင်မှု နေရာလွတ်ရရန် ကက်ရှ်ထဲရှိ ဒေတာအားလုံးကို ရှင်းလင်းပါ',
    thai: 'ล้างข้อมูลแคชทั้งหมดเพื่อเพิ่มพื้นที่จัดเก็บ',
    mandarin: '清除所有缓存数据以释放存储空间'
  },
  exportData: {
    english: 'Export Data',
    spanish: 'Exportar datos',
    brazilian_portuguese: 'Exportar dados',
    tok_pisin: 'Export Data',
    indonesian: 'Ekspor Data',
    nepali: 'डाटा निर्यात गर्नुहोस्',
    hindi: 'डेटा निर्यात करें',
    burmese: 'ဒေတာ တင်ပို့ပါ',
    thai: 'ส่งออกข้อมูล',
    mandarin: '导出数据'
  },
  exportDataDescription: {
    english: 'Export your data for backup or transfer',
    spanish: 'Exportar tus datos para respaldo o transferencia',
    brazilian_portuguese: 'Exportar seus dados para backup ou transferência',
    tok_pisin: 'Export data bilong yu long backup o transfer',
    indonesian: 'Ekspor data Anda untuk backup atau transfer',
    nepali: 'ब्याकअप वा स्थानान्तरणको लागि आफ्नो डाटा निर्यात गर्नुहोस्',
    hindi: 'बैकअप या स्थानांतरण के लिए अपना डेटा निर्यात करें',
    burmese: 'ဘက်အပ်သို့မဟုတ် လွှဲပြောင်းရန်အတွက် သင်၏ဒေတာကို တင်ပို့ပါ',
    thai: 'ส่งออกข้อมูลของคุณเพื่อสำรองหรือถ่ายโอน',
    mandarin: '导出您的数据以进行备份或传输'
  },
  support: {
    english: 'Support',
    spanish: 'Soporte',
    brazilian_portuguese: 'Suporte',
    tok_pisin: 'Support',
    indonesian: 'Dukungan',
    nepali: 'सहायता',
    hindi: 'सहायता',
    burmese: 'အကူအညီ',
    thai: 'การสนับสนุน',
    mandarin: '支持'
  },
  helpCenter: {
    english: 'Help Center',
    spanish: 'Centro de ayuda',
    brazilian_portuguese: 'Centro de ajuda',
    tok_pisin: 'Help Center',
    indonesian: 'Pusat Bantuan',
    nepali: 'सहायता केन्द्र',
    hindi: 'सहायता केंद्र',
    burmese: 'အကူအညီစင်တာ',
    thai: 'ศูนย์ช่วยเหลือ',
    mandarin: '帮助中心'
  },
  helpCenterComingSoon: {
    english: 'Help center feature coming soon',
    spanish: 'El centro de ayuda está próximo',
    brazilian_portuguese: 'O centro de ajuda está próximo',
    tok_pisin: 'Help center feature i kam bihain',
    indonesian: 'Fitur pusat bantuan segera hadir',
    nepali: 'सहायता केन्द्र सुविधा छिट्टै आउँदैछ',
    hindi: 'सहायता केंद्र सुविधा जल्द ही आ रही है',
    burmese: 'အကူအညီစင်တာ အင်္ဂါရပ် မကြာမီ ရောက်ရှိလာမည်',
    thai: 'ฟีเจอร์ศูนย์ช่วยเหลือจะมาเร็วๆ นี้',
    mandarin: '帮助中心功能即将推出'
  },
  contactSupport: {
    english: 'Contact Support',
    spanish: 'Contactar soporte',
    brazilian_portuguese: 'Contatar suporte',
    tok_pisin: 'Contact Support',
    indonesian: 'Hubungi Dukungan',
    nepali: 'सहायतासँग सम्पर्क गर्नुहोस्',
    hindi: 'सहायता से संपर्क करें',
    burmese: 'အကူအညီကို ဆက်သွယ်ပါ',
    thai: 'ติดต่อฝ่ายสนับสนุน',
    mandarin: '联系支持'
  },
  contactSupportComingSoon: {
    english: 'Contact support feature coming soon',
    spanish: 'La función de contacto con el soporte está próxima',
    brazilian_portuguese:
      'A funcionalidade de contato com o suporte está próxima',
    tok_pisin: 'Contact support feature i kam bihain',
    indonesian: 'Fitur hubungi dukungan segera hadir',
    nepali: 'सहायतासँग सम्पर्क सुविधा छिट्टै आउँदैछ',
    hindi: 'सहायता से संपर्क सुविधा जल्द ही आ रही है',
    burmese: 'အကူအညီကို ဆက်သွယ်ခြင်း အင်္ဂါရပ် မကြာမီ ရောက်ရှိလာမည်',
    thai: 'ฟีเจอร์ติดต่อฝ่ายสนับสนุนจะมาเร็วๆ นี้',
    mandarin: '联系支持功能即将推出'
  },
  termsAndConditions: {
    english: 'Terms & Conditions',
    spanish: 'Términos y condiciones',
    brazilian_portuguese: 'Termos e condições',
    tok_pisin: 'Terms na Conditions',
    indonesian: 'Syarat & Ketentuan',
    nepali: 'नियम र सर्तहरू',
    hindi: 'नियम और शर्तें',
    burmese: 'စည်းမျဉ်းများနှင့် သတ်မှတ်ချက်များ',
    thai: 'ข้อกำหนดและเงื่อนไข',
    mandarin: '条款和条件'
  },
  termsAndConditionsComingSoon: {
    english: 'Terms & Conditions feature coming soon',
    spanish: 'La función de términos y condiciones está próxima',
    brazilian_portuguese: 'A funcionalidade de termos e condições está próxima',
    tok_pisin: 'Terms na Conditions feature i kam bihain',
    indonesian: 'Fitur Syarat & Ketentuan segera hadir',
    nepali: 'नियम र सर्तहरू सुविधा छिट्टै आउँदैछ',
    hindi: 'नियम और शर्तें सुविधा जल्द ही आ रही है',
    burmese:
      'စည်းမျဉ်းများနှင့် သတ်မှတ်ချက်များ အင်္ဂါရပ် မကြာမီ ရောက်ရှိလာမည်',
    thai: 'ฟีเจอร์ข้อกำหนดและเงื่อนไขจะมาเร็วๆ นี้',
    mandarin: '条款和条件功能即将推出'
  },
  experimentalFeatures: {
    english: 'Experimental Features',
    spanish: 'Características Experimentales',
    brazilian_portuguese: 'Recursos Experimentais',
    tok_pisin: 'Experimental Features',
    indonesian: 'Fitur Eksperimental',
    nepali: 'प्रयोगात्मक सुविधाहरू',
    hindi: 'प्रयोगात्मक सुविधाएं',
    burmese: 'စမ်းသပ်အင်္ဂါရပ်များ',
    thai: 'ฟีเจอร์ทดลอง',
    mandarin: '实验性功能'
  },
  aiSuggestions: {
    english: 'AI Suggestions',
    spanish: 'Sugerencias de IA',
    brazilian_portuguese: 'Sugestões de IA',
    tok_pisin: 'AI Suggestions',
    indonesian: 'Saran AI',
    nepali: 'एआई सुझावहरू',
    hindi: 'एआई सुझाव',
    burmese: 'AI အကြံပြုချက်များ',
    thai: 'คำแนะนำจาก AI',
    mandarin: 'AI建议'
  },
  aiSuggestionsDescription: {
    english:
      'Enable AI-powered translation suggestions based on nearby translations',
    spanish:
      'Habilitar sugerencias de traducción impulsadas por IA basadas en traducciones cercanas',
    brazilian_portuguese:
      'Habilitar sugestões de tradução com IA baseadas em traduções próximas',
    tok_pisin:
      'Onim AI translation suggestions i save helpim long ol translation klostu',
    indonesian:
      'Aktifkan saran terjemahan berbasis AI berdasarkan terjemahan terdekat',
    nepali:
      'नजिकका अनुवादहरूमा आधारित एआई-संचालित अनुवाद सुझावहरू सक्षम गर्नुहोस्',
    hindi: 'निकटवर्ती अनुवादों के आधार पर AI-संचालित अनुवाद सुझाव सक्षम करें',
    burmese:
      'အနီးအနားရှိ ဘာသာပြန်ဆိုချက်များအပေါ် အခြေခံ၍ AI-ပါဝင်သော ဘာသာပြန်ဆိုချက် အကြံပြုချက်များကို ဖွင့်ပါ',
    thai: 'เปิดใช้งานคำแนะนำการแปลที่ขับเคลื่อนด้วย AI ตามการแปลที่อยู่ใกล้เคียง',
    mandarin: '启用基于附近翻译的AI驱动翻译建议'
  },
  playAll: {
    english: 'Play All Assets',
    spanish: 'Reproducir Todos los Recursos',
    brazilian_portuguese: 'Reproduzir Todos os Recursos',
    tok_pisin: 'Playim Olgeta Assets',
    indonesian: 'Putar Semua Aset',
    nepali: 'सबै एसेटहरू प्ले गर्नुहोस्',
    hindi: 'सभी एसेट चलाएं',
    burmese: 'အရင်းအမြစ်အားလုံးကို ဖွင့်ပါ',
    thai: 'เล่นทรัพยากรทั้งหมด',
    mandarin: '播放所有资源'
  },
  playAllDescription: {
    english:
      'Enable the play all assets feature to play all audio assets in sequence',
    spanish:
      'Habilitar la función de reproducir todos los recursos para reproducir todos los recursos de audio en secuencia',
    brazilian_portuguese:
      'Habilitar a função de reproduzir todos os recursos para reproduzir todos os recursos de áudio em sequência',
    tok_pisin:
      'Onim play all assets feature long playim olgeta audio assets long wanpela taim',
    indonesian:
      'Aktifkan fitur putar semua aset untuk memutar semua aset audio secara berurutan',
    nepali:
      'सबै अडियो एसेटहरू क्रमशः प्ले गर्न सबै एसेटहरू प्ले गर्ने सुविधा सक्षम गर्नुहोस्',
    hindi:
      'सभी ऑडियो एसेट को क्रम में चलाने के लिए सभी एसेट चलाएं सुविधा सक्षम करें',
    burmese:
      'အသံအရင်းအမြစ်အားလုံးကို အစဉ်အတိုင်း ဖွင့်ရန် အရင်းအမြစ်အားလုံးကို ဖွင့်ခြင်း အင်္ဂါရပ်ကို ဖွင့်ပါ',
    thai: 'เปิดใช้งานฟีเจอร์เล่นทรัพยากรทั้งหมดเพื่อเล่นทรัพยากรเสียงทั้งหมดตามลำดับ',
    mandarin: '启用播放所有资源功能以按顺序播放所有音频资源'
  },
  advanced: {
    english: 'Advanced',
    spanish: 'Avanzado',
    brazilian_portuguese: 'Avançado',
    tok_pisin: 'Advanced',
    indonesian: 'Lanjutan',
    nepali: 'उन्नत',
    hindi: 'उन्नत',
    burmese: 'အဆင့်မြင့်',
    thai: 'ขั้นสูง',
    mandarin: '高级'
  },
  debugMode: {
    english: 'Debug Mode',
    spanish: 'Modo de depuración',
    brazilian_portuguese: 'Modo de depuração',
    tok_pisin: 'Debug Mode',
    indonesian: 'Mode Debug',
    nepali: 'डिबग मोड',
    hindi: 'डिबग मोड',
    burmese: 'ဒီဘတ်ခ်မုဒ်',
    thai: 'โหมดดีบัก',
    mandarin: '调试模式'
  },
  debugModeDescription: {
    english: 'Enable debug mode for development features',
    spanish: 'Habilitar modo de depuración para características de desarrollo',
    brazilian_portuguese:
      'Habilitar modo de depuração para funcionalidades de desenvolvimento',
    tok_pisin: 'Onim debug mode long development features',
    indonesian: 'Aktifkan mode debug untuk fitur pengembangan',
    nepali: 'विकास सुविधाहरूको लागि डिबग मोड सक्षम गर्नुहोस्',
    hindi: 'विकास सुविधाओं के लिए डिबग मोड सक्षम करें',
    burmese: 'ဖွံ့ဖြိုးတိုးတက်မှု အင်္ဂါရပ်များအတွက် ဒီဘတ်ခ်မုဒ်ကို ဖွင့်ပါ',
    thai: 'เปิดใช้งานโหมดดีบักสำหรับฟีเจอร์การพัฒนา',
    mandarin: '为开发功能启用调试模式'
  },
  settingsRequireInternet: {
    english: 'Some settings require an internet connection',
    spanish: 'Algunas configuraciones requieren una conexión a internet',
    brazilian_portuguese:
      'Algumas configurações requerem uma conexão com a internet',
    tok_pisin: 'Sampela settings i nidim internet connection',
    indonesian: 'Beberapa pengaturan memerlukan koneksi internet',
    nepali: 'केही सेटिङहरूलाई इन्टरनेट जडान आवश्यक छ',
    hindi: 'कुछ सेटिंग्स के लिए इंटरनेट कनेक्शन आवश्यक है',
    burmese: 'ဆက်တင်အချို့သည် အင်တာနက်ချိတ်ဆက်မှု လိုအပ်သည်',
    thai: 'การตั้งค่าบางอย่างต้องใช้การเชื่อมต่ออินเทอร์เน็ต',
    mandarin: '某些设置需要互联网连接'
  },
  internetConnectionRequired: {
    english: 'Internet connection required',
    spanish: 'Se requiere conexión a internet',
    brazilian_portuguese: 'Conexão com a internet necessária',
    tok_pisin: 'Internet connection i mas',
    indonesian: 'Koneksi internet diperlukan',
    nepali: 'इन्टरनेट जडान आवश्यक छ',
    hindi: 'इंटरनेट कनेक्शन आवश्यक है',
    burmese: 'အင်တာနက်ချိတ်ဆက်မှု လိုအပ်သည်',
    thai: 'ต้องใช้การเชื่อมต่ออินเทอร์เน็ต',
    mandarin: '需要互联网连接'
  },
  clear: {
    english: 'Clear',
    spanish: 'Limpiar',
    brazilian_portuguese: 'Limpar',
    tok_pisin: 'Klinim',
    indonesian: 'Hapus',
    nepali: 'खाली गर्नुहोस्',
    hindi: 'साफ करें',
    burmese: 'ရှင်းလင်းပါ',
    thai: 'ล้าง',
    mandarin: '清除'
  },
  unnamedAsset: {
    english: 'Unnamed Asset',
    spanish: 'Actividad sin nombre',
    brazilian_portuguese: 'Atividade sem nome',
    tok_pisin: 'Asset i no gat nem',
    indonesian: 'Asset Tanpa Nama',
    nepali: 'नाम नभएको एसेट',
    hindi: 'अनामित एसेट',
    burmese: 'အမည်မရှိသော အရင်းအမြစ်',
    thai: 'ทรัพยากรที่ไม่มีชื่อ',
    mandarin: '未命名资源'
  },
  noAssetSelected: {
    english: 'No Asset Selected',
    spanish: 'No hay actividades seleccionadas',
    brazilian_portuguese: 'Nenhuma atividade selecionada',
    tok_pisin: 'Yu no makim wanpela asset',
    indonesian: 'Tidak Ada Asset yang Dipilih',
    nepali: 'कुनै एसेट छानिएको छैन',
    hindi: 'कोई एसेट चयनित नहीं',
    burmese: 'အရင်းအမြစ် ရွေးချယ်ထားခြင်း မရှိပါ',
    thai: 'ไม่ได้เลือกทรัพยากร',
    mandarin: '未选择资源'
  },
  assetNotAvailableOffline: {
    english: 'Asset not available offline',
    spanish: 'La actividad no está disponible sin conexión',
    brazilian_portuguese: 'A atividade não está disponível offline',
    tok_pisin: 'Asset i no stap taim i no gat internet',
    indonesian: 'Asset tidak tersedia offline',
    nepali: 'एसेट अफलाइन उपलब्ध छैन',
    hindi: 'एसेट ऑफलाइन उपलब्ध नहीं है',
    burmese: 'အရင်းအမြစ်သည် အော့ဖ်လိုင်း ရရှိနိုင်မည်မဟုတ်ပါ',
    thai: 'ทรัพยากรไม่พร้อมใช้งานแบบออฟไลน์',
    mandarin: '资源离线不可用'
  },
  cloudError: {
    english: 'Cloud error: {error}',
    spanish: 'Error en la nube: {error}',
    brazilian_portuguese: 'Erro na nuvem: {error}',
    tok_pisin: 'Cloud error: {error}',
    indonesian: 'Kesalahan cloud: {error}',
    nepali: 'क्लाउड त्रुटि: {error}',
    hindi: 'क्लाउड त्रुटि: {error}',
    burmese: 'ကလောက်ဒ် အမှား: {error}',
    thai: 'ข้อผิดพลาดของคลาวด์: {error}',
    mandarin: '云错误: {error}'
  },
  assetNotFoundOnline: {
    english: 'Asset not found online',
    spanish: 'La actividad no se encontró en línea',
    brazilian_portuguese: 'A atividade não foi encontrada online',
    tok_pisin: 'Asset i no stap long internet',
    indonesian: 'Asset tidak ditemukan online',
    nepali: 'एसेट अनलाइन फेला परेन',
    hindi: 'एसेट ऑनलाइन नहीं मिला',
    burmese: 'အရင်းအမြစ်ကို အွန်လိုင်းတွင် မတွေ့ရှိပါ',
    thai: 'ไม่พบทรัพยากรออนไลน์',
    mandarin: '在线未找到资源'
  },
  trySwitchingToCloudDataSource: {
    english: 'Try switching to Cloud data source above',
    spanish: 'Intenta cambiar a la fuente de datos en la nube',
    brazilian_portuguese: 'Tente mudar para a fonte de dados na nuvem',
    tok_pisin: 'Traim senisim long Cloud data source antap',
    indonesian: 'Coba beralih ke sumber data Cloud di atas',
    nepali: 'माथि क्लाउड डाटा स्रोतमा स्विच गर्ने प्रयास गर्नुहोस्',
    hindi: 'ऊपर क्लाउड डेटा स्रोत पर स्विच करने का प्रयास करें',
    burmese: 'အထက်ရှိ ကလောက်ဒ် ဒေတာ အရင်းအမြစ်သို့ ပြောင်းရန် ကြိုးစားပါ',
    thai: 'ลองเปลี่ยนไปใช้แหล่งข้อมูลคลาวด์ด้านบน',
    mandarin: '尝试切换到上方的云数据源'
  },
  trySwitchingToOfflineDataSource: {
    english: 'Try switching to Offline data source above',
    spanish: 'Intenta cambiar a la fuente de datos sin conexión',
    brazilian_portuguese: 'Tente mudar para a fonte de datos offline',
    tok_pisin: 'Traim senisim long Offline data source antap',
    indonesian: 'Coba beralih ke sumber data Offline di atas',
    nepali: 'माथि अफलाइन डाटा स्रोतमा स्विच गर्ने प्रयास गर्नुहोस्',
    hindi: 'ऊपर ऑफलाइन डेटा स्रोत पर स्विच करने का प्रयास करें',
    burmese: 'အထက်ရှိ အော့ဖ်လိုင်း ဒေတာ အရင်းအမြစ်သို့ ပြောင်းရန် ကြိုးစားပါ',
    thai: 'ลองเปลี่ยนไปใช้แหล่งข้อมูลออฟไลน์ด้านบน',
    mandarin: '尝试切换到上方的离线数据源'
  },
  assetMayNotBeSynchronized: {
    english: 'This asset may not be synchronized or may not exist',
    spanish: 'Esta actividad puede no estar sincronizada o puede no existir',
    brazilian_portuguese:
      'Esta atividade pode não estar sincronizada ou pode não existir',
    tok_pisin: 'Dispela asset i no sync o i no stap',
    indonesian: 'Asset ini mungkin tidak tersinkronisasi atau tidak ada',
    nepali: 'यो एसेट सिंक्रोनाइज नभएको वा अवस्थित नहुन सक्छ',
    hindi: 'यह एसेट सिंक्रनाइज़ नहीं हो सकता है या मौजूद नहीं हो सकता है',
    burmese: 'ဤအရင်းအမြစ်သည် စင့်ချရန်မလိုအပ်သော သို့မဟုတ် မရှိနိုင်ပါ',
    thai: 'ทรัพยากรนี้อาจไม่ได้ซิงค์หรืออาจไม่มีอยู่',
    mandarin: '此资源可能未同步或可能不存在'
  },
  noContentAvailable: {
    english: 'No content available',
    spanish: 'No hay contenido disponible',
    brazilian_portuguese: 'Nenhum conteúdo disponível',
    tok_pisin: 'I no gat content',
    indonesian: 'Tidak ada konten tersedia',
    nepali: 'कुनै सामग्री उपलब्ध छैन',
    hindi: 'कोई सामग्री उपलब्ध नहीं है',
    burmese: 'အကြောင်းအရာ မရရှိနိုင်ပါ',
    thai: 'ไม่มีเนื้อหา',
    mandarin: '无可用内容'
  },
  audioReady: {
    english: 'Audio ready',
    spanish: 'Audio listo',
    brazilian_portuguese: 'Áudio pronto',
    tok_pisin: 'Audio i redi',
    indonesian: 'Audio siap',
    nepali: 'अडियो तयार छ',
    hindi: 'ऑडियो तैयार',
    burmese: 'အသံ အဆင်သင့်ဖြစ်ပါပြီ',
    thai: 'เสียงพร้อม',
    mandarin: '音频就绪'
  },
  audioNotAvailable: {
    english: 'Audio not available',
    spanish: 'Audio no disponible',
    brazilian_portuguese: 'Áudio não disponível',
    tok_pisin: 'Audio i no stap',
    indonesian: 'Audio tidak tersedia',
    nepali: 'अडियो उपलब्ध छैन',
    hindi: 'ऑडियो उपलब्ध नहीं है',
    burmese: 'အသံ မရရှိနိုင်ပါ',
    thai: 'เสียงไม่พร้อมใช้งาน',
    mandarin: '音频不可用'
  },
  imagesAvailable: {
    english: 'Images available',
    spanish: 'Imágenes disponibles',
    brazilian_portuguese: 'Imagens disponíveis',
    tok_pisin: 'Ol piksa i stap',
    indonesian: 'Gambar tersedia',
    nepali: 'तस्बिरहरू उपलब्ध छन्',
    hindi: 'छवियां उपलब्ध हैं',
    burmese: 'ရုပ်ပုံများ ရရှိနိုင်ပါသည်',
    thai: 'มีรูปภาพ',
    mandarin: '图像可用'
  },
  language: {
    english: 'Language',
    spanish: 'Idioma',
    brazilian_portuguese: 'Idioma',
    tok_pisin: 'Tokples',
    indonesian: 'Bahasa',
    nepali: 'भाषा',
    hindi: 'भाषा',
    burmese: 'ဘာသာစကား',
    thai: 'ภาษา',
    mandarin: '语言'
  },
  template: {
    english: 'Template',
    spanish: 'Plantilla',
    brazilian_portuguese: 'Plantilla',
    tok_pisin: 'Template',
    indonesian: 'Template',
    nepali: 'टेम्प्लेट',
    hindi: 'टेम्प्लेट',
    burmese: 'ပုံစံ',
    thai: 'เทมเพลต',
    mandarin: '模板'
  },
  // template options
  bible: {
    english: 'Bible',
    spanish: 'Biblia',
    brazilian_portuguese: 'Bíblia',
    tok_pisin: 'Bible',
    indonesian: 'Alkitab',
    nepali: 'बाइबल',
    hindi: 'बाइबल',
    burmese: 'သမ္မာကျမ်းစာ',
    thai: 'พระคัมภีร์',
    mandarin: '圣经'
  },
  unstructured: {
    english: 'Unstructured',
    spanish: 'No estructurado',
    brazilian_portuguese: 'Não estruturado',
    tok_pisin: 'Unstructured',
    indonesian: 'Tidak terstruktur',
    nepali: 'संरचना नभएको',
    hindi: 'असंरचित',
    burmese: 'ဖွဲ့စည်းမှု မရှိသော',
    thai: 'ไม่มีโครงสร้าง',
    mandarin: '非结构化'
  },
  audioTracks: {
    english: 'Audio tracks',
    spanish: 'Pistas de audio',
    brazilian_portuguese: 'Pistas de áudio',
    tok_pisin: 'Ol audio track',
    indonesian: 'Trek audio',
    nepali: 'अडियो ट्र्याकहरू',
    hindi: 'ऑडियो ट्रैक',
    burmese: 'အသံထွက်လမ်းကြောင်းများ',
    thai: 'แทร็กเสียง',
    mandarin: '音频轨道'
  },
  membersOnly: {
    english: 'Members Only',
    spanish: 'Solo para miembros',
    brazilian_portuguese: 'Só para membros',
    tok_pisin: 'Member tasol',
    indonesian: 'Khusus Anggota',
    nepali: 'सदस्यहरूको लागि मात्र',
    hindi: 'केवल सदस्य',
    burmese: 'အဖွဲ့ဝင်များသာ',
    thai: 'สมาชิกเท่านั้น',
    mandarin: '仅限成员'
  },
  cloud: {
    english: 'Cloud',
    spanish: 'Nube',
    brazilian_portuguese: 'Nuvem',
    tok_pisin: 'Cloud',
    indonesian: 'Cloud',
    nepali: 'क्लाउड',
    hindi: 'क्लाउड',
    burmese: 'Cloud',
    thai: 'คลาวด์',
    mandarin: '云端'
  },
  syncing: {
    english: 'Syncing',
    spanish: 'Sincronizando',
    brazilian_portuguese: 'Sincronizando',
    tok_pisin: 'I sync',
    indonesian: 'Sinkronisasi',
    nepali: 'सिङ्क गर्दै',
    hindi: 'सिंक हो रहा है',
    burmese: 'အင်ချိန်နေသည်',
    thai: 'กำลังซิงค์',
    mandarin: '正在同步'
  },
  synced: {
    english: 'Synced',
    spanish: 'Sincronizado',
    brazilian_portuguese: 'Sincronizado',
    tok_pisin: 'Sync pinis',
    indonesian: 'Tersinkronisasi',
    nepali: 'सिङ्क भयो',
    hindi: 'सिंक हो गया',
    burmese: 'အင်ချိန်ပြီးပြီ',
    thai: 'ซิงค์แล้ว',
    mandarin: '已同步'
  },
  questSyncedToCloud: {
    english: 'Quest is synced to cloud',
    spanish: 'La misión está sincronizada en la nube',
    brazilian_portuguese: 'A missão está sincronizada na nuvem',
    tok_pisin: 'Quest i sync pinis long cloud',
    indonesian: 'Quest telah disinkronkan ke cloud',
    nepali: 'क्वेस्ट क्लाउडमा सिङ्क भएको छ',
    hindi: 'क्वेस्ट क्लाउड में सिंक हो गया है',
    burmese: 'Quest သည် cloud သို့ အင်ချိန်ပြီးပြီ',
    thai: 'เควสต์ถูกซิงค์ไปยังคลาวด์แล้ว',
    mandarin: '任务已同步到云端'
  },
  failed: {
    english: 'Failed',
    spanish: 'Fallado',
    brazilian_portuguese: 'Falhado',
    tok_pisin: 'I pail',
    indonesian: 'Gagal',
    nepali: 'असफल भयो',
    hindi: 'असफल',
    burmese: 'ကျရှုံးသည်',
    thai: 'ล้มเหลว',
    mandarin: '失败'
  },
  state: {
    english: 'State',
    spanish: 'Estado',
    brazilian_portuguese: 'Estado',
    tok_pisin: 'State',
    indonesian: 'Status',
    nepali: 'अवस्था',
    hindi: 'अवस्था',
    burmese: 'အခြေအနေ',
    thai: 'สถานะ',
    mandarin: '状态'
  },
  noQuestSelected: {
    english: 'No Quest Selected',
    spanish: 'No hay proyecto seleccionado',
    brazilian_portuguese: 'Nenhum projeto selecionado',
    tok_pisin: 'Yu no makim wanpela quest',
    indonesian: 'Tidak Ada Quest yang Dipilih',
    nepali: 'कुनै क्वेस्ट छानिएको छैन',
    hindi: 'कोई क्वेस्ट चयनित नहीं',
    burmese: 'Quest ကို မရွေးချယ်ထားပါ',
    thai: 'ไม่ได้เลือกเควสต์',
    mandarin: '未选择任务'
  },
  liveAttachmentStates: {
    english: 'Live Attachment States',
    spanish: 'Estados de adjuntos en vivo',
    brazilian_portuguese: 'Estados de anexos em tempo real',
    tok_pisin: 'Live Attachment States',
    indonesian: 'Status Lampiran Langsung',
    nepali: 'प्रत्यक्ष संलग्नक अवस्थाहरू',
    hindi: 'लाइव संलग्नक अवस्थाएं',
    burmese: 'တိုက်ရိုက်ပူးတွဲအခြေအနေများ',
    thai: 'สถานะไฟล์แนบแบบสด',
    mandarin: '实时附件状态'
  },
  searching: {
    english: 'Searching',
    spanish: 'Buscando',
    brazilian_portuguese: 'Buscando',
    tok_pisin: 'I painim',
    indonesian: 'Mencari',
    nepali: 'खोज्दै',
    hindi: 'खोज रहे हैं',
    burmese: 'ရှာဖွေနေသည်',
    thai: 'กำลังค้นหา',
    mandarin: '正在搜索'
  },
  translationSubmittedSuccessfully: {
    english: 'Translation submitted successfully',
    spanish: 'Traducción enviada correctamente',
    brazilian_portuguese: 'Tradução enviada com sucesso',
    tok_pisin: 'Translation i go gut pinis',
    indonesian: 'Terjemahan berhasil dikirim',
    nepali: 'अनुवाद सफलतापूर्वक पेश गरियो',
    hindi: 'अनुवाद सफलतापूर्वक सबमिट किया गया',
    burmese: 'ဘာသာပြန်ချက်ကို အောင်မြင်စွာ တင်သွင်းပြီးပြီ',
    thai: 'ส่งคำแปลสำเร็จแล้ว',
    mandarin: '翻译提交成功'
  },
  transcriptionSubmittedSuccessfully: {
    english: 'Transcription submitted successfully',
    spanish: 'Transcripción enviada correctamente',
    brazilian_portuguese: 'Transcrição enviada com sucesso',
    tok_pisin: 'Transcription i go gut pinis',
    indonesian: 'Transkripsi berhasil dikirim',
    nepali: 'ट्रान्सक्रिप्सन सफलतापूर्वक पेश गरियो',
    hindi: 'ट्रांसक्रिप्शन सफलतापूर्वक जमा हो गया',
    burmese: 'စာလုံးပေါင်းကို အောင်မြင်စွာ တင်မြှောက်ပြီးပါပြီ',
    thai: 'ส่งการถอดความสำเร็จแล้ว',
    mandarin: '转录已成功提交'
  },
  text: {
    english: 'Text',
    spanish: 'Texto',
    brazilian_portuguese: 'Texto',
    tok_pisin: 'Text',
    indonesian: 'Teks',
    nepali: 'पाठ',
    hindi: 'पाठ',
    burmese: 'စာသား',
    thai: 'ข้อความ',
    mandarin: '文本'
  },
  audio: {
    english: 'Audio',
    spanish: 'Audio',
    brazilian_portuguese: 'Áudio',
    tok_pisin: 'Audio',
    indonesian: 'Audio',
    nepali: 'अडियो',
    hindi: 'ऑडियो',
    burmese: 'အသံ',
    thai: 'เสียง',
    mandarin: '音频'
  },
  targetLanguage: {
    english: 'Target Language',
    spanish: 'Idioma de destino',
    brazilian_portuguese: 'Idioma de destino',
    tok_pisin: 'Target Tokples',
    indonesian: 'Bahasa Target',
    nepali: 'लक्षित भाषा',
    hindi: 'लक्ष्य भाषा',
    burmese: 'ပစ်မှတ်ဘာသာစကား',
    thai: 'ภาษาปลายทาง',
    mandarin: '目标语言'
  },
  sourceLanguage: {
    english: 'Source Language',
    spanish: 'Idioma de origen',
    brazilian_portuguese: 'Idioma de origem',
    tok_pisin: 'Source Tokples',
    indonesian: 'Bahasa Sumber',
    nepali: 'स्रोत भाषा',
    hindi: 'स्रोत भाषा',
    burmese: 'အရင်းအမြစ်ဘာသာစကား',
    thai: 'ภาษาต้นทาง',
    mandarin: '源语言'
  },
  your: {
    english: 'Your',
    spanish: 'Tu',
    brazilian_portuguese: 'Seu',
    tok_pisin: 'Bilong yu',
    indonesian: 'Anda',
    nepali: 'तपाईंको',
    hindi: 'आपका',
    burmese: 'သင်၏',
    thai: 'ของคุณ',
    mandarin: '您的'
  },
  translation: {
    english: 'Translation',
    spanish: 'Traducción',
    brazilian_portuguese: 'Tradução',
    tok_pisin: 'Translation',
    indonesian: 'Terjemahan',
    nepali: 'अनुवाद',
    hindi: 'अनुवाद',
    burmese: 'ဘာသာပြန်ဆိုချက်',
    thai: 'การแปล',
    mandarin: '翻译'
  },
  readyToSubmit: {
    english: 'Ready to submit',
    spanish: 'Listo para enviar',
    brazilian_portuguese: 'Pronto para enviar',
    tok_pisin: 'Redi long salim',
    indonesian: 'Siap untuk dikirim',
    nepali: 'पेश गर्न तयार',
    hindi: 'जमा करने के लिए तैयार',
    burmese: 'တင်မြှောက်ရန် အဆင်သင့်',
    thai: 'พร้อมส่ง',
    mandarin: '准备提交'
  },
  online: {
    english: 'Online',
    spanish: 'En línea',
    brazilian_portuguese: 'Online',
    tok_pisin: 'Online',
    indonesian: 'Online',
    nepali: 'अनलाइन',
    hindi: 'ऑनलाइन',
    burmese: 'အွန်လိုင်း',
    thai: 'ออนไลน์',
    mandarin: '在线'
  },
  allProjects: {
    english: 'All Projects',
    spanish: 'Todos los proyectos',
    brazilian_portuguese: 'Todos os projetos',
    tok_pisin: 'Olgeta Project',
    indonesian: 'Semua Proyek',
    nepali: 'सबै प्रोजेक्टहरू',
    hindi: 'सभी परियोजनाएं',
    burmese: 'စီမံကိန်းအားလုံး',
    thai: 'โครงการทั้งหมด',
    mandarin: '所有项目'
  },
  searchProjects: {
    english: 'Search projects...',
    spanish: 'Buscar proyectos...',
    brazilian_portuguese: 'Buscar projetos...',
    tok_pisin: 'Painim ol project...',
    indonesian: 'Cari proyek...',
    nepali: 'प्रोजेक्टहरू खोज्नुहोस्...',
    hindi: 'परियोजनाएं खोजें...',
    burmese: 'စီမံကိန်းများ ရှာပါ...',
    thai: 'ค้นหาโครงการ...',
    mandarin: '搜索项目...'
  },
  noProjectSelected: {
    english: 'No Project Selected',
    spanish: 'No hay proyecto seleccionado',
    brazilian_portuguese: 'Nenhum projeto selecionado',
    tok_pisin: 'Yu no makim wanpela project',
    indonesian: 'Tidak Ada Proyek yang Dipilih',
    nepali: 'कुनै प्रोजेक्ट छानिएको छैन',
    hindi: 'कोई परियोजना चयनित नहीं',
    burmese: 'စီမံကိန်း ရွေးချယ်ထားခြင်း မရှိပါ',
    thai: 'ไม่ได้เลือกโครงการ',
    mandarin: '未选择项目'
  },
  noQuestsFound: {
    english: 'No quests found',
    spanish: 'No se encontraron misiones',
    brazilian_portuguese: 'Nenhuma missão encontrada',
    tok_pisin: 'I no gat quest',
    indonesian: 'Tidak ada quest ditemukan',
    nepali: 'कुनै क्वेस्ट फेला परेन',
    hindi: 'कोई क्वेस्ट नहीं मिली',
    burmese: 'ခရီးစဉ် မတွေ့ရှိပါ',
    thai: 'ไม่พบภารกิจ',
    mandarin: '未找到任务'
  },
  noQuestsAvailable: {
    english: 'No quests available',
    spanish: 'No hay misiones disponibles',
    brazilian_portuguese: 'Nenhuma missão disponível',
    tok_pisin: 'I no gat quest long usim',
    indonesian: 'Tidak ada quest tersedia',
    nepali: 'कुनै क्वेस्ट उपलब्ध छैन',
    hindi: 'कोई क्वेस्ट उपलब्ध नहीं',
    burmese: 'ခရီးစဉ် မရှိပါ',
    thai: 'ไม่มีภารกิจ',
    mandarin: '没有可用的任务'
  },
  pleaseLogInToVote: {
    english: 'Please log in to vote',
    spanish: 'Por favor, inicia sesión para votar',
    brazilian_portuguese: 'Por favor, faça login para votar',
    tok_pisin: 'Plis login pastaim long vote',
    indonesian: 'Silakan login untuk memilih',
    nepali: 'कृपया मतदान गर्न लग इन गर्नुहोस्',
    hindi: 'कृपया मतदान करने के लिए लॉग इन करें',
    burmese: 'မဲပေးရန် ကျေးဇူးပြု၍ လော့ဂ်အင်လုပ်ပါ',
    thai: 'กรุณาเข้าสู่ระบบเพื่อลงคะแนน',
    mandarin: '请登录以投票'
  },
  pleaseLogInToTranscribe: {
    english: 'Please log in to transcribe audio',
    spanish: 'Por favor, inicia sesión para transcribir audio',
    brazilian_portuguese: 'Por favor, faça login para transcrever áudio',
    tok_pisin: 'Plis login pastaim long transcribe audio',
    indonesian: 'Silakan login untuk mentranskripsi audio',
    nepali: 'कृपया अडियो ट्रान्सक्राइब गर्न लग इन गर्नुहोस्',
    hindi: 'कृपया ऑडियो ट्रांसक्राइब करने के लिए लॉग इन करें',
    burmese: 'အသံ ရေးမှတ်ရန် ကျေးဇူးပြု၍ လော့ဂ်အင်လုပ်ပါ',
    thai: 'กรุณาเข้าสู่ระบบเพื่อถอดความเสียง',
    mandarin: '请登录以转录音频'
  },
  transcriptionFailed: {
    english: 'Failed to transcribe audio. Please try again.',
    spanish: 'Error al transcribir el audio. Por favor, inténtelo de nuevo.',
    brazilian_portuguese:
      'Falha ao transcrever áudio. Por favor, tente novamente.',
    tok_pisin: 'I no inap transcribe audio. Plis traim gen.',
    indonesian: 'Gagal mentranskripsi audio. Silakan coba lagi.',
    nepali: 'अडियो ट्रान्सक्राइब गर्न असफल। कृपया पुन: प्रयास गर्नुहोस्।',
    hindi: 'ऑडियो ट्रांसक्राइब करने में विफल। कृपया पुनः प्रयास करें।',
    burmese: 'အသံ ရေးမှတ်ရန် မအောင်မြင်ပါ။ ကျေးဇူးပြု၍ ထပ်မံကြိုးစားပါ။',
    thai: 'ถอดความเสียงไม่สำเร็จ กรุณาลองอีกครั้ง',
    mandarin: '转录音频失败。请重试。'
  },
  yourTranscriptionHasBeenSubmitted: {
    english: 'Your transcription has been submitted',
    spanish: 'Tu transcripción ha sido enviada',
    brazilian_portuguese: 'Sua transcrição foi enviada',
    tok_pisin: 'Transcription bilong yu i go pinis',
    indonesian: 'Transkripsi Anda telah dikirim',
    nepali: 'तपाईंको ट्रान्सक्रिप्शन पेश गरिएको छ',
    hindi: 'आपका ट्रांसक्रिप्शन जमा कर दिया गया है',
    burmese: 'သင်၏ စာလုံးပေါင်းကို တင်မြှောက်ပြီးပါပြီ',
    thai: 'การถอดความของคุณถูกส่งแล้ว',
    mandarin: '您的转录已提交'
  },
  failedToCreateTranscription: {
    english: 'Failed to create transcription',
    spanish: 'Error al crear la transcripción',
    brazilian_portuguese: 'Falha ao criar a transcrição',
    tok_pisin: 'I no inap mekim transcription',
    indonesian: 'Gagal membuat transkripsi',
    nepali: 'ट्रान्सक्रिप्शन सिर्जना गर्न असफल',
    hindi: 'ट्रांसक्रिप्शन बनाने में विफल',
    burmese: 'စာလုံးပေါင်း ဖန်တီးရန် မအောင်မြင်ပါ',
    thai: 'สร้างการถอดความไม่สำเร็จ',
    mandarin: '创建转录失败'
  },
  enterYourTranscription: {
    english: 'Enter your transcription',
    spanish: 'Escribe tu transcripción',
    brazilian_portuguese: 'Digite sua transcrição',
    tok_pisin: 'Raitim transcription bilong yu',
    indonesian: 'Masukkan transkripsi Anda',
    nepali: 'आफ्नो ट्रान्सक्रिप्शन प्रविष्ट गर्नुहोस्',
    hindi: 'अपना ट्रांसक्रिप्शन दर्ज करें',
    burmese: 'သင်၏ စာလုံးပေါင်းကို ထည့်သွင်းပါ',
    thai: 'ป้อนการถอดความของคุณ',
    mandarin: '输入您的转录'
  },
  submitTranscription: {
    english: 'Submit Transcription',
    spanish: 'Enviar transcripción',
    brazilian_portuguese: 'Enviar transcrição',
    tok_pisin: 'Salim Transcription',
    indonesian: 'Kirim Transkripsi',
    nepali: 'ट्रान्सक्रिप्शन पेश गर्नुहोस्',
    hindi: 'ट्रांसक्रिप्शन जमा करें',
    burmese: 'စာလုံးပေါင်း တင်မြှောက်ပါ',
    thai: 'ส่งการถอดความ',
    mandarin: '提交转录'
  },
  good: {
    english: 'Good',
    spanish: 'Bueno',
    brazilian_portuguese: 'Bom',
    tok_pisin: 'Gut',
    indonesian: 'Bagus',
    nepali: 'राम्रो',
    hindi: 'अच्छा',
    burmese: 'ကောင်းပါသည်',
    thai: 'ดี',
    mandarin: '好'
  },
  needsWork: {
    english: 'Needs Work',
    spanish: 'Necesita trabajo',
    brazilian_portuguese: 'Precisa de trabalho',
    tok_pisin: 'I nidim wok moa',
    indonesian: 'Perlu Perbaikan',
    nepali: 'सुधार चाहिन्छ',
    hindi: 'सुधार की आवश्यकता',
    burmese: 'ပြင်ဆင်ရန် လိုအပ်သည်',
    thai: 'ต้องปรับปรุง',
    mandarin: '需要改进'
  },
  pleaseLogInToVoteOnTranslations: {
    english: 'Please log in to vote on translations',
    spanish: 'Por favor, inicia sesión para votar en traducciones',
    brazilian_portuguese: 'Por favor, faça login para votar em traduções',
    tok_pisin: 'Plis login pastaim long vote long ol translation',
    indonesian: 'Silakan login untuk memilih terjemahan',
    nepali: 'कृपया अनुवादहरूमा मतदान गर्न लग इन गर्नुहोस्',
    hindi: 'कृपया अनुवादों पर मतदान करने के लिए लॉग इन करें',
    burmese: 'ဘာသာပြန်ဆိုချက်များတွင် မဲပေးရန် ကျေးဇူးပြု၍ လော့ဂ်အင်လုပ်ပါ',
    thai: 'กรุณาเข้าสู่ระบบเพื่อลงคะแนนการแปล',
    mandarin: '请登录以对翻译投票'
  },
  translationNotFound: {
    english: 'Translation not found',
    spanish: 'Traducción no encontrada',
    brazilian_portuguese: 'Tradução não encontrada',
    tok_pisin: 'Translation i no stap',
    indonesian: 'Terjemahan tidak ditemukan',
    nepali: 'अनुवाद फेला परेन',
    hindi: 'अनुवाद नहीं मिला',
    burmese: 'ဘာသာပြန်ဆိုချက် မတွေ့ရှိပါ',
    thai: 'ไม่พบการแปล',
    mandarin: '未找到翻译'
  },
  noTranslationsYet: {
    english: 'No translations yet. Be the first to translate!',
    spanish: 'No hay traducciones aún. Sé el primero en traducir!',
    brazilian_portuguese: 'Nenhuma tradução ainda. Seja o primeiro a traduzir!',
    tok_pisin: 'I no gat translation yet. Yu ken namba wan long translate!',
    indonesian: 'Belum ada terjemahan. Jadilah yang pertama menerjemahkan!',
    nepali: 'अहिलेसम्म कुनै अनुवाद छैन। पहिलो अनुवादक बन्नुहोस्!',
    hindi: 'अभी तक कोई अनुवाद नहीं। पहले अनुवादक बनें!',
    burmese: 'အခုထိ ဘာသာပြန်ဆိုချက် မရှိသေးပါ။ ပထမဆုံး ဘာသာပြန်သူ ဖြစ်ပါ!',
    thai: 'ยังไม่มีการแปล เป็นคนแรกที่แปล!',
    mandarin: '还没有翻译。成为第一个翻译者！'
  },
  viewProjectLimitedAccess: {
    english: 'View Project (Limited Access)',
    spanish: 'Ver proyecto (Acceso limitado)',
    brazilian_portuguese: 'Ver projeto (Acesso limitado)',
    tok_pisin: 'Lukim Project (Limited Access)',
    indonesian: 'Lihat Proyek (Akses Terbatas)',
    nepali: 'प्रोजेक्ट हेर्नुहोस् (सीमित पहुँच)',
    hindi: 'परियोजना देखें (सीमित पहुंच)',
    burmese: 'စီမံကိန်းကို ကြည့်ပါ (ကန့်သတ်ချက်ဖြင့် ဝင်ရောက်ခွင့်)',
    thai: 'ดูโครงการ (การเข้าถึงจำกัด)',
    mandarin: '查看项目（受限访问）'
  },
  languages: {
    english: 'Languages',
    spanish: 'Idiomas',
    brazilian_portuguese: 'Idiomas',
    tok_pisin: 'Ol Tokples',
    indonesian: 'Bahasa',
    nepali: 'भाषाहरू',
    hindi: 'भाषाएं',
    burmese: 'ဘာသာစကားများ',
    thai: 'ภาษา',
    mandarin: '语言'
  },
  downloadRequired: {
    english: 'Download required',
    spanish: 'Descarga requerida',
    brazilian_portuguese: 'Download requerido',
    tok_pisin: 'Yu mas daunim',
    indonesian: 'Unduhan diperlukan',
    nepali: 'डाउनलोड आवश्यक छ',
    hindi: 'डाउनलोड आवश्यक',
    burmese: 'ဒေါင်းလုဒ်လုပ်ရန် လိုအပ်သည်',
    thai: 'ต้องดาวน์โหลด',
    mandarin: '需要下载'
  },
  myProjects: {
    english: 'My Projects',
    spanish: 'Mis proyectos',
    brazilian_portuguese: 'Meus projetos',
    tok_pisin: 'Ol Project Bilong Mi',
    indonesian: 'Proyek Saya',
    nepali: 'मेरा प्रोजेक्टहरू',
    hindi: 'मेरी परियोजनाएं',
    burmese: 'ကျွန်ုပ်၏ စီမံကိန်းများ',
    thai: 'โครงการของฉัน',
    mandarin: '我的项目'
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
    indonesian:
      'Terjemahan ini saat ini aktif. Terjemahan aktif juga terlihat.',
    nepali: 'यो अनुवाद हाल सक्रिय छ। सक्रिय अनुवाद पनि दृश्यमान छ।',
    hindi: 'यह अनुवाद वर्तमान में सक्रिय है। सक्रिय अनुवाद दृश्यमान भी है।',
    burmese:
      'ဤဘာသာပြန်ဆိုချက်သည် လက်ရှိတွင် အသက်ဝင်နေသည်။ အသက်ဝင်သော ဘာသာပြန်ဆိုချက်သည်လည်း မြင်နိုင်သည်။',
    thai: 'การแปลนี้กำลังใช้งานอยู่ การแปลที่ใช้งานอยู่จะมองเห็นได้ด้วย',
    mandarin: '此翻译当前处于活动状态。活动翻译也可见。'
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
      'Terjemahan ini tidak aktif. Tidak ada tindakan yang dapat dilakukan kecuali diaktifkan kembali.',
    nepali:
      'यो अनुवाद निष्क्रिय छ। पुन: सक्रिय नगरेसम्म कुनै कार्य गर्न सकिँदैन।',
    hindi:
      'यह अनुवाद निष्क्रिय है। पुनः सक्रिय किए बिना कोई कार्रवाई नहीं की जा सकती।',
    burmese:
      'ဤဘာသာပြန်ဆိုချက်သည် အသက်မဝင်ပါ။ ပြန်လည်အသက်သွင်းမသည်အထိ မည်သည့်လုပ်ဆောင်ချက်မျှ မပြုလုပ်နိုင်ပါ။',
    thai: 'การแปลนี้ไม่ใช้งาน ไม่สามารถดำเนินการใดๆ ได้เว้นแต่จะเปิดใช้งานอีกครั้ง',
    mandarin: '此翻译处于非活动状态。除非重新激活，否则无法执行任何操作。'
  },
  statusTranslationVisible: {
    english: 'This translation is visible to other users.',
    spanish: 'Esta traducción es visible para otros usuarios.',
    brazilian_portuguese: 'Esta tradução está visível para outros usuários.',
    tok_pisin: 'Dispela translation i save long ol narapela user.',
    indonesian: 'Terjemahan ini terlihat oleh pengguna lain.',
    nepali: 'यो अनुवाद अन्य प्रयोगकर्ताहरूलाई देखिन्छ।',
    hindi: 'यह अनुवाद अन्य उपयोगकर्ताओं को दिखाई देता है।',
    burmese: 'ဤဘာသာပြန်ဆိုချက်ကို အခြားအသုံးပြုသူများ မြင်နိုင်သည်။',
    thai: 'การแปลนี้มองเห็นได้โดยผู้ใช้อื่น',
    mandarin: '此翻译对其他用户可见。'
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
      'Terjemahan ini disembunyikan dan tidak akan ditampilkan kepada pengguna lain. Terjemahan yang tidak terlihat juga tidak aktif.',
    nepali:
      'यो अनुवाद लुकाइएको छ र अन्य प्रयोगकर्ताहरूलाई देखाइने छैन। अदृश्य अनुवाद पनि निष्क्रिय छ।',
    hindi:
      'यह अनुवाद छिपा हुआ है और अन्य उपयोगकर्ताओं को नहीं दिखाया जाएगा। अदृश्य अनुवाद भी निष्क्रिय है।',
    burmese:
      'ဤဘာသာပြန်ဆိုချက်ကို ဖျောက်ထားပြီး အခြားအသုံးပြုသူများကို မပြသပါ။ မမြင်ရသော ဘာသာပြန်ဆိုချက်သည်လည်း အသက်မဝင်ပါ။',
    thai: 'การแปลนี้ถูกซ่อนและจะไม่แสดงให้ผู้ใช้อื่นเห็น การแปลที่มองไม่เห็นจะไม่ใช้งานด้วย',
    mandarin: '此翻译已隐藏，不会向其他用户显示。不可见翻译也处于非活动状态。'
  },
  statusTranslationMadeVisible: {
    english: 'The translation has been made visible',
    spanish: 'La traducción se ha hecho visible',
    brazilian_portuguese: 'A tradução foi tornada visível',
    tok_pisin: 'Translation i mekim save nau',
    indonesian: 'Terjemahan telah dibuat terlihat',
    nepali: 'अनुवाद दृश्यमान बनाइएको छ',
    hindi: 'अनुवाद दृश्यमान बना दिया गया है',
    burmese: 'ဘာသာပြန်ဆိုချက်ကို မြင်နိုင်အောင် ပြုလုပ်ပြီးပါပြီ',
    thai: 'การแปลถูกทำให้มองเห็นได้',
    mandarin: '翻译已设为可见'
  },
  statusTranslationMadeInvisible: {
    english: 'The translation has been made invisible',
    spanish: 'La traducción se ha hecho invisible',
    brazilian_portuguese: 'A tradução foi tornada invisível',
    tok_pisin: 'Translation i mekim hait nau',
    indonesian: 'Terjemahan telah dibuat tidak terlihat',
    nepali: 'अनुवाद अदृश्य बनाइएको छ',
    hindi: 'अनुवाद अदृश्य बना दिया गया है',
    burmese: 'ဘာသာပြန်ဆိုချက်ကို မမြင်ရအောင် ပြုလုပ်ပြီးပါပြီ',
    thai: 'การแปลถูกทำให้มองไม่เห็น',
    mandarin: '翻译已设为不可见'
  },
  statusTranslationMadeActive: {
    english: 'The translation has been made active',
    spanish: 'La traducción se ha activado',
    brazilian_portuguese: 'A tradução foi ativada',
    tok_pisin: 'Translation i mekim active nau',
    indonesian: 'Terjemahan telah diaktifkan',
    nepali: 'अनुवाद सक्रिय बनाइएको छ',
    hindi: 'अनुवाद सक्रिय बना दिया गया है',
    burmese: 'ဘာသာပြန်ဆိုချက်ကို အသက်သွင်းပြီးပါပြီ',
    thai: 'การแปลถูกทำให้ใช้งาน',
    mandarin: '翻译已设为活动'
  },
  statusTranslationMadeInactive: {
    english: 'The translation has been made inactive',
    spanish: 'La traducción ha sido desactivada',
    brazilian_portuguese: 'A tradução foi desativada',
    tok_pisin: 'Translation i mekim stop nau',
    indonesian: 'Terjemahan telah dinonaktifkan',
    nepali: 'अनुवाद निष्क्रिय बनाइएको छ',
    hindi: 'अनुवाद निष्क्रिय बना दिया गया है',
    burmese: 'ဘာသာပြန်ဆိုချက်ကို အသက်မဝင်အောင် ပြုလုပ်ပြီးပါပြီ',
    thai: 'การแปลถูกทำให้ไม่ใช้งาน',
    mandarin: '翻译已设为非活动'
  },
  statusTranslationUpdateFailed: {
    english: 'Failed to update translation settings',
    spanish: 'Error al actualizar la configuración de la traducción',
    brazilian_portuguese: 'Falha ao atualizar as configurações da tradução',
    tok_pisin: 'I no inap update translation settings',
    indonesian: 'Gagal mengupdate pengaturan terjemahan',
    nepali: 'अनुवाद सेटिङहरू अपडेट गर्न असफल',
    hindi: 'अनुवाद सेटिंग अपडेट करने में विफल',
    burmese: 'ဘာသာပြန်ဆိုချက် ဆက်တင်များကို မွမ်းမံရန် မအောင်မြင်ပါ',
    thai: 'อัปเดตการตั้งค่าการแปลไม่สำเร็จ',
    mandarin: '更新翻译设置失败'
  },
  translationSettingsLoadError: {
    english: 'Error loading translation settings.',
    spanish: 'Error al cargar la configuración de traducción.',
    brazilian_portuguese: 'Erro ao carregar as configurações de tradução.',
    tok_pisin: 'I no inap load translation settings.',
    indonesian: 'Gagal memuat pengaturan terjemahan.',
    nepali: 'अनुवाद सेटिङहरू लोड गर्दा त्रुटि।',
    hindi: 'अनुवाद सेटिंग लोड करने में त्रुटि।',
    burmese: 'ဘာသာပြန်ဆိုချက် ဆက်တင်များကို လုပ်ဆောင်ရာတွင် အမှားတက်ခဲ့သည်။',
    thai: 'เกิดข้อผิดพลาดในการโหลดการตั้งค่าการแปล',
    mandarin: '加载翻译设置时出错。'
  },
  contentText: {
    english: 'Content Text',
    spanish: 'Texto del Contenido',
    brazilian_portuguese: 'Texto do Conteúdo',
    tok_pisin: 'Content Text',
    indonesian: 'Teks Konten',
    nepali: 'सामग्री पाठ',
    hindi: 'सामग्री पाठ',
    burmese: 'အကြောင်းအရာ စာသား',
    thai: 'ข้อความเนื้อหา',
    mandarin: '内容文本'
  },
  enterContentText: {
    english: 'Enter content text...',
    spanish: 'Ingrese el texto del contenido...',
    brazilian_portuguese: 'Digite o texto do conteúdo...',
    tok_pisin: 'Putim content text...',
    indonesian: 'Masukkan teks konten...',
    nepali: 'सामग्री पाठ प्रविष्ट गर्नुहोस्...',
    hindi: 'सामग्री पाठ दर्ज करें...',
    burmese: 'အကြောင်းအရာ စာသားကို ထည့်သွင်းပါ...',
    thai: 'ป้อนข้อความเนื้อหา...',
    mandarin: '输入内容文本...'
  },
  saving: {
    english: 'Saving...',
    spanish: 'Guardando...',
    brazilian_portuguese: 'Salvando...',
    tok_pisin: 'Seivim...',
    indonesian: 'Menyimpan...',
    nepali: 'सुरक्षित गर्दै...',
    hindi: 'सहेज रहा है...',
    burmese: 'သိမ်းဆည်းနေသည်...',
    thai: 'กำลังบันทึก...',
    mandarin: '保存中...'
  },
  localAssetEditHint: {
    english: 'This asset is local only. Text can be edited until published.',
    spanish:
      'Este recurso es solo local. El texto se puede editar hasta que se publique.',
    brazilian_portuguese:
      'Este recurso é apenas local. O texto pode ser editado até ser publicado.',
    tok_pisin:
      'Dispela asset i local tasol. Yu ken senisim text inap yu publishim.',
    indonesian:
      'Aset ini hanya lokal. Teks dapat diedit hingga dipublikasikan.',
    nepali:
      'यो एसेट स्थानीय मात्र छ। प्रकाशित नभएसम्म पाठ सम्पादन गर्न सकिन्छ।',
    hindi:
      'यह एसेट केवल स्थानीय है। प्रकाशित होने तक पाठ संपादित किया जा सकता है।',
    burmese:
      'ဤပိုင်ဆိုင်မှုသည် ဒေသခံသာဖြစ်သည်။ ထုတ်ဝေမချင်းစာသားကို တည်းဖြတ်နိုင်သည်။',
    thai: 'สินทรัพย์นี้เป็นแบบท้องถิ่นเท่านั้น สามารถแก้ไขข้อความได้จนกว่าจะเผยแพร่',
    mandarin: '此资产仅为本地。在发布之前可以编辑文本。'
  },
  requests: {
    english: 'Requests',
    spanish: 'Solicitudes',
    brazilian_portuguese: 'Solicitações',
    tok_pisin: 'Ol askim',
    indonesian: 'Permintaan',
    nepali: 'अनुरोधहरू',
    hindi: 'अनुरोध',
    burmese: 'တောင်းဆိုမှုများ',
    thai: 'คำขอ',
    mandarin: '请求'
  },
  noPendingRequests: {
    english: 'No pending membership requests',
    spanish: 'No hay solicitudes de membresía pendientes',
    brazilian_portuguese: 'Sem solicitações de adesão pendentes',
    tok_pisin: 'I no gat askim i stap',
    indonesian: 'Tidak ada permintaan keanggotaan tertunda',
    nepali: 'कुनै बाँकी सदस्यता अनुरोध छैन',
    hindi: 'कोई लंबित सदस्यता अनुरोध नहीं',
    burmese: 'ဆိုင်းငံ့ထားသော အဖွဲ့ဝင်တောင်းဆိုမှု မရှိပါ',
    thai: 'ไม่มีคำขอเป็นสมาชิกที่รอดำเนินการ',
    mandarin: '没有待处理的成员资格请求'
  },
  confirmApprove: {
    english: 'Approve Request',
    spanish: 'Aprobar Solicitud',
    brazilian_portuguese: 'Aprovar Solicitação',
    tok_pisin: 'Orait long askim',
    indonesian: 'Setujui Permintaan',
    nepali: 'अनुरोध स्वीकृत गर्नुहोस्',
    hindi: 'अनुरोध स्वीकृत करें',
    burmese: 'တောင်းဆိုမှုကို အတည်ပြုပါ',
    thai: 'อนุมัติคำขอ',
    mandarin: '批准请求'
  },
  confirmApproveMessage: {
    english: 'Add {name} as a member of this project?',
    spanish: '¿Agregar a {name} como miembro de este proyecto?',
    brazilian_portuguese: 'Adicionar {name} como membro deste projeto?',
    tok_pisin: 'Putim {name} i kamap memba bilong projek?',
    indonesian: 'Tambahkan {name} sebagai anggota proyek ini?',
    nepali: '{name} लाई यो प्रोजेक्टको सदस्यको रूपमा थप्ने?',
    hindi: '{name} को इस परियोजना का सदस्य के रूप में जोड़ें?',
    burmese: '{name} ကို ဤစီမံကိန်း၏ အဖွဲ့ဝင်အဖြစ် ထည့်မလား?',
    thai: 'เพิ่ม {name} เป็นสมาชิกของโครงการนี้?',
    mandarin: '将 {name} 添加为此项目的成员？'
  },
  requestApproved: {
    english: 'Request approved',
    spanish: 'Solicitud aprobada',
    brazilian_portuguese: 'Solicitação aprovada',
    tok_pisin: 'Askim i orait',
    indonesian: 'Permintaan disetujui',
    nepali: 'अनुरोध स्वीकृत भयो',
    hindi: 'अनुरोध स्वीकृत हो गया',
    burmese: 'တောင်းဆိုမှုကို အတည်ပြုပြီးပါပြီ',
    thai: 'อนุมัติคำขอแล้ว',
    mandarin: '请求已批准'
  },
  confirmDeny: {
    english: 'Deny Request',
    spanish: 'Rechazar Solicitud',
    brazilian_portuguese: 'Negar Solicitação',
    tok_pisin: 'Tambu askim',
    indonesian: 'Tolak Permintaan',
    nepali: 'अनुरोध अस्वीकार गर्नुहोस्',
    hindi: 'अनुरोध अस्वीकार करें',
    burmese: 'တောင်းဆိုမှုကို ငြင်းပယ်ပါ',
    thai: 'ปฏิเสธคำขอ',
    mandarin: '拒绝请求'
  },
  confirmDenyMessage: {
    english: 'Deny membership request from {name}?',
    spanish: '¿Rechazar solicitud de membresía de {name}?',
    brazilian_portuguese: 'Negar solicitação de adesão de {name}?',
    tok_pisin: 'Tambu askim bilong {name}?',
    indonesian: 'Tolak permintaan keanggotaan dari {name}?',
    nepali: '{name} बाट सदस्यता अनुरोध अस्वीकार गर्ने?',
    hindi: '{name} से सदस्यता अनुरोध अस्वीकार करें?',
    burmese: '{name} ထံမှ အဖွဲ့ဝင်တောင်းဆိုမှုကို ငြင်းပယ်မလား?',
    thai: 'ปฏิเสธคำขอเป็นสมาชิกจาก {name}?',
    mandarin: '拒绝 {name} 的成员资格请求？'
  },
  requestDenied: {
    english: 'Request denied',
    spanish: 'Solicitud rechazada',
    brazilian_portuguese: 'Solicitação negada',
    tok_pisin: 'Askim i tambu',
    indonesian: 'Permintaan ditolak',
    nepali: 'अनुरोध अस्वीकृत भयो',
    hindi: 'अनुरोध अस्वीकृत हो गया',
    burmese: 'တောင်းဆိုမှုကို ငြင်းပယ်ပြီးပါပြီ',
    thai: 'ปฏิเสธคำขอแล้ว',
    mandarin: '请求已拒绝'
  },
  failedToApproveRequest: {
    english: 'Failed to approve request',
    spanish: 'Error al aprobar solicitud',
    brazilian_portuguese: 'Falha ao aprovar solicitação',
    tok_pisin: 'Askim i no inap orait',
    indonesian: 'Gagal menyetujui permintaan',
    nepali: 'अनुरोध स्वीकृत गर्न असफल',
    hindi: 'अनुरोध स्वीकृत करने में विफल',
    burmese: 'တောင်းဆိုမှုကို အတည်ပြုရန် မအောင်မြင်ပါ',
    thai: 'อนุมัติคำขอไม่สำเร็จ',
    mandarin: '批准请求失败'
  },
  failedToDenyRequest: {
    english: 'Failed to deny request',
    spanish: 'Error al rechazar solicitud',
    brazilian_portuguese: 'Falha ao negar solicitação',
    tok_pisin: 'Askim i no inap tambu',
    indonesian: 'Gagal menolak permintaan',
    nepali: 'अनुरोध अस्वीकार गर्न असफल',
    hindi: 'अनुरोध अस्वीकार करने में विफल',
    burmese: 'တောင်းဆိုမှုကို ငြင်းပယ်ရန် မအောင်မြင်ပါ',
    thai: 'ปฏิเสธคำขอไม่สำเร็จ',
    mandarin: '拒绝请求失败'
  },
  downloadQuestToView: {
    english: 'This quest must be downloaded before you can view it.',
    spanish: 'Este quest debe descargarse antes de poder verlo.',
    brazilian_portuguese: 'Esta quest deve ser baixada antes de visualizá-la.',
    tok_pisin: 'Yu mas daunim dispela quest pastaim long lukim.',
    indonesian: 'Quest ini harus diunduh sebelum Anda dapat melihatnya.',
    nepali: 'यो क्वेस्ट हेर्नु अघि डाउनलोड गर्नुपर्छ।',
    hindi: 'इस क्वेस्ट को देखने से पहले इसे डाउनलोड करना होगा।',
    burmese: 'ဤခရီးစဉ်ကို ကြည့်ရှုမီ ဒေါင်းလုဒ်လုပ်ရပါမည်။',
    thai: 'ต้องดาวน์โหลดภารกิจนี้ก่อนจึงจะดูได้',
    mandarin: '在查看此任务之前必须先下载。'
  },
  downloadNow: {
    english: 'Download Now',
    spanish: 'Descargar Ahora',
    brazilian_portuguese: 'Baixar Agora',
    tok_pisin: 'Daunim nau',
    indonesian: 'Unduh Sekarang',
    nepali: 'अहिले डाउनलोड गर्नुहोस्',
    hindi: 'अभी डाउनलोड करें',
    burmese: 'ယခု ဒေါင်းလုဒ်လုပ်ပါ',
    thai: 'ดาวน์โหลดตอนนี้',
    mandarin: '立即下载'
  },
  vadTitle: {
    english: 'Voice Activity',
    spanish: 'Actividad de Voz',
    brazilian_portuguese: 'Atividade de Voz',
    tok_pisin: 'Wok bilong vois',
    indonesian: 'Aktivitas Suara',
    nepali: 'आवाज गतिविधि',
    hindi: 'ध्वनि गतिविधि',
    burmese: 'အသံ လှုပ်ရှားမှု',
    thai: 'กิจกรรมเสียง',
    mandarin: '语音活动'
  },
  vadDescription: {
    english: 'Records automatically when you speak',
    spanish: 'Graba automáticamente cuando hablas',
    brazilian_portuguese: 'Grava automaticamente quando você fala',
    tok_pisin: 'Em i save record pastaim taim yu toktok',
    indonesian: 'Merekam otomatis saat Anda berbicara',
    nepali: 'तपाईं बोल्दा स्वचालित रूपमा रेकर्ड गर्छ',
    hindi: 'जब आप बोलते हैं तो स्वचालित रूप से रिकॉर्ड करता है',
    burmese: 'သင် စကားပြောသောအခါ အလိုအလျောက် မှတ်တမ်းတင်သည်',
    thai: 'บันทึกอัตโนมัติเมื่อคุณพูด',
    mandarin: '说话时自动录音'
  },
  vadCurrentLevel: {
    english: 'Current Level',
    spanish: 'Nivel Actual',
    brazilian_portuguese: 'Nível Atual',
    tok_pisin: 'Level nau',
    indonesian: 'Level Saat Ini',
    nepali: 'हालको स्तर',
    hindi: 'वर्तमान स्तर',
    burmese: 'လက်ရှိ အဆင့်',
    thai: 'ระดับปัจจุบัน',
    mandarin: '当前级别'
  },
  vadRecordingNow: {
    english: 'Recording',
    spanish: 'Grabando',
    brazilian_portuguese: 'Gravando',
    tok_pisin: 'I save nau',
    indonesian: 'Merekam',
    nepali: 'रेकर्ड गर्दै',
    hindi: 'रिकॉर्ड हो रहा है',
    burmese: 'မှတ်တမ်းတင်နေသည်',
    thai: 'กำลังบันทึก',
    mandarin: '录音中'
  },
  vadWaiting: {
    english: 'Waiting',
    spanish: 'Esperando',
    brazilian_portuguese: 'Aguardando',
    tok_pisin: 'Wetim',
    indonesian: 'Menunggu',
    nepali: 'पर्खँदै',
    hindi: 'प्रतीक्षा कर रहा है',
    burmese: 'စောင့်နေသည်',
    thai: 'กำลังรอ',
    mandarin: '等待中'
  },
  vadPaused: {
    english: 'Paused',
    spanish: 'Pausado',
    brazilian_portuguese: 'Pausado',
    tok_pisin: 'I stop liklik',
    indonesian: 'Dijeda',
    nepali: 'रोकिएको',
    hindi: 'रुका हुआ',
    burmese: 'ရပ်ထားသည်',
    thai: 'หยุดชั่วคราว',
    mandarin: '已暂停'
  },
  vadThreshold: {
    english: 'Sensitivity',
    spanish: 'Sensibilidad',
    brazilian_portuguese: 'Sensibilidade',
    tok_pisin: 'Strong bilong harim',
    indonesian: 'Sensitivitas',
    nepali: 'संवेदनशीलता',
    hindi: 'संवेदनशीलता',
    burmese: 'အာရုံခံနိုင်မှု',
    thai: 'ความไว',
    mandarin: '灵敏度'
  },
  vadSilenceDuration: {
    english: 'Pause Length',
    spanish: 'Duración de Pausa',
    brazilian_portuguese: 'Duração da Pausa',
    tok_pisin: 'Taim bilong pas',
    indonesian: 'Durasi Jeda',
    nepali: 'रोकाइको लम्बाइ',
    hindi: 'विराम की अवधि',
    burmese: 'ရပ်နားချိန် ကြာချိန်',
    thai: 'ความยาวการหยุด',
    mandarin: '暂停时长'
  },
  vadSilenceDescription: {
    english: 'How much silence is needed to determine segment boundaries.',
    spanish:
      'Cuánto silencio se necesita para determinar los límites del segmento.',
    brazilian_portuguese:
      'Quanto silêncio é necessário para determinar os limites do segmento.',
    tok_pisin: 'Hamas taim i no gat nois bilong katim toktok.',
    indonesian:
      'Berapa lama keheningan yang diperlukan untuk menentukan batas segmen.',
    nepali: 'खण्ड सीमाहरू निर्धारण गर्न कति मौनता आवश्यक छ।',
    hindi: 'खंड सीमाएं निर्धारित करने के लिए कितनी चुप्पी आवश्यक है।',
    burmese: 'အပိုင်းအခြားများ သတ်မှတ်ရန် ဘယ်လောက် တိတ်ဆိတ်မှု လိုအပ်သည်။',
    thai: 'ต้องมีความเงียบเท่าใดเพื่อกำหนดขอบเขตของส่วน',
    mandarin: '确定片段边界需要多少静音。'
  },
  vadMinSegmentLength: {
    english: 'Minimum Segment Length',
    spanish: 'Longitud Mínima de Segmento',
    brazilian_portuguese: 'Comprimento Mínimo do Segmento',
    tok_pisin: 'Liklik Taim Inap Bilong Toktok',
    indonesian: 'Panjang Segmen Minimum',
    nepali: 'न्यूनतम खण्ड लम्बाइ',
    hindi: 'न्यूनतम खंड लंबाई',
    burmese: 'အနည်းဆုံး အပိုင်း ကြာချိန်',
    thai: 'ความยาวส่วนขั้นต่ำ',
    mandarin: '最短片段长度'
  },
  vadMinSegmentLengthDescription: {
    english: 'Discard segments below this duration (filter brief noises)',
    spanish:
      'Descartar segmentos por debajo de esta duración (filtrar ruidos breves)',
    brazilian_portuguese:
      'Descartar segmentos abaixo desta duração (filtrar ruídos breves)',
    tok_pisin: 'Rausim sotpela rekoding (filta liklik pairap)',
    indonesian: 'Buang segmen di bawah durasi ini (filter suara singkat)',
    nepali:
      'यो अवधिभन्दा कम खण्डहरू त्याग्नुहोस् (छोटो आवाजहरू फिल्टर गर्नुहोस्)',
    hindi: 'इस अवधि से कम खंडों को त्यागें (संक्षिप्त आवाज़ों को फ़िल्टर करें)',
    burmese:
      'ဤကြာချိန်ထက် နည်းသော အပိုင်းများကို ပယ်ပါ (တိုတောင်းသော အသံများကို စစ်ထုတ်ပါ)',
    thai: 'ทิ้งส่วนที่สั้นกว่าระยะเวลานี้ (กรองเสียงสั้นๆ)',
    mandarin: '丢弃短于此时长的片段（过滤短暂噪音）'
  },
  vadNoFilter: {
    english: 'No filter',
    spanish: 'Sin filtro',
    brazilian_portuguese: 'Sem filtro',
    tok_pisin: 'No filta',
    indonesian: 'Tanpa filter',
    nepali: 'कुनै फिल्टर छैन',
    hindi: 'कोई फ़िल्टर नहीं',
    burmese: 'စစ်ထုတ်မှု မရှိပါ',
    thai: 'ไม่กรอง',
    mandarin: '无过滤'
  },
  vadLightFilter: {
    english: 'Light filter',
    spanish: 'Filtro ligero',
    brazilian_portuguese: 'Filtro leve',
    tok_pisin: 'Liklik filta',
    indonesian: 'Filter ringan',
    nepali: 'हल्का फिल्टर',
    hindi: 'हल्का फ़िल्टर',
    burmese: 'အပျော့စား စစ်ထုတ်မှု',
    thai: 'กรองเบา',
    mandarin: '轻度过滤'
  },
  vadMediumFilter: {
    english: 'Medium filter',
    spanish: 'Filtro medio',
    brazilian_portuguese: 'Filtro médio',
    tok_pisin: 'Namel filta',
    indonesian: 'Filter sedang',
    nepali: 'मध्यम फिल्टर',
    hindi: 'मध्यम फ़िल्टर',
    burmese: 'အလယ်အလတ် စစ်ထုတ်မှု',
    thai: 'กรองปานกลาง',
    mandarin: '中度过滤'
  },
  vadStrongFilter: {
    english: 'Strong filter',
    spanish: 'Filtro fuerte',
    brazilian_portuguese: 'Filtro forte',
    tok_pisin: 'Strongpela filta',
    indonesian: 'Filter kuat',
    nepali: 'बलियो फिल्टर',
    hindi: 'मजबूत फ़िल्टर',
    burmese: 'ပြင်းထန်သော စစ်ထုတ်မှု',
    thai: 'กรองแรง',
    mandarin: '强力过滤'
  },
  vadSensitive: {
    english: 'Sensitive',
    spanish: 'Sensible',
    brazilian_portuguese: 'Sensível',
    tok_pisin: 'I harim gut',
    indonesian: 'Sensitif',
    nepali: 'संवेदनशील',
    hindi: 'संवेदनशील',
    burmese: 'အာရုံခံနိုင်သည်',
    thai: 'ไว',
    mandarin: '敏感'
  },
  vadNormal: {
    english: 'Normal',
    spanish: 'Normal',
    brazilian_portuguese: 'Normal',
    tok_pisin: 'Nambawan',
    indonesian: 'Normal',
    nepali: 'सामान्य',
    hindi: 'सामान्य',
    burmese: 'ပုံမှန်',
    thai: 'ปกติ',
    mandarin: '普通'
  },
  vadLoud: {
    english: 'Loud',
    spanish: 'Alto',
    brazilian_portuguese: 'Alto',
    tok_pisin: 'Bikpela nois',
    indonesian: 'Keras',
    nepali: 'चर्को',
    hindi: 'तेज़',
    burmese: 'ကျယ်လောင်သည်',
    thai: 'ดัง',
    mandarin: '响亮'
  },
  vadVerySensitive: {
    english: 'Very Sensitive',
    spanish: 'Muy Sensible',
    brazilian_portuguese: 'Muito Sensível',
    tok_pisin: 'I harim tumas',
    indonesian: 'Sangat Sensitif',
    nepali: 'अत्यन्त संवेदनशील',
    hindi: 'बहुत संवेदनशील',
    burmese: 'အလွန်အာရုံခံနိုင်သည်',
    thai: 'ไวมาก',
    mandarin: '非常敏感'
  },
  vadLoudOnly: {
    english: 'Loud Only',
    spanish: 'Solo Alto',
    brazilian_portuguese: 'Apenas Alto',
    tok_pisin: 'Bikpela nois tasol',
    indonesian: 'Keras Saja',
    nepali: 'चर्को मात्र',
    hindi: 'केवल तेज़',
    burmese: 'ကျယ်လောင်သောအသံသာ',
    thai: 'ดังเท่านั้น',
    mandarin: '仅响亮'
  },
  vadVeryLoud: {
    english: 'Very Loud',
    spanish: 'Muy Alto',
    brazilian_portuguese: 'Muito Alto',
    tok_pisin: 'Bikpela nois tumas',
    indonesian: 'Sangat Keras',
    nepali: 'अत्यन्त चर्को',
    hindi: 'बहुत तेज़',
    burmese: 'အလွန်ကျယ်လောင်သည်',
    thai: 'ดังมาก',
    mandarin: '非常响亮'
  },
  vadQuickSegments: {
    english: 'Quick',
    spanish: 'Rápido',
    brazilian_portuguese: 'Rápido',
    tok_pisin: 'Kwik',
    indonesian: 'Cepat',
    nepali: 'छिटो',
    hindi: 'तेज़',
    burmese: 'မြန်သည်',
    thai: 'เร็ว',
    mandarin: '快速'
  },
  vadBalanced: {
    english: 'Balanced',
    spanish: 'Equilibrado',
    brazilian_portuguese: 'Equilibrado',
    tok_pisin: 'Naispela',
    indonesian: 'Seimbang',
    nepali: 'सन्तुलित',
    hindi: 'संतुलित',
    burmese: 'ချိန်ခွင်လျှာ',
    thai: 'สมดุล',
    mandarin: '平衡'
  },
  vadCompleteThoughts: {
    english: 'Complete',
    spanish: 'Completo',
    brazilian_portuguese: 'Completo',
    tok_pisin: 'Olgeta',
    indonesian: 'Lengkap',
    nepali: 'पूर्ण',
    hindi: 'पूर्ण',
    burmese: 'ပြည့်စုံသည်',
    thai: 'สมบูรณ์',
    mandarin: '完整'
  },
  vadDisplayMode: {
    english: 'Display Mode',
    spanish: 'Modo de Visualización',
    brazilian_portuguese: 'Modo de Exibição',
    tok_pisin: 'Kaim bilong lukim',
    indonesian: 'Mode Tampilan',
    nepali: 'प्रदर्शन मोड',
    hindi: 'प्रदर्शन मोड',
    burmese: 'ပြသမှု မုဒ်',
    thai: 'โหมดแสดงผล',
    mandarin: '显示模式'
  },
  vadFullScreen: {
    english: 'Full Screen',
    spanish: 'Pantalla Completa',
    brazilian_portuguese: 'Tela Cheia',
    tok_pisin: 'Fulap skrin',
    indonesian: 'Layar Penuh',
    nepali: 'पूर्ण स्क्रिन',
    hindi: 'पूर्ण स्क्रीन',
    burmese: 'ဖန်သားပြင် အပြည့်',
    thai: 'เต็มจอ',
    mandarin: '全屏'
  },
  vadFooter: {
    english: 'Footer',
    spanish: 'Pie de Página',
    brazilian_portuguese: 'Rodapé',
    tok_pisin: 'Asdaun',
    indonesian: 'Footer',
    nepali: 'फुटर',
    hindi: 'फुटर',
    burmese: 'အောက်ခြေ',
    thai: 'ส่วนท้าย',
    mandarin: '页脚'
  },
  vadDisplayDescription: {
    english: 'Choose how the waveform appears when recording',
    spanish: 'Elige cómo aparece la forma de onda al grabar',
    brazilian_portuguese: 'Escolha como a forma de onda aparece ao gravar',
    tok_pisin: 'Makim olsem wanem wevpom i kamap taim yu save record',
    indonesian: 'Pilih bagaimana bentuk gelombang muncul saat merekam',
    nepali: 'रेकर्डिङ गर्दा तरंग कसरी देखा पर्छ छान्नुहोस्',
    hindi: 'रिकॉर्डिंग करते समय तरंग कैसे दिखे यह चुनें',
    burmese: 'မှတ်တမ်းတင်နေစဉ် လှိုင်းပုံစံ မည်သို့ပေါ်မည်ကို ရွေးပါ',
    thai: 'เลือกวิธีแสดงคลื่นเสียงเมื่อบันทึก',
    mandarin: '选择录音时波形的显示方式'
  },
  vadStop: {
    english: 'Stop Recording',
    spanish: 'Detener Grabación',
    brazilian_portuguese: 'Parar Gravação',
    tok_pisin: 'Stopim rekod',
    indonesian: 'Berhenti Merekam',
    nepali: 'रेकर्डिङ रोक्नुहोस्',
    hindi: 'रिकॉर्डिंग रोकें',
    burmese: 'မှတ်တမ်းတင်ခြင်း ရပ်ပါ',
    thai: 'หยุดการบันทึก',
    mandarin: '停止录音'
  },
  vadHelpTitle: {
    english: 'How It Works',
    spanish: 'Cómo Funciona',
    brazilian_portuguese: 'Como Funciona',
    tok_pisin: 'Olsem wanem em i wok',
    indonesian: 'Cara Kerja',
    nepali: 'यो कसरी काम गर्छ',
    hindi: 'यह कैसे काम करता है',
    burmese: 'အလုပ်လုပ်ပုံ',
    thai: 'วิธีการทำงาน',
    mandarin: '工作原理'
  },
  vadHelpAutomatic: {
    english:
      'When sound is detected a segment will automatically start recording. After some silence the segment will be saved. You may record multiple segments like this in sequence while recording is activated.',
    spanish:
      'Cuando se detecta sonido, un segmento comenzará a grabarse automáticamente. Después de un silencio, el segmento se guardará. Puedes grabar múltiples segmentos así en secuencia mientras la grabación está activada.',
    brazilian_portuguese:
      'Quando som é detectado, um segmento começará a gravar automaticamente. Após um silêncio, o segmento será salvo. Você pode gravar múltiplos segmentos assim em sequência enquanto a gravação está ativada.',
    tok_pisin:
      'Taim masin i harim nois, em bai stat long rekodim. Bihain long taim i no gat nois, em bai sevim. Yu ken rekodim planti taim olsem wanwan taim rekod i op.',
    indonesian:
      'Saat suara terdeteksi, segmen akan mulai merekam secara otomatis. Setelah keheningan, segmen akan disimpan. Anda dapat merekam beberapa segmen seperti ini secara berurutan saat perekaman diaktifkan.',
    nepali:
      'जब आवाज पत्ता लाग्छ एक खण्ड स्वचालित रूपमा रेकर्डिङ सुरु हुनेछ। केही मौनता पछि खण्ड सेभ हुनेछ। रेकर्डिङ सक्रिय हुँदा तपाईं यसरी क्रमशः धेरै खण्डहरू रेकर्ड गर्न सक्नुहुन्छ।',
    hindi:
      'जब ध्वनि का पता चलता है तो एक सेगमेंट स्वचालित रूप से रिकॉर्डिंग शुरू होगा। कुछ चुप्पी के बाद सेगमेंट सहेजा जाएगा। रिकॉर्डिंग सक्रिय होने पर आप इस तरह क्रम में कई सेगमेंट रिकॉर्ड कर सकते हैं।',
    burmese:
      'အသံ ခံယူမိသောအခါ အပိုင်းတစ်ခုသည် အလိုအလျောက် မှတ်တမ်းတင်မည်။ တိတ်ဆိတ်မှု အနည်းငယ်ပြီးနောက် အပိုင်းကို သိမ်းဆည်းမည်။ မှတ်တမ်းတင်ခြင်း ဖွင့်ထားစဉ် ဤကဲ့သို့ အစဉ်လိုက် အပိုင်းများစွာ မှတ်တမ်းတင်နိုင်ပါသည်။',
    thai: 'เมื่อตรวจพบเสียง ส่วนจะเริ่มบันทึกโดยอัตโนมัติ หลังจากความเงียบสักครู่ ส่วนจะถูกบันทึก คุณสามารถบันทึกหลายส่วนแบบนี้ตามลำดับขณะเปิดการบันทึก',
    mandarin:
      '检测到声音时，片段将自动开始录音。静音一段时间后，片段将被保存。录音激活时，您可以按顺序这样录制多个片段。'
  },
  vadHelpSensitivity: {
    english:
      'Sensitivity sets the threshold to determine when a clip starts and ends. Lower sensitivity picks up quieter speech, but also other potential noises.',
    spanish:
      'La sensibilidad controla el umbral que determina cuándo un clip comienza y termina. Con mayor sensibilidad se detecta habla más silenciosa, pero también más ruido de fondo.',
    brazilian_portuguese:
      'A sensibilidade define o limite para determinar quando um clipe começa e termina. Sensibilidade mais baixa capta fala mais baixa, mas também outros ruídos potenciais.',
    tok_pisin:
      'Sensitiv i makim hamas nois i nidim bilong stat na pinis. Liklik sensitiv i harim smol toktok, tasol em i ken harim tu ol narapela nois.',
    indonesian:
      'Sensitivitas mengatur ambang batas untuk menentukan kapan klip dimulai dan berakhir. Sensitivitas rendah menangkap suara pelan, tetapi juga suara lain yang mungkin.',
    nepali:
      'संवेदनशीलताले क्लिप कहिले सुरु र समाप्त हुन्छ निर्धारण गर्न सीमा सेट गर्छ। कम संवेदनशीलताले शान्त बोली समात्छ, तर अन्य सम्भावित आवाजहरू पनि।',
    hindi:
      'संवेदनशीलता क्लिप कब शुरू और समाप्त होता है यह निर्धारित करने के लिए सीमा सेट करती है। कम संवेदनशीलता शांत भाषण पकड़ती है, लेकिन अन्य संभावित आवाज़ें भी।',
    burmese:
      'အာရုံခံနိုင်မှုသည် ကလစ်က မည်သည့်အခါ စပြီး ပြီးဆုံးသည်ကို သတ်မှတ်ရန် အနည်းဆုံး အဆင့်ကို သတ်မှတ်သည်။ အာရုံခံနိုင်မှု နည်းလျှင် အသံငယ်ငယ် စကားပြောချက်ကို ဖမ်းယူသည်၊ သို့သော် အခြား အသံများကိုလည်း ဖမ်းနိုင်သည်။',
    thai: 'ความไวกำหนดเกณฑ์เพื่อกำหนดว่าเมื่อไหร่คลิปจะเริ่มและจบ ความไวต่ำจะจับเสียงพูดที่เบา แต่ก็อาจจับเสียงอื่นๆ ด้วย',
    mandarin:
      '灵敏度设置用于确定片段何时开始和结束的阈值。较低的灵敏度可捕捉较安静的语音，但也会捕捉其他潜在噪音。'
  },
  vadHelpPause: {
    english:
      'A shorter Pause Length will break your recording into more segments at smaller pauses.',
    spanish:
      'Una longitud de pausa más corta dividirá tu grabación en más segmentos en pausas más pequeñas.',
    brazilian_portuguese:
      'Um comprimento de pausa mais curto dividirá sua gravação em mais segmentos em pausas menores.',
    tok_pisin:
      'Sotpela taim bilong pas bai katim rekod bilong yu long planti hap long ol liklik taim yu pas.',
    indonesian:
      'Durasi jeda yang lebih pendek akan memecah rekaman Anda menjadi lebih banyak segmen pada jeda yang lebih kecil.',
    nepali:
      'छोटो रोकाइको लम्बाइले तपाईंको रेकर्डिङलाई साना रोकाइहरूमा धेरै खण्डहरूमा विभाजन गर्नेछ।',
    hindi:
      'छोटी विराम लंबाई आपकी रिकॉर्डिंग को छोटे विरामों में अधिक खंडों में विभाजित करेगी।',
    burmese:
      'ရပ်နားချိန် ပိုတိုလျှင် သင်၏ မှတ်တမ်းကို ရပ်နားချိန် ကြာချိန် ပိုတိုသောနေရာများတွင် အပိုင်းများစွာ ခွဲပါမည်။',
    thai: 'ความยาวการหยุดที่สั้นลงจะแบ่งการบันทึกของคุณเป็นส่วนมากขึ้นที่จุดหยุดที่สั้นลง',
    mandarin: '较短的暂停时长会在较小的停顿处将您的录音分成更多片段。'
  },
  vadHelpMinSegment: {
    english:
      'Minimum Segment Length prevents saving of very short segments below the set duration, such as coughs or door slams.',
    spanish:
      'La Longitud Mínima de Segmento evita guardar segmentos muy cortos por debajo de la duración establecida, como toses o portazos.',
    brazilian_portuguese:
      'O Comprimento Mínimo do Segmento evita salvar segmentos muito curtos abaixo da duração definida, como tosses ou batidas de porta.',
    tok_pisin:
      'Liklik Taim Inap i banisim ol sotpela rekod aninit long taim yu makim, olsem kus o doa i paitim.',
    indonesian:
      'Panjang Segmen Minimum mencegah penyimpanan segmen yang sangat pendek di bawah durasi yang ditetapkan, seperti batuk atau bunyi pintu.',
    nepali:
      'न्यूनतम खण्ड लम्बाइले सेट गरिएको अवधिभन्दा कम धेरै छोटो खण्डहरू सेभ गर्नबाट रोक्छ, जस्तै खोकी वा ढोका ठोक्ने आवाज।',
    hindi:
      'न्यूनतम खंड लंबाई सेट अवधि से कम बहुत छोटे खंडों को सहेजने से रोकती है, जैसे खांसी या दरवाजा बंद करने की आवाज।',
    burmese:
      'အနည်းဆုံး အပိုင်း ကြာချိန်သည် သတ်မှတ်ထားသော ကြာချိန်ထက် နည်းသော အလွန်တိုသော အပိုင်းများကို သိမ်းဆည်းခြင်းမှ ကာကွယ်သည်၊ ဥပမာ ချောင်းဆိုးခြင်း သို့မဟုတ် တံခါးပိတ်သံ။',
    thai: 'ความยาวส่วนขั้นต่ำป้องกันการบันทึกส่วนที่สั้นมากกว่ากำหนด เช่น เสียงไอหรือเสียงประตูปิด',
    mandarin: '最短片段长度可防止保存短于设定时长的片段，例如咳嗽或关门声。'
  },
  vadRecordingSettings: {
    english: 'VAD recording settings',
    spanish: 'Configuración de grabación VAD',
    brazilian_portuguese: 'Configurações de gravação VAD',
    tok_pisin: 'VAD rekoding seting',
    indonesian: 'Pengaturan perekaman VAD',
    nepali: 'VAD रेकर्डिङ सेटिङहरू',
    hindi: 'VAD रिकॉर्डिंग सेटिंग',
    burmese: 'VAD မှတ်တမ်းတင်ခြင်း ဆက်တင်များ',
    thai: 'การตั้งค่าการบันทึก VAD',
    mandarin: 'VAD 录音设置'
  },
  startRecording: {
    english: 'Record',
    spanish: 'Grabar',
    brazilian_portuguese: 'Gravar',
    tok_pisin: 'Rekodim',
    indonesian: 'Rekam',
    nepali: 'रेकर्ड',
    hindi: 'रिकॉर्ड',
    burmese: 'မှတ်တမ်းတင်ပါ',
    thai: 'บันทึก',
    mandarin: '录音'
  },
  stopRecording: {
    english: 'Stop Recording',
    spanish: 'Detener Grabación',
    brazilian_portuguese: 'Parar Gravação',
    tok_pisin: 'Stopim Rekodim',
    indonesian: 'Hentikan Perekaman',
    nepali: 'रेकर्डिङ रोक्नुहोस्',
    hindi: 'रिकॉर्डिंग रोकें',
    burmese: 'မှတ်တမ်းတင်ခြင်း ရပ်ပါ',
    thai: 'หยุดการบันทึก',
    mandarin: '停止录音'
  },
  vadRecordingActive: {
    english: 'VAD recording active',
    spanish: 'Grabación VAD activa',
    brazilian_portuguese: 'Gravação VAD ativa',
    tok_pisin: 'VAD rekoding i wok',
    indonesian: 'Perekaman VAD aktif',
    nepali: 'VAD रेकर्डिङ सक्रिय',
    hindi: 'VAD रिकॉर्डिंग सक्रिय',
    burmese: 'VAD မှတ်တမ်းတင်ခြင်း အသက်ဝင်နေသည်',
    thai: 'การบันทึก VAD กำลังทำงาน',
    mandarin: 'VAD 录音已激活'
  },
  recordingHelpTitle: {
    english: 'Two ways to record',
    spanish: 'Dos formas de grabar',
    brazilian_portuguese: 'Duas formas de gravar',
    tok_pisin: 'Tupela rot bilong rekodim',
    indonesian: 'Dua cara merekam',
    nepali: 'रेकर्ड गर्ने दुई तरिका',
    hindi: 'रिकॉर्ड करने के दो तरीके',
    burmese: 'မှတ်တမ်းတင်ရန် နည်းလမ်း နှစ်ခု',
    thai: 'สองวิธีในการบันทึก',
    mandarin: '两种录制方式'
  },
  recordingHelpVAD: {
    english:
      'the record button to start Voice Activity Detection (VAD) recording. This will automatically create new audio segments whenever you pause as you talk. Tap again to end the VAD session.',
    spanish:
      'el botón de grabación para iniciar la grabación con Detección de Actividad de Voz (VAD). Esto creará automáticamente nuevos segmentos de audio cada vez que hagas una pausa mientras hablas. Toca de nuevo para finalizar la sesión VAD.',
    brazilian_portuguese:
      'o botão de gravação para iniciar a gravação com Detecção de Atividade de Voz (VAD). Isso criará automaticamente novos segmentos de áudio sempre que você pausar enquanto fala. Toque novamente para encerrar a sessão VAD.',
    tok_pisin:
      'baten bilong rekodim bilong statim Voice Activity Detection (VAD) rekoding. Em bai wokim nupela ol hap taim yu stopim toktok. Paitim gen bilong pinisim VAD sesion.',
    indonesian:
      'tombol rekam untuk memulai perekaman Voice Activity Detection (VAD). Ini akan secara otomatis membuat segmen audio baru setiap kali Anda berhenti sejenak saat berbicara. Ketuk lagi untuk mengakhiri sesi VAD.',
    nepali:
      'भ्वाइस एक्टिभिटी डिटेक्शन (VAD) रेकर्डिङ सुरु गर्न रेकर्ड बटन थिच्नुहोस्। यसले तपाईंले बोल्दा रोक्दा स्वचालित रूपमा नयाँ अडियो खण्डहरू सिर्जना गर्नेछ। VAD सत्र समाप्त गर्न फेरि ट्याप गर्नुहोस्।',
    hindi:
      'वॉइस एक्टिविटी डिटेक्शन (VAD) रिकॉर्डिंग शुरू करने के लिए रिकॉर्ड बटन दबाएं। यह आपके बोलते समय रुकने पर स्वचालित रूप से नए ऑडियो सेगमेंट बनाएगा। VAD सत्र समाप्त करने के लिए फिर से टैप करें।',
    burmese:
      'အသံလှုပ်ရှားမှု ထောက်လှမ်းခြင်း (VAD) မှတ်တမ်းတင်ရန် မှတ်တမ်းတင်ခလုတ်ကို နှိပ်ပါ။ သင်စကားပြောနေစဉ် ရပ်နားသောအခါ ဤသည် အသံအပိုင်းအစအသစ်များကို အလိုအလျောက် ဖန်တီးပေးမည်။ VAD အစည်းအဝေးကို အဆုံးသတ်ရန် ထပ်မံနှိပ်ပါ။',
    thai: 'ปุ่มบันทึกเพื่อเริ่มการบันทึกด้วยการตรวจจับกิจกรรมเสียง (VAD) ซึ่งจะสร้างส่วนเสียงใหม่โดยอัตโนมัติเมื่อคุณหยุดพูดขณะพูด กดอีกครั้งเพื่อสิ้นสุดเซสชัน VAD',
    mandarin:
      '录音按钮以开始语音活动检测 (VAD) 录音。当您说话时暂停，这将自动创建新的音频片段。再次点击以结束 VAD 会话。'
  },
  recordingHelpPushToTalk: {
    english: 'to record a single segment, release to stop recording.',
    spanish: 'para grabar un solo segmento, suelta para detener la grabación.',
    brazilian_portuguese:
      'para gravar um único segmento, solte para parar a gravação.',
    tok_pisin: 'bilong rekodim wanpela hap, lusim bilong stopim rekoding.',
    indonesian:
      'untuk merekam satu segmen, lepaskan untuk menghentikan perekaman.',
    nepali: 'एउटा खण्ड रेकर्ड गर्न, रेकर्डिङ रोक्न छोड्नुहोस्।',
    hindi: 'एकल सेगमेंट रिकॉर्ड करने के लिए, रिकॉर्डिंग रोकने के लिए छोड़ें।',
    burmese:
      'အပိုင်းအစတစ်ခုကို မှတ်တမ်းတင်ရန်၊ မှတ်တမ်းတင်ခြင်းကို ရပ်တန့်ရန် လွှတ်ပါ။',
    thai: 'เพื่อบันทึกส่วนเดียว ปล่อยเพื่อหยุดการบันทึก',
    mandarin: '录制单个片段，松开以停止录制。'
  },
  tap: {
    english: 'Tap',
    spanish: 'Toca',
    brazilian_portuguese: 'Toque',
    tok_pisin: 'Paitim',
    indonesian: 'Ketuk',
    nepali: 'ट्याप गर्नुहोस्',
    hindi: 'टैप करें',
    burmese: 'နှိပ်ပါ',
    thai: 'แตะ',
    mandarin: '点击'
  },
  pressAndHold: {
    english: 'Press and hold',
    spanish: 'Mantén presionado',
    brazilian_portuguese: 'Pressione e segure',
    tok_pisin: 'Presim na holim',
    indonesian: 'Tekan dan tahan',
    nepali: 'थिच्नुहोस् र होल्ड गर्नुहोस्',
    hindi: 'दबाएं और पकड़ें',
    burmese: 'နှိပ်ပြီး ကိုင်ထားပါ',
    thai: 'กดค้างไว้',
    mandarin: '按住'
  },
  vadAutoCalibrate: {
    english: 'Auto-Calibrate',
    spanish: 'Auto-Calibrar',
    brazilian_portuguese: 'Auto-Calibrar',
    tok_pisin: 'Olsem wanem yet',
    indonesian: 'Auto-Kalibrasi',
    nepali: 'स्वत: क्यालिब्रेट',
    hindi: 'स्वतः कैलिब्रेट',
    burmese: 'အလိုအလျောက် ချိန်ညှိခြင်း',
    thai: 'ปรับเทียบอัตโนมัติ',
    mandarin: '自动校准'
  },
  vadCalibrating: {
    english: 'Calibrating...',
    spanish: 'Calibrando...',
    brazilian_portuguese: 'Calibrando...',
    tok_pisin: 'Wokim nau...',
    indonesian: 'Mengkalibrasi...',
    nepali: 'क्यालिब्रेट गर्दै...',
    hindi: 'कैलिब्रेट हो रहा है...',
    burmese: 'ချိန်ညှိနေသည်...',
    thai: 'กำลังปรับเทียบ...',
    mandarin: '校准中...'
  },
  vadCalibrationFailed: {
    english: 'Calibration failed. Please try again in a quieter environment.',
    spanish:
      'La calibración falló. Por favor, inténtalo de nuevo en un entorno más silencioso.',
    brazilian_portuguese:
      'Calibração falhou. Por favor, tente novamente em um ambiente mais silencioso.',
    tok_pisin: 'Em i no wok. Traim gen long ples i no gat tumas nois.',
    indonesian:
      'Kalibrasi gagal. Silakan coba lagi di lingkungan yang lebih tenang.',
    nepali:
      'क्यालिब्रेसन असफल भयो। कृपया शान्त वातावरणमा पुन: प्रयास गर्नुहोस्।',
    hindi: 'कैलिब्रेशन विफल। कृपया शांत वातावरण में पुनः प्रयास करें।',
    burmese:
      'ချိန်ညှိခြင်း မအောင်မြင်ပါ။ ကျေးဇူးပြု၍ ပိုတိတ်ဆိတ်သော ပတ်ဝန်းကျင်တွင် ထပ်မံကြိုးစားပါ။',
    thai: 'การปรับเทียบล้มเหลว กรุณาลองอีกครั้งในสภาพแวดล้อมที่เงียบกว่า',
    mandarin: '校准失败。请在更安静的环境中重试。'
  },
  vadCalibrateHint: {
    english:
      'During auto-calibration remain silent or only allow sounds that you want to be below the sensitivity threshold.',
    spanish:
      'Durante la auto-calibración permanece en silencio o solo permite sonidos que deseas que estén por debajo del umbral de sensibilidad.',
    brazilian_portuguese:
      'Durante a auto-calibração permaneça em silêncio ou apenas permita sons que você deseja que fiquem abaixo do limite de sensibilidade.',
    tok_pisin:
      'Taim masin i wokim kalibresen, yu mas stap isi o larim ol nois tasol we yu laik i stap aninit long mak.',
    indonesian:
      'Selama kalibrasi otomatis tetaplah diam atau hanya izinkan suara yang ingin Anda agar berada di bawah ambang sensitivitas.',
    nepali:
      'स्वत: क्यालिब्रेसनको समयमा मौन रहनुहोस् वा केवल ती आवाजहरू मात्र अनुमति दिनुहोस् जुन तपाईं संवेदनशीलता सीमाभन्दा तल चाहनुहुन्छ।',
    hindi:
      'स्वतः कैलिब्रेशन के दौरान चुप रहें या केवल उन आवाज़ों की अनुमति दें जिन्हें आप संवेदनशीलता सीमा से नीचे चाहते हैं।',
    burmese:
      'အလိုအလျောက် ချိန်ညှိချိန်တွင် တိတ်ဆိတ်စွာ နေပါ သို့မဟုတ် အာရုံခံနိုင်မှု အနည်းဆုံးအဆင့်အောက်တွင် ရှိစေလိုသော အသံများကိုသာ ခွင့်ပြုပါ။',
    thai: 'ระหว่างการปรับเทียบอัตโนมัติ อยู่เงียบๆ หรืออนุญาตเฉพาะเสียงที่คุณต้องการให้อยู่ต่ำกว่าเกณฑ์ความไว',
    mandarin: '自动校准期间请保持安静，或仅允许您希望低于灵敏度阈值的声音。'
  },
  appUpgradeRequired: {
    english: 'App Upgrade Required',
    spanish: 'Actualización de App Requerida',
    brazilian_portuguese: 'Atualização do App Necessária',
    tok_pisin: 'Yu mas upgreidim app',
    indonesian: 'Pembaruan Aplikasi Diperlukan',
    nepali: 'एप अपग्रेड आवश्यक छ',
    hindi: 'ऐप अपग्रेड आवश्यक है',
    burmese: 'အက်ပ်ကို အဆင့်မြှင့်တင်ရန် လိုအပ်သည်',
    thai: 'ต้องอัปเกรดแอป',
    mandarin: '需要升级应用'
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
      'Versi baru aplikasi diperlukan untuk mengakses fitur terbaru. Silakan perbarui untuk melanjutkan.',
    nepali:
      'नवीनतम सुविधाहरू पहुँच गर्न एपको नयाँ संस्करण आवश्यक छ। कृपया जारी राख्न अपडेट गर्नुहोस्।',
    hindi:
      'नवीनतम सुविधाओं तक पहुंचने के लिए ऐप का नया संस्करण आवश्यक है। कृपया जारी रखने के लिए अपडेट करें।',
    burmese:
      'နောက်ဆုံးပေါ် အင်္ဂါရပ်များကို အသုံးပြုရန် အက်ပ်၏ ဗားရှင်းအသစ် လိုအပ်သည်။ ကျေးဇူးပြု၍ ဆက်လက်လုပ်ဆောင်ရန် အပ်ဒိတ်လုပ်ပါ။',
    thai: 'ต้องใช้เวอร์ชันใหม่ของแอปเพื่อเข้าถึงฟีเจอร์ล่าสุด กรุณาอัปเดตเพื่อดำเนินการต่อ',
    mandarin: '需要应用的新版本才能访问最新功能。请更新以继续。'
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
      'Versi aplikasi Anda lebih baru dari server. Silakan hubungi dukungan atau tunggu server diperbarui.',
    nepali:
      'तपाईंको एप संस्करण सर्भरभन्दा नयाँ छ। कृपया समर्थनलाई सम्पर्क गर्नुहोस् वा सर्भर अपडेट हुने प्रतीक्षा गर्नुहोस्।',
    hindi:
      'आपका ऐप संस्करण सर्वर से नया है। कृपया सहायता से संपर्क करें या सर्वर अपडेट होने की प्रतीक्षा करें।',
    burmese:
      'သင်၏ အက်ပ်ဗားရှင်းသည် ဆာဗာထက် ပိုမိုသစ်သည်။ ကျေးဇူးပြု၍ အကူအညီကို ဆက်သွယ်ပါ သို့မဟုတ် ဆာဗာ အပ်ဒိတ်လုပ်ရန် စောင့်ပါ။',
    thai: 'เวอร์ชันแอปของคุณใหม่กว่าซีร์เวอร์ กรุณาติดต่อฝ่ายสนับสนุนหรือรอให้ซีร์เวอร์อัปเดต',
    mandarin: '您的应用版本比服务器新。请联系支持或等待服务器更新。'
  },
  upgradeToVersion: {
    english: 'Please upgrade to version {version}',
    spanish: 'Por favor actualice a la versión {version}',
    brazilian_portuguese: 'Por favor atualize para a versão {version}',
    tok_pisin: 'Plis upgreidim long version {version}',
    indonesian: 'Silakan perbarui ke versi {version}',
    nepali: 'कृपया संस्करण {version} मा अपग्रेड गर्नुहोस्',
    hindi: 'कृपया संस्करण {version} में अपग्रेड करें',
    burmese: 'ကျေးဇူးပြု၍ ဗားရှင်း {version} သို့ အဆင့်မြှင့်တင်ပါ',
    thai: 'กรุณาอัปเกรดเป็นเวอร์ชัน {version}',
    mandarin: '请升级到版本 {version}'
  },
  currentVersion: {
    english: 'Current Version',
    spanish: 'Versión Actual',
    brazilian_portuguese: 'Versão Atual',
    tok_pisin: 'Version nau',
    indonesian: 'Versi Saat Ini',
    nepali: 'हालको संस्करण',
    hindi: 'वर्तमान संस्करण',
    burmese: 'လက်ရှိ ဗားရှင်း',
    thai: 'เวอร์ชันปัจจุบัน',
    mandarin: '当前版本'
  },
  requiredVersion: {
    english: 'Required Version',
    spanish: 'Versión Requerida',
    brazilian_portuguese: 'Versão Necessária',
    tok_pisin: 'Version yu mas gat',
    indonesian: 'Versi yang Diperlukan',
    nepali: 'आवश्यक संस्करण',
    hindi: 'आवश्यक संस्करण',
    burmese: 'လိုအပ်သော ဗားရှင်း',
    thai: 'เวอร์ชันที่ต้องการ',
    mandarin: '所需版本'
  },
  upgradeApp: {
    english: 'Upgrade App',
    spanish: 'Actualizar App',
    brazilian_portuguese: 'Atualizar App',
    tok_pisin: 'Upgreidim App',
    indonesian: 'Perbarui Aplikasi',
    nepali: 'एप अपग्रेड गर्नुहोस्',
    hindi: 'ऐप अपग्रेड करें',
    burmese: 'အက်ပ်ကို အဆင့်မြှင့်တင်ပါ',
    thai: 'อัปเกรดแอป',
    mandarin: '升级应用'
  },
  checkingSchemaVersion: {
    english: 'Checking schema compatibility...',
    spanish: 'Verificando compatibilidad del esquema...',
    brazilian_portuguese: 'Verificando compatibilidade do esquema...',
    tok_pisin: 'Checkim schema compatibility...',
    indonesian: 'Memeriksa kompatibilitas skema...',
    nepali: 'स्किमा अनुकूलता जाँच गर्दै...',
    hindi: 'स्कीमा अनुकूलता जांच रहे हैं...',
    burmese: 'စံညွှန်း ကိုက်ညီမှုကို စစ်ဆေးနေသည်...',
    thai: 'กำลังตรวจสอบความเข้ากันได้ของสคีมา...',
    mandarin: '正在检查架构兼容性...'
  },
  scanningCorruptedAttachments: {
    english: 'Scanning for corrupted attachments...',
    spanish: 'Buscando archivos adjuntos corruptos...',
    brazilian_portuguese: 'Procurando anexos corrompidos...',
    tok_pisin: 'Lukluk long ol bagarap fayl...',
    indonesian: 'Memindai lampiran yang rusak...',
    nepali: 'बिग्रिएका संलग्नकहरू स्क्यान गर्दै...',
    hindi: 'दूषित संलग्नकों को स्कैन कर रहे हैं...',
    burmese: 'ပျက်စီးသော ပူးတွဲဖိုင်များကို စကင်န်ဖတ်နေသည်...',
    thai: 'กำลังสแกนหาไฟล์แนบที่เสียหาย...',
    mandarin: '正在扫描损坏的附件...'
  },
  noCorruptedAttachments: {
    english: 'No Corrupted Attachments',
    spanish: 'No hay archivos adjuntos corruptos',
    brazilian_portuguese: 'Sem Anexos Corrompidos',
    tok_pisin: 'I no gat bagarap fayl',
    indonesian: 'Tidak Ada Lampiran Rusak',
    nepali: 'कुनै बिग्रिएको संलग्नक छैन',
    hindi: 'कोई दूषित संलग्नक नहीं',
    burmese: 'ပျက်စီးသော ပူးတွဲဖိုင်များ မရှိပါ',
    thai: 'ไม่มีไฟล์แนบที่เสียหาย',
    mandarin: '没有损坏的附件'
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
    indonesian: 'Database lampiran Anda sehat. Semua catatan lampiran valid.',
    nepali:
      'तपाईंको संलग्नक डाटाबेस स्वस्थ छ। सबै संलग्नक रेकर्डहरू मान्य छन्।',
    hindi: 'आपका संलग्नक डेटाबेस स्वस्थ है। सभी संलग्नक रिकॉर्ड मान्य हैं।',
    burmese:
      'သင်၏ ပူးတွဲဖိုင် ဒေတာဘေ့စ်သည် ကျန်းမာသည်။ ပူးတွဲဖိုင် မှတ်တမ်းအားလုံး တရားဝင်သည်။',
    thai: 'ฐานข้อมูลไฟล์แนบของคุณอยู่ในสภาพดี บันทึกไฟล์แนบทั้งหมดถูกต้อง',
    mandarin: '您的附件数据库健康。所有附件记录均有效。'
  },
  corruptedAttachments: {
    english: 'Corrupted Attachments',
    spanish: 'Archivos Adjuntos Corruptos',
    brazilian_portuguese: 'Anexos Corrompidos',
    tok_pisin: 'Ol Bagarap Fayl',
    indonesian: 'Lampiran Rusak',
    nepali: 'बिग्रिएका संलग्नकहरू',
    hindi: 'दूषित संलग्नक',
    burmese: 'ပျက်စီးသော ပူးတွဲဖိုင်များ',
    thai: 'ไฟล์แนบที่เสียหาย',
    mandarin: '损坏的附件'
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
      'Ditemukan {count} lampiran rusak dengan URL blob di database. Ini menyebabkan kesalahan sinkronisasi dan harus dibersihkan.',
    nepali:
      'डाटाबेसमा blob URL भएको {count} बिग्रिएको संलग्नक फेला पारियो। यसले सिंक त्रुटिहरू निम्त्याइरहेको छ र सफा गर्नुपर्छ।'
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
      'Ditemukan {count} lampiran rusak dengan URL blob di database. Ini menyebabkan kesalahan sinkronisasi dan harus dibersihkan.',
    nepali:
      'डाटाबेसमा blob URL भएका {count} बिग्रिएका संलग्नकहरू फेला पारियो। यसले सिंक त्रुटिहरू निम्त्याइरहेको छ र सफा गर्नुपर्छ।'
  },
  cleanAll: {
    english: 'Clean All ({count})',
    spanish: 'Limpiar Todo ({count})',
    brazilian_portuguese: 'Limpar Tudo ({count})',
    tok_pisin: 'Klinim Olgeta ({count})',
    indonesian: 'Bersihkan Semua ({count})',
    nepali: 'सबै सफा गर्नुहोस् ({count})'
  },
  cleaning: {
    english: 'Cleaning...',
    spanish: 'Limpiando...',
    brazilian_portuguese: 'Limpando...',
    tok_pisin: 'Mi klinim nau...',
    indonesian: 'Membersihkan...',
    nepali: 'सफा गर्दै...',
    hindi: 'सफाई कर रहे हैं...',
    burmese: 'ရှင်းလင်းနေသည်...',
    thai: 'กำลังทำความสะอาด...',
    mandarin: '正在清理...'
  },
  size: {
    english: 'Size',
    spanish: 'Tamaño',
    brazilian_portuguese: 'Tamanho',
    tok_pisin: 'Saiz',
    indonesian: 'Ukuran',
    nepali: 'आकार',
    hindi: 'आकार',
    burmese: 'အရွယ်အစား',
    thai: 'ขนาด',
    mandarin: '大小'
  },
  attachmentId: {
    english: 'Attachment ID',
    spanish: 'ID del Archivo Adjunto',
    brazilian_portuguese: 'ID do Anexo',
    tok_pisin: 'ID bilong Fayl',
    indonesian: 'ID Lampiran',
    nepali: 'संलग्नक ID',
    hindi: 'संलग्नक ID',
    burmese: 'ပူးတွဲဖိုင် ID',
    thai: 'รหัสไฟล์แนบ',
    mandarin: '附件ID'
  },
  localUri: {
    english: 'Local URI',
    spanish: 'URI Local',
    brazilian_portuguese: 'URI Local',
    tok_pisin: 'Local URI',
    indonesian: 'URI Lokal',
    nepali: 'स्थानीय URI',
    hindi: 'स्थानीय URI',
    burmese: 'ဒေသတွင်း URI',
    thai: 'URI ท้องถิ่น',
    mandarin: '本地URI'
  },
  associatedAssets: {
    english: 'Associated Assets ({count})',
    spanish: 'Activos Asociados ({count})',
    brazilian_portuguese: 'Ativos Associados ({count})',
    tok_pisin: 'Ol Asset i go wantaim ({count})',
    indonesian: 'Aset Terkait ({count})',
    nepali: 'सम्बद्ध एसेटहरू ({count})'
  },
  contentLinks: {
    english: 'Content Links ({count})',
    spanish: 'Enlaces de Contenido ({count})',
    brazilian_portuguese: 'Links de Conteúdo ({count})',
    tok_pisin: 'Ol Link bilong Content ({count})',
    indonesian: 'Tautan Konten ({count})',
    nepali: 'सामग्री लिंकहरू ({count})'
  },
  cleanThis: {
    english: 'Clean This',
    spanish: 'Limpiar Esto',
    brazilian_portuguese: 'Limpar Isto',
    tok_pisin: 'Klinim Dispela',
    indonesian: 'Bersihkan Ini',
    nepali: 'यो सफा गर्नुहोस्',
    hindi: 'इसे साफ करें',
    burmese: 'ဤအရာကို ရှင်းလင်းပါ',
    thai: 'ทำความสะอาดสิ่งนี้',
    mandarin: '清理此项'
  },
  cleanCorruptedAttachment: {
    english: 'Clean Corrupted Attachment',
    spanish: 'Limpiar Archivo Adjunto Corrupto',
    brazilian_portuguese: 'Limpar Anexo Corrompido',
    tok_pisin: 'Klinim Bagarap Fayl',
    indonesian: 'Bersihkan Lampiran Rusak',
    nepali: 'बिग्रिएको संलग्नक सफा गर्नुहोस्',
    hindi: 'दूषित संलग्नक साफ करें',
    burmese: 'ပျက်စီးသော ပူးတွဲဖိုင်ကို ရှင်းလင်းပါ',
    thai: 'ทำความสะอาดไฟล์แนบที่เสียหาย',
    mandarin: '清理损坏的附件'
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
      'Ini akan menghapus catatan lampiran rusak dan referensinya dari database. Tindakan ini tidak dapat dibatalkan.',
    nepali:
      'यसले बिग्रिएको संलग्नक रेकर्ड र यसको सन्दर्भहरू डाटाबेसबाट हटाउनेछ। यो कार्य पूर्ववत गर्न सकिँदैन।',
    hindi:
      'यह डेटाबेस से दूषित संलग्नक रिकॉर्ड और इसके संदर्भों को हटा देगा। यह कार्य पूर्ववत नहीं किया जा सकता।',
    burmese:
      'ဤအရာသည် ပျက်စီးသော ပူးတွဲဖိုင် မှတ်တမ်းနှင့် ၎င်း၏ ကိုးကားချက်များကို ဒေတာဘေ့စ်မှ ဖယ်ရှားမည်။ ဤလုပ်ဆောင်ချက်ကို ပြန်လည်ပြုပြင်နိုင်မည်မဟုတ်ပါ။',
    thai: 'สิ่งนี้จะลบบันทึกไฟล์แนบที่เสียหายและการอ้างอิงจากฐานข้อมูล การกระทำนี้ไม่สามารถยกเลิกได้',
    mandarin: '这将从数据库中删除损坏的附件记录及其引用。此操作无法撤销。'
  },
  clean: {
    english: 'Clean',
    spanish: 'Limpiar',
    brazilian_portuguese: 'Limpar',
    tok_pisin: 'Klinim',
    indonesian: 'Bersihkan',
    nepali: 'सफा गर्नुहोस्',
    hindi: 'साफ करें',
    burmese: 'ရှင်းလင်းပါ',
    thai: 'ทำความสะอาด',
    mandarin: '清理'
  },
  corruptedAttachmentCleanedSuccess: {
    english: 'Corrupted attachment cleaned successfully.',
    spanish: 'Archivo adjunto corrupto limpiado exitosamente.',
    brazilian_portuguese: 'Anexo corrompido limpo com sucesso.',
    tok_pisin: 'Bagarap fayl i klinim gut pinis.',
    indonesian: 'Lampiran rusak berhasil dibersihkan.',
    nepali: 'बिग्रिएको संलग्नक सफलतापूर्वक सफा गरियो।',
    hindi: 'दूषित संलग्नक सफलतापूर्वक साफ किया गया।',
    burmese: 'ပျက်စီးသော ပူးတွဲဖိုင်ကို အောင်မြင်စွာ ရှင်းလင်းပြီးပါပြီ။',
    thai: 'ทำความสะอาดไฟล์แนบที่เสียหายสำเร็จแล้ว',
    mandarin: '损坏的附件已成功清理。'
  },
  failedToCleanAttachment: {
    english: 'Failed to clean attachment: {error}',
    spanish: 'Error al limpiar el archivo adjunto: {error}',
    brazilian_portuguese: 'Falha ao limpar anexo: {error}',
    tok_pisin: 'I no inap klinim fayl: {error}',
    indonesian: 'Gagal membersihkan lampiran: {error}',
    nepali: 'संलग्नक सफा गर्न असफल: {error}'
  },
  cleanAllCorruptedAttachments: {
    english: 'Clean All Corrupted Attachments',
    spanish: 'Limpiar Todos los Archivos Adjuntos Corruptos',
    brazilian_portuguese: 'Limpar Todos os Anexos Corrompidos',
    tok_pisin: 'Klinim Olgeta Bagarap Fayl',
    indonesian: 'Bersihkan Semua Lampiran Rusak',
    nepali: 'सबै बिग्रिएका संलग्नकहरू सफा गर्नुहोस्',
    hindi: 'सभी दूषित संलग्नक साफ करें',
    burmese: 'ပျက်စီးသော ပူးတွဲဖိုင်အားလုံးကို ရှင်းလင်းပါ',
    thai: 'ทำความสะอาดไฟล์แนบที่เสียหายทั้งหมด',
    mandarin: '清理所有损坏的附件'
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
      'Ini akan membersihkan {count} lampiran rusak. Tindakan ini tidak dapat dibatalkan.',
    nepali:
      'यसले {count} बिग्रिएको संलग्नक सफा गर्नेछ। यो कार्य पूर्ववत गर्न सकिँदैन।'
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
      'Ini akan membersihkan {count} lampiran rusak. Tindakan ini tidak dapat dibatalkan.',
    nepali:
      'यसले {count} बिग्रिएका संलग्नकहरू सफा गर्नेछ। यो कार्य पूर्ववत गर्न सकिँदैन।'
  },
  partialSuccess: {
    english: 'Partial Success',
    spanish: 'Éxito Parcial',
    brazilian_portuguese: 'Sucesso Parcial',
    tok_pisin: 'Sampela i Orait',
    indonesian: 'Berhasil Sebagian',
    nepali: 'आंशिक सफलता',
    hindi: 'आंशिक सफलता',
    burmese: 'တစ်စိတ်တစ်ပိုင်း အောင်မြင်မှု',
    thai: 'ความสำเร็จบางส่วน',
    mandarin: '部分成功'
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
      'Membersihkan {cleaned} lampiran. {errorCount} kesalahan terjadi:\n\n{errors}',
    nepali: '{cleaned} संलग्नक सफा गरियो। {errorCount} त्रुटि भयो:\n\n{errors}',
    hindi: '{cleaned} संलग्नक साफ किया। {errorCount} त्रुटि हुई:\n\n{errors}',
    burmese:
      '{cleaned} ပူးတွဲဖိုင်ကို သန့်ရှင်းပြီး။ {errorCount} အမှား ဖြစ်ပွားခဲ့သည်:\n\n{errors}',
    thai: 'ล้างไฟล์แนบ {cleaned} รายการ เกิดข้อผิดพลาด {errorCount} รายการ:\n\n{errors}',
    mandarin: '已清理 {cleaned} 个附件。发生 {errorCount} 个错误:\n\n{errors}'
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
      'Membersihkan {cleaned} lampiran. {errorCount} kesalahan terjadi:\n\n{errors}',
    nepali:
      '{cleaned} संलग्नकहरू सफा गरियो। {errorCount} त्रुटिहरू भयो:\n\n{errors}',
    hindi:
      '{cleaned} संलग्नक साफ किए। {errorCount} त्रुटियां हुईं:\n\n{errors}',
    burmese:
      '{cleaned} ပူးတွဲဖိုင်များကို သန့်ရှင်းပြီး။ {errorCount} အမှားများ ဖြစ်ပွားခဲ့သည်:\n\n{errors}',
    thai: 'ล้างไฟล์แนบ {cleaned} รายการ เกิดข้อผิดพลาด {errorCount} รายการ:\n\n{errors}',
    mandarin: '已清理 {cleaned} 个附件。发生 {errorCount} 个错误:\n\n{errors}'
  },
  successfullyCleanedAttachments: {
    english: 'Successfully cleaned {cleaned} corrupted attachment.',
    spanish: 'Se limpió exitosamente {cleaned} archivo adjunto corrupto.',
    brazilian_portuguese: 'Limpou com sucesso {cleaned} anexo corrompido.',
    tok_pisin: 'Klinim gut {cleaned} bagarap fayl.',
    indonesian: 'Berhasil membersihkan {cleaned} lampiran rusak.',
    nepali: '{cleaned} बिग्रिएको संलग्नक सफलतापूर्वक सफा गरियो।',
    hindi: '{cleaned} दूषित संलग्नक सफलतापूर्वक साफ किया गया।',
    burmese:
      '{cleaned} ပျက်စီးသော ပူးတွဲဖိုင်ကို အောင်မြင်စွာ သန့်ရှင်းပြီးပါပြီ။',
    thai: 'ล้างไฟล์แนบที่เสียหาย {cleaned} รายการสำเร็จ',
    mandarin: '已成功清理 {cleaned} 个损坏的附件。'
  },
  successfullyCleanedAttachmentsPlural: {
    english: 'Successfully cleaned {cleaned} corrupted attachments.',
    spanish: 'Se limpiaron exitosamente {cleaned} archivos adjuntos corruptos.',
    brazilian_portuguese: 'Limpou com sucesso {cleaned} anexos corrompidos.',
    tok_pisin: 'Klinim gut {cleaned} bagarap fayl.',
    indonesian: 'Berhasil membersihkan {cleaned} lampiran rusak.',
    nepali: '{cleaned} बिग्रिएका संलग्नकहरू सफलतापूर्वक सफा गरियो।',
    hindi: '{cleaned} दूषित संलग्नक सफलतापूर्वक साफ किए गए।',
    burmese:
      '{cleaned} ပျက်စီးသော ပူးတွဲဖိုင်များကို အောင်မြင်စွာ သန့်ရှင်းပြီးပါပြီ။',
    thai: 'ล้างไฟล์แนบที่เสียหาย {cleaned} รายการสำเร็จ',
    mandarin: '已成功清理 {cleaned} 个损坏的附件。'
  },
  failedToCleanAttachments: {
    english: 'Failed to clean attachments: {error}',
    spanish: 'Error al limpiar los archivos adjuntos: {error}',
    brazilian_portuguese: 'Falha ao limpar anexos: {error}',
    tok_pisin: 'I no inap klinim ol fayl: {error}',
    indonesian: 'Gagal membersihkan lampiran: {error}',
    nepali: 'संलग्नकहरू सफा गर्न असफल: {error}',
    hindi: 'संलग्नक साफ करने में विफल: {error}',
    burmese: 'ပူးတွဲဖိုင်များကို သန့်ရှင်းရန် မအောင်မြင်ပါ: {error}',
    thai: 'ล้างไฟล์แนบไม่สำเร็จ: {error}',
    mandarin: '清理附件失败: {error}'
  },
  failedToLoadCorruptedAttachments: {
    english: 'Failed to load corrupted attachments. Please try again.',
    spanish:
      'Error al cargar los archivos adjuntos corruptos. Por favor, intente de nuevo.',
    brazilian_portuguese:
      'Falha ao carregar anexos corrompidos. Por favor, tente novamente.',
    tok_pisin: 'I no inap loadim ol bagarap fayl. Plis traim gen.',
    indonesian: 'Gagal memuat lampiran rusak. Silakan coba lagi.',
    nepali: 'बिग्रिएका संलग्नकहरू लोड गर्न असफल। कृपया पुन: प्रयास गर्नुहोस्।',
    hindi: 'दूषित संलग्नक लोड करने में विफल। कृपया पुनः प्रयास करें।',
    burmese:
      'ပျက်စီးသော ပူးတွဲဖိုင်များကို လုပ်ဆောင်ရန် မအောင်မြင်ပါ။ ကျေးဇူးပြု၍ ထပ်မံကြိုးစားပါ။',
    thai: 'โหลดไฟล์แนบที่เสียหายไม่สำเร็จ กรุณาลองอีกครั้ง',
    mandarin: '加载损坏的附件失败。请重试。'
  },
  unnamed: {
    english: 'Unnamed',
    spanish: 'Sin nombre',
    brazilian_portuguese: 'Sem nome',
    tok_pisin: 'I no gat nem',
    indonesian: 'Tanpa nama',
    nepali: 'नाम नभएको',
    hindi: 'बिना नाम',
    burmese: 'အမည်မဲ့',
    thai: 'ไม่มีชื่อ',
    mandarin: '未命名'
  },
  backToProjects: {
    english: 'Back to Projects',
    spanish: 'Volver a Proyectos',
    brazilian_portuguese: 'Voltar aos Projetos',
    tok_pisin: 'Go bek long ol Projek',
    indonesian: 'Kembali ke Proyek',
    nepali: 'प्रोजेक्टहरूमा फर्कनुहोस्',
    hindi: 'परियोजनाओं पर वापस',
    burmese: 'စီမံကိန်းများသို့ ပြန်သွားပါ',
    thai: 'กลับไปที่โครงการ',
    mandarin: '返回项目'
  },
  downloaded: {
    english: 'Downloaded',
    spanish: 'Descargado',
    brazilian_portuguese: 'Baixado',
    tok_pisin: 'Downloaded',
    indonesian: 'Diunduh',
    nepali: 'डाउनलोड भयो',
    hindi: 'डाउनलोड हो गया',
    burmese: 'ဒေါင်းလုဒ်ပြီးပါပြီ',
    thai: 'ดาวน์โหลดแล้ว',
    mandarin: '已下载'
  },
  freeUpSpace: {
    english: 'Free Up Space',
    spanish: 'Liberar Espacio',
    brazilian_portuguese: 'Liberar Espaço',
    tok_pisin: 'Free Up Space',
    indonesian: 'Bebaskan Ruang',
    nepali: 'ठाउँ खाली गर्नुहोस्',
    hindi: 'जगह खाली करें',
    burmese: 'နေရာ လွတ်မြောက်ပါ',
    thai: 'ปล่อยพื้นที่',
    mandarin: '释放空间'
  },
  storageUsed: {
    english: 'Storage Used',
    spanish: 'Espacio Usado',
    brazilian_portuguese: 'Espaço Usado',
    tok_pisin: 'Storage Used',
    indonesian: 'Penyimpanan yang Digunakan',
    nepali: 'प्रयोग भएको भण्डारण',
    hindi: 'उपयोग की गई संग्रहण',
    burmese: 'အသုံးပြုထားသော သိုလှောင်မှု',
    thai: 'พื้นที่จัดเก็บที่ใช้',
    mandarin: '已用存储'
  },
  notDownloaded: {
    english: 'Not Downloaded',
    spanish: 'No Descargado',
    brazilian_portuguese: 'Não Baixado',
    tok_pisin: 'Not Downloaded',
    indonesian: 'Tidak Diunduh',
    nepali: 'डाउनलोड भएको छैन',
    hindi: 'डाउनलोड नहीं हुआ',
    burmese: 'ဒေါင်းလုဒ်မလုပ်ရသေးပါ',
    thai: 'ยังไม่ได้ดาวน์โหลด',
    mandarin: '未下载'
  },
  missingCloudData: {
    english: 'Missing Cloud Data',
    spanish: 'Falta Datos en la Nube',
    brazilian_portuguese: 'Dados na Nuvem Faltando',
    tok_pisin: 'No gat ol data long cloud',
    indonesian: 'Data Cloud Hilang',
    nepali: 'क्लाउड डाटा हराइरहेको छ',
    hindi: 'क्लाउड डेटा गायब',
    burmese: 'Cloud ဒေတာ ပျောက်ဆုံးနေသည်',
    thai: 'ข้อมูลคลาวด์หายไป',
    mandarin: '云数据缺失'
  },
  deleteAccount: {
    english: 'Delete Account',
    spanish: 'Eliminar Cuenta',
    brazilian_portuguese: 'Excluir Conta',
    tok_pisin: 'Rausim Account',
    indonesian: 'Hapus Akun',
    nepali: 'खाता मेटाउनुहोस्',
    hindi: 'खाता हटाएं',
    burmese: 'အကောင့်ကို ဖျက်ပါ',
    thai: 'ลบบัญชี',
    mandarin: '删除账户'
  },
  accountDeletionTitle: {
    english: 'Delete Your Account',
    spanish: 'Eliminar Tu Cuenta',
    brazilian_portuguese: 'Excluir Sua Conta',
    tok_pisin: 'Rausim Account Bilong Yu',
    indonesian: 'Hapus Akun Anda',
    nepali: 'आफ्नो खाता मेटाउनुहोस्',
    hindi: 'अपना खाता हटाएं',
    burmese: 'သင်၏ အကောင့်ကို ဖျက်ပါ',
    thai: 'ลบบัญชีของคุณ',
    mandarin: '删除您的账户'
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
      'Setelah menghapus akun Anda, Anda tidak akan dapat mendaftar atau masuk saat offline. Anda harus online untuk membuat akun baru atau masuk.',
    nepali:
      'आफ्नो खाता मेटाएपछि, तपाईं अफलाइन हुँदा दर्ता वा लग इन गर्न सक्नुहुने छैन। नयाँ खाता बनाउन वा लग इन गर्न तपाईं अनलाइन हुनुपर्छ।',
    hindi:
      'खाता हटाने के बाद, आप ऑफलाइन होने पर पंजीकरण या लॉग इन नहीं कर सकेंगे। नया खाता बनाने या लॉग इन करने के लिए आपको ऑनलाइन होना चाहिए।',
    burmese:
      'သင်၏ အကောင့်ကို ဖျက်ပြီးနောက်၊ အင်တာနက် မရှိသောအခါ မှတ်ပုံတင်ခြင်း သို့မဟုတ် လော့ဂ်အင်လုပ်ခြင်း မပြုလုပ်နိုင်ပါ။ အကောင့်အသစ် ဖန်တီးရန် သို့မဟုတ် လော့ဂ်အင်လုပ်ရန် အင်တာနက် ချိတ်ဆက်ရပါမည်။',
    thai: 'หลังจากลบบัญชีแล้ว คุณจะไม่สามารถลงทะเบียนหรือเข้าสู่ระบบแบบออฟไลน์ได้ คุณต้องออนไลน์เพื่อสร้างบัญชีใหม่หรือเข้าสู่ระบบ',
    mandarin:
      '删除账户后，您将无法在离线时注册或登录。您必须在线才能创建新账户或登录。'
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
      'Akun Anda akan dinonaktifkan (penghapusan lunak). Semua data Anda akan dilestarikan, tetapi Anda tidak akan dapat mengakses aplikasi hingga Anda memulihkan akun Anda. Anda dapat memulihkan akun Anda kapan saja, tetapi Anda harus online untuk melakukannya.',
    nepali:
      'तपाईंको खाता निष्क्रिय गरिनेछ (सफ्ट डिलिट)। तपाईंको सबै डाटा सुरक्षित रहनेछ, तर तपाईंले आफ्नो खाता पुनर्स्थापना नगरेसम्म एप पहुँच गर्न सक्नुहुने छैन। तपाईं जुनसुकै बेला आफ्नो खाता पुनर्स्थापना गर्न सक्नुहुन्छ, तर त्यसका लागि तपाईं अनलाइन हुनुपर्छ।',
    hindi:
      'आपका खाता निष्क्रिय कर दिया जाएगा (सॉफ्ट डिलीट)। आपका सभी डेटा सुरक्षित रहेगा, लेकिन जब तक आप अपना खाता पुनर्स्थापित नहीं करते तब तक आप ऐप तक पहुंच नहीं सकेंगे। आप किसी भी समय अपना खाता पुनर्स्थापित कर सकते हैं, लेकिन इसके लिए आपको ऑनलाइन होना चाहिए।',
    burmese:
      'သင်၏ အကောင့်ကို ပိတ်သိမ်းမည် (ပျော့ပျောင်းဖျက်ခြင်း)။ သင်၏ ဒေတာအားလုံး ထိန်းသိမ်းမည်၊ သို့သော် သင်၏ အကောင့်ကို ပြန်လည်ရယူမသည်အထိ အက်ပ်ကို ဝင်ရောက်ခွင့် မရပါ။ မည်သည့်အချိန်မဆို အကောင့်ကို ပြန်လည်ရယူနိုင်ပါသည်၊ သို့သော် အင်တာနက် ချိတ်ဆက်ရပါမည်။',
    thai: 'บัญชีของคุณจะถูกปิดใช้งาน (การลบแบบนุ่มนวล) ข้อมูลทั้งหมดจะถูกเก็บไว้ แต่คุณจะไม่สามารถเข้าถึงแอปได้จนกว่าคุณจะกู้คืนบัญชี คุณสามารถกู้คืนบัญชีได้ตลอดเวลา แต่ต้องออนไลน์อยู่',
    mandarin:
      '您的账户将被停用（软删除）。您的所有数据将被保留，但在您恢复账户之前您将无法访问应用。您可以随时恢复账户，但必须在线。'
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
      'Semua kontribusi Anda (proyek, quest, aset, terjemahan, suara) akan dilestarikan dan akan tetap publik sesuai dengan syarat yang telah Anda setujui saat bergabung. Akun Anda dapat dipulihkan kapan saja, dan semua data Anda akan dapat diakses lagi.',
    nepali:
      'तपाईंका सबै योगदानहरू (प्रोजेक्टहरू, क्वेस्टहरू, एसेटहरू, अनुवादहरू, मतहरू) सुरक्षित रहनेछन् र तपाईंले सामेल हुँदा सहमत भएका सर्तहरू अनुसार सार्वजनिक रहनेछन्। तपाईंको खाता जुनसुकै बेला पुनर्स्थापना गर्न सकिन्छ, र तपाईंको सबै डाटा फेरि पहुँचयोग्य हुनेछ।',
    hindi:
      'आपके सभी योगदान (परियोजनाएं, क्वेस्ट, एसेट, अनुवाद, वोट) सुरक्षित रहेंगे और शामिल होने पर आपकी सहमति के अनुसार सार्वजनिक रहेंगे। आपका खाता किसी भी समय पुनर्स्थापित किया जा सकता है, और आपका सभी डेटा फिर से पहुंच योग्य होगा।',
    burmese:
      'သင်၏ ပါဝင်ဆောင်ရွက်မှုအားလုံး (စီမံကိန်းများ၊ ခရီးစဉ်များ၊ ပိုင်ဆိုင်မှုများ၊ ဘာသာပြန်ဆိုချက်များ၊ မဲများ) ထိန်းသိမ်းမည်၊ ပါဝင်ချိန်တွင် သဘောတူထားသော စည်းမျဉ်းများအရ များများပြည်သူမြင်နိုင်မည်။ မည်သည့်အချိန်မဆို အကောင့်ကို ပြန်လည်ရယူနိုင်ပါသည်။',
    thai: 'การมีส่วนร่วมทั้งหมดของคุณ (โครงการ ภารกิจ สินทรัพย์ การแปล  votes) จะถูกเก็บรักษาและจะยังคงเป็นสาธารณะตามข้อกำหนดที่คุณได้ตกลงเมื่อเข้าร่วม คุณสามารถกู้คืนบัญชีได้ตลอดเวลา และข้อมูลทั้งหมดจะเข้าถึงได้อีกครั้ง',
    mandarin:
      '您的所有贡献（项目、任务、资产、翻译、投票）将被保留，并将根据您加入时同意的条款保持公开。您可以随时恢复账户，所有数据将再次可访问。'
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
      'Apakah Anda benar-benar yakin ingin menghapus akun Anda? Anda dapat memulihkannya nanti, tetapi Anda harus online untuk melakukannya.',
    nepali:
      'के तपाईं आफ्नो खाता मेटाउन निश्चित हुनुहुन्छ? तपाईं यसलाई पछि पुनर्स्थापना गर्न सक्नुहुन्छ, तर त्यसका लागि तपाईं अनलाइन हुनुपर्छ।',
    hindi:
      'क्या आप वाकई अपना खाता हटाना चाहते हैं? आप इसे बाद में पुनर्स्थापित कर सकते हैं, लेकिन इसके लिए आपको ऑनलाइन होना चाहिए।',
    burmese:
      'သင်၏ အကောင့်ကို ဖျက်ရန် သေချာပါသလား? နောက်မှ ပြန်လည်ရယူနိုင်ပါသည်၊ သို့သော် အင်တာနက် ချိတ်ဆက်ရပါမည်။',
    thai: 'คุณแน่ใจหรือไม่ว่าต้องการลบบัญชี? คุณสามารถกู้คืนได้ในภายหลัง แต่ต้องออนไลน์อยู่',
    mandarin: '您确定要删除您的账户吗？您可以稍后恢复，但必须在线才能操作。'
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
      'Akun Anda akan dihapus (penghapusan lunak). Anda dapat memulihkannya nanti dari layar login, tetapi Anda harus online untuk memulihkannya.',
    nepali:
      'तपाईंको खाता मेटाइनेछ (सफ्ट डिलिट)। तपाईं यसलाई पछि लगइन स्क्रिनबाट पुनर्स्थापना गर्न सक्नुहुन्छ, तर पुनर्स्थापना गर्न तपाईं अनलाइन हुनुपर्छ।',
    hindi:
      'आपका खाता हटा दिया जाएगा (सॉफ्ट डिलीट)। आप इसे बाद में लॉगिन स्क्रीन से पुनर्स्थापित कर सकते हैं, लेकिन पुनर्स्थापित करने के लिए आपको ऑनलाइन होना चाहिए।',
    burmese:
      'သင်၏ အကောင့်ကို ဖျက်မည် (ပျော့ပျောင်းဖျက်ခြင်း)။ လော့ဂ်အင်စခရင်မှ ပြန်လည်ရယူနိုင်ပါသည်၊ သို့သော် အင်တာနက် ချိတ်ဆက်ရပါမည်။',
    thai: 'บัญชีของคุณจะถูกลบ (การลบแบบนุ่มนวล) คุณสามารถกู้คืนได้จากหน้าจอเข้าสู่ระบบในภายหลัง แต่ต้องออนไลน์อยู่เพื่อกู้คืน',
    mandarin:
      '您的账户将被删除（软删除）。您可以稍后从登录屏幕恢复，但必须在线才能恢复。'
  },
  accountDeletionStep1Title: {
    english: 'Step 1: Understand the Consequences',
    spanish: 'Paso 1: Entender las Consecuencias',
    brazilian_portuguese: 'Etapa 1: Entender as Consequências',
    tok_pisin: 'Step 1: Save ol Samting Bai Kamap',
    indonesian: 'Langkah 1: Pahami Konsekuensinya',
    nepali: 'चरण १: परिणामहरू बुझ्नुहोस्',
    hindi: 'चरण 1: परिणाम समझें',
    burmese: 'အဆင့် ၁: ရလဒ်များကို နားလည်ပါ',
    thai: 'ขั้นตอนที่ 1: ทำความเข้าใจผลที่ตามมา',
    mandarin: '步骤 1：了解后果'
  },
  accountDeletionStep2Title: {
    english: 'Step 2: Final Confirmation',
    spanish: 'Paso 2: Confirmación Final',
    brazilian_portuguese: 'Etapa 2: Confirmação Final',
    tok_pisin: 'Step 2: Final Confirm',
    indonesian: 'Langkah 2: Konfirmasi Akhir',
    nepali: 'चरण २: अन्तिम पुष्टि',
    hindi: 'चरण 2: अंतिम पुष्टि',
    burmese: 'အဆင့် ၂: နောက်ဆုံး အတည်ပြုချက်',
    thai: 'ขั้นตอนที่ 2: การยืนยันครั้งสุดท้าย',
    mandarin: '步骤 2：最终确认'
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
      'Akun Anda telah berhasil dihapus (penghapusan lunak). Anda dapat memulihkannya nanti, tetapi Anda harus online untuk melakukannya. Anda akan keluar sekarang.',
    nepali:
      'तपाईंको खाता सफलतापूर्वक मेटाइयो (सफ्ट डिलिट)। तपाईं यसलाई पछि पुनर्स्थापना गर्न सक्नुहुन्छ, तर त्यसका लागि तपाईं अनलाइन हुनुपर्छ। तपाईं अब साइन आउट हुनुहुनेछ।',
    hindi:
      'आपका खाता सफलतापूर्वक हटा दिया गया (सॉफ्ट डिलीट)। आप इसे बाद में पुनर्स्थापित कर सकते हैं, लेकिन इसके लिए आपको ऑनलाइन होना चाहिए। अब आप साइन आउट हो जाएंगे।',
    burmese:
      'သင်၏ အကောင့်ကို အောင်မြင်စွာ ဖျက်ပြီးပါပြီ (ပျော့ပျောင်းဖျက်ခြင်း)။ နောက်မှ ပြန်လည်ရယူနိုင်ပါသည်၊ သို့သော် အင်တာနက် ချိတ်ဆက်ရပါမည်။ ယခု လော့ဂ်အောက်ထွက်မည်။',
    thai: 'บัญชีของคุณถูกลบสำเร็จแล้ว (การลบแบบนุ่มนวล) คุณสามารถกู้คืนได้ในภายหลัง แต่ต้องออนไลน์อยู่ คุณจะถูกออกจากระบบตอนนี้',
    mandarin:
      '您的账户已成功删除（软删除）。您可以稍后恢复，但必须在线。您现在将被登出。'
  },
  accountDeletionError: {
    english: 'Failed to delete account: {error}',
    spanish: 'Error al eliminar la cuenta: {error}',
    brazilian_portuguese: 'Falha ao excluir conta: {error}',
    tok_pisin: 'I no inap rausim account: {error}',
    indonesian: 'Gagal menghapus akun: {error}',
    nepali: 'खाता मेटाउन असफल: {error}',
    hindi: 'खाता हटाने में विफल: {error}',
    burmese: 'အကောင့်ဖျက်ရန် မအောင်မြင်ပါ: {error}',
    thai: 'ลบบัญชีไม่สำเร็จ: {error}',
    mandarin: '删除账户失败: {error}'
  },
  accountDeletedTitle: {
    english: 'Account Deleted',
    spanish: 'Cuenta Eliminada',
    brazilian_portuguese: 'Conta Excluída',
    tok_pisin: 'Account i Raus',
    indonesian: 'Akun Dihapus',
    nepali: 'खाता मेटाइयो',
    hindi: 'खाता हटा दिया गया',
    burmese: 'အကောင့် ဖျက်ပြီးပါပြီ',
    thai: 'บัญชีถูกลบแล้ว',
    mandarin: '账户已删除'
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
      'Akun Anda telah dihapus. Anda dapat memulihkannya untuk mendapatkan kembali akses ke semua data Anda, atau Anda dapat keluar dan kembali ke layar login.',
    nepali:
      'तपाईंको खाता मेटाइएको छ। तपाईं आफ्नो सबै डाटामा पहुँच पुन: प्राप्त गर्न यसलाई पुनर्स्थापना गर्न सक्नुहुन्छ, वा तपाईं लगआउट गरेर लगइन स्क्रिनमा फर्कन सक्नुहुन्छ।',
    hindi:
      'आपका खाता हटा दिया गया है। आप इसे पुनर्स्थापित कर अपने सभी डेटा तक पहुंच पा सकते हैं, या लॉग आउट करके लॉगिन स्क्रीन पर वापस जा सकते हैं।',
    burmese:
      'သင်၏ အကောင့်ကို ဖျက်ပြီးပါပြီ။ ဒေတာအားလုံး ပြန်လည်ရယူရန် ပြန်လည်ရယူနိုင်ပါသည်၊ သို့မဟုတ် လော့ဂ်အောက်ထွက်၍ လော့ဂ်အင်စခရင်သို့ ပြန်သွားနိုင်ပါသည်။',
    thai: 'บัญชีของคุณถูกลบแล้ว คุณสามารถกู้คืนเพื่อเข้าถึงข้อมูลทั้งหมดของคุณได้ หรือออกจากระบบและกลับไปหน้าจอเข้าสู่ระบบ',
    mandarin:
      '您的账户已删除。您可以恢复它以重新访问所有数据，或登出并返回登录屏幕。'
  },
  restoreAccount: {
    english: 'Restore Account',
    spanish: 'Restaurar Cuenta',
    brazilian_portuguese: 'Restaurar Conta',
    tok_pisin: 'Restore Account',
    indonesian: 'Pulihkan Akun',
    nepali: 'खाता पुनर्स्थापना गर्नुहोस्',
    hindi: 'खाता पुनर्स्थापित करें',
    burmese: 'အကောင့်ကို ပြန်လည်ရယူပါ',
    thai: 'กู้คืนบัญชี',
    mandarin: '恢复账户'
  },
  restoreAccountConfirmTitle: {
    english: 'Restore Account?',
    spanish: '¿Restaurar Cuenta?',
    brazilian_portuguese: 'Restaurar Conta?',
    tok_pisin: 'Restore Account?',
    indonesian: 'Pulihkan Akun?',
    nepali: 'खाता पुनर्स्थापना गर्ने?',
    hindi: 'खाता पुनर्स्थापित करें?',
    burmese: 'အကောင့်ကို ပြန်လည်ရယူမလား?',
    thai: 'กู้คืนบัญชี?',
    mandarin: '恢复账户？'
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
      'Akun Anda akan dipulihkan sepenuhnya. Semua data Anda akan dapat diakses lagi, dan Anda dapat melanjutkan menggunakan aplikasi secara normal.',
    nepali:
      'तपाईंको खाता पूर्ण रूपमा पुनर्स्थापना गरिनेछ। तपाईंको सबै डाटा फेरि पहुँचयोग्य हुनेछ, र तपाईं सामान्य रूपमा एप प्रयोग जारी राख्न सक्नुहुन्छ।',
    hindi:
      'आपका खाता पूरी तरह से पुनर्स्थापित हो जाएगा। आपका सभी डेटा फिर से पहुंच योग्य होगा, और आप सामान्य रूप से ऐप का उपयोग जारी रख सकते हैं।',
    burmese:
      'သင်၏ အကောင့်ကို ပြည့်စုံစွာ ပြန်လည်ရယူမည်။ ဒေတာအားလုံး ပြန်လည်ဝင်ရောက်နိုင်မည်၊ အက်ပ်ကို ပုံမှန်ဆက်သုံးနိုင်ပါသည်။',
    thai: 'บัญชีของคุณจะถูกกู้คืนอย่างสมบูรณ์ ข้อมูลทั้งหมดจะเข้าถึงได้อีกครั้ง และคุณสามารถใช้แอปได้ตามปกติ',
    mandarin:
      '您的账户将被完全恢复。您的所有数据将再次可访问，您可以继续正常使用应用。'
  },
  accountRestoreSuccess: {
    english: 'Your account has been successfully restored. Welcome back!',
    spanish: 'Tu cuenta ha sido restaurada exitosamente. ¡Bienvenido de nuevo!',
    brazilian_portuguese:
      'Sua conta foi restaurada com sucesso. Bem-vindo de volta!',
    tok_pisin: 'Account bilong yu i restore pinis. Welkam bek!',
    indonesian: 'Akun Anda telah berhasil dipulihkan. Selamat datang kembali!',
    nepali: 'तपाईंको खाता सफलतापूर्वक पुनर्स्थापना गरियो। फेरि स्वागत छ!',
    hindi: 'आपका खाता सफलतापूर्वक पुनर्स्थापित हो गया। वापस स्वागत है!',
    burmese:
      'သင်၏ အကောင့်ကို အောင်မြင်စွာ ပြန်လည်ရယူပြီးပါပြီ။ ပြန်လာသည့်အတွက် ကြိုဆိုပါသည်!',
    thai: 'บัญชีของคุณถูกกู้คืนสำเร็จแล้ว ยินดีต้อนรับกลับ!',
    mandarin: '您的账户已成功恢复。欢迎回来！'
  },
  accountRestoreError: {
    english: 'Failed to restore account: {error}',
    spanish: 'Error al restaurar la cuenta: {error}',
    brazilian_portuguese: 'Falha ao restaurar conta: {error}',
    tok_pisin: 'I no inap restore account: {error}',
    indonesian: 'Gagal memulihkan akun: {error}',
    nepali: 'खाता पुनर्स्थापना गर्न असफल: {error}',
    hindi: 'खाता पुनर्स्थापित करने में विफल: {error}',
    burmese: 'အကောင့်ပြန်လည်ရယူရန် မအောင်မြင်ပါ: {error}',
    thai: 'กู้คืนบัญชีไม่สำเร็จ: {error}',
    mandarin: '恢复账户失败: {error}'
  },
  signInRequired: {
    english: 'Sign In Required',
    spanish: 'Inicio de Sesión Requerido',
    brazilian_portuguese: 'Login Necessário',
    tok_pisin: 'Mas I Mas Sign In',
    indonesian: 'Masuk Diperlukan',
    nepali: 'साइन इन आवश्यक छ',
    hindi: 'साइन इन आवश्यक',
    burmese: 'လော့ဂ်အင်လုပ်ရန် လိုအပ်သည်',
    thai: 'ต้องเข้าสู่ระบบ',
    mandarin: '需要登录'
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
      'Kami menyimpan informasi tentang apa yang akan diblokir di akun Anda. Silakan daftar untuk memastikan konten yang diblokir dapat disembunyikan dengan benar.',
    nepali:
      'हामी तपाईंको खातामा के ब्लक गर्ने बारे जानकारी भण्डारण गर्छौं। कृपया ब्लक गरिएको सामग्री राम्ररी लुकाउन सकिने सुनिश्चित गर्न दर्ता गर्नुहोस्।',
    hindi:
      'हम आपके खाते में क्या ब्लॉक करना है इसकी जानकारी संग्रहीत करते हैं। ब्लॉक की गई सामग्री को ठीक से छिपाने के लिए कृपया पंजीकरण करें।',
    burmese:
      'သင်၏ အကောင့်တွင် မည်သည့်အရာကို ပိတ်ဆို့မည်ကို ကျွန်ုပ်တို့ သိမ်းဆည်းပါသည်။ ပိတ်ဆို့ထားသော အကြောင်းအရာကို သင့်လျော်စွာ ဖျောက်ထားနိုင်ရန် ကျေးဇူးပြု၍ မှတ်ပုံတင်ပါ။',
    thai: 'เราเก็บข้อมูลเกี่ยวกับสิ่งที่ต้องบล็อกในบัญชีของคุณ กรุณาลงทะเบียนเพื่อให้แน่ใจว่าสามารถซ่อนเนื้อหาที่ถูกบล็อกได้อย่างถูกต้อง',
    mandarin:
      '我们在您的账户中存储有关要屏蔽内容的信息。请注册以确保被屏蔽的内容可以正确隐藏。'
  },
  connected: {
    english: 'Connected',
    spanish: 'Conectado',
    brazilian_portuguese: 'Conectado',
    tok_pisin: 'i connect pinis',
    indonesian: 'Terhubung',
    nepali: 'जडान भयो',
    hindi: 'कनेक्ट हो गया',
    burmese: 'ချိတ်ဆက်ပြီးပါပြီ',
    thai: 'เชื่อมต่อแล้ว',
    mandarin: '已连接'
  },
  downloadStatus: {
    english: 'Download Status',
    spanish: 'Estado de Descarga',
    brazilian_portuguese: 'Status de Download',
    tok_pisin: 'Download Status',
    indonesian: 'Status Unduhan',
    nepali: 'डाउनलोड स्थिति',
    hindi: 'डाउनलोड स्थिति',
    burmese: 'ဒေါင်းလုဒ် အခြေအနေ',
    thai: 'สถานะการดาวน์โหลด',
    mandarin: '下载状态'
  },
  powersyncStatus: {
    english: 'PowerSync Status',
    spanish: 'Estado de PowerSync',
    brazilian_portuguese: 'Status do PowerSync',
    tok_pisin: 'PowerSync Status',
    indonesian: 'Status PowerSync',
    nepali: 'PowerSync स्थिति',
    hindi: 'PowerSync स्थिति',
    burmese: 'PowerSync အခြေအနေ',
    thai: 'สถานะ PowerSync',
    mandarin: 'PowerSync 状态'
  },
  networkStatus: {
    english: 'Network Status',
    spanish: 'Estado de Red',
    brazilian_portuguese: 'Status da Rede',
    tok_pisin: 'Network Status',
    indonesian: 'Status Jaringan',
    nepali: 'नेटवर्क स्थिति',
    hindi: 'नेटवर्क स्थिति',
    burmese: 'အင်တာနက် အခြေအနေ',
    thai: 'สถานะเครือข่าย',
    mandarin: '网络状态'
  },
  attachmentDownloadProgress: {
    english: 'Attachment Download Progress',
    spanish: 'Progreso de Descarga de Archivos',
    brazilian_portuguese: 'Progresso de Download de Anexos',
    tok_pisin: 'Attachment Download Progress',
    indonesian: 'Kemajuan Unduhan Lampiran',
    nepali: 'संलग्नक डाउनलोड प्रगति',
    hindi: 'संलग्नक डाउनलोड प्रगति',
    burmese: 'ပူးတွဲဖိုင် ဒေါင်းလုဒ် တိုးတက်မှု',
    thai: 'ความคืบหน้าการดาวน์โหลดไฟล์แนบ',
    mandarin: '附件下载进度'
  },
  overallProgress: {
    english: 'Overall Progress',
    spanish: 'Progreso General',
    brazilian_portuguese: 'Progresso Geral',
    tok_pisin: 'Overall Progress',
    indonesian: 'Kemajuan Keseluruhan',
    nepali: 'समग्र प्रगति',
    hindi: 'कुल प्रगति',
    burmese: 'စုစုပေါင်း တိုးတက်မှု',
    thai: 'ความคืบหน้ารวม',
    mandarin: '总体进度'
  },
  currentDownload: {
    english: 'Current Download',
    spanish: 'Descarga Actual',
    brazilian_portuguese: 'Download Atual',
    tok_pisin: 'Current Download',
    indonesian: 'Unduhan Saat Ini',
    nepali: 'हालको डाउनलोड',
    hindi: 'वर्तमान डाउनलोड',
    burmese: 'လက်ရှိ ဒေါင်းလုဒ်',
    thai: 'การดาวน์โหลดปัจจุบัน',
    mandarin: '当前下载'
  },
  currentUpload: {
    english: 'Current Upload',
    spanish: 'Carga Actual',
    brazilian_portuguese: 'Upload Atual',
    tok_pisin: 'Current Upload',
    indonesian: 'Unggahan Saat Ini',
    nepali: 'हालको अपलोड',
    hindi: 'वर्तमान अपलोड',
    burmese: 'လက်ရှိ အပ်လုဒ်',
    thai: 'การอัปโหลดปัจจุบัน',
    mandarin: '当前上传'
  },
  queueStatus: {
    english: 'Queue Status',
    spanish: 'Estado de Cola',
    brazilian_portuguese: 'Status da Fila',
    tok_pisin: 'Queue Status',
    indonesian: 'Status Antrian',
    nepali: 'लाम स्थिति',
    hindi: 'कतार स्थिति',
    burmese: 'တန်းစီမှု အခြေအနေ',
    thai: 'สถานะคิว',
    mandarin: '队列状态'
  },
  allSynced: {
    english: 'All files synced',
    spanish: 'Todos los archivos sincronizados',
    brazilian_portuguese: 'Todos os arquivos sincronizados',
    tok_pisin: 'Olgeta file i sync pinis',
    indonesian: 'Semua file disinkronkan',
    nepali: 'सबै फाइलहरू सिङ्क भयो',
    hindi: 'सभी फाइलें सिंक हो गईं',
    burmese: 'ဖိုင်အားလုံး ထပ်တူပြုပြီးပါပြီ',
    thai: 'ไฟล์ทั้งหมดซิงค์แล้ว',
    mandarin: '所有文件已同步'
  },
  signInToViewDownloadStatus: {
    english: 'Please sign in to view download status and sync information.',
    spanish:
      'Por favor inicia sesión para ver el estado de descarga e información de sincronización.',
    brazilian_portuguese:
      'Por favor, faça login para ver o status de download e informações de sincronização.',
    tok_pisin: 'Plis sign in long lukim download status na sync info.',
    indonesian:
      'Silakan masuk untuk melihat status unduhan dan informasi sinkronisasi.',
    nepali: 'कृपया डाउनलोड स्थिति र सिंक जानकारी हेर्न साइन इन गर्नुहोस्।',
    hindi: 'कृपया डाउनलोड स्थिति और सिंक जानकारी देखने के लिए साइन इन करें।',
    burmese:
      'ဒေါင်းလုဒ် အခြေအနေနှင့် ထပ်တူပြုခြင်း အချက်အလက်များကို ကြည့်ရှုရန် ကျေးဇူးပြု၍ ဝင်ရောက်ပါ။',
    thai: 'กรุณาเข้าสู่ระบบเพื่อดูสถานะการดาวน์โหลดและข้อมูลการซิงค์',
    mandarin: '请登录以查看下载状态和同步信息。'
  },
  unsynced: {
    english: 'Unsynced',
    spanish: 'No sincronizado',
    brazilian_portuguese: 'Não sincronizado',
    tok_pisin: 'i no sync yet',
    indonesian: 'Tidak disinkronkan',
    nepali: 'सिङ्क भएको छैन',
    hindi: 'सिंक नहीं हुआ',
    burmese: 'ထပ်တူမပြုရသေး',
    thai: 'ยังไม่ได้ซิงค์',
    mandarin: '未同步'
  },
  onboardingCreateProjectTitle: {
    english: 'Record a Bible, or any other content',
    spanish: 'Graba una Biblia o cualquier otro contenido',
    brazilian_portuguese: 'Grave uma Bíblia ou qualquer outro conteúdo',
    tok_pisin: 'Rekodim Baibel o ol narapela samting',
    indonesian: 'Rekam Alkitab atau konten lainnya',
    nepali: 'बाइबल वा अन्य कुनै पनि सामग्री रेकर्ड गर्नुहोस्',
    hindi: 'बाइबल या कोई अन्य सामग्री रिकॉर्ड करें',
    burmese: 'ကျမ်းစာ သို့မဟုတ် အခြားမည်သည့် အကြောင်းအရာကိုမဆို မှတ်တမ်းတင်ပါ',
    thai: 'บันทึกพระคัมภีร์หรือเนื้อหาอื่นๆ',
    mandarin: '录制圣经或任何其他内容'
  },
  onboardingCreateProjectSubtitle: {
    english: 'Start by creating your first project',
    spanish: 'Comienza creando tu primer proyecto',
    brazilian_portuguese: 'Comece criando seu primeiro projeto',
    tok_pisin: 'Stat long mekim nupela projek',
    indonesian: 'Mulai dengan membuat proyek pertama Anda',
    nepali: 'आफ्नो पहिलो प्रोजेक्ट सिर्जना गरेर सुरु गर्नुहोस्',
    hindi: 'अपना पहला प्रोजेक्ट बनाकर शुरू करें',
    burmese: 'သင်၏ ပထမဆုံး ပရောဂျက်ကို ဖန်တီးခြင်းဖြင့် စတင်ပါ',
    thai: 'เริ่มต้นด้วยการสร้างโปรเจกต์แรกของคุณ',
    mandarin: '通过创建您的第一个项目开始'
  },
  onboardingCreateProjectExample: {
    english: 'Stories',
    spanish: 'Historias',
    brazilian_portuguese: 'Histórias',
    tok_pisin: 'Stori',
    indonesian: 'Cerita',
    nepali: 'कथाहरू',
    hindi: 'कहानियाँ',
    burmese: 'ပုံပြင်များ',
    thai: 'เรื่องราว',
    mandarin: '故事'
  },
  onboardingCreateProjectDescription: {
    english: 'Example project name',
    spanish: 'Nombre de proyecto de ejemplo',
    brazilian_portuguese: 'Nome do projeto de exemplo',
    tok_pisin: 'Nem bilong projek olsem',
    indonesian: 'Nama proyek contoh',
    nepali: 'उदाहरण प्रोजेक्ट नाम',
    hindi: 'उदाहरण प्रोजेक्ट नाम',
    burmese: 'ဥပမာ ပရောဂျက် အမည်',
    thai: 'ชื่อโปรเจกต์ตัวอย่าง',
    mandarin: '示例项目名称'
  },
  onboardingCreateProject: {
    english: 'Create Project',
    spanish: 'Crear Proyecto',
    brazilian_portuguese: 'Criar Projeto',
    tok_pisin: 'Mekim Projek',
    indonesian: 'Buat Proyek',
    nepali: 'प्रोजेक्ट सिर्जना गर्नुहोस्',
    hindi: 'प्रोजेक्ट बनाएं',
    burmese: 'ပရောဂျက် ဖန်တီးပါ',
    thai: 'สร้างโปรเจกต์',
    mandarin: '创建项目'
  },
  onboardingCreateQuestTitle: {
    english: 'Organize your content',
    spanish: 'Organiza tu contenido',
    brazilian_portuguese: 'Organize seu conteúdo',
    tok_pisin: 'Oganaisim samting bilong yu',
    indonesian: 'Organisir konten Anda',
    nepali: 'आफ्नो सामग्री व्यवस्थित गर्नुहोस्',
    hindi: 'अपनी सामग्री व्यवस्थित करें',
    burmese: 'သင်၏ အကြောင်းအရာကို စီစဉ်ပါ',
    thai: 'จัดระเบียบเนื้อหาของคุณ',
    mandarin: '整理您的内容'
  },
  onboardingCreateQuestSubtitle: {
    english: 'Add quests to break down your project into manageable pieces',
    spanish: 'Agrega misiones para dividir tu proyecto en partes manejables',
    brazilian_portuguese:
      'Adicione missões para dividir seu projeto em partes gerenciáveis',
    tok_pisin: 'Putim kwest long brukim projek i go long liklik hap',
    indonesian:
      'Tambahkan quest untuk membagi proyek Anda menjadi bagian yang dapat dikelola',
    nepali:
      'आफ्नो प्रोजेक्टलाई व्यवस्थापन योग्य टुक्राहरूमा विभाजन गर्न क्वेस्टहरू थप्नुहोस्',
    hindi:
      'अपने प्रोजेक्ट को प्रबंधनीय टुकड़ों में विभाजित करने के लिए क्वेस्ट जोड़ें',
    burmese:
      'သင်၏ ပရောဂျက်ကို စီမံခန့်ခွဲနိုင်သော အပိုင်းများအဖြစ် ခွဲရန် quest များ ထည့်ပါ',
    thai: 'เพิ่มเควสต์เพื่อแบ่งโปรเจกต์ของคุณออกเป็นส่วนที่จัดการได้',
    mandarin: '添加任务以将您的项目分解为可管理的部分'
  },
  onboardingQuestExample1: {
    english: 'Story 1',
    spanish: 'Historia 1',
    brazilian_portuguese: 'História 1',
    tok_pisin: 'Stori 1',
    indonesian: 'Cerita 1',
    nepali: 'कथा १',
    hindi: 'कहानी 1',
    burmese: 'ပုံပြင် ၁',
    thai: 'เรื่องราว 1',
    mandarin: '故事 1'
  },
  onboardingQuestExample2: {
    english: 'Story 2',
    spanish: 'Historia 2',
    brazilian_portuguese: 'História 2',
    tok_pisin: 'Stori 2',
    indonesian: 'Cerita 2',
    nepali: 'कथा २',
    hindi: 'कहानी 2',
    burmese: 'ပုံပြင် ၂',
    thai: 'เรื่องราว 2',
    mandarin: '故事 2'
  },
  onboardingCreateQuest: {
    english: 'Create Quest',
    spanish: 'Crear Misión',
    brazilian_portuguese: 'Criar Missão',
    tok_pisin: 'Mekim Kwest',
    indonesian: 'Buat Quest',
    nepali: 'क्वेस्ट सिर्जना गर्नुहोस्',
    hindi: 'क्वेस्ट बनाएं',
    burmese: 'Quest ဖန်တီးပါ',
    thai: 'สร้างเควสต์',
    mandarin: '创建任务'
  },
  onboardingRecordAudioTitle: {
    english: 'Start recording',
    spanish: 'Comienza a grabar',
    brazilian_portuguese: 'Comece a gravar',
    tok_pisin: 'Stat long rekodim',
    indonesian: 'Mulai merekam',
    nepali: 'रेकर्डिङ सुरु गर्नुहोस्',
    hindi: 'रिकॉर्डिंग शुरू करें',
    burmese: 'မှတ်တမ်းတင်ခြင်း စတင်ပါ',
    thai: 'เริ่มบันทึก',
    mandarin: '开始录制'
  },
  onboardingRecordAudioSubtitle: {
    english: 'Hold the button to record, or slide to record anytime you talk',
    spanish:
      'Mantén presionado el botón para grabar, o desliza para grabar cuando hables',
    brazilian_portuguese:
      'Mantenha pressionado o botão para gravar ou deslize para gravar quando falar',
    tok_pisin:
      'Holim button long rekodim, o slipim long rekodim taim yu toktok',
    indonesian:
      'Tahan tombol untuk merekam, atau geser untuk merekam kapan saja Anda berbicara',
    nepali:
      'रेकर्ड गर्न बटन थिच्नुहोस्, वा तपाईं बोल्दा जुनसुकै बेला रेकर्ड गर्न स्लाइड गर्नुहोस्',
    hindi:
      'रिकॉर्ड करने के लिए बटन दबाए रखें, या जब भी आप बोलें तो रिकॉर्ड करने के लिए स्लाइड करें',
    burmese:
      'မှတ်တမ်းတင်ရန် ခလုတ်ကို ကိုင်ထားပါ သို့မဟုတ် သင်စကားပြောသောအခါ မှတ်တမ်းတင်ရန် ရွှေ့ပါ',
    thai: 'กดปุ่มค้างไว้เพื่อบันทึก หรือเลื่อนเพื่อบันทึกเมื่อใดก็ตามที่คุณพูด',
    mandarin: '按住按钮录制，或滑动以在您说话时随时录制'
  },
  onboardingRecordMethod1: {
    english: 'Hold button to record',
    spanish: 'Mantén presionado para grabar',
    brazilian_portuguese: 'Mantenha pressionado para gravar',
    tok_pisin: 'Holim button long rekodim',
    indonesian: 'Tahan tombol untuk merekam',
    nepali: 'रेकर्ड गर्न बटन थिच्नुहोस्',
    hindi: 'रिकॉर्ड करने के लिए बटन दबाए रखें',
    burmese: 'မှတ်တမ်းတင်ရန် ခလုတ်ကို ကိုင်ထားပါ',
    thai: 'กดปุ่มค้างไว้เพื่อบันทึก',
    mandarin: '按住按钮录制'
  },
  onboardingRecordMethod2: {
    english: 'Slide to record anytime you talk',
    spanish: 'Desliza para grabar cuando hables',
    brazilian_portuguese: 'Deslize para gravar quando falar',
    tok_pisin: 'Slipim long rekodim taim yu toktok',
    indonesian: 'Geser untuk merekam kapan saja Anda berbicara',
    nepali: 'बोल्दा जुनसुकै बेला रेकर्ड गर्न स्लाइड गर्नुहोस्',
    hindi: 'जब भी आप बोलें तो रिकॉर्ड करने के लिए स्लाइड करें',
    burmese: 'သင်စကားပြောသောအခါ မှတ်တမ်းတင်ရန် ရွှေ့ပါ',
    thai: 'เลื่อนเพื่อบันทึกเมื่อใดก็ตามที่คุณพูด',
    mandarin: '滑动以在您说话时随时录制'
  },
  onboardingStartRecording: {
    english: 'Start Recording',
    spanish: 'Comenzar Grabación',
    brazilian_portuguese: 'Iniciar Gravação',
    tok_pisin: 'Stat Rekodim',
    indonesian: 'Mulai Merekam',
    nepali: 'रेकर्डिङ सुरु गर्नुहोस्',
    hindi: 'रिकॉर्डिंग शुरू करें',
    burmese: 'မှတ်တမ်းတင်ခြင်း စတင်ပါ',
    thai: 'เริ่มบันทึก',
    mandarin: '开始录制'
  },
  onboardingInviteTitle: {
    english: 'Work together',
    spanish: 'Trabaja en equipo',
    brazilian_portuguese: 'Trabalhe juntos',
    tok_pisin: 'Wok wantaim',
    indonesian: 'Bekerja bersama',
    nepali: 'सँगै काम गर्नुहोस्',
    hindi: 'साथ में काम करें',
    burmese: 'အတူတကွ လုပ်ဆောင်ပါ',
    thai: 'ทำงานร่วมกัน',
    mandarin: '一起工作'
  },
  onboardingInviteSubtitle: {
    english:
      "Invite others to collaborate. They'll receive a notification and see your project in their list",
    spanish:
      'Invita a otros a colaborar. Recibirán una notificación y verán tu proyecto en su lista',
    brazilian_portuguese:
      'Convide outros para colaborar. Eles receberão uma notificação e verão seu projeto em sua lista',
    tok_pisin:
      'Singim ol narapela long wok wantaim. Bai ol kisim notis na lukim projek bilong yu long list bilong ol',
    indonesian:
      'Undang orang lain untuk berkolaborasi. Mereka akan menerima notifikasi dan melihat proyek Anda di daftar mereka',
    nepali:
      'अरूलाई सहयोग गर्न निम्तो दिनुहोस्। उनीहरूले सूचना प्राप्त गर्नेछन् र उनीहरूको सूचीमा तपाईंको प्रोजेक्ट देख्नेछन्',
    hindi:
      'दूसरों को सहयोग करने के लिए आमंत्रित करें। उन्हें एक सूचना मिलेगी और वे अपनी सूची में आपका प्रोजेक्ट देखेंगे',
    burmese:
      'အခြားသူများကို ပူးပေါင်းလုပ်ဆောင်ရန် ဖိတ်ခေါ်ပါ။ သူတို့သည် အကြောင်းကြားချက်တစ်ခု ရရှိမည်ဖြစ်ပြီး သူတို့၏ စာရင်းတွင် သင်၏ ပရောဂျက်ကို မြင်ရမည်',
    thai: 'เชิญผู้อื่นให้ร่วมมือกัน พวกเขาจะได้รับการแจ้งเตือนและเห็นโปรเจกต์ของคุณในรายการของพวกเขา',
    mandarin: '邀请他人协作。他们将收到通知并在他们的列表中看到您的项目'
  },
  onboardingInviteBenefit1: {
    english: 'They receive a notification',
    spanish: 'Reciben una notificación',
    brazilian_portuguese: 'Eles recebem uma notificação',
    tok_pisin: 'Ol kisim notis',
    indonesian: 'Mereka menerima notifikasi',
    nepali: 'उनीहरूले सूचना प्राप्त गर्छन्',
    hindi: 'उन्हें एक सूचना मिलती है',
    burmese: 'သူတို့သည် အကြောင်းကြားချက်တစ်ခု ရရှိသည်',
    thai: 'พวกเขาได้รับการแจ้งเตือน',
    mandarin: '他们会收到通知'
  },
  onboardingInviteBenefit2: {
    english: 'Project appears in their list',
    spanish: 'El proyecto aparece en su lista',
    brazilian_portuguese: 'O projeto aparece em sua lista',
    tok_pisin: 'Projek i kamap long list bilong ol',
    indonesian: 'Proyek muncul di daftar mereka',
    nepali: 'प्रोजेक्ट उनीहरूको सूचीमा देखिन्छ',
    hindi: 'प्रोजेक्ट उनकी सूची में दिखाई देता है',
    burmese: 'ပရောဂျက်သည် သူတို့၏ စာရင်းတွင် ပေါ်လာသည်',
    thai: 'โปรเจกต์ปรากฏในรายการของพวกเขา',
    mandarin: '项目出现在他们的列表中'
  },
  onboardingInviteCollaborators: {
    english: 'Invite Collaborators',
    spanish: 'Invitar Colaboradores',
    brazilian_portuguese: 'Convidar Colaboradores',
    tok_pisin: 'Singim Ol Wokman',
    indonesian: 'Undang Kolaborator',
    nepali: 'सहकर्मीहरूलाई निम्तो दिनुहोस्',
    hindi: 'सहयोगियों को आमंत्रित करें',
    burmese: 'ပူးပေါင်းလုပ်ဆောင်သူများကို ဖိတ်ခေါ်ပါ',
    thai: 'เชิญผู้ร่วมงาน',
    mandarin: '邀请协作者'
  },
  onboardingContinue: {
    english: 'Continue',
    spanish: 'Continuar',
    brazilian_portuguese: 'Continuar',
    tok_pisin: 'Gohet',
    indonesian: 'Lanjutkan',
    nepali: 'जारी राख्नुहोस्',
    hindi: 'जारी रखें',
    burmese: 'ဆက်လုပ်ပါ',
    thai: 'ดำเนินการต่อ',
    mandarin: '继续'
  },
  onboardingBible: {
    english: 'Bible',
    spanish: 'Biblia',
    brazilian_portuguese: 'Bíblia',
    tok_pisin: 'Baibel',
    indonesian: 'Alkitab',
    nepali: 'बाइबल',
    hindi: 'बाइबल',
    burmese: 'ကျမ်းစာ',
    thai: 'พระคัมภีร์',
    mandarin: '圣经'
  },
  onboardingOther: {
    english: 'Other',
    spanish: 'Otro',
    brazilian_portuguese: 'Outro',
    tok_pisin: 'Narapela',
    indonesian: 'Lainnya',
    nepali: 'अन्य',
    hindi: 'अन्य',
    burmese: 'အခြား',
    thai: 'อื่นๆ',
    mandarin: '其他'
  },
  onboardingBibleSelectBookTitle: {
    english: 'Select a Book',
    spanish: 'Selecciona un Libro',
    brazilian_portuguese: 'Selecione um Livro',
    tok_pisin: 'Pilim Buk',
    indonesian: 'Pilih Buku',
    nepali: 'एउटा पुस्तक चयन गर्नुहोस्',
    hindi: 'एक पुस्तक चुनें',
    burmese: 'စာအုပ်တစ်အုပ်ကို ရွေးပါ',
    thai: 'เลือกหนังสือ',
    mandarin: '选择一本书'
  },
  onboardingBibleSelectBookSubtitle: {
    english: 'Choose which book of the Bible to translate',
    spanish: 'Elige qué libro de la Biblia traducir',
    brazilian_portuguese: 'Escolha qual livro da Bíblia traduzir',
    tok_pisin: 'Pilim wanpela buk bilong Baibel long tanim',
    indonesian: 'Pilih buku Alkitab mana yang akan diterjemahkan',
    nepali: 'बाइबलको कुन पुस्तक अनुवाद गर्ने छान्नुहोस्',
    hindi: 'चुनें कि बाइबल की कौन सी पुस्तक का अनुवाद करना है',
    burmese: 'ကျမ်းစာ၏ မည်သည့် စာအုပ်ကို ဘာသာပြန်ရမည်ကို ရွေးပါ',
    thai: 'เลือกหนังสือเล่มไหนของพระคัมภีร์ที่จะแปล',
    mandarin: '选择要翻译的圣经书籍'
  },
  onboardingBibleBookExample1: {
    english: 'Genesis',
    spanish: 'Génesis',
    brazilian_portuguese: 'Gênesis',
    tok_pisin: 'Jenesis',
    indonesian: 'Kejadian',
    nepali: 'उत्पत्ति',
    hindi: 'उत्पत्ति',
    burmese: 'ကာလအစ',
    thai: 'ปฐมกาล',
    mandarin: '创世记'
  },
  onboardingBibleBookExample2: {
    english: 'Matthew',
    spanish: 'Mateo',
    brazilian_portuguese: 'Mateus',
    tok_pisin: 'Matyu',
    indonesian: 'Matius',
    nepali: 'मत्ती',
    hindi: 'मत्ती',
    burmese: 'မဿဲ',
    thai: 'มัทธิว',
    mandarin: '马太福音'
  },
  onboardingBibleCreateChapterTitle: {
    english: 'Create Chapter Quests',
    spanish: 'Crear Quests de Capítulos',
    brazilian_portuguese: 'Criar Quests de Capítulos',
    tok_pisin: 'Mekim Ol Kwest bilong Kapitol',
    indonesian: 'Buat Quest Bab',
    nepali: 'अध्याय क्वेस्टहरू सिर्जना गर्नुहोस्',
    hindi: 'अध्याय क्वेस्ट बनाएं',
    burmese: 'အခန်း Quest များ ဖန်တီးပါ',
    thai: 'สร้างเควสต์บท',
    mandarin: '创建章节任务'
  },
  onboardingBibleCreateChapterSubtitle: {
    english: 'Each chapter becomes a quest you can work on',
    spanish:
      'Cada capítulo se convierte en una quest en la que puedes trabajar',
    brazilian_portuguese:
      'Cada capítulo se torna uma quest em que você pode trabalhar',
    tok_pisin: 'Olgeta kapitol i kamap wanpela kwest yu ken wok long en',
    indonesian: 'Setiap bab menjadi quest yang dapat Anda kerjakan',
    nepali: 'प्रत्येक अध्याय एउटा क्वेस्ट बन्छ जसमा तपाईं काम गर्न सक्नुहुन्छ',
    hindi: 'प्रत्येक अध्याय एक क्वेस्ट बन जाता है जिस पर आप काम कर सकते हैं',
    burmese: 'အခန်းတစ်ခန်းစီသည် သင်လုပ်ဆောင်နိုင်သော quest တစ်ခု ဖြစ်လာသည်',
    thai: 'แต่ละบทจะกลายเป็นเควสต์ที่คุณสามารถทำงานได้',
    mandarin: '每一章都成为一个您可以处理的任务'
  },
  onboardingBibleChapterExample1: {
    english: 'Chapter 1',
    spanish: 'Capítulo 1',
    brazilian_portuguese: 'Capítulo 1',
    tok_pisin: 'Kapitol 1',
    indonesian: 'Bab 1',
    nepali: 'अध्याय १',
    hindi: 'अध्याय 1',
    burmese: 'အခန်း ၁',
    thai: 'บทที่ 1',
    mandarin: '第1章'
  },
  onboardingBibleChapterExample2: {
    english: 'Chapter 2',
    spanish: 'Capítulo 2',
    brazilian_portuguese: 'Capítulo 2',
    tok_pisin: 'Kapitol 2',
    indonesian: 'Bab 2',
    nepali: 'अध्याय २',
    hindi: 'अध्याय 2',
    burmese: 'အခန်း ၂',
    thai: 'บทที่ 2',
    mandarin: '第2章'
  },
  onboardingVisionTitle: {
    english: 'Every language. Every culture.',
    spanish: 'Cada idioma. Cada cultura.',
    brazilian_portuguese: 'Cada idioma. Cada cultura.',
    tok_pisin: 'Olgeta tokples. Olgeta kalsa.',
    indonesian: 'Setiap bahasa. Setiap budaya.',
    nepali: 'प्रत्येक भाषा। प्रत्येक संस्कृति।',
    hindi: 'हर भाषा। हर संस्कृति।',
    burmese: 'ဘာသာစကားတိုင်း။ ယဉ်ကျေးမှုတိုင်း။',
    thai: 'ทุกภาษา ทุกวัฒนธรรม',
    mandarin: '每种语言。每种文化。'
  },
  onboardingVisionSubtitle: {
    english:
      'Collect text and audio language data quickly. Local-first, sync when connected. Collaborate, translate, validate.',
    spanish:
      'Recopila datos de texto y audio de idiomas rápidamente. Primero local, sincroniza cuando estés conectado. Colabora, traduce, valida.',
    brazilian_portuguese:
      'Colete dados de texto e áudio de idiomas rapidamente. Primeiro local, sincronize quando conectado. Colabore, traduza, valide.',
    tok_pisin:
      'Kisim ol text na audio bilong tokples kwiktaim. Stat long lokal, sync taim yu gat internet. Wok wantaim, tanim tokples, stretim.',
    indonesian:
      'Kumpulkan data bahasa teks dan audio dengan cepat. Lokal pertama, sinkronkan saat terhubung. Berkolaborasi, terjemahkan, validasi.',
    nepali:
      'पाठ र अडियो भाषा डाटा छिट्टै सङ्कलन गर्नुहोस्। स्थानीय-प्रथम, जडान हुँदा सिंक गर्नुहोस्। सहयोग गर्नुहोस्, अनुवाद गर्नुहोस्, प्रमाणित गर्नुहोस्।',
    hindi:
      'पाठ और ऑडियो भाषा डेटा जल्दी से एकत्र करें। स्थानीय-प्रथम, कनेक्ट होने पर सिंक करें। सहयोग करें, अनुवाद करें, मान्य करें।',
    burmese:
      'စာသားနှင့် အသံ ဘာသာစကား ဒေတာများကို အမြန်စုဆောင်းပါ။ ဒေသတွင်း-ဦးစားပေး၊ ချိတ်ဆက်သောအခါ ထပ်တူပြုပါ။ ပူးပေါင်းလုပ်ဆောင်ပါ၊ ဘာသာပြန်ပါ၊ အတည်ပြုပါ။',
    thai: 'รวบรวมข้อมูลภาษาข้อความและเสียงอย่างรวดเร็ว เน้นท้องถิ่นก่อน ซิงค์เมื่อเชื่อมต่อ ร่วมมือ แปล และตรวจสอบ',
    mandarin:
      '快速收集文本和音频语言数据。本地优先，连接时同步。协作、翻译、验证。'
  },
  onboardingVisionStatement1: {
    english: "Every language having access to the world's knowledge.",
    spanish: 'Cada idioma con acceso al conocimiento del mundo.',
    brazilian_portuguese: 'Cada idioma tendo acesso ao conhecimento do mundo.',
    tok_pisin: 'Olgeta tokples i gat akses long save bilong wol.',
    indonesian: 'Setiap bahasa memiliki akses ke pengetahuan dunia.',
    nepali: 'प्रत्येक भाषाले विश्वको ज्ञानमा पहुँच पाउने।',
    hindi: 'हर भाषा को दुनिया के ज्ञान तक पहुंच हो।',
    burmese: 'ဘာသာစကားတိုင်းသည် ကမ္ဘာ၏ အသိပညာသို့ ရောက်ရှိနိုင်သည်။',
    thai: 'ทุกภาษามีการเข้าถึงความรู้ของโลก',
    mandarin: '每种语言都能获得世界知识。'
  },
  onboardingVisionStatement2: {
    english: 'Every culture sharing its meaning with the world.',
    spanish: 'Cada cultura compartiendo su significado con el mundo.',
    brazilian_portuguese:
      'Cada cultura compartilhando seu significado com o mundo.',
    tok_pisin: 'Olgeta kalsa i salim save bilong en i go long wol.',
    indonesian: 'Setiap budaya berbagi maknanya dengan dunia.',
    nepali: 'प्रत्येक संस्कृतिले आफ्नो अर्थ विश्वसँग साझा गर्ने।',
    hindi: 'हर संस्कृति अपना अर्थ दुनिया के साथ साझा कर रही है।',
    burmese: 'ယဉ်ကျေးမှုတိုင်းသည် ၎င်း၏ အဓိပ္ပာယ်ကို ကမ္ဘာနှင့် မျှဝေနေသည်။',
    thai: 'ทุกวัฒนธรรมแบ่งปันความหมายกับโลก',
    mandarin: '每种文化都在与世界分享其意义。'
  },
  onboardingVisionCC0: {
    english: 'CC0/public domain data ensures no party can stop this vision.',
    spanish:
      'Los datos CC0/dominio público garantizan que ninguna parte pueda detener esta visión.',
    brazilian_portuguese:
      'Dados CC0/domínio público garantem que nenhuma parte possa impedir esta visão.',
    tok_pisin:
      'CC0/pablik domain data i mekim olsem wanpela man o grup i no inap stopim dispela visen.',
    indonesian:
      'Data CC0/domain publik memastikan tidak ada pihak yang dapat menghentikan visi ini.',
    nepali:
      'CC0/सार्वजनिक डोमेन डाटाले कुनै पनि पक्षले यो दृष्टिकोणलाई रोक्न नसक्ने सुनिश्चित गर्छ।',
    hindi:
      'CC0/सार्वजनिक डोमेन डेटा सुनिश्चित करता है कि कोई भी पक्ष इस दृष्टि को रोक नहीं सकता।',
    burmese:
      'CC0/ပြည်သူ့ဒိုမိန်း ဒေတာသည် မည်သည့်အဖွဲ့မျှ ဤမျှော်မှန်းချက်ကို ရပ်တန့်နိုင်မည်မဟုတ်ကြောင်း သေချာစေသည်။',
    thai: 'ข้อมูล CC0/สาธารณสมบัติรับประกันว่าไม่มีฝ่ายใดสามารถหยุดวิสัยทัศน์นี้ได้',
    mandarin: 'CC0/公共领域数据确保没有任何一方可以阻止这一愿景。'
  },
  onboardingOurVision: {
    english: 'Our Vision',
    spanish: 'Nuestra Visión',
    brazilian_portuguese: 'Nossa Visão',
    tok_pisin: 'Visen Bilong Mipela',
    indonesian: 'Visi Kami',
    nepali: 'हाम्रो दृष्टि',
    hindi: 'हमारी दृष्टि',
    burmese: 'ကျွန်ုပ်တို့၏ မျှော်မှန်းချက်',
    thai: 'วิสัยทัศน์ของเรา',
    mandarin: '我们的愿景'
  },
  onboardingSelectLanguageTitle: {
    english: 'Choose Your Language',
    spanish: 'Elige Tu Idioma',
    brazilian_portuguese: 'Escolha Seu Idioma',
    tok_pisin: 'Pilim Tokples Bilong Yu',
    indonesian: 'Pilih Bahasa Anda',
    nepali: 'आफ्नो भाषा छान्नुहोस्',
    hindi: 'अपनी भाषा चुनें',
    burmese: 'သင်၏ ဘာသာစကားကို ရွေးပါ',
    thai: 'เลือกภาษาของคุณ',
    mandarin: '选择您的语言'
  },
  onboardingSelectLanguageSubtitle: {
    english: "Select the language you'd like to use for the app interface",
    spanish:
      'Selecciona el idioma que deseas usar para la interfaz de la aplicación',
    brazilian_portuguese:
      'Selecione o idioma que deseja usar para a interface do aplicativo',
    tok_pisin: 'Pilim tokples yu laikim long yusim long app',
    indonesian: 'Pilih bahasa yang ingin Anda gunakan untuk antarmuka aplikasi',
    nepali: 'एप इन्टरफेसको लागि तपाईं प्रयोग गर्न चाहनुहुने भाषा चयन गर्नुहोस्',
    hindi: 'ऐप इंटरफेस के लिए आप जिस भाषा का उपयोग करना चाहते हैं उसे चुनें',
    burmese: 'အက်ပ်၏ အင်တာဖေ့စ်အတွက် အသုံးပြုလိုသော ဘာသာစကားကို ရွေးပါ',
    thai: 'เลือกภาษาที่คุณต้องการใช้สำหรับอินเทอร์เฟซแอป',
    mandarin: '选择您希望用于应用界面的语言'
  },
  exportProgress: {
    english: 'Export Progress',
    spanish: 'Progreso de Exportación',
    brazilian_portuguese: 'Progresso de Exportação',
    tok_pisin: 'Export Progress',
    indonesian: 'Progres Exportasi',
    nepali: 'निर्यात प्रगति',
    hindi: 'निर्यात प्रगति',
    burmese: 'တင်ပို့မှု တိုးတက်မှု',
    thai: 'ความคืบหน้าการส่งออก',
    mandarin: '导出进度'
  },
  exporting: {
    english: 'Exporting chapter... This may take a few moments.',
    spanish: 'Exportando capítulo... Esto puede tomar unos momentos.',
    brazilian_portuguese:
      'Exportando capítulo... Isso pode levar alguns momentos.',
    tok_pisin: 'Exporting chapter... This may take a few moments.',
    indonesian: 'Mengekspor bab... Ini mungkin memakan beberapa saat.',
    nepali: 'अध्याय निर्यात गर्दै... यसले केही क्षण लिन सक्छ।',
    hindi: 'अध्याय निर्यात हो रहा है... इसमें कुछ क्षण लग सकते हैं।',
    burmese: 'အခန်းကို တင်ပို့နေသည်... ခဏကြာနိုင်ပါသည်။',
    thai: 'กำลังส่งออกบท... อาจใช้เวลาสักครู่',
    mandarin: '正在导出章节... 可能需要一些时间。'
  },
  exportReady: {
    english: 'Export is ready!',
    spanish: 'Exportación lista!',
    brazilian_portuguese: 'Exportação pronta!',
    tok_pisin: 'Export is ready!',
    indonesian: 'Ekspor siap!',
    nepali: 'निर्यात तयार छ!',
    hindi: 'निर्यात तैयार है!',
    burmese: 'တင်ပို့မှု အဆင်သင့်ပါပြီ!',
    thai: 'การส่งออกพร้อมแล้ว!',
    mandarin: '导出已就绪！'
  },
  share: {
    english: 'Share',
    spanish: 'Compartir',
    brazilian_portuguese: 'Compartilhar',
    tok_pisin: 'Share',
    indonesian: 'Bagikan',
    nepali: 'साझा गर्नुहोस्',
    hindi: 'साझा करें',
    burmese: 'မျှဝေပါ',
    thai: 'แชร์',
    mandarin: '分享'
  },
  exportFailed: {
    english: 'Export failed',
    spanish: 'Exportación fallida',
    brazilian_portuguese: 'Exportação falhou',
    tok_pisin: 'Export failed',
    indonesian: 'Ekspor gagal',
    nepali: 'निर्यात असफल भयो',
    hindi: 'निर्यात विफल',
    burmese: 'တင်ပို့မှု မအောင်မြင်ပါ',
    thai: 'ส่งออกไม่สำเร็จ',
    mandarin: '导出失败'
  },
  close: {
    english: 'Close',
    spanish: 'Cerrar',
    brazilian_portuguese: 'Fechar',
    tok_pisin: 'Close',
    indonesian: 'Tutup',
    nepali: 'बन्द गर्नुहोस्',
    hindi: 'बंद करें',
    burmese: 'ပိတ်ပါ',
    thai: 'ปิด',
    mandarin: '关闭'
  },
  exportForDistribution: {
    english: 'Export for Distribution',
    spanish: 'Exportar para distribución',
    brazilian_portuguese: 'Exportar para distribuição',
    tok_pisin: 'Export for Distribution',
    indonesian: 'Ekspor untuk Distribusi',
    nepali: 'वितरणको लागि निर्यात',
    hindi: 'वितरण के लिए निर्यात',
    burmese: 'ဖြန့်ဖြူးရန် တင်ပို့ပါ',
    thai: 'ส่งออกเพื่อการแจกจ่าย',
    mandarin: '导出以供分发'
  },
  exportForDistributionDescription: {
    english: 'This export is intended for public distribution and sharing.',
    spanish:
      'Esta exportación está destinada a la distribución y el intercambio públicos.',
    brazilian_portuguese:
      'Esta exportação é destinada à distribuição e compartilhamento públicos.',
    tok_pisin:
      'Dispela export bilong wok long putim igo aut long olgeta na kisim sindaun wantaim ol arapela.',
    indonesian: 'Ekspor ini dimaksudkan untuk distribusi dan pembagian publik.',
    nepali: 'यो निर्यात सार्वजनिक वितरण र साझेदारीको लागि हो।',
    hindi: 'यह निर्यात सार्वजनिक वितरण और साझाकरण के लिए है।',
    burmese:
      'ဤတင်ပို့မှုသည် ပြည်သူ့ ဖြန့်ဖြူးမှုနှင့် မျှဝေမှုအတွက် ရည်ရွယ်သည်။',
    thai: 'การส่งออกนี้มีไว้สำหรับการแจกจ่ายและแบ่งปันสาธารณะ',
    mandarin: '此导出用于公共分发和共享。'
  },
  exportForFeedback: {
    english: 'Export for Feedback',
    spanish: 'Exportar para feedback',
    brazilian_portuguese: 'Exportar para feedback',
    tok_pisin: 'Export for Feedback',
    indonesian: 'Ekspor untuk Feedback',
    nepali: 'प्रतिक्रियाको लागि निर्यात',
    hindi: 'प्रतिक्रिया के लिए निर्यात',
    burmese: 'အကြံပြုချက်အတွက် တင်ပို့ပါ',
    thai: 'ส่งออกเพื่อรับข้อเสนอแนะ',
    mandarin: '导出以供反馈'
  },
  exportForFeedbackDescription: {
    english: 'This export is intended for feedback and sharing.',
    spanish: 'Esta exportación está destinada a feedback y compartido.',
    brazilian_portuguese:
      'Esta exportação é destinada a feedback e compartilhado.',
    tok_pisin: 'Dispela export bilong wok long feedback o share.',
    indonesian: 'Ekspor ini dimaksudkan untuk feedback dan pembagian.',
    nepali: 'यो निर्यात प्रतिक्रिया र साझेदारीको लागि हो।',
    hindi: 'यह निर्यात प्रतिक्रिया और साझाकरण के लिए है।',
    burmese: 'ဤတင်ပို့မှုသည် အကြံပြုချက်နှင့် မျှဝေမှုအတွက် ရည်ရွယ်သည်။',
    thai: 'การส่งออกนี้มีไว้สำหรับรับข้อเสนอแนะและการแบ่งปัน',
    mandarin: '此导出用于反馈和共享。'
  },
  selectExportType: {
    english: 'Select Export Type',
    spanish: 'Seleccionar tipo de exportación',
    brazilian_portuguese: 'Selecionar tipo de exportação',
    tok_pisin: 'Makim kain export',
    indonesian: 'Pilih Jenis Ekspor',
    nepali: 'निर्यात प्रकार छान्नुहोस्',
    hindi: 'निर्यात प्रकार चुनें',
    burmese: 'တင်ပို့မှု အမျိုးအစားကို ရွေးပါ',
    thai: 'เลือกประเภทการส่งออก',
    mandarin: '选择导出类型'
  },
  shareLocally: {
    english: 'Share File',
    spanish: 'Compartir archivo',
    brazilian_portuguese: 'Compartilhar arquivo',
    tok_pisin: 'Shareim file',
    indonesian: 'Bagikan file',
    nepali: 'फाइल साझा गर्नुहोस्',
    hindi: 'फाइल साझा करें',
    burmese: 'ဖိုင်ကို မျှဝေပါ',
    thai: 'แชร์ไฟล์',
    mandarin: '分享文件'
  },
  shareLocallyDescription: {
    english: 'Create a local audio file to save or share',
    spanish: 'Crear un archivo de audio local para guardar o compartir',
    brazilian_portuguese:
      'Criar um arquivo de áudio local para salvar ou compartilhar',
    tok_pisin: 'Mekim lokal audio fail long save o shareim',
    indonesian: 'Buat file audio lokal untuk disimpan atau dibagikan',
    nepali: 'सुरक्षित वा साझा गर्न स्थानीय अडियो फाइल सिर्जना गर्नुहोस्',
    hindi: 'सहेजने या साझा करने के लिए एक स्थानीय ऑडियो फाइल बनाएं',
    burmese: 'သိမ်းဆည်းရန် သို့မဟုတ် မျှဝေရန် ဒေသတွင်း အသံဖိုင်တစ်ခု ဖန်တီးပါ',
    thai: 'สร้างไฟล์เสียงท้องถิ่นเพื่อบันทึกหรือแชร์',
    mandarin: '创建本地音频文件以保存或共享'
  },
  questExport: {
    english: 'Quest Export',
    spanish: 'Exportación de Quest',
    brazilian_portuguese: 'Exportação de Quest',
    tok_pisin: 'Quest Export',
    indonesian: 'Ekspor Quest',
    nepali: 'क्वेस्ट निर्यात',
    hindi: 'क्वेस्ट निर्यात',
    burmese: 'Quest တင်ပို့မှု',
    thai: 'ส่งออกเควสต์',
    mandarin: '任务导出'
  },
  questExportDescription: {
    english:
      'Export bible chapters as audio files for sharing and distribution',
    spanish:
      'Exportar capítulos de la biblia como archivos de audio para compartir y distribuir',
    brazilian_portuguese:
      'Exportar capítulos da bíblia como arquivos de áudio para compartilhar e distribuir',
    tok_pisin:
      'Exportim ol bible chapter olsem audio fail long shareim na distributim',
    indonesian:
      'Ekspor pasal-pasal alkitab sebagai file audio untuk dibagikan dan didistribusikan',
    nepali:
      'साझेदारी र वितरणको लागि बाइबल अध्यायहरूलाई अडियो फाइलहरूको रूपमा निर्यात गर्नुहोस्',
    hindi:
      'साझाकरण और वितरण के लिए बाइबल अध्यायों को ऑडियो फाइलों के रूप में निर्यात करें',
    burmese:
      'မျှဝေရန်နှင့် ဖြန့်ဖြူးရန်အတွက် ကျမ်းစာ အခန်းများကို အသံဖိုင်များအဖြစ် တင်ပို့ပါ',
    thai: 'ส่งออกบทพระคัมภีร์เป็นไฟล์เสียงเพื่อแชร์และแจกจ่าย',
    mandarin: '将圣经章节导出为音频文件以供共享和分发'
  },
  transcription: {
    english: 'Transcription',
    spanish: 'Transcripción',
    brazilian_portuguese: 'Transcrição',
    tok_pisin: 'Transcription',
    indonesian: 'Transkripsi',
    nepali: 'ट्रान्स्क्रिप्सन',
    hindi: 'ट्रांसक्रिप्शन',
    burmese: 'အသံဖြင့် ရေးသားခြင်း',
    thai: 'การถอดความ',
    mandarin: '转录'
  },
  transcriptions: {
    english: 'Transcriptions',
    spanish: 'Transcripciones',
    brazilian_portuguese: 'Transcrições',
    tok_pisin: 'Ol Transcription',
    indonesian: 'Transkripsi',
    nepali: 'ट्रान्स्क्रिप्सनहरू',
    hindi: 'ट्रांसक्रिप्शन',
    burmese: 'အသံဖြင့် ရေးသားခြင်းများ',
    thai: 'การถอดความ',
    mandarin: '转录'
  },
  noTranscriptionsYet: {
    english: 'No transcriptions yet. Be the first to transcribe!',
    spanish: 'No hay transcripciones aún. ¡Sé el primero en transcribir!',
    brazilian_portuguese:
      'Nenhuma transcrição ainda. Seja o primeiro a transcrever!',
    tok_pisin: 'I no gat transcription yet. Yu ken namba wan long transcribe!',
    indonesian: 'Belum ada transkripsi. Jadilah yang pertama mentranskripsi!',
    nepali:
      'अहिलेसम्म कुनै ट्रान्स्क्रिप्सन छैन। पहिलो ट्रान्स्क्राइबर बन्नुहोस्!',
    hindi:
      'अभी तक कोई ट्रांसक्रिप्शन नहीं है। पहले ट्रांसक्राइब करने वाले बनें!',
    burmese: 'အသံဖြင့် ရေးသားခြင်း မရှိသေးပါ။ ပထမဆုံး ရေးသားသူ ဖြစ်ပါ!',
    thai: 'ยังไม่มีการถอดความ เป็นคนแรกที่ถอดความ!',
    mandarin: '还没有转录。成为第一个转录的人！'
  },
  transcriptionDescription: {
    english: 'Enable automatic transcription of audio recordings',
    spanish: 'Habilitar transcripción automática de grabaciones de audio',
    brazilian_portuguese:
      'Habilitar transcrição automática de gravações de áudio',
    tok_pisin: 'Enablem automatic transcription bilong audio recordings',
    indonesian: 'Aktifkan transkripsi otomatis rekaman audio',
    nepali: 'अडियो रेकर्डिङहरूको स्वचालित ट्रान्सक्रिप्सन सक्षम गर्नुहोस्',
    hindi: 'ऑडियो रिकॉर्डिंग की स्वचालित ट्रांसक्रिप्शन सक्षम करें',
    burmese: 'အသံဖမ်းယူမှုများ၏ အလိုအလျောက် အသံဖြင့် ရေးသားခြင်းကို ဖွင့်ပါ',
    thai: 'เปิดใช้งานการถอดความอัตโนมัติของการบันทึกเสียง',
    mandarin: '启用音频录音的自动转录'
  },
  transcriptionComplete: {
    english: 'Transcription Complete',
    spanish: 'Transcripción completada',
    brazilian_portuguese: 'Transcrição concluída',
    tok_pisin: 'Transcription i pinis',
    indonesian: 'Transkripsi selesai',
    nepali: 'ट्रान्स्क्रिप्सन पूरा भयो',
    hindi: 'ट्रांसक्रिप्शन पूर्ण',
    burmese: 'အသံဖြင့် ရေးသားခြင်း ပြီးစီးပါပြီ',
    thai: 'การถอดความเสร็จสมบูรณ์',
    mandarin: '转录完成'
  },
  copyFeedbackLink: {
    english: 'Copy Feedback Link',
    spanish: 'Copiar enlace de feedback',
    brazilian_portuguese: 'Copiar link de feedback',
    tok_pisin: 'Kopim feedback link',
    indonesian: 'Salin Tautan Umpan Balik',
    nepali: 'प्रतिक्रिया लिंक कपी गर्नुहोस्',
    hindi: 'प्रतिक्रिया लिंक कॉपी करें',
    burmese: 'အကြံပြုချက် လင့်ခ်ကို ကူးယူပါ',
    thai: 'คัดลอกลิงก์ข้อเสนอแนะ',
    mandarin: '复制反馈链接'
  },
  copyFeedbackLinkDescription: {
    english: 'Copy a link to share for feedback',
    spanish: 'Copiar un enlace para compartir para feedback',
    brazilian_portuguese: 'Copiar um link para compartilhar para feedback',
    tok_pisin: 'Kopim link long shareim bilong feedback',
    indonesian: 'Salin tautan untuk dibagikan untuk umpan balik',
    nepali: 'प्रतिक्रियाको लागि साझा गर्न लिंक कपी गर्नुहोस्',
    hindi: 'प्रतिक्रिया के लिए साझा करने के लिए एक लिंक कॉपी करें',
    burmese: 'အကြံပြုချက်အတွက် မျှဝေရန် လင့်ခ်တစ်ခုကို ကူးယူပါ',
    thai: 'คัดลอกลิงก์เพื่อแชร์สำหรับรับข้อเสนอแนะ',
    mandarin: '复制链接以分享反馈'
  },
  feedbackLinkNote: {
    english:
      'Note: We plan to implement a link to the LangQuest website where exports can be viewed and commented on in the future.',
    spanish:
      'Nota: Planeamos implementar un enlace al sitio web de LangQuest donde las exportaciones se pueden ver y comentar en el futuro.',
    brazilian_portuguese:
      'Nota: Planejamos implementar um link para o site LangQuest onde as exportações podem ser visualizadas e comentadas no futuro.',
    tok_pisin:
      'Notis: Mipela planim long mekim link long LangQuest website we ol export inap lukim na tok long en long bihain.',
    indonesian:
      'Catatan: Kami berencana untuk mengimplementasikan tautan ke situs web LangQuest di mana ekspor dapat dilihat dan dikomentari di masa depan.',
    nepali:
      'नोट: हामी भविष्यमा LangQuest वेबसाइटमा लिंक लागू गर्ने योजना बनाइरहेका छौं जहाँ निर्यातहरू हेर्न र टिप्पणी गर्न सकिन्छ।',
    hindi:
      'नोट: हम भविष्य में LangQuest वेबसाइट पर एक लिंक लागू करने की योजना बना रहे हैं जहां निर्यात देखे और टिप्पणी की जा सकेंगे।',
    burmese:
      'မှတ်ချက်- အနာဂတ်တွင် ထုတ်ပို့မှုများကို ကြည့်ရှုနိုင်ပြီး မှတ်ချက်ပေးနိုင်သော LangQuest ဝက်ဘ်ဆိုဒ်သို့ လင့်ခ်တစ်ခု အကောင်အထည်ဖော်ရန် ကျွန်ုပ်တို့ စီစဉ်ထားပါသည်။',
    thai: 'หมายเหตุ: เราวางแผนที่จะใช้ลิงก์ไปยังเว็บไซต์ LangQuest ซึ่งสามารถดูและแสดงความคิดเห็นเกี่ยวกับการส่งออกในอนาคต',
    mandarin:
      '注意：我们计划实施指向 LangQuest 网站的链接，将来可以在那里查看和评论导出内容。'
  },
  linkCopied: {
    english: 'Link copied to clipboard!',
    spanish: '¡Enlace copiado al portapapeles!',
    brazilian_portuguese: 'Link copiado para a área de transferência!',
    tok_pisin: 'Link kopim igo long clipboard!',
    indonesian: 'Tautan disalin ke clipboard!',
    nepali: 'लिंक क्लिपबोर्डमा कपी भयो!',
    hindi: 'लिंक क्लिपबोर्ड पर कॉपी हो गया!',
    burmese: 'လင့်ခ်ကို clipboard သို့ ကူးယူပြီးပါပြီ!',
    thai: 'คัดลอกลิงก์ไปยังคลิปบอร์ดแล้ว!',
    mandarin: '链接已复制到剪贴板！'
  },
  verseMarkers: {
    english: 'Verse Labels',
    spanish: 'Etiquetas de Versículos',
    brazilian_portuguese: 'Etiquetas de Versículos',
    tok_pisin: 'Verse Labels',
    indonesian: 'Label Versi',
    nepali: 'पद लेबलहरू',
    hindi: 'पद लेबल',
    burmese: 'ကျမ်းပိုဒ် စာညွှန်းများ',
    thai: 'ป้ายกำกับข้อ',
    mandarin: '经文标签'
  },
  enableVerseLabelsQuestion: {
    english: 'Enable Verse Labels?',
    spanish: '¿Habilitar etiquetas de versículos?',
    brazilian_portuguese: 'Habilitar etiquetas de versículos?',
    tok_pisin: 'Enablem verse labels?',
    indonesian: 'Aktifkan label versi?',
    nepali: 'पद लेबलहरू सक्षम गर्ने?',
    hindi: 'पद लेबल सक्षम करें?',
    burmese: 'ကျမ်းပိုဒ် စာညွှန်းများကို ဖွင့်မည်လား?',
    thai: 'เปิดใช้งานป้ายกำกับข้อ?',
    mandarin: '启用经文标签？'
  },
  enableVerseLabelsDescription: {
    english:
      'This experimental feature helps organize Bible resources using verse labels. You can enable / disable it anytime at the Settings menu.',
    spanish:
      'Esta función experimental ayuda a organizar los recursos de la Biblia usando etiquetas de versículos. Puedes habilitarla / deshabilitarla en cualquier momento desde el menú de Configuración.',
    brazilian_portuguese:
      'Este recurso experimental ajuda a organizar os recursos da Bíblia usando etiquetas de versículos. Você pode ativá-lo / desativá-lo a qualquer momento no menu de Configurações.',
    tok_pisin:
      'Dispela experimental feature i helpim long organaisim Bible resources wantaim verse labels. Yu ken enablem / disableim long Settings menu long anytime.',
    indonesian:
      'Fitur eksperimental ini membantu mengorganisir sumber daya Alkitab menggunakan label versi. Anda dapat mengaktifkan / menonaktifkannya kapan saja di menu Pengaturan.',
    nepali:
      'यो प्रयोगात्मक सुविधाले पद लेबलहरू प्रयोग गरेर बाइबल स्रोतहरू व्यवस्थित गर्न मद्दत गर्छ। तपाईं यसलाई सेटिङ्स मेनुमा जुनसुकै समय सक्षम / असक्षम गर्न सक्नुहुन्छ।',
    hindi:
      'यह प्रयोगात्मक सुविधा पद लेबल का उपयोग करके बाइबल संसाधनों को व्यवस्थित करने में मदद करती है। आप इसे सेटिंग्स मेनू में कभी भी सक्षम/असक्षम कर सकते हैं।',
    burmese:
      'ဤစမ်းသပ်အင်္ဂါရပ်သည် ကျမ်းပိုဒ် စာညွှန်းများကို အသုံးပြု၍ ကျမ်းစာ အရင်းအမြစ်များကို စီစဉ်ရန် ကူညီပေးသည်။ သင်သည် Settings menu တွင် မည်သည့်အချိန်တွင်မဆို ဖွင့်/ပိတ်နိုင်သည်။',
    thai: 'ฟีเจอร์ทดลองนี้ช่วยจัดระเบียบทรัพยากรพระคัมภีร์โดยใช้ป้ายกำกับข้อ คุณสามารถเปิด/ปิดได้ตลอดเวลาที่เมนูการตั้งค่า',
    mandarin:
      '此实验性功能使用经文标签帮助组织圣经资源。您可以随时在设置菜单中启用/禁用它。'
  },
  verseMarkersDescription: {
    english: 'Enable verse labels to help organize Bible resources',
    spanish:
      'Habilitar etiquetas de versículos para ayudar a organizar recursos de la Biblia',
    brazilian_portuguese:
      'Habilitar etiquetas de versículos para ajudar a organizar recursos da Bíblia',
    tok_pisin: 'Enable verse labels to help organize Bible resources',
    indonesian:
      'Aktifkan label versi untuk membantu mengorganisir sumber daya Alkitab',
    nepali:
      'बाइबल स्रोतहरू व्यवस्थित गर्न मद्दत गर्न पद लेबलहरू सक्षम गर्नुहोस्',
    hindi: 'बाइबल संसाधनों को व्यवस्थित करने में मदद के लिए पद लेबल सक्षम करें',
    burmese:
      'ကျမ်းစာ အရင်းအမြစ်များကို စီစဉ်ရန် ကူညီရန် ကျမ်းပိုဒ် စာညွှန်းများကို ဖွင့်ပါ',
    thai: 'เปิดใช้งานป้ายกำกับข้อเพื่อช่วยจัดระเบียบทรัพยากรพระคัมภีร์',
    mandarin: '启用经文标签以帮助组织圣经资源'
  },
  // Languoid Link Suggestion strings
  languoidLinkSuggestionTitle: {
    english: 'Link your language?',
    spanish: '¿Vincular tu idioma?',
    brazilian_portuguese: '¿Vincular seu idioma?',
    tok_pisin: 'Joinim tok ples bilong yu?',
    indonesian: 'Apakah Anda ingin menghubungkan bahasa Anda?',
    nepali: 'आफ्नो भाषा लिंक गर्नुहुन्छ?',
    hindi: 'अपनी भाषा लिंक करें?',
    burmese: 'သင်၏ ဘာသာစကားကို ချိတ်ဆက်မည်လား?',
    thai: 'เชื่อมโยงภาษาของคุณ?',
    mandarin: '链接您的语言？'
  },
  languoidLinkSuggestionDrawerTitle: {
    english: 'Link to existing language',
    spanish: 'Vincular a un idioma existente',
    brazilian_portuguese: 'Vincular a um idioma existente',
    tok_pisin: 'Joinim wanpela tok ples',
    indonesian: 'Hubungkan ke bahasa yang ada',
    nepali: 'अवस्थित भाषामा लिंक गर्नुहोस्',
    hindi: 'मौजूदा भाषा से लिंक करें',
    burmese: 'ရှိပြီးသား ဘာသာစကားသို့ ချိတ်ဆက်ပါ',
    thai: 'เชื่อมโยงกับภาษาที่มีอยู่',
    mandarin: '链接到现有语言'
  },
  languoidLinkSuggestionDescription: {
    english:
      'We found existing languages that may match the one you created. Would you like to link to an existing language?',
    spanish:
      'Encontramos idiomas existentes que pueden coincidir con el que creaste. ¿Te gustaría vincular a un idioma existente?',
    brazilian_portuguese:
      'Encontramos idiomas existentes que podem corresponder ao que você criou. Gostaria de vincular a um idioma existente?',
    tok_pisin:
      'Mipela painim tok ples i stap pinis we inap wankain long tok ples yu bin mekim. Yu laik joinim wanpela tok ples i stap pinis?',
    indonesian:
      'Kami menemukan bahasa yang ada yang mungkin cocok dengan yang Anda buat. Apakah Anda ingin menghubungkan ke bahasa yang ada?',
    nepali:
      'हामीले तपाईंले सिर्जना गर्नुभएको सँग मेल खान सक्ने अवस्थित भाषाहरू फेला पार्यौं। के तपाईं अवस्थित भाषामा लिंक गर्न चाहनुहुन्छ?',
    hindi:
      'हमें मौजूदा भाषाएं मिलीं जो आपके द्वारा बनाई गई भाषा से मेल खा सकती हैं। क्या आप मौजूदा भाषा से लिंक करना चाहेंगे?',
    burmese:
      'သင်ဖန်တီးထားသော ဘာသာစကားနှင့် ကိုက်ညီနိုင်သော ရှိပြီးသား ဘာသာစကားများကို ကျွန်ုပ်တို့ တွေ့ရှိပါသည်။ ရှိပြီးသား ဘာသာစကားသို့ ချိတ်ဆက်လိုပါသလား?',
    thai: 'เราพบภาษาที่มีอยู่ซึ่งอาจตรงกับภาษาที่คุณสร้าง คุณต้องการเชื่อมโยงกับภาษาที่มีอยู่หรือไม่?',
    mandarin:
      '我们找到了可能与您创建的语言匹配的现有语言。您想链接到现有语言吗？'
  },
  yourLanguage: {
    english: 'Your language',
    spanish: 'Tu idioma',
    brazilian_portuguese: 'Seu idioma',
    tok_pisin: 'Tok ples bilong yu',
    indonesian: 'Bahasa Anda',
    nepali: 'तपाईंको भाषा',
    hindi: 'आपकी भाषा',
    burmese: 'သင်၏ ဘာသာစကား',
    thai: 'ภาษาของคุณ',
    mandarin: '您的语言'
  },
  seeLanguageSuggestions: {
    english: 'See language suggestions',
    spanish: 'Ver sugerencias de idioma',
    brazilian_portuguese: 'Ver sugestões de idioma',
    tok_pisin: 'Lukim ol tok ples bilong en',
    indonesian: 'Lihat sugesti bahasa',
    nepali: 'भाषा सुझावहरू हेर्नुहोस्',
    hindi: 'भाषा सुझाव देखें',
    burmese: 'ဘာသာစကား အကြံပြုချက်များကို ကြည့်ပါ',
    thai: 'ดูคำแนะนำภาษา',
    mandarin: '查看语言建议'
  },
  keepMyLanguage: {
    english: 'Keep my language',
    spanish: 'Mantener mi idioma',
    brazilian_portuguese: 'Manter meu idioma',
    tok_pisin: 'Holim tok ples bilong mi',
    indonesian: 'Simpan bahasa saya',
    nepali: 'मेरो भाषा राख्नुहोस्',
    hindi: 'मेरी भाषा रखें',
    burmese: 'ကျွန်ုပ်၏ ဘာသာစကားကို ထားပါ',
    thai: 'เก็บภาษาของฉัน',
    mandarin: '保留我的语言'
  },
  chooseThisLanguage: {
    english: 'Choose this language',
    spanish: 'Elegir este idioma',
    brazilian_portuguese: 'Escolher este idioma',
    tok_pisin: 'Pilim dispela tok ples',
    indonesian: 'Pilih bahasa ini',
    nepali: 'यो भाषा छान्नुहोस्',
    hindi: 'यह भाषा चुनें',
    burmese: 'ဤဘာသာစကားကို ရွေးပါ',
    thai: 'เลือกภาษานี้',
    mandarin: '选择此语言'
  },
  exactMatch: {
    english: 'Exact match',
    spanish: 'Coincidencia exacta',
    brazilian_portuguese: 'Correspondência exata',
    tok_pisin: 'Sem tru',
    indonesian: 'Kecocokan persis',
    nepali: 'ठीक मिल्यो',
    hindi: 'सटीक मिलान',
    burmese: 'တိကျသော ကိုက်ညီမှု',
    thai: 'ตรงกันทุกประการ',
    mandarin: '完全匹配'
  },
  partialMatch: {
    english: 'Partial match',
    spanish: 'Coincidencia parcial',
    brazilian_portuguese: 'Correspondência parcial',
    tok_pisin: 'Luk olsem',
    indonesian: 'Kecocokan sebagian',
    nepali: 'आंशिक मिल्यो',
    hindi: 'आंशिक मिलान',
    burmese: 'တစ်စိတ်တစ်ပိုင်း ကိုက်ညီမှု',
    thai: 'ตรงกันบางส่วน',
    mandarin: '部分匹配'
  },
  matchedByName: {
    english: 'Matched by name',
    spanish: 'Coincide por nombre',
    brazilian_portuguese: 'Correspondido por nome',
    tok_pisin: 'Painim long nem',
    indonesian: 'Cocok berdasarkan nama',
    nepali: 'नामद्वारा मेल खायो',
    hindi: 'नाम से मेल खाया',
    burmese: 'အမည်ဖြင့် ကိုက်ညီသည်',
    thai: 'ตรงกันตามชื่อ',
    mandarin: '按名称匹配'
  },
  matchedByAlias: {
    english: 'Matched by alias',
    spanish: 'Coincide por alias',
    brazilian_portuguese: 'Correspondido por alias',
    tok_pisin: 'Painim long narapela nem',
    indonesian: 'Cocok berdasarkan alias',
    nepali: 'उपनामद्वारा मेल खायो',
    hindi: 'उपनाम से मेल खाया',
    burmese: 'အမည်ပြောင်ဖြင့် ကိုက်ညီသည်',
    thai: 'ตรงกันตามนามแฝง',
    mandarin: '按别名匹配'
  },
  matchedByIsoCode: {
    english: 'Matched by ISO code',
    spanish: 'Coincide por código ISO',
    brazilian_portuguese: 'Correspondido por código ISO',
    tok_pisin: 'Painim long ISO kod',
    indonesian: 'Cocok berdasarkan kode ISO',
    nepali: 'ISO कोडद्वारा मेल खायो',
    hindi: 'ISO कोड से मेल खाया',
    burmese: 'ISO ကုဒ်ဖြင့် ကိုက်ညီသည်',
    thai: 'ตรงกันตามรหัส ISO',
    mandarin: '按ISO代码匹配'
  },
  languageLinkSuccess: {
    english: 'Language linked successfully',
    spanish: 'Idioma vinculado con éxito',
    brazilian_portuguese: 'Idioma vinculado com sucesso',
    tok_pisin: 'Tok ples joinim gut',
    indonesian: 'Bahasa berhasil dihubungkan',
    nepali: 'भाषा सफलतापूर्वक लिंक भयो',
    hindi: 'भाषा सफलतापूर्वक लिंक हो गई',
    burmese: 'ဘာသာစကားကို အောင်မြင်စွာ ချိတ်ဆက်ပြီးပါပြီ',
    thai: 'เชื่อมโยงภาษาสำเร็จแล้ว',
    mandarin: '语言链接成功'
  },
  languageLinkError: {
    english: 'Failed to link language',
    spanish: 'Error al vincular idioma',
    brazilian_portuguese: 'Falha ao vincular idioma',
    tok_pisin: 'No inap joinim tok ples',
    indonesian: 'Gagal menghubungkan bahasa',
    nepali: 'भाषा लिंक गर्न असफल',
    hindi: 'भाषा लिंक करने में विफल',
    burmese: 'ဘာသာစကားကို ချိတ်ဆက်ရန် မအောင်မြင်ပါ',
    thai: 'เชื่อมโยงภาษาไม่สำเร็จ',
    mandarin: '链接语言失败'
  },
  keepLanguageSuccess: {
    english: 'Your custom language has been kept',
    spanish: 'Tu idioma personalizado ha sido conservado',
    brazilian_portuguese: 'Seu idioma personalizado foi mantido',
    tok_pisin: 'Tok ples bilong yu i stap yet',
    indonesian: 'Bahasa kustom Anda telah disimpan',
    nepali: 'तपाईंको आफ्नै भाषा राखिएको छ',
    hindi: 'आपकी कस्टम भाषा रखी गई है',
    burmese: 'သင်၏ စိတ်ကြိုက် ဘာသာစကားကို ထားရှိပြီးပါပြီ',
    thai: 'เก็บภาษาที่กำหนดเองของคุณแล้ว',
    mandarin: '您的自定义语言已保留'
  },
  enableLanguoidLinkSuggestions: {
    english: 'Language link suggestions',
    spanish: 'Sugerencias de vinculación de idioma',
    brazilian_portuguese: 'Sugestões de vinculação de idioma',
    tok_pisin: 'Ol tok ples bilong joinim',
    indonesian: 'Saran tautan bahasa',
    nepali: 'भाषा लिंक सुझावहरू',
    hindi: 'भाषा लिंक सुझाव',
    burmese: 'ဘာသာစကား ချိတ်ဆက်မှု အကြံပြုချက်များ',
    thai: 'คำแนะนำการเชื่อมโยงภาษา',
    mandarin: '语言链接建议'
  },
  enableLanguoidLinkSuggestionsDescription: {
    english:
      'Get suggestions to link your custom-created languages to existing ones in the database',
    spanish:
      'Recibe sugerencias para vincular tus idiomas personalizados con los existentes en la base de datos',
    brazilian_portuguese:
      'Receba sugestões para vincular seus idiomas personalizados aos existentes no banco de dados',
    tok_pisin:
      'Kisim ol tok ples bilong joinim tok ples bilong yu wantaim ol tok ples i stap pinis long database',
    indonesian:
      'Dapatkan saran untuk menghubungkan bahasa kustom Anda dengan yang ada di database',
    nepali:
      'आफ्नो आफ्नै-सिर्जना गरिएका भाषाहरूलाई डाटाबेसमा अवस्थित भाषाहरूसँग लिंक गर्न सुझावहरू प्राप्त गर्नुहोस्',
    hindi:
      'अपनी कस्टम-बनाई गई भाषाओं को डेटाबेस में मौजूदा भाषाओं से लिंक करने के लिए सुझाव प्राप्त करें',
    burmese:
      'သင်၏ စိတ်ကြိုက် ဖန်တီးထားသော ဘာသာစကားများကို ဒေတာဘေ့စ်ရှိ ရှိပြီးသား ဘာသာစကားများသို့ ချိတ်ဆက်ရန် အကြံပြုချက်များ ရယူပါ',
    thai: 'รับคำแนะนำเพื่อเชื่อมโยงภาษาที่คุณสร้างเองกับภาษาที่มีอยู่ในฐานข้อมูล',
    mandarin: '获取建议，将您自定义创建的语言链接到数据库中的现有语言'
  },
  enableMerge: {
    english: 'Merge assets',
    spanish: 'Fusionar activos',
    brazilian_portuguese: 'Mesclar ativos',
    tok_pisin: 'Joinim ol aset',
    indonesian: 'Gabungkan aset',
    nepali: 'सम्पत्तिहरू मर्ज गर्नुहोस्',
    hindi: 'एसेट मर्ज करें',
    burmese: 'ပိုင်ဆိုင်မှုများကို ပေါင်းစပ်ပါ',
    thai: 'รวมสินทรัพย์',
    mandarin: '合并资产'
  },
  enableMergeDescription: {
    english:
      'Allow merging multiple audio assets into a single asset. Use with caution — segment order may need manual adjustment after merging.',
    spanish:
      'Permitir fusionar múltiples activos de audio en un solo activo. Usar con precaución — el orden de los segmentos puede necesitar ajuste manual después de fusionar.',
    brazilian_portuguese:
      'Permitir mesclar vários ativos de áudio em um único ativo. Use com cuidado — a ordem dos segmentos pode precisar de ajuste manual após a mesclagem.',
    tok_pisin:
      'Larim joinim planti audio aset i go insait long wanpela aset. Usim gut — order bilong ol segment i ken nidim stretim bihain long joinim.',
    indonesian:
      'Izinkan penggabungan beberapa aset audio menjadi satu aset. Gunakan dengan hati-hati — urutan segmen mungkin perlu penyesuaian manual setelah penggabungan.',
    nepali:
      'धेरै अडियो सम्पत्तिहरूलाई एकल सम्पत्तिमा मर्ज गर्न अनुमति दिनुहोस्। सावधानीपूर्वक प्रयोग गर्नुहोस् — मर्ज गरेपछि खण्ड क्रम म्यानुअल समायोजन आवश्यक पर्न सक्छ।',
    hindi:
      'कई ऑडियो एसेट को एक एसेट में मर्ज करने की अनुमति दें। सावधानी से उपयोग करें — मर्ज करने के बाद सेगमेंट क्रम को मैन्युअल रूप से समायोजित करने की आवश्यकता हो सकती है।',
    burmese:
      'အသံပိုင်ဆိုင်မှုများစွာကို တစ်ခုတည်းသော ပိုင်ဆိုင်မှုသို့ ပေါင်းစပ်ခွင့်ပြုပါ။ သတိဖြင့် အသုံးပြုပါ — ပေါင်းစပ်ပြီးနောက် အပိုင်းအစ အစဉ်ကို လက်ဖြင့် ညှိယူရန် လိုအပ်နိုင်သည်။',
    thai: 'อนุญาตให้รวมสินทรัพย์เสียงหลายรายการเป็นสินทรัพย์เดียว ใช้ด้วยความระมัดระวัง — ลำดับของส่วนอาจต้องปรับด้วยตนเองหลังจากรวม',
    mandarin:
      '允许将多个音频资产合并为单个资产。请谨慎使用 — 合并后可能需要手动调整片段顺序。'
  }
} as const;

// Type check to ensure all translation keys have all supported languages
// type ValidateTranslations<T> = {
//   [K in keyof T]: T[K] extends TranslationSet ? true : never;
// };
// type ValidationResult = ValidateTranslations<typeof translations>;
