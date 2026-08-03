"use client";

import { useEffect } from "react";
import * as THREE from "three";
import gsap from "gsap";
import type { DestinationId } from "@/lib/types";
import { DESTINATIONS, flightDuration } from "@/lib/destinations";
import { useSiteStore } from "@/lib/store";

/**
 * Per-frame flight state shared by the ship and the camera rig.
 *
 * The engine mutates the `THREE.Vector3` fields in place (never reassigns them),
 * so `Ship` and `CameraRig` can hold the same references and read them cheaply
 * inside their own `useFrame` loops without triggering React renders.
 */
export interface FlightState {
  /** World-space position the ship should occupy this frame. */
  shipPosition: THREE.Vector3;
  /** Normalised direction the ship's nose (local +Z) should point. */
  shipForward: THREE.Vector3;
  /** World-space position the camera should occupy this frame. */
  cameraPosition: THREE.Vector3;
  /** World-space point the camera should look at this frame. */
  cameraTarget: THREE.Vector3;
  /** Target bank/roll angle (radians) leaning the ship into its current turn. */
  bank: number;
  /** Engine intensity target, 0..1. Peaks mid-flight, settles low when docked. */
  throttle: number;
  /** Mirrors the OS "reduce motion" preference; consumers gate idle motion on it. */
  reducedMotion: boolean;
}

/** Fraction of a destination's camera offset the ship parks along, toward the planet. */
const SHIP_DOCK_FACTOR = 0.42;
/** How far below the sight line the docked ship sits, so the planet stays framed. */
const SHIP_DOCK_DROP = 0.35;
/** Gap kept between the ship and a destination's outermost geometry. */
const SHIP_CLEARANCE = 1.4;
/**
 * Yaw applied to the ship's parking spot, in radians. Swinging it off the
 * camera's sight line keeps the ship from occluding the destination. It leans
 * right so that when the overlay shifts the framing left, the ship travels
 * toward centre frame rather than off the edge.
 */
const SHIP_DOCK_YAW = 0.34;
/** Sideways bow of the ship's arc, as a fraction of leg length. */
const SHIP_ARC = 0.22;
/** Gentler bow for the camera path so framing stays steady. */
const CAM_ARC = 0.1;
/** Resting engine glow while docked. */
const IDLE_THROTTLE = 0.22;
/** Scales tangent curvature into a bank angle. */
const BANK_GAIN = 9;
/** Maximum bank angle (radians ~28.6°). */
const MAX_BANK = 0.5;

const UP = new THREE.Vector3(0, 1, 0);
const FALLBACK_AXIS = new THREE.Vector3(0, 0, 1);

// Reusable scratch vectors — never allocate inside the animation callbacks.
const _mid = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _side = new THREE.Vector3();
const _tan = new THREE.Vector3();
const _tanAhead = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _face = new THREE.Vector3();

const shipCurve = new THREE.QuadraticBezierCurve3(
  new THREE.Vector3(),
  new THREE.Vector3(),
  new THREE.Vector3(),
);
const camCurve = new THREE.QuadraticBezierCurve3(
  new THREE.Vector3(),
  new THREE.Vector3(),
  new THREE.Vector3(),
);
const _targetStart = new THREE.Vector3();
const _targetEnd = new THREE.Vector3();

/** Single normalised progress value GSAP animates from 0 → 1 per flight. */
const progress = { t: 0 };

function queryReducedMotion(): boolean {
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  return false;
}

export const flightState: FlightState = {
  shipPosition: new THREE.Vector3(),
  shipForward: new THREE.Vector3(0, 0, -1),
  cameraPosition: new THREE.Vector3(),
  cameraTarget: new THREE.Vector3(),
  bank: 0,
  throttle: IDLE_THROTTLE,
  reducedMotion: queryReducedMotion(),
};

function shipDockInto(id: DestinationId, out: THREE.Vector3): THREE.Vector3 {
  const d = DESTINATIONS[id];
  const [ox, oy, oz] = d.cameraOffset;

  const offsetLen = Math.hypot(ox, oy, oz) || 1;

  // Park outside the object's outermost geometry, otherwise the ship ends up
  // buried inside a ring system or the accretion disk.
  const minDist = d.visualRadius + SHIP_CLEARANCE;
  const dist = Math.max(offsetLen * SHIP_DOCK_FACTOR, minDist);

  // Swing the parking spot off the camera's sight line so the ship frames the
  // destination instead of covering it.
  const cos = Math.cos(SHIP_DOCK_YAW);
  const sin = Math.sin(SHIP_DOCK_YAW);
  const dx = (ox * cos + oz * sin) / offsetLen;
  const dy = oy / offsetLen;
  const dz = (-ox * sin + oz * cos) / offsetLen;

  out.set(
    d.position[0] + dx * dist,
    d.position[1] + dy * dist - SHIP_DOCK_DROP,
    d.position[2] + dz * dist,
  );
  return out;
}

