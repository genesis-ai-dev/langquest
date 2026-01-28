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
  locale?: string;
}

export const ConfirmEmail = ({
  confirmation_url,
  locale = 'en'
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
    },
    'id-ID': {
      preview: 'Konfirmasi Akun LangQuest Anda',
      title: 'Konfirmasi Akun',
      description:
        'Klik tautan di bawah ini untuk mengonfirmasi akun Anda dan menyelesaikan registrasi:',
      button: 'Konfirmasi Akun',
      orCopy: 'Atau salin dan tempel tautan ini di peramban Anda:',
      expiry: 'Tautan ini akan kadaluarsa dalam 24 jam.'
    },
    'tpi-PG': {
      preview: 'Strongim LangQuest Akaun bilong yu',
      title: 'Strongim LangQuest Akaun bilong yu',
      description:
        'Click link long yu pastim strongim yu account yu and completeim registration yu:',
      button: 'Strongim LangQuest Akaun',
      orCopy: 'Or copyim pasteim link yu long yu browser:',
      expiry: 'Link yu no expireim long 24 hours.'
    },
    ne: {
      preview: 'तपाईंको LangQuest खाता पुष्टि गर्नुहोस्',
      title: 'तपाईंको खाता पुष्टि गर्नुहोस्',
      description:
        'तपाईंको खाता पुष्टि गर्न र दर्ता पूरा गर्न यो लिंक अनुसरण गर्नुहोस्:',
      button: 'खाता पुष्टि गर्नुहोस्',
      orCopy: 'वा यो लिंक तपाईंको ब्राउजरमा कपि र पेस्ट गर्नुहोस्:',
      expiry: 'यो लिंक २४ घण्टामा समाप्त हुनेछ।'
    }
  };

  const t = localizations[locale as keyof typeof localizations];

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
            <Text className="my-6 text-sm text-gray-800">{t.description}</Text>
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

export default ConfirmEmail;
