"use client";

import { useEffect } from "react";
import { useSiteStore } from "@/lib/store";
import { detectCapability, readSavedMode, saveMode } from "@/lib/capability";

/**
 * Runs capability detection once on mount and writes the verdict to the store.
 * Also listens for prefers-reduced-motion changes — turning it ON always forces
 * "classic", even if the user has locked their preference, because it is an
 * accessibility requirement.
 *
 * Renders nothing; place this once near the root of the component tree.
 */
export function CapabilityGate() {
  const setMode = useSiteStore((s) => s.setMode);
  const setQuality = useSiteStore((s) => s.setQuality);

  useEffect(() => {
    // Pick the rendering tier before anything mounts, so quality never changes
    // in front of the user. Runs even when a saved mode preference exists,
    // because the tier is about the hardware, not the choice.
    const report = detectCapability();
    setQuality(report.recommendedQuality);

    // 1. Honour the user's saved choice first — it always wins over detection.
    const saved = readSavedMode();
    if (saved !== null) {
      setMode(saved, { lock: true });
    } else {
      // 2. No saved preference — use the hardware verdict.
      setMode(report.recommended); // intentionally no lock
    }

    // 3. Watch for prefers-reduced-motion changes at runtime.
    //    Turning it ON is an accessibility action and overrides everything.
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");

    function handleMotionChange(e: MediaQueryListEvent) {
      if (e.matches) {
        // Force classic — do NOT lock so detection can re-run if turned off.
        setMode("classic");
        // Persist so a page reload also respects this.
        saveMode("classic");
      }
    }

    mq.addEventListener("change", handleMotionChange);
    return () => {
      mq.removeEventListener("change", handleMotionChange);
    };
  }, [setMode, setQuality]);

  return null;
}