function cameraDockInto(id: DestinationId, out: THREE.Vector3): THREE.Vector3 {
  const d = DESTINATIONS[id];
  out.set(
    d.position[0] + d.cameraOffset[0],
    d.position[1] + d.cameraOffset[1],
    d.position[2] + d.cameraOffset[2],
  );
  return out;
}

function planetInto(id: DestinationId, out: THREE.Vector3): THREE.Vector3 {
  const d = DESTINATIONS[id];
  out.set(d.position[0], d.position[1], d.position[2]);
  return out;
}

/** A fresh `Vector3` at a destination's docked camera position (mount-time use). */
export function getCameraDock(id: DestinationId): THREE.Vector3 {
  return cameraDockInto(id, new THREE.Vector3());
}

function buildCurve(
  curve: THREE.QuadraticBezierCurve3,
  start: THREE.Vector3,
  end: THREE.Vector3,
  arc: number,
): void {
  curve.v0.copy(start);
  curve.v2.copy(end);
  _mid.copy(start).add(end).multiplyScalar(0.5);
  _dir.copy(end).sub(start);
  const dist = _dir.length();
  if (dist < 1e-5) {
    curve.v1.copy(_mid);
    return;
  }
  _dir.divideScalar(dist);
  // Control point offset perpendicular to travel (and slightly up) so the path arcs.
  _side.crossVectors(_dir, UP);
  if (_side.lengthSq() < 1e-6) {
    _side.crossVectors(_dir, FALLBACK_AXIS);
  }
  _side.normalize();
  curve.v1
    .copy(_mid)
    .addScaledVector(_side, dist * arc)
    .addScaledVector(UP, dist * arc * 0.5);
}

function faceToward(target: THREE.Vector3): void {
  _face.copy(target).sub(flightState.shipPosition);
  if (_face.lengthSq() > 1e-8) {
    flightState.shipForward.copy(_face).normalize();
  }
}

/** Snap every anchor to a destination's docked rest pose. */
function snapTo(id: DestinationId): void {
  shipDockInto(id, flightState.shipPosition);
  cameraDockInto(id, flightState.cameraPosition);
  planetInto(id, flightState.cameraTarget);
  planetInto(id, _tmp);
  faceToward(_tmp);
  flightState.bank = 0;
  flightState.throttle = IDLE_THROTTLE;
}

function computeBank(): number {
  _a.set(_tan.x, 0, _tan.z);
  _b.set(_tanAhead.x, 0, _tanAhead.z);
  if (_a.lengthSq() < 1e-8 || _b.lengthSq() < 1e-8) return 0;
  _a.normalize();
  _b.normalize();
  const turn = _a.z * _b.x - _a.x * _b.z; // (a × b).y — signed horizontal turn
  return THREE.MathUtils.clamp(turn * BANK_GAIN, -MAX_BANK, MAX_BANK);
}

/** Evaluate both curves at normalised progress `t` and write every anchor. */
function applyProgress(t: number): void {
  shipCurve.getPoint(t, flightState.shipPosition);
  camCurve.getPoint(t, flightState.cameraPosition);
  flightState.cameraTarget.copy(_targetStart).lerp(_targetEnd, t);

  shipCurve.getTangent(t, _tan);
  if (_tan.lengthSq() > 1e-8) {
    flightState.shipForward.copy(_tan).normalize();
  }
  shipCurve.getTangent(Math.min(t + 0.03, 1), _tanAhead);
  flightState.bank = computeBank();

  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  flightState.throttle = 0.55 + 0.45 * Math.sin(Math.PI * clamped);
}

// --- flight lifecycle ------------------------------------------------------

type SiteState = ReturnType<typeof useSiteStore.getState>;

