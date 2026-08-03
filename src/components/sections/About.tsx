import { profile, education, coursework } from "@/content/profile";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { TagRow } from "@/components/ui/Tag";

export function About() {
  return (
    <section id="about" aria-labelledby="about-heading" className="py-24">
      <Container>
        <SectionHeading eyebrow="About" title="Background" />

        <p className="mb-12 max-w-3xl text-lg leading-relaxed text-ink-muted">
          {profile.blurb}
        </p>

        <div className="border border-edge bg-surface/70 backdrop-blur-sm rounded-xl p-6 max-w-2xl">
          <h3 className="text-base font-semibold text-ink mb-4">
            {education.school}
          </h3>

          <p className="text-ink-muted mb-1">{education.degree}</p>
          {education.minor && (
            <p className="text-ink-muted mb-4">{education.minor}</p>
          )}

          <dl className="grid grid-cols-2 gap-x-8 gap-y-2 mb-6 font-mono text-xs">
            <div>
              <dt className="text-ink-dim">Location</dt>
              <dd className="text-ink-muted mt-0.5">{education.location}</dd>
            </div>
            <div>
              <dt className="text-ink-dim">Graduation</dt>
              <dd className="text-ink-muted mt-0.5">{education.graduation}</dd>
            </div>
            <div>
              <dt className="text-ink-dim">GPA</dt>
              <dd className="text-ink-muted mt-0.5">{education.gpa}</dd>
            </div>
          </dl>

          {education.awards.length > 0 && (
            <div className="mb-6">
              <p className="font-mono text-xs text-ink-dim mb-2 uppercase tracking-widest">
                Awards
              </p>
              <ul className="space-y-1">
                {education.awards.map((award) => (
                  <li key={award} className="text-sm text-ink-muted flex gap-2">
                    <span className="text-accent select-none" aria-hidden="true">
                      —
                    </span>
                    {award}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="font-mono text-xs text-ink-dim mb-3 uppercase tracking-widest">
              Relevant Coursework
            </p>
            <TagRow items={coursework} />
          </div>
        </div>
      </Container>
    </section>
  );
}
