import type { SupabaseClient } from '@supabase/supabase-js';

export type EmailSuppressionReason =
  | 'hard_bounce'
  | 'complaint'
  | 'soft_bounce'
  | 'manual';

export interface EmailSuppressionRow {
  normalized_email: string;
  reason: EmailSuppressionReason;
  soft_bounce_count: number;
  suppressed_at: string | null;
  soft_suppressed_at: string | null;
  expires_at: string | null;
  deactivated_at: string | null;
  source_resend_email_id: string | null;
  created_at: string;
  updated_at: string;
}

const SOFT_SUPPRESSION_DAYS = 60;

export function normalizeRecipientEmail(
  raw: string | null | undefined
): string | null {
  const normalized = raw?.trim().toLowerCase();
  return normalized && normalized.length > 0 ? normalized : null;
}

export function recipientFromResendTo(
  to: string[] | null | undefined
): string | null {
  const first = to?.[0];
  if (!first) return null;
  const angle = first.match(/<([^>]+)>/);
  return normalizeRecipientEmail(angle?.[1] ?? first);
}

export function getSoftBounceThreshold(): number {
  const raw = Deno.env.get('EMAIL_SOFT_BOUNCE_THRESHOLD');
  const n = raw ? Number.parseInt(raw, 10) : 3;
  return Number.isFinite(n) && n >= 1 ? n : 3;
}

export function isSuppressionRowActive(
  row: Pick<
    EmailSuppressionRow,
    'suppressed_at' | 'soft_suppressed_at' | 'expires_at' | 'deactivated_at'
  > | null,
  now = new Date()
): boolean {
  if (!row || row.deactivated_at) return false;
  if (row.suppressed_at) return true;
  if (row.soft_suppressed_at && row.expires_at) {
    return new Date(row.expires_at) > now;
  }
  return false;
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

/** Lazy soft-tier expiry: deactivate and reset soft counters. */
export async function deactivateExpiredSoftSuppression(
  supabase: SupabaseClient,
  normalizedEmail: string,
  row: Pick<
    EmailSuppressionRow,
    'soft_suppressed_at' | 'expires_at' | 'deactivated_at' | 'suppressed_at'
  >
): Promise<void> {
  if (row.suppressed_at || row.deactivated_at || !row.soft_suppressed_at) {
    return;
  }
  if (!row.expires_at || new Date(row.expires_at) > new Date()) {
    return;
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('email_suppression')
    .update({
      deactivated_at: now,
      soft_suppressed_at: null,
      expires_at: null,
      soft_bounce_count: 0,
      updated_at: now
    })
    .eq('normalized_email', normalizedEmail);

  if (error) {
    console.error('[email_suppression] soft expiry deactivate:', error);
  }
}

export async function fetchEmailSuppression(
  supabase: SupabaseClient,
  normalizedEmail: string
): Promise<EmailSuppressionRow | null> {
  const { data, error } = await supabase
    .from('email_suppression')
    .select(
      'normalized_email, reason, soft_bounce_count, suppressed_at, soft_suppressed_at, expires_at, deactivated_at, source_resend_email_id, created_at, updated_at'
    )
    .eq('normalized_email', normalizedEmail)
    .maybeSingle();

  if (error) {
    console.error('[email_suppression] read:', error);
    return null;
  }

  return data as EmailSuppressionRow | null;
}

export async function isEmailAddressSuppressed(
  supabase: SupabaseClient,
  rawEmail: string | null | undefined
): Promise<boolean> {
  const normalized = normalizeRecipientEmail(rawEmail);
  if (!normalized) return false;

  const row = await fetchEmailSuppression(supabase, normalized);
  if (!row) return false;

  if (isSuppressionRowActive(row)) return true;

  await deactivateExpiredSoftSuppression(supabase, normalized, row);
  return false;
}

export async function applyHardBounceSuppression(
  supabase: SupabaseClient,
  normalizedEmail: string,
  resendEmailId: string,
  now: string
): Promise<void> {
  const { error } = await supabase.from('email_suppression').upsert(
    {
      normalized_email: normalizedEmail,
      reason: 'hard_bounce',
      suppressed_at: now,
      soft_bounce_count: 0,
      soft_suppressed_at: null,
      expires_at: null,
      deactivated_at: null,
      source_resend_email_id: resendEmailId,
      updated_at: now
    },
    { onConflict: 'normalized_email' }
  );

  if (error) {
    console.error('[email_suppression] hard bounce upsert:', error);
  }
}

export async function applyComplaintSuppression(
  supabase: SupabaseClient,
  normalizedEmail: string,
  resendEmailId: string,
  now: string
): Promise<void> {
  const { error } = await supabase.from('email_suppression').upsert(
    {
      normalized_email: normalizedEmail,
      reason: 'complaint',
      suppressed_at: now,
      soft_bounce_count: 0,
      soft_suppressed_at: null,
      expires_at: null,
      deactivated_at: null,
      source_resend_email_id: resendEmailId,
      updated_at: now
    },
    { onConflict: 'normalized_email' }
  );

  if (error) {
    console.error('[email_suppression] complaint upsert:', error);
  }
}

export async function applyTransientBounceSuppression(
  supabase: SupabaseClient,
  normalizedEmail: string,
  resendEmailId: string,
  now: string
): Promise<void> {
  const threshold = getSoftBounceThreshold();
  const existing = await fetchEmailSuppression(supabase, normalizedEmail);

  if (existing?.suppressed_at) {
    return;
  }

  if (existing) {
    await deactivateExpiredSoftSuppression(supabase, normalizedEmail, existing);
    const refreshed = await fetchEmailSuppression(supabase, normalizedEmail);
    if (refreshed?.suppressed_at) return;

    const baseCount =
      refreshed && !refreshed.deactivated_at
        ? (refreshed.soft_bounce_count ?? 0)
        : 0;
    const nextCount = baseCount + 1;
    const atThreshold = nextCount >= threshold;

    const patch: Record<string, unknown> = {
      normalized_email: normalizedEmail,
      reason: 'soft_bounce',
      soft_bounce_count: nextCount,
      source_resend_email_id: resendEmailId,
      updated_at: now,
      deactivated_at: null
    };

    if (atThreshold) {
      patch.soft_suppressed_at = now;
      patch.expires_at = addDaysIso(now, SOFT_SUPPRESSION_DAYS);
    }

    const { error } = await supabase
      .from('email_suppression')
      .upsert(patch, { onConflict: 'normalized_email' });

    if (error) {
      console.error('[email_suppression] soft bounce upsert:', error);
    }
    return;
  }

  const atThreshold = 1 >= threshold;
  const patch: Record<string, unknown> = {
    normalized_email: normalizedEmail,
    reason: 'soft_bounce',
    soft_bounce_count: 1,
    source_resend_email_id: resendEmailId,
    updated_at: now,
    created_at: now,
    deactivated_at: null
  };

  if (atThreshold) {
    patch.soft_suppressed_at = now;
    patch.expires_at = addDaysIso(now, SOFT_SUPPRESSION_DAYS);
  }

  const { error } = await supabase
    .from('email_suppression')
    .upsert(patch, { onConflict: 'normalized_email' });

  if (error) {
    console.error('[email_suppression] soft bounce upsert:', error);
  }
}
