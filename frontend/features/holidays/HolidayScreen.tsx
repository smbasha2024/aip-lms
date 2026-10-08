"use client";
import { useState, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useLeaveYear } from "@/hooks/use-leave-year";
import { useHolidays } from "@/hooks/use-calendar";
import { QueryError, QueryLoading } from "@/components/common/QueryState";
import { YearSelect } from "@/components/common/YearSelect";
import { calendarDate } from "@/lib/format";
import { HolidayCalendar } from "./HolidayCalendar";
import { HolidayList } from "./HolidayList";
function subscribe(callback:()=>void) { const media=window.matchMedia?.("(max-width: 767px)");media?.addEventListener("change",callback);return ()=>media?.removeEventListener("change",callback); }
function mobileSnapshot() { return window.matchMedia?.("(max-width: 767px)").matches??false; }
export function HolidayScreen() {
  const {user}=useAuth();const selection=useLeaveYear();const params=useSearchParams();const router=useRouter();const path=usePathname();
  const months=params.getAll("month");const raw=months[0];const validMonth=months.length===0 || (months.length===1 && /^\d{1,2}$/.test(raw) && Number(raw)>=1 && Number(raw)<=12);
  const month=months.length===0 ? null : Number(raw);
  const query=useHolidays(validMonth ? selection.year : null);const mobile=useSyncExternalStore(subscribe,mobileSnapshot,()=>true);
  const [chosenView,setView]=useState<"calendar"|"list"|null>(null);const view=chosenView??(mobile ? "list" : "calendar");
  const [selectedId,selectId]=useState<string|null>(null);
  function navigate(year:number,month:number|null) { router.replace(`${path}?year=${year}${month===null ? "" : `&month=${month}`}`,{scroll:false});selectId(null); }
  const today=user?.business_today??"";const calendarMonth=month??Number(today.slice(5,7));
  const all=query.data?.items??[];const shown=month===null ? all : all.filter(holiday=>Number(holiday.holiday_date.slice(5,7))===month);
  const selected=shown.find(holiday=>holiday.holiday_id===selectedId);
  return <section className="max-w-6xl space-y-5"><header className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-3xl font-semibold">Holiday Calendar</h1>
    <div className="flex flex-wrap items-center gap-3"><YearSelect {...selection} select={year=>navigate(year,validMonth ? month : null)} />
      <label htmlFor="holiday-month" className="text-sm font-medium">Month</label><select id="holiday-month" value={validMonth ? month??"" : "invalid"} onChange={event=>navigate(selection.year??selection.current,event.target.value==="" ? null : Number(event.target.value))} className="rounded border border-slate-300 bg-white px-3 py-2">
      {!validMonth&&<option value="invalid" disabled>Select a valid month</option>}<option value="">All months</option>{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>{new Intl.DateTimeFormat("en",{month:"long",timeZone:"UTC"}).format(new Date(Date.UTC(2026,i,1)))}</option>)}</select></div></header>
    <div role="group" aria-label="Holiday view" className="flex gap-2">{(["calendar","list"] as const).map(option=><button key={option} aria-pressed={view===option} onClick={()=>setView(option)} className={`rounded border px-4 py-2 ${view===option ? "border-blue-600 bg-blue-50 text-blue-800" : "border-slate-300 bg-white"}`}>{option==="calendar" ? "Calendar" : "List"}</button>)}</div>
    {selection.year===null || !validMonth ? <p role="alert">Select a year between 1900 and 9999 and a month between 1 and 12.</p> : query.isPending ? <QueryLoading/> : query.isError ? <QueryError error={query.error} retry={()=>void query.refetch()}/> : <>
      {shown.length===0&&<p className="rounded-lg border bg-white p-5">No holidays have been published for {selection.year}{month!==null ? ` in the selected month` : ""}.</p>}
      {view==="calendar" ? <HolidayCalendar year={selection.year} month={calendarMonth} today={today} holidays={all} select={holiday=>selectId(holiday.holiday_id)} navigate={navigate}/> : <HolidayList holidays={shown} select={holiday=>selectId(holiday.holiday_id)} grouped={month===null}/>}
      {selected&&<section aria-label="Holiday details" className="rounded-lg border border-blue-200 bg-white p-5"><h2 className="break-words text-xl font-semibold">{selected.name}</h2><p className="mt-2">{calendarDate(selected.holiday_date)} · {selected.is_optional ? "Optional" : "Mandatory"}</p><p className="mt-3 break-words">{selected.description??"No description provided."}</p><button onClick={()=>selectId(null)} className="mt-4 rounded border px-3 py-2">Close details</button></section>}
    </>}
  </section>;
}
