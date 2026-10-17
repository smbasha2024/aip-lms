// Plain <img>: next/image adds an inline style attribute that the app CSP (style-src nonce) blocks.
export function BrandLogo({ size }: { size: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/aiproxys-logo.png" alt="" width={size} height={Math.round(size * 0.88)} />;
}
// Logo tile + "AIProxys / Leave Management" wordmark (UI_SPEC.md §4.6). Text colors come from the parent.
export function BrandLockup({ compact = false, subtitleClassName = "text-sidebar-muted" }: { compact?: boolean; subtitleClassName?: string }) {
  return <span className="flex min-w-0 items-center gap-3">
    <span className={`grid flex-none place-items-center overflow-hidden bg-white ${compact ? "h-8 w-8 rounded-lg" : "h-10 w-10 rounded-[11px]"}`}>
      <BrandLogo size={compact ? 28 : 36} /></span>
    <span className="min-w-0 font-display leading-tight"><span className="block truncate font-bold">AIProxys</span>
      {!compact && <span className={`block truncate text-xs font-medium ${subtitleClassName}`}>Leave Management</span>}</span>
  </span>;
}
