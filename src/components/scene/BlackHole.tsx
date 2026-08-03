"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { DESTINATIONS } from "@/lib/destinations";
import { useSiteStore } from "@/lib/store";
import { sceneTime } from "@/lib/sceneTime";
import { NOISE_OCTAVES } from "./shaders/lib";
import { BILLBOARD_FRAGMENT, BILLBOARD_VERTEX } from "./BlackHoleShaders";

type Uniforms = { [key: string]: THREE.IUniform };

/** Reactive prefers-reduced-motion flag (client-only, SSR-safe default). */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

/**
 * The Void — a black event horizon wrapped in a shader-driven accretion disk
 * modelled on the Interstellar "Gargantua" black hole.
 *
 * All the glowing structure is painted on one camera-facing (billboarded) quad,
 * so gravitational lensing can be authored directly in screen space: a bright
 * arc bends over the top of the shadow and a fainter one under the bottom, both
 * sweeping down to meet the horizontal disk at the sides. The disk carries a
 * white-hot-to-accent temperature ramp, Keplerian-sheared dust lanes, a
 * razor-thin photon ring, and doppler beaming so the limb rushing toward the
 * camera is brighter and blue-shifted. Doing the lensing in 2D avoids the
 * edge-on collapse a second 3D disk suffers, and is far cheaper than ray
 * marching.
 *
 * Interaction contract matches Planet: hover scales and shows a pointer cursor,
 * click flies here, and the cursor is always restored on unmount.
 */
export function BlackHole() {
  const dest = DESTINATIONS["black-hole"];
  const quality = useSiteStore((s) => s.quality);
  const flyTo = useSiteStore((s) => s.flyTo);
  const active = useSiteStore((s) => s.destination === "black-hole");
  const reduced = usePrefersReducedMotion();

  const groupRef = useRef<THREE.Group>(null);
  const billboardRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const low = quality === "low";
  const horizonSeg = low ? 24 : 48;
  const octaves = low ? NOISE_OCTAVES.low : NOISE_OCTAVES.high;

  const r = dest.radius;
  // The visible disk stays inside visualRadius (= r * 2.4) so the docked ship
  // never parks inside the geometry. The billboard quad is a little larger; its
  // corners fall outside the disk and are discarded in the fragment shader.
  const diskOuter = r * 2.2;
  const half = r * 2.35;

  // The uniform object is created once and handed to the material; three.js
  // owns it after that. Per-frame updates go through the material ref so nothing
  // mutates a memoized value during render.
  const diskMatRef = useRef<THREE.ShaderMaterial>(null);

  const diskUniforms = useMemo<Uniforms>(
    () => ({
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(dest.color) },
      // Shadow radius and disk extent in the quad's local units.
      uShadow: { value: r },
      uDiskOuter: { value: diskOuter },
      // Arc geometry, in units of the shadow radius: apex just above the photon
      // ring, feet meeting the disk at +/- uArcWidth.
      uArcApex: { value: 1.18 },
      uArcWidth: { value: 2.0 },
      uThickness: { value: 0.16 },
      uBeaming: { value: 0.6 },
      uPhoton: { value: 2.6 },
      uOpacity: { value: 1 },
      uOctaves: { value: NOISE_OCTAVES.high },
      uLow: { value: 0 },
    }),
    [dest, r, diskOuter],
  );

  // Track the runtime-adjustable quality tier: the octave budget plus the
  // low-tier flag that drops the priciest noise layer in the shader.
  useEffect(() => {
    const m = diskMatRef.current;
    if (!m) return;
    m.uniforms.uOctaves.value = octaves;
    m.uniforms.uLow.value = low ? 1 : 0;
  }, [octaves, low]);

  // Always restore the cursor if we unmount mid-hover.
  useEffect(() => {
    return () => {
      document.body.style.cursor = "";
    };
  }, []);

  useFrame((state, delta) => {
    const mat = diskMatRef.current;

    // Advance the disk animation unless reduced motion asked us to hold still.
    if (mat && !reduced) {
      mat.uniforms.uTime.value = sceneTime();
    }

    // Billboard the disk: keep the quad square-on to the camera every frame so
    // the lensed silhouette never turns edge-on. copy() mutates in place, so
    // there is no per-frame allocation.
    const bb = billboardRef.current;
    if (bb) bb.quaternion.copy(state.camera.quaternion);

    // Brighten the photon ring on hover / when this is the active destination.
    if (mat) {
      const target = active ? 4.2 : hovered ? 3.4 : 2.6;
      mat.uniforms.uPhoton.value = THREE.MathUtils.damp(
        mat.uniforms.uPhoton.value as number,
        target,
        6,
        delta,
      );
    }

    const g = groupRef.current;
    if (g) {
      const target = hovered ? 1.1 : 1;
      g.scale.setScalar(THREE.MathUtils.damp(g.scale.x, target, 6, delta));
    }
  });

  return (
    <group ref={groupRef} position={dest.position}>
      {/* Invisible interaction proxy — one stable hit target over the disk. */}
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHovered(false);
          document.body.style.cursor = "";
        }}
        onClick={(e) => {
          e.stopPropagation();
          flyTo("black-hole");
        }}
      >
        <sphereGeometry args={[diskOuter, 16, 16]} />
        <meshBasicMaterial colorWrite={false} depthWrite={false} />
      </mesh>

      {/* Event horizon — genuinely black, so it reads as an absence. */}
      <mesh renderOrder={0}>
        <sphereGeometry args={[r, horizonSeg, horizonSeg]} />
        <meshBasicMaterial color="#000000" toneMapped={false} />
      </mesh>

      {/* Accretion disk, lensed arcs and photon ring, all painted on one
          camera-facing quad. Additive + no depth write so the layers sum into
          glow; the hot core and photon ring exceed 1.0 to drive the bloom.
          Rendered after the horizon sphere, which fills the shadow with black
          and depth-culls the quad's interior, so only the disk, the over/under
          arcs and the ring survive. */}
      <mesh ref={billboardRef} renderOrder={2}>
        <planeGeometry args={[half * 2.0, half * 2.0]} />
        <shaderMaterial
          ref={diskMatRef}
          vertexShader={BILLBOARD_VERTEX}
          fragmentShader={BILLBOARD_FRAGMENT}
          uniforms={diskUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      {/* Label. No `occlude` — drei implements it with a per-frame raycast
          against the scene, which costs more than it is worth for a small
          label that reads fine drawn on top. */}
      <Html
        position={[0, r * 1.8, 0]}
        center
        distanceFactor={16}
        pointerEvents="none"
      >
        <div
          style={{
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 12,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            userSelect: "none",
            color: dest.color,
            textShadow: `0 0 10px ${dest.color}80`,
            opacity: hovered || active ? 1 : 0.8,
            transition: "opacity 150ms ease",
          }}
        >
          {dest.label}
        </div>
      </Html>
    </group>
  );
}
