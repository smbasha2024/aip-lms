"use client";
import { useEffect, useId, useState } from "react";
import { useDirectReports } from "@/hooks/use-team";
import { QueryError } from "@/components/common/QueryState";
export function AsyncEmployeeSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const id = useId(); const [search, setSearch] = useState(""); const [debounced, setDebounced] = useState(""); const [open, setOpen] = useState(false); const [active, setActive] = useState(-1); const [selected, setSelected] = useState({ id: "", label: "" });
  useEffect(() => { const timer = setTimeout(() => { setDebounced(search.trim()); setActive(-1); }, 300); return () => clearTimeout(timer); }, [search]);
  const query = useDirectReports({ page: 1, page_size: 20, ...(debounced ? { search: debounced } : {}) });
  const options = query.data?.items ?? [];
  function choose(index: number) { const employee = options[index]; if (employee) { setSelected({ id: employee.employee_id, label: `${employee.name} (${employee.employee_code})` }); onChange(employee.employee_id); setOpen(false); } }
  return <div><label htmlFor={id}>Employee</label><p className="text-xs text-slate-600">Search your current direct reports.</p><input id={id} role="combobox" aria-autocomplete="list" aria-controls={`${id}-options`} aria-expanded={open} aria-activedescendant={open && options[active] ? `${id}-${active}` : undefined} value={search} maxLength={200} placeholder="Search name, email or code" onFocus={() => setOpen(true)} onChange={event => { setSearch(event.target.value); setOpen(true); }} onKeyDown={event => {
    if (event.key === "Escape") setOpen(false);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); setActive(index => Math.max(0, Math.min(options.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)))); }
    if (event.key === "Enter" && open) { event.preventDefault(); choose(Math.max(0, active)); }
  }} className="mt-1 block w-full rounded border p-2"/>
    {value && <p className="mt-1 break-words text-sm">{selected.id === value ? selected.label : `Selected employee: ${value}`} <button onClick={() => { onChange(""); setSelected({ id: "", label: "" }); setSearch(""); setOpen(false); }} className="text-blue-700 underline">Clear employee</button></p>}
    {open && <div className="mt-1 rounded border bg-white p-2">{query.isPending ? <p role="status">Searching employees…</p> : query.isError ? <QueryError error={query.error} retry={() => void query.refetch()}/> : <><ul id={`${id}-options`} role="listbox" aria-label="Direct reports">{options.map((employee,index) => <li id={`${id}-${index}`} key={employee.employee_id} role="option" aria-selected={employee.employee_id === value} onMouseDown={event => event.preventDefault()} onClick={() => choose(index)} className={`cursor-pointer rounded p-2 ${active === index ? "bg-blue-50" : ""}`}>{employee.name} ({employee.employee_code})</li>)}</ul>{!options.length && <p>No direct reports match.</p>}{(query.data?.total ?? 0) > 20 && <p className="text-xs">Showing the first 20 matches. Refine your search.</p>}<button onClick={() => setOpen(false)} className="mt-2 text-sm underline">Close employee search</button></>}</div>}
  </div>;
}
