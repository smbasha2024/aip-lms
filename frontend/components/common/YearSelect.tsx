"use client";
export function YearSelect({ year, options, select, tone = "default" }: { year: number | null; options: number[]; select: (year: number) => void; tone?: "default" | "hero" }) {
  const hero = tone === "hero";
  return <div className="flex items-center gap-2"><label htmlFor="leave-year" className={`text-sm font-medium ${hero ? "text-white/90" : "text-ink"}`}>Year</label>
    <select id="leave-year" value={year ?? ""} onChange={event => select(Number(event.target.value))} className={`min-h-11 rounded-[10px] border px-3 py-2 text-ink ${hero ? "border-white/40 bg-white font-semibold" : "border-[#c9d3e6] bg-white"}`}>
      {year === null && <option value="" disabled>Select a valid year</option>}
      {options.map(option => <option key={option} value={option}>{option}</option>)}
    </select></div>;
}
