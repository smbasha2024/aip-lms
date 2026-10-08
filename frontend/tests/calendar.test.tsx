import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { describe, it, expect } from "vitest";
import type { ReactNode } from "react";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { AuthGate } from "@/features/auth/AuthGate";
import { HolidayScreen } from "@/features/holidays/HolidayScreen";
import { LeaveSummaryPanel } from "@/features/leave/LeaveSummaryPanel";
import { SESSION_KEY } from "@/hooks/use-auth-session";
import { calendarService } from "@/services/calendar-service";
import { setAuthTransport } from "@/lib/auth-transport";
import type { Identity } from "@/types/auth";
import type { Holiday } from "@/types/employee";
import { server } from "./mocks/server";
import { navigationMock } from "./navigation-mock";
const origin="http://localhost:18000/api/v1";
const user: Identity={user_id:"u1",employee_id:"e1",employee_code:"EMP001",name:"Employee",email:"emp@example.invalid",role:"EMPLOYEE",department:{department_id:"d1",code:"ENG",name:"Engineering"},organization_timezone:"Asia/Kolkata",business_today:"2026-10-08"};
const holidays: Holiday[]=[{holiday_id:"h1",holiday_date:"2026-10-02",name:"Company Day",description:"Company celebration",year:2026,is_optional:false,status:"ACTIVE"},{holiday_id:"h2",holiday_date:"2026-10-05",name:"Optional Day",description:null,year:2026,is_optional:true,status:"ACTIVE"}];
function mount(children: ReactNode) {
  navigationMock.pathname="/holidays";
  sessionStorage.setItem(SESSION_KEY,JSON.stringify({token:"test-token",expires_at:Date.now()+60_000}));
  server.use(http.get(`${origin}/auth/me`,()=>HttpResponse.json(user)));
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  const wrapper=({children}:{children:ReactNode})=><QueryClientProvider client={client}><AuthProvider><AuthGate>{children}</AuthGate></AuthProvider></QueryClientProvider>;
  return render(children,{wrapper});
}
function published(items=holidays) {
  server.use(http.get(`${origin}/holidays`,({request})=>{
    const query=new URL(request.url).searchParams;expect(query.get("status")).toBe("ACTIVE");expect(query.has("month")).toBe(false);
    expect(request.headers.get("Authorization")).toBe("Bearer test-token");
    return HttpResponse.json({year:Number(query.get("year")),month:null,items});
  }));
}
describe("Phase 5 calendar",()=>{
  it("renders mandatory/optional holidays and opens details with Enter",async()=>{
    published();mount(<HolidayScreen/>);
    const day=await screen.findByRole("button",{name:"Friday, 02 October 2026, Company Day, Mandatory"});
    day.focus();await userEvent.keyboard("{Enter}");
    const details=screen.getByRole("region",{name:"Holiday details"});expect(within(details).getByText("Company celebration")).toBeVisible();
    expect(screen.getByRole("button",{name:/Monday, 05 October 2026, Optional Day, Optional/})).toBeVisible();
    await userEvent.click(within(details).getByRole("button",{name:"Close details"}));expect(screen.queryByRole("region",{name:"Holiday details"})).not.toBeInTheDocument();
  });
  it("moves focus between dates using arrows and marks organizational today",async()=>{
    published();mount(<HolidayScreen/>);const first=await screen.findByRole("button",{name:/Friday, 02 October/});first.focus();
    await userEvent.keyboard("{ArrowRight}");expect(screen.getByRole("button",{name:"Saturday, 03 October 2026"})).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");expect(screen.getByRole("button",{name:"Saturday, 10 October 2026"})).toHaveFocus();
    expect(screen.getByRole("button",{name:"Thursday, 08 October 2026"})).toHaveAttribute("aria-current","date");
  });
  it("toggles grouped list and renders dates, types and nullable descriptions",async()=>{
    published();mount(<HolidayScreen/>);await screen.findByRole("button",{name:/Company Day, Mandatory/});
    await userEvent.click(screen.getByRole("button",{name:"List"}));
    const table=screen.getByRole("table");expect(within(table).getByText("02-Oct-2026")).toBeInTheDocument();expect(within(table).getByText("Optional")).toBeInTheDocument();expect(within(table).getByText("—")).toBeInTheDocument();
    await userEvent.click(within(table).getByRole("button",{name:"Optional Day"}));expect(screen.getByRole("region",{name:"Holiday details"})).toHaveTextContent("No description provided.");
  });
  it("filters month from the year payload and writes URL navigation",async()=>{
    published();const result=mount(<HolidayScreen/>);await screen.findByRole("button",{name:/Company Day, Mandatory/});
    await userEvent.click(screen.getByRole("button",{name:"Next month"}));expect(navigationMock.replace).toHaveBeenCalledWith("/holidays?year=2026&month=11",{scroll:false});
    window.history.replaceState({},"","/holidays?year=2026&month=11");result.rerender(<HolidayScreen/>);
    expect(screen.getByText("No holidays have been published for 2026 in the selected month.")).toBeVisible();
    expect(screen.getByRole("heading",{name:"November 2026"})).toBeVisible();
    await userEvent.click(screen.getByRole("button",{name:"Today"}));expect(navigationMock.replace).toHaveBeenCalledWith("/holidays?year=2026&month=10",{scroll:false});
    await userEvent.selectOptions(screen.getByLabelText("Year"),"2025");expect(navigationMock.replace).toHaveBeenCalledWith("/holidays?year=2025&month=11",{scroll:false});
  });
  it("handles empty year with an accessible calendar",async()=>{
    published([]);mount(<HolidayScreen/>);expect(await screen.findByText("No holidays have been published for 2026.")).toBeVisible();expect(screen.getByRole("button",{name:"Thursday, 08 October 2026"})).toBeVisible();
  });
  it.each(["year=bad","month=0","month=13","month=bad","month=10&month=11"])("validates URL %s",async query=>{
    window.history.replaceState({},"",`/holidays?${query}`);published();mount(<HolidayScreen/>);expect(await screen.findByRole("alert")).toHaveTextContent("Select a year between 1900 and 9999");
  });
  it("shows loading and retries safe errors",async()=>{
    let release!:()=>void;const pending=new Promise<void>(resolve=>{release=resolve;});
    server.use(http.get(`${origin}/holidays`,async()=>{await pending;return HttpResponse.json({error:{code:"SERVER_ERROR",message:"secret SQL",details:null}},{status:500});}));
    mount(<HolidayScreen/>);expect(await screen.findByText("Loading your information…")).toBeVisible();release();expect(await screen.findByRole("alert")).not.toHaveTextContent("secret");
    published();await userEvent.click(screen.getByRole("button",{name:"Retry"}));expect(await screen.findByRole("button",{name:/Company Day, Mandatory/})).toBeVisible();
  });
  it("uses a list by default on a narrow viewport",async()=>{
    const previous=window.matchMedia;
    window.matchMedia=()=>({matches:true,addEventListener:()=>{},removeEventListener:()=>{}} as unknown as MediaQueryList);
    try {published();mount(<HolidayScreen/>);expect(await screen.findByRole("table")).toBeInTheDocument();expect(screen.getByRole("button",{name:"List"})).toHaveAttribute("aria-pressed","true");}
    finally {window.matchMedia=previous;}
  });
});
describe("Reusable leave preview foundation",()=>{
  it("renders API counts directly including a zero-day preview",()=>{
    render(<LeaveSummaryPanel calculation={{from_date:"2026-10-03",to_date:"2026-10-04",calendar_days:2,weekend_days:2,holiday_days:0,leave_days:0}}/>);
    expect(screen.getByText("Requested days").nextElementSibling).toHaveTextContent("0");expect(screen.getByRole("status")).toHaveTextContent("no working days");
  });
  it("provides loading, error and empty states",()=>{
    const result=render(<LeaveSummaryPanel calculation={null}/>);expect(screen.getByText(/Select a leave type and dates/)).toBeVisible();result.rerender(<LeaveSummaryPanel calculation={null} loading/>);expect(screen.getByRole("status")).toHaveTextContent("Calculating");result.rerender(<LeaveSummaryPanel calculation={null} error="Please retry."/>);expect(screen.getByRole("alert")).toHaveTextContent("Please retry.");
  });
  it("sends exact UUID/date requests and reads holiday details through authenticated transport",async()=>{
    setAuthTransport("test-token",null);const body={employee_id:"e1",leave_type_id:"t1",from_date:"2026-10-12",to_date:"2026-10-12"};
    server.use(http.post(`${origin}/leave/calculate-days`,async({request})=>{expect(request.headers.get("Authorization")).toBe("Bearer test-token");expect(await request.json()).toEqual(body);return HttpResponse.json({...body,calendar_days:1,weekend_days:0,holiday_days:0,leave_days:1});}),http.get(`${origin}/holidays/h1`,()=>HttpResponse.json(holidays[0])));
    expect((await calendarService.calculate(body)).leave_days).toBe(1);expect((await calendarService.holiday("h1")).name).toBe("Company Day");
  });
});
