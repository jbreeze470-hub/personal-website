/**
 * Shared type contracts. Authored in Wave 0 — subagents build against these
 * and must not modify this file.
 */

export type DestinationId =
  | "station"
  | "stock-predictor"
  | "blackprint"
  | "black-hole";

export type ViewMode = "immersive" | "classic";

export type Quality = "high" | "low";

export interface Link {
  label: string;
  href: string;
  external?: boolean;
}

export interface Profile {
  name: string;
  tagline: string;
  blurb: string;
  location: string;
  email: string;
  phone: string;
  links: Link[];
}

export interface Education {
  school: string;
  degree: string;
  minor?: string;
  location: string;
  graduation: string;
  gpa: string;
  awards: string[];
}

export interface Experience {
  id: string;
  role: string;
  organization: string;
  location: string;
  period: string;
  current: boolean;
  highlights: string[];
  tech: string[];
}

/** Long-form narrative shown in a project overlay or detail section. */
export interface CaseStudy {
  problem: string;
  approach: string[];
  outcome: string[];
}

export interface ProjectMedia {
  /** Poster image shown before the video loads. */
  poster: string;
  /** Demo video source. Placeholder until real captures land. */
  video?: string;
  /** True while the asset is a stand-in. */
  placeholder: boolean;
}

export interface Project {
  id: string;
  title: string;
  blurb: string;
  context: string;
  period: string;
  tech: string[];
  /** Featured projects get a planet and a full case study. */
  featured: boolean;
  destination?: DestinationId;
  media?: ProjectMedia;
  caseStudy?: CaseStudy;
  links: Link[];
}

export interface SkillGroup {
  label: string;
  items: string[];
}
