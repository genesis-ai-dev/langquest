import { renderAsync } from 'npm:@react-email/components';
import { createClient } from 'npm:@supabase/supabase-js';
import React from 'npm:react';
import { Resend } from 'npm:resend';
import { Webhook } from 'npm:standardwebhooks';
import { ConfirmEmail } from './_templates/confirm-email.tsx';
import { ResetPassword } from './_templates/reset-password.tsx';

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string);
// const hookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET') as string;
const rawHookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET') as string;
const hookSecret = rawHookSecret.startsWith('v1,whsec_')
  ? rawHookSecret.substring(3) // Remove the 'v1,' prefix
  : rawHookSecret;
const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
const supabase = createClient(supabaseUrl, supabaseKey);

// Email subject translations
const emailSubjects = {
  signup: {
    en: 'Confirm Your LangQuest Account',
    es: 'Confirma tu cuenta de LangQuest',
    fr: 'Confirmez votre compte LangQuest',
    'pt-BR': 'Confirme sua conta LangQuest'
  },
  recovery: {
    en: 'Reset Your LangQuest Password',
    es: 'Restablece tu contraseña de LangQuest',
    fr: 'Réinitialisez votre mot de passe LangQuest',
    'pt-BR': 'Redefina sua senha do LangQuest'
  }
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('not allowed', { status: 400 });
  }

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);
  const wh = new Webhook(hookSecret);

  try {
    const {
      user,
      email_data: { token_hash, redirect_to, site_url, email_action_type }
    } = wh.verify(payload, headers) as {
      user: {
        email: string;
        new_email?: string;
        user_metadata?: {
          ui_language_id?: string;
          username?: string;
        };
      };
      email_data: {
        token: string;
        token_hash: string;
        redirect_to: string;
        email_action_type: string;
        site_url: string;
        token_new: string;
        token_hash_new: string;
      };
    };

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

    const ui_language = language?.locale ?? 'en';

    const parsedRedirectTo = new URL(redirect_to);
    const confirmation_url = `${site_url}${
      !site_url.endsWith('/auth/v1') ? '/auth/v1' : ''
    }/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to.replace(
      parsedRedirectTo.host,
      `${parsedRedirectTo.host}/${ui_language}`
    )}`;

    // Determine which template to use and prepare email data
    let subject: string;
    let html: string;
    let text: string;

    switch (email_action_type) {
      case 'email_change':
      case 'signup': {
        const emailComponent = React.createElement(ConfirmEmail, {
          confirmation_url,
          ui_language
        }) as React.ReactElement;

        html = await renderAsync(emailComponent);
        text = await renderAsync(emailComponent, { plainText: true });
        subject =
          emailSubjects.signup[
            ui_language as keyof typeof emailSubjects.signup
          ] || emailSubjects.signup.en;
        break;
      }
      case 'recovery': {
        const resetPasswordComponent = React.createElement(ResetPassword, {
          confirmation_url,
          ui_language
        }) as React.ReactElement;

        html = await renderAsync(resetPasswordComponent);
        text = await renderAsync(resetPasswordComponent, { plainText: true });
        subject =
          emailSubjects.recovery[
            ui_language as keyof typeof emailSubjects.recovery
          ] || emailSubjects.recovery.en;
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
        headers: { 'Content-Type': 'application/json' }
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
