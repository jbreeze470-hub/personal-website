"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useSiteStore } from "@/lib/store";
import { saveMode } from "@/lib/capability";

/** Settle time after compilation before frames start counting. */
const WARMUP_SECONDS = 1.0;
const SAMPLE_WINDOW_SECONDS = 2.5;
/**
 * Only bail when the scene is genuinely unusable — a slideshow, not merely
 * below 60fps.
 */
const FPS_UNUSABLE = 14;

/**
 * Runtime FPS safety net — mounts inside the R3F <Canvas>.
 *
 * Deliberately narrow in scope. It does NOT lower the quality tier: that is
 * chosen once from hardware hints in CapabilityGate, before the first frame.
 * Dropping quality at runtime strips clouds, surface relief and station detail
 * while the user is looking at them, which reads as the page breaking — and it
 * misfired on hardware that renders the full scene perfectly well.
 *
 * All this does is catch the case where 3D is hopeless on this device and fall
 * back to the classic 2D view, which is a clean experience rather than a
 * half-broken one.
 *
 * Renders no visual output.
 */
export function FpsSampler() {
  const setMode = useSiteStore((s) => s.setMode);

  const elapsed = useRef(0);
  const sampleElapsed = useRef(0);
  const frameCount = useRef(0);
  const done = useRef(false);

  useFrame((_state, delta) => {
    if (done.current) return;

    // Do not measure until every shader is linked. Compilation stalls frames,
    // and counting through it makes capable machines look slow.
    if (!useSiteStore.getState().shadersCompiled) return;

    // Warm-up — let the first post-compile frames settle.
    if (elapsed.current < WARMUP_SECONDS) {
      elapsed.current += delta;
      return;
    }

    // Ignore single huge hitches (tab switch, GC pause) that would otherwise
    // poison the average.
    if (delta < 0.5) {
      sampleElapsed.current += delta;
      frameCount.current += 1;
    }

    if (sampleElapsed.current < SAMPLE_WINDOW_SECONDS) return;

    done.current = true;
    const avgFps = frameCount.current / sampleElapsed.current;

    if (avgFps >= FPS_UNUSABLE) return;

    // Respect an explicit choice: if the user asked for 3D, leave them in it
    // rather than overriding them. They have the toggle.
    if (useSiteStore.getState().modeLocked) return;

    // Auto-selected immersive on hardware that cannot sustain it. Persist so
    // future loads do not flash 3D and snap back.
    setMode("classic");
    saveMode("classic");
  });

  return null;
}
