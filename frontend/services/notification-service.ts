import { apiRequest } from "@/lib/api-client";
import type { Notification, NotificationFilters, NotificationPage } from "@/types/notification";
export const notificationService = {
  list: (filters: NotificationFilters, signal?: AbortSignal) => apiRequest<NotificationPage>("GET", "/notifications", { query: { ...filters }, signal }),
  read: (id: string) => apiRequest<Notification>("POST", `/notifications/${encodeURIComponent(id)}/read`),
};
