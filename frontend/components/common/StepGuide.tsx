// Decorative progress guide for multi-field forms (UI_SPEC.md §4.6). Hidden from assistive technology:
// field labels, validation and errors remain the source of truth.
export function StepGuide({ steps }: { steps: [label: string, done: boolean][] }) {
  return <ol aria-hidden="true" className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">{steps.map(([label, done], index) =>
    <li key={label} className="flex items-center gap-2">{index > 0 && <span className="h-px w-5 bg-line" />}<span className={`grid h-6 w-6 place-items-center rounded-full ${done ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-700"}`}>{done ? "✓" : index + 1}</span><span className={done ? "text-brand-700" : ""}>{label}</span></li>)}</ol>;
}
