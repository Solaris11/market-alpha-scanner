export const NOTIFICATION_TYPES = ["system", "subscription", "signal", "email_verification"] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type UserNotification = {
  actionUrl: string | null;
  createdAt: string;
  id: string;
  message: string;
  read: boolean;
  title: string;
  type: NotificationType;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isNotificationType(value: unknown): value is NotificationType {
  return typeof value === "string" && NOTIFICATION_TYPES.includes(value as NotificationType);
}

export function normalizeNotificationId(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return UUID_RE.test(text) ? text : null;
}

export function notificationDisplayMessage(notification: Pick<UserNotification, "message" | "type">): string {
  if (notification.type === "email_verification") {
    return "Verify your email address. Check your inbox or spam/junk folder.";
  }
  return notification.message;
}
