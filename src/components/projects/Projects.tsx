import { featuredProjects, otherProjects } from "@/content/projects";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { TagRow } from "@/components/ui/Tag";
import { ProjectMediaFrame } from "./ProjectMediaFrame";
import { CaseStudyBody } from "./CaseStudyBody";
import { ProjectCard } from "./ProjectCard";

export function Projects() {
  return (
    <section id="projects" className="py-24">
      <Container>
        <SectionHeading
          eyebrow="Projects"
          title="Selected work"
          description="Two featured projects with full case studies. Two more compact entries below."
        />

        {/* Featured projects */}
        <div className="space-y-24">
          {featuredProjects.map((project, index) => (
            <article
              key={project.id}
              id={`project-${project.id}`}
              className="scroll-mt-24"
            >
              {/* Title + meta */}
              <header className="mb-6">
                <h3 className="text-2xl font-semibold text-ink sm:text-3xl">
                  {project.title}
                </h3>
                <p className="mt-1 font-mono text-xs text-ink-dim">
                  {project.context} &middot; {project.period}
                </p>
                <p className="mt-3 max-w-2xl text-ink-muted leading-relaxed">
                  {project.blurb}
                </p>
              </header>

              {/* Demo media */}
              <div className="mb-8">
                <ProjectMediaFrame project={project} />
              </div>

              {/* Case study narrative */}
              {project.caseStudy && (
                <div className="mb-8 rounded-xl border border-edge bg-surface/70 backdrop-blur-sm p-6">
                  <CaseStudyBody project={project} />
                </div>
              )}

              {/* Tech tags */}
              <div className="mb-6">
                <TagRow items={project.tech} />
              </div>

              {/* Links */}
              {project.links.length > 0 && (
                <ul className="flex flex-wrap gap-4">
                  {project.links.map((link) => (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        {...(link.external
                          ? { target: "_blank", rel: "noopener noreferrer" }
                          : {})}
                        className="font-mono text-sm text-accent hover:text-accent-bright transition-colors underline underline-offset-4"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}

              {/* Divider between featured projects */}
              {index < featuredProjects.length - 1 && (
                <hr className="mt-24 border-edge" />
              )}
            </article>
          ))}
        </div>

        {/* Other work */}
        <div className="mt-24">
          <h3 className="mb-8 text-lg font-semibold text-ink">Other work</h3>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {otherProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
