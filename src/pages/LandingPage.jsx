import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import ProblemSection from "../components/ProblemSection";
import PlatformWorkflow from "../components/PlatformWorkflow";
import CoreCapabilities from "../components/CoreCapabilities";
import ModelArchitecture from "../components/ModelArchitecture";
import ForecastVisualization from "../components/ForecastVisualization";
import HowItWorks from "../components/HowItWorks";
import AIAssistantPreview from "../components/AIAssistantPreview";
import TechnologyStack from "../components/TechnologyStack";
import ProjectPurpose from "../components/ProjectPurpose";
import FinalCTA from "../components/FinalCTA";
import Footer from "../components/Footer";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <main>
        <Hero />
        <ProblemSection />
        <PlatformWorkflow />
        <CoreCapabilities />
        <ModelArchitecture />
        <ForecastVisualization />
        <HowItWorks />
        <AIAssistantPreview />
        <TechnologyStack />
        <ProjectPurpose />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
