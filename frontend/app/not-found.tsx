import Link from "next/link";
export default function NotFound() {
  return <section className="mx-auto max-w-xl p-8"><h1 className="text-2xl font-semibold">Page not found</h1><p className="my-4">The page you requested is unavailable.</p>
    <Link href="/dashboard" className="text-blue-700 underline">Back to dashboard</Link></section>;
}
