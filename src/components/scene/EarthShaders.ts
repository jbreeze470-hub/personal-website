"use client";

/**
 * GLSL sources and tuning constants for the Earth scenery object.
 *
 * Kept out of the React component so the shader text reads top-to-bottom.
 * The shared noise/lighting helpers in `./shaders/lib` are interpolated into
 * every fragment shader via `${GLSL_LIB}` — we never re-implement noise here.
 */

import { GLSL_BUMP, GLSL_LIB } from "./shaders/lib";

/**
 * World-space direction toward the "sun". Matches the scene key light
 * (`SceneLighting` directional light at [7, 8, 16]) so Earth's lit hemisphere
 * agrees with how every other object in the scene is lit.
 */
export const SUN_DIRECTION: readonly [number, number, number] = [7, 8, 16];

/** Additive atmosphere tint, authored directly in linear RGB. */
export const ATMOSPHERE_COLOR: readonly [number, number, number] = [
  0.25, 0.5, 1.0,
];

/** Clouds sit just above the surface; atmosphere is a thin rim shell.
 *  Keep the atmosphere shell tight — a thick shell reads as a painted blue
 *  band rather than a limb glow. */
export const CLOUD_RADIUS_SCALE = 1.012;
export const ATMOSPHERE_RADIUS_SCALE = 1.055;

/** Rotation rates (rad/s). Clouds drift slightly faster than the ground. */
export const EARTH_SPIN_SPEED = 0.025;
export const CLOUD_SPIN_SPEED = 0.035;

/**
 * Shared vertex stage for the surface and cloud shells.
 * - `vLocalPos`   local position → continent pattern is painted on the mesh
 *                 and rotates with it.
 * - `vWorldNormal` world normal (includes the mesh spin) → the day/night
 *                 terminator stays fixed in world space while land turns
 *                 through it.
 * - `vViewDir`    world-space view direction for specular + fresnel.
 * - `vM0/1/2`     columns of mat3(modelMatrix). The surface relief normal is
 *                 built in local space (the height field is local) then rotated
 *                 into world space with these — modelMatrix is vertex-only, so
 *                 the fragment shader must receive the rotation as varyings.
 */
