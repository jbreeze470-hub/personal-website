"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { EARTH } from "@/lib/destinations";
import { useSiteStore } from "@/lib/store";
import { sceneTime } from "@/lib/sceneTime";
import { NOISE_OCTAVES, SPHERE_SEGMENTS } from "./shaders/lib";
import {
  ATMOSPHERE_COLOR,
  ATMOSPHERE_RADIUS_SCALE,
  CLOUD_RADIUS_SCALE,
  CLOUD_SPIN_SPEED,
  EARTH_ATMOSPHERE_FRAGMENT,
  EARTH_ATMOSPHERE_VERTEX,
  EARTH_CLOUD_FRAGMENT,
  EARTH_SPIN_SPEED,
  EARTH_SURFACE_FRAGMENT,
  EARTH_SURFACE_VERTEX,
  SUN_DIRECTION,
} from "./EarthShaders";

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

/** A normalized sun-direction vector, cloned per material so nothing shares it. */
function sunDirectionUniform() {
  return new THREE.Vector3(
    SUN_DIRECTION[0],
    SUN_DIRECTION[1],
    SUN_DIRECTION[2],
  ).normalize();
}

/**
 * Cloud shell — a slightly larger transparent sphere. Only mounted at high
 * quality; dropped entirely on low so weak GPUs skip the extra fbm pass.
 */
function EarthClouds({ reduced }: { reduced: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);

  // Created once and handed to the material; three.js owns it after that.
  // Per-frame updates go through `matRef` so nothing mutates a memoized value
  // during render.
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSunDirection: { value: sunDirectionUniform() },
      uOctaves: { value: NOISE_OCTAVES.high },
    }),
    [],
  );

  useFrame(() => {
    if (reduced) return;
    const t = sceneTime();
    const m = matRef.current;
    if (m) m.uniforms.uTime.value = t;
    if (meshRef.current) meshRef.current.rotation.y = t * CLOUD_SPIN_SPEED;
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry
        args={[
          EARTH.radius * CLOUD_RADIUS_SCALE,
          SPHERE_SEGMENTS.high,
          SPHERE_SEGMENTS.high,
        ]}
      />
      <shaderMaterial
        ref={matRef}
        vertexShader={EARTH_SURFACE_VERTEX}
        fragmentShader={EARTH_CLOUD_FRAGMENT}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

/**
 * Atmosphere — a wider BackSide additive shell whose fresnel rim glows at the
 * limb. Static (no animation), so it needs no frame loop.
 */
function EarthAtmosphere({ segments }: { segments: number }) {
  const uniforms = useMemo(
    () => ({
      uSunDirection: { value: sunDirectionUniform() },
      uColor: {
        value: new THREE.Color(
          ATMOSPHERE_COLOR[0],
          ATMOSPHERE_COLOR[1],
          ATMOSPHERE_COLOR[2],
        ),
      },
    }),
    [],
  );

  return (
    <mesh scale={ATMOSPHERE_RADIUS_SCALE}>
      <sphereGeometry args={[EARTH.radius, segments, segments]} />
      <shaderMaterial
        vertexShader={EARTH_ATMOSPHERE_VERTEX}
        fragmentShader={EARTH_ATMOSPHERE_FRAGMENT}
        uniforms={uniforms}
        transparent
        side={THREE.BackSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

/**
 * Earth — scenery below the station. Not clickable, not a destination.
 *
 * Shader-driven planet in three stacked shells:
 *  - surface: procedural continents/ocean, terrain colour, ice caps, a soft
 *    day/night terminator and night-side city lights;
 *  - clouds: a drifting transparent fbm layer (high quality only);
 *  - atmosphere: an additive fresnel rim glow.
 *
 * Quality tiering: low drops the cloud layer, shrinks the geometry segment
 * count, reduces noise octaves and disables the city lights.
 */
export function Earth() {
  const quality = useSiteStore((s) => s.quality);
  const reduced = usePrefersReducedMotion();
  const meshRef = useRef<THREE.Mesh>(null);

  const isLow = quality === "low";
  const segments = isLow ? SPHERE_SEGMENTS.low : SPHERE_SEGMENTS.high;
  const octaves = isLow ? NOISE_OCTAVES.low : NOISE_OCTAVES.high;

  // Created once and handed to the material; three.js owns it after that.
  // Per-frame and quality updates go through `matRef` so nothing mutates a
  // memoized value during render.
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSunDirection: { value: sunDirectionUniform() },
      uOctaves: { value: NOISE_OCTAVES.high as number },
      uNightLights: { value: 1 },
      uBump: { value: 1 },
    }),
    [],
  );

  // React to runtime quality changes (the FPS sampler can downgrade quality).
  useEffect(() => {
    const m = matRef.current;
    if (!m) return;
    m.uniforms.uOctaves.value = octaves;
    m.uniforms.uNightLights.value = isLow ? 0 : 1;
    m.uniforms.uBump.value = isLow ? 0 : 1;
  }, [octaves, isLow]);

  useFrame(() => {
    if (reduced) return;
    const t = sceneTime();
    const m = matRef.current;
    if (m) m.uniforms.uTime.value = t;
    if (meshRef.current) meshRef.current.rotation.y = t * EARTH_SPIN_SPEED;
  });

  return (
    // Axial tilt: 23.5 degrees, as Earth actually has. It also swings the polar
    // ice cap away from the camera so the visible face shows continents and
    // ocean rather than a flat white pole.
    <group position={EARTH.position} rotation={[-0.41, 0, 0.22]}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[EARTH.radius, segments, segments]} />
        <shaderMaterial
          ref={matRef}
          vertexShader={EARTH_SURFACE_VERTEX}
          fragmentShader={EARTH_SURFACE_FRAGMENT}
          uniforms={uniforms}
          toneMapped={false}
        />
      </mesh>

      {!isLow && <EarthClouds reduced={reduced} />}

      <EarthAtmosphere segments={segments} />
    </group>
  );
}
