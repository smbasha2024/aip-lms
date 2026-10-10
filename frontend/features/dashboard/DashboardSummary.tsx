import Link from "next/link";
export function DashboardCounts({ items }: { items: { label: string; value: number }[] }) {
  return <dl className={`grid grid-cols-2 gap-3 sm:grid-cols-3 ${items.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-5"}`}>{items.map(item => <div key={item.label} className="rounded border bg-slate-50 p-4"><dt className="text-sm text-slate-600">{item.label}</dt><dd className="mt-2 text-2xl font-semibold tabular-nums">{item.value}</dd></div>)}</dl>;
}
export function DashboardActions({ items }: { items: { label: string; href: string }[] }) {
  return <div className="flex flex-wrap gap-3">{items.map(item => <Link key={item.href} href={item.href} className="inline-flex min-h-11 items-center rounded border border-slate-300 bg-white px-3 py-2 text-sm text-blue-700">{item.label}</Link>)}</div>;
}
