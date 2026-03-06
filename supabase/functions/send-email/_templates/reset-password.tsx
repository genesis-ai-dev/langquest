import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Tailwind,
  Text
} from 'npm:@react-email/components';
import * as React from 'npm:react';

interface ResetPasswordProps {
  confirmation_url: string;
  locale?: string;
}

export const ResetPassword = ({
  confirmation_url,
  locale = 'en'
}: ResetPasswordProps) => {
  // Translations
  const translations = {
    en: {
      preview: 'Reset your LangQuest password',
      title: 'Reset Your Password',
      greeting: 'Hello,',
      description:
        "Someone requested a password reset for your LangQuest account. If this wasn't you, please ignore this email.",
      instruction: 'Click the button below to reset your password:',
      button: 'Reset Password',
      orCopy: 'Or copy and paste this link in your browser:',
      expiry: 'This link will expire in 24 hours.'
    },
    es: {
      preview: 'Restablece tu contraseña de LangQuest',
      title: 'Restablecer tu contraseña',
      greeting: 'Hola,',
      description:
        'Alguien solicitó un restablecimiento de contraseña para tu cuenta de LangQuest. Si no fuiste tú, ignora este correo.',
      instruction:
        'Haz clic en el botón de abajo para restablecer tu contraseña:',
      button: 'Restablecer Contraseña',
      orCopy: 'O copia y pega este enlace en tu navegador:',
      expiry: 'Este enlace expirará en 24 horas.'
    },
    fr: {
      preview: 'Réinitialisez votre mot de passe LangQuest',
      title: 'Réinitialiser votre mot de passe',
      greeting: 'Bonjour,',
      description:
        "Quelqu'un a demandé la réinitialisation du mot de passe de votre compte LangQuest. Si ce n'était pas vous, veuillez ignorer cet e-mail.",
      instruction:
        'Cliquez sur le bouton ci-dessous pour réinitialiser votre mot de passe :',
      button: 'Réinitialiser le mot de passe',
      orCopy: 'Ou copiez et collez ce lien dans votre navigateur :',
      expiry: 'Ce lien expirera dans 24 heures.'
    },
    'pt-BR': {
      preview: 'Redefina sua senha do LangQuest',
      title: 'Redefinir Sua Senha',
      greeting: 'Olá,',
      description:
        'Alguém solicitou uma redefinição de senha para sua conta do LangQuest. Se não foi você, por favor ignore este email.',
      instruction: 'Clique no botão abaixo para redefinir sua senha:',
      button: 'Redefinir Senha',
      orCopy: 'Ou copie e cole este link no seu navegador:',
      expiry: 'Este link vai expirar em 24 horas.'
    },
    'id-ID': {
      preview: 'Atur Ulang Kata Sandi LangQuest Anda',
      title: 'Atur Ulang Kata Sandi',
      greeting: 'Halo,',
      description:
        'Seseorang meminta pembaruan kata sandi untuk akun LangQuest Anda. Jika bukan Anda, silakan abaikan email ini.',
      instruction:
        'Klik tombol di bawah ini untuk mengatur ulang kata sandi Anda:',
      button: 'Atur Ulang Kata Sandi',
      orCopy: 'Atau salin dan tempel tautan ini di peramban Anda:',
      expiry: 'Tautan ini akan kadaluarsa dalam 24 jam.'
    },
    'tpi-PG': {
      preview: 'Resetim LangQuest Password bilong yu',
      title: 'Resetim LangQuest Password bilong yu',
      greeting: 'Hello,',
      description:
        'Someone requestim resetim password bilong yu account langquest yu. Yu no strongim yu, plis ignore email yu.',
      instruction: 'Click button long yu pastim resetim password bilong yu:',
      button: 'Resetim Password',
      orCopy: 'Or copyim pasteim link yu long yu browser:',
      expiry: 'Link yu no expireim long 24 hours.'
    },
    ne: {
      preview: 'तपाईंको LangQuest पासवर्ड रिसेट गर्नुहोस्',
      title: 'तपाईंको पासवर्ड रिसेट गर्नुहोस्',
      greeting: 'नमस्कार,',
      description:
        'कसैले तपाईंको LangQuest खाताको लागि पासवर्ड रिसेट अनुरोध गरेको छ। यदि यो तपाईं होइन भने, कृपया यो इमेल बेवास्ता गर्नुहोस्।',
      instruction: 'तपाईंको पासवर्ड रिसेट गर्न तलको बटनमा क्लिक गर्नुहोस्:',
      button: 'पासवर्ड रिसेट गर्नुहोस्',
      orCopy: 'वा यो लिंक तपाईंको ब्राउजरमा कपि र पेस्ट गर्नुहोस्:',
      expiry: 'यो लिंक २४ घण्टामा समाप्त हुनेछ।'
    },
    hi: {
      preview: 'अपना LangQuest पासवर्ड रीसेट करें',
      title: 'अपना पासवर्ड रीसेट करें',
      greeting: 'नमस्ते,',
      description:
        'किसी ने आपके LangQuest खाते के लिए पासवर्ड रीसेट का अनुरोध किया है। यदि यह आप नहीं थे, तो कृपया इस ईमेल को अनदेखा करें।',
      instruction:
        'अपना पासवर्ड रीसेट करने के लिए नीचे दिए गए बटन पर क्लिक करें:',
      button: 'पासवर्ड रीसेट करें',
      orCopy: 'या अपने ब्राउज़र में इस लिंक को कॉपी और पेस्ट करें:',
      expiry: 'यह लिंक 24 घंटे में समाप्त हो जाएगा।'
    },
    my: {
      preview: 'သင်၏ LangQuest စကားဝှက်ကို ပြန်လည်သတ်မှတ်ပါ',
      title: 'သင်၏ စကားဝှက်ကို ပြန်လည်သတ်မှတ်ပါ',
      greeting: 'မင်္ဂလာပါ၊',
      description:
        'တစ်စုံတစ်ယောက်က သင်၏ LangQuest အကောင့်အတွက် စကားဝှက် ပြန်လည်သတ်မှတ်ရန် တောင်းဆိုထားပါသည်။ သင်မဟုတ်ပါက ဤအီးမေးလ်ကို လျစ်လျူရှုပါ။',
      instruction:
        'သင်၏ စကားဝှက်ကို ပြန်လည်သတ်မှတ်ရန် အောက်ပါ ခလုတ်ကို နှိပ်ပါ:',
      button: 'စကားဝှက် ပြန်လည်သတ်မှတ်ပါ',
      orCopy: 'သို့မဟုတ် ဤလင့်ခ်ကို သင်၏ ဘရောက်ဆာတွင် ကူးယူ၍ ထည့်ပါ:',
      expiry: 'ဤလင့်ခ်သည် 24 နာရီအတွင်း သက်တမ်းကုန်ဆုံးမည်။'
    },
    th: {
      preview: 'รีเซ็ตรหัสผ่าน LangQuest ของคุณ',
      title: 'รีเซ็ตรหัสผ่านของคุณ',
      greeting: 'สวัสดีครับ/ค่ะ',
      description:
        'มีคนขอรีเซ็ตรหัสผ่านสำหรับบัญชี LangQuest ของคุณ หากไม่ใช่คุณ กรุณาเพิกเฉยต่ออีเมลนี้',
      instruction: 'คลิกปุ่มด้านล่างเพื่อรีเซ็ตรหัสผ่านของคุณ:',
      button: 'รีเซ็ตรหัสผ่าน',
      orCopy: 'หรือคัดลอกและวางลิงก์นี้ในเบราว์เซอร์ของคุณ:',
      expiry: 'ลิงก์นี้จะหมดอายุใน 24 ชั่วโมง'
    },
    'zh-CN': {
      preview: '重置您的 LangQuest 密码',
      title: '重置您的密码',
      greeting: '您好，',
      description:
        '有人请求重置您的 LangQuest 账户密码。如果不是您，请忽略此邮件。',
      instruction: '点击下面的按钮重置您的密码:',
      button: '重置密码',
      orCopy: '或者将此链接复制并粘贴到您的浏览器中:',
      expiry: '此链接将在 24 小时后过期。'
    }
  };

  const t = translations[locale as keyof typeof translations];

  return (
    <Html>
      <Head />
      <Preview>{t.preview}</Preview>
      <Tailwind>
        <Body className="bg-white">
          <Container className="mx-auto px-3">
            <Heading className="my-10 text-2xl font-bold text-gray-800">
              {t.title}
            </Heading>
            <Text className="my-6 text-sm text-gray-800">{t.greeting}</Text>
            <Text className="my-6 text-sm text-gray-800">{t.description}</Text>
            <Text className="my-6 text-sm text-gray-800">{t.instruction}</Text>
            <Link
              href={confirmation_url}
              target="_blank"
              className="mb-4 inline-block rounded bg-green-500 px-5 py-3.5 text-center text-sm text-white no-underline"
            >
              {t.button}
            </Link>
            <Text className="mb-3.5 text-sm text-gray-800">{t.orCopy}</Text>
            <Text className="inline-block w-[90.5%] break-all rounded border border-gray-200 bg-gray-100 p-4 font-mono text-sm text-gray-800">
              {confirmation_url}
            </Text>
            <Text className="mt-3.5 text-sm text-gray-400">{t.expiry}</Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default ResetPassword;
