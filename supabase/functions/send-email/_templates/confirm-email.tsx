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

interface ConfirmEmailProps {
  confirmation_url: string;
  ui_language?: string;
}

export const ConfirmEmail = ({
  confirmation_url,
  ui_language = 'en'
}: ConfirmEmailProps) => {
  // Translations
  const localizations = {
    en: {
      preview: 'Confirm your LangQuest account',
      title: 'Confirm Your Account',
      description:
        'Follow this link to confirm your account and complete your registration:',
      button: 'Confirm Account',
      orCopy: 'Or copy and paste this link in your browser:',
      expiry: 'This link will expire in 24 hours.'
    },
    es: {
      preview: 'Confirma tu cuenta de LangQuest',
      title: 'Confirma tu cuenta',
      description:
        'Sigue este enlace para confirmar tu cuenta y completar tu registro:',
      button: 'Confirmar cuenta',
      orCopy: 'O copia y pega este enlace en tu navegador:',
      expiry: 'Este enlace expirará en 24 horas.'
    },
    fr: {
      preview: 'Confirmez votre compte LangQuest',
      title: 'Confirmez votre compte',
      description:
        'Suivez ce lien pour confirmer votre compte et compléter votre inscription :',
      button: 'Confirmer le compte',
      orCopy: 'Ou copiez et collez ce lien dans votre navigateur :',
      expiry: 'Ce lien expirera dans 24 heures.'
    },
    'pt-BR': {
      preview: 'Confirme sua conta LangQuest',
      title: 'Confirme Sua Conta',
      description:
        'Siga este link para confirmar sua conta e completar seu registro:',
      button: 'Confirmar Conta',
      orCopy: 'Ou você pode copiar e colar este link no seu navegador:',
      expiry: 'Este link vai expirar em 24 horas.'
    }
  };

  const t =
    localizations[ui_language as keyof typeof localizations] ||
    localizations.en;

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
            <Text className="text-gray-800 text-sm my-6">{t.description}</Text>
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

export default ConfirmEmail;
