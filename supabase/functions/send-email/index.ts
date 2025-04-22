import React from 'npm:react';
import { Webhook } from 'npm:standardwebhooks';
import { Resend } from 'npm:resend';
import { renderAsync } from 'npm:@react-email/components';
import { createClient } from 'npm:@supabase/supabase-js';
import { ConfirmEmail } from './_templates/confirm-email.tsx';
import { ResetPassword } from './_templates/reset-password.tsx';
import { getISO2Language } from './_utils/iso-converter.ts';

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string);
const hookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET') as string;
const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
const supabase = createClient(supabaseUrl, supabaseKey);

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

    console.log('profile ui language id', profile?.ui_language_id);
    console.log('user ui language id', user.user_metadata?.ui_language_id);
    const { data: language } = await supabase
      .from('language')
      .select('iso639_3')
      .eq('id', profile?.ui_language_id ?? user.user_metadata?.ui_language_id)
      .single();

    console.log('language', language);

    const ui_language = getISO2Language(language?.iso639_3 ?? 'eng');

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

    switch (email_action_type) {
      case 'email_change':
      case 'signup':
        html = await renderAsync(
          React.createElement(ConfirmEmail, {
            confirmation_url,
            ui_language
          }) as React.ReactElement
        );
        subject =
          ui_language === 'es'
            ? 'Confirma tu cuenta de LangQuest'
            : ui_language === 'fr'
              ? 'Confirmez votre compte LangQuest'
              : 'Confirm Your LangQuest Account';
        break;
      case 'recovery':
        html = await renderAsync(
          React.createElement(ResetPassword, {
            confirmation_url,
            ui_language
          }) as React.ReactElement
        );
        subject =
          ui_language === 'es'
            ? 'Restablece tu contraseña de LangQuest'
            : ui_language === 'fr'
              ? 'Réinitialisez votre mot de passe LangQuest'
              : 'Reset Your LangQuest Password';
        break;
      default:
        throw new Error('Unsupported email action type');
    }

    const sendEmail = user.new_email ?? user.email;

    const { error } = await resend.emails.send({
      from: 'LangQuest <account-security@langquest.org>',
      to: [sendEmail],
      subject,
      html
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
