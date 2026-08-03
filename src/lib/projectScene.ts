import { DESTINATIONS, EARTH } from "./destinations";

/**
 * Screen projection for the loading skeleton.
 *
 * Deliberately implemented with plain vector maths rather than THREE.Camera:
 * the loader renders before (and instead of) the 3D bundle, and importing
 * three here would pull ~600KB into the main chunk, defeating the dynamic
 * import that keeps classic-mode visitors from downloading it at all.
 */

type Vec3 = readonly [number, number, number];

const FOV_DEG = 55;

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
function norm(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

export interface ProjectedBody {
  id: string;
  /** Percent of viewport width/height for the body's centre. */
  leftPct: number;
  topPct: number;
  /** On-screen diameter in pixels. */
  sizePx: number;
}

/**
 * Project the scene's bodies as the docked station camera sees them.
 *
 * The hero always opens parked at the station, so this initial framing is
 * deterministic — only the aspect ratio varies between viewports.
 */
export function projectSceneBodies(
  viewportW: number,
  viewportH: number,
): ProjectedBody[] {
  const station = DESTINATIONS.station;
  const eye: Vec3 = [
    station.position[0] + station.cameraOffset[0],
    station.position[1] + station.cameraOffset[1],
    station.position[2] + station.cameraOffset[2],
  ];
  const target: Vec3 = station.position;

  const forward = norm(sub(target, eye));
  const right = norm(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);

  const aspect = viewportW / viewportH || 1;
  const tanHalf = Math.tan((FOV_DEG * Math.PI) / 360);

  // What to stand in for. The black hole is represented by its glowing disk
  // rather than its horizon, since the disk is what actually occupies screen.
  const bodies: { id: string; position: Vec3; radius: number }[] = [
    { id: "earth", position: EARTH.position, radius: EARTH.radius },
    {
      id: "stock-predictor",
      position: DESTINATIONS["stock-predictor"].position,
      radius: DESTINATIONS["stock-predictor"].radius,
    },
    {
      id: "blackprint",
      position: DESTINATIONS.blackprint.position,
      radius: DESTINATIONS.blackprint.radius,
    },
    {
      id: "black-hole",
      position: DESTINATIONS["black-hole"].position,
      radius: DESTINATIONS["black-hole"].radius * 2.4,
    },
    { id: "station", position: station.position, radius: station.radius },
  ];

  const out: ProjectedBody[] = [];

  for (const b of bodies) {
    const v = sub(b.position, eye);
    const z = dot(v, forward);
    if (z <= 0.001) continue; // behind the camera

    const x = dot(v, right);
    const y = dot(v, up);

    const ndcX = x / z / (tanHalf * aspect);
    const ndcY = y / z / tanHalf;

    // Angular radius -> on-screen diameter.
    const sizePx = ((b.radius / z / tanHalf) * viewportH);

    const leftPct = ((ndcX + 1) / 2) * 100;
    const topPct = ((1 - ndcY) / 2) * 100;

    // Skip anything comfortably outside the frame.
    if (leftPct < -40 || leftPct > 140 || topPct < -40 || topPct > 140) continue;

    out.push({ id: b.id, leftPct, topPct, sizePx });
  }

  return out;
}
