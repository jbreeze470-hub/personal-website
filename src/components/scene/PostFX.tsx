"use client";

import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { useSiteStore } from "@/lib/store";

/**
 * PostFX — postprocessing stack for the 3D space scene.
 * Only mounts when quality === "high" to avoid GPU cost on weak devices.
 * Place this as the last child in the R3F scene tree (handled by orchestrator).
 */
export function PostFX() {
  const quality = useSiteStore((s) => s.quality);

  // Zero overhead on low-tier devices — return nothing, no composer created.
  if (quality !== "high") return null;

  return (
    /**
     * multisampling={0}: Disabled because Bloom reads from a luminance pass
     * (not the MSAA resolve buffer). MSAA + postprocessing double-buffers
     * cause a noticeable shimmer; disabling it is the standard recommendation
     * for any postprocessing-heavy pipeline with @react-three/postprocessing.
     */
    <EffectComposer multisampling={0}>
      <Bloom
        // Only pixels brighter than ~1.0 (above display range) bloom.
        // 0.95 keeps the glow on genuinely hot elements — engine cores, the
        // photon ring, the inner accretion disk — without hazing the planets.
        luminanceThreshold={0.95}
        // Gentle rolloff so the bloom border isn't a hard cut.
        luminanceSmoothing={0.3}
        // Restrained: over a dark starfield a high intensity turns every
        // bright object into a washed-out blob.
        intensity={1.05}
        // Mipmap blur gives a naturally-shaped falloff and is cheap, but each
        // level halves the resolution it blurs at — the default (8) smears the
        // black hole's glow across most of the viewport as a smoky haze. Four
        // levels with a tight radius keeps the glow hugging its source.
        mipmapBlur
        levels={4}
        radius={0.55}
      />
      {/*
        No Vignette. A vignette works by darkening toward the frame edges,
        which is invisible over busy imagery but reads as a large grey disc
        over a uniform starfield — there is no detail to hide the gradient.
      */}
    </EffectComposer>
  );
}