let activeTween: ReturnType<typeof gsap.to> | null = null;
let pendingArrive: ReturnType<typeof gsap.delayedCall> | null = null;
/** Bumped per flight; a superseded flight's completion is ignored via this token. */
let flightCounter = 0;
/** Destination the engine is currently animating toward (null when settled). */
let activeTarget: DestinationId | null = null;
/** Last destination the ship actually docked at (used as the "from" for durations). */
let lastArrived: DestinationId = "station";

function cancelPending(): void {
  if (activeTween) {
    activeTween.kill();
    activeTween = null;
  }
  if (pendingArrive) {
    pendingArrive.kill();
    pendingArrive = null;
  }
}

/** Fire `arrive()` exactly once for the flight identified by `id`. */
function callArrive(id: number): void {
  if (id === flightCounter) {
    useSiteStore.getState().arrive();
  }
}

function startFlight(fromId: DestinationId, toId: DestinationId): void {
  // Kill any in-flight tween / pending arrival so only this flight can complete.
  cancelPending();
  const myId = ++flightCounter;

  // Curves always start from the CURRENT anchors, so a mid-flight retarget
  // continues smoothly from wherever the ship and camera actually are.
  buildCurve(shipCurve, flightState.shipPosition, shipDockInto(toId, _tmp), SHIP_ARC);
  buildCurve(camCurve, flightState.cameraPosition, cameraDockInto(toId, _tmp), CAM_ARC);
  _targetStart.copy(flightState.cameraTarget);
  planetInto(toId, _targetEnd);

  const legDistance = flightState.shipPosition.distanceTo(shipCurve.v2);

  // Reduced motion or a no-op hop: jump straight there and arrive next tick
  // (deferred so we never call the store setter synchronously during render).
  if (flightState.reducedMotion || legDistance < 0.01) {
    snapTo(toId);
    pendingArrive = gsap.delayedCall(0, () => {
      pendingArrive = null;
      callArrive(myId);
    });
    return;
  }

  progress.t = 0;
  activeTween = gsap.to(progress, {
    t: 1,
    duration: flightDuration(fromId, toId),
    ease: "power2.inOut",
    onUpdate: () => applyProgress(progress.t),
    onComplete: () => {
      activeTween = null;
      snapTo(toId);
      callArrive(myId);
    },
  });
}

/** React to store changes: begin or retarget a flight, or record arrival. */
function evaluate(state: SiteState): void {
  if (state.isFlying) {
    if (activeTarget !== state.destination) {
      const fromId = activeTarget ?? lastArrived;
      activeTarget = state.destination;
      startFlight(fromId, state.destination);
    }
  } else {
    activeTarget = null;
    lastArrived = state.destination;
  }
}

// Initialise anchors at module load so the very first frame is already correct,
// even before the hook's effect runs.
snapTo("station");

// --- subscription lifecycle (ref-counted so it survives StrictMode remounts) --

let subscribers = 0;
let unsubStore: (() => void) | null = null;
let mediaQuery: MediaQueryList | null = null;
let onMediaChange: (() => void) | null = null;

function setupMedia(): void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return;
  }
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mediaQuery = mq;
  flightState.reducedMotion = mq.matches;
  onMediaChange = () => {
    flightState.reducedMotion = mq.matches;
  };
  mq.addEventListener("change", onMediaChange);
}

function teardownMedia(): void {
  if (mediaQuery && onMediaChange) {
    mediaQuery.removeEventListener("change", onMediaChange);
  }
  mediaQuery = null;
  onMediaChange = null;
}

function acquire(): void {
  subscribers += 1;
  if (subscribers > 1) return;

  const state = useSiteStore.getState();
  lastArrived = state.destination;
  activeTarget = null;
  snapTo(state.destination);
  setupMedia();
  unsubStore = useSiteStore.subscribe(evaluate);
  evaluate(state); // resolve any flight already pending at mount time
}

function release(): void {
  subscribers = Math.max(0, subscribers - 1);
  if (subscribers > 0) return;

  if (unsubStore) {
    unsubStore();
    unsubStore = null;
  }
  teardownMedia();
  cancelPending();
  activeTarget = null;
}

/**
 * Drives the fly-to animation. Watches the store's `destination`/`isFlying`,
 * animates the shared `flightState` along a curved path via GSAP, and calls
 * `arrive()` exactly once when a flight finishes (or immediately, deferred, when
 * reduced motion is preferred). Returns the shared state for convenience; `Ship`
 * and `CameraRig` also import `flightState` directly.
 */
export function useFlyTo(): FlightState {
  useEffect(() => {
    acquire();
    return () => release();
  }, []);

  return flightState;
}
