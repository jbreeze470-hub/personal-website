import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { HeroExperience } from "@/components/scene/HeroExperience";
import { CapabilityGate } from "@/components/fallback/CapabilityGate";
import { ViewModeToggle } from "@/components/fallback/ViewModeToggle";
import { About } from "@/components/sections/About";
import { Projects } from "@/components/projects/Projects";
import { Experience } from "@/components/sections/Experience";
import { Skills } from "@/components/sections/Skills";
import { Contact } from "@/components/sections/Contact";

export default function Home() {
  return (
    <>
      <CapabilityGate />
      <SiteHeader />
      <main id="main" className="flex-1">
        <HeroExperience />
        <About />
        <Projects />
        <Experience />
        <Skills />
        <Contact />
      </main>
      <SiteFooter />
      <ViewModeToggle />
    </>
  );
}
