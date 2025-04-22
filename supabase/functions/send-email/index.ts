import React from "npm:react";
import { Webhook } from "npm:standardwebhooks";
import { Resend } from "npm:resend";
import { renderAsync } from "npm:@react-email/components";
import { createClient } from "npm:@supabase/supabase-js";
import { ConfirmEmail } from "./_templates/confirm-email.tsx";
import { ResetPassword } from "./_templates/reset-password.tsx";
import { getISO2Language } from "./_utils/iso-converter.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY") as string);
const hookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET") as string;

const productionSupabaseUrl = Deno.env.get("SUPABASE_URL") as string;
const productionSupabaseKey = Deno.env.get(
  "SUPABASE_ANON_KEY",
) as string;

const previewSupabaseUrl = Deno.env.get("SUPABASE_PREVIEW_URL") as string;
const previewSupabaseKey = Deno.env.get(
  "SUPABASE_PREVIEW_ANON_KEY",
) as string;

type Environment = "production" | "preview";
const getSupabase = (environment: Environment) => {
  const url = environment === "production"
    ? productionSupabaseUrl
    : previewSupabaseUrl;
  const key = environment === "production"
    ? productionSupabaseKey
    : previewSupabaseKey;
  return createClient(url, key);
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("not allowed", { status: 400 });
  }

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);
  const wh = new Webhook(hookSecret);

  try {
    const {
      user,
      email_data: { token_hash, redirect_to, site_url, email_action_type },
    } = wh.verify(payload, headers) as {
      user: {
        email: string;
        user_metadata?: {
          ui_language?: string;
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

    const parsedRedirectTo = new URL(redirect_to);
    const redirectToParams = new URLSearchParams(parsedRedirectTo.search);
    const environment = redirectToParams.get("environment") ?? "production";

    const supabase = getSupabase(environment as Environment);

    // Get user profile from database
    const { data: profile } = await supabase
      .from("profile")
      .select(
        `
        language:ui_language_id(iso639_3)
      `,
      )
      .eq("username", user.user_metadata?.username)
      .single();

    const ui_language = getISO2Language(profile?.language?.iso639_3 ?? "eng");

    const confirmation_url = `${site_url}${
      !site_url.endsWith("/auth/v1") ? "/auth/v1" : ""
    }/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${
      redirect_to.replace(
        parsedRedirectTo.host,
        `${parsedRedirectTo.host}/${ui_language}`,
      )
    }`;

    // Determine which template to use and prepare email data
    let subject: string;
    let html: string;

    switch (email_action_type) {
      case "email_change":
      case "signup":
        html = await renderAsync(
          React.createElement(ConfirmEmail, {
            confirmation_url,
            ui_language,
          }) as React.ReactElement,
        );
        subject = ui_language === "spanish"
          ? "Confirma tu cuenta de LangQuest"
          : ui_language === "french"
          ? "Confirmez votre compte LangQuest"
          : "Confirm Your LangQuest Account";
        break;
      case "recovery":
        html = await renderAsync(
          React.createElement(ResetPassword, {
            confirmation_url,
            ui_language,
          }) as React.ReactElement,
        );
        subject = ui_language === "spanish"
          ? "Restablece tu contraseña de LangQuest"
          : ui_language === "french"
          ? "Réinitialisez votre mot de passe LangQuest"
          : "Reset Your LangQuest Password";
        break;
      default:
        throw new Error("Unsupported email action type");
    }

    const { error } = await resend.emails.send({
      from: "LangQuest <account-security@langquest.org>",
      to: [user.email],
      subject,
      html,
    });

    if (error) throw error;
  } catch (error) {
    console.log(error);
    return new Response(
      JSON.stringify({
        error: {
          http_code: error instanceof Error ? error.code : 500,
          message: error instanceof Error ? error.message : error,
        },
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const responseHeaders = new Headers();
  responseHeaders.set("Content-Type", "application/json");
  return new Response(JSON.stringify({}), {
    status: 200,
    headers: responseHeaders,
  });
});
