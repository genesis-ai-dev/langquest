export class NotificationService {
  // async getAllNotifications(profile_id: string) {
  //   return await db.query.notification.findMany({
  //     where: eq(notification.profile_id, profile.id),
  //     with: {
  //       invite_request: true
  //     }
  //   });
  // }
  // async getAllInviteRequestNotifications(profile_id: string) {
  //   return await db.query.notification.findMany({
  //     where: and(
  //       eq(notification.profile_id, profile_id),
  //       isNotNull(notification.invite_request_id)
  //     ),
  //     with: {
  //       invite_request: {
  //         with: {
  //           sender: true,
  //           receiver: true,
  //           project: true
  //         }
  //       }
  //     }
  //   });
  // }
}

export const notificationService = new NotificationService();
