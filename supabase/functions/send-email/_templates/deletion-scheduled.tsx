import {
  Body,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Row,
  Tailwind,
  Text
} from '@react-email/components';

export interface DeletionScheduledEmailProps {
  purgeDate: string;
  locale?: string;
  logoUrl?: string;
}

const translations = {
  en: {
    preview: 'Your LangQuest account deletion is scheduled',
    title: 'Your account deletion is scheduled',
    greeting: 'Hello,',
    intro: 'You asked us to delete your LangQuest account.',
    purgeLine: (date: string) =>
      `We'll permanently delete your account and personal data on ${date}.`,
    duringGrace:
      'Changed your mind? Sign back into the app before that date and tap Cancel deletion on the overlay that appears.',
    afterPurge:
      "After that date, we'll remove your account, profile, and personal identifiers. Text translations and comments stay public without your name attached. Voice recordings stay in the language archive with your name removed, to preserve irreplaceable audio-only translations.",
    audioDeletion:
      'To delete your own recordings instead, reply to this email or write admin@frontierrnd.com when you request deletion.',
    backup:
      "Backup copies at our service providers may remain until routine rotation replaces them. We leave those copies unused and won't restore your data from them on request.",
    thanks: 'Thanks,',
    team: 'The LangQuest team'
  }
} as const;

export const DeletionScheduledEmail = ({
  purgeDate,
  locale = 'en',
  logoUrl = 'https://langquest.org/langquest-logo-light.png'
}: DeletionScheduledEmailProps) => {
  const t = translations[locale as keyof typeof translations] ?? translations.en;

  return (
    <Html>
      <Head />
      <Preview>{t.preview}</Preview>
      <Tailwind>
        <Body className="bg-[#fbfbfb] font-sans">
          <Container className="mx-auto mt-10 mb-6 max-w-[602px] rounded-lg border border-solid border-[#e5e7eb] bg-white px-8 py-8">
            <Row className="mb-6">
              <Column className="w-[32px] align-middle">
                <Img
                  src={logoUrl}
                  width={32}
                  height={32}
                  alt="LangQuest"
                  className="block rounded-lg"
                />
              </Column>
              <Column className="pl-1 align-middle">
                <Text className="m-0 text-[15px] leading-none text-[#111827]">
                  LangQuest
                </Text>
              </Column>
            </Row>

            <Heading className="m-0 mb-8 text-2xl leading-[1.3] font-semibold tracking-[-0.3px] text-[#111827]">
              {t.title}
            </Heading>

            <Text className="m-0 mb-4 text-[15px] leading-[1.5] text-[#3c4149]">
              {t.greeting}
            </Text>
            <Text className="m-0 mb-4 text-[15px] leading-[1.5] text-[#3c4149]">
              {t.intro}
            </Text>
            <Text className="m-0 mb-4 text-[15px] leading-[1.5] font-semibold text-[#3c4149]">
              {t.purgeLine(purgeDate)}
            </Text>
            <Text className="m-0 mb-4 text-[15px] leading-[1.5] text-[#3c4149]">
              {t.duringGrace}
            </Text>
            <Text className="m-0 mb-4 text-[15px] leading-[1.5] text-[#3c4149]">
              {t.afterPurge}
            </Text>
            <Text className="m-0 mb-4 text-[15px] leading-[1.5] text-[#3c4149]">
              {t.audioDeletion}
            </Text>

            <Hr className="my-6 border-[#e5e7eb]" />

            <Text className="m-0 mb-6 text-[15px] leading-[1.5] text-[#6b7280]">
              {t.backup}
            </Text>

            <Text className="m-0 mt-6 text-[15px] leading-[1.5] text-[#3c4149]">
              {t.thanks}
              <br />
              {t.team}
            </Text>
          </Container>

          <Container className="mx-auto mt-0 mb-10 max-w-[602px] px-8">
            <Text className="m-0 text-[13px] leading-[1.5] text-[#6b7280]">
              © {new Date().getFullYear()} LangQuest
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

DeletionScheduledEmail.PreviewProps = {
  purgeDate: 'July 23, 2026',
  locale: 'en'
} satisfies DeletionScheduledEmailProps;

export default DeletionScheduledEmail;
