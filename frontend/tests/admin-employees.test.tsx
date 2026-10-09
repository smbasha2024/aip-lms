import { render, screen, within, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { afterEach, beforeAll, describe, it, expect, vi } from "vitest";
import type { ReactNode } from "react";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { AuthGate } from "@/features/auth/AuthGate";
import { EmployeesScreen } from "@/features/employees/EmployeesScreen";
import { EmployeeFormScreen } from "@/features/employees/EmployeeFormScreen";
import { EmployeeDetailScreen } from "@/features/employees/EmployeeDetailScreen";
import { EmployeeStatusAction } from "@/features/employees/EmployeeStatusAction";
import { AsyncEmployeeSelect } from "@/components/forms/AsyncEmployeeSelect";
import { DepartmentFilter } from "@/components/forms/DepartmentFilter";
import { ApprovalsScreen } from "@/features/approvals/ApprovalsScreen";
import { SESSION_KEY } from "@/hooks/use-auth-session";
import { safeReturnTo } from "@/lib/permissions";
import type { Identity } from "@/types/auth";
import type { Employee } from "@/types/employee";
import type { EmployeeCreate, EmployeeUpdate } from "@/types/admin-employee";
import { employeeUpdate } from "@/types/admin-employee";
import { server } from "./mocks/server";
import { navigationMock } from "./navigation-mock";
const base = "http://localhost:18000/api/v1", id = "11111111-1111-4111-8111-111111111111", mgr = "22222222-2222-4222-8222-222222222222", adm = "33333333-3333-4333-8333-333333333333";
const department = { department_id: "44444444-4444-4444-8444-444444444444", code: "ENG", name: "Engineering" };
const identity: Identity = { user_id: "admin-user", employee_id: adm, employee_code: "ADM001", name: "Administrator", email: "admin@example.invalid", role: "ADMINISTRATOR", department, organization_timezone: "Asia/Kolkata", business_today: "2026-10-09" };
const employee: Employee = { employee_id: id, employee_code: "EMP001", name: "Current Employee", email: "emp001@example.invalid", phone: null, designation: null, joining_date: "2026-01-01", status: "ACTIVE", department, manager: { employee_id: mgr, employee_code: "MGR001", name: "Manager" }, account: { user_id: "employee-user", role: "EMPLOYEE", status: "ACTIVE" } };
const manager: Employee = { ...employee, employee_id: mgr, employee_code: "MGR001", name: "Manager", manager: null, account: { user_id: "manager-user", role: "MANAGER", status: "ACTIVE" } };
const adminRow: Employee = { ...employee, employee_id: adm, employee_code: "ADM001", name: "Administrator", manager: null, account: { user_id: identity.user_id, role: "ADMINISTRATOR", status: "ACTIVE" } };
function page(items: Employee[], total = items.length) { return { items, total, page: 1, page_size: 20 }; }
function fail(status: number, code: string) { return HttpResponse.json({ error: { code, message: "private SQL password", details: null } }, { status }); }
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function(this: HTMLDialogElement) { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function(this: HTMLDialogElement) { this.removeAttribute("open"); } });
});
afterEach(() => vi.restoreAllMocks());
function defaults(selected = employee) {
  server.use(http.get(`${base}/departments`, () => HttpResponse.json({ items: [department] })),
    http.get(`${base}/employees`, ({ request }) => { const q = new URL(request.url).searchParams; return HttpResponse.json(page([selected, manager, adminRow].filter(row => !q.get("role") || row.account?.role === q.get("role")))); }),
    http.get(`${base}/employees/${id}`, () => HttpResponse.json(selected)), http.get(`${base}/employees/${adm}`, () => HttpResponse.json(adminRow)),
    http.get(`${base}/employees/${id}/leave-balance`, () => HttpResponse.json({ employee_id: id, employee_code: "EMP001", year: 2026, balances: [] })),
    http.get(`${base}/employees/${id}/leave-applications`, () => HttpResponse.json(page([]))),
    http.get(`${base}/leave-types`, () => HttpResponse.json({ items: [] })), http.get(`${base}/leave/approvals/pending`, () => HttpResponse.json(page([]))));
}
function mount(children: ReactNode, path = "/admin/employees", user = identity) {
  window.history.replaceState({}, "", path); navigationMock.pathname = path.split("?")[0];
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token: "test-token", expires_at: Date.now() + 60_000 }));
  server.use(http.get(`${base}/auth/me`, () => HttpResponse.json(user)));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><AuthProvider><AuthGate>{children}</AuthGate></AuthProvider></QueryClientProvider>);
}
async function fill(role = "EMPLOYEE") {
  await screen.findByLabelText("Employee ID *");
  for (const [label,value] of [["Employee ID *","new011"],["Name *"," New Person "],["Email *"," NEW011@EXAMPLE.INVALID "],["Joining Date *","2026-10-01"],["Initial Password *","  exact-password-123  "]]) fireEvent.change(screen.getByLabelText(label), { target: { value } });
  await userEvent.selectOptions(screen.getByLabelText("Department *"), department.department_id);
  await userEvent.selectOptions(screen.getByLabelText("Role *"), role);
  if (role === "EMPLOYEE") { await userEvent.click(screen.getByRole("combobox", { name: "Reporting Manager" })); await userEvent.click(await screen.findByRole("option", { name: "Manager (MGR001)" })); }
}
async function save() { await userEvent.click(screen.getByRole("button", { name: "Save Employee" })); }

