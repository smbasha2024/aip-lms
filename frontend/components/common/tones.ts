// Presentation-only color tones (UI_SPEC.md §4.6). No business meaning; leave types are never hardcoded.
const leaveTypeTones = ["tone-brand", "tone-teal", "tone-green", "tone-amber", "tone-violet", "tone-magenta", "tone-sky"];
/**
 * Stable tone for a leave type, so every screen shows the same color for the same type.
 * Loss of Pay (code LOP) is always red by product decision (UI_SPEC.md §4.6); red is not used for any other type.
 * Other types get a tone derived from their name, so new admin-defined types are colored without hardcoding.
 */
export function leaveTypeTone(name: string, code?: string): string {
  const normalized = name.trim().toLowerCase();
  if (code?.trim().toUpperCase() === "LOP" || normalized === "loss of pay") return "tone-red";
  let hash = 21;
  for (const char of normalized) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
  hash ^= hash >>> 16; hash = Math.imul(hash, 0x45d9f3b) >>> 0; hash ^= hash >>> 16; // avalanche so all bits affect the slot
  return leaveTypeTones[(hash >>> 0) % leaveTypeTones.length];
}
const metricTones: Record<string, string> = {
  allocated: "tone-brand", "carried forward": "tone-violet", used: "tone-slate", pending: "tone-amber", available: "tone-green",
  "team size": "tone-brand", "pending approvals": "tone-amber", "approved applications": "tone-green", "on leave today": "tone-sky",
  "total employees": "tone-brand", "active employees": "tone-teal", "pending applications": "tone-amber", "rejected applications": "tone-red",
  approved: "tone-green", rejected: "tone-red", cancelled: "tone-slate",
};
/** Tone for a metric/count label, e.g. "Pending approvals" → amber. */
export function metricTone(label: string): string { return metricTones[label.trim().toLowerCase()] ?? "tone-brand"; }
