import { isExpiredByLastUpdated } from '@/utils/dateUtils';

export type MembershipRequestUiStatus = string | null;

export function membershipRequestUiStatus(
  request: { status: string; last_updated: string } | null | undefined,
  isExpired: (lastUpdated: string) => boolean = isExpiredByLastUpdated
): MembershipRequestUiStatus {
  if (!request) return null;

  if (request.status === 'pending' && isExpired(request.last_updated)) {
    return 'expired';
  }

  return request.status;
}
