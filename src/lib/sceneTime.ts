/**
 * Monotonic scene time, in seconds.
 *
 * Deliberately NOT three's `state.clock.elapsedTime`. R3F resets the clock —
 * `clock.stop(); clock.elapsedTime = 0; clock.start()` — every single time
 * `frameloop` changes. `SceneCanvas` toggles `frameloop` to suspend rendering
 * while the hero is scrolled out of view, so reading `elapsedTime` would snap
 * every time-driven animation back to its t=0 pose the moment the visitor
 * scrolled back up: Earth's spin and cloud drift both derive absolute rotation
 * from it, as do the accretion disk, the engine glow and the idle camera drift.
 *
 * `performance.now()` is monotonic and independent of the render loop, so
 * bodies keep turning while off-screen and are simply where you would expect
 * them to be on return — no jump.
 */
const ORIGIN =
  typeof performance !== "undefined" ? performance.now() : 0;

export function sceneTime(): number {
  if (typeof performance === "undefined") return 0;
  return (performance.now() - ORIGIN) / 1000;
}
