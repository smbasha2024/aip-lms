"use client";
export function YearSelect({ year, options, select }: { year: number | null; options: number[]; select: (year: number) => void }) {
  return <div className="flex items-center gap-2"><label htmlFor="leave-year" className="text-sm font-medium">Year</label>
    <select id="leave-year" value={year ?? ""} onChange={event => select(Number(event.target.value))} className="rounded-md border border-slate-300 bg-white px-3 py-2">
      {year === null && <option value="" disabled>Select a valid year</option>}
      {options.map(option => <option key={option} value={option}>{option}</option>)}
    </select></div>;
}
