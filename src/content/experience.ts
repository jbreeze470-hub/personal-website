import type { Experience } from "@/lib/types";

export const experience: Experience[] = [
  {
    id: "microsoft",
    role: "Software Engineering Intern",
    organization: "Microsoft",
    location: "Redmond, WA",
    period: "Summer 2026",
    current: false,
    highlights: [
      "Built and shipped full-stack features for a product serving 500M+ users using TypeScript, React, TanStack Query, and Redux.",
      "Improved reliability and scalability of production services by writing, reviewing, and debugging code with Git, CI/CD pipelines, and Agile workflows.",
      "Designed a more efficient data-loading strategy that improved query speed by 50% over the original plan while fetching 10x more data.",
    ],
    tech: ["TypeScript", "React", "TanStack Query", "Redux", "CI/CD", "Git"],
  },
  {
    id: "mcmaster-software-labs",
    role: "Machine Learning Research Assistant (Co-op)",
    organization: "McMaster Swiftware Labs",
    location: "Hamilton, ON",
    period: "Apr 2025 – Sep 2025",
    current: false,
    highlights: [
      "Reduced neural network weight matrix storage by 20% with no loss in model accuracy by designing custom matrix compression algorithms.",
      "Built Python data-analysis pipelines (Pandas, Matplotlib, Seaborn) that quantified entropy, variance, and distributions to guide compression decisions.",
      "Identified statistical patterns in neural-network weights that improved storage and compression efficiency.",
    ],
    tech: ["Python", "Pandas", "Matplotlib", "Seaborn", "NumPy"],
  },
  {
    id: "blackprint",
    role: "Website Developer",
    organization: "Blackprint",
    location: "Hamilton, ON",
    period: "Aug 2025 – Present",
    current: true,
    highlights: [
      "Build responsive, WCAG 2.1 accessible web pages using TypeScript, JavaScript, HTML, CSS, and Bootstrap that deliver a consistent experience across devices.",
      "Improve usability and engagement by developing interactive components — navigation menus, forms, and modals — in TypeScript.",
    ],
    tech: ["TypeScript", "JavaScript", "HTML", "CSS", "Bootstrap", "WCAG 2.1"],
  },
  {
    id: "nsbe",
    role: "Membership Chair",
    organization: "National Society of Black Engineers",
    location: "Hamilton, ON",
    period: "Sep 2024 – Present",
    current: true,
    highlights: [
      "Coordinate logistics, mentorship, and alumni networking for an equity, diversity, and inclusion engineering summit serving 100+ attendees.",
    ],
    tech: [],
  },
];
