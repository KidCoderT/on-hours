import { MotionConfig } from "motion/react";
import { useRelease } from "./lib/release";
import { ComingSoon } from "./sections/ComingSoon";
import { Download } from "./sections/Download";
import { Footer } from "./sections/Footer";
import { Header } from "./sections/Header";
import { Hero } from "./sections/Hero";
import { Idea } from "./sections/Idea";
import { Settings } from "./sections/Settings";
import { Styles } from "./sections/Styles";
import { Week } from "./sections/Week";

function App() {
  const release = useRelease();
  return (
    // reducedMotion="user": people who ask for less motion get fades only, no movement.
    <MotionConfig reducedMotion="user">
      <Header release={release} />
      <main>
        <Hero release={release} />
        <Idea />
        <Styles />
        <Week />
        <Settings />
        <Download release={release} />
        <ComingSoon />
      </main>
      <Footer release={release} />
    </MotionConfig>
  );
}

export default App;
