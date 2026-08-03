import { GLSL_LIB } from "./shaders/lib";

/**
 * Black-hole shaders — an Interstellar "Gargantua" style accretion disk.
 *
 * Everything that glows is painted on a single camera-facing (billboarded)
 * quad, so the silhouette is authored directly in screen space and never
 * collapses into an edge-on streak the way a second 3D disk would. Working in
 * the quad's local frame, in units of the shadow radius, the fragment shader
 * draws:
 *   - a razor-thin, very bright photon ring welded to the event horizon;
 *   - the direct accretion disk as a thin horizontal band on each side, seen
 *     nearly edge-on;
 *   - two gravitationally lensed arcs — a bright one bending over the top of
 *     the shadow and a fainter one under the bottom — each the half of an
 *     ellipse whose feet meet the horizontal disk at the left and right, which
 *     is exactly the Gargantua outline.
 *
 * Dust lanes come from ridged/fbm noise sampled in polar coordinates with
 * Keplerian shear (inner material laps the rim, so filaments smear into spiral
 * arms). A temperature ramp runs white-hot at the inner edge through orange to
 * the destination's accent at the rim, and doppler beaming makes the limb
 * rushing toward the camera brighter and bluer than the receding one.
 */

/** Billboard quad: hand the fragment stage the local XY position (world units,
 *  pre-normalisation) and nothing else. All the lensing is authored in this 2D
 *  frame, so no vertex-stage matrices ever need to reach the fragment. */
export const BILLBOARD_VERTEX = /* glsl */ `
varying vec2 vLocal;

void main() {
  vLocal = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const BILLBOARD_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
uniform float uShadow;
uniform float uDiskOuter;
uniform float uArcApex;
uniform float uArcWidth;
uniform float uThickness;
uniform float uBeaming;
uniform float uPhoton;
uniform float uOpacity;
uniform int uOctaves;
uniform int uLow;

varying vec2 vLocal;

${GLSL_LIB}

// Temperature ramp: white-hot inner edge -> orange -> the brand accent at the
// rim. Values run above 1.0 so the hot core survives to the bloom pass.
vec3 diskTemp(float t) {
  vec3 hot  = vec3(3.2, 3.0, 2.8);
  vec3 mid  = vec3(2.4, 1.05, 0.35);
  vec3 cool = uColor * 1.15;
  vec3 c = mix(hot, mid, smoothstep(0.0, 0.32, t));
  c = mix(c, cool, smoothstep(0.32, 1.0, t));
  return c;
}

void main() {
  // Work in units of the shadow radius: the event horizon is the disc rad < 1.
  vec2 q = vLocal / uShadow;
  float x = q.x;
  float y = q.y;
  float rad = length(q);
  float phi = atan(y, x);
  float diskOuterQ = uDiskOuter / uShadow;

  // Beyond the disk there is nothing to draw (the quad corners land here).
  if (rad > diskOuterQ + 0.35) discard;

  // Keplerian shear: inner material orbits faster (v ~ r^-1.5), so a feature at
  // a fixed radius is dragged further round the closer it is to the hole.
  // Sampling noise in this sheared polar frame smears filaments into spirals.
  float orbital = uTime * (0.6 / pow(max(rad, 0.35), 1.5));
  float swirl = phi + orbital;
  vec3 np = vec3(cos(swirl) * rad, sin(swirl) * rad, uTime * 0.04);
  float fil = ridged(np * 1.8, uOctaves);
  float density = fil;
  if (uLow == 0) {
    // Second, higher-frequency clump layer — the priciest sampling, so it is
    // dropped entirely at low quality.
    float clumps = fbm(np * 3.4 + 7.0, uOctaves);
    density = mix(fil, clumps, 0.4);
  }
  // Dark dust lanes cut across the bright disk wherever the noise dips.
  float dust = mix(0.28, 1.15, smoothstep(0.12, 0.78, density));

  // Temperature by distance from the shadow (0 = inner/hot, 1 = rim/cool).
  float tCoord = clamp((rad - 1.0) / max(diskOuterQ - 1.0, 0.001), 0.0, 1.0);
  vec3 temp = diskTemp(tCoord);

  // Doppler beaming: the left limb rushes toward the camera — brighter and
  // blue-shifted — while the right recedes, dimmer and red-shifted.
  float side = clamp(x / 1.4, -1.0, 1.0);
  float approach = -side;
  float beam = 1.0 + uBeaming * approach;
  vec3 dop = temp;
  dop.b *= 1.0 + 0.35 * max(approach, 0.0);
  dop.r *= 1.0 + 0.30 * max(-approach, 0.0);
  beam = max(beam, 0.15);

  // Keep every additive tail out of the black interior, and fade the outer rim.
  float outside = smoothstep(1.0, 1.06, rad);
  float xout = 1.0 - smoothstep(diskOuterQ * 0.80, diskOuterQ, abs(x));

  // Radial envelope forcing the quad's contribution to exactly zero by the rim.
  // The disk and arc terms are Gaussians, so they have long tails that never
  // reach zero on their own; additively blended against black space those tails
  // tint the whole quad as a faint smoky haze.
  float envelope = 1.0 - smoothstep(diskOuterQ * 0.62, diskOuterQ * 1.02, rad);

  vec3 col = vec3(0.0);

  // (1) Direct disk — a thin horizontal band on each side of the shadow, seen
  //     nearly edge-on so it barely has vertical thickness (flaring outward).
  {
    float thick = uThickness * (1.0 + 0.6 * tCoord);
    float band = exp(-(y * y) / (thick * thick));
    float xin  = smoothstep(1.02, 1.22, abs(x));
    float rb   = mix(2.6, 0.45, tCoord);
    float d = band * xin * xout * outside;
    col += dop * (d * rb * dust * beam);
  }

  // (2) Lensed arcs — light from the far side of the disk bent up over the top
  //     and down under the bottom. Each is the upper/lower half of an ellipse
  //     whose apex sits just outside the photon ring (uArcApex) and whose feet
  //     reach the horizontal disk at +/- uArcWidth, so the arcs merge into the
  //     disk at the sides. As |x| passes uArcWidth the height collapses to zero
  //     and the term becomes the y = 0 band, joining the disk seamlessly. The
  //     top image is brighter than the bottom, as in the reference.
  {
    float ax = clamp(1.0 - (x * x) / (uArcWidth * uArcWidth), 0.0, 1.0);
    float arcH = uArcApex * sqrt(ax);
    float at = uThickness * 1.5;
    float top = exp(-((y - arcH) * (y - arcH)) / (at * at));
    float bot = exp(-((y + arcH) * (y + arcH)) / (at * at));
    float rbA = mix(2.3, 0.5, tCoord);
    float base = xout * outside * dust * beam * rbA;
    col += dop * (top * base);
    col += dop * (bot * base * 0.5);
  }

  // (3) Photon ring — a razor-thin, very bright annulus welded to the horizon,
  //     inner edge trimmed so it never dips into the depth-culled shadow.
  {
    float ring = exp(-((rad - 1.03) * (rad - 1.03)) / (0.024 * 0.024));
    ring *= smoothstep(0.99, 1.02, rad);
    vec3 rc = mix(uColor, vec3(1.0), 0.78);
    col += rc * (ring * uPhoton);
  }

  col *= uOpacity;

  // Discard the vast empty region of the quad so it neither blends nor blooms.
  if (max(col.r, max(col.g, col.b)) < 0.002) discard;

  gl_FragColor = vec4(col, 1.0);
}
`;
