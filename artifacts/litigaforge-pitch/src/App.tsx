import { useEffect } from "react";
import { Route, Switch, useLocation } from "wouter";
import { slides } from "./slideLoader";
import VideoTemplate from "./components/video/VideoTemplate";

function AllSlides() {
  return (
    <div>
      {slides.map((slide) => (
        <div
          key={slide.id}
          className="slide [&_.w-screen]:!w-full [&_.h-screen]:!h-full"
          style={{ width: 1920, height: 1080, overflow: "hidden", position: "relative" }}
        >
          <slide.Component />
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [location, navigate] = useLocation();

  // DO NOT edit — unknown-route redirect to main view
  useEffect(() => {
    const knownPaths = [
      "/allslides",
      "/",
      ...slides.map((_, i) => `/slide${i + 1}`),
    ];
    if (!knownPaths.includes(location)) {
      navigate("/");
    }
  }, [location]);

  // DO NOT edit — parent navigateToSlide postMessage listener
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data && e.data.type === "navigateToSlide") {
        navigate(`/slide${e.data.index}`);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return (
    <Switch>
      <Route path="/allslides" component={AllSlides} />
      {slides.map((slide, i) => (
        <Route
          key={slide.id}
          path={`/slide${i + 1}`}
          component={() => (
            <div className="w-screen h-screen overflow-hidden">
              <slide.Component />
            </div>
          )}
        />
      ))}
      <Route component={() => <VideoTemplate />} />
    </Switch>
  );
}
