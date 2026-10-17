import { format, parseISO } from "date-fns";
import type { Holiday } from "@/types/employee";
import { calendarDate } from "@/lib/format";
export function HolidayList({ holidays, select, grouped }: { holidays: Holiday[]; select: (holiday: Holiday) => void; grouped: boolean }) {
  const groups=new Map<string,Holiday[]>();
  holidays.forEach(holiday=>{const key=grouped ? holiday.holiday_date.slice(0,7) : "all";groups.set(key,[...(groups.get(key)??[]),holiday]);});
  return <div className="space-y-5">{Array.from(groups,([key,items])=><section key={key}>
    {grouped&&<h2 className="mb-3 section-title">{format(parseISO(`${key}-01`),"MMMM yyyy")}</h2>}
    <div className="hidden overflow-x-auto rounded-[14px] border border-line bg-white md:block"><table className="data-table w-full text-left text-sm"><caption className="table-title">Published holidays{grouped ? ` ${key}` : ""}</caption>
      <thead className="bg-[#f6f8fd] table-head"><tr>{["Date","Day","Holiday","Type","Description"].map(label=><th scope="col" key={label} className="px-4 py-3">{label}</th>)}</tr></thead>
      <tbody>{items.map(holiday=><tr key={holiday.holiday_id} className="border-t border-line"><td className="whitespace-nowrap px-4 py-3">{calendarDate(holiday.holiday_date)}</td><td className="px-4 py-3">{format(parseISO(holiday.holiday_date),"EEEE")}</td><th scope="row" className="max-w-xs break-words px-4 py-3"><button onClick={()=>select(holiday)} className="text-left font-medium text-brand-700 underline">{holiday.name}</button></th><td className="px-4 py-3">{holiday.is_optional ? "Optional" : "Mandatory"}</td><td className="max-w-sm break-words px-4 py-3">{holiday.description??"—"}</td></tr>)}</tbody></table></div>
    <div className="space-y-3 md:hidden">{items.map(holiday=><article key={holiday.holiday_id} className="rounded-[14px] border border-line bg-white p-4"><h3 className="break-words font-semibold"><button onClick={()=>select(holiday)} className="text-left text-brand-700 underline">{holiday.name}</button></h3><p className="mt-2 text-sm">{calendarDate(holiday.holiday_date)} · {format(parseISO(holiday.holiday_date),"EEEE")}</p><p className="mt-2 text-sm">{holiday.is_optional ? "Optional" : "Mandatory"}</p><p className="mt-2 break-words text-sm text-muted">{holiday.description??"—"}</p></article>)}</div>
  </section>)}</div>;
}
