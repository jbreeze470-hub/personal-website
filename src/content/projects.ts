import type { Project } from "@/lib/types";
import { PLACEHOLDER_BLACKPRINT, PLACEHOLDER_GITHUB } from "./profile";

/**
 * Featured projects map to planets in the 3D scene.
 * Everything else lives at the black hole ("no demo video yet").
 * Media paths are placeholders until real captures land.
 */
export const projects: Project[] = [
  {
    id: "stock-predictor",
    title: "Stock Predictor",
    blurb:
      "A stock forecasting model built on engineered technical indicators, improving accuracy 12% over baseline.",
    context: "Personal project",
    period: "2025",
    featured: true,
    destination: "stock-predictor",
    tech: [
      "Python",
      "TensorFlow",
      "PyTorch",
      "Pandas",
      "Tkinter",
      "Matplotlib",
      "Plotly",
      "Seaborn",
    ],
    media: {
      poster: "/media/stock-predictor-poster.svg",
      video: "/media/stock-predictor-demo.mp4",
      placeholder: false,
    },
    caseStudy: {
      problem:
        "Raw price history is a weak predictor on its own. I wanted to test how much forecast accuracy improves when the model is fed engineered technical indicators instead of just closing prices.",
      approach: [
        "Pulled historical market data from the Yahoo Finance and Alpha Vantage APIs.",
        "Engineered technical features — RSI, MACD, and moving averages — rather than training on raw price series.",
        "Built and compared models in TensorFlow and PyTorch against a baseline.",
        "Wrapped the pipeline in a Tkinter desktop interface so predictions could be run without touching code.",
        "Visualized trends and model behaviour with Matplotlib, Plotly, and Seaborn.",
      ],
      outcome: [
        "Improved forecast accuracy by 12% over baseline models.",
        "Produced a repeatable feature-engineering pipeline that made the effect of each indicator measurable.",
      ],
    },
    links: [{ label: "GitHub", href: PLACEHOLDER_GITHUB, external: true }],
  },
  {
    id: "blackprint",
    title: "Blackprint",
    blurb:
      "A responsive, WCAG 2.1 accessible website I build and maintain in production.",
    context: "Blackprint — Website Developer",
    period: "Aug 2025 – Present",
    featured: true,
    destination: "blackprint",
    tech: ["TypeScript", "JavaScript", "HTML", "CSS", "Bootstrap", "WCAG 2.1"],
    media: {
      poster: "/media/blackprint-poster.svg",
      video: "/media/blackprint-demo.mp4",
      placeholder: false,
    },
    caseStudy: {
      problem:
        "Blackprint needed a site that works for everyone — across screen sizes and for users relying on assistive technology — not just a design that looks right on a laptop.",
      approach: [
        "Built responsive pages in TypeScript, JavaScript, HTML, CSS, and Bootstrap.",
        "Held the build to WCAG 2.1 accessibility standards throughout.",
        "Developed interactive components — navigation menus, forms, and modals — in TypeScript.",
        "Maintain the site on an ongoing basis rather than shipping once and walking away.",
      ],
      outcome: [
        "Delivers a consistent experience across devices.",
        "Improved usability and engagement through the interactive component work.",
      ],
    },
    links: [
      { label: "Live site", href: PLACEHOLDER_BLACKPRINT, external: true },
    ],
  },
  {
    id: "accessibility-web-app",
    title: "Accessibility-Based Web App",
    blurb:
      "Real-time speech translation with 95%+ accuracy across multiple languages, plus tone classification.",
    context: "DeltaHacks XI",
    period: "2025",
    featured: false,
    tech: ["Python", "JavaScript", "Whisper API"],
    caseStudy: {
      problem:
        "Live conversation across languages is a hard accessibility gap, especially when tone carries meaning that a literal translation loses.",
      approach: [
        "Implemented real-time speech translation using the Whisper API.",
        "Built a tone-classification feature for nuanced sentiment detection.",
        "Kept audio-to-text processing low-latency so the experience stayed conversational.",
      ],
      outcome: [
        "Achieved 95%+ translation accuracy across multiple languages.",
        "Built at DeltaHacks XI under hackathon time constraints.",
      ],
    },
    links: [{ label: "GitHub", href: PLACEHOLDER_GITHUB, external: true }],
  },
  {
    id: "ar-try-on",
    title: "Augmented Reality Try-On",
    blurb:
      "A real-time AR garment try-on using pose estimation and body-landmark tracking.",
    context: "Personal project",
    period: "2025",
    featured: false,
    tech: ["React", "Python", "OpenCV", "MediaPipe"],
    caseStudy: {
      problem:
        "Online clothing shopping gives you no sense of fit. I wanted to test whether commodity pose estimation was good enough to anchor garments to a body in real time.",
      approach: [
        "Used MediaPipe pose estimation and body-landmark tracking to anchor garments to the user.",
        "Integrated OpenCV camera processing with a React frontend.",
        "Built catalog view, garment selection, and live preview into the UI.",
      ],
      outcome: [
        "Produced a working real-time try-on experience driven by a standard webcam.",
      ],
    },
    links: [{ label: "GitHub", href: PLACEHOLDER_GITHUB, external: true }],
  },
];

export const featuredProjects = projects.filter((p) => p.featured);
export const otherProjects = projects.filter((p) => !p.featured);

export function getProject(id: string): Project | undefined {
  return projects.find((p) => p.id === id);
}
