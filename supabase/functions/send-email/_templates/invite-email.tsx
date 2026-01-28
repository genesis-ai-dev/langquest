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
