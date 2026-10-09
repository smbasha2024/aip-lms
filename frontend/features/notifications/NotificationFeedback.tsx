"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
const FeedbackContext = createContext<(message: string) => void>(() => undefined);
export function useNotificationFeedback() { return useContext(FeedbackContext); }
export function NotificationFeedbackProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<{ message: string } | null>(null);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 8_000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  return <FeedbackContext.Provider value={message => setNotice({ message })}>
    {children}
    {notice && <div role="status" className="fixed bottom-4 left-4 right-4 z-50 flex items-center gap-3 rounded-lg border border-slate-300 bg-white p-4 shadow-lg sm:left-auto sm:max-w-md">
      <p className="min-w-0 flex-1 break-words">{notice.message}</p><button onClick={() => setNotice(null)} aria-label="Dismiss notification message" className="rounded border px-3 py-2">Dismiss</button>
    </div>}
  </FeedbackContext.Provider>;
}
