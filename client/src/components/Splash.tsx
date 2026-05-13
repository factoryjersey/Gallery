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

      {/* Logo overlay — colour swaps per slide */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          fontFamily: "Georgia, serif",
          fontSize: "clamp(48px, 9vw, 120px)",
          fontWeight: 400,
          letterSpacing: "0.04em",
          color: logoColour,
          transition: `color ${FADE_MS}ms ease`,
          textShadow: "0 2px 24px rgba(0,0,0,0.25)",
          userSelect: "none",
        }}
      >
        GALLERY
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
