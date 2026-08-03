"use client";

import { Canvas } from "@react-three/fiber";
import { DESTINATIONS } from "@/lib/destinations";
import { SpaceScene } from "./SpaceScene";

const station = DESTINATIONS.station;
const INITIAL_CAMERA: [number, number, number] = [
  station.position[0] + station.cameraOffset[0],
  station.position[1] + station.cameraOffset[1],
  station.position[2] + station.cameraOffset[2],
];

export function SceneCanvas() {
  return (
    <Canvas
      camera={{ position: INITIAL_CAMERA, fov: 55, near: 0.1, far: 600 }}
      // Cap DPR at 1.5: these are smooth gradient surfaces, so the jump to a
      // full 2x costs ~1.8x the fragment work for almost no visible gain.
      dpr={[1, 1.5]}
      // Transparent so the page-wide CSS starfield shows through. The scene
      // deliberately has no starfield of its own — one shared field means the
      // stars are identical above and below the hero, with no seam.
      gl={{
        antialias: true,
        powerPreference: "high-performance",
        alpha: true,
      }}
      onCreated={({ gl, scene }) => {
        scene.background = null;
        gl.setClearColor(0x000000, 0);
      }}
      style={{ position: "absolute", inset: 0, background: "transparent" }}
    >
      <SpaceScene />
    </Canvas>
  );
}
