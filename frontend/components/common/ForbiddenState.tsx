import Link from "next/link";
export function ForbiddenState() {
  return <main className="mx-auto max-w-xl p-8"><h1 className="text-2xl font-semibold">Access restricted</h1>
    <p className="my-4">You don&apos;t have permission to view this page.</p><Link className="text-blue-700 underline" href="/dashboard">Back to dashboard</Link></main>;
}
