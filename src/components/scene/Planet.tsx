"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { DESTINATIONS } from "@/lib/destinations";
import { useSiteStore } from "@/lib/store";
import type { DestinationId } from "@/lib/types";
import {
  GLSL_BUMP,
  GLSL_FRESNEL,
  GLSL_LIB,
  NOISE_OCTAVES,
  SPHERE_SEGMENTS,
} from "./shaders/lib";

type Uniforms = { [key: string]: THREE.IUniform };

/**
 * World-space direction toward the scene key light. Mirrors the "distant sun"
 * directional light in SceneLighting (position [7, 8, 16]) so each planet's
 * day/night terminator lines up with the rest of the scene.
 */
const LIGHT_DIR = new THREE.Vector3(7, 8, 16).normalize();

/** Shared vertex stage for the planet bodies and the atmosphere shell. */
const SPHERE_VERTEX = /* glsl */ `
varying vec3 vLocalPos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec3 vViewDir;

void main() {
  vLocalPos = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vViewDir = cameraPosition - wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

/** Vertex stage for the ring: also carries the planet centre for shading. */
const RING_VERTEX = /* glsl */ `
varying vec3 vLocalPos;
varying vec3 vWorldPos;
varying vec3 vCenter;

void main() {
  vLocalPos = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vCenter = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

/**
 * stock-predictor — a banded gas giant. Belts and zones are domain-warped so
 * the seams churn and swirl into each other, several storm ovals rotate with
 * the flow, and bands at different latitudes drift at different speeds.
 */
const GAS_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
uniform vec3 uLightDir;
uniform int uOctaves;
uniform float uHighlight;

varying vec3 vLocalPos;
varying vec3 vWorldNormal;
varying vec3 vViewDir;

${GLSL_LIB}

// One rotating storm oval centred at (lonC, latC); soft-edged mask in [0,1].
float stormOval(float lat, float lon, float lonC, float latC, float rx, float ry) {
  vec2 d = vec2(lon - lonC, lat - latC);
  d.x = mod(d.x + 3.14159265, 6.2831853) - 3.14159265;   // wrap longitude
  d.x /= rx;
  d.y /= ry;
  return 1.0 - smoothstep(0.55, 1.0, length(d));
}

void main() {
  vec3 dir = normalize(vLocalPos);
  float lat = clamp(dir.y, -0.999, 0.999);
  float absLat = abs(lat);

  // Differential rotation: equatorial bands drift faster than the poles, so
  // storms and seams shear past one another over time.
  float drift = mix(uTime * 0.05, uTime * 0.11, 1.0 - absLat);
  vec3 sdir = dir;
  sdir.xz = rot2(drift) * sdir.xz;
  float lon = atan(sdir.z, sdir.x);

  // Domain-warped turbulence: feeding noise back into itself makes the belt
  // boundaries churn and curl rather than sit in clean stripes.
  vec3 wp = vec3(sdir.x * 1.3, lat * 4.5, sdir.z * 1.3);
  float churn = warpedFbm(wp + vec3(uTime * 0.03, 0.0, 0.0), uOctaves);

  // Latitude banding, displaced hard by the churn for turbulent seams.
  float bandCoord = lat * 11.0 + (churn - 0.5) * 6.0;
  float bands = 0.5 + 0.5 * sin(bandCoord);
  bands = mix(bands, smoothstep(0.2, 0.8, bands), 0.5);   // sharpen belt edges

  // Rusty belts vs pale cream zones, tinted by the accent colour.
  vec3 belt = mix(uColor, vec3(0.42, 0.22, 0.12), 0.55);
  vec3 zone = mix(uColor, vec3(0.92, 0.87, 0.74), 0.6);
  vec3 albedo = mix(belt, zone, bands);

  // Ridged filaments stretched along the bands add wind-shear streaks.
  float fila = ridged(vec3(sdir.x * 3.0, lat * 22.0, sdir.z * 3.0) + churn, uOctaves);
  albedo *= 0.85 + 0.22 * fila;

  // A few discrete storm ovals, carried around by the differential rotation.
  float s1 = stormOval(lat, lon, 1.4, -0.22, 0.55, 0.26);   // great red spot
  float s2 = stormOval(lat, lon, -2.0, 0.32, 0.34, 0.17);   // pale northern oval
  float s3 = stormOval(lat, lon, 0.3, 0.12, 0.22, 0.13);    // small vortex
  vec3 spot1 = mix(uColor, vec3(0.80, 0.34, 0.18), 0.7);
  vec3 spot2 = mix(uColor, vec3(0.93, 0.86, 0.70), 0.65);
  albedo = mix(albedo, spot1, s1 * 0.7);
  albedo = mix(albedo, spot2, s2 * 0.55);
  albedo = mix(albedo, spot2, s3 * 0.5);

  albedo = clamp(albedo, 0.0, 1.0);

  // Soft day/night terminator.
  vec3 N = normalize(vWorldNormal);
  float ndl = dot(N, normalize(uLightDir));
  float day = smoothstep(-0.2, 0.4, ndl);
  vec3 lit = clamp(albedo * (0.05 + 0.90 * day), 0.0, 1.0);

  // Fresnel limb — thin, brighter on the lit side and when highlighted (blooms).
  float f = fresnel(vViewDir, N, 3.0);
  vec3 rimCol = mix(uColor, vec3(0.9, 0.95, 1.0), 0.4);
  lit += rimCol * f * (0.5 + 1.0 * day + 1.3 * uHighlight);

  gl_FragColor = vec4(lit, 1.0);
}
`;

/**
 * blackprint — a terrestrial world pushed hard toward real geology. Continents
 * come from warped fbm (eroded coastlines) and ridged mountain chains; the land
 * is pitted with impact craters at several scales; a relief normal from the
 * height field (perturbNormal) makes crater rims catch the light and floors
 * fall into shadow; young craters throw out bright ejecta ray systems; and the
 * surface mixes several palettes (green, ochre, rust, pale rock, dark basalt).
 */
const TERRA_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
uniform vec3 uLightDir;
uniform int uOctaves;
uniform float uHighlight;
uniform float uBump;

varying vec3 vLocalPos;
varying vec3 vWorldNormal;
varying vec3 vViewDir;

${GLSL_LIB}

const float SEA = 0.50;

// Continent elevation: warped fbm carves eroded coastlines, ridged builds the
// mountain chains that run along them.
float landElevation(vec3 p) {
  float base = warpedFbm(p * 1.7 + vec3(11.0, 3.0, 7.0), uOctaves);
  float ranges = ridged(p * 3.1 + vec3(5.0, 1.0, 9.0), uOctaves);
  return base * 0.90 + ranges * 0.30;
}

// Surface height driving both the relief normal and the colour decisions.
//
// No impact craters here on purpose: this world has oceans and an atmosphere,
// and both erase craters over time. Cratering belongs on an airless body — on
// a living world it just reads as mud.
float heightAt(vec3 p) {
  float e = landElevation(p);
  float land = smoothstep(SEA, SEA + 0.04, e);
  // Fine ridged detail sharpens ridgelines and valleys on land only.
  float relief = (ridged(p * 7.0, uOctaves) - 0.4) * 0.22;
  // Oceans flatten to sea level so only land carries relief.
  return mix(SEA + 0.02, e + relief, land);
}

${GLSL_BUMP}

void main() {
  vec3 dir = normalize(vLocalPos);

  // Slow spin handled by rotating the sample point; the relief normal is rotated
  // back into world space so the terminator stays fixed while the land turns.
  float ang = uTime * 0.03;
  vec3 sp = dir;
  sp.xz = rot2(ang) * sp.xz;

  // Relief-aware normal, gated to the high tier via a uniform branch so it
  // stays coherent. perturbNormal samples heightAt several extra times.
  vec3 Nw = dir;
  if (uBump > 0.5) {
    vec3 Np = perturbNormal(sp, sp, 0.38, 0.0025);
    Np.xz = rot2(-ang) * Np.xz;
    Nw = normalize(Np);
  }

  // --- Terrain channels -------------------------------------------------
  float elev = landElevation(sp);
  float landMask = smoothstep(SEA, SEA + 0.025, elev);
  float latAbs = abs(dir.y);
  float moisture = warpedFbm(sp * 2.1 + vec3(19.0, 2.0, 5.0), uOctaves);

  // --- Ocean: abyssal depths grading up to bright tropical shelves ------
  float shelf = smoothstep(SEA - 0.09, SEA, elev);
  vec3 abyss     = vec3(0.008, 0.035, 0.105);
  vec3 openOcean = vec3(0.020, 0.105, 0.260);
  vec3 shallow   = vec3(0.075, 0.330, 0.470);
  vec3 ocean = mix(abyss, openOcean, smoothstep(0.14, SEA, elev));
  ocean = mix(ocean, shallow, shelf * shelf);

  // --- Land: biomes by latitude, moisture and elevation -----------------
  vec3 tropics  = vec3(0.09, 0.30, 0.10);
  vec3 temperate= vec3(0.16, 0.34, 0.14);
  vec3 steppe   = vec3(0.44, 0.42, 0.21);
  vec3 desert   = vec3(0.62, 0.50, 0.28);
  vec3 tundra   = vec3(0.36, 0.36, 0.32);
  vec3 rock     = vec3(0.44, 0.41, 0.38);

  // Dry belts sit either side of the equator, as on a real world.
  float aridBand = exp(-pow((latAbs - 0.32) * 4.4, 2.0));
  float dry = clamp(aridBand * 0.85 + (1.0 - moisture) * 0.5, 0.0, 1.0);

  vec3 green = mix(temperate, tropics, smoothstep(0.35, 0.0, latAbs));
  vec3 landCol = mix(green, mix(steppe, desert, dry), smoothstep(0.30, 0.72, dry));
  landCol = mix(landCol, tundra, smoothstep(0.52, 0.74, latAbs));

  // Exposed rock on the steepest, highest ground.
  float highland = smoothstep(SEA + 0.07, SEA + 0.19, elev);
  landCol = mix(landCol, rock, highland * 0.55);

  // Thin bright coastline where land meets water.
  float beach = smoothstep(SEA, SEA + 0.012, elev) * (1.0 - smoothstep(SEA + 0.012, SEA + 0.03, elev));
  landCol = mix(landCol, vec3(0.72, 0.66, 0.48), beach * 0.55);

  vec3 albedo = mix(ocean, landCol, landMask);

  // --- Polar caps + snow on the peaks -----------------------------------
  float capEdge = (vnoise(sp * 4.5 + 17.0) - 0.5) * 0.16;
  float cap = smoothstep(0.72, 0.84, latAbs + capEdge);
  float peaks = smoothstep(SEA + 0.21, SEA + 0.31, elev) * landMask;
  float snow = clamp(cap + peaks, 0.0, 1.0);
  albedo = mix(albedo, vec3(0.88, 0.91, 0.95), snow);

  albedo = clamp(albedo, 0.0, 1.0);

  // --- Lighting ---------------------------------------------------------
  vec3 L = normalize(uLightDir);
  vec3 V = normalize(vViewDir);
  float dayMask = smoothstep(-0.06, 0.18, dot(dir, L));   // broad terminator
  float shade = max(dot(Nw, L), 0.0);                     // relief self-shadow
  vec3 lit = albedo * (0.05 + 0.95 * shade) * (0.08 + 0.92 * dayMask);

  // Specular sun glint on water only — the single biggest cue that the blue
  // areas are liquid rather than painted.
  float water = 1.0 - landMask;
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(dir, H), 0.0), 90.0);
  lit += vec3(0.85, 0.94, 1.0) * spec * water * dayMask * 0.85 * (1.0 - snow);

  // Thin fresnel atmosphere rim, tinted toward the destination colour.
  float f = fresnel(vViewDir, dir, 3.6);
  vec3 atmo = mix(vec3(0.35, 0.6, 1.0), uColor, 0.35);
  lit += atmo * f * (0.22 + 0.75 * dayMask + 1.0 * uHighlight);

  gl_FragColor = vec4(lit, 1.0);
}
`;

/** blackprint atmosphere shell — additive fresnel halo (high quality only). */
const ATMO_FRAGMENT = /* glsl */ `
uniform vec3 uLightDir;

varying vec3 vLocalPos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec3 vViewDir;

${GLSL_FRESNEL}

void main() {
  vec3 N = normalize(vWorldNormal);
  // A high exponent keeps the haze pinned to the limb. At low exponents the
  // glow spreads across the whole disc and milks out the surface detail
  // underneath, which is the expensive part of this planet.
  float f = fresnel(vViewDir, N, 6.0);
  float day = smoothstep(-0.25, 0.5, dot(N, normalize(uLightDir)));
  vec3 col = mix(vec3(0.30, 0.55, 1.0), vec3(0.6, 0.85, 1.0), day);
  float a = f * (0.12 + 0.55 * day);
  gl_FragColor = vec4(col * (0.5 + 0.7 * day), a);
}
`;

/** Ring system — many fine ringlets, a Cassini division + secondary gaps,
 *  warm-dust-to-icy colour, and darkening where the disc passes into shadow. */
const RING_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uLightDir;
uniform float uInner;
uniform float uOuter;
uniform float uPlanetRadius;
uniform float uOpacity;
uniform int uOctaves;

varying vec3 vLocalPos;
varying vec3 vWorldPos;
varying vec3 vCenter;

${GLSL_LIB}

void main() {
  float r = length(vLocalPos.xy);
  float t = (r - uInner) / (uOuter - uInner);
  if (t < 0.0 || t > 1.0) discard;

  float ang = atan(vLocalPos.y, vLocalPos.x);

  // Multi-scale radial structure resolves into hundreds of fine ringlets.
  float n1 = fbm(vec3(t * 22.0, ang * 0.25, 3.1), uOctaves);
  float n2 = fbm(vec3(t * 90.0, ang * 0.12, 9.0), uOctaves);
  float ringlets = 0.5 + 0.5 * sin(t * 210.0 + n1 * 6.0);
  float density = (0.35 + 0.65 * n1) * (0.55 + 0.45 * n2) * (0.55 + 0.45 * ringlets);

  // A wide Cassini-style division plus two subtler secondary gaps.
  density *= smoothstep(0.015, 0.05, abs(t - 0.52));
  density *= 0.6 + 0.4 * smoothstep(0.010, 0.035, abs(t - 0.70));
  density *= 0.7 + 0.3 * smoothstep(0.008, 0.030, abs(t - 0.28));

  // Soft inner and outer edges.
  density *= smoothstep(0.0, 0.05, t) * smoothstep(0.0, 0.06, 1.0 - t);

  float alpha = clamp(density, 0.0, 1.0) * uOpacity;
  if (alpha < 0.01) discard;

  // Warm dust on the inner disc grading to icy on the outer disc.
  vec3 icy = mix(uColor, vec3(0.86, 0.90, 0.97), 0.6);
  vec3 dust = vec3(0.72, 0.60, 0.44);
  vec3 ringCol = mix(dust, icy, smoothstep(0.25, 0.75, t));
  ringCol *= 0.7 + 0.4 * n2;

  // Light-facing half brighter than the far half.
  vec3 L = normalize(uLightDir);
  vec3 toPoint = normalize(vWorldPos - vCenter);
  float facing = 0.4 + 0.6 * smoothstep(-0.7, 0.7, dot(toPoint, L));

  // Planet shadow cast across the ring on the anti-solar side.
  vec3 P = vWorldPos - vCenter;
  float along = dot(P, L);
  float shadow = 1.0;
  if (along < 0.0) {
    float perp = length(P - along * L);
    shadow = 0.2 + 0.8 * smoothstep(uPlanetRadius * 0.98, uPlanetRadius * 1.30, perp);
  }

  ringCol *= facing * shadow;

  gl_FragColor = vec4(ringCol, alpha);
}
`;

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
 * One project planet, positioned and coloured from DESTINATIONS[id] and
 * rendered with a bespoke shader so it reads as a real astronomical body.
 *
 * Visual distinction by id:
 *  - "stock-predictor": a banded gas giant with differential rotation, churning
 *    band seams and a gapped, noise-textured ring system.
 *  - "blackprint":      a terrestrial world — eroded continents, polar caps,
 *    drifting clouds and a thin fresnel atmosphere.
 *
 * Interaction (unchanged): hover scales it up + shows a pointer cursor, click
 * flies there. When it is the active destination it reads brighter (limb bloom).
 */
export function Planet({ id }: { id: DestinationId }) {
  const dest = DESTINATIONS[id];
  const quality = useSiteStore((s) => s.quality);
  const flyTo = useSiteStore((s) => s.flyTo);
  const active = useSiteStore((s) => s.destination === id);
  const reduced = usePrefersReducedMotion();

  const isGasGiant = id === "stock-predictor";
  const isLow = quality === "low";
  const segments = isLow ? SPHERE_SEGMENTS.low : SPHERE_SEGMENTS.high;
  const ringSegments = isLow ? 64 : 160;
  const octaves = isLow ? NOISE_OCTAVES.low : NOISE_OCTAVES.high;

  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  // Uniform objects are created once and handed to the materials; three.js owns
  // them after that. Per-frame updates go through the material refs so nothing
  // mutates a memoized value during render. useMemo is per instance, so the two
  // Planets never share objects.
  const coreMatRef = useRef<THREE.ShaderMaterial>(null);
  const ringMatRef = useRef<THREE.ShaderMaterial>(null);

  const coreUniforms = useMemo<Uniforms>(
    () => ({
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(dest.color) },
      uLightDir: { value: LIGHT_DIR.clone() },
      uOctaves: { value: NOISE_OCTAVES.high },
      uHighlight: { value: 0 },
      uBump: { value: 1 },
    }),
    [dest],
  );

  const ringUniforms = useMemo<Uniforms>(
    () => ({
      uColor: { value: new THREE.Color(dest.color) },
      uLightDir: { value: LIGHT_DIR.clone() },
      uInner: { value: dest.radius * 1.35 },
      uOuter: { value: dest.radius * 2.35 },
      uPlanetRadius: { value: dest.radius },
      uOpacity: { value: 0.9 },
      uOctaves: { value: NOISE_OCTAVES.high },
    }),
    [dest],
  );

  const atmosphereUniforms = useMemo<Uniforms>(
    () => ({
      uLightDir: { value: LIGHT_DIR.clone() },
    }),
    [],
  );

  // Keep the octave budget and relief gate in sync with the (runtime-adjustable)
  // quality tier. perturbNormal is high-tier only, driven by uBump.
  useEffect(() => {
    if (coreMatRef.current) {
      coreMatRef.current.uniforms.uOctaves.value = octaves;
      coreMatRef.current.uniforms.uBump.value = isLow ? 0 : 1;
    }
    if (ringMatRef.current) {
      ringMatRef.current.uniforms.uOctaves.value = octaves;
    }
  }, [octaves, isLow]);

  // Always restore the cursor if we unmount mid-hover.
  useEffect(() => {
    return () => {
      document.body.style.cursor = "";
    };
  }, []);

  useFrame((state, delta) => {
    const core = coreMatRef.current;
    if (core) {
      // Advance surface animation only when motion is allowed; visuals persist.
      if (!reduced) {
        core.uniforms.uTime.value = state.clock.elapsedTime;
      }

      // Smoothly drive the limb-glow highlight toward the interaction state.
      const highlightTarget = (active ? 1 : 0) + (hovered ? 0.5 : 0);
      core.uniforms.uHighlight.value = THREE.MathUtils.damp(
        core.uniforms.uHighlight.value as number,
        highlightTarget,
        6,
        delta,
      );
    }

    const g = groupRef.current;
    if (g) {
      const target = hovered ? 1.12 : 1;
      g.scale.setScalar(THREE.MathUtils.damp(g.scale.x, target, 6, delta));
    }
  });

  return (
    <group ref={groupRef} position={dest.position}>
      {/* Core body — also the interaction target. */}
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
          flyTo(id);
        }}
      >
        <sphereGeometry args={[dest.radius, segments, segments]} />
        <shaderMaterial
          ref={coreMatRef}
          vertexShader={SPHERE_VERTEX}
          fragmentShader={isGasGiant ? GAS_FRAGMENT : TERRA_FRAGMENT}
          uniforms={coreUniforms}
          toneMapped={false}
        />
      </mesh>

      {/* stock-predictor: gapped, noise-textured ring system. */}
      {isGasGiant && (
        <mesh rotation={[Math.PI / 2.4, 0, Math.PI / 7]} raycast={() => null}>
          <ringGeometry
            args={[dest.radius * 1.35, dest.radius * 2.35, ringSegments, 1]}
          />
          <shaderMaterial
            ref={ringMatRef}
            vertexShader={RING_VERTEX}
            fragmentShader={RING_FRAGMENT}
            uniforms={ringUniforms}
            transparent
            side={THREE.DoubleSide}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      )}

      {/* blackprint: additive fresnel atmosphere shell (high quality only). */}
      {!isGasGiant && !isLow && (
        <mesh raycast={() => null}>
          <sphereGeometry args={[dest.radius * 1.06, segments, segments]} />
          <shaderMaterial
            vertexShader={SPHERE_VERTEX}
            fragmentShader={ATMO_FRAGMENT}
            uniforms={atmosphereUniforms}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      )}

      {/* Active highlight ring */}
      {active && (
        <mesh rotation={[Math.PI / 2, 0, 0]} raycast={() => null}>
          <ringGeometry
            args={[dest.radius * 1.35, dest.radius * 1.45, 64]}
          />
          <meshBasicMaterial
            color={dest.color}
            transparent
            opacity={0.6}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      )}

      {/* Label. No `occlude` — drei implements it with a per-frame raycast
          against the scene, which costs more than it is worth for a small
          label that reads fine drawn on top. */}
      <Html
        position={[0, dest.radius + 0.9, 0]}
        center
        distanceFactor={14}
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
