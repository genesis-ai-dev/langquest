import { render } from '@react-email/render';
import '@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from '@supabase/supabase-js';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import React from 'react';
import { Resend } from 'resend';
import { Webhook } from 'standardwebhooks';
import { isEmailAddressSuppressed } from '../shared/emailSuppression.ts';
import { ConfirmEmail } from './_templates/confirm-email.tsx';
import { InviteEmail } from './_templates/invite-email.tsx';
import { ResetPassword } from './_templates/reset-password.tsx';
import {
  getMaxInviteResendAttempts,
  inviteMaySendAnotherOutboundEmail
} from './inviteBounceGuard.ts';

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
const rawHookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET')!;
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SERVICE_ROLE_KEY')!;

const hookSecret = rawHookSecret.startsWith('v1,whsec_')
  ? rawHookSecret.substring(9) // Remove the 'v1,' prefix
  : rawHookSecret;

const supabase = createClient(supabaseUrl, supabaseKey);

const signupEmailSubjects = {
  en: 'Confirm Your LangQuest Account',
  es: 'Confirma tu cuenta de LangQuest',
  fr: 'Confirmez votre compte LangQuest',
  'pt-BR': 'Confirme sua conta LangQuest',
  'id-ID': 'Konfirmasi Akun LangQuest Anda',
  'tpi-PG': 'Strongim LangQuest Akaun bilong yu',
  ne: 'तपाईंको LangQuest खाता पुष्टि गर्नुहोस्',
  hi: 'अपना LangQuest खाता पुष्टि करें',
  my: 'သင်၏ LangQuest အကောင့်ကို အတည်ပြုပါ',
  th: 'ยืนยันบัญชี LangQuest ของคุณ',
  'zh-CN': '确认您的 LangQuest 账户'
};

// Email subject translations
const emailSubjects = {
  signup: signupEmailSubjects,
  email_change: signupEmailSubjects,
  recovery: {
    en: 'Reset Your LangQuest Password',
    es: 'Restablece tu contraseña de LangQuest',
    fr: 'Réinitialisez votre mot de passe LangQuest',
    'pt-BR': 'Redefina sua senha do LangQuest',
    'id-ID': 'Atur Ulang Kata Sandi LangQuest Anda',
    'tpi-PG': 'Resetim LangQuest Password bilong yu',
    ne: 'तपाईंको LangQuest पासवर्ड रिसेट गर्नुहोस्',
    hi: 'अपना LangQuest पासवर्ड रीसेट करें',
    my: 'သင်၏ LangQuest စကားဝှက်ကို ပြန်လည်သတ်မှတ်ပါ',
    th: 'รีเซ็ตรหัสผ่าน LangQuest ของคุณ',
    'zh-CN': '重置您的 LangQuest 密码'
  },
  invite: {
    en: "You've been invited to join a project on LangQuest",
    es: 'Has sido invitado a unirte a un proyecto en LangQuest',
    fr: 'Vous avez été invité à rejoindre un projet sur LangQuest',
    'pt-BR': 'Você foi convidado para participar de um projeto no LangQuest',
    'id-ID': 'Anda telah diundang untuk bergabung dalam proyek di LangQuest',
    'tpi-PG': 'Yu telah strongim langquest bilong yu',
    ne: 'तपाईंलाई LangQuest मा एउटा प्रोजेक्टमा सामेल हुन आमन्त्रित गरिएको छ',
    hi: 'आपको LangQuest पर एक प्रोजेक्ट में शामिल होने के लिए आमंत्रित किया गया है',
    my: 'သင့်အား LangQuest တွင် စီမံကိန်းတစ်ခုတွင် ပါဝင်ရန် ဖိတ်ခေါ်ထားပါသည်',
    th: 'คุณได้รับเชิญให้เข้าร่วมโครงการใน LangQuest',
    'zh-CN': '您已被邀请加入 LangQuest 上的项目'
  }
};

const emailTypeEndpoint = {
  email_change: 'registration-confirmation',
  signup: 'registration-confirmation',
  recovery: 'reset-password'
};

/**
 * Maps languoid.name to locale code for email localization
 */
