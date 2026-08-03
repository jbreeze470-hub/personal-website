"use client";

/**
 * Shared, framework-free helpers for the crafted look of the ship and station:
 * a deterministic PRNG, a surface-profile radius sampler, and a MeshStandard
 * material that draws procedural panel lines + per-plate surface variation via
 * `onBeforeCompile`. Kept in a `Ship*`-named module so both `Ship.tsx` and
 * `Station.tsx` can reuse one implementation without duplicating the GLSL.
 *
 * Nothing here uses React or allocates inside a render loop; callers build these
 * once inside `useMemo` and dispose the returned materials on unmount.
 */

import * as THREE from "three";

export type Rng = () => number;

/**
 * mulberry32 — a tiny deterministic PRNG. Seeded so greeble/light scatter is
 * stable across renders; `Math.random()` during render is impure and the React
 * Compiler rejects it.
 */
export function makeRng(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Sample the radius of a lathe profile (`[radius, axialCoord]` pairs, ordered
 * from high axial coord to low) at an arbitrary axial coordinate. Used to sit
 * greebles and running lights on the true hull surface.
 */
export function profileRadiusAt(
  profile: readonly (readonly [number, number])[],
  coord: number,
): number {
  const first = profile[0];
  const last = profile[profile.length - 1];
  if (coord >= first[1]) return first[0];
  if (coord <= last[1]) return last[0];
  for (let i = 0; i < profile.length - 1; i++) {
    const [r0, h0] = profile[i];
    const [r1, h1] = profile[i + 1];
    if (coord <= h0 && coord >= h1) {
      const span = h1 - h0;
      const t = span === 0 ? 0 : (coord - h0) / span;
      return r0 + (r1 - r0) * t;
    }
  }
  return last[0];
}

export interface PanelMaterialOptions {
  color: THREE.ColorRepresentation;
  metalness?: number;
  roughness?: number;
  emissive?: THREE.ColorRepresentation;
  emissiveIntensity?: number;
  /** Longitudinal seam count (lines around the hull). */
  uLines?: number;
  /** Latitudinal seam count (lines along the hull). */
  vLines?: number;
  /** How dark the recessed seams get, 0..1. */
  seamStrength?: number;
  /** Per-plate brightness spread, 0..1. */
  plateStrength?: number;
  /** Seam half-width in UV space. */
  lineWidth?: number;
  /** Pattern seed so neighbouring parts don't share plate noise. */
  seed?: number;
}

/**
 * A dark-metal `MeshStandardMaterial` that keeps full scene lighting but adds a
 * grid of recessed panel-line seams plus subtle per-plate brightness/roughness
 * variation — the reference's "plated hull" in a single draw call, no textures.
 * The pattern is injected once at compile time; there are no per-frame uniforms.
 */
export function createPanelMaterial(
  opts: PanelMaterialOptions,
): THREE.MeshStandardMaterial {
  const {
    color,
    metalness = 0.9,
    roughness = 0.4,
    emissive = 0x000000,
    emissiveIntensity = 1,
    uLines = 8,
    vLines = 14,
    seamStrength = 0.55,
    plateStrength = 0.14,
    lineWidth = 0.035,
    seed = 0,
  } = opts;

  const mat = new THREE.MeshStandardMaterial({
    color,
    metalness,
    roughness,
    emissive,
    emissiveIntensity,
  });

  // Force the generic uv varying so `vUv` exists without needing a texture map.
  mat.defines = { ...(mat.defines ?? {}), USE_UV: "" };

  const uc = uLines.toFixed(1);
  const vc = vLines.toFixed(1);
  const lw = lineWidth.toFixed(4);
  const ss = seamStrength.toFixed(4);
  const ps = plateStrength.toFixed(4);
  const sd = seed.toFixed(1);

  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <roughnessmap_fragment>",
      `#include <roughnessmap_fragment>
      {
        float _uc = ${uc};
        float _vc = ${vc};
        float _fu = fract(vUv.x * _uc);
        float _fv = fract(vUv.y * _vc);
        float _du = min(_fu, 1.0 - _fu);
        float _dv = min(_fv, 1.0 - _fv);
        float _seam = smoothstep(${lw}, 0.0, min(_du, _dv));
        float _cu = floor(vUv.x * _uc);
        float _cv = floor(vUv.y * _vc);
        float _rnd = fract(sin(dot(vec2(_cu, _cv) + ${sd}, vec2(12.9898, 78.233))) * 43758.5453);
        diffuseColor.rgb *= (1.0 - ${ss} * _seam);
        diffuseColor.rgb *= (1.0 + (_rnd - 0.5) * ${ps});
        roughnessFactor = clamp(roughnessFactor * (0.82 + _rnd * 0.36) + _seam * 0.28, 0.03, 1.0);
      }`,
    );
  };

  // Unique cache key per pattern so three doesn't reuse another panel material's
  // compiled program for a different seam/plate configuration.
  mat.customProgramCacheKey = () => `panel:${uc}:${vc}:${lw}:${ss}:${ps}:${sd}`;

  return mat;
}

/** Anything with a `dispose()` — geometries, materials, instanced meshes. */
export interface Disposable {
  dispose(): void;
}
