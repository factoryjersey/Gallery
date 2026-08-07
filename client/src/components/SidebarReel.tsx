import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

const SETTING_KEY = "sidebar.instagram-reel-url";
const EMBED_SCRIPT_SRC = "https://www.instagram.com/embed.js";

/**
 * Load Instagram's embed script once per page. Idempotent — if it's
 * already been added by an earlier mount, we just call the global
 * .process() to re-scan the DOM so newly-mounted blockquotes get
 * upgraded to the fancy embed. If the script isn't there yet, we
 * inject it — it self-scans on load.
 */
function ensureEmbedScript() {
  if (typeof window === "undefined") return;
  const w = window as any;
  if (w.instgrm?.Embeds?.process) {
    // Script already loaded — kick it to notice our new blockquote.
    w.instgrm.Embeds.process();
    return;
  }
  if (document.querySelector(`script[src="${EMBED_SCRIPT_SRC}"]`)) return;
  const s = document.createElement("script");
  s.src = EMBED_SCRIPT_SRC;
  s.async = true;
  document.body.appendChild(s);
}

/** Strip query strings / trailing slashes so IG's embed script gets a
 *  canonical permalink. Accepts either a full reel URL or a permalink
 *  shortcode; returns the canonical /reel/… form Instagram accepts. */
function normaliseReelUrl(raw: string): string | null {
  const url = raw.trim();
  if (!url) return null;
  try {
    const u = new URL(url);
    // Keep only the pathname — drops referral params like ?igsh=…
    return `${u.origin}${u.pathname.replace(/\/$/, "")}/`;
  } catch {
    return null;
  }
}

/**
 * Sidebar block that renders the editor's configured Instagram reel.
 * Sourced from site_settings.sidebar.instagram-reel-url — the admin
 * pastes a URL there and this component picks it up on next fetch.
 *
 * Renders nothing when no URL is set, or when the URL doesn't parse.
 * The Instagram embed itself is drawn by Meta's own script (loaded
 * once, lazily) so we always get whatever styling / video controls
 * Instagram ships right now.
 */
export default function SidebarReel() {
  const { data } = useQuery<{ key: string; value: string | null }>({
    queryKey: [`/api/settings/${SETTING_KEY}`],
  });
  const permalink = useMemo(() => (data?.value ? normaliseReelUrl(data.value) : null), [data]);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!permalink) return;
    ensureEmbedScript();
  }, [permalink]);

  if (!permalink) return null;

  return (
    <div data-testid="sidebar-instagram-reel">
      <div className="mb-5">
        <span className="gallery-section-label">On Instagram</span>
      </div>
      <div ref={wrapperRef}>
        {/* Instagram's canonical blockquote embed — their script scans
            for elements with class="instagram-media" + data-instgrm-
            permalink and rewrites them to the fancy iframe embed. */}
        <blockquote
          className="instagram-media"
          data-instgrm-permalink={permalink}
          data-instgrm-version="14"
          data-instgrm-captioned
          style={{
            background: "#FFF",
            border: 0,
            borderRadius: 0,
            boxShadow: "none",
            margin: 0,
            padding: 0,
            minWidth: 0,
            width: "100%",
          }}
        >
          <a href={permalink} target="_blank" rel="noopener noreferrer">
            View this reel on Instagram
          </a>
        </blockquote>
      </div>
    </div>
  );
}
