/**
 * Device capability detection — pure logic, no JSX, no React components.
 * All window/navigator access MUST happen inside effects (client-only).
 */

export interface CapabilityReport {
  prefersReducedMotion: boolean;
  hasWebGL: boolean;
  cores: number | undefined;
  memory: number | undefined;
  saveData: boolean;
  coarsePointer: boolean;
  smallViewport: boolean;
  recommended: "immersive" | "classic";
  /**
   * Rendering tier to start at. Decided from static hints BEFORE the first
   * frame, deliberately: changing quality once the scene is on screen strips
   * clouds, surface relief and station detail in full view, which reads as the
   * page breaking. Better to pick once, up front, and never move.
   */
  recommendedQuality: "high" | "low";
}

interface NavigatorExtras {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
}

/** Probe WebGL support by actually creating a test canvas. */
function probeWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const ctx =
      canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    // Release context resource before discarding the canvas
    const ext = ctx as WebGLRenderingContext | null;
    if (ext) {
      const loseCtx = ext.getExtension("WEBGL_lose_context");
      loseCtx?.loseContext();
    }
    return ctx !== null;
  } catch {
    return false;
  }
}

/**
 * Run all capability checks and return a report with a recommended mode.
 * Call this only on the client (inside useEffect / event handlers).
 */
export function detectCapability(): CapabilityReport {
  const nav = navigator as Navigator & NavigatorExtras;

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  const hasWebGL = probeWebGL();

  const cores: number | undefined =
    typeof navigator.hardwareConcurrency === "number"
      ? navigator.hardwareConcurrency
      : undefined;

  const memory: number | undefined =
    typeof nav.deviceMemory === "number" ? nav.deviceMemory : undefined;

  const saveData: boolean = nav.connection?.saveData === true;

  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const smallViewport = window.innerWidth < 768;

  // Decision rules in priority order:
  // 1. prefers-reduced-motion → classic (hard accessibility rule)
  // 2. No WebGL → classic
  // 3. Save-data → classic
  // 4. Weak hardware (cores ≤ 4 when defined, OR memory ≤ 4 when defined) → classic
  // 5. Small viewport + coarse pointer (phone) → classic
  // 6. Otherwise → immersive
  let recommended: "immersive" | "classic";

  if (prefersReducedMotion) {
    recommended = "classic";
  } else if (!hasWebGL) {
    recommended = "classic";
  } else if (saveData) {
    recommended = "classic";
  } else if (
    (cores !== undefined && cores <= 4) ||
    (memory !== undefined && memory <= 4)
  ) {
    recommended = "classic";
  } else if (smallViewport && coarsePointer) {
    recommended = "classic";
  } else {
    recommended = "immersive";
  }

  // Quality tier, decided here so it never changes mid-session. Only clearly
  // modest hardware starts low; anything else gets the full-detail scene and
  // keeps it.
  const modestHardware =
    (cores !== undefined && cores <= 6) ||
    (memory !== undefined && memory <= 4) ||
    (smallViewport && coarsePointer);

  const recommendedQuality: "high" | "low" = modestHardware ? "low" : "high";

  return {
    prefersReducedMotion,
    hasWebGL,
    cores,
    memory,
    saveData,
    coarsePointer,
    smallViewport,
    recommended,
    recommendedQuality,
  };
}

// ---------------------------------------------------------------------------
// localStorage persistence helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = "nap:view-mode";

/** Read the user's explicitly saved view-mode preference, or null if none. */
export function readSavedMode(): "immersive" | "classic" | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "immersive" || raw === "classic") return raw;
    return null;
  } catch {
    return null;
  }
}

/** Persist the user's explicit view-mode choice to localStorage. */
export function saveMode(mode: "immersive" | "classic"): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Private-browsing / storage disabled — fail silently.
  }
}
