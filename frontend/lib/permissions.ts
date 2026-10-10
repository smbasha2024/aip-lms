import type { Role } from "@/types/auth";
export function canDecideLeave(user: { employee_id: string; role: Role } | null, ownerId: string, managerId: string, status: string): boolean {
  return !!user && status === "PENDING" && user.employee_id !== ownerId && (user.role === "ADMINISTRATOR" || user.role === "MANAGER" && user.employee_id === managerId);
}
export function canAccess(path: string, role: Role): boolean {
  if (path === "/admin" || path.startsWith("/admin/")) return role === "ADMINISTRATOR";
  if (path === "/approvals" || path.startsWith("/approvals/") || path === "/team" || path.startsWith("/team/")) {
    return role === "MANAGER" || role === "ADMINISTRATOR";
  }
  return true;
}
export function safeReturnTo(value: string | null, role: Role): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes(String.fromCharCode(92)) ||
      Array.from(value).some(char => char.charCodeAt(0) < 32)) return "/dashboard";
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith("//") || decoded.includes(String.fromCharCode(92))) return "/dashboard";
    const url = new URL(value, "https://local.invalid");
    // Only implemented, protected screens can be a login destination in this slice.
    if (url.origin !== "https://local.invalid" || !["/dashboard", "/profile", "/leave/balance", "/holidays", "/leave/apply", "/leave/history", "/approvals", "/team", "/team/calendar", "/notifications", "/admin/employees", "/admin/employees/new", "/admin/leave-types", "/admin/leave-balances", "/admin/holidays"].includes(url.pathname) && !/^\/leave\/applications\/[0-9a-f-]{36}$/i.test(url.pathname)
        && !/^\/admin\/employees\/[0-9a-f-]{36}(?:\/edit)?$/i.test(url.pathname)
        && !/^\/team\/[0-9a-f-]{36}$/i.test(url.pathname)
        || !canAccess(url.pathname, role)) return "/dashboard";
    return url.pathname + url.search + url.hash;
  } catch { return "/dashboard"; }
}
export const navigation = [
  { label: "Dashboard", href: "/dashboard", ready: true },
  { label: "Notifications", href: "/notifications", ready: true },
  { label: "My Profile", href: "/profile", ready: true },
  { label: "Apply Leave", href: "/leave/apply", ready: true },
  { label: "Leave Balance", href: "/leave/balance", ready: true },
  { label: "My Leave Applications", href: "/leave/history", ready: true },
  { label: "Holidays", href: "/holidays", ready: true },
  { label: "Pending Approvals", href: "/approvals", ready: true },
  { label: "My Team", href: "/team", ready: true },
  { label: "Team Calendar", href: "/team/calendar", ready: true },
  { label: "Reports", href: "/reports" },
  { label: "Employees", href: "/admin/employees", ready: true },
  { label: "Leave Types", href: "/admin/leave-types", ready: true },
  { label: "Leave Balances", href: "/admin/leave-balances", ready: true },
  { label: "All Applications", href: "/admin/leave-applications" },
  { label: "Holiday Management", href: "/admin/holidays", ready: true },
];
