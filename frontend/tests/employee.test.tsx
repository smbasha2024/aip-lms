import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { describe, it, expect } from "vitest";
import type { ReactNode } from "react";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { AuthGate } from "@/features/auth/AuthGate";
import { EmployeeProfileCard } from "@/features/employees/EmployeeProfileCard";
import { EmployeeDashboard } from "@/features/dashboard/EmployeeDashboard";
import { LeaveBalanceScreen } from "@/features/leave/LeaveBalanceScreen";
import { SESSION_KEY } from "@/hooks/use-auth-session";
import { safeReturnTo } from "@/lib/permissions";
import { employeeService } from "@/services/employee-service";
import { setAuthTransport } from "@/lib/auth-transport";
import type { Identity } from "@/types/auth";
import type { BalanceItem, DashboardResponse, Employee } from "@/types/employee";
import { server } from "./mocks/server";
import { navigationMock } from "./navigation-mock";
const origin="http://localhost:18000/api/v1";
const user: Identity={user_id:"user-1",employee_id:"emp-1",employee_code:"EMP001",name:"Employee Example",email:"emp@example.invalid",role:"EMPLOYEE",department:{department_id:"dept-1",code:"ENG",name:"Engineering"},organization_timezone:"Asia/Kolkata",business_today:"2026-10-08"};
const profile: Employee={employee_id:user.employee_id,employee_code:user.employee_code,name:user.name,email:user.email,department:user.department,phone:null,designation:"Developer",joining_date:"2026-01-10",status:"ACTIVE",manager:{employee_id:"mgr-1",employee_code:"MGR001",name:"Manager Example"}};
const balance: BalanceItem={balance_id:"bal-1",leave_type_id:"type-1",leave_type:"CUSTOM",leave_type_name:"Research Leave",allocated:15,carried_forward:2.25,used:3,pending:2,available:7.75};
const dashboard: DashboardResponse={year:2026,employee:user,leave_totals:balance,leave_balances:[balance],pending_application_count:8,recent_applications:[],upcoming_holidays:[],unread_notification_count:3,manager_summary:null,admin_summary:null};
function mount(children: ReactNode, identity=user) {
  sessionStorage.setItem(SESSION_KEY,JSON.stringify({token:"test-token",expires_at:Date.now()+60_000}));
  server.use(http.get(`${origin}/auth/me`,()=>HttpResponse.json(identity)));
  const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
  const wrapper=({children}:{children:ReactNode})=><QueryClientProvider client={client}><AuthProvider><AuthGate>{children}</AuthGate></AuthProvider></QueryClientProvider>;
  return render(children,{wrapper});
}
function mockBalance(rows=[balance]) {
  server.use(http.get(`${origin}/employees/emp-1/leave-balance`,({request})=> {
    expect(request.headers.get("Authorization")).toBe("Bearer test-token");
    const year=Number(new URL(request.url).searchParams.get("year"));
    return HttpResponse.json({employee_id:"emp-1",employee_code:"EMP001",year,balances:rows});
  }));
}
function fail(code="SERVER_ERROR",status=500) { return HttpResponse.json({error:{code,message:"unsafe database details",details:null}},{status}); }

