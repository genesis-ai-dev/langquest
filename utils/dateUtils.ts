// Expiry constants
export const INVITATION_EXPIRY_DAYS = 7;
export const INVITATION_EXPIRY_MS =
  INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

// Helper function to check if invitation/request is expired
export function isInvitationExpired(createdAt: string): boolean {
  const createdDate = new Date(createdAt);
  const now = new Date();
  const daysDiff =
    (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
  return daysDiff > INVITATION_EXPIRY_DAYS;
}

// Helper function to check if invitation/request is expired based on last updated
export function isExpiredByLastUpdated(lastUpdated: string): boolean {
  const updatedDate = new Date(lastUpdated);
  const now = new Date();
  return now.getTime() - updatedDate.getTime() > INVITATION_EXPIRY_MS;
}

// Helper function to check if invitation should be hidden (3 days after expiry/decline)
export function shouldHideInvitation(
  status: string,
  lastUpdated: string,
  createdAt: string
): boolean {
  if (status === 'declined' || isInvitationExpired(createdAt)) {
    const updatedDate = new Date(lastUpdated);
    const now = new Date();
    const daysDiff =
      (now.getTime() - updatedDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff > 3;
  }
  return false;
}

export function formatRelativeDate(dateString: string): string {
  // Both SQLite ("2026-03-20 14:30:00") and Postgres ("2026-03-20 14:30:00+00")
  // use a space between date and time. Hermes requires the ISO 8601 'T' separator,
  // so always replace the first space in the datetime portion. For SQLite strings
  // that lack a timezone suffix, also append 'Z' to mark them as UTC.
  let normalized = dateString.replace(' ', 'T');
  const hasTimezone = /([Z]|[+-]\d{2}:?\d{0,2})$/.test(normalized);
  if (!hasTimezone) {
    normalized = normalized + 'Z';
  }
  const date = new Date(normalized);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > 365) {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } else if (diffDays > 30) {
    const months = Math.floor(diffDays / 30);
    return `${months} month${months > 1 ? 's' : ''} ago`;
  } else if (diffDays > 1) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  } else {
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
    if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else {
      const diffMinutes = Math.floor(diffTime / (1000 * 60));
      return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    }
  }
}

export function toPostgresDate(date: Date) {
  return date.toISOString().replace('T', ' ').slice(0, 19) + '+00';
}
