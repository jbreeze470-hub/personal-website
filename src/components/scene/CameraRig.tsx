"use client";

import { useLayoutEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useSiteStore } from "@/lib/store";
import { DESTINATIONS } from "@/lib/destinations";
import { sceneTime } from "@/lib/sceneTime";
import { flightState, getCameraDock } from "./useFlyTo";

/** How quickly the camera position catches up to the animated anchor (weighty lag). */
const POS_LAMBDA = 6;
/** How quickly the look-at target catches up (kept tighter than position). */
const LOOK_LAMBDA = 8;
/**
 * How quickly the framing shifts when the overlay opens or closes.
 *
 * Tuned against the panel's 440ms slide: an exponential damp is ~95% settled
 * after 3/lambda seconds, so lambda 6 lands at ~0.5s. Matching the two means
 * the camera re-frame and the panel arrive together, instead of one snapping
 * into place while the other is still moving.
 */
const FRAME_LAMBDA = 6;
/**
 * Fraction of the viewport's half-width the subject slides left by while the
 * overlay is open, so it stays visible beside the panel instead of behind it.
 * Only applied at the `sm` breakpoint and up, where the panel is a side drawer.
 */
const OVERLAY_SHIFT = 0.44;

const _drift = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _worldUp = new THREE.Vector3(0, 1, 0);

/**
 * Owns the scene camera. Each frame it damps toward the animated flight anchors
 * (so movement feels weighty rather than rigidly glued) while still settling
 * exactly on target, and adds a whisper of idle drift while docked.
 */
export function CameraRig() {
  const camera = useThree((s) => s.camera);

  // `base` damps toward the anchor; idle drift is layered on top of it so the
  // damping never fights the drift and always converges exactly on the anchor.
  const base = useRef<THREE.Vector3>(null);
  const look = useRef<THREE.Vector3>(null);
  /** Eased lateral framing offset, in world units. */
  const frameShift = useRef(0);

  useLayoutEffect(() => {
    // Start already parked at the station dock so the first frame is correct.
    const startPos = getCameraDock("station");
    const startLook = new THREE.Vector3(...DESTINATIONS.station.position);
    base.current = startPos;
    look.current = startLook;
    camera.position.copy(startPos);
    camera.lookAt(startLook);
  }, [camera]);

  useFrame((state, delta) => {
    const b = base.current;
    const l = look.current;
    if (!b || !l) return;

    const dt = Math.min(delta, 0.05);
    const reduced = flightState.reducedMotion;
    const { isFlying: flying, overlayOpen } = useSiteStore.getState();

    // While the overlay is open, look slightly to the right of the subject so
    // the subject renders left of the panel. Sized from the actual frustum so
    // the shift holds across viewports.
    let shiftTarget = 0;
    if (overlayOpen && state.size.width >= 640) {
      const cam = camera as THREE.PerspectiveCamera;
      const dist = b.distanceTo(l) || 1;
      const halfWidth =
        dist * Math.tan((cam.fov * Math.PI) / 360) * (cam.aspect || 1);
      shiftTarget = halfWidth * OVERLAY_SHIFT;
    }

    if (reduced) {
      // Reduced motion: hold exactly on the anchors, no easing, no drift.
      frameShift.current = shiftTarget;
      b.copy(flightState.cameraPosition);
      l.copy(flightState.cameraTarget);
      camera.position.copy(b);
      applyShift(camera, b, l, frameShift.current);
      return;
    }

    frameShift.current = THREE.MathUtils.damp(
      frameShift.current,
      shiftTarget,
      FRAME_LAMBDA,
      dt,
    );

    // Damp the base position and look target toward their animated anchors.
    b.x = THREE.MathUtils.damp(b.x, flightState.cameraPosition.x, POS_LAMBDA, dt);
    b.y = THREE.MathUtils.damp(b.y, flightState.cameraPosition.y, POS_LAMBDA, dt);
    b.z = THREE.MathUtils.damp(b.z, flightState.cameraPosition.z, POS_LAMBDA, dt);

    l.x = THREE.MathUtils.damp(l.x, flightState.cameraTarget.x, LOOK_LAMBDA, dt);
    l.y = THREE.MathUtils.damp(l.y, flightState.cameraTarget.y, LOOK_LAMBDA, dt);
    l.z = THREE.MathUtils.damp(l.z, flightState.cameraTarget.z, LOOK_LAMBDA, dt);

    // Subtle idle parallax while docked — mean-zero, so the subject stays framed.
    _drift.set(0, 0, 0);
    if (!flying) {
      const time = sceneTime();
      _drift.set(
        Math.sin(time * 0.5) * 0.05,
        Math.cos(time * 0.4) * 0.035,
        Math.sin(time * 0.32) * 0.03,
      );
    }

    camera.position.copy(b).add(_drift);
    applyShift(camera, camera.position, l, frameShift.current);
  });

  return null;
}

/**
 * Aim the camera at `target`, nudged along the camera's own right axis. A
 * positive shift swings the view right, which pushes the subject left on screen.
 */
function applyShift(
  camera: THREE.Camera,
  position: THREE.Vector3,
  target: THREE.Vector3,
  shift: number,
) {
  if (Math.abs(shift) < 1e-4) {
    camera.lookAt(target);
    return;
  }

  _forward.copy(target).sub(position);
  _right.crossVectors(_forward, _worldUp);
  if (_right.lengthSq() < 1e-8) {
    camera.lookAt(target);
    return;
  }

  _right.normalize().multiplyScalar(shift);
  camera.lookAt(
    target.x + _right.x,
    target.y + _right.y,
    target.z + _right.z,
  );
}
