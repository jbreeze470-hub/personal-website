"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useSiteStore } from "@/lib/store";

/** Frames to let settle after compilation before revealing the scene. */
const SETTLE_FRAMES = 2;

/**
 * Holds the hero in its loading state until the scene is genuinely ready.
 *
 * Materials in three.js compile their shaders lazily, on the first frame each
 * one is actually drawn. Left alone that means objects pop into view one at a
 * time as their programs finish — which looks like the page is broken.
 *
 * So on mount we force every material in the scene to compile up front
 * (`compileAsync` uses KHR_parallel_shader_compile where available, so it does
 * not block the main thread), then wait a few frames for the first draws to
 * settle before flipping `sceneReady`.
 *
 * Renders nothing.
 */
export function SceneReadyProbe() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const setShadersCompiled = useSiteStore((s) => s.setShadersCompiled);

  const compiled = useRef(false);
  const frames = useRef(0);
  const done = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function precompile() {
      try {
        // compileAsync resolves once the GPU reports the programs are linked.
        await gl.compileAsync(scene, camera);
      } catch {
        // Older/odd drivers may not support the async path — the synchronous
        // compile still guarantees the programs exist before we reveal.
        try {
          gl.compile(scene, camera);
        } catch {
          // If compilation cannot be forced at all, fall through: the frame
          // counter below still gives materials time to compile lazily.
        }
      }
      if (!cancelled) compiled.current = true;
    }

    void precompile();

    return () => {
      cancelled = true;
      // Leaving immersive mode unmounts the canvas; make sure a later return
      // waits for a fresh compile rather than showing a half-built scene.
      setShadersCompiled(false);
    };
  }, [gl, scene, camera, setShadersCompiled]);

  useFrame(() => {
    if (done.current || !compiled.current) return;
    frames.current += 1;
    if (frames.current >= SETTLE_FRAMES) {
      done.current = true;
      setShadersCompiled(true);
    }
  });

  return null;
}
