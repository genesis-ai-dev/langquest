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

interface InviteEmailProps {
  projectName: string;
  inviterName: string;
  joinUrl: string;
  locale?: string;
}

export const InviteEmail = ({
  projectName,
  inviterName,
  joinUrl,
  locale = 'en'
}: InviteEmailProps) => {
  // Translations
  const translations = {
    en: {
      preview: `You've been invited to join ${projectName} on LangQuest`,
      title: 'Project Invitation',
      greeting: 'Hello!',
      description: `${inviterName} has invited you to join the project "${projectName}" on LangQuest, a collaborative language learning platform.`,
      whatIsLangQuest:
        'LangQuest helps communities create and share language learning resources. Join us to contribute translations, audio recordings, and help preserve languages worldwide.',
      instruction:
        'Click the button below to create your account and join the project:',
      button: 'Join LangQuest',
      orCopy: 'Or copy and paste this link in your browser:',
      expiry: 'This invitation link will expire in 7 days.'
    },
    es: {
      preview: `Has sido invitado a unirte a ${projectName} en LangQuest`,
      title: 'Invitación al Proyecto',
      greeting: '¡Hola!',
      description: `${inviterName} te ha invitado a unirte al proyecto "${projectName}" en LangQuest, una plataforma colaborativa de aprendizaje de idiomas.`,
      whatIsLangQuest:
        'LangQuest ayuda a las comunidades a crear y compartir recursos para el aprendizaje de idiomas. Únete para contribuir con traducciones, grabaciones de audio y ayudar a preservar idiomas en todo el mundo.',
      instruction:
        'Haz clic en el botón de abajo para crear tu cuenta y unirte al proyecto:',
      button: 'Unirse a LangQuest',
      orCopy: 'O copia y pega este enlace en tu navegador:',
      expiry: 'Este enlace de invitación expirará en 7 días.'
    },
    fr: {
      preview: `Vous avez été invité à rejoindre ${projectName} sur LangQuest`,
      title: 'Invitation au Projet',
      greeting: 'Bonjour !',
      description: `${inviterName} vous a invité à rejoindre le projet "${projectName}" sur LangQuest, une plateforme collaborative d'apprentissage des langues.`,
      whatIsLangQuest:
        "LangQuest aide les communautés à créer et partager des ressources d'apprentissage des langues. Rejoignez-nous pour contribuer des traductions, des enregistrements audio et aider à préserver les langues du monde entier.",
      instruction:
        'Cliquez sur le bouton ci-dessous pour créer votre compte et rejoindre le projet :',
      button: 'Rejoindre LangQuest',
      orCopy: 'Ou copiez et collez ce lien dans votre navigateur :',
      expiry: "Ce lien d'invitation expirera dans 7 jours."
    },
    'pt-BR': {
      preview: `Você foi convidado para participar de ${projectName} no LangQuest`,
      title: 'Convite para Projeto',
      greeting: 'Olá!',
      description: `${inviterName} convidou você para participar do projeto "${projectName}" no LangQuest, uma plataforma colaborativa de aprendizado de idiomas.`,
      whatIsLangQuest:
        'O LangQuest ajuda comunidades a criar e compartilhar recursos de aprendizado de idiomas. Junte-se a nós para contribuir com traduções, gravações de áudio e ajudar a preservar idiomas em todo o mundo.',
      instruction:
        'Clique no botão abaixo para criar sua conta e participar do projeto:',
      button: 'Participar do LangQuest',
      orCopy: 'Ou copie e cole este link no seu navegador:',
      expiry: 'Este link de convite expirará em 7 dias.'
    },
    'id-ID': {
      preview: 'Anda telah diundang untuk bergabung dalam proyek di LangQuest',
      title: 'Undangan untuk Proyek',
      greeting: 'Halo!',
      description: `${inviterName} telah mengundang Anda untuk bergabung dalam proyek "${projectName}" di LangQuest, sebuah platform kolaboratif pembelajaran bahasa.`,
      whatIsLangQuest:
        'LangQuest membantu komunitas membuat dan berbagi sumber belajar bahasa. Bergabunglah untuk berkontribusi dalam penerjemahan, rekaman audio, dan membantu menjaga bahasa di seluruh dunia.',
      instruction:
        'Klik tombol di bawah ini untuk membuat akun Anda dan bergabung dalam proyek:',
      button: 'Bergabung di LangQuest',
      orCopy: 'Atau salin dan tempel tautan ini di peramban Anda:',
      expiry: 'Tautan undangan ini akan kadaluarsa dalam 7 hari.'
    },
    'tpi-PG': {
      preview: 'Yu telah strongim langquest bilong yu',
      title: 'Strongim LangQuest bilong yu',
      greeting: 'Hello,',
      description: `${inviterName} i salim yu strongim yu long joinim project "{projectName}" long langquest yu, platform collaborative learning language.`,
      whatIsLangQuest:
        'LangQuest helpim yu community strongim yu long shareim language learning resources. Joinim yu long contributeim translation, audio recording, and helpim preserveim language long whole world.',
      instruction:
        'Click button long yu pastim strongim yu account yu and joinim project yu:',
      button: 'Joinim LangQuest',
      orCopy: 'Or copyim pasteim link yu long yu browser:',
      expiry: 'Link yu no expireim long 7 days.'
    },
    ne: {
      preview: `तपाईंलाई ${projectName} मा LangQuest मा सामेल हुन आमन्त्रित गरिएको छ`,
      title: 'प्रोजेक्ट आमन्त्रण',
      greeting: 'नमस्कार!',
      description: `${inviterName} ले तपाईंलाई LangQuest मा "${projectName}" प्रोजेक्टमा सामेल हुन आमन्त्रित गर्नुभएको छ, एक सहयोगी भाषा सिकाइ प्लेटफर्म।`,
      whatIsLangQuest:
        'LangQuest ले समुदायहरूलाई भाषा सिकाइ स्रोतहरू सिर्जना र साझेदारी गर्न मद्दत गर्दछ। अनुवाद, अडियो रेकर्डिङहरू योगदान गर्न र विश्वभर भाषाहरू संरक्षण गर्न मद्दत गर्न हामीसँग जोडिनुहोस्।',
      instruction:
        'तपाईंको खाता सिर्जना गर्न र प्रोजेक्टमा सामेल हुन तलको बटनमा क्लिक गर्नुहोस्:',
      button: 'LangQuest मा सामेल हुनुहोस्',
      orCopy: 'वा यो लिंक तपाईंको ब्राउजरमा कपि र पेस्ट गर्नुहोस्:',
      expiry: 'यो आमन्त्रण लिंक ७ दिनमा समाप्त हुनेछ।'
    },
    hi: {
      preview: `आपको ${projectName} में LangQuest में शामिल होने के लिए आमंत्रित किया गया है`,
      title: 'प्रोजेक्ट आमंत्रण',
      greeting: 'नमस्ते!',
      description: `${inviterName} ने आपको LangQuest पर "${projectName}" प्रोजेक्ट में शामिल होने के लिए आमंत्रित किया है, एक सहयोगी भाषा सीखने का मंच।`,
      whatIsLangQuest:
        'LangQuest समुदायों को भाषा सीखने के संसाधन बनाने और साझा करने में मदद करता है। अनुवाद, ऑडियो रिकॉर्डिंग में योगदान देने और दुनिया भर की भाषाओं को संरक्षित करने में मदद करने के लिए हमसे जुड़ें।',
      instruction:
        'अपना खाता बनाने और प्रोजेक्ट में शामिल होने के लिए नीचे दिए गए बटन पर क्लिक करें:',
      button: 'LangQuest में शामिल हों',
      orCopy: 'या अपने ब्राउज़र में इस लिंक को कॉपी और पेस्ट करें:',
      expiry: 'यह आमंत्रण लिंक 7 दिनों में समाप्त हो जाएगा।'
    },
    my: {
      preview: `သင့်အား ${projectName} တွင် LangQuest တွင် ပါဝင်ရန် ဖိတ်ခေါ်ထားပါသည်`,
      title: 'စီမံကိန်း ဖိတ်ခေါ်ခြင်း',
      greeting: 'မင်္ဂလာပါ!',
      description: `${inviterName} သည် သင့်အား LangQuest တွင် "${projectName}" စီမံကိန်းတွင် ပါဝင်ရန် ဖိတ်ခေါ်ထားပါသည်၊ ပူးပေါင်းဆောင်ရွက်သော ဘာသာစကား သင်ယူမှု ပလက်ဖောင်းတစ်ခုဖြစ်သည်။`,
      whatIsLangQuest:
        'LangQuest သည် အသိုင်းအဝိုင်းများကို ဘာသာစကား သင်ယူမှု အရင်းအမြစ်များ ဖန်တီးရန်နှင့် မျှဝေရန် ကူညီပေးသည်။ ဘာသာပြန်ဆိုခြင်း၊ အသံဖမ်းယူခြင်းများတွင် ပါဝင်ဆောင်ရွက်ရန်နှင့် ကမ္ဘာတစ်ဝှမ်းရှိ ဘာသာစကားများကို ထိန်းသိမ်းရန် ကူညီရန် ကျွန်ုပ်တို့နှင့် ပူးပေါင်းပါ။',
      instruction:
        'သင်၏ အကောင့်ကို ဖန်တီးရန်နှင့် စီမံကိန်းတွင် ပါဝင်ရန် အောက်ပါ ခလုတ်ကို နှိပ်ပါ:',
      button: 'LangQuest တွင် ပါဝင်ပါ',
      orCopy: 'သို့မဟုတ် ဤလင့်ခ်ကို သင်၏ ဘရောက်ဆာတွင် ကူးယူ၍ ထည့်ပါ:',
      expiry: 'ဤဖိတ်ခေါ်ခြင်း လင့်ခ်သည် 7 ရက်အတွင်း သက်တမ်းကုန်ဆုံးမည်။'
    },
    th: {
      preview: `คุณได้รับเชิญให้เข้าร่วม ${projectName} ใน LangQuest`,
      title: 'คำเชิญเข้าร่วมโครงการ',
      greeting: 'สวัสดี!',
      description: `${inviterName} ได้เชิญคุณให้เข้าร่วมโครงการ "${projectName}" ใน LangQuest ซึ่งเป็นแพลตฟอร์มการเรียนรู้ภาษาที่ทำงานร่วมกัน`,
      whatIsLangQuest:
        'LangQuest ช่วยให้ชุมชนสร้างและแบ่งปันทรัพยากรการเรียนรู้ภาษา เข้าร่วมกับเราเพื่อมีส่วนร่วมในการแปล บันทึกเสียง และช่วยรักษาภาษาทั่วโลก',
      instruction: 'คลิกปุ่มด้านล่างเพื่อสร้างบัญชีของคุณและเข้าร่วมโครงการ:',
      button: 'เข้าร่วม LangQuest',
      orCopy: 'หรือคัดลอกและวางลิงก์นี้ในเบราว์เซอร์ของคุณ:',
      expiry: 'ลิงก์คำเชิญนี้จะหมดอายุใน 7 วัน'
    },
    'zh-CN': {
      preview: `您已被邀请加入 LangQuest 上的 ${projectName}`,
      title: '项目邀请',
      greeting: '您好！',
      description: `${inviterName} 邀请您加入 LangQuest 上的项目 "${projectName}"，这是一个协作式语言学习平台。`,
      whatIsLangQuest:
        'LangQuest 帮助社区创建和分享语言学习资源。加入我们，贡献翻译、音频录制，并帮助保护世界各地的语言。',
      instruction: '点击下面的按钮创建您的账户并加入项目:',
      button: '加入 LangQuest',
      orCopy: '或者将此链接复制并粘贴到您的浏览器中:',
      expiry: '此邀请链接将在 7 天后过期。'
    }
  };

  const t =
    translations[locale as keyof typeof translations] || translations.en;

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
            <Text className="my-6 text-sm text-gray-800">
              {t.whatIsLangQuest}
            </Text>
            <Text className="my-6 text-sm text-gray-800">{t.instruction}</Text>
            <Link
              href={joinUrl}
              target="_blank"
              className="mb-4 inline-block rounded bg-green-500 px-5 py-3.5 text-center text-sm text-white no-underline"
            >
              {t.button}
            </Link>
            <Text className="mb-3.5 text-sm text-gray-800">{t.orCopy}</Text>
            <Text className="inline-block w-[90.5%] break-all rounded border border-gray-200 bg-gray-100 p-4 font-mono text-sm text-gray-800">
              {joinUrl}
            </Text>
            <Text className="mt-3.5 text-sm text-gray-400">{t.expiry}</Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default InviteEmail;
