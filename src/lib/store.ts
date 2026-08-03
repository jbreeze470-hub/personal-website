"use client";

import { create } from "zustand";
import type { DestinationId, Quality, ViewMode } from "./types";

/**
 * Shared state bridge between the 3D scene, the flight controller, and the
 * DOM overlay layer. Authored in Wave 0 — subagents consume this and must not
 * change its shape.
 *
 * Flow: user clicks a planet -> flyTo(id) sets isFlying
 *       -> flight controller animates, calls arrive() on completion
 *       -> arrive() opens the overlay for the active destination.
 */
interface SiteState {
  /** Where the ship currently is, or is heading. */
  destination: DestinationId;
  /** True while the camera/ship animation is running. */
  isFlying: boolean;
  /** True when a project overlay panel is open. */
  overlayOpen: boolean;
  /** immersive = 3D scene mounted. classic = static fallback. */
  mode: ViewMode;
  /** Rendering budget, downgraded by the FPS sampler. */
  quality: Quality;
  /** True once the user has explicitly chosen a mode (never auto-override). */
  modeLocked: boolean;
  /**
   * True once every material in the scene has compiled. The hero waits on
   * this before revealing, so nothing pops in as its shader finishes; and the
   * FPS sampler waits on it before measuring, since compilation stalls frames
   * and sampling through it reads as "slow device" on capable hardware.
   */
  shadersCompiled: boolean;

  flyTo: (destination: DestinationId) => void;
  arrive: () => void;
  closeOverlay: () => void;
  returnToStation: () => void;
  setMode: (mode: ViewMode, options?: { lock?: boolean }) => void;
  setQuality: (quality: Quality) => void;
  setShadersCompiled: (compiled: boolean) => void;
}

export const useSiteStore = create<SiteState>((set, get) => ({
  destination: "station",
  isFlying: false,
  overlayOpen: false,
  mode: "classic",
  quality: "high",
  modeLocked: false,
  shadersCompiled: false,

  flyTo: (destination) => {
    if (get().destination === destination && get().overlayOpen) return;
    set({ destination, isFlying: true, overlayOpen: false });
  },

  arrive: () =>
    set((state) => ({
      isFlying: false,
      overlayOpen: state.destination !== "station",
    })),

  closeOverlay: () => set({ overlayOpen: false }),

  returnToStation: () =>
    set({ destination: "station", isFlying: true, overlayOpen: false }),

  setMode: (mode, options) =>
    set((state) => ({
      mode,
      modeLocked: options?.lock ?? state.modeLocked,
      ...(mode === "classic"
        ? {
            overlayOpen: false,
            isFlying: false,
            destination: "station" as const,
            // The canvas unmounts, so a later return must wait for a fresh
            // compile rather than revealing a half-built scene.
            shadersCompiled: false,
          }
        : {}),
    })),

  setQuality: (quality) => set({ quality }),

  setShadersCompiled: (shadersCompiled) => set({ shadersCompiled }),
}));
