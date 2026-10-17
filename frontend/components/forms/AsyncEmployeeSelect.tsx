"use client";
import { useEffect, useId, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useEmployees } from "@/hooks/use-admin-employees";
import { useDirectReports } from "@/hooks/use-team";
import { QueryError } from "@/components/common/QueryState";
import { Info } from "lucide-react";
import type { LucideIcon } from "lucide-react";
export function AsyncEmployeeSelect({ value, onChange, managers = false, excludeId, initialLabel = "", label = "Employee", labelIcon: LabelIcon }: { value: string; onChange: (id: string) => void; managers?: boolean; excludeId?: string; initialLabel?: string; label?: string; labelIcon?: LucideIcon }) {
  const id = useId(); const [search, setSearch] = useState(""); const [debounced, setDebounced] = useState(""); const [open, setOpen] = useState(false); const [active, setActive] = useState(-1); const [selected, setSelected] = useState({ id: "", label: "" });
  useEffect(() => { const timer = setTimeout(() => { setDebounced(search.trim()); setActive(-1); }, 300); return () => clearTimeout(timer); }, [search]);
  const { user } = useAuth(); const organization = user?.role === "ADMINISTRATOR";
  const filters = { page: 1, page_size: 20, ...(debounced ? { search: debounced } : {}) };
  const reports = useDirectReports(!organization && !managers ? filters : null);
  const employees = useEmployees(organization ? { ...filters, ...(managers ? { status: "ACTIVE", role: "MANAGER" } as const : {}) } : null);
  const administrators = useEmployees(organization && managers ? { ...filters, status: "ACTIVE", role: "ADMINISTRATOR" } : null);
  const query = organization ? employees : reports;
  const options = [...(query.data?.items ?? []), ...(managers ? administrators.data?.items ?? [] : [])]
    .filter(employee => employee.employee_id !== excludeId && (!managers || employee.account?.status === "ACTIVE"))
    .sort((a,b) => a.name.localeCompare(b.name) || a.employee_id.localeCompare(b.employee_id));
  const pending = query.isPending || managers && administrators.isPending;
  const failed = query.isError || managers && administrators.isError;
  function choose(index: number) { const employee = options[index]; if (employee) { setSelected({ id: employee.employee_id, label: `${employee.name} (${employee.employee_code})` }); onChange(employee.employee_id); setOpen(false); } }
  const help = managers ? "Search active managers and administrators. Only top-level managers and administrators may omit a manager." : organization ? "Search organization employees." : "Search your current direct reports.";
  // Help text: visible as a hover/focus tooltip on the info icon; kept in the DOM (visually hidden) and linked to the input.
  return <div><div className="flex items-center gap-1.5"><label htmlFor={id} className={LabelIcon ? "flex items-center gap-2 font-medium" : undefined}>{LabelIcon && <LabelIcon aria-hidden size={16} className="text-brand-600" />}{label}</label><span aria-hidden="true" data-tip={help} className="help-tip"><Info size={14} /></span></div><p id={`${id}-help`} className="sr-only">{help}</p><input id={id} aria-describedby={`${id}-help`} role="combobox" aria-autocomplete="list" aria-controls={`${id}-options`} aria-expanded={open} aria-activedescendant={open && options[active] ? `${id}-${active}` : undefined} value={search} maxLength={200} placeholder="Search name, email or code" onFocus={() => setOpen(true)} onChange={event => { setSearch(event.target.value); setOpen(true); }} onKeyDown={event => {
    if (event.key === "Escape") setOpen(false);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); setActive(index => Math.max(0, Math.min(options.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)))); }
    if (event.key === "Enter" && open) { event.preventDefault(); choose(Math.max(0, active)); }
  }} className="field-input mt-1 block w-full"/>
    {value && <p className="mt-1 break-words text-sm">{selected.id === value ? selected.label : initialLabel || `Selected employee: ${value}`} <button type="button" onClick={() => { onChange(""); setSelected({ id: "", label: "" }); setSearch(""); setOpen(false); }} className="text-brand-700 underline">Clear employee</button></p>}
    {open && <div className="mt-1 rounded-[14px] border bg-white p-2 border-line">{pending ? <p role="status">Searching employees…</p> : failed ? <QueryError error={(query.error ?? administrators.error)!} retry={() => { void query.refetch(); if (managers) void administrators.refetch(); }}/> : <><ul id={`${id}-options`} role="listbox" aria-label={label + " search results"}>{options.map((employee,index) => <li id={`${id}-${index}`} key={employee.employee_id} role="option" aria-selected={employee.employee_id === value} onMouseDown={event => event.preventDefault()} onClick={() => choose(index)} className={`cursor-pointer rounded p-2 ${active === index ? "bg-brand-50" : ""}`}>{employee.name} ({employee.employee_code})</li>)}</ul>{!options.length && <p>No employees match.</p>}{((query.data?.total ?? 0) > 20 || managers && (administrators.data?.total ?? 0) > 20) && <p className="text-xs">Showing the first 20 matches per role. Refine your search.</p>}<button type="button" onClick={() => setOpen(false)} className="mt-2 text-sm underline">Close employee search</button></>}</div>}
  </div>;
}