export const EARTH_SURFACE_VERTEX = /* glsl */ `
varying vec3 vLocalPos;
varying vec3 vWorldNormal;
varying vec3 vViewDir;
varying vec3 vM0;
varying vec3 vM1;
varying vec3 vM2;

void main() {
  vLocalPos = position;
  mat3 m = mat3(modelMatrix);
  vM0 = m[0];
  vM1 = m[1];
  vM2 = m[2];
  vWorldNormal = normalize(m * normal);
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vViewDir = cameraPosition - worldPos.xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/**
 * Surface: continents from warped fbm (eroded coastlines), mountain relief lit
 * through a perturbNormal bump (high tier only), biome colour driven by
 * latitude + a moisture channel, ocean depth variation near coasts, noisy polar
 * ice caps, a soft day/night terminator, ocean vs land specular, and land-only
 * clustered city lights on the night side.
 */
export const EARTH_SURFACE_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform vec3 uSunDirection;
uniform int uOctaves;
uniform float uNightLights;
uniform float uBump;

varying vec3 vLocalPos;
varying vec3 vWorldNormal;
varying vec3 vViewDir;
varying vec3 vM0;
varying vec3 vM1;
varying vec3 vM2;

${GLSL_LIB}

// Continent elevation: warped fbm carves eroded coastlines, ridged builds ranges.
float landElevation(vec3 p) {
  float base = warpedFbm(p * 1.7 + vec3(3.1, 1.7, 8.2), uOctaves);
  float ranges = ridged(p * 3.4 + vec3(5.0, 2.0, 1.0), uOctaves);
  return base * 0.85 + ranges * 0.28;
}

// Height field for the relief normal. Oceans flatten to a constant sea level so
// only the land carries mountain relief.
float heightAt(vec3 p) {
  float e = landElevation(p);
  float land = smoothstep(0.50, 0.55, e);
  float mountains = (ridged(p * 5.0, uOctaves) - 0.4) * 0.5;
  float landH = e + mountains * land;
  return mix(0.52, landH, land);
}

${GLSL_BUMP}

void main() {
  vec3 dir = normalize(vLocalPos);
  mat3 modelRot = mat3(vM0, vM1, vM2);

  // Relief normal: perturb in local space (the height field is local), then
  // rotate into world space. High tier only — low falls back to the smooth
  // world normal so weak GPUs skip the extra heightAt evaluations.
  vec3 N;
  if (uBump > 0.5) {
    vec3 Nl = perturbNormal(dir, dir, 0.5, 0.0025);
    N = normalize(modelRot * Nl);
  } else {
    N = normalize(vWorldNormal);
  }
  vec3 V = normalize(vViewDir);
  vec3 L = normalize(uSunDirection);

  // --- Continents vs ocean ---------------------------------------------
  float continents = landElevation(dir);
  float landMask = smoothstep(0.50, 0.54, continents);
  float lat = abs(dir.y); // 0 at equator, 1 at the poles
  float moisture = warpedFbm(dir * 2.2 + vec3(21.0, 3.0, 7.0), uOctaves);

  // --- Ocean: abyssal deep -> shelf lightening near the coastline -------
  float shelf = smoothstep(0.44, 0.50, continents);
  vec3 deepC = vec3(0.008, 0.030, 0.095);
  vec3 midC = vec3(0.015, 0.075, 0.180);
  vec3 shelfC = vec3(0.045, 0.190, 0.290);
  vec3 ocean = mix(deepC, midC, smoothstep(0.15, 0.50, continents));
  ocean = mix(ocean, shelfC, shelf);

  // --- Land biomes by latitude + moisture, rock on high ground ----------
  float warm = 1.0 - smoothstep(0.12, 0.72, lat);
  vec3 forest = vec3(0.06, 0.20, 0.07);
  vec3 tropic = vec3(0.09, 0.30, 0.10);
  vec3 grass = vec3(0.30, 0.34, 0.13);
  vec3 desert = vec3(0.55, 0.44, 0.24);
  vec3 rock = vec3(0.30, 0.24, 0.17);
  vec3 tundra = vec3(0.45, 0.46, 0.42);

  vec3 veg = mix(forest, tropic, warm * moisture);
  veg = mix(veg, grass, (1.0 - moisture) * warm * 0.7);
  float aridBand = 1.0 - smoothstep(0.0, 0.22, abs(lat - 0.32));
  float arid = clamp(aridBand * (0.4 + 0.9 * (1.0 - moisture)), 0.0, 1.0);
  vec3 land = mix(veg, desert, arid);
  land = mix(land, rock, smoothstep(0.60, 0.78, continents));
  land = mix(land, tundra, smoothstep(0.55, 0.72, lat));

  vec3 surface = mix(ocean, land, landMask);

  // --- Polar ice caps with an irregular, noisy boundary ----------------
  float iceEdge = (vnoise(dir * 4.5 + 17.0) - 0.5) * 0.20;
  float ice = smoothstep(0.66, 0.80, lat + iceEdge);
  surface = mix(surface, vec3(0.82, 0.87, 0.93), ice);

  surface = saturateColor(surface, 1.08);

  // --- Lighting: relief normal shades mountains; the smooth normal keeps
  //     the terminator and night-lights stable ---------------------------
  float shade = max(dot(N, L), 0.0);
  float dayMask = smoothstep(-0.12, 0.16, dot(dir, L));
  vec3 color = surface * (0.02 + 0.98 * shade) * (0.06 + 0.94 * dayMask);

  // --- Specular: tight bright glint on ocean, broad + weak on land -----
  float oceanness = (1.0 - landMask) * (1.0 - ice);
  float specPow = mix(14.0, 110.0, oceanness);
  float specAmt = mix(0.05, 0.6, oceanness);
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), specPow) * specAmt * dayMask;
  // Faint animated shimmer so the sun-glint feels like moving water.
  spec *= 0.9 + 0.1 * vnoise(dir * 26.0 + vec3(0.0, uTime * 0.15, 0.0));
  color += spec * vec3(1.0, 0.96, 0.88);

  // --- Night-side city lights: land only, clustered by noise -----------
  float night = 1.0 - dayMask;
  if (uNightLights > 0.5 && night > 0.02) {
    float city = fbm(dir * 8.5 + vec3(41.0, 7.0, 19.0), uOctaves);
    float cityMask = smoothstep(0.60, 0.70, city) * landMask * (1.0 - ice);
    // Push above 1.0 so the selective-bloom pass picks the lights up.
    color += vec3(1.0, 0.72, 0.35) * cityMask * night * 2.4;
  }

  gl_FragColor = vec4(color, 1.0);
}
`;

