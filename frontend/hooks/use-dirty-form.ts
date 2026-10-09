"use client";
import { useEffect } from "react";
export function useDirtyForm(dirty: boolean, message = "Discard your unsaved leave application?") {
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = message; };
    const click = (event: MouseEvent) => {
      const anchor = (event.target as Element)?.closest?.("a[href]");
      if (anchor && !window.confirm(message)) { event.preventDefault(); event.stopPropagation(); }
    };
    const originalState = window.history.state;
    const originalUrl = window.location.href;
    const back = (event: PopStateEvent) => {
      if (!window.confirm(message)) {
        event.stopImmediatePropagation();
        // Restore this entry for either Back or Forward without leaving the form.
        window.history.pushState(originalState, "", originalUrl);
      }
    };
    // Modern routers can handle native traversals before popstate is dispatched.
    const navigation = (window as Window & { navigation?: EventTarget }).navigation;
    const navigate = (event: Event) => {
      if ((event as Event & { navigationType?: string }).navigationType === "traverse" && event.cancelable &&
          !window.confirm(message)) {
        event.preventDefault(); event.stopImmediatePropagation();
      }
    };
    navigation?.addEventListener("navigate", navigate, true);
    window.addEventListener("beforeunload", unload); window.addEventListener("popstate", back, true);
    document.addEventListener("click", click, true);
    return () => { navigation?.removeEventListener("navigate", navigate, true); window.removeEventListener("beforeunload", unload); window.removeEventListener("popstate", back, true); document.removeEventListener("click", click, true); };
  }, [dirty, message]);
}
