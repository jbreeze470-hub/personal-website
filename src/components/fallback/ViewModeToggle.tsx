"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useSiteStore } from "@/lib/store";
import { detectCapability, saveMode } from "@/lib/capability";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Probing WebGL creates a canvas, so cache the result for the session.
 * Only ever read after hydration.
 */
let webglCache: boolean | null = null;
function hasWebGLSupport(): boolean {
  if (webglCache === null) {
    webglCache = detectCapability().hasWebGL;
  }
  return webglCache;
}

const noopSubscribe = () => () => {};

/**
 * False during SSR and during hydration, true afterwards. useSyncExternalStore
 * keeps the hydration render identical to the server output, instead of
 * branching on `typeof window`, which produces a hydration mismatch.
 */
function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

function subscribeMotion(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_MOTION_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false,
  );
}

/**
 * Fixed-position toggle letting the user switch between the immersive 3D view
 * and the classic 2D view.
 *
 * - Hidden when WebGL is unavailable (3D cannot render).
 * - Disabled when prefers-reduced-motion is active.
 * - Clicking flips the mode, locks it, and persists the choice.
 */
export function ViewModeToggle() {
  const mode = useSiteStore((s) => s.mode);
  const setMode = useSiteStore((s) => s.setMode);
  const hydrated = useHydrated();
  const prefersReducedMotion = useReducedMotion();

  const isImmersive = mode === "immersive";

  const handleClick = useCallback(() => {
    if (prefersReducedMotion) return;
    const next = isImmersive ? "classic" : "immersive";
    setMode(next, { lock: true });
    saveMode(next);
  }, [isImmersive, prefersReducedMotion, setMode]);

  if (!hydrated) return null;
  if (!hasWebGLSupport()) return null;

  const label = isImmersive ? "Exit 3D view" : "Launch 3D view";
  const reducedMotionTitle =
    "3D animations are disabled because prefers-reduced-motion is active in your system settings.";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={prefersReducedMotion}
      aria-label={
        prefersReducedMotion ? "3D view unavailable (reduced motion)" : label
      }
      title={prefersReducedMotion ? reducedMotionTitle : label}
      className={[
        "fixed bottom-4 left-4 z-40",
        "border border-edge bg-surface/80 backdrop-blur",
        "font-mono text-xs rounded px-3 py-2",
        "transition-colors",
        prefersReducedMotion
          ? "text-ink-dim cursor-not-allowed opacity-50"
          : "text-ink-muted hover:text-accent hover:border-accent-deep cursor-pointer",
      ].join(" ")}
    >
      {prefersReducedMotion ? "3D unavailable" : label}
    </button>
  );
}
