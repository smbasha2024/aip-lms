"use client";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useNotifications } from "@/hooks/use-notifications";
import { useNotificationFilters } from "@/hooks/use-notification-filters";
import { QueryError, QueryLoading } from "@/components/common/QueryState";
import { ListPagination } from "@/components/common/ListPagination";
import { NotificationList } from "./NotificationList";
export function NotificationsScreen() {
  const { user } = useAuth(); const state = useNotificationFilters(); const query = useNotifications(state.filters);
  useEffect(() => { document.title = "Notifications · Employee Leave Management"; }, []);
  return <section className="max-w-4xl space-y-5"><h1 className="text-3xl font-semibold">Notifications</h1>
    <nav aria-label="Notification filters" className="flex gap-2">{["All", "Unread"].map(label => <button key={label} aria-current={state.unread === (label === "Unread") ? "page" : undefined} onClick={() => state.update("is_read", label === "Unread" ? "false" : "")} className={`rounded border px-4 py-2 ${state.unread === (label === "Unread") ? "bg-blue-700 text-white" : "bg-white"}`}>{label}</button>)}</nav>
    {!state.filters ? <p role="alert">Invalid notification filters. <button onClick={state.clear} className="underline">Clear filters</button></p> : query.isPending ? <QueryLoading/>
      : query.isError ? <QueryError error={query.error} retry={() => void query.refetch()}/> : <>
        {query.isFetching && <p role="status">Refreshing notifications…</p>}
        {query.data.items.length ? <NotificationList items={query.data.items} timezone={user?.organization_timezone ?? "UTC"}/>
          : <p className="rounded border bg-white p-6">{query.data.total ? "No notifications on this page." : "You're all caught up."}</p>}
        <ListPagination page={state.page} pageSize={state.pageSize} total={query.data.total} update={state.update} label="Notifications"/>
      </>}
  </section>;
}
