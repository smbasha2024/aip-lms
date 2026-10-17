import Link from "next/link";
import { ShieldAlert } from "lucide-react";
export function ForbiddenState() {
  return <main className="mx-auto my-8 max-w-xl px-4"><div className="card flex flex-col items-center gap-3 px-6 py-10 text-center">
    <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-600"><ShieldAlert aria-hidden size={24} /></span>
    <h1 className="page-title">Access restricted</h1>
    <p className="text-muted">You don&apos;t have permission to view this page.</p><Link className="btn btn-primary mt-2" href="/dashboard">Back to dashboard</Link></div></main>;
}
