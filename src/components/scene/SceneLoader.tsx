"use client";

import { useEffect, useState } from "react";
import { projectSceneBodies, type ProjectedBody } from "@/lib/projectScene";

/**
 * Loading state for the 3D hero.
 *
 * Rather than an unrelated spinner, this draws shimmering skeletons in the
 * projected position and size of each body, so the loading state has the shape
 * of the scene that is arriving. The page-wide starfield shows through, so the
 * only thing that changes on reveal is that the placeholders become planets.
 *
 * Used for BOTH loading phases — fetching the Three.js chunk and compiling its
 * shaders — so the two read as one continuous state.
 */
export function SceneLoader({
  label = "Initializing flight systems",
}: {
  label?: string;
}) {
  const [bodies, setBodies] = useState<ProjectedBody[]>([]);

  useEffect(() => {
    const measure = () =>
      setBodies(projectSceneBodies(window.innerWidth, window.innerHeight));
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {/* Skeletons sit where the real bodies will appear. */}
      <div aria-hidden="true">
        {bodies.map((b, i) => (
          <div
            key={b.id}
            className="shimmer-shape"
            style={{
              left: `${b.leftPct}%`,
              top: `${b.topPct}%`,
              width: `${b.sizePx}px`,
              height: `${b.sizePx}px`,
              transform: "translate(-50%, -50%)",
              // Stagger the sweeps so they do not pulse in lockstep.
              animationDelay: `${i * 180}ms`,
            }}
          />
        ))}
      </div>

      <div className="absolute inset-x-0 bottom-28 flex flex-col items-center gap-3">
        <div className="h-px w-40 overflow-hidden rounded bg-edge">
          <div className="h-full w-1/3 animate-pulse rounded bg-accent/70" />
        </div>
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-ink-dim">
          {label}
        </p>
      </div>
    </div>
  );
}
