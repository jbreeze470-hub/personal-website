"use client";

import {
  useCallback,
  useEffect,
  useRef,
} from "react";
import { useSiteStore } from "@/lib/store";
import { DESTINATIONS } from "@/lib/destinations";
import { getProject, otherProjects } from "@/content/projects";
import type { DestinationId, Project } from "@/lib/types";
import { CaseStudyBody } from "@/components/projects/CaseStudyBody";
import { ProjectMediaFrame } from "@/components/projects/ProjectMediaFrame";
import { TagRow } from "@/components/ui/Tag";

// ---------------------------------------------------------------------------
// Focus trap helpers
// ---------------------------------------------------------------------------

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.closest("[aria-hidden='true']"),
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ExternalLinks({ links }: { links: Project["links"] }) {
  if (!links.length) return null;
  return (
    <ul className="flex flex-wrap gap-3">
      {links.map((link) => (
        <li key={link.href}>
          <a
            href={link.href}
            target={link.external ? "_blank" : undefined}
            rel={link.external ? "noopener noreferrer" : undefined}
            className="inline-flex items-center gap-1.5 rounded-full border border-edge-bright bg-surface-raised px-4 py-1.5 font-mono text-xs text-ink-muted transition-colors duration-150 hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {link.label}
            {link.external && (
              <svg
                aria-hidden="true"
                className="h-3 w-3"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M5 2H2v8h8V7M7 2h3v3M10 2 5.5 6.5" />
              </svg>
            )}
          </a>
        </li>
      ))}
    </ul>
  );
}

function ProjectContent({ project }: { project: Project }) {
  return (
    <div className="space-y-6">
      <ProjectMediaFrame project={project} />

      <p className="leading-relaxed text-ink-muted">{project.blurb}</p>

      {project.caseStudy && <CaseStudyBody project={project} />}

      {project.tech.length > 0 && (
        <div>
          <p className="mb-2 font-mono text-xs uppercase tracking-widest text-ink-dim">
            Tech
          </p>
          <TagRow items={project.tech} />
        </div>
      )}

      {project.links.length > 0 && (
        <div>
          <p className="mb-2 font-mono text-xs uppercase tracking-widest text-ink-dim">
            Links
          </p>
          <ExternalLinks links={project.links} />
        </div>
      )}
    </div>
  );
}