describe("Phase 11 employee administration", () => {
  it("preserves edit department selection when lookup options arrive after prefill", async () => {
    defaults(); let release!: () => void; const waiting = new Promise<void>(resolve => { release = resolve; });
    server.use(http.get(`${base}/departments`, async () => { await waiting; return HttpResponse.json({ items: [department] }); }));
    mount(<EmployeeFormScreen id={id}/>, `/admin/employees/${id}/edit`);
    await screen.findByLabelText("Employee ID *"); release();
    await screen.findByRole("option", { name: department.name });
    expect(screen.getByLabelText("Department *")).toHaveValue(department.department_id);
  });

  it.each(["EMPLOYEE","MANAGER"] as const)("denies %s without protected rows", async role => { defaults(); mount(<EmployeesScreen/>, "/admin/employees", { ...identity, role }); expect(await screen.findByText("You don't have permission to view this page.")).toBeVisible(); expect(screen.queryByRole("table")).not.toBeInTheDocument(); });
  it("renders nested references, nullable designation and all action links", async () => {
    defaults(); mount(<EmployeesScreen/>); const table = await screen.findByRole("table", { name: "Organization employees" }); const row = within(table).getByText("EMP001").closest("tr")!;
    expect(within(row).getByText(employee.email)).toBeVisible(); expect(within(row).getByText(department.name)).toBeVisible(); expect(within(row).getByText("—")).toBeVisible(); await userEvent.click(within(row).getByText("Actions for EMP001"));
    for (const [label,suffix] of [["View Profile",""],["Edit","/edit"],["View Leave Balance","?tab=balance"],["View Leave History","?tab=history"]]) expect(within(row).getByRole("link", { name: label })).toHaveAttribute("href", `/admin/employees/${id}${suffix}`);
    const card = screen.getByRole("article", { name: "Current Employee (EMP001)" });
    expect(within(card).getByText(employee.email)).toBeVisible();
    expect(within(card).getByText("Reporting Manager")).toBeVisible();
    expect(within(card).getByText("Actions for EMP001")).toBeVisible();
    expect(screen.getByRole("link", { name: "Add Employee" })).toHaveAttribute("href", "/admin/employees/new");
  });
  it("debounces search, preserves status and merges rapid filter edits", async () => {
    defaults(); mount(<EmployeesScreen/>, "/admin/employees?page=3&status=ACTIVE"); await screen.findByRole("table"); fireEvent.change(screen.getByLabelText("Search"), { target: { value: " EMP001 " } }); expect(navigationMock.replace).not.toHaveBeenCalled();
    await waitFor(() => expect(navigationMock.replace).toHaveBeenLastCalledWith("/admin/employees?status=ACTIVE&search=EMP001", { scroll: false })); await userEvent.selectOptions(screen.getByLabelText("Department"), department.department_id); expect(navigationMock.replace).toHaveBeenLastCalledWith(`/admin/employees?status=ACTIVE&search=EMP001&department_id=${department.department_id}`, { scroll: false });
  });
  it("restores filters and sends server pagination", async () => { defaults(); let query = ""; server.use(http.get(`${base}/employees`, ({ request }) => { query = new URL(request.url).search; return HttpResponse.json(page([employee],25)); })); mount(<EmployeesScreen/>, "/admin/employees?search=EMP001&status=INACTIVE&page=2&page_size=10"); await screen.findByRole("table"); expect(query).toContain("page=2"); expect(screen.getByLabelText("Search")).toHaveValue("EMP001"); expect(screen.getByLabelText("Status")).toHaveValue("INACTIVE"); await userEvent.click(screen.getByRole("button", { name: "Next" })); expect(navigationMock.replace).toHaveBeenLastCalledWith("/admin/employees?search=EMP001&status=INACTIVE&page=3&page_size=10", { scroll: false }); });
  it.each(["page=0","status=BAD","manager_id=bad","unexpected=1"])("blocks invalid %s", async query => { defaults(); let read = false; server.use(http.get(`${base}/employees`, () => { read = true; return HttpResponse.json(page([])); })); mount(<EmployeesScreen/>, `/admin/employees?${query}`); expect(await screen.findByRole("alert")).toHaveTextContent("Invalid employee filters"); expect(read).toBe(false); });
  it("recovers a safe list error to empty state", async () => { defaults(); server.use(http.get(`${base}/employees`, () => fail(500,"SERVER_ERROR"))); mount(<EmployeesScreen/>); expect(await screen.findByRole("alert")).not.toHaveTextContent("private"); server.use(http.get(`${base}/employees`, () => HttpResponse.json(page([])))); await userEvent.click(screen.getByRole("button", { name: "Retry" })); expect(await screen.findByText("No employees match these filters.")).toBeVisible(); });
  it("filters inactive accounts/self from the active manager/admin picker", async () => {
    defaults(); const queries: string[] = []; server.use(http.get(`${base}/employees`, ({ request }) => { const q = new URL(request.url).searchParams; queries.push(q.toString()); return HttpResponse.json(page(q.get("role") === "MANAGER" ? [{ ...employee, account: { ...employee.account!, role: "MANAGER" } }, { ...manager, account: { ...manager.account!, status: "LOCKED" } }] : [adminRow])); }));
    mount(<AsyncEmployeeSelect managers label="Reporting Manager" value="" excludeId={id} onChange={() => {}}/>); await userEvent.click(await screen.findByRole("combobox")); expect(await screen.findByRole("option", { name: "Administrator (ADM001)" })).toBeVisible(); expect(screen.queryByRole("option", { name: "Manager (MGR001)" })).not.toBeInTheDocument(); expect(screen.queryByRole("option", { name: "Current Employee (EMP001)" })).not.toBeInTheDocument(); expect(queries.some(q => q.includes("role=MANAGER") && q.includes("status=ACTIVE"))).toBe(true);
  });
  it("administrator approvals search organization employees with keyboard", async () => { defaults(); let search = ""; server.use(http.get(`${base}/employees`, ({ request }) => { search = new URL(request.url).searchParams.get("search") ?? ""; return HttpResponse.json(page([employee])); })); mount(<ApprovalsScreen/>, "/approvals"); await userEvent.type(await screen.findByRole("combobox", { name: "Employee" }), "Current"); await waitFor(() => expect(search).toBe("Current")); await screen.findByRole("option", { name: "Current Employee (EMP001)" }); await userEvent.keyboard("{ArrowDown}{Enter}"); expect(navigationMock.replace).toHaveBeenLastCalledWith(`/approvals?employee_id=${id}`, { scroll: false }); });
  it("uses administrator department scope and retries lookup failures", async () => { defaults(); let status = ""; server.use(http.get(`${base}/departments`, ({ request }) => { status = new URL(request.url).searchParams.get("status") ?? ""; return fail(500,"SERVER_ERROR"); })); mount(<DepartmentFilter value="" onChange={() => {}}/>); expect(await screen.findByRole("alert")).not.toHaveTextContent("private"); expect(status).toBe("ALL"); server.use(http.get(`${base}/departments`, () => HttpResponse.json({ items: [department] }))); await userEvent.click(screen.getByRole("button", { name: "Retry" })); expect(await screen.findByRole("option", { name: department.name })).toBeVisible(); });
  it("creates normalized fields with exact password and clears password after success", async () => { defaults(); let body: EmployeeCreate | null = null; server.use(http.post(`${base}/admin/employees`, async ({ request }) => { body = await request.json() as EmployeeCreate; return HttpResponse.json(employee,{status:201}); })); mount(<EmployeeFormScreen/>, "/admin/employees/new"); await fill(); await save(); await waitFor(() => expect(navigationMock.push).toHaveBeenCalledWith("/admin/employees?notice=saved")); expect(body).toMatchObject({ employee_code: "NEW011", name: "New Person", email: "new011@example.invalid", manager_id: mgr, phone: null, initial_password: "  exact-password-123  " }); expect(screen.getByLabelText("Initial Password *")).toHaveValue(""); });
  it("allows top-level manager without reporting manager", async () => { defaults(); let body: EmployeeCreate | null = null; server.use(http.post(`${base}/admin/employees`, async ({ request }) => { body = await request.json() as EmployeeCreate; return HttpResponse.json(manager,{status:201}); })); mount(<EmployeeFormScreen/>, "/admin/employees/new"); await fill("MANAGER"); await save(); await waitFor(() => expect(navigationMock.push).toHaveBeenCalled()); expect(body).toMatchObject({ role: "MANAGER", manager_id: null }); });
  it.each([["Name *","","Name is required."],["Email *","bad","Enter a valid email."],["Initial Password *","short","Use 12–128 characters."]])("rejects invalid %s before posting", async (label,value,message) => { defaults(); let posts = 0; server.use(http.post(`${base}/admin/employees`, () => { posts++; return HttpResponse.json(employee); })); mount(<EmployeeFormScreen/>, "/admin/employees/new"); await fill(); fireEvent.change(screen.getByLabelText(label),{target:{value}}); await save(); expect(await screen.findByText(message)).toBeVisible(); expect(posts).toBe(0); });
  it.each([["EMPLOYEE_CODE_EXISTS","Employee ID *"],["EMPLOYEE_EMAIL_EXISTS","Email *"],["DEPARTMENT_INACTIVE","Department *"]])("maps %s to field", async (code,label) => { defaults(); server.use(http.post(`${base}/admin/employees`, () => fail(409,code))); mount(<EmployeeFormScreen/>, "/admin/employees/new"); await fill(); await save(); await waitFor(() => expect(screen.getByLabelText("Initial Password *")).toHaveValue("")); expect(screen.getByLabelText(label)).toHaveAttribute("aria-invalid","true"); });
  it("requires reporting manager for EMPLOYEE", async () => { defaults(); mount(<EmployeeFormScreen/>, "/admin/employees/new"); await fill(); await userEvent.click(screen.getByRole("button", { name: "Clear employee" })); await save(); expect(await screen.findByText("Choose a reporting manager.")).toBeVisible(); });
  it("confirms dirty cancellation and preserves unsaved form on decline", async () => { defaults(); const confirm = vi.spyOn(window,"confirm").mockReturnValue(false); mount(<EmployeeFormScreen/>, "/admin/employees/new"); await fill(); await userEvent.click(screen.getByRole("button",{name:"Cancel"})); expect(navigationMock.push).not.toHaveBeenCalled(); expect(screen.getByLabelText("Name *")).toHaveValue(" New Person "); confirm.mockReturnValue(true); await userEvent.click(screen.getByRole("button",{name:"Cancel"})); expect(navigationMock.push).toHaveBeenCalledWith("/admin/employees"); });
  it("prefills edit, immutable code, no role/password and full PUT body", async () => { defaults(); let body: EmployeeUpdate | null = null; server.use(http.put(`${base}/admin/employees/${id}`, async ({ request }) => { body = await request.json() as EmployeeUpdate; return HttpResponse.json(employee); })); mount(<EmployeeFormScreen id={id}/>, `/admin/employees/${id}/edit`); const code = await screen.findByLabelText("Employee ID *"); expect(code).toHaveValue("EMP001"); expect(code).toHaveAttribute("readonly"); expect(screen.queryByLabelText("Initial Password *")).not.toBeInTheDocument(); expect(screen.queryByLabelText("Role *")).not.toBeInTheDocument(); fireEvent.change(screen.getByLabelText("Name *"),{target:{value:" Renamed "}}); await save(); await waitFor(() => expect(navigationMock.push).toHaveBeenCalled()); expect(body).toEqual({...employeeUpdate(employee),name:"Renamed"}); });
  it("prevents duplicate create and retry after ambiguous failure", async () => { defaults(); let posts = 0; let release!: () => void; const waiting = new Promise<void>(resolve => { release = resolve; }); server.use(http.post(`${base}/admin/employees`, async () => { posts++; await waiting; return fail(500,"SERVER_ERROR"); })); mount(<EmployeeFormScreen/>, "/admin/employees/new"); await fill(); const button = screen.getByRole("button",{name:"Save Employee"}); await userEvent.dblClick(button); await waitFor(() => expect(posts).toBe(1)); expect(button).toBeDisabled(); release(); expect(await screen.findByRole("alert")).toHaveTextContent("outcome is uncertain"); expect(screen.getByRole("button",{name:"Save Employee"})).toBeDisabled(); });
  it("status confirmation reloads fresh fields and performs full replacement", async () => { defaults(); const fresh = {...employee,name:"Latest Name",phone:"fresh"}; let body: EmployeeUpdate | null = null; server.use(http.get(`${base}/employees/${id}`,()=>HttpResponse.json(fresh)),http.put(`${base}/admin/employees/${id}`,async({request})=>{body=await request.json() as EmployeeUpdate;return HttpResponse.json({...fresh,status:"INACTIVE"});})); mount(<EmployeeStatusAction employee={employee}/>); await userEvent.click(await screen.findByRole("button",{name:"Deactivate"})); await userEvent.click(within(screen.getByRole("dialog")).getByRole("button",{name:"Deactivate"})); await waitFor(()=>expect(screen.queryByRole("dialog")).not.toBeInTheDocument()); expect(body).toEqual({...employeeUpdate(fresh),status:"INACTIVE"}); });
  it("rejects stale status without overwriting",async()=>{defaults();let writes=0;server.use(http.get(`${base}/employees/${id}`,()=>HttpResponse.json({...employee,status:"INACTIVE"})),http.put(`${base}/admin/employees/${id}`,()=>{writes++;return HttpResponse.json(employee);}));mount(<EmployeeStatusAction employee={employee}/>);await userEvent.click(await screen.findByRole("button",{name:"Deactivate"}));await userEvent.click(within(screen.getByRole("dialog")).getByRole("button",{name:"Deactivate"}));expect(await screen.findByRole("alert")).toHaveTextContent("Employment status changed");expect(writes).toBe(0);});
  it.each(["RESIGNED","TERMINATED"] as const)("hides status toggle for %s",async status=>{defaults();mount(<EmployeeDetailScreen id={id}/>,`/admin/employees/${id}`);await screen.findByRole("heading",{name:"Current Employee (EMP001)"});const result=render(<EmployeeStatusAction employee={{...employee,status}}/>,{wrapper:({children})=><QueryClientProvider client={new QueryClient()}><AuthProvider>{children}</AuthProvider></QueryClientProvider>});expect(within(result.container).queryByRole("button")).not.toBeInTheDocument();});
  it("hides self account/toggle and restricts self status to ACTIVE",async()=>{defaults();const result=mount(<EmployeeDetailScreen id={adm}/>,`/admin/employees/${adm}`);expect(await screen.findByText("Your account role/status cannot be changed here.")).toBeVisible();expect(screen.queryByRole("button",{name:"Deactivate"})).not.toBeInTheDocument();result.unmount();mount(<EmployeeFormScreen id={adm}/>,`/admin/employees/${adm}/edit`);await screen.findByLabelText("Status *");expect(within(screen.getByLabelText("Status *")).getAllByRole("option")).toHaveLength(1);});
  it("changes separate account role/status with session notice",async()=>{defaults();vi.spyOn(window,"confirm").mockReturnValue(true);let body:unknown;server.use(http.put(`${base}/admin/employees/${id}/account`,async({request})=>{body=await request.json();return HttpResponse.json({...employee.account,role:"MANAGER"});}));mount(<EmployeeDetailScreen id={id}/>,`/admin/employees/${id}`);await userEvent.selectOptions(await screen.findByLabelText("Role"),"MANAGER");await userEvent.click(screen.getByRole("button",{name:"Save Account"}));expect(await screen.findByText("Account updated. Existing sessions have ended.")).toBeVisible();expect(body).toEqual({role:"MANAGER",status:"ACTIVE"});});
  it("reuses balance/history tab URL and back link",async()=>{defaults();mount(<EmployeeDetailScreen id={id}/>,`/admin/employees/${id}?tab=balance&year=2026`);expect(await screen.findByText("No leave balances have been allocated for 2026.")).toBeVisible();expect(screen.getByRole("link",{name:"Back to Employees"})).toHaveAttribute("href","/admin/employees");await userEvent.click(screen.getByRole("button",{name:"Leave History"}));expect(navigationMock.replace).toHaveBeenLastCalledWith(`/admin/employees/${id}?tab=history&year=2026`,{scroll:false});});
  it.each(["/admin/employees","/admin/employees/new",`/admin/employees/${id}`,`/admin/employees/${id}/edit`])("permits return route %s for admin only",path=>{expect(safeReturnTo(path,"ADMINISTRATOR")).toBe(path);for(const role of ["MANAGER","EMPLOYEE"] as const)expect(safeReturnTo(path,role)).toBe("/dashboard");});
});
