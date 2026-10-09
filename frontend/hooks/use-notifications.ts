"use client";
import { useEffect, useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import { notificationService } from "@/services/notification-service";
import type { DashboardResponse } from "@/types/employee";
import type { NotificationFilters } from "@/types/notification";
function subscribeVisibility(callback: () => void) {
  document.addEventListener("visibilitychange", callback);
  return () => document.removeEventListener("visibilitychange", callback);
}
export function useNotifications(filters: NotificationFilters | null) {
  const { user } = useAuth();
  const visible = useSyncExternalStore(subscribeVisibility, () => document.visibilityState !== "hidden", () => false);
  const enabled = !!user && !!filters && visible;
  const query = useQuery({
    queryKey: ["notifications", user?.user_id, filters],
    queryFn: ({ signal }) => notificationService.list(filters!, signal),
    enabled, refetchInterval: enabled ? 60_000 : false,
    refetchIntervalInBackground: false, refetchOnWindowFocus: "always",
  });
  const refetch = query.refetch;
  useEffect(() => {
    if (!enabled) return;
    const refresh = () => { if (document.visibilityState !== "hidden") void refetch(); };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [enabled, refetch]);
  return query;
}
export function useNotificationCount() {
  const { user } = useAuth();
  const year = Number(user?.business_today.slice(0, 4));
  // Observe cache state directly: disabled query observers treat invalidated data
  // as non-stale. Cache subscription also avoids any dashboard request for the bell.
  const client = useQueryClient();
  const dashboard = useSyncExternalStore(
    callback => client.getQueryCache().subscribe(callback),
    () => client.getQueryState<DashboardResponse>(["dashboard", user?.employee_id, year]),
    () => undefined,
  );
  const unread = useNotifications({ is_read: false, page: 1, page_size: 1 });
  const dashboardCount = dashboard && !dashboard.isInvalidated ? dashboard.data?.unread_notification_count : undefined;
  const count = dashboardCount !== undefined && dashboard!.dataUpdatedAt > unread.dataUpdatedAt
    ? dashboardCount : unread.data?.total ?? dashboardCount;
  return { count, query: unread };
}
export function useMarkNotificationRead(feedback: (message: string) => void) {
  const client = useQueryClient();
  return useMutation({ mutationFn: notificationService.read, retry: false,
    onSuccess: () => feedback("Notification marked as read."),
    onError: () => feedback("Could not mark the notification as read. You can retry from Notifications."),
    onSettled: async () => { await Promise.all(["notifications", "dashboard"].map(key => client.invalidateQueries({ queryKey: [key] }))); },
  });
}
