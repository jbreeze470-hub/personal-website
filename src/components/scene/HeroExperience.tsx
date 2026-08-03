"use client";

import dynamic from "next/dynamic";
import { useSiteStore } from "@/lib/store";
import { ClassicHero } from "@/components/layout/ClassicHero";
import { DestinationOverlay } from "@/components/overlay/DestinationOverlay";
import { profile } from "@/content/profile";
import { PLANET_DESTINATIONS } from "@/lib/destinations";
import { SceneLoader } from "@/components/scene/SceneLoader";

/**
 * Three.js is several hundred KB. Loading it dynamically with ssr:false means
 * classic-mode visitors never download the 3D bundle at all.
 *
 * No `loading` fallback here on purpose: HeroExperience already renders
 * <SceneLoader /> for the whole pre-ready window, covering both the chunk
 * fetch and the shader compile. Supplying one here too mounted two copies of
 * the skeletons on top of each other, doubling their opacity.
 */
const SceneCanvas = dynamic(
  () => import("@/components/scene/SceneCanvas").then((m) => m.SceneCanvas),
  {
    ssr: false,
    loading: () => null,
  },
);

export function HeroExperience() {
  const mode = useSiteStore((s) => s.mode);
  const flyTo = useSiteStore((s) => s.flyTo);
  const returnToStation = useSiteStore((s) => s.returnToStation);
  const destination = useSiteStore((s) => s.destination);
  const isFlying = useSiteStore((s) => s.isFlying);
  const shadersCompiled = useSiteStore((s) => s.shadersCompiled);

  // Reveal as soon as the shaders are linked. The device calibration runs
  // afterwards, in view — which is fine now that the sampler waits for
  // compilation before measuring, so it no longer misreads capable hardware
  // as slow and downgrades it.
  const sceneReady = shadersCompiled;

  if (mode === "classic") {
    return <ClassicHero />;
  }

  return (
    <section
      className="relative h-screen w-full overflow-hidden"
      aria-label="Interactive project galaxy"
    >
      {/* The canvas mounts immediately so it can compile, but stays invisible
          until every material is linked — otherwise objects pop into view one
          at a time as their shaders finish. */}
      <div
        className={[
          "absolute inset-0 transition-opacity duration-500 ease-out",
          sceneReady ? "opacity-100" : "opacity-0",
        ].join(" ")}
      >
        <SceneCanvas />
      </div>

      {!sceneReady && <SceneLoader />}

      {/* HUD — keeps the portfolio readable even while the scene is the hero. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 pt-28">
        <div className="mx-auto w-full max-w-5xl px-6 sm:px-8">
          <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            {profile.name}
          </h1>
          <p className="mt-3 max-w-xl text-lg text-accent-bright">
            {profile.tagline}
          </p>
          <p className="mt-4 font-mono text-xs uppercase tracking-[0.2em] text-ink-dim">
            {!sceneReady
              ? "Preparing flight systems…"
              : isFlying
                ? "In transit…"
                : "Select a destination to explore"}
          </p>
        </div>
      </div>

      {/* Keyboard-accessible equivalent of clicking a planet. Hidden until the
          scene exists — offering travel to a galaxy that has not rendered yet
          would just queue a flight nobody can see. */}
      <nav
        className={[
          "absolute inset-x-0 bottom-8 z-10 flex flex-wrap items-center justify-center gap-3 px-6",
          "transition-opacity duration-500",
          sceneReady ? "opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
        aria-label="Project destinations"
        aria-hidden={sceneReady ? undefined : true}
      >
        {PLANET_DESTINATIONS.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => flyTo(d.id)}
            tabIndex={sceneReady ? undefined : -1}
            aria-current={destination === d.id ? "true" : undefined}
            className={[
              "rounded border px-3 py-2 font-mono text-xs backdrop-blur transition-colors",
              destination === d.id
                ? "border-accent-deep bg-surface/90 text-accent"
                : "border-edge bg-surface/80 text-ink-muted hover:border-accent-deep hover:text-accent",
            ].join(" ")}
          >
            {d.label}
          </button>
        ))}

        {/* Always offer the way home. Disabled at the station so the control
            never pretends to do something it will not. */}
        <button
          type="button"
          onClick={returnToStation}
          disabled={destination === "station"}
          tabIndex={sceneReady ? undefined : -1}
          className={[
            "rounded border px-3 py-2 font-mono text-xs backdrop-blur transition-colors",
            destination === "station"
              ? "cursor-not-allowed border-edge/60 bg-surface/40 text-ink-dim/60"
              : "border-accent-deep bg-surface/80 text-accent hover:bg-accent hover:text-void",
          ].join(" ")}
        >
          ← Station
        </button>
      </nav>

      <DestinationOverlay />
    </section>
  );
}
