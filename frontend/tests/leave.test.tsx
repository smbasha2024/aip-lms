import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { describe, it, expect, vi } from "vitest";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { AuthGate } from "@/features/auth/AuthGate";
import { ApplyLeaveScreen } from "@/features/leave/ApplyLeaveScreen";
import { ApplicationDetailScreen } from "@/features/leave/ApplicationDetailScreen";
import { calendarService } from "@/services/calendar-service";
import { SESSION_KEY } from "@/hooks/use-auth-session";
import type { Identity } from "@/types/auth";
import type { Application } from "@/types/leave";
import { server } from "./mocks/server";
import { navigationMock } from "./navigation-mock";
const origin="http://localhost:18000/api/v1";
const user: Identity={user_id:"u1",employee_id:"e1",employee_code:"EMP001",name:"Employee",email:"emp@example.invalid",role:"EMPLOYEE",department:{department_id:"d1",code:"ENG",name:"Engineering"},organization_timezone:"Asia/Kolkata",business_today:"2026-10-09"};
const id="11111111-1111-4111-8111-111111111111";
const application: Application={application_id:id,employee:{employee_id:"e1",employee_code:"EMP001",name:"Employee"},leave_type:{leave_type_id:"t1",code:"EARNED",name:"Earned Leave"},from_date:"2026-10-12",to_date:"2026-10-13",number_of_days:2,reason:"Personal",status:"PENDING",manager:{employee_id:"m1",employee_code:"MGR001",name:"Manager"},approved_by:null,rejected_by:null,cancelled_by:null,approved_at:null,rejected_at:null,cancelled_at:null,approval_comment:null,rejection_reason:null,cancellation_reason:null,created_at:"2026-10-09T00:00:00Z",updated_at:null};
function mount(detail=false, available: number|null=10) {
  navigationMock.pathname=detail ? `/leave/applications/${id}` : "/leave/apply";
  sessionStorage.setItem(SESSION_KEY,JSON.stringify({token:"test-token",expires_at:Date.now()+60_000}));
  server.use(http.get(`${origin}/auth/me`,()=>HttpResponse.json(user)),
    http.get(`${origin}/leave-types`,()=>HttpResponse.json({items:[{leave_type_id:"t1",code:"EARNED",name:"Earned Leave",status:"ACTIVE",allow_employee_application:true}]})),
    http.get(`${origin}/employees/e1/leave-balance`,({request})=>{expect(new URL(request.url).searchParams.get("year")).toBe("2026");return HttpResponse.json({employee_id:"e1",employee_code:"EMP001",year:2026,balances:available===null ? [] : [{balance_id:"b1",leave_type_id:"t1",leave_type:"EARNED",leave_type_name:"Earned Leave",allocated:available,carried_forward:0,used:0,pending:0,available}]});}));
  const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
  return {client,...render(<QueryClientProvider client={client}><AuthProvider><AuthGate>{detail ? <ApplicationDetailScreen id={id}/> : <ApplyLeaveScreen/>}</AuthGate></AuthProvider></QueryClientProvider>)};
}
function preview(days=2) {server.use(http.post(`${origin}/leave/calculate-days`,async({request})=>{const body=await request.json() as Record<string,string>;expect(Object.keys(body).sort()).toEqual(["employee_id","from_date","leave_type_id","to_date"]);return HttpResponse.json({from_date:body.from_date,to_date:body.to_date,calendar_days:2,weekend_days:0,holiday_days:2-days,leave_days:days});}));}
async function fill(reason="Personal") {
  await userEvent.selectOptions(await screen.findByLabelText("Leave Type *"),"t1");
  await userEvent.type(screen.getByLabelText("From Date *"),"2026-10-12");await userEvent.type(screen.getByLabelText("To Date *"),"2026-10-13");
  if(reason) await userEvent.type(screen.getByLabelText("Reason *"),reason);
}
const submit=()=>screen.getByRole("button",{name:"Submit application"});
describe("Phase 6 Apply Leave",()=>{
  it("previews exact fields, trims reason, prevents duplicate clicks, invalidates and navigates",async()=>{
    preview();let release!:()=>void;const pending=new Promise<void>(resolve=>{release=resolve;});let calls=0;
    server.use(http.post(`${origin}/leave/applications`,async({request})=>{calls++;expect(await request.json()).toEqual({employee_id:"e1",leave_type_id:"t1",from_date:"2026-10-12",to_date:"2026-10-13",reason:"Personal"});await pending;return HttpResponse.json(application,{status:201});}));
    const {client}=mount();const invalidate=vi.spyOn(client,"invalidateQueries");await fill(" Personal ");await waitFor(()=>expect(submit()).toBeEnabled());
    expect(screen.getByText("Available balance: 10")).toBeVisible();expect(screen.getByText("Estimated remaining balance: 8")).toBeVisible();
    await userEvent.dblClick(submit());expect(screen.getByRole("button",{name:"Submitting…"})).toBeDisabled();expect(calls).toBe(1);release();
    await waitFor(()=>expect(navigationMock.replace).toHaveBeenCalledWith(`/leave/applications/${id}`));expect(invalidate).toHaveBeenCalledWith({queryKey:["balances"]});
  });
  it.each([[0,10,"no working days"],[2,1,"Insufficient available leave balance."]])("blocks %s days with %s available",async(days,available,message)=>{preview(Number(days));mount(false,Number(available));await fill();expect(await screen.findByText(new RegExp(String(message)))).toBeVisible();expect(submit()).toBeDisabled();});
  it("shows allocation guidance",async()=>{preview();mount(false,null);await fill();expect(await screen.findByText(/No balance is allocated/)).toBeVisible();expect(submit()).toBeDisabled();});
  it("blocks blank reason, past, reversed and cross-year dates",async()=>{
    preview();mount();await fill(" ");await screen.findByText("Requested days");expect(submit()).toBeDisabled();
    for(const [field,value] of [["From Date *","2026-10-01"],["From Date *","2026-10-14"],["To Date *","2027-01-01"]]) {await userEvent.clear(screen.getByLabelText(field));await userEvent.type(screen.getByLabelText(field),value);expect(screen.getByRole("alert")).toHaveTextContent("one calendar year");expect(submit()).toBeDisabled();}
  });
  it("cancels stale in-flight calculation",async()=>{
    const calculate=vi.spyOn(calendarService,"calculate");let started!:()=>void;const sent=new Promise<void>(resolve=>{started=resolve;});let release!:()=>void;const pending=new Promise<void>(resolve=>{release=resolve;});
    server.use(http.post(`${origin}/leave/calculate-days`,async({request})=>{const body=await request.json() as Record<string,string>;if(body.to_date==="2026-10-13"){started();await pending;}return HttpResponse.json({from_date:body.from_date,to_date:body.to_date,calendar_days:3,weekend_days:0,holiday_days:0,leave_days:body.to_date==="2026-10-13" ? 2 : 3});}));
    mount();await fill();await sent;await userEvent.clear(screen.getByLabelText("To Date *"));await userEvent.type(screen.getByLabelText("To Date *"),"2026-10-14");await waitFor(()=>expect(screen.getByText("Estimated remaining balance: 7")).toBeVisible());expect(calculate.mock.calls[0][1]?.aborted).toBe(true);release();calculate.mockRestore();
  });
  it("shows preview error/retry",async()=>{server.use(http.post(`${origin}/leave/calculate-days`,()=>HttpResponse.json({error:{code:"LEAVE_TYPE_INACTIVE",message:"private SQL"}},{status:400})));mount();await fill();expect(await screen.findByRole("alert")).toHaveTextContent("inactive");expect(submit()).toBeDisabled();preview();await userEvent.click(screen.getByRole("button",{name:"Retry"}));await waitFor(()=>expect(submit()).toBeEnabled());});
  it.each(["INSUFFICIENT_LEAVE_BALANCE","MANAGER_NOT_FOUND","OVERLAPPING_LEAVE_APPLICATION","VALIDATION_ERROR"])("preserves inputs after %s",async code=>{
    preview();server.use(http.post(`${origin}/leave/applications`,()=>HttpResponse.json({error:{code,message:"private SQL",details:code==="OVERLAPPING_LEAVE_APPLICATION" ? {application_id:id} : [{field:"body.reason",message:"unsafe"}]}},{status:code==="OVERLAPPING_LEAVE_APPLICATION" ? 409 : code==="VALIDATION_ERROR" ? 422 : 400})));
    mount();await fill();await waitFor(()=>expect(submit()).toBeEnabled());await userEvent.click(submit());await screen.findByRole("alert");expect(screen.getByLabelText("Reason *")).toHaveValue("Personal");expect(screen.getByRole("alert")).not.toHaveTextContent("private SQL");if(code==="OVERLAPPING_LEAVE_APPLICATION") expect(screen.getByRole("link",{name:"View existing application"})).toHaveAttribute("href",`/leave/applications/${id}`);
  });
  it("does not replay an ambiguous failed submission",async()=>{preview();let calls=0;server.use(http.post(`${origin}/leave/applications`,()=>{calls++;return HttpResponse.error();}));mount();await fill();await waitFor(()=>expect(submit()).toBeEnabled());await userEvent.click(submit());expect(await screen.findByText(/Submission may have succeeded/)).toBeVisible();expect(submit()).toBeDisabled();expect(calls).toBe(1);});
  it("confirms dirty cancellation",async()=>{preview();mount();await fill();const confirm=vi.spyOn(window,"confirm").mockReturnValue(false);await userEvent.click(screen.getByRole("button",{name:"Cancel"}));expect(navigationMock.replace).not.toHaveBeenCalled();expect(confirm).toHaveBeenCalled();confirm.mockReturnValue(true);await userEvent.click(screen.getByRole("button",{name:"Cancel"}));expect(navigationMock.replace).toHaveBeenCalledWith("/dashboard");confirm.mockRestore();});
  it("protects dirty anchor and history navigation",async()=>{
    window.history.replaceState({},"","/leave/apply");preview();mount();
    await userEvent.type(await screen.findByLabelText("Reason *"),"Unsaved");
    const confirm=vi.spyOn(window,"confirm").mockReturnValue(false);
    const anchor=document.createElement("a");anchor.href="/dashboard";anchor.textContent="Leave form";document.body.append(anchor);
    try {
      await userEvent.click(anchor);expect(confirm).toHaveBeenCalled();
      window.history.replaceState({},"","/dashboard");window.dispatchEvent(new PopStateEvent("popstate",{state:{}}));
      expect(window.location.pathname).toBe("/leave/apply");expect(screen.getByLabelText("Reason *")).toHaveValue("Unsaved");
    } finally { anchor.remove();confirm.mockRestore(); }
  });

  it("cancels supported native history traversal before the router",async()=>{
    const navigation=new EventTarget();Object.defineProperty(window,"navigation",{configurable:true,value:navigation});
    const confirm=vi.spyOn(window,"confirm").mockReturnValue(false);
    try {
      preview();mount();await userEvent.type(await screen.findByLabelText("Reason *"),"Unsaved");
      const event=new Event("navigate",{cancelable:true});Object.defineProperty(event,"navigationType",{value:"traverse"});
      expect(navigation.dispatchEvent(event)).toBe(false);expect(event.defaultPrevented).toBe(true);
      expect(screen.getByLabelText("Reason *")).toHaveValue("Unsaved");
    } finally { confirm.mockRestore();Reflect.deleteProperty(window,"navigation"); }
  });

});
describe("Application details",()=>{
  it("renders authoritative plain detail, notice and timeline without future actions",async()=>{server.use(http.get(`${origin}/leave/applications/${id}`,()=>HttpResponse.json({...application,reason:"<script>unsafe</script>\nPersonal"})));sessionStorage.setItem("aip-lms-leave-notice",id);mount(true);expect(await screen.findByText("PENDING")).toBeVisible();expect(screen.getByText(/<script>unsafe/)).toBeVisible();expect(screen.getByRole("region",{name:"Leave timeline"})).toHaveTextContent("Submitted");expect(screen.getByText("09-Oct-2026, 5:30 AM (Asia/Kolkata)")).toBeVisible();expect(screen.queryByRole("button",{name:"Approve"})).not.toBeInTheDocument();expect(screen.getByRole("status")).toHaveTextContent("Leave application submitted");});
  it.each([403,404])("handles %s detail safely",async status=>{server.use(http.get(`${origin}/leave/applications/${id}`,()=>HttpResponse.json({error:{code:status===403 ? "FORBIDDEN" : "LEAVE_APPLICATION_NOT_FOUND"}},{status})));mount(true);expect(await screen.findByText(status===403 ? "Access restricted" : "Application could not be found.")).toBeVisible();});
});
