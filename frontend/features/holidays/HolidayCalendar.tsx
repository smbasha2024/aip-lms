"use client";
import { useRef } from "react";
import { eachDayOfInterval, startOfMonth, endOfMonth, getISODay, format, parseISO } from "date-fns";
import type { Holiday } from "@/types/employee";
export const WEEKDAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
export function HolidayCalendar({ year, month, today, holidays, select, navigate }: {
  year: number; month: number; today: string; holidays: Holiday[];
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
  return <section aria-label="Holiday calendar" className="rounded-lg border border-slate-200 bg-white p-3 sm:p-5">
    <header className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">{format(first,"MMMM yyyy")}</h2>
      <div className="flex gap-2"><button disabled={year===1900&&month===1} onClick={()=>move(-1)} aria-label="Previous month" className="rounded border px-3 py-2 disabled:opacity-40">←</button>
      <button onClick={()=>navigate(Number(today.slice(0,4)),Number(today.slice(5,7)))} className="rounded border px-3 py-2">Today</button>
      <button disabled={year===9999&&month===12} onClick={()=>move(1)} aria-label="Next month" className="rounded border px-3 py-2 disabled:opacity-40">→</button></div></header>
    <p className="mb-4 text-sm text-slate-600">● Mandatory / ○ Optional</p>
    <div className="grid grid-cols-7 gap-1">{WEEKDAYS.map(day=><span key={day} className="py-2 text-center text-xs font-semibold text-slate-600">{day}</span>)}
      {Array.from({length:getISODay(first)-1},(_,index)=><span key={`empty-${index}`} aria-hidden />)}
      {days.map((day,index)=>{const key=format(day,"yyyy-MM-dd");const holiday=byDate.get(key);const weekend=getISODay(day)>=6;
        return <button key={key} ref={element=>{refs.current[index]=element;}} type="button"
          aria-label={`${format(day,"EEEE, dd MMMM yyyy")}${holiday ? `, ${holiday.name}, ${holiday.is_optional ? "Optional" : "Mandatory"}` : ""}`}
          aria-current={key===today ? "date" : undefined} onClick={()=>holiday&&select(holiday)}
          onKeyDown={event=>{const delta:Record<string,number>={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};
            if(event.key in delta){event.preventDefault();const target=index+delta[event.key];if(target>=0&&target<days.length) refs.current[target]?.focus();}}}
          className={`min-h-24 min-w-0 rounded border p-1 text-left align-top sm:p-2 ${weekend ? "bg-slate-50" : "bg-white"} ${key===today ? "border-blue-600 ring-1 ring-blue-600" : "border-slate-200"}`}>
          <span className="block text-sm">{format(day,"d")}</span>{holiday&&<span title={`${holiday.name} (${holiday.is_optional ? "Optional" : "Mandatory"})`} className="mt-2 block truncate text-xs text-blue-800">{holiday.is_optional ? "○" : "●"} {holiday.name}</span>}
        </button>;})}
    </div><p className="mt-3 text-xs text-slate-600">Use arrow keys to move between dates. Select a holiday to view details.</p>
  </section>;
}
