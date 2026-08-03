import type { Project } from "@/lib/types";

export function CaseStudyBody({ project }: { project: Project }) {
  if (!project.caseStudy) return null;

  const { problem, approach, outcome } = project.caseStudy;

  return (
    <div className="space-y-6">
      {/* Problem */}
      <div>
        <h4 className="font-mono text-xs uppercase tracking-widest text-accent mb-2">
          Problem
        </h4>
        <p className="text-ink-muted leading-relaxed">{problem}</p>
      </div>

      {/* Approach */}
      <div>
        <h4 className="font-mono text-xs uppercase tracking-widest text-accent mb-2">
          Approach
        </h4>
        <ul className="space-y-1.5">
          {approach.map((step, i) => (
            <li key={i} className="flex gap-2 text-ink-muted leading-relaxed">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent-deep" aria-hidden="true" />
              {step}
            </li>
          ))}
        </ul>
      </div>

      {/* Outcome */}
      <div>
        <h4 className="font-mono text-xs uppercase tracking-widest text-accent mb-2">
          Outcome
        </h4>
        <ul className="space-y-1.5">
          {outcome.map((result, i) => (
            <li key={i} className="flex gap-2 text-ink leading-relaxed">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden="true" />
              {result}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
