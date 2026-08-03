import { skills } from "@/content/skills";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { TagRow } from "@/components/ui/Tag";

export function Skills() {
  return (
    <section id="skills" aria-labelledby="skills-heading" className="py-24">
      <Container>
        <SectionHeading eyebrow="Skills" title="Technical proficiencies" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          {skills.map((group) => (
            <div key={group.label}>
              <h3 className="font-mono text-xs uppercase tracking-[0.15em] text-ink-dim mb-3">
                {group.label}
              </h3>
              <TagRow items={group.items} />
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
