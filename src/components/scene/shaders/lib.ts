/**
 * Shared GLSL chunks for the space scene.
 *
 * Authored once so every shader agent composes the same noise and lighting
 * helpers. Import these constants and interpolate them into shader sources.
 * Subagents consume this file; they must not edit it.
 *
 * All functions here are original hash-based implementations (no third-party
 * noise code), chosen so they stay cheap on integrated GPUs.
 */

/**
 * Highest octave count any shader may request.
 *
 * This bounds the unrolled loop in `fbm`/`ridged`, so lowering it shrinks the
 * compiled shader as well as the per-pixel work — a uniform-controlled `break`
 * alone would still leave the full six iterations in the binary.
 */
const MAX_OCTAVES = 4;

/** Cheap deterministic hash + 3D value noise + fbm. */
export const GLSL_NOISE = /* glsl */ `
float hash31(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

// Smooth 3D value noise via trilinear interpolation of hashed lattice points.
float vnoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  vec3 u = f * f * (3.0 - 2.0 * f);

  float n000 = hash31(i + vec3(0.0, 0.0, 0.0));
  float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash31(i + vec3(1.0, 1.0, 1.0));

  return mix(
    mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
    mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y),
    u.z
  );
}

// Fractional Brownian motion. The loop bound is a compile-time constant and
// every iteration is unrolled into the shader, so it is capped at the highest
// quality tier's octave count rather than an arbitrary maximum.
float fbm(vec3 p, int octaves) {
  float sum = 0.0;
  float amp = 0.5;
  float freq = 1.0;
  for (int i = 0; i < ${MAX_OCTAVES}; i++) {
    if (i >= octaves) break;
    sum += amp * vnoise(p * freq);
    freq *= 2.02;
    amp *= 0.5;
  }
  return sum;
}

// Ridged variant — good for mountain chains and disk filaments.
float ridged(vec3 p, int octaves) {
  float sum = 0.0;
  float amp = 0.5;
  float freq = 1.0;
  for (int i = 0; i < ${MAX_OCTAVES}; i++) {
    if (i >= octaves) break;
    float n = 1.0 - abs(vnoise(p * freq) * 2.0 - 1.0);
    sum += amp * n * n;
    freq *= 2.02;
    amp *= 0.5;
  }
  return sum;
}

// Domain-warped fbm. Feeding noise back into its own input breaks up the
// smooth "cloudy" look and produces swirls, deltas and eroded coastlines.
float warpedFbm(vec3 p, int octaves) {
  vec3 q = vec3(
    fbm(p + vec3(0.0, 0.0, 0.0), octaves),
    fbm(p + vec3(5.2, 1.3, 2.7), octaves),
    fbm(p + vec3(1.7, 9.2, 4.1), octaves)
  );
  return fbm(p + 3.2 * q, octaves);
}
`;

/** Fresnel rim term, used for atmospheres and glass-like edges. */
export const GLSL_FRESNEL = /* glsl */ `
float fresnel(vec3 viewDir, vec3 normal, float power) {
  return pow(clamp(1.0 - dot(normalize(viewDir), normalize(normal)), 0.0, 1.0), power);
}
`;

/**
 * Cellular (Worley) noise and a crater field built on it.
 *
 * `craters` returns a height offset shaped like a real impact basin: a sunken
 * floor, a raised rim, and a soft ejecta skirt. Layering it at several scales
 * gives the pitted look of an airless body.
 */
export const GLSL_CELLULAR = /* glsl */ `
vec3 hash33(vec3 p) {
  p = vec3(
    dot(p, vec3(127.1, 311.7, 74.7)),
    dot(p, vec3(269.5, 183.3, 246.1)),
    dot(p, vec3(113.5, 271.9, 124.6))
  );
  return fract(sin(p) * 43758.5453123);
}

// Distance to the nearest feature point. Returns (F1, cellId).
vec2 worley(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  float f1 = 1e9;
  float id = 0.0;
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      for (int z = -1; z <= 1; z++) {
        vec3 g = vec3(float(x), float(y), float(z));
        vec3 o = hash33(i + g);
        float d = length(g + o - f);
        if (d < f1) {
          f1 = d;
          id = dot(i + g, vec3(1.0, 57.0, 113.0));
        }
      }
    }
  }
  return vec2(f1, id);
}

/**
 * One scale of impact craters.
 * "density" scales the cell grid; larger = more, smaller craters.
 * Returns a signed height: negative inside the floor, positive at the rim.
 */
float craters(vec3 p, float density) {
  vec2 w = worley(p * density);
  float d = w.x;

  // Randomise which cells actually contain a crater, and how big.
  float present = step(0.42, fract(sin(w.y) * 43758.5453));
  float radius = 0.30 + 0.22 * fract(sin(w.y * 1.7) * 24634.6345);

  float t = clamp(d / radius, 0.0, 1.0);

  // Bowl floor, then a rim that peaks just outside the basin edge.
  float floorTerm = -(1.0 - smoothstep(0.0, 0.82, t));
  float rim = exp(-pow((t - 0.9) * 5.0, 2.0)) * 0.9;

  return present * (floorTerm * 0.55 + rim);
}
`;

/**
 * Analytic bump normals.
 *
 * Sampling a height function at small offsets and taking the gradient gives a
 * perturbed normal, so lighting picks out relief. This is what makes craters
 * and mountains read as geometry rather than as a painted-on texture.
 */
export const GLSL_BUMP = /* glsl */ `
// Rebuild a normal from a height field sampled around p.
// "heightAt" must be defined by the including shader as:
//     float heightAt(vec3 p)
vec3 perturbNormal(vec3 p, vec3 N, float strength, float eps) {
  float h = heightAt(p);
  vec3 t1 = normalize(abs(N.y) < 0.99 ? cross(N, vec3(0.0, 1.0, 0.0))
                                      : cross(N, vec3(1.0, 0.0, 0.0)));
  vec3 t2 = normalize(cross(N, t1));

  float hx = heightAt(p + t1 * eps);
  float hy = heightAt(p + t2 * eps);

  vec3 grad = (hx - h) / eps * t1 + (hy - h) / eps * t2;
  return normalize(N - grad * strength);
}
`;

/** Filmic-ish tonemap + sRGB helpers so shader output matches three's pipeline. */
export const GLSL_COLOR = /* glsl */ `
vec3 tonemap(vec3 c) {
  return c / (c + vec3(1.0));
}

vec3 saturateColor(vec3 c, float amount) {
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return mix(vec3(l), c, amount);
}
`;

/** Rotation helpers for animating surface flow and disk spin. */
export const GLSL_ROTATE = /* glsl */ `
mat2 rot2(float a) {
  float s = sin(a);
  float c = cos(a);
  return mat2(c, -s, s, c);
}
`;

/** Everything, in dependency order. Prepend to any fragment shader. */
export const GLSL_LIB = `${GLSL_NOISE}\n${GLSL_FRESNEL}\n${GLSL_CELLULAR}\n${GLSL_COLOR}\n${GLSL_ROTATE}`;

/** Octave budget per quality tier. Capped at MAX_OCTAVES, which also bounds the
 *  unrolled loop in `fbm`/`ridged`. Four octaves keeps continents, ranges and
 *  cloud structure legible; the fifth and sixth add detail finer than a pixel
 *  at the distances the camera actually sits, so they cost fill rate for no
 *  visible gain. */
export const NOISE_OCTAVES = {
  high: MAX_OCTAVES,
  low: 2,
} as const;

/** Sphere geometry segment budget per quality tier. */
export const SPHERE_SEGMENTS = {
  high: 96,
  low: 24,
} as const;