/**
 * Clouds: a transparent fbm field on a slightly larger shell. Drifts via its
 * own mesh spin plus a slow in-shader swirl, and is lit by the same sun
 * direction so it darkens onto the night side.
 */
export const EARTH_CLOUD_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform vec3 uSunDirection;
uniform int uOctaves;

varying vec3 vLocalPos;
varying vec3 vWorldNormal;
varying vec3 vViewDir;

${GLSL_LIB}

void main() {
  vec3 dir = normalize(vLocalPos);
  vec3 N = normalize(vWorldNormal);
  vec3 L = normalize(uSunDirection);

  // Higher base frequency than the terrain: cloud cells should read as weather
  // systems, not continents. A second warped octave breaks up the banding.
  vec3 p = dir * 4.4;
  p.xz = rot2(uTime * 0.010) * p.xz;
  float coverage = fbm(p + vec3(uTime * 0.012, 0.0, uTime * 0.005), uOctaves);
  float wisps = fbm(p * 2.6 + vec3(0.0, uTime * 0.02, 0.0), uOctaves);
  coverage = coverage * 0.72 + wisps * 0.28;
  float clouds = smoothstep(0.46, 0.68, coverage);

  float day = smoothstep(-0.10, 0.24, dot(N, L));
  vec3 col = vec3(1.0) * (0.05 + 0.92 * day); // dark on the night side
  gl_FragColor = vec4(col, clouds * 0.82);
}
`;

/** Atmosphere vertex: only needs the world normal and view direction. */
export const EARTH_ATMOSPHERE_VERTEX = /* glsl */ `
varying vec3 vWorldNormal;
varying vec3 vViewDir;

void main() {
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vViewDir = cameraPosition - worldPos.xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/**
 * Atmosphere: a BackSide additive shell. `fresnel()` makes the glow strongest
 * at the limb, and it brightens on the sunlit side so the rim reads as a blue
 * crescent rather than a flat halo. The limb peak exceeds 1.0 to bloom.
 */
export const EARTH_ATMOSPHERE_FRAGMENT = /* glsl */ `
uniform vec3 uSunDirection;
uniform vec3 uColor;

varying vec3 vWorldNormal;
varying vec3 vViewDir;

${GLSL_LIB}

void main() {
  vec3 N = normalize(vWorldNormal);
  vec3 V = normalize(vViewDir);
  vec3 L = normalize(uSunDirection);

  // This shell renders BackSide, so the interpolated normal faces away from the
  // camera and dot(V, N) is negative across the visible ring. The shared
  // fresnel() clamps that to 1.0, which flattens the whole ring to full
  // brightness — a hard blue band. Using |dot| restores the gradient: 0 at the
  // centre of the disc, 1 exactly at the limb.
  float ndv = abs(dot(V, N));
  float rim = pow(1.0 - ndv, 4.0);
  float day = smoothstep(-0.30, 0.50, dot(N, L));
  float glow = rim * (0.06 + 0.95 * day);

  // Alpha 1.0 keeps the additive contribution deterministic (= rgb).
  gl_FragColor = vec4(uColor * glow, 1.0);
}
`;
