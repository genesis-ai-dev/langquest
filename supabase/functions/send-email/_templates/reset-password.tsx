import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
  Tailwind
} from 'npm:@react-email/components';
import * as React from 'npm:react';

interface ResetPasswordProps {
  confirmation_url: string;
  ui_language?: string;
}

export const ResetPassword = ({
  confirmation_url,
  ui_language = 'en'
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
    }
  };

  const t =
    translations[ui_language as keyof typeof translations] || translations.en;

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
            <Text className="text-gray-800 text-sm my-6">{t.instruction}</Text>
            <Link
              href={confirmation_url}
              target="_blank"
              className="inline-block bg-green-500 text-white text-sm no-underline text-center py-3.5 px-5 rounded mb-4"
            >
              {t.button}
            </Link>
            <Text className="text-gray-800 text-sm mb-3.5">{t.orCopy}</Text>
            <Text className="inline-block p-4 w-[90.5%] bg-gray-100 rounded border border-gray-200 text-gray-800 break-all font-mono text-sm">
              {confirmation_url}
            </Text>
            <Text className="text-gray-400 text-sm mt-3.5">{t.expiry}</Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default ResetPassword;
