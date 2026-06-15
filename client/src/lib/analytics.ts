/**
 * Google Analytics 4 integration.
 *
 * The measurement ID is read from VITE_GA4_MEASUREMENT_ID at build
 * time. Vite inlines values prefixed with VITE_ into the client bundle;
 * unprefixed env vars stay server-side, so we explicitly opt into
 * exposure here.
 *
 * If the ID isn't set (local dev, preview builds) the module turns
 * itself off — no script is loaded, no events fire. This keeps the
 * console clean and avoids polluting GA with dev traffic.
 *
 * Why not gtag's automatic pageview tracking: GA4's default page_view
 * fires once when the page initially loads. Wouter is a SPA router —
 * subsequent navigations are pushState calls the browser doesn't tell
 * GA about. We manually emit a page_view on every location change via
 * useAnalyticsPageviews().
 */

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const MEASUREMENT_ID = (import.meta.env.VITE_GA4_MEASUREMENT_ID as string | undefined)?.trim() || "";
const ENABLED = MEASUREMENT_ID.startsWith("G-");

let initialised = false;

/**
 * Inject the gtag.js loader and bootstrap the dataLayer. Safe to call
 * multiple times — the second call is a no-op. Returns the resolved
 * measurement ID (empty string if analytics is disabled).
 */
export function initAnalytics(): string {
  if (!ENABLED || initialised || typeof window === "undefined") return MEASUREMENT_ID;
  initialised = true;

  // Stub gtag immediately so calls made before the script loads queue
  // into the dataLayer. GA4's own snippet does the same — calls are
  // buffered and replayed once gtag.js finishes parsing.
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag("js", new Date());
  // send_page_view: false — we emit page_view ourselves on every route
  // change (including the initial one), to keep SPA navigations
  // accurate. Without this flag the initial paint would double-count.
  window.gtag("config", MEASUREMENT_ID, { send_page_view: false });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);

  return MEASUREMENT_ID;
}

/**
 * Send a SPA page_view event. Called once on the initial load and on
 * every subsequent wouter location change.
 */
export function trackPageview(path: string, title?: string) {
  if (!ENABLED || typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", "page_view", {
    page_path: path,
    page_location: window.location.href,
    page_title: title || document.title,
  });
}

/** Fire a custom event. Thin convenience over the dataLayer push so
 *  callers don't reach into window.gtag directly. */
export function trackEvent(name: string, params?: Record<string, unknown>) {
  if (!ENABLED || typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", name, params || {});
}

export const ANALYTICS_ENABLED = ENABLED;
