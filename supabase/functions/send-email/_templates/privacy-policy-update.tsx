import {
  Body,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Tailwind,
  Text
} from '@react-email/components';

const privacyPolicyUrl = 'https://langquest.org/privacy';

export interface PrivacyPolicyUpdateEmailProps {
  effectiveDate: string;
  summary: string;
  changesBody: string;
  logoUrl?: string;
}

export const PrivacyPolicyUpdateEmail = ({
  effectiveDate,
  summary,
  changesBody,
  logoUrl = 'https://langquest.org/langquest-logo-light.png'
}: PrivacyPolicyUpdateEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>See what changed in our Privacy Policy</Preview>
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
              We&apos;re updating our Privacy Policy
            </Heading>

            <Text className="m-0 mb-4 text-[15px] leading-[1.5] text-[#3c4149]">
              Hello LangQuest User,
            </Text>
            <Text className="m-0 mb-6 text-[15px] leading-[1.5] text-[#3c4149]">
              We&apos;re updating our Privacy Policy, effective {effectiveDate}.
            </Text>

            <Text className="m-0 mb-2 text-[15px] leading-[1.5] font-bold text-[#3c4149]">
              Here&apos;s the gist:
            </Text>
            <Text className="m-0 mb-8 text-[15px] leading-[1.5] whitespace-pre-line text-[#3c4149]">
              {summary}
            </Text>

            <Text className="m-0 mb-0 text-[15px] leading-[1.5] text-[#3c4149]">
              The specific policy language is changing as follows:
            </Text>

            <Hr className="my-6 border-[#e5e7eb]" />

            <div
              className="text-[15px] leading-[1.5] text-[#3c4149]"
              dangerouslySetInnerHTML={{ __html: changesBody }}
            />

            <Hr className="my-6 border-[#e5e7eb]" />

            <Text className="m-0 mb-6 text-[15px] leading-[1.5] text-[#3c4149]">
              You can read the updated Privacy Policy{' '}
              <Link
                href={privacyPolicyUrl}
                className="text-[15px] text-[#6D55CE] no-underline"
              >
                here
              </Link>
              .
            </Text>

            <Text className="m-0 mt-6 text-[15px] leading-[1.5] text-[#3c4149]">
              Thanks,
              <br />
              The LangQuest team
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

PrivacyPolicyUpdateEmail.PreviewProps = {
  effectiveDate: 'July 8, 2026',
  summary:
    'We want to link anonymous analytics and session replays to signed-in accounts. It helps us understand and fix bugs faster.\n\nOur Privacy Policy now reflects this: it describes account-linked analytics and limited session replay on supported devices, and clarifies that disabling analytics in profile settings stops linking events to your account and turns off further analytics and replay collection.',
  changesBody: `<p style="margin:0 0 12px;line-height:1.5;font-size:15px;color:#3c4149"><strong>Current wording:</strong> Unique identifiers: randomly generated device identifiers that don't personally identify you but help us analyze usage patterns.</p>
<p style="margin:0 0 24px;line-height:1.5;font-size:15px;color:#3c4149"><strong>New wording:</strong> Account linkage: if you are signed in and have not opted out of analytics, we associate usage events with your account user ID…</p>
<p style="margin:0 0 12px;line-height:1.5;font-size:15px;color:#3c4149"><strong>Current wording:</strong> You can opt out of analytics collection directly in the App's profile settings…</p>
<p style="margin:0 0 24px;line-height:1.5;font-size:15px;color:#3c4149"><strong>New wording:</strong> You can opt out of analytics collection directly in the App's profile settings… <strong>This stops linking usage events to your account user ID and prevents further analytics and session replay collection while you continue to use the App.</strong></p>`
} satisfies PrivacyPolicyUpdateEmailProps;

export default PrivacyPolicyUpdateEmail;
