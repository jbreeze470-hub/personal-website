"use client";

import { useEffect, useState } from "react";
import { profile } from "@/content/profile";
import { NAV_SECTIONS } from "@/lib/nav";
import { Container } from "@/components/ui/Container";
import { useSiteStore } from "@/lib/store";

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const overlayOpen = useSiteStore((s) => s.overlayOpen);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const initials = profile.name
    .split(" ")
    .map((n) => n[0])
    .join("");

  return (
    <header
      className={[
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-void/90 backdrop-blur-md border-b border-edge"
          : "bg-transparent",
        // The project panel is a focus-trapped modal, so this nav is
        // unreachable while it is open. Hide it rather than paint it on top.
        overlayOpen
          ? "pointer-events-none -translate-y-full opacity-0"
          : "translate-y-0 opacity-100",
      ].join(" ")}
      aria-hidden={overlayOpen || undefined}
      inert={overlayOpen || undefined}
    >
      {/* Skip to main content — accessibility requirement */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[70] focus:rounded focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-mono focus:text-void focus:outline-none"
      >
        Skip to content
      </a>

      <Container className="flex items-center justify-between h-16">
        {/* Logotype */}
        <a
          href="#"
          aria-label={`${profile.name} — back to top`}
          className="font-mono text-sm font-medium text-ink tracking-widest hover:text-accent transition-colors"
        >
          {initials}
          <span className="text-accent">.</span>
        </a>

        {/* Desktop nav */}
        <nav aria-label="Site navigation" className="hidden md:flex items-center gap-6">
          {NAV_SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="font-mono text-xs text-ink-muted hover:text-ink transition-colors tracking-wide uppercase"
            >
              {section.label}
            </a>
          ))}
        </nav>

        {/* Mobile nav — minimal */}
        <nav aria-label="Site navigation mobile" className="flex md:hidden items-center gap-4">
          <a
            href="#projects"
            className="font-mono text-xs text-ink-muted hover:text-ink transition-colors tracking-wide"
          >
            Projects
          </a>
          <a
            href="#contact"
            className="font-mono text-xs border border-accent text-accent px-3 py-1.5 rounded hover:bg-accent hover:text-void transition-colors tracking-wide"
          >
            Contact
          </a>
        </nav>
      </Container>
    </header>
  );
}
