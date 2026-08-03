import { experience } from "@/content/experience";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { TagRow } from "@/components/ui/Tag";

export function Experience() {
  return (
    <section id="experience" aria-labelledby="experience-heading" className="py-24">
      <Container>
        <SectionHeading eyebrow="Experience" title="Where I've worked" />

        <ol className="relative space-y-12">
          {experience.map((entry) => (
            <li key={entry.id} className="relative pl-8">
              {/* Timeline line */}
              <span
                className="absolute left-0 top-2 h-full w-px bg-edge"
                aria-hidden="true"
              />
              {/* Dot */}
              <span
                className="absolute left-[-4px] top-2 h-2 w-2 rounded-full bg-accent"
                aria-hidden="true"
              />

              <div className="flex flex-wrap items-start gap-3 mb-1">
                <h3 className="text-base font-semibold text-ink leading-snug">
                  {entry.role}
                </h3>
                {entry.current && (
                  <span className="inline-flex items-center rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 font-mono text-xs text-accent">
                    Current
                  </span>
                )}
              </div>

              <p className="text-sm text-ink-muted mb-1">
                {entry.organization}
                <span className="mx-2 text-ink-dim" aria-hidden="true">·</span>
                {entry.location}
              </p>

              <p className="font-mono text-xs text-ink-dim mb-4">
                {entry.period}
              </p>

              {entry.highlights.length > 0 && (
                <ul className="space-y-2 mb-4">
                  {entry.highlights.map((point, i) => (
                    <li
                      key={i}
                      className="text-sm text-ink-muted flex gap-3 leading-relaxed"
                    >
                      <span
                        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-edge-bright"
                        aria-hidden="true"
                      />
                      {point}
                    </li>
                  ))}
                </ul>
              )}

              <TagRow items={entry.tech} />
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
