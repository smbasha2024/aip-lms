export type NotificationType = "LEAVE_SUBMITTED" | "LEAVE_APPROVED" | "LEAVE_REJECTED" | "LEAVE_CANCELLED" | "SYSTEM";
export interface Notification {
  notification_id: string;
  notification_type: NotificationType;
  title: string;
  message: string;
  reference_type: string | null;
  reference_id: string | null;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
}
export interface NotificationFilters { is_read?: boolean; page: number; page_size: number }
export interface NotificationPage { items: Notification[]; page: number; page_size: number; total: number }
