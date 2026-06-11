import { useEffect } from "react";

interface Meta {
  /** Page title — slots into <title> and og:title. Suffix with the site
   *  name handled internally so callers can pass the article title verbatim. */
  title?: string;
  /** Meta description / OG description. Truncated to ~200 chars for
   *  social shares (Twitter cuts ~160; we leave headroom). */
  description?: string;
  /** Absolute URL for og:image / twitter:image. */
  image?: string;
  /** Article publish date for article:published_time. ISO 8601. */
  publishedAt?: string;
  /** Author name for article:author. */
  author?: string;
  /** og:type — default "website", override to "article" on article pages. */
  type?: "website" | "article";
}

const SITE_NAME = "Gallery — Jersey's life & style magazine";
const DESC_LIMIT = 200;

/** Find or create a <meta> tag matching the supplied selector and set its
 *  content. Returns the element so callers can null it out on cleanup. */
function setMeta(selector: string, attr: "name" | "property", key: string, content: string): HTMLMetaElement {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
  return el;
}

function clearMeta(selector: string) {
  const el = document.head.querySelector<HTMLMetaElement>(selector);
  if (el && el.dataset.dynamic === "true") el.remove();
}

/**
 * Imperatively update <title> + meta description + Open Graph + Twitter
 * card tags for the current route. Lighter than react-helmet/etc — we
 * just mutate document.head on mount/effect, and restore the defaults on
 * unmount so the next route doesn't inherit stale tags.
 *
 * Crawlers running JavaScript (Googlebot, Bingbot, modern social-share
 * cards via tools like LinkedIn / Slack / Discord) will see the dynamic
 * values. Crawlers that don't run JS still see the index.html defaults,
 * which is better than nothing.
 */
export function useDocumentMeta({ title, description, image, publishedAt, author, type }: Meta) {
  useEffect(() => {
    // Title — suffix with site name unless it already contains "Gallery"
    const fullTitle = title
      ? title.toLowerCase().includes("gallery")
        ? title
        : `${title} — Gallery`
      : SITE_NAME;
    const prevTitle = document.title;
    document.title = fullTitle;

    // Truncated description for shares
    const desc = description ? description.slice(0, DESC_LIMIT).trim() : "";

    // Mark anything we touch with data-dynamic so cleanup only removes
    // tags we created (or repurposed); the static index.html defaults
    // stay put.
    const touched: HTMLMetaElement[] = [];
    const upsert = (sel: string, attr: "name" | "property", key: string, val: string) => {
      const el = setMeta(sel, attr, key, val);
      el.dataset.dynamic = "true";
      touched.push(el);
    };

    if (desc) {
      upsert('meta[name="description"]', "name", "description", desc);
      upsert('meta[property="og:description"]', "property", "og:description", desc);
      upsert('meta[name="twitter:description"]', "name", "twitter:description", desc);
    }
    upsert('meta[property="og:title"]', "property", "og:title", fullTitle);
    upsert('meta[name="twitter:title"]', "name", "twitter:title", fullTitle);
    upsert('meta[property="og:type"]', "property", "og:type", type || "website");
    if (image) {
      upsert('meta[property="og:image"]', "property", "og:image", image);
      upsert('meta[name="twitter:image"]', "name", "twitter:image", image);
      upsert('meta[name="twitter:card"]', "name", "twitter:card", "summary_large_image");
    }
    if (publishedAt) {
      upsert('meta[property="article:published_time"]', "property", "article:published_time", publishedAt);
    }
    if (author) {
      upsert('meta[property="article:author"]', "property", "article:author", author);
    }
    // Canonical link — the current URL with the current pathname. Strips
    // any hash / query so duplicate-content audits stay clean.
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", `${window.location.origin}${window.location.pathname}`);

    return () => {
      document.title = prevTitle;
      // Tags created by this hook get cleaned up so they don't leak
      // article-specific values onto the next route's view. The shell
      // defaults from index.html (which don't carry data-dynamic) stay.
      clearMeta('meta[name="description"]');
      clearMeta('meta[property="og:description"]');
      clearMeta('meta[name="twitter:description"]');
      clearMeta('meta[property="og:title"]');
      clearMeta('meta[name="twitter:title"]');
      clearMeta('meta[property="og:type"]');
      clearMeta('meta[property="og:image"]');
      clearMeta('meta[name="twitter:image"]');
      clearMeta('meta[name="twitter:card"]');
      clearMeta('meta[property="article:published_time"]');
      clearMeta('meta[property="article:author"]');
    };
  }, [title, description, image, publishedAt, author, type]);
}