describe("Phase 4 employee screens",()=> {
  it("renders profile fields from API with nullable values safely",async()=> {
    navigationMock.pathname="/profile";
    server.use(http.get(`${origin}/employees/emp-1`,()=>HttpResponse.json(profile)));mount(<EmployeeProfileCard/>);
    expect(await screen.findByText("Developer")).toBeVisible();
    for(const text of ["10-Jan-2026","Manager Example (MGR001)","Active","—","To update your details, contact your administrator."]) expect(screen.getByText(text)).toBeVisible();
    expect(screen.queryByRole("button",{name:/edit/i})).not.toBeInTheDocument();
  });
  it("renders null manager and designation as em dashes",async()=> {
    server.use(http.get(`${origin}/employees/emp-1`,()=>HttpResponse.json({...profile,manager:null,designation:null})));
    mount(<EmployeeProfileCard/>);expect(await screen.findAllByText("—")).toHaveLength(3);
  });
  it("shows loading and retries safe profile errors",async()=> {
    let release!:()=>void;const pending=new Promise<void>(resolve=>{release=resolve;});
    server.use(http.get(`${origin}/employees/emp-1`,async()=>{await pending;return fail();}));mount(<EmployeeProfileCard/>);
    expect(await screen.findByText("Loading your information…")).toBeVisible();release();
    expect(await screen.findByRole("alert")).not.toHaveTextContent("unsafe");
    server.use(http.get(`${origin}/employees/emp-1`,()=>HttpResponse.json(profile)));
    await userEvent.click(screen.getByRole("button",{name:"Retry"}));expect(await screen.findByText("Developer")).toBeVisible();
  });
  it("renders permission denial without private data",async()=> {
    server.use(http.get(`${origin}/employees/emp-1`,()=>fail("FORBIDDEN",403)));mount(<EmployeeProfileCard/>);
    expect(await screen.findByText("You don't have permission to view this page.")).toBeVisible();
    expect(screen.queryByText("Developer")).not.toBeInTheDocument();
  });
  it("renders authoritative availability and carry-forward in table and cards",async()=> {
    navigationMock.pathname="/leave/balance";mockBalance();mount(<LeaveBalanceScreen/>);
    const table=await screen.findByRole("table",{name:"Leave balances"});
    for(const text of ["Research Leave","7.75","Carried Forward"]) expect(within(table).getByText(text)).toBeInTheDocument();
    expect(screen.getAllByText("Research Leave")).toHaveLength(2);expect(screen.getByLabelText("Year")).toHaveValue("2026");
  });
  it("changes year in URL and refetches without retaining previous rows",async()=> {
    navigationMock.pathname="/leave/balance";mockBalance();const result=mount(<LeaveBalanceScreen/>);await screen.findByRole("table");
    await userEvent.selectOptions(screen.getByLabelText("Year"),"2025");expect(navigationMock.replace).toHaveBeenCalledWith("/leave/balance?year=2025",{scroll:false});
    mockBalance([]);window.history.replaceState({},"","/leave/balance?year=2025");result.rerender(<LeaveBalanceScreen/>);
    expect(await screen.findByText("No leave balances have been allocated for 2025. Contact your administrator.")).toBeVisible();expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
  it("restores historical year from URL",async()=> {
    window.history.replaceState({},"","/leave/balance?year=2020");mockBalance([]);mount(<LeaveBalanceScreen/>);
    expect(await screen.findByText(/allocated for 2020/)).toBeVisible();expect(screen.getByLabelText("Year")).toHaveValue("2020");
  });
  it.each(["bad","1899","10000","", "2026&year=2025"])("rejects invalid year %s before fetching",async year=> {
    window.history.replaceState({},"",`/leave/balance?year=${year}`);mount(<LeaveBalanceScreen/>);
    expect(await screen.findByRole("alert")).toHaveTextContent("Enter a year between 1900 and 9999");
  });
  it("hides zero carry-forward and marks exhausted balances",async()=> {
    mockBalance([{...balance,carried_forward:0,available:0}]);mount(<LeaveBalanceScreen/>);const table=await screen.findByRole("table");
    expect(within(table).queryByRole("columnheader",{name:"Carried Forward"})).not.toBeInTheDocument();expect(within(table).getByText("No balance left")).toBeInTheDocument();
  });
  it("retries balance errors",async()=> {
    server.use(http.get(`${origin}/employees/emp-1/leave-balance`,()=>fail()));mount(<LeaveBalanceScreen/>);
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");mockBalance();
    await userEvent.click(screen.getByRole("button",{name:"Retry"}));expect(await screen.findByRole("table")).toBeInTheDocument();
  });
  it("uses dashboard totals, dynamic cards, counts and supported actions",async()=> {
    server.use(http.get(`${origin}/dashboard`,({request})=>{expect(new URL(request.url).searchParams.get("year")).toBe("2026");return HttpResponse.json(dashboard);}));mount(<EmployeeDashboard/>);
    expect(await screen.findByText("Research Leave")).toBeVisible();expect(screen.getByText(/Pending applications in 2026/)).toHaveTextContent("8");expect(screen.getByText(/Unread notifications:/)).toHaveTextContent("3");
    expect(screen.getByText("No leave applications yet.")).toBeVisible();expect(screen.getByText("No upcoming holidays have been published.")).toBeVisible();
    expect(screen.getByRole("link",{name:"Apply Leave"})).toHaveAttribute("href","/leave/apply");expect(screen.getByRole("link",{name:"View detailed balances"})).toHaveAttribute("href","/leave/balance?year=2026");
  });
  it("renders recent applications and optional holidays",async()=> {
    server.use(http.get(`${origin}/dashboard`,()=>HttpResponse.json({...dashboard,
      recent_applications:[{application_id:"a-1",employee_id:user.employee_id,employee_code:user.employee_code,employee_name:user.name,department:user.department,manager:profile.manager,leave_type_id:"type-1",leave_type:"CUSTOM",leave_type_name:"Research Leave",from_date:"2026-11-01",to_date:"2026-11-02",number_of_days:2,reason:"Research",status:"PENDING",created_at:"2026-10-08T00:00:00Z"}],
      upcoming_holidays:[{holiday_id:"h-1",holiday_date:"2026-11-10",name:"Research Day",description:null,year:2026,is_optional:true,status:"ACTIVE"}]})));mount(<EmployeeDashboard/>);
    expect(await screen.findByText("Research Day (Optional)")).toBeVisible();expect(screen.getByText("Research Leave · PENDING")).toBeVisible();expect(screen.getByText(/01-Nov-2026 – 02-Nov-2026/)).toBeVisible();
  });
  it.each(["MANAGER","ADMINISTRATOR"] as const)("shows unavailable summary for %s",async role=> {
    server.use(http.get(`${origin}/dashboard`,()=>HttpResponse.json({...dashboard,leave_balances:[]})),
      http.get(`${origin}/managers/me/direct-reports`,()=>HttpResponse.json({items:[],total:0,page:1,page_size:1})),
      http.get(`${origin}/leave/approvals/pending`,()=>HttpResponse.json({items:[],total:0,page:1,page_size:1})));mount(<EmployeeDashboard/>,{...user,role});
    expect(await screen.findByText(role==="MANAGER" ? "Team summary is not available yet." : "Organization summary is not available yet.")).toBeVisible();expect(screen.getByText(/No leave balances have been allocated/)).toBeVisible();
  });
  it("retries dashboard errors",async()=> {
    server.use(http.get(`${origin}/dashboard`,()=>fail()));mount(<EmployeeDashboard/>);expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
    server.use(http.get(`${origin}/dashboard`,()=>HttpResponse.json(dashboard)));await userEvent.click(screen.getByRole("button",{name:"Retry"}));expect(await screen.findByText("Research Leave")).toBeVisible();
  });
  it("allows a safe return to balance screen",()=> {expect(safeReturnTo("/leave/balance?year=2025","EMPLOYEE")).toBe("/leave/balance?year=2025");});
  it("authenticates by-code and leave-type service reads",async()=> {
    setAuthTransport("test-token",null);server.use(http.get(`${origin}/employees/by-code/EMP001`,({request})=>{expect(request.headers.get("Authorization")).toBe("Bearer test-token");return HttpResponse.json(profile);}),http.get(`${origin}/leave-types`,()=>HttpResponse.json({items:[]})));
    expect((await employeeService.byCode("EMP001")).employee_code).toBe("EMP001");expect((await employeeService.leaveTypes()).items).toEqual([]);
  });
});
