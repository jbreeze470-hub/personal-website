import type { Profile, Education } from "@/lib/types";

/**
 * TODO(nana): swap these placeholders once the real URLs are ready.
 * Search for "PLACEHOLDER" across src/content to find every one.
 */
export const PLACEHOLDER_GITHUB = "https://github.com/jbreeze470-hub";
export const PLACEHOLDER_BLACKPRINT = "https://blackprint.example.com";

export const profile: Profile = {
  name: "Nana Appiagyei Poku",
  tagline: "I build full-stack products and applied AI systems.",
  blurb:
    "Computer Science student at McMaster University. Most recently a software engineering intern at Microsoft, where I shipped full-stack features for a product serving over 500 million users. Before that I researched neural network compression, cutting weight matrix storage by 20% with no loss in accuracy. I like problems that sit between solid engineering and machine learning.",
  location: "Hamilton, ON, Canada",
  email: "appiagyeipoku470@gmail.com",
  phone: "365-476-3860",
  links: [
    {
      label: "GitHub",
      href: PLACEHOLDER_GITHUB,
      external: true,
    },
    {
      label: "LinkedIn",
      href: "https://linkedin.com/in/nanaappiagyeipoku",
      external: true,
    },
    {
      label: "Email",
      href: "mailto:appiagyeipoku470@gmail.com",
    },
  ],
};

export const education: Education = {
  school: "McMaster University",
  degree: "Bachelor of Applied Science in Computer Science",
  minor: "Minor in Finance",
  location: "Hamilton, ON",
  graduation: "Expected April 2028",
  gpa: "3.5 / 4.0",
  awards: [
    "ACCPI Award",
    "John C. Holland Award — Black Community Leadership and Academic Excellence",
  ],
};

export const coursework: string[] = [
  "Data Structures",
  "Algorithms",
  "Software Design",
  "Object-Oriented Programming (Java)",
  "Web Development",
  "Internet Protocols (TCP/IP)",
  "Machine Learning",
  "Linear Algebra",
  "Probability & Statistics",
  "Differential Equations",
];
