"use client";
import { useRef } from "react";
import { eachDayOfInterval, startOfMonth, endOfMonth, getISODay, format, parseISO } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import type { Holiday } from "@/types/employee";
import { CardHeader } from "@/components/common/CardHeader";
export const WEEKDAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
export function HolidayCalendar({ year, month, today, holidays, select, navigate, showStatus = false }: {
  year: number; month: number; today: string; holidays: Holiday[]; showStatus?: boolean;
  select: (holiday: Holiday) => void; navigate: (year: number, month: number) => void;
}) {
  const first=parseISO(`${String(year).padStart(4,"0")}-${String(month).padStart(2,"0")}-01`);
  const days=eachDayOfInterval({start:startOfMonth(first),end:endOfMonth(first)});
  const refs=useRef<(HTMLButtonElement|null)[]>([]);
  const byDate=new Map(holidays.map(holiday=>[holiday.holiday_date,holiday]));
  function move(delta: number) {
    const index=year*12+month-1+delta;const nextYear=Math.floor(index/12);const nextMonth=index%12+1;
    if(nextYear>=1900&&nextYear<=9999) navigate(nextYear,nextMonth);
  }
  const leading=getISODay(first)-1; const trailing=(7-((leading+days.length)%7))%7;
  return <section aria-label="Holiday calendar" className="card overflow-hidden">
    <CardHeader icon={CalendarDays} action={<div className="flex gap-1.5"><button disabled={year===1900&&month===1} onClick={()=>move(-1)} aria-label="Previous month" className="btn btn-secondary px-3"><ChevronLeft aria-hidden size={18}/></button>
      <button onClick={()=>navigate(Number(today.slice(0,4)),Number(today.slice(5,7)))} className="btn btn-secondary">Today</button>
      <button disabled={year===9999&&month===12} onClick={()=>move(1)} aria-label="Next month" className="btn btn-secondary px-3"><ChevronRight aria-hidden size={18}/></button></div>}>{format(first,"MMMM yyyy")}</CardHeader>
    <div className="p-3 sm:p-5">
    <p className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted"><span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-3 w-3 rounded bg-brand-600" />Mandatory</span>
      <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-3 w-3 rounded border-2 border-dashed border-[#c27c00] bg-warn-bg" />Optional</span>
      <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-3 w-3 rounded border border-line bg-[#f2f5fb]" />Weekend</span>
      <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-3 w-3 rounded-full bg-brand-600 ring-2 ring-brand-100" />Today</span></p>
    <div className="overflow-hidden rounded-xl border border-line">
    <div className="grid grid-cols-7 bg-[#eef4fc]">{WEEKDAYS.map((day,index)=><span key={day} className={`py-2 text-center text-[11px] font-bold uppercase tracking-wider ${index>=5 ? "text-[#6d4bd8]" : "text-brand-800"}`}>{day}</span>)}</div>
    <div className="grid grid-cols-7 gap-px border-t border-line bg-line">
      {Array.from({length:leading},(_,index)=><span key={`empty-${index}`} aria-hidden className="min-h-24 bg-[#f7f9fd]" />)}
      {days.map((day,index)=>{const key=format(day,"yyyy-MM-dd");const holiday=byDate.get(key);const weekend=getISODay(day)>=6;const isToday=key===today;
        const inactive=showStatus&&holiday?.status==="INACTIVE";
        return <button key={key} ref={element=>{refs.current[index]=element;}} type="button"
          aria-label={`${format(day,"EEEE, dd MMMM yyyy")}${holiday ? `, ${holiday.name}, ${holiday.is_optional ? "Optional" : "Mandatory"}${showStatus ? `, ${holiday.status === "ACTIVE" ? "Active" : "Inactive"}` : ""}` : ""}`}
          aria-current={isToday ? "date" : undefined} onClick={()=>holiday&&select(holiday)}
          onKeyDown={event=>{const delta:Record<string,number>={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};
            if(event.key in delta){event.preventDefault();const target=index+delta[event.key];if(target>=0&&target<days.length) refs.current[target]?.focus();}}}
          className={`relative flex min-h-24! min-w-0 flex-col items-center justify-center gap-1.5 p-1.5 text-center transition-colors focus-visible:z-10 sm:p-2 ${holiday&&!inactive ? (holiday.is_optional ? "bg-[#fffaf0] hover:bg-warn-bg" : "bg-brand-50 hover:bg-[#dfeafa]") : weekend ? "bg-[#f2f5fb] hover:bg-[#e9eef8]" : "bg-white hover:bg-[#f6f9fe]"} ${holiday ? "cursor-pointer" : "cursor-default"}`}>
          <span className={`grid h-7 w-7 place-items-center rounded-full text-sm ${isToday ? "bg-brand-600 font-bold text-white ring-2 ring-brand-100" : weekend ? "font-medium text-[#6d4bd8]" : "font-medium text-ink"}`}>{format(day,"d")}</span>
          {holiday&&<span title={`${holiday.name} (${holiday.is_optional ? "Optional" : "Mandatory"})`} className={`block w-full truncate rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${inactive ? "border border-dashed border-line bg-white text-muted" : holiday.is_optional ? "border border-dashed border-[#c27c00] bg-warn-bg text-warn-fg" : "bg-brand-600 text-white"}`}>{inactive ? "Inactive · " : ""}{holiday.is_optional ? "○" : "●"} {holiday.name}</span>}
        </button>;})}
      {Array.from({length:trailing},(_,index)=><span key={`tail-${index}`} aria-hidden className="min-h-24 bg-[#f7f9fd]" />)}
    </div></div>
    <p className="mt-3 text-xs text-muted">Use arrow keys to move between dates. Select a holiday to view details.</p>
  </div></section>;
}
