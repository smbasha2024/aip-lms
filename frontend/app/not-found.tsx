import Link from "next/link";
import { Compass } from "lucide-react";
export default function NotFound() {
  return <section className="mx-auto my-8 max-w-xl px-4"><div className="card flex flex-col items-center gap-3 px-6 py-10 text-center">
    <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-600"><Compass aria-hidden size={24} /></span>
    <h1 className="page-title">Page not found</h1><p className="text-muted">The page you requested is unavailable.</p>
    <Link href="/dashboard" className="btn btn-primary mt-2">Back to dashboard</Link></div></section>;
}