function mapLanguoidNameToLocale(
  languoidName: string | null | undefined
): string {
  if (!languoidName) return 'en';

  const normalized = languoidName.toLowerCase().trim();

  // Map languoid names to locale codes
  const mapping: Record<string, string> = {
    english: 'en',
    spanish: 'es',
    french: 'fr',
    'brazilian portuguese': 'pt-BR',
    'tok pisin': 'tpi-PG',
    'standard indonesian': 'id-ID',
    indonesian: 'id-ID', // Also handle just "Indonesian"
    nepali: 'ne',
    hindi: 'hi',
    burmese: 'my',
    myanmar: 'my',
    thai: 'th',
    mandarin: 'zh-CN',
    'mandarin chinese': 'zh-CN',
    chinese: 'zh-CN'
  };

  return mapping[normalized] ?? 'en';
}
Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('not allowed', {
      status: 400
    });
  }
  const redis = new Redis({
    url: Deno.env.get('UPSTASH_REDIS_REST_URL'),
    token: Deno.env.get('UPSTASH_REDIS_REST_TOKEN')
  });
  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.fixedWindow(20, '1 h'),
    analytics: true
  });
  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);
  const wh = new Webhook(hookSecret);
  try {
    // Check if this is an invite request webhook
    const parsedPayload = JSON.parse(payload);
    if (parsedPayload.type === 'invite') {
      // Handle invite request
      const { record } = parsedPayload;
      const { data: inviteRow } = await supabase
        .from('invite')
        .select('email_status, count')
        .eq('id', record.id)
        .single();

      if (await isEmailAddressSuppressed(supabase, record.receiver_email)) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'email_globally_suppressed'
          }),
          {
            status: 422,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      const maxResendAttempts = getMaxInviteResendAttempts();

      if (
        inviteRow?.email_status === 'bounced' &&
        !inviteMaySendAnotherOutboundEmail(
          inviteRow.count,
          false,
          maxResendAttempts
        )
      ) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'invite_bounce_retry_exhausted'
          }),
          {
            status: 422,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      // Check if email exists in profile table
      const { data: existingProfile } = await supabase
        .from('profile')
        .select('id')
        .eq('email', record.receiver_email)
        .single();
      // Update status to pending
      await supabase
        .from('invite')
        .update({
          status: 'pending'
        })
        .eq('id', record.id);
      // Only send email if user doesn't exist
      if (!existingProfile) {
        // Get project details
        const { data: project } = await supabase
          .from('project')
          .select('name')
          .eq('id', record.project_id)
          .single();
        // Get sender details
        const { data: sender } = await supabase
          .from('profile')
          .select('username, ui_language_id, ui_languoid_id')
          .eq('id', record.sender_profile_id)
          .single();
        // Get languoid for localization (prefer ui_languoid_id, fallback to ui_language_id)
        let locale = 'en';
        if (sender?.ui_languoid_id) {
          const { data: languoid } = await supabase
            .from('languoid')
            .select('name')
            .eq('id', sender.ui_languoid_id)
            .single();
          locale = mapLanguoidNameToLocale(languoid?.name);
        } else if (sender?.ui_language_id) {
          // Fallback to old language table for backward compatibility
          const { data: language } = await supabase
            .from('language')
            .select('locale')
            .eq('id', sender.ui_language_id)
            .single();
          locale = language?.locale ?? 'en';
        }
        // Construct the invite URL that goes to the website notifications page
        // The website will handle deep linking to the app or redirecting to stores
        const siteUrl = Deno.env.get('AUTH_SITE_URL');
        const joinUrl = `${siteUrl}/notifications`;

        const inviteComponent = React.createElement(InviteEmail, {
          projectName: project?.name ?? 'Unknown Project',
          inviterName: sender?.username ?? 'A LangQuest user',
          joinUrl,
          locale
        });
        const html = await render(inviteComponent);
        const text = await render(inviteComponent, {
          plainText: true
        });
        const subject = emailSubjects.invite[locale] ?? emailSubjects.invite.en;
        const { data: emailData, error } = await resend.emails.send({
          from: 'LangQuest <invitations@langquest.org>',
          to: [record.receiver_email],
          subject,
          html,
          text
        });
        if (error) throw error;

        // Update invite with email tracking data
        const { error: updateError } = await supabase
          .from('invite')
          .update({
            resend_email_id: emailData?.id,
            email_status: 'sent',
            email_sent_at: new Date().toISOString()
          })
          .eq('id', record.id);

        if (updateError) {
          console.error('Failed to update invite email tracking:', updateError);
          // Don't throw - email was sent successfully, just tracking failed
        }
      }
      return new Response(
        JSON.stringify({
          success: true
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }
    // Handle regular auth emails (existing code)
    const {
      user,
      email_data: { token_hash, redirect_to, site_url, email_action_type }
    } = wh.verify(payload, headers);
    const identifier = user.email;
    const { success } = await ratelimit.limit(identifier);
    if (!success) {
      return new Response(null, {
        status: 429
      });
    }
    // Get user profile from database
    const { data: profile } = await supabase
      .from('profile')
      .select('ui_language_id, ui_languoid_id')
      .eq('username', user.user_metadata?.username)
      .single();

    // Get locale from languoid (prefer ui_languoid_id, fallback to ui_language_id)
    let locale = 'en';
    const uiLanguoidId =
      profile?.ui_languoid_id ?? user.user_metadata?.ui_languoid_id;
    const uiLanguageId =
      profile?.ui_language_id ?? user.user_metadata?.ui_language_id;

    if (uiLanguoidId) {
      const { data: languoid } = await supabase
        .from('languoid')
        .select('name')
        .eq('id', uiLanguoidId)
        .single();
      locale = mapLanguoidNameToLocale(languoid?.name);
    } else if (uiLanguageId) {
      // Fallback to old language table for backward compatibility
      const { data: language } = await supabase
        .from('language')
        .select('locale')
        .eq('id', uiLanguageId)
        .single();
      locale = language?.locale ?? 'en';
    }
    const parsedRedirectTo = new URL(redirect_to);
    const parsedSiteUrl = new URL(site_url);
    const projectRef = parsedSiteUrl.host.split('.')[0];
    const confirmation_url = `${parsedRedirectTo.protocol}//${parsedRedirectTo.host}/supabase/${projectRef}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to.replace(parsedRedirectTo.host, `${parsedRedirectTo.host}/${locale}/${emailTypeEndpoint[email_action_type]}`)}`;
    const languageEmailSubjects = emailSubjects[email_action_type];
    // Determine which template to use and prepare email data
    const subject = languageEmailSubjects[locale];
    let html;
    let text;
    switch (email_action_type) {
      case 'email_change':
      case 'signup': {
        const emailComponent = React.createElement(ConfirmEmail, {
          confirmation_url,
          locale
        });
        html = await render(emailComponent);
        text = await render(emailComponent, {
          plainText: true
        });
        break;
      }
      case 'recovery': {
        const resetPasswordComponent = React.createElement(ResetPassword, {
          confirmation_url,
          locale
        });
        html = await render(resetPasswordComponent);
        text = await render(resetPasswordComponent, {
          plainText: true
        });
        break;
      }
      default:
        throw new Error('Unsupported email action type');
    }
    const sendEmail = user.new_email ?? user.email;

    if (await isEmailAddressSuppressed(supabase, sendEmail)) {
      return new Response(
        JSON.stringify({
          error: {
            http_code: 422,
            message: 'email_globally_suppressed'
          }
        }),
        {
          status: 422,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const { error } = await resend.emails.send({
      from: 'LangQuest <account-security@langquest.org>',
      to: [sendEmail],
      subject,
      html,
      text
    });
    if (error) throw error;
  } catch (error) {
    console.log(error);
    return new Response(
      JSON.stringify({
        error: {
          http_code: error instanceof Error ? error.code : 500,
          message: error instanceof Error ? error.message : error
        }
      }),
      {
        status: 401,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
  const responseHeaders = new Headers();
  responseHeaders.set('Content-Type', 'application/json');
  return new Response(JSON.stringify({}), {
    status: 200,
    headers: responseHeaders
  });
});
