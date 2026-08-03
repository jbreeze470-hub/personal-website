import { profile } from "@/content/profile";
import { Container } from "@/components/ui/Container";
import type { Link } from "@/lib/types";

export function ClassicHero() {
  return (
    <section
      className="starfield-fallback relative min-h-screen flex flex-col items-center justify-center"
      aria-label="Introduction"
    >
      {/* Content layer sits above the starfield */}
      <Container className="relative z-10 flex flex-col items-center text-center py-32">
        {/* Eyebrow — orbital motif */}
        <p className="font-mono text-xs text-accent tracking-[0.25em] uppercase mb-6 select-none">
          <span aria-hidden="true">◈</span>
          <span className="mx-3 text-ink-dim">43°15′N · 79°52′W</span>
          <span aria-hidden="true">◈</span>
        </p>

        {/* Name — single h1 for the page */}
        <h1 className="font-sans text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight text-ink mb-4 leading-none">
          {profile.name}
        </h1>

        {/* Tagline */}
        <p className="font-sans text-xl sm:text-2xl text-accent-bright mb-6 max-w-xl leading-snug">
          {profile.tagline}
        </p>

        {/* Hook — tight supporting line, not the full blurb */}
        <p className="font-sans text-base text-ink-muted max-w-lg mb-10 leading-relaxed">
          CS student at McMaster. Recently at Microsoft. Interested in the
          intersection of solid engineering and machine learning.
        </p>

        {/* Primary CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-14">
          <a
            href="#projects"
            className="font-mono text-sm bg-accent text-void px-6 py-3 rounded hover:bg-accent-bright transition-colors tracking-wide"
          >
            View projects
          </a>
          <a
            href="#contact"
            className="font-mono text-sm border border-accent text-accent px-6 py-3 rounded hover:bg-accent hover:text-void transition-colors tracking-wide"
          >
            Get in touch
          </a>
        </div>

        {/* Secondary links row */}
        <ul className="flex flex-wrap items-center justify-center gap-5" role="list" aria-label="Social and contact links">
          {profile.links.map((link: Link) => (
            <li key={link.label}>
              <a
                href={link.href}
                {...(link.external
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
                className="font-mono text-xs text-ink-dim hover:text-accent transition-colors tracking-wide uppercase"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </Container>

      {/* Scroll cue */}
      <div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-ink-dim pointer-events-none select-none"
        aria-hidden="true"
      >
        <span className="font-mono text-[10px] tracking-[0.2em] uppercase">Scroll</span>
        <svg
          width="16"
          height="20"
          viewBox="0 0 16 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="animate-bounce"
        >
          <path
            d="M8 1v14M2 10l6 7 6-7"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </section>
  );
}
