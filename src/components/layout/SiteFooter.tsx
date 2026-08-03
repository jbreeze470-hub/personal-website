import { profile } from "@/content/profile";
import { Container } from "@/components/ui/Container";
import type { Link } from "@/lib/types";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-edge bg-space/60 backdrop-blur-sm">
      <Container className="py-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          {/* Left: name + tagline */}
          <div>
            <p className="font-mono text-sm text-ink tracking-wide">{profile.name}</p>
            <p className="font-sans text-xs text-ink-dim mt-1">
              © {year} — built with Next.js &amp; Tailwind CSS
            </p>
          </div>

          {/* Right: links */}
          <ul
            className="flex flex-wrap items-center gap-5"
            role="list"
            aria-label="Footer links"
          >
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
        </div>
      </Container>
    </footer>
  );
}