function BlackHoleContent() {
  return (
    <div className="space-y-8">
      <p className="text-ink-muted leading-relaxed">
        These projects don&apos;t have a recorded demo yet — but they&apos;re
        real work, shipped or competed. Video captures are coming.
      </p>

      <ul className="space-y-8">
        {otherProjects.map((project) => (
          <li
            key={project.id}
            className="rounded-xl border border-edge bg-surface-raised p-5 space-y-4"
          >
            <div>
              <h3 className="font-sans text-base font-semibold text-ink">
                {project.title}
              </h3>
              <p className="font-mono text-xs text-ink-dim mt-0.5">
                {project.context} · {project.period}
              </p>
            </div>

            <p className="text-sm leading-relaxed text-ink-muted">
              {project.blurb}
            </p>

            {project.tech.length > 0 && <TagRow items={project.tech} />}

            {project.links.length > 0 && (
              <ExternalLinks links={project.links} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

interface PanelProps {
  destination: DestinationId;
  onClose: () => void;
  onReturn: () => void;
  panelRef: React.RefObject<HTMLDivElement | null>;
  closeButtonRef: React.RefObject<HTMLButtonElement | null>;
}

function Panel({
  destination,
  onClose,
  onReturn,
  panelRef,
  closeButtonRef,
}: PanelProps) {
  const dest = DESTINATIONS[destination];
  const projectId = dest.projectId;
  const project = projectId ? getProject(projectId) : undefined;

  const isBlackHole = destination === "black-hole";
  const headingId = "overlay-heading";

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      className="pointer-events-auto flex flex-col bg-space border-l border-edge h-full w-full max-w-xl ml-auto"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-edge px-6 pt-7 pb-5 shrink-0">
        <div>
          <h2
            id={headingId}
            className="font-sans text-xl font-semibold text-ink"
          >
            {dest.label}
          </h2>
          {project && (
            <p className="font-mono text-xs text-ink-dim mt-1">
              {project.context} · {project.period}
            </p>
          )}
          {isBlackHole && (
            <p className="font-mono text-xs text-ink-dim mt-1">
              Unrecorded projects
            </p>
          )}
        </div>

        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 rounded-md p-1.5 text-ink-dim transition-colors duration-150 hover:bg-surface-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <svg
            aria-hidden="true"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M4 4l12 12M16 4 4 16" />
          </svg>
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {isBlackHole && <BlackHoleContent />}
        {!isBlackHole && project && <ProjectContent project={project} />}
        {!isBlackHole && !project && (
          <p className="text-ink-muted">No project data found.</p>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-edge px-6 py-4">
        <button
          type="button"
          onClick={onReturn}
          className="w-full rounded-lg border border-edge-bright bg-surface-raised px-4 py-2.5 font-mono text-sm text-ink-muted transition-colors duration-150 hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          ← Return to station
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function DestinationOverlay() {
  const overlayOpen = useSiteStore((s) => s.overlayOpen);
  const destination = useSiteStore((s) => s.destination);
  const closeOverlay = useSiteStore((s) => s.closeOverlay);
  const returnToStation = useSiteStore((s) => s.returnToStation);

  /**
   * The panel stays mounted and is driven purely by CSS transitions. Deriving
   * `open` rather than mirroring it into state avoids setState-in-effect
   * cascades and makes the exit animation work without an unmount timer.
   */
  const open = overlayOpen && destination !== "station";

  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Scroll lock + focus handoff for the lifetime of the open state.
  // Cleanup restores both, so unmount is covered too.
  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    // preventScroll: focusing an element inside a panel that is still sliding
    // in would otherwise scroll it into view mid-animation, fighting the
    // transform.
    closeButtonRef.current?.focus({ preventScroll: true });

    return () => {
      document.body.style.overflow = "";
      previousFocusRef.current?.focus({ preventScroll: true });
    };
  }, [open]);

  // Escape key + focus trap
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!panelRef.current) return;

      if (e.key === "Escape") {
        e.preventDefault();
        closeOverlay();
        return;
      }

      if (e.key === "Tab") {
        const focusable = getFocusable(panelRef.current);
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    },
    [closeOverlay],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown]);

  return (
    <div
      className={[
        // Above the site header (z-50) so the panel can never be painted over.
        "fixed inset-0 z-[60]",
        // Must not swallow clicks on the 3D scene while closed.
        open ? "" : "pointer-events-none",
      ].join(" ")}
      aria-hidden={open ? undefined : true}
    >
      {/* Backdrop */}
      <div
        className={[
          "absolute inset-0 bg-void/70",
          // Promoted so the fade composites on the GPU instead of repainting
          // while the 3D scene is already saturating it.
          "[will-change:opacity] transition-opacity duration-[440ms]",
          "ease-[cubic-bezier(0.22,1,0.36,1)]",
          open ? "opacity-100" : "opacity-0 pointer-events-none",
        ].join(" ")}
        onClick={closeOverlay}
        aria-hidden="true"
      />

      {/* One panel only: bottom sheet on mobile, right-hand drawer from sm up.
          Rendering it twice would make panelRef point at whichever copy mounted
          last, breaking the focus trap on the other breakpoint. */}
      <div
        className={[
          "absolute inset-x-0 bottom-0 h-[85dvh]",
          "sm:inset-y-0 sm:left-auto sm:right-0 sm:h-full sm:w-full sm:max-w-xl",
          /**
           * `will-change: transform` keeps the panel on its own compositor
           * layer, so the slide never triggers a repaint — it arrives at the
           * same moment the camera is re-framing and every planet shader is
           * still drawing, which is exactly when a repaint would stutter.
           *
           * Quintic ease-out over 440ms: most of the travel happens early and
           * it settles gently, which reads as deliberate rather than abrupt.
           * It also runs slightly longer than the camera's re-framing damp, so
           * the two motions finish together instead of one snapping first.
           */
          "[will-change:transform] transform-gpu",
          "transition-transform duration-[440ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
          open
            ? "translate-y-0 sm:translate-x-0"
            : "translate-y-full sm:translate-y-0 sm:translate-x-full",
        ].join(" ")}
      >
        {destination !== "station" && (
          <Panel
            destination={destination}
            onClose={closeOverlay}
            onReturn={returnToStation}
            panelRef={panelRef}
            closeButtonRef={closeButtonRef}
          />
        )}
      </div>
    </div>
  );
}
