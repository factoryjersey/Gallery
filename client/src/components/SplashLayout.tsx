import { useEffect, useLayoutEffect, useRef, useState, createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ArticleWithDetails } from "@shared/schema";
import GalleryWordmark from "@/components/GalleryWordmark";

// localStorage key + how long the splash stays "seen" before showing again
const STORAGE_KEY = "gallery-splash-seen";
const SEEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Logo colour cycles per slide; falls back when there are more slides than colours
const LOGO_COLOURS = ["#ffffff", "hsl(182 55% 56%)", "#ffffff"];

// Per-slide duration, and the cross-phase reveal duration when the site rolls
// up over the slideshow and the wordmark morphs into the header.
const SLIDE_MS = 1800;
const FADE_MS = 800;
const REVEAL_MS = 1100;

type Phase = "playing" | "closing" | "done";

// Tiny context so the Header knows whether to render its own logo or stay
// quiet while the splash wordmark animates into its slot.
const SplashPhaseContext = createContext<Phase>("done");
export function useSplashPhase() {
  return useContext(SplashPhaseContext);
}

function shouldShow(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return true;
    const seenAt = parseInt(raw, 10);
    if (Number.isNaN(seenAt)) return true;
    return Date.now() - seenAt > SEEN_TTL_MS;
  } catch {
    return true;
  }
}

function markSeen() {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // ignore (private mode / storage disabled)
  }
}

interface SplashLayoutProps {
  children: React.ReactNode;
}

export default function SplashLayout({ children }: SplashLayoutProps) {
  const [phase, setPhase] = useState<Phase>(() => (shouldShow() ? "playing" : "done"));
  const [index, setIndex] = useState(0);
  const [targetBox, setTargetBox] = useState<{ x: number; y: number; w: number; h: number } | null>(
    null,
  );
  const stageRef = useRef<HTMLDivElement>(null);

  // Featured stories drive the slide images.
  const { data } = useQuery<{ articles: ArticleWithDetails[] }>({
    queryKey: ["/api/articles/featured"],
    enabled: phase !== "done",
  });

  const slides = (data?.articles || []).filter((a) => !!a.featuredImage).slice(0, 3);

  // Measure the header logo so the splash wordmark can morph into its slot.
  // The site stage is currently translated below the fold (translateY(100vh)),
  // so the measured Y is offset by viewport height — subtract it back to get
  // the natural position the header will sit at once the stage is at rest.
  useLayoutEffect(() => {
    if (phase === "done") return;
    const slot = document.querySelector('[data-testid="header-logo-slot"]') as HTMLElement | null;
    if (!slot) return;
    const r = slot.getBoundingClientRect();
    setTargetBox({
      x: r.left + r.width / 2,
      y: r.top - window.innerHeight + r.height / 2,
      w: r.width,
      h: r.height,
    });
  }, [phase, slides.length]);

  // Preload slide images so cross-fades don't visibly stall.
  useEffect(() => {
    if (phase === "done") return;
    for (const s of slides) {
      if (s.featuredImage) {
        const img = new Image();
        img.src = s.featuredImage;
      }
    }
  }, [phase, slides]);

  // Auto-advance through the slides; on the last one, kick off the close
  // transition (site rolls up + wordmark morphs into header).
  useEffect(() => {
    if (phase !== "playing" || slides.length < 3) return;
    const t = window.setTimeout(() => {
      if (index === slides.length - 1) {
        setPhase("closing");
        window.setTimeout(() => {
          markSeen();
          setPhase("done");
        }, REVEAL_MS);
      } else {
        setIndex((i) => i + 1);
      }
    }, SLIDE_MS);
    return () => window.clearTimeout(t);
  }, [phase, index, slides.length]);

  // Returning visitor: render the page normally, no splash, no transforms.
  if (phase === "done") {
    return (
      <SplashPhaseContext.Provider value="done">{children}</SplashPhaseContext.Provider>
    );
  }

  // Site stage: starts below the fold during play, rises up during close.
  // Once at rest it becomes static so the page scrolls/lays out normally.
  const stageTransform =
    phase === "playing" ? "translateY(100vh)" : "translateY(0)";

  // Wordmark: big-centred during play, shrunk to the header slot during close.
  // Falls back to centre while we wait for the header to mount and measure.
  const wordmarkStyle: React.CSSProperties = (() => {
    const playing = phase === "playing" || !targetBox;
    if (playing) {
      return {
        top: "50%",
        left: "50%",
        width: "min(70vw, 760px)",
        transform: "translate(-50%, -50%)",
      };
    }
    return {
      top: targetBox.y,
      left: targetBox.x,
      width: targetBox.w,
      transform: "translate(-50%, -50%)",
    };
  })();

  const logoColour = LOGO_COLOURS[index % LOGO_COLOURS.length];
  // During closing, blend toward the header's resting ink colour so the
  // wordmark settles into the page rather than landing as pure white text.
  const colourNow = phase === "closing" ? "hsl(0 0% 30%)" : logoColour;

  return (
    <SplashPhaseContext.Provider value={phase}>
      {/* Slideshow — fixed below the rising site stage */}
      <div
        role="dialog"
        aria-label="Welcome to Gallery"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 60,
          background: "#000",
          pointerEvents: phase === "playing" ? "auto" : "none",
        }}
        data-testid="splash"
      >
        {slides.map((s, i) => (
          <div
            key={s.id}
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url('${s.featuredImage}')`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              opacity: i === index && phase === "playing" ? 1 : i === index ? 1 : 0,
              transform: i === index ? "scale(1.04)" : "scale(1)",
              transition: `opacity ${FADE_MS}ms ease, transform ${SLIDE_MS + FADE_MS}ms ease-out`,
            }}
          />
        ))}
      </div>

      {/* Wordmark — animates from splash-centre into the header logo slot */}
      <div
        style={{
          position: "fixed",
          zIndex: 80,
          color: colourNow,
          filter:
            phase === "playing"
              ? "drop-shadow(0 2px 24px rgba(0,0,0,0.25))"
              : "none",
          pointerEvents: "none",
          transition: `top ${REVEAL_MS}ms cubic-bezier(.7,.0,.2,1), left ${REVEAL_MS}ms cubic-bezier(.7,.0,.2,1), width ${REVEAL_MS}ms cubic-bezier(.7,.0,.2,1), color ${FADE_MS}ms ease, filter ${REVEAL_MS}ms ease`,
          ...wordmarkStyle,
        }}
        data-testid="splash-wordmark"
      >
        <GalleryWordmark />
      </div>

      {/* Site stage — folds up over the slideshow during the close phase */}
      <div
        ref={stageRef}
        style={{
          transform: stageTransform,
          transition: `transform ${REVEAL_MS}ms cubic-bezier(.7,.0,.2,1)`,
          position: "relative",
          zIndex: 70,
          background: "var(--background, #fff)",
          minHeight: "100vh",
        }}
      >
        {children}
      </div>
    </SplashPhaseContext.Provider>
  );
}
