import { z } from 'zod';

interface EmailMessages {
  enterValidEmail: string;
  emailRequired: string;
}

interface PasswordRequiredMessage {
  passwordRequired: string;
}

export function requireOnline(isOnline: boolean, message: string): void {
  if (!isOnline) {
    throw new Error(message);
  }
}

function createEmailSchema(messages: EmailMessages) {
  return z
    .email(messages.enterValidEmail)
    .nonempty(messages.emailRequired)
    .toLowerCase()
    .trim();
}

export function createSignInSchema(
  messages: EmailMessages & PasswordRequiredMessage
) {
  return z.object({
    email: createEmailSchema(messages),
    password: z
      .string(messages.passwordRequired)
      .nonempty(messages.passwordRequired)
  });
}

export function createForgotPasswordSchema(messages: EmailMessages) {
  return z.object({
    email: createEmailSchema(messages)
  });
}

export function createRegisterSchema(
  messages: EmailMessages &
    PasswordRequiredMessage & {
      passwordMinLength: string;
      usernameRequired: string;
      passwordsNoMatch: string;
    }
) {
  return z
    .object({
      email: createEmailSchema(messages),
      password: z
        .string(messages.passwordRequired)
        .nonempty(messages.passwordRequired)
        .min(6, messages.passwordMinLength),
      confirmPassword: z
        .string(messages.passwordRequired)
        .nonempty(messages.passwordRequired),
      username: z
        .string(messages.usernameRequired)
        .nonempty(messages.usernameRequired)
        .min(3, messages.usernameRequired)
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: messages.passwordsNoMatch,
      path: ['confirmPassword']
    });
}

export type SignInFormValues = z.infer<ReturnType<typeof createSignInSchema>>;
export type ForgotPasswordFormValues = z.infer<
  ReturnType<typeof createForgotPasswordSchema>
>;
export type RegisterFormValues = z.infer<
  ReturnType<typeof createRegisterSchema>
>;
