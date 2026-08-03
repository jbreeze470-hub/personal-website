import type { Project } from "@/lib/types";
import { TagRow } from "@/components/ui/Tag";

export function ProjectCard({ project }: { project: Project }) {
  return (
    <article className="flex flex-col gap-4 rounded-xl border border-edge bg-surface/70 backdrop-blur-sm p-6 transition-colors hover:border-edge-bright">
      <div>
        {/* h4: cards render beneath the "Other work" h3 in Projects.tsx */}
        <h4 className="text-lg font-semibold text-ink">{project.title}</h4>
        <p className="mt-0.5 font-mono text-xs text-ink-dim">
          {project.context} &middot; {project.period}
        </p>
      </div>

      <p className="text-sm text-ink-muted leading-relaxed">{project.blurb}</p>

      <TagRow items={project.tech} />

      {project.links.length > 0 && (
        <ul className="flex flex-wrap gap-3">
          {project.links.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                {...(link.external
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
                className="font-mono text-xs text-accent hover:text-accent-bright transition-colors underline underline-offset-4"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
