export enum NotificationStates {
  UNREAD,
  READ,
}

export interface NotificationData {
  topic: string;
  title: string;
  body: string;
  bookingId: string;
}
