"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { safeReturnTo } from "@/lib/permissions";
import { ApiError } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-messages";
const schema = z.object({ username: z.string().trim().min(1, "Email or Employee ID is required.").max(255),
  password: z.string().min(1, "Password is required.").max(128) });
type Values = z.infer<typeof schema>;
export function LoginForm() {
  const auth = useAuth(); const router = useRouter(); const [submitted, setSubmitted] = useState(false);
  const [visible, setVisible] = useState(false); const [error, setError] = useState<string | null>(null);
  const form = useForm<Values>({ defaultValues: { username: "", password: "" } });
  useEffect(() => { if (auth.user && !submitted) router.replace("/dashboard"); }, [auth.user, router, submitted]);
  async function submit(values: Values) {
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      let first = true;
      parsed.error.issues.forEach(issue => { const field = issue.path[0] as keyof Values;
        form.setError(field, { message: issue.message }, { shouldFocus: first }); first = false; });
      return;
    }
    setError(null); setSubmitted(true);
    try {
      const user = await auth.signIn(parsed.data.username, parsed.data.password);
      form.resetField("password");
      const returnTo = new URLSearchParams(window.location.search).get("returnTo");
      router.replace(safeReturnTo(returnTo, user.role));
    } catch (failure) {
      setSubmitted(false); setError(failure instanceof ApiError ? failure.message : errorMessage("SERVER_ERROR"));
      form.resetField("password"); form.setFocus("password");
    }
  }
  const expired = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("reason") === "expired";
  if (auth.loading || auth.user) return <p role="status" className="p-8 text-center">Checking your session…</p>;
  if (auth.error) return <main className="p-8"><p role="alert">Unable to restore your session.</p>
    <button onClick={() => void auth.retry()}>Retry</button><button onClick={() => void auth.signOut()}>Sign out on this device</button></main>;
  return <main className="grid min-h-screen place-items-center bg-slate-50 px-4 py-10">
    <section className="w-full max-w-[400px] rounded-lg border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="sign-in-title">
      <div className="mb-5 flex items-center gap-3"><span className="rounded-lg bg-blue-50 p-3 text-blue-700"><LockKeyhole aria-hidden size={24} /></span>
        <p className="font-semibold text-slate-900">Employee Leave Management</p></div>
      <h1 id="sign-in-title" className="text-2xl font-semibold">Sign in</h1><p className="mb-6 mt-2 text-sm text-slate-600">Access your employee workspace.</p>
      {(error || auth.notice || expired) && <p role="alert" className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800">{error || auth.notice || "Your session has expired. Please sign in again."}</p>}
      <form onSubmit={form.handleSubmit(submit)} noValidate className="space-y-5">
        <div><label htmlFor="username" className="mb-1 block text-sm font-medium">Email or Employee ID *</label>
          <input {...form.register("username")} id="username" autoComplete="username" autoFocus aria-required="true"
            aria-invalid={!!form.formState.errors.username} aria-describedby={form.formState.errors.username ? "username-error" : undefined}
            data-testid="login-username" maxLength={255} className="w-full rounded-md border border-slate-300 px-3 py-2" />
          {form.formState.errors.username && <p id="username-error" className="mt-1 text-sm text-red-700">{form.formState.errors.username.message}</p>}</div>
        <div><label htmlFor="password" className="mb-1 block text-sm font-medium">Password *</label><div className="relative">
          <input {...form.register("password")} id="password" type={visible ? "text" : "password"} autoComplete="current-password" aria-required="true"
            aria-invalid={!!form.formState.errors.password} aria-describedby={form.formState.errors.password ? "password-error" : undefined}
            data-testid="login-password" maxLength={128} className="w-full rounded-md border border-slate-300 px-3 py-2 pr-12" />
          <button type="button" aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} onClick={() => setVisible(!visible)}
            className="absolute right-1 top-1 rounded p-2 text-slate-600">{visible ? <EyeOff aria-hidden size={18} /> : <Eye aria-hidden size={18} />}</button></div>
          {form.formState.errors.password && <p id="password-error" className="mt-1 text-sm text-red-700">{form.formState.errors.password.message}</p>}</div>
        <button data-testid="login-submit" type="submit" disabled={form.formState.isSubmitting || auth.loginPending} aria-busy={form.formState.isSubmitting}
          className="w-full rounded-md bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-60">{form.formState.isSubmitting ? "Signing in…" : "Sign in"}</button>
      </form>
    </section></main>;
}
