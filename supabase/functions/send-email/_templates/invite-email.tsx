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
          <Container className="px-3 mx-auto">
            <Heading className="text-2xl font-bold text-gray-800 my-10">
              {t.title}
            </Heading>
            <Text className="text-gray-800 text-sm my-6">{t.greeting}</Text>
            <Text className="text-gray-800 text-sm my-6">{t.description}</Text>
            <Text className="text-gray-800 text-sm my-6">
              {t.whatIsLangQuest}
            </Text>
            <Text className="text-gray-800 text-sm my-6">{t.instruction}</Text>
            <Link
              href={joinUrl}
              target="_blank"
              className="inline-block bg-green-500 text-white text-sm no-underline text-center py-3.5 px-5 rounded mb-4"
            >
              {t.button}
            </Link>
            <Text className="text-gray-800 text-sm mb-3.5">{t.orCopy}</Text>
            <Text className="inline-block p-4 w-[90.5%] bg-gray-100 rounded border border-gray-200 text-gray-800 break-all font-mono text-sm">
              {joinUrl}
            </Text>
            <Text className="text-gray-400 text-sm mt-3.5">{t.expiry}</Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default InviteEmail;
