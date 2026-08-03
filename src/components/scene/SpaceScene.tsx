"use client";

import { Earth } from "./Earth";
import { Station } from "./Station";
import { Planet } from "./Planet";
import { BlackHole } from "./BlackHole";
import { SceneLighting } from "./SceneLighting";
import { Ship } from "./Ship";
import { CameraRig } from "./CameraRig";
import { useFlyTo } from "./useFlyTo";
import { PostFX } from "./PostFX";
import { SceneReadyProbe } from "./SceneReadyProbe";
import { FpsSampler } from "@/components/fallback/FpsSampler";

/**
 * Scene graph composition. Ship and CameraRig read the shared `flightState`
 * but do not activate it — calling useFlyTo() here acquires the store
 * subscription that drives travel and fires arrive(). Without this call
 * nothing would animate and overlays would never open.
 *
 * There is intentionally no 3D starfield: the canvas is transparent and the
 * page-wide CSS starfield shows through, so the sky is continuous from the
 * hero all the way down the page instead of changing at the seam.
 */
export function SpaceScene() {
  useFlyTo();

  return (
    <>
      <SceneLighting />
      <Earth />
      <Station />
      <Planet id="stock-predictor" />
      <Planet id="blackprint" />
      <BlackHole />
      <Ship />
      <CameraRig />
      <SceneReadyProbe />
      <FpsSampler />
      {/* Composer must be last in the tree. Self-disables at low quality. */}
      <PostFX />
    </>
  );
}
