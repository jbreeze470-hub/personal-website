import type { DestinationId } from "./types";

/**
 * Canonical positions for every object in the 3D scene.
 *
 * Authored in Wave 0 so the scene agent (which renders objects) and the
 * flight agent (which animates toward them) agree on coordinates without
 * seeing each other's code. Subagents read this; they must not edit it.
 *
 * Axes: +X right, +Y up, +Z toward viewer. Units are arbitrary world units.
 */
export interface Destination {
  id: DestinationId;
  /** Short label rendered next to the object in 3D. */
  label: string;
  /** Longer hint shown on hover. */
  hint: string;
  /** Object centre in world space. */
  position: [number, number, number];
  /** Visual radius, used for both geometry and camera framing. */
  radius: number;
  /**
   * Outer extent of everything drawn for this destination — rings, atmosphere,
   * accretion disk. The ship parks outside this so it never sits inside the
   * geometry it just flew to.
   */
  visualRadius: number;
  /** Where the camera parks when docked, relative to `position`. */
  cameraOffset: [number, number, number];
  /** Accent colour for the object and its label. */
  color: string;
  /** Matching project id in src/content/projects.ts, when applicable. */
  projectId?: string;
}

export const DESTINATIONS: Record<DestinationId, Destination> = {
  station: {
    id: "station",
    label: "Home Station",
    hint: "Orbital platform above Earth — start here",
    position: [0, 0, 0],
    radius: 1.2,
    visualRadius: 2.2,
    cameraOffset: [0, 1.5, 9],
    color: "#67e8f9",
  },
  "stock-predictor": {
    id: "stock-predictor",
    label: "Stock Predictor",
    hint: "Forecasting model — demo video",
    // Sits low and left so it reads just below the hero copy rather than
    // behind it. y is chosen so the planet's top edge clears the text block.
    position: [-16, -3, -12],
    radius: 2.4,
    // Ring geometry extends to radius * 2.35.
    visualRadius: 2.4 * 2.35,
    // Biased right of centre so the subject sits left of the overlay panel.
    cameraOffset: [4.5, 1.6, 12],
    color: "#22d3ee",
    projectId: "stock-predictor",
  },
  blackprint: {
    id: "blackprint",
    label: "Blackprint",
    hint: "Production website — demo video",
    position: [15, -1.5, -18],
    radius: 2.8,
    // Atmosphere shell sits just outside the surface.
    visualRadius: 2.8 * 1.25,
    cameraOffset: [3.5, 1.4, 9.5],
    color: "#38bdf8",
    projectId: "blackprint",
  },
  "black-hole": {
    id: "black-hole",
    label: "The Void",
    hint: "Projects without a demo video — yet",
    position: [2, 4, -40],
    radius: 3.6,
    // Accretion disk extends to radius * 2.4.
    visualRadius: 3.6 * 2.4,
    cameraOffset: [5, 2.6, 16],
    color: "#a78bfa",
  },
};

/** Earth sits below and behind the station; it is scenery, not a destination.
 *  Positioned and sized so the full sphere fits inside the hero framing —
 *  a cropped planet reads as a mistake rather than a horizon. */
export const EARTH = {
  position: [0, -11, -17] as [number, number, number],
  radius: 4.5,
};

/** Travel order used by keyboard navigation and "next destination" controls. */
export const TRAVEL_ORDER: DestinationId[] = [
  "station",
  "stock-predictor",
  "blackprint",
  "black-hole",
];

export const PLANET_DESTINATIONS = TRAVEL_ORDER.filter(
  (id) => id !== "station",
).map((id) => DESTINATIONS[id]);

/** Seconds the fly-to animation should take, by distance travelled. */
export function flightDuration(
  from: DestinationId,
  to: DestinationId,
): number {
  const a = DESTINATIONS[from].position;
  const b = DESTINATIONS[to].position;
  const dist = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  return Math.min(3.4, Math.max(1.6, dist / 14));
}
