"use client";

/**
 * Lighting rig for the space scene. Cheap and shadow-free so it stays smooth
 * on mid-range laptops: a low cool ambient fill, a bright cool "distant sun"
 * key light, a faint opposing rim, and a subtle cyan accent point light.
 *
 * (The R3F JSX intrinsics used here — <ambientLight> etc. — are provided by
 * @react-three/fiber's global module augmentation, imported by sibling scene
 * files in the same program.)
 */
export function SceneLighting() {
  return (
    <>
      {/* Cool ambient fill so nothing is pure black on the shadow side. */}
      <ambientLight intensity={0.34} color="#243352" />

      {/* Distant sun — the key light. No shadows (expensive on laptops).
          Biased toward the camera (+Z) so the hemisphere the viewer actually
          sees is lit: surface detail in shadow is detail nobody looks at.
          Still off-axis enough to keep a terminator and give the bodies form.
          MUST stay in sync with LIGHT_DIR in Planet.tsx and SUN_DIRECTION in
          EarthShaders.ts, or each planet's terminator disagrees with the rest
          of the scene. */}
      <directionalLight
        position={[7, 8, 16]}
        intensity={2.6}
        color="#eaf2ff"
      />

      {/* Faint rim from the opposite side to separate objects from the void. */}
      <directionalLight
        position={[-12, -4, -18]}
        intensity={0.4}
        color="#3b3a6b"
      />

      {/* Subtle cyan accent near the station keeps the palette on-brand. */}
      <pointLight
        position={[0, 2, 6]}
        intensity={12}
        distance={40}
        decay={2}
        color="#22d3ee"
      />
    </>
  );
}
