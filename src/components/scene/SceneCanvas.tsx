"use client";

import { useEffect, useRef, useState } from "react";
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
  // Pause rendering while the hero is off-screen. R3F defaults to
  // frameloop="always", which keeps shading every planet, the black hole and
  // the bloom pass at full rate while the visitor reads the 2D sections below.
  const [inView, setInView] = useState(true);
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // Without IntersectionObserver, stay on — never risk a frozen hero.
    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      // Resume slightly before the hero scrolls back in, so the first visible
      // frame is already current rather than a stale one.
      { rootMargin: "200px" },
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={hostRef} className="absolute inset-0">
      <Canvas
        camera={{ position: INITIAL_CAMERA, fov: 55, near: 0.1, far: 600 }}
        /**
         * Render at CSS pixel density. These surfaces are procedurally shaded
         * with multi-octave noise, so cost scales directly with pixel count —
         * DPR 1.5 means 2.25x the fragment work. On this scene that is the
         * single largest performance lever, and MSAA already handles the edges.
         */
        dpr={1}
        /**
         * Suspended while scrolled away. Flight animations run on GSAP's own
         * ticker (see useFlyTo), not useFrame, so pausing rendering cannot
         * desync flight state; and CameraRig damps toward the flight anchors
         * rather than copying them, so resuming eases back in instead of
         * snapping.
         */
        frameloop={inView ? "always" : "never"}
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
    </div>
  );
}
