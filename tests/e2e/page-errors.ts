import type { Page } from "../../frontend/node_modules/@playwright/test";

// https://github.com/microsoft/playwright/issues/42823: hard navigation can
// cancel Next prefetches before pagehide. Keep genuine application/CORS failures.
export function cancelledPrefetch(error: Error, navigating: boolean, origin: string): string | null {
  if (!navigating) return null;
  const match = error.stack?.split("\n")[0].match(/^Fetch API cannot load (https?:\/\/\S+) due to access control checks\.$/);
  if (!match || !error.stack?.includes("/_next/static/chunks/")) return null;
  const url = new URL(match[1]);
  return url.origin === origin && url.searchParams.has("_rsc") ? url.pathname : null;
}

const states = new WeakMap<Page, { navigating: boolean; origin: string; seen: WeakSet<Error>; cancellations: string[] }>();
export function navigationCancellations(page: Page) { return states.get(page)?.cancellations ?? []; }

export function watchPageErrors(page: Page, errors: string[] = []) {
  let state = states.get(page);
  if (!state) {
    state = { navigating: false, origin: "", seen: new WeakSet(), cancellations: [] };
    states.set(page, state);
    const current = state;
    page.on("request", request => {
      if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
        current.navigating = true;
        current.origin = new URL(request.url()).origin;
      }
    });
    page.on("framenavigated", frame => { if (frame === page.mainFrame()) current.navigating = false; });
    page.on("requestfailed", request => {
      if (request.isNavigationRequest() && request.frame() === page.mainFrame()) current.navigating = false;
    });
  }
  const current = state;
  const record = (error: Error) => {
    const path = cancelledPrefetch(error, current.navigating, current.origin);
    if (path) {
      if (!current.seen.has(error)) { current.seen.add(error); current.cancellations.push(path); }
    } else errors.push(error.message);
  };
  page.on("pageerror", record);
  return { errors, stop: () => page.off("pageerror", record) };
}
