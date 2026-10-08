"use client";
import NotFound from "@/app/not-found";
// AuthGate evaluates role restrictions before this fallback renders.
export default function UnavailableRoute() { return <NotFound />; }
