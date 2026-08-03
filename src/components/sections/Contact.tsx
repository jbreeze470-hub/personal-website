import { profile } from "@/content/profile";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";

export function Contact() {
  return (
    <section id="contact" aria-labelledby="contact-heading" className="py-24">
      <Container>
        <SectionHeading
          eyebrow="Contact"
          title="Get in touch"
          description="Open to internship and new-grad opportunities in full-stack, backend, and applied AI/ML. Feel free to reach out."
        />

        <a
          href={`mailto:${profile.email}`}
          className="inline-block text-2xl font-mono text-accent hover:text-accent-bright transition-colors mb-10"
        >
          {profile.email}
        </a>

        <p className="font-mono text-xs text-ink-dim mb-6 uppercase tracking-widest">
          {profile.location}
        </p>

        <nav aria-label="Social and professional links">
          <ul className="flex flex-wrap gap-4">
            {profile.links.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  className="font-mono text-sm text-ink-muted border border-edge rounded-md px-4 py-2 hover:border-edge-bright hover:text-ink transition-colors"
                  {...(link.external
                    ? {
                        target: "_blank",
                        rel: "noopener noreferrer",
                      }
                    : {})}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </Container>
    </section>
  );
}
