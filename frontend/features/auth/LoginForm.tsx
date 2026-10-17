"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Check, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { BrandLockup } from "@/components/common/BrandLogo";
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
  if (auth.loading || auth.user) return <p role="status" className="grid min-h-screen place-items-center bg-canvas p-8 text-center text-muted">Checking your session…</p>;
  if (auth.error) return <main className="grid min-h-screen place-items-center bg-canvas p-8"><div className="card w-full max-w-sm space-y-4 p-6 text-center"><p role="alert" className="text-ink">Unable to restore your session.</p>
    <div className="flex flex-wrap justify-center gap-3"><button onClick={() => void auth.retry()} className="btn btn-primary">Retry</button><button onClick={() => void auth.signOut()} className="btn btn-secondary">Sign out on this device</button></div></div></main>;
  return <main className="grid min-h-screen grid-rows-[auto_1fr] bg-white md:grid-cols-[1fr_1fr] md:grid-rows-1 lg:grid-cols-[1.05fr_1fr]">
    <aside aria-label="About AIProxys Leave Management" className="hero-gradient hero-rings flex flex-col justify-between gap-6 px-6 py-6 md:px-10 md:py-10 lg:px-13 lg:py-12">
      <div><BrandLockup subtitleClassName="text-white/85" />
        <div className="hidden md:block"><h2 className="mt-10 max-w-[14ch] font-display text-3xl lg:text-4xl font-bold leading-tight text-white">Plan time off with confidence.</h2>
          <p className="mt-4 max-w-[42ch] text-white/85">Apply for leave, track approvals and see your balance for the year in one place.</p>
          <ul className="mt-7 space-y-3 text-sm">{["Live leave balances by type", "Manager approvals with notifications", "Holiday-aware day calculation"].map(text =>
            <li key={text} className="flex items-center gap-2.5"><span className="grid h-6.5 w-6.5 place-items-center rounded-lg bg-white/15"><Check aria-hidden size={15} className="text-lime-brand" /></span>{text}</li>)}</ul></div></div>
      <p className="hidden text-xs text-white/70 md:block">© {new Date().getFullYear()} AIProxys · Smart AI Agents</p>
    </aside>
    <div className="flex justify-center px-4 pb-10 pt-8 sm:px-8 md:items-center md:p-10 lg:p-12">
    <section className="w-full max-w-[400px]" aria-labelledby="sign-in-title">
      <h1 id="sign-in-title" className="font-display text-[1.75rem] font-bold text-ink">Sign in</h1><p className="mb-6 mt-1.5 text-muted">Access your employee workspace.</p>
      {(error || auth.notice || expired) && <p role="alert" className="mb-5 rounded-[10px] border border-[#f1b7bb] bg-bad-bg p-3 text-sm text-bad-fg">{error || auth.notice || "Your session has expired. Please sign in again."}</p>}
      <form onSubmit={form.handleSubmit(submit)} noValidate className="space-y-5">
        <div><label htmlFor="username" className="field-label">Email or Employee ID *</label><div className="relative">
          <Mail aria-hidden size={17} className="pointer-events-none absolute left-3.5 top-3.5 text-muted" />
          <input {...form.register("username")} id="username" autoComplete="username" autoFocus aria-required="true"
            aria-invalid={!!form.formState.errors.username} aria-describedby={form.formState.errors.username ? "username-error" : undefined}
            data-testid="login-username" maxLength={255} className="field-input w-full pl-10" /></div>
          {form.formState.errors.username && <p id="username-error" className="field-error">{form.formState.errors.username.message}</p>}</div>
        <div><label htmlFor="password" className="field-label">Password *</label><div className="relative">
          <LockKeyhole aria-hidden size={17} className="pointer-events-none absolute left-3.5 top-3.5 text-muted" />
          <input {...form.register("password")} id="password" type={visible ? "text" : "password"} autoComplete="current-password" aria-required="true"
            aria-invalid={!!form.formState.errors.password} aria-describedby={form.formState.errors.password ? "password-error" : undefined}
            data-testid="login-password" maxLength={128} className="field-input w-full pl-10 pr-12" />
          <button type="button" aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} onClick={() => setVisible(!visible)}
            className="absolute right-1 top-1 rounded-lg p-2 text-muted hover:bg-brand-50 hover:text-brand-700">{visible ? <EyeOff aria-hidden size={18} /> : <Eye aria-hidden size={18} />}</button></div>
          {form.formState.errors.password && <p id="password-error" className="field-error">{form.formState.errors.password.message}</p>}</div>
        <button data-testid="login-submit" type="submit" disabled={form.formState.isSubmitting || auth.loginPending} aria-busy={form.formState.isSubmitting}
          className="btn btn-primary w-full">{form.formState.isSubmitting ? "Signing in…" : "Sign in"}</button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">Trouble signing in? Contact your HR administrator.</p>
    </section></div></main>;
}
