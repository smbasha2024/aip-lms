"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import { employeeService } from "@/services/employee-service";
import { calendarService } from "@/services/calendar-service";
import { leaveService } from "@/services/leave-service";
import type { Application, HistoryFilters } from "@/types/leave";
import type { CalculateDaysRequest } from "@/types/calendar";
export function useLeaveTypes() {
  const { user } = useAuth();
  return useQuery({ queryKey: ["leave-types", user?.user_id], queryFn: ({ signal }) => employeeService.leaveTypes(signal), enabled: !!user });
}
export function useLeavePreview(body: CalculateDaysRequest | null) {
  const { user } = useAuth();
  return useQuery({ queryKey: ["leave-preview", user?.user_id, body], enabled: !!body && !!user, retry: false,
    queryFn: async ({ signal }) => {
      await new Promise<void>((resolve, reject) => {
        const abort = () => { clearTimeout(timer); reject(new DOMException("Cancelled", "AbortError")); };
        const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, 400);
        signal.addEventListener("abort", abort, { once: true });
        if (signal.aborted) abort();
      });
      return calendarService.calculate(body!, signal);
    } });
}
export function useApplyLeave() {
  const client = useQueryClient(); const { user } = useAuth();
  return useMutation({ mutationFn: leaveService.apply, retry: false,
    onSuccess: async application => {
      client.setQueryData(["application", user?.employee_id, user?.role, application.application_id], application);
      await Promise.all(["balances", "dashboard", "applications", "notifications"].map(key => client.invalidateQueries({ queryKey: [key] })));
    } });
}
export function useApplication(id: string) {
  const { user } = useAuth();
  return useQuery({ queryKey: ["application", user?.employee_id, user?.role, id], queryFn: ({ signal }) => leaveService.detail(id, signal), enabled: !!user });
}

export function useLeaveHistory(filters: HistoryFilters | null) {
  const { user } = useAuth();
  return useQuery({ queryKey: ["applications", "employee", user?.employee_id, user?.role, filters],
    queryFn: ({ signal }) => leaveService.history(user!.employee_id, filters!, signal), enabled: !!user && !!filters });
}
export function useCancelLeave() {
  const client = useQueryClient(); const { user } = useAuth();
  return useMutation({ mutationFn: leaveService.cancel, retry: false,
    onSuccess: application => client.setQueryData(["application", user?.employee_id, user?.role, application.application_id], application),
    onSettled: async () => { await Promise.all(["application", "applications", "balances", "dashboard", "approvals", "notifications"].map(key => client.invalidateQueries({ queryKey: [key] }))); } });
}

export function useDecideLeave(action: "approve" | "reject") {
  const client = useQueryClient(); const { user } = useAuth();
  return useMutation({ retry: false,
    mutationFn: ({ id, text }: { id: string; text: string }) => action === "approve" ? leaveService.approve({ id, ...(text ? { comment: text } : {}) }) : leaveService.reject({ id, reason: text }),
    onSuccess: application => client.setQueryData(["application", user?.employee_id, user?.role, application.application_id], application),
    onSettled: async () => { await Promise.all(["application", "applications", "balances", "dashboard", "approvals", "notifications"].map(key => client.invalidateQueries({ queryKey: [key] }))); } });
}

export function useApprovalBalance(application: Application | undefined, enabled: boolean) {
  const { user } = useAuth();
  return useQuery({ queryKey: ["balances", "approval", user?.user_id, user?.role, application?.application_id],
    queryFn: ({ signal }) => employeeService.approvalBalance(application!.employee.employee_id, Number(application!.from_date.slice(0,4)), application!.application_id, signal), enabled: !!user && !!application && enabled });
}
