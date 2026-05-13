import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ArticleWithDetails } from "@shared/schema";

// localStorage key + how long the splash stays "seen" before showing again
const STORAGE_KEY = "gallery-splash-seen";
const SEEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Logo colour palette — one per slide; cycles if more slides than colours
const LOGO_COLOURS = ["#ffffff", "hsl(182 55% 56%)", "#ffffff"];

// How long each slide stays on screen, and the cross-fade duration
const SLIDE_MS = 1600;
const FADE_MS = 800;

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

export default function Splash() {
  const [active, setActive] = useState<boolean>(() => shouldShow());
  const [index, setIndex] = useState(0);
  const [closing, setClosing] = useState(false);

  // Featured articles drive the slide images. The splash only renders once
  // at least 3 images are available; until then it stays hidden, so we
  // never flash an empty overlay.
  const { data } = useQuery<{ articles: ArticleWithDetails[] }>({
    queryKey: ["/api/articles/featured"],
    enabled: active,
  });

  const slides = (data?.articles || [])
    .filter((a) => !!a.featuredImage)
    .slice(0, 3);

  // Preload the chosen images so the cross-fades aren't visibly jank.
  useEffect(() => {
    if (!active || slides.length === 0) return;
    for (const s of slides) {
      if (!s.featuredImage) continue;
      const img = new Image();
      img.src = s.featuredImage;
    }
  }, [active, slides]);

  // Auto-advance through slides; close on the last one.
  useEffect(() => {
    if (!active || slides.length === 0) return;
    if (index >= slides.length) return;
    const t = window.setTimeout(() => {
      if (index === slides.length - 1) {
        setClosing(true);
        window.setTimeout(() => {
          markSeen();
          setActive(false);
        }, FADE_MS);
      } else {
        setIndex((i) => i + 1);
      }
    }, SLIDE_MS);
    return () => window.clearTimeout(t);
  }, [active, index, slides.length]);

  // Bail out silently if we shouldn't show, or no images loaded in time.
  if (!active) return null;
  if (slides.length < 3) return null;

  const current = slides[index];
  const logoColour = LOGO_COLOURS[index % LOGO_COLOURS.length];

  const handleSkip = () => {
    setClosing(true);
    window.setTimeout(() => {
      markSeen();
      setActive(false);
    }, FADE_MS);
  };

  return (
    <div
      role="dialog"
      aria-label="Welcome to Gallery"
      onClick={handleSkip}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "#000",
        cursor: "pointer",
        opacity: closing ? 0 : 1,
        transition: `opacity ${FADE_MS}ms ease`,
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
            transform: i === index ? "scale(1.04)" : "scale(1)",
            transition: `opacity ${FADE_MS}ms ease, transform ${SLIDE_MS + FADE_MS}ms ease-out`,
            opacity: i === index ? 1 : 0,
          }}
        />
      ))}

      {/* Logo overlay — colour swaps per slide. Inline SVG with currentColor
          so the per-slide colour tween still works, plus a slow scale-up
          so the wordmark feels alive across the intro. */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(70vw, 760px)",
          color: logoColour,
          filter: "drop-shadow(0 2px 24px rgba(0,0,0,0.25))",
          transition: `color ${FADE_MS}ms ease`,
          userSelect: "none",
          pointerEvents: "none",
        }}
      >
        <svg
          viewBox="0 0 972.24 130.4"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="Gallery"
          role="img"
          style={{
            display: "block",
            width: "100%",
            height: "auto",
            transform: `scale(${1 + index * 0.04})`,
            transition: `transform ${SLIDE_MS + FADE_MS}ms ease-out`,
          }}
        >
          <path
            fill="currentColor"
            d="M920.34,160a3.44,3.44,0,0,0,3.44,3.44h12a3.56,3.56,0,0,0,3.44-3.44V102.17L982.1,41.86a3.35,3.35,0,0,0-2.9-5.25H965.62a3.9,3.9,0,0,0-2.9,1.63L929.94,84.42,897.16,38.24a3.58,3.58,0,0,0-2.9-1.63h-13.4a3.35,3.35,0,0,0-2.9,5.25l42.38,60.49ZM757.88,98.19v-44h32.24c11.77,0,22.1,9.78,22.1,21.55a22.5,22.5,0,0,1-22.1,22.46Zm-19,61.76a3.43,3.43,0,0,0,3.44,3.44h11.77a3.56,3.56,0,0,0,3.44-3.44V113.76h27.35l24.09,48a3.34,3.34,0,0,0,2.89,1.63H826a3.43,3.43,0,0,0,3.08-5.25l-24.81-46C820,105.8,831.05,92,831.05,75.37c0-21.55-17.75-38.76-39.48-38.76H742.31a3.43,3.43,0,0,0-3.44,3.44ZM596,160a3.43,3.43,0,0,0,3.44,3.44h72.44A3.44,3.44,0,0,0,675.3,160V150a3.44,3.44,0,0,0-3.45-3.44H614.62V107.61H663a3.44,3.44,0,0,0,3.44-3.44V94A3.56,3.56,0,0,0,663,90.58H614.62V53.63h57.23a3.44,3.44,0,0,0,3.45-3.44V40.05a3.44,3.44,0,0,0-3.45-3.44H599.41A3.43,3.43,0,0,0,596,40.05Zm-126.6,0a3.44,3.44,0,0,0,3.44,3.44h64.48a3.44,3.44,0,0,0,3.44-3.44V150a3.44,3.44,0,0,0-3.44-3.44H488.2V40.05a3.56,3.56,0,0,0-3.44-3.44H472.81a3.44,3.44,0,0,0-3.44,3.44Zm-126.6,0a3.44,3.44,0,0,0,3.44,3.44h64.48a3.44,3.44,0,0,0,3.44-3.44V150a3.44,3.44,0,0,0-3.44-3.44H361.6V40.05a3.55,3.55,0,0,0-3.44-3.44h-12a3.44,3.44,0,0,0-3.44,3.44ZM206.39,120.29l22.1-49.63h.9l22.28,49.63Zm-33.69,43.1h11.41a4.55,4.55,0,0,0,4.17-2.72c3.62-8.33,7.42-16.48,11.05-24.81h59.22l11.23,24.81a4.23,4.23,0,0,0,4.17,2.72h11.41a3.2,3.2,0,0,0,3.08-4.71L233.2,36.79a4.25,4.25,0,0,0-3.08-2h-1.81a4.21,4.21,0,0,0-3.08,2L169.62,158.68a3.2,3.2,0,0,0,3.08,4.71M10.43,100.18a64.89,64.89,0,0,0,65.2,65,90.5,90.5,0,0,0,44.91-11.95,4.44,4.44,0,0,0,1.45-2.9c0-14.49-.18-29.34-.18-43.83a3.41,3.41,0,0,0-3.26-3.44h-33a3.33,3.33,0,0,0-3.44,3.44V117a3.29,3.29,0,0,0,3.44,3.26h17.75v20.28a63.84,63.84,0,0,1-27.17,6.16c-25.72,0-45.46-21.74-45.46-46.91,0-25.36,19.74-47.09,45.46-47.09,11,0,22.28,4.89,30.79,12.31,1.81,1.64,3.26,1.82,4.71.19,2.72-2.9,5.43-5.62,8.15-8.52a3.5,3.5,0,0,0-.18-5.07C107.32,41.14,93,34.8,75.63,34.8a65.2,65.2,0,0,0-65.2,65.38"
            transform="translate(-10.43 -34.8)"
          />
        </svg>
      </div>

      {/* Skip hint */}
      <div
        style={{
          position: "absolute",
          bottom: 24,
          right: 24,
          fontFamily: "Arial, sans-serif",
          fontSize: 11,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.7)",
        }}
      >
        Tap to skip
      </div>
    </div>
  );
}
