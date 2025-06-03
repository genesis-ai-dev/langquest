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

console.log('🚀 Send-email function starting up...');

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string);
const rawHookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET') as string;
const hookSecret = rawHookSecret.startsWith('v1,whsec_')
  ? rawHookSecret.substring(9) // Remove the 'v1,' prefix
  : rawHookSecret;
const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
const supabase = createClient(supabaseUrl, supabaseKey);

console.log('✅ Environment variables loaded and clients initialized');

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

type EmailTypeEndpoint = keyof typeof emailTypeEndpoint;
const emailTypeEndpoint = {
  email_change: 'registration-confirmation',
  signup: 'registration-confirmation',
  recovery: 'reset-password'
} as const;

Deno.serve(async (req) => {
  console.log(`📨 Incoming ${req.method} request to send-email function`);

  if (req.method !== 'POST') {
    console.log('❌ Method not allowed:', req.method);
    return new Response('not allowed', { status: 400 });
  }

  console.log('🔧 Initializing Redis and rate limiting...');
  const redis = new Redis({
    url: Deno.env.get('UPSTASH_REDIS_REST_URL')!,
    token: Deno.env.get('UPSTASH_REDIS_REST_TOKEN')!
  });

  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.fixedWindow(4, '1 h'),
    analytics: true
  });

  console.log('📥 Reading request payload...');
  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);
  const wh = new Webhook(hookSecret);

  try {
    console.log('🔍 Parsing payload...');
    // Check if this is an invite request webhook
    const parsedPayload = JSON.parse(payload);
    console.log('📋 Payload type:', parsedPayload.type);

    if (parsedPayload.type === 'invite_request') {
      console.log('📧 Processing invite request...');
      // Handle invite request
      const { record } = parsedPayload;
      console.log('👤 Invite details:', {
        id: record.id,
        receiver_email: record.receiver_email,
        project_id: record.project_id,
        sender_profile_id: record.sender_profile_id
      });

      console.log('🔍 Checking if email exists in profile table...');
      // Check if email exists in profile table
      const { data: existingProfile, error: profileError } = await supabase
        .from('profile')
        .select('id')
        .eq('email', record.receiver_email)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('❌ Error checking existing profile:', profileError);
        throw profileError;
      }

      console.log('📝 Updating invite status to pending...');
      // Update status to pending
      const { error: updateError } = await supabase
        .from('invite_request')
        .update({ status: 'pending' })
        .eq('id', record.id);

      if (updateError) {
        console.error('❌ Error updating invite status:', updateError);
        throw updateError;
      }

      // Only send email if user doesn't exist
      if (!existingProfile) {
        console.log('👤 User does not exist, sending invite email...');

        console.log('🏗️ Fetching project details...');
        // Get project details
        const { data: project, error: projectError } = await supabase
          .from('project')
          .select('name')
          .eq('id', record.project_id)
          .single();

        if (projectError) {
          console.error('❌ Error fetching project:', projectError);
          throw projectError;
        }

        console.log('👤 Fetching sender details...');
        // Get sender details
        const { data: sender, error: senderError } = await supabase
          .from('profile')
          .select('username, ui_language_id')
          .eq('id', record.sender_profile_id)
          .single();

        if (senderError) {
          console.error('❌ Error fetching sender:', senderError);
          throw senderError;
        }

        console.log('🌐 Fetching language for localization...');
        // Get language for localization
        const { data: language, error: languageError } = await supabase
          .from('language')
          .select('locale')
          .eq('id', sender?.ui_language_id)
          .single();

        if (languageError && languageError.code !== 'PGRST116') {
          console.error('❌ Error fetching language:', languageError);
        }

        const locale = language?.locale ?? 'en';
        const joinUrl = `${Deno.env.get('SITE_URL')}/register?invite=${record.id}`;

        console.log('📧 Preparing invite email...', {
          locale,
          projectName: project?.name,
          inviterName: sender?.username,
          joinUrl
        });

        const inviteComponent = React.createElement(InviteEmail, {
          projectName: project?.name ?? 'Unknown Project',
          inviterName: sender?.username ?? 'A LangQuest user',
          joinUrl,
          locale
        }) as React.ReactElement;

        console.log('🎨 Rendering email templates...');
        const html = await renderAsync(inviteComponent);
        const text = await renderAsync(inviteComponent, { plainText: true });

        const subject =
          emailSubjects.invite[locale as keyof typeof emailSubjects.invite] ??
          emailSubjects.invite.en;

        console.log('📤 Sending invite email via Resend...', {
          to: record.receiver_email,
          subject,
          from: 'LangQuest <invitations@langquest.org>'
        });

        const { error } = await resend.emails.send({
          from: 'LangQuest <invitations@langquest.org>',
          to: [record.receiver_email],
          subject,
          html,
          text
        });

        if (error) {
          console.error('❌ Error sending invite email:', error);
          throw error;
        }

        console.log('✅ Invite email sent successfully');
      } else {
        console.log('👤 User already exists, skipping email send');
      }

      console.log('✅ Invite request processed successfully');
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('🔐 Processing regular auth email...');
    // Handle regular auth emails (existing code)
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

    console.log('📧 Auth email details:', {
      email: user.email,
      new_email: user.new_email,
      email_action_type,
      username: user.user_metadata?.username
    });

    const identifier = user.email;
    console.log('🚦 Checking rate limit for:', identifier);
    const { success } = await ratelimit.limit(identifier);

    if (!success) {
      console.log('⚠️ Rate limit exceeded for:', identifier);
      return new Response(null, { status: 429 });
    }

    console.log('👤 Fetching user profile from database...');
    // Get user profile from database
    const { data: profile, error: profileError } = await supabase
      .from('profile')
      .select('ui_language_id')
      .eq('username', user.user_metadata?.username)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('❌ Error fetching user profile:', profileError);
    }

    console.log('🌐 Fetching language settings...');
    const { data: language, error: languageError } = await supabase
      .from('language')
      .select('locale')
      .eq('id', profile?.ui_language_id ?? user.user_metadata?.ui_language_id)
      .single();

    if (languageError && languageError.code !== 'PGRST116') {
      console.error('❌ Error fetching language:', languageError);
    }

    const locale = language?.locale ?? 'en';
    console.log('🌐 Using locale:', locale);

    const parsedRedirectTo = new URL(redirect_to);
    const parsedSiteUrl = new URL(site_url);
    const confirmation_url = `https://${parsedRedirectTo.host}/supabase/${parsedSiteUrl.host.split('.')[0]}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to.replace(
      parsedRedirectTo.host,
      `${parsedRedirectTo.host}/${locale}/${emailTypeEndpoint[email_action_type as EmailTypeEndpoint]}`
    )}`;

    console.log(
      '🔗 Generated confirmation URL for email type:',
      email_action_type
    );

    // Determine which template to use and prepare email data
    type Language = (typeof emailSubjects)[keyof typeof emailSubjects];
    type EmailActionType = keyof typeof emailSubjects;

    const languageEmailSubjects =
      emailSubjects[email_action_type as EmailActionType];

    // Determine which template to use and prepare email data
    const subject = languageEmailSubjects[locale as keyof Language];
    let html: string;
    let text: string;

    console.log(
      '🎨 Rendering email template for action type:',
      email_action_type
    );
    switch (email_action_type) {
      case 'email_change':
      case 'signup': {
        console.log('📧 Rendering confirmation email template...');
        const emailComponent = React.createElement(ConfirmEmail, {
          confirmation_url,
          locale
        }) as React.ReactElement;

        html = await renderAsync(emailComponent);
        text = await renderAsync(emailComponent, { plainText: true });
        break;
      }
      case 'recovery': {
        console.log('🔐 Rendering password reset email template...');
        const resetPasswordComponent = React.createElement(ResetPassword, {
          confirmation_url,
          locale
        }) as React.ReactElement;

        html = await renderAsync(resetPasswordComponent);
        text = await renderAsync(resetPasswordComponent, { plainText: true });
        break;
      }
      default:
        console.error('❌ Unsupported email action type:', email_action_type);
        throw new Error('Unsupported email action type');
    }

    const sendEmail = user.new_email ?? user.email;
    console.log('📤 Sending auth email via Resend...', {
      to: sendEmail,
      subject,
      from: 'LangQuest <account-security@langquest.org>',
      action_type: email_action_type
    });

    const { error } = await resend.emails.send({
      from: 'LangQuest <account-security@langquest.org>',
      to: [sendEmail],
      subject,
      html,
      text
    });

    if (error) {
      console.error('❌ Error sending auth email:', error);
      throw error;
    }

    console.log('✅ Auth email sent successfully');
  } catch (error) {
    console.error('💥 Error in send-email function:', error);
    console.error('📋 Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    return new Response(
      JSON.stringify({
        error: {
          http_code: error instanceof Error ? (error as any).code || 500 : 500,
          message: error instanceof Error ? error.message : error
        }
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  console.log('✅ Send-email function completed successfully');
  const responseHeaders = new Headers();
  responseHeaders.set('Content-Type', 'application/json');
  return new Response(JSON.stringify({}), {
    status: 200,
    headers: responseHeaders
  });
});
