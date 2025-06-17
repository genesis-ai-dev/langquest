import { Ratelimit } from 'https://cdn.skypack.dev/@upstash/ratelimit@latest';
import { Redis } from 'https://deno.land/x/upstash_redis@v1.19.3/mod.ts';
import { renderAsync } from 'npm:@react-email/components';
import { createClient } from 'npm:@supabase/supabase-js';
import React from 'npm:react';
import { Resend } from 'npm:resend';
import { Webhook } from 'npm:standardwebhooks';
import { ConfirmEmail } from './_templates/confirm-email.tsx';
import { InviteEmail } from './_templates/invite-email.tsx';
import { ResetPassword } from './_templates/reset-password.tsx';
const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
const rawHookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET');
const hookSecret = rawHookSecret.startsWith('v1,whsec_')
  ? rawHookSecret.substring(9) // Remove the 'v1,' prefix
  : rawHookSecret;
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(supabaseUrl, supabaseKey);
const signupEmailSubjects = {
  en: 'Confirm Your LangQuest Account',
  es: 'Confirma tu cuenta de LangQuest',
  fr: 'Confirmez votre compte LangQuest',
  'pt-BR': 'Confirme sua conta LangQuest'
};
// Email subject translations
const emailSubjects = {
  signup: signupEmailSubjects,
  email_change: signupEmailSubjects,
  recovery: {
    en: 'Reset Your LangQuest Password',
    es: 'Restablece tu contraseña de LangQuest',
    fr: 'Réinitialisez votre mot de passe LangQuest',
    'pt-BR': 'Redefina sua senha do LangQuest'
  },
  invite: {
    en: "You've been invited to join a project on LangQuest",
    es: 'Has sido invitado a unirte a un proyecto en LangQuest',
    fr: 'Vous avez été invité à rejoindre un projet sur LangQuest',
    'pt-BR': 'Você foi convidado para participar de um projeto no LangQuest'
  }
};
const emailTypeEndpoint = {
  email_change: 'registration-confirmation',
  signup: 'registration-confirmation',
  recovery: 'reset-password'
};
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
    limiter: Ratelimit.fixedWindow(4, '1 h'),
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
          .select('username, ui_language_id')
          .eq('id', record.sender_profile_id)
          .single();
        // Get language for localization
        const { data: language } = await supabase
          .from('language')
          .select('locale')
          .eq('id', sender?.ui_language_id)
          .single();
        const locale = language?.locale ?? 'en';
        const joinUrl = `${Deno.env.get('PLAY_STORE_URL')}`;
        const inviteComponent = React.createElement(InviteEmail, {
          projectName: project?.name ?? 'Unknown Project',
          inviterName: sender?.username ?? 'A LangQuest user',
          joinUrl,
          locale
        });
        const html = await renderAsync(inviteComponent);
        const text = await renderAsync(inviteComponent, {
          plainText: true
        });
        const subject = emailSubjects.invite[locale] ?? emailSubjects.invite.en;
        const { error } = await resend.emails.send({
          from: 'LangQuest <invitations@langquest.org>',
          to: [record.receiver_email],
          subject,
          html,
          text
        });
        if (error) throw error;
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
      .select('ui_language_id')
      .eq('username', user.user_metadata?.username)
      .single();
    const { data: language } = await supabase
      .from('language')
      .select('locale')
      .eq('id', profile?.ui_language_id ?? user.user_metadata?.ui_language_id)
      .single();
    const locale = language?.locale ?? 'en';
    const parsedRedirectTo = new URL(redirect_to);
    const parsedSiteUrl = new URL(site_url);
    const projectRef = parsedSiteUrl.host.split('.')[0];
    const confirmation_url = `https://${parsedRedirectTo.host}/supabase/${projectRef}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to.replace(parsedRedirectTo.host, `${parsedRedirectTo.host}/${locale}/${emailTypeEndpoint[email_action_type]}?project_ref=${projectRef}`)}`;
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
        html = await renderAsync(emailComponent);
        text = await renderAsync(emailComponent, {
          plainText: true
        });
        break;
      }
      case 'recovery': {
        const resetPasswordComponent = React.createElement(ResetPassword, {
          confirmation_url,
          locale
        });
        html = await renderAsync(resetPasswordComponent);
        text = await renderAsync(resetPasswordComponent, {
          plainText: true
        });
        break;
      }
      default:
        throw new Error('Unsupported email action type');
    }
    const sendEmail = user.new_email ?? user.email;
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
